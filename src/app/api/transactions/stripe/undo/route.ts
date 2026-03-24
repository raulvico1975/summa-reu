import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import {
  BATCH_SIZE,
  getAdminDb,
  validateUserMembership,
  verifyIdToken,
} from '@/lib/api/admin-sdk';
import { requirePermission } from '@/lib/api/require-permission';
import type { Transaction } from '@/lib/data';
import { buildStripeUndoPlan } from '@/lib/fiscal/stripe-undo-plan';
import { getLockFailureMessage, type LockOperation } from '@/lib/fiscal/processLocks';
import { filterActiveChildDocsForParent } from '@/lib/remittances/active-child-docs';
import { isActiveRemittanceChild } from '@/lib/remittances/is-active-child';
import type { Donation } from '@/lib/types/donations';

interface StripeUndoRequestBody {
  orgId: string;
  parentTxId: string;
}

interface StripeUndoResponseBody {
  success: boolean;
  idempotent: boolean;
  donationsArchived?: number;
  childrenArchived?: number;
  childrenDeleted?: number;
  error?: string;
  code?: string;
}

interface LockAcquireResult {
  ok: boolean;
  reason?: 'locked_by_other' | 'error';
  lockedByUid?: string;
  operation?: LockOperation;
}

const LOCK_TTL_SECONDS = 90;

const PARENT_STRIPE_RESET_FIELDS = [
  'isRemittance',
  'remittanceId',
  'remittanceItemCount',
  'remittanceResolvedCount',
  'remittancePendingCount',
  'remittancePendingTotalAmount',
  'remittanceExpectedTotalCents',
  'remittanceResolvedTotalCents',
  'remittancePendingTotalCents',
  'remittanceType',
  'remittanceDirection',
  'remittanceStatus',
  'pendingReturns',
  'stripeTransferId',
  'stripePayoutId',
] as const;

function validateBody(body: unknown):
  | { ok: true; data: StripeUndoRequestBody }
  | { ok: false; error: string; code: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body invàlid', code: 'INVALID_BODY' };
  }

  const payload = body as Record<string, unknown>;
  const orgId = typeof payload.orgId === 'string' ? payload.orgId.trim() : '';
  const parentTxId = typeof payload.parentTxId === 'string' ? payload.parentTxId.trim() : '';

  if (!orgId) {
    return { ok: false, error: 'orgId obligatori', code: 'MISSING_ORG_ID' };
  }

  if (!parentTxId) {
    return { ok: false, error: 'parentTxId obligatori', code: 'MISSING_PARENT_TX_ID' };
  }

  return {
    ok: true,
    data: { orgId, parentTxId },
  };
}

async function acquireProcessLockAdmin(input: {
  orgId: string;
  parentTxId: string;
  uid: string;
  operation: LockOperation;
}): Promise<LockAcquireResult> {
  const db = getAdminDb();
  const lockRef = db.doc(`organizations/${input.orgId}/processLocks/${input.parentTxId}`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const lockSnap = await transaction.get(lockRef);
      const now = Timestamp.now();

      if (lockSnap.exists) {
        const lockData = lockSnap.data();
        if (lockData?.expiresAt && lockData.expiresAt.toMillis() > now.toMillis()) {
          return {
            ok: false as const,
            reason: 'locked_by_other' as const,
            lockedByUid: typeof lockData.lockedByUid === 'string' ? lockData.lockedByUid : undefined,
            operation: lockData.operation as LockOperation | undefined,
          };
        }
      }

      const expiresAt = Timestamp.fromMillis(now.toMillis() + LOCK_TTL_SECONDS * 1000);
      transaction.set(lockRef, {
        lockedAt: now,
        expiresAt,
        lockedByUid: input.uid,
        operation: input.operation,
      });

      return { ok: true as const };
    });

    return result;
  } catch (error) {
    console.error('[transactions/stripe/undo] Error adquirint lock:', error);
    return { ok: false, reason: 'error' };
  }
}

async function releaseProcessLockAdmin(input: {
  orgId: string;
  parentTxId: string;
}): Promise<void> {
  const db = getAdminDb();
  const lockRef = db.doc(`organizations/${input.orgId}/processLocks/${input.parentTxId}`);

  try {
    await lockRef.delete();
  } catch (error) {
    console.warn('[transactions/stripe/undo] Error alliberant lock:', error);
  }
}

async function writeAuditLog(input: {
  db: FirebaseFirestore.Firestore;
  orgId: string;
  parentTx: Transaction;
  uid: string;
  email?: string;
  donationsArchived: number;
  childrenArchived: number;
  childrenDeleted: number;
  timestamp: string;
}): Promise<void> {
  try {
    await input.db.collection(`organizations/${input.orgId}/audit_logs`).add({
      timestamp: input.timestamp,
      userId: input.uid,
      userName: input.email ?? input.uid,
      userEmail: input.email ?? '',
      action: 'UPDATE',
      entityType: 'TRANSACTION',
      entityId: input.parentTx.id,
      entityName: input.parentTx.description ?? input.parentTx.id,
      description:
        `Desfer Stripe: ${input.donationsArchived} donacions arxivades, ` +
        `${input.childrenArchived} filles fiscals arxivades, ` +
        `${input.childrenDeleted} filles no fiscals eliminades.`,
    });
  } catch (error) {
    console.warn('[transactions/stripe/undo] Audit log no disponible:', error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<StripeUndoResponseBody>> {
  const authResult = await verifyIdToken(request);
  if (!authResult) {
    return NextResponse.json(
      { success: false, idempotent: false, error: 'No autenticat', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  let parsedBody: StripeUndoRequestBody;
  try {
    const rawBody = await request.json();
    const validation = validateBody(rawBody);
    if (!validation.ok) {
      return NextResponse.json(
        { success: false, idempotent: false, error: validation.error, code: validation.code },
        { status: 400 }
      );
    }
    parsedBody = validation.data;
  } catch {
    return NextResponse.json(
      { success: false, idempotent: false, error: 'JSON invàlid', code: 'INVALID_JSON' },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  const membership = await validateUserMembership(db, authResult.uid, parsedBody.orgId);
  const accessError = requirePermission(membership, {
    code: 'MOVIMENTS_EDITAR_REQUIRED',
    check: (permissions) => permissions['moviments.editar'],
  });
  if (accessError) {
    return accessError as NextResponse<StripeUndoResponseBody>;
  }

  const parentRef = db.doc(`organizations/${parsedBody.orgId}/transactions/${parsedBody.parentTxId}`);
  const parentSnap = await parentRef.get();

  if (!parentSnap.exists) {
    return NextResponse.json(
      { success: false, idempotent: false, error: 'Transacció pare no trobada', code: 'PARENT_NOT_FOUND' },
      { status: 404 }
    );
  }

  const parentTx = {
    ...(parentSnap.data() as Omit<Transaction, 'id'>),
    id: parentSnap.id,
  } as Transaction;

  const transactionsRef = db.collection(`organizations/${parsedBody.orgId}/transactions`);
  const donationsRef = db.collection(`organizations/${parsedBody.orgId}/donations`);

  const byParentSnap = await transactionsRef
    .where('parentTransactionId', '==', parsedBody.parentTxId)
    .get();

  let childDocs = byParentSnap.docs.filter((docSnap) =>
    isActiveRemittanceChild(docSnap.data() as Transaction)
  );

  if (childDocs.length === 0 && parentTx.remittanceId) {
    const byRemittanceSnap = await transactionsRef
      .where('remittanceId', '==', parentTx.remittanceId)
      .get();
    childDocs = filterActiveChildDocsForParent(byRemittanceSnap.docs, parsedBody.parentTxId);
  }

  const donationSnap = await donationsRef
    .where('parentTransactionId', '==', parsedBody.parentTxId)
    .get();

  const plan = buildStripeUndoPlan({
    parent: parentTx,
    children: childDocs.map((docSnap) => ({
      id: docSnap.id,
      data: {
        ...(docSnap.data() as Omit<Transaction, 'id'>),
        id: docSnap.id,
      } as Transaction,
    })),
    donations: donationSnap.docs.map((docSnap) => ({
      id: docSnap.id,
      data: {
        id: docSnap.id,
        ...(docSnap.data() as Donation),
      } as Donation,
    })),
  });

  if (plan.isIdempotent) {
    return NextResponse.json({
      success: true,
      idempotent: true,
      donationsArchived: 0,
      childrenArchived: 0,
      childrenDeleted: 0,
    });
  }

  const hasStripeData =
    Boolean(parentTx.stripeTransferId) ||
    plan.archiveDonationIds.length > 0 ||
    childDocs.some((docSnap) => {
      const data = docSnap.data() as Transaction;
      return data.source === 'stripe' || !!data.stripePaymentId || !!data.stripeTransferId;
    });

  if (!hasStripeData) {
    return NextResponse.json(
      {
        success: false,
        idempotent: false,
        error: 'La transacció pare no té una imputació Stripe activa',
        code: 'PARENT_NOT_STRIPE',
      },
      { status: 400 }
    );
  }

  const lockResult = await acquireProcessLockAdmin({
    orgId: parsedBody.orgId,
    parentTxId: parsedBody.parentTxId,
    uid: authResult.uid,
    operation: 'undoRemittance',
  });

  if (!lockResult.ok) {
    return NextResponse.json(
      {
        success: false,
        idempotent: false,
        error: getLockFailureMessage(lockResult),
        code: lockResult.reason === 'locked_by_other' ? 'LOCKED_BY_OTHER' : 'LOCK_ERROR',
      },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  try {
    const archiveChildIds = new Set(plan.archiveChildIds);
    const deleteChildIds = new Set(plan.deleteChildIds);
    const archiveDonationIds = new Set(plan.archiveDonationIds);

    const transactionDocsToArchive = childDocs.filter((docSnap) => archiveChildIds.has(docSnap.id));
    const transactionDocsToDelete = childDocs.filter((docSnap) => deleteChildIds.has(docSnap.id));
    const donationDocsToArchive = donationSnap.docs.filter((docSnap) => archiveDonationIds.has(docSnap.id));

    let childrenArchived = 0;
    for (let cursor = 0; cursor < transactionDocsToArchive.length; cursor += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = transactionDocsToArchive.slice(cursor, cursor + BATCH_SIZE);

      for (const docSnap of chunk) {
        batch.update(docSnap.ref, {
          archivedAt: now,
          archivedByUid: authResult.uid,
          archivedReason: 'undo_process',
          archivedFromAction: 'undo_stripe',
        });
        childrenArchived++;
      }

      await batch.commit();
    }

    let childrenDeleted = 0;
    for (let cursor = 0; cursor < transactionDocsToDelete.length; cursor += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = transactionDocsToDelete.slice(cursor, cursor + BATCH_SIZE);

      for (const docSnap of chunk) {
        batch.delete(docSnap.ref);
        childrenDeleted++;
      }

      await batch.commit();
    }

    let donationsArchived = 0;
    for (let cursor = 0; cursor < donationDocsToArchive.length; cursor += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = donationDocsToArchive.slice(cursor, cursor + BATCH_SIZE);

      for (const docSnap of chunk) {
        batch.update(docSnap.ref, {
          archivedAt: now,
          archivedByUid: authResult.uid,
          archivedReason: 'undo_process',
          archivedFromAction: 'undo_stripe',
        });
        donationsArchived++;
      }

      await batch.commit();
    }

    if (plan.shouldDeleteRemittance && parentTx.remittanceId) {
      await db.doc(`organizations/${parsedBody.orgId}/remittances/${parentTx.remittanceId}`).delete();
    }

    if (plan.shouldResetParent) {
      const parentResetPayload: Record<string, ReturnType<typeof FieldValue.delete> | string> = {
        updatedAt: now,
      };
      for (const field of PARENT_STRIPE_RESET_FIELDS) {
        parentResetPayload[field] = FieldValue.delete();
      }
      await parentRef.update(parentResetPayload);
    }

    await writeAuditLog({
      db,
      orgId: parsedBody.orgId,
      parentTx,
      uid: authResult.uid,
      email: authResult.email,
      donationsArchived,
      childrenArchived,
      childrenDeleted,
      timestamp: now,
    });

    return NextResponse.json({
      success: true,
      idempotent: false,
      donationsArchived,
      childrenArchived,
      childrenDeleted,
    });
  } catch (error) {
    console.error('[transactions/stripe/undo] Error desfent Stripe:', error);
    return NextResponse.json(
      {
        success: false,
        idempotent: false,
        error: 'Error intern del servidor',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  } finally {
    await releaseProcessLockAdmin({
      orgId: parsedBody.orgId,
      parentTxId: parsedBody.parentTxId,
    });
  }
}
