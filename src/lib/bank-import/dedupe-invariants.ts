import type { ClassifiedRow } from '@/lib/transaction-dedupe';

type ImportTx = ClassifiedRow['tx'];

export interface DedupeSearchRangeInput {
  date: string;
  operationDate?: string | null;
}

export interface DedupeSearchRangeOptions {
  toleranceDays?: number;
}

function toDateOnly(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const dateOnly = trimmed.split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
  return dateOnly;
}

/**
 * Contracte d'invariant d'importació:
 * - from = min(date, operationDate)
 * - to = max(date, operationDate)
 * - mai excloure el camp date del moviment.
 */
export function computeDedupeSearchRange(
  txs: DedupeSearchRangeInput[],
  options: DedupeSearchRangeOptions = {}
): { from: string; to: string } | null {
  const toleranceDays = Number.isInteger(options.toleranceDays) && (options.toleranceDays as number) > 0
    ? (options.toleranceDays as number)
    : 0;
  const values = txs
    .flatMap((tx) => {
      const date = toDateOnly(tx.date);
      const operationDate = toDateOnly(tx.operationDate);
      const dates: string[] = [];

      if (date) dates.push(date);
      if (operationDate && operationDate !== date) dates.push(operationDate);

      return dates;
    })
    .sort((a, b) => a.localeCompare(b));

  if (values.length === 0) return null;

  if (toleranceDays === 0) {
    return { from: values[0], to: values[values.length - 1] };
  }

  const fromDate = new Date(`${values[0]}T00:00:00.000Z`);
  const toDate = new Date(`${values[values.length - 1]}T00:00:00.000Z`);
  const dayMs = 24 * 60 * 60 * 1000;

  const fromWithTolerance = new Date(fromDate.getTime() - (toleranceDays * dayMs));
  const toWithTolerance = new Date(toDate.getTime() + (toleranceDays * dayMs));

  return {
    from: fromWithTolerance.toISOString().slice(0, 10),
    to: toWithTolerance.toISOString().slice(0, 10),
  };
}

export interface ImportSelectionResult {
  transactionsToImport: ImportTx[];
  stats: {
    duplicateSkippedCount: number;
    candidateCount: number;
    candidateUserImportedCount: number;
    candidateUserSkippedCount: number;
  };
}

/**
 * Invariant IMP-2:
 * - DUPLICATE_CANDIDATE és sempre heurístic.
 * - Només s'importa si hi ha opt-in explícit.
 */
export function buildImportSelection(
  classifiedResults: ClassifiedRow[],
  selectedCandidateIndexes: number[]
): ImportSelectionResult {
  const candidates = classifiedResults.filter((c) => c.status === 'DUPLICATE_CANDIDATE');
  const newTxs = classifiedResults.filter((c) => c.status === 'NEW');
  const safeDupes = classifiedResults.filter((c) => c.status === 'DUPLICATE_SAFE');

  const selectedSet = new Set(
    selectedCandidateIndexes.filter(
      (index) => Number.isInteger(index) && index >= 0 && index < candidates.length
    )
  );

  const candidatesToImport = candidates.filter((_, index) => selectedSet.has(index));

  return {
    transactionsToImport: [
      ...newTxs.map((c) => c.tx),
      ...candidatesToImport.map((c) => c.tx),
    ],
    stats: {
      duplicateSkippedCount: safeDupes.length,
      candidateCount: candidates.length,
      candidateUserImportedCount: candidatesToImport.length,
      candidateUserSkippedCount: candidates.length - candidatesToImport.length,
    },
  };
}
