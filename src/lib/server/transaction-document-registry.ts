import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import { LEGACY_TRANSACTION_DOCUMENT_ID } from '@/lib/transactions/transaction-documents';

export const TRANSACTION_DOCUMENT_REGISTRY_VERSION = 1;
export const MAX_TRANSACTION_DOCUMENTS = 40;
export const MAX_PENDING_STORAGE_CLEANUP_PATHS = 50;

export interface ServerTransactionDocumentRecord {
  url: string;
  storagePath: string | null;
  filename: string;
  contentType: string | null;
  size: number | null;
  isPrimary: boolean;
  createdAt: string;
  createdByUid: string | null;
  source: 'transaction-upload' | 'legacy-document';
}

export type TransactionDocumentMutation =
  | { action: 'link'; document: ServerTransactionDocumentRecord; makePrimary?: boolean }
  | { action: 'delete'; documentId: string }
  | { action: 'setPrimary'; documentId: string }
  | { action: 'clearUrl'; documentUrl: string | null }
  | { action: 'clearStoragePath'; storagePath: string; preserveStorage?: boolean };

export interface TransactionDocumentMutationResult {
  documentId: string | null;
  documentCount: number;
  primaryDocumentId: string | null;
  idempotent: boolean;
  storageCleanupPaths: string[];
  cleanupPending: boolean;
}

export interface RelatedTransactionDocumentWrite {
  path: string;
  action: 'update' | 'delete';
  data?: DocumentData;
  expected?: Record<string, unknown>;
}

/**
 * Canonical metadata mutation. Parent mirror, document metadata and registry
 * are committed in one Admin SDK transaction. Clients cannot write the
 * registry, so they cannot forge an empty state to bypass parent deletion.
 */
export async function mutateTransactionDocumentsAdmin(input: {
  db: Firestore;
  orgId: string;
  transactionId: string;
  mutation: TransactionDocumentMutation;
  actorUid: string | null;
  nowIso?: string;
  relatedWrites?: RelatedTransactionDocumentWrite[];
  fillTransactionFields?: {
    category?: string | null;
    contactId?: string | null;
    contactType?: 'supplier' | null;
  };
  additionalStorageCleanupPaths?: string[];
}): Promise<TransactionDocumentMutationResult> {
  const { db, orgId, transactionId, mutation } = input;
  const nowIso = input.nowIso ?? new Date().toISOString();
  const transactionRef = db.doc(`organizations/${orgId}/transactions/${transactionId}`);
  const documentsRef = transactionRef.collection('documents');
  const registryRef = db.doc(`organizations/${orgId}/transactionDocumentRegistry/${transactionId}`);
  const transactionStoragePrefix = `organizations/${orgId}/documents/${transactionId}/`;

  const additionalStorageCleanupPaths = [...new Set(input.additionalStorageCleanupPaths ?? [])];
  if (additionalStorageCleanupPaths.length > 2 || additionalStorageCleanupPaths.some((path) =>
    typeof path !== 'string'
    || path.length > 1024
    || !isSafeCleanupPath(path, orgId, transactionId)
  )) throw new Error('INVALID_STORAGE_CLEANUP_PATH');

  const relatedWrites = input.relatedWrites ?? [];
  if (relatedWrites.length > 5 || relatedWrites.some((write) =>
    !write.path.startsWith(`organizations/${orgId}/pendingDocuments/`)
  )) throw new Error('INVALID_RELATED_WRITE');

  return db.runTransaction(async (tx) => {
    const [transactionSnap, documentsSnap, registrySnap, ...relatedSnaps] = await Promise.all([
      tx.get(transactionRef),
      tx.get(documentsRef),
      tx.get(registryRef),
      ...relatedWrites.map((write) => tx.get(db.doc(write.path))),
    ]);
    if (!transactionSnap.exists) throw new Error('TRANSACTION_NOT_FOUND');
    if (documentsSnap.size > MAX_TRANSACTION_DOCUMENTS) throw new Error('DOCUMENT_LIMIT_EXCEEDED');
    for (let index = 0; index < relatedWrites.length; index += 1) {
      const write = relatedWrites[index];
      const snap = relatedSnaps[index];
      if (!snap.exists) throw new Error('RELATED_DOCUMENT_NOT_FOUND');
      const data = snap.data() ?? {};
      for (const [key, expected] of Object.entries(write.expected ?? {})) {
        if (data[key] !== expected) throw new Error('RELATED_DOCUMENT_CONFLICT');
      }
    }

    const parent = transactionSnap.data() ?? {};
    const registryData = registrySnap.exists ? registrySnap.data() ?? {} : {};
    const existingStorageCleanupPaths = Array.isArray(registryData.pendingStorageCleanupPaths)
      ? registryData.pendingStorageCleanupPaths.filter((path): path is string => typeof path === 'string')
      : [];
    if (
      existingStorageCleanupPaths.length > MAX_PENDING_STORAGE_CLEANUP_PATHS
      || existingStorageCleanupPaths.some((path) => !isSafeCleanupPath(path, orgId, transactionId))
    ) throw new Error('REGISTRY_CLEANUP_INVALID');
    const currentParentUrl = typeof parent.document === 'string' && parent.document.trim()
      ? parent.document.trim()
      : null;
    const records = new Map(documentsSnap.docs.map((snap) => [
      snap.id,
      normalizeRecord(snap.data(), input.actorUid, nowIso),
    ]));

    // Materialize a legacy-only mirror before a mutation so the registry never
    // depends exclusively on the forgeable/nullable parent field.
    if (currentParentUrl && ![...records.values()].some((record) => record.url === currentParentUrl)) {
      const legacyRecord: ServerTransactionDocumentRecord = {
        url: currentParentUrl,
        storagePath: null,
        filename: inferFilename(currentParentUrl) ?? `${transactionId}-document`,
        contentType: null,
        size: null,
        isPrimary: true,
        createdAt: nowIso,
        createdByUid: null,
        source: 'legacy-document',
      };
      records.set(LEGACY_TRANSACTION_DOCUMENT_ID, legacyRecord);
      tx.set(documentsRef.doc(LEGACY_TRANSACTION_DOCUMENT_ID), legacyRecord);
    }

    let documentId: string | null = null;
    let idempotent = false;
    const removedStoragePaths: string[] = [];

    if (mutation.action === 'link') {
      const normalized = normalizeRecord(mutation.document, input.actorUid, nowIso);
      const duplicate = [...records.entries()].find(([, record]) =>
        normalized.storagePath
          ? record.storagePath === normalized.storagePath
          : record.url === normalized.url
      );
      if (duplicate) {
        documentId = duplicate[0];
        idempotent = true;
      } else {
        if (records.size >= MAX_TRANSACTION_DOCUMENTS) throw new Error('DOCUMENT_LIMIT_EXCEEDED');
        const ref = documentsRef.doc();
        documentId = ref.id;
        const shouldBePrimary = mutation.makePrimary === true || records.size === 0;
        if (shouldBePrimary) {
          for (const [id, record] of records) {
            if (record.isPrimary) {
              const next = { ...record, isPrimary: false };
              records.set(id, next);
              tx.update(documentsRef.doc(id), { isPrimary: false });
            }
          }
        }
        const next = { ...normalized, isPrimary: shouldBePrimary };
        records.set(documentId, next);
        tx.set(ref, next);
      }
    } else if (mutation.action === 'delete') {
      if (!records.has(mutation.documentId)) {
        idempotent = true;
      } else {
        const removed = records.get(mutation.documentId);
        if (removed?.storagePath) {
          if (!removed.storagePath.startsWith(transactionStoragePrefix)) {
            throw new Error('STORAGE_PATH_REQUIRES_ADMIN_REPAIR');
          }
          removedStoragePaths.push(removed.storagePath);
        }
        records.delete(mutation.documentId);
        tx.delete(documentsRef.doc(mutation.documentId));
      }
    } else if (mutation.action === 'clearUrl') {
      if (!mutation.documentUrl) throw new Error('DOCUMENT_URL_REQUIRED');
      let removed = false;
      for (const [id, record] of [...records.entries()]) {
        if (mutation.documentUrl && record.url === mutation.documentUrl) {
          if (record.storagePath) {
            if (!record.storagePath.startsWith(transactionStoragePrefix)) {
              throw new Error('STORAGE_PATH_REQUIRES_ADMIN_REPAIR');
            }
            removedStoragePaths.push(record.storagePath);
          }
          records.delete(id);
          tx.delete(documentsRef.doc(id));
          removed = true;
        }
      }
      idempotent = !removed;
    } else if (mutation.action === 'clearStoragePath') {
      let removed = false;
      for (const [id, record] of [...records.entries()]) {
        if (record.storagePath === mutation.storagePath) {
          if (record.storagePath && mutation.preserveStorage !== true) {
            if (!record.storagePath.startsWith(transactionStoragePrefix)) {
              throw new Error('STORAGE_PATH_REQUIRES_ADMIN_REPAIR');
            }
            removedStoragePaths.push(record.storagePath);
          }
          records.delete(id);
          tx.delete(documentsRef.doc(id));
          removed = true;
        }
      }
      idempotent = !removed;
    } else {
      if (!records.has(mutation.documentId)) throw new Error('DOCUMENT_NOT_FOUND');
      documentId = mutation.documentId;
      for (const [id, record] of records) {
        if (record.isPrimary !== (id === mutation.documentId)) {
          const next = { ...record, isPrimary: id === mutation.documentId };
          records.set(id, next);
          tx.update(documentsRef.doc(id), { isPrimary: next.isPrimary });
        }
      }
    }

    let primary = [...records.entries()].find(([, record]) => record.isPrimary) ?? null;
    if (!primary && records.size > 0) {
      primary = [...records.entries()].sort((a, b) => a[1].createdAt.localeCompare(b[1].createdAt))[0];
      const next = { ...primary[1], isPrimary: true };
      records.set(primary[0], next);
      primary = [primary[0], next];
      tx.update(documentsRef.doc(primary[0]), { isPrimary: true });
    }

    const fill = input.fillTransactionFields ?? {};
    const transactionUpdate: DocumentData = {
      document: primary?.[1].url ?? null,
      updatedAt: nowIso,
    };
    if (!parent.category && typeof fill.category === 'string' && fill.category) {
      transactionUpdate.category = fill.category;
    }
    if (!parent.contactId && typeof fill.contactId === 'string' && fill.contactId) {
      transactionUpdate.contactId = fill.contactId;
      transactionUpdate.contactType = fill.contactType === 'supplier' ? 'supplier' : null;
    }
    tx.update(transactionRef, transactionUpdate);

    const storageCleanupPaths = [...new Set([
      ...existingStorageCleanupPaths,
      ...removedStoragePaths,
      ...additionalStorageCleanupPaths,
    ])];
    if (storageCleanupPaths.length > MAX_PENDING_STORAGE_CLEANUP_PATHS) {
      throw new Error('STORAGE_CLEANUP_LIMIT_EXCEEDED');
    }

    if (records.size === 0 && storageCleanupPaths.length === 0) {
      tx.delete(registryRef);
    } else {
      tx.set(registryRef, {
        hasDocuments: records.size > 0,
        documentCount: records.size,
        primaryDocumentId: primary?.[0] ?? null,
        registryVersion: TRANSACTION_DOCUMENT_REGISTRY_VERSION,
        pendingStorageCleanupPaths: storageCleanupPaths,
        updatedAt: nowIso,
      });
    }


    for (const write of relatedWrites) {
      const ref = db.doc(write.path);
      if (write.action === 'delete') {
        tx.delete(ref);
      } else {
        if (!write.data || Object.values(write.data).some((value) => value === undefined)) {
          throw new Error('INVALID_RELATED_WRITE');
        }
        tx.update(ref, write.data);
      }
    }

    return {
      documentId,
      documentCount: records.size,
      primaryDocumentId: primary?.[0] ?? null,
      idempotent,
      storageCleanupPaths,
      cleanupPending: storageCleanupPaths.length > 0,
    };
  });
}

/** Finalizes only paths already persisted in the backend-owned cleanup outbox. */
export async function finalizeTransactionDocumentStorageCleanupAdmin(input: {
  db: Firestore;
  orgId: string;
  transactionId: string;
  cleanedPaths: string[];
  nowIso?: string;
}): Promise<{ cleanupPending: boolean; storageCleanupPaths: string[] }> {
  const cleanedPaths = [...new Set(input.cleanedPaths)];
  if (
    cleanedPaths.length > MAX_PENDING_STORAGE_CLEANUP_PATHS
    || cleanedPaths.some((path) => typeof path !== 'string' || !isSafeCleanupPath(path, input.orgId, input.transactionId))
  ) throw new Error('INVALID_STORAGE_CLEANUP_PATH');
  const registryRef = input.db.doc(
    `organizations/${input.orgId}/transactionDocumentRegistry/${input.transactionId}`
  );
  return input.db.runTransaction(async (tx) => {
    const registrySnap = await tx.get(registryRef);
    if (!registrySnap.exists) return { cleanupPending: false, storageCleanupPaths: [] };
    const data = registrySnap.data() ?? {};
    const pending = Array.isArray(data.pendingStorageCleanupPaths)
      ? data.pendingStorageCleanupPaths.filter((path): path is string => typeof path === 'string')
      : [];
    if (pending.some((path) => !isSafeCleanupPath(path, input.orgId, input.transactionId))) {
      throw new Error('REGISTRY_CLEANUP_INVALID');
    }
    if (cleanedPaths.some((path) => !pending.includes(path))) {
      throw new Error('STORAGE_CLEANUP_NOT_PENDING');
    }
    const remaining = pending.filter((path) => !cleanedPaths.includes(path));
    const documentCount = typeof data.documentCount === 'number' ? data.documentCount : 0;
    if (documentCount === 0 && remaining.length === 0) {
      tx.delete(registryRef);
    } else {
      tx.update(registryRef, {
        pendingStorageCleanupPaths: remaining,
        updatedAt: input.nowIso ?? new Date().toISOString(),
      });
    }
    return { cleanupPending: remaining.length > 0, storageCleanupPaths: remaining };
  });
}

export async function getTransactionDocumentStorageCleanupPathsAdmin(input: {
  db: Firestore;
  orgId: string;
  transactionId: string;
}): Promise<string[]> {
  const snap = await input.db.doc(
    `organizations/${input.orgId}/transactionDocumentRegistry/${input.transactionId}`
  ).get();
  if (!snap.exists) return [];
  const data = snap.data() ?? {};
  const pending = Array.isArray(data.pendingStorageCleanupPaths)
    ? data.pendingStorageCleanupPaths.filter((path): path is string => typeof path === 'string')
    : [];
  if (
    pending.length > MAX_PENDING_STORAGE_CLEANUP_PATHS
    || pending.some((path) => !isSafeCleanupPath(path, input.orgId, input.transactionId))
  ) throw new Error('REGISTRY_CLEANUP_INVALID');
  return [...new Set(pending)];
}

function isSafeCleanupPath(path: string, orgId: string, transactionId: string): boolean {
  if (path.length < 1 || path.length > 1024 || path.includes('\\')) return false;
  const txPrefix = `organizations/${orgId}/documents/${transactionId}/`;
  if (path.startsWith(txPrefix)) {
    const basename = path.slice(txPrefix.length);
    return Boolean(basename) && !basename.includes('/');
  }
  const pendingPrefix = `organizations/${orgId}/pendingDocuments/`;
  if (!path.startsWith(pendingPrefix)) return false;
  const segments = path.slice(pendingPrefix.length).split('/');
  return segments.length === 2
    && /^[A-Za-z0-9_-]{1,160}$/.test(segments[0])
    && Boolean(segments[1])
    && segments[1].length <= 240;
}

function normalizeRecord(
  value: Record<string, unknown> | ServerTransactionDocumentRecord,
  actorUid: string | null,
  nowIso: string
): ServerTransactionDocumentRecord {
  const url = typeof value.url === 'string' ? value.url.trim() : '';
  if (!url) throw new Error('DOCUMENT_URL_REQUIRED');
  return {
    url,
    storagePath: typeof value.storagePath === 'string' && value.storagePath.trim() ? value.storagePath.trim() : null,
    filename: typeof value.filename === 'string' && value.filename.trim()
      ? value.filename.trim()
      : inferFilename(url) ?? 'document',
    contentType: typeof value.contentType === 'string' && value.contentType.trim() ? value.contentType.trim() : null,
    size: typeof value.size === 'number' && Number.isFinite(value.size) ? value.size : null,
    isPrimary: value.isPrimary === true,
    createdAt: typeof value.createdAt === 'string' && value.createdAt ? value.createdAt : nowIso,
    createdByUid: typeof value.createdByUid === 'string' && value.createdByUid ? value.createdByUid : actorUid,
    source: value.source === 'legacy-document' ? 'legacy-document' : 'transaction-upload',
  };
}

function inferFilename(url: string): string | null {
  try {
    const parsed = new URL(url);
    const encoded = parsed.pathname.split('/').filter(Boolean).pop();
    return encoded ? decodeURIComponent(encoded).split('/').filter(Boolean).pop() ?? null : null;
  } catch {
    return url.split('/').filter(Boolean).pop() ?? null;
  }
}
