import { calculateDonorNet } from '@/lib/fiscal/calculateDonorNet';
import { isFiscalDonationCandidate } from '@/lib/fiscal/is-fiscal-donation-candidate';
import { buildCanonicalFiscalContributions } from '@/lib/fiscal/canonical-fiscal-contributions';

export interface DonorSummaryTransaction {
  id?: string;
  amount: number;
  date: string;
  transactionType?: string;
  donationStatus?: string;
  linkedTransactionId?: string | null;
  archivedAt?: string | null;
  isSplit?: boolean;
  isRemittance?: boolean;
  note?: string | null;
  description?: string | null;
  contactId?: string | null;
}

export interface DonorSummaryReturnItem {
  id: string;
  date: string;
  amount: number;
  description: string;
}

export interface DonorSummaryResult {
  totalHistoric: number;
  totalHistoricCount: number;
  currentYear: number;
  currentYearCount: number;
  lastDonationDate: string | null;
  returns: {
    count: number;
    amount: number;
    lastDate: string | null;
    items: DonorSummaryReturnItem[];
  };
  currentYearGross: number;
  currentYearReturned: number;
  currentYearNet: number;
  previousYear: number;
  previousYearCount: number;
  previousYearGross: number;
  previousYearReturned: number;
  previousYearNet: number;
  includedDonationIds: string[];
  includedReturnIds: string[];
  effectiveReturnIds: string[];
  validDonationsCount: number;
  currentYearDonationCandidatesCount: number;
  excludedIdsByReason: Record<string, string[]>;
  scopeYear: number;
  scopeDonorId: string;
  datasetFingerprint: string;
}

export interface DonorSummaryInput {
  transactions: DonorSummaryTransaction[];
  donorId: string;
  year: number;
}

export function getDonorSummaryTransactionKey(tx: DonorSummaryTransaction): string {
  if (tx.id && tx.id.trim().length > 0) {
    return tx.id;
  }

  const transactionType = tx.transactionType ?? '';
  const donationStatus = tx.donationStatus ?? '';
  const linkedTransactionId = tx.linkedTransactionId ?? '';
  const contactId = tx.contactId ?? '';
  const archivedFlag = tx.archivedAt ? 'archived' : '';
  const splitFlag = tx.isSplit ? 'split' : '';
  const remittanceFlag = tx.isRemittance ? 'remit' : '';
  return `noid:${tx.date}:${tx.amount}:${transactionType}:${donationStatus}:${linkedTransactionId}:${contactId}:${archivedFlag}:${splitFlag}:${remittanceFlag}`;
}

export function buildDonorSummaryDatasetFingerprint(input: DonorSummaryInput): string {
  const txIds = input.transactions
    .map(tx => getDonorSummaryTransactionKey(tx))
    .sort();

  return `${input.donorId}|${input.year}|${txIds.join(',')}`;
}

export function isDrawerDonationCandidate(tx: Pick<DonorSummaryTransaction, 'amount' | 'transactionType' | 'archivedAt' | 'isSplit'>): boolean {
  return tx.amount > 0 && isFiscalDonationCandidate(tx);
}

export function isDrawerReturnCandidate(tx: Pick<DonorSummaryTransaction, 'amount' | 'transactionType' | 'donationStatus'>): boolean {
  return (tx.amount < 0 && tx.transactionType === 'return') ||
    (tx.amount > 0 && tx.donationStatus === 'returned');
}

function isNegativeReturnTransaction(tx: Pick<DonorSummaryTransaction, 'amount' | 'transactionType'>): boolean {
  return tx.amount < 0 && tx.transactionType === 'return';
}

function isReturnedDonationTransaction(tx: Pick<DonorSummaryTransaction, 'amount' | 'donationStatus'>): boolean {
  return tx.amount > 0 && tx.donationStatus === 'returned';
}

export function createEmptyDonorSummary(input: DonorSummaryInput): DonorSummaryResult {
  return {
    totalHistoric: 0,
    totalHistoricCount: 0,
    currentYear: 0,
    currentYearCount: 0,
    lastDonationDate: null,
    returns: { count: 0, amount: 0, lastDate: null, items: [] },
    currentYearGross: 0,
    currentYearReturned: 0,
    currentYearNet: 0,
    previousYear: 0,
    previousYearCount: 0,
    previousYearGross: 0,
    previousYearReturned: 0,
    previousYearNet: 0,
    includedDonationIds: [],
    includedReturnIds: [],
    effectiveReturnIds: [],
    validDonationsCount: 0,
    currentYearDonationCandidatesCount: 0,
    excludedIdsByReason: {
      nonPositiveAmount: [],
      archived: [],
      splitParent: [],
      notFiscalDonationCandidate: [],
    },
    scopeYear: input.year,
    scopeDonorId: input.donorId,
    datasetFingerprint: buildDonorSummaryDatasetFingerprint(input),
  };
}

export function calculateDonorSummary(input: DonorSummaryInput): DonorSummaryResult {
  if (!input.transactions || input.transactions.length === 0) {
    return createEmptyDonorSummary({ ...input, transactions: [] });
  }

  const canonicalContributions = buildCanonicalFiscalContributions(input.transactions);
  const canonicalAmountByIndex = new Map<number, number>();

  for (const contribution of canonicalContributions.contributions) {
    canonicalAmountByIndex.set(contribution.sourceIndex, contribution.canonicalAmount);
  }

  const currentYearStr = String(input.year);
  const previousYear = input.year - 1;
  const previousYearStr = String(previousYear);

  let totalHistoric = 0;
  let totalHistoricCount = 0;
  let currentYearTotal = 0;
  let currentYearCount = 0;
  let lastDonationDate: string | null = null;
  let returnsCount = 0;
  let returnsAmount = 0;
  let lastReturnDate: string | null = null;
  const returnItems: DonorSummaryReturnItem[] = [];

  let previousYearTotal = 0;
  let previousYearCount = 0;

  const includedDonationIds: string[] = [];
  const includedReturnIds: string[] = [];
  const effectiveReturnIds: string[] = [];
  const excludedIdsByReason: Record<string, string[]> = {
    nonPositiveAmount: [],
    archived: [],
    splitParent: [],
    notFiscalDonationCandidate: [],
  };
  const transactionsById = new Map<string, DonorSummaryTransaction>();
  const linkedDonationIdsFromNegativeReturns = new Set<string>();

  input.transactions.forEach((tx) => {
    if (tx.id && tx.id.trim().length > 0) {
      transactionsById.set(tx.id, tx);
    }
    if (isNegativeReturnTransaction(tx) && tx.linkedTransactionId) {
      linkedDonationIdsFromNegativeReturns.add(tx.linkedTransactionId);
    }
  });

  input.transactions.forEach((tx, sourceIndex) => {
    const txKey = getDonorSummaryTransactionKey(tx);

    if (isDrawerDonationCandidate(tx)) {
      totalHistoric += tx.amount;
      totalHistoricCount++;

      if (tx.date.startsWith(currentYearStr)) {
        currentYearTotal += tx.amount;
        currentYearCount++;
      }

      if (tx.date.startsWith(previousYearStr)) {
        previousYearTotal += tx.amount;
        previousYearCount++;
      }

      if (!lastDonationDate || tx.date > lastDonationDate) {
        lastDonationDate = tx.date;
      }
    } else {
      // Traçabilitat d'exclusions del còmput legacy de donacions del drawer
      if (tx.amount <= 0) {
        excludedIdsByReason.nonPositiveAmount.push(txKey);
      }
      if (tx.archivedAt) {
        excludedIdsByReason.archived.push(txKey);
      }
      if (tx.isSplit) {
        excludedIdsByReason.splitParent.push(txKey);
      }
      if (!isFiscalDonationCandidate(tx)) {
        excludedIdsByReason.notFiscalDonationCandidate.push(txKey);
      }
    }

    if (isDrawerReturnCandidate(tx)) {
      let isEffectiveReturn = true;
      if (isReturnedDonationTransaction(tx)) {
        const directlyLinkedTransaction = tx.linkedTransactionId
          ? transactionsById.get(tx.linkedTransactionId)
          : undefined;
        const hasDirectLinkedNegativeReturn = !!(
          directlyLinkedTransaction &&
          isNegativeReturnTransaction(directlyLinkedTransaction)
        );
        const hasReverseLinkedNegativeReturn = !!(
          tx.id &&
          linkedDonationIdsFromNegativeReturns.has(tx.id)
        );
        if (hasDirectLinkedNegativeReturn || hasReverseLinkedNegativeReturn) {
          isEffectiveReturn = false;
        }
      }

      if (isEffectiveReturn) {
        effectiveReturnIds.push(txKey);
        returnsCount++;
        returnsAmount += Math.abs(tx.amount);

        if (!lastReturnDate || tx.date > lastReturnDate) {
          lastReturnDate = tx.date;
        }

        returnItems.push({
          id: txKey,
          date: tx.date,
          amount: Math.abs(tx.amount),
          description: tx.note || tx.description || '',
        });
      }
    }

    // IDs inclosos en còmput fiscal net: mateix criteri que calculateDonorNet/model182
    if (tx.contactId === input.donorId && tx.date.startsWith(currentYearStr)) {
      const netAmount = canonicalAmountByIndex.get(sourceIndex) ?? 0;
      if (netAmount > 0) {
        includedDonationIds.push(txKey);
      }
      if (netAmount < 0) {
        includedReturnIds.push(txKey);
      }
    }
  });

  returnItems.sort((a, b) => b.date.localeCompare(a.date));
  const recentReturns = returnItems.slice(0, 5);

  const currentYearNetResult = calculateDonorNet({
    transactions: input.transactions,
    donorId: input.donorId,
    year: input.year,
  });

  const previousYearNetResult = calculateDonorNet({
    transactions: input.transactions,
    donorId: input.donorId,
    year: previousYear,
  });

  return {
    totalHistoric,
    totalHistoricCount,
    currentYear: currentYearTotal,
    currentYearCount,
    lastDonationDate,
    returns: {
      count: returnsCount,
      amount: returnsAmount,
      lastDate: lastReturnDate,
      items: recentReturns,
    },
    currentYearGross: currentYearNetResult.grossDonationsCents / 100,
    currentYearReturned: Math.abs(currentYearNetResult.returnsCents) / 100,
    currentYearNet: Math.max(0, currentYearNetResult.netCents / 100),
    previousYear: previousYearTotal,
    previousYearCount,
    previousYearGross: previousYearNetResult.grossDonationsCents / 100,
    previousYearReturned: Math.abs(previousYearNetResult.returnsCents) / 100,
    previousYearNet: Math.max(0, previousYearNetResult.netCents / 100),
    includedDonationIds,
    includedReturnIds,
    effectiveReturnIds,
    validDonationsCount: includedDonationIds.length,
    currentYearDonationCandidatesCount: currentYearCount,
    excludedIdsByReason,
    scopeYear: input.year,
    scopeDonorId: input.donorId,
    datasetFingerprint: buildDonorSummaryDatasetFingerprint(input),
  };
}
