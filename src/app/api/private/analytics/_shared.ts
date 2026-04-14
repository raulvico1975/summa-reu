import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, validateUserMembership, verifyIdToken } from '@/lib/api/admin-sdk';
import { requirePermission } from '@/lib/api/require-permission';
import { canViewFinancialDashboard } from '@/lib/can-view-financial-dashboard';
import {
  getOrgIdFromSlug,
  parseAnalyticsRequestBody,
  type AnalyticsRequestBody,
} from '@/lib/read-models/analytics';

export interface AnalyticsRouteContext {
  db: FirebaseFirestore.Firestore;
  orgId: string;
  body: AnalyticsRequestBody;
}

function badRequest(code: string) {
  return NextResponse.json({ success: false, code }, { status: 400 });
}

export async function authorizeAnalyticsRequest(
  request: NextRequest
): Promise<
  | { ok: true; context: AnalyticsRouteContext }
  | { ok: false; response: NextResponse }
> {
  const authResult = await verifyIdToken(request);
  if (!authResult) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, code: 'UNAUTHORIZED' }, { status: 401 }),
    };
  }

  let jsonBody: unknown;
  try {
    jsonBody = await request.json();
  } catch {
    return { ok: false, response: badRequest('INVALID_BODY') };
  }

  const parsedBody = parseAnalyticsRequestBody(jsonBody);
  if (!parsedBody.ok) {
    return { ok: false, response: badRequest(parsedBody.code) };
  }

  const db = getAdminDb();
  const orgId = await getOrgIdFromSlug(db, parsedBody.value.orgSlug);
  if (!orgId) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, code: 'ORG_NOT_FOUND' }, { status: 404 }),
    };
  }

  const membership = await validateUserMembership(db, authResult.uid, orgId);
  const denied = requirePermission(membership, {
    code: 'DASHBOARD_FINANCIAL_READ_REQUIRED',
    check: (permissions) =>
      permissions['sections.dashboard'] && canViewFinancialDashboard(permissions),
  });
  if (denied) {
    return { ok: false, response: denied };
  }

  return {
    ok: true,
    context: {
      db,
      orgId,
      body: parsedBody.value,
    },
  };
}
