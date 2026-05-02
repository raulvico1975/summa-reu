'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from '@/i18n';
import {
  Upload,
  FileText,
  FileCode,
  Check,
  X,
  AlertCircle,
  Loader2,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { ref, uploadBytes } from 'firebase/storage';
import { doc, collection, serverTimestamp, setDoc, query, where, getDocs } from 'firebase/firestore';
import { computeSha256 } from '@/lib/files/sha256';
import { pendingDocumentsCollection } from '@/lib/pending-documents/refs';
import { assertUploadContext } from '@/lib/storage-upload-guard';
import { isStorageUnauthorizedError, reportStorageUnauthorized } from '@/lib/system-incidents';
import { extractXmlData } from '@/lib/pending-documents/extract-xml';
import { extractPdfData } from '@/lib/pending-documents/extract-pdf';
import { extractImageData } from '@/lib/pending-documents/extract-image';
import type { PendingDocument, PendingDocumentType } from '@/lib/pending-documents/types';
import type { Contact } from '@/lib/data';

// =============================================================================
// TYPES
// =============================================================================

type FileUploadStatus = 'queued' | 'hashing' | 'checking' | 'uploading' | 'saving' | 'extracting' | 'done' | 'error' | 'duplicate';

interface FileUploadItem {
  id: string;
  file: File;
  status: FileUploadStatus;
  progress: number;
  error?: string;
  sha256?: string;
  docId?: string;
}

interface PendingDocumentsUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete?: (count: number) => void;
  /** Contactes per fer match de proveïdor durant l'extracció XML */
  contacts?: Contact[];
  /** Fitxers inicials per carregar automàticament (drag & drop extern) */
  initialFiles?: File[];
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Determina el tipus de document basat en l'extensió.
 * - Imatges (jpg, png, etc.) → receipt (tiquet)
 * - XML → invoice (factura electrònica)
 * - PDF → unknown (pot ser factura, nòmina o tiquet)
 */
function detectDocumentType(filename: string): PendingDocumentType {
  const ext = filename.toLowerCase().split('.').pop();

  // Imatges són normalment tickets/rebuts
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
    return 'receipt';
  }

  // XML són normalment factures electròniques
  if (ext === 'xml') {
    return 'invoice';
  }

  // PDF pot ser qualsevol cosa, l'AI ho determinarà
  return 'unknown';
}

/**
 * Determina el contentType del fitxer.
 */
function getContentType(file: File): string {
  if (file.type) return file.type;

  const ext = file.name.toLowerCase().split('.').pop();
  switch (ext) {
    case 'xml':
      return 'application/xml';
    case 'pdf':
      return 'application/pdf';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Retorna la icona segons l'extensió del fitxer.
 */
function getFileIcon(filename: string) {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'xml') {
    return <FileCode className="h-5 w-5 text-orange-500" />;
  }
  return <FileText className="h-5 w-5 text-blue-500" />;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PendingDocumentsUploadModal({
  open,
  onOpenChange,
  onUploadComplete,
  contacts = [],
  initialFiles,
}: PendingDocumentsUploadModalProps) {
  const { firestore, storage, auth } = useFirebase();
  const { organizationId, organization } = useCurrentOrganization();
  const { toast } = useToast();
  const { t } = useTranslations();

  const [files, setFiles] = React.useState<FileUploadItem[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Netejar estat quan es tanca
  React.useEffect(() => {
    if (!open) {
      setFiles([]);
      setIsUploading(false);
      setIsDragging(false);
    }
  }, [open]);

  // Carregar fitxers inicials quan s'obre el modal (drag & drop extern)
  React.useEffect(() => {
    if (open && initialFiles && initialFiles.length > 0 && files.length === 0) {
      const validFiles = initialFiles.filter(f => {
        const ext = f.name.toLowerCase().split('.').pop();
        return ['pdf', 'xml', 'jpg', 'jpeg', 'png'].includes(ext || '');
      });

      if (validFiles.length > 0) {
        const newItems: FileUploadItem[] = validFiles.map(file => ({
          id: crypto.randomUUID(),
          file,
          status: 'queued' as const,
          progress: 0,
        }));
        setFiles(newItems);
      }
    }
  }, [open, initialFiles]);

  // Afegir fitxers a la llista
  const addFiles = React.useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const validFiles = fileArray.filter(f => {
      const ext = f.name.toLowerCase().split('.').pop();
      return ['pdf', 'xml', 'jpg', 'jpeg', 'png'].includes(ext || '');
    });

    if (validFiles.length < fileArray.length) {
      toast({
        variant: 'destructive',
        title: t.pendingDocs.upload.invalidFiles,
        description: t.pendingDocs.upload.invalidFilesDesc,
      });
    }

    const newItems: FileUploadItem[] = validFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      status: 'queued',
      progress: 0,
    }));

    setFiles(prev => [...prev, ...newItems]);
  }, [toast]);

  // Handlers de drag & drop
  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  // Handler per selecció de fitxers
  const handleFileSelect = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      // Reset input per permetre seleccionar el mateix fitxer
      e.target.value = '';
    }
  }, [addFiles]);

  // Eliminar fitxer de la llista
  const removeFile = React.useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  // Actualitzar estat d'un fitxer
  const updateFileStatus = React.useCallback((
    id: string,
    updates: Partial<FileUploadItem>
  ) => {
    setFiles(prev => prev.map(f =>
      f.id === id ? { ...f, ...updates } : f
    ));
  }, []);

  // Comprovar si el hash ja existeix (dedupe)
  const checkDuplicate = React.useCallback(async (sha256: string): Promise<boolean> => {
    if (!organizationId || !firestore) return false;

    try {
      const collRef = pendingDocumentsCollection(firestore, organizationId);
      const q = query(
        collRef,
        where('file.sha256', '==', sha256),
        where('status', 'in', ['draft', 'confirmed', 'sepa_generated', 'matched'])
      );
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('[checkDuplicate] Error:', error);
      return false;
    }
  }, [organizationId, firestore]);

  // Processar un fitxer
  const processFile = React.useCallback(async (item: FileUploadItem): Promise<boolean> => {
    if (!organizationId || !firestore || !storage) return false;

    try {
      // 1. Calcular SHA256
      updateFileStatus(item.id, { status: 'hashing', progress: 10 });
      const sha256 = await computeSha256(item.file);
      updateFileStatus(item.id, { sha256, progress: 30 });

      // 2. Comprovar duplicat
      updateFileStatus(item.id, { status: 'checking', progress: 40 });
      const isDuplicate = await checkDuplicate(sha256);
      if (isDuplicate) {
        updateFileStatus(item.id, { status: 'duplicate', progress: 100 });
        return false;
      }

      // 3. Generar docId
      const docId = doc(pendingDocumentsCollection(firestore, organizationId)).id;
      updateFileStatus(item.id, { docId, progress: 50 });

      // 4. Pujar a Storage
      updateFileStatus(item.id, { status: 'uploading', progress: 60 });
      const storagePath = `organizations/${organizationId}/pendingDocuments/${docId}/${item.file.name}`;

      // Diagnòstic diferencial: verificar context d'upload
      const uploadCheck = assertUploadContext({
        contextLabel: 'pendents',
        orgId: organizationId,
        path: storagePath,
      });

      if (!uploadCheck.ok) {
        const msg = uploadCheck.reason === 'NO_AUTH'
          ? 'Sessió no preparada. Torna-ho a intentar en 2 segons.'
          : 'Organització no identificada.';
        updateFileStatus(item.id, { status: 'error', error: msg });
        return false;
      }

      const storageRef = ref(storage, storagePath);
      const contentType = getContentType(item.file);

      await uploadBytes(storageRef, item.file, {
        contentType,
        customMetadata: {
          originalFileName: item.file.name,
          sha256,
        },
      });
      updateFileStatus(item.id, { progress: 80 });

      // 5. Crear document Firestore
      updateFileStatus(item.id, { status: 'saving', progress: 90 });
      const docRef = doc(pendingDocumentsCollection(firestore, organizationId), docId);
      const now = serverTimestamp();

      const pendingDoc: Omit<PendingDocument, 'id'> = {
        status: 'draft',
        type: detectDocumentType(item.file.name),
        file: {
          storagePath,
          filename: item.file.name,
          contentType,
          sizeBytes: item.file.size,
          sha256,
        },
        invoiceNumber: null,
        invoiceDate: null,
        amount: null,
        supplierId: null,
        categoryId: null,
        extracted: null,
        sepa: null,
        matchedTransactionId: null,
        reportId: null,
        createdAt: now as any,
        updatedAt: now as any,
        confirmedAt: null,
      };

      await setDoc(docRef, pendingDoc);

      // 6. Extracció automàtica (XML o PDF)
      const isXml =
        contentType.includes('xml') ||
        item.file.name.toLowerCase().endsWith('.xml');

      const isPdf =
        contentType === 'application/pdf' ||
        item.file.name.toLowerCase().endsWith('.pdf');

      // Construir el document complet per passar als extractors
      const fullDoc: PendingDocument = {
        id: docId,
        ...pendingDoc,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };

      if (isXml) {
        updateFileStatus(item.id, { status: 'extracting', progress: 95 });

        try {
          await extractXmlData(storage, firestore, organizationId, fullDoc, contacts);
        } catch (extractError) {
          // L'extracció pot fallar sense bloquejar l'upload
          console.warn('[processFile] XML extraction error (non-blocking):', extractError);
        }
      } else if (isPdf && organization) {
        updateFileStatus(item.id, { status: 'extracting', progress: 95 });

        try {
          await extractPdfData(
            storage,
            firestore,
            organizationId,
            organization.name || '',
            organization.taxId || '',
            fullDoc,
            contacts
          );
        } catch (extractError) {
          // L'extracció pot fallar sense bloquejar l'upload
          console.warn('[processFile] PDF extraction error (non-blocking):', extractError);
        }
      } else if (contentType.startsWith('image/')) {
        // Imatges (tickets) - extraure amb IA
        updateFileStatus(item.id, { status: 'extracting', progress: 95 });

        try {
          const authUser = auth.currentUser;
          if (!authUser) {
            throw new Error('Sessió no vàlida. Torna a iniciar sessió.');
          }
          await extractImageData(storage, firestore, organizationId, fullDoc, await authUser.getIdToken());
        } catch (extractError) {
          // L'extracció pot fallar sense bloquejar l'upload
          console.warn('[processFile] Image extraction error (non-blocking):', extractError);
        }
      }

      updateFileStatus(item.id, { status: 'done', progress: 100 });
      return true;
    } catch (error) {
      console.error('[processFile] Error:', error);

      // Detectar i reportar storage/unauthorized
      if (isStorageUnauthorizedError(error) && firestore && organizationId) {
        const storagePath = `organizations/${organizationId}/pendingDocuments/${item.docId || 'unknown'}/${item.file.name}`;
        reportStorageUnauthorized(firestore, {
          storagePath,
          feature: 'pendingDocuments',
          route: typeof window !== 'undefined' ? window.location.pathname : undefined,
          orgId: organizationId,
          orgSlug: organization?.slug,
          originalError: error,
        }).catch(reportErr => console.error('[processFile] Failed to report storage incident:', reportErr));
      }

      const errorMessage = error instanceof Error ? error.message : t.common.unknownError;
      updateFileStatus(item.id, { status: 'error', error: errorMessage });
      return false;
    }
  }, [organizationId, organization, firestore, storage, auth, updateFileStatus, checkDuplicate, contacts, t]);

  // Iniciar upload de tots els fitxers
  const startUpload = React.useCallback(async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    try {
      // Processar en sèrie per evitar sobrecàrrega
      for (const item of files) {
        if (item.status !== 'queued') continue;

        const success = await processFile(item);
        if (success) {
          successCount++;
        } else {
          // Verificar si era duplicat
          const updatedItem = files.find(f => f.id === item.id);
          if (updatedItem?.status === 'duplicate') {
            duplicateCount++;
          } else {
            errorCount++;
          }
        }
      }

      // Toast de resum
      if (successCount > 0) {
        toast({
          title: t.pendingDocs.toasts.uploaded({ count: successCount }),
          description: duplicateCount > 0
            ? t.pendingDocs.toasts.uploadedWithDuplicates({ duplicates: duplicateCount })
            : undefined,
        });
        onUploadComplete?.(successCount);
      } else if (duplicateCount > 0 && errorCount === 0) {
        toast({
          title: t.pendingDocs.toasts.allDuplicates,
          description: t.pendingDocs.toasts.allDuplicatesDesc,
        });
      } else if (errorCount > 0) {
        toast({
          variant: 'destructive',
          title: t.pendingDocs.toasts.uploadFailed,
          description: t.pendingDocs.upload.stats.errors({ count: errorCount }),
        });
      }

      // Tancar modal si tot ok
      if (errorCount === 0) {
        setTimeout(() => onOpenChange(false), 500);
      }
    } finally {
      setIsUploading(false);
    }
  }, [files, processFile, toast, onOpenChange, onUploadComplete]);

  // Calcular estadístiques
  const stats = React.useMemo(() => {
    const queued = files.filter(f => f.status === 'queued').length;
    const processing = files.filter(f =>
      ['hashing', 'checking', 'uploading', 'saving'].includes(f.status)
    ).length;
    const done = files.filter(f => f.status === 'done').length;
    const errors = files.filter(f => f.status === 'error').length;
    const duplicates = files.filter(f => f.status === 'duplicate').length;
    return { queued, processing, done, errors, duplicates, total: files.length };
  }, [files]);

  const canStartUpload = stats.queued > 0 && !isUploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t.pendingDocs.upload.title}
          </DialogTitle>
          <DialogDescription>
            {t.pendingDocs.upload.description}
          </DialogDescription>
        </DialogHeader>

        {/* Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.xml,.jpg,.jpeg,.png"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {isDragging ? t.pendingDocs.upload.dropHere : t.pendingDocs.upload.dragOrClick}
          </p>
        </div>

        {/* Llista de fitxers */}
        {files.length > 0 && (
          <div className="max-h-60 overflow-y-auto space-y-2">
            {files.map(item => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border',
                  item.status === 'done' && 'bg-green-50 border-green-200',
                  item.status === 'error' && 'bg-red-50 border-red-200',
                  item.status === 'duplicate' && 'bg-amber-50 border-amber-200'
                )}
              >
                {/* Icona */}
                {getFileIcon(item.file.name)}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.file.name}</p>
                  <div className="flex items-center gap-2">
                    {item.status === 'queued' && (
                      <span className="text-xs text-muted-foreground">{t.pendingDocs.upload.status.queued}</span>
                    )}
                    {item.status === 'hashing' && (
                      <span className="text-xs text-blue-600">{t.pendingDocs.upload.status.hashing}</span>
                    )}
                    {item.status === 'checking' && (
                      <span className="text-xs text-blue-600">{t.pendingDocs.upload.status.checking}</span>
                    )}
                    {item.status === 'uploading' && (
                      <span className="text-xs text-blue-600">{t.pendingDocs.upload.status.uploading}</span>
                    )}
                    {item.status === 'saving' && (
                      <span className="text-xs text-blue-600">{t.pendingDocs.upload.status.saving}</span>
                    )}
                    {item.status === 'extracting' && (
                      <span className="text-xs text-purple-600">{t.pendingDocs.upload.status.extracting}</span>
                    )}
                    {item.status === 'done' && (
                      <span className="text-xs text-green-600">{t.pendingDocs.upload.status.done}</span>
                    )}
                    {item.status === 'error' && (
                      <span className="text-xs text-red-600">{item.error || t.pendingDocs.upload.status.error}</span>
                    )}
                    {item.status === 'duplicate' && (
                      <span className="text-xs text-amber-600">{t.pendingDocs.upload.status.duplicate}</span>
                    )}
                  </div>
                  {/* Barra de progrés */}
                  {['hashing', 'checking', 'uploading', 'saving', 'extracting'].includes(item.status) && (
                    <Progress value={item.progress} className="h-1 mt-1" />
                  )}
                </div>

                {/* Estat/Accions */}
                <div className="flex-shrink-0">
                  {item.status === 'queued' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(item.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                  {['hashing', 'checking', 'uploading', 'saving', 'extracting'].includes(item.status) && (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  )}
                  {item.status === 'done' && (
                    <Check className="h-5 w-5 text-green-500" />
                  )}
                  {item.status === 'error' && (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  {item.status === 'duplicate' && (
                    <X className="h-5 w-5 text-amber-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Resum i accions */}
        {files.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{t.pendingDocs.upload.stats.files({ count: stats.total })}</span>
              {stats.done > 0 && (
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  {t.pendingDocs.upload.stats.completed({ count: stats.done })}
                </Badge>
              )}
              {stats.duplicates > 0 && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700">
                  {t.pendingDocs.upload.stats.duplicates({ count: stats.duplicates })}
                </Badge>
              )}
              {stats.errors > 0 && (
                <Badge variant="outline" className="bg-red-50 text-red-700">
                  {t.pendingDocs.upload.stats.errors({ count: stats.errors })}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isUploading}
              >
                {stats.done === stats.total && stats.total > 0 ? t.pendingDocs.actions.close : t.pendingDocs.actions.cancel}
              </Button>
              {canStartUpload && (
                <Button onClick={startUpload}>
                  <Upload className="mr-2 h-4 w-4" />
                  {t.pendingDocs.upload.button({ count: stats.queued })}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
