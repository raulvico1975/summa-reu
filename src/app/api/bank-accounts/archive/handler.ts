/**
 * POST /api/bank-accounts/archive
 *
 * Arxiva un compte bancari si NO té cap transacció associada.
 *
 * Característiques:
 * - Només escriptura via Admin SDK (bypassant Firestore Rules)
 * - Validació de rol admin
 * - NO permet reassignació (diferent de categories/projects)
 * - Idempotent: si ja està arxivat, retorna success
 *
 * IMPORTANT: No es poden arxivar comptes amb transaccions perquè
 * el bankAccountId és referència d'integritat per conciliació.
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  getAdminDb,
  verifyIdToken,
  validateUserMembership,
  type MembershipValidation,
} from '@/lib/api/admin-sdk';

// =============================================================================
// TIPUS
// =============================================================================

interface ArchiveBankAccountRequest {
  orgId: string;
  bankAccountId: string;
}

interface ArchiveBankAccountResponse {
  success: boolean;
  idempotent?: boolean;
  error?: string;
  code?: string;
  transactionCount?: number;
}

type ArchiveBankAccountsRouteDeps = {
  verifyIdTokenFn: typeof verifyIdToken;
  getAdminDbFn: typeof getAdminDb;
  validateUserMembershipFn: typeof validateUserMembership;
};

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json<ArchiveBankAccountResponse>(
    { success: false, error, code },
    { status }
  );
}

const defaultDeps: ArchiveBankAccountsRouteDeps = {
  verifyIdTokenFn: verifyIdToken,
  getAdminDbFn: getAdminDb,
  validateUserMembershipFn: validateUserMembership,
};

function requireAdminMembership(membership: MembershipValidation) {
  if (!membership.valid) {
    return jsonError('NOT_MEMBER', 'NOT_MEMBER', 403);
  }

  if (membership.role !== 'admin') {
    return jsonError('ADMIN_REQUIRED', 'Només administradors poden arxivar comptes bancaris.', 403);
  }

  return null;
}

// =============================================================================
// HELPER: Comptar comptes bancaris actius
// =============================================================================

async function countActiveBankAccounts(
  db: Firestore,
  orgId: string
): Promise<number> {
  const bankAccountsRef = db.collection(`organizations/${orgId}/bankAccounts`);
  const snapshot = await bankAccountsRef.get();

  // Comptar comptes que NO estan arxivats i que estan actius
  const activeCount = snapshot.docs.filter(doc => {
    const data = doc.data();
    return data.archivedAt == null && data.isActive !== false;
  }).length;

  return activeCount;
}

// =============================================================================
// HANDLER PRINCIPAL
// =============================================================================

export async function handleArchiveBankAccountPost(
  request: NextRequest,
  deps: ArchiveBankAccountsRouteDeps = defaultDeps
): Promise<NextResponse<ArchiveBankAccountResponse>> {
  const startTime = Date.now();

  // 1. Autenticació
  const authResult = await deps.verifyIdTokenFn(request);
  if (!authResult) {
    return jsonError('UNAUTHORIZED', 'No autenticat', 401);
  }

  const { uid } = authResult;
  const db = deps.getAdminDbFn();

  // 2. Parse body
  let body: ArchiveBankAccountRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_BODY', 'Body invàlid', 400);
  }

  const { orgId, bankAccountId } = body;

  // 3. Validar camps obligatoris
  if (!orgId) {
    return jsonError('MISSING_ORG_ID', 'orgId és obligatori', 400);
  }

  if (!bankAccountId) {
    return jsonError('MISSING_BANK_ACCOUNT_ID', 'bankAccountId és obligatori', 400);
  }

  // 4. Validar membership admin-only (admin o SuperAdmin global)
  const membership = await deps.validateUserMembershipFn(db, uid, orgId);
  const accessError = requireAdminMembership(membership);
  if (accessError) return accessError;

  // 6. Validar que el compte existeix
  const bankAccountRef = db.doc(`organizations/${orgId}/bankAccounts/${bankAccountId}`);
  const bankAccountSnap = await bankAccountRef.get();

  if (!bankAccountSnap.exists) {
    return jsonError('NOT_FOUND', 'Compte bancari no existeix', 404);
  }

  const bankAccountData = bankAccountSnap.data();

  // Idempotència: si ja està arxivat, retornem success
  if (bankAccountData?.archivedAt != null) {
    console.log(`[bank-accounts/archive] Compte ${bankAccountId} ja arxivat (idempotent)`);
    return NextResponse.json({
      success: true,
      idempotent: true,
    });
  }

  // 7. Guardrail: no permetre arxivar l'últim compte actiu
  const activeCount = await countActiveBankAccounts(db, orgId);
  if (activeCount <= 1) {
    return NextResponse.json(
      {
        success: false,
        error: 'No es pot arxivar l\'últim compte bancari actiu',
        code: 'LAST_ACTIVE_ACCOUNT',
      },
      { status: 400 }
    );
  }

  // 8. Query transaccions amb bankAccountId == <bankAccountId>
  // IMPORTANT: Comptem TOTES les transaccions (actives i arxivades)
  // perquè volem evitar orfes a qualsevol nivell (integritat de conciliació)
  const transactionsRef = db.collection(`organizations/${orgId}/transactions`);
  const bankAccountTransactionsQuery = transactionsRef
    .where('bankAccountId', '==', bankAccountId);

  const transactionsSnap = await bankAccountTransactionsQuery.get();
  const txCount = transactionsSnap.size;

  console.log(`[bank-accounts/archive] Compte ${bankAccountId} té ${txCount} transaccions (total)`);

  // 9. Si count > 0, error
  // NOTA: NO oferim reassignació per comptes bancaris (diferent de categories)
  if (txCount > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Aquest compte té ${txCount} moviments associats. No es pot arxivar.`,
        code: 'HAS_TRANSACTIONS',
        transactionCount: txCount,
      },
      { status: 400 }
    );
  }

  // 10. Arxivar el compte bancari
  await bankAccountRef.update({
    archivedAt: FieldValue.serverTimestamp(),
    archivedByUid: uid,
    archivedFromAction: 'archive-bankaccount-api',
    isActive: false, // Mantenim coherència amb el camp legacy
    updatedAt: new Date().toISOString(),
  });

  const elapsed = Date.now() - startTime;
  console.log(`[bank-accounts/archive] Compte ${bankAccountId} arxivat. Temps: ${elapsed}ms`);

  return NextResponse.json({
    success: true,
  });
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ArchiveBankAccountResponse>> {
  return handleArchiveBankAccountPost(request);
}
