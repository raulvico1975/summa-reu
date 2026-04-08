// src/components/project-module/quick-expense-screen.tsx
// Pantalla minimalista per captura ràpida de despeses (<10s)
// Flux: Foto → Import → Guardar
// Auto: date=avui, needsReview=true, sense projecte/partida
// IA: extracció automàtica de data, import i concepte

'use client';

import * as React from 'react';
import { useState, useRef, useCallback } from 'react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useStorage } from '@/firebase/provider';
import { useSaveOffBankExpense, useUpdateOffBankExpense } from '@/hooks/use-project-module';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/i18n';
import { suggestCategory } from '@/lib/expense-category-suggestions';
import type { OffBankAttachment } from '@/lib/project-module-types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, X, Loader2, Check, Image as ImageIcon, FileText, ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useOrgUrl } from '@/hooks/organization-provider';

// =============================================================================
// TYPES
// =============================================================================

interface QuickExpenseScreenProps {
  organizationId: string;
  /** Mode landing: 100dvh, sense scroll, footer absolut amb safe-area */
  isLandingMode?: boolean;
}

interface PendingUpload {
  file: File;
  id: string;
  uploading: boolean;
  url?: string;
  storagePath?: string;
  error?: string;
}

/** Resultat de l'extracció IA */
interface AIExtraction {
  date: string | null;
  amount: number | null;
  currency: string | null;
  merchant: string | null;
  concept: string | null;
  confidence: number;
}

/** Estat de l'extracció IA */
type AIExtractionState = 'idle' | 'extracting' | 'done' | 'error';

// =============================================================================
// CONSTANTS
// =============================================================================

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ACCEPTED_DOC_TYPES = ['application/pdf'];
const ALL_ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_DOC_TYPES];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// =============================================================================
// HELPERS
// =============================================================================

function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith('image/')) {
    return <ImageIcon className="h-5 w-5 text-blue-500" />;
  }
  return <FileText className="h-5 w-5 text-gray-500" />;
}

function buildAttachmentsFromUploads(entries: PendingUpload[]): OffBankAttachment[] {
  const uploadedAt = new Date().toISOString().split('T')[0];

  return entries
    .filter((entry) => entry.url && !entry.error)
    .map((entry) => ({
      url: entry.url!,
      name: entry.file.name,
      contentType: entry.file.type,
      size: entry.file.size,
      uploadedAt,
    }));
}

// =============================================================================
// COMPONENT
// =============================================================================

export function QuickExpenseScreen({ organizationId, isLandingMode = false }: QuickExpenseScreenProps) {
  const storage = useStorage();
  const { save, isSaving } = useSaveOffBankExpense();
  const { update, isUpdating } = useUpdateOffBankExpense();
  const { toast } = useToast();
  const { tr } = useTranslations();
  const { buildUrl } = useOrgUrl();

  // Refs per inputs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refs per detectar si l'usuari ha editat manualment els camps
  const userEditedAmount = useRef(false);
  const userEditedConcept = useRef(false);
  const userEditedDate = useRef(false);

  // Estats
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [amountEUR, setAmountEUR] = useState('');
  const [concept, setConcept] = useState('');
  const [date, setDate] = useState(''); // Per a la data extreta per IA
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftExpenseId, setDraftExpenseId] = useState<string | null>(null);
  const [isDraftSyncing, setIsDraftSyncing] = useState(false);

  // Estats multimoneda (per monedes ≠ EUR)
  const [currency, setCurrency] = useState('EUR');
  const [amountOriginal, setAmountOriginal] = useState('');

  // Estat IA
  const [aiState, setAIState] = useState<AIExtractionState>('idle');
  const [aiExtraction, setAIExtraction] = useState<AIExtraction | null>(null);
  const [lastAIAttempt, setLastAIAttempt] = useState<{ fileUrl: string; storagePath: string } | null>(null);

  // Derivats
  const hasAttachments = uploads.some(u => u.url && !u.error);
  const isUploading = uploads.some(u => u.uploading);
  const isPersisting = isSubmitting || isDraftSyncing || isSaving || isUpdating;
  const canSubmit = hasAttachments && !isUploading && !isPersisting;

  const buildDraftPayload = useCallback((entries: PendingUpload[]) => {
    const attachments = buildAttachmentsFromUploads(entries);

    if (attachments.length === 0) {
      return null;
    }

    const finalDate = date || new Date().toISOString().split('T')[0];
    const finalConcept = concept.trim() || tr('projectModule.quickExpense.defaultConcept');
    const suggestedCategory = suggestCategory(finalConcept);

    const isMulticurrency = currency !== 'EUR' && currency !== '';
    let finalAmountEUR: string | null = null;
    let finalOriginalCurrency: string | null = null;
    let finalOriginalAmount: string | null = null;

    if (isMulticurrency) {
      finalOriginalCurrency = currency;
      const parsedOriginal = amountOriginal.trim() ? parseFloat(amountOriginal) : null;
      finalOriginalAmount = parsedOriginal !== null && !Number.isNaN(parsedOriginal)
        ? String(parsedOriginal)
        : null;

      const parsedEUR = amountEUR.trim() ? parseFloat(amountEUR) : null;
      if (parsedEUR !== null && parsedEUR > 0) {
        finalAmountEUR = String(parsedEUR);
      }
    } else {
      const parsedAmount = amountEUR.trim() ? parseFloat(amountEUR) : null;
      if (parsedAmount !== null && parsedAmount > 0) {
        finalAmountEUR = String(parsedAmount);
      }
    }

    return {
      date: finalDate,
      concept: finalConcept,
      amountEUR: finalAmountEUR,
      counterpartyName: '',
      categoryName: suggestedCategory ?? '',
      attachments,
      needsReview: true,
      originalCurrency: finalOriginalCurrency,
      originalAmount: finalOriginalAmount,
    };
  }, [amountEUR, amountOriginal, concept, currency, date, tr]);

  const syncDraftExpense = useCallback(async (entries: PendingUpload[]) => {
    const payload = buildDraftPayload(entries);

    if (!payload) {
      if (draftExpenseId) {
        await update(draftExpenseId, { attachments: [] });
      }
      return;
    }

    setIsDraftSyncing(true);
    try {
      if (draftExpenseId) {
        await update(draftExpenseId, payload);
      } else {
        const newId = await save(payload);
        setDraftExpenseId(newId);
      }
    } catch (error) {
      console.error('[QuickExpense] Draft sync error:', error);
      toast({
        title: tr('projectModule.quickExpense.errorTitle'),
        description: tr('projectModule.quickExpense.errorBody'),
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsDraftSyncing(false);
    }
  }, [buildDraftPayload, draftExpenseId, save, toast, tr, update]);

  // ---------------------------------------------------------------------------
  // IA EXTRACTION
  // ---------------------------------------------------------------------------

  const extractWithAI = useCallback(async (fileUrl: string, storagePath: string) => {
    // Només intentem extracció per imatges
    setLastAIAttempt({ fileUrl, storagePath });
    setAIState('extracting');

    try {
      const response = await fetch('/api/ai/extract-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl, storagePath }),
      });

      if (!response.ok) {
        console.warn('[QuickExpense] AI extraction failed:', response.status);
        setAIState('error');
        return;
      }

      const result = await response.json();
      const extraction: AIExtraction = {
        date: result.date ?? null,
        amount: result.amount ?? null,
        currency: result.currency ?? null,
        merchant: result.merchant ?? null,
        concept: result.concept ?? null,
        confidence: result.confidence ?? 0,
      };

      setAIExtraction(extraction);
      setAIState('done');

      // Preomplir camps només si l'usuari no els ha editat manualment
      if (extraction.date && !userEditedDate.current && !date) {
        setDate(extraction.date);
      }

      if (extraction.amount !== null && !userEditedAmount.current && !amountEUR && !amountOriginal) {
        const detectedCurrency = extraction.currency?.toUpperCase() || 'EUR';

        if (detectedCurrency === 'EUR') {
          setAmountEUR(String(extraction.amount));
          setCurrency('EUR');
        } else {
          // Moneda estrangera
          setCurrency(detectedCurrency);
          setAmountOriginal(String(extraction.amount));
          // amountEUR es calcularà amb fxRate del projecte o s'omplirà manualment
        }
      }

      if (!userEditedConcept.current && !concept) {
        // Combinar merchant + concept
        const parts = [extraction.merchant, extraction.concept].filter(Boolean);
        if (parts.length > 0) {
          setConcept(parts.join(' — '));
        }
      }

    } catch (error) {
      console.error('[QuickExpense] AI extraction error:', error);
      setAIState('error');
    }
  }, [date, amountEUR, amountOriginal, concept]);

  const handleRetryAI = useCallback(() => {
    if (!lastAIAttempt || aiState === 'extracting') return;
    extractWithAI(lastAIAttempt.fileUrl, lastAIAttempt.storagePath);
  }, [aiState, extractWithAI, lastAIAttempt]);

  // ---------------------------------------------------------------------------
  // FILE UPLOAD
  // ---------------------------------------------------------------------------

  const uploadFile = useCallback(async (file: File): Promise<{ url: string; storagePath: string } | null> => {
    const tempId = generateTempId();
    const storagePath = `organizations/${organizationId}/offBankExpenses/temp/${tempId}_${file.name}`;
    const storageRef = ref(storage, storagePath);

    try {
      const uploadResult = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(uploadResult.ref);
      return { url: downloadURL, storagePath };
    } catch (error) {
      console.error('[QuickExpense] Upload error:', error);
      return null;
    }
  }, [storage, organizationId]);

  const handleFiles = useCallback(async (files: File[]) => {
    const validFiles: PendingUpload[] = [];

    for (const file of files) {
      // Validar tipus
      if (!ALL_ACCEPTED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
        console.warn(`[QuickExpense] Tipus no acceptat: ${file.type}`);
        continue;
      }

      // Validar mida
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`[QuickExpense] Fitxer massa gran: ${file.name}`);
        continue;
      }

      validFiles.push({
        file,
        id: generateTempId(),
        uploading: true,
      });
    }

    if (validFiles.length === 0) return;

    // Afegir a la llista
    let nextUploads = [...uploads, ...validFiles];
    setUploads(nextUploads);

    // Pujar cadascun i extreure amb IA si és imatge
    let firstImageUpload: { url: string; storagePath: string } | null = null;

    for (const pending of validFiles) {
      const result = await uploadFile(pending.file);

      nextUploads = nextUploads.map((entry) =>
        entry.id === pending.id
          ? {
              ...entry,
              uploading: false,
              url: result?.url ?? undefined,
              storagePath: result?.storagePath ?? undefined,
              error: result ? undefined : 'Error',
            }
          : entry
      );
      setUploads(nextUploads);

      // Guardar la primera imatge per fer extracció IA
      if (result && pending.file.type.startsWith('image/') && !firstImageUpload) {
        firstImageUpload = result;
      }
    }

    // Fer extracció IA automàtica amb la primera imatge pujada
    if (firstImageUpload && aiState === 'idle') {
      extractWithAI(firstImageUpload.url, firstImageUpload.storagePath);
    }

    if (nextUploads.some((entry) => entry.url && !entry.error)) {
      await syncDraftExpense(nextUploads);
    }
  }, [aiState, extractWithAI, syncDraftExpense, uploadFile, uploads]);

  const handleRemoveUpload = useCallback(async (id: string) => {
    const upload = uploads.find(u => u.id === id);
    if (upload?.storagePath || upload?.url) {
      try {
        const storageRef = ref(storage, upload.storagePath ?? upload.url!);
        await deleteObject(storageRef).catch(() => {});
      } catch {}
    }

    const nextUploads = uploads.filter((entry) => entry.id !== id);
    setUploads(nextUploads);

    if (draftExpenseId) {
      await syncDraftExpense(nextUploads);
    }
  }, [draftExpenseId, storage, syncDraftExpense, uploads]);

  // ---------------------------------------------------------------------------
  // CAMERA HANDLER
  // ---------------------------------------------------------------------------

  const handleCameraClick = useCallback(() => {
    cameraInputRef.current?.click();
  }, []);

  const handleFileClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFiles(files);
    }
    e.target.value = '';
  }, [handleFiles]);

  // ---------------------------------------------------------------------------
  // SUBMIT
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);

    try {
      const isMulticurrency = currency !== 'EUR' && currency !== '';
      const parsedOriginal = amountOriginal.trim() ? parseFloat(amountOriginal) : null;
      const parsedAmount = amountEUR.trim() ? parseFloat(amountEUR) : null;

      if (isMulticurrency && parsedOriginal !== null && parsedOriginal <= 0) {
        toast({
          title: tr('projectModule.quickExpense.invalidAmountTitle'),
          description: tr('projectModule.quickExpense.invalidAmountDesc'),
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      if (!isMulticurrency && parsedAmount !== null && parsedAmount <= 0) {
        toast({
          title: tr('projectModule.quickExpense.invalidAmountTitle'),
          description: tr('projectModule.quickExpense.invalidAmountDesc'),
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      await syncDraftExpense(uploads);

      // Èxit
      toast({
        title: tr('projectModule.quickExpense.successTitle'),
        description: tr('projectModule.quickExpense.successBody'),
      });

      // Reset form per encadenar
      setUploads([]);
      setAmountEUR('');
      setAmountOriginal('');
      setConcept('');
      setDate('');
      setCurrency('EUR');
      setDraftExpenseId(null);
      setAIState('idle');
      setAIExtraction(null);
      setLastAIAttempt(null);
      userEditedAmount.current = false;
      userEditedConcept.current = false;
      userEditedDate.current = false;

    } catch (error) {
      console.error('[QuickExpense] Save error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [amountEUR, amountOriginal, canSubmit, currency, syncDraftExpense, toast, tr, uploads]);

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  // Limitar visualització d'adjunts en mode landing (màxim 2 visibles)
  const visibleUploads = isLandingMode ? uploads.slice(0, 2) : uploads;
  const hiddenCount = isLandingMode ? Math.max(0, uploads.length - 2) : 0;

  return (
    <div
      className={
        isLandingMode
          ? 'h-[100dvh] bg-background flex flex-col overflow-hidden'
          : 'min-h-screen bg-background flex flex-col'
      }
    >
      {/* Header minimalista */}
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <Link href={buildUrl('/project-module/expenses')}>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {tr('common.back')}
          </Button>
        </Link>
        <h1 className="font-semibold text-lg">
          {tr('projectModule.quickExpense.title')}
        </h1>
        <div className="w-20" /> {/* Spacer per centrar títol */}
      </div>

      {/* Contingut principal */}
      <div
        className={
          isLandingMode
            ? 'flex-1 flex flex-col p-4 gap-4 max-w-lg mx-auto w-full overflow-y-auto'
            : 'flex-1 flex flex-col p-4 gap-6 max-w-lg mx-auto w-full'
        }
      >

        {/* Secció 1: Captura foto/fitxer */}
        <div className="space-y-3">
          <Label className="text-base font-medium">
            {tr('projectModule.quickExpense.attachmentLabel')}
          </Label>

          {/* Botons captura */}
          <div className="flex gap-3">
            {/* Botó càmera (principal) */}
            <Button
              type="button"
              variant="default"
              size="lg"
              className="flex-1 h-20 flex-col gap-1"
              onClick={handleCameraClick}
              disabled={isUploading}
            >
              <Camera className="h-6 w-6" />
              <span className="text-sm">{tr('projectModule.quickExpense.cameraButton')}</span>
            </Button>

            {/* Botó fitxer (secundari) */}
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1 h-20 flex-col gap-1"
              onClick={handleFileClick}
              disabled={isUploading}
            >
              <Upload className="h-6 w-6" />
              <span className="text-sm">{tr('projectModule.quickExpense.uploadButton')}</span>
            </Button>
          </div>

          {/* Inputs ocults */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleInputChange}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={handleInputChange}
          />

          {/* Llista de fitxers pujats/pujant */}
          {uploads.length > 0 && (
            <div className="space-y-2 mt-3">
              {visibleUploads.map((upload) => (
                <div
                  key={upload.id}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                >
                  {upload.uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : upload.error ? (
                    <X className="h-5 w-5 text-destructive" />
                  ) : (
                    getFileIcon(upload.file.type)
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{upload.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {upload.uploading
                        ? (tr('projectModule.quickExpense.uploading'))
                        : upload.error
                          ? upload.error
                          : formatFileSize(upload.file.size)}
                    </p>
                  </div>

                  {!upload.uploading && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleRemoveUpload(upload.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {hiddenCount > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  {tr('projectModule.quickExpense.hiddenFiles', '+{count} fitxer{plural} més')
                    .replace('{count}', String(hiddenCount))
                    .replace('{plural}', hiddenCount > 1 ? 's' : '')}
                </p>
              )}

              {/* Indicador extracció IA */}
              {aiState === 'extracting' && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{tr('projectModule.quickExpense.aiExtracting')}</span>
                </div>
              )}
              {aiState === 'done' && aiExtraction && aiExtraction.confidence > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  {tr('projectModule.quickExpense.aiSuggested')}
                </Badge>
              )}
              {aiState === 'error' && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-sm font-medium text-destructive">
                    {tr('projectModule.quickExpense.aiErrorTitle')}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tr('projectModule.quickExpense.aiErrorBody')}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={handleRetryAI}
                    disabled={!lastAIAttempt}
                  >
                    {tr('projectModule.quickExpense.aiRetry')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Secció 2: Import (opcional) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="amount" className="text-base font-medium">
              {tr('projectModule.quickExpense.amountLabel')}
            </Label>
            {/* Mostrar moneda detectada si no és EUR */}
            {currency !== 'EUR' && (
              <Badge variant="outline" className="text-xs">
                {currency}
              </Badge>
            )}
          </div>

          {currency === 'EUR' ? (
            // Input EUR directe
              <Input
                id="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
              placeholder={tr('projectModule.quickExpense.amountPlaceholder', 'Ex: 12,50')}
                value={amountEUR}
                onChange={(e) => {
                userEditedAmount.current = true;
                setAmountEUR(e.target.value);
              }}
              className="text-2xl h-14 font-mono text-center"
            />
          ) : (
            // Input moneda estrangera
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  id="amount-original"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder={tr('projectModule.quickExpense.originalAmountPlaceholder', 'Import en {currency}').replace('{currency}', currency)}
                  value={amountOriginal}
                  onChange={(e) => {
                    userEditedAmount.current = true;
                    setAmountOriginal(e.target.value);
                  }}
                  className="text-xl h-12 font-mono text-center flex-1"
                />
                <span className="text-lg font-medium text-muted-foreground">{currency}</span>
              </div>
              <Input
                id="amount-eur"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="Import EUR (opcional)"
                value={amountEUR}
                onChange={(e) => {
                  userEditedAmount.current = true;
                  setAmountEUR(e.target.value);
                }}
                className="h-10 font-mono text-center text-sm"
              />
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            {tr('projectModule.quickExpense.amountHint')}
          </p>
        </div>

        {/* Secció 3: Nota/concepte (opcional) */}
        <div className="space-y-2">
          <Label htmlFor="concept" className="text-base font-medium">
            {tr('projectModule.quickExpense.conceptLabel')}
          </Label>
          <Input
            id="concept"
            type="text"
            placeholder={tr('projectModule.quickExpense.conceptPlaceholder')}
            value={concept}
            onChange={(e) => {
              userEditedConcept.current = true;
              setConcept(e.target.value);
            }}
            className="h-12"
          />
        </div>

        {/* Spacer (només en mode normal) */}
        {!isLandingMode && <div className="flex-1" />}
      </div>

      {/* Footer amb botó guardar */}
      <div
        className={
          isLandingMode
            ? 'shrink-0 bg-background pt-4 px-4 border-t'
            : 'sticky bottom-0 bg-background pt-4 pb-6 -mx-4 px-4 border-t max-w-lg mx-auto w-full'
        }
        style={isLandingMode ? { paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' } : undefined}
      >
        <div className="max-w-lg mx-auto">
          <Button
            type="button"
            size="lg"
            className="w-full h-14 text-lg"
            onClick={handleSubmit}
            disabled={!canSubmit || isPersisting}
          >
            {isPersisting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                {tr('projectModule.quickExpense.saving')}
              </>
            ) : (
              <>
                <Check className="h-5 w-5 mr-2" />
                {tr('projectModule.quickExpense.saveButton')}
              </>
            )}
          </Button>

          {!hasAttachments && (
            <p className="text-center text-sm text-muted-foreground mt-2">
              {tr('projectModule.quickExpense.attachmentRequired')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
