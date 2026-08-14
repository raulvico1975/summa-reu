import assert from 'node:assert/strict';
import test from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';
import {
  finalizeTransactionDocumentStorageCleanupAdmin,
  mutateTransactionDocumentsAdmin,
} from '@/lib/server/transaction-document-registry';
import { processTransactionDocumentStorageCleanupAdmin } from '@/lib/server/transaction-document-storage-cleanup';

class FakeRef {
  constructor(public path: string, protected readonly db: FakeDb) {}
  get id() { return this.path.split('/').pop() ?? ''; }
  collection(name: string) { return new FakeCollection(`${this.path}/${name}`, this.db); }
}

class FakeCollection extends FakeRef {
  private nextId = 0;
  doc(id?: string) { return new FakeRef(`${this.path}/${id ?? `generated-${++this.nextId}`}`, this.db); }
}

class FakeDb {
  docs = new Map<string, Record<string, unknown>>();
  throwOnUpdatePath: string | null = null;
  throwOnDeletePath: string | null = null;
  doc(path: string) { return new FakeRef(path, this); }
  async runTransaction<T>(callback: (tx: ReturnType<FakeDb['transaction']>) => Promise<T>) {
    const staged = new Map([...this.docs].map(([path, data]) => [path, structuredClone(data)]));
    const tx = this.transaction(staged);
    const result = await callback(tx);
    this.docs = staged;
    return result;
  }
  private transaction(staged = this.docs) {
    return {
      get: async (ref: FakeRef) => {
        if (ref instanceof FakeCollection) {
          const prefix = `${ref.path}/`;
          const docs = [...staged.entries()]
            .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
            .map(([path, data]) => ({ id: path.slice(prefix.length), data: () => structuredClone(data) }));
          return { size: docs.length, docs };
        }
        const data = staged.get(ref.path);
        return { exists: Boolean(data), data: () => data ? structuredClone(data) : undefined };
      },
      set: (ref: FakeRef, data: Record<string, unknown>) => staged.set(ref.path, structuredClone(data)),
      update: (ref: FakeRef, data: Record<string, unknown>) => {
        if (this.throwOnUpdatePath === ref.path) throw new Error('INJECTED_WRITE_FAILURE');
        const current = staged.get(ref.path);
        if (!current) throw new Error('NOT_FOUND');
        staged.set(ref.path, { ...current, ...structuredClone(data) });
      },
      delete: (ref: FakeRef) => {
        if (this.throwOnDeletePath === ref.path) throw new Error('INJECTED_DELETE_FAILURE');
        staged.delete(ref.path);
      },
    };
  }
}

const TX = 'organizations/org-1/transactions/tx-1';
const PENDING = 'organizations/org-1/pendingDocuments/pending-1';

function linkMutation() {
  return {
    action: 'link' as const,
    makePrimary: true,
    document: {
      url: 'https://storage.example/signed-a',
      storagePath: 'organizations/org-1/documents/tx-1/pending-1--invoice.pdf',
      filename: 'pending-1--invoice.pdf',
      contentType: 'application/pdf',
      size: 100,
      isPrimary: true,
      createdAt: '2026-08-14T10:00:00.000Z',
      createdByUid: 'user-1',
      source: 'transaction-upload' as const,
    },
  };
}

test('link actualitza metadata, mirror, registry i pending dins una sola transacció', async () => {
  const db = new FakeDb();
  db.docs.set(TX, { document: null, updatedAt: null });
  db.docs.set(PENDING, { status: 'confirmed', matchedTransactionId: null });
  const result = await mutateTransactionDocumentsAdmin({
    db: db as unknown as Firestore,
    orgId: 'org-1',
    transactionId: 'tx-1',
    actorUid: 'user-1',
    nowIso: '2026-08-14T10:00:00.000Z',
    mutation: linkMutation(),
    relatedWrites: [{
      path: PENDING,
      action: 'update',
      expected: { status: 'confirmed' },
      data: { status: 'matched', matchedTransactionId: 'tx-1' },
    }],
  });
  assert.equal(result.documentCount, 1);
  assert.equal(db.docs.get(TX)?.document, 'https://storage.example/signed-a');
  assert.equal(db.docs.get(PENDING)?.status, 'matched');
  assert.equal(db.docs.get('organizations/org-1/transactionDocumentRegistry/tx-1')?.documentCount, 1);
});

test('fallada després de preparar writes fa rollback de tx, metadata, registry i pending', async () => {
  const db = new FakeDb();
  db.docs.set(TX, { document: null, updatedAt: null });
  db.docs.set(PENDING, { status: 'confirmed', matchedTransactionId: null });
  db.throwOnUpdatePath = PENDING;
  await assert.rejects(() => mutateTransactionDocumentsAdmin({
    db: db as unknown as Firestore,
    orgId: 'org-1',
    transactionId: 'tx-1',
    actorUid: 'user-1',
    mutation: linkMutation(),
    relatedWrites: [{ path: PENDING, action: 'update', data: { status: 'matched' } }],
  }), /INJECTED_WRITE_FAILURE/);
  assert.deepEqual(db.docs.get(TX), { document: null, updatedAt: null });
  assert.deepEqual(db.docs.get(PENDING), { status: 'confirmed', matchedTransactionId: null });
  assert.equal([...db.docs.keys()].some((path) => path.includes('/documents/')), false);
  assert.equal([...db.docs.keys()].some((path) => path.includes('transactionDocumentRegistry')), false);
});

test('retry amb URL nova i mateix storagePath és idempotent', async () => {
  const db = new FakeDb();
  db.docs.set(TX, { document: null });
  const first = await mutateTransactionDocumentsAdmin({
    db: db as unknown as Firestore,
    orgId: 'org-1', transactionId: 'tx-1', actorUid: 'user-1', mutation: linkMutation(),
  });
  const secondMutation = linkMutation();
  secondMutation.document.url = 'https://storage.example/signed-b';
  const second = await mutateTransactionDocumentsAdmin({
    db: db as unknown as Firestore,
    orgId: 'org-1', transactionId: 'tx-1', actorUid: 'user-1', mutation: secondMutation,
  });
  assert.equal(second.idempotent, true);
  assert.equal(second.documentId, first.documentId);
  assert.equal(second.documentCount, 1);
});

test('clear per storagePath conserva els altres adjunts i recalcula primary', async () => {
  const db = new FakeDb();
  db.docs.set(TX, { document: 'https://storage.example/a' });
  db.docs.set(`${TX}/documents/a`, { ...linkMutation().document, url: 'https://storage.example/a', isPrimary: true });
  db.docs.set(`${TX}/documents/b`, {
    ...linkMutation().document,
    url: 'https://storage.example/b',
    storagePath: 'organizations/org-1/documents/tx-1/pending-2--invoice.pdf',
    isPrimary: false,
  });
  db.docs.set('organizations/org-1/transactionDocumentRegistry/tx-1', {
    hasDocuments: true, documentCount: 2, primaryDocumentId: 'a', registryVersion: 1,
  });
  const result = await mutateTransactionDocumentsAdmin({
    db: db as unknown as Firestore,
    orgId: 'org-1', transactionId: 'tx-1', actorUid: 'user-1',
    mutation: { action: 'clearStoragePath', storagePath: linkMutation().document.storagePath },
  });
  assert.equal(result.documentCount, 1);
  assert.equal(db.docs.has(`${TX}/documents/a`), false);
  assert.equal(db.docs.has(`${TX}/documents/b`), true);
  assert.equal(db.docs.get(TX)?.document, 'https://storage.example/b');
  assert.deepEqual(result.storageCleanupPaths, [linkMutation().document.storagePath]);
});

test('delete del darrer adjunt conserva registry fins que Storage queda finalitzat', async () => {
  const db = new FakeDb();
  const registryPath = 'organizations/org-1/transactionDocumentRegistry/tx-1';
  db.docs.set(TX, { document: linkMutation().document.url });
  db.docs.set(`${TX}/documents/a`, linkMutation().document);
  db.docs.set(registryPath, {
    hasDocuments: true, documentCount: 1, primaryDocumentId: 'a', registryVersion: 1,
  });
  const removed = await mutateTransactionDocumentsAdmin({
    db: db as unknown as Firestore,
    orgId: 'org-1', transactionId: 'tx-1', actorUid: 'user-1',
    mutation: { action: 'delete', documentId: 'a' },
  });

  assert.equal(removed.cleanupPending, true);
  assert.deepEqual(removed.storageCleanupPaths, [linkMutation().document.storagePath]);
  assert.deepEqual(db.docs.get(registryPath), {
    hasDocuments: false,
    documentCount: 0,
    primaryDocumentId: null,
    registryVersion: 1,
    pendingStorageCleanupPaths: [linkMutation().document.storagePath],
    updatedAt: db.docs.get(registryPath)?.updatedAt,
  });

  const finalized = await finalizeTransactionDocumentStorageCleanupAdmin({
    db: db as unknown as Firestore,
    orgId: 'org-1', transactionId: 'tx-1',
    cleanedPaths: removed.storageCleanupPaths,
  });
  assert.equal(finalized.cleanupPending, false);
  assert.equal(db.docs.has(registryPath), false);
});

test('delete refusa metadata amb Storage fora de la transacció i fa rollback', async () => {
  const db = new FakeDb();
  db.docs.set(TX, { document: 'https://storage.example/foreign' });
  db.docs.set(`${TX}/documents/a`, {
    ...linkMutation().document,
    url: 'https://storage.example/foreign',
    storagePath: 'organizations/org-1/documents/tx-other/secret.pdf',
  });
  await assert.rejects(() => mutateTransactionDocumentsAdmin({
    db: db as unknown as Firestore,
    orgId: 'org-1', transactionId: 'tx-1', actorUid: 'user-1',
    mutation: { action: 'delete', documentId: 'a' },
  }), /STORAGE_PATH_REQUIRES_ADMIN_REPAIR/);
  assert.equal(db.docs.has(`${TX}/documents/a`), true);
  assert.equal(db.docs.get(TX)?.document, 'https://storage.example/foreign');
});

test('pending delete encola original i final encara que la metadata ja no existeixi', async () => {
  const db = new FakeDb();
  const original = 'organizations/org-1/pendingDocuments/pending-1/original.pdf';
  const finalPath = 'organizations/org-1/documents/tx-1/pending-1--renamed.pdf';
  db.docs.set(TX, { document: null });
  db.docs.set(PENDING, { status: 'matched', matchedTransactionId: 'tx-1' });
  const result = await mutateTransactionDocumentsAdmin({
    db: db as unknown as Firestore,
    orgId: 'org-1', transactionId: 'tx-1', actorUid: 'user-1',
    mutation: { action: 'clearStoragePath', storagePath: finalPath },
    additionalStorageCleanupPaths: [original, finalPath],
    relatedWrites: [{
      path: PENDING,
      action: 'delete',
      expected: { status: 'matched', matchedTransactionId: 'tx-1' },
    }],
  });
  assert.equal(result.idempotent, true);
  assert.deepEqual(result.storageCleanupPaths, [original, finalPath]);
  assert.equal(db.docs.has(PENDING), false);
});

test('cleanup Storage fallit queda durable i retry amb objecte absent finalitza', async () => {
  const db = new FakeDb();
  const registryPath = 'organizations/org-1/transactionDocumentRegistry/tx-1';
  const storagePath = linkMutation().document.storagePath;
  db.docs.set(registryPath, {
    hasDocuments: false,
    documentCount: 0,
    primaryDocumentId: null,
    registryVersion: 1,
    pendingStorageCleanupPaths: [storagePath],
  });
  const failed = await processTransactionDocumentStorageCleanupAdmin({
    db: db as unknown as Firestore,
    bucket: {
      file: () => ({ delete: async () => { throw new Error('STORAGE_DOWN'); } }),
    } as never,
    orgId: 'org-1', transactionId: 'tx-1', storageCleanupPaths: [storagePath],
  });
  assert.equal(failed.cleanupPending, true);
  assert.equal(db.docs.has(registryPath), true);

  const retried = await processTransactionDocumentStorageCleanupAdmin({
    db: db as unknown as Firestore,
    bucket: {
      file: () => ({ delete: async () => undefined }),
    } as never,
    orgId: 'org-1', transactionId: 'tx-1', storageCleanupPaths: [storagePath],
  });
  assert.equal(retried.cleanupPending, false);
  assert.equal(db.docs.has(registryPath), false);
});

test('Storage eliminat però finalize fallit conserva outbox per retry', async () => {
  const db = new FakeDb();
  const registryPath = 'organizations/org-1/transactionDocumentRegistry/tx-1';
  const storagePath = linkMutation().document.storagePath;
  db.docs.set(registryPath, {
    hasDocuments: false, documentCount: 0, primaryDocumentId: null, registryVersion: 1,
    pendingStorageCleanupPaths: [storagePath],
  });
  db.throwOnDeletePath = registryPath;
  const result = await processTransactionDocumentStorageCleanupAdmin({
    db: db as unknown as Firestore,
    bucket: { file: () => ({ delete: async () => undefined }) } as never,
    orgId: 'org-1', transactionId: 'tx-1', storageCleanupPaths: [storagePath],
  });
  assert.equal(result.cleanupPending, true);
  assert.deepEqual(db.docs.get(registryPath)?.pendingStorageCleanupPaths, [storagePath]);
});

test('límit documental permet 39 a 40 i bloqueja el 41è amb rollback', async () => {
  const db = new FakeDb();
  db.docs.set(TX, { document: 'https://storage.example/0' });
  for (let index = 0; index < 39; index += 1) {
    db.docs.set(`${TX}/documents/doc-${index}`, {
      ...linkMutation().document,
      url: `https://storage.example/${index}`,
      storagePath: `organizations/org-1/documents/tx-1/doc-${index}.pdf`,
      isPrimary: index === 0,
    });
  }
  const fortieth = linkMutation();
  fortieth.document.storagePath = 'organizations/org-1/documents/tx-1/doc-39.pdf';
  fortieth.document.url = 'https://storage.example/39';
  const allowed = await mutateTransactionDocumentsAdmin({
    db: db as unknown as Firestore,
    orgId: 'org-1', transactionId: 'tx-1', actorUid: 'user-1', mutation: fortieth,
  });
  assert.equal(allowed.documentCount, 40);
  const snapshot = structuredClone([...db.docs.entries()]);
  const fortyFirst = linkMutation();
  fortyFirst.document.storagePath = 'organizations/org-1/documents/tx-1/doc-40.pdf';
  await assert.rejects(() => mutateTransactionDocumentsAdmin({
    db: db as unknown as Firestore,
    orgId: 'org-1', transactionId: 'tx-1', actorUid: 'user-1', mutation: fortyFirst,
  }), /DOCUMENT_LIMIT_EXCEEDED/);
  assert.deepEqual([...db.docs.entries()], snapshot);
});

test('snapshot preexistent de 41 documents falla tancat abans de qualsevol mutació', async () => {
  const db = new FakeDb();
  db.docs.set(TX, { document: 'https://storage.example/0' });
  for (let index = 0; index < 41; index += 1) {
    db.docs.set(`${TX}/documents/doc-${index}`, {
      ...linkMutation().document,
      url: `https://storage.example/${index}`,
      storagePath: `organizations/org-1/documents/tx-1/doc-${index}.pdf`,
      isPrimary: index === 0,
    });
  }
  const snapshot = structuredClone([...db.docs.entries()]);
  await assert.rejects(() => mutateTransactionDocumentsAdmin({
    db: db as unknown as Firestore,
    orgId: 'org-1', transactionId: 'tx-1', actorUid: 'user-1',
    mutation: { action: 'setPrimary', documentId: 'doc-2' },
  }), /DOCUMENT_LIMIT_EXCEEDED/);
  assert.deepEqual([...db.docs.entries()], snapshot);
});
