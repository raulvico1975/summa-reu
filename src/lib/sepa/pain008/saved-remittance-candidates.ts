import type { SepaCollectionRunHistorySummary } from './run-history';

const MAX_AMOUNT_DIFF_CENTS = 2;
const STRONG_DATE_WINDOW_DAYS = 7;

export type SavedRemittanceCandidateReason = 'missing_bank_account' | 'no_clear_match' | null;
export type SavedRemittanceSelectionReason =
  | 'missing_transaction_bank_account'
  | 'bank_account_mismatch'
  | 'amount_mismatch'
  | null;

export interface SavedRemittanceCandidate extends SepaCollectionRunHistorySummary {
  amountDiffCents: number;
  dateDiffDays: number | null;
  sameBankAccount: true;
  isStrongMatch: boolean;
}

export interface RankSavedRemittanceCandidatesInput {
  transaction: {
    bankAccountId: string | null | undefined;
    amount: number;
    date: string | null | undefined;
  };
  runs: SepaCollectionRunHistorySummary[];
}

export interface RankedSavedRemittanceCandidates {
  suggested: SavedRemittanceCandidate | null;
  possible: SavedRemittanceCandidate[];
  reason: SavedRemittanceCandidateReason;
}

export interface ValidateSavedRemittanceSelectionInput {
  transactionBankAccountId: string | null | undefined;
  savedRunBankAccountId: string | null | undefined;
  transactionAmount: number;
  savedRunTotalCents: number;
}

export interface SavedRemittanceSelectionValidation {
  valid: boolean;
  reason: SavedRemittanceSelectionReason;
}

function toCents(amount: number): number {
  return Math.round(Math.abs(amount) * 100);
}

function toDateOnly(date: string | null | undefined): Date | null {
  if (!date) return null;

  const value = date.includes('T') ? date.slice(0, 10) : date;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDateDiffDays(a: string | null | undefined, b: string | null | undefined): number | null {
  const left = toDateOnly(a);
  const right = toDateOnly(b);
  if (!left || !right) return null;
  return Math.abs(Math.round((left.getTime() - right.getTime()) / 86_400_000));
}

function compareCandidates(a: SavedRemittanceCandidate, b: SavedRemittanceCandidate): number {
  if (a.amountDiffCents !== b.amountDiffCents) {
    return a.amountDiffCents - b.amountDiffCents;
  }

  const aDateDiff = a.dateDiffDays ?? Number.POSITIVE_INFINITY;
  const bDateDiff = b.dateDiffDays ?? Number.POSITIVE_INFINITY;
  if (aDateDiff !== bDateDiff) {
    return aDateDiff - bDateDiff;
  }

  if (a.itemCount !== b.itemCount) {
    return b.itemCount - a.itemCount;
  }

  const aTimestamp = a.exportedAt ?? a.createdAt ?? '';
  const bTimestamp = b.exportedAt ?? b.createdAt ?? '';
  return bTimestamp.localeCompare(aTimestamp);
}

export function rankSavedRemittanceCandidates(
  input: RankSavedRemittanceCandidatesInput
): RankedSavedRemittanceCandidates {
  const bankAccountId = input.transaction.bankAccountId ?? null;
  if (!bankAccountId) {
    return {
      suggested: null,
      possible: [],
      reason: 'missing_bank_account',
    };
  }

  const targetAmountCents = toCents(input.transaction.amount);

  const possible = input.runs
    .filter((run) => {
      if (!run.id || !run.storagePath) return false;
      if (run.bankAccountId !== bankAccountId) return false;
      return Math.abs(run.totalCents - targetAmountCents) <= MAX_AMOUNT_DIFF_CENTS;
    })
    .map<SavedRemittanceCandidate>((run) => {
      const dateDiffDays = getDateDiffDays(run.collectionDate, input.transaction.date);
      const amountDiffCents = Math.abs(run.totalCents - targetAmountCents);
      return {
        ...run,
        amountDiffCents,
        dateDiffDays,
        sameBankAccount: true,
        isStrongMatch: dateDiffDays !== null && dateDiffDays <= STRONG_DATE_WINDOW_DAYS,
      };
    })
    .sort(compareCandidates);

  const strongMatches = possible.filter((candidate) => candidate.isStrongMatch);

  return {
    suggested: strongMatches.length === 1 ? strongMatches[0] : null,
    possible,
    reason: possible.length === 0 ? 'no_clear_match' : null,
  };
}

export function validateSavedRemittanceSelection(
  input: ValidateSavedRemittanceSelectionInput
): SavedRemittanceSelectionValidation {
  if (!input.transactionBankAccountId) {
    return {
      valid: false,
      reason: 'missing_transaction_bank_account',
    };
  }

  if (input.savedRunBankAccountId !== input.transactionBankAccountId) {
    return {
      valid: false,
      reason: 'bank_account_mismatch',
    };
  }

  const amountDiffCents = Math.abs(input.savedRunTotalCents - toCents(input.transactionAmount));
  if (amountDiffCents > MAX_AMOUNT_DIFF_CENTS) {
    return {
      valid: false,
      reason: 'amount_mismatch',
    };
  }

  return {
    valid: true,
    reason: null,
  };
}
