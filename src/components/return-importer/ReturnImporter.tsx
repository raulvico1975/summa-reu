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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import type { Transaction, Donor } from '@/lib/data';
import { formatCurrencyEU } from '@/lib/normalize';
import {
  FileUp,
  Loader2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  X,
  Upload,
  Layers,
  UserRoundX,
  Search,
  UserPlus,
  ChevronDown,
} from 'lucide-react';
import { useReturnImporter, type ParsedReturn, type BulkReturnGroup } from './useReturnImporter';
import { useTranslations } from '@/i18n';

// ═══════════════════════════════════════════════════════════════════════════════
// TIPUS
// ═══════════════════════════════════════════════════════════════════════════════

interface ReturnImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  isSuperAdmin?: boolean;
  /** Mode contextual: assignar devolucions directament a aquest pare */
  parentTransaction?: Transaction | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export function ReturnImporter({
  open,
  onOpenChange,
  onComplete,
  isSuperAdmin = false,
  parentTransaction = null,
}: ReturnImporterProps) {
  const { t } = useTranslations();
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedRows, setSelectedRows] = React.useState<Set<number>>(new Set());
  const [dragActive, setDragActive] = React.useState(false);
  const [forceRecreateChildren, setForceRecreateChildren] = React.useState(false);
  const [confirmForceRecreate, setConfirmForceRecreate] = React.useState(false);
  const [isOptionalMappingOpen, setIsOptionalMappingOpen] = React.useState(false);

  const {
    step,
    setStep,
    isProcessing,
    isContextMode,
    parentTransaction: hookParentTx,
    files,
    allRows,
    startRow,
    setStartRow,
    previewRows,
    numColumns,
    mapping,
    setMapping,
    parsedReturns,
    groupedMatches,
    bulkReturnGroups,
    stats,
    parseFiles,
    performMatching,
    processReturns,
    reset,
    handleCreateDonorForReturn,
  } = useReturnImporter({ parentTransaction });

  // Reset quan es tanca
  React.useEffect(() => {
    if (!open) {
      reset();
      setSelectedRows(new Set());
    }
  }, [open, reset]);

  // Seleccionar tots els matched per defecte quan arribem a preview
  React.useEffect(() => {
    if (step === 'preview') {
      const matchedIndices = new Set(
        parsedReturns
          .map((r, i) => (r.status === 'matched' || r.status === 'donor_found') ? i : -1)
          .filter(i => i >= 0)
      );
      setSelectedRows(matchedIndices);
    }
  }, [step, parsedReturns]);

  // ═══════════════════════════════════════════════════════════════════════════
  // DIALOG CREAR DONANT
  // ═══════════════════════════════════════════════════════════════════════════

  const [createDonorDialog, setCreateDonorDialog] = React.useState<{
    open: boolean;
    returnIndex: number;
    returnItem: ParsedReturn | null;
  }>({ open: false, returnIndex: -1, returnItem: null });

  const handleOpenCreateDonor = (index: number, item: ParsedReturn) => {
    setCreateDonorDialog({ open: true, returnIndex: index, returnItem: item });
  };

  const handleCreateDonorSubmit = async (data: { name: string; taxId: string; zipCode?: string; iban?: string }) => {
    const result = await handleCreateDonorForReturn(createDonorDialog.returnIndex, data);
    if (!result.success) {
      throw new Error(result.error || t.returnImporter.createDonor.errorGeneric);
    }
    toast({
      title: t.returnImporter.createDonor.toastSuccess,
      description: t.returnImporter.createDonor.toastSuccessDesc.replace('{name}', data.name),
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(event.target.files || []);
    if (newFiles.length > 0) {
      parseFiles(newFiles);
    }
    event.target.value = '';
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      f => f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );

    if (droppedFiles.length > 0) {
      parseFiles(droppedFiles);
    } else {
      toast({
        variant: 'destructive',
        title: t.returnImporter?.invalidFormatTitle || t.importers.transaction.errors.unsupportedFormat,
        description:
          t.returnImporter?.invalidFormatDescription ||
          t.importers.transaction.errors.unsupportedFormatDescription,
      });
    }
  };

  const handleToggleRow = (index: number) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleToggleAll = () => {
    const selectableIndices = parsedReturns
      .map((r, i) => (r.status === 'matched' || r.status === 'donor_found') ? i : -1)
      .filter(i => i >= 0);

    if (selectedRows.size === selectableIndices.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(selectableIndices));
    }
  };

  const handleProcess = async () => {
    // Si forceRecreateChildren està activat, requerir confirmació
    if (forceRecreateChildren && !confirmForceRecreate) {
      toast({
        title: t.returnImporter?.confirmRequired || 'Confirmació requerida',
        description: t.returnImporter?.confirmRequiredDesc || 'Has de marcar la casella de confirmació per forçar la recreació.',
        variant: 'destructive',
      });
      return;
    }
    await processReturns({ forceRecreateChildren });
    onComplete();
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const truncateIban = (iban: string) => {
    if (iban.length <= 12) return iban;
    return `${iban.slice(0, 8)}...${iban.slice(-4)}`;
  };

  const selectableCount = parsedReturns.filter(r => r.status === 'matched' || r.status === 'donor_found').length;

  // Estadístiques de remeses parcials
  const partialRemittanceStats = React.useMemo(() => {
    // Comptar devolucions agrupades sense donant (pendents d'identificar)
    const groupedWithoutDonor = parsedReturns.filter(r =>
      r.matchType === 'grouped' && !r.matchedDonor
    );
    const pendingCount = groupedWithoutDonor.length;
    const pendingAmount = groupedWithoutDonor.reduce((sum, r) => sum + r.amount, 0);

    // Comptar devolucions agrupades AMB donant (resolubles)
    const groupedWithDonor = parsedReturns.filter(r =>
      r.matchType === 'grouped' && r.matchedDonor
    );
    const resolvedCount = groupedWithDonor.length;

    // Determinar quants grups seran parcials
    const groupsWithPending = new Set(groupedWithoutDonor.map(r => r.groupId)).size;

    return {
      pendingCount,
      pendingAmount,
      resolvedCount,
      groupsWithPending,
      hasPartial: pendingCount > 0 && resolvedCount > 0, // Té resolubles i pendents
      allPending: pendingCount > 0 && resolvedCount === 0, // Tot és pendent (cap resolt)
    };
  }, [parsedReturns, stats.grouped]);

  // Determinar si hi ha accions possibles (com a mínim una devolució amb donant)
  const hasActionableReturns = selectableCount > 0 && !partialRemittanceStats.allPending;

  // Determinar si hi ha alguna fila amb badge de tipus (per amagar la columna si no)
  const hasAnyTypeBadge = parsedReturns.some(r =>
    r.matchType === 'grouped' || r.matchType === 'individual' || !r.matchedDonor
  );

  const dialogContentClassName =
    step === 'mapping' || step === 'preview'
      ? 'max-h-[85vh] w-full max-w-5xl flex flex-col overflow-hidden p-0'
      : 'w-[calc(100vw-2rem)] max-w-lg';

  const mappingMissingMessage =
    mapping.ibanColumn === null
      ? "Falta assignar l'IBAN."
      : mapping.amountColumn === null
        ? "Falta assignar l'import."
        : null;

  const bulkAutoProcessCount = bulkReturnGroups.filter((group) => group.status === 'auto').length;

  const previewActionMessage = bulkReturnGroups.length > 0
    ? (
      bulkAutoProcessCount === 0
        ? 'No hi ha cap liquidacio llesta per processar.'
        : forceRecreateChildren && !confirmForceRecreate
          ? (t.returnImporter?.confirmRequiredDesc || 'Confirma la recreacio forçada per continuar.')
          : null
    )
    : (
      partialRemittanceStats.allPending
        ? (t.returnImporter?.identifyAtLeastOne || 'Identifica almenys un donant per continuar')
        : selectedRows.size === 0
          ? 'Selecciona almenys una devolucio per continuar.'
          : forceRecreateChildren && !confirmForceRecreate
            ? (t.returnImporter?.confirmRequiredDesc || 'Confirma la recreacio forçada per continuar.')
            : null
    );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERITZACIÓ
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogContentClassName}>

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 1: UPLOAD
            ═══════════════════════════════════════════════════════════════════ */}
        {step === 'upload' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                {t.returnImporter?.title || "Importar devolucions del banc"}
              </DialogTitle>
              <DialogDescription>
                {t.returnImporter?.description || "Puja el fitxer amb el detall de devolucions que et facilita el banc. El sistema farà matching per IBAN amb els teus donants."}
              </DialogDescription>
            </DialogHeader>

            {/* Zona Drag & Drop */}
            <div
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                ${dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={handleFileClick}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv,.xlsx,.xls"
                multiple
                className="hidden"
                disabled={isProcessing}
              />

              <FileUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">
                {t.returnImporter?.dropzone || "Arrossega fitxers aquí o clica per seleccionar"}
              </p>
              <p className="text-xs text-muted-foreground">
                {t.returnImporter?.dropzoneFormats || "CSV, Excel (.xlsx, .xls)"}
              </p>
            </div>

            {/* Fitxers seleccionats */}
            {files.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t.returnImporter?.filesSelected?.(files.length) || `${files.length} fitxer(s) seleccionat(s):`}</p>
                <div className="flex flex-wrap gap-2">
                  {files.map((file, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {file.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.returnImporter?.readingFiles || "Llegint fitxers..."}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                {t.returnImporter?.cancel || t.common.cancel}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 2: MAPPING
            ═══════════════════════════════════════════════════════════════════ */}
        {step === 'mapping' && (
          <>
            <div className="shrink-0 border-b px-6 py-4">
              <DialogHeader className="pr-8">
                <DialogTitle>
                  {t.returnImporter?.columnMapping || "Configuracio de columnes"}
                </DialogTitle>
                <DialogDescription>
                  {(t.returnImporter?.dataRowsDetected || "S'han detectat {count} files de dades en {files} fitxer(s)")
                    .replace('{count}', String(allRows.length - startRow))
                    .replace('{files}', String(files.length))}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6">
                <div className="space-y-2 rounded-lg border p-4">
                  <label className="text-sm font-medium">{t.returnImporter?.startRowLabel || "Fila inicial de dades:"}</label>
                  <Select
                    value={String(startRow)}
                    onValueChange={(value) => setStartRow(parseInt(value, 10))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: Math.min(allRows.length, 20) }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {(t.returnImporter?.rowPreview || "Fila {n}: {preview}...")
                            .replace('{n}', String(i + 1))
                            .replace('{preview}', allRows[i]?.slice(0, 3).join(' | ').substring(0, 60) || '')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 rounded-lg border p-4">
                  <Label className="font-medium">Camps obligatoris</Label>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-green-500"></span>
                        {t.returnImporter?.ibanColumn || 'Columna IBAN'} *
                      </label>
                      <Select
                        value={mapping.ibanColumn !== null ? String(mapping.ibanColumn) : 'none'}
                        onValueChange={(value) => setMapping({ ...mapping, ibanColumn: value === 'none' ? null : parseInt(value, 10) })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={t.returnImporter?.selectPlaceholder || '-- Selecciona --'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t.returnImporter?.selectPlaceholder || '-- Selecciona --'}</SelectItem>
                          {Array.from({ length: numColumns }, (_, i) => (
                            <SelectItem key={i} value={String(i)}>
                              {(t.returnImporter?.columnPreview || 'Col {n}: {preview}')
                                .replace('{n}', String(i + 1))
                                .replace('{preview}', previewRows[0]?.[i]?.substring(0, 25) || '-')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                        {t.returnImporter?.amountColumn || 'Columna Import'} *
                      </label>
                      <Select
                        value={mapping.amountColumn !== null ? String(mapping.amountColumn) : 'none'}
                        onValueChange={(value) => setMapping({ ...mapping, amountColumn: value === 'none' ? null : parseInt(value, 10) })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={t.returnImporter?.selectPlaceholder || '-- Selecciona --'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t.returnImporter?.selectPlaceholder || '-- Selecciona --'}</SelectItem>
                          {Array.from({ length: numColumns }, (_, i) => (
                            <SelectItem key={i} value={String(i)}>
                              {(t.returnImporter?.columnPreview || 'Col {n}: {preview}')
                                .replace('{n}', String(i + 1))
                                .replace('{preview}', previewRows[0]?.[i]?.substring(0, 25) || '-')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Collapsible open={isOptionalMappingOpen} onOpenChange={setIsOptionalMappingOpen} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <Label className="font-medium">Mes camps</Label>
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="gap-2 px-2">
                        Mostrar opcionals
                        <ChevronDown className={`h-4 w-4 transition-transform ${isOptionalMappingOpen ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="pt-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                          {t.returnImporter?.dateColumn || 'Columna Data'} (opcional)
                        </label>
                        <Select
                          value={mapping.dateColumn !== null ? String(mapping.dateColumn) : 'none'}
                          onValueChange={(value) => setMapping({ ...mapping, dateColumn: value === 'none' ? null : parseInt(value, 10) })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder={t.returnImporter?.notAvailable || '-- No disponible --'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t.returnImporter?.notAvailable || '-- No disponible --'}</SelectItem>
                            {Array.from({ length: numColumns }, (_, i) => (
                              <SelectItem key={i} value={String(i)}>
                                {(t.returnImporter?.columnPreview || 'Col {n}: {preview}')
                                  .replace('{n}', String(i + 1))
                                  .replace('{preview}', previewRows[0]?.[i]?.substring(0, 25) || '-')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-gray-400"></span>
                          {t.returnImporter?.dniColumn || 'Columna DNI'} (opcional)
                        </label>
                        <Select
                          value={mapping.dniColumn !== null ? String(mapping.dniColumn) : 'none'}
                          onValueChange={(value) => setMapping({ ...mapping, dniColumn: value === 'none' ? null : parseInt(value, 10) })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder={t.returnImporter?.notAvailable || '-- No disponible --'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t.returnImporter?.notAvailable || '-- No disponible --'}</SelectItem>
                            {Array.from({ length: numColumns }, (_, i) => (
                              <SelectItem key={i} value={String(i)}>
                                {(t.returnImporter?.columnPreview || 'Col {n}: {preview}')
                                  .replace('{n}', String(i + 1))
                                  .replace('{preview}', previewRows[0]?.[i]?.substring(0, 25) || '-')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{(t.returnImporter?.previewLabel || 'Vista previa (primeres {n} files):').replace('{n}', String(previewRows.length))}</label>
                  <div className="max-h-[240px] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 text-xs">#</TableHead>
                          {Array.from({ length: numColumns }, (_, i) => (
                            <TableHead
                              key={i}
                              className={`text-xs min-w-[100px] ${
                                i === mapping.ibanColumn ? 'bg-green-100 dark:bg-green-900/30' :
                                i === mapping.amountColumn ? 'bg-blue-100 dark:bg-blue-900/30' :
                                i === mapping.dateColumn ? 'bg-purple-100 dark:bg-purple-900/30' :
                                i === mapping.dniColumn ? 'bg-gray-100 dark:bg-gray-800/30' :
                                ''
                              }`}
                            >
                              Col {i + 1}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewRows.map((row, rowIdx) => (
                          <TableRow key={rowIdx}>
                            <TableCell className="text-xs text-muted-foreground">
                              {startRow + rowIdx + 1}
                            </TableCell>
                            {Array.from({ length: numColumns }, (_, colIdx) => (
                              <TableCell
                                key={colIdx}
                                className={`text-xs truncate max-w-[150px] ${
                                  colIdx === mapping.ibanColumn ? 'bg-green-50 dark:bg-green-900/20' :
                                  colIdx === mapping.amountColumn ? 'bg-blue-50 dark:bg-blue-900/20' :
                                  colIdx === mapping.dateColumn ? 'bg-purple-50 dark:bg-purple-900/20' :
                                  colIdx === mapping.dniColumn ? 'bg-gray-50 dark:bg-gray-800/20' :
                                  ''
                                }`}
                              >
                                {row[colIdx] || '-'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t px-6 py-4">
              {mappingMissingMessage ? (
                <p className="mb-3 text-sm text-muted-foreground">{mappingMissingMessage}</p>
              ) : null}
              <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
                <Button variant="outline" onClick={() => { reset(); }}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t.returnImporter?.back || 'Tornar'}
                </Button>
                <Button
                  onClick={performMatching}
                  disabled={isProcessing || mapping.ibanColumn === null || mapping.amountColumn === null}
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 h-4 w-4" />
                  )}
                  {t.returnImporter?.continue || 'Continuar'}
                </Button>
              </DialogFooter>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 3: PREVIEW
            ═══════════════════════════════════════════════════════════════════ */}
        {step === 'preview' && (
          <>
            <div className="shrink-0 border-b px-6 py-4">
              <DialogHeader className="pr-8">
                <DialogTitle>
                  {isContextMode
                    ? (t.returnImporter?.contextModeTitle || "Assignar devolucions a l'apunt seleccionat")
                    : (t.returnImporter?.results || "Resultat del matching")}
                </DialogTitle>
                <DialogDescription>
                  {isContextMode && hookParentTx ? (
                    <span className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">
                        {hookParentTx.date} · {formatCurrencyEU(Math.abs(hookParentTx.amount))} · {hookParentTx.description?.slice(0, 50)}
                      </span>
                      <span>{(t.returnImporter?.contextModeDesc || "Les {count} devolucions del fitxer s'assignaran a aquest apunt").replace('{count}', String(parsedReturns.length))}</span>
                    </span>
                  ) : (
                    t.returnImporter?.reviewDesc || "Revisa les coincidencies i selecciona les devolucions a assignar"
                  )}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-4">
              {/* Mode BULK: Resum de grups */}
                  {bulkReturnGroups.length > 0 ? (
                    <>
                      {bulkReturnGroups.filter(g => g.status === 'auto').length > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800">
                            {bulkAutoProcessCount} {t.returnImporter?.autoMatched || 'liquidacions auto-matched'}
                          </span>
                        </div>
                      )}
                      {bulkReturnGroups.filter(g => g.status === 'needsReview').length > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 border border-orange-200">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                          <span className="text-sm font-medium text-orange-800">
                            {bulkReturnGroups.filter(g => g.status === 'needsReview').length} {t.returnImporter?.pendingReview || 'pendents de revisio'}
                          </span>
                        </div>
                      )}
                      {bulkReturnGroups.filter(g => g.status === 'noMatch').length > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
                          <X className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-medium text-red-800">
                            {bulkReturnGroups.filter(g => g.status === 'noMatch').length} {t.returnImporter?.noMatch || 'sense coincidencia'}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {(stats.matched + stats.donorFound) > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800">
                            {stats.matched + stats.donorFound} {t.returnImporter?.withDonorIdentified || 'amb donant identificat'}
                          </span>
                        </div>
                      )}
                      {stats.grouped > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                          <Layers className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">
                            {stats.grouped} {t.returnImporter?.inRemittance || 'en remesa'} ({groupedMatches.length} {groupedMatches.length === 1 ? (t.returnImporter?.group || 'grup') : (t.returnImporter?.groups || 'grups')})
                          </span>
                        </div>
                      )}
                      {stats.notFound > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
                          <X className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-medium text-red-800">
                            {stats.notFound} {t.returnImporter?.withoutDonor || 'sense donant'}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {partialRemittanceStats.pendingCount > 0 && (
                  <div className={`p-3 rounded-lg border ${partialRemittanceStats.allPending ? 'border-red-300 bg-red-50' : 'border-orange-300 bg-orange-50'}`}>
                    <div className="flex items-start gap-2">
                      <UserRoundX className={`h-5 w-5 mt-0.5 flex-shrink-0 ${partialRemittanceStats.allPending ? 'text-red-600' : 'text-orange-600'}`} />
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${partialRemittanceStats.allPending ? 'text-red-800' : 'text-orange-800'}`}>
                          {partialRemittanceStats.allPending
                            ? (t.returnImporter?.noDonorIdentified?.(partialRemittanceStats.pendingCount, formatCurrencyEU(partialRemittanceStats.pendingAmount)) || `Cap donant identificat: ${partialRemittanceStats.pendingCount} devolucions pendents (${formatCurrencyEU(partialRemittanceStats.pendingAmount)})`)
                            : (t.returnImporter?.partialRemittance?.(partialRemittanceStats.pendingCount, formatCurrencyEU(partialRemittanceStats.pendingAmount)) || `Remesa parcial: ${partialRemittanceStats.pendingCount} devolucions sense donant identificat (${formatCurrencyEU(partialRemittanceStats.pendingAmount)} pendents)`)
                          }
                        </p>
                        <p className={`text-xs mt-1 ${partialRemittanceStats.allPending ? 'text-red-700' : 'text-orange-700'}`}>
                          {partialRemittanceStats.allPending
                            ? (t.returnImporter?.noDonorIdentifiedHelp || 'No hi ha cap devolucio amb donant identificat. Identifica almenys un donant per poder processar.')
                            : (t.returnImporter?.partialRemittanceHelp || "Les devolucions amb donant es processaran ara. Les pendents quedaran registrades per identificar-les manualment despres.")
                          }
                        </p>
                        <p className={`text-xs font-medium mt-1 ${partialRemittanceStats.allPending ? 'text-red-800' : 'text-orange-800'}`}>
                          {t.returnImporter?.statusIdentified?.(partialRemittanceStats.resolvedCount, partialRemittanceStats.pendingCount + partialRemittanceStats.resolvedCount) || `Estat: ${partialRemittanceStats.resolvedCount}/${partialRemittanceStats.pendingCount + partialRemittanceStats.resolvedCount} identificades`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {bulkReturnGroups.length > 0 ? (
                  <div className="max-h-[320px] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.returnImporter?.settlementDate || 'Data Liquidacio'}</TableHead>
                          <TableHead>{t.returnImporter?.settlementNumber || 'Num. Liquidacio'}</TableHead>
                          <TableHead className="text-right">{t.returnImporter?.amount || 'Import'}</TableHead>
                          <TableHead className="text-center">{t.returnImporter?.returnsCount || 'Devolucions'}</TableHead>
                          <TableHead>{t.returnImporter?.status || 'Estat'}</TableHead>
                          <TableHead>{t.returnImporter?.parentTransaction || 'Transaccio Pare'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bulkReturnGroups.map((group) => (
                          <TableRow
                            key={group.key}
                            className={
                              group.status === 'auto' ? 'bg-green-50/50' :
                              group.status === 'needsReview' ? 'bg-orange-50/50' :
                              'bg-red-50/30'
                            }
                          >
                            <TableCell className="text-sm font-mono">
                              {group.liquidationDateISO}
                            </TableCell>
                            <TableCell className="text-sm font-mono">
                              {group.liquidationNumber}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrencyEU(group.totalAmount)}
                            </TableCell>
                            <TableCell className="text-center text-sm">
                              {group.rows.length}
                            </TableCell>
                            <TableCell>
                              {group.status === 'auto' ? (
                                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Auto-matched
                                </Badge>
                              ) : group.status === 'needsReview' ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 cursor-help">
                                      <AlertTriangle className="mr-1 h-3 w-3" />
                                      {group.reason === 'multipleCandidates' ? (t.returnImporter?.multipleCandidates || 'Multiples candidats') :
                                       group.reason === 'outsideWindow' ? (t.returnImporter?.outsideWindow || 'Fora finestra') : (t.returnImporter?.needsReview || 'Revisio')}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {group.reason === 'multipleCandidates'
                                      ? (t.returnImporter?.candidatesInWindow || '{n} candidats dins ±2 dies').replace('{n}', String(group.candidatesInWindow.length))
                                      : group.reason === 'outsideWindow'
                                      ? (t.returnImporter?.candidatesOutsideWindow || '{n} candidats fora de la finestra ±2 dies').replace('{n}', String(group.candidatesOutsideWindow.length))
                                      : (t.returnImporter?.manualReviewNeeded || 'Cal revisio manual')}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                                  <X className="mr-1 h-3 w-3" />
                                  {t.returnImporter?.noMatchLabel || 'Sense coincidencia'}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {group.matchedParent ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-green-700 font-medium">
                                    {group.matchedParent.date?.split('T')[0] || '-'}
                                  </span>
                                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                    {group.matchedParent.description || '-'}
                                  </span>
                                </div>
                              ) : group.candidatesInWindow.length > 0 ? (
                                <span className="text-orange-600 text-xs">
                                  {(t.returnImporter?.candidatesAvailable || '{n} candidats disponibles').replace('{n}', String(group.candidatesInWindow.length))}
                                </span>
                              ) : group.candidatesOutsideWindow.length > 0 ? (
                                <span className="text-orange-600 text-xs">
                                  {(t.returnImporter?.outsideWindowLabel || '{n} fora finestra').replace('{n}', String(group.candidatesOutsideWindow.length))}
                                </span>
                              ) : (
                                <span className="text-red-500 text-xs">{t.returnImporter?.noCandidate || 'Cap candidat'}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="max-h-[320px] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedRows.size === selectableCount && selectableCount > 0}
                              onCheckedChange={handleToggleAll}
                              disabled={selectableCount === 0 || partialRemittanceStats.allPending}
                            />
                          </TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Import</TableHead>
                          <TableHead>IBAN</TableHead>
                          <TableHead>Donant</TableHead>
                          {hasAnyTypeBadge && <TableHead>Tipus</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedReturns.map((item, index) => (
                          <TableRow
                            key={index}
                            className={
                              item.matchType === 'grouped' ? 'bg-blue-50/50' :
                              item.status === 'matched' ? 'bg-green-50/50' :
                              item.status === 'donor_found' ? 'bg-yellow-50/50' :
                              'bg-red-50/30'
                            }
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedRows.has(index)}
                                onCheckedChange={() => handleToggleRow(index)}
                                disabled={item.status === 'not_found' || (item.matchType === 'grouped' && !item.matchedDonor)}
                              />
                            </TableCell>
                            <TableCell className="text-sm">
                              {item.date ? item.date.toISOString().split('T')[0] : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrencyEU(item.amount)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {truncateIban(item.iban)}
                            </TableCell>
                            <TableCell>
                              {item.matchedDonor ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-sm text-green-700 font-medium">
                                    {item.matchedDonor.name}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    via {item.matchedBy === 'iban' ? 'IBAN' : item.matchedBy === 'dni' ? 'DNI' : item.matchedBy === 'manual' ? 'Manual' : 'Nom'}
                                  </span>
                                </div>
                              ) : item.matchType === 'grouped' ? (
                                <div className="flex flex-col gap-1">
                                  <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 w-fit">
                                    <UserRoundX className="mr-1 h-3 w-3" />
                                    {t.returnImporter?.pendingIdentify || "Pendent d'identificar"}
                                  </Badge>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs text-orange-700 hover:text-orange-900 hover:bg-orange-100"
                                      onClick={() => toast({ title: t.returnImporter?.featurePending || 'Funcionalitat pendent', description: t.returnImporter?.searchDonorSoon || 'Buscar donant existent - proximament' })}
                                    >
                                      <Search className="mr-1 h-3 w-3" />
                                      {t.returnImporter?.searchButton || 'Buscar'}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs text-orange-700 hover:text-orange-900 hover:bg-orange-100"
                                      onClick={() => handleOpenCreateDonor(index, item)}
                                    >
                                      <UserPlus className="mr-1 h-3 w-3" />
                                      {t.returnImporter?.createButton || 'Crear'}
                                    </Button>
                                  </div>
                                  {item.originalName && (
                                    <span className="text-xs text-muted-foreground">
                                      {item.originalName}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-col gap-0.5">
                                  <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 w-fit">
                                    <AlertTriangle className="mr-1 h-3 w-3" />
                                    {t.returnImporter?.notFoundLabel || 'No trobat'}
                                  </Badge>
                                  {item.dni && (
                                    <span className="text-xs text-muted-foreground">
                                      DNI: {item.dni}
                                    </span>
                                  )}
                                  {!item.dni && item.originalName && (
                                    <span className="text-xs text-muted-foreground">
                                      Nom: {item.originalName}
                                    </span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            {hasAnyTypeBadge && (
                              <TableCell>
                                {item.matchType === 'grouped' ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 cursor-help">
                                        <Layers className="mr-1 h-3 w-3" />
                                        {t.returnImporter?.groupedBadge || 'Agrupada'}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>{t.returnImporter?.groupedTooltip || "Forma part d'una remesa de devolucions"}</TooltipContent>
                                  </Tooltip>
                                ) : item.matchType === 'individual' ? (
                                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                    {t.returnImporter?.individualBadge || 'Individual'}
                                  </Badge>
                                ) : !item.matchedDonor ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 cursor-help">
                                        <UserRoundX className="mr-1 h-3 w-3" />
                                        {t.returnImporter?.pendingBadge || 'Pendent'}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>{t.returnImporter?.pendingTooltip || "Pendent d'identificar donant"}</TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="text-sm text-muted-foreground bg-muted rounded-lg p-3 space-y-1">
                  {bulkReturnGroups.length > 0 ? (
                    <>
                      <p>
                        {(t.returnImporter?.settlementsAutoProcess || '{n} liquidacions es processaran automaticament.')
                          .replace('{n}', `<strong>${bulkAutoProcessCount}</strong>`)
                          .split('<strong>').map((part, i) =>
                            i === 0 ? part : <React.Fragment key={i}><strong>{part.split('</strong>')[0]}</strong>{part.split('</strong>')[1]}</React.Fragment>
                          )}
                      </p>
                      {bulkReturnGroups.filter(g => g.status === 'needsReview').length > 0 && (
                        <p className="text-orange-700">
                          <AlertTriangle className="inline h-3 w-3 mr-1" />
                          {(t.returnImporter?.settlementsNeedReview || '{n} liquidacions requereixen revisio manual (multiples candidats o fora de la finestra ±2 dies).')
                            .replace('{n}', String(bulkReturnGroups.filter(g => g.status === 'needsReview').length))}
                        </p>
                      )}
                      {bulkReturnGroups.filter(g => g.status === 'noMatch').length > 0 && (
                        <p className="text-red-700">
                          <X className="inline h-3 w-3 mr-1" />
                          {(t.returnImporter?.settlementsNoMatch || '{n} liquidacions sense cap transaccio coincident.')
                            .replace('{n}', String(bulkReturnGroups.filter(g => g.status === 'noMatch').length))}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p>
                        {(t.returnImporter?.selectedCount || '{n} devolucions seleccionades per assignar.')
                          .replace('{n}', `<strong>${selectedRows.size}</strong>`)
                          .split('<strong>').map((part, i) =>
                            i === 0 ? part : <React.Fragment key={i}><strong>{part.split('</strong>')[0]}</strong>{part.split('</strong>')[1]}</React.Fragment>
                          )}
                      </p>
                      {stats.grouped > 0 && partialRemittanceStats.resolvedCount > 0 && (
                        <p className="text-blue-700">
                          <Layers className="inline h-3 w-3 mr-1" />
                          {(t.returnImporter?.groupedAssignInfo || "Les {n} devolucions agrupades s'assignaran com a part d'una remesa.")
                            .replace('{n}', String(partialRemittanceStats.resolvedCount))}
                        </p>
                      )}
                      {partialRemittanceStats.pendingCount > 0 && (
                        <p className="text-orange-700">
                          <UserRoundX className="inline h-3 w-3 mr-1" />
                          {(t.returnImporter?.pendingRemaining || "{n} devolucions quedaran pendents d'identificar. La remesa es marcara com a parcial fins que s'identifiquin tots els donants.")
                            .replace('{n}', String(partialRemittanceStats.pendingCount))}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {isSuperAdmin && (
                  <div className="space-y-2 p-3 rounded-lg border border-red-300 bg-red-50">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="forceRecreateChildren"
                        checked={forceRecreateChildren}
                        onCheckedChange={(checked) => {
                          setForceRecreateChildren(checked === true);
                          if (!checked) setConfirmForceRecreate(false);
                        }}
                      />
                      <div className="flex-1">
                        <Label htmlFor="forceRecreateChildren" className="text-red-800 font-medium cursor-pointer">
                          {t.returnImporter?.forceRecreateLabel || 'Forcar recreacio de devolucions (SuperAdmin)'}
                        </Label>
                        <p className="text-xs text-red-700 mt-0.5">
                          {t.returnImporter?.forceRecreateDesc || "Elimina i recrea les filles de l'apunt pare seleccionat. Us nomes per migracions."}
                        </p>
                      </div>
                    </div>
                    {forceRecreateChildren && (
                      <div className="flex items-center gap-2 ml-6 p-2 bg-red-100 rounded border border-red-400">
                        <Checkbox
                          id="confirmForceRecreate"
                          checked={confirmForceRecreate}
                          onCheckedChange={(checked) => setConfirmForceRecreate(checked === true)}
                        />
                        <Label htmlFor="confirmForceRecreate" className="text-red-900 text-sm cursor-pointer">
                          {t.returnImporter?.forceRecreateConfirm || "Entenc el risc: les devolucions filles existents s'eliminaran permanentment"}
                        </Label>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 border-t px-6 py-4">
              {previewActionMessage ? (
                <p className="mb-3 text-sm text-muted-foreground">{previewActionMessage}</p>
              ) : null}
              <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
                <Button variant="outline" onClick={() => setStep('mapping')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t.returnImporter?.back || 'Tornar'}
                </Button>
                {bulkReturnGroups.length > 0 ? (
                  <Button
                    onClick={handleProcess}
                    disabled={isProcessing || bulkAutoProcessCount === 0 || (forceRecreateChildren && !confirmForceRecreate)}
                  >
                    {isProcessing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {(t.returnImporter?.processSettlements || 'Processar {n} liquidacions').replace('{n}', String(bulkAutoProcessCount))}
                  </Button>
                ) : (
                  <Button
                    onClick={handleProcess}
                    disabled={isProcessing || !hasActionableReturns || selectedRows.size === 0 || (forceRecreateChildren && !confirmForceRecreate)}
                  >
                    {isProcessing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {t.returnImporter?.process || 'Assignar'} {selectedRows.size} devolucions
                  </Button>
                )}
              </DialogFooter>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 4: PROCESSING
            ═══════════════════════════════════════════════════════════════════ */}
        {step === 'processing' && (
          <>
            <DialogHeader>
              <DialogTitle>{t.returnImporter?.processingTitle || "Processant devolucions"}</DialogTitle>
              <DialogDescription>
                {t.returnImporter?.processingDesc || "Assignant donants i actualitzant comptadors"}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium">{t.returnImporter?.processingProgress || "Processant devolucions..."}</p>
              <p className="text-sm text-muted-foreground">
                {t.returnImporter?.processingDesc || "Assignant donants i actualitzant comptadors"}
              </p>
            </div>
          </>
        )}

      </DialogContent>

      {/* Dialog per crear donant */}
      <CreateDonorForReturnDialog
        open={createDonorDialog.open}
        onOpenChange={(open) => setCreateDonorDialog(prev => ({ ...prev, open }))}
        returnItem={createDonorDialog.returnItem}
        returnIndex={createDonorDialog.returnIndex}
        onSubmit={handleCreateDonorSubmit}
        t={t}
      />
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIALOG CREAR DONANT
// ═══════════════════════════════════════════════════════════════════════════════

interface CreateDonorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnItem: ParsedReturn | null;
  returnIndex: number;
  onSubmit: (data: { name: string; taxId: string; zipCode?: string; iban?: string }) => Promise<void>;
  t: ReturnType<typeof useTranslations>['t'];
}

function CreateDonorForReturnDialog({
  open,
  onOpenChange,
  returnItem,
  onSubmit,
  t,
}: CreateDonorDialogProps) {
  const [name, setName] = React.useState('');
  const [taxId, setTaxId] = React.useState('');
  const [zipCode, setZipCode] = React.useState('');
  const [iban, setIban] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Pre-emplenar IBAN quan s'obre el dialog
  React.useEffect(() => {
    if (open && returnItem) {
      setIban(returnItem.iban || '');
      setName('');
      setTaxId('');
      setZipCode('');
      setError(null);
    }
  }, [open, returnItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validacions
    if (!name.trim()) {
      setError(t.returnImporter.createDonor.errorNameRequired);
      return;
    }
    if (!taxId.trim()) {
      setError(t.returnImporter.createDonor.errorTaxIdRequired);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ name, taxId, zipCode, iban: iban || undefined });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.returnImporter.createDonor.errorGeneric);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.returnImporter.createDonor.title}</DialogTitle>
          <DialogDescription>
            {t.returnImporter.createDonor.description}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="donor-name">{t.returnImporter.createDonor.labelName} *</Label>
            <Input
              id="donor-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.returnImporter.createDonor.placeholderName}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="donor-taxId">{t.returnImporter.createDonor.labelTaxId} *</Label>
            <Input
              id="donor-taxId"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="12345678A"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="donor-iban">{t.returnImporter.createDonor.labelIban}</Label>
            <Input
              id="donor-iban"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="ES00 0000 0000 0000 0000 0000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="donor-zipCode">{t.returnImporter.createDonor.labelZipCode}</Label>
            <Input
              id="donor-zipCode"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              placeholder="08001"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t.returnImporter.createDonor.creating : t.returnImporter.createDonor.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
