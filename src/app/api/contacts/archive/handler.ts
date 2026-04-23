/**
 * POST /api/contacts/archive
 *
 * Arxiva un contacte (donor/supplier/employee) si NO té cap transacció associada.
 *
 * Característiques:
 * - Només escriptura via Admin SDK (bypassant Firestore Rules)
 * - Validació d'accés operatiu (admin/user)
 * - NO permet reassignació (diferent de categories/projects)
 * - Idempotent: si ja està arxivat, retorna success
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  getAdminDb,
  verifyIdToken,
  validateUserMembership,
  type MembershipValidation,
} from '@/lib/api/admin-sdk';
import { requireOperationalAccess } from '@/lib/api/require-operational-access';
import {
  canArchiveContact,
  getLinkedTransactionCount,
} from '@/lib/contacts/archive-contact-policy';

interface ArchiveContactRequest {
  orgId: string;
  contactId: string;
  dryRun?: boolean;
  blockIfAnyTransaction?: boolean;
}

interface ArchiveContactResponse {
  success: boolean;
  idempotent?: boolean;
  error?: string;
  code?: string;
  activeCount?: number;
  archivedCount?: number;
  transactionCount?: number;
  canArchive?: boolean;
}

type ArchiveContactsRouteDeps = {
  verifyIdTokenFn: typeof verifyIdToken;
  getAdminDbFn: typeof getAdminDb;
  validateUserMembershipFn: typeof validateUserMembership;
  requireOperationalAccessFn: typeof requireOperationalAccess;
};

const defaultDeps: ArchiveContactsRouteDeps = {
  verifyIdTokenFn: verifyIdToken,
  getAdminDbFn: getAdminDb,
  validateUserMembershipFn: validateUserMembership,
  requireOperationalAccessFn: requireOperationalAccess,
};

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json<ArchiveContactResponse>(
    { success: false, error, code },
    { status }
  );
}

function isDonorContact(contactData: Record<string, unknown>): boolean {
  if (contactData.type === 'donor') {
    return true;
  }

  const roles = contactData.roles;
  return !!roles
    && typeof roles === 'object'
    && !Array.isArray(roles)
    && (roles as Record<string, unknown>).donor === true;
}

function resolveArchivePolicy(
  contactData: Record<string, unknown>,
  requestedBlockIfAnyTransaction: boolean
) {
  return isDonorContact(contactData) ? true : requestedBlockIfAnyTransaction;
}

async function countLinkedTransactions(
  db: Firestore,
  orgId: string,
  contactId: string
) {
  const transactionsRef = db.collection(`organizations/${orgId}/transactions`);
  const transactionsSnap = await transactionsRef.where('contactId', '==', contactId).get();

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

  return { activeCount, archivedCount };
}

export async function handleArchiveContactPost(
  request: NextRequest,
  deps: ArchiveContactsRouteDeps = defaultDeps
): Promise<NextResponse<ArchiveContactResponse>> {
  const startTime = Date.now();

  const authResult = await deps.verifyIdTokenFn(request);
  if (!authResult) {
    return jsonError('UNAUTHORIZED', 'No autenticat', 401);
  }

  let body: ArchiveContactRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_BODY', 'Body invàlid', 400);
  }

  const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';
  const contactId = typeof body.contactId === 'string' ? body.contactId.trim() : '';
  const requestedBlockIfAnyTransaction = body.blockIfAnyTransaction === true;

  if (!orgId) {
    return jsonError('MISSING_ORG_ID', 'orgId és obligatori', 400);
  }

  if (!contactId) {
    return jsonError('MISSING_CONTACT_ID', 'contactId és obligatori', 400);
  }

  const db = deps.getAdminDbFn();
  const membership = await deps.validateUserMembershipFn(db, authResult.uid, orgId);
  const accessError = deps.requireOperationalAccessFn(membership as MembershipValidation);
  if (accessError) return accessError;

  const contactRef = db.doc(`organizations/${orgId}/contacts/${contactId}`);
  const contactSnap = await contactRef.get();

  if (!contactSnap.exists) {
    return jsonError('NOT_FOUND', 'Contacte no existeix', 404);
  }

  const contactData = (contactSnap.data() ?? {}) as Record<string, unknown>;

  if (contactData.archivedAt != null) {
    console.log(`[contacts/archive] Contacte ${contactId} ja arxivat (idempotent)`);
    return NextResponse.json({
      success: true,
      idempotent: true,
    });
  }

  const { activeCount, archivedCount } = await countLinkedTransactions(db, orgId, contactId);
  const effectiveBlockIfAnyTransaction = resolveArchivePolicy(
    contactData,
    requestedBlockIfAnyTransaction
  );
  const txCount = getLinkedTransactionCount({ activeCount, archivedCount });
  const canArchive = canArchiveContact(
    { activeCount, archivedCount },
    { blockIfAnyTransaction: effectiveBlockIfAnyTransaction }
  );

  console.log(
    `[contacts/archive] Contacte ${contactId} (${contactData.name || 'sense nom'}) té ${activeCount} actius + ${archivedCount} arxivats${body.dryRun ? ' [dryRun]' : ''}`
  );

  if (body.dryRun) {
    if (!canArchive) {
      return NextResponse.json({
        success: false,
        code: 'HAS_TRANSACTIONS',
        activeCount,
        archivedCount,
        transactionCount: txCount,
        canArchive: false,
      });
    }

    return NextResponse.json({
      success: true,
      code: 'OK_TO_ARCHIVE',
      activeCount,
      archivedCount,
      transactionCount: txCount,
      canArchive: true,
    });
  }

  if (!canArchive) {
    const message = effectiveBlockIfAnyTransaction
      ? `Aquest contacte té ${txCount} moviments associats. No es pot eliminar.`
      : `Aquest contacte té ${activeCount} moviments actius. No es pot arxivar.`;

    return NextResponse.json(
      {
        success: false,
        error: message,
        code: 'HAS_TRANSACTIONS',
        activeCount,
        archivedCount,
        transactionCount: txCount,
      },
      { status: 400 }
    );
  }

  await contactRef.update({
    archivedAt: FieldValue.serverTimestamp(),
    archivedByUid: authResult.uid,
    archivedFromAction: 'archive-contact-api',
    updatedAt: new Date().toISOString(),
  });

  const elapsed = Date.now() - startTime;
  console.log(`[contacts/archive] Contacte ${contactId} arxivat. Temps: ${elapsed}ms`);

  return NextResponse.json({
    success: true,
  });
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ArchiveContactResponse>> {
  return handleArchiveContactPost(request);
}
