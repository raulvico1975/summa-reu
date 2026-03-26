/**
 * POST /api/expense-reports/archive
 *
 * Arxiva una liquidació (ExpenseReport) si NO té tiquets pendents assignats.
 *
 * Característiques:
 * - Només escriptura via Admin SDK (bypassant Firestore Rules)
 * - Validació de rol admin o user
 * - NO permet arxivar si té tiquets pendents (status !== 'matched')
 * - NO permet arxivar si ja està conciliada (status === 'matched')
 * - Idempotent: si ja està arxivada, retorna success
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import {
  getAdminDb,
  verifyIdToken,
  validateUserMembership,
} from '@/lib/api/admin-sdk';
import { requireOperationalAccess } from '@/lib/api/require-operational-access';

// =============================================================================
// TIPUS
// =============================================================================

interface ArchiveExpenseReportRequest {
  orgId: string;
  reportId: string;
  dryRun?: boolean;  // Si true, només compta tiquets sense arxivar
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

// =============================================================================
// HANDLER PRINCIPAL
// =============================================================================

export async function POST(
  request: NextRequest
): Promise<NextResponse<ArchiveExpenseReportResponse>> {
  const startTime = Date.now();

  // 1. Autenticació
  const authResult = await verifyIdToken(request);
  if (!authResult) {
    return NextResponse.json(
      { success: false, error: 'No autenticat', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  const { uid } = authResult;
  const db = getAdminDb();

  // 2. Parse body
  let body: ArchiveExpenseReportRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Body invàlid', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  const { orgId, reportId } = body;

  // 3. Validar camps obligatoris
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

  // 4. Validar membership + accés operatiu (admin/user)
  const membership = await validateUserMembership(db, uid, orgId);
  const accessError = requireOperationalAccess(membership);
  if (accessError) return accessError;

  // 6. Validar que la liquidació existeix
  const reportRef = db.doc(`organizations/${orgId}/expenseReports/${reportId}`);
  const reportSnap = await reportRef.get();

  if (!reportSnap.exists) {
    return NextResponse.json(
      { success: false, error: 'Liquidació no existeix', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  const reportData = reportSnap.data();

  // Idempotència: si ja està arxivada, retornem success
  if (reportData?.status === 'archived') {
    console.log(`[expense-reports/archive] Liquidació ${reportId} ja arxivada (idempotent)`);
    return NextResponse.json({
      success: true,
      idempotent: true,
    });
  }

  // 7. Bloquejar si la liquidació està conciliada (matched)
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

  // 8. Query tiquets assignats a aquesta liquidació
  const pendingDocsRef = db.collection(`organizations/${orgId}/pendingDocuments`);
  const assignedTicketsQuery = pendingDocsRef
    .where('reportId', '==', reportId);

  const assignedTicketsSnap = await assignedTicketsQuery.get();

  // Separar tiquets pendents vs conciliats
  let pendingCount = 0;
  let matchedCount = 0;
  for (const doc of assignedTicketsSnap.docs) {
    const data = doc.data();
    if (data.status === 'matched') {
      matchedCount++;
    } else {
      pendingCount++;
    }
  }

  console.log(`[expense-reports/archive] Liquidació ${reportId} té ${pendingCount} tiquets pendents + ${matchedCount} conciliats${body.dryRun ? ' [dryRun]' : ''}`);

  // 9. Mode dryRun: només retornem el comptatge sense arxivar
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

  // 10. ENFORCE: bloquejar si hi ha tiquets pendents
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

  // 11. Arxivar la liquidació
  await reportRef.update({
    status: 'archived',
    archivedAt: FieldValue.serverTimestamp(),
    archivedByUid: uid,
    archivedFromAction: 'archive-expense-report-api',
    updatedAt: new Date().toISOString(),
  });

  const elapsed = Date.now() - startTime;
  console.log(`[expense-reports/archive] Liquidació ${reportId} arxivada. Temps: ${elapsed}ms`);

  return NextResponse.json({
    success: true,
  });
}
