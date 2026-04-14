import { NextRequest, NextResponse } from 'next/server';
import {
  computeBalance,
  computeIncomeComposition,
  getDashboardLedgerTransactions,
  getOrganizationCategories,
  getOrganizationContacts,
  getSocialTransactions,
  resolveMissionTransferCategoryId,
} from '@/lib/read-models/analytics';
import { authorizeAnalyticsRequest } from '@/app/api/analytics-private/_shared';

export async function POST(request: NextRequest) {
  const auth = await authorizeAnalyticsRequest(request);
  if (!auth.ok) return auth.response;

  const { db, orgId, body } = auth.context;
  const [ledgerTxs, socialTxs, categories, contacts] = await Promise.all([
    getDashboardLedgerTransactions(db, orgId, body.from, body.to),
    getSocialTransactions(db, orgId, body.from, body.to),
    getOrganizationCategories(db, orgId),
    getOrganizationContacts(db, orgId),
  ]);

  const missionTransferCategoryId = resolveMissionTransferCategoryId(categories);
  const { incomeTotal } = computeBalance(ledgerTxs, missionTransferCategoryId);
  const result = computeIncomeComposition({
    incomeTotal,
    socialTxs,
    contacts,
  });

  return NextResponse.json({
    success: true,
    ...result,
    period: {
      from: body.from,
      to: body.to,
    },
  });
}
