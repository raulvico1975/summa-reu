import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LEGACY_TRANSACTION_DOCUMENT_ID,
  pickNextPrimaryDocument,
  resolveParentDocumentAfterDocumentDelete,
  resolveTransactionDocuments,
  type TransactionDocumentRecord,
} from '@/lib/transactions/transaction-documents';
import { buildUniqueTransactionDocumentStoragePath } from '@/lib/files/transaction-documents';

const baseDocument = (overrides: Partial<TransactionDocumentRecord> & { id?: string } = {}) => ({
  id: overrides.id,
  url: overrides.url ?? 'https://storage.local/doc-a.pdf',
  storagePath: overrides.storagePath ?? 'organizations/org-1/documents/tx-1/doc-a.pdf',
  filename: overrides.filename ?? 'doc-a.pdf',
  contentType: overrides.contentType ?? 'application/pdf',
  size: overrides.size ?? 123,
  isPrimary: overrides.isPrimary ?? false,
  createdAt: overrides.createdAt ?? '2026-06-09T06:00:00.000Z',
  createdByUid: overrides.createdByUid ?? 'user-1',
  source: overrides.source ?? 'transaction-upload',
});

test('resolveTransactionDocuments: moviment sense document retorna 0 documents', () => {
  const result = resolveTransactionDocuments({
    transactionId: 'tx-1',
    legacyDocument: null,
    documents: [],
  });

  assert.equal(result.count, 0);
  assert.equal(result.primaryDocument, null);
  assert.deepEqual(result.documents, []);
});

test('uploads amb el mateix filename tenen paths únics i no se sobreescriuen', () => {
  const base = { organizationId: 'org-1', transactionId: 'tx-1', filename: 'factura.pdf' };
  const first = buildUniqueTransactionDocumentStoragePath({ ...base, uploadId: 'attempt-a' });
  const second = buildUniqueTransactionDocumentStoragePath({ ...base, uploadId: 'attempt-b' });
  assert.notEqual(first, second);
  assert.match(first, /\/attempt-a--factura\.pdf$/);
});

test('resolveTransactionDocuments: document legacy es mostra com 1 document principal', () => {
  const result = resolveTransactionDocuments({
    transactionId: 'tx-1',
    legacyDocument: 'https://storage.local/legacy.pdf',
    documents: [],
  });

  assert.equal(result.count, 1);
  assert.equal(result.primaryDocument?.id, LEGACY_TRANSACTION_DOCUMENT_ID);
  assert.equal(result.primaryDocument?.isLegacy, true);
  assert.equal(result.primaryDocument?.isPrimary, true);
});

test('resolveTransactionDocuments: documents nous retornen N documents', () => {
  const result = resolveTransactionDocuments({
    transactionId: 'tx-1',
    legacyDocument: null,
    documents: [
      baseDocument({ id: 'doc-b', url: 'https://storage.local/doc-b.pdf' }),
      baseDocument({ id: 'doc-a', url: 'https://storage.local/doc-a.pdf' }),
    ],
  });

  assert.equal(result.count, 2);
  assert.deepEqual(result.documents.map((doc) => doc.id), ['doc-a', 'doc-b']);
});

test('resolveTransactionDocuments: legacy duplicat per URL conserva el registre amb storagePath', () => {
  const result = resolveTransactionDocuments({
    transactionId: 'tx-1',
    legacyDocument: 'https://storage.local/doc-a.pdf',
    documents: [
      baseDocument({ id: 'doc-a', url: 'https://storage.local/doc-a.pdf' }),
      baseDocument({ id: 'doc-b', url: 'https://storage.local/doc-b.pdf' }),
    ],
  });

  assert.equal(result.count, 2);
  assert.deepEqual(result.documents.map((doc) => doc.id), [
    'doc-a',
    'doc-b',
  ]);
  assert.equal(result.documents[0]?.storagePath, 'organizations/org-1/documents/tx-1/doc-a.pdf');
  assert.equal(result.documents[0]?.isLegacy, false);
});

test('resolveTransactionDocuments: document nou marcat primary guanya el legacy', () => {
  const result = resolveTransactionDocuments({
    transactionId: 'tx-1',
    legacyDocument: 'https://storage.local/legacy.pdf',
    documents: [
      baseDocument({ id: 'doc-a', isPrimary: false }),
      baseDocument({ id: 'doc-b', url: 'https://storage.local/doc-b.pdf', isPrimary: true }),
    ],
  });

  assert.equal(result.primaryDocument?.id, 'doc-b');
  assert.equal(result.documents.find((doc) => doc.id === 'doc-b')?.isPrimary, true);
  assert.equal(result.documents.find((doc) => doc.id === LEGACY_TRANSACTION_DOCUMENT_ID)?.isPrimary, false);
});

test('resolveTransactionDocuments: sense primary explícit usa ordre estable', () => {
  const result = resolveTransactionDocuments({
    transactionId: 'tx-1',
    legacyDocument: null,
    documents: [
      baseDocument({ id: 'doc-b', createdAt: '2026-06-09T06:02:00.000Z', url: 'https://storage.local/doc-b.pdf' }),
      baseDocument({ id: 'doc-a', createdAt: '2026-06-09T06:01:00.000Z', url: 'https://storage.local/doc-a.pdf' }),
    ],
  });

  assert.equal(result.primaryDocument?.id, 'doc-a');
  assert.equal(result.count, 2);
});

test('pickNextPrimaryDocument: selecciona el document més antic restant', () => {
  const next = pickNextPrimaryDocument([
    baseDocument({ id: 'doc-a', createdAt: '2026-06-09T06:01:00.000Z' }),
    baseDocument({ id: 'doc-b', createdAt: '2026-06-09T06:02:00.000Z', url: 'https://storage.local/doc-b.pdf' }),
  ], 'doc-a');

  assert.equal(next?.id, 'doc-b');
});

test('resolveParentDocumentAfterDocumentDelete: no ressuscita el document esborrat com a legacy', () => {
  const next = resolveParentDocumentAfterDocumentDelete({
    currentParentDocumentUrl: 'https://storage.local/doc-a.pdf',
    deletedDocumentUrl: 'https://storage.local/doc-a.pdf',
  });

  assert.equal(next, null);
});

test('resolveParentDocumentAfterDocumentDelete: conserva una URL legacy diferent', () => {
  const next = resolveParentDocumentAfterDocumentDelete({
    currentParentDocumentUrl: 'https://storage.local/legacy.pdf',
    deletedDocumentUrl: 'https://storage.local/doc-a.pdf',
  });

  assert.equal(next, 'https://storage.local/legacy.pdf');
});

test('resolveParentDocumentAfterDocumentDelete: prioritza el nou document principal', () => {
  const next = resolveParentDocumentAfterDocumentDelete({
    currentParentDocumentUrl: 'https://storage.local/doc-a.pdf',
    deletedDocumentUrl: 'https://storage.local/doc-a.pdf',
    nextPrimaryDocumentUrl: 'https://storage.local/doc-b.pdf',
  });

  assert.equal(next, 'https://storage.local/doc-b.pdf');
});
