import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { BATCH_SIZE } from '@/lib/api/admin-sdk';
import {
  computeBankImportHash,
  prepareDeterministicTransactions,
  type CanonicalBankImportTx,
} from '@/lib/bank-import/idempotency';
import { safeSet, safeUpdate, SafeWriteValidationError } from '@/lib/safe-write';

export const BANK_IMPORT_LOCK_TTL_MS = 10 * 60 * 1000;

export interface CanonicalBankImportStats {
  duplicateSkippedCount: number;
  candidateCount?: number;
  candidateUserImportedCount?: number;
  candidateUserSkippedCount?: number;
}

export interface ExecuteCanonicalBankImportInput {
  db: Firestore;
  orgId: string;
  bankAccountId: string;
  fileName: string | null;
  source: 'csv' | 'xlsx';
  totalRows: number;
  stats: CanonicalBankImportStats;
  transactions: CanonicalBankImportTx[];
  requestedBy: string;
}

export interface CanonicalCreatedTransaction extends CanonicalBankImportTx {
  id: string;
}

export type ExecuteCanonicalBankImportResult =
  | {
      ok: true;
      idempotent: boolean;
      createdCount: number;
      importRunId: string;
      inputHash: string;
      createdTransactions: CanonicalCreatedTransaction[];
    }
  | {
      ok: false;
      status: 400 | 409 | 500;
      code: string;
      error: string;
      inputHash: string;
    };

interface ImportJobDoc {
  status: 'processing' | 'completed' | 'error';
  inputHash: string;
  lockExpiresAt: FirebaseFirestore.Timestamp | null;
  requestedByUid: string;
  importRunId?: string;
  createdCount?: number;
}

function sanitizeErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 300)
    : 'Error desconegut durant la importació';
}

export function computeCanonicalImportInputHash(
  input: Omit<ExecuteCanonicalBankImportInput, 'db' | 'stats' | 'requestedBy'>
): string {
  return computeBankImportHash({
    orgId: input.orgId,
    bankAccountId: input.bankAccountId,
    source: input.source,
    fileName: input.fileName,
    totalRows: input.totalRows,
    transactions: input.transactions,
  });
}

export async function executeCanonicalBankImport(
  input: ExecuteCanonicalBankImportInput
): Promise<ExecuteCanonicalBankImportResult> {
  const inputHash = computeCanonicalImportInputHash(input);
  const importJobRef = input.db.doc(`organizations/${input.orgId}/importJobs/${inputHash}`);
  const now = Timestamp.now();
  const lockExpiresAt = Timestamp.fromMillis(now.toMillis() + BANK_IMPORT_LOCK_TTL_MS);

  let lockResult:
    | { mode: 'idempotent'; importRunId: string; createdCount: number }
    | { mode: 'locked'; lockedByUid: string }
    | { mode: 'process' };

  try {
    lockResult = await input.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(importJobRef);
      const existing = snapshot.data() as ImportJobDoc | undefined;
      if (existing?.status === 'completed') {
        return {
          mode: 'idempotent' as const,
          importRunId: existing.importRunId ?? inputHash,
          createdCount: existing.createdCount ?? 0,
        };
      }
      if (
        existing?.status === 'processing'
        && existing.lockExpiresAt
        && existing.lockExpiresAt.toMillis() > now.toMillis()
      ) {
        return { mode: 'locked' as const, lockedByUid: existing.requestedByUid };
      }

      await safeSet({
        data: {
          status: 'processing',
          type: 'bankTransactions',
          inputHash,
          orgId: input.orgId,
          bankAccountId: input.bankAccountId,
          source: input.source,
          fileName: input.fileName,
          totalRows: input.totalRows,
          startedAt: now,
          lockExpiresAt,
          requestedByUid: input.requestedBy,
        },
        context: {
          updatedBy: input.requestedBy,
          source: 'import',
          updatedAtFactory: () => FieldValue.serverTimestamp(),
          requiredFields: ['status', 'type', 'inputHash', 'orgId', 'bankAccountId', 'requestedByUid'],
        },
        write: (payload) => transaction.set(importJobRef, payload, { merge: true }),
      });
      return { mode: 'process' as const };
    });
  } catch (error) {
    return {
      ok: false,
      status: error instanceof SafeWriteValidationError ? 400 : 500,
      code: error instanceof SafeWriteValidationError ? error.code : 'IMPORT_LOCK_ERROR',
      error: error instanceof SafeWriteValidationError ? error.message : 'Error intern del servidor',
      inputHash,
    };
  }

  if (lockResult.mode === 'idempotent') {
    return {
      ok: true,
      idempotent: true,
      createdCount: lockResult.createdCount,
      importRunId: lockResult.importRunId,
      inputHash,
      createdTransactions: [],
    };
  }
  if (lockResult.mode === 'locked') {
    return {
      ok: false,
      status: 409,
      code: 'IMPORT_LOCKED',
      error: `Importació en curs per ${lockResult.lockedByUid}. Torna-ho a provar en uns segons.`,
      inputHash,
    };
  }

  const writeContextBase = {
    updatedBy: input.requestedBy,
    source: 'import' as const,
    updatedAtFactory: () => FieldValue.serverTimestamp(),
  };

  try {
    const prepared = prepareDeterministicTransactions(input.transactions, inputHash);
    for (let index = 0; index < prepared.length; index += BATCH_SIZE) {
      const batch = input.db.batch();
      for (const item of prepared.slice(index, index + BATCH_SIZE)) {
        const transactionRef = input.db.doc(
          `organizations/${input.orgId}/transactions/${item.id}`
        );
        await safeSet({
          data: item.tx as unknown as Record<string, unknown>,
          context: {
            ...writeContextBase,
            requiredFields: ['date', 'description', 'amount', 'bankAccountId', 'source'],
            amountFields: ['amount'],
          },
          write: (payload) => batch.set(transactionRef, payload, { merge: true }),
        });
      }
      await batch.commit();
    }

    const dates = prepared.map((item) => item.tx.date).sort((a, b) => a.localeCompare(b));
    const importRunRef = input.db.doc(`organizations/${input.orgId}/importRuns/${inputHash}`);
    await safeSet({
      data: {
        type: 'bankTransactions',
        source: input.source,
        fileName: input.fileName,
        dateMin: dates[0],
        dateMax: dates[dates.length - 1],
        totalRows: input.totalRows,
        createdCount: prepared.length,
        duplicateSkippedCount: input.stats.duplicateSkippedCount,
        ...(input.stats.candidateCount === undefined
          ? {}
          : { candidateCount: input.stats.candidateCount }),
        ...(input.stats.candidateUserImportedCount === undefined
          ? {}
          : { candidateUserImportedCount: input.stats.candidateUserImportedCount }),
        ...(input.stats.candidateUserSkippedCount === undefined
          ? {}
          : { candidateUserSkippedCount: input.stats.candidateUserSkippedCount }),
        createdBy: input.requestedBy,
        bankAccountId: input.bankAccountId,
        inputHash,
        createdAt: FieldValue.serverTimestamp(),
      },
      context: {
        ...writeContextBase,
        requiredFields: ['type', 'source', 'createdBy', 'bankAccountId', 'inputHash'],
      },
      write: (payload) => importRunRef.set(payload, { merge: true }),
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
      context: { ...writeContextBase, requiredFields: ['status'] },
      write: (payload) => importJobRef.set(payload, { merge: true }),
    });

    return {
      ok: true,
      idempotent: false,
      createdCount: prepared.length,
      importRunId: importRunRef.id,
      inputHash,
      createdTransactions: prepared.map((item) => ({ id: item.id, ...item.tx })),
    };
  } catch (error) {
    const sanitizedError = sanitizeErrorMessage(error);
    await safeUpdate({
      data: {
        status: 'error',
        lastError: sanitizedError,
        finishedAt: FieldValue.serverTimestamp(),
        lockExpiresAt: null,
      },
      context: { ...writeContextBase, requiredFields: ['status'] },
      write: (payload) => importJobRef.set(payload, { merge: true }),
    });
    return {
      ok: false,
      status: error instanceof SafeWriteValidationError ? 400 : 500,
      code: error instanceof SafeWriteValidationError ? error.code : 'IMPORT_FAILED',
      error: error instanceof SafeWriteValidationError ? error.message : sanitizedError,
      inputHash,
    };
  }
}
