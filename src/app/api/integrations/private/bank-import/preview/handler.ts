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
import {
  prepareBankStatementPreview,
  type BankStatementPreviewDataSource,
  type BankStatementPreviewFile,
  type BankStatementPreviewRow,
} from '@/lib/private-integrations/prepare-only';

const ROUTE_PATH = '/api/integrations/private/bank-import/preview';

type RequestLike = Pick<NextRequest, 'headers' | 'json'>;

interface BankPreviewDeps {
  authRepository?: IntegrationAuthRepository;
  dataSource?: BankStatementPreviewDataSource;
  now?: Date;
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isValidPreviewRow(row: BankStatementPreviewRow, bankAccountId: string): boolean {
  const tx = row?.tx;
  return Number.isInteger(row?.rowIndex)
    && row.rowIndex > 0
    && Boolean(tx)
    && tx.source === 'bank'
    && tx.bankAccountId === bankAccountId
    && /^\d{4}-\d{2}-\d{2}$/.test(tx.operationDate)
    && typeof tx.date === 'string'
    && tx.date.length > 0
    && typeof tx.description === 'string'
    && tx.description.trim().length > 0
    && Number.isFinite(tx.amount)
    && (tx.balanceAfter === undefined || Number.isFinite(tx.balanceAfter));
}

async function audit(
  repository: IntegrationAuthRepository,
  base: Awaited<ReturnType<typeof authenticateIntegrationRequest>>['audit'],
  result: 'allowed' | 'unauthorized' | 'org_denied' | 'scope_denied' | 'bad_request' | 'error',
  status: number,
  code: string,
  requestKeyHash?: string
) {
  await recordIntegrationAudit({
    ...base,
    ...(requestKeyHash ? { requestKeyHash } : {}),
    result,
    status,
    code,
  }, repository);
}

export async function handlePrivateBankImportPreview(
  request: RequestLike,
  deps: BankPreviewDeps = {}
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const source = isObject(body) ? body : {};
  const orgId = cleanString(source.orgId);
  const bankAccountId = cleanString(source.bankAccountId);
  const file = isObject(source.file) ? source.file as unknown as BankStatementPreviewFile : null;
  const rows = Array.isArray(source.rows) ? source.rows as BankStatementPreviewRow[] : null;
  const authRepository = deps.authRepository
    ?? createFirestoreIntegrationAuthRepository(getAdminDb());
  const auth = await authenticateIntegrationRequest({
    request,
    orgId,
    requiredScope: 'bank_import.preview',
    route: `POST ${ROUTE_PATH}`,
    repository: authRepository,
  });

  if (!auth.ok) {
    await audit(
      authRepository,
      auth.audit,
      auth.code === 'ORG_NOT_ALLOWED' ? 'org_denied'
        : auth.code === 'SCOPE_DENIED' ? 'scope_denied'
          : auth.code === 'MISSING_ORG_ID' ? 'bad_request'
            : 'unauthorized',
      auth.status,
      auth.code
    );
    return NextResponse.json({ success: false, code: auth.code }, { status: auth.status });
  }

  if (
    !bankAccountId
    || !file
    || !cleanString(file.name)
    || !/^[a-f0-9]{64}$/.test(cleanString(file.sha256))
    || (file.source !== 'csv' && file.source !== 'xlsx')
    || !Number.isInteger(file.dataRowsCount)
    || !rows
  ) {
    await audit(authRepository, auth.audit, 'bad_request', 400, 'INVALID_REQUEST');
    return NextResponse.json({ success: false, code: 'INVALID_REQUEST' }, { status: 400 });
  }
  if (rows.length === 0 || rows.length > 10_000 || rows.some((row) => !isValidPreviewRow(row, bankAccountId))) {
    await audit(authRepository, auth.audit, 'bad_request', 400, 'INVALID_ROWS');
    return NextResponse.json({ success: false, code: 'INVALID_ROWS' }, { status: 400 });
  }

  const requestKeyHash = hashOpaqueValue(`${orgId}|${bankAccountId}|${file.sha256}`);
  try {
    const preview = await prepareBankStatementPreview(
      { orgId, bankAccountId, file, rows, now: deps.now },
      deps.dataSource ?? createFirestorePrepareDataSource(getAdminDb())
    );
    await audit(authRepository, auth.audit, 'allowed', 200, 'OK', requestKeyHash);
    return NextResponse.json({ success: true, preview });
  } catch (error) {
    console.error('[private bank import preview] error', error);
    await audit(authRepository, auth.audit, 'error', 500, 'INTERNAL_ERROR', requestKeyHash);
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
