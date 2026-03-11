/**
 * POST /api/transactions/import
 *
 * Importació bancària backend amb idempotència.
 *
 * Objectius:
 * - Escriure transaccions al backend (Admin SDK), no al client.
 * - Idempotència per inputHash (reintents segurs).
 * - Batching <= 50 operacions.
 * - Bloqueig temporal per evitar processaments concurrents del mateix payload.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  getAdminDb,
  verifyIdToken,
  validateUserMembership,
  BATCH_SIZE,
} from '@/lib/api/admin-sdk';
import { requirePermission } from '@/lib/api/require-permission';
import { normalizeBankDescription } from '@/lib/normalize';
import {
  computeBankImportHash,
  prepareDeterministicTransactions,
  type CanonicalBankImportTx,
} from '@/lib/bank-import/idempotency';
import { safeSet, safeUpdate, SafeWriteValidationError } from '@/lib/safe-write';

const LOCK_TTL_MS = 10 * 60 * 1000; // 10 minuts
const MAX_TRANSACTIONS_PER_REQUEST = 2000;

type ImportSource = 'csv' | 'xlsx';
type ContactType = 'donor' | 'supplier' | 'employee';
type TransactionType = 'normal' | 'return' | 'return_fee' | 'donation' | 'fee';
const ALLOWED_CONTACT_TYPES: readonly ContactType[] = ['donor', 'supplier', 'employee'];
const ALLOWED_TRANSACTION_TYPES: readonly TransactionType[] = [
  'normal',
  'return',
  'return_fee',
  'donation',
  'fee',
];

interface ImportRequestStats {
  duplicateSkippedCount: number;
  candidateCount?: number;
  candidateUserImportedCount?: number;
  candidateUserSkippedCount?: number;
}

interface ImportTransactionInput {
  date: string;
  description: string;
  amount: number;
  balanceAfter?: number;
  operationDate: string;
  category?: string | null;
  document?: string | null;
  contactId?: string | null;
  contactType?: ContactType | null;
  transactionType?: TransactionType;
  bankAccountId?: string | null;
  source?: 'bank' | 'manual' | 'remittance' | 'stripe';
}

interface ImportTransactionsRequest {
  orgId: string;
  bankAccountId: string;
  fileName: string | null;
  source: ImportSource;
  totalRows: number;
  stats: ImportRequestStats;
  transactions: ImportTransactionInput[];
}

type NormalizedTransactionInputResult =
  | { ok: true; tx: CanonicalBankImportTx }
  | { ok: false; error: string; code: string };

interface CreatedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  balanceAfter?: number;
  operationDate: string;
  category: string | null;
  document: string | null;
  contactId: string | null;
  contactType: ContactType | null;
  transactionType: TransactionType;
  bankAccountId: string;
  source: 'bank';
}

interface ImportTransactionsResponse {
  success: boolean;
  idempotent?: boolean;
  createdCount?: number;
  importRunId?: string;
  inputHash?: string;
  createdTransactions?: CreatedTransaction[];
  error?: string;
  code?: string;
}

interface ImportJobDoc {
  status: 'processing' | 'completed' | 'error';
  type: 'bankTransactions';
  inputHash: string;
  orgId: string;
  bankAccountId: string;
  source: ImportSource;
  fileName: string | null;
  totalRows: number;
  startedAt: FirebaseFirestore.Timestamp;
  lockExpiresAt: FirebaseFirestore.Timestamp | null;
  requestedByUid: string;
  importRunId?: string;
  createdCount?: number;
  lastError?: string;
  finishedAt?: FirebaseFirestore.Timestamp;
}

function sanitizeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Error desconegut durant la importació';
  }
  return error.message.slice(0, 300);
}

function validateBody(body: unknown): {
  ok: true;
  data: ImportTransactionsRequest;
} | {
  ok: false;
  error: string;
  code: string;
} {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body invàlid', code: 'INVALID_BODY' };
  }

  const req = body as Record<string, unknown>;

  if (typeof req.orgId !== 'string' || !req.orgId.trim()) {
    return { ok: false, error: 'orgId obligatori', code: 'MISSING_ORG_ID' };
  }
  if (typeof req.bankAccountId !== 'string' || !req.bankAccountId.trim()) {
    return { ok: false, error: 'bankAccountId obligatori', code: 'MISSING_BANK_ACCOUNT_ID' };
  }
  if (req.fileName !== null && req.fileName !== undefined && typeof req.fileName !== 'string') {
    return { ok: false, error: 'fileName invàlid', code: 'INVALID_FILE_NAME' };
  }
  if (req.source !== 'csv' && req.source !== 'xlsx') {
    return { ok: false, error: 'source invàlid', code: 'INVALID_SOURCE' };
  }
  if (typeof req.totalRows !== 'number' || !Number.isFinite(req.totalRows) || req.totalRows < 0) {
    return { ok: false, error: 'totalRows invàlid', code: 'INVALID_TOTAL_ROWS' };
  }
  if (!req.stats || typeof req.stats !== 'object') {
    return { ok: false, error: 'stats invàlid', code: 'INVALID_STATS' };
  }
  if (!Array.isArray(req.transactions) || req.transactions.length === 0) {
    return { ok: false, error: 'transactions obligatori', code: 'MISSING_TRANSACTIONS' };
  }
  if (req.transactions.length > MAX_TRANSACTIONS_PER_REQUEST) {
    return {
      ok: false,
      error: `Màxim ${MAX_TRANSACTIONS_PER_REQUEST} transaccions per request`,
      code: 'TOO_MANY_TRANSACTIONS',
    };
  }

  const stats = req.stats as Record<string, unknown>;
  if (
    typeof stats.duplicateSkippedCount !== 'number' ||
    !Number.isFinite(stats.duplicateSkippedCount) ||
    stats.duplicateSkippedCount < 0
  ) {
    return {
      ok: false,
      error: 'stats.duplicateSkippedCount invàlid',
      code: 'INVALID_STATS_DUPLICATE_COUNT',
    };
  }

  const parsedStats: ImportRequestStats = {
    duplicateSkippedCount: stats.duplicateSkippedCount as number,
  };
  if (typeof stats.candidateCount === 'number') {
    parsedStats.candidateCount = stats.candidateCount;
  }
  if (typeof stats.candidateUserImportedCount === 'number') {
    parsedStats.candidateUserImportedCount = stats.candidateUserImportedCount;
  }
  if (typeof stats.candidateUserSkippedCount === 'number') {
    parsedStats.candidateUserSkippedCount = stats.candidateUserSkippedCount;
  }

  return {
    ok: true,
    data: {
      orgId: req.orgId as string,
      bankAccountId: req.bankAccountId as string,
      fileName: (req.fileName as string | null | undefined) ?? null,
      source: req.source as ImportSource,
      totalRows: req.totalRows as number,
      stats: parsedStats,
      transactions: req.transactions as ImportTransactionInput[],
    },
  };
}

const ISO_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeIsoDateOnly(dateValue: string | undefined): string | null {
  if (!dateValue) return null;
  const trimmed = dateValue.trim();
  if (!ISO_DATE_ONLY_RE.test(trimmed)) return null;

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.toISOString().slice(0, 10) !== trimmed) return null;

  return trimmed;
}

function normalizeTransactionInput(
  tx: ImportTransactionInput,
  bankAccountId: string,
  index: number
): NormalizedTransactionInputResult {
  if (!tx || typeof tx !== 'object') {
    return {
      ok: false,
      error: `transactions[${index}] ha de ser un objecte vàlid`,
      code: 'INVALID_TRANSACTION',
    };
  }
  if (typeof tx.date !== 'string' || !tx.date.trim()) {
    return {
      ok: false,
      error: `transactions[${index}] ha de tenir date vàlida`,
      code: 'INVALID_DATE',
    };
  }
  if (typeof tx.description !== 'string' || !tx.description.trim()) {
    return {
      ok: false,
      error: `transactions[${index}] ha de tenir description vàlida`,
      code: 'INVALID_DESCRIPTION',
    };
  }
  if (typeof tx.amount !== 'number' || !Number.isFinite(tx.amount)) {
    return {
      ok: false,
      error: `transactions[${index}] ha de tenir amount vàlid`,
      code: 'INVALID_AMOUNT',
    };
  }

  if (tx.source !== undefined && tx.source !== 'bank') {
    return {
      ok: false,
      error: `transactions[${index}] només permet source='bank' a l'import bancari directe`,
      code: 'INVALID_SOURCE_CONTRACT',
    };
  }

  if (
    typeof tx.bankAccountId === 'string' &&
    tx.bankAccountId.trim() !== '' &&
    tx.bankAccountId !== bankAccountId
  ) {
    return {
      ok: false,
      error: `transactions[${index}] bankAccountId no coincideix amb el compte seleccionat`,
      code: 'BANK_ACCOUNT_MISMATCH',
    };
  }

  const operationDate = normalizeIsoDateOnly(tx.operationDate);
  if (!operationDate) {
    return {
      ok: false,
      error: `transactions[${index}] cal Data d'operació (F. execució)`,
      code: 'OPERATION_DATE_REQUIRED',
    };
  }

  const dateObj = new Date(tx.date);
  if (Number.isNaN(dateObj.getTime())) {
    return {
      ok: false,
      error: `transactions[${index}] date invàlida`,
      code: 'INVALID_DATE',
    };
  }

  const transactionType: TransactionType = tx.transactionType ?? 'normal';
  const contactType: ContactType | null = tx.contactType ?? null;
  const balanceAfter = typeof tx.balanceAfter === 'number' && Number.isFinite(tx.balanceAfter)
    ? tx.balanceAfter
    : undefined;

  return {
    ok: true,
    tx: {
      date: dateObj.toISOString(),
      description: normalizeBankDescription(tx.description),
      amount: tx.amount,
      ...(balanceAfter !== undefined ? { balanceAfter } : {}),
      operationDate,
      category: tx.category ?? null,
      document: null,
      contactId: tx.contactId ?? null,
      contactType,
      transactionType,
      bankAccountId,
      source: 'bank',
    }
  };
}

function validateRuntimeAndFiscalInvariants(
  tx: CanonicalBankImportTx,
  index: number
): { ok: true } | { ok: false; error: string; code: string } {
  if (!ALLOWED_TRANSACTION_TYPES.includes(tx.transactionType)) {
    return {
      ok: false,
      error: `transactions[${index}].transactionType invàlid`,
      code: 'INVALID_TRANSACTION_TYPE',
    };
  }

  if (tx.contactType !== null && !ALLOWED_CONTACT_TYPES.includes(tx.contactType)) {
    return {
      ok: false,
      error: `transactions[${index}].contactType invàlid`,
      code: 'INVALID_CONTACT_TYPE',
    };
  }

  if (tx.contactType !== null && !tx.contactId) {
    return {
      ok: false,
      error: `transactions[${index}] té contactType però no contactId`,
      code: 'CONTACT_TYPE_WITHOUT_CONTACT',
    };
  }

  if (tx.contactId && tx.contactType === null) {
    return {
      ok: false,
      error: `transactions[${index}] té contactId però no contactType`,
      code: 'CONTACT_ID_WITHOUT_TYPE',
    };
  }

  // Import bancari: permetem returns sense contactId en fase d'ingesta.
  // Es podran vincular al donant posteriorment (p. ex. Return Importer).
  if (tx.transactionType === 'return' && !tx.contactId && tx.source !== 'bank') {
    return {
      ok: false,
      error: `transactions[${index}] (return) requereix contactId`,
      code: 'A1_RETURN_REQUIRES_CONTACT',
    };
  }

  if (tx.transactionType === 'fee' && !!tx.contactId) {
    return {
      ok: false,
      error: `transactions[${index}] (fee) no pot tenir contactId`,
      code: 'A1_FEE_FORBIDS_CONTACT',
    };
  }

  // Invariant A2: coherència de signe segons tipus
  if (tx.transactionType === 'return' && tx.amount >= 0) {
    return {
      ok: false,
      error: `transactions[${index}] (return) ha de tenir import negatiu`,
      code: 'A2_RETURN_SIGN_INVALID',
    };
  }

  if (tx.transactionType === 'donation' && tx.amount <= 0) {
    return {
      ok: false,
      error: `transactions[${index}] (donation) ha de tenir import positiu`,
      code: 'A2_DONATION_SIGN_INVALID',
    };
  }

  if (tx.transactionType === 'fee' && tx.amount >= 0) {
    return {
      ok: false,
      error: `transactions[${index}] (fee) ha de tenir import negatiu`,
      code: 'A2_FEE_SIGN_INVALID',
    };
  }

  return { ok: true };
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ImportTransactionsResponse>> {
  const authResult = await verifyIdToken(request);
  if (!authResult) {
    return NextResponse.json(
      { success: false, error: 'No autenticat', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  let parsedBody: ImportTransactionsRequest;
  try {
    const rawBody = await request.json();
    const validation = validateBody(rawBody);
    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: validation.error, code: validation.code },
        { status: 400 }
      );
    }
    parsedBody = validation.data;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Body invàlid', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  const membership = await validateUserMembership(db, authResult.uid, parsedBody.orgId);
  const accessError = requirePermission(membership, {
    code: 'MOVIMENTS_IMPORTAR_EXTRACTES_REQUIRED',
    check: (permissions) => permissions['moviments.importarExtractes'],
  });
  if (accessError) return accessError as NextResponse<ImportTransactionsResponse>;

  const normalizedTransactions: CanonicalBankImportTx[] = [];

  for (let i = 0; i < parsedBody.transactions.length; i++) {
    const tx = parsedBody.transactions[i] as ImportTransactionInput;
    const normalized = normalizeTransactionInput(tx, parsedBody.bankAccountId, i);

    if (!normalized.ok) {
      return NextResponse.json(
        {
          success: false,
          error: normalized.error,
          code: normalized.code,
        },
        { status: 400 }
      );
    }

    normalizedTransactions.push(normalized.tx);
  }

  if (normalizedTransactions.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No hi ha transaccions vàlides', code: 'NO_VALID_TRANSACTIONS' },
      { status: 400 }
    );
  }

  for (let i = 0; i < normalizedTransactions.length; i++) {
    const runtimeValidation = validateRuntimeAndFiscalInvariants(normalizedTransactions[i], i);
    if (!runtimeValidation.ok) {
      return NextResponse.json(
        {
          success: false,
          error: runtimeValidation.error,
          code: runtimeValidation.code,
        },
        { status: 400 }
      );
    }
  }

  const inputHash = computeBankImportHash({
    orgId: parsedBody.orgId,
    bankAccountId: parsedBody.bankAccountId,
    source: parsedBody.source,
    fileName: parsedBody.fileName,
    totalRows: parsedBody.totalRows,
    transactions: normalizedTransactions,
  });

  const importJobRef = db.doc(`organizations/${parsedBody.orgId}/importJobs/${inputHash}`);
  const now = Timestamp.now();
  const lockExpiresAt = Timestamp.fromMillis(now.toMillis() + LOCK_TTL_MS);

  let lockResult:
    | { mode: 'idempotent'; importRunId: string; createdCount: number }
    | { mode: 'locked'; lockedByUid: string }
    | { mode: 'process' };

  try {
    lockResult = await db.runTransaction(async (tx) => {
      const snap = await tx.get(importJobRef);
      const existing = snap.data() as ImportJobDoc | undefined;

      if (existing) {
        if (existing.status === 'completed') {
          return {
            mode: 'idempotent' as const,
            importRunId: existing.importRunId ?? inputHash,
            createdCount: existing.createdCount ?? 0,
          };
        }

        if (
          existing.status === 'processing' &&
          existing.lockExpiresAt &&
          existing.lockExpiresAt.toMillis() > now.toMillis()
        ) {
          return {
            mode: 'locked' as const,
            lockedByUid: existing.requestedByUid,
          };
        }
      }

      const jobData: ImportJobDoc = {
        status: 'processing',
        type: 'bankTransactions',
        inputHash,
        orgId: parsedBody.orgId,
        bankAccountId: parsedBody.bankAccountId,
        source: parsedBody.source,
        fileName: parsedBody.fileName,
        totalRows: parsedBody.totalRows,
        startedAt: now,
        lockExpiresAt,
        requestedByUid: authResult.uid,
      };

      await safeSet({
        data: jobData as unknown as Record<string, unknown>,
        context: {
          updatedBy: authResult.uid,
          source: 'import',
          updatedAtFactory: () => FieldValue.serverTimestamp(),
          requiredFields: ['status', 'type', 'inputHash', 'orgId', 'bankAccountId', 'requestedByUid'],
        },
        write: (payload) => {
          tx.set(importJobRef, payload, { merge: true });
        },
      });
      return { mode: 'process' as const };
    });
  } catch (error) {
    if (error instanceof SafeWriteValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: 400 }
      );
    }
    console.error('[transactions/import] Error preparant lock d\'import:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error intern del servidor',
        code: 'IMPORT_LOCK_ERROR',
      },
      { status: 500 }
    );
  }

  if (lockResult.mode === 'idempotent') {
    return NextResponse.json({
      success: true,
      idempotent: true,
      createdCount: lockResult.createdCount,
      importRunId: lockResult.importRunId,
      inputHash,
      createdTransactions: [],
    });
  }

  if (lockResult.mode === 'locked') {
    return NextResponse.json(
      {
        success: false,
        error: `Importació en curs per ${lockResult.lockedByUid}. Torna-ho a provar en uns segons.`,
        code: 'IMPORT_LOCKED',
      },
      { status: 409 }
    );
  }

  try {
    const writeContextBase = {
      updatedBy: authResult.uid,
      source: 'import' as const,
      updatedAtFactory: () => FieldValue.serverTimestamp(),
    };

    const prepared = prepareDeterministicTransactions(normalizedTransactions, inputHash);

    for (let i = 0; i < prepared.length; i += BATCH_SIZE) {
      const chunk = prepared.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      for (const item of chunk) {
        const txRef = db.doc(`organizations/${parsedBody.orgId}/transactions/${item.id}`);
        await safeSet({
          data: item.tx as unknown as Record<string, unknown>,
          context: {
            ...writeContextBase,
            requiredFields: ['date', 'description', 'amount', 'bankAccountId', 'source'],
            amountFields: ['amount'],
          },
          write: (payload) => {
            batch.set(txRef, payload, { merge: true });
          },
        });
      }

      await batch.commit();
    }

    const dates = prepared.map((p) => p.tx.date).sort((a, b) => a.localeCompare(b));
    const importRunRef = db.doc(`organizations/${parsedBody.orgId}/importRuns/${inputHash}`);
    const importRunPayload = {
      type: 'bankTransactions',
      source: parsedBody.source,
      fileName: parsedBody.fileName,
      dateMin: dates[0],
      dateMax: dates[dates.length - 1],
      totalRows: parsedBody.totalRows,
      createdCount: prepared.length,
      duplicateSkippedCount: parsedBody.stats.duplicateSkippedCount,
      createdBy: authResult.uid,
      bankAccountId: parsedBody.bankAccountId,
      candidateCount: parsedBody.stats.candidateCount,
      candidateUserImportedCount: parsedBody.stats.candidateUserImportedCount,
      candidateUserSkippedCount: parsedBody.stats.candidateUserSkippedCount,
      inputHash,
      createdAt: FieldValue.serverTimestamp(),
    };

    await safeSet({
      data: importRunPayload,
      context: {
        ...writeContextBase,
        requiredFields: ['type', 'source', 'createdBy', 'bankAccountId', 'inputHash'],
      },
      write: async (payload) => {
        await importRunRef.set(payload, { merge: true });
      },
    });

    await safeUpdate({
      data: {
        status: 'completed',
        importRunId: importRunRef.id,
        createdCount: prepared.length,
        finishedAt: FieldValue.serverTimestamp(),
        lockExpiresAt: null,
        lastError: FieldValue.delete(),
      },
      context: {
        ...writeContextBase,
        requiredFields: ['status'],
      },
      write: async (payload) => {
        await importJobRef.set(payload, { merge: true });
      },
    });

    const createdTransactions: CreatedTransaction[] = prepared.map((item) => ({
      id: item.id,
      date: item.tx.date,
      description: item.tx.description,
      amount: item.tx.amount,
      ...(item.tx.balanceAfter !== undefined ? { balanceAfter: item.tx.balanceAfter } : {}),
      operationDate: item.tx.operationDate,
      category: item.tx.category,
      document: item.tx.document,
      contactId: item.tx.contactId,
      contactType: item.tx.contactType,
      transactionType: item.tx.transactionType,
      bankAccountId: item.tx.bankAccountId,
      source: item.tx.source,
    }));

    return NextResponse.json({
      success: true,
      idempotent: false,
      createdCount: prepared.length,
      importRunId: importRunRef.id,
      inputHash,
      createdTransactions,
    });
  } catch (error) {
    const sanitizedError = sanitizeErrorMessage(error);
    console.error('[transactions/import] Error processant import:', error);

    await safeUpdate({
      data: {
        status: 'error',
        lastError: sanitizedError,
        finishedAt: FieldValue.serverTimestamp(),
        lockExpiresAt: null,
      },
      context: {
        updatedBy: authResult.uid,
        source: 'import',
        updatedAtFactory: () => FieldValue.serverTimestamp(),
        requiredFields: ['status'],
      },
      write: async (payload) => {
        await importJobRef.set(payload, { merge: true });
      },
    });

    if (error instanceof SafeWriteValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: sanitizedError,
        code: 'IMPORT_FAILED',
      },
      { status: 500 }
    );
  }
}
