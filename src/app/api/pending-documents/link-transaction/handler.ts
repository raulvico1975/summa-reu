import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import { getAdminApp, getAdminDb, verifyIdToken } from '@/lib/api/admin-sdk';
import { resolveServerEntitlement, type EntitlementDbLike } from '@/lib/api/require-entitlement';
import { mutateTransactionDocumentsAdmin } from '@/lib/server/transaction-document-registry';
import {
  buildPendingDocumentStorageIdentity,
  pendingDocumentStoragePathsMatch,
} from '@/lib/server/pending-document-storage-identity';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;

interface LinkPendingDocumentDeps {
  verifyIdTokenFn?: typeof verifyIdToken;
  getAdminDbFn?: () => Firestore;
  getStorageBucketFn?: () => Bucket;
  resolveEntitlementFn?: typeof resolveServerEntitlement;
  mutateTransactionDocumentsAdminFn?: typeof mutateTransactionDocumentsAdmin;
}

export async function handleLinkPendingDocumentPost(
  request: NextRequest,
  deps: LinkPendingDocumentDeps = {}
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
  const transactionId = typeof body.transactionId === 'string' ? body.transactionId : '';
  if (![orgId, pendingDocumentId, transactionId].every((value) => ID_PATTERN.test(value))) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  const db = (deps.getAdminDbFn ?? getAdminDb)();
  const resolveEntitlementFn = deps.resolveEntitlementFn ?? resolveServerEntitlement;
  const mutateTransactionDocumentsAdminFn = deps.mutateTransactionDocumentsAdminFn ?? mutateTransactionDocumentsAdmin;
  const memberSnap = await db.doc(`organizations/${orgId}/members/${auth.uid}`).get();
  const member = memberSnap.data() ?? {};
  const userAllowed = memberSnap.exists
    && (member.role === 'admin' || member.capabilities?.['moviments.editar'] === true);
  if (!userAllowed) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const [matchAccess, documentAccess] = await Promise.all([
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
  if (!matchAccess.allowed || !documentAccess.allowed) {
    return NextResponse.json({ error: 'ENTITLEMENT_DENIED' }, { status: 403 });
  }

  const pendingPath = `organizations/${orgId}/pendingDocuments/${pendingDocumentId}`;
  const pendingSnap = await db.doc(pendingPath).get();
  const pending = pendingSnap.data() ?? {};
  if (!pendingSnap.exists || pending.status !== 'confirmed') {
    return NextResponse.json({ error: 'PENDING_STATE_CONFLICT' }, { status: 409 });
  }
  const file = pending.file && typeof pending.file === 'object'
    ? pending.file as Record<string, unknown>
    : {};
  const sourcePath = typeof file.storagePath === 'string' ? file.storagePath : '';
  const identity = buildPendingDocumentStorageIdentity({
    orgId,
    pendingDocumentId,
    transactionId,
    filename: file.filename,
  });
  const filename = identity?.filename ?? '';
  const contentType = typeof file.contentType === 'string' && file.contentType.trim() ? file.contentType.trim() : null;
  const size = typeof file.sizeBytes === 'number' && Number.isFinite(file.sizeBytes) ? file.sizeBytes : null;
  if (!identity
    || !pendingDocumentStoragePathsMatch({ identity, originalPath: sourcePath })
    || (contentType !== null && contentType.length > 120)
    || (size !== null && (size < 0 || size > 15 * 1024 * 1024))) {
    return NextResponse.json({ error: 'INVALID_STORAGE_PATH' }, { status: 400 });
  }
  const bucket = (deps.getStorageBucketFn ?? (() => getStorage(getAdminApp()).bucket()))();
  const storageFile = bucket.file(sourcePath);
  const [exists] = await storageFile.exists();
  if (!exists) return NextResponse.json({ error: 'STORAGE_OBJECT_NOT_FOUND' }, { status: 404 });
  const finalStoragePath = identity.finalPath;
  const finalFile = bucket.file(finalStoragePath);
  let copied = false;

  try {
    const [destinationExists] = await finalFile.exists();
    if (!destinationExists) {
      await storageFile.copy(finalFile);
      copied = true;
    }
    const [signedUrl] = await finalFile.getSignedUrl({ action: 'read', expires: '03-01-2500' });

    const result = await mutateTransactionDocumentsAdminFn({
      db,
      orgId,
      transactionId,
      actorUid: auth.uid,
      fillTransactionFields: {
        category: typeof pending.categoryId === 'string' ? pending.categoryId : null,
        contactId: typeof pending.supplierId === 'string' ? pending.supplierId : null,
        contactType: 'supplier',
      },
      relatedWrites: [{
        path: pendingPath,
        action: 'update',
        expected: { status: pending.status },
        data: {
          status: 'matched',
          matchedTransactionId: transactionId,
          suggestedTransactionIds: [],
          'file.finalStoragePath': finalStoragePath,
          updatedAt: FieldValue.serverTimestamp(),
        },
      }],
      mutation: {
        action: 'link',
        makePrimary: true,
        document: {
          url: signedUrl,
          storagePath: finalStoragePath,
          filename,
          contentType,
          size,
          isPrimary: true,
          createdAt: new Date().toISOString(),
          createdByUid: auth.uid,
          source: 'transaction-upload',
        },
      },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (copied) {
      await finalFile.delete({ ignoreNotFound: true }).catch(() => undefined);
    }
    const code = error instanceof Error ? error.message : 'MUTATION_FAILED';
    return NextResponse.json({ error: code }, { status: code.endsWith('_CONFLICT') ? 409 : 400 });
  }
}
