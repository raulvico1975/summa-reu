import { NextRequest, NextResponse } from 'next/server';
import {
  computeMonthlyEvolution,
  getDashboardLedgerTransactions,
  getOrganizationCategories,
  resolveMissionTransferCategoryId,
} from '@/lib/read-models/analytics';
import { authorizeAnalyticsRequest } from '@/app/api/analytics-private/_shared';

export async function POST(request: NextRequest) {
  const auth = await authorizeAnalyticsRequest(request);
  if (!auth.ok) return auth.response;

  const { db, orgId, body } = auth.context;
  const [ledgerTxs, categories] = await Promise.all([
    getDashboardLedgerTransactions(db, orgId, body.from, body.to),
    getOrganizationCategories(db, orgId),
  ]);

  const missionTransferCategoryId = resolveMissionTransferCategoryId(categories);
  const result = computeMonthlyEvolution(
    ledgerTxs,
    body.from,
    body.to,
    missionTransferCategoryId
  );

  return NextResponse.json({
    success: true,
    ...result,
    period: {
      from: body.from,
      to: body.to,
    },
  });
}
