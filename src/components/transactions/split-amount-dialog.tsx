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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useTranslations } from '@/i18n';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import type { AnyContact, Category, Transaction } from '@/lib/data';
import { formatCurrencyEU } from '@/lib/normalize';
import {
  calculateSplitAmountDeltaCents,
  isSplitAmountBalanced,
} from '@/lib/fiscal/split-amount-balance';
import {
  MAX_SPLIT_CHILDREN,
  SPLIT_TOO_LARGE_CODE,
  getSplitTooLargeMessage,
} from '@/lib/transactions/split-contract';

type SplitKind = 'donation' | 'nonDonation';

interface SplitLineState {
  id: string;
  amountInput: string;
  kind: SplitKind;
  categoryId: string | null;
  contactId: string | null;
  note: string;
}

interface SplitAmountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  categories: Category[];
  contacts: AnyContact[];
  onApplied?: () => void;
}

interface ParsedSplitLine {
  id: string;
  amountCents: number | null;
  kind: SplitKind;
  categoryId: string | null;
  contactId: string | null;
  note: string;
  hasAmountError: boolean;
  hasCategoryError: boolean;
  hasContactError: boolean;
}

function createLine(partial?: Partial<SplitLineState>): SplitLineState {
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    amountInput: '',
    kind: 'donation',
    categoryId: null,
    contactId: null,
    note: '',
    ...partial,
  };
}

function parseAmountInputToCents(rawValue: string): number | null {
  const normalized = rawValue.trim().replace(',', '.');
  if (!normalized) return null;

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;

  return Math.round(amount * 100);
}

export function SplitAmountDialog({
  open,
  onOpenChange,
  transaction,
  categories,
  contacts,
  onApplied,
}: SplitAmountDialogProps) {
  const { tr, t } = useTranslations();
  const { toast } = useToast();
  const { user } = useFirebase();
  const { organizationId } = useCurrentOrganization();

  const [lines, setLines] = React.useState<SplitLineState[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const splitTooLargeMessage = tr(
    'movements.split.tooManyLines',
    getSplitTooLargeMessage()
  );

  const donorContacts = React.useMemo(
    () => contacts.filter((contact) => contact.type === 'donor'),
    [contacts]
  );

  const activeCategories = React.useMemo(
    () => categories.filter((category) => !category.archivedAt),
    [categories]
  );

  const contactsById = React.useMemo(() => {
    return new Map(contacts.map((contact) => [contact.id, contact]));
  }, [contacts]);

  const parentAmountCents = React.useMemo(() => {
    if (!transaction) return 0;
    return Math.round(transaction.amount * 100);
  }, [transaction]);

  React.useEffect(() => {
    if (!open || !transaction) return;

    const initialAmount = Math.max(parentAmountCents, 0) / 100;
    setLines([
      createLine({ amountInput: initialAmount.toFixed(2), kind: 'donation' }),
      createLine({ kind: 'nonDonation' }),
    ]);
  }, [open, transaction, parentAmountCents]);

  const parsedLines = React.useMemo<ParsedSplitLine[]>(() => {
    return lines.map((line) => {
      const amountCents = parseAmountInputToCents(line.amountInput);
      const selectedContact = line.contactId ? contactsById.get(line.contactId) : null;
      const hasAmountError = amountCents == null || amountCents <= 0;
      const hasCategoryError = line.kind === 'nonDonation' && !line.categoryId;
      const hasContactError = line.kind === 'donation' && (!line.contactId || selectedContact?.type !== 'donor');

      return {
        id: line.id,
        amountCents,
        kind: line.kind,
        categoryId: line.categoryId,
        contactId: line.contactId,
        note: line.note,
        hasAmountError,
        hasCategoryError,
        hasContactError,
      };
    });
  }, [lines, contactsById]);

  const parsedLineAmounts = React.useMemo(() => {
    return parsedLines.map((line) => line.amountCents ?? 0);
  }, [parsedLines]);

  const deltaCents = React.useMemo(() => {
    return calculateSplitAmountDeltaCents(parentAmountCents, parsedLineAmounts);
  }, [parentAmountCents, parsedLineAmounts]);

  const isDeltaBalanced = React.useMemo(() => {
    return isSplitAmountBalanced(parentAmountCents, parsedLineAmounts);
  }, [parentAmountCents, parsedLineAmounts]);

  const hasLineErrors = React.useMemo(() => {
    if (lines.length < 2) return true;
    return parsedLines.some((line) => line.hasAmountError || line.hasCategoryError || line.hasContactError);
  }, [lines.length, parsedLines]);

  const isAtSplitLineLimit = lines.length >= MAX_SPLIT_CHILDREN;
  const hasTooManyLines = lines.length > MAX_SPLIT_CHILDREN;
  const canApply = !isSubmitting && !hasLineErrors && isDeltaBalanced && !hasTooManyLines;

  const updateLine = React.useCallback((lineId: string, patch: Partial<SplitLineState>) => {
    setLines((previousLines) =>
      previousLines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              ...patch,
            }
          : line
      )
    );
  }, []);

  const handleAddLine = React.useCallback(() => {
    setLines((previousLines) => {
      if (previousLines.length >= MAX_SPLIT_CHILDREN) {
        return previousLines;
      }

      return [...previousLines, createLine({ kind: 'nonDonation' })];
    });
  }, []);

  const handleRemoveLine = React.useCallback((lineId: string) => {
    setLines((previousLines) => {
      if (previousLines.length <= 2) return previousLines;
      return previousLines.filter((line) => line.id !== lineId);
    });
  }, []);

  const handleApply = React.useCallback(async () => {
    if (!transaction || !organizationId || !canApply) return;

    const idToken = await user?.getIdToken();
    if (!idToken) {
      toast({
        variant: 'destructive',
        title: t.common.error,
      });
      return;
    }

    const payload = {
      orgId: organizationId,
      parentTxId: transaction.id,
      lines: parsedLines.map((line) => ({
        amountCents: line.amountCents ?? 0,
        kind: line.kind,
        categoryId: line.categoryId,
        contactId: line.contactId,
        note: line.note.trim() || null,
      })),
    };

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/transactions/split', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({
          variant: 'destructive',
          title: t.common.error,
          description:
            result?.code === SPLIT_TOO_LARGE_CODE
              ? splitTooLargeMessage
              : result?.error || t.common.error,
        });
        return;
      }

      onOpenChange(false);
      onApplied?.();
    } catch (error) {
      console.error('[split-amount-dialog] Error aplicant desglossament:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [canApply, onApplied, onOpenChange, organizationId, parsedLines, splitTooLargeMessage, t.common.error, toast, transaction, user]);

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{tr('movements.split.title')}</DialogTitle>
          <DialogDescription>{tr('movements.split.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1">
          {lines.map((line, index) => {
            const parsedLine = parsedLines.find((item) => item.id === line.id);
            const isDonationLine = line.kind === 'donation';

            return (
              <div key={line.id} className="rounded-md border p-3 space-y-3">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                  <div className="space-y-1 lg:col-span-1">
                    <Label>{tr('movements.split.amount')}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.amountInput}
                      onChange={(event) => {
                        updateLine(line.id, { amountInput: event.target.value });
                      }}
                      className={parsedLine?.hasAmountError ? 'border-destructive' : ''}
                    />
                  </div>

                  <div className="space-y-1 lg:col-span-2">
                    <Label>{tr('movements.split.kind')}</Label>
                    <Select
                      value={line.kind}
                      onValueChange={(value) => {
                        const nextKind = value as SplitKind;
                        updateLine(line.id, {
                          kind: nextKind,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="donation">{tr('movements.split.kindDonation')}</SelectItem>
                        <SelectItem value="nonDonation">{tr('movements.split.kindNonDonation')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1 lg:col-span-2">
                    <Label>{tr('movements.split.category')}</Label>
                    <Select
                      value={line.categoryId ?? '__none__'}
                      onValueChange={(value) => {
                        updateLine(line.id, { categoryId: value === '__none__' ? null : value });
                      }}
                    >
                      <SelectTrigger className={parsedLine?.hasCategoryError ? 'border-destructive' : ''}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t.common.none}</SelectItem>
                        {activeCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {t.categories[category.name as keyof typeof t.categories] || category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                  <div className="space-y-1 lg:col-span-2">
                    <Label>{tr('movements.split.contact')}</Label>
                    <Select
                      value={line.contactId ?? '__none__'}
                      onValueChange={(value) => {
                        updateLine(line.id, { contactId: value === '__none__' ? null : value });
                      }}
                    >
                      <SelectTrigger className={parsedLine?.hasContactError ? 'border-destructive' : ''}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t.common.none}</SelectItem>
                        {(isDonationLine ? donorContacts : contacts).map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1 lg:col-span-2">
                    <Label>{tr('movements.split.note')}</Label>
                    <Input
                      value={line.note}
                      onChange={(event) => {
                        updateLine(line.id, { note: event.target.value });
                      }}
                    />
                  </div>

                  <div className="flex items-end justify-end lg:col-span-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveLine(line.id)}
                      disabled={lines.length <= 2}
                      aria-label={`${t.common.delete} ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={handleAddLine} disabled={isAtSplitLineLimit || isSubmitting}>
              <Plus className="mr-2 h-4 w-4" />
              {tr('movements.split.addLine')}
            </Button>

            <div className={`text-sm tabular-nums ${isDeltaBalanced ? 'text-muted-foreground' : 'text-destructive'}`}>
              Δ {formatCurrencyEU(deltaCents / 100)}
            </div>
          </div>

          {isAtSplitLineLimit && (
            <p className={`text-sm ${hasTooManyLines ? 'text-destructive' : 'text-muted-foreground'}`}>
              {splitTooLargeMessage}
            </p>
          )}

          {!isDeltaBalanced && (
            <p className="text-sm text-destructive">{tr('movements.split.deltaInvalid')}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {tr('movements.split.cancel')}
          </Button>
          <Button onClick={handleApply} disabled={!canApply}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : tr('movements.split.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
