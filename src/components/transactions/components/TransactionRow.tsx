'use client';

import * as React from 'react';
import {
  TableCell,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ContactCombobox, Contact } from '@/components/contact-combobox';
import { SummaTooltip } from '@/components/ui/summa-tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Sparkles,
  Loader2,
  ChevronDown,
  FileUp,
  FileText,
  Trash2,
  MoreVertical,
  Edit,
  FolderKanban,
  GitMerge,
  Link,
  AlertTriangle,
  Undo2,
  Eye,
  AlertCircle,
  CreditCard,
  MessageSquare,
  Mail,
} from 'lucide-react';
import type { Transaction, Category, Project, ContactType } from '@/lib/data';
import { formatCurrencyEU, formatDateShort } from '@/lib/normalize';
import { Checkbox } from '@/components/ui/checkbox';
import { RowDropTarget } from '@/components/files/row-drop-target';
import type { DeleteTransactionBlockedReason } from '@/lib/transactions/can-delete-transaction';
import { canShowUndoSplitAction } from '@/lib/splits/split-visibility';
import {
  canSplitStripeRemittance as canSplitStripeRemittanceCandidate,
  isStripeLikeTransaction,
} from '@/lib/transactions/stripe-detection';
import {
  type StripeImputationSummary,
} from '@/lib/stripe/activeStripeImputation';
import { isDemoEnv } from '@/lib/demo/isDemoOrg';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Helper: middle ellipsis per a noms llargs
 * Mostra primers 18 caràcters + … + últims 10
 */
function middleEllipsis(s: string, head = 18, tail = 10): string {
  if (!s) return s;
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

// =============================================================================
// TYPES
// =============================================================================

interface TransactionRowProps {
  transaction: Transaction;
  contactName: string | null;
  contactType: ContactType | null;
  stripeImputationSummary?: StripeImputationSummary | null;
  projectName: string | null;
  relevantCategories: Category[];
  isLegacyCategory?: boolean;
  categoryTranslations: Record<string, string>;
  comboboxContacts: Contact[];
  availableProjects: Project[] | null;
  showProjectColumn: boolean;
  isDocumentLoading: boolean;
  isCategoryLoading: boolean;
  isContactLoading?: boolean;
  // Bulk selection (opcional, només si canBulkEdit)
  isSelected?: boolean;
  isSelectionDisabled?: boolean;
  onToggleSelect?: (id: string) => void;
  // Drag & drop document (opcional, només si canEdit)
  onDropFile?: (txId: string, file: File) => Promise<void>;
  dropHint?: string;
  // Handlers
  onSetNote: (txId: string, note: string) => void;
  onSetCategory: (txId: string, category: string) => void;
  onSetContact: (txId: string, contactId: string | null, contactType?: ContactType) => void;
  onSetProject: (txId: string, projectId: string | null) => void;
  onAttachDocument: (txId: string) => void;
  onDeleteDocument: (txId: string) => void;
  onCategorize: (txId: string) => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  onOpenReturnDialog: (tx: Transaction) => void;
  onSplitRemittance: (tx: Transaction) => void;
  onSplitAmount: (tx: Transaction) => void;
  onSplitStripeRemittance?: (tx: Transaction) => void;
  onOpenStripeImputationDetail?: (tx: Transaction) => void;
  onOpenSplitDetail?: (txId: string) => void;
  onUndoSplit?: (txId: string) => void;
  onViewRemittanceDetail: (txId: string, parentTx?: Transaction) => void;
  onUndoRemittance?: (tx: Transaction) => void;
  onGenerateReturnEmailDraft?: (tx: Transaction) => void;
  onCreateNewContact: (txId: string, type: 'donor' | 'supplier') => void;
  onOpenReturnImporter?: (parentTx?: Transaction) => void;
  // SEPA reconciliation
  detectedPrebankRemittance?: { id: string; nbOfTxs: number; ctrlSum: number } | null;
  onReconcileSepa?: (tx: Transaction) => void;
  isSplitDeleteBlocked?: boolean;
  deleteBlockedReason?: DeleteTransactionBlockedReason | null;
  // Translations
  t: {
    date: string;
    amount: string;
    balance: string;
    returnBadge: string;
    returnBadgeShort: string;
    returnAssignedTooltip: string;
    pendingDonorAssignment: string;
    commissionBadge: string;
    commissionBadgeShort: string;
    bankCommissionReturn: string;
    returnedDonation: string;
    returnedDonationInfo: string;
    assign: string;
    assignDonor: string;
    assignDonorTooltip: string;
    remittanceUseImporter: string;
    uploadBankFile: string;
    uploadBankFileTooltip: string;
    unlink: string;
    searchCategory: string;
    noResults: string;
    suggestWithAI: string;
    categorize: string;
    uncategorized: string;
    viewDocument: string;
    addNote?: string;
    editNote?: string;
    attachProof: string;
    attachDocument: string;
    deleteDocument: string;
    manageReturn: string;
    generateReturnEmail?: string;
    edit: string;
    splitAmount: string;
    splitRemittance: string;
    splitPaymentRemittance?: string;
    splitStripeRemittance: string;
    delete: string;
    deleteBlocked: string;
    deleteBlockedParentRemittance: string;
    deleteBlockedChildRemittance: string;
    viewRemittanceDetail: string;
    remittanceQuotes: string;
    remittanceProcessedLabel: string;
    remittanceNotApplicable: string;
    undoRemittance?: string;
    splitProcessedLabel?: string;
    undoSplit?: string;
    stripeImputed?: string;
    viewStripeImputationDetail?: string;
    undoStripeImputation?: string;
    reconcileSepa?: string;
    moreOptionsAriaLabel?: string;
    legacyCategory?: string;
    noContact?: string;
  };
  getCategoryDisplayName: (category: string | null | undefined) => string;
}

// =============================================================================
// HELPERS
// =============================================================================


// =============================================================================
// COMPONENT
// =============================================================================

export const TransactionRow = React.memo(function TransactionRow({
  transaction: tx,
  contactName,
  projectName,
  stripeImputationSummary,
  relevantCategories,
  isLegacyCategory,
  categoryTranslations,
  comboboxContacts,
  availableProjects,
  showProjectColumn,
  isDocumentLoading,
  isCategoryLoading,
  isContactLoading,
  isSelected,
  isSelectionDisabled,
  onToggleSelect,
  onDropFile,
  dropHint,
  onSetCategory,
  onSetContact,
  onSetProject,
  onAttachDocument,
  onDeleteDocument,
  onCategorize,
  onEdit,
  onDelete,
  onOpenReturnDialog,
  onSplitRemittance,
  onSplitAmount,
  onSplitStripeRemittance,
  onOpenStripeImputationDetail,
  onOpenSplitDetail,
  onUndoSplit,
  onViewRemittanceDetail,
  onUndoRemittance,
  onGenerateReturnEmailDraft,
  onCreateNewContact,
  onOpenReturnImporter,
  detectedPrebankRemittance,
  onReconcileSepa,
  isSplitDeleteBlocked,
  deleteBlockedReason,
  t,
  getCategoryDisplayName,
}: TransactionRowProps) {
  // Local state for category popover - avoids parent re-render
  const [isCategoryPopoverOpen, setIsCategoryPopoverOpen] = React.useState(false);
  // Local state for actions dropdown menu - needed to close before opening modals (Radix aria-hidden fix)
  const [isActionsMenuOpen, setIsActionsMenuOpen] = React.useState(false);

  const isExpense = tx.amount < 0;
  const hasDocument = !!tx.document;
  const hasBalanceAfter = typeof tx.balanceAfter === 'number' && Number.isFinite(tx.balanceAfter);
  const balanceText = hasBalanceAfter ? formatCurrencyEU(Math.abs(tx.balanceAfter!)) : '—';
  const isReturn = tx.transactionType === 'return';
  const isReturnFee = tx.transactionType === 'return_fee';
  const isReturnedDonation = tx.donationStatus === 'returned';
  const subtleReturnBadgeClassName =
    'h-5 shrink-0 rounded-full border-red-200 bg-red-50 px-1.5 py-0 text-[10px] font-medium leading-none text-red-700 shadow-none hover:bg-red-50';
  const subtleCommissionBadgeClassName =
    'h-5 shrink-0 rounded-full border-orange-200 bg-orange-50 px-1.5 py-0 text-[10px] font-medium leading-none text-orange-700 shadow-none hover:bg-orange-50';
  const canManageReturn =
    tx.amount < 0 &&
    !tx.isRemittance &&
    !tx.isRemittanceItem &&
    tx.transactionType !== 'return_fee' &&
    tx.source !== 'stripe';
  const canGenerateReturnEmail = isReturn && !!tx.contactId && tx.isRemittance !== true;
  const deleteBlockedMessage = React.useMemo(() => {
    if (deleteBlockedReason === 'parentRemittance') {
      return t.deleteBlockedParentRemittance;
    }
    if (deleteBlockedReason === 'childRemittance') {
      return t.deleteBlockedChildRemittance;
    }
    if (isSplitDeleteBlocked) {
      return t.deleteBlocked;
    }
    return null;
  }, [
    deleteBlockedReason,
    isSplitDeleteBlocked,
    t.deleteBlocked,
    t.deleteBlockedChildRemittance,
    t.deleteBlockedParentRemittance,
  ]);
  // Detecta transaccions via Stripe (donations, fees)
  const isFromStripe = tx.source === 'stripe';
  const showStripeBadge = isStripeLikeTransaction(tx);
  const hasStripeImputation = !!stripeImputationSummary;
  const hasStripeChildren = !!tx.stripeTransferId || hasStripeImputation;
  const stripeDonorEntries = stripeImputationSummary?.donorEntries ?? [];
  const hasSingleStripeDonor = stripeImputationSummary?.donorCount === 1;
  const hasMultipleStripeDonors = (stripeImputationSummary?.donorCount ?? 0) > 1;
  const canSplitAmount =
    tx.amount > 0 &&
    !tx.isRemittance &&
    !tx.isRemittanceItem &&
    !tx.isSplit &&
    !tx.parentTransactionId &&
    !hasStripeChildren &&
    !showStripeBadge &&
    tx.transactionType !== 'donation' &&
    tx.transactionType !== 'fee';

  // Stable callbacks using useCallback to prevent child re-renders
  const handleSelectContact = React.useCallback((contactId: string | null) => {
    if (contactId) {
      const contact = comboboxContacts.find(c => c.id === contactId);
      onSetContact(tx.id, contactId, contact?.type);
    } else {
      onSetContact(tx.id, null);
    }
  }, [tx.id, comboboxContacts, onSetContact]);

  const handleCreateNewContact = React.useCallback((type: 'donor' | 'supplier') => {
    onCreateNewContact(tx.id, type);
  }, [tx.id, onCreateNewContact]);

  const handleCategorySelect = React.useCallback((categoryId: string) => {
    onSetCategory(tx.id, categoryId);
    setIsCategoryPopoverOpen(false);
  }, [tx.id, onSetCategory]);

  const handleCategorizeWithAI = React.useCallback(() => {
    onCategorize(tx.id);
    setIsCategoryPopoverOpen(false);
  }, [tx.id, onCategorize]);

  const handleSetProject = React.useCallback((projectId: string | null) => {
    onSetProject(tx.id, projectId);
  }, [tx.id, onSetProject]);

  const handleAttachDocument = React.useCallback(() => {
    onAttachDocument(tx.id);
  }, [tx.id, onAttachDocument]);

  const handleDeleteDocument = React.useCallback(() => {
    onDeleteDocument(tx.id);
  }, [tx.id, onDeleteDocument]);

  const handleEdit = React.useCallback(() => {
    // Delay per permetre que el DropdownMenu es tanqui completament
    // abans d'obrir la modal d'edició (evita conflicte aria-hidden)
    setIsActionsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onEdit(tx);
    }, 100);
  }, [tx, onEdit]);

  const handleDelete = React.useCallback(() => {
    // Delay per permetre que el DropdownMenu es tanqui completament
    // abans d'obrir la modal de confirmació (evita conflicte aria-hidden)
    setIsActionsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onDelete(tx);
    }, 100);
  }, [tx, onDelete]);

  const handleOpenReturnDialog = React.useCallback(() => {
    // Delay per permetre que el DropdownMenu es tanqui completament
    // abans d'obrir la modal (evita conflicte aria-hidden)
    setIsActionsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onOpenReturnDialog(tx);
    }, 100);
  }, [tx, onOpenReturnDialog]);

  const handleGenerateReturnEmailDraft = React.useCallback(() => {
    if (!onGenerateReturnEmailDraft) return;
    setIsActionsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onGenerateReturnEmailDraft(tx);
    }, 100);
  }, [onGenerateReturnEmailDraft, tx]);

  const handleSplitRemittance = React.useCallback(() => {
    // Delay per permetre que el DropdownMenu es tanqui completament
    // abans d'obrir la modal (evita conflicte aria-hidden)
    setIsActionsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onSplitRemittance(tx);
    }, 100);
  }, [tx, onSplitRemittance]);

  const handleSplitAmount = React.useCallback(() => {
    setIsActionsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onSplitAmount(tx);
    }, 100);
  }, [tx, onSplitAmount]);

  const handleSplitStripeRemittance = React.useCallback(() => {
    if (!onSplitStripeRemittance) return;
    // Delay per permetre que el DropdownMenu es tanqui completament
    setIsActionsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onSplitStripeRemittance(tx);
    }, 100);
  }, [tx, onSplitStripeRemittance]);

  const handleOpenStripeDetail = React.useCallback(() => {
    if (!onOpenStripeImputationDetail) return;
    setIsActionsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onOpenStripeImputationDetail(tx);
    }, 100);
  }, [onOpenStripeImputationDetail, tx]);

  const handleViewRemittanceDetail = React.useCallback(() => {
    onViewRemittanceDetail(tx.id, tx);
  }, [tx, onViewRemittanceDetail]);

  const handleOpenSplitDetail = React.useCallback(() => {
    if (!onOpenSplitDetail) return;
    onOpenSplitDetail(tx.id);
  }, [onOpenSplitDetail, tx.id]);

  const handleUndoSplit = React.useCallback(() => {
    if (!onUndoSplit) return;
    setIsActionsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onUndoSplit(tx.id);
    }, 100);
  }, [onUndoSplit, tx.id]);

  const handleUndoRemittance = React.useCallback(() => {
    if (!onUndoRemittance) return;
    // Delay per permetre que el DropdownMenu es tanqui completament
    setIsActionsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onUndoRemittance(tx);
    }, 100);
  }, [tx, onUndoRemittance]);

  const handleReconcileSepa = React.useCallback(() => {
    if (!onReconcileSepa) return;
    setIsActionsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onReconcileSepa(tx);
    }, 100);
  }, [tx, onReconcileSepa]);

  // Render transaction type badge
  const renderTransactionTypeBadge = () => {
    if (isReturn) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={subtleReturnBadgeClassName}>
              {t.returnBadgeShort}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {tx.contactId ? t.returnAssignedTooltip : t.pendingDonorAssignment}
          </TooltipContent>
        </Tooltip>
      );
    }
    if (isReturnFee) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={subtleCommissionBadgeClassName}>
              {t.commissionBadgeShort}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {t.bankCommissionReturn}
          </TooltipContent>
        </Tooltip>
      );
    }
    if (isReturnedDonation) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-0.5 text-xs py-0 px-1.5 text-gray-500 line-through">
              {t.returnedDonation}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {t.returnedDonationInfo}
          </TooltipContent>
        </Tooltip>
      );
    }
    return null;
  };

  // Handler per al drop de fitxers
  const handleFileDrop = React.useCallback(async (file: File) => {
    if (onDropFile) {
      await onDropFile(tx.id, file);
    }
  }, [onDropFile, tx.id]);

  // Detecta si és una remesa de donacions processada (no devolucions)
  const isProcessedDonationRemittance = tx.isRemittance && tx.remittanceType !== 'returns';
  const displayDate = tx.operationDate || tx.date;

  // Classes de la fila
  const rowClassName = `h-auto ${
    isReturn ? 'bg-red-50/30' :
    isReturnFee ? 'bg-orange-50/30' :
    isReturnedDonation ? 'bg-gray-50/35' :
    isProcessedDonationRemittance ? 'bg-emerald-50/20' : ''
  } ${isSelected ? 'bg-primary/5' : ''}`;

  // Renderitzar amb o sense RowDropTarget segons si onDropFile està definit
  const rowContent = (
    <>
      {/* Checkbox - només si onToggleSelect està definit (canBulkEdit) */}
      {onToggleSelect && (
        <TableCell className="px-2.5 py-3 align-top">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => {
              if (isSelectionDisabled) return;
              onToggleSelect(tx.id);
            }}
            disabled={isSelectionDisabled}
            aria-label={`Seleccionar moviment ${tx.description}`}
            className="h-4 w-4"
          />
        </TableCell>
      )}
      {/* Date */}
      <TableCell className="whitespace-nowrap py-3.5 text-xs text-muted-foreground align-top">
        {formatDateShort(displayDate)}
      </TableCell>

      {/* Amount */}
      <TableCell
        className={`whitespace-nowrap py-3.5 text-right font-mono text-[13px] font-medium tabular-nums align-top ${
          isReturnedDonation ? 'text-gray-400 line-through' :
          tx.amount > 0 ? 'text-green-600' : 'text-foreground'
        }`}
      >
        {formatCurrencyEU(tx.amount)}
      </TableCell>

      {/* Balance */}
      <TableCell className="w-[120px] whitespace-nowrap py-3.5 text-right font-mono text-[13px] tabular-nums text-foreground align-top">
        {balanceText}
      </TableCell>

      {/* Concept + Note + Badge + Mobile summary */}
      <TableCell className="min-w-0 py-3.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p
              className={`min-w-0 max-w-[320px] truncate text-[13px] leading-5 ${isReturnedDonation ? 'text-gray-400' : ''}`}
              title={tx.description}
            >
              {tx.description}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              {tx.isRemittance && tx.remittanceStatus !== 'partial' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className={`h-5 rounded-full px-1.5 py-0 text-[10px] leading-none cursor-pointer ${
                        isProcessedDonationRemittance
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'hover:bg-accent'
                      }`}
                      onClick={handleViewRemittanceDetail}
                    >
                      {tx.remittanceResolvedCount ?? tx.remittanceItemCount}/{tx.remittanceItemCount} {t.remittanceQuotes}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t.viewRemittanceDetail}
                  </TooltipContent>
                </Tooltip>
              )}
              {(hasStripeImputation || (showStripeBadge && !hasStripeImputation)) && (
                <>
                  {hasStripeImputation && onOpenStripeImputationDetail && (
                    <Badge
                      variant="outline"
                      className="cursor-pointer rounded-full border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700 hover:bg-blue-100"
                      onClick={handleOpenStripeDetail}
                    >
                      {t.stripeImputed || 'Stripe imputat'}
                    </Badge>
                  )}
                  {showStripeBadge && !hasStripeImputation && (
                    <Badge variant="outline" className="h-5 rounded-full border-blue-200 bg-blue-50 px-1.5 py-0 text-[10px] text-blue-700">
                      Stripe
                    </Badge>
                  )}
                </>
              )}
              {renderTransactionTypeBadge()}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {tx.isRemittance && tx.remittanceStatus === 'partial' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="h-5 gap-0.5 rounded-full border-orange-200 bg-orange-50 px-1.5 py-0 text-[10px] leading-none text-orange-700 cursor-pointer hover:bg-orange-100"
                    onClick={handleViewRemittanceDetail}
                  >
                    <AlertCircle className="h-3 w-3 text-orange-600" />
                    <span>
                      {tx.remittanceResolvedCount ?? tx.remittanceItemCount}/{tx.remittanceItemCount}
                    </span>
                    {tx.remittancePendingCount ? (
                      <span className="text-orange-600">({tx.remittancePendingCount} pend.)</span>
                    ) : null}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {`Remesa parcial: ${tx.remittancePendingCount} pendents (${formatCurrencyEU(tx.remittancePendingTotalAmount || 0)})`}
                </TooltipContent>
              </Tooltip>
            )}
            {canShowUndoSplitAction(tx) && onOpenSplitDetail && (
              <Badge
                variant="secondary"
                className="cursor-pointer rounded-full px-1.5 py-0.5 text-[10px]"
                onClick={handleOpenSplitDetail}
              >
                {t.splitProcessedLabel || 'Desglossat'}
              </Badge>
            )}
            {/* Badge SEPA detectada */}
            {detectedPrebankRemittance && !tx.isRemittance && onReconcileSepa && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="gap-1 cursor-pointer rounded-full border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] text-purple-700 hover:bg-purple-100"
                    onClick={handleReconcileSepa}
                  >
                    <CreditCard className="h-3 w-3 text-purple-600" />
                    <span>Remesa SEPA ({detectedPrebankRemittance.nbOfTxs})</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Remesa SEPA detectada: {detectedPrebankRemittance.nbOfTxs} pagaments · {formatCurrencyEU(detectedPrebankRemittance.ctrlSum)}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Nota: només text, edició via menú ⋮ */}
          {tx.note && !isDemoEnv() && (
            <p className="mt-0.5 max-w-[320px] truncate text-xs leading-5 text-muted-foreground" title={tx.note}>
              {tx.note}
            </p>
          )}
          {/* Mobile/tablet summary: categoria i contacte sota el concepte */}
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground lg:hidden">
            <span className="truncate max-w-[120px]">{getCategoryDisplayName(tx.category) || 'Sense categoria'}{isLegacyCategory && <span className="text-amber-600 ml-0.5" title={t.legacyCategory ?? 'Cal recategoritzar'}>⚠</span>}</span>
            <span className="text-muted-foreground/50">·</span>
            {hasStripeImputation ? (
              <button
                type="button"
                onClick={handleOpenStripeDetail}
                className="max-w-[180px] truncate text-left"
              >
                {t.stripeImputed || 'Stripe imputat'}
              </button>
            ) : contactName ? (
              <SummaTooltip content={contactName}>
                <span className="max-w-[180px]">
                  {middleEllipsis(contactName)}
                </span>
              </SummaTooltip>
            ) : (
              <span className="max-w-[180px]">{t.noContact ?? 'Sense contacte'}</span>
            )}
          </div>
        </div>
      </TableCell>

      {/* Contact - hidden on mobile, visible from lg */}
      <TableCell className="hidden min-w-0 py-3.5 align-top lg:table-cell">
        {/* Cas 1: Pare de remesa de devolucions - mostrar estat, NO "Assignar donant" */}
        {tx.isRemittance && tx.remittanceType === 'returns' ? (
          <div className="flex items-center gap-1">
            {tx.remittanceStatus === 'complete' ? (
              <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 text-xs">
                Remesa completa
              </Badge>
            ) : tx.remittanceStatus === 'partial' ? (
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-orange-700 border-orange-300 bg-orange-50 text-xs">
                  {tx.remittanceResolvedCount ?? 0}/{tx.remittanceItemCount ?? 0}
                </Badge>
                {onOpenReturnImporter && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenReturnImporter(tx)}
                        className="text-orange-600 hover:text-orange-800 h-6 text-xs px-1"
                      >
                        <FileUp className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Importar fitxer per identificar devolucions pendents
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50 text-xs">
                  Pendent
                </Badge>
                {onOpenReturnImporter && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenReturnImporter(tx)}
                        className="text-red-600 hover:text-red-800 h-6 text-xs px-1"
                      >
                        <FileUp className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Importar fitxer per identificar devolucions
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
        ) : isProcessedDonationRemittance ? (
          // Cas 2: Remesa de donacions processada - NO té contacte, mostrar "—"
          <span className="text-muted-foreground text-sm">{t.remittanceNotApplicable}</span>
        ) : hasSingleStripeDonor && stripeImputationSummary?.singleDonorDisplayName ? (
          <SummaTooltip content={stripeImputationSummary.singleDonorDisplayName}>
            <button
              type="button"
              onClick={handleOpenStripeDetail}
              className="max-w-[180px] truncate text-left text-sm hover:underline"
            >
              {stripeImputationSummary.singleDonorDisplayName}
            </button>
          </SummaTooltip>
        ) : hasMultipleStripeDonors ? (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="text-left">
                <Badge variant="outline" className="text-xs py-0 px-1.5 hover:bg-accent">
                  {stripeImputationSummary?.donorCount} socis
                </Badge>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-3">
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Repartiment Stripe
                </div>
                {stripeDonorEntries.map((entry) => (
                  <div key={entry.key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{entry.donorDisplayName}</span>
                    <span className="shrink-0 font-mono">{formatCurrencyEU(entry.totalAmount)}</span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ) : hasStripeImputation ? (
          <button type="button" onClick={handleOpenStripeDetail} className="text-left">
            <Badge variant="outline" className="text-xs py-0 px-1.5 hover:bg-accent">
              {t.stripeImputed || 'Stripe imputat'}
            </Badge>
          </button>
        ) : isReturn && !tx.contactId ? (
          // Cas 3: Devolució individual pendent (NO és pare de remesa)
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenReturnDialog}
                  className="text-red-600 border-red-300 hover:bg-red-50 h-7 text-xs px-2"
                >
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {t.assignDonor}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t.assignDonorTooltip}
              </TooltipContent>
            </Tooltip>
            {onOpenReturnImporter && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenReturnImporter(tx)}
                    className="text-muted-foreground hover:text-foreground h-7 text-xs px-2"
                  >
                    <FileUp className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {t.uploadBankFileTooltip}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        ) : (
          // Cas 3: Transacció normal - mostrar combobox de contactes
          <ContactCombobox
            contacts={comboboxContacts}
            value={tx.contactId ?? null}
            onSelect={handleSelectContact}
            onCreateNew={handleCreateNewContact}
            disabled={isContactLoading}
          />
        )}
      </TableCell>

      {/* Category - hidden on mobile, visible from lg */}
      <TableCell className="hidden min-w-0 py-3.5 align-top lg:table-cell">
        <Popover open={isCategoryPopoverOpen} onOpenChange={setIsCategoryPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              role="combobox"
              disabled={isCategoryLoading || isContactLoading}
              className={`h-6 w-full min-w-0 justify-start rounded-full border border-border bg-muted/30 px-2 py-0.5 text-xs font-medium gap-0.5 text-foreground/90 hover:bg-muted/50 ${isReturnedDonation ? 'opacity-50' : ''}`}
            >
              {isCategoryLoading ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{t.categorize}...</span>
                </span>
              ) : (
                <span className="flex min-w-0 flex-1 items-center gap-1 truncate">
                  {tx.category ? getCategoryDisplayName(tx.category) : t.uncategorized}
                  {isLegacyCategory && <span className="text-[10px] text-amber-600" title={t.legacyCategory ?? 'Cal recategoritzar'}>⚠</span>}
                </span>
              )}
              <ChevronDown className="ml-0.5 h-3 w-3 shrink-0 opacity-70" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0" align="start">
            <Command>
              <CommandInput placeholder={t.searchCategory} />
              <CommandList>
                <CommandEmpty>{t.noResults}</CommandEmpty>
                <CommandGroup>
                  {relevantCategories.map((cat) => (
                    <CommandItem
                      key={cat.id}
                      value={categoryTranslations[cat.name] || cat.name}
                      onSelect={() => handleCategorySelect(cat.id)}
                    >
                      {categoryTranslations[cat.name] || cat.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandGroup>
                  <CommandItem
                    value={t.suggestWithAI}
                    onSelect={handleCategorizeWithAI}
                    className="text-primary"
                  >
                    <Sparkles className="mr-2 h-3 w-3" />
                    {t.suggestWithAI}
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </TableCell>

      {/* Project - hidden on mobile, visible from lg */}
      {showProjectColumn && (
        <TableCell className="hidden py-3.5 align-top lg:table-cell">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {projectName ? (
                <Button variant="ghost" className="h-auto p-0 text-left font-normal flex items-center gap-1">
                  <span className={`text-xs truncate max-w-[90px] ${isReturnedDonation ? 'text-gray-400' : ''}`}>{projectName}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="text-muted-foreground h-6 text-xs">
                  <FolderKanban className="mr-1 h-3 w-3" />
                  {t.assign}
                </Button>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleSetProject(null)}>
                {t.unlink}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {availableProjects?.map((project) => (
                <DropdownMenuItem key={project.id} onClick={() => handleSetProject(project.id)}>
                  {project.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      )}

      {/* Document column - always visible */}
      <TableCell className="w-10 shrink-0 py-3.5 text-center align-top">
        <div className="flex items-center justify-center">
          {isDocumentLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : hasDocument ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={tx.document!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted/40"
                  aria-label={t.viewDocument}
                >
                  <FileText className="h-[18px] w-[18px] fill-current text-foreground/80" />
                </a>
              </TooltipTrigger>
              <TooltipContent>{t.viewDocument}</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleAttachDocument}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted/35"
                  aria-label={isExpense ? t.attachProof : t.attachDocument}
                >
                  <FileText className="h-[18px] w-[18px] text-foreground/65" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {isExpense ? t.attachProof : t.attachDocument}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TableCell>

      {/* Actions menu column */}
      <TableCell className="w-9 shrink-0 py-3 text-right align-top pr-2">
        <DropdownMenu open={isActionsMenuOpen} onOpenChange={setIsActionsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/40"
              aria-label={t.moreOptionsAriaLabel ?? "Més opcions"}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" forceMount>
            {canManageReturn && (
              <>
                <DropdownMenuItem onClick={handleOpenReturnDialog}>
                  <Link className="mr-2 h-4 w-4 text-red-500" />
                  {t.manageReturn}
                </DropdownMenuItem>
                {canGenerateReturnEmail && onGenerateReturnEmailDraft && (
                  <DropdownMenuItem onClick={handleGenerateReturnEmailDraft}>
                    <Mail className="mr-2 h-4 w-4" />
                    {t.generateReturnEmail || 'Generar correu al soci'}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
              </>
            )}
            {tx.isRemittance && tx.remittanceType === 'returns' && (
              <>
                <DropdownMenuItem onClick={handleViewRemittanceDetail}>
                  <Eye className="mr-2 h-4 w-4 text-blue-500" />
                  {t.viewRemittanceDetail}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={handleEdit}>
              <Edit className="mr-2 h-4 w-4" />
              {t.edit}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleEdit}>
              <MessageSquare className="mr-2 h-4 w-4" />
              {tx.note ? (t.editNote || 'Editar nota') : (t.addNote || 'Afegir nota')}
            </DropdownMenuItem>
            {!hasDocument ? (
              <DropdownMenuItem onClick={handleAttachDocument}>
                <FileUp className="mr-2 h-4 w-4" />
                {t.attachDocument}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={handleDeleteDocument} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                {t.deleteDocument}
              </DropdownMenuItem>
            )}
            {hasStripeImputation && onOpenStripeImputationDetail && (
              <DropdownMenuItem onClick={handleOpenStripeDetail}>
                <Eye className="mr-2 h-4 w-4 text-blue-600" />
                {t.viewStripeImputationDetail || 'Veure detall Stripe'}
              </DropdownMenuItem>
            )}
            {!hasStripeImputation && canSplitStripeRemittanceCandidate(tx) && onSplitStripeRemittance && (
              <DropdownMenuItem onClick={handleSplitStripeRemittance}>
                <GitMerge className="mr-2 h-4 w-4 text-purple-600" />
                {'Imputar Stripe'}
              </DropdownMenuItem>
            )}
            {canSplitAmount && (
              <DropdownMenuItem onClick={handleSplitAmount}>
                <GitMerge className="mr-2 h-4 w-4" />
                {t.splitAmount}
              </DropdownMenuItem>
            )}
            {tx.amount > 0 && !isReturn && !isReturnFee && !tx.isRemittance && !tx.isRemittanceItem && !showStripeBadge && !hasStripeChildren && (
              <DropdownMenuItem onClick={handleSplitRemittance}>
                <GitMerge className="mr-2 h-4 w-4" />
                {t.splitRemittance}
              </DropdownMenuItem>
            )}
            {tx.amount < 0 && !isReturn && !isReturnFee && !tx.isRemittance && !tx.isRemittanceItem && !isFromStripe && !hasStripeChildren && (
              <DropdownMenuItem onClick={handleSplitRemittance}>
                <GitMerge className="mr-2 h-4 w-4 text-orange-600" />
                {t.splitPaymentRemittance || 'Dividir remesa pagaments'}
              </DropdownMenuItem>
            )}
            {/* SEPA pre-banc detectada */}
            {detectedPrebankRemittance && !tx.isRemittance && onReconcileSepa && (
              <DropdownMenuItem onClick={handleReconcileSepa} className="text-purple-600">
                <CreditCard className="mr-2 h-4 w-4" />
                {t.reconcileSepa || 'Desagregar i conciliar'}
              </DropdownMenuItem>
            )}
            {(tx.isRemittance || hasStripeChildren) && onUndoRemittance && (
              <DropdownMenuItem onClick={handleUndoRemittance} className="text-orange-600">
                <Undo2 className="mr-2 h-4 w-4" />
                {hasStripeImputation
                  ? (t.undoStripeImputation || 'Desfer imputació Stripe')
                  : (t.undoRemittance || 'Desfer remesa')}
              </DropdownMenuItem>
            )}
            {canShowUndoSplitAction(tx) && onUndoSplit && (
              <DropdownMenuItem onClick={handleUndoSplit} className="text-orange-600">
                <Undo2 className="mr-2 h-4 w-4" />
                {t.undoSplit || 'Desfer desglossament'}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {deleteBlockedMessage ? (
              <DropdownMenuItem disabled className="text-muted-foreground cursor-not-allowed">
                <Trash2 className="mr-2 h-4 w-4" />
                {deleteBlockedMessage}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                {t.delete}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </>
  );

  // Si onDropFile està definit, embolcallem amb RowDropTarget
  if (onDropFile) {
    return (
      <RowDropTarget
        as="tr"
        disabled={false}
        onDropFile={handleFileDrop}
        dropHint={dropHint}
        className={rowClassName}
      >
        {rowContent}
      </RowDropTarget>
    );
  }

  // Sense drag & drop, renderitzem TableRow normal
  return (
    <TableRow className={rowClassName}>
      {rowContent}
    </TableRow>
  );
});
