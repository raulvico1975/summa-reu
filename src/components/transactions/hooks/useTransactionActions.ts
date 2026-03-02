'use client';

import * as React from 'react';
import { doc, CollectionReference, type Firestore, writeBatch, deleteField, query, where, getDocs, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, FirebaseStorage } from 'firebase/storage';
import { pendingDocumentsCollection } from '@/lib/pending-documents/refs';
import { getMatchedPendingDocumentId } from '@/lib/pending-documents';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { assertUploadContext } from '@/lib/storage-upload-guard';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/i18n';
import type { Transaction, AnyContact, ContactType, Category } from '@/lib/data';
import { buildDocumentFilename } from '@/lib/build-document-filename';
import { attachDocumentToTransaction } from '@/lib/files/attach-document';
import { handleTransactionDelete, isFiscallyRelevantTransaction } from '@/lib/fiscal/softDeleteTransaction';
import { isCategoryIdCompatibleStrict } from '@/lib/constants';

// =============================================================================
// TYPES
// =============================================================================

interface EditFormData {
  description: string;
  amount: string;
  note: string;
  contactId: string | null;
  projectId: string | null;
}

interface NewContactFormData {
  name: string;
  taxId: string;
  zipCode: string;
  city: string;
  province: string;
}

interface UseTransactionActionsParams {
  transactionsCollection: CollectionReference | null;
  contactsCollection: CollectionReference | null;
  organizationId: string | null;
  storage: FirebaseStorage;
  transactions: Transaction[] | null;
  availableContacts: AnyContact[] | null;
  availableCategories?: Category[] | null;
  firestore?: Firestore | null;
  userId?: string | null;
  canEditMovements?: boolean;
}

interface UseTransactionActionsReturn {
  // ─────────────────────────────────────────────────────────────────────────
  // NOTE SETTER (for InlineNoteEditor component)
  // ─────────────────────────────────────────────────────────────────────────
  handleSetNote: (txId: string, note: string) => void;

  // ─────────────────────────────────────────────────────────────────────────
  // PROPERTY SETTERS
  // ─────────────────────────────────────────────────────────────────────────
  handleSetCategory: (txId: string, newCategory: string) => void;
  handleSetContact: (txId: string, newContactId: string | null, contactType?: ContactType) => void;
  handleSetProject: (txId: string, newProjectId: string | null) => void;

  // ─────────────────────────────────────────────────────────────────────────
  // DOCUMENT UPLOAD / DELETE
  // ─────────────────────────────────────────────────────────────────────────
  docLoadingStates: Record<string, boolean>;
  handleAttachDocument: (transactionId: string) => void;
  /** Adjunta un fitxer ja seleccionat amb un nom explicit (overrideFilename). */
  handleAttachDocumentWithName: (transactionId: string, file: File, overrideFilename: string) => Promise<void>;
  handleDeleteDocument: (transactionId: string) => void;
  isDeleteDocDialogOpen: boolean;
  transactionToDeleteDoc: Transaction | null;
  handleDeleteDocClick: (transaction: Transaction) => void;
  handleDeleteDocConfirm: () => void;
  handleCloseDeleteDocDialog: () => void;

  // ─────────────────────────────────────────────────────────────────────────
  // EDIT DIALOG (state managed by EditTransactionDialog component)
  // ─────────────────────────────────────────────────────────────────────────
  isEditDialogOpen: boolean;
  editingTransaction: Transaction | null;
  handleEditClick: (transaction: Transaction) => void;
  handleSaveEdit: (formData: EditFormData) => void;
  handleCloseEditDialog: () => void;

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE DIALOG
  // ─────────────────────────────────────────────────────────────────────────
  isDeleteDialogOpen: boolean;
  transactionToDelete: Transaction | null;
  handleDeleteClick: (transaction: Transaction) => void;
  handleDeleteConfirm: () => void;
  handleCloseDeleteDialog: () => void;

  // ─────────────────────────────────────────────────────────────────────────
  // NEW CONTACT DIALOG (state managed by NewContactDialog component)
  // ─────────────────────────────────────────────────────────────────────────
  isNewContactDialogOpen: boolean;
  newContactType: 'donor' | 'supplier';
  handleOpenNewContactDialog: (txId: string, type: 'donor' | 'supplier') => void;
  handleSaveNewContact: (formData: NewContactFormData) => void;
  handleCloseNewContactDialog: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Reverteix tots els PendingDocuments conciliats amb una transacció a 'confirmed'.
 * Retorna el nombre de documents revertits (0 si no n'hi ha cap).
 */
async function unmatchPendingDocuments(
  firestore: Firestore,
  orgId: string,
  txId: string
): Promise<number> {
  const q = query(
    pendingDocumentsCollection(firestore, orgId),
    where('matchedTransactionId', '==', txId),
    where('status', '==', 'matched')
  );

  const snap = await getDocs(q);
  if (snap.empty) return 0;

  const batch = writeBatch(firestore);
  for (const docSnap of snap.docs) {
    batch.update(docSnap.ref, {
      status: 'confirmed',
      matchedTransactionId: deleteField(),
    });
  }

  await batch.commit();
  return snap.size;
}

// =============================================================================
// HOOK
// =============================================================================

export function useTransactionActions({
  transactionsCollection,
  contactsCollection,
  organizationId,
  storage,
  transactions,
  availableContacts,
  availableCategories,
  firestore,
  userId,
  canEditMovements = true,
}: UseTransactionActionsParams): UseTransactionActionsReturn {
  const { toast } = useToast();
  const { t } = useTranslations();

  // ─────────────────────────────────────────────────────────────────────────
  // STATE: Document Upload / Delete
  // ─────────────────────────────────────────────────────────────────────────
  const [docLoadingStates, setDocLoadingStates] = React.useState<Record<string, boolean>>({});
  const [isDeleteDocDialogOpen, setIsDeleteDocDialogOpen] = React.useState(false);
  const [transactionToDeleteDoc, setTransactionToDeleteDoc] = React.useState<Transaction | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // STATE: Edit Dialog
  // ─────────────────────────────────────────────────────────────────────────
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editingTransaction, setEditingTransaction] = React.useState<Transaction | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // STATE: Delete Dialog
  // ─────────────────────────────────────────────────────────────────────────
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [transactionToDelete, setTransactionToDelete] = React.useState<Transaction | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // STATE: New Contact Dialog
  // ─────────────────────────────────────────────────────────────────────────
  const [isNewContactDialogOpen, setIsNewContactDialogOpen] = React.useState(false);
  const [newContactType, setNewContactType] = React.useState<'donor' | 'supplier'>('donor');
  const [newContactTransactionId, setNewContactTransactionId] = React.useState<string | null>(null);

  const ensureCanEdit = React.useCallback((): boolean => {
    if (canEditMovements) return true;
    toast({
      variant: 'destructive',
      title: t.common.error,
      description: 'No tens permisos per editar moviments.',
    });
    return false;
  }, [canEditMovements, toast, t.common.error]);

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTE SETTER (for InlineNoteEditor component)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleSetNote = React.useCallback((txId: string, note: string) => {
    if (!ensureCanEdit()) return;
    if (!transactionsCollection) return;
    updateDocumentNonBlocking(doc(transactionsCollection, txId), { note: note || null });
  }, [ensureCanEdit, transactionsCollection]);

  // ═══════════════════════════════════════════════════════════════════════════
  // PROPERTY SETTERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleSetCategory = React.useCallback((txId: string, categoryId: string) => {
    if (!ensureCanEdit()) return;
    if (!transactionsCollection) return;

    if (!availableCategories) {
      toast({
        variant: 'destructive',
        title: t.movements?.table?.categoryTypeMismatch?.title ?? 'Error',
        description: t.movements?.table?.categoryTypeMismatch?.loading ?? 'Carregant categories… torna-ho a provar.',
      });
      return;
    }

    const tx = transactions?.find(tr => tr.id === txId);
    if (tx && !isCategoryIdCompatibleStrict(tx.amount, categoryId, availableCategories)) {
      toast({
        variant: 'destructive',
        title: t.movements?.table?.categoryTypeMismatch?.title ?? 'Tipus incompatible',
        description: t.movements?.table?.categoryTypeMismatch?.description ?? 'Aquesta categoria no és compatible amb el signe del moviment.',
      });
      return;
    }

    updateDocumentNonBlocking(doc(transactionsCollection, txId), { category: categoryId });
  }, [ensureCanEdit, transactionsCollection, transactions, availableCategories, toast, t]);

  const handleSetContact = React.useCallback((txId: string, newContactId: string | null, contactType?: ContactType) => {
    if (!ensureCanEdit()) return;
    if (!transactionsCollection) return;

    const updates: Record<string, unknown> = {
      contactId: newContactId,
      contactType: newContactId ? contactType : null,
    };

    // Auto-assign default category if contact has one and transaction doesn't
    if (newContactId) {
      const contact = availableContacts?.find(c => c.id === newContactId);
      const tx = transactions?.find(t => t.id === txId);
      if (contact?.defaultCategoryId && !tx?.category) {
        // Guardrail: només assignar si categories carregades i tipus compatible
        if (availableCategories && isCategoryIdCompatibleStrict(tx!.amount, contact.defaultCategoryId, availableCategories)) {
          updates.category = contact.defaultCategoryId;
        }
      }
    }

    updateDocumentNonBlocking(doc(transactionsCollection, txId), updates);
  }, [ensureCanEdit, transactionsCollection, availableContacts, availableCategories, transactions]);

  const handleSetProject = React.useCallback((txId: string, newProjectId: string | null) => {
    if (!ensureCanEdit()) return;
    if (!transactionsCollection) return;
    updateDocumentNonBlocking(doc(transactionsCollection, txId), { projectId: newProjectId });
  }, [ensureCanEdit, transactionsCollection]);

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCUMENT UPLOAD
  // ═══════════════════════════════════════════════════════════════════════════

  const handleAttachDocument = React.useCallback((transactionId: string) => {
    if (!ensureCanEdit()) return;
    if (!organizationId || !transactionsCollection) {
      const errorMsg = t.movements.table.organizationNotIdentified;
      toast({ variant: 'destructive', title: t.common.error, description: errorMsg });
      return;
    }

    // Delay per permetre que el dropdown menu es tanqui correctament abans d'obrir el file picker.
    // Sense aquest delay, el DropdownMenu de Radix UI pot quedar en un estat inconsistent
    // que bloqueja tota la interfície.
    setTimeout(() => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'application/pdf,image/*,.doc,.docx,.xls,.xlsx';
      fileInput.style.display = 'none';

      fileInput.onchange = async (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) {
          if (fileInput.parentElement) {
            document.body.removeChild(fileInput);
          }
          return;
        }
        setDocLoadingStates(prev => ({ ...prev, [transactionId]: true }));

        // Construir nom de fitxer estandarditzat
        const tx = transactions?.find(t => t.id === transactionId) ?? null;
        const dateISO = tx?.date ?? new Date().toISOString().split('T')[0];
        const concept = (tx?.note?.trim() || tx?.description?.trim() || 'moviment');
        const finalName = buildDocumentFilename({ dateISO, concept, originalName: file.name });

        toast({ title: t.movements.table.uploadingDocument, description: `Adjuntant "${finalName}"...` });

        const storagePath = `organizations/${organizationId}/documents/${transactionId}/${finalName}`;

        // Diagnòstic diferencial: verificar context d'upload
        const uploadCheck = assertUploadContext({
          contextLabel: 'moviments',
          orgId: organizationId,
          path: storagePath,
        });

        if (!uploadCheck.ok) {
          const msg = uploadCheck.reason === 'NO_AUTH'
            ? 'Sessió no preparada. Torna-ho a intentar en 2 segons.'
            : 'Organització no identificada.';
          toast({ variant: 'destructive', title: t.common.error, description: msg });
          setDocLoadingStates(prev => ({ ...prev, [transactionId]: false }));
          if (fileInput.parentElement) {
            document.body.removeChild(fileInput);
          }
          return;
        }

        const storageRef = ref(storage, storagePath);

        try {
          const uploadResult = await uploadBytes(storageRef, file);

          const downloadURL = await getDownloadURL(uploadResult.ref);
          updateDocumentNonBlocking(doc(transactionsCollection, transactionId), { document: downloadURL });

          toast({ title: t.movements.table.uploadSuccess, description: t.movements.table.documentUploadedSuccessfully });
        } catch (error: unknown) {
          console.error('FIREBASE_UPLOAD_ERROR_DIAGNOSTIC', error);
          const firebaseError = error as { code?: string; message?: string };
          const errorCode = firebaseError.code || 'UNKNOWN_CODE';

          let description = t.movements.table.unexpectedError(errorCode);
          if (errorCode === 'storage/unauthorized' || errorCode === 'storage/object-not-found') {
            description = t.movements.table.firebasePermissionDenied;
          } else if (errorCode === 'storage/canceled') {
            description = t.movements.table.uploadCancelled;
          }
          toast({ variant: 'destructive', title: t.movements.table.uploadError, description, duration: 9000 });
        } finally {
          setDocLoadingStates(prev => ({ ...prev, [transactionId]: false }));
          if (fileInput.parentElement) {
            document.body.removeChild(fileInput);
          }
        }
      };

      document.body.appendChild(fileInput);
      fileInput.click();
    }, 100);
  }, [ensureCanEdit, organizationId, transactionsCollection, storage, toast, t]);

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCUMENT ATTACH WITH EXPLICIT FILENAME (called from TransactionsTable dialog)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleAttachDocumentWithName = React.useCallback(async (
    transactionId: string,
    file: File,
    overrideFilename: string,
  ) => {
    if (!ensureCanEdit()) return;
    if (!organizationId || !firestore) {
      toast({ variant: 'destructive', title: t.common.error, description: t.movements.table.organizationNotIdentified });
      return;
    }

    setDocLoadingStates(prev => ({ ...prev, [transactionId]: true }));
    const tx = transactions?.find(tx => tx.id === transactionId) ?? null;

    toast({
      title: t.movements.table.uploadingDocument,
      description: `Adjuntant "${overrideFilename}"...`,
    });

    try {
      const result = await attachDocumentToTransaction({
        firestore,
        storage,
        organizationId,
        transactionId,
        file,
        transactionDate: tx?.date,
        transactionConcept: tx?.note || tx?.description,
        overrideFilename,
      });

      if (result.success) {
        toast({
          title: t.movements.table.uploadSuccess,
          description: t.movements.table.documentUploadedSuccessfully,
        });
      } else {
        toast({
          variant: 'destructive',
          title: t.movements.table.uploadError,
          description: result.error || t.movements.table.unexpectedError('UNKNOWN'),
        });
      }
    } catch (error) {
      console.error('[handleAttachDocumentWithName] Error:', error);
      toast({
        variant: 'destructive',
        title: t.movements.table.uploadError,
        description: error instanceof Error ? error.message : t.movements.table.unexpectedError('UNKNOWN'),
      });
    } finally {
      setDocLoadingStates(prev => ({ ...prev, [transactionId]: false }));
    }
  }, [ensureCanEdit, organizationId, firestore, storage, transactions, toast, t]);

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCUMENT DELETE
  // ═══════════════════════════════════════════════════════════════════════════

  const handleDeleteDocClick = React.useCallback((transaction: Transaction) => {
    setTransactionToDeleteDoc(transaction);
    setIsDeleteDocDialogOpen(true);
  }, []);

  const handleDeleteDocConfirm = React.useCallback(async () => {
    if (!ensureCanEdit()) return;
    if (!transactionToDeleteDoc || !transactionsCollection || !organizationId || !firestore) {
      setIsDeleteDocDialogOpen(false);
      setTransactionToDeleteDoc(null);
      return;
    }

    const transactionId = transactionToDeleteDoc.id;
    const documentUrl = transactionToDeleteDoc.document;

    setDocLoadingStates(prev => ({ ...prev, [transactionId]: true }));

    // ── GUARDRAIL: bloquejar si el document prové d'un pendent conciliat ──
    if (firestore && organizationId && transactionId) {
      const pdQuery = query(
        pendingDocumentsCollection(firestore, organizationId),
        where('matchedTransactionId', '==', transactionId),
        where('status', '==', 'matched'),
        limit(1)
      );

      const pdSnap = await getDocs(pdQuery);
      if (!pdSnap.empty) {
        toast({
          variant: 'destructive',
          title: t.pendingDocs.toasts.deleteDocBlockedTitle,
          description: t.pendingDocs.toasts.deleteDocBlockedDesc,
        });
        setDocLoadingStates(prev => ({ ...prev, [transactionId]: false }));
        setIsDeleteDocDialogOpen(false);
        setTransactionToDeleteDoc(null);
        return;
      }
    }

    try {
      // GUARDRAIL: Comprovar si el document prové d'un pendent conciliat
      const matchedPendingId = await getMatchedPendingDocumentId(firestore, organizationId, transactionId);
      if (matchedPendingId) {
        toast({
          variant: 'destructive',
          title: t.movements.table.deleteDocFromPendingError || 'No es pot eliminar',
          description: t.movements.table.deleteDocFromPendingHint || 'Aquest document prové d\'un moviment pendent conciliat. Elimina el pendent per desfer la conciliació.',
        });
        setDocLoadingStates(prev => ({ ...prev, [transactionId]: false }));
        setIsDeleteDocDialogOpen(false);
        setTransactionToDeleteDoc(null);
        return;
      }

      // Intentar eliminar el fitxer de Storage si tenim la URL
      if (documentUrl) {
        try {
          // Extreure el path del Storage des de la URL de download
          const storageRef = ref(storage, documentUrl);
          await deleteObject(storageRef);
        } catch (storageError: unknown) {
          // Si el fitxer no existeix o hi ha error, continuem igualment
          const firebaseError = storageError as { code?: string };
          if (firebaseError.code !== 'storage/object-not-found') {
            console.warn('Error eliminant fitxer de Storage:', storageError);
          }
        }
      }

      // Actualitzar Firestore per treure la referència al document
      updateDocumentNonBlocking(doc(transactionsCollection, transactionId), { document: null });

      toast({ title: t.movements.table.documentDeleted });
    } catch (error: unknown) {
      console.error('Error eliminant document:', error);
      const firebaseError = error as { message?: string };
      toast({
        variant: 'destructive',
        title: t.movements.table.uploadError,
        description: firebaseError.message || t.common.error,
      });
    } finally {
      setDocLoadingStates(prev => ({ ...prev, [transactionId]: false }));
      setIsDeleteDocDialogOpen(false);
      setTransactionToDeleteDoc(null);
    }
  }, [ensureCanEdit, transactionToDeleteDoc, transactionsCollection, organizationId, firestore, storage, toast, t]);

  const handleCloseDeleteDocDialog = React.useCallback(() => {
    setIsDeleteDocDialogOpen(false);
    setTransactionToDeleteDoc(null);
  }, []);

  const handleDeleteDocument = React.useCallback((transactionId: string) => {
    const transaction = transactions?.find(tx => tx.id === transactionId);
    if (transaction) {
      handleDeleteDocClick(transaction);
    }
  }, [transactions, handleDeleteDocClick]);

  // ═══════════════════════════════════════════════════════════════════════════
  // EDIT DIALOG
  // ═══════════════════════════════════════════════════════════════════════════

  const handleEditClick = React.useCallback((transaction: Transaction) => {
    if (!ensureCanEdit()) return;
    setEditingTransaction(transaction);
    setIsEditDialogOpen(true);
  }, [ensureCanEdit]);

  const handleSaveEdit = React.useCallback((formData: EditFormData) => {
    if (!ensureCanEdit()) return;
    if (!editingTransaction || !transactionsCollection) return;

    const selectedContact = formData.contactId
      ? availableContacts?.find(c => c.id === formData.contactId)
      : null;

    updateDocumentNonBlocking(doc(transactionsCollection, editingTransaction.id), {
      description: formData.description,
      amount: parseFloat(formData.amount),
      note: formData.note || null,
      contactId: formData.contactId,
      contactType: selectedContact?.type || null,
      projectId: formData.projectId,
    });

    toast({ title: t.movements.table.transactionUpdated });
    setIsEditDialogOpen(false);
    setEditingTransaction(null);
  }, [ensureCanEdit, editingTransaction, transactionsCollection, availableContacts, toast, t]);

  const handleCloseEditDialog = React.useCallback(() => {
    setIsEditDialogOpen(false);
    setEditingTransaction(null);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE DIALOG
  // ═══════════════════════════════════════════════════════════════════════════

  const handleDeleteClick = React.useCallback((transaction: Transaction) => {
    if (!ensureCanEdit()) return;
    setTransactionToDelete(transaction);
    setIsDeleteDialogOpen(true);
  }, [ensureCanEdit]);

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!ensureCanEdit()) return;
    if (!transactionToDelete || !transactionsCollection) {
      setIsDeleteDialogOpen(false);
      setTransactionToDelete(null);
      return;
    }

    // ── AUTO-UNMATCH: revertir pending documents conciliats ──
    let unmatchedCount = 0;
    if (firestore && organizationId) {
      try {
        unmatchedCount = await unmatchPendingDocuments(
          firestore,
          organizationId,
          transactionToDelete.id
        );
      } catch (error) {
        console.error('[handleDeleteConfirm] Error unmatching pending documents:', error);
        toast({
          variant: 'destructive',
          title: t.pendingDocs.toasts.autoUnmatchErrorTitle,
          description: t.pendingDocs.toasts.autoUnmatchErrorDesc,
        });
        setIsDeleteDialogOpen(false);
        setTransactionToDelete(null);
        return; // NO eliminar la transacció si falla l'unmatch
      }
    }

    // Soft-delete per transaccions fiscals (returns, remittance IN, stripe donations amb contactId)
    if (firestore && organizationId && userId && isFiscallyRelevantTransaction(transactionToDelete)) {
      try {
        await handleTransactionDelete(transactionToDelete, {
          firestore,
          orgId: organizationId,
          userId,
          reason: 'user_delete',
        });
        // Missatge específic per soft-delete
        toast({
          title: 'Moviment arxivat',
          description: 'El moviment fiscal ha estat arxivat (no eliminat).',
        });
      } catch (error) {
        console.error('[handleDeleteConfirm] Error archiving transaction:', error);
        toast({
          variant: 'destructive',
          title: t.common.error,
          description: (error as Error).message || 'Error arxivant la transacció',
        });
      }
    } else {
      // Delete normal per transaccions no fiscals
      deleteDocumentNonBlocking(doc(transactionsCollection, transactionToDelete.id));
      toast({ title: 'Moviment eliminat' });
    }

    // Toast informatiu si s'ha desfet alguna conciliació
    if (unmatchedCount > 0) {
      toast({
        title: t.pendingDocs.toasts.autoUnmatchTitle,
        description: t.pendingDocs.toasts.autoUnmatchDesc,
      });
    }

    setIsDeleteDialogOpen(false);
    setTransactionToDelete(null);
  }, [ensureCanEdit, transactionToDelete, transactionsCollection, firestore, organizationId, userId, toast, t]);

  const handleCloseDeleteDialog = React.useCallback(() => {
    setIsDeleteDialogOpen(false);
    setTransactionToDelete(null);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW CONTACT DIALOG
  // ═══════════════════════════════════════════════════════════════════════════

  const handleOpenNewContactDialog = React.useCallback((txId: string, type: 'donor' | 'supplier') => {
    if (!ensureCanEdit()) return;
    setNewContactTransactionId(txId);
    setNewContactType(type);
    setIsNewContactDialogOpen(true);
  }, [ensureCanEdit]);

  const handleSaveNewContact = React.useCallback((formData: NewContactFormData) => {
    if (!ensureCanEdit()) return;
    // Only name is required
    if (!formData.name) {
      toast({ variant: 'destructive', title: t.common.error, description: t.donors.errorNameRequired });
      return;
    }

    if (!contactsCollection || !transactionsCollection) return;

    // Warning if taxId or zipCode is missing for donors
    const hasIncompleteData = newContactType === 'donor' && (!formData.taxId || !formData.zipCode);

    const now = new Date().toISOString();
    const newContactData = {
      type: newContactType,
      name: formData.name,
      taxId: formData.taxId || null,
      zipCode: formData.zipCode || null,
      city: formData.city || null,
      province: formData.province || null,
      createdAt: now,
      ...(newContactType === 'donor' && {
        donorType: 'individual',
        membershipType: 'one-time',
      }),
    };

    addDocumentNonBlocking(contactsCollection, newContactData)
      .then(docRef => {
        if (docRef && newContactTransactionId) {
          handleSetContact(newContactTransactionId, docRef.id, newContactType);
        }
      });

    const typeLabel = newContactType === 'donor' ? t.donors.title.slice(0, -1) : t.suppliers.title.slice(0, -1);

    // Show creation toast
    toast({ title: t.movements.table.contactCreatedSuccess(typeLabel, formData.name).split('.')[0] });

    // Show warning if taxId or zipCode is missing
    if (hasIncompleteData) {
      setTimeout(() => {
        toast({
          title: t.donors.incompleteDataWarning,
          description: t.donors.incompleteDataWarningDescription,
        });
      }, 500);
    }

    setIsNewContactDialogOpen(false);
    setNewContactTransactionId(null);
  }, [
    ensureCanEdit,
    newContactType,
    newContactTransactionId,
    contactsCollection,
    transactionsCollection,
    handleSetContact,
    toast,
    t,
  ]);

  const handleCloseNewContactDialog = React.useCallback(() => {
    setIsNewContactDialogOpen(false);
    setNewContactTransactionId(null);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // RETURN
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // Note Setter
    handleSetNote,

    // Property Setters
    handleSetCategory,
    handleSetContact,
    handleSetProject,

    // Document Upload / Delete
    docLoadingStates,
    handleAttachDocument,
    handleAttachDocumentWithName,
    handleDeleteDocument,
    isDeleteDocDialogOpen,
    transactionToDeleteDoc,
    handleDeleteDocClick,
    handleDeleteDocConfirm,
    handleCloseDeleteDocDialog,

    // Edit Dialog
    isEditDialogOpen,
    editingTransaction,
    handleEditClick,
    handleSaveEdit,
    handleCloseEditDialog,

    // Delete Dialog
    isDeleteDialogOpen,
    transactionToDelete,
    handleDeleteClick,
    handleDeleteConfirm,
    handleCloseDeleteDialog,

    // New Contact Dialog
    isNewContactDialogOpen,
    newContactType,
    handleOpenNewContactDialog,
    handleSaveNewContact,
    handleCloseNewContactDialog,
  };
}
