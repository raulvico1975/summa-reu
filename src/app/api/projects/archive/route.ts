/**
 * POST /api/projects/archive
 *
 * Arxiva un projecte (eix d'actuació) amb reassignació opcional de transaccions.
 *
 * Característiques:
 * - Només escriptura via Admin SDK (bypassant Firestore Rules)
 * - orgId derivat de la membership de l'usuari (no del body)
 * - Validació de rol admin/user
 * - Reassignació atòmica amb batch (50 docs/batch)
 * - Idempotent: si ja està arxivat, retorna success
 *
 * NOTA: Aquesta API NO afecta projectModule/* (mòdul de projectes modern)
 * Només afecta organizations/{orgId}/projects/* (eixos d'actuació legacy)
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import {
  getAdminDb,
  verifyIdToken,
  validateUserMembership,
  BATCH_SIZE,
} from '@/lib/api/admin-sdk';
import { requireOperationalAccess } from '@/lib/api/require-operational-access';

// =============================================================================
// TIPUS
// =============================================================================

interface ArchiveProjectRequest {
  orgId: string;
  fromProjectId: string;
  toProjectId?: string | null;
}

interface ArchiveProjectResponse {
  success: boolean;
  idempotent?: boolean;
  reassignedCount?: number;
  error?: string;
  code?: string;
}

// =============================================================================
// HANDLER PRINCIPAL
// =============================================================================

export async function POST(
  request: NextRequest
): Promise<NextResponse<ArchiveProjectResponse>> {
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
  let body: ArchiveProjectRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Body invàlid', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  const { orgId, fromProjectId, toProjectId } = body;

  // 3. Validar orgId obligatori
  if (!orgId) {
    return NextResponse.json(
      { success: false, error: 'orgId és obligatori', code: 'MISSING_ORG_ID' },
      { status: 400 }
    );
  }

  if (!fromProjectId) {
    return NextResponse.json(
      { success: false, error: 'fromProjectId és obligatori', code: 'MISSING_FROM_ID' },
      { status: 400 }
    );
  }

  // 4. Validar membership + accés operatiu (admin/user)
  const membership = await validateUserMembership(db, uid, orgId);
  const accessError = requireOperationalAccess(membership);
  if (accessError) return accessError;

  // 6. Validar que fromProject existeix i no està arxivat
  const fromProjectRef = db.doc(`organizations/${orgId}/projects/${fromProjectId}`);
  const fromProjectSnap = await fromProjectRef.get();

  if (!fromProjectSnap.exists) {
    return NextResponse.json(
      { success: false, error: 'Eix origen no existeix', code: 'FROM_NOT_FOUND' },
      { status: 404 }
    );
  }

  const fromProjectData = fromProjectSnap.data();

  // Idempotència: si ja està arxivat, retornem success
  if (fromProjectData?.archivedAt != null) {
    console.log(`[projects/archive] Eix ${fromProjectId} ja arxivat (idempotent)`);
    return NextResponse.json({
      success: true,
      idempotent: true,
      reassignedCount: 0,
    });
  }

  // 6. Si hi ha toProjectId, validar que existeix, no està arxivat, i no és el mateix
  if (toProjectId) {
    if (toProjectId === fromProjectId) {
      return NextResponse.json(
        { success: false, error: 'Eix destí no pot ser el mateix que origen', code: 'SAME_PROJECT' },
        { status: 400 }
      );
    }

    const toProjectRef = db.doc(`organizations/${orgId}/projects/${toProjectId}`);
    const toProjectSnap = await toProjectRef.get();

    if (!toProjectSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Eix destí no existeix', code: 'TO_NOT_FOUND' },
        { status: 400 }
      );
    }

    const toProjectData = toProjectSnap.data();
    if (toProjectData?.archivedAt != null) {
      return NextResponse.json(
        { success: false, error: 'Eix destí està arxivat', code: 'TO_ARCHIVED' },
        { status: 400 }
      );
    }
  }

  // 7. Query transaccions amb projectId == fromProjectId
  // NOTA: No podem usar where('archivedAt', '==', null) perquè Firestore
  // no troba documents on el camp no existeix (dades legacy sense archivedAt)
  const transactionsRef = db.collection(`organizations/${orgId}/transactions`);
  const projectTransactionsQuery = transactionsRef
    .where('projectId', '==', fromProjectId);

  const projectTransactionsSnap = await projectTransactionsQuery.get();

  // Filtrar actives a codi (archivedAt == null o undefined/absent)
  const activeDocs = projectTransactionsSnap.docs.filter(doc => {
    const data = doc.data();
    return data.archivedAt == null; // Cobreix null i undefined
  });
  const activeCount = activeDocs.length;

  console.log(`[projects/archive] Eix ${fromProjectId} té ${activeCount} transaccions actives`);

  // 8. Si count > 0 i no hi ha toProjectId, error
  // NOTA: Retornem activeCount perquè la UI pugui mostrar-lo al ReassignModal
  if (activeCount > 0 && !toProjectId) {
    return NextResponse.json(
      {
        success: false,
        error: `Eix té ${activeCount} moviments actius. Cal reassignar-los primer.`,
        code: 'HAS_ACTIVE_TRANSACTIONS',
        activeCount,
      },
      { status: 400 }
    );
  }

  // 9. Si count > 0 i toProjectId, fer batch reassign (chunks de BATCH_SIZE=50)
  let reassignedCount = 0;
  if (activeCount > 0 && toProjectId) {
    for (let i = 0; i < activeDocs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = activeDocs.slice(i, i + BATCH_SIZE);

      for (const doc of chunk) {
        batch.update(doc.ref, { projectId: toProjectId });
      }

      await batch.commit();
      reassignedCount += chunk.length;
      console.log(`[projects/archive] Reassignades ${reassignedCount}/${activeDocs.length} transaccions`);
    }
  }

  // 10. Arxivar el projecte origen
  await fromProjectRef.update({
    archivedAt: FieldValue.serverTimestamp(),
    archivedByUid: uid,
    archivedFromAction: 'archive-project-api',
  });

  const elapsed = Date.now() - startTime;
  console.log(`[projects/archive] Eix ${fromProjectId} arxivat. Reassignades: ${reassignedCount}. Temps: ${elapsed}ms`);

  return NextResponse.json({
    success: true,
    reassignedCount,
  });
}
