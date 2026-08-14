import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { handleLinkPendingDocumentPost } from '@/app/api/pending-documents/link-transaction/handler';
import { handleUnlinkPendingDocumentPost } from '@/app/api/pending-documents/unlink-transaction/handler';
import { handleRetryTransactionDocumentCleanupPost } from '@/app/api/transaction-documents/retry-cleanup/handler';

class FakeSnapshot {
  constructor(private readonly value: Record<string, unknown> | null) {}
  get exists() { return this.value !== null; }
  data() { return this.value ?? undefined; }
}

class FakeDb {
  constructor(readonly docs: Record<string, Record<string, unknown>>) {}
  doc(path: string) {
    return { get: async () => new FakeSnapshot(this.docs[path] ?? null) };
  }
}

class FakeFile {
  constructor(
    readonly path: string,
    private readonly files: Map<string, string>,
    private readonly failSigningPath: string | null
  ) {}
  async exists() { return [this.files.has(this.path)] as const; }
  async copy(destination: FakeFile) {
    const value = this.files.get(this.path);
    if (value === undefined) throw new Error('SOURCE_MISSING');
    this.files.set(destination.path, value);
  }
  async getSignedUrl() {
    if (this.path === this.failSigningPath) throw new Error('SIGNING_FAILED');
    return [`https://storage.test/${encodeURIComponent(this.path)}`] as const;
  }
  async delete() { this.files.delete(this.path); }
}

class FakeBucket {
  readonly files: Map<string, string>;
  constructor(initial: Record<string, string>, private readonly failSigningPath: string | null = null) {
    this.files = new Map(Object.entries(initial));
  }
  file(path: string) { return new FakeFile(path, this.files, this.failSigningPath); }
}

const allowEntitlement = async () => ({
  allowed: true,
  diagnostics: [],
  enforcementMode: 'active' as const,
});

function request(path: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function baseDocs(extra: Record<string, Record<string, unknown>> = {}) {
  return {
    'organizations/org-1/members/user-1': { role: 'admin' },
    ...extra,
  };
}

test('link elimina només el destí creat per aquest intent si falla la signatura', async () => {
  const original = 'organizations/org-1/pendingDocuments/pending-1/ticket.pdf';
  const finalPath = 'organizations/org-1/documents/tx-1/pending-1--ticket.pdf';
  const bucket = new FakeBucket({ [original]: 'payload' }, finalPath);
  let mutateCalls = 0;
  const response = await handleLinkPendingDocumentPost(
    request('/api/pending-documents/link-transaction', {
      orgId: 'org-1', pendingDocumentId: 'pending-1', transactionId: 'tx-1',
    }),
    {
      verifyIdTokenFn: async () => ({ uid: 'user-1' }),
      getAdminDbFn: () => new FakeDb(baseDocs({
        'organizations/org-1/pendingDocuments/pending-1': {
          status: 'confirmed',
          file: { filename: 'ticket.pdf', storagePath: original, contentType: 'application/pdf', sizeBytes: 8 },
        },
      })) as never,
      getStorageBucketFn: () => bucket as never,
      resolveEntitlementFn: allowEntitlement,
      mutateTransactionDocumentsAdminFn: async () => {
        mutateCalls += 1;
        throw new Error('UNREACHABLE');
      },
    }
  );

  assert.equal(response.status, 400);
  assert.equal(mutateCalls, 0);
  assert.equal(bucket.files.has(original), true);
  assert.equal(bucket.files.has(finalPath), false);
});

test('unlink d un pending orfe retorna 409 sense mutacions ni paths', async () => {
  let mutateCalls = 0;
  const response = await handleUnlinkPendingDocumentPost(
    request('/api/pending-documents/unlink-transaction', {
      orgId: 'org-1', pendingDocumentId: 'pending-1', action: 'delete',
    }),
    {
      verifyIdTokenFn: async () => ({ uid: 'user-1' }),
      getAdminDbFn: () => new FakeDb(baseDocs({
        'organizations/org-1/pendingDocuments/pending-1': {
          status: 'matched', matchedTransactionId: 'tx-1',
          file: {
            filename: 'ticket.pdf',
            storagePath: 'organizations/org-1/pendingDocuments/pending-1/ticket.pdf',
            finalStoragePath: 'organizations/org-1/documents/tx-1/pending-1--ticket.pdf',
          },
        },
      })) as never,
      resolveEntitlementFn: allowEntitlement,
      mutateTransactionDocumentsAdminFn: async () => {
        mutateCalls += 1;
        throw new Error('UNREACHABLE');
      },
    }
  );

  assert.equal(response.status, 409);
  assert.equal(mutateCalls, 0);
  assert.deepEqual(await response.json(), { error: 'ORPHAN_REQUIRES_ADMIN_REPAIR' });
});

test('unlink delete retorna original i final; confirm no retorna cap path', async () => {
  const original = 'organizations/org-1/pendingDocuments/pending-1/ticket.pdf';
  const finalPath = 'organizations/org-1/documents/tx-1/pending-1--ticket.pdf';
  const db = new FakeDb(baseDocs({
    'organizations/org-1/pendingDocuments/pending-1': {
      status: 'matched', matchedTransactionId: 'tx-1',
      file: { filename: 'ticket.pdf', storagePath: original, finalStoragePath: finalPath },
    },
    'organizations/org-1/transactions/tx-1': { document: 'https://storage.test/final' },
  }));
  const commonDeps = {
    verifyIdTokenFn: async () => ({ uid: 'user-1' }),
    getAdminDbFn: () => db as never,
    resolveEntitlementFn: allowEntitlement,
    mutateTransactionDocumentsAdminFn: async () => ({
      documentId: 'doc-a', documentCount: 0, primaryDocumentId: null, idempotent: false,
      storageCleanupPaths: [original, finalPath], cleanupPending: true,
    }),
    getStorageBucketFn: () => new FakeBucket({}) as never,
    processStorageCleanupFn: async () => ({ cleanupPending: false, storageCleanupPaths: [], cleanupErrors: [] }),
  };

  const deleting = await handleUnlinkPendingDocumentPost(
    request('/api/pending-documents/unlink-transaction', {
      orgId: 'org-1', pendingDocumentId: 'pending-1', action: 'delete',
    }),
    commonDeps
  );
  const confirming = await handleUnlinkPendingDocumentPost(
    request('/api/pending-documents/unlink-transaction', {
      orgId: 'org-1', pendingDocumentId: 'pending-1', action: 'confirm',
    }),
    commonDeps
  );

  assert.deepEqual((await deleting.json()).storagePaths, []);
  assert.deepEqual((await confirming.json()).storagePaths, []);
});

test('retry cleanup després de reload usa només outbox backend i rebutja path injectat', async () => {
  const db = new FakeDb(baseDocs());
  const finalPath = 'organizations/org-1/documents/tx-1/upload--ticket.pdf';
  let receivedPaths: string[] = [];
  const deps = {
    verifyIdTokenFn: async () => ({ uid: 'user-1' }),
    getAdminDbFn: () => db as never,
    getStorageBucketFn: () => new FakeBucket({}) as never,
    getCleanupPathsFn: async () => [finalPath],
    processCleanupFn: async (input: { storageCleanupPaths: string[] }) => {
      receivedPaths = input.storageCleanupPaths;
      return { cleanupPending: false, storageCleanupPaths: [], cleanupErrors: [] };
    },
  };
  const injected = await handleRetryTransactionDocumentCleanupPost(
    request('/api/transaction-documents/retry-cleanup', {
      orgId: 'org-1', transactionId: 'tx-1', storagePath: 'organizations/org-1/private/secret.pdf',
    }),
    deps as never
  );
  assert.equal(injected.status, 400);
  assert.deepEqual(receivedPaths, []);

  const retried = await handleRetryTransactionDocumentCleanupPost(
    request('/api/transaction-documents/retry-cleanup', { orgId: 'org-1', transactionId: 'tx-1' }),
    deps as never
  );
  assert.equal(retried.status, 200);
  assert.deepEqual(receivedPaths, [finalPath]);
});
