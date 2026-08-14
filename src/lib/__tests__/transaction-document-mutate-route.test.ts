import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { handleTransactionDocumentMutationPost } from '@/app/api/transaction-documents/mutate/handler';

class FakeSnapshot {
  constructor(private readonly value: Record<string, unknown> | null) {}
  get exists() { return this.value !== null; }
  data() { return this.value ?? undefined; }
}

test('generic route neutralitza URL, actor, data i source declarats pel client', async () => {
  const storagePath = 'organizations/org-1/documents/tx-1/attempt--invoice.pdf';
  const capturedInputs: Record<string, unknown>[] = [];
  const request = new NextRequest('http://localhost/api/transaction-documents/mutate', {
    method: 'POST',
    headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'link',
      orgId: 'org-1',
      transactionId: 'tx-1',
      document: {
        url: 'https://attacker.example/secret',
        storagePath,
        filename: 'invoice.pdf',
        contentType: 'application/pdf',
        size: 10,
        createdAt: '1999-01-01T00:00:00.000Z',
        createdByUid: 'attacker',
        source: 'legacy-document',
      },
    }),
  });
  const response = await handleTransactionDocumentMutationPost(request, {
    verifyIdTokenFn: async () => ({ uid: 'user-1' }),
    getAdminDbFn: () => ({
      doc: () => ({ get: async () => new FakeSnapshot({ role: 'admin' }) }),
    }) as never,
    getStorageBucketFn: () => ({
      file: (path: string) => ({
        exists: async () => [path === storagePath],
        getSignedUrl: async () => ['https://storage.example/server-signed'],
      }),
    }) as never,
    resolveEntitlementFn: async () => ({ allowed: true, diagnostics: [], enforcementMode: 'active' }),
    mutateTransactionDocumentsAdminFn: async (input) => {
      capturedInputs.push(input as unknown as Record<string, unknown>);
      return {
        documentId: 'doc-1', documentCount: 1, primaryDocumentId: 'doc-1', idempotent: false,
        storageCleanupPaths: [], cleanupPending: false,
      };
    },
    processStorageCleanupFn: async () => ({
      cleanupPending: false, storageCleanupPaths: [], cleanupErrors: [],
    }),
  });

  assert.equal(response.status, 200);
  const captured = capturedInputs[0];
  assert.ok(captured);
  assert.equal(captured.actorUid, 'user-1');
  const mutation = captured.mutation as { document: Record<string, unknown> };
  assert.equal(mutation.document.url, 'https://storage.example/server-signed');
  assert.equal(mutation.document.createdByUid, null);
  assert.equal(mutation.document.source, 'transaction-upload');
  assert.notEqual(mutation.document.createdAt, '1999-01-01T00:00:00.000Z');
});
