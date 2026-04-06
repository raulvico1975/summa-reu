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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, ArrowRightCircle, Ban, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/i18n';
import { useFirebase, useMemoFirebase, addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { collection, doc, query, where } from 'firebase/firestore';
import { useCollection } from '@/firebase';
import type { Employee } from '@/lib/data';
import {
  readEmployeesExcel,
  generateImportPreview,
  prepareEmployeeData,
  type EmployeeImportResult,
  type EmployeeImportPreview,
} from '@/lib/employees-import';
import { downloadEmployeesTemplate } from '@/lib/employees-export';

// ═══════════════════════════════════════════════════════════════════════════
// TIPUS
// ═══════════════════════════════════════════════════════════════════════════

type ImportStep = 'upload' | 'preview' | 'importing' | 'done';

interface EmployeeImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function EmployeeImporter({ open, onOpenChange, onComplete }: EmployeeImporterProps) {
  const { firestore } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const { toast } = useToast();
  const { t, tr, language } = useTranslations();

  // State
  const [step, setStep] = React.useState<ImportStep>('upload');
  const [importResult, setImportResult] = React.useState<EmployeeImportResult | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [parseWarnings, setParseWarnings] = React.useState<string[]>([]);

  // Ref per input file
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Obtenir treballadors existents
  const contactsCollection = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'contacts') : null,
    [firestore, organizationId]
  );

  const employeesQuery = useMemoFirebase(
    () => contactsCollection ? query(contactsCollection, where('type', '==', 'employee')) : null,
    [contactsCollection]
  );

  const { data: employeesRaw } = useCollection<Employee & { archivedAt?: string }>(employeesQuery);
  const employees = React.useMemo(
    () => employeesRaw?.filter(e => !e.archivedAt) || [],
    [employeesRaw]
  );

  // Reset quan es tanca
  React.useEffect(() => {
    if (!open) {
      setStep('upload');
      setImportResult(null);
      setParseWarnings([]);
      setIsProcessing(false);
    }
  }, [open]);

  // Handler: Seleccionar fitxer
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setParseWarnings([]);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const { rows, warnings } = readEmployeesExcel(arrayBuffer);

      if (rows.length === 0) {
        toast({
          variant: 'destructive',
          title: tr('employeeImporter.emptyFileTitle', t.importers.common.emptyFile),
          description: tr('employeeImporter.emptyFileDescription', "No s'han trobat dades de treballadors al fitxer."),
        });
        setIsProcessing(false);
        return;
      }

      setParseWarnings(warnings);

      // Generar preview comparant amb existents
      const result = generateImportPreview(rows, employees);
      setImportResult(result);
      setStep('preview');
    } catch (error) {
      console.error('Error llegint fitxer:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: tr('employeeImporter.readError', "No s'ha pogut llegir el fitxer Excel."),
      });
    } finally {
      setIsProcessing(false);
      // Reset input per permetre tornar a seleccionar el mateix fitxer
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handler: Aplicar importació
  const handleApplyImport = async () => {
    if (!importResult || !contactsCollection) return;

    setStep('importing');
    setIsProcessing(true);

    const toProcess = importResult.previews.filter(p => p.action === 'create' || p.action === 'update');

    try {
      const now = new Date().toISOString();
      let created = 0;
      let updated = 0;

      // Processar en batches de 50 (límit Firestore)
      for (let i = 0; i < toProcess.length; i++) {
        const preview = toProcess[i];
        const data = prepareEmployeeData(preview.parsed);

        if (preview.action === 'create') {
          await addDocumentNonBlocking(contactsCollection, {
            ...data,
            roles: { employee: true },
            createdAt: now,
            updatedAt: now,
          });
          created++;
        } else if (preview.action === 'update' && preview.existingId) {
          await setDocumentNonBlocking(
            doc(contactsCollection, preview.existingId),
            { ...data, updatedAt: now },
            { merge: true }
          );
          updated++;
        }
      }

      setStep('done');
      toast({
        presentation: 'centered-success',
        title: t.importers.common.importComplete,
        description: tr('employeeImporter.importSummary', '{created} creats, {updated} actualitzats.')
          .replace('{created}', String(created))
          .replace('{updated}', String(updated)),
      });

      onComplete?.();
    } catch (error) {
      console.error('Error important:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: tr('employeeImporter.importError', "S'ha produït un error durant la importació."),
      });
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  // Renderitzar badge segons acció
  const renderActionBadge = (action: EmployeeImportPreview['action']) => {
    switch (action) {
      case 'create':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {tr('employeeImporter.actionCreate', 'Nou')}
          </Badge>
        );
      case 'update':
        return (
          <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <ArrowRightCircle className="h-3 w-3 mr-1" />
            {tr('employeeImporter.actionUpdate', 'Actualitzar')}
          </Badge>
        );
      case 'skip':
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-600">
            <Ban className="h-3 w-3 mr-1" />
            {tr('employeeImporter.actionSkip', 'Ometre')}
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[min(96vw,78rem)] flex-col overflow-hidden sm:w-[min(calc(100vw-3rem),78rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-purple-500" />
            {tr('employeeImporter.title', 'Importar treballadors')}
          </DialogTitle>
          <DialogDescription>
            {tr('employeeImporter.description', "Importa treballadors des d'un fitxer Excel (.xlsx)")}
          </DialogDescription>
        </DialogHeader>

        {/* STEP: Upload */}
        {step === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center py-8 gap-6">
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center">
                <Upload className="h-8 w-8 text-purple-500" />
              </div>
              <h3 className="font-medium">{tr('employeeImporter.uploadTitle', 'Selecciona un fitxer Excel')}</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {tr('employeeImporter.uploadDescription', 'El fitxer ha de contenir una capçalera amb columnes: NIF, Nom, Email, Telèfon, IBAN, Data alta, Codi postal, Notes')}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => downloadEmployeesTemplate(language)}
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
                {isProcessing ? t.importers.common.importing : tr('employeeImporter.selectFile', 'Seleccionar fitxer')}
              </Button>
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
                {tr('employeeImporter.matchingHelp', "Els treballadors es relacionen per NIF. Si el NIF coincideix, s'actualitza; si no, es crea un nou registre. Si no s'informa el NIF, sempre es crea un nou treballador.")}
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
                <span>{tr('employeeImporter.summaryNew', '{count} nous').replace('{count}', String(importResult.summary.toCreate))}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>{tr('employeeImporter.summaryUpdated', '{count} actualitzacions').replace('{count}', String(importResult.summary.toUpdate))}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span>{tr('employeeImporter.summarySkipped', '{count} omesos').replace('{count}', String(importResult.summary.toSkip))}</span>
              </div>
            </div>

            {/* Avisos de parsing */}
            {parseWarnings.length > 0 && (
              <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <details className="text-xs">
                    <summary className="cursor-pointer">{tr('employeeImporter.warningsCount', '{count} avís(os) durant el parsing').replace('{count}', String(parseWarnings.length))}</summary>
                    <ul className="mt-2 space-y-1">
                      {parseWarnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </details>
                </AlertDescription>
              </Alert>
            )}

            {/* Taula de preview */}
            <ScrollArea className="flex-1 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">{tr('employeeImporter.table.action', 'Acció')}</TableHead>
                    <TableHead>NIF</TableHead>
                    <TableHead>{t.importers.common.name}</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-48">{tr('employeeImporter.table.details', 'Detalls')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importResult.previews.map((preview, idx) => (
                    <TableRow
                      key={idx}
                      className={preview.action === 'skip' ? 'opacity-50' : ''}
                    >
                      <TableCell>{renderActionBadge(preview.action)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {preview.parsed.taxId || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>{preview.parsed.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {preview.parsed.email || '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {preview.action === 'update' && preview.changes && (
                          <span>{tr('employeeImporter.changesLabel', 'Canvis:')} {preview.changes.join(', ')}</span>
                        )}
                        {preview.action === 'skip' && preview.reason && (
                          <span>{preview.reason}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {/* STEP: Importing */}
        {step === 'importing' && (
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            <div className="animate-pulse text-center space-y-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center">
                <FileSpreadsheet className="h-8 w-8 text-purple-500" />
              </div>
              <h3 className="font-medium">{tr('employeeImporter.importingTitle', 'Important treballadors...')}</h3>
              <p className="text-sm text-muted-foreground">{tr('employeeImporter.importingDescription', 'Això pot trigar uns segons')}</p>
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
                {tr('employeeImporter.doneDescription', "Tots els treballadors s'han processat correctament")}
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
                {tr('employeeImporter.applyImport', 'Aplicar importació')}
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
