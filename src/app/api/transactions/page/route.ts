import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, validateUserMembership, verifyIdToken } from '@/lib/api/admin-sdk';
import { requirePermission } from '@/lib/api/require-permission';
import type { Transaction } from '@/lib/data';
import {
  decodeTransactionPageCursor,
  encodeTransactionPageCursor,
  isArchivedTransaction,
  resolvePeriodRange,
} from '@/lib/read-models/transactions';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const SCAN_MULTIPLIER = 3;
const MAX_SCAN_LOOPS = 5;

function parseLimit(value: string | null): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
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

  let startAfterDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  if (cursor) {
    const cursorDoc = await db.doc(`organizations/${orgId}/transactions/${cursor.id}`).get();
    if (!cursorDoc.exists) {
      return NextResponse.json({ success: false, code: 'CURSOR_NOT_FOUND' }, { status: 400 });
    }
    startAfterDoc = cursorDoc as FirebaseFirestore.QueryDocumentSnapshot;
  }

  const items: Transaction[] = [];
  let scanCursor = startAfterDoc;
  let nextCursor: string | null = null;
  let exhausted = false;
  const scanLimit = Math.min(limit * SCAN_MULTIPLIER, 250);

  for (let loop = 0; loop < MAX_SCAN_LOOPS && items.length < limit; loop += 1) {
    let pageQuery = baseQuery.limit(scanLimit);
    if (scanCursor) {
      pageQuery = pageQuery.startAfter(scanCursor);
    }

    const snapshot = await pageQuery.get();
    if (snapshot.empty) {
      exhausted = true;
      break;
    }

    scanCursor = snapshot.docs[snapshot.docs.length - 1] ?? null;

    for (const doc of snapshot.docs) {
      const tx = { id: doc.id, ...doc.data() } as Transaction;
      if (!showArchived && isArchivedTransaction(tx)) continue;
      items.push(tx);
      nextCursor = encodeTransactionPageCursor({ id: doc.id });
      if (items.length >= limit) break;
    }

    if (snapshot.size < scanLimit) {
      exhausted = true;
      break;
    }
  }

  return NextResponse.json({
    success: true,
    items,
    nextCursor: exhausted ? null : nextCursor,
  });
}
