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
import {
  getAdminDb,
  verifyIdToken,
  validateUserMembership,
} from '@/lib/api/admin-sdk';
import { requirePermission } from '@/lib/api/require-permission';
import type { CanonicalBankImportTx } from '@/lib/bank-import/idempotency';
import { executeCanonicalBankImport } from '@/lib/bank-import/execute-canonical-import';
import {
  canonicalizeBankImportTransaction,
  type BankImportContactType as ContactType,
  type BankImportTransactionInput as ImportTransactionInput,
  type BankImportTransactionType as TransactionType,
} from '@/lib/bank-import/canonicalize';

const MAX_TRANSACTIONS_PER_REQUEST = 2000;

type ImportSource = 'csv' | 'xlsx';

interface ImportRequestStats {
  duplicateSkippedCount: number;
  candidateCount?: number;
  candidateUserImportedCount?: number;
  candidateUserSkippedCount?: number;
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
    const normalized = canonicalizeBankImportTransaction(tx, parsedBody.bankAccountId, i);

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

  const result = await executeCanonicalBankImport({
    db,
    orgId: parsedBody.orgId,
    bankAccountId: parsedBody.bankAccountId,
    fileName: parsedBody.fileName,
    source: parsedBody.source,
    totalRows: parsedBody.totalRows,
    stats: parsedBody.stats,
    transactions: normalizedTransactions,
    requestedBy: authResult.uid,
  });
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error, code: result.code },
      { status: result.status }
    );
  }
  return NextResponse.json({ success: true, ...result });
}
