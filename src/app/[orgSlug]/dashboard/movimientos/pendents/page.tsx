'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Contact, Category, Transaction } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from '@/i18n';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { MOBILE_CTA_PRIMARY } from '@/lib/ui/mobile-actions';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  FileStack,
  FileText,
  Upload,
  Info,
  Loader2,
  CheckCheck,
  CreditCard,
  MoreVertical,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/ui/empty-state';
import {
  buildPendingDocumentsQuery,
  updatePendingDocument,
  renamePendingDocument,
  confirmPendingDocument,
  confirmManyPendingDocuments,
  archivePendingDocument,
  restorePendingDocument,
  deletePendingDocument,
  deleteMatchedPendingDocument,
  isDocumentReadyToConfirm,
  type PendingDocument,
  type PendingDocumentStatus,
} from '@/lib/pending-documents';
import { PendingDocumentsUploadModal } from '@/components/pending-documents/pending-documents-upload-modal';
import { PendingDocumentRow } from '@/components/pending-documents/pending-document-row';
import { PendingDocumentCard } from '@/components/pending-documents/pending-document-card';
import {
  PendingDocumentsFilterPanel,
  filterPendingDocuments,
  EMPTY_FILTERS,
  type PendingDocumentsFilters,
} from '@/components/pending-documents/pending-documents-filter-panel';
import { SepaGenerationModal } from '@/components/pending-documents/sepa-generation-modal';
import { ReconciliationModal } from '@/components/pending-documents/reconciliation-modal';

// Filtres per pestanyes (exclusius)
const DRAFTS_FILTER: PendingDocumentStatus[] = ['draft'];
const PENDING_FILTER: PendingDocumentStatus[] = ['confirmed', 'sepa_generated'];

export default function PendingDocsPage() {
  const { organization, organizationId, userRole } = useCurrentOrganization();
  const { firestore, storage } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const { t, tr } = useTranslations();
  const isMobile = useIsMobile();

  // Feature flag check - redirect if not enabled
  const isPendingDocsEnabled = organization?.features?.pendingDocs ?? false;

  // Admin i user poden operar (superadmin es resol com admin). Viewer: només lectura.
  const canOperate = userRole === 'admin' || userRole === 'user';

  // Estat del filtre (per defecte: Per revisar = drafts)
  const [statusFilter, setStatusFilter] = React.useState<PendingDocumentStatus[] | 'all' | 'matched' | 'archived'>(DRAFTS_FILTER);

  // Modal d'upload
  const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false);
  const [initialUploadFiles, setInitialUploadFiles] = React.useState<File[] | undefined>(undefined);

  // Clau per forçar remount de la llista després d'upload
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Estats de càrrega
  const [confirmingDocId, setConfirmingDocId] = React.useState<string | null>(null);
  const [isBulkConfirming, setIsBulkConfirming] = React.useState(false);
  const [archivingDocId, setArchivingDocId] = React.useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = React.useState<string | null>(null);
  const [relinkingDocId, setRelinkingDocId] = React.useState<string | null>(null);
  const [deletingMatchedDocId, setDeletingMatchedDocId] = React.useState<string | null>(null);

  // Filtres client-side
  const [filters, setFilters] = React.useState<PendingDocumentsFilters>(EMPTY_FILTERS);

  // Selecció múltiple
  const [selectedDocIds, setSelectedDocIds] = React.useState<Set<string>>(new Set());

  // Modal SEPA
  const [isSepaModalOpen, setIsSepaModalOpen] = React.useState(false);

  // Modal de conciliació
  const [reconcileDoc, setReconcileDoc] = React.useState<PendingDocument | null>(null);
  const [reconcileTx, setReconcileTx] = React.useState<Transaction | null>(null);

  // Control d'expansió per files (només una a la vegada)
  const [expandedDocId, setExpandedDocId] = React.useState<string | null>(null);

  // Drag & drop extern (per obrir modal amb fitxers)
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);
  const dragCounter = React.useRef(0);

  // Ref per scroll a dalt després d'upload
  const topRef = React.useRef<HTMLDivElement>(null);

  // Construir la query memoitzada
  const pendingDocsQuery = useMemoFirebase(
    () => {
      if (!organizationId || !firestore || !isPendingDocsEnabled) return null;

      // Determinar quins estats filtrar
      let statusIn: PendingDocumentStatus[] | undefined;
      if (statusFilter === 'all') {
        statusIn = undefined; // Tots
      } else if (statusFilter === 'matched') {
        statusIn = ['matched'];
      } else if (statusFilter === 'archived') {
        statusIn = ['archived'];
      } else {
        statusIn = statusFilter;
      }

      return buildPendingDocumentsQuery(firestore, organizationId, { statusIn });
    },
    [firestore, organizationId, isPendingDocsEnabled, statusFilter]
  );

  // Subscriure a la col·lecció (filtrada per tab actiu)
  const { data: pendingDocs, isLoading, error } = useCollection<PendingDocument>(pendingDocsQuery);

  // Query extra per comptar tots els docs (sense filtre de status)
  const allDocsQuery = useMemoFirebase(
    () => {
      if (!organizationId || !firestore || !isPendingDocsEnabled) return null;
      return buildPendingDocumentsQuery(firestore, organizationId);
    },
    [firestore, organizationId, isPendingDocsEnabled]
  );
  const { data: allDocs } = useCollection<PendingDocument>(allDocsQuery);

  // Recomptes per tab (derivats d'allDocs, mateixa lògica que les constants de filtre)
  const tabCounts = React.useMemo(() => {
    if (!allDocs) return { drafts: 0, pending: 0, matched: 0, archived: 0 };
    return {
      drafts: allDocs.filter(d => DRAFTS_FILTER.includes(d.status)).length,
      pending: allDocs.filter(d => PENDING_FILTER.includes(d.status)).length,
      matched: allDocs.filter(d => d.status === 'matched').length,
      archived: allDocs.filter(d => d.status === 'archived').length,
    };
  }, [allDocs]);

  // Carregar contactes
  const contactsQuery = useMemoFirebase(
    () => organizationId && firestore
      ? collection(firestore, 'organizations', organizationId, 'contacts')
      : null,
    [firestore, organizationId]
  );
  const { data: contacts } = useCollection<Contact>(contactsQuery);

  // Carregar categories
  const categoriesQuery = useMemoFirebase(
    () => organizationId && firestore
      ? collection(firestore, 'organizations', organizationId, 'categories')
      : null,
    [firestore, organizationId]
  );
  const { data: categories } = useCollection<Category>(categoriesQuery);

  // Carregar transaccions (per conciliació)
  const transactionsQuery = useMemoFirebase(
    () => organizationId && firestore
      ? collection(firestore, 'organizations', organizationId, 'transactions')
      : null,
    [firestore, organizationId]
  );
  const { data: transactions } = useCollection<Transaction>(transactionsQuery);

  const sortedPendingDocs = React.useMemo(() => {
    if (!pendingDocs) return [];

    const toMillis = (value: unknown) => {
      if (!value) return 0;
      if (typeof value === 'object' && value !== null) {
        if ('toMillis' in value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
          return (value as { toMillis: () => number }).toMillis();
        }
        if ('seconds' in value && typeof (value as { seconds?: unknown }).seconds === 'number') {
          return Number((value as { seconds: number }).seconds) * 1000;
        }
      }
      return 0;
    };

    return [...pendingDocs].sort((left, right) => toMillis(right.createdAt) - toMillis(left.createdAt));
  }, [pendingDocs]);

  React.useEffect(() => {
    if (organization && !isPendingDocsEnabled) {
      router.replace('../movimientos');
    }
  }, [organization, isPendingDocsEnabled, router]);

  // Handler per actualitzar un camp
  const handleFieldUpdate = React.useCallback(async (
    docId: string,
    field: string,
    value: string | number | null
  ) => {
    if (!canOperate || !firestore || !organizationId) return;

    try {
      await updatePendingDocument(firestore, organizationId, docId, {
        [field]: value,
        fieldSources: { [field]: 'manual' },
      });
    } catch (error) {
      console.error('Error updating field:', error);
      toast({
        variant: 'destructive',
        title: t.pendingDocs.toasts.error,
        description: t.pendingDocs.toasts.errorConfirm,
      });
    }
  }, [canOperate, firestore, organizationId, toast]);

  // Handler per confirmar un document
  const handleConfirm = React.useCallback(async (doc: PendingDocument) => {
    if (!canOperate || !firestore || !organizationId) return;

    setConfirmingDocId(doc.id);
    try {
      await confirmPendingDocument(firestore, organizationId, doc);
      toast({
        title: t.pendingDocs.toasts.confirmed,
        description: `${doc.invoiceNumber || doc.file.filename}`,
      });
    } catch (error) {
      console.error('Error confirming document:', error);
      toast({
        variant: 'destructive',
        title: t.pendingDocs.toasts.error,
        description: error instanceof Error ? error.message : t.pendingDocs.toasts.errorConfirm,
      });
    } finally {
      setConfirmingDocId(null);
    }
  }, [canOperate, firestore, organizationId, toast]);

  // Handler per confirmar tots els documents vàlids
  const handleBulkConfirm = React.useCallback(async () => {
    if (!canOperate || !firestore || !organizationId || !pendingDocs) return;

    const drafts = pendingDocs.filter(d => d.status === 'draft');
    if (drafts.length === 0) return;

    setIsBulkConfirming(true);
    try {
      const result = await confirmManyPendingDocuments(firestore, organizationId, drafts);

      if (result.confirmedCount > 0) {
        toast({
          title: t.pendingDocs.toasts.confirmedMultiple({ count: result.confirmedCount }),
          description: result.skippedCount > 0
            ? `${result.skippedCount} ${t.pendingDocs.statuses.incomplete.toLowerCase()}`
            : undefined,
        });
      } else {
        toast({
          variant: 'destructive',
          title: t.pendingDocs.toasts.error,
          description: t.pendingDocs.toasts.errorConfirm,
        });
      }
    } catch (error) {
      console.error('Error bulk confirming:', error);
      toast({
        variant: 'destructive',
        title: t.pendingDocs.toasts.error,
        description: t.pendingDocs.toasts.errorConfirm,
      });
    } finally {
      setIsBulkConfirming(false);
    }
  }, [canOperate, firestore, organizationId, pendingDocs, toast]);

  // Handler per arxivar un document
  const handleArchive = React.useCallback(async (doc: PendingDocument) => {
    if (!canOperate || !firestore || !organizationId) return;

    setArchivingDocId(doc.id);
    try {
      await archivePendingDocument(firestore, organizationId, doc);
      toast({
        title: t.pendingDocs.toasts.archived,
        description: `${doc.invoiceNumber || doc.file.filename}`,
      });
    } catch (error) {
      console.error('Error archiving document:', error);
      toast({
        variant: 'destructive',
        title: t.pendingDocs.toasts.error,
        description: error instanceof Error ? error.message : t.pendingDocs.toasts.errorArchive,
      });
    } finally {
      setArchivingDocId(null);
    }
  }, [canOperate, firestore, organizationId, toast]);

  // Handler per restaurar un document arxivat
  const handleRestore = React.useCallback(async (doc: PendingDocument) => {
    if (!canOperate || !firestore || !organizationId) return;

    setArchivingDocId(doc.id);
    try {
      await restorePendingDocument(firestore, organizationId, doc);
      toast({
        title: t.pendingDocs.toasts.restored,
        description: `${doc.invoiceNumber || doc.file.filename}`,
      });
    } catch (error) {
      console.error('Error restoring document:', error);
      toast({
        variant: 'destructive',
        title: t.pendingDocs.toasts.error,
        description: error instanceof Error ? error.message : t.pendingDocs.toasts.errorRestore,
      });
    } finally {
      setArchivingDocId(null);
    }
  }, [canOperate, firestore, organizationId, toast]);

  // Handler per eliminar un document
  const handleDelete = React.useCallback(async (doc: PendingDocument) => {
    if (!canOperate || !firestore || !storage || !organizationId) return;

    setDeletingDocId(doc.id);
    try {
      const result = await deletePendingDocument(firestore, storage, organizationId, doc.id);

      // Tancar expansió si estava obert
      if (expandedDocId === doc.id) {
        setExpandedDocId(null);
      }

      toast({
        title: t.pendingDocs.toasts.deleted,
        description: `${doc.invoiceNumber || doc.file.filename}`,
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        variant: 'destructive',
        title: t.pendingDocs.toasts.error,
        description: error instanceof Error ? error.message : t.pendingDocs.toasts.errorDelete,
      });
    } finally {
      setDeletingDocId(null);
    }
  }, [canOperate, firestore, storage, organizationId, toast, expandedDocId]);

  // Handler per eliminar un document matched (desfer conciliació)
  const handleDeleteMatched = React.useCallback(async (doc: PendingDocument) => {
    if (!canOperate || !firestore || !storage || !organizationId) return;

    if (doc.status !== 'matched') {
      toast({
        variant: 'destructive',
        title: t.pendingDocs.toasts.error,
        description: tr('pendingDocs.toasts.notMatched', 'Aquest document no està conciliat'),
      });
      return;
    }

    setDeletingMatchedDocId(doc.id);
    try {
      await deleteMatchedPendingDocument(firestore, storage, organizationId, doc.id);

      // Tancar expansió si estava obert
      if (expandedDocId === doc.id) {
        setExpandedDocId(null);
      }

      toast({
        title: t.pendingDocs.toasts.matchedDeleted || 'Conciliació desfeta',
        description: t.pendingDocs.toasts.matchedDeletedDesc || 'El moviment bancari torna a estar lliure per conciliar.',
      });
    } catch (error) {
      console.error('Error deleting matched document:', error);
      toast({
        variant: 'destructive',
        title: t.pendingDocs.toasts.error,
        description: error instanceof Error ? error.message : t.pendingDocs.toasts.errorDelete,
      });
    } finally {
      setDeletingMatchedDocId(null);
    }
  }, [canOperate, firestore, storage, organizationId, toast, expandedDocId, t]);

  // Handler per re-vincular document a transacció
  const handleRelinkDocument = React.useCallback(async (doc: PendingDocument) => {
    if (!canOperate || !organizationId) return;

    setRelinkingDocId(doc.id);
    try {
      // Obtenir token d'autenticació
      const { getAuth } = await import('firebase/auth');
      const authInstance = getAuth();
      const user = authInstance.currentUser;
      if (!user) {
        throw new Error('No autenticat');
      }
      const idToken = await user.getIdToken();

      const response = await fetch('/api/pending-documents/relink-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          orgId: organizationId,
          pendingId: doc.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error re-vinculant document');
      }

      toast({
        title: t.pendingDocs.toasts.relinked || 'Document re-vinculat',
        description: doc.file.filename,
      });
    } catch (error) {
      console.error('Error relinking document:', error);
      toast({
        variant: 'destructive',
        title: t.pendingDocs.toasts.error,
        description: error instanceof Error ? error.message : 'Error re-vinculant document',
      });
    } finally {
      setRelinkingDocId(null);
    }
  }, [canOperate, organizationId, toast, t]);

  // Handler per renombrar un document (cosmètic, Firestore only)
  const handleRename = React.useCallback(async (docId: string, newFilename: string) => {
    if (!canOperate || !firestore || !organizationId) return;

    try {
      await renamePendingDocument(firestore, organizationId, docId, newFilename);
      toast({
        title: t.pendingDocs.rename.success,
      });
    } catch (error) {
      console.error('Error renaming document:', error);
      toast({
        variant: 'destructive',
        title: t.pendingDocs.toasts.error,
        description: error instanceof Error ? error.message : t.pendingDocs.toasts.errorUnknown,
      });
    }
  }, [canOperate, firestore, organizationId, toast]);

  // Helper per determinar si un filtre està actiu
  const isFilterActive = (filter: typeof statusFilter) => {
    if (Array.isArray(filter) && Array.isArray(statusFilter)) {
      return JSON.stringify(filter) === JSON.stringify(statusFilter);
    }
    return filter === statusFilter;
  };

  // Reset complet de l'estat d'upload/drag (funció normal, no useCallback)
  const resetUploadUI = () => {
    setIsUploadModalOpen(false);
    setInitialUploadFiles(undefined);
    setIsDraggingOver(false);
    dragCounter.current = 0;
    setRefreshKey((k) => k + 1);
  };

  // Callback quan es completa l'upload
  const handleUploadComplete = (count: number) => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
    setStatusFilter(DRAFTS_FILTER);
    resetUploadUI();
  };

  // Handlers de drag & drop extern (zona de la pàgina)
  // Usem dragCounter ref per evitar falsos dragLeave de fills interns
  const handlePageDragEnter = React.useCallback((e: React.DragEvent) => {
    if (!canOperate) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true);
    }
  }, [canOperate]);

  const handlePageDragOver = React.useCallback((e: React.DragEvent) => {
    if (!canOperate) return;
    e.preventDefault();
    e.stopPropagation();
  }, [canOperate]);

  const handlePageDragLeave = React.useCallback((e: React.DragEvent) => {
    if (!canOperate) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingOver(false);
    }
  }, [canOperate]);

  const handlePageDrop = React.useCallback((e: React.DragEvent) => {
    if (!canOperate) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingOver(false);

    if (e.dataTransfer.files.length > 0) {
      // Filtrar només fitxers vàlids abans d'obrir el modal
      const allFiles = Array.from(e.dataTransfer.files);
      const validFiles = allFiles.filter(f => {
        const ext = f.name.toLowerCase().split('.').pop();
        return ['pdf', 'xml', 'jpg', 'jpeg', 'png'].includes(ext || '');
      });

      if (validFiles.length === 0) {
        // Cap fitxer vàlid → mostrar toast i no obrir modal
        toast({
          variant: 'destructive',
          title: t.pendingDocs.upload.invalidFiles,
          description: t.pendingDocs.upload.invalidFilesDesc,
        });
        return;
      }

      setInitialUploadFiles(validFiles);
      setIsUploadModalOpen(true);
    }
  }, [canOperate, toast, t]);

  // Aplicar filtres client-side
  const filteredDocs = React.useMemo(() => {
    return filterPendingDocuments(sortedPendingDocs, filters, contacts || []);
  }, [sortedPendingDocs, filters, contacts]);

  // Drafts per bulk confirm (derivats d'allDocs per disponibilitat cross-tab)
  const readyDrafts = React.useMemo(
    () => (allDocs || []).filter(d => d.status === 'draft').filter(isDocumentReadyToConfirm),
    [allDocs]
  );

  // Documents seleccionables: només confirmed (per generar SEPA)
  const selectableDocs = React.useMemo(() => {
    if (!canOperate) return [];
    return filteredDocs.filter(d => d.status === 'confirmed');
  }, [canOperate, filteredDocs]);

  // Handlers de selecció
  const handleSelectDoc = React.useCallback((docId: string, selected: boolean) => {
    if (!canOperate) return;
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(docId);
      } else {
        next.delete(docId);
      }
      return next;
    });
  }, [canOperate]);

  const handleSelectAll = React.useCallback((selected: boolean) => {
    if (!canOperate) return;
    if (selected) {
      setSelectedDocIds(new Set(selectableDocs.map(d => d.id)));
    } else {
      setSelectedDocIds(new Set());
    }
  }, [canOperate, selectableDocs]);

  // Documents seleccionats
  const selectedDocs = React.useMemo(() => {
    if (!canOperate) return [];
    return filteredDocs.filter(d => selectedDocIds.has(d.id));
  }, [canOperate, filteredDocs, selectedDocIds]);

  // Netejar selecció quan canvia el filtre
  React.useEffect(() => {
    setSelectedDocIds(new Set());
  }, [statusFilter]);

  // Handler per quan es completa la generació SEPA
  const handleSepaComplete = React.useCallback(() => {
    setSelectedDocIds(new Set());
    // Refrescar la llista (la subscripció ho farà automàticament)
  }, []);

  // Handler per obrir el modal de conciliació
  const handleReconcile = React.useCallback((doc: PendingDocument) => {
    if (!canOperate) return;
    // Buscar la primera transacció suggerida
    const suggestedId = doc.suggestedTransactionIds?.[0];
    if (!suggestedId || !transactions) {
      toast({
        variant: 'destructive',
        title: t.pendingDocs.toasts.error,
        description: t.pendingDocs.toasts.errorLink,
      });
      return;
    }

    const tx = transactions.find(t => t.id === suggestedId);
    if (!tx) {
      toast({
        variant: 'destructive',
        title: t.pendingDocs.toasts.error,
        description: t.pendingDocs.toasts.errorLink,
      });
      return;
    }

    setReconcileDoc(doc);
    setReconcileTx(tx);
  }, [canOperate, transactions, toast]);

  // Handler quan es completa la conciliació
  const handleReconcileComplete = React.useCallback(() => {
    setReconcileDoc(null);
    setReconcileTx(null);
    // La subscripció refrescarà automàticament
  }, []);

  // Si encara no tenim l'organització o el flag no està actiu, mostrar loading
  if (!organization || !isPendingDocsEnabled) {
    return (
      <div className="w-full flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Path per navegar a moviments (per link a transacció conciliada)
  const movimentsPath = `../movimientos`;

  return (
    <TooltipProvider>
      <div
        ref={topRef}
        className="w-full flex flex-col gap-6 relative pb-24 md:pb-0"
        onDragEnter={handlePageDragEnter}
        onDragOver={handlePageDragOver}
        onDragLeave={handlePageDragLeave}
        onDrop={handlePageDrop}
        onDragEnd={() => { setIsDraggingOver(false); dragCounter.current = 0; }}
      >
        {/* Overlay de drag & drop */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 bg-primary/5 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
            <div className="bg-background/95 backdrop-blur-sm rounded-lg px-6 py-4 shadow-lg border">
              <div className="flex items-center gap-3 text-primary">
                <Upload className="h-8 w-8" />
                <span className="text-lg font-medium">
                  {t.pendingDocs.upload.dropHere}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="../movimientos">
                <ArrowLeft className="h-4 w-4 mr-1" />
                {t.movements.title}
              </Link>
            </Button>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight font-headline">
                  {t.pendingDocs.title}
                </h1>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  Experimental
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {t.pendingDocs.subtitle}
              </p>
            </div>
            {canOperate && (
              <div className="flex items-center gap-2">
                {isMobile ? (
                  <>
                    {/* CTA principal en mòbil */}
                    <Button onClick={() => setIsUploadModalOpen(true)} className={MOBILE_CTA_PRIMARY}>
                      <Upload className="mr-2 h-4 w-4" />
                      {t.pendingDocs.actions.upload}
                    </Button>
                    {/* Accions secundàries a overflow menu */}
                    {(selectedDocs.length > 0 || (isFilterActive(DRAFTS_FILTER) && readyDrafts.length > 0)) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {selectedDocs.length > 0 && (
                            <DropdownMenuItem onClick={() => setIsSepaModalOpen(true)}>
                              <CreditCard className="mr-2 h-4 w-4" />
                              {t.pendingDocs.actions.generateSepa} ({selectedDocs.length})
                            </DropdownMenuItem>
                          )}
                          {isFilterActive(DRAFTS_FILTER) && readyDrafts.length > 0 && selectedDocs.length === 0 && (
                            <DropdownMenuItem onClick={handleBulkConfirm} disabled={isBulkConfirming}>
                              {isBulkConfirming ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCheck className="mr-2 h-4 w-4" />
                              )}
                              {t.pendingDocs.actions.confirmAll} ({readyDrafts.length})
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </>
                ) : (
                  <>
                    {/* Botó SEPA quan hi ha selecció */}
                    {selectedDocs.length > 0 && (
                      <Button
                        onClick={() => setIsSepaModalOpen(true)}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <CreditCard className="mr-2 h-4 w-4" />
                        {t.pendingDocs.actions.generateSepa} ({selectedDocs.length})
                      </Button>
                    )}
                    {/* Botó "Confirmar totes" només a la pestanya "Per revisar" */}
                    {isFilterActive(DRAFTS_FILTER) && readyDrafts.length > 0 && selectedDocs.length === 0 && (
                      <Button
                        variant="outline"
                        onClick={handleBulkConfirm}
                        disabled={isBulkConfirming}
                      >
                        {isBulkConfirming ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCheck className="mr-2 h-4 w-4" />
                        )}
                        {t.pendingDocs.actions.confirmAll} ({readyDrafts.length})
                      </Button>
                    )}
                    <Button onClick={() => setIsUploadModalOpen(true)}>
                      <Upload className="mr-2 h-4 w-4" />
                      {t.pendingDocs.actions.upload}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Banner informatiu segons la pestanya activa */}
        {isFilterActive(DRAFTS_FILTER) && (
          <Alert className="border-orange-200 bg-orange-50">
            <Info className="h-4 w-4 text-orange-600" />
            <AlertTitle className="text-orange-800">
              {t.pendingDocs.banners.prebank}
            </AlertTitle>
            <AlertDescription className="text-orange-700">
              <span>
                {t.pendingDocs.banners.reviewInfo}
              </span>
            </AlertDescription>
          </Alert>
        )}

        {isFilterActive(PENDING_FILTER) && (
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">
              {t.pendingDocs.banners.prebank}
            </AlertTitle>
            <AlertDescription className="text-blue-700">
              <span>
                {t.pendingDocs.banners.bankPendingInfo}
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Tabs de filtre (exclusius) */}
        {isMobile ? (
          <Select
            value={
              isFilterActive(DRAFTS_FILTER) ? 'drafts' :
              isFilterActive(PENDING_FILTER) ? 'pending' :
              isFilterActive('matched') ? 'matched' : 'archived'
            }
            onValueChange={(value) => {
              switch (value) {
                case 'drafts': setStatusFilter(DRAFTS_FILTER); break;
                case 'pending': setStatusFilter(PENDING_FILTER); break;
                case 'matched': setStatusFilter('matched'); break;
                case 'archived': setStatusFilter('archived'); break;
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="drafts">
                {t.pendingDocs.tabs.review}
                {tabCounts.drafts > 0 && ` (${tabCounts.drafts})`}
              </SelectItem>
              <SelectItem value="pending">
                {t.pendingDocs.tabs.bankPending}
                {tabCounts.pending > 0 && ` (${tabCounts.pending})`}
              </SelectItem>
              <SelectItem value="matched">
                {t.pendingDocs.tabs.reconciled}
                {tabCounts.matched > 0 && ` (${tabCounts.matched})`}
              </SelectItem>
              <SelectItem value="archived">
                {t.pendingDocs.tabs.archived}
                {tabCounts.archived > 0 && ` (${tabCounts.archived})`}
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center gap-2 border-b pb-2">
            <Button
              variant={isFilterActive(DRAFTS_FILTER) ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter(DRAFTS_FILTER)}
            >
              {t.pendingDocs.tabs.review}
              {tabCounts.drafts > 0 && (
                <Badge variant="outline" className="ml-2">{tabCounts.drafts}</Badge>
              )}
            </Button>
            <Button
              variant={isFilterActive(PENDING_FILTER) ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter(PENDING_FILTER)}
            >
              {t.pendingDocs.tabs.bankPending}
              {tabCounts.pending > 0 && (
                <Badge variant="outline" className="ml-2">{tabCounts.pending}</Badge>
              )}
            </Button>
            <Button
              variant={isFilterActive('matched') ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('matched')}
            >
              {t.pendingDocs.tabs.reconciled}
              {tabCounts.matched > 0 && (
                <Badge variant="outline" className="ml-2">{tabCounts.matched}</Badge>
              )}
            </Button>
            <Button
              variant={isFilterActive('archived') ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('archived')}
            >
              {t.pendingDocs.tabs.archived}
              {tabCounts.archived > 0 && (
                <Badge variant="outline" className="ml-2">{tabCounts.archived}</Badge>
              )}
            </Button>
          </div>
        )}

        {/* Panell de filtres */}
        <PendingDocumentsFilterPanel
          filters={filters}
          onFiltersChange={setFilters}
          contacts={contacts || []}
          categories={categories || []}
        />

        {/* Llista de documents */}
        <Card>
          <CardContent key={refreshKey} className="p-0 overflow-hidden">
            {isLoading ? (
              // Skeleton loading
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : error ? (
              // Error state
              <div className="p-8 text-center">
                <p className="text-destructive">{t.pendingDocs.toasts.error}: {error.message}</p>
              </div>
            ) : filteredDocs.length === 0 ? (
              // Empty state
              <EmptyState
                icon={FileStack}
                title={pendingDocs && pendingDocs.length > 0 ? t.pendingDocs.empty.review : t.pendingDocs.empty.bankPending}
                description={pendingDocs && pendingDocs.length > 0
                  ? t.pendingDocs.empty.reviewDesc
                  : t.pendingDocs.empty.bankPendingDesc
                }
                className="py-16"
              />
            ) : isFilterActive(DRAFTS_FILTER) ? (
              // Vista compacta + expandible per drafts (responsive)
              <div className="divide-y">
                {filteredDocs.map((doc) => (
                  <PendingDocumentCard
                    key={doc.id}
                    doc={doc}
                    contacts={contacts || []}
                    categories={categories || []}
                    canOperate={canOperate}
                    onUpdate={handleFieldUpdate}
                    onConfirm={handleConfirm}
                    onArchive={handleArchive}
                    onDelete={handleDelete}
                    onRename={handleRename}
                    isConfirming={confirmingDocId === doc.id}
                    isArchiving={archivingDocId === doc.id}
                    isDeleting={deletingDocId === doc.id}
                    isExpanded={expandedDocId === doc.id}
                    onToggleExpand={() => setExpandedDocId(expandedDocId === doc.id ? null : doc.id)}
                  />
                ))}
              </div>
            ) : (
              // Vista per altres pestanyes: taula a lg+, llista compacta a < lg
              <>
                {/* Taula desktop (lg+) */}
                <div className="hidden lg:block">
                  <Table className="w-full table-fixed">
                    <TableHeader>
                      <TableRow>
                        {/* Checkbox per selecció múltiple */}
                        {canOperate && selectableDocs.length > 0 && (
                          <TableHead className="w-[40px] pr-0">
                            <Checkbox
                              checked={selectedDocIds.size > 0 && selectedDocIds.size === selectableDocs.length}
                              onCheckedChange={(checked) => handleSelectAll(!!checked)}
                              aria-label={t.pendingDocs.selection.selectAll}
                            />
                          </TableHead>
                        )}
                        <TableHead>{t.pendingDocs.fields.filename}</TableHead>
                        <TableHead className="text-right">{t.pendingDocs.fields.amount}</TableHead>
                        <TableHead>{t.pendingDocs.fields.invoiceDate}</TableHead>
                        <TableHead>{t.pendingDocs.fields.type}</TableHead>
                        <TableHead>{t.pendingDocs.fields.invoiceNumber}</TableHead>
                        <TableHead>{t.pendingDocs.fields.supplier}</TableHead>
                        <TableHead>{t.pendingDocs.fields.category}</TableHead>
                        <TableHead>{t.pendingDocs.statuses.draft}</TableHead>
                        <TableHead className="w-[70px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDocs.map((doc) => (
                        <PendingDocumentRow
                          key={doc.id}
                          doc={doc}
                          contacts={contacts || []}
                          categories={categories || []}
                          canOperate={canOperate}
                          onUpdate={handleFieldUpdate}
                          onConfirm={handleConfirm}
                          onArchive={handleArchive}
                          onRestore={handleRestore}
                          onReconcile={handleReconcile}
                          onRelinkDocument={handleRelinkDocument}
                          onDeleteMatched={handleDeleteMatched}
                          isConfirming={confirmingDocId === doc.id}
                          isArchiving={archivingDocId === doc.id}
                          isRelinking={relinkingDocId === doc.id}
                          isDeletingMatched={deletingMatchedDocId === doc.id}
                          movimentsPath={movimentsPath}
                          isSelectable={canOperate && doc.status === 'confirmed'}
                          isSelected={selectedDocIds.has(doc.id)}
                          onSelect={handleSelectDoc}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Llista mòbil (< lg) */}
                <div className="lg:hidden divide-y">
                  {filteredDocs.map((doc) => {
                    const supplierName = doc.supplierId
                      ? contacts?.find(c => c.id === doc.supplierId)?.name
                      : null;
                    const isSelectable = canOperate && doc.status === 'confirmed';
                    const isSelected = selectedDocIds.has(doc.id);
                    const canReconcile = doc.status === 'confirmed' && doc.suggestedTransactionIds && doc.suggestedTransactionIds.length > 0;
                    return (
                      <div key={doc.id} className="p-3 flex items-center gap-3">
                        {/* Checkbox per selecció (només confirmed) */}
                        {isSelectable && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectDoc(doc.id, !!checked)}
                            aria-label={t.pendingDocs.selection.selectAll}
                            className="shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium truncate">{doc.file.filename}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {supplierName && <span>{supplierName} · </span>}
                            {doc.invoiceDate && <span>{doc.invoiceDate}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-medium tabular-nums">
                            {doc.amount !== null ? `${doc.amount.toFixed(2)} €` : '—'}
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] mt-1',
                              doc.status === 'confirmed' && 'bg-blue-50 text-blue-700 border-blue-200',
                              doc.status === 'sepa_generated' && 'bg-purple-50 text-purple-700 border-purple-200',
                              doc.status === 'matched' && 'bg-green-50 text-green-700 border-green-200',
                              doc.status === 'archived' && 'bg-amber-50 text-amber-700 border-amber-200'
                            )}
                          >
                            {t.pendingDocs.statuses[doc.status === 'sepa_generated' ? 'sepaGenerated' : doc.status] || doc.status}
                          </Badge>
                        </div>
                        {/* Menú d'accions */}
                        {canOperate && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {/* Conciliar (només si té suggeriments) */}
                              {canReconcile && (
                                <DropdownMenuItem onClick={() => handleReconcile(doc)}>
                                  {t.pendingDocs.actions.reconcile}
                                </DropdownMenuItem>
                              )}
                              {/* Veure transacció (només matched) */}
                              {doc.status === 'matched' && doc.matchedTransactionId && (
                                <DropdownMenuItem asChild>
                                  <Link href={`${movimentsPath}?txId=${doc.matchedTransactionId}`}>
                                    {t.pendingDocs.actions.viewTransaction}
                                  </Link>
                                </DropdownMenuItem>
                              )}
                              {/* Arxivar (no arxivats) */}
                              {doc.status !== 'archived' && doc.status !== 'matched' && (
                                <DropdownMenuItem
                                  onClick={() => handleArchive(doc)}
                                  disabled={archivingDocId === doc.id}
                                >
                                  {t.pendingDocs.actions.archive}
                                </DropdownMenuItem>
                              )}
                              {/* Restaurar (només arxivats) */}
                              {doc.status === 'archived' && (
                                <DropdownMenuItem
                                  onClick={() => handleRestore(doc)}
                                  disabled={archivingDocId === doc.id}
                                >
                                  {t.pendingDocs.actions.restore}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Nota de peu */}
        <p className="text-xs text-muted-foreground text-center">
          {t.pendingDocs.banners.prebankDescription}
        </p>

        {/* Modal d'upload */}
        <PendingDocumentsUploadModal
          open={isUploadModalOpen}
          onOpenChange={(open) => {
            if (open) {
              setIsUploadModalOpen(true);
              return;
            }
            resetUploadUI();
          }}
          onUploadComplete={handleUploadComplete}
          contacts={contacts || []}
          initialFiles={initialUploadFiles}
        />

        {/* Modal SEPA */}
        <SepaGenerationModal
          open={isSepaModalOpen}
          onOpenChange={setIsSepaModalOpen}
          selectedDocuments={selectedDocs}
          contacts={contacts || []}
          onComplete={handleSepaComplete}
        />

        {/* Modal de conciliació */}
        <ReconciliationModal
          open={!!reconcileDoc}
          onOpenChange={(open) => {
            if (!open) {
              setReconcileDoc(null);
              setReconcileTx(null);
            }
          }}
          pendingDoc={reconcileDoc}
          transaction={reconcileTx}
          contacts={contacts || []}
          categories={categories || []}
          onComplete={handleReconcileComplete}
        />
      </div>
    </TooltipProvider>
  );
}
