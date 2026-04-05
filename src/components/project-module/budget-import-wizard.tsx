// src/components/project-module/budget-import-wizard.tsx
// Wizard d'importació de pressupost des d'Excel

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/i18n';
import { useFirebase } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import {
  collection,
  getDocs,
  writeBatch,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  readWorkbook,
  getSheetNames,
  getSheetData,
  detectHeaders,
  parseRows,
  consolidateRows,
  autoDetectMapping,
  isAmountColumn,
  type ColumnMapping,
  type ConsolidatedBudgetLine,
} from '@/lib/budget-import';

// ═══════════════════════════════════════════════════════════════════════════════
// TIPUS
// ═══════════════════════════════════════════════════════════════════════════════

type ImportStep = 'upload' | 'sheet' | 'mapping' | 'grouping' | 'preview' | 'importing';

interface BudgetImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onComplete: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function BudgetImportWizard({
  open,
  onOpenChange,
  projectId,
  onComplete,
}: BudgetImportWizardProps) {
  const { t, tr } = useTranslations();
  const { toast } = useToast();
  const { firestore, user } = useFirebase();
  const { organizationId } = useCurrentOrganization();

  // Estat del wizard
  const [step, setStep] = React.useState<ImportStep>('upload');

  // Pas 1: Fitxer
  const [file, setFile] = React.useState<File | null>(null);
  const [workbook, setWorkbook] = React.useState<ReturnType<typeof readWorkbook> | null>(null);

  // Pas 2: Sheet
  const [sheetNames, setSheetNames] = React.useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = React.useState<string>('');
  const [sheetData, setSheetData] = React.useState<unknown[][]>([]);
  const [headerRow, setHeaderRow] = React.useState<number>(0);
  const [headers, setHeaders] = React.useState<string[]>([]);

  // Pas 3: Mapping
  const [mapping, setMapping] = React.useState<ColumnMapping>({
    nameColumn: null,
    amountColumn: null,
    codeColumn: null,
    extractCodeFromName: false,
  });

  // Pas 4: Agrupació
  const [groupSublines, setGroupSublines] = React.useState<boolean>(true);

  // Pas 5: Preview
  const [previewLines, setPreviewLines] = React.useState<ConsolidatedBudgetLine[]>([]);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [totalAmount, setTotalAmount] = React.useState<number>(0);

  // Pas 6: Importing
  const [isImporting, setIsImporting] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState(0);

  // Reset quan es tanca
  React.useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('upload');
        setFile(null);
        setWorkbook(null);
        setSheetNames([]);
        setSelectedSheet('');
        setSheetData([]);
        setHeaderRow(0);
        setHeaders([]);
        setMapping({ nameColumn: null, amountColumn: null, codeColumn: null, extractCodeFromName: false });
        setGroupSublines(true);
        setPreviewLines([]);
        setWarnings([]);
        setTotalAmount(0);
        setIsImporting(false);
        setImportProgress(0);
      }, 200);
    }
  }, [open]);

  // ─────────────────────────────────────────────────────────────────────────────
  // PAS 1: Pujar fitxer
  // ─────────────────────────────────────────────────────────────────────────────

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      toast({
        title: tr('projectModule.import.invalidFormat', 'Format no vàlid'),
        description: tr('projectModule.import.selectExcelFile', 'Selecciona un fitxer Excel (.xlsx o .xls)'),
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);

    try {
      const data = await selectedFile.arrayBuffer();
      const wb = readWorkbook(data);
      setWorkbook(wb);
      const names = getSheetNames(wb);
      setSheetNames(names);

      // Si només hi ha una sheet, seleccionar-la automàticament
      if (names.length === 1) {
        setSelectedSheet(names[0]);
      }
    } catch (err) {
      console.error('Error llegint Excel:', err);
      toast({
        title: tr('projectModule.import.errorReadingFile', 'Error llegint fitxer'),
        description: tr('projectModule.import.errorReadingFileDesc', "No s'ha pogut llegir el fitxer Excel"),
        variant: 'destructive',
      });
      setFile(null);
    }
  };

  const handleNextFromUpload = () => {
    if (!workbook || sheetNames.length === 0) return;

    if (sheetNames.length === 1) {
      // Saltar a mapping si només hi ha una sheet
      loadSheetAndContinue(sheetNames[0], 'mapping');
    } else {
      setStep('sheet');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // PAS 2: Seleccionar sheet
  // ─────────────────────────────────────────────────────────────────────────────

  const loadSheetAndContinue = (sheetName: string, nextStep: ImportStep) => {
    if (!workbook) return;

    const data = getSheetData(workbook, sheetName);
    setSheetData(data);

    const { headers: detectedHeaders, headerRow: hRow } = detectHeaders(data);
    setHeaders(detectedHeaders);
    setHeaderRow(hRow);

    // Auto-detect mapping
    const autoMapping = autoDetectMapping(detectedHeaders);
    setMapping(autoMapping);

    setSelectedSheet(sheetName);
    setStep(nextStep);
  };

  const handleNextFromSheet = () => {
    if (!selectedSheet) return;
    loadSheetAndContinue(selectedSheet, 'mapping');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // PAS 3: Mapping de columnes
  // ─────────────────────────────────────────────────────────────────────────────

  const handleNextFromMapping = () => {
    if (!mapping.nameColumn || !mapping.amountColumn) {
      toast({
        title: tr('projectModule.import.incompleteMapping', 'Mapping incomplet'),
        description: tr('projectModule.import.selectColumns', 'Cal seleccionar les columnes de nom i import'),
        variant: 'destructive',
      });
      return;
    }
    setStep('grouping');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // PAS 4: Regla d'agrupació
  // ─────────────────────────────────────────────────────────────────────────────

  const handleNextFromGrouping = () => {
    // Processar les dades
    // Permetre files pare (sense import) quan grouping està activat i tenim codis
    const allowParentLabels = groupSublines && (!!mapping.codeColumn || mapping.extractCodeFromName);
    const parsedRows = parseRows(sheetData, headerRow, mapping, allowParentLabels);

    // Activar agrupació per context quan:
    // - extractCodeFromName = true (codis incrustats al text)
    // - groupSublines = true (mode agrupació)
    // Això permet consolidar pressupostos ACCD/Fons Català on les subpartides no tenen codi
    const useContextGrouping = mapping.extractCodeFromName && groupSublines;
    const result = consolidateRows(parsedRows, groupSublines, useContextGrouping);

    setPreviewLines(result.lines);
    setWarnings(result.warnings);
    setTotalAmount(result.totalAmount);

    setStep('preview');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // PAS 5: Preview i confirmació
  // ─────────────────────────────────────────────────────────────────────────────

  const toggleLineInclude = (index: number) => {
    setPreviewLines(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], include: !updated[index].include };
      return updated;
    });

    // Recalcular total
    setTotalAmount(
      previewLines
        .map((line, i) => (i === index ? !line.include : line.include) ? line.budgetedAmountEUR : 0)
        .reduce((sum, amt) => sum + amt, 0)
    );
  };

  const handleImport = async () => {
    if (!organizationId || !user) return;

    const linesToImport = previewLines.filter(line => line.include);
    if (linesToImport.length === 0) {
      toast({
        title: tr('projectModule.import.noLinesSelected', 'Cap línia seleccionada'),
        description: tr('projectModule.import.selectAtLeastOneLine', 'Selecciona almenys una partida per importar'),
        variant: 'destructive',
      });
      return;
    }

    setStep('importing');
    setIsImporting(true);
    setImportProgress(0);

    try {
      const linesRef = collection(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'projects',
        projectId,
        'budgetLines'
      );

      // 1. Esborrar línies existents
      const existingSnap = await getDocs(linesRef);
      const deleteCount = existingSnap.size;

      if (deleteCount > 0) {
        // Batch delete (màxim 500 per batch)
        const deleteBatches: ReturnType<typeof writeBatch>[] = [];
        let currentBatch = writeBatch(firestore);
        let batchCount = 0;

        for (const docSnap of existingSnap.docs) {
          currentBatch.delete(docSnap.ref);
          batchCount++;

          if (batchCount >= 450) {
            deleteBatches.push(currentBatch);
            currentBatch = writeBatch(firestore);
            batchCount = 0;
          }
        }

        if (batchCount > 0) {
          deleteBatches.push(currentBatch);
        }

        for (const batch of deleteBatches) {
          await batch.commit();
        }
      }

      setImportProgress(30);

      // 2. Crear noves línies
      const createBatches: ReturnType<typeof writeBatch>[] = [];
      let currentBatch = writeBatch(firestore);
      let batchCount = 0;

      const now = serverTimestamp();

      for (const line of linesToImport) {
        const newRef = doc(linesRef);
        currentBatch.set(newRef, {
          name: line.name,
          code: line.code || null,
          budgetedAmountEUR: line.budgetedAmountEUR,
          order: line.order,
          createdBy: user.uid,
          createdAt: now,
          updatedAt: now,
        });
        batchCount++;

        if (batchCount >= 450) {
          createBatches.push(currentBatch);
          currentBatch = writeBatch(firestore);
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        createBatches.push(currentBatch);
      }

      for (let i = 0; i < createBatches.length; i++) {
        await createBatches[i].commit();
        setImportProgress(30 + Math.round((i + 1) / createBatches.length * 70));
      }

      setImportProgress(100);

      toast({
        title: tr('projectModule.import.importCompleted', 'Importació completada'),
        description: `${linesToImport.length} ${tr('projectModule.import.linesImported', 'partides importades correctament')}`,
      });

      onComplete();
      onOpenChange(false);

    } catch (err) {
      console.error('Error important pressupost:', err);
      toast({
        title: tr('projectModule.import.importError', "Error d'importació"),
        description: tr('projectModule.import.importErrorDesc', "No s'ha pogut completar la importació"),
        variant: 'destructive',
      });
      setStep('preview');
    } finally {
      setIsImporting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('ca-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const renderStepIndicator = () => {
    const steps: { key: ImportStep; label: string }[] = [
      { key: 'upload', label: `1. ${tr('projectModule.import.stepFile', 'Fitxer')}` },
      { key: 'sheet', label: `2. ${tr('projectModule.import.stepSheet', 'Pestanya')}` },
      { key: 'mapping', label: `3. ${tr('projectModule.import.stepColumns', 'Columnes')}` },
      { key: 'grouping', label: `4. ${tr('projectModule.import.stepGrouping', 'Agrupació')}` },
      { key: 'preview', label: `5. ${tr('projectModule.import.stepReview', 'Revisió')}` },
    ];

    // Si només hi ha una sheet, amagar el pas 2
    const visibleSteps = sheetNames.length <= 1
      ? steps.filter(s => s.key !== 'sheet')
      : steps;

    const currentIndex = visibleSteps.findIndex(s => s.key === step);

    return (
      <div className="flex items-center gap-2 mb-6">
        {visibleSteps.map((s, i) => (
          <React.Fragment key={s.key}>
            <div
              className={`flex items-center gap-1 text-sm ${
                i <= currentIndex ? 'text-primary font-medium' : 'text-muted-foreground'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  i < currentIndex
                    ? 'bg-primary text-primary-foreground'
                    : i === currentIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {i < currentIndex ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span className="hidden sm:inline">{s.label.split('. ')[1]}</span>
            </div>
            {i < visibleSteps.length - 1 && (
              <div className={`flex-1 h-0.5 ${i < currentIndex ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderUploadStep = () => (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          file ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
      >
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
          id="budget-file-input"
        />
        <label htmlFor="budget-file-input" className="cursor-pointer">
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileSpreadsheet className="w-12 h-12 text-primary" />
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">{tr('projectModule.import.changeFile', 'Clica per canviar el fitxer')}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-12 h-12 text-muted-foreground" />
              <p className="font-medium">{tr('projectModule.import.dragOrClick', 'Arrossega o clica per seleccionar')}</p>
              <p className="text-sm text-muted-foreground">{tr('projectModule.import.excelFileHint', 'Fitxer Excel (.xlsx)')}</p>
            </div>
          )}
        </label>
      </div>
    </div>
  );

  const renderSheetStep = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{tr('projectModule.import.selectSheet', 'Selecciona la pestanya amb el pressupost')}</Label>
        <Select value={selectedSheet} onValueChange={setSelectedSheet}>
          <SelectTrigger>
            <SelectValue placeholder={tr('projectModule.import.selectSheetPlaceholder', 'Selecciona una pestanya...')} />
          </SelectTrigger>
          <SelectContent>
            {sheetNames.map(name => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedSheet && sheetData.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="text-sm text-muted-foreground p-2 bg-muted">
            {tr('projectModule.import.preview10Rows', 'Previsualització (primeres 10 files)')}
          </div>
          <div className="overflow-x-auto max-h-48">
            <Table>
              <TableBody>
                {sheetData.slice(0, 10).map((row, i) => (
                  <TableRow key={i} className={i === headerRow ? 'bg-primary/10' : ''}>
                    {(row as unknown[]).slice(0, 8).map((cell, j) => (
                      <TableCell key={j} className="py-1 px-2 text-xs whitespace-nowrap">
                        {String(cell ?? '')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );

  const renderMappingStep = () => (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {tr('projectModule.import.selectFunderColumn', 'Selecciona la columna del finançador principal (p.ex. ACCD). No seleccionis "TOTAL PROJECTE".')}
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label>{tr('projectModule.import.nameColumnLabel', 'Columna de Nom/Descripció *')}</Label>
          <Select
            value={mapping.nameColumn ?? ''}
            onValueChange={(v) => setMapping(prev => ({ ...prev, nameColumn: v || null }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={tr('projectModule.import.selectPlaceholder', 'Selecciona...')} />
            </SelectTrigger>
            <SelectContent>
              {headers.map(h => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{tr('projectModule.import.amountColumnLabel', "Columna d'Import (EUR) *")}</Label>
          <Select
            value={mapping.amountColumn ?? ''}
            onValueChange={(v) => setMapping(prev => ({ ...prev, amountColumn: v || null }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={tr('projectModule.import.selectPlaceholder', 'Selecciona...')} />
            </SelectTrigger>
            <SelectContent>
              {headers.map(h => {
                const colIdx = headers.indexOf(h);
                const isAmount = isAmountColumn(sheetData, headerRow, colIdx);
                const isTotalLike = h.toLowerCase().includes('total');
                return (
                  <SelectItem key={h} value={h}>
                    {h}
                    {isAmount && !isTotalLike && ' ✓'}
                    {isTotalLike && ` ${tr('projectModule.import.notRecommended', '(no recomanat)')}`}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{tr('projectModule.import.codeColumnLabel', 'Columna de Codi (opcional)')}</Label>
          <Select
            value={mapping.codeColumn ?? '__none__'}
            onValueChange={(v) => setMapping(prev => ({ ...prev, codeColumn: v === '__none__' ? null : v, extractCodeFromName: v === '__none__' ? prev.extractCodeFromName : false }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={tr('projectModule.import.nonePlaceholder', 'Cap')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{tr('projectModule.import.none', 'Cap')}</SelectItem>
              {headers.map(h => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Toggle per extreure codi del text (només si no hi ha columna de codi) */}
        {!mapping.codeColumn && (
          <div className="flex items-start space-x-3 p-3 border rounded-lg bg-muted/30">
            <Checkbox
              id="extractCode"
              checked={mapping.extractCodeFromName}
              onCheckedChange={(checked) => setMapping(prev => ({ ...prev, extractCodeFromName: !!checked }))}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor="extractCode" className="font-medium cursor-pointer">
                {tr('projectModule.import.extractCodeLabel', 'Extreure codi del text (PARTIDES)')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {tr('projectModule.import.extractCodeHint', 'Detecta codis com "a.1)", "A)" o "a.1.1)" dins del camp de nom i els separa automàticament.')}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>{tr('projectModule.import.headerRowLabel', 'Fila de capçalera')}</Label>
        <Input
          type="number"
          min={1}
          max={sheetData.length}
          value={headerRow + 1}
          onChange={(e) => {
            const newRow = parseInt(e.target.value, 10) - 1;
            if (newRow >= 0 && newRow < sheetData.length) {
              setHeaderRow(newRow);
              const { headers: newHeaders } = detectHeaders(sheetData, newRow);
              setHeaders(newHeaders);
            }
          }}
          className="w-24"
        />
        <p className="text-xs text-muted-foreground">{tr('projectModule.import.headerRowHint', 'Fila que conté els noms de les columnes')}</p>
      </div>
    </div>
  );

  const renderGroupingStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {tr('projectModule.import.groupingQuestion', 'Com vols importar les línies del pressupost?')}
      </p>

      <RadioGroup
        value={groupSublines ? 'group' : 'all'}
        onValueChange={(v) => setGroupSublines(v === 'group')}
        className="space-y-3"
      >
        <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
          <RadioGroupItem value="group" id="group" className="mt-1" />
          <div className="space-y-1">
            <Label htmlFor="group" className="font-medium cursor-pointer">
              {tr('projectModule.import.groupSublines', 'Agrupar subpartides a partida (recomanat)')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {tr('projectModule.import.groupSublinesDesc', 'Les subpartides (a1.1, a1.2...) es sumen a la seva partida (a1). Evita duplicitats amb totals de grup.')}
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
          <RadioGroupItem value="all" id="all" className="mt-1" />
          <div className="space-y-1">
            <Label htmlFor="all" className="font-medium cursor-pointer">
              {tr('projectModule.import.importAll', 'Importar totes les línies tal qual')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {tr('projectModule.import.importAllDesc', 'Cada fila amb import positiu es converteix en una partida. Pot causar duplicitats si hi ha totals.')}
            </p>
          </div>
        </div>
      </RadioGroup>

      <Alert variant="default">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {tr('projectModule.import.totalExcluded', 'Les files detectades com a "Total" s\'exclouen automàticament per evitar dobles comptatges.')}
        </AlertDescription>
      </Alert>
    </div>
  );

  const renderPreviewStep = () => {
    const includedCount = previewLines.filter(l => l.include).length;
    const includedTotal = previewLines
      .filter(l => l.include)
      .reduce((sum, l) => sum + l.budgetedAmountEUR, 0);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {includedCount} {tr('projectModule.import.linesSelected', 'partides seleccionades')}
          </p>
          <p className="font-medium">
            {tr('projectModule.import.totalLabel', 'Total: {amount}').replace('{amount}', formatAmount(includedTotal))}
          </p>
        </div>

        {warnings.length > 0 && (
          <Alert variant="default">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside text-xs space-y-1">
                {warnings.slice(0, 5).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
                {warnings.length > 5 && (
                  <li>{tr('projectModule.import.moreWarnings', '...i {count} més').replace('{count}', String(warnings.length - 5))}</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead className="w-20">{tr('projectModule.import.codeHeader', 'Codi')}</TableHead>
                <TableHead>{tr('projectModule.import.lineHeader', 'Partida')}</TableHead>
                <TableHead className="text-right w-32">{tr('projectModule.import.amountHeader', 'Import')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewLines.map((line, i) => (
                <TableRow key={i} className={!line.include ? 'opacity-50 bg-muted/30' : line.isChapter ? 'bg-amber-50' : ''}>
                  <TableCell className="py-2">
                    <Checkbox
                      checked={line.include}
                      onCheckedChange={() => toggleLineInclude(i)}
                    />
                  </TableCell>
                  <TableCell className="py-2 text-xs font-mono">
                    <span className={line.isChapter ? 'font-bold' : ''}>
                      {line.code || '-'}
                    </span>
                    {line.isChapter && (
                      <span className="ml-1 text-[10px] text-amber-600 font-normal">{tr('projectModule.import.chapter', '(capítol)')}</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-sm">
                    {line.name}
                  </TableCell>
                  <TableCell className="py-2 text-right text-sm font-medium">
                    {formatAmount(line.budgetedAmountEUR)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {tr('projectModule.import.replaceWarning', 'Aquesta acció substituirà completament el pressupost actual del projecte.')}
          </AlertDescription>
        </Alert>
      </div>
    );
  };

  const renderImportingStep = () => (
    <div className="space-y-4 py-8">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="font-medium">{tr('projectModule.import.importing', 'Important pressupost...')}</p>
        <Progress value={importProgress} className="w-full max-w-xs" />
        <p className="text-sm text-muted-foreground">
          {importProgress < 30
            ? tr('projectModule.import.deletingOld', 'Esborrant partides anteriors...')
            : importProgress < 100
              ? tr('projectModule.import.creatingNew', 'Creant noves partides...')
              : tr('projectModule.import.completed', 'Completat!')}
        </p>
      </div>
    </div>
  );

  const canGoNext = (): boolean => {
    switch (step) {
      case 'upload':
        return !!workbook && sheetNames.length > 0;
      case 'sheet':
        return !!selectedSheet;
      case 'mapping':
        return !!mapping.nameColumn && !!mapping.amountColumn;
      case 'grouping':
        return true;
      case 'preview':
        return previewLines.some(l => l.include);
      default:
        return false;
    }
  };

  const handleBack = () => {
    switch (step) {
      case 'sheet':
        setStep('upload');
        break;
      case 'mapping':
        setStep(sheetNames.length > 1 ? 'sheet' : 'upload');
        break;
      case 'grouping':
        setStep('mapping');
        break;
      case 'preview':
        setStep('grouping');
        break;
    }
  };

  const handleNext = () => {
    switch (step) {
      case 'upload':
        handleNextFromUpload();
        break;
      case 'sheet':
        handleNextFromSheet();
        break;
      case 'mapping':
        handleNextFromMapping();
        break;
      case 'grouping':
        handleNextFromGrouping();
        break;
      case 'preview':
        handleImport();
        break;
    }
  };

  return (
    <Dialog open={open} onOpenChange={isImporting ? undefined : onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[min(96vw,78rem)] overflow-y-auto sm:w-[min(calc(100vw-3rem),78rem)]">
        <DialogHeader>
          <DialogTitle>
            <FileSpreadsheet className="inline-block w-5 h-5 mr-2" />
            {tr('projectModule.import.wizardTitle', 'Importar pressupost (Excel)')}
          </DialogTitle>
          <DialogDescription>
            {tr('projectModule.import.wizardDescription', "Carrega el pressupost del finançador principal des d'un fitxer Excel")}
          </DialogDescription>
        </DialogHeader>

        {step !== 'importing' && renderStepIndicator()}

        <div className="min-h-[200px]">
          {step === 'upload' && renderUploadStep()}
          {step === 'sheet' && renderSheetStep()}
          {step === 'mapping' && renderMappingStep()}
          {step === 'grouping' && renderGroupingStep()}
          {step === 'preview' && renderPreviewStep()}
          {step === 'importing' && renderImportingStep()}
        </div>

        {step !== 'importing' && (
          <DialogFooter className="flex gap-2">
            {step !== 'upload' && (
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {tr('projectModule.import.back', 'Enrere')}
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {tr('projectModule.import.cancel', 'Cancel·lar')}
            </Button>
            <Button onClick={handleNext} disabled={!canGoNext()}>
              {step === 'preview' ? (
                <>
                  {tr('projectModule.import.importAndReplace', 'Importar i substituir')}
                  <CheckCircle2 className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  {tr('projectModule.import.next', 'Següent')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
