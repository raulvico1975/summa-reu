import { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import { getStorage } from 'firebase-admin/storage';
import { getAdminApp, getAdminDb, verifyIdToken } from '@/lib/api/admin-sdk';
import { getTransactionDocumentStorageCleanupPathsAdmin } from '@/lib/server/transaction-document-registry';
import { processTransactionDocumentStorageCleanupAdmin } from '@/lib/server/transaction-document-storage-cleanup';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;

interface RetryCleanupDeps {
  verifyIdTokenFn?: typeof verifyIdToken;
  getAdminDbFn?: () => Firestore;
  getStorageBucketFn?: () => Bucket;
  getCleanupPathsFn?: typeof getTransactionDocumentStorageCleanupPathsAdmin;
  processCleanupFn?: typeof processTransactionDocumentStorageCleanupAdmin;
}

export async function handleRetryTransactionDocumentCleanupPost(
  request: NextRequest,
  deps: RetryCleanupDeps = {}
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
  if (!ID_PATTERN.test(orgId) || !ID_PATTERN.test(transactionId)
    || Object.keys(body).some((key) => !['orgId', 'transactionId'].includes(key))) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  const db = (deps.getAdminDbFn ?? getAdminDb)();
  const memberSnap = await db.doc(`organizations/${orgId}/members/${auth.uid}`).get();
  const member = memberSnap.data() ?? {};
  if (!memberSnap.exists
    || (member.role !== 'admin' && member.capabilities?.['moviments.editar'] !== true)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    const paths = await (deps.getCleanupPathsFn ?? getTransactionDocumentStorageCleanupPathsAdmin)({
      db,
      orgId,
      transactionId,
    });
    const cleanup = await (deps.processCleanupFn ?? processTransactionDocumentStorageCleanupAdmin)({
      db,
      bucket: (deps.getStorageBucketFn ?? (() => getStorage(getAdminApp()).bucket()))(),
      orgId,
      transactionId,
      storageCleanupPaths: paths,
    });
    return NextResponse.json(
      { ok: true, cleanupPending: cleanup.cleanupPending, cleanupErrors: cleanup.cleanupErrors.length },
      { status: cleanup.cleanupPending ? 202 : 200 }
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : 'CLEANUP_RETRY_FAILED';
    return NextResponse.json({ error: code }, { status: 409 });
  }
}
