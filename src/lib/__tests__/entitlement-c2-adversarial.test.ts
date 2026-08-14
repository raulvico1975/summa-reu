import assert from 'node:assert/strict';
import test from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';
import { auditTransactionDocumentRegistry } from '@/lib/entitlements/transaction-document-audit';
import { mutateTransactionDocumentsAdmin } from '@/lib/server/transaction-document-registry';
import {
  buildPendingDocumentStorageIdentity,
  pendingDocumentStoragePathsMatch,
} from '@/lib/server/pending-document-storage-identity';

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
  doc(path: string) { return new FakeRef(path, this); }
  async runTransaction<T>(callback: (tx: ReturnType<FakeDb['transaction']>) => Promise<T>) {
    const staged = new Map([...this.docs].map(([path, data]) => [path, structuredClone(data)]));
    const result = await callback(this.transaction(staged));
    this.docs = staged;
    return result;
  }
  private transaction(staged: Map<string, Record<string, unknown>>) {
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
        const current = staged.get(ref.path);
        if (!current) throw new Error('NOT_FOUND');
        staged.set(ref.path, { ...current, ...structuredClone(data) });
      },
      delete: (ref: FakeRef) => { staged.delete(ref.path); },
    };
  }
}

test('auditoria bloqueja metadata i Storage coherents entre si però d una altra org o transaccio', () => {
  const foreignPath = 'organizations/org-2/documents/tx-9/secret.pdf';
  const report = auditTransactionDocumentRegistry([{
    organizationId: 'org-1',
    transactionId: 'tx-1',
    mirrorDocument: 'https://storage.example/secret',
    documents: [{
      id: 'doc-a',
      url: 'https://storage.example/secret',
      storagePath: foreignPath,
      isPrimary: true,
      source: 'transaction-upload',
    }],
    storageObjectPaths: [foreignPath],
    registry: {
      hasDocuments: true,
      documentCount: 1,
      primaryDocumentId: 'doc-a',
      registryVersion: 1,
    },
  }]);

  assert.equal(report.canActivate, false);
  assert.equal(report.findings.length, 1);
});

test('auditoria bloqueja URL Firebase divergent i dos IDs amb la mateixa identitat Storage', () => {
  const localPath = 'organizations/org-1/documents/tx-1/local.pdf';
  const foreignUrl = 'https://firebasestorage.googleapis.com/v0/b/test/o/organizations%2Forg-2%2Fdocuments%2Ftx-9%2Fsecret.pdf?alt=media';
  const report = auditTransactionDocumentRegistry([{
    organizationId: 'org-1',
    transactionId: 'tx-1',
    mirrorDocument: foreignUrl,
    documents: [
      { id: 'doc-a', url: foreignUrl, storagePath: localPath, isPrimary: true, source: 'transaction-upload' },
      { id: 'doc-b', url: foreignUrl, storagePath: localPath, isPrimary: false, source: 'transaction-upload' },
    ],
    storageObjectPaths: [localPath],
    registry: {
      hasDocuments: true,
      documentCount: 2,
      primaryDocumentId: 'doc-a',
      registryVersion: 1,
    },
  }]);

  assert.equal(report.canActivate, false);
  assert.ok(report.findings[0].codes.includes('URL_PATH_IDENTITY_MISMATCH'));
  assert.ok(report.findings[0].codes.includes('DUPLICATE_STORAGE_IDENTITY'));
});

test('desfer A conserva B quan B ja era el primari', async () => {
  const db = new FakeDb();
  const txPath = 'organizations/org-1/transactions/tx-1';
  const pathA = 'organizations/org-1/documents/tx-1/pending-a--a.pdf';
  const pathB = 'organizations/org-1/documents/tx-1/pending-b--b.pdf';
  db.docs.set(txPath, { document: 'https://storage.example/b' });
  db.docs.set(`${txPath}/documents/a`, {
    url: 'https://storage.example/a', storagePath: pathA, filename: 'a.pdf',
    contentType: 'application/pdf', size: 10, isPrimary: false,
    createdAt: '2026-08-14T10:00:00.000Z', createdByUid: 'user-1', source: 'transaction-upload',
  });
  db.docs.set(`${txPath}/documents/b`, {
    url: 'https://storage.example/b', storagePath: pathB, filename: 'b.pdf',
    contentType: 'application/pdf', size: 10, isPrimary: true,
    createdAt: '2026-08-14T10:01:00.000Z', createdByUid: 'user-1', source: 'transaction-upload',
  });
  db.docs.set('organizations/org-1/transactionDocumentRegistry/tx-1', {
    hasDocuments: true, documentCount: 2, primaryDocumentId: 'b', registryVersion: 1,
  });

  const result = await mutateTransactionDocumentsAdmin({
    db: db as unknown as Firestore,
    orgId: 'org-1', transactionId: 'tx-1', actorUid: 'user-1',
    mutation: { action: 'clearStoragePath', storagePath: pathA },
  });

  assert.equal(result.documentCount, 1);
  assert.equal(result.primaryDocumentId, 'b');
  assert.equal(db.docs.has(`${txPath}/documents/a`), false);
  assert.equal(db.docs.has(`${txPath}/documents/b`), true);
  assert.equal(db.docs.get(txPath)?.document, 'https://storage.example/b');
});

test('un nom cosmetic nou no invalida el path original immutable del pending', () => {
  const identity = buildPendingDocumentStorageIdentity({
    orgId: 'org-1',
    pendingDocumentId: 'pending-1',
    transactionId: 'tx-1',
    filename: 'nom-visible-nou.pdf',
  });
  assert.ok(identity);
  assert.equal(pendingDocumentStoragePathsMatch({
    identity,
    originalPath: 'organizations/org-1/pendingDocuments/pending-1/nom-original.pdf',
  }), true);
  assert.equal(identity.finalPath, 'organizations/org-1/documents/tx-1/pending-1--nom-visible-nou.pdf');
});
