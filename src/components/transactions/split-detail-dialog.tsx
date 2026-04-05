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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Transaction } from '@/lib/data';
import { formatCurrencyEU } from '@/lib/normalize';
import { Loader2 } from 'lucide-react';
import { useTranslations } from '@/i18n';

interface SplitDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentTransaction: Transaction | null;
  splitParts: Transaction[];
  onUndoSplit: (parentTxId: string) => void;
  isUndoing?: boolean;
}

type SplitChildWithLegacyNote = Transaction & {
  notes?: string | null;
  contactName?: string | null;
};

export function SplitDetailDialog({
  open,
  onOpenChange,
  parentTransaction,
  splitParts,
  onUndoSplit,
  isUndoing = false,
}: SplitDetailDialogProps) {
  const { tr } = useTranslations();
  const totalParts = React.useMemo(
    () => splitParts.reduce((sum, item) => sum + item.amount, 0),
    [splitParts]
  );

  if (!parentTransaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[min(96vw,64rem)] overflow-hidden sm:w-[min(calc(100vw-3rem),64rem)]">
        <DialogHeader>
          <DialogTitle>{tr('dialogs.splitDetail.title', 'Detall del desglossament')}</DialogTitle>
          <DialogDescription>
            {tr('dialogs.splitDetail.description', 'El moviment bancari pare no es modifica. Pots revisar les parts i desfer el desglossament.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto pr-1">
          <div className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{tr('dialogs.splitDetail.originalAmount', 'Import original')}</span>
              <span className="font-medium">{formatCurrencyEU(parentTransaction.amount)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{tr('dialogs.splitDetail.totalParts', 'Total parts')}</span>
              <span className="font-medium">{formatCurrencyEU(totalParts)}</span>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px] text-right">{tr('dialogs.splitDetail.amount', 'Import')}</TableHead>
                  <TableHead className="w-[120px]">{tr('dialogs.splitDetail.type', 'Tipus')}</TableHead>
                  <TableHead>{tr('dialogs.splitDetail.contact', 'Contacte')}</TableHead>
                  <TableHead>{tr('dialogs.splitDetail.note', 'Nota')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {splitParts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {tr('dialogs.splitDetail.detailEmpty', 'No hi ha línies actives.')}
                    </TableCell>
                  </TableRow>
                ) : (
                  splitParts.map((item) => {
                    const itemWithLegacy = item as SplitChildWithLegacyNote;
                    const itemNote = item.note ?? itemWithLegacy.notes ?? '';
                    const contactLabel = itemWithLegacy.contactName || '—';
                    const isDonationLine = item.transactionType === 'donation';

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-right font-mono">{formatCurrencyEU(item.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={isDonationLine ? 'default' : 'secondary'}>
                            {isDonationLine
                              ? tr('dialogs.splitDetail.donationType', 'Donació')
                              : tr('dialogs.splitDetail.otherType', 'Altres')}
                          </Badge>
                        </TableCell>
                        <TableCell>{contactLabel}</TableCell>
                        <TableCell className="max-w-[280px] truncate" title={itemNote || ''}>
                          {itemNote || '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="text-orange-600 border-orange-300 hover:bg-orange-50"
            disabled={isUndoing}
            onClick={() => onUndoSplit(parentTransaction.id)}
          >
            {isUndoing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {tr('dialogs.splitDetail.undo', 'Desfer desglossament')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
