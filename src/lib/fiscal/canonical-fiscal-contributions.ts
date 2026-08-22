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

function normalizeLinkedTransactionId(linkedTransactionId?: string | null): string | null {
  if (!linkedTransactionId) return null;
  const trimmed = linkedTransactionId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeAmountCents(amount: number): number {
  return Math.round(Math.abs(amount) * 100);
}

function canonicalReturnPairingKey(tx: CanonicalFiscalInputTransaction): string | null {
  const contactId = tx.contactId?.trim();
  if (!contactId || !tx.date) {
    return null;
  }

  const dateKey = tx.date.slice(0, 10);
  return `${contactId}|${dateKey}|${normalizeAmountCents(tx.amount)}`;
}

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
 * Construeix l'import efectiu de cada apunt fiscal.
 *
 * Una donació positiva marcada com a `returned` no és una segona devolució: és
 * l'aportació fallida i, per tant, no és certificable. Quan també existeix el
 * moviment bancari negatiu que representa el mateix retorn, tots dos apunts
 * formen una sola parella operativa amb efecte fiscal total zero.
 *
 * Una devolució negativa sense parella continua restant una sola vegada perquè
 * pot correspondre a una donació que ja havia estat comptabilitzada abans.
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
      const linkedDonationId = normalizeLinkedTransactionId(tx.linkedTransactionId);
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

    const linkedReturnId = normalizeLinkedTransactionId(tx.linkedTransactionId);
    const linkedReturnIndex = linkedReturnId
      ? returnIndexesById.get(linkedReturnId)
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

    const linkedDonationId = normalizeLinkedTransactionId(tx.linkedTransactionId);
    const returnedDonationIndex = linkedDonationId
      ? returnedDonationIndexesById.get(linkedDonationId)
      : undefined;
    if (returnedDonationIndex !== undefined) {
      pairedReturnIndexes.add(returnIndex);
      pairedReturnedDonationIndexes.add(returnedDonationIndex);
    }
  });

  // Casos de dades legacy o imports sense link explícit:
  // si coincideixen per donant + data + import exacte, emparella un-a-un.
  const unpairedReturnedByKey = new Map<string, number[]>();
  const unpairedReturnsByKey = new Map<string, number[]>();

  transactions.forEach((tx, index) => {
    if (isReturnedDonationCandidate(tx) && !pairedReturnedDonationIndexes.has(index)) {
      const key = canonicalReturnPairingKey(tx);
      if (key) {
        const current = unpairedReturnedByKey.get(key) ?? [];
        current.push(index);
        unpairedReturnedByKey.set(key, current);
      }
    }

    if (isReturnCandidate(tx) && !pairedReturnIndexes.has(index)) {
      const key = canonicalReturnPairingKey(tx);
      if (key) {
        const current = unpairedReturnsByKey.get(key) ?? [];
        current.push(index);
        unpairedReturnsByKey.set(key, current);
      }
    }
  });

  for (const [key, returnedIndexes] of unpairedReturnedByKey.entries()) {
    const returnIndexes = unpairedReturnsByKey.get(key);
    if (!returnIndexes || returnIndexes.length === 0) {
      continue;
    }

    const pairCount = Math.min(returnedIndexes.length, returnIndexes.length);
    for (let i = 0; i < pairCount; i++) {
      pairedReturnedDonationIndexes.add(returnedIndexes[i]);
      pairedReturnIndexes.add(returnIndexes[i]);
    }
  }

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
        canonicalAmount: 0,
      };
    }

    if (isReturnCandidate(tx)) {
      return {
        sourceIndex,
        tx,
        canonicalAmount: pairedReturnIndexes.has(sourceIndex) ? 0 : -Math.abs(tx.amount),
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
