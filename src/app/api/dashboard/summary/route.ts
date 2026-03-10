import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, validateUserMembership, verifyIdToken } from '@/lib/api/admin-sdk';
import { requirePermission } from '@/lib/api/require-permission';
import { canViewFinancialDashboard } from '@/lib/can-view-financial-dashboard';
import type { Transaction } from '@/lib/data';
import { buildDashboardSummary, resolvePeriodRange } from '@/lib/read-models/transactions';

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
    code: 'DASHBOARD_FINANCIAL_READ_REQUIRED',
    check: (permissions) =>
      permissions['sections.dashboard'] && canViewFinancialDashboard(permissions),
  });
  if (denied) return denied;

  const { start, end } = resolvePeriodRange(request.nextUrl.searchParams);

  let transactionsQuery: FirebaseFirestore.Query = db
    .collection(`organizations/${orgId}/transactions`)
    .orderBy('date', 'desc');

  if (start) {
    transactionsQuery = transactionsQuery.where('date', '>=', start);
  }
  if (end) {
    transactionsQuery = transactionsQuery.where('date', '<=', end);
  }

  const [transactionsSnap, missionTransferCategoriesSnap] = await Promise.all([
    transactionsQuery.get(),
    db
      .collection(`organizations/${orgId}/categories`)
      .where('systemKey', '==', 'missionTransfers')
      .limit(1)
      .get(),
  ]);

  const transactions = transactionsSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as Transaction
  );
  const missionTransferCategoryId = missionTransferCategoriesSnap.docs[0]?.id ?? null;
  const summary = buildDashboardSummary(transactions, missionTransferCategoryId);

  return NextResponse.json({
    success: true,
    ...summary,
    periodStart: start,
    periodEnd: end,
  });
}
