'use client';

/**
 * TicketsInbox — Llista de tickets (PendingDocument type:'receipt')
 *
 * Mostra tots els tickets pujats amb opcions per:
 * - Veure preview
 * - Editar camps
 * - Reprocessar amb IA
 * - Arxivar
 * - Selecció múltiple per assignar a liquidació
 *
 * @see PAS 2 de la implementació de liquidacions
 */

import * as React from 'react';
import {
  onSnapshot,
  query,
  where,
  orderBy,
  writeBatch,
  doc,
  getDoc,
  arrayUnion,
  type Firestore,
} from 'firebase/firestore';
import { ref, getDownloadURL, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import { pendingDocumentsCollection, pendingDocumentDoc } from '@/lib/pending-documents/refs';
import { updatePendingDocument, archivePendingDocument } from '@/lib/pending-documents/api';
import type { PendingDocument } from '@/lib/pending-documents/types';
import { expenseReportRef, expenseReportsRefUntyped } from '@/lib/expense-reports/refs';
import { listenExpenseReports } from '@/lib/expense-reports/api';
import type { ExpenseReport } from '@/lib/expense-reports/types';
import { useTranslations } from '@/i18n';
import { useToast } from '@/hooks/use-toast';
import { formatCurrencyEU } from '@/lib/normalize';
import { format } from 'date-fns';
import { ca } from 'date-fns/locale';
import { serverTimestamp, addDoc, setDoc } from 'firebase/firestore';
import { computeSha256 } from '@/lib/files/sha256';
import { extractImageData } from '@/lib/pending-documents/extract-image';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Receipt,
  Archive,
  Sparkles,
  Loader2,
  Image as ImageIcon,
  FileText,
  ExternalLink,
  Save,
  X,
  CheckSquare,
  Plus,
  Camera,
} from 'lucide-react';
import { PendingDocumentsUploadModal } from '@/components/pending-documents/pending-documents-upload-modal';

// =============================================================================
// TYPES
// =============================================================================

interface TicketsInboxProps {
  firestore: Firestore;
  storage: FirebaseStorage;
  organizationId: string;
  canOperate: boolean;
}

type TicketFilter = 'all' | 'unassigned' | 'assigned';

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ca });
  } catch {
    return dateStr;
  }
}

function isImageFile(contentType: string): boolean {
  return contentType.startsWith('image/');
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TicketsInbox({
  firestore,
  storage,
  organizationId,
  canOperate,
}: TicketsInboxProps) {
  const { t } = useTranslations();
  const { toast } = useToast();

  // Estats
  const [tickets, setTickets] = React.useState<PendingDocument[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<TicketFilter>('unassigned');

  // Modal d'edició
  const [editingTicket, setEditingTicket] = React.useState<PendingDocument | null>(null);
  const [editForm, setEditForm] = React.useState({
    invoiceDate: '',
    amount: '',
    merchant: '',
    concept: '',
  });
  const [isSaving, setIsSaving] = React.useState(false);

  // Preview d'imatge
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);

  // IA processing
  const [processingTicketId, setProcessingTicketId] = React.useState<string | null>(null);

  // ===========================================================================
  // SELECCIÓ MÚLTIPLE I ASSIGNACIÓ A LIQUIDACIÓ
  // ===========================================================================
  const [selectedTicketIds, setSelectedTicketIds] = React.useState<Set<string>>(new Set());
  const [showAssignModal, setShowAssignModal] = React.useState(false);
  const [assignMode, setAssignMode] = React.useState<'existing' | 'new'>('existing');
  const [existingReports, setExistingReports] = React.useState<ExpenseReport[]>([]);
  const [selectedReportId, setSelectedReportId] = React.useState<string>('');
  const [newReportForm, setNewReportForm] = React.useState({
    title: '',
    dateFrom: '',
    dateTo: '',
    location: '',
    notes: '',
  });
  const [isAssigning, setIsAssigning] = React.useState(false);

  // Modal de pujada de tickets
  const [showUploadModal, setShowUploadModal] = React.useState(false);

  // Càmera directa (input ocult)
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = React.useState(false);

  // Ref per evitar múltiples execucions d'auto-reparació
  const didRepairRef = React.useRef(false);

  // Auto-reparació de tiquets orfes (reportId apunta a liquidació inexistent)
  // Només s'executa si canOperate (admin) i un cop per muntatge
  const repairOrphanedTickets = React.useCallback(
    async (docs: PendingDocument[]) => {
      // Guardrails: només admins i un cop per muntatge
      if (!canOperate || didRepairRef.current) return;
      if (!firestore || !organizationId) return;

      didRepairRef.current = true;

      // Filtrar tiquets amb reportId
      const assignedTickets = docs.filter((t) => t.reportId);
      if (assignedTickets.length === 0) return;

      // Obtenir IDs únics de liquidacions referenciades
      const reportIds = [...new Set(assignedTickets.map((t) => t.reportId!))];

      // Verificar quines liquidacions existeixen
      const orphanedTicketIds: string[] = [];

      for (const reportId of reportIds) {
        try {
          const reportRef = expenseReportRef(firestore, organizationId, reportId);
          const reportSnap = await getDoc(reportRef);
          if (!reportSnap.exists()) {
            // Liquidació no existeix → els tiquets són orfes
            const orphans = assignedTickets.filter((t) => t.reportId === reportId);
            orphanedTicketIds.push(...orphans.map((t) => t.id));
          }
        } catch {
          // Error de lectura → no fer res (pot ser permisos)
        }
      }

      if (orphanedTicketIds.length === 0) return;

      // Reparar amb chunking (màx 50 operacions per batch)
      const BATCH_LIMIT = 50;
      try {
        for (let i = 0; i < orphanedTicketIds.length; i += BATCH_LIMIT) {
          const chunk = orphanedTicketIds.slice(i, i + BATCH_LIMIT);
          const batch = writeBatch(firestore);

          for (const ticketId of chunk) {
            const ticketRef = pendingDocumentDoc(firestore, organizationId, ticketId);
            batch.update(ticketRef, {
              reportId: null,
              updatedAt: serverTimestamp(),
            });
          }

          await batch.commit();
        }

        console.info(`[TicketsInbox] Auto-repaired ${orphanedTicketIds.length} orphaned ticket(s)`);
      } catch {
        // Silenciós: no bloquejar l'usuari
      }
    },
    [firestore, organizationId, canOperate]
  );

  // Subscripció a tickets (type: 'receipt', status no arxivat)
  React.useEffect(() => {
    if (!organizationId || !firestore) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const collRef = pendingDocumentsCollection(firestore, organizationId);
    const q = query(
      collRef,
      where('type', '==', 'receipt'),
      where('status', 'in', ['draft', 'confirmed']),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: PendingDocument[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          docs.push({ ...data, id: docSnap.id } as PendingDocument);
        });
        setTickets(docs);
        setIsLoading(false);

        // Auto-reparació silenciosa (no bloquejant)
        repairOrphanedTickets(docs);
      },
      (error) => {
        console.error('[TicketsInbox] Error:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [organizationId, firestore, repairOrphanedTickets]);

  // Subscripció a liquidacions existents (draft/submitted) quan s'obre el modal
  React.useEffect(() => {
    if (!showAssignModal || !organizationId || !firestore) return;

    const unsubscribe = listenExpenseReports(
      firestore,
      organizationId,
      { statusIn: ['draft', 'submitted'] },
      (reports) => setExistingReports(reports),
      (error) => console.error('[TicketsInbox] Error loading reports:', error)
    );

    return () => unsubscribe();
  }, [showAssignModal, organizationId, firestore]);

  // Netejar selecció quan canvia el filtre
  React.useEffect(() => {
    setSelectedTicketIds(new Set());
  }, [filter]);

  // Filtrar tickets
  const filteredTickets = React.useMemo(() => {
    switch (filter) {
      case 'unassigned':
        return tickets.filter((t) => !t.reportId);
      case 'assigned':
        return tickets.filter((t) => t.reportId);
      default:
        return tickets;
    }
  }, [tickets, filter]);

  // Comptadors
  const counts = React.useMemo(() => ({
    all: tickets.length,
    unassigned: tickets.filter((t) => !t.reportId).length,
    assigned: tickets.filter((t) => t.reportId).length,
  }), [tickets]);

  // Tickets seleccionables (només els que no tenen reportId)
  const selectableTickets = React.useMemo(
    () => filteredTickets.filter((t) => !t.reportId),
    [filteredTickets]
  );

  // Funcions de selecció
  const handleToggleSelect = (ticketId: string) => {
    setSelectedTicketIds((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) {
        next.delete(ticketId);
      } else {
        next.add(ticketId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedTicketIds.size === selectableTickets.length) {
      // Deseleccionar tot
      setSelectedTicketIds(new Set());
    } else {
      // Seleccionar tots els seleccionables
      setSelectedTicketIds(new Set(selectableTickets.map((t) => t.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedTicketIds(new Set());
  };

  // Obrir modal d'assignació
  const handleOpenAssignModal = () => {
    setAssignMode('existing');
    setSelectedReportId('');
    setNewReportForm({
      title: '',
      dateFrom: '',
      dateTo: '',
      location: '',
      notes: '',
    });
    setShowAssignModal(true);
  };

  // Assignació batch atòmica
  const handleAssignToReport = async () => {
    if (selectedTicketIds.size === 0) return;

    setIsAssigning(true);

    try {
      let targetReportId: string;

      // Si mode "new", crear primer la liquidació
      if (assignMode === 'new') {
        const now = serverTimestamp();
        const reportRef = expenseReportsRefUntyped(firestore, organizationId);
        const newReportDoc = await addDoc(reportRef, {
          status: 'draft',
          title: newReportForm.title || null,
          dateFrom: newReportForm.dateFrom || null,
          dateTo: newReportForm.dateTo || null,
          location: newReportForm.location || null,
          beneficiary: null,
          receiptDocIds: [],
          mileage: null,
          totalAmount: 0,
          notes: newReportForm.notes || null,
          matchedTransactionId: null,
          generatedPdf: null,
          sepa: null,
          payment: null,
          createdAt: now,
          updatedAt: now,
          submittedAt: null,
        });
        targetReportId = newReportDoc.id;
      } else {
        if (!selectedReportId) {
          toast({
            title: t.common?.error ?? 'Error',
            description: t.ticketsInbox?.toasts?.selectExisting ?? 'Selecciona una liquidació existent.',
            variant: 'destructive',
          });
          setIsAssigning(false);
          return;
        }
        targetReportId = selectedReportId;
      }

      // Validar server-side que els tickets no estiguin ja assignats
      const ticketIdsToAssign = Array.from(selectedTicketIds);
      const alreadyAssigned: string[] = [];

      for (const ticketId of ticketIdsToAssign) {
        const ticketRef = pendingDocumentDoc(firestore, organizationId, ticketId);
        const ticketSnap = await getDoc(ticketRef);
        if (ticketSnap.exists()) {
          const data = ticketSnap.data() as PendingDocument;
          if (data.reportId) {
            alreadyAssigned.push(ticketId);
          }
        }
      }

      if (alreadyAssigned.length > 0) {
        toast({
          title: t.ticketsInbox?.toasts?.alreadyAssignedTitle ?? 'Alguns tickets ja assignats',
          description: t.ticketsInbox?.toasts?.alreadyAssignedDesc?.({ count: alreadyAssigned.length }) ?? `${alreadyAssigned.length} ticket(s) ja tenien liquidació assignada.`,
          variant: 'destructive',
        });
        // Treure els ja assignats de la selecció
        const validTicketIds = ticketIdsToAssign.filter((id) => !alreadyAssigned.includes(id));
        if (validTicketIds.length === 0) {
          setIsAssigning(false);
          return;
        }
      }

      const validTicketIds = ticketIdsToAssign.filter((id) => !alreadyAssigned.includes(id));

      // Batch atòmic (màx 50 operacions per batch)
      const BATCH_LIMIT = 50;
      const batches: ReturnType<typeof writeBatch>[] = [];

      // Cada ticket genera 2 operacions: update ticket + update report
      // Però podem agrupar els updates del report en un sol amb arrayUnion
      // Estratègia: 1 batch per cada 49 tickets (49 ticket updates + 1 report update = 50)
      const ticketsPerBatch = Math.floor(BATCH_LIMIT / 1) - 1; // 49

      for (let i = 0; i < validTicketIds.length; i += ticketsPerBatch) {
        const chunk = validTicketIds.slice(i, i + ticketsPerBatch);
        const batch = writeBatch(firestore);

        // Update tickets
        for (const ticketId of chunk) {
          const ticketRef = doc(firestore, `organizations/${organizationId}/pendingDocuments/${ticketId}`);
          batch.update(ticketRef, {
            reportId: targetReportId,
            updatedAt: serverTimestamp(),
          });
        }

        // Update report amb arrayUnion
        const reportRef = expenseReportRef(firestore, organizationId, targetReportId);
        batch.update(reportRef, {
          receiptDocIds: arrayUnion(...chunk),
          updatedAt: serverTimestamp(),
        });

        batches.push(batch);
      }

      // Executar tots els batches
      await Promise.all(batches.map((b) => b.commit()));

      toast({
        title: t.ticketsInbox?.toasts?.assignedSuccess ?? 'Tickets assignats',
        description: t.ticketsInbox?.toasts?.assignedSuccessDesc?.({ count: validTicketIds.length }) ?? `${validTicketIds.length} ticket(s) assignats correctament.`,
      });

      // Netejar i tancar
      setSelectedTicketIds(new Set());
      setShowAssignModal(false);
    } catch (error) {
      console.error('[handleAssignToReport] Error:', error);
      toast({
        title: t.common?.error ?? 'Error',
        description: t.ticketsInbox?.toasts?.assignError ?? 'No s\'ha pogut completar l\'assignació.',
        variant: 'destructive',
      });
    } finally {
      setIsAssigning(false);
    }
  };

  // Obrir preview
  const handlePreview = async (ticket: PendingDocument) => {
    if (!isImageFile(ticket.file.contentType)) {
      // Per PDFs, obrir en nova pestanya
      try {
        const storageRef = ref(storage, ticket.file.storagePath);
        const url = await getDownloadURL(storageRef);
        window.open(url, '_blank');
      } catch (error) {
        console.error('[handlePreview] Error:', error);
        toast({
          title: t.common?.error ?? 'Error',
          description: t.ticketsInbox?.toasts?.cannotOpenFile ?? 'No s\'ha pogut obrir el fitxer.',
          variant: 'destructive',
        });
      }
      return;
    }

    // Per imatges, mostrar modal
    setPreviewLoading(true);
    try {
      const storageRef = ref(storage, ticket.file.storagePath);
      const url = await getDownloadURL(storageRef);
      setPreviewUrl(url);
    } catch (error) {
      console.error('[handlePreview] Error:', error);
      toast({
        title: t.common?.error ?? 'Error',
        description: t.ticketsInbox?.toasts?.cannotLoadImage ?? 'No s\'ha pogut carregar la imatge.',
        variant: 'destructive',
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Obrir editor
  const handleEdit = (ticket: PendingDocument) => {
    setEditingTicket(ticket);
    setEditForm({
      invoiceDate: ticket.invoiceDate ?? '',
      amount: ticket.amount?.toString() ?? '',
      merchant: ticket.extracted?.evidence?.supplierName ?? '',
      concept: ticket.file.filename,
    });
  };

  // Guardar edició
  const handleSaveEdit = async () => {
    if (!editingTicket) return;

    setIsSaving(true);
    try {
      const patch: Record<string, string | number | null> = {};

      // Només actualitzar camps que han canviat i no són buits
      if (editForm.invoiceDate && editForm.invoiceDate !== editingTicket.invoiceDate) {
        patch.invoiceDate = editForm.invoiceDate;
      }

      const newAmount = editForm.amount ? parseFloat(editForm.amount) : null;
      if (newAmount !== null && newAmount !== editingTicket.amount) {
        patch.amount = newAmount;
      }

      if (Object.keys(patch).length > 0) {
        await updatePendingDocument(firestore, organizationId, editingTicket.id, patch);
        toast({
          title: t.ticketsInbox?.toasts?.ticketSaved ?? 'Ticket guardat',
        });
      }

      setEditingTicket(null);
    } catch (error) {
      console.error('[handleSaveEdit] Error:', error);
      toast({
        title: t.common?.error ?? 'Error',
        description: t.ticketsInbox?.toasts?.cannotSave ?? 'No s\'ha pogut guardar.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Processar amb IA
  const handleProcessWithAI = async (ticket: PendingDocument) => {
    setProcessingTicketId(ticket.id);

    try {
      // Obtenir URL del fitxer
      const storageRef = ref(storage, ticket.file.storagePath);
      const fileUrl = await getDownloadURL(storageRef);

      // Cridar endpoint IA
      const response = await fetch('/api/ai/extract-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl,
          docId: ticket.id,
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.message || 'Error de IA');
      }

      // Aplicar resultats només als camps buits (no sobreescriure manuals)
      const patch: Record<string, string | number | null> = {};

      if (result.date && !ticket.invoiceDate) {
        patch.invoiceDate = result.date;
      }

      if (result.amount !== null && ticket.amount === null) {
        patch.amount = result.amount;
      }

      if (Object.keys(patch).length > 0) {
        await updatePendingDocument(firestore, organizationId, ticket.id, patch);
        toast({
          title: t.ticketsInbox?.toasts?.aiFilledTitle ?? 'Camps omplerts amb IA',
        });
      } else {
        toast({
          title: t.ticketsInbox?.toasts?.noChanges ?? 'Sense canvis',
          description: result.confidence > 0
            ? (t.ticketsInbox?.toasts?.noChangesHadValues ?? 'Tots els camps ja tenien valor.')
            : (t.ticketsInbox?.toasts?.noChangesNoData ?? 'La IA no ha pogut extreure dades.'),
        });
      }
    } catch (error) {
      console.error('[handleProcessWithAI] Error:', error);
      toast({
        title: t.ticketsInbox?.toasts?.aiErrorTitle ?? 'Error de IA',
        description: error instanceof Error ? error.message : (t.ticketsInbox?.toasts?.aiErrorDesc ?? 'No s\'ha pogut processar.'),
        variant: 'destructive',
      });
    } finally {
      setProcessingTicketId(null);
    }
  };

  // Handler per pujar foto directa de la càmera
  const handleTicketImageUpload = async (file: File) => {
    if (!file || !organizationId || !firestore || !storage) return;

    setIsUploadingPhoto(true);

    try {
      // 1. Calcular SHA256 per dedupe
      const sha256 = await computeSha256(file);

      // 2. Comprovar duplicat
      const collRef = pendingDocumentsCollection(firestore, organizationId);
      const dupQuery = query(
        collRef,
        where('file.sha256', '==', sha256),
        where('status', 'in', ['draft', 'confirmed', 'sepa_generated', 'matched'])
      );
      const { getDocs } = await import('firebase/firestore');
      const dupSnapshot = await getDocs(dupQuery);

      if (!dupSnapshot.empty) {
        toast({
          title: t.ticketsInbox?.toasts?.duplicateTitle ?? 'Ticket duplicat',
          description: t.ticketsInbox?.toasts?.duplicateDesc ?? 'Ja existeix un ticket amb aquesta imatge.',
          variant: 'destructive',
        });
        setIsUploadingPhoto(false);
        return;
      }

      // 3. Generar docId
      const docId = doc(collRef).id;

      // 4. Pujar a Storage
      const contentType = file.type || 'image/jpeg';
      const storagePath = `organizations/${organizationId}/pendingDocuments/${docId}/${file.name}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file, {
        contentType,
        customMetadata: {
          originalFileName: file.name,
          sha256,
        },
      });

      // 5. Crear document Firestore
      const docRef = doc(collRef, docId);
      const now = serverTimestamp();

      const pendingDoc: Omit<PendingDocument, 'id'> = {
        status: 'draft',
        type: 'receipt',
        file: {
          storagePath,
          filename: file.name,
          contentType,
          sizeBytes: file.size,
          sha256,
        },
        invoiceNumber: null,
        invoiceDate: null,
        amount: null,
        supplierId: null,
        categoryId: null,
        extracted: null,
        sepa: null,
        matchedTransactionId: null,
        reportId: null,
        createdAt: now as any,
        updatedAt: now as any,
        confirmedAt: null,
      };

      await setDoc(docRef, pendingDoc);

      // 6. Extracció automàtica amb IA
      const fullDoc: PendingDocument = {
        id: docId,
        ...pendingDoc,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };

      try {
        await extractImageData(storage, firestore, organizationId, fullDoc);
      } catch (extractError) {
        // L'extracció pot fallar sense bloquejar l'upload
        console.warn('[handleTicketImageUpload] Image extraction error (non-blocking):', extractError);
      }

      toast({
        title: t.ticketsInbox?.toasts?.uploadedTitle ?? 'Ticket pujat',
        description: t.ticketsInbox?.toasts?.uploadedDesc ?? 'La foto s\'ha pujat correctament.',
      });
    } catch (error) {
      console.error('[handleTicketImageUpload] Error:', error);
      toast({
        title: t.common?.error ?? 'Error',
        description: t.ticketsInbox?.toasts?.cannotUpload ?? 'No s\'ha pogut pujar la foto.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Arxivar
  const handleArchive = async (ticket: PendingDocument) => {
    try {
      await archivePendingDocument(firestore, organizationId, ticket);
      toast({ title: t.ticketsInbox?.toasts?.archivedTitle ?? 'Ticket arxivat' });
    } catch (error) {
      console.error('[handleArchive] Error:', error);
      toast({
        title: t.common?.error ?? 'Error',
        description: t.ticketsInbox?.toasts?.cannotArchive ?? 'No s\'ha pogut arxivar.',
        variant: 'destructive',
      });
    }
  };

  // Render loading
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Header: Layout responsive en 2 franges que fan wrap */}
      <div className="flex flex-col gap-3">
        {/* Franja 1: Filtres + Accions (wrap en mòbil) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Filtres */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filter === 'unassigned' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('unassigned')}
              className="shrink-0"
            >
              <span className="sm:hidden">{t.ticketsInbox?.filters?.pending ?? 'Pendents'}</span>
              <span className="hidden sm:inline">{t.ticketsInbox?.filters?.noSettlement ?? 'Sense liquidació'}</span>
              {counts.unassigned > 0 && (
                <Badge variant="secondary" className="ml-1.5">
                  {counts.unassigned}
                </Badge>
              )}
            </Button>
            <Button
              variant={filter === 'assigned' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('assigned')}
              className="shrink-0"
            >
              {t.ticketsInbox?.filters?.assigned ?? 'Assignats'}
              {counts.assigned > 0 && (
                <Badge variant="secondary" className="ml-1.5">
                  {counts.assigned}
                </Badge>
              )}
            </Button>
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              className="shrink-0"
            >
              {t.ticketsInbox?.filters?.all ?? 'Tots'}
              <Badge variant="secondary" className="ml-1.5">
                {counts.all}
              </Badge>
            </Button>
          </div>

          {/* Botons d'acció */}
          {canOperate && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Fer foto - obre càmera en mòbil */}
              <Button
                size="sm"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="shrink-0"
              >
                {isUploadingPhoto ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="mr-2 h-4 w-4" />
                )}
                {t.ticketsInbox?.actions?.takePhoto ?? 'Fer foto'}
              </Button>
              {/* Afegir ticket - obre modal genèric */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowUploadModal(true)}
                className="shrink-0"
              >
                <Plus className="mr-2 h-4 w-4" />
                <span className="sm:hidden">{t.ticketsInbox?.actions?.addTicketShort ?? 'Afegir'}</span>
                <span className="hidden sm:inline">{t.ticketsInbox?.actions?.addTicket ?? 'Afegir ticket'}</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Barra d'accions (quan hi ha selecció) */}
      {selectedTicketIds.size > 0 && canOperate && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={
                    selectableTickets.length > 0 &&
                    selectedTicketIds.size === selectableTickets.length
                  }
                  onCheckedChange={handleSelectAll}
                  aria-label={t.ticketsInbox?.actions?.selectAll ?? 'Seleccionar tots'}
                />
                <span className="text-sm font-medium">
                  {t.ticketsInbox?.actions?.selectedCount?.({ count: selectedTicketIds.size }) ?? `${selectedTicketIds.size} seleccionats`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleOpenAssignModal}>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  {t.ticketsInbox?.actions?.assignToSettlement ?? 'Assignar a liquidació'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleClearSelection}
                >
                  <X className="mr-2 h-4 w-4" />
                  {t.ticketsInbox?.actions?.clearSelection ?? 'Netejar selecció'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Llista de tickets */}
      {filteredTickets.length === 0 ? (
        <Card className="py-6">
          <CardContent className="text-center space-y-3">
            <Receipt className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <div>
              <p className="font-medium">
                {filter === 'unassigned' ? (t.ticketsInbox?.empty?.noUnassigned ?? 'Cap ticket pendent') : (t.ticketsInbox?.empty?.noTickets ?? 'Cap ticket')}
              </p>
              <p className="text-sm text-muted-foreground">
                {filter === 'unassigned'
                  ? (t.ticketsInbox?.empty?.uploadToStart ?? 'Puja tickets per començar.')
                  : (t.ticketsInbox?.empty?.noInFilter ?? 'No hi ha tickets en aquest filtre.')}
              </p>
            </div>
            {canOperate && filter === 'unassigned' && (
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                >
                  {isUploadingPhoto ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="mr-2 h-4 w-4" />
                  )}
                  {t.ticketsInbox?.actions?.takePhoto ?? 'Fer foto'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowUploadModal(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t.ticketsInbox?.actions?.addTicket ?? 'Afegir ticket'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTickets.map((ticket) => {
            const isSelectable = !ticket.reportId;
            const isSelected = selectedTicketIds.has(ticket.id);

            return (
              <Card
                key={ticket.id}
                className={`hover:shadow-sm transition-shadow ${isSelected ? 'ring-2 ring-primary' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Checkbox (només visible si canOperate) */}
                    {canOperate && (
                      <div className="flex-shrink-0">
                        {isSelectable ? (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleSelect(ticket.id)}
                            aria-label={`Seleccionar ${ticket.file.filename}`}
                          />
                        ) : (
                          <Checkbox
                            disabled
                            className="opacity-50"
                            aria-label={t.ticketsInbox?.badges?.assigned ?? 'Ja assignat'}
                          />
                        )}
                      </div>
                    )}

                    {/* Icona/preview */}
                    <button
                      onClick={() => handlePreview(ticket)}
                      className="flex-shrink-0 w-12 h-12 rounded bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                      title={t.ticketsInbox?.tooltips?.viewFile ?? 'Veure fitxer'}
                    >
                      {isImageFile(ticket.file.contentType) ? (
                        <ImageIcon className="h-6 w-6 text-blue-500" />
                      ) : (
                        <FileText className="h-6 w-6 text-gray-500" />
                      )}
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {ticket.extracted?.evidence?.supplierName || ticket.file.filename}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{formatDate(ticket.invoiceDate)}</span>
                        {ticket.amount !== null && (
                          <span className="font-medium text-foreground">
                            {formatCurrencyEU(ticket.amount)}
                          </span>
                        )}
                      </div>
                      {/* Badge d'estat */}
                      <div className="mt-1">
                        {ticket.reportId ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            {t.ticketsInbox?.badges?.assigned ?? 'Ja assignat'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700">
                            {t.ticketsInbox?.badges?.noSettlement ?? 'Sense liquidació'}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Accions */}
                    {canOperate && (
                      <div className="flex items-center gap-1">
                        {/* Processar amb IA */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleProcessWithAI(ticket)}
                          disabled={processingTicketId === ticket.id}
                          title={t.ticketsInbox?.tooltips?.fillWithAI ?? 'Omplir amb IA'}
                        >
                          {processingTicketId === ticket.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>

                        {/* Editar */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(ticket)}
                          title={t.ticketsInbox?.tooltips?.edit ?? 'Editar'}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>

                        {/* Arxivar (només si no assignat) */}
                        {!ticket.reportId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleArchive(ticket)}
                            title={t.ticketsInbox?.tooltips?.archive ?? 'Arxivar'}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal d'edició */}
      <Dialog open={!!editingTicket} onOpenChange={(open) => !open && setEditingTicket(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.ticketsInbox?.editModal?.title ?? 'Editar ticket'}</DialogTitle>
            <DialogDescription>
              {editingTicket?.file.filename}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceDate">{t.ticketsInbox?.editModal?.date ?? 'Data'}</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={editForm.invoiceDate}
                onChange={(e) => setEditForm((f) => ({ ...f, invoiceDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">{t.ticketsInbox?.editModal?.amount ?? 'Import'}</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={editForm.amount}
                onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTicket(null)}>
              <X className="mr-2 h-4 w-4" />
              {t.common?.cancel ?? 'Cancel·lar'}
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {t.common?.save ?? 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de preview d'imatge */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.ticketsInbox?.previewModal?.title ?? 'Preview'}</DialogTitle>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt="Ticket preview"
              className="w-full h-auto max-h-[70vh] object-contain rounded"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Modal d'assignació a liquidació */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.ticketsInbox?.assignModal?.title ?? 'Assignar a liquidació'}</DialogTitle>
            <DialogDescription>
              {t.ticketsInbox?.assignModal?.selectedCount?.({ count: selectedTicketIds.size }) ?? `${selectedTicketIds.size} seleccionats`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Selector de mode */}
            <div className="flex gap-2">
              <Button
                variant={assignMode === 'existing' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAssignMode('existing')}
                className="flex-1"
              >
                {t.ticketsInbox?.assignModal?.existingSettlement ?? 'Liquidació existent'}
              </Button>
              <Button
                variant={assignMode === 'new' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAssignMode('new')}
                className="flex-1"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t.ticketsInbox?.assignModal?.newSettlement ?? 'Nova liquidació'}
              </Button>
            </div>

            {assignMode === 'existing' ? (
              /* Selector de liquidació existent */
              <div className="space-y-2">
                <Label htmlFor="existingReport">{t.ticketsInbox?.assignModal?.selectLabel ?? 'Selecciona liquidació'}</Label>
                {existingReports.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {t.ticketsInbox?.assignModal?.noSettlementsAvailable ?? 'No hi ha liquidacions en esborrany o enviades.'}
                    <br />
                    {t.ticketsInbox?.assignModal?.createNew ?? 'Crea una nova liquidació.'}
                  </p>
                ) : (
                  <Select
                    value={selectedReportId}
                    onValueChange={setSelectedReportId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t.ticketsInbox?.assignModal?.selectPlaceholder ?? 'Selecciona una liquidació...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {existingReports.map((report) => (
                        <SelectItem key={report.id} value={report.id}>
                          <div className="flex items-center gap-2">
                            <span>{report.title || (t.ticketsInbox?.assignModal?.noTitle ?? 'Sense títol')}</span>
                            <Badge variant="outline" className="text-xs">
                              {report.status === 'draft' ? (t.ticketsInbox?.badges?.draft ?? 'Esborrany') : (t.ticketsInbox?.badges?.submitted ?? 'Enviada')}
                            </Badge>
                            <span className="text-muted-foreground text-xs">
                              {t.ticketsInbox?.assignModal?.ticketCount?.({ count: report.receiptDocIds.length }) ?? `(${report.receiptDocIds.length} tickets)`}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : (
              /* Formulari de nova liquidació */
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newTitle">{t.ticketsInbox?.assignModal?.titleLabel ?? 'Títol / Motiu'}</Label>
                  <Input
                    id="newTitle"
                    placeholder={t.ticketsInbox?.assignModal?.titlePlaceholder ?? 'Ex: Viatge Barcelona març 2024'}
                    value={newReportForm.title}
                    onChange={(e) =>
                      setNewReportForm((f) => ({ ...f, title: e.target.value }))
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newDateFrom">{t.ticketsInbox?.assignModal?.dateStart ?? 'Data inici'}</Label>
                    <Input
                      id="newDateFrom"
                      type="date"
                      value={newReportForm.dateFrom}
                      onChange={(e) =>
                        setNewReportForm((f) => ({ ...f, dateFrom: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newDateTo">{t.ticketsInbox?.assignModal?.dateEnd ?? 'Data fi'}</Label>
                    <Input
                      id="newDateTo"
                      type="date"
                      value={newReportForm.dateTo}
                      onChange={(e) =>
                        setNewReportForm((f) => ({ ...f, dateTo: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newLocation">{t.ticketsInbox?.assignModal?.destination ?? 'Destí (opcional)'}</Label>
                  <Input
                    id="newLocation"
                    placeholder={t.ticketsInbox?.assignModal?.destinationPlaceholder ?? 'Ex: Barcelona'}
                    value={newReportForm.location}
                    onChange={(e) =>
                      setNewReportForm((f) => ({ ...f, location: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newNotes">{t.ticketsInbox?.assignModal?.notes ?? 'Notes (opcional)'}</Label>
                  <Textarea
                    id="newNotes"
                    placeholder={t.ticketsInbox?.assignModal?.notesPlaceholder ?? 'Observacions...'}
                    rows={2}
                    value={newReportForm.notes}
                    onChange={(e) =>
                      setNewReportForm((f) => ({ ...f, notes: e.target.value }))
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAssignModal(false)}
              disabled={isAssigning}
            >
              {t.common?.cancel ?? 'Cancel·lar'}
            </Button>
            <Button
              onClick={handleAssignToReport}
              disabled={
                isAssigning ||
                (assignMode === 'existing' && !selectedReportId && existingReports.length > 0)
              }
            >
              {isAssigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.ticketsInbox?.assignModal?.assigning ?? 'Assignant...'}
                </>
              ) : (
                <>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  {t.ticketsInbox?.assignModal?.assignCount?.({ count: selectedTicketIds.size }) ?? `Assignar ${selectedTicketIds.size} tickets`}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de pujada de tickets */}
      <PendingDocumentsUploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
      />

      {/* Input ocult per càmera directa */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          // Reset input per permetre re-foto del mateix nom
          e.target.value = '';
          await handleTicketImageUpload(file);
        }}
      />
    </div>
  );
}
