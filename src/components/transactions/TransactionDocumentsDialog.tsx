'use client';

import * as React from 'react';
import { ExternalLink, Loader2, Star, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useFirebase } from '@/firebase';
import { useTranslations } from '@/i18n';
import type { Transaction } from '@/lib/data';
import {
  addTransactionDocument,
  deleteTransactionDocument,
  setPrimaryTransactionDocument,
} from '@/lib/files/transaction-documents';
import { openDocumentUrl, openTransactionDocument } from '@/lib/open-document-url';
import type { ResolvedTransactionDocument } from '@/lib/transactions/transaction-documents';
import { useToast } from '@/hooks/use-toast';

interface TransactionDocumentsDialogProps {
  organizationId: string | null;
  transaction: Transaction;
  documents: ResolvedTransactionDocument[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
}

export function TransactionDocumentsDialog({
  organizationId,
  transaction,
  documents,
  open,
  onOpenChange,
  canEdit = true,
}: TransactionDocumentsDialogProps) {
  const { firestore, storage, user } = useFirebase();
  const { tr } = useTranslations();
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);

  const canWrite = canEdit && !!organizationId;
  const countText = tr('movements.documents.count', '{count} documents')
    .replace('{count}', String(documents.length));

  const handlePickFile = React.useCallback(() => {
    if (!canWrite) return;
    fileInputRef.current?.click();
  }, [canWrite]);

  const handleFileSelected = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !organizationId || !canWrite) return;

    setPendingAction('upload');
    try {
      await addTransactionDocument({
        firestore,
        storage,
        organizationId,
        transaction,
        file,
        createdByUid: user?.uid ?? null,
      });
    } finally {
      setPendingAction(null);
    }
  }, [canWrite, firestore, organizationId, storage, transaction, user?.uid]);

  const handleSetPrimary = React.useCallback(async (documentId: string) => {
    if (!organizationId || !canWrite) return;
    setPendingAction(`primary:${documentId}`);
    try {
      await setPrimaryTransactionDocument(firestore, organizationId, transaction, documentId);
    } finally {
      setPendingAction(null);
    }
  }, [canWrite, firestore, organizationId, transaction]);

  const handleDelete = React.useCallback(async (documentId: string) => {
    if (!organizationId || !canWrite) return;
    setPendingAction(`delete:${documentId}`);
    try {
      const deletion = await deleteTransactionDocument(firestore, organizationId, transaction, documentId);
      if (deletion.cleanupPending) {
        toast({
          variant: 'destructive',
          title: tr('movements.table.documentCleanupPending', 'Document desvinculat; la neteja del fitxer queda pendent.'),
        });
      }
    } finally {
      setPendingAction(null);
    }
  }, [canWrite, firestore, organizationId, toast, tr, transaction]);

  const handleOpen = React.useCallback(async (document: ResolvedTransactionDocument) => {
    if (!organizationId || !user) {
      openDocumentUrl(document.url);
      return;
    }

    setPendingAction(`open:${document.id}`);
    try {
      await openTransactionDocument({
        organizationId,
        transactionId: transaction.id,
        documentId: document.id,
        fallbackUrl: document.url,
        getIdToken: () => user.getIdToken(),
      });
    } finally {
      setPendingAction(null);
    }
  }, [organizationId, transaction.id, user]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{tr('movements.documents.title', 'Documents del moviment')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {documents.length === 0
                ? tr('movements.documents.empty', 'Aquest moviment no té documents.')
                : countText}
            </p>
            {canWrite && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={handleFileSelected}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handlePickFile}
                  disabled={pendingAction !== null}
                >
                  {pendingAction === 'upload' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {tr('movements.documents.add', 'Afegir')}
                </Button>
              </>
            )}
          </div>

          {!canEdit && (
            <p
              role="status"
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-900"
            >
              {tr(
                'movements.documents.readOnlyByPlan',
                'El pla o la configuració actual permet consultar i descarregar la documentació existent, però no modificar-la.'
              )}
            </p>
          )}

          <div className="max-h-[360px] space-y-2 overflow-y-auto">
            {documents.map((document) => (
              <div
                key={document.id}
                className="flex min-w-0 items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{document.filename}</p>
                    {document.isPrimary && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {tr('movements.documents.primary', 'Principal')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {document.isLegacy
                      ? tr('movements.documents.legacy', 'Document anterior')
                      : document.contentType || tr('movements.documents.file', 'Fitxer')}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => void handleOpen(document)}
                    disabled={pendingAction !== null}
                    aria-label={tr('movements.documents.open', 'Obrir')}
                  >
                    {pendingAction === `open:${document.id}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                  </Button>
                  {canWrite && !document.isPrimary && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleSetPrimary(document.id)}
                      disabled={pendingAction !== null}
                      aria-label={tr('movements.documents.setPrimary', 'Marcar com a principal')}
                    >
                      {pendingAction === `primary:${document.id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Star className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  {canWrite && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(document.id)}
                      disabled={pendingAction !== null}
                      aria-label={tr('movements.documents.delete', 'Desvincular')}
                    >
                      {pendingAction === `delete:${document.id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
