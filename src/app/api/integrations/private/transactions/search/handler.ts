import { NextResponse, type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/api/admin-sdk';
import {
  authenticateIntegrationRequest,
  createFirestoreIntegrationAuthRepository,
  recordIntegrationAudit,
  type IntegrationAuditResult,
  type IntegrationAuthRepository,
} from '@/lib/api/integration-auth';
import type { Transaction } from '@/lib/data';
import {
  decodeTransactionPageCursor,
  encodeTransactionPageCursor,
  matchesTransactionPageFilters,
  type TransactionSearchContext,
} from '@/lib/read-models/transactions';
import {
  serializePublicTransaction,
  type PublicTransactionDto,
} from '@/lib/transactions/public-transaction-dto';
import { isVisibleInMovementsLedger } from '@/lib/transactions/remittance-visibility';

const ROUTE_PATH = '/api/integrations/private/transactions/search';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const SCAN_MULTIPLIER = 5;
const MAX_SCAN_LOOPS = 20;
const ISO_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

type RequestLike = Pick<NextRequest, 'headers' | 'nextUrl'>;

export interface IntegrationTransactionDto {
  id: string;
  date: string;
  amount: number;
  description: string;
  contactId: string | null;
  contactType: 'donor' | 'supplier' | 'employee' | null;
  category: string | null;
  projectId: string | null;
  bankAccountId: string | null;
  source: 'bank' | 'remittance' | 'manual' | 'stripe' | null;
  transactionType: 'normal' | 'return' | 'return_fee' | 'donation' | 'fee' | null;
  document: string | null;
}

export interface IntegrationTransactionPageDoc {
  id: string;
  data: Record<string, unknown>;
}

export interface TransactionsSearchDataSource {
  fetchPage(args: {
    orgId: string;
    limit: number;
    cursorId: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  }): Promise<IntegrationTransactionPageDoc[]>;
  loadSearchContext(orgId: string): Promise<TransactionSearchContext>;
}

interface SearchParams {
  orgId: string | null;
  q: string;
  contactId: string | null;
  bankAccountId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  includeArchived: boolean;
  limit: number;
  cursorId: string | null;
  cursorError: boolean;
  dateError: boolean;
}

interface TransactionsSearchDeps {
  authRepository?: IntegrationAuthRepository;
  dataSource?: TransactionsSearchDataSource;
}

class CursorNotFoundError extends Error {}

function normalizeString(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed || null;
}

function parseLimit(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function parseSearchParams(request: RequestLike): SearchParams {
  const rawCursor = request.nextUrl.searchParams.get('cursor');
  const decodedCursor = decodeTransactionPageCursor(rawCursor);
  const dateFrom = normalizeString(request.nextUrl.searchParams.get('dateFrom'));
  const dateTo = normalizeString(request.nextUrl.searchParams.get('dateTo'));

  return {
    orgId: normalizeString(request.nextUrl.searchParams.get('orgId')),
    q: request.nextUrl.searchParams.get('q')?.trim() ?? '',
    contactId: normalizeString(request.nextUrl.searchParams.get('contactId')),
    bankAccountId: normalizeString(request.nextUrl.searchParams.get('bankAccountId')),
    dateFrom,
    dateTo,
    includeArchived: request.nextUrl.searchParams.get('includeArchived') === 'true',
    limit: parseLimit(request.nextUrl.searchParams.get('limit')),
    cursorId: decodedCursor?.id ?? null,
    cursorError: Boolean(rawCursor) && !decodedCursor,
    dateError:
      Boolean(dateFrom && !ISO_DATE_ONLY_RE.test(dateFrom)) ||
      Boolean(dateTo && !ISO_DATE_ONLY_RE.test(dateTo)),
  };
}

function toIntegrationTransactionDto(transaction: PublicTransactionDto): IntegrationTransactionDto {
  return {
    id: transaction.id,
    date: transaction.date,
    amount: transaction.amount,
    description: transaction.description,
    contactId: transaction.contactId,
    contactType: transaction.contactType,
    category: transaction.category,
    projectId: transaction.projectId,
    bankAccountId: transaction.bankAccountId,
    source: transaction.source,
    transactionType: transaction.transactionType,
    document: transaction.document,
  };
}

export async function searchTransactionsPage(
  dataSource: TransactionsSearchDataSource,
  params: SearchParams
): Promise<{ transactions: IntegrationTransactionDto[]; nextCursor: string | null }> {
  const filters = {
    search: params.q,
    movementType: null,
    contactId: params.contactId,
    categoryId: null,
    source: null,
    bankAccountId: params.bankAccountId,
  };

  const searchContext =
    params.q.length > 0 ? await dataSource.loadSearchContext(params.orgId ?? '') : undefined;

  const transactions: IntegrationTransactionDto[] = [];
  const scanLimit = Math.min(params.limit * SCAN_MULTIPLIER, 250);
  let cursorId = params.cursorId;
  let lastIncludedCursor: string | null = null;

  for (let loop = 0; loop < MAX_SCAN_LOOPS; loop += 1) {
    const page = await dataSource.fetchPage({
      orgId: params.orgId ?? '',
      limit: scanLimit,
      cursorId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    });

    if (page.length === 0) {
      break;
    }

    cursorId = page[page.length - 1]?.id ?? null;

    for (const doc of page) {
      const tx = { id: doc.id, ...doc.data } as Transaction;
      if (!isVisibleInMovementsLedger(tx, { showArchived: params.includeArchived })) {
        continue;
      }

      if (!matchesTransactionPageFilters(tx, filters, searchContext)) {
        continue;
      }

      const serialized = toIntegrationTransactionDto(serializePublicTransaction(doc.id, doc.data));
      if (transactions.length < params.limit) {
        transactions.push(serialized);
        lastIncludedCursor = encodeTransactionPageCursor({ id: doc.id });
        continue;
      }

      return {
        transactions,
        nextCursor: lastIncludedCursor,
      };
    }

    if (page.length < scanLimit) {
      break;
    }
  }

  return {
    transactions,
    nextCursor: null,
  };
}

async function loadSearchContextFromFirestore(orgId: string): Promise<TransactionSearchContext> {
  const db = getAdminDb();
  const [contactsSnapshot, categoriesSnapshot, projectsSnapshot] = await Promise.all([
    db.collection(`organizations/${orgId}/contacts`).select('name').get(),
    db.collection(`organizations/${orgId}/categories`).select('name').get(),
    db.collection(`organizations/${orgId}/projects`).select('name').get(),
  ]);

  const contactNamesById = contactsSnapshot.docs.reduce<Record<string, string>>((acc, doc) => {
    const name = doc.get('name');
    if (typeof name === 'string' && name.trim()) {
      acc[doc.id] = name;
    }
    return acc;
  }, {});

  const categoryLabelsById = categoriesSnapshot.docs.reduce<Record<string, string>>((acc, doc) => {
    const name = doc.get('name');
    if (typeof name === 'string' && name.trim()) {
      acc[doc.id] = name;
    }
    return acc;
  }, {});

  const projectNamesById = projectsSnapshot.docs.reduce<Record<string, string>>((acc, doc) => {
    const name = doc.get('name');
    if (typeof name === 'string' && name.trim()) {
      acc[doc.id] = name;
    }
    return acc;
  }, {});

  return {
    contactNamesById,
    categoryLabelsById,
    projectNamesById,
  };
}

function createFirestoreDataSource(): TransactionsSearchDataSource {
  return {
    async fetchPage({ orgId, limit, cursorId, dateFrom, dateTo }) {
      const db = getAdminDb();
      let query: FirebaseFirestore.Query = db
        .collection(`organizations/${orgId}/transactions`)
        .orderBy('date', 'desc')
        .limit(limit);

      if (dateFrom) {
        query = query.where('date', '>=', dateFrom);
      }
      if (dateTo) {
        query = query.where('date', '<=', dateTo);
      }

      if (cursorId) {
        const cursorDoc = await db.doc(`organizations/${orgId}/transactions/${cursorId}`).get();
        if (!cursorDoc.exists) {
          throw new CursorNotFoundError('Cursor document not found');
        }
        query = query.startAfter(cursorDoc);
      }

      const snapshot = await query.get();
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        data: doc.data() as Record<string, unknown>,
      }));
    },

    loadSearchContext: loadSearchContextFromFirestore,
  };
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

export async function handlePrivateTransactionsSearch(
  request: RequestLike,
  deps: TransactionsSearchDeps = {}
) {
  const authRepository = deps.authRepository ?? createFirestoreIntegrationAuthRepository(getAdminDb());
  const dataSource = deps.dataSource ?? createFirestoreDataSource();
  const params = parseSearchParams(request);
  const auth = await authenticateIntegrationRequest({
    request,
    orgId: params.orgId,
    requiredScope: 'transactions.read',
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

  if (params.cursorError) {
    await auditRoute(authRepository, auth.audit, 'bad_request', 400, 'INVALID_CURSOR');
    return NextResponse.json(
      { success: false, code: 'INVALID_CURSOR' },
      { status: 400 }
    );
  }

  if (params.dateError) {
    await auditRoute(authRepository, auth.audit, 'bad_request', 400, 'INVALID_DATE');
    return NextResponse.json(
      { success: false, code: 'INVALID_DATE' },
      { status: 400 }
    );
  }

  try {
    const { transactions, nextCursor } = await searchTransactionsPage(dataSource, params);
    await auditRoute(authRepository, auth.audit, 'allowed', 200, 'OK');

    return NextResponse.json({
      success: true,
      transactions,
      nextCursor,
      limit: params.limit,
    });
  } catch (error) {
    if (error instanceof CursorNotFoundError) {
      await auditRoute(authRepository, auth.audit, 'bad_request', 400, 'CURSOR_NOT_FOUND');
      return NextResponse.json(
        { success: false, code: 'CURSOR_NOT_FOUND' },
        { status: 400 }
      );
    }

    console.error('[private transactions search] error', error);
    await auditRoute(authRepository, auth.audit, 'error', 500, 'INTERNAL_ERROR');
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
