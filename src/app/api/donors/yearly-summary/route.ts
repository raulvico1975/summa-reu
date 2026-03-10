import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, validateUserMembership, verifyIdToken } from '@/lib/api/admin-sdk';
import { requirePermission } from '@/lib/api/require-permission';
import type { Transaction } from '@/lib/data';
import { isArchivedTransaction, resolvePeriodRange } from '@/lib/read-models/transactions';

type DonorSummaryItem = {
  donorId: string;
  year: number | null;
  totalDonations: number;
  donationCount: number;
};

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
    code: 'MOVIMENTS_READ_REQUIRED',
    check: (permissions) => permissions['moviments.read'],
  });
  if (denied) return denied;

  const explicitYear = request.nextUrl.searchParams.get('year');
  const year = explicitYear ? Number.parseInt(explicitYear, 10) : null;
  const { start, end } = resolvePeriodRange(request.nextUrl.searchParams);

  let transactionsQuery: FirebaseFirestore.Query = db.collection(`organizations/${orgId}/transactions`);
  if (start || end) {
    transactionsQuery = transactionsQuery.orderBy('date', 'desc');
    if (start) {
      transactionsQuery = transactionsQuery.where('date', '>=', start);
    }
    if (end) {
      transactionsQuery = transactionsQuery.where('date', '<=', end);
    }
  }

  const snapshot = await transactionsQuery.get();
  const grouped = new Map<string, DonorSummaryItem>();

  for (const doc of snapshot.docs) {
    const tx = { id: doc.id, ...doc.data() } as Transaction;
    if (!tx.contactId || tx.contactType !== 'donor') continue;
    if (isArchivedTransaction(tx)) continue;
    if (tx.amount <= 0) continue;

    const current = grouped.get(tx.contactId) ?? {
      donorId: tx.contactId,
      year: Number.isFinite(year) ? year : null,
      totalDonations: 0,
      donationCount: 0,
    };
    current.totalDonations += tx.amount;
    current.donationCount += 1;
    grouped.set(tx.contactId, current);
  }

  return NextResponse.json({
    success: true,
    items: [...grouped.values()].sort(
      (a, b) => b.totalDonations - a.totalDonations || a.donorId.localeCompare(b.donorId)
    ),
    periodStart: start,
    periodEnd: end,
  });
}
