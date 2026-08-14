'use client';

import * as React from 'react';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { ExternalLink, FileText, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useUpdateOffBankExpense } from '@/hooks/use-project-module';
import { useTranslations } from '@/i18n';
import { buildDocumentFilename } from '@/lib/build-document-filename';
import type { DocumentReviewRow } from '@/lib/document-review';
import { openDocumentUrl, openOrganizationDocument } from '@/lib/open-document-url';
import type { OffBankAttachment } from '@/lib/project-module-types';

const ACCEPT_STRING = 'application/pdf,image/*,.doc,.docx,.xls,.xlsx';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

function getOffBankExpenseId(row: DocumentReviewRow | null): string | null {
  if (!row?.txId.startsWith('off_')) return null;
  return row.txId.slice(4).trim() || null;
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getContentType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'doc') return 'application/msword';
  if (extension === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (extension === 'xls') return 'application/vnd.ms-excel';
  if (extension === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return 'application/octet-stream';
}

function isAcceptedFile(file: File): boolean {
  const contentType = getContentType(file);
  return ACCEPTED_TYPES.has(contentType) || contentType.startsWith('image/');
}

function uniqueFilename(baseName: string, usedNames: Set<string>): string {
  if (!usedNames.has(baseName)) {
    usedNames.add(baseName);
    return baseName;
  }

  const lastDot = baseName.lastIndexOf('.');
  const stem = lastDot > 0 ? baseName.slice(0, lastDot) : baseName;
  const extension = lastDot > 0 ? baseName.slice(lastDot) : '';
  let index = 2;
  let candidate = `${stem}_doc${String(index).padStart(2, '0')}${extension}`;
  while (usedNames.has(candidate)) {
    index += 1;
    candidate = `${stem}_doc${String(index).padStart(2, '0')}${extension}`;
  }
  usedNames.add(candidate);
  return candidate;
}

export function OffBankDocumentCompletionDialog({
  open,
  onOpenChange,
  organizationId,
  row,
  attachments,
  canEdit,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
  row: DocumentReviewRow | null;
  attachments: OffBankAttachment[];
  canEdit: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const { storage, user } = useFirebase();
  const { update, isUpdating } = useUpdateOffBankExpense();
  const { toast } = useToast();
  const { tr } = useTranslations();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const canUploadRef = React.useRef(false);
  const [isUploading, setIsUploading] = React.useState(false);

  const expenseId = getOffBankExpenseId(row);
  const canUpload = canEdit && Boolean(organizationId && expenseId);
  const isProcessing = isUploading || isUpdating;

  React.useEffect(() => {
    canUploadRef.current = canUpload;
    if (!canUpload && open) onOpenChange(false);
  }, [canUpload, onOpenChange, open]);

  const handleOpenAttachment = React.useCallback((attachment: OffBankAttachment) => {
    if (!organizationId || !user) {
      openDocumentUrl(attachment.url);
      return;
    }

    void openOrganizationDocument({
      organizationId,
      storagePath: attachment.storagePath ?? null,
      fallbackUrl: attachment.url,
      getIdToken: () => user.getIdToken(),
    });
  }, [organizationId, user]);

  const handleFiles = React.useCallback(async (files: File[]) => {
    if (!canUploadRef.current || !organizationId || !expenseId || !row) return;

    const validFiles = files.filter((file) => isAcceptedFile(file) && file.size <= MAX_FILE_SIZE);
    if (validFiles.length === 0) {
      toast({
        variant: 'destructive',
        title: tr('projectModule.documentReview.complete.noValidFiles'),
        description: tr('projectModule.documentReview.complete.noValidFilesDesc'),
      });
      return;
    }

    setIsUploading(true);
    const uploadedByThisAttempt: ReturnType<typeof ref>[] = [];
    let persisted = false;
    try {
      const usedNames = new Set(attachments.map((attachment) => attachment.name));
      const uploaded: OffBankAttachment[] = [];

      for (const file of validFiles) {
        if (!canUploadRef.current) throw new Error('PROJECT_MUTATION_NOT_ALLOWED');
        const baseName = buildDocumentFilename({
          dateISO: row.paymentDate || row.dateExpense,
          concept: row.concept,
          originalName: file.name,
        });
        const finalName = uniqueFilename(baseName, usedNames);
        const storagePath = `organizations/${organizationId}/offBankExpenses/${expenseId}/${finalName}`;
        const storageRef = ref(storage, storagePath);
        const contentType = getContentType(file);
        const result = await uploadBytes(storageRef, file, {
          contentType,
          customMetadata: {
            originalFileName: file.name,
          },
        });
        uploadedByThisAttempt.push(storageRef);
        const url = await getDownloadURL(result.ref);
        uploaded.push({
          url,
          storagePath,
          name: finalName,
          contentType,
          size: file.size,
          uploadedAt: new Date().toISOString().split('T')[0],
        });
      }

      if (!canUploadRef.current) throw new Error('PROJECT_MUTATION_NOT_ALLOWED');
      await update(expenseId, { attachments: [...attachments, ...uploaded] });
      persisted = true;
      await onSaved();
      toast({
        title: tr('projectModule.documentReview.complete.savedTitle'),
        description: tr('projectModule.documentReview.complete.savedDesc'),
      });
      onOpenChange(false);
    } catch (error) {
      if (!persisted) {
        await Promise.all(uploadedByThisAttempt.map((storageRef) =>
          deleteObject(storageRef).catch(() => undefined)
        ));
      }
      toast({
        variant: 'destructive',
        title: tr('projectModule.documentReview.complete.errorTitle'),
        description: error instanceof Error ? error.message : tr('projectModule.documentReview.complete.errorDesc'),
      });
    } finally {
      setIsUploading(false);
    }
  }, [attachments, canUpload, expenseId, onOpenChange, onSaved, organizationId, row, storage, toast, tr, update]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{tr('projectModule.documentReview.complete.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1 text-sm">
            <div className="font-medium">{row?.concept || '-'}</div>
            <div className="text-muted-foreground">
              {row?.counterpartyName || '-'} · {row?.dateExpense || '-'}
            </div>
          </div>

          <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            {tr('projectModule.documentReview.complete.addOnlyNotice')}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              {tr('projectModule.documentReview.complete.currentDocuments')}
            </div>
            {attachments.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                {tr('projectModule.documentReview.complete.noCurrentDocuments')}
              </p>
            ) : (
              <div className="max-h-[220px] space-y-2 overflow-y-auto">
                {attachments.map((attachment) => (
                  <div
                    key={`${attachment.storagePath ?? attachment.url}-${attachment.name}`}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{attachment.name}</div>
                        <div className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => handleOpenAttachment(attachment)}
                      aria-label={tr('projectModule.documentReview.complete.openDocument')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT_STRING}
            className="hidden"
            disabled={!canUpload || isProcessing}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = '';
              if (files.length > 0) {
                void handleFiles(files);
              }
            }}
          />

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tr('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={!canUpload || isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {canEdit
                ? tr('projectModule.documentReview.complete.addDocuments')
                : tr('projectModule.documentReview.complete.readOnly')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
