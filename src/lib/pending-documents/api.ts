// src/lib/pending-documents/api.ts
// Access layer per a documents pendents de conciliació

import {
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
  doc as firestoreDoc,
  type Firestore,
  type Query,
} from 'firebase/firestore';
import { ref, deleteObject, type FirebaseStorage } from 'firebase/storage';
import { pendingDocumentsCollection, pendingDocumentDoc } from './refs';
import type {
  PendingDocument,
  PendingDocumentStatus,
  CreatePendingDocumentInput,
  UpdatePendingDocumentInput,
} from './types';

/**
 * Opcions per filtrar documents pendents.
 */
export interface ListPendingDocumentsOptions {
  /** Filtrar per aquests estats (OR). Si no s'especifica, retorna tots. */
  statusIn?: PendingDocumentStatus[];
}

/**
 * Construeix una query per llistar documents pendents.
 * Útil per passar a useCollection amb useMemoFirebase.
 *
 * @param firestore - Instància de Firestore
 * @param orgId - ID de l'organització
 * @param options - Opcions de filtre
 * @returns Query tipada o null si no hi ha orgId
 */
export function buildPendingDocumentsQuery(
  firestore: Firestore,
  orgId: string | null | undefined,
  options: ListPendingDocumentsOptions = {}
): Query<PendingDocument> | null {
  if (!orgId) return null;

  const collectionRef = pendingDocumentsCollection(firestore, orgId);

  // Si hi ha filtre per status, aplicar-lo
  if (options.statusIn && options.statusIn.length > 0) {
    // Evitem dependre d'un índex compost per la combinació status + createdAt.
    // La UI ja pot ordenar després en memòria per createdAt desc.
    return query(collectionRef, where('status', 'in', options.statusIn));
  }

  // Sense filtre, retornar tots ordenats per data
  return query(collectionRef, orderBy('createdAt', 'desc'));
}

/**
 * Crea un document pendent en estat draft.
 * Només per ús intern (encara no exposat a UI).
 *
 * @param firestore - Instància de Firestore
 * @param orgId - ID de l'organització
 * @param input - Dades del document
 * @returns ID del document creat
 */
export async function createPendingDocumentDraft(
  firestore: Firestore,
  orgId: string,
  input: CreatePendingDocumentInput
): Promise<string> {
  const collectionRef = pendingDocumentsCollection(firestore, orgId);

  const now = serverTimestamp();
  const docData: Omit<PendingDocument, 'id'> = {
    status: 'draft',
    type: input.type,
    file: input.file,
    invoiceNumber: null,
    invoiceDate: null,
    amount: null,
    supplierId: null,
    categoryId: null,
    extracted: null,
    sepa: null,
    matchedTransactionId: null,
    reportId: null,
    createdAt: now as Timestamp,
    updatedAt: now as Timestamp,
    confirmedAt: null,
  };

  const docRef = await addDoc(collectionRef, docData);
  return docRef.id;
}

/**
 * Actualitza un document pendent.
 * Només per ús intern (encara no exposat a UI).
 *
 * @param firestore - Instància de Firestore
 * @param orgId - ID de l'organització
 * @param docId - ID del document
 * @param patch - Camps a actualitzar
 */
export async function updatePendingDocument(
  firestore: Firestore,
  orgId: string,
  docId: string,
  patch: UpdatePendingDocumentInput
): Promise<void> {
  const docRef = pendingDocumentDoc(firestore, orgId, docId);

  try {
    await updateDoc(docRef, {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    // Idempotent: si el document no existeix, loguem i ignorem
    if (error instanceof Error && error.message.includes('No document to update')) {
      console.warn(`[updatePendingDocument] Document ${docId} ja no existeix (idempotent)`);
      return;
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDACIÓ I CONFIRMACIÓ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Camps obligatoris per poder confirmar un document segons el tipus.
 * - invoice/payroll: tots els camps (amount, invoiceDate, invoiceNumber, supplierId, categoryId)
 * - receipt: només amount, invoiceDate, categoryId (invoiceNumber i supplierId opcionals)
 */
export const REQUIRED_FIELDS_FOR_CONFIRM = [
  'amount',
  'invoiceDate',
  'invoiceNumber',
  'supplierId',
  'categoryId',
] as const;

export const REQUIRED_FIELDS_FOR_RECEIPT = [
  'amount',
  'invoiceDate',
  'categoryId',
] as const;

/**
 * Comprova si un document té tots els camps obligatoris per confirmar.
 * Els receipts tenen requisits més relaxats (no cal invoiceNumber ni supplierId).
 */
export function isDocumentReadyToConfirm(doc: PendingDocument): boolean {
  // Receipts: només cal amount, invoiceDate, categoryId
  if (doc.type === 'receipt') {
    return (
      doc.amount !== null &&
      doc.invoiceDate !== null &&
      doc.categoryId !== null
    );
  }

  // Invoice/payroll/unknown: tots els camps
  return (
    doc.amount !== null &&
    doc.invoiceDate !== null &&
    doc.invoiceNumber !== null &&
    doc.invoiceNumber.trim() !== '' &&
    doc.supplierId !== null &&
    doc.categoryId !== null
  );
}

/**
 * Retorna els camps que falten per poder confirmar.
 * Els receipts tenen requisits més relaxats.
 */
export function getMissingFields(doc: PendingDocument): string[] {
  const missing: string[] = [];

  // Camps obligatoris per a tots
  if (doc.amount === null) missing.push('amount');
  if (doc.invoiceDate === null) missing.push('invoiceDate');
  if (doc.categoryId === null) missing.push('categoryId');

  // Camps addicionals per invoice/payroll/unknown
  if (doc.type !== 'receipt') {
    if (doc.invoiceNumber === null || doc.invoiceNumber.trim() === '') missing.push('invoiceNumber');
    if (doc.supplierId === null) missing.push('supplierId');
  }

  return missing;
}

/**
 * Resultat de la confirmació massiva.
 */
export interface ConfirmManyResult {
  confirmedCount: number;
  skippedCount: number;
  skippedIds: string[];
}

/**
 * Confirma múltiples documents en batch.
 * Només confirma els documents que tenen tots els camps obligatoris.
 * Usa batch writes amb segments de 500 màxim.
 *
 * @param firestore - Instància de Firestore
 * @param orgId - ID de l'organització
 * @param docs - Documents a confirmar
 * @returns Resultat amb comptadors
 */
export async function confirmManyPendingDocuments(
  firestore: Firestore,
  orgId: string,
  docs: PendingDocument[]
): Promise<ConfirmManyResult> {
  // Filtrar només els que estan llestos
  const readyDocs = docs.filter(isDocumentReadyToConfirm);
  const skippedDocs = docs.filter(d => !isDocumentReadyToConfirm(d));

  if (readyDocs.length === 0) {
    return {
      confirmedCount: 0,
      skippedCount: skippedDocs.length,
      skippedIds: skippedDocs.map(d => d.id),
    };
  }

  // Firestore batch limit: max 50 operacions per batch
  const BATCH_SIZE = 50;
  const chunks: PendingDocument[][] = [];

  for (let i = 0; i < readyDocs.length; i += BATCH_SIZE) {
    chunks.push(readyDocs.slice(i, i + BATCH_SIZE));
  }

  // Processar cada chunk
  for (const chunk of chunks) {
    const batch = writeBatch(firestore);

    for (const doc of chunk) {
      const docRef = pendingDocumentDoc(firestore, orgId, doc.id);
      batch.update(docRef, {
        status: 'confirmed',
        confirmedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  }

  return {
    confirmedCount: readyDocs.length,
    skippedCount: skippedDocs.length,
    skippedIds: skippedDocs.map(d => d.id),
  };
}

/**
 * Confirma un sol document.
 * Valida que tingui tots els camps obligatoris.
 *
 * @throws Error si el document no està llest per confirmar
 */
export async function confirmPendingDocument(
  firestore: Firestore,
  orgId: string,
  doc: PendingDocument
): Promise<void> {
  if (!isDocumentReadyToConfirm(doc)) {
    const missing = getMissingFields(doc);
    throw new Error(`Falten camps obligatoris: ${missing.join(', ')}`);
  }

  const docRef = pendingDocumentDoc(firestore, orgId, doc.id);

  await updateDoc(docRef, {
    status: 'confirmed',
    confirmedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ARXIVAR I RESTAURAR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Arxiva un document pendent.
 * Guarda l'estat anterior per poder restaurar-lo.
 *
 * @param firestore - Instància de Firestore
 * @param orgId - ID de l'organització
 * @param doc - Document a arxivar
 */
export async function archivePendingDocument(
  firestore: Firestore,
  orgId: string,
  doc: PendingDocument
): Promise<void> {
  if (doc.status === 'archived') {
    throw new Error('El document ja està arxivat');
  }

  if (doc.status === 'matched') {
    throw new Error('No es pot arxivar un document ja conciliat');
  }

  const docRef = pendingDocumentDoc(firestore, orgId, doc.id);

  await updateDoc(docRef, {
    status: 'archived',
    previousStatus: doc.status,
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Restaura un document arxivat al seu estat anterior.
 *
 * @param firestore - Instància de Firestore
 * @param orgId - ID de l'organització
 * @param doc - Document a restaurar
 */
export async function restorePendingDocument(
  firestore: Firestore,
  orgId: string,
  doc: PendingDocument
): Promise<void> {
  if (doc.status !== 'archived') {
    throw new Error('El document no està arxivat');
  }

  const docRef = pendingDocumentDoc(firestore, orgId, doc.id);

  // Restaurar a l'estat anterior, o draft si no hi ha previousStatus
  const restoreStatus = doc.previousStatus || 'draft';

  await updateDoc(docRef, {
    status: restoreStatus,
    previousStatus: null,
    archivedAt: null,
    updatedAt: serverTimestamp(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ELIMINAR DOCUMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resultat de l'eliminació amb informació sobre el fitxer.
 */
export interface DeletePendingDocumentResult {
  /** Si el fitxer s'ha esborrat correctament de Storage */
  fileDeleted: boolean;
  /** Missatge d'error si el fitxer no s'ha pogut esborrar */
  fileError?: string;
}

/**
 * Elimina un document pendent i el seu fitxer associat.
 *
 * Guardrails:
 * - Només es poden eliminar documents amb status 'draft' o 'confirmed'
 * - sepa_generated i matched NO es poden eliminar (només arxivar)
 * - archived es pot eliminar (l'usuari ja l'havia descartat)
 *
 * El fitxer de Storage s'intenta esborrar best-effort:
 * si falla, el document s'esborra igualment però es retorna l'error.
 *
 * @param firestore - Instància de Firestore
 * @param storage - Instància de Firebase Storage
 * @param orgId - ID de l'organització
 * @param docId - ID del document a eliminar
 * @returns Resultat amb info sobre l'eliminació del fitxer
 * @throws Error si l'estat del document no permet eliminació
 */
export async function deletePendingDocument(
  firestore: Firestore,
  storage: FirebaseStorage,
  orgId: string,
  docId: string
): Promise<DeletePendingDocumentResult> {
  // 1. Llegir el document per obtenir storagePath i validar status
  const docRef = pendingDocumentDoc(firestore, orgId, docId);
  const docSnap = await getDoc(docRef);

  // Idempotent: si el document ja no existeix, considerem èxit
  if (!docSnap.exists()) {
    console.warn(`[deletePendingDocument] Document ${docId} ja no existeix (idempotent)`);
    return { fileDeleted: true, fileError: undefined };
  }

  const docData = docSnap.data() as PendingDocument;

  // 2. Validar guardrails segons status
  if (docData.status === 'sepa_generated') {
    throw new Error(
      'No es pot eliminar un document inclòs en una remesa SEPA. Arxiva\'l si no el vols veure.'
    );
  }

  if (docData.status === 'matched') {
    throw new Error(
      'No es pot eliminar un document ja conciliat amb un moviment bancari. Arxiva\'l si no el vols veure.'
    );
  }

  // 3. Esborrar el document de Firestore
  await deleteDoc(docRef);

  // 4. Intentar esborrar el fitxer de Storage (best-effort)
  let fileDeleted = false;
  let fileError: string | undefined;

  if (docData.file?.storagePath) {
    try {
      const storageRef = ref(storage, docData.file.storagePath);
      await deleteObject(storageRef);
      fileDeleted = true;
    } catch (error) {
      // No fem rollback - el document ja està esborrat
      console.warn('[deletePendingDocument] No s\'ha pogut esborrar el fitxer:', error);
      fileError = error instanceof Error ? error.message : 'Error desconegut';
    }
  } else {
    // No hi havia fitxer associat
    fileDeleted = true;
  }

  return { fileDeleted, fileError };
}

/**
 * Comprova si un document es pot eliminar segons el seu estat.
 */
export function canDeletePendingDocument(status: PendingDocumentStatus): boolean {
  return status === 'draft' || status === 'confirmed' || status === 'archived';
}

/**
 * Renombra un document pendent (cosmètic, Firestore only).
 * Actualitza només `file.filename`, NO toca `file.storagePath`.
 *
 * @param firestore - Instància de Firestore
 * @param orgId - ID de l'organització
 * @param docId - ID del document
 * @param newFilename - Nou nom del fitxer (amb extensió)
 */
export async function renamePendingDocument(
  firestore: Firestore,
  orgId: string,
  docId: string,
  newFilename: string
): Promise<void> {
  if (!newFilename || !newFilename.trim()) {
    throw new Error('El nom del fitxer no pot ser buit');
  }

  const docRef = pendingDocumentDoc(firestore, orgId, docId);

  await updateDoc(docRef, {
    'file.filename': newFilename.trim(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Comprova si un document es pot editar completament segons el seu estat.
 * - draft/confirmed: tots els camps editables
 * - sepa_generated: només categoryId editable (camps de pagament bloquejats)
 * - matched/archived: no editable
 */
export function getEditableFields(status: PendingDocumentStatus): {
  allEditable: boolean;
  limitedEditable: boolean;
  editableFields: string[];
} {
  switch (status) {
    case 'draft':
    case 'confirmed':
      return {
        allEditable: true,
        limitedEditable: false,
        editableFields: ['amount', 'invoiceDate', 'invoiceNumber', 'supplierId', 'categoryId', 'type'],
      };
    case 'sepa_generated':
      return {
        allEditable: false,
        limitedEditable: true,
        editableFields: ['categoryId'], // Només categoria editable
      };
    case 'matched':
    case 'archived':
    default:
      return {
        allEditable: false,
        limitedEditable: false,
        editableFields: [],
      };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PENDING DOC MATCHED - CONSULTES I ELIMINACIÓ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Comprova si una transacció té un document pendent conciliat (matched) associat.
 *
 * @param firestore - Instància de Firestore
 * @param orgId - ID de l'organització
 * @param transactionId - ID de la transacció a comprovar
 * @returns L'ID del pending document si existeix, o null si no
 */
export async function getMatchedPendingDocumentId(
  firestore: Firestore,
  orgId: string,
  transactionId: string
): Promise<string | null> {
  const collectionRef = pendingDocumentsCollection(firestore, orgId);

  const matchedQuery = query(
    collectionRef,
    where('matchedTransactionId', '==', transactionId),
    where('status', '==', 'matched'),
    firestoreLimit(1)
  );

  const snapshot = await getDocs(matchedQuery);

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].id;
}

/**
 * Elimina un document pendent matched i desfà la conciliació amb la transacció.
 *
 * Efectes:
 * - Elimina el pending document de Firestore
 * - Elimina el fitxer de Storage (best-effort)
 * - Neteja els camps de conciliació de la transacció (document, category, contactId si provenen del pendent)
 *
 * @param firestore - Instància de Firestore
 * @param storage - Instància de Firebase Storage
 * @param orgId - ID de l'organització
 * @param pendingDocId - ID del document pendent a eliminar
 * @returns Resultat amb info sobre l'operació
 */
export async function deleteMatchedPendingDocument(
  firestore: Firestore,
  storage: FirebaseStorage,
  orgId: string,
  pendingDocId: string
): Promise<{ success: boolean; fileDeleted: boolean; fileError?: string }> {
  // 1. Llegir el pending document
  const pendingRef = pendingDocumentDoc(firestore, orgId, pendingDocId);
  const pendingSnap = await getDoc(pendingRef);

  // Idempotent: si el document ja no existeix, considerem èxit
  if (!pendingSnap.exists()) {
    console.warn(`[deleteMatchedPendingDocument] Document ${pendingDocId} ja no existeix (idempotent)`);
    return { success: true, fileDeleted: true, fileError: undefined };
  }

  const pendingData = pendingSnap.data() as PendingDocument;

  // 2. Validar que està matched
  if (pendingData.status !== 'matched') {
    throw new Error('El document no està conciliat. Usa la funció d\'eliminació normal.');
  }

  const matchedTxId = pendingData.matchedTransactionId;
  if (!matchedTxId) {
    throw new Error('El document indica status matched però no té matchedTransactionId');
  }

  // 3. Comprovar si la transacció existeix
  const txRef = firestoreDoc(firestore, `organizations/${orgId}/transactions/${matchedTxId}`);
  const txSnap = await getDoc(txRef);
  const txExists = txSnap.exists();

  if (!txExists) {
    console.warn(`[deleteMatchedPendingDocument] Transacció ${matchedTxId} ja no existeix (orphan reference)`);
  }

  // 4. Preparar batch per atomicitat
  const batch = writeBatch(firestore);

  // 4a. Actualitzar la transacció per treure referència al document (només si existeix)
  if (txExists) {
    batch.update(txRef, {
      document: null,
      updatedAt: serverTimestamp(),
    });
  }

  // 4b. Eliminar el pending document
  batch.delete(pendingRef);

  // 5. Executar batch
  await batch.commit();

  // 5. Eliminar fitxers de Storage (best-effort, fora del batch)
  let fileDeleted = true;
  let fileError: string | undefined;

  // Eliminar fitxer original (pendingDocuments path)
  if (pendingData.file?.storagePath) {
    try {
      const storageRef = ref(storage, pendingData.file.storagePath);
      await deleteObject(storageRef);
    } catch (error) {
      console.warn('[deleteMatchedPendingDocument] No s\'ha pogut esborrar storagePath:', error);
      // No és error crític - pot ser que ja s'hagi eliminat
    }
  }

  // Eliminar còpia al destí final (documents path)
  if (pendingData.file?.finalStoragePath) {
    try {
      const finalRef = ref(storage, pendingData.file.finalStoragePath);
      await deleteObject(finalRef);
    } catch (error) {
      console.warn('[deleteMatchedPendingDocument] No s\'ha pogut esborrar finalStoragePath:', error);
      fileDeleted = false;
      fileError = error instanceof Error ? error.message : 'Error desconegut';
    }
  }

  return { success: true, fileDeleted, fileError };
}
