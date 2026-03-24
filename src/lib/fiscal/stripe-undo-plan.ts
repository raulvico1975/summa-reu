import type { Transaction } from '@/lib/data';
import type { Donation } from '@/lib/types/donations';

export interface StripeUndoChildRecord {
  id: string;
  data: Transaction;
}

export interface StripeUndoDonationRecord {
  id: string;
  data: Donation;
}

export interface StripeUndoPlanInput {
  parent: Pick<Transaction, 'isRemittance' | 'remittanceId' | 'stripeTransferId'>;
  children: StripeUndoChildRecord[];
  donations: StripeUndoDonationRecord[];
}

export interface StripeUndoPlan {
  archiveChildIds: string[];
  deleteChildIds: string[];
  archiveDonationIds: string[];
  hasStripeMarkers: boolean;
  shouldDeleteRemittance: boolean;
  shouldResetParent: boolean;
  isIdempotent: boolean;
}

function isActiveDonation(donation: Donation): boolean {
  return !donation.archivedAt;
}

function isFiscallyRelevantTransactionForUndo(tx: Transaction): boolean {
  if (tx.transactionType === 'return') {
    return true;
  }

  if (tx.source === 'remittance' && tx.amount > 0) {
    return true;
  }

  if (tx.source === 'stripe' && tx.transactionType === 'donation' && !!tx.contactId) {
    return true;
  }

  return false;
}

export function buildStripeUndoPlan({
  parent,
  children,
  donations,
}: StripeUndoPlanInput): StripeUndoPlan {
  const archiveChildIds: string[] = [];
  const deleteChildIds: string[] = [];

  for (const child of children) {
    if (child.data.archivedAt) continue;

    if (isFiscallyRelevantTransactionForUndo(child.data)) {
      archiveChildIds.push(child.id);
    } else {
      deleteChildIds.push(child.id);
    }
  }

  const archiveDonationIds = donations
    .filter((donation) => isActiveDonation(donation.data))
    .map((donation) => donation.id);

  const hasStripeMarkers = Boolean(
    parent.isRemittance ||
    parent.remittanceId ||
    parent.stripeTransferId
  );

  const hasUndoWork =
    archiveChildIds.length > 0 ||
    deleteChildIds.length > 0 ||
    archiveDonationIds.length > 0;

  return {
    archiveChildIds,
    deleteChildIds,
    archiveDonationIds,
    hasStripeMarkers,
    shouldDeleteRemittance: Boolean(parent.remittanceId),
    shouldResetParent: hasUndoWork || hasStripeMarkers,
    isIdempotent: !hasUndoWork && !hasStripeMarkers,
  };
}
