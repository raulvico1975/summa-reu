import { NextRequest, NextResponse } from 'next/server';
import {
  computeBalance,
  getDashboardLedgerTransactions,
  getOrganizationCategories,
  resolveMissionTransferCategoryId,
} from '@/lib/read-models/analytics';
import { authorizeAnalyticsRequest } from '@/app/api/private/analytics/_shared';

export async function POST(request: NextRequest) {
  const auth = await authorizeAnalyticsRequest(request);
  if (!auth.ok) return auth.response;

  const { db, orgId, body } = auth.context;
  const [ledgerTxs, categories] = await Promise.all([
    getDashboardLedgerTransactions(db, orgId, body.from, body.to),
    getOrganizationCategories(db, orgId),
  ]);

  const missionTransferCategoryId = resolveMissionTransferCategoryId(categories);
  const result = computeBalance(ledgerTxs, missionTransferCategoryId);

  return NextResponse.json({
    success: true,
    ...result,
    period: {
      from: body.from,
      to: body.to,
    },
  });
}
