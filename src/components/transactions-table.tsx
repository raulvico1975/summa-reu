'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DonorSearchCombobox } from '@/components/donor-search-combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Check,
  Undo2,
  Download,
  Plus,
  X,
  Trash2,
} from 'lucide-react';
import type { Transaction, Category, Project, AnyContact, Donor, Supplier, Employee, ContactType } from '@/lib/data';
import { SUPER_ADMIN_UID } from '@/lib/data';
import { formatCurrencyEU } from '@/lib/normalize';
import { trackUX } from '@/lib/ux/trackUX';
import { useToast } from '@/hooks/use-toast';
import { RemittanceDetailModal } from '@/components/remittance-detail-modal';
import { StripeImputationModal } from '@/components/stripe/StripeImputationModal';
import { SplitAmountDialog } from '@/components/transactions/split-amount-dialog';
import { SplitDetailDialog } from '@/components/transactions/split-detail-dialog';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch, query, orderBy, where, getDocs, deleteDoc, deleteField, updateDoc, type UpdateData } from 'firebase/firestore';
import { Checkbox } from '@/components/ui/checkbox';
import { Tag, XCircle, Search, FileX, Undo } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslations } from '@/i18n';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { useReturnManagement } from '@/components/transactions/hooks/useReturnManagement';
import { useTransactionCategorization } from '@/components/transactions/hooks/useTransactionCategorization';
import { useTransactionActions } from '@/components/transactions/hooks/useTransactionActions';
import { EditTransactionDialog } from '@/components/transactions/EditTransactionDialog';
import { NewContactDialog } from '@/components/transactions/NewContactDialog';
import { TransactionRow } from '@/components/transactions/components/TransactionRow';
import { TransactionRowMobile } from '@/components/transactions/components/TransactionRowMobile';
import { TransactionsFilters, TableFilter } from '@/components/transactions/components/TransactionsFilters';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { buildDocumentFilename } from '@/lib/build-document-filename';
import { DateFilter, type DateFilterValue } from '@/components/date-filter';
import { useTransactionFilters } from '@/hooks/use-transaction-filters';
import { useBankAccounts } from '@/hooks/use-bank-accounts';
import { TRANSACTION_URL_FILTERS, type TransactionUrlFilter, type SourceFilter, findSystemCategoryId, isCategoryIdCompatibleStrict } from '@/lib/constants';
import { toPeriodQuery } from '@/lib/period-query';
import { SepaReconcileModal } from '@/components/pending-documents/sepa-reconcile-modal';
import { filterValidSelectItems } from '@/lib/ui/safe-select-options';
import type { PrebankRemittance } from '@/lib/pending-documents/sepa-remittance';
import { prebankRemittancesCollection } from '@/lib/pending-documents/sepa-remittance';
import { pendingDocumentsCollection } from '@/lib/pending-documents/refs';
import { filterActiveContacts } from '@/lib/contacts/filterActiveContacts';
import { UndoProcessingDialog } from '@/components/undo-processing-dialog';
import { ReturnEmailDraftDialog } from '@/components/returns/ReturnEmailDraftDialog';
import { buildReturnEmailDraft } from '@/lib/returns/build-return-email-draft';
import {
  detectUndoOperationType,
  countChildTransactions,
  executeUndo,
  type UndoOperationType,
} from '@/lib/fiscal/undoProcessing';
import { detectLegacyCategoryTransactions, logLegacyCategorySummary } from '@/lib/category-health';
import { sortTransactionsForTable } from '@/lib/transactions/sort-transactions-for-table';
import { isVisibleInMovementsLedger } from '@/lib/transactions/remittance-visibility';
import {
  getDeleteTransactionBlockedReason,
  type DeleteTransactionBlockedReason,
} from '@/lib/transactions/can-delete-transaction';
import { filterSplitChildTransactions } from '@/lib/splits/split-visibility';
import { undoSplit } from '@/lib/splits/undoSplit';
import { handleTransactionDelete, isFiscallyRelevantTransaction } from '@/lib/fiscal/softDeleteTransaction';
import { isS9PendingFiscalTransaction } from '@/lib/fiscal/sentinels/s9-fiscal-coherence';
import {
  applyTransactionPatch,
  buildCategoryInlineUpdate,
  buildContactInlineUpdate,
  matchesInlineReactiveFilter,
} from '@/lib/transactions/inline-update-state';

interface TransactionsTableProps {
  initialDateFilter?: DateFilterValue | null;
  initialFiscalFilter?: 'pending' | null;
  canEditMovements?: boolean;
}

type TransactionsPageResponse = {
  success: boolean;
  transactions?: Transaction[];
  nextCursor?: string | null;
  total?: number;
  limit?: number;
};

const RemittanceSplitter = dynamic(
  () => import('@/components/remittance-splitter').then((mod) => mod.RemittanceSplitter),
  { ssr: false },
);

const ReturnImporter = dynamic(
  () => import('@/components/return-importer').then((mod) => mod.ReturnImporter),
  { ssr: false },
);

export function TransactionsTable({
  initialDateFilter = null,
  initialFiscalFilter = null,
  canEditMovements = true
}: TransactionsTableProps = {}) {
  const { firestore, user, storage } = useFirebase();
  const { organizationId, organization } = useCurrentOrganization();
  const { t, language, tr } = useTranslations();
  const { toast } = useToast();
  const locale = language === 'es' ? 'es-ES' : 'ca-ES';
  const isMobile = useIsMobile();
  const getDisplayDate = React.useCallback((tx: Transaction): string => {
    if (tx.operationDate) {
      return tx.operationDate;
    }
    return (tx.date ?? '').slice(0, 10);
  }, []);

  // SuperAdmin detection per bulk mode
  const isSuperAdmin = user?.uid === SUPER_ADMIN_UID;
  const [isBulkMode, setIsBulkMode] = React.useState(false);
  const [pagedTransactions, setPagedTransactions] = React.useState<Transaction[] | null>(null);
  const [isLoadingTransactions, setIsLoadingTransactions] = React.useState(false);
  const [isLoadingMoreTransactions, setIsLoadingMoreTransactions] = React.useState(false);
  const [transactionsNextCursor, setTransactionsNextCursor] = React.useState<string | null>(null);
  const [hasMoreTransactions, setHasMoreTransactions] = React.useState(false);
  const [transactionsTotal, setTransactionsTotal] = React.useState<number | null>(null);
  const [autoLoadBlockedByError, setAutoLoadBlockedByError] = React.useState(false);
  const latestPageRequestIdRef = React.useRef(0);
  const [inlineUpdatePendingByTxId, setInlineUpdatePendingByTxId] = React.useState<Record<string, 'contact' | 'category'>>({});
  const INLINE_UPDATE_TIMEOUT_MS = 8000;
  // Memoitzar categoryTranslations per evitar re-renders innecessaris
  const categoryTranslations = React.useMemo(
    () => t.categories as Record<string, string>,
    [t.categories]
  );

  // Filtre actiu
  const [tableFilter, setTableFilter] = React.useState<TableFilter>('all');

  // Filtre de dates
  const [dateFilter, setDateFilter] = React.useState<DateFilterValue>(initialDateFilter || { type: 'all' });
  const periodQuery = React.useMemo(() => toPeriodQuery(dateFilter), [dateFilter]);

  // Cercador intel·ligent
  const [searchQuery, setSearchQuery] = React.useState('');
  const deferredSearchQuery = React.useDeferredValue(searchQuery);

  // Filtre per contactId (des d'enllaç de donant)
  const [contactIdFilter, setContactIdFilter] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const filter = params.get('filter');
      const contactId = params.get('contactId');
      const fiscal = params.get('fiscal');

      if (fiscal === 'pending') {
        setTableFilter('fiscalPending');
      } else if (isTransactionUrlFilter(filter)) {
        setTableFilter(filter);
      }

      if (contactId) {
        setContactIdFilter(contactId);
      }
    }
  }, []);

  React.useEffect(() => {
    if (initialFiscalFilter !== 'pending') return;
    setTableFilter((prev) => (prev === 'fiscalPending' ? prev : 'fiscalPending'));
  }, [initialFiscalFilter]);

  React.useEffect(() => {
    if (!initialDateFilter) return;
    setDateFilter(prev => (areDateFiltersEqual(prev, initialDateFilter) ? prev : initialDateFilter));
  }, [initialDateFilter]);

  // Carregar remeses pre-banc per detectar SEPA pendents
  React.useEffect(() => {
    async function loadPrebankRemittances() {
      if (!firestore || !organizationId) return;

      try {
        const q = query(
          prebankRemittancesCollection(firestore, organizationId),
          where('status', 'in', ['matched_to_bank', 'prebank_generated'])
        );
        const snap = await getDocs(q);

        const remittanceMap = new Map<string, PrebankRemittance>();
        snap.docs.forEach(d => {
          const data = d.data();
          const remittance = { ...data, id: d.id } as PrebankRemittance;
          // Indexar per parentTransactionId si existeix
          if (remittance.parentTransactionId) {
            remittanceMap.set(remittance.parentTransactionId, remittance);
          }
        });
        setDetectedSepaRemittances(remittanceMap);
      } catch (error) {
        console.error('Error loading prebank remittances:', error);
      }
    }

    loadPrebankRemittances();
  }, [firestore, organizationId]);

  const [sortDateAsc, setSortDateAsc] = React.useState(false); // false = més recents primer

  // Columna Projecte - sempre oculta a la taula de moviments
  // (es gestiona a través de filtres i detalls individuals)
  const showProjectColumn = false;

  // Filtre per amagar desglossament de remeses - sempre actiu (ledger mode)
  // Els ítems de remesa es gestionen dins els modals de remesa, no a la taula principal
  const hideRemittanceItems = true;

  // Filtre per source
  const [sourceFilter, setSourceFilter] = React.useState<SourceFilter>('all');

  // Filtre per compte bancari
  const [bankAccountFilter, setBankAccountFilter] = React.useState<string>('__all__');

  const serverMovementType = React.useMemo<'income' | 'expense' | null>(() => {
    if (tableFilter === 'income') return 'income';
    if (tableFilter === 'expenses') return 'expense';
    return null;
  }, [tableFilter]);

  const trimmedDeferredSearchQuery = React.useMemo(
    () => deferredSearchQuery.trim(),
    [deferredSearchQuery]
  );

  // Bank accounts
  const { bankAccounts } = useBankAccounts();

  // ═══════════════════════════════════════════════════════════════════════════
  // SELECCIÓ MÚLTIPLE (bulk actions)
  // ═══════════════════════════════════════════════════════════════════════════
  const canBulkEdit = canEditMovements;
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [isBulkCategoryDialogOpen, setIsBulkCategoryDialogOpen] = React.useState(false);
  const [bulkCategoryId, setBulkCategoryId] = React.useState<string | null>(null);
  const [isBulkUpdating, setIsBulkUpdating] = React.useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = React.useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);

  // Helpers de selecció
  const toggleOne = React.useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAllVisible = React.useCallback((visibleIds: string[]) => {
    setSelectedIds(prev => {
      const allSelected = visibleIds.every(id => prev.has(id));
      if (allSelected) {
        // Deseleccionar tots els visibles
        const next = new Set(prev);
        visibleIds.forEach(id => next.delete(id));
        return next;
      } else {
        // Seleccionar tots els visibles
        const next = new Set(prev);
        visibleIds.forEach(id => next.add(id));
        return next;
      }
    });
  }, []);

  const clearSelection = React.useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // COL·LECCIONS DE TRANSACCIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // Referència base de la col·lecció (per operacions de document)
  const transactionsCollection = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'transactions') : null,
    [firestore, organizationId]
  );
  const categoriesCollection = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'categories') : null,
    [firestore, organizationId]
  );
  const contactsCollection = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'contacts') : null,
    [firestore, organizationId]
  );
  const projectsCollection = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'projects') : null,
    [firestore, organizationId]
  );
  
  const { data: availableCategories } = useCollection<Category>(categoriesCollection);
  const { data: availableContacts } = useCollection<AnyContact>(contactsCollection);
  const { data: availableProjects } = useCollection<Project>(projectsCollection);

  const missionTransferCategoryId = React.useMemo(
    () => availableCategories ? findSystemCategoryId(availableCategories, 'missionTransfers') : null,
    [availableCategories]
  );

  // Estat per toggle SuperAdmin "incloure arxivades"
  const [showArchived, setShowArchived] = React.useState(false);
  const showArchivedInLedger = showArchived && isSuperAdmin;

  const loadTransactionsPage = React.useCallback(
    async (mode: 'reset' | 'append', cursorOverride?: string | null) => {
      if (!organizationId || !user) {
        setPagedTransactions(null);
        setTransactionsNextCursor(null);
        setHasMoreTransactions(false);
        setTransactionsTotal(null);
        setIsLoadingTransactions(false);
        setIsLoadingMoreTransactions(false);
        return;
      }

      if (mode === 'reset') {
        setIsLoadingTransactions(true);
      } else {
        setIsLoadingMoreTransactions(true);
      }

      let requestId = 0;
      try {
        requestId = latestPageRequestIdRef.current + 1;
        latestPageRequestIdRef.current = requestId;
        const idToken = await user.getIdToken();
        const params = new URLSearchParams({
          orgId: organizationId,
          limit: '50',
          showArchived: showArchivedInLedger ? 'true' : 'false',
          ...periodQuery,
        });

        if (trimmedDeferredSearchQuery) {
          params.set('search', trimmedDeferredSearchQuery);
        }
        if (serverMovementType) {
          params.set('movementType', serverMovementType);
        }
        if (contactIdFilter) {
          params.set('contactId', contactIdFilter);
        }
        if (sourceFilter !== 'all') {
          params.set('source', sourceFilter);
        }
        if (bankAccountFilter !== '__all__') {
          params.set('bankAccountId', bankAccountFilter);
        }

        if (mode === 'append' && cursorOverride) {
          params.set('cursor', cursorOverride);
        }

        const response = await fetch(`/api/transactions/page?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`transactions page request failed: ${response.status}`);
        }

        const payload = await response.json() as TransactionsPageResponse;
        if (requestId !== latestPageRequestIdRef.current) {
          return;
        }
        const nextItems = payload.transactions ?? [];

        setPagedTransactions((prev) => {
          if (mode === 'reset' || !prev) {
            return nextItems;
          }
          const seen = new Set(prev.map((tx) => tx.id));
          const merged = [...prev];
          for (const tx of nextItems) {
            if (seen.has(tx.id)) continue;
            seen.add(tx.id);
            merged.push(tx);
          }
          return merged;
        });
        setTransactionsNextCursor(payload.nextCursor ?? null);
        setHasMoreTransactions(Boolean(payload.nextCursor));
        if (typeof payload.total === 'number') {
          setTransactionsTotal(payload.total);
        } else if (mode === 'reset') {
          setTransactionsTotal(nextItems.length);
        }
        if (mode === 'reset') {
          setAutoLoadBlockedByError(false);
        }
      } catch (error) {
        if (requestId !== latestPageRequestIdRef.current) {
          return;
        }
        console.error('[transactions-table] page load error:', error);
        if (mode === 'reset') {
          setPagedTransactions([]);
          setTransactionsNextCursor(null);
          setHasMoreTransactions(false);
          setTransactionsTotal(0);
          setAutoLoadBlockedByError(false);
        } else {
          setAutoLoadBlockedByError(true);
        }
        toast({
          variant: 'destructive',
          title: t.common.error,
          description: t.common.dbConnectionError,
        });
      } finally {
        if (requestId !== latestPageRequestIdRef.current) {
          return;
        }
        setIsLoadingTransactions(false);
        setIsLoadingMoreTransactions(false);
      }
    },
    [
      bankAccountFilter,
      contactIdFilter,
      organizationId,
      periodQuery,
      serverMovementType,
      showArchivedInLedger,
      sourceFilter,
      t.common.dbConnectionError,
      t.common.error,
      toast,
      trimmedDeferredSearchQuery,
      user,
    ]
  );

  React.useEffect(() => {
    void loadTransactionsPage('reset');
  }, [loadTransactionsPage]);

  const handleLoadMoreTransactions = React.useCallback(() => {
    if (!hasMoreTransactions || isLoadingMoreTransactions) return;
    setAutoLoadBlockedByError(false);
    void loadTransactionsPage('append', transactionsNextCursor);
  }, [hasMoreTransactions, isLoadingMoreTransactions, loadTransactionsPage, transactionsNextCursor]);

  // Filtrar transaccions arxivades (soft-delete) - només SuperAdmin pot veure-les
  const activeTransactions = React.useMemo(() => {
    if (!pagedTransactions) return null;
    if (showArchivedInLedger) {
      // SuperAdmin amb toggle: mostrar totes
      return pagedTransactions;
    }
    // Filtrar les que tenen archivedAt (soft-deleted)
    return pagedTransactions.filter(tx => !tx.archivedAt);
  }, [pagedTransactions, showArchivedInLedger]);

  // Aplicar filtre de dates primer
  const transactions = useTransactionFilters(activeTransactions ?? undefined, dateFilter);

  // Detectar categories legacy (docIds en lloc de nameKeys)
  React.useEffect(() => {
    if (!transactions || transactions.length === 0 || !organizationId) return;
    const legacyTxs = detectLegacyCategoryTransactions(transactions);
    if (legacyTxs.length > 0) {
      logLegacyCategorySummary(organizationId, legacyTxs);
    }
  }, [transactions, organizationId]);

  // Helper per obtenir el nom traduït d'una categoria (pot ser ID o nom clau)
  const getCategoryDisplayName = React.useCallback((categoryValue: string | null | undefined): string => {
    if (!categoryValue) return '';
    // Primer buscar per ID (defaultCategoryId guarda IDs)
    const categoryById = availableCategories?.find(c => c.id === categoryValue);
    if (categoryById) {
      return categoryTranslations[categoryById.name] || categoryById.name;
    }
    // Si no és ID, és un nom clau - buscar traducció directament
    return categoryTranslations[categoryValue] || categoryValue;
  }, [availableCategories, categoryTranslations]);

  const [isSplitterOpen, setIsSplitterOpen] = React.useState(false);
  const [transactionToSplit, setTransactionToSplit] = React.useState<Transaction | null>(null);
  const [isSplitAmountDialogOpen, setIsSplitAmountDialogOpen] = React.useState(false);
  const [splitAmountTransaction, setSplitAmountTransaction] = React.useState<Transaction | null>(null);
  const [isSplitDetailDialogOpen, setIsSplitDetailDialogOpen] = React.useState(false);
  const [splitDetailParentTxId, setSplitDetailParentTxId] = React.useState<string | null>(null);
  const [isUndoSplitProcessing, setIsUndoSplitProcessing] = React.useState(false);

  // Modal detall remesa
  const [isRemittanceDetailOpen, setIsRemittanceDetailOpen] = React.useState(false);
  const [selectedRemittanceId, setSelectedRemittanceId] = React.useState<string | null>(null);
  const [remittanceDetailParentTx, setRemittanceDetailParentTx] = React.useState<Transaction | null>(null);

  // Modal importador devolucions
  const [isReturnImporterOpen, setIsReturnImporterOpen] = React.useState(false);
  const [returnImporterParentTx, setReturnImporterParentTx] = React.useState<Transaction | null>(null);

  // Modal imputacio Stripe
  const [isStripeImputationOpen, setIsStripeImputationOpen] = React.useState(false);

  // Modal SEPA reconcile
  const [sepaReconcileTx, setSepaReconcileTx] = React.useState<Transaction | null>(null);
  const [sepaReconcileRemittance, setSepaReconcileRemittance] = React.useState<PrebankRemittance | null>(null);

  // Cache de remeses pre-banc detectades per transacció (txId -> remittance)
  const [detectedSepaRemittances, setDetectedSepaRemittances] = React.useState<Map<string, PrebankRemittance>>(new Map());
  const [stripeTransactionToSplit, setStripeTransactionToSplit] = React.useState<Transaction | null>(null);

  // Modal undo processament
  const [isUndoDialogOpen, setIsUndoDialogOpen] = React.useState(false);
  const [undoTransaction, setUndoTransaction] = React.useState<Transaction | null>(null);
  const [undoChildCount, setUndoChildCount] = React.useState(0);
  const [isUndoProcessing, setIsUndoProcessing] = React.useState(false);
  const [isReturnEmailDraftDialogOpen, setIsReturnEmailDraftDialogOpen] = React.useState(false);
  const [returnEmailDraftBody, setReturnEmailDraftBody] = React.useState('');

  // Maps per noms
  const contactMap = React.useMemo(() =>
    availableContacts?.reduce((acc, contact) => {
      acc[contact.id] = { name: contact.name, type: contact.type };
      return acc;
    }, {} as Record<string, { name: string; type: ContactType }>) || {},
  [availableContacts]);

  const donors = React.useMemo(() =>
    filterActiveContacts(availableContacts?.filter(c => c.type === 'donor') as Donor[] || []),
  [availableContacts]);

  // P0: TOTS els donants per matching IBAN en remeses (sense filtrar per estat)
  // Inclou: active, inactive (baixa), archived, deleted
  const allDonorsForRemittance = React.useMemo(() =>
    (availableContacts?.filter(c => c.type === 'donor') as Donor[] || []),
  [availableContacts]);

  // Map contactId -> membershipType per filtrar donations vs memberFees
  const donorMembershipMap = React.useMemo(() => {
    if (!availableContacts) return new Map<string, 'one-time' | 'recurring'>();
    return new Map(
      availableContacts
        .filter((c): c is Donor => c.type === 'donor')
        .map(c => [c.id, c.membershipType || 'one-time'])
    );
  }, [availableContacts]);
  
  const suppliers = React.useMemo(() =>
    availableContacts?.filter(c => c.type === 'supplier') as Supplier[] || [],
  [availableContacts]);

  const employees = React.useMemo(() =>
    availableContacts?.filter(c => c.type === 'employee') as Employee[] || [],
  [availableContacts]);

  // Memoized contacts for ContactCombobox to prevent re-renders
  const comboboxContacts = React.useMemo(() =>
    availableContacts?.map(c => ({ id: c.id, name: c.name, type: c.type })) || [],
  [availableContacts]);

  const projectMap = React.useMemo(() =>
    availableProjects?.reduce((acc, project) => {
        acc[project.id] = project.name;
        return acc;
    }, {} as Record<string, string>) || {},
  [availableProjects]);

  const allTransactionsById = React.useMemo(() => {
    return (pagedTransactions ?? []).reduce((acc, tx) => {
      acc[tx.id] = tx;
      return acc;
    }, {} as Record<string, Transaction>);
  }, [pagedTransactions]);

  const splitDetailParentTx = React.useMemo(
    () => (splitDetailParentTxId ? allTransactionsById[splitDetailParentTxId] ?? null : null),
    [allTransactionsById, splitDetailParentTxId]
  );

  const splitDetailParts = React.useMemo(() => {
    if (!splitDetailParentTxId) return [];
    return (pagedTransactions ?? []).filter(
      (tx) => tx.parentTransactionId === splitDetailParentTxId && !tx.archivedAt
    );
  }, [pagedTransactions, splitDetailParentTxId]);

  // Mapa de comptes bancaris per ID (per export)
  const bankAccountMap = React.useMemo(() =>
    bankAccounts.reduce((acc, account) => {
      acc[account.id] = account.name;
      return acc;
    }, {} as Record<string, string>),
  [bankAccounts]);

  // ═══════════════════════════════════════════════════════════════════════════
  // GESTIÓ DE DEVOLUCIONS (HOOK EXTERN)
  // ═══════════════════════════════════════════════════════════════════════════
  const {
    isReturnDialogOpen,
    handleCloseReturnDialog,
    returnTransaction,
    returnDonorId,
    setReturnDonorId,
    returnLinkedTxId,
    setReturnLinkedTxId,
    donorDonations,
    isLoadingDonations,
    returnMode,
    setReturnMode,
    splitRows,
    addSplitRow,
    updateSplitRow,
    removeSplitRow,
    splitValidationError,
    canUseManualSplit,
    parentReturnTotal,
    isSavingReturn,
    canSaveReturn,
    handleOpenReturnDialog,
    handleSaveReturn,
  } = useReturnManagement({
    transactionsCollection,
    contactsCollection,
    organizationId,
    userId: user?.uid ?? null,
    donors,
    contactMap,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BULK MODE HANDLERS (SuperAdmin only)
  // ═══════════════════════════════════════════════════════════════════════════
  const handleQuotaExceeded = React.useCallback(() => {
    setIsBulkMode(false);
    trackUX('ai.bulk.fallback_quota', { reason: 'quota_exceeded' });
    toast({
      variant: 'destructive',
      title: language === 'ca' ? "Quota d'IA assolida" : "Cuota de IA alcanzada",
      description: language === 'ca'
        ? "L'IA ha arribat al límit de quota. Pots continuar en mode normal o reprendre més tard."
        : "La IA ha alcanzado el límite de cuota. Puedes continuar en modo normal o reanudar más tarde.",
    });
  }, [toast, language]);

  const handleBulkModeChange = React.useCallback((enabled: boolean) => {
    setIsBulkMode(enabled);
    trackUX('ai.bulk.toggle', { enabled });
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORITZACIÓ IA (HOOK EXTERN)
  // ═══════════════════════════════════════════════════════════════════════════
  const {
    loadingStates,
    isBatchCategorizing,
    batchProgress,
    handleCategorize,
    handleBatchCategorize,
    handleCancelBatch,
  } = useTransactionCategorization({
    transactionsCollection,
    transactions,
    availableCategories,
    getCategoryDisplayName,
    bulkMode: isBulkMode,
    onQuotaExceeded: handleQuotaExceeded,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCIONS DE TRANSACCIONS (HOOK EXTERN)
  // ═══════════════════════════════════════════════════════════════════════════
  const {
    // Note Setter
    handleSetNote,
    // Property Setters
    handleSetCategory: handleSetCategoryFromHook,
    handleSetContact: handleSetContactFromHook,
    handleSetProject,
    // Document Upload / Delete
    docLoadingStates,
    handleAttachDocumentWithName,
    handleDeleteDocument,
    isDeleteDocDialogOpen,
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
    handleDeleteClick,
    handleDeleteConfirm,
    handleCloseDeleteDialog,
    // New Contact Dialog
    isNewContactDialogOpen,
    newContactType,
    handleOpenNewContactDialog,
    handleSaveNewContact,
    handleCloseNewContactDialog,
  } = useTransactionActions({
    transactionsCollection,
    contactsCollection,
    organizationId,
    storage,
    transactions,
    availableContacts,
    availableCategories,
    firestore,
    userId: user?.uid,
    canEditMovements,
  });

  const setInlineUpdatePending = React.useCallback((txId: string, nextState: 'contact' | 'category' | null) => {
    setInlineUpdatePendingByTxId((prev) => {
      if (nextState === null) {
        if (!prev[txId]) return prev;
        const next = { ...prev };
        delete next[txId];
        return next;
      }

      if (prev[txId] === nextState) return prev;
      return {
        ...prev,
        [txId]: nextState,
      };
    });
  }, []);

  const rollbackInlineTransaction = React.useCallback((previousTx: Transaction) => {
    setPagedTransactions((prev) => applyTransactionPatch(prev, previousTx.id, previousTx));
  }, []);

  const runInlineTransactionUpdate = React.useCallback(async (
    txId: string,
    kind: 'contact' | 'category',
    remoteUpdate: Record<string, unknown>,
    localPatch: Partial<Transaction>
  ) => {
    if (!canEditMovements) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: 'No tens permisos per editar moviments.',
      });
      return;
    }

    if (!transactionsCollection) return;
    if (inlineUpdatePendingByTxId[txId]) return;

    const previousTx = allTransactionsById[txId];
    if (!previousTx) return;

    setInlineUpdatePending(txId, kind);
    setPagedTransactions((prev) => applyTransactionPatch(prev, txId, localPatch));

    try {
      const writePromise = updateDoc(doc(transactionsCollection, txId), remoteUpdate as UpdateData<Transaction>);
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = window.setTimeout(() => {
          reject(new Error('Inline update timeout'));
        }, INLINE_UPDATE_TIMEOUT_MS);
        writePromise.finally(() => window.clearTimeout(timeoutId)).catch(() => {
          window.clearTimeout(timeoutId);
        });
      });

      await Promise.race([writePromise, timeoutPromise]);
    } catch (error) {
      rollbackInlineTransaction(previousTx);

      const firebaseError = error as { message?: string };
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: firebaseError.message || t.common.dbConnectionError,
      });
    } finally {
      setInlineUpdatePending(txId, null);
    }
  }, [
    allTransactionsById,
    canEditMovements,
    INLINE_UPDATE_TIMEOUT_MS,
    inlineUpdatePendingByTxId,
    rollbackInlineTransaction,
    setInlineUpdatePending,
    t.common.dbConnectionError,
    t.common.error,
    toast,
    transactionsCollection,
  ]);

  const handleSetCategory = React.useCallback((txId: string, categoryId: string) => {
    const tx = allTransactionsById[txId];
    if (!tx) return;

    if (!canEditMovements) {
      handleSetCategoryFromHook(txId, categoryId);
      return;
    }

    if (!availableCategories) {
      toast({
        variant: 'destructive',
        title: t.movements?.table?.categoryTypeMismatch?.title ?? 'Error',
        description: t.movements?.table?.categoryTypeMismatch?.loading ?? 'Carregant categories… torna-ho a provar.',
      });
      return;
    }

    if (!isCategoryIdCompatibleStrict(tx.amount, categoryId, availableCategories)) {
      toast({
        variant: 'destructive',
        title: t.movements?.table?.categoryTypeMismatch?.title ?? 'Tipus incompatible',
        description: t.movements?.table?.categoryTypeMismatch?.description ?? 'Aquesta categoria no és compatible amb el signe del moviment.',
      });
      return;
    }

    const update = buildCategoryInlineUpdate(categoryId);
    void runInlineTransactionUpdate(txId, 'category', update.remoteUpdate, update.localPatch);
  }, [
    allTransactionsById,
    availableCategories,
    canEditMovements,
    handleSetCategoryFromHook,
    runInlineTransactionUpdate,
    t,
    toast,
  ]);

  const handleSetContact = React.useCallback((txId: string, newContactId: string | null, contactType?: ContactType) => {
    const tx = allTransactionsById[txId];
    if (!tx) return;

    if (!canEditMovements) {
      handleSetContactFromHook(txId, newContactId, contactType);
      return;
    }

    const update = buildContactInlineUpdate({
      transaction: tx,
      nextContactId: newContactId,
      contactType,
      availableContacts,
      availableCategories,
    });

    void runInlineTransactionUpdate(txId, 'contact', update.remoteUpdate, update.localPatch);
  }, [
    allTransactionsById,
    availableCategories,
    availableContacts,
    canEditMovements,
    handleSetContactFromHook,
    runInlineTransactionUpdate,
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENAME DIALOG STATE & HELPERS
  // ═══════════════════════════════════════════════════════════════════════════
  const [pendingUpload, setPendingUpload] = React.useState<{
    txId: string;
    file: File;
    suggestedName: string;
  } | null>(null);

  /** Calcula el "concepte" per al nom de fitxer: contacte > note > description > 'moviment' */
  const getConceptForFilename = React.useCallback((tx: { contactId?: string | null; note?: string | null; description?: string | null }) => {
    const contactName = tx.contactId ? contactMap[tx.contactId]?.name : null;
    return contactName || tx.note?.trim() || tx.description?.trim() || 'moviment';
  }, [contactMap]);

  /** Punt únic de "prepare upload": obre diàleg si cal, sinó puja directe */
  const prepareUpload = React.useCallback((txId: string, file: File) => {
    const tx = transactions?.find(t => t.id === txId);
    if (!tx) return;

    const suggestedName = buildDocumentFilename({
      dateISO: getDisplayDate(tx) || new Date().toISOString().split('T')[0],
      concept: getConceptForFilename(tx),
      originalName: file.name,
    });

    if (suggestedName !== file.name) {
      setPendingUpload({ txId, file, suggestedName });
    } else {
      // Noms iguals → puja directament
      handleAttachDocumentWithName(txId, file, file.name);
    }
  }, [transactions, getConceptForFilename, handleAttachDocumentWithName]);

  /** Confirma upload des del diàleg: useOriginal=true → nom original, false → suggerit */
  const handleConfirmUpload = React.useCallback((useOriginal: boolean) => {
    if (!pendingUpload) return;
    const { txId, file, suggestedName } = pendingUpload;
    const finalName = useOriginal ? file.name : suggestedName;
    handleAttachDocumentWithName(txId, file, finalName);
    setPendingUpload(null);
  }, [pendingUpload, handleAttachDocumentWithName]);

  // ═══════════════════════════════════════════════════════════════════════════
  // DRAG & DROP DOCUMENT HANDLER
  // ═══════════════════════════════════════════════════════════════════════════
  const handleDropFile = React.useCallback(async (txId: string, file: File) => {
    if (!firestore || !storage || !organizationId) return;
    prepareUpload(txId, file);
  }, [firestore, storage, organizationId, prepareUpload]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CLICK-TO-ATTACH WITH RENAME (substitueix handleAttachDocument del hook)
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAttachDocumentWithRename = React.useCallback((txId: string) => {
    if (!organizationId) return;

    setTimeout(() => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'application/pdf,image/*,.doc,.docx,.xls,.xlsx';
      fileInput.style.display = 'none';

      fileInput.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (fileInput.parentElement) {
          document.body.removeChild(fileInput);
        }
        if (!file) return;
        prepareUpload(txId, file);
      };

      document.body.appendChild(fileInput);
      fileInput.click();
    }, 100);
  }, [organizationId, prepareUpload]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADÍSTIQUES
  // ═══════════════════════════════════════════════════════════════════════════
  const expensesWithoutDoc = React.useMemo(() => {
    if (!transactions) return [];
    return transactions.filter(tx => tx.amount < 0 && !tx.document);
  }, [transactions]);

  // Devolucions (return + return_fee)
  const returnTransactions = React.useMemo(() => {
    if (!transactions) return [];
    return transactions.filter(tx => 
      tx.transactionType === 'return' || tx.transactionType === 'return_fee'
    );
  }, [transactions]);

  // Devolucions pendents d'assignar
  // NOTA: Exclou pares de remeses amb status 'complete' (els donants estan a les filles)
  const pendingReturns = React.useMemo(() => {
    return returnTransactions.filter(tx => {
      // Si és un pare de remesa de devolucions, només comptar si NO és complete
      if (tx.isRemittance && tx.remittanceType === 'returns') {
        return tx.remittanceStatus !== 'complete';
      }
      // Per la resta (individuals o filles), comprovar si no té contactId
      return tx.transactionType === 'return' && !tx.contactId;
    });
  }, [returnTransactions]);

  // Estadístiques de devolucions pendents (diferenciant remeses vs individuals)
  const pendingReturnsStats = React.useMemo(() => {
    if (!transactions) return {
      individualCount: 0,
      remittanceCount: 0,
      remittanceItemsCount: 0,
      hasPendingRemittances: false,
      hasPendingIndividuals: false,
      pendingRemittancesList: [] as Transaction[],
      pendingIndividualsList: [] as Transaction[],
    };

    // Devolucions individuals pendents (return sense contactId i NO part d'una remesa)
    const pendingIndividuals = transactions.filter(tx =>
      tx.transactionType === 'return' &&
      !tx.contactId &&
      !tx.isRemittance &&
      tx.source !== 'remittance'  // No és filla d'una remesa
    );

    // Fitxers de devolucions pendents (remeses amb status !== 'complete')
    const pendingRemittances = transactions.filter(tx =>
      tx.isRemittance &&
      tx.remittanceType === 'returns' &&
      tx.remittanceStatus !== 'complete'
    );

    // Total d'ítems pendents dins les remeses
    const remittanceItemsCount = pendingRemittances.reduce((sum, tx) =>
      sum + (tx.remittancePendingCount ?? 0), 0
    );

    // Ordenar remeses per data descendent (més recents primer)
    const sortedRemittances = [...pendingRemittances].sort((a, b) =>
      new Date(getDisplayDate(b)).getTime() - new Date(getDisplayDate(a)).getTime()
    );

    return {
      individualCount: pendingIndividuals.length,
      remittanceCount: pendingRemittances.length,
      remittanceItemsCount,
      hasPendingRemittances: pendingRemittances.length > 0,
      hasPendingIndividuals: pendingIndividuals.length > 0,
      pendingRemittancesList: sortedRemittances,
      pendingIndividualsList: pendingIndividuals,
    };
  }, [transactions]);

  // Moviments sense categoritzar
  const uncategorizedTransactions = React.useMemo(() => {
    if (!transactions) return [];
    return transactions.filter(tx => tx.category === null || tx.category === 'Revisar');
  }, [transactions]);

  // Moviments sense contacte assignat (amount > 50€) - DEPRECATED, ara usem donationsNoContact
  const noContactTransactions = React.useMemo(() => {
    if (!transactions) return [];
    return transactions.filter(tx => !tx.contactId && Math.abs(tx.amount) > 50);
  }, [transactions]);

  // Donacions/quotes sense contacte assignat (categoria "Donaciones" o "Cuotas socios" però sense contactId)
  const donationsNoContactTransactions = React.useMemo(() => {
    if (!transactions) return [];
    return transactions.filter(tx =>
      !tx.contactId &&
      tx.amount > 0 &&
      (tx.category === 'Donaciones' || tx.category === 'Cuotas socios')
    );
  }, [transactions]);

  const fiscalPendingTransactions = React.useMemo(() => {
    if (!transactions) return [];
    return transactions.filter(tx => isS9PendingFiscalTransaction(tx));
  }, [transactions]);

  const pendingReturnsIds = React.useMemo(
    () => new Set(pendingReturns.map((tx) => tx.id)),
    [pendingReturns]
  );
  const pendingRemittanceIds = React.useMemo(
    () => new Set(pendingReturnsStats.pendingRemittancesList.map((tx) => tx.id)),
    [pendingReturnsStats.pendingRemittancesList]
  );
  const pendingIndividualIds = React.useMemo(
    () => new Set(pendingReturnsStats.pendingIndividualsList.map((tx) => tx.id)),
    [pendingReturnsStats.pendingIndividualsList]
  );

  const isServerHandledTableFilter = tableFilter === 'income' || tableFilter === 'expenses';
  const hasLocalOnlyFilter = tableFilter !== 'all' && !isServerHandledTableFilter;
  const hasBackendFilter = (
    isServerHandledTableFilter ||
    trimmedDeferredSearchQuery !== '' ||
    contactIdFilter !== null ||
    sourceFilter !== 'all' ||
    bankAccountFilter !== '__all__' ||
    dateFilter.type !== 'all'
  );

  const matchesTransactionFilters = React.useCallback((tx: Transaction) => {
    switch (tableFilter) {
      case 'missing':
        if (!(tx.amount < 0 && !tx.document)) return false;
        break;
      case 'returns':
        if (!(tx.transactionType === 'return' || tx.transactionType === 'return_fee')) return false;
        break;
      case 'income':
        if (!(tx.amount > 0)) return false;
        break;
      case 'expenses':
        if (!(tx.amount < 0)) return false;
        break;
      case 'expensesWithoutDoc':
        if (!(tx.amount < 0 && !tx.document)) return false;
        break;
      case 'operatingExpenses':
        if (!(tx.amount < 0 && tx.category !== missionTransferCategoryId)) return false;
        break;
      case 'missionTransfers':
        if (!(missionTransferCategoryId && tx.category === missionTransferCategoryId)) return false;
        break;
      case 'donations': {
        if (tx.amount <= 0 || tx.contactType !== 'donor' || !tx.contactId) return false;
        const membershipType = donorMembershipMap.get(tx.contactId) || 'one-time';
        if (membershipType !== 'one-time') return false;
        break;
      }
      case 'memberFees': {
        if (tx.amount <= 0 || tx.contactType !== 'donor' || !tx.contactId) return false;
        const membershipType = donorMembershipMap.get(tx.contactId) || 'one-time';
        if (membershipType !== 'recurring') return false;
        break;
      }
      case 'pendingReturns':
        if (!pendingReturnsIds.has(tx.id)) return false;
        break;
      case 'pendingRemittances':
        if (!pendingRemittanceIds.has(tx.id)) return false;
        break;
      case 'pendingIndividuals':
        if (!pendingIndividualIds.has(tx.id)) return false;
        break;
      case 'uncategorized':
      case 'noContact':
      case 'donationsNoContact':
        if (!matchesInlineReactiveFilter(tx, tableFilter)) return false;
        break;
      case 'fiscalPending':
        if (!isS9PendingFiscalTransaction(tx)) return false;
        break;
      case 'all':
      default:
        break;
    }

    if (hideRemittanceItems && !isVisibleInMovementsLedger(tx, { showArchived: showArchivedInLedger })) {
      return false;
    }

    if (tx.parentTransactionId && allTransactionsById[tx.parentTransactionId]?.isSplit) {
      return false;
    }

    if (sourceFilter !== 'all') {
      // Source filter is already resolved server-side for the paginated endpoint.
    }

    if (bankAccountFilter !== '__all__' && tx.bankAccountId !== bankAccountFilter) {
      // Bank-account filter is already resolved server-side for the paginated endpoint.
    }

    if (contactIdFilter && tx.contactId !== contactIdFilter) {
      // Contact filter is already resolved server-side for the paginated endpoint.
    }

    if (trimmedDeferredSearchQuery) {
      // Search is already resolved server-side for the paginated endpoint.
    }

    return true;
  }, [
    allTransactionsById,
    bankAccountFilter,
    contactIdFilter,
    contactMap,
    donorMembershipMap,
    getCategoryDisplayName,
    hideRemittanceItems,
    missionTransferCategoryId,
    pendingIndividualIds,
    pendingRemittanceIds,
    pendingReturnsIds,
    projectMap,
    trimmedDeferredSearchQuery,
    showArchivedInLedger,
    sourceFilter,
    tableFilter,
  ]);

  // Transaccions filtrades i ordenades per data (més recents primer)
  const filteredTransactions = React.useMemo(() => {
    if (!transactions) return [];
    const result = transactions.filter(matchesTransactionFilters);

    // Ordenar per data (criteri principal) i, en grups fiables, per saldo intra-dia
    return sortTransactionsForTable(result, {
      sortDateAsc,
      getDisplayDate,
    });
  }, [transactions, matchesTransactionFilters, sortDateAsc, getDisplayDate]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RESUM FILTRAT
  // ═══════════════════════════════════════════════════════════════════════════
  const hasActiveFilter = hasBackendFilter || hasLocalOnlyFilter;
  const isResolvingLocalFilters = hasLocalOnlyFilter && hasMoreTransactions && !autoLoadBlockedByError;
  const hasIncompleteLocalDataset = hasLocalOnlyFilter && (hasMoreTransactions || autoLoadBlockedByError);
  const canRenderResolvedResults = !hasIncompleteLocalDataset;
  const visibleTransactions = canRenderResolvedResults ? filteredTransactions : [];

  React.useEffect(() => {
    setAutoLoadBlockedByError(false);
  }, [organizationId, periodQuery, showArchivedInLedger, tableFilter, trimmedDeferredSearchQuery, contactIdFilter, sourceFilter, bankAccountFilter]);

  React.useEffect(() => {
    if (!hasLocalOnlyFilter) return;
    if (!hasMoreTransactions) return;
    if (autoLoadBlockedByError) return;
    if (isLoadingTransactions || isLoadingMoreTransactions) return;
    void loadTransactionsPage('append', transactionsNextCursor);
  }, [
    autoLoadBlockedByError,
    hasMoreTransactions,
    hasLocalOnlyFilter,
    isLoadingMoreTransactions,
    isLoadingTransactions,
    loadTransactionsPage,
    transactionsNextCursor,
  ]);

  const filteredSummary = React.useMemo(() => {
    if (!hasActiveFilter || !transactions || !canRenderResolvedResults) return null;

    // Total del període = només apunts bancaris (ledger), excloent desglossaments interns
    const periodTotal = filterSplitChildTransactions(
      transactions.filter((tx) =>
        isVisibleInMovementsLedger(tx, { showArchived: showArchivedInLedger })
      ),
      allTransactionsById
    ).length;

    const visible = visibleTransactions;
    const summaryTotal = hasBackendFilter
      ? transactionsTotal ?? visible.length
      : periodTotal;

    return {
      showing: visible.length,
      total: summaryTotal,
      income: visible.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0),
      expenses: visible.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + tx.amount, 0),
    };
  }, [visibleTransactions, transactions, hasActiveFilter, allTransactionsById, canRenderResolvedResults, hasBackendFilter, showArchivedInLedger, transactionsTotal]);

  const clearAllFilters = React.useCallback(() => {
    setTableFilter('all');
    setSearchQuery('');
    setDateFilter({ type: 'all' });
    setContactIdFilter(null);
    setSourceFilter('all');
    setBankAccountFilter('__all__');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('filter');
      url.searchParams.delete('contactId');
      url.searchParams.delete('fiscal');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCIONS EN BLOC (BULK)
  // ═══════════════════════════════════════════════════════════════════════════

  const bulkT = t.movements?.table?.bulkSelection;
  const isBulkSelectionBlocked = React.useCallback((tx: Transaction): boolean => {
    if (getDeleteTransactionBlockedReason(tx)) return true;
    if (tx.isSplit) return true;
    if (!tx.parentTransactionId) return false;
    return !!allTransactionsById[tx.parentTransactionId]?.isSplit;
  }, [allTransactionsById]);
  const selectedTransactions = React.useMemo(
    () => Array.from(selectedIds)
      .map((id) => allTransactionsById[id])
      .filter((tx): tx is Transaction => !!tx && !tx.archivedAt && !isBulkSelectionBlocked(tx)),
    [selectedIds, allTransactionsById, isBulkSelectionBlocked]
  );
  React.useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        const tx = allTransactionsById[id];
        if (tx && !isBulkSelectionBlocked(tx)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [allTransactionsById, isBulkSelectionBlocked]);

  // Derivats per a la capçalera
  const selectableVisibleIds = React.useMemo(
    () => visibleTransactions.filter((tx) => !isBulkSelectionBlocked(tx)).map((tx) => tx.id),
    [visibleTransactions, isBulkSelectionBlocked]
  );
  const selectedCount = selectedIds.size;
  const allVisibleSelected = selectableVisibleIds.length > 0 && selectableVisibleIds.every(id => selectedIds.has(id));
  const someVisibleSelected = selectableVisibleIds.some(id => selectedIds.has(id));
  const checkboxState = allVisibleSelected ? 'checked' : someVisibleSelected ? 'indeterminate' : 'unchecked';
  const blockedSelectedCount = React.useMemo(() => {
    return Array.from(selectedIds).filter((id) => {
      const tx = allTransactionsById[id];
      if (!tx) return true;
      return isBulkSelectionBlocked(tx);
    }).length;
  }, [selectedIds, allTransactionsById, isBulkSelectionBlocked]);
  const deletableSelectedCount = selectedTransactions.length;

  // Determinar tipus de la selecció bulk (per filtrar categories i bloquejar mixed)
  const bulkSelectionType = React.useMemo(() => {
    if (selectedTransactions.length === 0) return 'none' as const;
    const allPositive = selectedTransactions.every(tx => tx.amount > 0);
    const allNegative = selectedTransactions.every(tx => tx.amount < 0);
    if (allPositive) return 'income' as const;
    if (allNegative) return 'expense' as const;
    return 'mixed' as const;
  }, [selectedTransactions]);

  const bulkAvailableCategories = React.useMemo(() => {
    if (!availableCategories || bulkSelectionType === 'mixed' || bulkSelectionType === 'none') return [];
    return filterValidSelectItems(
      availableCategories.filter(c => c.type === bulkSelectionType),
      'transactions-table.bulkCategories'
    );
  }, [availableCategories, bulkSelectionType]);

  // Bulk update amb batching (màx 50 per batch)
  const handleBulkUpdateCategory = React.useCallback(async (categoryId: string | null) => {
    if (!organizationId || selectedTransactions.length === 0) return;

    setIsBulkUpdating(true);
    const idsToUpdate = selectedTransactions.map((tx) => tx.id);
    const BATCH_SIZE = 50;
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    trackUX('bulk.category.start', { count: idsToUpdate.length, action: categoryId ? 'assign' : 'remove' });

    try {
      // Dividir en chunks de 50
      for (let i = 0; i < idsToUpdate.length; i += BATCH_SIZE) {
        const chunk = idsToUpdate.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(firestore);
        let batchCount = 0;

        for (const txId of chunk) {
          const txRef = doc(firestore, 'organizations', organizationId, 'transactions', txId);
          if (categoryId) {
            // Guardrail: validar compatibilitat signe ↔ tipus
            const tx = transactions?.find(tr => tr.id === txId);
            if (tx && availableCategories && !isCategoryIdCompatibleStrict(tx.amount, categoryId, availableCategories)) {
              skippedCount++;
              continue;
            }
            batch.update(txRef, { category: categoryId });
          } else {
            batch.update(txRef, { category: null });
          }
          batchCount++;
        }

        if (batchCount > 0) {
          try {
            await batch.commit();
            successCount += batchCount;
          } catch (error) {
            console.error('[BulkUpdate] Batch error:', error);
            failCount += batchCount;
          }
        }
      }

      // Feedback: skipped per incompatibilitat
      if (skippedCount > 0) {
        const msg = bulkT?.skippedIncompatible
          ? (typeof bulkT.skippedIncompatible === 'function' ? bulkT.skippedIncompatible(skippedCount) : String(bulkT.skippedIncompatible).replace('{{count}}', String(skippedCount)))
          : `No s'han assignat ${skippedCount} moviments per incompatibilitat de tipus.`;
        toast({ variant: 'destructive', title: msg });
      }

      // Feedback
      if (failCount === 0 && successCount > 0) {
        const categoryDisplayName = categoryId ? getCategoryDisplayName(categoryId) : '';
        toast({
          title: categoryId
            ? bulkT?.successAssigned(successCount, categoryDisplayName) ?? `Categoria assignada a ${successCount} moviments.`
            : bulkT?.successRemoved(successCount) ?? `Categoria treta de ${successCount} moviments.`,
        });
        trackUX('bulk.category.success', { count: successCount, action: categoryId ? 'assign' : 'remove' });
      } else if (successCount > 0) {
        toast({
          title: bulkT?.errorPartial(successCount, failCount) ?? `Completat parcialment: ${successCount} actualitzats, ${failCount} amb errors.`,
          variant: 'destructive',
        });
        trackUX('bulk.category.partial', { success: successCount, failed: failCount });
      } else if (failCount > 0) {
        toast({
          title: bulkT?.errorAll ?? "No s'ha pogut actualitzar cap moviment.",
          variant: 'destructive',
        });
        trackUX('bulk.category.error', { count: idsToUpdate.length });
      }

      // Netejar selecció
      clearSelection();
      setIsBulkCategoryDialogOpen(false);
      setBulkCategoryId(null);

    } finally {
      setIsBulkUpdating(false);
    }
  }, [organizationId, selectedTransactions, transactions, availableCategories, firestore, getCategoryDisplayName, toast, bulkT, clearSelection]);

  const handleOpenBulkCategoryDialog = React.useCallback(() => {
    setBulkCategoryId(null);
    setIsBulkCategoryDialogOpen(true);
  }, []);

  const handleBulkRemoveCategory = React.useCallback(() => {
    handleBulkUpdateCategory(null);
  }, [handleBulkUpdateCategory]);

  const handleApplyBulkCategory = React.useCallback(() => {
    if (!bulkCategoryId) return;
    handleBulkUpdateCategory(bulkCategoryId);
  }, [bulkCategoryId, handleBulkUpdateCategory]);

  const handleBulkDeleteSelected = React.useCallback(async () => {
    if (!organizationId || selectedTransactions.length === 0) return;

    setIsBulkDeleting(true);
    trackUX('bulk.delete.start', { count: selectedTransactions.length });

    let deletedCount = 0;
    let archivedCount = 0;
    const blockedCount = blockedSelectedCount;
    let failedCount = 0;
    let autoUnmatchedCount = 0;
    const failedIds = new Set<string>();

    try {
      for (const tx of selectedTransactions) {
        try {
          const pendingQuery = query(
            pendingDocumentsCollection(firestore, organizationId),
            where('matchedTransactionId', '==', tx.id),
            where('status', '==', 'matched')
          );
          const pendingSnap = await getDocs(pendingQuery);

          if (!pendingSnap.empty) {
            const BATCH_SIZE = 50;
            for (let i = 0; i < pendingSnap.docs.length; i += BATCH_SIZE) {
              const batch = writeBatch(firestore);
              const chunk = pendingSnap.docs.slice(i, i + BATCH_SIZE);
              for (const pendingDoc of chunk) {
                batch.update(pendingDoc.ref, {
                  status: 'confirmed',
                  matchedTransactionId: deleteField(),
                });
              }
              await batch.commit();
            }
            autoUnmatchedCount += pendingSnap.size;
          }
        } catch (error) {
          console.error('[BulkDelete] Error unmatching pending docs:', error);
          failedCount++;
          failedIds.add(tx.id);
          continue;
        }

        try {
          if (isFiscallyRelevantTransaction(tx) && user?.uid) {
            await handleTransactionDelete(tx, {
              firestore,
              orgId: organizationId,
              userId: user.uid,
              reason: 'user_delete',
            });
            archivedCount++;
          } else if (isFiscallyRelevantTransaction(tx) && !user?.uid) {
            throw new Error('No user context for fiscal archive');
          } else {
            await deleteDoc(doc(firestore, 'organizations', organizationId, 'transactions', tx.id));
            deletedCount++;
          }
        } catch (error) {
          console.error('[BulkDelete] Error deleting tx:', tx.id, error);
          failedCount++;
          failedIds.add(tx.id);
        }
      }

      const processedCount = deletedCount + archivedCount;
      if (processedCount > 0) {
        toast({
          title: bulkT?.successDeleted
            ? bulkT.successDeleted(processedCount, archivedCount)
            : `${processedCount} moviment${processedCount > 1 ? 's' : ''} eliminat${processedCount > 1 ? 's' : ''}${archivedCount > 0 ? ` (${archivedCount} arxivat${archivedCount > 1 ? 's' : ''})` : ''}.`,
        });
        trackUX('bulk.delete.success', { processedCount, archivedCount });
      }

      if (blockedCount > 0) {
        toast({
          variant: 'destructive',
          title: bulkT?.blockedSkipped
            ? bulkT.blockedSkipped(blockedCount)
            : `${blockedCount} moviment${blockedCount > 1 ? 's' : ''} no es poden eliminar per restriccions de remesa/desglossament.`,
        });
      }

      if (failedCount > 0) {
        toast({
          variant: 'destructive',
          title: bulkT?.errorPartialDelete
            ? bulkT.errorPartialDelete(processedCount, failedCount)
            : `Completat parcialment: ${processedCount} eliminats/arxivats, ${failedCount} amb errors.`,
        });
        trackUX('bulk.delete.partial', { processedCount, failedCount });
      }

      if (processedCount === 0 && blockedCount === 0 && failedCount > 0) {
        trackUX('bulk.delete.error', { count: selectedTransactions.length });
      }

      if (autoUnmatchedCount > 0) {
        toast({
          title: t.pendingDocs.toasts.autoUnmatchTitle,
          description: t.pendingDocs.toasts.autoUnmatchDesc,
        });
      }

      setSelectedIds(new Set(Array.from(failedIds)));
      setIsBulkDeleteDialogOpen(false);
    } finally {
      setIsBulkDeleting(false);
    }
  }, [organizationId, selectedTransactions, blockedSelectedCount, firestore, user?.uid, toast, bulkT, t.pendingDocs.toasts]);

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORTAR EXCEL
  // ═══════════════════════════════════════════════════════════════════════════

  const handleExportFilteredTransactions = async () => {
    if (!canRenderResolvedResults || hasMoreTransactions) {
      toast({
        title: 'Carregant més moviments',
        description: 'Cal acabar de carregar les pàgines del resultat actual abans d’exportar-lo complet.',
      });
      return;
    }

    if (visibleTransactions.length === 0) {
      toast({ title: t.movements.table.noTransactions });
      return;
    }

    let XLSX: typeof import('xlsx');
    try {
      XLSX = await import('xlsx');
    } catch (error) {
      console.error('Error loading xlsx for filtered export:', error);
      toast({ variant: 'destructive', title: t.common.error, description: "No s'ha pogut carregar l'exportador Excel." });
      return;
    }

    // Traduccions de columnes (amb fallback)
    const exportCols = t.movements.table.exportColumns ?? {
      date: 'Data',
      description: 'Descripció',
      amount: 'Import',
      category: 'Categoria',
      contact: 'Contacte',
      contactType: 'Tipus contacte',
      project: 'Projecte',
      bankAccount: 'Compte bancari',
      source: 'Origen',
      transactionType: 'Tipus',
      transactionId: 'ID transacció',
    };

    // Mapa per traduir source
    const sourceLabels: Record<string, string> = {
      bank: t.movements.table.sourceBank ?? 'Banc',
      remittance: t.movements.table.sourceRemittance ?? 'Remesa',
      stripe: 'Stripe',
      manual: t.movements.table.sourceManual ?? 'Manual',
    };

    // Mapa per traduir contactType
    const contactTypeLabels: Record<string, string> = {
      donor: t.common?.donor ?? 'Donant',
      supplier: t.common?.supplier ?? 'Proveïdor',
      employee: t.common?.employee ?? 'Empleat',
    };

    // Mapa per traduir transactionType
    const txTypeLabels: Record<string, string> = {
      donation: t.movements.table.typeDonation ?? 'Donació',
      return: t.movements.table.typeReturn ?? 'Devolució',
      fee: t.movements.table.typeFee ?? 'Comissió',
      return_fee: t.movements.table.typeReturnFee ?? 'Comissió devolució',
    };

    const excelData = visibleTransactions.map(tx => {
      const contact = tx.contactId ? contactMap[tx.contactId] : null;
      return {
        [exportCols.date]: formatDate(tx.date),
        [exportCols.description]: tx.description || '',
        [exportCols.amount]: tx.amount,
        [exportCols.category]: tx.category ? getCategoryDisplayName(tx.category) : '',
        [exportCols.contact]: contact?.name || '',
        [exportCols.contactType]: contact?.type ? (contactTypeLabels[contact.type] || contact.type) : '',
        [exportCols.project]: tx.projectId ? (projectMap[tx.projectId] || '') : '',
        [exportCols.bankAccount]: tx.bankAccountId ? (bankAccountMap[tx.bankAccountId] || '') : '',
        [exportCols.source]: tx.source ? (sourceLabels[tx.source] || tx.source) : '',
        [exportCols.transactionType]: tx.transactionType ? (txTypeLabels[tx.transactionType] || tx.transactionType) : '',
        [exportCols.transactionId]: tx.id,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, t.movements.table.excelSheetName);

    // Ajustar amplada de columnes
    const colWidths = [
      { wch: 12 },  // Data
      { wch: 45 },  // Descripció
      { wch: 12 },  // Import
      { wch: 22 },  // Categoria
      { wch: 28 },  // Contacte
      { wch: 12 },  // Tipus contacte
      { wch: 22 },  // Projecte
      { wch: 20 },  // Compte bancari
      { wch: 10 },  // Origen
      { wch: 14 },  // Tipus
      { wch: 24 },  // ID transacció
    ];
    worksheet['!cols'] = colWidths;

    const fileName = t.movements.table.filteredExcelFileName({
      date: new Date().toISOString().split('T')[0],
    });
    XLSX.writeFile(workbook, fileName);

    toast({
      title: t.movements.table.exportSuccess,
      description: t.movements.table.exportedCount(visibleTransactions.length),
    });
  };

  const handleExportExpensesWithoutDoc = () => {
    if (expensesWithoutDoc.length === 0) {
      toast({ title: t.movements.table.noExpensesWithoutDocument, description: t.movements.table.allExpensesHaveProof });
      return;
    }

    const headers = [t.movements.table.date, t.movements.table.amount, t.movements.table.bankConcept, t.movements.table.noteLabel, t.movements.table.contact, t.movements.table.category, t.movements.table.project];
    const rows = expensesWithoutDoc.map(tx => [
      formatDate(tx.date),
      tx.amount.toString().replace('.', ','),
      `"${tx.description.replace(/"/g, '""')}"`,
      `"${(tx.note || '').replace(/"/g, '""')}"`,
      tx.contactId && contactMap[tx.contactId] ? contactMap[tx.contactId].name : '',
      tx.category ? getCategoryDisplayName(tx.category) : '',
      tx.projectId && projectMap[tx.projectId] ? projectMap[tx.projectId] : '',
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = t.movements.table.expensesWithoutDocumentFileName({
      date: new Date().toISOString().split('T')[0],
    });
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: t.movements.table.expensesExportedTitle,
      description: t.movements.table.expensesExportedDescription(expensesWithoutDoc.length),
    });
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      return date.toLocaleDateString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const handleSplitRemittance = (transaction: Transaction) => {
    setTransactionToSplit(transaction);
    setIsSplitterOpen(true);
  };

  const handleSplitAmount = React.useCallback((transaction: Transaction) => {
    if (!transaction.bankAccountId) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: tr('movements.split.missingBankAccount'),
      });
      return;
    }

    setSplitAmountTransaction(transaction);
    setIsSplitAmountDialogOpen(true);
  }, [t.common.error, toast, tr]);

  const handleOpenSplitDetail = React.useCallback((txId: string) => {
    setSplitDetailParentTxId(txId);
    setIsSplitDetailDialogOpen(true);
  }, []);

  const handleUndoSplit = React.useCallback(async (parentTxId: string) => {
    if (!organizationId || !user?.uid) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: 'No es pot desfer el desglossament ara mateix.',
      });
      return;
    }

    setIsUndoSplitProcessing(true);
    try {
      const result = await undoSplit({
        firestore,
        orgId: organizationId,
        parentTxId,
        userId: user.uid,
      });

      if (!result.success) {
        toast({
          variant: 'destructive',
          title: t.common.error,
          description: result.error || 'No s\'ha pogut desfer el desglossament.',
        });
        return;
      }

      if (result.idempotent) {
        toast({
          title: 'Ja estava desfet',
          description: 'Aquest desglossament ja no tenia línies actives.',
        });
      } else {
        toast({
          title: 'Desglossament desfet',
          description: `S'han arxivat ${result.archivedChildren} línies derivades.`,
        });
      }

      setIsSplitDetailDialogOpen(false);
      setSplitDetailParentTxId(null);
    } finally {
      setIsUndoSplitProcessing(false);
    }
  }, [organizationId, user?.uid, t.common.error, toast, firestore, user]);

  const handleGenerateReturnEmailDraft = React.useCallback((transaction: Transaction) => {
    if (transaction.transactionType !== 'return') return;
    if (!transaction.contactId) return;
    if (transaction.isRemittance === true) return;

    const contactName =
      (transaction as Transaction & { contactName?: string | null }).contactName?.trim()
      || contactMap[transaction.contactId]?.name
      || null;
    const txDate = getDisplayDate(transaction);
    const draft = buildReturnEmailDraft({
      contactName,
      txDate,
      amount: transaction.amount,
      language,
      organizationReturnTemplate: organization?.returnEmailTemplate ?? null,
    });

    setReturnEmailDraftBody(draft);
    setIsReturnEmailDraftDialogOpen(true);
  }, [contactMap, getDisplayDate, language, organization?.returnEmailTemplate]);

  const handleOnSplitDone = () => {
    setIsSplitterOpen(false);
    setTransactionToSplit(null);
  };

  const isSplitDeleteBlockedInMemory = React.useCallback((transaction: Transaction): boolean => {
    if (transaction.isSplit) return true;
    if (!transaction.parentTransactionId) return false;
    return !!allTransactionsById[transaction.parentTransactionId]?.isSplit;
  }, [allTransactionsById]);

  const getDeleteBlockedMessage = React.useCallback((reason: DeleteTransactionBlockedReason | null): string | null => {
    if (reason === 'parentRemittance') {
      return tr('movements.delete.blocked.parentRemittance');
    }
    if (reason === 'childRemittance') {
      return tr('movements.delete.blocked.childRemittance');
    }
    return null;
  }, [tr]);

  const handleDeleteWithSplitGuard = React.useCallback((transaction: Transaction) => {
    const blockedReason = getDeleteTransactionBlockedReason(transaction);
    const blockedMessage = getDeleteBlockedMessage(blockedReason);
    if (blockedMessage) {
      toast({
        variant: 'destructive',
        title: tr('movements.delete.blocked.title'),
        description: blockedMessage,
      });
      return;
    }

    if (isSplitDeleteBlockedInMemory(transaction)) {
      toast({
        variant: 'destructive',
        title: tr('movements.delete.blocked.title'),
        description: tr('movements.split.deleteBlocked'),
      });
      return;
    }

    handleDeleteClick(transaction);
  }, [getDeleteBlockedMessage, handleDeleteClick, isSplitDeleteBlockedInMemory, toast, tr]);

  const handleViewRemittanceDetail = (remittanceId: string, parentTx?: Transaction) => {
    setSelectedRemittanceId(remittanceId);
    setRemittanceDetailParentTx(parentTx || null);
    setIsRemittanceDetailOpen(true);
  };

  // Desfer remesa/Stripe: obre diàleg de confirmació
  const handleUndoRemittance = async (transaction: Transaction) => {
    if (!organizationId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No es pot desfer: falta informació',
      });
      return;
    }

    // Detectar el tipus d'operació
    const opType = detectUndoOperationType(transaction);
    if (!opType) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No es pot desfer aquesta transacció',
      });
      return;
    }

    // Comptar filles
    const childCount = await countChildTransactions(
      firestore,
      organizationId,
      transaction.id,
      transaction.remittanceId
    );

    if (childCount === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No s\'han trobat transaccions filles per desfer',
      });
      return;
    }

    // Obrir diàleg de confirmació
    setUndoTransaction(transaction);
    setUndoChildCount(childCount);
    setIsUndoDialogOpen(true);
  };

  // Executar l'undo quan l'usuari confirma
  const handleUndoConfirm = async () => {
    if (!undoTransaction || !organizationId || !user?.uid) return;

    const opType = detectUndoOperationType(undoTransaction);
    if (!opType) return;

    setIsUndoProcessing(true);

    try {
      // Per remeses IN (amount > 0), usar API server-side
      // Per Stripe i devolucions, mantenir flux client-side
      if (opType === 'remittance_in' && undoTransaction.amount > 0) {
        await handleUndoServerSide();
      } else {
        await handleUndoClientSide(opType);
      }
    } finally {
      setIsUndoProcessing(false);
    }
  };

  // Undo server-side per remeses IN
  const handleUndoServerSide = async () => {
    if (!undoTransaction || !organizationId || !user) return;

    try {
      const idToken = await user.getIdToken();

      const response = await fetch('/api/remittances/in/undo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          orgId: organizationId,
          parentTxId: undoTransaction.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({
          variant: 'destructive',
          title: 'Error desfent processament',
          description: result.error || 'Error desconegut',
        });
        return;
      }

      if (result.idempotent) {
        toast({
          title: 'Ja estava desfet',
          description: 'Aquesta remesa ja s\'havia desfet anteriorment.',
        });
      } else {
        toast({
          title: 'Processament desfet',
          description: `S'han arxivat ${result.archivedCount} transaccions. Pots processar de nou.`,
        });
      }

      setIsUndoDialogOpen(false);
      setUndoTransaction(null);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconegut';
      console.error('Error undoing processing (server-side):', error);
      toast({
        variant: 'destructive',
        title: 'Error desfent processament',
        description: errorMessage,
      });
    }
  };

  // Undo client-side per Stripe, devolucions i remeses OUT
  const handleUndoClientSide = async (opType: UndoOperationType) => {
    if (!undoTransaction || !organizationId || !user?.uid) return;

    try {
      const result = await executeUndo(undoTransaction, opType, {
        firestore,
        orgId: organizationId,
        userId: user.uid,
      });

      if (result.success) {
        const description = opType === 'returns'
          ? `S'han eliminat ${result.childrenDeleted} devolucions filles. Pots processar de nou.`
          : `S'han arxivat ${result.childrenArchived} transaccions fiscals${result.childrenDeleted > 0 ? ` i eliminat ${result.childrenDeleted} no fiscals` : ''}. Pots processar de nou.`;
        toast({
          title: 'Processament desfet',
          description,
        });
        setIsUndoDialogOpen(false);
        setUndoTransaction(null);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error desfent processament',
          description: result.error || 'Error desconegut',
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconegut';
      console.error('Error undoing processing:', error);
      toast({
        variant: 'destructive',
        title: 'Error desfent processament',
        description: errorMessage,
      });
    }
  };

  // Stripe imputation handlers
  const handleSplitStripeRemittance = (transaction: Transaction) => {
    setStripeTransactionToSplit(transaction);
    setIsStripeImputationOpen(true);
  };

  const handleStripeImportDone = () => {
    setIsStripeImputationOpen(false);
    setStripeTransactionToSplit(null);
  };

  // SEPA Reconcile handler
  const handleReconcileSepa = (tx: Transaction) => {
    const remittance = detectedSepaRemittances.get(tx.id);
    if (!remittance) return;

    setSepaReconcileTx(tx);
    setSepaReconcileRemittance(remittance);
  };

  const handleSepaReconcileComplete = () => {
    setSepaReconcileTx(null);
    setSepaReconcileRemittance(null);
    // Recarregar les remeses pre-banc (esborra la que s'ha reconciliat)
    setDetectedSepaRemittances(new Map());
  };

  const hasUncategorized = React.useMemo(() =>
    transactions?.some(tx => !tx.category || tx.category === 'Revisar'),
  [transactions]);

  // Memoized categories map per tipus
  const categoriesByType = React.useMemo(() => ({
    income: availableCategories?.filter(c => c.type === 'income') || [],
    expense: availableCategories?.filter(c => c.type === 'expense') || [],
  }), [availableCategories]);

  // Memoized translations object for TransactionRow
  const rowTranslations = React.useMemo(() => ({
    date: t.movements.table.date,
    amount: t.movements.table.amount,
    balance: tr('movements.table.balance'),
    returnBadge: t.movements.table.returnBadge,
    returnAssignedTooltip: t.movements.table.returnAssignedTooltip,
    pendingDonorAssignment: t.movements.table.pendingDonorAssignment,
    commissionBadge: t.movements.table.commissionBadge,
    bankCommissionReturn: t.movements.table.bankCommissionReturn,
    returnedDonation: t.movements.table.returnedDonation,
    returnedDonationInfo: t.movements.table.returnedDonationInfo,
    assign: t.movements.table.assign,
    assignDonor: t.movements.table.assignDonor || 'Assignar donant',
    assignDonorTooltip: t.movements.table.assignDonorTooltip || 'Assigna el donant afectat per aquesta devolució',
    remittanceUseImporter: t.movements.table.remittanceUseImporter || 'Aquesta devolució forma part d\'una remesa. Fes servir "Importar fitxer del banc" per desglossar-la.',
    uploadBankFile: t.movements.table.uploadBankFile || 'Pujar fitxer',
    uploadBankFileTooltip: t.movements.table.uploadBankFileTooltip || 'Importar fitxer del banc per identificar devolucions',
    unlink: t.movements.table.unlink,
    searchCategory: t.movements.table.searchCategory,
    noResults: t.movements.table.noResults,
    suggestWithAI: t.movements.table.suggestWithAI,
    categorize: t.movements.table.categorize,
    uncategorized: t.movements.table.uncategorized,
    viewDocument: t.movements.table.viewDocument,
    addNote: t.movements.table.addNote,
    editNote: t.movements.table.editNote,
    attachProof: t.movements.table.attachProof,
    attachDocument: t.movements.table.attachDocument,
    deleteDocument: t.movements.table.deleteDocument,
    manageReturn: t.movements.table.manageReturn,
    generateReturnEmail: tr('returns.emailDraft.action'),
    edit: t.movements.table.edit,
    splitAmount: tr('movements.split.action'),
    splitRemittance: t.movements.table.splitRemittance,
    splitPaymentRemittance: t.movements.table.splitPaymentRemittance,
    splitStripeRemittance: t.movements.table.splitStripeRemittance,
    delete: t.movements.table.delete,
    deleteBlocked: tr('movements.split.deleteBlocked'),
    deleteBlockedParentRemittance: tr('movements.delete.blocked.parentRemittance'),
    deleteBlockedChildRemittance: tr('movements.delete.blocked.childRemittance'),
    viewRemittanceDetail: t.movements.table.viewRemittanceDetail,
    remittanceQuotes: t.movements.table.remittanceQuotes,
    remittanceProcessedLabel: t.movements.table.remittanceProcessedLabel,
    remittanceNotApplicable: t.movements.table.remittanceNotApplicable,
    splitProcessedLabel: 'Desglossat',
    undoRemittance:
      (t.movements.table as typeof t.movements.table & { undoRemittance?: string }).undoRemittance ||
      'Desfer remesa',
    undoSplit: 'Desfer desglossament',
    moreOptionsAriaLabel: t.movements.table.moreOptionsAriaLabel,
    legacyCategory: t.movements?.table?.legacyCategory ?? 'Cal recategoritzar',
    noContact: t.movements.table.noContact,
  }), [t, tr]);

  // Memoized filter translations
  const filterTranslations = React.useMemo(() => ({
    categorizeAll: t.movements.table.categorizeAll,
    all: t.movements.table.all,
    returns: t.movements.table.returns,
    pendingReturns: t.movements.table.pendingReturns || 'Devolucions pendents',
    withoutDocument: t.movements.table.withoutDocument,
    uncategorized: t.movements.table.uncategorized,
    noContact: t.movements.table.noContact,
    donationsNoContact: t.movements.table.donationsNoContact || 'Donaciones sin contacto',
    pendingFilters: t.movements.table.pendingFilters,
    exportTooltip: t.movements.table.exportTooltip,
    importReturnsFile: t.movements.table.uploadBankFile,
    allAccounts: t.settings.bankAccounts.allAccounts,
    // New translations for reorganized UI
    filtersTitle: t.movements.table.filtersTitle || 'Filtres',
    filtersDescription: t.movements.table.filtersDescription || 'Filtra els moviments per tipus, origen o compte',
    clearFilters: t.movements.table.clearFilters || 'Netejar filtres',
    applyFilters: t.movements.table.applyFilters || 'Aplicar',
    filterByType: t.movements.table.filterByType || 'Tipus de moviment',
    filterBySource: t.movements.table.filterBySource || 'Origen',
    filterByAccount: t.movements.table.filterByAccount || 'Compte bancari',
    pendingTasks: t.movements.table.pendingTasks || 'Tasques pendents',
    // Quick filters (shortcuts)
    onlyExpenses: t.movements.table.onlyExpenses,
    expensesWithoutDocument: t.movements.table.expensesWithoutDocument,
    expensesWithoutDocumentTooltip: t.movements.table.expensesWithoutDocumentTooltip,
    // Batch categorization controls
    stopProcessAriaLabel: t.movements.table.stopProcessAriaLabel,
    stopButton: t.movements.table.stopButton,
    stopProcessTooltip: t.movements.table.stopProcessTooltip,
    suggestCategoriesAriaLabel: t.movements.table.suggestCategoriesAriaLabel,
    suggestCategoriesTooltip: t.movements.table.suggestCategoriesTooltip,
    // Bulk mode controls (SuperAdmin)
    bulkModeAriaLabel: t.movements.table.bulkModeAriaLabel,
    bulkModeLabel: t.movements.table.bulkModeLabel,
    bulkModeTooltip: t.movements.table.bulkModeTooltip,
    // Archived toggle (SuperAdmin)
    showArchivedAriaLabel: t.movements.table.showArchivedAriaLabel,
    showArchivedLabel: t.movements.table.showArchivedLabel,
    showArchivedTooltip: t.movements.table.showArchivedTooltip,
    // Source filter labels
    sourceAll: t.movements.table.sourceAll,
    sourceBank: t.movements.table.sourceBank,
    sourceRemittance: t.movements.table.sourceRemittance,
    sourceManual: t.movements.table.sourceManual,
    sourceStripe: t.movements.table.sourceStripe,
    sourceEmpty: t.movements.table.sourceEmpty,
  }), [t]);

  return (
    <TooltipProvider>
      {/* ═══════════════════════════════════════════════════════════════════════
          SECCIÓ: Barra principal (Períodes + Cerca + Compte bancari)
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="mb-4 w-full">
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="shrink-0">
            <DateFilter value={dateFilter} onChange={setDateFilter} />
          </div>

          <div className="relative w-full lg:min-w-[420px] lg:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.movements.table.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 pl-10 pr-10 text-base"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {bankAccounts.length > 0 && (
            <div className="w-full lg:w-[280px] lg:shrink-0">
              <Select value={bankAccountFilter} onValueChange={setBankAccountFilter}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder={t.settings.bankAccounts.allAccounts} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t.settings.bankAccounts.allAccounts}</SelectItem>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECCIÓ: Treball actiu (Cerca + Classificar + Mode ràpid + Filtres + Opcions)
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="mb-4">
        <TransactionsFilters
          currentFilter={tableFilter}
          onFilterChange={setTableFilter}
          totalCount={transactions?.length || 0}
          returnsCount={returnTransactions.length}
          pendingReturnsCount={pendingReturns.length}
          expensesWithoutDocCount={expensesWithoutDoc.length}
          uncategorizedCount={uncategorizedTransactions.length}
          noContactCount={noContactTransactions.length}
          donationsNoContactCount={donationsNoContactTransactions.length}
          hasUncategorized={hasUncategorized ?? false}
          isBatchCategorizing={isBatchCategorizing}
          onBatchCategorize={handleBatchCategorize}
          onCancelBatch={handleCancelBatch}
          onExportExpensesWithoutDoc={handleExportExpensesWithoutDoc}
          onOpenReturnImporter={() => setIsReturnImporterOpen(true)}
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
          bankAccountFilter={bankAccountFilter}
          onBankAccountFilterChange={setBankAccountFilter}
          isSuperAdmin={isSuperAdmin}
          isBulkMode={isBulkMode}
          onBulkModeChange={handleBulkModeChange}
          batchProgress={batchProgress}
          showArchived={showArchived}
          onShowArchivedChange={setShowArchived}
          t={filterTranslations}
        />
      </div>

      {/* Avís devolucions pendents - flux únic simplificat */}
      {pendingReturns.length > 0 && tableFilter !== 'pendingReturns' && (
        <div className="mb-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <Undo2 className="h-5 w-5 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                {t.pendingReturnsAlert.title}
              </p>
              <p className="text-xs text-red-600">
                {t.pendingReturnsAlert.description(pendingReturns.length)}
              </p>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => setTableFilter('pendingReturns')}
              className="bg-red-600 hover:bg-red-700"
            >
              {t.pendingReturnsAlert.review}
            </Button>
          </div>
        </div>
      )}

      {hasLocalOnlyFilter && !canRenderResolvedResults && (
        <div className="mb-4 px-4 py-3 border rounded-lg bg-muted/40 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3 text-sm">
            {isResolvingLocalFilters ? (
              <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
            )}
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                {isResolvingLocalFilters
                  ? 'Carregant més moviments'
                  : 'No s\'han pogut completar els filtres locals'}
              </p>
              <p className="text-muted-foreground">
                {isResolvingLocalFilters
                  ? 'Alguns filtres avançats encara necessiten recórrer més pàgines perquè no tenen suport complet al backend en aquesta iteració.'
                  : 'Reintenta la càrrega o neteja aquests filtres locals per evitar un resultat parcial.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {autoLoadBlockedByError && hasMoreTransactions && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMoreTransactions}
                disabled={isLoadingMoreTransactions}
              >
                {isLoadingMoreTransactions ? t.common.loading : 'Reintenta'}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              {t.movements.table.clearFilters}
            </Button>
          </div>
        </div>
      )}

      {/* Barra de resum quan hi ha filtre actiu */}
      {filteredSummary && (
        <div className="mb-4 px-4 py-2 bg-muted/50 border rounded-lg flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {/* Context: filtre per contactId des de fitxa donant */}
            {contactIdFilter && contactMap[contactIdFilter] && (
              <span className="text-orange-600 font-medium">
                Devolucions de {contactMap[contactIdFilter].name}
              </span>
            )}
            <span>
              {t.movements.table.showingOf(filteredSummary.showing, filteredSummary.total)}
            </span>
            <span className="hidden md:inline text-muted-foreground/50">·</span>
            <span>
              {t.movements.table.income}: <span className="text-green-600 font-medium">{formatCurrencyEU(filteredSummary.income)}</span>
            </span>
            <span className="hidden md:inline text-muted-foreground/50">·</span>
            <span>
              {t.movements.table.expenses}: <span className="text-red-600 font-medium">{formatCurrencyEU(filteredSummary.expenses)}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleExportFilteredTransactions}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.movements.table.exportFiltered}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={clearAllFilters}
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.movements.table.clearFilters}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          BARRA D'ACCIONS EN BLOC
          ═══════════════════════════════════════════════════════════════════════ */}
      {canBulkEdit && selectedCount > 0 && (
        <div className="mb-4 px-4 py-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {bulkT?.selected(selectedCount) ?? `${selectedCount} seleccionat${selectedCount > 1 ? 's' : ''}`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="text-muted-foreground h-7"
            >
              <X className="h-3 w-3 mr-1" />
              {bulkT?.deselectAll ?? 'Deseleccionar'}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenBulkCategoryDialog}
              disabled={isBulkUpdating || isBulkDeleting || bulkSelectionType === 'mixed' || !availableCategories}
              className="h-8"
              aria-label={`Assignar categoria a ${selectedCount} moviments`}
              title={bulkSelectionType === 'mixed' ? (bulkT?.mixedTypesWarning ?? 'La selecció inclou ingressos i despeses. Desselecciona per assignar categoria.') : undefined}
            >
              <Tag className="h-3.5 w-3.5 mr-1.5" />
              {bulkSelectionType === 'mixed'
                ? (bulkT?.mixedTypesWarning ?? 'Ingressos i despeses barrejats')
                : (bulkT?.assignCategory ?? 'Assignar categoria...')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulkRemoveCategory}
              disabled={isBulkUpdating || isBulkDeleting}
              className="h-8 text-muted-foreground hover:text-destructive"
              aria-label={`Treure categoria de ${selectedCount} moviments`}
            >
              {isBulkUpdating ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
              )}
              {bulkT?.removeCategory ?? 'Treure categoria'}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsBulkDeleteDialogOpen(true)}
              disabled={isBulkUpdating || isBulkDeleting || deletableSelectedCount === 0}
              className="h-8"
              aria-label={`Eliminar ${deletableSelectedCount} moviments seleccionats`}
            >
              {isBulkDeleting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              {bulkT?.deleteSelected ?? 'Eliminar seleccionats'}
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          LLISTA MÒBIL (stacked rows) - < 768px
          ═══════════════════════════════════════════════════════════════════════ */}
      {isMobile && (
        <div className="space-y-2">
          {/* Loading skeleton mòbil */}
          {isLoadingTransactions && !pagedTransactions && (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={`skeleton-mobile-${i}`} className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </div>
            ))
          )}

          {/* Llista de transaccions mòbil */}
          {!isLoadingTransactions && visibleTransactions.map((tx) => (
            <TransactionRowMobile
              key={tx.id}
              transaction={tx}
              contactName={tx.contactId ? contactMap[tx.contactId]?.name || null : null}
              contactType={tx.contactId ? contactMap[tx.contactId]?.type || null : null}
              categoryDisplayName={getCategoryDisplayName(tx.category)}
              onEdit={handleEditClick}
              onDelete={handleDeleteWithSplitGuard}
              onSplitRemittance={handleSplitRemittance}
              onSplitAmount={handleSplitAmount}
              onSplitStripeRemittance={handleSplitStripeRemittance}
              onOpenSplitDetail={handleOpenSplitDetail}
              onUndoSplit={handleUndoSplit}
              onUndoRemittance={handleUndoRemittance}
              isSplitDeleteBlocked={isSplitDeleteBlockedInMemory(tx)}
              deleteBlockedReason={getDeleteTransactionBlockedReason(tx)}
              onOpenReturnDialog={handleOpenReturnDialog}
              onGenerateReturnEmailDraft={handleGenerateReturnEmailDraft}
              onViewRemittanceDetail={handleViewRemittanceDetail}
              onAttachDocument={handleAttachDocumentWithRename}
              t={rowTranslations}
            />
          ))}

          {/* Empty state mòbil */}
          {!isLoadingTransactions && canRenderResolvedResults && visibleTransactions.length === 0 && (
            <EmptyState
              icon={tableFilter === 'missing' ? FileX : tableFilter === 'returns' ? Undo : Search}
              title={
                tableFilter === 'missing'
                  ? t.movements.table.allExpensesHaveProofEmpty
                  : tableFilter === 'returns'
                  ? t.movements.table.noReturns
                  : (t.emptyStates?.movements?.noResults ?? t.movements.table.noTransactions)
              }
              description={
                tableFilter !== 'missing' && tableFilter !== 'returns'
                  ? (t.emptyStates?.movements?.noResultsDesc ?? undefined)
                  : undefined
              }
              className="py-12"
            />
          )}

        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAULA DE TRANSACCIONS (desktop/tablet) - >= 768px
          ═══════════════════════════════════════════════════════════════════════ */}
      {!isMobile && (
        <div className="w-full rounded-md border table-scroll-stable overflow-hidden [&>div]:overflow-visible [&>div]:overflow-x-hidden">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="h-9">
                {/* Checkbox columna - només visible per admin/user */}
                {canBulkEdit && (
                  <TableHead className="w-[40px] py-2 px-2">
                    <Checkbox
                      checked={checkboxState === 'checked'}
                      ref={(el) => {
                        if (el) {
                          (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = checkboxState === 'indeterminate';
                        }
                      }}
                      onCheckedChange={() => toggleAllVisible(selectableVisibleIds)}
                      disabled={selectableVisibleIds.length === 0}
                      aria-label={allVisibleSelected ? bulkT?.deselectAll ?? 'Deseleccionar tots' : bulkT?.selectAll ?? 'Seleccionar tots'}
                      className="h-4 w-4"
                    />
                  </TableHead>
                )}
                <TableHead className="w-[90px] py-2">
                  <button
                    onClick={() => setSortDateAsc(!sortDateAsc)}
                    className="flex items-center gap-1 hover:text-foreground transition-colors text-xs"
                  >
                    {t.movements.table.date}
                    {sortDateAsc ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="w-[110px] text-right py-2 whitespace-nowrap">{t.movements.table.amount}</TableHead>
                <TableHead className="w-[120px] text-right py-2 whitespace-nowrap">{tr('movements.table.balance')}</TableHead>
                <TableHead className="py-2 min-w-0">{t.movements.table.concept}</TableHead>
                <TableHead className="w-[180px] py-2 hidden lg:table-cell">{t.movements.table.contact}</TableHead>
                <TableHead className="w-[160px] py-2 hidden lg:table-cell">{t.movements.table.category}</TableHead>
                {showProjectColumn && (
                  <TableHead className="w-[100px] py-2 hidden lg:table-cell">
                    {t.movements.table.project}
                  </TableHead>
                )}
                <TableHead className="w-7 shrink-0 text-center py-2"><span className="sr-only">Document</span></TableHead>
                <TableHead className="w-9 shrink-0 text-right py-2 pr-2"><span className="sr-only">{t.movements.table.actions}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleTransactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  contactName={tx.contactId ? contactMap[tx.contactId]?.name || null : null}
                  contactType={tx.contactId ? contactMap[tx.contactId]?.type || null : null}
                  projectName={tx.projectId ? projectMap[tx.projectId] || null : null}
                  relevantCategories={tx.amount > 0 ? categoriesByType.income : categoriesByType.expense}
                  isLegacyCategory={!!tx.category && !availableCategories?.some(c => c.id === tx.category)}
                  categoryTranslations={categoryTranslations}
                  comboboxContacts={comboboxContacts}
                  availableProjects={availableProjects}
                  showProjectColumn={showProjectColumn}
                  isDocumentLoading={docLoadingStates[tx.id] || false}
                  isCategoryLoading={loadingStates[tx.id] || Boolean(inlineUpdatePendingByTxId[tx.id])}
                  isContactLoading={Boolean(inlineUpdatePendingByTxId[tx.id])}
                  isSelected={canBulkEdit ? selectedIds.has(tx.id) : undefined}
                  isSelectionDisabled={canBulkEdit ? isBulkSelectionBlocked(tx) : undefined}
                  onToggleSelect={canBulkEdit ? toggleOne : undefined}
                  onDropFile={canBulkEdit ? handleDropFile : undefined}
                  dropHint={t.movements.table.dropToAttach || 'Deixa anar per adjuntar'}
                  onSetNote={handleSetNote}
                  onSetCategory={handleSetCategory}
                  onSetContact={handleSetContact}
                  onSetProject={handleSetProject}
                  onAttachDocument={handleAttachDocumentWithRename}
                  onDeleteDocument={handleDeleteDocument}
                  onCategorize={handleCategorize}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteWithSplitGuard}
                  onOpenReturnDialog={handleOpenReturnDialog}
                  onGenerateReturnEmailDraft={handleGenerateReturnEmailDraft}
                  onSplitAmount={handleSplitAmount}
                  onSplitRemittance={handleSplitRemittance}
                  onSplitStripeRemittance={handleSplitStripeRemittance}
                  onOpenSplitDetail={handleOpenSplitDetail}
                  onUndoSplit={handleUndoSplit}
                  onViewRemittanceDetail={handleViewRemittanceDetail}
                  onUndoRemittance={handleUndoRemittance}
                  onCreateNewContact={handleOpenNewContactDialog}
                  onOpenReturnImporter={(parentTx?: Transaction) => {
                    setReturnImporterParentTx(parentTx || tx); // Mode contextual: usa la tx actual
                    setIsReturnImporterOpen(true);
                  }}
                  detectedPrebankRemittance={detectedSepaRemittances.get(tx.id) ? {
                    id: detectedSepaRemittances.get(tx.id)!.id,
                    nbOfTxs: detectedSepaRemittances.get(tx.id)!.nbOfTxs,
                    ctrlSum: detectedSepaRemittances.get(tx.id)!.ctrlSum,
                  } : null}
                  onReconcileSepa={handleReconcileSepa}
                  isSplitDeleteBlocked={isSplitDeleteBlockedInMemory(tx)}
                  deleteBlockedReason={getDeleteTransactionBlockedReason(tx)}
                  t={rowTranslations}
                  getCategoryDisplayName={getCategoryDisplayName}
                />
              ))}
              {/* Skeleton loading state */}
              {isLoadingTransactions && !pagedTransactions && (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {canBulkEdit && <TableCell className="w-10"><Skeleton className="h-4 w-4" /></TableCell>}
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full max-w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    {showProjectColumn && <TableCell><Skeleton className="h-4 w-24" /></TableCell>}
                    <TableCell><Skeleton className="h-5 w-5 rounded" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
                  </TableRow>
                ))
              )}
              {/* Empty state (only when not loading) */}
              {!isLoadingTransactions && canRenderResolvedResults && visibleTransactions.length === 0 && (
                  <TableRow>
                      <TableCell colSpan={(canBulkEdit ? 9 : 8) + (showProjectColumn ? 1 : 0)} className="p-0">
                        <EmptyState
                          icon={tableFilter === 'missing' ? FileX : tableFilter === 'returns' ? Undo : Search}
                          title={
                            tableFilter === 'missing'
                              ? t.movements.table.allExpensesHaveProofEmpty
                              : tableFilter === 'returns'
                              ? t.movements.table.noReturns
                              : (t.emptyStates?.movements?.noResults ?? t.movements.table.noTransactions)
                          }
                          description={
                            tableFilter !== 'missing' && tableFilter !== 'returns'
                              ? (t.emptyStates?.movements?.noResultsDesc ?? undefined)
                              : undefined
                          }
                          className="border-0 rounded-none py-12"
                        />
                      </TableCell>
                  </TableRow>
               )}
            </TableBody>
          </Table>
        </div>
      )}

      {hasMoreTransactions && !hasLocalOnlyFilter && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={handleLoadMoreTransactions}
            disabled={isLoadingMoreTransactions}
          >
            {isLoadingMoreTransactions ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.common.loading}
              </>
            ) : (
              tr('common.loadMore', 'Carregar més')
            )}
          </Button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          DIÀLEGS
          ═══════════════════════════════════════════════════════════════════════ */}

      {/* Bulk Assign Category Dialog */}
      <Dialog open={isBulkCategoryDialogOpen} onOpenChange={setIsBulkCategoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              {bulkT?.assignCategoryTitle ?? 'Assignar categoria'}
            </DialogTitle>
            <DialogDescription>
              {bulkT?.assignCategoryDescription ?? 'Selecciona la categoria que vols assignar als moviments seleccionats.'}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Select value={bulkCategoryId ?? undefined} onValueChange={setBulkCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder={bulkT?.selectCategoryPlaceholder ?? 'Selecciona una categoria...'} />
              </SelectTrigger>
              <SelectContent>
                {bulkAvailableCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {categoryTranslations[cat.name] || cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{bulkT?.cancel ?? 'Cancel·lar'}</Button>
            </DialogClose>
            <Button
              onClick={handleApplyBulkCategory}
              disabled={!bulkCategoryId || isBulkUpdating}
            >
              {isBulkUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {bulkT?.apply ?? 'Aplicar'}...
                </>
              ) : (
                bulkT?.apply ?? 'Aplicar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!open && !isBulkDeleting) setIsBulkDeleteDialogOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkT?.confirmDeleteTitle
                ? bulkT.confirmDeleteTitle(deletableSelectedCount)
                : `Eliminar ${deletableSelectedCount} moviment${deletableSelectedCount > 1 ? 's' : ''}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkT?.confirmDeleteDescription
                ? bulkT.confirmDeleteDescription(deletableSelectedCount, blockedSelectedCount)
                : `Aquesta acció no es pot desfer.${blockedSelectedCount > 0 ? ` ${blockedSelectedCount} seleccionat${blockedSelectedCount > 1 ? 's' : ''} no es poden eliminar i es descartaran.` : ''}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setIsBulkDeleteDialogOpen(false)}
              disabled={isBulkDeleting}
            >
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteSelected}
              disabled={isBulkDeleting || deletableSelectedCount === 0}
            >
              {isBulkDeleting
                ? (bulkT?.deleting ?? 'Eliminant...')
                : (bulkT?.confirmDeleteAction ?? t.common.delete)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Return Assignment Dialog */}
      <Dialog open={isReturnDialogOpen} onOpenChange={(open) => !open && handleCloseReturnDialog()}>
        <DialogContent className="w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader className="min-w-0 pr-8">
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Undo2 className="h-5 w-5" />
              {canUseManualSplit
                ? (t.movements.table.manageReturn || 'Gestionar devolució')
                : t.movements.table.assignAffectedDonor}
            </DialogTitle>
            <DialogDescription>
              {canUseManualSplit
                ? 'Assignació simple o múltiple dins del mateix modal. La suma de les filles ha de quadrar exactament amb el pare.'
                : t.movements.table.assignAffectedDonorDescription}
            </DialogDescription>
          </DialogHeader>
          
          {returnTransaction && (
            <div className="min-w-0 space-y-4 py-4">
              {/* Info de la devolució */}
              <div className="min-w-0 overflow-hidden rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-medium text-red-800">{t.movements.table.returnInfo}</p>
                <p className="break-words text-sm text-red-600">{returnTransaction.description}</p>
                <p className="text-lg font-bold text-red-700 mt-1">
                  {formatCurrencyEU(returnTransaction.amount)}
                </p>
                <p className="text-xs text-red-500">{formatDate(returnTransaction.date)}</p>
              </div>

              {canUseManualSplit && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={returnMode === 'single' ? 'default' : 'outline'}
                      onClick={() => setReturnMode('single')}
                    >
                      Assignació simple
                    </Button>
                    <Button
                      type="button"
                      variant={returnMode === 'multi' ? 'default' : 'outline'}
                      onClick={() => setReturnMode('multi')}
                    >
                      Assignació múltiple
                    </Button>
                  </div>
                </div>
              )}

              {returnMode === 'multi' && canUseManualSplit ? (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_140px_48px] gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <span>Soci</span>
                    <span>Import</span>
                    <span className="text-right">Acció</span>
                  </div>

                  <div className="space-y-2">
                    {splitRows.map((row, index) => (
                      <div
                        key={`split-row-${index}`}
                        className="grid grid-cols-[minmax(0,1fr)_140px_48px] gap-2"
                      >
                        <DonorSearchCombobox
                          className="min-w-0"
                          donors={donors}
                          value={row.contactId}
                          onSelect={(contactId) => updateSplitRow(index, { contactId })}
                        />
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={Number.isFinite(row.amount) && row.amount !== 0 ? row.amount : ''}
                          onChange={(event) => {
                            const rawValue = event.target.value.replace(',', '.');
                            updateSplitRow(index, {
                              amount: rawValue === '' ? Number.NaN : Number(rawValue),
                            });
                          }}
                          placeholder="0,00"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSplitRow(index)}
                          aria-label={`Eliminar fila ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button type="button" variant="outline" onClick={addSplitRow}>
                      <Plus className="mr-2 h-4 w-4" />
                      Afegir soci
                    </Button>

                    <div className="text-right text-sm">
                      <p className="text-muted-foreground">
                        Suma: {formatCurrencyEU(
                          splitRows.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0)
                        )} / {formatCurrencyEU(parentReturnTotal)}
                      </p>
                      {splitValidationError ? (
                        <p className="font-medium text-red-600">{splitValidationError}</p>
                      ) : (
                        <p className="flex items-center justify-end gap-1 font-medium text-green-600">
                          <Check className="h-4 w-4" />
                          Suma correcta
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>{t.movements.table.affectedDonor}</Label>
                    <DonorSearchCombobox
                      className="min-w-0"
                      donors={donors}
                      value={returnDonorId}
                      onSelect={(donorId) => {
                        setReturnDonorId(donorId);
                        setReturnLinkedTxId(null);
                      }}
                    />
                  </div>

                  {returnDonorId && (
                    <div className="space-y-2">
                      <Label>{t.movements.table.originalDonation}</Label>
                      {isLoadingDonations ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t.movements.table.loadingDonations}
                        </div>
                      ) : donorDonations.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {t.movements.table.noDonationsFound}
                        </p>
                      ) : (
                        <Select
                          value={returnLinkedTxId || 'none'}
                          onValueChange={(v) => setReturnLinkedTxId(v === 'none' ? null : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t.movements.table.linkToDonation} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t.movements.table.noLink}</SelectItem>
                            {donorDonations.filter(d => d.id).map(donation => (
                              <SelectItem key={donation.id} value={donation.id}>
                                {formatDate(donation.date)} - {formatCurrencyEU(donation.amount)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {returnLinkedTxId && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          {t.movements.table.linkedDonationInfo}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t.common.cancel}</Button>
            </DialogClose>
            <Button 
              onClick={handleSaveReturn}
              disabled={!canSaveReturn}
            >
              {isSavingReturn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReturnEmailDraftDialog
        open={isReturnEmailDraftDialogOpen}
        onOpenChange={setIsReturnEmailDraftDialogOpen}
        initialBody={returnEmailDraftBody}
      />

      {/* Edit Transaction Dialog */}
      <EditTransactionDialog
        open={isEditDialogOpen}
        transaction={editingTransaction}
        donors={donors}
        suppliers={suppliers}
        projects={availableProjects?.filter(p => !p.archivedAt) ?? null}
        availableContacts={availableContacts}
        onSave={handleSaveEdit}
        onClose={handleCloseEditDialog}
      />

      {/* New Contact Dialog */}
      <NewContactDialog
        open={isNewContactDialogOpen}
        contactType={newContactType}
        onSave={handleSaveNewContact}
        onClose={handleCloseNewContactDialog}
      />
      
      {/* Delete Transaction Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => !open && handleCloseDeleteDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.settings.confirmDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.settings.confirmDeleteDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCloseDeleteDialog}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Document Dialog */}
      <AlertDialog open={isDeleteDocDialogOpen} onOpenChange={(open) => !open && handleCloseDeleteDocDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.movements.table.confirmDeleteDocument}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.movements.table.confirmDeleteDocumentDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCloseDeleteDocDialog}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDocConfirm}>
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remittance Splitter Dialog */}
      {transactionToSplit && availableContacts && (
        <RemittanceSplitter
          open={isSplitterOpen}
          onOpenChange={setIsSplitterOpen}
          transaction={transactionToSplit}
          existingDonors={allDonorsForRemittance}
          existingSuppliers={suppliers}
          existingEmployees={employees}
          onSplitDone={handleOnSplitDone}
        />
      )}

      {splitAmountTransaction && (
        <SplitAmountDialog
          open={isSplitAmountDialogOpen}
          onOpenChange={(open) => {
            setIsSplitAmountDialogOpen(open);
            if (!open) {
              setSplitAmountTransaction(null);
            }
          }}
          transaction={splitAmountTransaction}
          categories={availableCategories || []}
          contacts={availableContacts || []}
          onApplied={() => {
            setIsSplitAmountDialogOpen(false);
            setSplitAmountTransaction(null);
          }}
        />
      )}

      <SplitDetailDialog
        open={isSplitDetailDialogOpen}
        onOpenChange={(open) => {
          setIsSplitDetailDialogOpen(open);
          if (!open) {
            setSplitDetailParentTxId(null);
          }
        }}
        parentTransaction={splitDetailParentTx}
        splitParts={splitDetailParts}
        onUndoSplit={handleUndoSplit}
        isUndoing={isUndoSplitProcessing}
      />

      {/* Remittance Detail Modal */}
      {organizationId && (
        <RemittanceDetailModal
          open={isRemittanceDetailOpen}
          onOpenChange={setIsRemittanceDetailOpen}
          remittanceId={selectedRemittanceId}
          organizationId={organizationId}
          parentTransaction={remittanceDetailParentTx}
        />
      )}

      {/* Return Importer Modal */}
      {isReturnImporterOpen && (
        <ReturnImporter
          open={isReturnImporterOpen}
          onOpenChange={(open) => {
            setIsReturnImporterOpen(open);
            if (!open) setReturnImporterParentTx(null);
          }}
          onComplete={() => {
            setIsReturnImporterOpen(false);
            setReturnImporterParentTx(null);
          }}
          isSuperAdmin={isSuperAdmin}
          parentTransaction={returnImporterParentTx}
        />
      )}

      {/* Stripe Imputation Modal */}
      {stripeTransactionToSplit && (
        <StripeImputationModal
          open={isStripeImputationOpen}
          onOpenChange={(open) => {
            setIsStripeImputationOpen(open);
            if (!open) setStripeTransactionToSplit(null);
          }}
          bankTransaction={{
            id: stripeTransactionToSplit.id,
            amount: stripeTransactionToSplit.amount,
            date: stripeTransactionToSplit.date,
            description: stripeTransactionToSplit.description,
          }}
          donors={donors}
          onComplete={handleStripeImportDone}
        />
      )}

      {/* SEPA Reconcile Modal */}
      <SepaReconcileModal
        open={!!sepaReconcileTx}
        onOpenChange={(open) => {
          if (!open) {
            setSepaReconcileTx(null);
            setSepaReconcileRemittance(null);
          }
        }}
        transaction={sepaReconcileTx}
        prebankRemittance={sepaReconcileRemittance}
        onComplete={handleSepaReconcileComplete}
      />

      {/* Undo Processing Dialog */}
      <UndoProcessingDialog
        open={isUndoDialogOpen}
        onOpenChange={(open) => {
          if (!open && !isUndoProcessing) {
            setIsUndoDialogOpen(false);
            setUndoTransaction(null);
          }
        }}
        transaction={undoTransaction}
        operationType={undoTransaction ? detectUndoOperationType(undoTransaction) : null}
        childCount={undoChildCount}
        isProcessing={isUndoProcessing}
        onConfirm={handleUndoConfirm}
      />
      {/* Rename Suggestion Dialog */}
      <AlertDialog open={!!pendingUpload} onOpenChange={(open) => { if (!open) setPendingUpload(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.movements.table.renameDocument}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingUpload && t.movements.table.renameSuggestion({
                original: pendingUpload.file.name,
                suggested: pendingUpload.suggestedName,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleConfirmUpload(true)}>
              {t.movements.table.keepOriginal}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmUpload(false)}>
              {t.movements.table.renameAndAttach}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}

function areDateFiltersEqual(a: DateFilterValue, b: DateFilterValue): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'all') return true;
  if (a.type === 'year' || a.type === 'quarter' || a.type === 'month') {
    if (a.year !== b.year) return false;
  }
  if (a.type === 'quarter') {
    return a.quarter === b.quarter;
  }
  if (a.type === 'month') {
    return a.month === b.month;
  }
  if (a.type === 'year') {
    return true;
  }
  if (a.type === 'custom') {
    const aRange = a.customRange;
    const bRange = (b as DateFilterValue).customRange;
    const aFrom = aRange?.from?.getTime() ?? null;
    const bFrom = bRange?.from?.getTime() ?? null;
    const aTo = aRange?.to?.getTime() ?? null;
    const bTo = bRange?.to?.getTime() ?? null;
    return aFrom === bFrom && aTo === bTo;
  }
  return false;
}

function isTransactionUrlFilter(value: string | null): value is TransactionUrlFilter {
  if (!value) return false;
  return (TRANSACTION_URL_FILTERS as readonly string[]).includes(value);
}
