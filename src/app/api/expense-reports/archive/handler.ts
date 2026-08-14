import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import {
  getAdminDb,
  verifyIdToken,
  validateUserMembership,
} from '@/lib/api/admin-sdk';
import { requirePermission } from '@/lib/api/require-permission';
import { canAccessProjectsArea } from '@/lib/permissions';
import { resolveServerEntitlement, type EntitlementDbLike } from '@/lib/api/require-entitlement';

interface ArchiveExpenseReportRequest {
  orgId: string;
  reportId: string;
  dryRun?: boolean;
}

interface ArchiveExpenseReportResponse {
  success: boolean;
  idempotent?: boolean;
  error?: string;
  code?: string;
  pendingCount?: number;
  matchedCount?: number;
  canArchive?: boolean;
}

const RESOURCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;

export interface ArchiveExpenseReportRouteDeps {
  getAdminDbFn?: typeof getAdminDb;
  validateUserMembershipFn?: typeof validateUserMembership;
  verifyIdTokenFn?: typeof verifyIdToken;
  resolveEntitlementFn?: typeof resolveServerEntitlement;
  serverTimestampFn?: () => unknown;
  nowFn?: () => Date;
}

export async function handleArchiveExpenseReportPost(
  request: NextRequest,
  deps: ArchiveExpenseReportRouteDeps = {}
): Promise<NextResponse<ArchiveExpenseReportResponse>> {
  const startTime = Date.now();
  const verifyIdTokenFn = deps.verifyIdTokenFn ?? verifyIdToken;
  const getAdminDbFn = deps.getAdminDbFn ?? getAdminDb;
  const validateUserMembershipFn = deps.validateUserMembershipFn ?? validateUserMembership;
  const resolveEntitlementFn = deps.resolveEntitlementFn ?? resolveServerEntitlement;
  const serverTimestampFn = deps.serverTimestampFn ?? (() => FieldValue.serverTimestamp());
  const nowFn = deps.nowFn ?? (() => new Date());

  const authResult = await verifyIdTokenFn(request);
  if (!authResult) {
    return NextResponse.json(
      { success: false, error: 'No autenticat', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  let body: ArchiveExpenseReportRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Body invàlid', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  const orgId = typeof body.orgId === 'string' ? body.orgId : '';
  const reportId = typeof body.reportId === 'string' ? body.reportId : '';
  if (!orgId) {
    return NextResponse.json(
      { success: false, error: 'orgId és obligatori', code: 'MISSING_ORG_ID' },
      { status: 400 }
    );
  }
  if (!reportId) {
    return NextResponse.json(
      { success: false, error: 'reportId és obligatori', code: 'MISSING_REPORT_ID' },
      { status: 400 }
    );
  }
  if (!RESOURCE_ID_PATTERN.test(orgId) || !RESOURCE_ID_PATTERN.test(reportId)) {
    return NextResponse.json(
      { success: false, error: 'orgId o reportId invàlid', code: 'INVALID_ID' },
      { status: 400 }
    );
  }

  const db = getAdminDbFn();
  const membership = await validateUserMembershipFn(db, authResult.uid, orgId);
  const accessError = requirePermission(membership, {
    code: 'PROJECT_MODULE_REQUIRED',
    check: canAccessProjectsArea,
  });
  if (accessError) return accessError;

  // Keep the commercial guard before every functional report/ticket read.
  const entitlement = await resolveEntitlementFn({
    db: db as unknown as EntitlementDbLike,
    orgId,
    capability: 'projects.mutate',
    userAllowed: true,
  });
  if (!entitlement.allowed) {
    return NextResponse.json(
      { success: false, error: 'El pla no permet modificar liquidacions.', code: 'ENTITLEMENT_DENIED' },
      { status: 403 }
    );
  }

  const reportRef = db.doc(`organizations/${orgId}/expenseReports/${reportId}`);
  const reportSnap = await reportRef.get();
  if (!reportSnap.exists) {
    return NextResponse.json(
      { success: false, error: 'Liquidació no existeix', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  const reportData = reportSnap.data();
  if (reportData?.status === 'archived') {
    console.log(`[expense-reports/archive] Liquidació ${reportId} ja arxivada (idempotent)`);
    return NextResponse.json({ success: true, idempotent: true });
  }
  if (reportData?.status === 'matched') {
    return NextResponse.json(
      {
        success: false,
        error: 'Una liquidació conciliada no es pot arxivar.',
        code: 'IS_MATCHED',
      },
      { status: 400 }
    );
  }

  const assignedTicketsSnap = await db
    .collection(`organizations/${orgId}/pendingDocuments`)
    .where('reportId', '==', reportId)
    .get();

  let pendingCount = 0;
  let matchedCount = 0;
  for (const document of assignedTicketsSnap.docs) {
    const data = document.data();
    if (data.status === 'matched') matchedCount += 1;
    else pendingCount += 1;
  }

  console.log(`[expense-reports/archive] Liquidació ${reportId} té ${pendingCount} tiquets pendents + ${matchedCount} conciliats${body.dryRun ? ' [dryRun]' : ''}`);

  if (body.dryRun) {
    if (pendingCount > 0) {
      return NextResponse.json({
        success: false,
        code: 'HAS_PENDING_TICKETS',
        pendingCount,
        matchedCount,
        canArchive: false,
      });
    }
    return NextResponse.json({
      success: true,
      code: 'OK_TO_ARCHIVE',
      pendingCount: 0,
      matchedCount,
      canArchive: true,
    });
  }

  if (pendingCount > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Aquesta liquidació té ${pendingCount} tiquets pendents assignats. No es pot arxivar.`,
        code: 'HAS_PENDING_TICKETS',
        pendingCount,
        matchedCount,
      },
      { status: 400 }
    );
  }

  await reportRef.update({
    status: 'archived',
    archivedAt: serverTimestampFn(),
    archivedByUid: authResult.uid,
    archivedFromAction: 'archive-expense-report-api',
    updatedAt: nowFn().toISOString(),
  });

  console.log(`[expense-reports/archive] Liquidació ${reportId} arxivada. Temps: ${Date.now() - startTime}ms`);
  return NextResponse.json({ success: true });
}
