import type { ComputedCheck } from "./types";
import type { HealthTx } from "./checks";

const MONEY_TOLERANCE = 0.01;
const SAMPLE_IDS_LIMIT = 10;

export interface CategoryDoc {
  id: string;
  type?: "income" | "expense";
  name?: string;
  systemKey?: string | null;
}

export interface ProjectModuleProjectDoc {
  id: string;
  fxRate?: number | null;
}

export interface FxTransferDoc {
  id: string;
  eurSent?: number;
  localReceived?: number;
}

export interface ExpenseExportDoc {
  id: string;
  amountEUR?: number;
  categoryId?: string | null;
  isEligibleForProjects?: boolean;
  deletedAt?: unknown;
}

export interface ExpenseAssignment {
  projectId: string;
  amountEUR: number | null;
  localPct?: number;
}

export interface ExpenseLinkDoc {
  id: string;
  assignments?: ExpenseAssignment[];
}

export interface OffBankExpenseDoc {
  id: string;
  amountEUR?: number | null;
  originalCurrency?: string | null;
  originalAmount?: number | null;
  fxRate?: number | null;
  amountOriginal?: number | null;
  fxRateUsed?: number | null;
}

export interface ReconciliationInput {
  operationalTransactions: HealthTx[];
  allTransactions: HealthTx[];
  categories: CategoryDoc[];
  exportExpenses: ExpenseExportDoc[];
  expenseLinks: ExpenseLinkDoc[];
  offBankExpenses: OffBankExpenseDoc[];
  projectModuleProjects: ProjectModuleProjectDoc[];
  projectFxTransfers: Map<string, FxTransferDoc[]>;
}

export interface ReconciliationResult {
  R1: ComputedCheck;
  R2: ComputedCheck;
  R3: ComputedCheck;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function nearlyEqual(a: number, b: number, tolerance = MONEY_TOLERANCE): boolean {
  return Math.abs(a - b) <= tolerance;
}

function pushIssue(
  examples: Array<Record<string, unknown>>,
  issue: Record<string, unknown>,
  maxExamples = 5
): void {
  if (examples.length < maxExamples) {
    examples.push(issue);
  }
}

function pushSampleId(sampleIds: string[], id: string | null | undefined): void {
  if (!id) return;
  if (sampleIds.length >= SAMPLE_IDS_LIMIT) return;
  if (sampleIds.includes(id)) return;
  sampleIds.push(id);
}

function findMissionTransferCategoryId(categories: CategoryDoc[]): string | null {
  const bySystemKey = categories.find((c) => c.systemKey === "missionTransfers");
  if (bySystemKey) return bySystemKey.id;

  const byLegacyName = categories.find((c) => c.name === "missionTransfers");
  if (byLegacyName) return byLegacyName.id;

  return null;
}

function calculateProjectFeedEligibility(tx: HealthTx): boolean {
  if (tx.archivedAt != null) return false;
  if (tx.amount >= 0) return false;
  if (tx.transactionType === "return" || tx.transactionType === "return_fee") return false;
  if ((tx as { isCounterpartTransfer?: boolean }).isCounterpartTransfer === true) return false;
  if ((tx as { isRemittance?: boolean }).isRemittance === true) return false;
  if (tx.isSplit === true) return false;
  return true;
}

function computeWeightedFxRate(transfers: FxTransferDoc[]): number | null {
  if (transfers.length === 0) return null;

  let totalEur = 0;
  let totalLocal = 0;
  for (const transfer of transfers) {
    if (typeof transfer.eurSent === "number" && transfer.eurSent > 0) {
      totalEur += transfer.eurSent;
    }
    if (typeof transfer.localReceived === "number" && transfer.localReceived > 0) {
      totalLocal += transfer.localReceived;
    }
  }

  if (totalLocal <= 0) return null;
  return totalEur / totalLocal;
}

function getEffectiveProjectTC(
  project: ProjectModuleProjectDoc | undefined,
  transfers: FxTransferDoc[]
): number | null {
  const weighted = computeWeightedFxRate(transfers);
  if (weighted !== null) return weighted;

  if (project && typeof project.fxRate === "number" && project.fxRate > 0) {
    return 1 / project.fxRate;
  }

  return null;
}

function computeFxAmountEUR(originalAmount: number, localPct: number, tc: number | null): number | null {
  if (tc === null || tc <= 0) return null;
  return -Math.abs(originalAmount * (localPct / 100) * tc);
}

function isFxExpense(offBankExpense: OffBankExpenseDoc): boolean {
  const originalCurrency = offBankExpense.originalCurrency ?? null;
  const originalAmount =
    typeof offBankExpense.originalAmount === "number"
      ? offBankExpense.originalAmount
      : typeof offBankExpense.amountOriginal === "number"
      ? offBankExpense.amountOriginal
      : null;

  return !!(
    originalCurrency &&
    originalCurrency !== "EUR" &&
    originalAmount !== null &&
    originalAmount > 0
  );
}

export function runReconciliations(input: ReconciliationInput): ReconciliationResult {
  const {
    operationalTransactions,
    allTransactions,
    categories,
    exportExpenses,
    expenseLinks,
    offBankExpenses,
    projectModuleProjects,
    projectFxTransfers,
  } = input;

  // ───────────────────────────────────────────────────────────────────────────
  // R1) Dashboard totals parity
  // ───────────────────────────────────────────────────────────────────────────

  const missionCategoryId = findMissionTransferCategoryId(categories);

  let signedNet = 0;
  let incomeAbs = 0;
  let expensesAbs = 0;
  let transfersAbs = 0;
  let negativesAbs = 0;

  for (const tx of operationalTransactions) {
    signedNet += tx.amount;
    if (tx.amount > 0) {
      incomeAbs += tx.amount;
      continue;
    }

    const txAbs = Math.abs(tx.amount);
    negativesAbs += txAbs;

    if (missionCategoryId && tx.category === missionCategoryId) {
      transfersAbs += txAbs;
    } else {
      expensesAbs += txAbs;
    }
  }

  const netFromParts = incomeAbs - expensesAbs - transfersAbs;
  const negativesFromParts = expensesAbs + transfersAbs;

  const examplesR1: Array<Record<string, unknown>> = [];
  const sampleIdsR1: string[] = [];
  let countR1 = 0;

  if (!nearlyEqual(signedNet, netFromParts)) {
    countR1++;
    pushIssue(examplesR1, {
      issue: "net_mismatch",
      signedNet: round2(signedNet),
      netFromParts: round2(netFromParts),
      diff: round2(signedNet - netFromParts),
    });
  }

  if (!nearlyEqual(negativesAbs, negativesFromParts)) {
    countR1++;
    pushIssue(examplesR1, {
      issue: "negative_partition_mismatch",
      negativesAbs: round2(negativesAbs),
      negativesFromParts: round2(negativesFromParts),
      diff: round2(negativesAbs - negativesFromParts),
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // R2) Feed de despeses per projectes (elegibilitat)
  // ───────────────────────────────────────────────────────────────────────────

  const exportByTxId = new Map<string, ExpenseExportDoc>();
  for (const exp of exportExpenses) {
    exportByTxId.set(exp.id, exp);
  }

  const allTxIds = new Set(allTransactions.map((tx) => tx.id));

  const examplesR2: Array<Record<string, unknown>> = [];
  const sampleIdsR2: string[] = [];
  let countR2 = 0;

  for (const tx of allTransactions) {
    const expectedEligible = calculateProjectFeedEligibility(tx);
    const exp = exportByTxId.get(tx.id);

    const observedEligible = !!(
      exp &&
      exp.deletedAt == null &&
      exp.isEligibleForProjects === true
    );

    if (expectedEligible !== observedEligible) {
      countR2++;
      pushSampleId(sampleIdsR2, tx.id);
      pushIssue(examplesR2, {
        txId: tx.id,
        issue: "eligibility_mismatch",
        expectedEligible,
        observedEligible,
      });
    }
  }

  for (const exp of exportExpenses) {
    const isActiveExport = exp.deletedAt == null && exp.isEligibleForProjects === true;
    if (!isActiveExport) continue;

    if (!allTxIds.has(exp.id)) {
      countR2++;
      pushSampleId(sampleIdsR2, exp.id);
      pushIssue(examplesR2, {
        txId: exp.id,
        issue: "export_without_source_transaction",
      });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // R3) FX i repartiments d'imputació
  // ───────────────────────────────────────────────────────────────────────────

  const offBankById = new Map<string, OffBankExpenseDoc>();
  for (const off of offBankExpenses) {
    offBankById.set(off.id, off);
  }

  const moduleProjectById = new Map<string, ProjectModuleProjectDoc>();
  for (const project of projectModuleProjects) {
    moduleProjectById.set(project.id, project);
  }

  const examplesR3: Array<Record<string, unknown>> = [];
  const sampleIdsR3: string[] = [];
  let countR3 = 0;

  for (const link of expenseLinks) {
    const assignments = Array.isArray(link.assignments) ? link.assignments : [];
    if (assignments.length === 0) continue;

    let totalAbs: number | null = null;
    let txKind: "bank" | "offBank" = "bank";

    if (link.id.startsWith("off_")) {
      txKind = "offBank";
      const offId = link.id.slice(4);
      const offExpense = offBankById.get(offId);
      if (!offExpense) {
        countR3++;
        pushSampleId(sampleIdsR3, link.id);
        pushIssue(examplesR3, {
          txId: link.id,
          issue: "offbank_expense_missing",
        });
        continue;
      }

      if (typeof offExpense.amountEUR === "number") {
        totalAbs = Math.abs(offExpense.amountEUR);
      }
    } else {
      const bankExpense = exportByTxId.get(link.id);
      if (!bankExpense) {
        countR3++;
        pushSampleId(sampleIdsR3, link.id);
        pushIssue(examplesR3, {
          txId: link.id,
          issue: "bank_export_missing",
        });
        continue;
      }
      if (typeof bankExpense.amountEUR === "number") {
        totalAbs = Math.abs(bankExpense.amountEUR);
      }
    }

    const hasLocalPct = assignments.some((a) => typeof a.localPct === "number");
    const totalLocalPct = assignments.reduce((sum, a) => sum + (typeof a.localPct === "number" ? a.localPct : 0), 0);

    if (hasLocalPct && totalLocalPct > 100.01) {
      countR3++;
      pushSampleId(sampleIdsR3, link.id);
      pushIssue(examplesR3, {
        txId: link.id,
        issue: "local_pct_over_100",
        totalLocalPct: round2(totalLocalPct),
      });
    }

    let assignedAbs = 0;

    for (const assignment of assignments) {
      if (!assignment.projectId || !moduleProjectById.has(assignment.projectId)) {
        countR3++;
        pushSampleId(sampleIdsR3, link.id);
        pushIssue(examplesR3, {
          txId: link.id,
          issue: "assignment_project_missing",
          projectId: assignment.projectId ?? null,
        });
      }

      if (typeof assignment.localPct === "number" && (assignment.localPct < 0 || assignment.localPct > 100)) {
        countR3++;
        pushSampleId(sampleIdsR3, link.id);
        pushIssue(examplesR3, {
          txId: link.id,
          issue: "local_pct_out_of_range",
          projectId: assignment.projectId,
          localPct: assignment.localPct,
        });
      }

      if (assignment.amountEUR != null && assignment.amountEUR > 0) {
        countR3++;
        pushSampleId(sampleIdsR3, link.id);
        pushIssue(examplesR3, {
          txId: link.id,
          issue: "assignment_amount_positive",
          projectId: assignment.projectId,
          amountEUR: assignment.amountEUR,
        });
      }

      if (assignment.amountEUR != null) {
        assignedAbs += Math.abs(assignment.amountEUR);
      }

      if (txKind !== "offBank") continue;

      const offId = link.id.slice(4);
      const offExpense = offBankById.get(offId);
      if (!offExpense) continue;
      if (!isFxExpense(offExpense)) continue;

      const originalAmount =
        typeof offExpense.originalAmount === "number"
          ? offExpense.originalAmount
          : typeof offExpense.amountOriginal === "number"
          ? offExpense.amountOriginal
          : null;

      if (originalAmount === null || originalAmount <= 0) continue;

      const manualTc =
        typeof offExpense.fxRate === "number" && offExpense.fxRate > 0
          ? offExpense.fxRate
          : typeof offExpense.fxRateUsed === "number" && offExpense.fxRateUsed > 0
          ? offExpense.fxRateUsed
          : null;

      const project = moduleProjectById.get(assignment.projectId);
      const projectTransfers = projectFxTransfers.get(assignment.projectId) ?? [];
      const effectiveProjectTc = getEffectiveProjectTC(project, projectTransfers);
      const tc = manualTc ?? effectiveProjectTc;

      const pct = typeof assignment.localPct === "number" ? assignment.localPct : 100;
      const expectedAmount = computeFxAmountEUR(originalAmount, pct, tc);
      const currentAmount = assignment.amountEUR;

      const equivalent =
        (expectedAmount === null && currentAmount === null) ||
        (expectedAmount !== null && currentAmount !== null && nearlyEqual(expectedAmount, currentAmount));

      if (!equivalent) {
        countR3++;
        pushSampleId(sampleIdsR3, link.id);
        pushIssue(examplesR3, {
          txId: link.id,
          issue: "fx_amount_mismatch",
          projectId: assignment.projectId,
          expectedAmountEUR: expectedAmount,
          currentAmountEUR: currentAmount,
          tc,
          localPct: pct,
        });
      }
    }

    if (totalAbs !== null && assignedAbs > totalAbs + MONEY_TOLERANCE) {
      countR3++;
      pushSampleId(sampleIdsR3, link.id);
      pushIssue(examplesR3, {
        txId: link.id,
        issue: "assigned_over_total",
        assignedAbs: round2(assignedAbs),
        totalAbs: round2(totalAbs),
      });
    }
  }

  return {
    R1: {
      count: countR1,
      sampleIds: sampleIdsR1,
      examples: examplesR1,
      details: {
        incomeAbs: round2(incomeAbs),
        expensesAbs: round2(expensesAbs),
        transfersAbs: round2(transfersAbs),
        signedNet: round2(signedNet),
      },
    },
    R2: {
      count: countR2,
      sampleIds: sampleIdsR2,
      examples: examplesR2,
      details: {
        transactionsChecked: allTransactions.length,
        exportsChecked: exportExpenses.length,
      },
    },
    R3: {
      count: countR3,
      sampleIds: sampleIdsR3,
      examples: examplesR3,
      details: {
        expenseLinksChecked: expenseLinks.length,
      },
    },
  };
}
