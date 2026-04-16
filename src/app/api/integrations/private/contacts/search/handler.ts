import { NextResponse, type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/api/admin-sdk';
import {
  authenticateIntegrationRequest,
  createFirestoreIntegrationAuthRepository,
  recordIntegrationAudit,
  type IntegrationAuditResult,
  type IntegrationAuthRepository,
} from '@/lib/api/integration-auth';

const ROUTE_PATH = '/api/integrations/private/contacts/search';
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MIN_QUERY_LENGTH = 2;

type ContactRoleFlags = {
  donor?: boolean;
  supplier?: boolean;
  employee?: boolean;
};

type ContactType = 'donor' | 'supplier' | 'employee';
type DonorStatus = 'active' | 'pending_return' | 'inactive';

export interface IntegrationContactRecord {
  id: string;
  name: string;
  taxId: string;
  email: string | null;
  iban: string | null;
  type: ContactType;
  roles?: ContactRoleFlags | null;
  status?: DonorStatus | null;
  archivedAt?: string | null;
}

export interface IntegrationContactDto {
  id: string;
  name: string;
  taxId: string;
  email: string | null;
  iban: string | null;
  type: ContactType;
  roles: ContactRoleFlags;
  status: DonorStatus | null;
}

type RequestLike = Pick<NextRequest, 'headers' | 'nextUrl'>;

interface SearchParams {
  orgId: string | null;
  q: string;
  includeArchived: boolean;
  limit: number;
}

interface ContactsSearchDeps {
  authRepository?: IntegrationAuthRepository;
  listContactsFn?: (orgId: string) => Promise<IntegrationContactRecord[]>;
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeCompactValue(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

function parseLimit(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function parseSearchParams(request: RequestLike): SearchParams {
  return {
    orgId: request.nextUrl.searchParams.get('orgId')?.trim() ?? null,
    q: request.nextUrl.searchParams.get('q')?.trim() ?? '',
    includeArchived: request.nextUrl.searchParams.get('includeArchived') === 'true',
    limit: parseLimit(request.nextUrl.searchParams.get('limit')),
  };
}

function normalizeRoles(contact: IntegrationContactRecord): ContactRoleFlags {
  const baseRoles =
    contact.roles && typeof contact.roles === 'object'
      ? { ...contact.roles }
      : {};

  baseRoles[contact.type] = true;
  return {
    donor: baseRoles.donor === true || undefined,
    supplier: baseRoles.supplier === true || undefined,
    employee: baseRoles.employee === true || undefined,
  };
}

function toContactDto(contact: IntegrationContactRecord): IntegrationContactDto {
  return {
    id: contact.id,
    name: contact.name,
    taxId: contact.taxId,
    email: contact.email ?? null,
    iban: contact.iban ?? null,
    type: contact.type,
    roles: normalizeRoles(contact),
    status: contact.status ?? null,
  };
}

function matchesContactSearch(contact: IntegrationContactRecord, query: string): boolean {
  const normalizedQuery = normalizeSearchValue(query);
  const compactQuery = normalizeCompactValue(query);
  const fields = [
    normalizeSearchValue(contact.name),
    normalizeSearchValue(contact.taxId),
    normalizeSearchValue(contact.email ?? ''),
    normalizeSearchValue(contact.iban ?? ''),
  ];
  const compactFields = [
    normalizeCompactValue(contact.taxId),
    normalizeCompactValue(contact.iban ?? ''),
  ];

  return (
    fields.some((value) => value.includes(normalizedQuery)) ||
    compactFields.some((value) => compactQuery !== '' && value.includes(compactQuery))
  );
}

export function searchContacts(
  contacts: IntegrationContactRecord[],
  params: SearchParams
): IntegrationContactDto[] {
  return contacts
    .filter((contact) => params.includeArchived || !contact.archivedAt)
    .filter((contact) => matchesContactSearch(contact, params.q))
    .sort((a, b) => a.name.localeCompare(b.name, 'ca'))
    .slice(0, params.limit)
    .map(toContactDto);
}

async function listContactsFromFirestore(orgId: string): Promise<IntegrationContactRecord[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(`organizations/${orgId}/contacts`)
    .select('name', 'taxId', 'email', 'iban', 'type', 'roles', 'status', 'archivedAt')
    .get();

  return snapshot.docs.flatMap((doc) => {
    const data = doc.data();
    if (
      typeof data.name !== 'string' ||
      typeof data.taxId !== 'string' ||
      (data.type !== 'donor' && data.type !== 'supplier' && data.type !== 'employee')
    ) {
      return [];
    }

    return [{
      id: doc.id,
      name: data.name,
      taxId: data.taxId,
      email: typeof data.email === 'string' ? data.email : null,
      iban: typeof data.iban === 'string' ? data.iban : null,
      type: data.type,
      roles: data.roles && typeof data.roles === 'object'
        ? (data.roles as ContactRoleFlags)
        : undefined,
      status:
        data.status === 'active' || data.status === 'pending_return' || data.status === 'inactive'
          ? data.status
          : null,
      archivedAt: typeof data.archivedAt === 'string' ? data.archivedAt : null,
    }];
  });
}

async function auditRoute(
  repository: IntegrationAuthRepository,
  audit: Awaited<ReturnType<typeof authenticateIntegrationRequest>>['audit'],
  result: IntegrationAuditResult,
  status: number,
  code: string
): Promise<void> {
  await recordIntegrationAudit(
    {
      ...audit,
      result,
      status,
      code,
    },
    repository
  );
}

export async function handlePrivateContactsSearch(
  request: RequestLike,
  deps: ContactsSearchDeps = {}
) {
  const authRepository = deps.authRepository ?? createFirestoreIntegrationAuthRepository(getAdminDb());
  const params = parseSearchParams(request);
  const auth = await authenticateIntegrationRequest({
    request,
    orgId: params.orgId,
    requiredScope: 'contacts.read',
    route: `GET ${ROUTE_PATH}`,
    repository: authRepository,
  });

  if (!auth.ok) {
    await auditRoute(
      authRepository,
      auth.audit,
      auth.code === 'ORG_NOT_ALLOWED'
        ? 'org_denied'
        : auth.code === 'SCOPE_DENIED'
          ? 'scope_denied'
          : auth.code === 'MISSING_ORG_ID'
            ? 'bad_request'
            : 'unauthorized',
      auth.status,
      auth.code
    );

    return NextResponse.json(
      { success: false, code: auth.code },
      { status: auth.status }
    );
  }

  if (params.q.length < MIN_QUERY_LENGTH) {
    await auditRoute(authRepository, auth.audit, 'bad_request', 400, 'INVALID_QUERY');
    return NextResponse.json(
      {
        success: false,
        code: 'INVALID_QUERY',
        error: `q must contain at least ${MIN_QUERY_LENGTH} characters`,
      },
      { status: 400 }
    );
  }

  try {
    const listContactsFn = deps.listContactsFn ?? listContactsFromFirestore;
    const contacts = await listContactsFn(auth.context.orgId);
    const results = searchContacts(contacts, params);

    await auditRoute(authRepository, auth.audit, 'allowed', 200, 'OK');
    return NextResponse.json({
      success: true,
      contacts: results,
      limit: params.limit,
    });
  } catch (error) {
    console.error('[private contacts search] error', error);
    await auditRoute(authRepository, auth.audit, 'error', 500, 'INTERNAL_ERROR');
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
