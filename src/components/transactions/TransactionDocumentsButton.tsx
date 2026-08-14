'use client';

import * as React from 'react';
import { collection, orderBy, query } from 'firebase/firestore';
import { FileText, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { useTranslations } from '@/i18n';
import type { Transaction } from '@/lib/data';
import {
  resolveTransactionDocuments,
  type TransactionDocumentRecord,
} from '@/lib/transactions/transaction-documents';
import { TransactionDocumentsDialog } from './TransactionDocumentsDialog';

interface TransactionDocumentsButtonProps {
  transaction: Transaction;
  canEdit?: boolean;
  loading?: boolean;
}

export function TransactionDocumentsButton({
  transaction,
  canEdit = false,
  loading = false,
}: TransactionDocumentsButtonProps) {
  const { firestore } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const { tr } = useTranslations();
  const [open, setOpen] = React.useState(false);
  const documentsQuery = useMemoFirebase(() => {
    if (!organizationId) return null;
    return query(
      collection(firestore, 'organizations', organizationId, 'transactions', transaction.id, 'documents'),
      orderBy('createdAt', 'asc')
    );
  }, [firestore, organizationId, transaction.id]);
  const { data: documents, isLoading } = useCollection<TransactionDocumentRecord>(
    documentsQuery,
    [organizationId, transaction.id],
    { ignorePermissionDenied: true }
  );
  const resolved = React.useMemo(() => resolveTransactionDocuments({
    transactionId: transaction.id,
    legacyDocument: transaction.document,
    documents: documents ?? [],
  }), [documents, transaction.document, transaction.id]);
  const label = resolved.count === 0
    ? tr('movements.documents.emptyShort', 'Sense documents')
    : resolved.count === 1
      ? tr('movements.documents.oneShort', '1 document')
      : tr('movements.documents.countShort', '{count} documents').replace('{count}', String(resolved.count));

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative h-8 w-8"
            onClick={() => setOpen(true)}
            aria-label={label}
          >
            {loading || isLoading ? (
              <Loader2 className="h-[18px] w-[18px] animate-spin text-muted-foreground" />
            ) : (
              <FileText className={`h-[18px] w-[18px] ${resolved.count > 0 ? 'fill-current text-foreground/80' : 'text-foreground/65'}`} />
            )}
            {resolved.count > 1 && (
              <Badge className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full px-1 text-[10px]">
                {resolved.count}
              </Badge>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <TransactionDocumentsDialog
        organizationId={organizationId}
        transaction={transaction}
        documents={resolved.documents}
        open={open}
        onOpenChange={setOpen}
        canEdit={canEdit}
      />
    </>
  );
}
