/**
 * POST /api/contacts/archive
 *
 * Arxiva un contacte (donor/supplier/employee) si NO té cap transacció associada.
 *
 * Característiques:
 * - Només escriptura via Admin SDK (bypassant Firestore Rules)
 * - Validació de rol admin
 * - NO permet reassignació (diferent de categories/projects)
 * - Idempotent: si ja està arxivat, retorna success
 *
 * IMPORTANT: No es poden arxivar contactes amb transaccions perquè
 * el contactId és referència d'integritat per fiscalitat (Model 182, 347).
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

interface ArchiveContactRequest {
  orgId: string;
  contactId: string;
  dryRun?: boolean;  // Si true, només compta transaccions sense arxivar
}

interface ArchiveContactResponse {
  success: boolean;
  idempotent?: boolean;
  error?: string;
  code?: string;
  // Desglossat per transparència UX
  activeCount?: number;
  archivedCount?: number;
  transactionCount?: number;  // Mantenim per retrocompatibilitat
  canArchive?: boolean;  // En mode dryRun, indica si es pot arxivar
}

// =============================================================================
// HANDLER PRINCIPAL
// =============================================================================

export async function POST(
  request: NextRequest
): Promise<NextResponse<ArchiveContactResponse>> {
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
  let body: ArchiveContactRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Body invàlid', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  const { orgId, contactId } = body;

  // 3. Validar camps obligatoris
  if (!orgId) {
    return NextResponse.json(
      { success: false, error: 'orgId és obligatori', code: 'MISSING_ORG_ID' },
      { status: 400 }
    );
  }

  if (!contactId) {
    return NextResponse.json(
      { success: false, error: 'contactId és obligatori', code: 'MISSING_CONTACT_ID' },
      { status: 400 }
    );
  }

  // 4. Validar membership + accés operatiu (admin/user)
  const membership = await validateUserMembership(db, uid, orgId);
  const accessError = requireOperationalAccess(membership);
  if (accessError) return accessError;

  // 6. Validar que el contacte existeix
  const contactRef = db.doc(`organizations/${orgId}/contacts/${contactId}`);
  const contactSnap = await contactRef.get();

  if (!contactSnap.exists) {
    return NextResponse.json(
      { success: false, error: 'Contacte no existeix', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  const contactData = contactSnap.data();

  // Idempotència: si ja està arxivat, retornem success
  if (contactData?.archivedAt != null) {
    console.log(`[contacts/archive] Contacte ${contactId} ja arxivat (idempotent)`);
    return NextResponse.json({
      success: true,
      idempotent: true,
    });
  }

  // 7. Query transaccions amb contactId == <contactId>
  // IMPORTANT: Comptem TOTES les transaccions (actives i arxivades)
  // perquè volem evitar orfes a qualsevol nivell (integritat fiscal: Model 182, 347)
  const transactionsRef = db.collection(`organizations/${orgId}/transactions`);
  const contactTransactionsQuery = transactionsRef
    .where('contactId', '==', contactId);

  const transactionsSnap = await contactTransactionsQuery.get();

  // Desglossar actius vs arxivats per transparència UX
  let activeCount = 0;
  let archivedCount = 0;
  for (const doc of transactionsSnap.docs) {
    const data = doc.data();
    if (data.archivedAt == null) {
      activeCount++;
    } else {
      archivedCount++;
    }
  }
  const txCount = activeCount + archivedCount;

  console.log(`[contacts/archive] Contacte ${contactId} (${contactData?.name || 'sense nom'}) té ${activeCount} actius + ${archivedCount} arxivats${body.dryRun ? ' [dryRun]' : ''}`);

  // 8. Mode dryRun: només retornem el comptatge sense arxivar
  if (body.dryRun) {
    // Bloquejar només si hi ha ACTIUS
    if (activeCount > 0) {
      return NextResponse.json({
        success: false,
        code: 'HAS_TRANSACTIONS',
        activeCount,
        archivedCount,
        transactionCount: txCount,
        canArchive: false,
      });
    }
    // Permetre arxivar (pot tenir arxivats com a historial)
    return NextResponse.json({
      success: true,
      code: 'OK_TO_ARCHIVE',
      activeCount: 0,
      archivedCount,
      transactionCount: txCount,
      canArchive: true,
    });
  }

  // 9. ENFORCE: bloquejar només per actius
  // NOTA: NO oferim reassignació per contactes (diferent de categories)
  if (activeCount > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Aquest contacte té ${activeCount} moviments actius. No es pot arxivar.`,
        code: 'HAS_TRANSACTIONS',
        activeCount,
        archivedCount,
        transactionCount: txCount,
      },
      { status: 400 }
    );
  }

  // 10. Arxivar el contacte
  await contactRef.update({
    archivedAt: FieldValue.serverTimestamp(),
    archivedByUid: uid,
    archivedFromAction: 'archive-contact-api',
    updatedAt: new Date().toISOString(),
  });

  const elapsed = Date.now() - startTime;
  console.log(`[contacts/archive] Contacte ${contactId} arxivat. Temps: ${elapsed}ms`);

  return NextResponse.json({
    success: true,
  });
}
