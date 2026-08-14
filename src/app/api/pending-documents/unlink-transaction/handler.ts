import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import { getStorage } from 'firebase-admin/storage';
import { getAdminApp, getAdminDb, verifyIdToken } from '@/lib/api/admin-sdk';
import { resolveServerEntitlement, type EntitlementDbLike } from '@/lib/api/require-entitlement';
import { mutateTransactionDocumentsAdmin } from '@/lib/server/transaction-document-registry';
import {
  buildPendingDocumentStorageIdentity,
  pendingDocumentStoragePathsMatch,
} from '@/lib/server/pending-document-storage-identity';
import { processTransactionDocumentStorageCleanupAdmin } from '@/lib/server/transaction-document-storage-cleanup';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;

interface UnlinkPendingDocumentDeps {
  verifyIdTokenFn?: typeof verifyIdToken;
  getAdminDbFn?: () => Firestore;
  resolveEntitlementFn?: typeof resolveServerEntitlement;
  mutateTransactionDocumentsAdminFn?: typeof mutateTransactionDocumentsAdmin;
  getStorageBucketFn?: () => Bucket;
  processStorageCleanupFn?: typeof processTransactionDocumentStorageCleanupAdmin;
}

export async function handleUnlinkPendingDocumentPost(
  request: NextRequest,
  deps: UnlinkPendingDocumentDeps = {}
) {
  const auth = await (deps.verifyIdTokenFn ?? verifyIdToken)(request);
  if (!auth) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  const orgId = typeof body.orgId === 'string' ? body.orgId : '';
  const pendingDocumentId = typeof body.pendingDocumentId === 'string' ? body.pendingDocumentId : '';
  const action = body.action === 'confirm' || body.action === 'delete' ? body.action : null;
  if (!ID_PATTERN.test(orgId) || !ID_PATTERN.test(pendingDocumentId) || !action) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  const db = (deps.getAdminDbFn ?? getAdminDb)();
  const resolveEntitlementFn = deps.resolveEntitlementFn ?? resolveServerEntitlement;
  const mutateTransactionDocumentsAdminFn = deps.mutateTransactionDocumentsAdminFn ?? mutateTransactionDocumentsAdmin;
  const processStorageCleanupFn = deps.processStorageCleanupFn ?? processTransactionDocumentStorageCleanupAdmin;
  const memberSnap = await db.doc(`organizations/${orgId}/members/${auth.uid}`).get();
  const member = memberSnap.data() ?? {};
  const userAllowed = memberSnap.exists
    && (member.role === 'admin' || member.capabilities?.['moviments.editar'] === true);
  if (!userAllowed) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const [pendingCapability, matchCapability, transactionCapability] = await Promise.all([
    resolveEntitlementFn({
      db: db as unknown as EntitlementDbLike,
      orgId,
      capability: 'pendingDocuments.mutate',
      userAllowed,
    }),
    resolveEntitlementFn({
      db: db as unknown as EntitlementDbLike,
      orgId,
      capability: 'pendingDocuments.match',
      userAllowed,
    }),
    resolveEntitlementFn({
      db: db as unknown as EntitlementDbLike,
      orgId,
      capability: 'transactionDocuments.mutate',
      userAllowed,
    }),
  ]);
  if (!pendingCapability.allowed || !matchCapability.allowed || !transactionCapability.allowed) {
    return NextResponse.json({ error: 'ENTITLEMENT_DENIED' }, { status: 403 });
  }

  const pendingPath = `organizations/${orgId}/pendingDocuments/${pendingDocumentId}`;
  const pendingSnap = await db.doc(pendingPath).get();
  const pending = pendingSnap.data() ?? {};
  const transactionId = typeof pending.matchedTransactionId === 'string' ? pending.matchedTransactionId : '';
  if (!pendingSnap.exists || pending.status !== 'matched' || !ID_PATTERN.test(transactionId)) {
    return NextResponse.json({ error: 'PENDING_NOT_MATCHED' }, { status: 409 });
  }
  const transactionSnap = await db.doc(`organizations/${orgId}/transactions/${transactionId}`).get();
  if (!transactionSnap.exists) {
    return NextResponse.json({ error: 'ORPHAN_REQUIRES_ADMIN_REPAIR' }, { status: 409 });
  }

  const file = pending.file && typeof pending.file === 'object'
    ? pending.file as Record<string, unknown>
    : {};
  const originalPath = typeof file.storagePath === 'string' ? file.storagePath : '';
  const finalPath = typeof file.finalStoragePath === 'string' ? file.finalStoragePath : '';
  const identity = buildPendingDocumentStorageIdentity({
    orgId,
    pendingDocumentId,
    transactionId,
    filename: file.filename,
  });
  if (!identity || !pendingDocumentStoragePathsMatch({ identity, originalPath, finalPath })) {
    return NextResponse.json({ error: 'PENDING_STORAGE_IDENTITY_INVALID' }, { status: 409 });
  }
  const canonicalStoragePath = finalPath || identity.finalPath;

  try {
    const result = await mutateTransactionDocumentsAdminFn({
      db,
      orgId,
      transactionId,
      actorUid: auth.uid,
      mutation: {
        action: 'clearStoragePath',
        storagePath: canonicalStoragePath,
        preserveStorage: action === 'confirm',
      },
      additionalStorageCleanupPaths: action === 'delete' ? [originalPath, identity.finalPath] : [],
      relatedWrites: [{
        path: pendingPath,
        action: action === 'delete' ? 'delete' : 'update',
        expected: { status: 'matched', matchedTransactionId: transactionId },
        ...(action === 'confirm' ? {
          data: {
            status: 'confirmed',
            matchedTransactionId: null,
            updatedAt: FieldValue.serverTimestamp(),
          },
        } : {}),
      }],
    });
    const cleanup = await processStorageCleanupFn({
      db,
      bucket: (deps.getStorageBucketFn ?? (() => getStorage(getAdminApp()).bucket()))(),
      orgId,
      transactionId,
      storageCleanupPaths: result.storageCleanupPaths,
    });
    return NextResponse.json(
      {
        ok: true,
        transactionId,
        transactionDocumentCleared: !result.idempotent,
        cleanupPending: cleanup.cleanupPending,
        cleanupErrors: cleanup.cleanupErrors.length,
        storagePaths: [],
      },
      { status: cleanup.cleanupPending ? 202 : 200 }
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : 'MUTATION_FAILED';
    return NextResponse.json({ error: code }, { status: code.endsWith('_CONFLICT') ? 409 : 400 });
  }
}
