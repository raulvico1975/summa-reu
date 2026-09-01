import { NextResponse, type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/api/admin-sdk';
import {
  authenticateIntegrationRequest,
  createFirestoreIntegrationAuthRepository,
  hashOpaqueValue,
  recordIntegrationAudit,
  type IntegrationAuditResult,
  type IntegrationAuthRepository,
  type IntegrationScope,
} from '@/lib/api/integration-auth';
import {
  resolutionStatus,
  type BankAccountSearchInput,
  type ContactRoleFilter,
  type ContactSearchInput,
  type TransactionDirection,
  type TransactionSearchInput,
} from '@/lib/private-integrations/conversational-search';
import {
  createCanonicalPublicMcpReadService,
  createFirestoreConversationalSearchDataSource,
  type ConversationalSearchDataSource,
} from '@/lib/private-integrations/conversational-pilot-read-service';

export type { ConversationalSearchDataSource } from '@/lib/private-integrations/conversational-pilot-read-service';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const ISO_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

type RequestLike = Pick<NextRequest, 'headers' | 'nextUrl'>;

interface SearchDeps {
  authRepository?: IntegrationAuthRepository;
  dataSource?: ConversationalSearchDataSource;
}

function clean(value: string | null): string {
  return value?.trim() ?? '';
}

function parseLimit(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function parseFiniteNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseRole(value: string | null): ContactRoleFilter | null {
  if (value === null || value === '' || value === 'any') return 'any';
  if (value === 'donor' || value === 'supplier' || value === 'employee') return value;
  return null;
}

function parseDirection(value: string | null): TransactionDirection | null {
  if (value === null || value === '' || value === 'any') return 'any';
  if (value === 'income' || value === 'expense') return value;
  return null;
}

async function audit(
  repository: IntegrationAuthRepository,
  base: Awaited<ReturnType<typeof authenticateIntegrationRequest>>['audit'],
  result: IntegrationAuditResult,
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

function authFailureResult(code: string): IntegrationAuditResult {
  if (code === 'ORG_NOT_ALLOWED') return 'org_denied';
  if (code === 'SCOPE_DENIED') return 'scope_denied';
  if (code === 'MISSING_ORG_ID') return 'bad_request';
  return 'unauthorized';
}

async function authenticate(
  request: RequestLike,
  deps: SearchDeps,
  orgId: string,
  scope: IntegrationScope,
  route: string
) {
  const repository = deps.authRepository ?? createFirestoreIntegrationAuthRepository(getAdminDb());
  const auth = await authenticateIntegrationRequest({
    request,
    orgId,
    requiredScope: scope,
    route,
    repository,
  });
  if (!auth.ok) {
    await audit(repository, auth.audit, authFailureResult(auth.code), auth.status, auth.code);
  }
  return { auth, repository };
}

function successResponse(candidates: unknown[]) {
  return {
    success: true,
    candidates,
    count: candidates.length,
    resolution: resolutionStatus(candidates.length),
    effects: { businessDataMutated: false },
  };
}

export async function handleConversationalBankAccountsSearch(
  request: RequestLike,
  deps: SearchDeps = {}
) {
  const orgId = clean(request.nextUrl.searchParams.get('orgId'));
  const q = clean(request.nextUrl.searchParams.get('q'));
  const input: BankAccountSearchInput = {
    ...(q ? { q } : {}),
    includeArchived: request.nextUrl.searchParams.get('includeArchived') === 'true',
    limit: parseLimit(request.nextUrl.searchParams.get('limit')),
  };
  const { auth, repository } = await authenticate(
    request,
    deps,
    orgId,
    'bank_accounts.search',
    'GET /api/integrations/private/conversational-search/bank-accounts'
  );
  if (!auth.ok) return NextResponse.json({ success: false, code: auth.code }, { status: auth.status });
  if (q && q.length < 2) {
    await audit(repository, auth.audit, 'bad_request', 400, 'INVALID_QUERY');
    return NextResponse.json({ success: false, code: 'INVALID_QUERY' }, { status: 400 });
  }

  const requestKeyHash = hashOpaqueValue(JSON.stringify(input));
  try {
    const service = createCanonicalPublicMcpReadService(
      deps.dataSource ?? createFirestoreConversationalSearchDataSource()
    );
    const candidates = await service.searchBankAccounts(auth.context.orgId, input);
    await audit(repository, auth.audit, 'allowed', 200, 'OK', requestKeyHash);
    return NextResponse.json(successResponse(candidates));
  } catch (error) {
    console.error('[conversational bank accounts search] error', error);
    await audit(repository, auth.audit, 'error', 500, 'INTERNAL_ERROR', requestKeyHash);
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function handleConversationalContactsSearch(
  request: RequestLike,
  deps: SearchDeps = {}
) {
  const orgId = clean(request.nextUrl.searchParams.get('orgId'));
  const q = clean(request.nextUrl.searchParams.get('q'));
  const role = parseRole(request.nextUrl.searchParams.get('role'));
  const input: ContactSearchInput | null = role ? {
    q,
    role,
    includeArchived: request.nextUrl.searchParams.get('includeArchived') === 'true',
    limit: parseLimit(request.nextUrl.searchParams.get('limit')),
  } : null;
  const { auth, repository } = await authenticate(
    request,
    deps,
    orgId,
    'contacts.search',
    'GET /api/integrations/private/conversational-search/contacts'
  );
  if (!auth.ok) return NextResponse.json({ success: false, code: auth.code }, { status: auth.status });
  if (!input || q.length < 2) {
    await audit(repository, auth.audit, 'bad_request', 400, 'INVALID_QUERY');
    return NextResponse.json({ success: false, code: 'INVALID_QUERY' }, { status: 400 });
  }

  const requestKeyHash = hashOpaqueValue(JSON.stringify(input));
  try {
    const service = createCanonicalPublicMcpReadService(
      deps.dataSource ?? createFirestoreConversationalSearchDataSource()
    );
    const candidates = await service.searchContacts(auth.context.orgId, input);
    await audit(repository, auth.audit, 'allowed', 200, 'OK', requestKeyHash);
    return NextResponse.json(successResponse(candidates));
  } catch (error) {
    console.error('[conversational contacts search] error', error);
    await audit(repository, auth.audit, 'error', 500, 'INTERNAL_ERROR', requestKeyHash);
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function handleConversationalTransactionsSearch(
  request: RequestLike,
  deps: SearchDeps = {}
) {
  const params = request.nextUrl.searchParams;
  const orgId = clean(params.get('orgId'));
  const q = clean(params.get('q'));
  const amount = parseFiniteNumber(params.get('amount'));
  const amountTolerance = parseFiniteNumber(params.get('amountTolerance')) ?? 0.01;
  const dateFrom = clean(params.get('dateFrom'));
  const dateTo = clean(params.get('dateTo'));
  const bankAccountId = clean(params.get('bankAccountId'));
  const direction = parseDirection(params.get('direction'));
  const input: TransactionSearchInput | null = direction ? {
    ...(q ? { q } : {}),
    ...(amount !== undefined ? { amount } : {}),
    amountTolerance,
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    ...(bankAccountId ? { bankAccountId } : {}),
    direction,
    includeArchived: params.get('includeArchived') === 'true',
    limit: parseLimit(params.get('limit')),
  } : null;
  const { auth, repository } = await authenticate(
    request,
    deps,
    orgId,
    'transactions.search',
    'GET /api/integrations/private/conversational-search/transactions'
  );
  if (!auth.ok) return NextResponse.json({ success: false, code: auth.code }, { status: auth.status });

  const hasFilter = q.length >= 2
    || amount !== undefined
    || Boolean(dateFrom || dateTo || bankAccountId)
    || (direction !== null && direction !== 'any');
  const invalid = !input
    || (q.length > 0 && q.length < 2)
    || (amount !== undefined && !Number.isFinite(amount))
    || !Number.isFinite(amountTolerance)
    || amountTolerance < 0
    || amountTolerance > 1_000_000
    || Boolean(dateFrom && !ISO_DATE_ONLY_RE.test(dateFrom))
    || Boolean(dateTo && !ISO_DATE_ONLY_RE.test(dateTo))
    || Boolean(dateFrom && dateTo && dateFrom > dateTo)
    || !hasFilter;
  if (invalid) {
    await audit(repository, auth.audit, 'bad_request', 400, 'INVALID_QUERY');
    return NextResponse.json({ success: false, code: 'INVALID_QUERY' }, { status: 400 });
  }

  const requestKeyHash = hashOpaqueValue(JSON.stringify(input));
  try {
    const service = createCanonicalPublicMcpReadService(
      deps.dataSource ?? createFirestoreConversationalSearchDataSource()
    );
    const candidates = await service.searchTransactions(auth.context.orgId, input);
    await audit(repository, auth.audit, 'allowed', 200, 'OK', requestKeyHash);
    return NextResponse.json(successResponse(candidates));
  } catch (error) {
    console.error('[conversational transactions search] error', error);
    await audit(repository, auth.audit, 'error', 500, 'INTERNAL_ERROR', requestKeyHash);
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
