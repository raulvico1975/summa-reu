import { NextResponse, type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/api/admin-sdk';
import {
  authenticateIntegrationRequest,
  createFirestoreIntegrationAuthRepository,
  hashOpaqueValue,
  recordIntegrationAudit,
  type IntegrationAuthRepository,
} from '@/lib/api/integration-auth';
import { createFirestorePrepareDataSource } from '@/lib/private-integrations/firestore-prepare-data-source';
import { createFirestoreBankImportPlanStore } from '@/lib/private-integrations/firestore-bank-import-plan-store';
import {
  prepareBankImportPlan,
  type BankImportPlanStore,
} from '@/lib/private-integrations/bank-import-plan';
import type {
  BankStatementPreviewDataSource,
  BankStatementPreviewFile,
  BankStatementPreviewRow,
} from '@/lib/private-integrations/prepare-only';

const ROUTE = 'POST /api/integrations/private/bank-import/plan';
type RequestLike = Pick<NextRequest, 'headers' | 'json'>;

interface Deps {
  authRepository?: IntegrationAuthRepository;
  dataSource?: BankStatementPreviewDataSource;
  planStore?: BankImportPlanStore;
  now?: Date;
  planIdFactory?: () => string;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function handlePrivateBankImportPlan(request: RequestLike, deps: Deps = {}) {
  let raw: unknown = null;
  try { raw = await request.json(); } catch { /* invalid below */ }
  const body = object(raw);
  const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';
  const bankAccountId = typeof body.bankAccountId === 'string' ? body.bankAccountId.trim() : '';
  const file = object(body.file) as unknown as BankStatementPreviewFile;
  const rows = Array.isArray(body.rows) ? body.rows as BankStatementPreviewRow[] : [];
  const selectedRowIndexes = Array.isArray(body.selectedRowIndexes)
    ? body.selectedRowIndexes as number[]
    : [];
  const repository = deps.authRepository ?? createFirestoreIntegrationAuthRepository(getAdminDb());
  const auth = await authenticateIntegrationRequest({
    request,
    orgId,
    requiredScope: 'bank_import.prepare',
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
  if (
    !bankAccountId
    || !file
    || typeof file.name !== 'string'
    || !/^[a-f0-9]{64}$/.test(file.sha256 ?? '')
    || (file.source !== 'csv' && file.source !== 'xlsx')
    || rows.length === 0
    || selectedRowIndexes.length === 0
  ) {
    await recordIntegrationAudit({ ...auth.audit, result: 'bad_request', code: 'INVALID_REQUEST', status: 400 }, repository);
    return NextResponse.json({ success: false, code: 'INVALID_REQUEST' }, { status: 400 });
  }

  const requestKeyHash = hashOpaqueValue(`${bankAccountId}|${file.sha256}|${selectedRowIndexes.join(',')}`);
  try {
    const db = deps.dataSource && deps.planStore ? null : getAdminDb();
    const result = await prepareBankImportPlan({
      orgId,
      tokenId: auth.context.tokenId,
      bankAccountId,
      file,
      rows,
      selectedRowIndexes,
      now: deps.now,
      planIdFactory: deps.planIdFactory,
    }, deps.dataSource ?? createFirestorePrepareDataSource(db!), deps.planStore ?? createFirestoreBankImportPlanStore(db!));
    if (!result.prepared) {
      await recordIntegrationAudit({ ...auth.audit, requestKeyHash, result: 'conflict', code: result.code, status: 409 }, repository);
      return NextResponse.json({ success: false, code: result.code, blockers: result.blockers ?? [] }, { status: 409 });
    }
    const plan = result.plan;
    await recordIntegrationAudit({ ...auth.audit, requestKeyHash, resourceId: plan.planId, result: 'allowed', code: 'PLAN_PREPARED', status: 201 }, repository);
    return NextResponse.json({
      success: true,
      plan: {
        planId: plan.planId,
        status: plan.status,
        bankAccount: { id: plan.bankAccountId, name: plan.bankAccountName },
        file: { name: plan.fileName, sha256: plan.fileSha256, source: plan.fileSource },
        inputHash: plan.inputHash,
        selectionHash: plan.selectionHash,
        selectedRowIndexes: plan.selectedRowIndexes,
        selectedCount: plan.selectedRows.length,
        totals: {
          income: plan.selectedRows.filter((row) => row.tx.amount > 0).reduce((sum, row) => sum + row.tx.amount, 0),
          expense: plan.selectedRows.filter((row) => row.tx.amount < 0).reduce((sum, row) => sum + row.tx.amount, 0),
        },
        duplicateSkippedCount: plan.duplicateSkippedCount,
        candidateSkippedCount: plan.candidateSkippedCount,
        expiresAt: plan.expiresAt,
        confirmationText: plan.confirmationText,
      },
      effects: { businessDataMutated: false, planPersisted: true, imported: false },
    }, { status: 201 });
  } catch (error) {
    console.error('[private bank import plan] error', error);
    await recordIntegrationAudit({ ...auth.audit, requestKeyHash, result: 'error', code: 'INTERNAL_ERROR', status: 500 }, repository);
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
