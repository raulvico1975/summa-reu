// src/components/transactions/components/TransactionRowMobile.tsx
// Layout "stacked row" per mòbil - mostra tota la info sense scroll horitzontal

'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SummaTooltip } from '@/components/ui/summa-tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  MoreVertical,
  User,
  Undo2,
  Ban,
  Eye,
  Edit,
  Trash2,
  FolderKanban,
  MessageSquare,
  GitMerge,
  Mail,
  Loader2,
} from 'lucide-react';
import type { Transaction, ContactType } from '@/lib/data';
import { formatCurrencyEU, formatDateShort } from '@/lib/normalize';
import type { DeleteTransactionBlockedReason } from '@/lib/transactions/can-delete-transaction';
import { canShowUndoSplitAction } from '@/lib/splits/split-visibility';
import {
  canSplitStripeRemittance as canSplitStripeRemittanceCandidate,
  isStripeLikeTransaction,
} from '@/lib/transactions/stripe-detection';
import {
  type StripeImputationSummary,
} from '@/lib/stripe/activeStripeImputation';

/**
 * Helper: middle ellipsis per a noms llargs
 * Mostra primers 18 caràcters + … + últims 10
 */
function middleEllipsis(s: string, head = 18, tail = 10): string {
  if (!s) return s;
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

interface TransactionRowMobileProps {
  transaction: Transaction;
  contactName: string | null;
  contactType: ContactType | null;
  stripeImputationSummary?: StripeImputationSummary | null;
  categoryDisplayName: string;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  onSplitRemittance?: (tx: Transaction) => void;
  onSplitAmount?: (tx: Transaction) => void;
  onSplitStripeRemittance?: (tx: Transaction) => void;
  onOpenStripeImputationDetail?: (tx: Transaction) => void;
  onOpenSplitDetail?: (txId: string) => void;
  onUndoSplit?: (txId: string) => void;
  onUndoRemittance?: (tx: Transaction) => void;
  isSplitDeleteBlocked?: boolean;
  deleteBlockedReason?: DeleteTransactionBlockedReason | null;
  onOpenReturnDialog?: (tx: Transaction) => void;
  onGenerateReturnEmailDraft?: (tx: Transaction) => void;
  onViewRemittanceDetail?: (txId: string) => void;
  onAttachDocument?: (txId: string) => void;
  showDonationCandidate?: boolean;
  isDonationPending?: boolean;
  onMarkAsDonation?: (txId: string) => void;
  t: {
    amount: string;
    balance: string;
    noContact: string;
    returnBadge: string;
    returnBadgeShort: string;
    commissionBadge: string;
    commissionBadgeShort: string;
    returnedDonation: string;
    viewDocument: string;
    attachProof: string;
    edit: string;
    delete: string;
    splitAmount: string;
    splitRemittance?: string;
    splitPaymentRemittance?: string;
    splitStripeRemittance?: string;
    deleteBlocked: string;
    deleteBlockedParentRemittance: string;
    deleteBlockedChildRemittance: string;
    viewRemittanceDetail: string;
    splitProcessedLabel?: string;
    undoSplit?: string;
    undoRemittance?: string;
    stripeImputed?: string;
    viewStripeImputationDetail?: string;
    undoStripeImputation?: string;
    remittanceQuotes: string;
    manageReturn?: string;
    generateReturnEmail?: string;
    addNote?: string;
    editNote?: string;
    readyToCountIn182: string;
    markAsDonation182: string;
    fiscalDonation: string;
  };
}


export const TransactionRowMobile = React.memo(function TransactionRowMobile({
  transaction: tx,
  contactName,
  stripeImputationSummary,
  categoryDisplayName,
  onEdit,
  onDelete,
  onSplitRemittance,
  onSplitAmount,
  onSplitStripeRemittance,
  onOpenStripeImputationDetail,
  onOpenSplitDetail,
  onUndoSplit,
  onUndoRemittance,
  isSplitDeleteBlocked,
  deleteBlockedReason,
  onOpenReturnDialog,
  onGenerateReturnEmailDraft,
  onViewRemittanceDetail,
  onAttachDocument,
  showDonationCandidate,
  isDonationPending,
  onMarkAsDonation,
  t,
}: TransactionRowMobileProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const displayDate = tx.operationDate || tx.date;

  const isReturn = tx.transactionType === 'return';
  const isReturnFee = tx.transactionType === 'return_fee';
  const isReturnedDonation = tx.donationStatus === 'returned';
  const canGenerateReturnEmail = isReturn && !!tx.contactId && tx.isRemittance !== true;
  const hasDocument = !!tx.document;
  const hasBalanceAfter = typeof tx.balanceAfter === 'number' && Number.isFinite(tx.balanceAfter);
  const balanceText = hasBalanceAfter ? formatCurrencyEU(Math.abs(tx.balanceAfter!)) : '—';
  const isFromStripe = tx.source === 'stripe';
  const isStripeLike = isStripeLikeTransaction(tx);
  const hasStripeImputation = !!stripeImputationSummary;
  const hasStripeChildren = !!tx.stripeTransferId || hasStripeImputation;
  const stripeDonorEntries = stripeImputationSummary?.donorEntries ?? [];
  const hasSingleStripeDonor = stripeImputationSummary?.donorCount === 1;
  const hasMultipleStripeDonors = (stripeImputationSummary?.donorCount ?? 0) > 1;
  const canManageReturn =
    tx.amount < 0 &&
    !tx.isRemittance &&
    !tx.isRemittanceItem &&
    tx.transactionType !== 'return_fee' &&
    !isFromStripe;
  const canSplitAmount =
    tx.amount > 0 &&
    !tx.isRemittance &&
    !tx.isRemittanceItem &&
    !tx.isSplit &&
    !tx.parentTransactionId &&
    !hasStripeChildren &&
    !isStripeLike &&
    tx.transactionType !== 'donation' &&
    tx.transactionType !== 'fee';
  const canSplitIncomeRemittance =
    tx.amount > 0 &&
    !isReturn &&
    !isReturnFee &&
    !tx.isRemittance &&
    !tx.isRemittanceItem &&
    !hasStripeChildren &&
    !isStripeLike;
  const canSplitPaymentRemittance =
    tx.amount < 0 &&
    !isReturn &&
    !isReturnFee &&
    !tx.isRemittance &&
    !tx.isRemittanceItem &&
    !hasStripeChildren &&
    !isFromStripe;
  const canSplitStripeRemittance = React.useMemo(
    () => canSplitStripeRemittanceCandidate(tx),
    [tx]
  );
  const isFiscalDonation = tx.transactionType === 'donation' && !isReturnedDonation;
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

  // Background color based on transaction type
  const bgClass = isReturn
    ? 'bg-red-50/35 border-red-200'
    : isReturnFee
    ? 'bg-orange-50/35 border-orange-200'
    : isReturnedDonation
    ? 'bg-gray-50/40 border-gray-200'
    : tx.isRemittance && tx.remittanceType !== 'returns'
    ? 'bg-emerald-50/25 border-emerald-200'
    : 'border-border/50';

  const handleEdit = React.useCallback(() => {
    setIsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      onEdit(tx);
    }, 50);
  }, [tx, onEdit]);

  const handleDelete = React.useCallback(() => {
    setIsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      onDelete(tx);
    }, 50);
  }, [tx, onDelete]);

  const handleManageReturn = React.useCallback(() => {
    if (!onOpenReturnDialog) return;
    setIsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      onOpenReturnDialog(tx);
    }, 50);
  }, [tx, onOpenReturnDialog]);

  const handleGenerateReturnEmailDraft = React.useCallback(() => {
    if (!onGenerateReturnEmailDraft) return;
    setIsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      onGenerateReturnEmailDraft(tx);
    }, 50);
  }, [onGenerateReturnEmailDraft, tx]);

  const handleViewRemittance = React.useCallback(() => {
    if (!onViewRemittanceDetail) return;
    setIsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      onViewRemittanceDetail(tx.id);
    }, 50);
  }, [tx.id, onViewRemittanceDetail]);

  const handleOpenSplitDetail = React.useCallback(() => {
    if (!onOpenSplitDetail) return;
    setIsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      onOpenSplitDetail(tx.id);
    }, 50);
  }, [onOpenSplitDetail, tx.id]);

  const handleUndoSplit = React.useCallback(() => {
    if (!onUndoSplit) return;
    setIsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      onUndoSplit(tx.id);
    }, 50);
  }, [onUndoSplit, tx.id]);

  const handleUndoRemittance = React.useCallback(() => {
    if (!onUndoRemittance) return;
    setIsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      onUndoRemittance(tx);
    }, 50);
  }, [onUndoRemittance, tx]);

  const handleAttachDoc = React.useCallback(() => {
    if (!onAttachDocument) return;
    setIsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      onAttachDocument(tx.id);
    }, 50);
  }, [tx.id, onAttachDocument]);

  const handleSplitAmount = React.useCallback(() => {
    if (!onSplitAmount) return;
    setIsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      onSplitAmount(tx);
    }, 50);
  }, [onSplitAmount, tx]);

  const handleSplitRemittance = React.useCallback(() => {
    if (!onSplitRemittance) return;
    setIsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      onSplitRemittance(tx);
    }, 50);
  }, [onSplitRemittance, tx]);

  const handleSplitStripeRemittance = React.useCallback(() => {
    if (!onSplitStripeRemittance) return;
    setIsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      onSplitStripeRemittance(tx);
    }, 50);
  }, [onSplitStripeRemittance, tx]);

  const handleOpenStripeDetail = React.useCallback(() => {
    if (!onOpenStripeImputationDetail) return;
    setIsMenuOpen(false);
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      onOpenStripeImputationDetail(tx);
    }, 50);
  }, [onOpenStripeImputationDetail, tx]);

  const handleMarkAsDonation = React.useCallback(() => {
    if (!onMarkAsDonation || isDonationPending) return;
    onMarkAsDonation(tx.id);
  }, [isDonationPending, onMarkAsDonation, tx.id]);

  return (
    <div className={`rounded-xl border p-3 ${bgClass}`}>
      {/* Line 1: Data · Import · Saldo */}
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span className="text-muted-foreground whitespace-nowrap">{formatDateShort(displayDate)}</span>
        <span className="text-muted-foreground/50">·</span>
        <span
          className={`font-medium whitespace-nowrap ${
            isReturnedDonation
              ? 'text-gray-400 line-through'
              : tx.amount > 0
              ? 'text-green-600'
              : 'text-foreground'
          }`}
        >
          {t.amount}: {formatCurrencyEU(tx.amount)}
        </span>
        <span className="text-muted-foreground/50">·</span>
        <span className="font-medium whitespace-nowrap text-foreground">
          {t.balance}: {balanceText}
        </span>
      </div>

      {/* Line 2: Concepte */}
      <div className="mt-1 min-w-0">
        <p
          className={`text-sm truncate ${isReturnedDonation ? 'text-gray-400 line-through' : 'text-foreground'}`}
          title={tx.description}
        >
          {tx.description}
        </p>
      </div>

      {/* Line 3: Contacte + Categoria (chips) */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <Badge variant="secondary" className="max-w-[48%] rounded-full px-2 py-0.5 text-[11px] font-normal">
          <span className="truncate">{categoryDisplayName || '—'}</span>
        </Badge>
        <Badge variant="outline" className="max-w-[48%] rounded-full px-2 py-0.5 text-[11px] font-normal">
          <span className="inline-flex items-center gap-1 min-w-0">
            <User className="h-3 w-3 shrink-0" />
            {hasSingleStripeDonor && stripeImputationSummary?.singleDonorDisplayName ? (
              <SummaTooltip content={stripeImputationSummary.singleDonorDisplayName}>
                <button
                  type="button"
                  onClick={handleOpenStripeDetail}
                  className="truncate text-left"
                >
                  {middleEllipsis(stripeImputationSummary.singleDonorDisplayName)}
                </button>
              </SummaTooltip>
            ) : hasMultipleStripeDonors ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="truncate text-left"
                  >
                    {stripeImputationSummary?.donorCount} socis
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
              <button
                type="button"
                onClick={handleOpenStripeDetail}
                className="truncate text-left"
              >
                {t.stripeImputed || 'Stripe imputat'}
              </button>
            ) : contactName ? (
              <SummaTooltip content={contactName}>
                <span className="truncate">{middleEllipsis(contactName)}</span>
              </SummaTooltip>
            ) : (
              <span className="truncate">{t.noContact}</span>
            )}
          </span>
        </Badge>
        {showDonationCandidate ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isDonationPending}
            onClick={handleMarkAsDonation}
            aria-label={`${t.readyToCountIn182}. ${t.markAsDonation182}`}
            title={`${t.readyToCountIn182}. ${t.markAsDonation182}`}
            className="h-5 w-10 justify-center rounded-full border-amber-200 bg-amber-50 px-0 text-[10px] font-semibold text-amber-700 hover:bg-amber-100"
          >
            {isDonationPending ? <Loader2 className="h-3 w-3 animate-spin" /> : '182'}
          </Button>
        ) : null}
        {!showDonationCandidate && isFiscalDonation ? (
          <Badge
            variant="outline"
            title={t.fiscalDonation}
            className="w-10 justify-center rounded-full border-emerald-200 bg-emerald-50 px-0 py-0.5 text-center text-[10px] font-semibold text-emerald-700"
          >
            182
          </Badge>
        ) : null}
      </div>

      {/* Middle: Badges (type + remittance) */}
      {(isReturn || isReturnFee || isReturnedDonation || tx.isRemittance || canShowUndoSplitAction(tx) || hasStripeImputation) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {isReturn && (
            <Badge variant="outline" className="gap-1 rounded-full border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
              <Undo2 className="h-3 w-3" />
              {t.returnBadgeShort}
            </Badge>
          )}
          {isReturnFee && (
            <Badge variant="outline" className="gap-1 rounded-full border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
              <Ban className="h-3 w-3" />
              {t.commissionBadgeShort}
            </Badge>
          )}
          {isReturnedDonation && (
            <Badge variant="outline" className="gap-1 rounded-full px-1.5 py-0.5 text-[10px] text-gray-500 line-through">
              {t.returnedDonation}
            </Badge>
          )}
          {tx.isRemittance && onViewRemittanceDetail && (
            <Badge
              variant="outline"
              className="gap-1 cursor-pointer rounded-full px-1.5 py-0.5 text-[10px] hover:bg-accent"
              onClick={() => onViewRemittanceDetail(tx.id)}
            >
              <Eye className="h-3 w-3" />
              {tx.remittanceResolvedCount ?? tx.remittanceItemCount}/{tx.remittanceItemCount} {t.remittanceQuotes}
            </Badge>
          )}
          {hasStripeImputation && (
            <Badge
              variant="outline"
              className="cursor-pointer rounded-full px-1.5 py-0.5 text-[10px] hover:bg-accent"
              onClick={handleOpenStripeDetail}
            >
              {t.stripeImputed || 'Stripe imputat'}
            </Badge>
          )}
          {canShowUndoSplitAction(tx) && onOpenSplitDetail && (
            <Badge
              variant="secondary"
              className="cursor-pointer rounded-full px-1.5 py-0.5 text-[10px] hover:bg-accent"
              onClick={handleOpenSplitDetail}
            >
              {t.splitProcessedLabel || 'Desglossat'}
            </Badge>
          )}
        </div>
      )}

      {/* Actions rail */}
      <div className="mt-2 flex justify-end gap-1 shrink-0">
        {hasDocument && tx.document && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => window.open(tx.document!, '_blank')}
            aria-label={t.viewDocument}
          >
            <FileText className="h-4 w-4 fill-current text-muted-foreground" />
          </Button>
        )}
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" forceMount>
            <DropdownMenuItem onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              {t.edit}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleEdit}>
              <MessageSquare className="h-4 w-4 mr-2" />
              {tx.note ? (t.editNote || 'Editar nota') : (t.addNote || 'Afegir nota')}
            </DropdownMenuItem>
            {!hasDocument && onAttachDocument && (
              <DropdownMenuItem onClick={handleAttachDoc}>
                <FileText className="h-4 w-4 mr-2 text-muted-foreground/40" />
                {t.attachProof}
              </DropdownMenuItem>
            )}
            {tx.isRemittance && onViewRemittanceDetail && (
              <DropdownMenuItem onClick={handleViewRemittance}>
                <FolderKanban className="h-4 w-4 mr-2" />
                {t.viewRemittanceDetail}
              </DropdownMenuItem>
            )}
            {canManageReturn && onOpenReturnDialog && (
              <DropdownMenuItem onClick={handleManageReturn}>
                <Undo2 className="h-4 w-4 mr-2" />
                {t.manageReturn || 'Assignar donant'}
              </DropdownMenuItem>
            )}
            {canGenerateReturnEmail && onGenerateReturnEmailDraft && (
              <DropdownMenuItem onClick={handleGenerateReturnEmailDraft}>
                <Mail className="h-4 w-4 mr-2" />
                {t.generateReturnEmail || 'Generar correu al soci'}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {hasStripeImputation && onOpenStripeImputationDetail && (
              <DropdownMenuItem onClick={handleOpenStripeDetail}>
                <Eye className="h-4 w-4 mr-2 text-blue-600" />
                {t.viewStripeImputationDetail || 'Veure detall Stripe'}
              </DropdownMenuItem>
            )}
            {!hasStripeImputation && canSplitStripeRemittance && onSplitStripeRemittance && (
              <DropdownMenuItem onClick={handleSplitStripeRemittance}>
                <GitMerge className="h-4 w-4 mr-2 text-purple-600" />
                {'Imputar Stripe'}
              </DropdownMenuItem>
            )}
            {canSplitAmount && onSplitAmount && (
              <DropdownMenuItem onClick={handleSplitAmount}>
                <GitMerge className="h-4 w-4 mr-2" />
                {t.splitAmount}
              </DropdownMenuItem>
            )}
            {canSplitIncomeRemittance && onSplitRemittance && (
              <DropdownMenuItem onClick={handleSplitRemittance}>
                <GitMerge className="h-4 w-4 mr-2" />
                {t.splitRemittance || 'Dividir Remesa'}
              </DropdownMenuItem>
            )}
            {canSplitPaymentRemittance && onSplitRemittance && (
              <DropdownMenuItem onClick={handleSplitRemittance}>
                <GitMerge className="h-4 w-4 mr-2 text-orange-600" />
                {t.splitPaymentRemittance || 'Dividir remesa pagaments'}
              </DropdownMenuItem>
            )}
            {canShowUndoSplitAction(tx) && onUndoSplit && (
              <DropdownMenuItem onClick={handleUndoSplit} className="text-orange-600">
                <Undo2 className="h-4 w-4 mr-2" />
                {t.undoSplit || 'Desfer desglossament'}
              </DropdownMenuItem>
            )}
            {(tx.isRemittance || hasStripeChildren) && onUndoRemittance && (
              <DropdownMenuItem onClick={handleUndoRemittance} className="text-orange-600">
                <Undo2 className="h-4 w-4 mr-2" />
                {hasStripeImputation
                  ? (t.undoStripeImputation || 'Desfer imputació Stripe')
                  : (t.undoRemittance || 'Desfer remesa')}
              </DropdownMenuItem>
            )}
            {deleteBlockedMessage ? (
              <DropdownMenuItem disabled className="text-muted-foreground cursor-not-allowed">
                <Trash2 className="h-4 w-4 mr-2" />
                {deleteBlockedMessage}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                {t.delete}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});
