import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, validateUserMembership, verifyIdToken } from '@/lib/api/admin-sdk';
import { requirePermission } from '@/lib/api/require-permission';
import { serializePublicTransaction } from '@/lib/transactions/public-transaction-dto';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 300;

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

  const limit = parseLimit(request.nextUrl.searchParams.get('limit'));

  const db = getAdminDb();
  const membership = await validateUserMembership(db, authResult.uid, orgId);
  const denied = requirePermission(membership, {
    code: 'MOVIMENTS_ROUTE_REQUIRED',
    // Guard crític d'API: /moviments només amb secció i lectura bancària.
    check: (permissions) => permissions['sections.moviments'] && permissions['moviments.read'],
  });
  if (denied) return denied;

  const snapshot = await db
    .collection(`organizations/${orgId}/transactions`)
    .orderBy('date', 'desc')
    .limit(limit)
    .get();

  const items = snapshot.docs.map((doc) =>
    serializePublicTransaction(doc.id, doc.data() as Record<string, unknown>)
  );
  return NextResponse.json({ success: true, items });
}
