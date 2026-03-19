import {
  collection,
  getDocs,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';

import type { Transaction } from '@/lib/data';
import type { Donation } from '@/lib/types/donations';

type FirestoreDocLike<TData = Record<string, unknown>> = {
  id: string;
  data: () => TData;
};

type FirestoreSnapshotLike<TData = Record<string, unknown>> = {
  docs: Array<FirestoreDocLike<TData>>;
};

type AdminQueryLike<TData = Record<string, unknown>> = {
  where: (field: string, op: '==' | '>=' | '<=', value: unknown) => AdminQueryLike<TData>;
  get: () => Promise<FirestoreSnapshotLike<TData>>;
};

type AdminDbLike = {
  collection: (path: string) => AdminQueryLike<Record<string, unknown>>;
};

export interface UnifiedFiscalFilters {
  contactId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

function isArchived(value: string | null | undefined): boolean {
  return value != null && value !== '';
}

function isRelevantTransaction(tx: Transaction): boolean {
  if (!tx.contactId) return false;
  if (isArchived(tx.archivedAt)) return false;

  if (tx.amount > 0 && tx.transactionType === 'donation') {
    return true;
  }

  if (tx.amount < 0 && tx.transactionType === 'return') {
    return true;
  }

  if (tx.amount > 0 && tx.donationStatus === 'returned') {
    return true;
  }

  return false;
}

function getDonationAmount(donation: Donation): number {
  if (typeof donation.amountGross === 'number' && Number.isFinite(donation.amountGross)) {
    return donation.amountGross;
  }

  if (typeof donation.amount === 'number' && Number.isFinite(donation.amount)) {
    return donation.amount;
  }

  return 0;
}

function isRelevantDonation(donation: Donation): boolean {
  if (donation.type !== 'donation') return false;
  if (!donation.contactId) return false;
  if (isArchived(donation.archivedAt)) return false;
  return getDonationAmount(donation) > 0;
}

function mapDonationToTransaction(donation: Donation): Transaction {
  return {
    id: donation.id ?? donation.stripePaymentId ?? donation.parentTransactionId ?? donation.date,
    date: donation.date,
    description: donation.description ?? 'Stripe donation',
    note: donation.description ?? null,
    amount: getDonationAmount(donation),
    category: null,
    document: null,
    contactId: donation.contactId ?? null,
    contactType: 'donor',
    transactionType: 'donation',
    source: 'stripe',
    parentTransactionId: donation.parentTransactionId ?? null,
    stripePaymentId: donation.stripePaymentId ?? null,
    stripeTransferId: donation.stripeTransferId ?? null,
    archivedAt: donation.archivedAt ?? null,
  };
}

function sortUnifiedFiscalTransactions(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((left, right) => {
    if (left.date !== right.date) {
      return right.date.localeCompare(left.date);
    }

    return (right.id ?? '').localeCompare(left.id ?? '');
  });
}

export function mergeUnifiedFiscalDonations(input: {
  transactions: Transaction[];
  donations: Donation[];
}): Transaction[] {
  const mappedDonations = input.donations
    .filter(isRelevantDonation)
    .map(mapDonationToTransaction);

  const donationStripeIds = new Set(
    mappedDonations
      .map((donation) => donation.stripePaymentId)
      .filter((stripePaymentId): stripePaymentId is string => !!stripePaymentId)
  );

  const relevantTransactions = input.transactions
    .filter(isRelevantTransaction)
    .filter((tx) => {
      if (
        tx.source === 'stripe' &&
        tx.transactionType === 'donation' &&
        tx.stripePaymentId &&
        donationStripeIds.has(tx.stripePaymentId)
      ) {
        return false;
      }

      return true;
    });

  return sortUnifiedFiscalTransactions([
    ...relevantTransactions,
    ...mappedDonations,
  ]);
}

function applyAdminFilters<TData extends Record<string, unknown>>(
  source: AdminQueryLike<TData>,
  filters: UnifiedFiscalFilters
): AdminQueryLike<TData> {
  let current = source;

  if (filters.contactId) {
    current = current.where('contactId', '==', filters.contactId);
  }
  if (filters.dateFrom) {
    current = current.where('date', '>=', filters.dateFrom);
  }
  if (filters.dateTo) {
    current = current.where('date', '<=', filters.dateTo);
  }

  return current;
}

export async function getUnifiedFiscalDonationsWithAdmin(input: {
  db: AdminDbLike;
  organizationId: string;
  filters?: UnifiedFiscalFilters;
}): Promise<Transaction[]> {
  const { db, organizationId, filters = {} } = input;

  const transactionsQuery = applyAdminFilters(
    db.collection(`organizations/${organizationId}/transactions`),
    filters
  );
  const donationsQuery = applyAdminFilters(
    db.collection(`organizations/${organizationId}/donations`),
    filters
  );

  const [transactionsSnapshot, donationsSnapshot] = await Promise.all([
    transactionsQuery.get(),
    donationsQuery.get(),
  ]);

  const transactions = transactionsSnapshot.docs.map((docSnap) => ({
    ...(docSnap.data() as Transaction),
    id: docSnap.id,
  }));
  const donations = donationsSnapshot.docs.map((docSnap) => ({
    ...((docSnap.data() as unknown) as Donation),
    id: docSnap.id,
  }));

  return mergeUnifiedFiscalDonations({ transactions, donations });
}

export async function getUnifiedFiscalDonationsWithClient(input: {
  firestore: Firestore;
  organizationId: string;
  filters?: UnifiedFiscalFilters;
}): Promise<Transaction[]> {
  const { firestore, organizationId, filters = {} } = input;

  const transactionsRef = collection(firestore, 'organizations', organizationId, 'transactions');
  const donationsRef = collection(firestore, 'organizations', organizationId, 'donations');

  const transactionConstraints = [];
  const donationConstraints = [];

  if (filters.contactId) {
    transactionConstraints.push(where('contactId', '==', filters.contactId));
    donationConstraints.push(where('contactId', '==', filters.contactId));
  }
  if (filters.dateFrom) {
    transactionConstraints.push(where('date', '>=', filters.dateFrom));
    donationConstraints.push(where('date', '>=', filters.dateFrom));
  }
  if (filters.dateTo) {
    transactionConstraints.push(where('date', '<=', filters.dateTo));
    donationConstraints.push(where('date', '<=', filters.dateTo));
  }

  const [transactionsSnapshot, donationsSnapshot] = await Promise.all([
    getDocs(query(transactionsRef, ...transactionConstraints)),
    getDocs(query(donationsRef, ...donationConstraints)),
  ]);

  const transactions = transactionsSnapshot.docs.map((docSnap) => ({
    ...(docSnap.data() as Transaction),
    id: docSnap.id,
  }));
  const donations = donationsSnapshot.docs.map((docSnap) => ({
    ...((docSnap.data() as unknown) as Donation),
    id: docSnap.id,
  }));

  return mergeUnifiedFiscalDonations({ transactions, donations });
}
