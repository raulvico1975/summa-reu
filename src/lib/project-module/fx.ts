import type { ExpenseAssignment, FxTransfer, Project } from '@/lib/project-module-types';

interface FxExpenseLike {
  source?: string | null;
  amountEUR?: number | null;
  originalCurrency?: string | null;
  originalAmount?: number | null;
  currency?: string | null;
  amountOriginal?: number | null;
  fxRate?: number | null;
  fxRateUsed?: number | null;
  pendingConversion?: boolean | null;
}

interface FxRateEvidence {
  amountEUR?: number | null;
  originalAmount?: number | null;
}

function isCloseAmount(a: number, b: number): boolean {
  const absDiff = Math.abs(a - b);
  const tolerance = Math.max(0.02, Math.abs(b) * 0.005);
  return absDiff <= tolerance;
}

export function getFxOriginalAmount(expense: FxExpenseLike): number | null {
  const amount = expense.originalAmount ?? expense.amountOriginal ?? null;
  return typeof amount === 'number' && amount > 0 ? amount : null;
}

export function isFxExpenseWithLocalAmount(expense: FxExpenseLike): boolean {
  const currency = expense.originalCurrency ?? expense.currency ?? null;
  return (
    expense.source === 'offBank' &&
    currency != null &&
    currency !== 'EUR' &&
    getFxOriginalAmount(expense) !== null
  );
}

/**
 * Normalitza un tipus de canvi manual a EUR per 1 unitat local.
 *
 * Contracte intern:
 * - computeFxAmountEUR sempre rep EUR/local.
 * - Valors legacy/demo com "655.957 XOF = 1 EUR" son local/EUR i s'han
 *   d'invertir nomes quan hi ha evidencia suficient.
 */
export function normalizeFxRateToEurPerLocal(
  rate: number | null | undefined,
  evidence: FxRateEvidence = {}
): number | null {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return null;

  const originalAmount = evidence.originalAmount;
  const amountEUR = evidence.amountEUR;

  if (
    originalAmount != null &&
    originalAmount > 0 &&
    amountEUR != null &&
    Number.isFinite(amountEUR) &&
    Math.abs(amountEUR) > 0
  ) {
    const expected = Math.abs(amountEUR);
    const direct = Math.abs(originalAmount * rate);
    const inverted = Math.abs(originalAmount / rate);
    const directMatches = isCloseAmount(direct, expected);
    const invertedMatches = isCloseAmount(inverted, expected);

    if (invertedMatches && !directMatches) return 1 / rate;
    if (directMatches && !invertedMatches) return rate;
  }

  if (rate <= 1) return rate;

  return null;
}

export function resolveManualExpenseFxRate(expense: FxExpenseLike): number | null {
  const originalAmount = getFxOriginalAmount(expense);
  const rate = expense.fxRate ?? expense.fxRateUsed ?? null;
  return normalizeFxRateToEurPerLocal(rate, {
    originalAmount,
    amountEUR: expense.amountEUR ?? null,
  });
}

/**
 * Calcula l'import en EUR d'una despesa off-bank amb moneda local.
 * Retorna negatiu (convenció despesa) o null si no hi ha TC vàlid.
 *
 * IMPORTANT:
 * - Aquesta és la ÚNICA funció autoritzada per convertir a EUR.
 * - No assumir mai la direcció del TC fora d'aquí.
 */
export function computeFxAmountEUR(
  originalAmount: number,
  localPct: number,
  tc: number | null
): number | null {
  if (tc === null || tc <= 0) return null;
  return -Math.abs(originalAmount * (localPct / 100) * tc);
}

export function computeSafeFxAssignmentAmountEUR(options: {
  expense: FxExpenseLike;
  assignment: Pick<ExpenseAssignment, 'amountEUR' | 'localPct'>;
  projectTC: number | null;
}): number | null {
  const { expense, assignment, projectTC } = options;

  if (!isFxExpenseWithLocalAmount(expense)) {
    return assignment.amountEUR ?? null;
  }

  const originalAmount = getFxOriginalAmount(expense);
  if (originalAmount === null) return null;

  const localPct = assignment.localPct ?? 100;
  const manualTC = resolveManualExpenseFxRate(expense);
  const tc = manualTC ?? projectTC;

  if (tc != null && tc > 0) {
    return computeFxAmountEUR(originalAmount, localPct, tc);
  }

  return null;
}

export function computeWeightedProjectFxRate(transfers: FxTransfer[]): number | null {
  if (transfers.length === 0) return null;
  const totalEur = transfers.reduce((sum, transfer) => sum + transfer.eurSent, 0);
  const totalLocal = transfers.reduce((sum, transfer) => sum + transfer.localReceived, 0);
  return totalLocal > 0 ? totalEur / totalLocal : null;
}

export function getEffectiveProjectFxRate(transfers: FxTransfer[], project: Project): number | null {
  const weighted = computeWeightedProjectFxRate(transfers);
  if (weighted !== null) return weighted;
  return project.fxRate && project.fxRate > 0 ? 1 / project.fxRate : null;
}
