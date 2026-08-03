import { NextResponse, type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/api/admin-sdk';
import {
  authenticateIntegrationRequest,
  createFirestoreIntegrationAuthRepository,
  hashOpaqueValue,
  recordIntegrationAudit,
  type IntegrationAuthRepository,
} from '@/lib/api/integration-auth';
import { executeCanonicalBankImport } from '@/lib/bank-import/execute-canonical-import';
import { createFirestorePrepareDataSource } from '@/lib/private-integrations/firestore-prepare-data-source';
import { createFirestoreBankImportPlanStore } from '@/lib/private-integrations/firestore-bank-import-plan-store';
import {
  commitBankImportPlan,
  type BankImportExecutor,
  type BankImportPlanStore,
} from '@/lib/private-integrations/bank-import-plan';
import type { BankStatementPreviewDataSource } from '@/lib/private-integrations/prepare-only';

const ROUTE = 'POST /api/integrations/private/bank-import/commit';
type RequestLike = Pick<NextRequest, 'headers' | 'json'>;

interface Deps {
  authRepository?: IntegrationAuthRepository;
  dataSource?: BankStatementPreviewDataSource;
  planStore?: BankImportPlanStore;
  executor?: BankImportExecutor;
  now?: Date;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function statusFor(code: string): 400 | 404 | 409 {
  if (code === 'PLAN_NOT_FOUND') return 404;
  if (code === 'HUMAN_CONFIRMATION_REQUIRED' || code === 'EXPLICIT_SELECTION_REQUIRED') return 400;
  return 409;
}

export async function handlePrivateBankImportCommit(request: RequestLike, deps: Deps = {}) {
  let raw: unknown = null;
  try { raw = await request.json(); } catch { /* invalid below */ }
  const body = object(raw);
  const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';
  const repository = deps.authRepository ?? createFirestoreIntegrationAuthRepository(getAdminDb());
  const auth = await authenticateIntegrationRequest({
    request,
    orgId,
    requiredScope: 'bank_import.commit',
    route: ROUTE,
    repository,
  });
  if (!auth.ok) {
    await recordIntegrationAudit({
      ...auth.audit,
      result: auth.code === 'ORG_NOT_ALLOWED' ? 'org_denied'
        : auth.code === 'SCOPE_DENIED' ? 'scope_denied'
          : auth.code === 'MISSING_ORG_ID' ? 'bad_request' : 'unauthorized',
      code: auth.code,
      status: auth.status,
    }, repository);
    return NextResponse.json({ success: false, code: auth.code }, { status: auth.status });
  }

  const input = {
    orgId,
    tokenId: auth.context.tokenId,
    planId: typeof body.planId === 'string' ? body.planId.trim() : '',
    bankAccountId: typeof body.bankAccountId === 'string' ? body.bankAccountId.trim() : '',
    fileSha256: typeof body.fileSha256 === 'string' ? body.fileSha256.trim() : '',
    inputHash: typeof body.inputHash === 'string' ? body.inputHash.trim() : '',
    selectedRowIndexes: Array.isArray(body.selectedRowIndexes) ? body.selectedRowIndexes as number[] : [],
    confirmationText: typeof body.confirmationText === 'string' ? body.confirmationText : '',
    humanConfirmed: body.humanConfirmed === true,
    now: deps.now,
  };
  if (!input.planId || !input.bankAccountId || !/^[a-f0-9]{64}$/.test(input.fileSha256) || !/^[a-f0-9]{64}$/.test(input.inputHash)) {
    await recordIntegrationAudit({ ...auth.audit, result: 'bad_request', code: 'INVALID_REQUEST', status: 400 }, repository);
    return NextResponse.json({ success: false, code: 'INVALID_REQUEST' }, { status: 400 });
  }

  const requestKeyHash = hashOpaqueValue(`${input.planId}|${input.inputHash}|${input.selectedRowIndexes.join(',')}`);
  const db = deps.dataSource && deps.planStore && deps.executor ? null : getAdminDb();
  const store = deps.planStore ?? createFirestoreBankImportPlanStore(db!);
  const executor = deps.executor ?? {
    async execute(plan) {
      const result = await executeCanonicalBankImport({
        db: db!,
        orgId: plan.orgId,
        bankAccountId: plan.bankAccountId,
        fileName: plan.fileName,
        source: plan.fileSource,
        totalRows: plan.totalSourceRows,
        stats: {
          duplicateSkippedCount: plan.duplicateSkippedCount,
          candidateCount: plan.candidateSkippedCount,
          candidateUserImportedCount: 0,
          candidateUserSkippedCount: plan.candidateSkippedCount,
        },
        transactions: plan.selectedRows.map((row) => row.tx),
        requestedBy: `integration:${plan.tokenId}`,
      });
      return result.ok
        ? {
            ok: true as const,
            idempotent: result.idempotent,
            importRunId: result.importRunId,
            importedIds: result.createdTransactions.map((transaction) => transaction.id),
          }
        : { ok: false as const, code: result.code };
    },
  };

  try {
    const result = await commitBankImportPlan(
      input,
      deps.dataSource ?? createFirestorePrepareDataSource(db!),
      store,
      executor
    );
    if (!result.committed) {
      const status = statusFor(result.code);
      await recordIntegrationAudit({ ...auth.audit, requestKeyHash, resourceId: input.planId, result: 'conflict', code: result.code, status }, repository);
      return NextResponse.json({ success: false, code: result.code }, { status });
    }
    await recordIntegrationAudit({ ...auth.audit, requestKeyHash, resourceId: input.planId, result: 'allowed', code: 'IMPORT_COMMITTED', status: 200 }, repository);
    return NextResponse.json({
      success: true,
      committed: true,
      idempotent: result.idempotent,
      planId: input.planId,
      importRunId: result.importRunId,
      createdCount: result.importedIds.length,
      importedIds: result.importedIds,
      effects: { businessDataMutated: true, imported: true },
    });
  } catch (error) {
    console.error('[private bank import commit] error', error);
    await store.block({ planId: input.planId, now: (deps.now ?? new Date()).toISOString(), reason: 'INTERNAL_ERROR' }).catch(() => undefined);
    await recordIntegrationAudit({ ...auth.audit, requestKeyHash, resourceId: input.planId, result: 'error', code: 'INTERNAL_ERROR', status: 500 }, repository);
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
