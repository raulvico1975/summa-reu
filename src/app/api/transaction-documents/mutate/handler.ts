import { NextRequest, NextResponse } from 'next/server';
import { getAdminApp, getAdminDb, verifyIdToken } from '@/lib/api/admin-sdk';
import { getStorage } from 'firebase-admin/storage';
import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import { resolveServerEntitlement, type EntitlementDbLike } from '@/lib/api/require-entitlement';
import {
  mutateTransactionDocumentsAdmin,
  type ServerTransactionDocumentRecord,
  type TransactionDocumentMutation,
} from '@/lib/server/transaction-document-registry';
import { processTransactionDocumentStorageCleanupAdmin } from '@/lib/server/transaction-document-storage-cleanup';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;

interface TransactionDocumentMutationDeps {
  verifyIdTokenFn?: typeof verifyIdToken;
  getAdminDbFn?: () => Firestore;
  getStorageBucketFn?: () => Bucket;
  resolveEntitlementFn?: typeof resolveServerEntitlement;
  mutateTransactionDocumentsAdminFn?: typeof mutateTransactionDocumentsAdmin;
  processStorageCleanupFn?: typeof processTransactionDocumentStorageCleanupAdmin;
}

export async function handleTransactionDocumentMutationPost(
  request: NextRequest,
  deps: TransactionDocumentMutationDeps = {}
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
  const transactionId = typeof body.transactionId === 'string' ? body.transactionId : '';
  if (!ID_PATTERN.test(orgId) || !ID_PATTERN.test(transactionId)) {
    return NextResponse.json({ error: 'INVALID_ID' }, { status: 400 });
  }

  const db = (deps.getAdminDbFn ?? getAdminDb)();
  const bucket = (deps.getStorageBucketFn ?? (() => getStorage(getAdminApp()).bucket()))();
  const memberSnap = await db.doc(`organizations/${orgId}/members/${auth.uid}`).get();
  const member = memberSnap.data() ?? {};
  const userAllowed = memberSnap.exists
    && (member.role === 'admin' || member.capabilities?.['moviments.editar'] === true);
  if (!userAllowed) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const entitlement = await (deps.resolveEntitlementFn ?? resolveServerEntitlement)({
    db: db as unknown as EntitlementDbLike,
    orgId,
    capability: 'transactionDocuments.mutate',
    userAllowed,
  });
  if (!entitlement.allowed) {
    return NextResponse.json({ error: 'ENTITLEMENT_DENIED' }, { status: 403 });
  }

  const mutation = parseMutation(body, orgId, transactionId);
  if (!mutation) return NextResponse.json({ error: 'INVALID_MUTATION' }, { status: 400 });

  if (mutation.action === 'link') {
    const storagePath = mutation.document.storagePath;
    if (!storagePath) return NextResponse.json({ error: 'STORAGE_PATH_REQUIRED' }, { status: 400 });
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) return NextResponse.json({ error: 'STORAGE_OBJECT_NOT_FOUND' }, { status: 404 });
    const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: '03-01-2500' });
    mutation.document.url = signedUrl;
  }

  try {
    const result = await (deps.mutateTransactionDocumentsAdminFn ?? mutateTransactionDocumentsAdmin)({
      db,
      orgId,
      transactionId,
      mutation,
      actorUid: auth.uid,
    });
    const cleanup = await (deps.processStorageCleanupFn ?? processTransactionDocumentStorageCleanupAdmin)({
      db,
      bucket,
      orgId,
      transactionId,
      storageCleanupPaths: result.storageCleanupPaths,
    });
    return NextResponse.json(
      { ok: true, ...result, ...cleanup },
      { status: cleanup.cleanupPending ? 202 : 200 }
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : 'MUTATION_FAILED';
    const status = code === 'TRANSACTION_NOT_FOUND' || code === 'DOCUMENT_NOT_FOUND' ? 404
      : code === 'DOCUMENT_LIMIT_EXCEEDED' ? 409
        : 400;
    return NextResponse.json({ error: code }, { status });
  }
}

function parseMutation(
  body: Record<string, unknown>,
  orgId: string,
  transactionId: string
): TransactionDocumentMutation | null {
  if (body.action === 'link') {
    const value = body.document;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const storagePath = typeof record.storagePath === 'string' && record.storagePath.trim()
      ? record.storagePath.trim()
      : null;
    const allowedStoragePrefixes = [`organizations/${orgId}/documents/${transactionId}/`];
    if (!storagePath || (
      storagePath.length > 1024
      || !allowedStoragePrefixes.some((prefix) => storagePath.startsWith(prefix))
    )) return null;
    const filename = typeof record.filename === 'string' ? record.filename.trim() : '';
    if (!filename || filename.length > 240 || filename.includes('/')) return null;
    const contentType = typeof record.contentType === 'string' && record.contentType.trim()
      ? record.contentType.trim()
      : null;
    if (contentType && contentType.length > 120) return null;
    const size = typeof record.size === 'number' && Number.isFinite(record.size) ? record.size : null;
    if (size !== null && (size < 0 || size > 15 * 1024 * 1024)) return null;
    const document: ServerTransactionDocumentRecord = {
      // Placeholder: POST verifies the object and replaces this with a signed URL.
      url: 'https://storage.invalid/pending-verification',
      storagePath,
      filename,
      contentType,
      size,
      isPrimary: false,
      createdAt: new Date().toISOString(),
      createdByUid: null,
      source: 'transaction-upload',
    };
    return { action: 'link', document, makePrimary: body.makePrimary === true };
  }
  if (body.action === 'delete' || body.action === 'setPrimary') {
    const documentId = typeof body.documentId === 'string' ? body.documentId : '';
    if (!ID_PATTERN.test(documentId)) return null;
    return { action: body.action, documentId };
  }
  if (body.action === 'clearUrl') {
    const documentUrl = typeof body.documentUrl === 'string' && body.documentUrl.trim()
      ? body.documentUrl.trim()
      : null;
    if (!documentUrl) return null;
    return {
      action: 'clearUrl',
      documentUrl,
    };
  }
  return null;
}
