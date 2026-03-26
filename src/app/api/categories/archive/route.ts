/**
 * POST /api/categories/archive
 *
 * Arxiva una categoria si no té moviments assignats.
 *
 * Característiques:
 * - Només escriptura via Admin SDK (bypassant Firestore Rules)
 * - orgId derivat de la membership de l'usuari (no del body)
 * - Validació de rol admin
 * - Bloqueig si la categoria té transaccions (CATEGORY_IN_USE)
 * - Bloqueig si la categoria és de sistema (SYSTEM_CATEGORY_LOCKED)
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

interface ArchiveCategoryRequest {
  orgId: string;
  fromCategoryId: string;
}

interface ArchiveCategoryResponse {
  success: boolean;
  idempotent?: boolean;
  error?: string;
  code?: string;
}

// =============================================================================
// HANDLER PRINCIPAL
// =============================================================================

export async function POST(
  request: NextRequest
): Promise<NextResponse<ArchiveCategoryResponse>> {
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
  let body: ArchiveCategoryRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Body invàlid', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  const { orgId, fromCategoryId } = body;

  // 3. Validar orgId obligatori
  if (!orgId) {
    return NextResponse.json(
      { success: false, error: 'orgId és obligatori', code: 'MISSING_ORG_ID' },
      { status: 400 }
    );
  }

  if (!fromCategoryId) {
    return NextResponse.json(
      { success: false, error: 'fromCategoryId és obligatori', code: 'MISSING_FROM_ID' },
      { status: 400 }
    );
  }

  // 4. Validar membership + accés operatiu (admin/user)
  const membership = await validateUserMembership(db, uid, orgId);
  const accessError = requireOperationalAccess(membership);
  if (accessError) return accessError;

  // 6. Validar que fromCategory existeix i no està arxivada
  const fromCategoryRef = db.doc(`organizations/${orgId}/categories/${fromCategoryId}`);
  const fromCategorySnap = await fromCategoryRef.get();

  if (!fromCategorySnap.exists) {
    return NextResponse.json(
      { success: false, error: 'Categoria origen no existeix', code: 'FROM_NOT_FOUND' },
      { status: 404 }
    );
  }

  const fromCategoryData = fromCategorySnap.data();

  // Guardrail: categories de sistema no es poden arxivar
  if (fromCategoryData?.systemKey) {
    return NextResponse.json(
      { success: false, error: 'Categoria de sistema protegida. No es pot arxivar.', code: 'SYSTEM_CATEGORY_LOCKED' },
      { status: 400 }
    );
  }

  // Idempotència: si ja està arxivada, retornem success
  if (fromCategoryData?.archivedAt != null) {
    console.log(`[categories/archive] Categoria ${fromCategoryId} ja arxivada (idempotent)`);
    return NextResponse.json({
      success: true,
      idempotent: true,
    });
  }

  // 7. Guardrail: no es pot arxivar si té transaccions assignades
  const transactionsRef = db.collection(`organizations/${orgId}/transactions`);
  const usageCheck = await transactionsRef
    .where('category', '==', fromCategoryId)
    .limit(1)
    .get();

  if (!usageCheck.empty) {
    console.log(`[categories/archive] Categoria ${fromCategoryId} té transaccions assignades — bloqueig`);
    return NextResponse.json(
      {
        success: false,
        error: 'No es pot arxivar aquesta categoria perquè ja té moviments assignats.',
        code: 'CATEGORY_IN_USE',
      },
      { status: 400 }
    );
  }

  // 8. Arxivar la categoria origen
  await fromCategoryRef.update({
    archivedAt: FieldValue.serverTimestamp(),
    archivedByUid: uid,
    archivedFromAction: 'archive-category-api',
  });

  const elapsed = Date.now() - startTime;
  console.log(`[categories/archive] Categoria ${fromCategoryId} arxivada. Temps: ${elapsed}ms`);

  return NextResponse.json({
    success: true,
  });
}
