import type { TransactionType } from '@/lib/data';
import { isFiscalDonationCandidate } from '@/lib/fiscal/is-fiscal-donation-candidate';

export type FiscalKind = 'donation' | 'non_fiscal' | 'pending_review';

export interface FiscalOracleTransaction {
  id: string;
  date: string;
  amount: number;
  category?: string | null;
  contactId?: string | null;
  contactType?: 'donor' | 'supplier' | 'employee';
  source?: 'bank' | 'remittance' | 'manual' | 'stripe';
  transactionType?: TransactionType;
  archivedAt?: string | null;
  fiscalKind?: FiscalKind | null;
}

export interface FiscalOracleMetrics {
  donorNet: number;
  total182: number;
  certificateNet: number;
  pendingExcludedCount: number;
}

export const FISCAL_ORACLE_DEMO_IDS = {
  donorId: 'demo_oracle_donor_001',
  donationTxId: 'demo_oracle_tx_donation_001',
  nonFiscalTxId: 'demo_oracle_tx_non_fiscal_001',
  pendingTxId: 'demo_oracle_tx_pending_001',
  returnWithDonorTxId: 'demo_oracle_tx_return_donor_001',
  returnWithoutDonorTxId: 'demo_oracle_tx_return_orphan_001',
  stripeLegacyTxId: 'demo_tx_stripe_don_001',
  remittanceLegacyTxId: 'demo_tx_sepa_in_line_001',
} as const;

export const FISCAL_ORACLE_AMOUNTS = {
  donation: 120,
  nonFiscal: 45,
  pending: 35,
  returnWithDonor: -20,
  returnWithoutDonor: -15,
  stripeLegacy: 25,
  remittanceLegacy: 10,
} as const;

export const FISCAL_ORACLE_EXPECTED: Readonly<FiscalOracleMetrics> = Object.freeze({
  donorNet: 125,
  total182: 125,
  certificateNet: 125,
  pendingExcludedCount: 2,
});

interface OracleFixtureInput {
  year: number;
  donationCategoryId: string;
  membershipFeeCategoryId: string;
  donorId?: string;
}

export function createFiscalOracleFixtureTransactions(input: OracleFixtureInput): FiscalOracleTransaction[] {
  const {
    year,
    donationCategoryId,
    membershipFeeCategoryId,
    donorId = FISCAL_ORACLE_DEMO_IDS.donorId,
  } = input;

  const baseDate = `${year}-07-`;

  return [
    {
      id: FISCAL_ORACLE_DEMO_IDS.donationTxId,
      date: `${baseDate}01`,
      amount: FISCAL_ORACLE_AMOUNTS.donation,
      category: donationCategoryId,
      contactId: donorId,
      contactType: 'donor',
      source: 'bank',
      transactionType: 'normal',
      fiscalKind: 'donation',
      archivedAt: null,
    },
    {
      id: FISCAL_ORACLE_DEMO_IDS.nonFiscalTxId,
      date: `${baseDate}02`,
      amount: FISCAL_ORACLE_AMOUNTS.nonFiscal,
      category: membershipFeeCategoryId,
      contactId: donorId,
      contactType: 'donor',
      source: 'bank',
      transactionType: 'normal',
      fiscalKind: 'non_fiscal',
      archivedAt: null,
    },
    {
      id: FISCAL_ORACLE_DEMO_IDS.pendingTxId,
      date: `${baseDate}03`,
      amount: FISCAL_ORACLE_AMOUNTS.pending,
      category: donationCategoryId,
      contactId: donorId,
      contactType: 'donor',
      source: 'bank',
      transactionType: 'normal',
      archivedAt: null,
    },
    {
      id: FISCAL_ORACLE_DEMO_IDS.returnWithDonorTxId,
      date: `${baseDate}04`,
      amount: FISCAL_ORACLE_AMOUNTS.returnWithDonor,
      category: donationCategoryId,
      contactId: donorId,
      contactType: 'donor',
      source: 'bank',
      transactionType: 'return',
      archivedAt: null,
    },
    {
      id: FISCAL_ORACLE_DEMO_IDS.returnWithoutDonorTxId,
      date: `${baseDate}05`,
      amount: FISCAL_ORACLE_AMOUNTS.returnWithoutDonor,
      category: donationCategoryId,
      contactType: 'donor',
      source: 'bank',
      transactionType: 'return',
      archivedAt: null,
    },
    {
      id: FISCAL_ORACLE_DEMO_IDS.stripeLegacyTxId,
      date: `${baseDate}06`,
      amount: FISCAL_ORACLE_AMOUNTS.stripeLegacy,
      category: donationCategoryId,
      contactId: donorId,
      contactType: 'donor',
      source: 'stripe',
      transactionType: 'donation',
      archivedAt: null,
    },
    {
      id: FISCAL_ORACLE_DEMO_IDS.remittanceLegacyTxId,
      date: `${baseDate}07`,
      amount: FISCAL_ORACLE_AMOUNTS.remittanceLegacy,
      category: membershipFeeCategoryId,
      contactId: donorId,
      contactType: 'donor',
      source: 'remittance',
      transactionType: 'normal',
      archivedAt: null,
    },
  ];
}

export function resolveEffectiveFiscalKind(tx: FiscalOracleTransaction): FiscalKind {
  if (tx.fiscalKind === 'donation' || tx.fiscalKind === 'non_fiscal' || tx.fiscalKind === 'pending_review') {
    return tx.fiscalKind;
  }

  if (isFiscalDonationCandidate(tx)) {
    return 'donation';
  }

  if (
    tx.transactionType === 'return' ||
    tx.transactionType === 'return_fee' ||
    tx.transactionType === 'fee'
  ) {
    return 'non_fiscal';
  }

  return 'pending_review';
}

function sameYear(isoDate: string, year: number): boolean {
  return isoDate.startsWith(String(year));
}

export function calculateFiscalOracleMetrics(
  transactions: FiscalOracleTransaction[],
  year: number,
  donorId: string = FISCAL_ORACLE_DEMO_IDS.donorId
): FiscalOracleMetrics {
  const donorTotals = new Map<string, { donations: number; returns: number }>();
  let pendingExcludedCount = 0;

  const addDonorTotals = (contactId: string, donationDelta: number, returnDelta: number) => {
    const current = donorTotals.get(contactId) ?? { donations: 0, returns: 0 };
    current.donations += donationDelta;
    current.returns += returnDelta;
    donorTotals.set(contactId, current);
  };

  for (const tx of transactions) {
    if (tx.archivedAt) continue;
    if (!sameYear(tx.date, year)) continue;

    const effectiveFiscalKind = resolveEffectiveFiscalKind(tx);

    if (
      effectiveFiscalKind === 'donation' &&
      !!tx.contactId &&
      tx.amount > 0
    ) {
      addDonorTotals(tx.contactId, tx.amount, 0);
      continue;
    }

    if (
      tx.transactionType === 'return' &&
      !!tx.contactId &&
      tx.amount < 0
    ) {
      addDonorTotals(tx.contactId, 0, tx.amount);
      continue;
    }

    if (
      effectiveFiscalKind === 'pending_review' &&
      !!tx.contactId &&
      tx.amount > 0
    ) {
      pendingExcludedCount += 1;
    }
  }

  const donorTotalsEntry = donorTotals.get(donorId) ?? { donations: 0, returns: 0 };
  const donorNet = donorTotalsEntry.donations + donorTotalsEntry.returns;

  let total182 = 0;
  for (const totals of donorTotals.values()) {
    const donorNetFor182 = totals.donations + totals.returns;
    if (donorNetFor182 > 0) {
      total182 += donorNetFor182;
    }
  }

  return {
    donorNet,
    total182,
    certificateNet: donorNet,
    pendingExcludedCount,
  };
}

export function diffFiscalOracle(
  actual: FiscalOracleMetrics,
  expected: FiscalOracleMetrics = FISCAL_ORACLE_EXPECTED
): string[] {
  const diffs: string[] = [];

  const compareField = (field: keyof FiscalOracleMetrics) => {
    if (actual[field] !== expected[field]) {
      diffs.push(`${field}: expected=${expected[field]} actual=${actual[field]}`);
    }
  };

  compareField('donorNet');
  compareField('total182');
  compareField('certificateNet');
  compareField('pendingExcludedCount');

  return diffs;
}
