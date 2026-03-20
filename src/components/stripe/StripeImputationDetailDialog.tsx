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
import { formatCurrencyEU, formatDateShort } from '@/lib/normalize';
import type { Transaction } from '@/lib/data';
import {
  formatStripeImputationStatus,
  type StripeImputationSummary,
} from '@/lib/stripe/activeStripeImputation';

interface StripeImputationDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentTransaction: Transaction | null;
  summary: StripeImputationSummary | null;
  onUndo: (transaction: Transaction) => void;
}

export function StripeImputationDetailDialog({
  open,
  onOpenChange,
  parentTransaction,
  summary,
  onUndo,
}: StripeImputationDetailDialogProps) {
  const handleUndo = React.useCallback(() => {
    if (!parentTransaction) return;
    onOpenChange(false);
    onUndo(parentTransaction);
  }, [onOpenChange, onUndo, parentTransaction]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0 pr-6">
          <DialogTitle>Detall imputació Stripe</DialogTitle>
          <DialogDescription>
            {summary
              ? formatStripeImputationStatus(summary)
              : 'No s’ha trobat cap imputació Stripe activa per aquest moviment.'}
          </DialogDescription>
        </DialogHeader>

        {summary && parentTransaction ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700">
                Stripe imputat
              </Badge>
              <Badge variant="secondary">
                {summary.donationCount} donaci{summary.donationCount === 1 ? 'o' : 'ons'}
              </Badge>
              {summary.adjustmentCount > 0 && (
                <Badge variant="secondary">
                  {summary.adjustmentCount} ajust{summary.adjustmentCount === 1 ? '' : 'os'}
                </Badge>
              )}
              <Badge variant="secondary">{formatCurrencyEU(summary.totalAmount)}</Badge>
            </div>

            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <div className="font-medium">{parentTransaction.description}</div>
              <div className="text-muted-foreground">
                {formatDateShort(parentTransaction.operationDate || parentTransaction.date)} · {formatCurrencyEU(parentTransaction.amount)}
              </div>
            </div>

            <div className="min-h-0 overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Donant</TableHead>
                    <TableHead>Referència</TableHead>
                    <TableHead className="text-right">Import</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>{formatDateShort(line.date)}</TableCell>
                      <TableCell className="max-w-[220px] truncate">
                        {line.donorDisplayName || line.customerEmail || 'Sense donant'}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">
                        {line.stripePaymentId || line.description || 'Sense identificador Stripe'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrencyEU(line.amountGross)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="shrink-0 border-t bg-background pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Tancar
              </Button>
              <Button variant="destructive" onClick={handleUndo}>
                Desfer imputació Stripe
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
