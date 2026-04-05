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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, ArrowRightCircle, Ban, Download, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { useTranslations } from '@/i18n';
import { collection, doc } from 'firebase/firestore';
import {
  readCategoriesExcel,
  generateCategoryImportPreview,
  prepareCategoryCreateData,
  prepareCategoryUpdateData,
  type CategoryImportResult,
  type CategoryImportPreview,
} from '@/lib/categories-import';
import { downloadCategoriesTemplate } from '@/lib/categories-export';
import type { Category } from '@/lib/data';
import { normalizeCategoryLabel } from '@/lib/categories/normalizeCategoryLabel';

// ═══════════════════════════════════════════════════════════════════════════
// TIPUS
// ═══════════════════════════════════════════════════════════════════════════

type ImportStep = 'upload' | 'preview' | 'importing' | 'done';

interface CategoryImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function CategoryImporter({ open, onOpenChange, onComplete }: CategoryImporterProps) {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const { t, tr, language } = useTranslations();

  // Categories existents
  const categoriesCollection = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'categories') : null,
    [firestore, organizationId]
  );
  const { data: categories } = useCollection<Category>(categoriesCollection);

  // State
  const [step, setStep] = React.useState<ImportStep>('upload');
  const [importResult, setImportResult] = React.useState<CategoryImportResult | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [parseWarnings, setParseWarnings] = React.useState<string[]>([]);
  const [parseErrors, setParseErrors] = React.useState<string[]>([]);
  const [updateExisting, setUpdateExisting] = React.useState(false);

  // Ref per input file
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Reset quan es tanca
  React.useEffect(() => {
    if (!open) {
      setStep('upload');
      setImportResult(null);
      setParseWarnings([]);
      setParseErrors([]);
      setIsProcessing(false);
      setUpdateExisting(false);
    }
  }, [open]);

  // Handler: Seleccionar fitxer
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setParseWarnings([]);
    setParseErrors([]);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const { rows, warnings, errors } = readCategoriesExcel(arrayBuffer);

      // Si hi ha errors de parsing, no continuar
      if (errors.length > 0) {
        setParseErrors(errors);
        setIsProcessing(false);
        return;
      }

      if (rows.length === 0) {
        toast({
          variant: 'destructive',
          title: tr('categoryImporter.emptyFileTitle', t.importers.common.emptyFile),
          description: tr('categoryImporter.emptyFileDescription', "No s'han trobat dades de categories al fitxer."),
        });
        setIsProcessing(false);
        return;
      }

      setParseWarnings(warnings);

      // Generar preview comparant amb existents
      const result = generateCategoryImportPreview(
        rows,
        categories || [],
        updateExisting
      );

      setImportResult(result);
      setStep('preview');
    } catch (error) {
      console.error('Error llegint fitxer:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: tr('categoryImporter.readError', "No s'ha pogut llegir el fitxer Excel."),
      });
    } finally {
      setIsProcessing(false);
      // Reset input per permetre tornar a seleccionar el mateix fitxer
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Regenerar preview quan canvia l'opció d'actualitzar
  const handleUpdateExistingChange = (checked: boolean) => {
    setUpdateExisting(checked);

    // Si ja tenim dades parsejades, regenerar preview
    if (importResult && categories) {
      // Obtenir les files parsejades originals des dels previews
      const parsedRows = importResult.previews.map(p => p.parsed);
      const newResult = generateCategoryImportPreview(parsedRows, categories, checked);
      setImportResult(newResult);
    }
  };

  // Handler: Aplicar importació
  const handleApplyImport = async () => {
    if (!importResult || !categoriesCollection) return;

    setStep('importing');
    setIsProcessing(true);

    const toProcess = importResult.previews.filter(p => p.action === 'create' || p.action === 'update');

    try {
      let created = 0;
      let updated = 0;

      // Processar en batches de 50 (Firestore limit)
      for (let i = 0; i < toProcess.length; i++) {
        const preview = toProcess[i];

        if (preview.action === 'create') {
          const data = prepareCategoryCreateData(preview.parsed);
          addDocumentNonBlocking(categoriesCollection, data);
          created++;
        } else if (preview.action === 'update' && preview.existingId) {
          const data = prepareCategoryUpdateData(preview.parsed, preview.existingOrder);
          setDocumentNonBlocking(doc(categoriesCollection, preview.existingId), data, { merge: true });
          updated++;
        }
      }

      setStep('done');
      toast({
        title: t.importers.common.importComplete,
        description: tr('categoryImporter.importSummary', '{created} creades, {updated} actualitzades.')
          .replace('{created}', String(created))
          .replace('{updated}', String(updated)),
      });

      onComplete?.();
    } catch (error) {
      console.error('Error important:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: tr('categoryImporter.importError', "S'ha produït un error durant la importació."),
      });
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  // Renderitzar badge segons acció
  const renderActionBadge = (action: CategoryImportPreview['action']) => {
    switch (action) {
      case 'create':
        return (
            <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {tr('categoryImporter.actionCreate', 'Nova')}
          </Badge>
        );
      case 'update':
        return (
            <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <ArrowRightCircle className="h-3 w-3 mr-1" />
            {tr('categoryImporter.actionUpdate', 'Actualitzar')}
          </Badge>
        );
      case 'skip':
        return (
            <Badge variant="secondary" className="bg-gray-100 text-gray-600">
            <Ban className="h-3 w-3 mr-1" />
            {tr('categoryImporter.actionSkip', 'Ometre')}
          </Badge>
        );
    }
  };

  // Renderitzar badge de tipus
  const getTypeBadge = (type: 'income' | 'expense') => {
    if (type === 'income') {
      return <Badge className="bg-green-100 text-green-800 border-green-300">{t.settings.income}</Badge>;
    }
    return <Badge className="bg-red-100 text-red-800 border-red-300">{t.settings.expense}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[min(96vw,78rem)] flex-col overflow-hidden sm:w-[min(calc(100vw-3rem),78rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-500" />
            {tr('categoryImporter.title', 'Importar categories')}
          </DialogTitle>
          <DialogDescription>
            {tr('categoryImporter.description', "Importa categories des d'un fitxer Excel (.xlsx)")}
          </DialogDescription>
        </DialogHeader>

        {/* STEP: Upload */}
        {step === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center py-8 gap-6">
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                <Upload className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="font-medium">{tr('categoryImporter.uploadTitle', 'Selecciona un fitxer Excel')}</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {tr('categoryImporter.uploadDescription', 'El fitxer ha de contenir columnes: Nom (obligatori), Tipus (income/expense)')}
              </p>
            </div>

            {/* Opció actualitzar existents */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="updateExisting"
                checked={updateExisting}
                onCheckedChange={(checked) => setUpdateExisting(checked === true)}
              />
              <Label htmlFor="updateExisting" className="text-sm">
                {tr('categoryImporter.updateExisting', 'Actualitzar categories existents')}
              </Label>
            </div>

            {/* Errors de parsing */}
            {parseErrors.length > 0 && (
              <Alert variant="destructive" className="max-w-md">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{tr('categoryImporter.fileErrorsTitle', 'Errors al fitxer')}</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 space-y-1 text-sm">
                    {parseErrors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => downloadCategoriesTemplate(language)}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  {t.importers.common.downloadTemplate}
                </Button>

                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {isProcessing ? t.importers.common.importing : tr('categoryImporter.selectFile', 'Seleccionar fitxer')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {tr('categoryImporter.templateHint', 'Utilitza aquesta plantilla per importar categories.')}
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Microcopy sobre matching */}
            <Alert className="max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {tr('categoryImporter.matchingHelp', "Les categories es relacionen per nom i tipus. Si ja existeix una categoria amb el mateix nom i tipus, es pot actualitzar o ometre segons l'opció seleccionada.")}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* STEP: Preview */}
        {step === 'preview' && importResult && (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {/* Resum */}
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>{tr('categoryImporter.summaryNew', '{count} noves').replace('{count}', String(importResult.summary.toCreate))}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>{tr('categoryImporter.summaryUpdated', '{count} actualitzacions').replace('{count}', String(importResult.summary.toUpdate))}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span>{tr('categoryImporter.summarySkipped', '{count} omeses').replace('{count}', String(importResult.summary.toSkip))}</span>
              </div>
            </div>

            {/* Opció actualitzar existents */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="updateExistingPreview"
                checked={updateExisting}
                onCheckedChange={(checked) => handleUpdateExistingChange(checked === true)}
              />
              <Label htmlFor="updateExistingPreview" className="text-sm">
                {tr('categoryImporter.updateExisting', 'Actualitzar categories existents')}
              </Label>
            </div>

            {/* Avisos de parsing */}
            {(parseWarnings.length > 0 || importResult.warnings.length > 0) && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <details className="text-xs">
                    <summary className="cursor-pointer">
                      {tr('categoryImporter.warningsCount', '{count} avís(os)').replace('{count}', String(parseWarnings.length + importResult.warnings.length))}
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {[...parseWarnings, ...importResult.warnings].map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </details>
                </AlertDescription>
              </Alert>
            )}

            {/* Taula de preview amb scroll vertical robust */}
            <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
              <ScrollArea className="h-[50vh] max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">{tr('categoryImporter.table.action', 'Acció')}</TableHead>
                    <TableHead>{t.importers.common.name}</TableHead>
                    <TableHead className="w-20">{tr('categoryImporter.table.type', 'Tipus')}</TableHead>
                    <TableHead className="w-16">{tr('categoryImporter.table.order', 'Ordre')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importResult.previews.map((preview, idx) => (
                    <TableRow
                      key={idx}
                      className={preview.action === 'skip' ? 'opacity-50' : ''}
                    >
                      <TableCell>{renderActionBadge(preview.action)}</TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">
                            {normalizeCategoryLabel(preview.parsed.name)}
                          </span>
                          {/* Raó d'omissió sota el nom */}
                          {preview.action === 'skip' && preview.reason && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {preview.reason}
                            </div>
                          )}
                          {/* Canvis per updates */}
                          {preview.action === 'update' && preview.changes && (
                            <div className="text-xs text-blue-600 mt-0.5">
                              {preview.changes.join(', ')}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getTypeBadge(preview.parsed.type)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {preview.parsed.order ?? '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* STEP: Importing */}
        {step === 'importing' && (
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            <div className="animate-pulse text-center space-y-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                <FileSpreadsheet className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="font-medium">{tr('categoryImporter.importingTitle', 'Important categories...')}</h3>
              <p className="text-sm text-muted-foreground">{tr('categoryImporter.importingDescription', 'Això pot trigar uns segons')}</p>
            </div>
          </div>
        )}

        {/* STEP: Done */}
        {step === 'done' && (
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="font-medium">{t.importers.common.importComplete}</h3>
              <p className="text-sm text-muted-foreground">
                {tr('categoryImporter.doneDescription', "Les categories s'han processat correctament")}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          {step === 'upload' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t.importers.common.close}
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                {t.importers.common.back}
              </Button>
              <Button
                onClick={handleApplyImport}
                disabled={
                  isProcessing ||
                  (importResult?.summary.toCreate === 0 && importResult?.summary.toUpdate === 0)
                }
              >
                {tr('categoryImporter.applyImport', 'Aplicar importació')}
              </Button>
            </>
          )}

          {step === 'done' && (
            <Button onClick={() => onOpenChange(false)}>
              {t.importers.common.close}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
