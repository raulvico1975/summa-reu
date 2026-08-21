import type { Transaction } from '@/lib/data';

type CanonicalFiscalInputTransaction = {
  id?: string;
  date: string;
  contactId?: string | null;
  amount: number;
  transactionType?: string;
  donationStatus?: string;
  linkedTransactionId?: string | null;
  archivedAt?: string | null;
  isSplit?: boolean;
  isRemittance?: boolean;
};

export interface CanonicalFiscalContribution<T extends CanonicalFiscalInputTransaction = Transaction> {
  sourceIndex: number;
  tx: T;
  canonicalAmount: number;
}

export interface CanonicalFiscalContributionsResult<T extends CanonicalFiscalInputTransaction = Transaction> {
  contributions: Array<CanonicalFiscalContribution<T>>;
  pairedReturnedDonationIndexes: Set<number>;
  pairedReturnIndexes: Set<number>;
}

function isArchivedOrExcluded(tx: CanonicalFiscalInputTransaction): boolean {
  return !!(tx.archivedAt || tx.isSplit || tx.isRemittance);
}

function isRegularDonationCandidate(tx: CanonicalFiscalInputTransaction): boolean {
  return (
    !isArchivedOrExcluded(tx) &&
    Number.isFinite(tx.amount) &&
    tx.amount > 0 &&
    tx.transactionType === 'donation' &&
    tx.donationStatus !== 'returned'
  );
}

function isReturnedDonationCandidate(tx: CanonicalFiscalInputTransaction): boolean {
  return (
    !isArchivedOrExcluded(tx) &&
    Number.isFinite(tx.amount) &&
    tx.amount > 0 &&
    tx.transactionType === 'donation' &&
    tx.donationStatus === 'returned'
  );
}

function isReturnCandidate(tx: CanonicalFiscalInputTransaction): boolean {
  return (
    !isArchivedOrExcluded(tx) &&
    Number.isFinite(tx.amount) &&
    tx.amount < 0 &&
    tx.transactionType === 'return'
  );
}

/**
 * Construeix l'import efectiu de cada apunt fiscal, evitant dobles còmputs de devolucions
 * quan existeix parella explícita:
 *   - donationStatus='returned' + transactionType='return' vinculades per linkedTransactionId.
 */
export function buildCanonicalFiscalContributions<T extends CanonicalFiscalInputTransaction>(
  transactions: readonly T[]
): CanonicalFiscalContributionsResult<T> {
  const returnIndexesById = new Map<string, number>();
  const returnedDonationIndexesById = new Map<string, number>();
  const returnIndexesByLinkedDonationId = new Map<string, number[]>();

  const pairedReturnedDonationIndexes = new Set<number>();
  const pairedReturnIndexes = new Set<number>();

  transactions.forEach((tx, index) => {
    if (!isRegularDonationCandidate(tx) && !isReturnedDonationCandidate(tx) && !isReturnCandidate(tx)) {
      return;
    }

    if (isReturnCandidate(tx) && tx.id) {
      returnIndexesById.set(tx.id, index);
      const linkedDonationId = tx.linkedTransactionId?.trim();
      if (linkedDonationId) {
        const current = returnIndexesByLinkedDonationId.get(linkedDonationId) ?? [];
        current.push(index);
        returnIndexesByLinkedDonationId.set(linkedDonationId, current);
      }
    }

    if (isReturnedDonationCandidate(tx) && tx.id) {
      returnedDonationIndexesById.set(tx.id, index);
    }
  });

  transactions.forEach((tx, returnedDonationIndex) => {
    if (!isReturnedDonationCandidate(tx) || !tx.id) {
      return;
    }

    const linkedReturnIndex = tx.linkedTransactionId?.trim()
      ? returnIndexesById.get(tx.linkedTransactionId.trim())
      : undefined;
    const reverseReturnIndexes = returnIndexesByLinkedDonationId.get(tx.id) ?? [];

    if (linkedReturnIndex !== undefined) {
      pairedReturnedDonationIndexes.add(returnedDonationIndex);
      pairedReturnIndexes.add(linkedReturnIndex);
    }

    for (const returnIndex of reverseReturnIndexes) {
      pairedReturnedDonationIndexes.add(returnedDonationIndex);
      pairedReturnIndexes.add(returnIndex);
    }
  });

  transactions.forEach((tx, returnIndex) => {
    if (!isReturnCandidate(tx) || !tx.linkedTransactionId?.trim()) {
      return;
    }

    const returnedDonationIndex = returnedDonationIndexesById.get(tx.linkedTransactionId.trim());
    if (returnedDonationIndex !== undefined) {
      pairedReturnIndexes.add(returnIndex);
      pairedReturnedDonationIndexes.add(returnedDonationIndex);
    }
  });

  const contributions = transactions.map((tx, sourceIndex) => {
    if (isRegularDonationCandidate(tx)) {
      return {
        sourceIndex,
        tx,
        canonicalAmount: tx.amount,
      };
    }

    if (isReturnedDonationCandidate(tx)) {
      return {
        sourceIndex,
        tx,
        canonicalAmount: pairedReturnedDonationIndexes.has(sourceIndex) ? 0 : -Math.abs(tx.amount),
      };
    }

    if (isReturnCandidate(tx)) {
      return {
        sourceIndex,
        tx,
        canonicalAmount: -Math.abs(tx.amount),
      };
    }

    return {
      sourceIndex,
      tx,
      canonicalAmount: 0,
    };
  });

  return {
    contributions,
    pairedReturnedDonationIndexes,
    pairedReturnIndexes,
  };
}
