import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  type Firestore,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { deleteObject, getDownloadURL, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import { buildDocumentFilename } from '@/lib/build-document-filename';
import {
  LEGACY_TRANSACTION_DOCUMENT_ID,
  pickNextPrimaryDocument,
  resolveParentDocumentAfterDocumentDelete,
  resolveTransactionDocuments,
  type ResolvedTransactionDocuments,
  type TransactionDocumentRecord,
} from '@/lib/transactions/transaction-documents';

interface TransactionLike {
  id: string;
  date?: string | null;
  description?: string | null;
  note?: string | null;
  document?: string | null;
}

export interface AddTransactionDocumentParams {
  firestore: Firestore;
  storage: FirebaseStorage;
  organizationId: string;
  transaction: TransactionLike;
  file: File;
  overrideFilename?: string;
  createdByUid?: string | null;
  makePrimary?: boolean;
}

export interface AddTransactionDocumentResult {
  documentId: string;
  downloadURL: string;
  storagePath: string;
  filename: string;
  isPrimary: boolean;
}

export interface LinkExistingTransactionDocumentParams {
  firestore: Firestore;
  organizationId: string;
  transaction: TransactionLike;
  url: string;
  storagePath?: string | null;
  filename?: string | null;
  contentType?: string | null;
  size?: number | null;
  createdByUid?: string | null;
  source?: TransactionDocumentRecord['source'];
  makePrimary?: boolean;
}

export async function listTransactionDocuments(
  firestore: Firestore,
  organizationId: string,
  transaction: TransactionLike
): Promise<ResolvedTransactionDocuments> {
  const snapshot = await getDocs(query(
    transactionDocumentsCollection(firestore, organizationId, transaction.id),
    orderBy('createdAt', 'asc')
  ));
  const documents = snapshot.docs.map((docSnap) => ({
    ...(docSnap.data() as TransactionDocumentRecord),
    id: docSnap.id,
  }));

  return resolveTransactionDocuments({
    transactionId: transaction.id,
    legacyDocument: transaction.document ?? null,
    documents,
  });
}

export async function addTransactionDocument({
  firestore,
  storage,
  organizationId,
  transaction,
  file,
  overrideFilename,
  createdByUid = null,
  makePrimary,
}: AddTransactionDocumentParams): Promise<AddTransactionDocumentResult> {
  const dateISO = transaction.date ?? new Date().toISOString().split('T')[0];
  const concept = transaction.note?.trim() || transaction.description?.trim() || 'moviment';
  const filename = overrideFilename ?? buildDocumentFilename({ dateISO, concept, originalName: file.name });
  const storagePath = buildUniqueTransactionDocumentStoragePath({
    organizationId,
    transactionId: transaction.id,
    filename,
    uploadId: globalThis.crypto.randomUUID(),
  });
  const storageRef = ref(storage, storagePath);
  const contentType = getContentType(file);
  let downloadURL = '';
  let result: TransactionDocumentMutationResponse;
  try {
    const uploadResult = await uploadBytes(storageRef, file, {
      contentType,
      customMetadata: {
        originalFileName: file.name,
      },
    });
    downloadURL = await getDownloadURL(uploadResult.ref);
    const now = new Date().toISOString();
    const record: TransactionDocumentRecord = {
      url: downloadURL,
      storagePath,
      filename,
      contentType,
      size: typeof file.size === 'number' ? file.size : null,
      isPrimary: makePrimary === true,
      createdAt: now,
      createdByUid: createdByUid ?? null,
      source: 'transaction-upload',
    };
    result = await callTransactionDocumentMutation(firestore, {
      action: 'link',
      orgId: organizationId,
      transactionId: transaction.id,
      document: record,
      makePrimary: makePrimary === true,
    });
  } catch (error) {
    await deleteObject(storageRef).catch(() => undefined);
    throw error;
  }

  return {
    documentId: result.documentId,
    downloadURL,
    storagePath,
    filename,
    isPrimary: result.primaryDocumentId === result.documentId,
  };
}

export function buildUniqueTransactionDocumentStoragePath(input: {
  organizationId: string;
  transactionId: string;
  filename: string;
  uploadId: string;
}): string {
  return `organizations/${input.organizationId}/documents/${input.transactionId}/${input.uploadId}--${input.filename}`;
}

export async function linkExistingTransactionDocument({
  firestore,
  organizationId,
  transaction,
  url,
  storagePath = null,
  filename = null,
  contentType = null,
  size = null,
  createdByUid = null,
  source = 'transaction-upload',
  makePrimary,
}: LinkExistingTransactionDocumentParams): Promise<string> {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    throw new Error('URL de document buida');
  }

  const now = new Date().toISOString();
  const result = await callTransactionDocumentMutation(firestore, {
    action: 'link',
    orgId: organizationId,
    transactionId: transaction.id,
    makePrimary: makePrimary === true,
    document: {
    url: trimmedUrl,
    storagePath: storagePath ?? null,
    filename: filename?.trim() || inferFilenameFromUrl(trimmedUrl) || 'document',
    contentType: contentType ?? null,
    size: typeof size === 'number' && Number.isFinite(size) ? size : null,
    isPrimary: makePrimary === true,
    createdAt: now,
    createdByUid: createdByUid ?? null,
    source,
    } satisfies TransactionDocumentRecord,
  });
  return result.documentId;
}

export async function deleteTransactionDocument(
  firestore: Firestore,
  organizationId: string,
  transaction: TransactionLike,
  documentId: string
): Promise<TransactionDocumentMutationResponse> {
  return callTransactionDocumentMutation(firestore, {
    action: 'delete',
    orgId: organizationId,
    transactionId: transaction.id,
    documentId,
  });
}

export async function setPrimaryTransactionDocument(
  firestore: Firestore,
  organizationId: string,
  transaction: TransactionLike,
  documentId: string
): Promise<void> {
  await callTransactionDocumentMutation(firestore, {
    action: 'setPrimary',
    orgId: organizationId,
    transactionId: transaction.id,
    documentId,
  });
}

export async function clearTransactionDocumentLink(
  firestore: Firestore,
  organizationId: string,
  transactionId: string,
  documentUrl: string | null
): Promise<TransactionDocumentMutationResponse> {
  return callTransactionDocumentMutation(firestore, {
    action: 'clearUrl',
    orgId: organizationId,
    transactionId,
    documentUrl,
  });
}

function transactionDocumentsCollection(
  firestore: Firestore,
  organizationId: string,
  transactionId: string
) {
  return collection(firestore, 'organizations', organizationId, 'transactions', transactionId, 'documents');
}

interface TransactionDocumentMutationResponse {
  documentId: string;
  documentCount: number;
  primaryDocumentId: string | null;
  cleanupPending?: boolean;
  cleanupErrors?: string[] | number;
}

async function callTransactionDocumentMutation(
  firestore: Firestore,
  body: Record<string, unknown>
): Promise<TransactionDocumentMutationResponse> {
  const user = getAuth(firestore.app).currentUser;
  if (!user) throw new Error('Sessió no vàlida');
  const idToken = await user.getIdToken();
  const response = await fetch('/api/transaction-documents/mutate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const result = await response.json() as TransactionDocumentMutationResponse & { error?: string };
  if (!response.ok) throw new Error(result.error ?? 'No s\'ha pogut actualitzar el document');
  if (result.cleanupPending && typeof body.orgId === 'string' && typeof body.transactionId === 'string') {
    const retryResponse = await fetch('/api/transaction-documents/retry-cleanup', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orgId: body.orgId, transactionId: body.transactionId }),
    });
    if (retryResponse.ok) {
      const retried = await retryResponse.json() as { cleanupPending?: boolean; cleanupErrors?: number };
      return { ...result, ...retried };
    }
  }
  return result;
}

function getContentType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.toLowerCase().split('.').pop();
  switch (ext) {
    case 'xml':
      return 'application/xml';
    case 'pdf':
      return 'application/pdf';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
}

function inferFilenameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const encodedName = parsed.pathname.split('/').filter(Boolean).pop();
    if (!encodedName) return null;
    const decodedPath = decodeURIComponent(encodedName);
    return decodedPath.split('/').filter(Boolean).pop() ?? decodedPath;
  } catch {
    return url.split('/').filter(Boolean).pop() ?? null;
  }
}
