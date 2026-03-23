import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, validateUserMembership, verifyIdToken } from '@/lib/api/admin-sdk';
import { requirePermission } from '@/lib/api/require-permission';
import type { Transaction } from '@/lib/data';
import {
  decodeTransactionPageCursor,
  encodeTransactionPageCursor,
  hasServerSideTransactionFilters,
  matchesTransactionPageFilters,
  parseTransactionPageFilters,
  resolvePeriodRange,
  type TransactionSearchContext,
} from '@/lib/read-models/transactions';
import {
  serializePublicTransaction,
  type PublicTransactionDto,
} from '@/lib/transactions/public-transaction-dto';
import { isVisibleInMovementsLedger } from '@/lib/transactions/remittance-visibility';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const SCAN_MULTIPLIER = 3;
const MAX_SCAN_LOOPS = 5;
const FILTERED_SCAN_MULTIPLIER = 5;
const FILTERED_MAX_SCAN_LOOPS = 20;

function parseLimit(value: string | null): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

async function loadTransactionSearchContext(
  db: FirebaseFirestore.Firestore,
  orgId: string
): Promise<TransactionSearchContext> {
  const [contactsSnapshot, categoriesSnapshot, projectsSnapshot] = await Promise.all([
    db.collection(`organizations/${orgId}/contacts`).get(),
    db.collection(`organizations/${orgId}/categories`).get(),
    db.collection(`organizations/${orgId}/projects`).get(),
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

interface TransactionPageScanResult {
  transactions: PublicTransactionDto[];
  nextCursor: string | null;
  total: number;
}

async function scanFilteredTransactionsPage({
  baseQuery,
  limit,
  includeTransactions,
  showArchived,
  pageFilters,
  searchContext,
  startAfterDoc,
  scanLimit,
  maxScanLoops,
}: {
  baseQuery: FirebaseFirestore.Query;
  limit: number;
  includeTransactions?: boolean;
  showArchived: boolean;
  pageFilters: ReturnType<typeof parseTransactionPageFilters>;
  searchContext?: TransactionSearchContext;
  startAfterDoc: FirebaseFirestore.QueryDocumentSnapshot | null;
  scanLimit: number;
  maxScanLoops: number;
}): Promise<TransactionPageScanResult> {
  const transactions: PublicTransactionDto[] = [];
  let nextCursor: string | null = null;
  let matchedCount = 0;
  let hasExtraMatch = false;
  let scanCursor = startAfterDoc;

  for (let loop = 0; loop < maxScanLoops; loop += 1) {
    let pageQuery = baseQuery.limit(scanLimit);
    if (scanCursor) {
      pageQuery = pageQuery.startAfter(scanCursor);
    }

    const snapshot = await pageQuery.get();
    if (snapshot.empty) {
      break;
    }

    scanCursor = snapshot.docs[snapshot.docs.length - 1] ?? null;

    for (const doc of snapshot.docs) {
      const rawData = doc.data() as Record<string, unknown>;
      const tx = { id: doc.id, ...rawData } as Transaction;
      if (!isVisibleInMovementsLedger(tx, { showArchived })) continue;
      if (!matchesTransactionPageFilters(tx, pageFilters, searchContext)) continue;

      matchedCount += 1;

      if (includeTransactions !== false && transactions.length < limit) {
        transactions.push(serializePublicTransaction(doc.id, rawData));
        nextCursor = encodeTransactionPageCursor({ id: doc.id });
        continue;
      }

      if (includeTransactions !== false) {
        hasExtraMatch = true;
        break;
      }
    }

    if (hasExtraMatch || snapshot.size < scanLimit) {
      break;
    }
  }

  return {
    transactions,
    nextCursor: hasExtraMatch ? nextCursor : null,
    total: matchedCount,
  };
}

export async function GET(request: NextRequest) {
  const authResult = await verifyIdToken(request);
  if (!authResult) {
    return NextResponse.json({ success: false, code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const orgId = request.nextUrl.searchParams.get('orgId')?.trim() ?? '';
  if (!orgId) {
    return NextResponse.json({ success: false, code: 'MISSING_ORG_ID' }, { status: 400 });
  }

  const db = getAdminDb();
  const membership = await validateUserMembership(db, authResult.uid, orgId);
  const denied = requirePermission(membership, {
    code: 'MOVIMENTS_ROUTE_REQUIRED',
    check: (permissions) => permissions['sections.moviments'] && permissions['moviments.read'],
  });
  if (denied) return denied;

  const limit = parseLimit(request.nextUrl.searchParams.get('limit'));
  const showArchived = request.nextUrl.searchParams.get('showArchived') === 'true';
  const cursor = decodeTransactionPageCursor(request.nextUrl.searchParams.get('cursor'));
  const pageFilters = parseTransactionPageFilters(request.nextUrl.searchParams);
  if (request.nextUrl.searchParams.get('cursor') && !cursor) {
    return NextResponse.json({ success: false, code: 'INVALID_CURSOR' }, { status: 400 });
  }

  const { start, end } = resolvePeriodRange(request.nextUrl.searchParams);

  let baseQuery: FirebaseFirestore.Query = db
    .collection(`organizations/${orgId}/transactions`)
    .orderBy('date', 'desc');

  if (start) {
    baseQuery = baseQuery.where('date', '>=', start);
  }
  if (end) {
    baseQuery = baseQuery.where('date', '<=', end);
  }
  if (pageFilters.contactId) {
    baseQuery = baseQuery.where('contactId', '==', pageFilters.contactId);
  }

  let startAfterDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  if (cursor) {
    const cursorDoc = await db.doc(`organizations/${orgId}/transactions/${cursor.id}`).get();
    if (!cursorDoc.exists) {
      return NextResponse.json({ success: false, code: 'CURSOR_NOT_FOUND' }, { status: 400 });
    }
    startAfterDoc = cursorDoc as FirebaseFirestore.QueryDocumentSnapshot;
  }

  const searchContext = pageFilters.search
    ? await loadTransactionSearchContext(db, orgId)
    : undefined;
  const hasServerFilters = hasServerSideTransactionFilters(pageFilters);
  const scanLimit = Math.min(
    limit * (hasServerFilters ? FILTERED_SCAN_MULTIPLIER : SCAN_MULTIPLIER),
    250
  );
  const maxScanLoops = hasServerFilters ? FILTERED_MAX_SCAN_LOOPS : MAX_SCAN_LOOPS;
  const [{ transactions, nextCursor }, { total }] = await Promise.all([
    scanFilteredTransactionsPage({
      baseQuery,
      limit,
      includeTransactions: true,
      showArchived,
      pageFilters,
      searchContext,
      startAfterDoc,
      scanLimit,
      maxScanLoops,
    }),
    scanFilteredTransactionsPage({
      baseQuery,
      limit: 0,
      includeTransactions: false,
      showArchived,
      pageFilters,
      searchContext,
      startAfterDoc: null,
      scanLimit,
      maxScanLoops: Math.max(maxScanLoops, 100),
    }),
  ]);

  return NextResponse.json({
    success: true,
    transactions,
    nextCursor,
    total,
    limit,
  });
}
