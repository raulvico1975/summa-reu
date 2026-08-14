'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowRight,
  FileText,
  Calendar,
  User,
  FolderOpen,
  Loader2,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ca } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/i18n';
import { useFirebase } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { formatCurrencyEU } from '@/lib/normalize';
import type { PendingDocument } from '@/lib/pending-documents/types';
import type { Transaction, Contact, Category } from '@/lib/data';
import {
  linkDocumentToTransaction,
  ignoreMatchSuggestion,
} from '@/lib/pending-documents/suggest-matches';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ReconciliationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingDoc: PendingDocument | null;
  transaction: Transaction | null;
  contacts: Contact[];
  categories: Category[];
  onComplete: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getContactName(contactId: string | null | undefined, contacts: Contact[]): string {
  if (!contactId) return '—';
  const contact = contacts.find(c => c.id === contactId);
  return contact?.name || '—';
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ca });
  } catch {
    return dateStr;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function ReconciliationModal({
  open,
  onOpenChange,
  pendingDoc,
  transaction,
  contacts,
  categories,
  onComplete,
}: ReconciliationModalProps) {
  const { firestore, storage } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const { toast } = useToast();
  const { t } = useTranslations();
  const categoryTranslations = t.categories as Record<string, string>;

  const getCategoryName = (categoryId: string | null | undefined) => {
    if (!categoryId) return '—';
    const category = categories.find(c => c.id === categoryId);
    if (!category) return '—';
    return categoryTranslations[category.name] ?? category.name;
  };

  const [isLinking, setIsLinking] = React.useState(false);
  const [isIgnoring, setIsIgnoring] = React.useState(false);

  // Handler: Vincular
  const handleLink = async () => {
    if (!firestore || !storage || !organizationId || !pendingDoc || !transaction) return;

    setIsLinking(true);
    try {
      await linkDocumentToTransaction(firestore, storage, organizationId, pendingDoc, transaction.id);

      toast({
        title: t.reconciliation.linked,
        description: t.reconciliation.linkedDesc({ name: pendingDoc.invoiceNumber || pendingDoc.file.filename }),
      });

      onComplete();
      onOpenChange(false);
    } catch (error) {
      console.error('Error linking document:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.reconciliation.linkError,
      });
    } finally {
      setIsLinking(false);
    }
  };

  // Handler: Ignorar
  const handleIgnore = async () => {
    if (!firestore || !organizationId || !pendingDoc || !transaction) return;

    setIsIgnoring(true);
    try {
      await ignoreMatchSuggestion(firestore, organizationId, pendingDoc, transaction.id);

      toast({
        title: t.reconciliation.ignored,
        description: t.reconciliation.ignoredDesc,
      });

      onComplete();
      onOpenChange(false);
    } catch (error) {
      console.error('Error ignoring suggestion:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.reconciliation.ignoreError,
      });
    } finally {
      setIsIgnoring(false);
    }
  };

  if (!pendingDoc || !transaction) {
    return null;
  }

  const supplier = pendingDoc.supplierId
    ? contacts.find(c => c.id === pendingDoc.supplierId)
    : null;

  // Comparar imports
  const docAmount = pendingDoc.amount || 0;
  const txAmount = Math.abs(transaction.amount);
  const amountsMatch = Math.abs(docAmount - txAmount) < 0.01;

  // Comparar dates
  const docDate = pendingDoc.invoiceDate;
  const txDate = transaction.date;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>{t.reconciliation.title}</DialogTitle>
          <DialogDescription>
            {t.reconciliation.description}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-start">
          {/* Document pendent */}
          <div className="min-w-0 space-y-3 rounded-lg border bg-muted/20 p-4">
            <h4 className="font-medium text-sm text-muted-foreground">{t.reconciliation.pendingDoc}</h4>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="min-w-0 break-words">{pendingDoc.file.filename}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{t.reconciliation.invoiceNumber}:</span>
                <span>{pendingDoc.invoiceNumber || '—'}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{formatDate(docDate)}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="break-words">{supplier?.name || '—'}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span className="break-words">{getCategoryName(pendingDoc.categoryId)}</span>
              </div>

              <div className="pt-2">
                <span className={`text-lg font-bold ${amountsMatch ? 'text-green-600' : 'text-amber-600'}`}>
                  {formatCurrencyEU(docAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center py-1 md:py-0">
            <ArrowRight className="h-6 w-6 text-muted-foreground md:block hidden" />
            <ArrowRight className="h-6 w-6 rotate-90 text-muted-foreground md:hidden" />
          </div>

          {/* Transacció bancària */}
          <div className="min-w-0 space-y-3 rounded-lg border bg-muted/20 p-4">
            <h4 className="font-medium text-sm text-muted-foreground">{t.reconciliation.bankMovement}</h4>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{formatDate(txDate)}</span>
              </div>

              <div className="text-sm">
                <span className="break-words text-muted-foreground">
                  {transaction.description}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="break-words">{getContactName(transaction.contactId, contacts)}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span className="break-words">{getCategoryName(transaction.category)}</span>
              </div>

              <div className="pt-2">
                <span className={`text-lg font-bold ${amountsMatch ? 'text-green-600' : 'text-amber-600'}`}>
                  {formatCurrencyEU(txAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Indicadors de coincidència */}
        <div className="flex flex-wrap gap-2 py-2">
          <Badge variant={amountsMatch ? 'default' : 'secondary'} className={amountsMatch ? 'bg-green-100 text-green-800' : ''}>
            {amountsMatch ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
            {amountsMatch ? t.reconciliation.amountMatch : t.reconciliation.amountDifferent}
          </Badge>

          {supplier && transaction.description.toLowerCase().includes(supplier.name.toLowerCase().split(' ')[0]) && (
            <Badge variant="default" className="bg-green-100 text-green-800">
              <Check className="h-3 w-3 mr-1" />
              {t.reconciliation.supplierDetected}
            </Badge>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleIgnore}
            disabled={isLinking || isIgnoring}
          >
            {isIgnoring ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <X className="mr-2 h-4 w-4" />
            )}
            {t.reconciliation.ignore}
          </Button>
          <Button
            onClick={handleLink}
            disabled={isLinking || isIgnoring}
          >
            {isLinking ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            {t.reconciliation.link}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
