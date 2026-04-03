// src/components/project-module/add-off-bank-expense-modal.tsx
// Modal per afegir o editar despeses de terreny (off-bank)

'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { computeFxAmountEUR } from '@/lib/project-module/fx';
import { normalizeAssignments } from '@/lib/project-module/normalize-assignments';
import { useSaveOffBankExpense, useUpdateOffBankExpense, useSaveExpenseLink } from '@/hooks/use-project-module';
import type { ExpenseAssignment, OffBankAttachment } from '@/lib/project-module-types';
import { useToast } from '@/hooks/use-toast';
import { trackUX } from '@/lib/ux/trackUX';
import { ChevronDown, ChevronUp, Info, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExpenseAttachmentsDropzone } from './expense-attachments-dropzone';
import { buildDocumentFilename } from '@/lib/build-document-filename';
import { useTranslations } from '@/i18n';

interface OffBankExpenseInitialValues {
  date: string;
  amountEUR: string;
  concept: string;
  counterpartyName: string;
  categoryName: string;
  // Nous camps FX
  currency?: string;
  amountOriginal?: string;
  fxRateOverride?: string;
  useFxOverride?: boolean;
  // Camps justificació
  invoiceNumber?: string;
  issuerTaxId?: string;
  invoiceDate?: string;
  paymentDate?: string;
  // Attachments
  attachments?: OffBankAttachment[];
  // Revisió
  needsReview?: boolean;
}

interface OffBankExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  mode?: 'create' | 'edit';
  expenseId?: string;
  initialValues?: OffBankExpenseInitialValues;
  // FX del projecte (opcional)
  projectFxRate?: number | null;
  projectFxCurrency?: string | null;
  // Imputacions existents (per mode edit)
  existingAssignments?: ExpenseAssignment[];
  // Per upload d'attachments
  organizationId: string;
  // Mode ràpid (terreny): marca needsReview automàticament
  quickMode?: boolean;
}

export function OffBankExpenseModal({
  open,
  onOpenChange,
  onSuccess,
  mode = 'create',
  expenseId,
  initialValues,
  projectFxRate,
  projectFxCurrency,
  existingAssignments,
  organizationId,
  quickMode = false,
}: OffBankExpenseModalProps) {
  const { save, isSaving } = useSaveOffBankExpense();
  const { update, isUpdating } = useUpdateOffBankExpense();
  const { save: saveExpenseLink } = useSaveExpenseLink();
  const { toast } = useToast();
  const { tr } = useTranslations();

  const isEditMode = mode === 'edit';
  const isProcessing = isSaving || isUpdating;

  // Camps bàsics
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [amountEUR, setAmountEUR] = useState('');
  const [concept, setConcept] = useState('');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [categoryName, setCategoryName] = useState('');

  // Camps FX (moneda local) — per defecte ON en despeses de terreny
  const [useForeignCurrency, setUseForeignCurrency] = useState(true);
  const [currency, setCurrency] = useState('');
  const [amountOriginal, setAmountOriginal] = useState('');
  const [fxRateOverride, setFxRateOverride] = useState('');

  // EUR manual (cas especial, col·lapsat per defecte)
  const [eurManualEnabled, setEurManualEnabled] = useState(false);

  // Camps justificació integrats a la capçalera del formulari
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issuerTaxId, setIssuerTaxId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [paymentDate, setPaymentDate] = useState('');

  // Attachments (nou)
  const [attachments, setAttachments] = useState<OffBankAttachment[]>([]);

  // Revisió (nou)
  const [needsReview, setNeedsReview] = useState(quickMode);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Generador de noms de fitxer per attachments
  const handleBuildFileName = useCallback((originalName: string) => {
    return buildDocumentFilename({
      dateISO: date,
      concept: concept,
      originalName,
    });
  }, [date, concept]);

  // Nota: El TC s'aplica al imputar la despesa a un projecte, no aquí.

  // Carregar valors inicials quan s'obre en mode edit
  useEffect(() => {
    if (open && isEditMode && initialValues) {
      setDate(initialValues.date);
      setAmountEUR(initialValues.amountEUR);
      setConcept(initialValues.concept);
      setCounterpartyName(initialValues.counterpartyName);
      setCategoryName(initialValues.categoryName);
      // FX
      if (initialValues.currency && initialValues.currency !== 'EUR') {
        setUseForeignCurrency(true);
        setCurrency(initialValues.currency);
        setAmountOriginal(initialValues.amountOriginal ?? '');
        setFxRateOverride(initialValues.fxRateOverride ?? '');
        // Si té amountEUR amb moneda local, vol dir que hi havia EUR manual
        setEurManualEnabled(!!initialValues.amountEUR && parseFloat(initialValues.amountEUR) > 0);
      } else if (initialValues.amountEUR && parseFloat(initialValues.amountEUR) > 0) {
        // Despesa EUR real: mostrar camp EUR directe
        setUseForeignCurrency(false);
        setCurrency('');
        setAmountOriginal('');
        setFxRateOverride('');
        setEurManualEnabled(false);
      } else {
        // Sense moneda ni EUR (ex: quick-expense incompleta): default moneda local ON
        setUseForeignCurrency(true);
        setCurrency(projectFxCurrency ?? '');
        setAmountOriginal('');
        setFxRateOverride('');
        setEurManualEnabled(false);
      }
      // Justificació
      setInvoiceNumber(initialValues.invoiceNumber ?? '');
      setIssuerTaxId(initialValues.issuerTaxId ?? '');
      // invoiceDate per defecte = date de la despesa
      setInvoiceDate(initialValues.invoiceDate ?? initialValues.date);
      setPaymentDate(initialValues.paymentDate ?? '');
      // Attachments
      setAttachments(initialValues.attachments ?? []);
      // Revisió
      setNeedsReview(initialValues.needsReview ?? false);
      setErrors({});
    }
  }, [open, isEditMode, initialValues]);

  // Inicialitzar moneda del projecte quan s'obre el modal
  useEffect(() => {
    if (open && !isEditMode && projectFxCurrency) {
      setCurrency(projectFxCurrency);
    }
  }, [open, isEditMode, projectFxCurrency]);

  useEffect(() => {
    if (!open) return;
    const derivedDate = paymentDate || invoiceDate || '';
    if (derivedDate && derivedDate !== date) {
      setDate(derivedDate);
    }
  }, [open, paymentDate, invoiceDate, date]);

  // Categoria: no s'usa en despeses off-bank (la classificació real és la partida del projecte)

  const resetForm = () => {
    const today = new Date();
    setDate(today.toISOString().split('T')[0]);
    setAmountEUR('');
    setConcept('');
    setCounterpartyName('');
    // FX — per defecte ON
    setUseForeignCurrency(true);
    setCurrency(projectFxCurrency ?? '');
    setAmountOriginal('');
    setFxRateOverride('');
    // EUR manual
    setEurManualEnabled(false);
    // Justificació
    setInvoiceNumber('');
    setIssuerTaxId('');
    setInvoiceDate(today.toISOString().split('T')[0]);
    setPaymentDate('');
    // Attachments
    setAttachments([]);
    // Revisió
    setNeedsReview(quickMode);
    setErrors({});
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const effectiveDate = paymentDate || invoiceDate || date;

    // Data
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(effectiveDate)) {
      newErrors.invoiceDate = tr('projectModule.offBank.invalidDate');
    }

    // Validació FX si s'usa moneda estrangera
    if (useForeignCurrency) {
      if (!currency.trim()) {
        newErrors.currency = tr('projectModule.offBank.selectCurrency');
      }
      const origAmount = parseFloat(amountOriginal.replace(',', '.'));
      if (isNaN(origAmount) || origAmount <= 0) {
        newErrors.amountOriginal = tr('projectModule.amountPositive');
      }
      // EUR manual: només validar si l'usuari l'ha activat i ha escrit quelcom
      if (eurManualEnabled && amountEUR.trim()) {
        const eurVal = parseFloat(amountEUR.replace(',', '.'));
        if (isNaN(eurVal) || eurVal <= 0) {
          newErrors.amountEUR = tr('projectModule.amountPositive');
        }
      }
    } else {
      // Import EUR obligatori si NO és moneda local
      const amount = parseFloat(amountEUR.replace(',', '.'));
      if (isNaN(amount) || amount <= 0) {
        newErrors.amountEUR = tr('projectModule.amountPositive');
      }
    }

    // Concepte
    if (concept.trim().length === 0) {
      newErrors.concept = tr('projectModule.offBank.conceptRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;
    const effectiveDate = paymentDate || invoiceDate || date;

    const shouldNeedReview = needsReview;

    // Determinar amountEUR
    // - Si moneda local + EUR manual amb valor → valor introduït
    // - Si moneda local sense EUR manual → null (es calcularà al imputar)
    // - Si EUR directe → valor introduït
    let finalAmountEUR: string | null = null;
    if (useForeignCurrency) {
      if (eurManualEnabled && amountEUR.trim()) {
        finalAmountEUR = amountEUR.replace(',', '.');
      }
      // Altrament queda null
    } else {
      finalAmountEUR = amountEUR.replace(',', '.');
    }

    // Preparar dades
    const formData = {
      date: effectiveDate,
      amountEUR: finalAmountEUR,
      concept,
      counterpartyName,
      categoryName: categoryName || '',
      // Moneda local (nous camps)
      originalCurrency: useForeignCurrency ? currency.trim().toUpperCase() : null,
      originalAmount: useForeignCurrency ? amountOriginal.replace(',', '.') : null,
      fxRate: null, // El TC s'aplica en imputar, no al crear
      // Justificació
      invoiceNumber: invoiceNumber.trim() || undefined,
      issuerTaxId: issuerTaxId.trim() || undefined,
      invoiceDate: invoiceDate || undefined,
      paymentDate: paymentDate || undefined,
      // Attachments
      attachments: attachments.length > 0 ? attachments : undefined,
      // Revisió: marcar si toca
      needsReview: shouldNeedReview || undefined,
    };

    try {
      if (isEditMode && expenseId) {
        // Mode edició
        await update(expenseId, formData);

        // Recàlcul d'assignacions si l'import ha canviat (R5)
        if (existingAssignments && existingAssignments.length === 1) {
          const assignment = existingAssignments[0];

          if (useForeignCurrency) {
            // FX: recalcular amb funció pura compartida
            const newOriginalAmountStr = amountOriginal.replace(',', '.');
            const newOriginalAmount = parseFloat(newOriginalAmountStr);
            if (!isNaN(newOriginalAmount) && newOriginalAmount > 0) {
              const oldOriginalStr = initialValues?.amountOriginal ?? '0';
              const oldOriginalAmount = parseFloat(oldOriginalStr.replace(',', '.'));
              const amountChanged = isNaN(oldOriginalAmount) || Math.abs(newOriginalAmount - oldOriginalAmount) > 0.001;

              if (amountChanged) {
                // TC forçat a la despesa > TC del projecte > null
                const expenseTcStr = initialValues?.fxRateOverride;
                const expenseTc = expenseTcStr ? parseFloat(expenseTcStr) : NaN;
                const tc = (!isNaN(expenseTc) && expenseTc > 0) ? expenseTc : projectFxRate;

                const newAmountEUR = computeFxAmountEUR(
                  newOriginalAmount,
                  assignment.localPct ?? 100,
                  tc ?? null
                );

                if (newAmountEUR !== null) {
                  await saveExpenseLink(`off_${expenseId}`, [{
                    ...assignment,
                    amountEUR: newAmountEUR,
                  }], null);
                }
                // Si tc null → no tocar amountEUR
              }
            }
            // Si amountOriginal invàlid → no tocar res
          } else {
            // EUR directe: recàlcul simple
            const newAmountEUR = parseFloat(amountEUR.replace(',', '.'));
            if (!isNaN(newAmountEUR) && newAmountEUR > 0) {
              const oldAmountEUR = initialValues ? parseFloat(initialValues.amountEUR.replace(',', '.')) : 0;
              const amountChanged = isNaN(oldAmountEUR) || Math.abs(newAmountEUR - oldAmountEUR) > 0.001;

              if (amountChanged) {
                await saveExpenseLink(`off_${expenseId}`, [{
                  ...assignment,
                  amountEUR: -newAmountEUR,
                }], null);
              }
            }
          }
        } else if (existingAssignments && existingAssignments.length > 1) {
          // ===== B2: multi-assignació =====

          // 1) Detectar canvi d'import
          // FX: comparem import original
          // EUR: comparem import EUR
          if (useForeignCurrency) {
            const newOriginalStr = amountOriginal.replace(',', '.');
            const newOriginalAmount = parseFloat(newOriginalStr);
            const oldOriginalStr = initialValues?.amountOriginal ?? '0';
            const oldOriginalAmount = parseFloat(oldOriginalStr.replace(',', '.'));

            if (isNaN(newOriginalAmount) || newOriginalAmount <= 0) return;
            const amountChanged =
              isNaN(oldOriginalAmount) ||
              Math.abs(newOriginalAmount - oldOriginalAmount) > 0.001;
            if (!amountChanged) return;

            // 2) Resoldre TC (forçat > projecte)
            const expenseTcStr = initialValues?.fxRateOverride;
            const expenseTc = expenseTcStr ? parseFloat(expenseTcStr) : NaN;
            const tc = (!isNaN(expenseTc) && expenseTc > 0) ? expenseTc : projectFxRate;

            // Guardrail: si no hi ha TC resolt, no tocar res
            if (!tc || tc <= 0) return;

            // 3) Recalcular només assignacions amb amountEUR !== null
            const updated = existingAssignments.map(a => {
              if (a.amountEUR === null) return a; // preservar pendents
              const pct = a.localPct ?? 0;
              const eur = computeFxAmountEUR(newOriginalAmount, pct, tc);
              // eur no pot ser NaN; si fos null, ja hauríem retornat abans
              return { ...a, amountEUR: eur };
            });

            // 4) Normalitzar i desar (preserva parcialitats)
            const totalAmountEURAbs = updated.reduce(
              (s, a) => s + Math.abs(a.amountEUR ?? 0),
              0
            );
            const normalized = normalizeAssignments(
              updated,
              { isFx: true, totalAmountEURAbs },
              'preservePartial'
            );

            await saveExpenseLink(`off_${expenseId}`, normalized.assignments, null);
          } else {
            // ===== EUR (no FX) =====
            const newAmountEUR = parseFloat(amountEUR.replace(',', '.'));
            const oldAmountEUR = initialValues
              ? parseFloat(initialValues.amountEUR.replace(',', '.'))
              : 0;

            if (isNaN(newAmountEUR) || newAmountEUR <= 0) return;
            const amountChanged =
              isNaN(oldAmountEUR) || Math.abs(newAmountEUR - oldAmountEUR) > 0.001;
            if (!amountChanged) return;

            // Guardrail: totes les assignacions han de tenir amountEUR vàlid
            if (existingAssignments.some(a => a.amountEUR === null)) return;

            const weights = existingAssignments.map(a => Math.abs(a.amountEUR ?? 0));
            const totalWeight = weights.reduce((s, v) => s + v, 0);
            if (totalWeight <= 0) return;

            // Repartiment proporcional
            let acc = 0;
            const updated = existingAssignments.map((a, idx) => {
              const share = (weights[idx] / totalWeight) * newAmountEUR;
              const rounded = Math.round(share * 100) / 100;
              acc += rounded;
              return { ...a, amountEUR: -Math.abs(rounded) };
            });

            // Ajust de cèntims a l'última assignació
            const delta = Math.round((newAmountEUR - acc) * 100) / 100;
            if (delta !== 0 && updated.length > 0) {
              const last = updated[updated.length - 1];
              last.amountEUR = -Math.abs(
                Math.round((Math.abs(last.amountEUR) + delta) * 100) / 100
              );
            }

            const totalAmountEURAbs = updated.reduce(
              (s, a) => s + Math.abs(a.amountEUR ?? 0),
              0
            );
            const normalized = normalizeAssignments(
              updated,
              { isFx: false, totalAmountEURAbs },
              'preservePartial'
            );

            await saveExpenseLink(`off_${expenseId}`, normalized.assignments, null);
          }
        }

        trackUX('expenses.offBank.edit.save', { expenseId });

        toast({
          title: tr('projectModule.offBank.expenseUpdated'),
          description: tr('projectModule.offBank.expenseUpdatedDesc'),
        });
      } else {
        // Mode creació
        const newId = await save(formData);

        trackUX('expenses.offBank.create', { expenseId: newId });

        toast({
          title: tr('projectModule.offBank.expenseAdded'),
          description: tr('projectModule.offBank.expenseAddedDesc'),
        });
      }

      resetForm();
      onOpenChange(false);
      onSuccess();

    } catch (err) {
      toast({
        variant: 'destructive',
        title: tr('projectModule.offBank.errorTitle'),
        description: err instanceof Error ? err.message : (isEditMode ? tr('projectModule.offBank.errorUpdating') : tr('projectModule.offBank.errorCreating')),
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,940px)] !w-[min(calc(100vw-1.5rem),64rem)] !max-w-[64rem] flex-col overflow-hidden p-0 sm:!w-[min(calc(100vw-3rem),64rem)]">
        <DialogHeader className="border-b px-4 py-5 pr-10 sm:px-6">
          <DialogTitle>
            {isEditMode ? tr('projectModule.offBank.editTitle') : tr('projectModule.offBank.addTitle')}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {tr('projectModule.offBank.justificationHint')}
          </p>
        </DialogHeader>

        <form id="offbank-form" onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="grid gap-5">
            <div className="space-y-4">
          {/* Avís si hi ha múltiples imputacions */}
          {isEditMode && existingAssignments && existingAssignments.length > 1 && (
            <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                {tr('projectModule.offBank.multiAssignmentWarning')}
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-xl border bg-background p-4 shadow-sm">
            <div className="grid gap-4">
              <div className="grid gap-4 lg:grid-cols-[160px_160px_minmax(0,1.5fr)]">
                <div className="space-y-2">
                  <Label htmlFor="invoiceDate">{tr('projectModule.invoiceDate')}</Label>
                  <Input
                    id="invoiceDate"
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className={errors.invoiceDate ? 'border-destructive' : ''}
                  />
                  {errors.invoiceDate && (
                    <p className="text-sm text-destructive">{errors.invoiceDate}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentDate">{tr('projectModule.paymentDate')}</Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="concept">{tr('projectModule.offBank.conceptLabel')}</Label>
                  <Input
                    id="concept"
                    type="text"
                    placeholder={tr('projectModule.offBank.conceptPlaceholder')}
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    className={errors.concept ? 'border-destructive' : ''}
                  />
                  {errors.concept && (
                    <p className="text-sm text-destructive">{errors.concept}</p>
                  )}
                </div>
              </div>

              {useForeignCurrency ? (
                <div className="grid gap-4 lg:grid-cols-[140px_150px_minmax(220px,1fr)_170px_170px]">
                  <div className="space-y-2">
                    <Label htmlFor="amountOriginal">{tr('projectModule.offBank.amountLabel')}</Label>
                    <Input
                      id="amountOriginal"
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={amountOriginal}
                      onChange={(e) => setAmountOriginal(e.target.value)}
                      className={errors.amountOriginal ? 'border-destructive' : ''}
                    />
                    {errors.amountOriginal && (
                      <p className="text-sm text-destructive">{errors.amountOriginal}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency">{tr('projectModule.offBank.currencyLabel')}</Label>
                    <select
                      id="currency"
                      value={currency}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCurrency(val);
                        if (val === 'EUR') {
                          setUseForeignCurrency(false);
                          setAmountOriginal('');
                          setFxRateOverride('');
                        }
                      }}
                      className={`flex h-10 w-full rounded-md border bg-background px-3 py-1 text-sm font-mono ${errors.currency ? 'border-destructive' : 'border-input'}`}
                    >
                      <option value="">{tr('projectModule.offBank.selectPlaceholder')}</option>
                      <option value="XOF">{tr('projectModule.offBank.currencyXOF')}</option>
                      <option value="USD">{tr('projectModule.offBank.currencyUSD')}</option>
                      <option value="GBP">{tr('projectModule.offBank.currencyGBP')}</option>
                    </select>
                    {errors.currency && (
                      <p className="text-sm text-destructive">{errors.currency}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="counterpartyName">{tr('projectModule.offBank.counterpartyLabel')}</Label>
                    <Input
                      id="counterpartyName"
                      type="text"
                      placeholder={tr('projectModule.offBank.counterpartyPlaceholder')}
                      value={counterpartyName}
                      onChange={(e) => setCounterpartyName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="issuerTaxId">{tr('projectModule.issuerTaxId')}</Label>
                    <Input
                      id="issuerTaxId"
                      type="text"
                      placeholder="B12345678"
                      value={issuerTaxId}
                      onChange={(e) => setIssuerTaxId(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invoiceNumber">{tr('projectModule.invoiceNumber')}</Label>
                    <Input
                      id="invoiceNumber"
                      type="text"
                      placeholder="F-2024-001"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-[140px_150px_minmax(220px,1fr)_170px_170px]">
                  <div className="space-y-2">
                    <Label htmlFor="amountEUR">{tr('projectModule.eurAmount')}</Label>
                    <Input
                      id="amountEUR"
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={amountEUR}
                      onChange={(e) => setAmountEUR(e.target.value)}
                      className={errors.amountEUR ? 'border-destructive' : ''}
                    />
                    {errors.amountEUR && (
                      <p className="text-sm text-destructive">{errors.amountEUR}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency-eur">{tr('projectModule.offBank.currencyLabel')}</Label>
                    <Input id="currency-eur" value="EUR" readOnly className="bg-muted/30" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="counterpartyName">{tr('projectModule.offBank.counterpartyLabel')}</Label>
                    <Input
                      id="counterpartyName"
                      type="text"
                      placeholder={tr('projectModule.offBank.counterpartyPlaceholder')}
                      value={counterpartyName}
                      onChange={(e) => setCounterpartyName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="issuerTaxId">{tr('projectModule.issuerTaxId')}</Label>
                    <Input
                      id="issuerTaxId"
                      type="text"
                      placeholder="B12345678"
                      value={issuerTaxId}
                      onChange={(e) => setIssuerTaxId(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invoiceNumber">{tr('projectModule.invoiceNumber')}</Label>
                    <Input
                      id="invoiceNumber"
                      type="text"
                      placeholder="F-2024-001"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {useForeignCurrency ? (
                <Collapsible open={eurManualEnabled} onOpenChange={setEurManualEnabled}>
                  <div className="rounded-lg border bg-muted/20 px-3 py-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="flex items-center justify-between gap-3 rounded-md border bg-background/70 px-3 py-2">
                        <Label htmlFor="useForeignCurrency" className="cursor-pointer text-sm font-normal text-muted-foreground">
                          {tr('projectModule.localCurrencyExpense')}
                        </Label>
                        <Switch
                          id="useForeignCurrency"
                          checked={useForeignCurrency}
                          onCheckedChange={(checked) => {
                            setUseForeignCurrency(checked);
                            if (!checked) {
                              setCurrency('');
                              setAmountOriginal('');
                              setFxRateOverride('');
                              setEurManualEnabled(false);
                            }
                          }}
                        />
                      </div>

                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" type="button" className="h-auto justify-between rounded-md border bg-background/70 px-3 py-2">
                          <span className="text-sm text-muted-foreground">{tr('projectModule.offBank.eurManualToggle')}</span>
                          {eurManualEnabled ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </div>

                    <div className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      <Info className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{tr('projectModule.offBank.fxAutoHint')}</span>
                    </div>

                    <CollapsibleContent className="space-y-2 pt-3">
                      <div className="rounded-lg border bg-background px-3 py-3 md:max-w-sm">
                        <div className="space-y-1">
                          <Label htmlFor="amountEUR" className="text-xs">{tr('projectModule.offBank.eurAmountLabel')}</Label>
                          <Input
                            id="amountEUR"
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={amountEUR}
                            onChange={(e) => setAmountEUR(e.target.value)}
                            className={errors.amountEUR ? 'border-destructive h-9' : 'h-9'}
                          />
                          {errors.amountEUR && (
                            <p className="text-sm text-destructive">{errors.amountEUR}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {tr('projectModule.offBank.eurAutoHint')}
                          </p>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ) : (
                <div className="rounded-lg border bg-muted/20 px-3 py-3">
                  <div className="flex items-center justify-between gap-3 rounded-md border bg-background/70 px-3 py-2 md:max-w-md">
                    <Label htmlFor="useForeignCurrency" className="cursor-pointer text-sm font-normal text-muted-foreground">
                      {tr('projectModule.localCurrencyExpense')}
                    </Label>
                    <Switch
                      id="useForeignCurrency"
                      checked={useForeignCurrency}
                      onCheckedChange={(checked) => {
                        setUseForeignCurrency(checked);
                        if (!checked) {
                          setCurrency('');
                          setAmountOriginal('');
                          setFxRateOverride('');
                          setEurManualEnabled(false);
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

            </div>

            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/10 p-4 shadow-sm">
                <div>
                  <ExpenseAttachmentsDropzone
                    organizationId={organizationId}
                    expenseId={isEditMode ? expenseId ?? null : null}
                    attachments={attachments}
                    onAttachmentsChange={setAttachments}
                    disabled={isProcessing}
                    buildFileName={handleBuildFileName}
                  />
                </div>
              </div>
            </div>
          </div>
        </form>

        <DialogFooter className="border-t bg-background px-4 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isProcessing}
          >
            {tr('projectModule.offBank.cancel')}
          </Button>
          <Button type="submit" form="offbank-form" disabled={isProcessing}>
            {isProcessing
              ? tr('projectModule.offBank.saving')
              : isEditMode
                ? tr('projectModule.offBank.saveChanges')
                : tr('projectModule.offBank.addExpense')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Alias per compatibilitat amb codi existent
export const AddOffBankExpenseModal = OffBankExpenseModal;
