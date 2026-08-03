import { createHash, randomUUID } from 'node:crypto';
import { canonicalizeBankImportTransaction } from '@/lib/bank-import/canonicalize';
import {
  buildCanonicalSignature,
  type CanonicalBankImportTx,
} from '@/lib/bank-import/idempotency';
import { computeCanonicalImportInputHash } from '@/lib/bank-import/execute-canonical-import';
import { computeDedupeSearchRange } from '@/lib/bank-import/dedupe-invariants';
import { classifyTransactions } from '@/lib/transaction-dedupe';
import {
  prepareBankStatementPreview,
  type BankStatementPreviewDataSource,
  type BankStatementPreviewFile,
  type BankStatementPreviewRow,
} from '@/lib/private-integrations/prepare-only';

export const BANK_IMPORT_PLAN_TTL_MS = 15 * 60 * 1000;
export const MAX_BANK_IMPORT_PLAN_ROWS = 2_000;

export interface PlannedBankImportRow {
  rowIndex: number;
  tx: CanonicalBankImportTx;
}

export interface BankImportPlan {
  planId: string;
  type: 'bank_import';
  status: 'prepared' | 'processing' | 'consumed' | 'blocked';
  orgId: string;
  tokenId: string;
  bankAccountId: string;
  bankAccountName: string;
  fileName: string;
  fileSource: 'csv' | 'xlsx';
  fileSha256: string;
  previewInputHash: string;
  inputHash: string;
  selectionHash: string;
  selectedRowIndexes: number[];
  selectedRows: PlannedBankImportRow[];
  totalSourceRows: number;
  duplicateSkippedCount: number;
  candidateSkippedCount: number;
  confirmationText: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
  blockedAt: string | null;
  blockedReason: string | null;
  importRunId: string | null;
  importedIds: string[];
}

export interface BankImportPlanStore {
  create(plan: BankImportPlan): Promise<void>;
  get(planId: string): Promise<BankImportPlan | null>;
  claim(args: BankImportPlanClaimArgs): Promise<{ ok: true; plan: BankImportPlan } | { ok: false; code: string }>;
  complete(args: {
    planId: string;
    now: string;
    importRunId: string;
    importedIds: string[];
  }): Promise<void>;
  block(args: { planId: string; now: string; reason: string }): Promise<void>;
}

export interface BankImportPlanClaimArgs {
  planId: string;
  orgId: string;
  tokenId: string;
  bankAccountId: string;
  fileSha256: string;
  inputHash: string;
  selectionHash: string;
  confirmationText: string;
  humanConfirmed: boolean;
  now: string;
}

export interface PrepareBankImportPlanInput {
  orgId: string;
  tokenId: string;
  bankAccountId: string;
  file: BankStatementPreviewFile;
  rows: BankStatementPreviewRow[];
  selectedRowIndexes: number[];
  now?: Date;
  planIdFactory?: () => string;
}

export interface CommitBankImportPlanInput {
  orgId: string;
  tokenId: string;
  planId: string;
  bankAccountId: string;
  fileSha256: string;
  inputHash: string;
  selectedRowIndexes: number[];
  confirmationText: string;
  humanConfirmed: boolean;
  now?: Date;
}

export interface BankImportExecutor {
  execute(plan: BankImportPlan): Promise<{
    ok: true;
    idempotent: boolean;
    importRunId: string;
    importedIds: string[];
  } | {
    ok: false;
    code: string;
  }>;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function computeSelectionHash(rows: PlannedBankImportRow[]): string {
  return sha256(JSON.stringify(rows
    .map((row) => ({ rowIndex: row.rowIndex, signature: buildCanonicalSignature(row.tx) }))
    .sort((a, b) => a.rowIndex - b.rowIndex)));
}

function cleanSelection(values: number[]): number[] | null {
  if (!Array.isArray(values) || values.length === 0 || values.length > MAX_BANK_IMPORT_PLAN_ROWS) {
    return null;
  }
  const cleaned = [...new Set(values)];
  if (cleaned.some((value) => !Number.isInteger(value) || value <= 0)) return null;
  return cleaned.sort((a, b) => a - b);
}

function confirmationText(planId: string, count: number, accountName: string): string {
  return `CONFIRMO IMPORTAR ${count} MOVIMENTS AL COMPTE ${accountName} AMB EL PLA ${planId}`;
}

export async function prepareBankImportPlan(
  input: PrepareBankImportPlanInput,
  dataSource: BankStatementPreviewDataSource,
  store: BankImportPlanStore
): Promise<{ prepared: true; plan: BankImportPlan } | { prepared: false; code: string; blockers?: string[] }> {
  const selection = cleanSelection(input.selectedRowIndexes);
  if (!selection) return { prepared: false, code: 'EXPLICIT_SELECTION_REQUIRED' };
  if (input.rows.length > MAX_BANK_IMPORT_PLAN_ROWS) {
    return { prepared: false, code: 'TOO_MANY_ROWS' };
  }

  const preview = await prepareBankStatementPreview(input, dataSource);
  if (!preview.prepared) {
    return { prepared: false, code: 'PREVIEW_BLOCKED', blockers: preview.blockers };
  }
  if (!preview.rows || !preview.bankAccount || !preview.counts || !preview.inputHash) {
    return { prepared: false, code: 'PREVIEW_INTEGRITY_FAILED' };
  }

  const previewByRow = new Map(preview.rows.map((row) => [row.rowIndex, row]));
  const inputByRow = new Map(input.rows.map((row) => [row.rowIndex, row]));
  const selectedRows: PlannedBankImportRow[] = [];
  for (const rowIndex of selection) {
    const previewRow = previewByRow.get(rowIndex);
    const sourceRow = inputByRow.get(rowIndex);
    if (!previewRow || !sourceRow) return { prepared: false, code: 'SELECTION_NOT_FOUND' };
    if (previewRow.status !== 'NEW') return { prepared: false, code: 'SELECTION_NOT_NEW' };
    const canonical = canonicalizeBankImportTransaction(sourceRow.tx, input.bankAccountId, rowIndex);
    if (!canonical.ok) return { prepared: false, code: canonical.code };
    selectedRows.push({ rowIndex, tx: canonical.tx });
  }

  const planId = `bip_${(input.planIdFactory?.() ?? randomUUID()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 28)}`;
  const now = input.now ?? new Date();
  const inputHash = computeCanonicalImportInputHash({
    orgId: input.orgId,
    bankAccountId: input.bankAccountId,
    fileName: input.file.name,
    source: input.file.source,
    totalRows: input.file.dataRowsCount,
    transactions: selectedRows.map((row) => row.tx),
  });
  const plan: BankImportPlan = {
    planId,
    type: 'bank_import',
    status: 'prepared',
    orgId: input.orgId,
    tokenId: input.tokenId,
    bankAccountId: input.bankAccountId,
    bankAccountName: preview.bankAccount.name,
    fileName: input.file.name,
    fileSource: input.file.source,
    fileSha256: input.file.sha256,
    previewInputHash: preview.inputHash,
    inputHash,
    selectionHash: computeSelectionHash(selectedRows),
    selectedRowIndexes: selection,
    selectedRows,
    totalSourceRows: input.file.dataRowsCount,
    duplicateSkippedCount: preview.counts.duplicates,
    candidateSkippedCount: preview.counts.candidates,
    confirmationText: confirmationText(planId, selectedRows.length, preview.bankAccount.name),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + BANK_IMPORT_PLAN_TTL_MS).toISOString(),
    consumedAt: null,
    blockedAt: null,
    blockedReason: null,
    importRunId: null,
    importedIds: [],
  };
  await store.create(plan);
  return { prepared: true, plan };
}

export async function commitBankImportPlan(
  input: CommitBankImportPlanInput,
  dataSource: BankStatementPreviewDataSource,
  store: BankImportPlanStore,
  executor: BankImportExecutor
): Promise<{ committed: true; idempotent: boolean; importRunId: string; importedIds: string[] }
  | { committed: false; code: string }> {
  const selection = cleanSelection(input.selectedRowIndexes);
  if (!selection) return { committed: false, code: 'EXPLICIT_SELECTION_REQUIRED' };
  const now = input.now ?? new Date();
  const selectionHash = sha256(JSON.stringify(selection));
  const claimed = await store.claim({
    planId: input.planId,
    orgId: input.orgId,
    tokenId: input.tokenId,
    bankAccountId: input.bankAccountId,
    fileSha256: input.fileSha256,
    inputHash: input.inputHash,
    selectionHash,
    confirmationText: input.confirmationText,
    humanConfirmed: input.humanConfirmed,
    now: now.toISOString(),
  });
  if (!claimed.ok) return { committed: false, code: claimed.code };
  const plan = claimed.plan;

  const account = await dataSource.getBankAccount(plan.orgId, plan.bankAccountId);
  if (!account || account.archivedAt || account.isActive === false) {
    await store.block({ planId: plan.planId, now: now.toISOString(), reason: 'BANK_ACCOUNT_INACTIVE' });
    return { committed: false, code: 'BANK_ACCOUNT_INACTIVE' };
  }
  if (computeSelectionHash(plan.selectedRows) !== plan.selectionHash) {
    await store.block({ planId: plan.planId, now: now.toISOString(), reason: 'PLAN_INTEGRITY_FAILED' });
    return { committed: false, code: 'PLAN_INTEGRITY_FAILED' };
  }
  const recomputedInputHash = computeCanonicalImportInputHash({
    orgId: plan.orgId,
    bankAccountId: plan.bankAccountId,
    fileName: plan.fileName,
    source: plan.fileSource,
    totalRows: plan.totalSourceRows,
    transactions: plan.selectedRows.map((row) => row.tx),
  });
  if (recomputedInputHash !== plan.inputHash) {
    await store.block({ planId: plan.planId, now: now.toISOString(), reason: 'INPUT_HASH_MISMATCH' });
    return { committed: false, code: 'INPUT_HASH_MISMATCH' };
  }

  const range = computeDedupeSearchRange(plan.selectedRows.map((row) => row.tx), { toleranceDays: 3 });
  if (!range) {
    await store.block({ planId: plan.planId, now: now.toISOString(), reason: 'NO_VALID_DATE_RANGE' });
    return { committed: false, code: 'NO_VALID_DATE_RANGE' };
  }
  const existing = await dataSource.listTransactions({
    orgId: plan.orgId,
    bankAccountId: plan.bankAccountId,
    dateFrom: range.from,
    dateTo: range.to,
  });
  const current = classifyTransactions(
    plan.selectedRows.map((row) => {
      const { contactType, ...tx } = row.tx;
      return {
        tx: { ...tx, ...(contactType ? { contactType } : {}) },
        rawRow: { _rowIndex: row.rowIndex },
      };
    }),
    existing,
    plan.bankAccountId,
    ['operationDate', 'balanceAfter']
  );
  if (current.some((row) => row.status !== 'NEW')) {
    await store.block({ planId: plan.planId, now: now.toISOString(), reason: 'DEDUPE_DRIFT' });
    return { committed: false, code: 'DEDUPE_DRIFT' };
  }

  const result = await executor.execute(plan);
  if (!result.ok) {
    await store.block({ planId: plan.planId, now: now.toISOString(), reason: result.code });
    return { committed: false, code: result.code };
  }
  await store.complete({
    planId: plan.planId,
    now: now.toISOString(),
    importRunId: result.importRunId,
    importedIds: result.importedIds,
  });
  return {
    committed: true,
    idempotent: result.idempotent,
    importRunId: result.importRunId,
    importedIds: result.importedIds,
  };
}

export const bankImportPlanHashes = {
  selectionIndexes: (values: number[]) => sha256(JSON.stringify([...values].sort((a, b) => a - b))),
};

export function validateBankImportPlanClaim(
  plan: Pick<BankImportPlan,
    'planId' | 'orgId' | 'tokenId' | 'bankAccountId' | 'fileSha256' | 'inputHash'
    | 'selectedRowIndexes' | 'confirmationText' | 'status' | 'expiresAt'>,
  args: BankImportPlanClaimArgs
): string | null {
  if (plan.planId !== args.planId) return 'PLAN_NOT_FOUND';
  if (plan.orgId !== args.orgId) return 'PLAN_ORG_MISMATCH';
  if (plan.tokenId !== args.tokenId) return 'PLAN_TOKEN_MISMATCH';
  if (plan.bankAccountId !== args.bankAccountId) return 'PLAN_BANK_ACCOUNT_MISMATCH';
  if (plan.fileSha256 !== args.fileSha256) return 'PLAN_FILE_HASH_MISMATCH';
  if (plan.inputHash !== args.inputHash) return 'PLAN_INPUT_HASH_MISMATCH';
  if (bankImportPlanHashes.selectionIndexes(plan.selectedRowIndexes) !== args.selectionHash) {
    return 'PLAN_SELECTION_MISMATCH';
  }
  if (!args.humanConfirmed || args.confirmationText !== plan.confirmationText) {
    return 'HUMAN_CONFIRMATION_REQUIRED';
  }
  if (plan.status !== 'prepared') {
    return plan.status === 'consumed' ? 'PLAN_ALREADY_USED' : 'PLAN_NOT_PREPARED';
  }
  if (Date.parse(plan.expiresAt) <= Date.parse(args.now)) return 'PLAN_EXPIRED';
  return null;
}
