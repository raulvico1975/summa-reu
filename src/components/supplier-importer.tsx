'use client';

import * as React from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Download,
  ArrowRight,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Supplier, Category } from '@/lib/data';
import { collection, query, where, getDocs, writeBatch, doc, limit } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { useTranslations } from '@/i18n';
import {
  isOfficialSuppliersTemplate,
  getOfficialSupplierMapping,
  downloadSuppliersTemplate,
  SUPPLIERS_TEMPLATE_HEADERS,
} from '@/lib/suppliers/suppliers-template';

// ═══════════════════════════════════════════════════════════════════════════════
// TIPUS
// ═══════════════════════════════════════════════════════════════════════════════

type ColumnMapping = {
  name: string | null;
  taxId: string | null;
  defaultCategory: string | null;
  address: string | null;
  zipCode: string | null;
  city: string | null;
  province: string | null;
  phone: string | null;
  email: string | null;
  iban: string | null;
};

type ImportRow = {
  rowIndex: number;
  data: Record<string, any>;
  parsed: Partial<Supplier> & { defaultCategoryId?: string };
  status: 'valid' | 'duplicate' | 'invalid';
  error?: string;
  warning?: string;
};

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const emptyMapping: ColumnMapping = {
  name: null,
  taxId: null,
  defaultCategory: null,
  address: null,
  zipCode: null,
  city: null,
  province: null,
  phone: null,
  email: null,
  iban: null,
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function toTitleCase(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (word.length === 0) return '';
      const prepositions = ['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'i', 'sl', 'sa', 'slu', 'sll'];
      if (prepositions.includes(word)) return word.toUpperCase() === 'SL' || word.toUpperCase() === 'SA' || word.toUpperCase() === 'SLU' || word.toUpperCase() === 'SLL' ? word.toUpperCase() : word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function cleanTaxId(value: any): string {
  if (!value) return '';
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function cleanIban(value: any): string {
  if (!value) return '';
  return String(value).toUpperCase().replace(/\s/g, '');
}

/**
 * Normalitza un nom de categoria per matching
 */
function normalizeCategoryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

interface SupplierImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: (count: number) => void;
}

export function SupplierImporter({
  open,
  onOpenChange,
  onImportComplete,
}: SupplierImporterProps) {
  const { firestore } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const { toast } = useToast();
  const { t, tr } = useTranslations();

  // Carregar TOTES les categories per matching (agnòstic de tipus)
  const categoriesQuery = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'categories') : null,
    [firestore, organizationId]
  );
  const { data: allCategories } = useCollection<Category>(categoriesQuery);
  const categoryTranslations = t.categories as Record<string, string>;

  const [step, setStep] = React.useState<ImportStep>('upload');
  const [file, setFile] = React.useState<File | null>(null);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rawData, setRawData] = React.useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = React.useState<ColumnMapping>(emptyMapping);
  const [importRows, setImportRows] = React.useState<ImportRow[]>([]);
  const [importProgress, setImportProgress] = React.useState(0);
  const [importedCount, setImportedCount] = React.useState(0);
  // Map de taxId -> docId per detectar duplicats (només actius)
  const [existingSupplierIds, setExistingSupplierIds] = React.useState<Map<string, string>>(new Map());
  // Error si no és plantilla oficial
  const [templateError, setTemplateError] = React.useState<string | null>(null);

  // Reset quan es tanca
  React.useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('upload');
        setFile(null);
        setHeaders([]);
        setRawData([]);
        setMapping(emptyMapping);
        setImportRows([]);
        setImportProgress(0);
        setImportedCount(0);
        setTemplateError(null);
      }, 300);
    }
  }, [open]);

  // Carregar CIFs existents quan s'obre (només proveïdors NO eliminats)
  React.useEffect(() => {
    if (open && organizationId && firestore) {
      loadExistingTaxIds();
    }
  }, [open, organizationId, firestore]);

  const loadExistingTaxIds = async () => {
    if (!organizationId || !firestore) return;
    try {
      const contactsRef = collection(firestore, 'organizations', organizationId, 'contacts');
      // Limitar a 5000 per rendiment
      const q = query(contactsRef, where('type', '==', 'supplier'), limit(5000));
      const snapshot = await getDocs(q);
      const ids = new Map<string, string>();
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        // Criteri normalitzat: "actiu" = deletedAt == null && archivedAt == null
        // Suportem els dos camps defensivament per compatibilitat
        if (data.deletedAt || data.archivedAt) {
          return; // Ignorar proveïdors eliminats
        }
        if (data.taxId) {
          ids.set(cleanTaxId(data.taxId), docSnap.id);
        }
      });
      setExistingSupplierIds(ids);
    } catch (error) {
      console.error('Error carregant CIFs existents:', error);
      toast({ variant: 'destructive', title: t.common?.error || 'Error' });
    }
  };

  /**
   * Busca categoria per nom (matching normalitzat, agnòstic de tipus).
   * Si hi ha duplicats amb diferent tipus (income/expense), retorna null i avisa.
   */
  const getCategoryIdByName = React.useCallback((categoryName: string): { id: string | null; ambiguous: boolean } => {
    if (!categoryName || !allCategories || allCategories.length === 0) {
      return { id: null, ambiguous: false };
    }

    const normalizedInput = normalizeCategoryName(categoryName);

    // Buscar TOTES les categories que coincideixen (per nom o traducció)
    const matches = allCategories.filter(c => {
      const normalizedName = normalizeCategoryName(c.name);
      const translatedName = categoryTranslations[c.name] || '';
      const normalizedTranslation = normalizeCategoryName(translatedName);

      return normalizedName === normalizedInput || normalizedTranslation === normalizedInput;
    });

    if (matches.length === 0) {
      return { id: null, ambiguous: false };
    }

    // Si hi ha múltiples matches amb diferents tipus, és ambigu
    const types = new Set(matches.map(c => c.type));
    if (types.size > 1) {
      return { id: null, ambiguous: true };
    }

    // Match únic o tots del mateix tipus: agafar el primer
    return { id: matches[0].id, ambiguous: false };
  }, [allCategories, categoryTranslations]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setTemplateError(null);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: '' });

      if (jsonData.length === 0) {
        toast({ variant: 'destructive', title: t.common.error, description: t.importers.common.emptyFile });
        return;
      }

      const detectedHeaders = Object.keys(jsonData[0]);
      setHeaders(detectedHeaders);
      setRawData(jsonData);

      // Comprovar si és la plantilla oficial de Summa
      const official = isOfficialSuppliersTemplate(detectedHeaders);

      if (official) {
        // Plantilla oficial: mapatge automàtic i saltar a preview
        const officialMapping = getOfficialSupplierMapping(detectedHeaders);
        const autoMapping: ColumnMapping = { ...emptyMapping };

        // Convertir índexs a noms de capçalera
        for (const [field, idx] of Object.entries(officialMapping)) {
          if (idx !== undefined && idx >= 0 && idx < detectedHeaders.length) {
            autoMapping[field as keyof ColumnMapping] = detectedHeaders[idx];
          }
        }

        setMapping(autoMapping);
        // Processar directament sense passar per mapping
        processDataWithMapping(autoMapping, jsonData);
      } else {
        // NO és plantilla oficial: mostrar error
        setTemplateError(tr('suppliers.importer.officialTemplateRequired'));
      }
    } catch (error) {
      console.error('Error llegint fitxer:', error);
      toast({ variant: 'destructive', title: t.common.error, description: t.importers.common.cannotReadFile });
    }
  };

  // Processar dades amb un mapping específic (per plantilla oficial)
  const processDataWithMapping = (currentMapping: ColumnMapping, data: Record<string, any>[]) => {
    const rows: ImportRow[] = data.map((row, index) => {
      // Llegir categoria de l'Excel
      const categoryFromExcel = currentMapping.defaultCategory
        ? String(row[currentMapping.defaultCategory] || '').trim()
        : '';

      // Fer matching amb categories existents (agnòstic de tipus)
      const categoryMatch = categoryFromExcel ? getCategoryIdByName(categoryFromExcel) : { id: null, ambiguous: false };
      let categoryWarning: string | undefined;
      if (categoryFromExcel) {
        if (categoryMatch.ambiguous) {
          categoryWarning = `Categoria "${categoryFromExcel}" ambigua (existeix com income i expense)`;
        } else if (!categoryMatch.id) {
          categoryWarning = `Categoria "${categoryFromExcel}" no trobada`;
        }
      }

      const parsed: Partial<Supplier> & { defaultCategoryId?: string } = {
        type: 'supplier',
        name: currentMapping.name ? toTitleCase(String(row[currentMapping.name] || '')) : '',
        taxId: currentMapping.taxId ? cleanTaxId(row[currentMapping.taxId]) : '',
        address: currentMapping.address ? String(row[currentMapping.address] || '').trim() : undefined,
        zipCode: currentMapping.zipCode ? String(row[currentMapping.zipCode] || '').trim() : undefined,
        city: currentMapping.city ? String(row[currentMapping.city] || '').trim() : undefined,
        province: currentMapping.province ? String(row[currentMapping.province] || '').trim() : undefined,
        phone: currentMapping.phone ? String(row[currentMapping.phone] || '').trim() : undefined,
        email: currentMapping.email ? String(row[currentMapping.email] || '').trim() : undefined,
        iban: currentMapping.iban ? cleanIban(row[currentMapping.iban]) : undefined,
      };

      // Assignar defaultCategoryId si s'ha trobat (i no és ambigu)
      if (categoryMatch.id) {
        parsed.defaultCategoryId = categoryMatch.id;
      }

      let status: ImportRow['status'] = 'valid';
      let error: string | undefined;

      if (!parsed.name) {
        status = 'invalid';
        error = t.importers.supplier.errors.missingName;
      } else if (parsed.taxId && existingSupplierIds.has(parsed.taxId)) {
        // Només marcar duplicat si té taxId i aquest existeix (i no està eliminat)
        status = 'duplicate';
        error = t.importers.common.alreadyExists;
      }

      return { rowIndex: index + 2, data: row, parsed, status, error, warning: categoryWarning };
    });

    // Detectar duplicats interns per taxId
    const seenTaxIds = new Set<string>();
    for (const row of rows) {
      if (row.status === 'valid' && row.parsed.taxId) {
        if (seenTaxIds.has(row.parsed.taxId)) {
          row.status = 'duplicate';
          row.error = t.importers.common.duplicateInFile;
        } else {
          seenTaxIds.add(row.parsed.taxId);
        }
      }
    }

    setImportRows(rows);
    setStep('preview');
  };

  const executeImport = async () => {
    if (!organizationId || !firestore) return;

    setStep('importing');
    setImportProgress(0);

    const validRows = importRows.filter(r => r.status === 'valid');
    const contactsRef = collection(firestore, 'organizations', organizationId, 'contacts');
    const now = new Date().toISOString();

    let imported = 0;
    const batchSize = 50;
    const batches = Math.ceil(validRows.length / batchSize);

    try {
      for (let i = 0; i < batches; i++) {
        const batch = writeBatch(firestore);
        const start = i * batchSize;
        const end = Math.min(start + batchSize, validRows.length);

        for (let j = start; j < end; j++) {
          const row = validRows[j];
          const newDocRef = doc(contactsRef);

          // Netejar undefined abans de guardar
          const cleanData: Record<string, any> = {
            id: newDocRef.id,
            type: 'supplier',
            name: row.parsed.name || '',
            createdAt: now,
            updatedAt: now,
          };

          // Camps opcionals
          if (row.parsed.taxId) cleanData.taxId = row.parsed.taxId;
          if (row.parsed.address) cleanData.address = row.parsed.address;
          if (row.parsed.zipCode) cleanData.zipCode = row.parsed.zipCode;
          if (row.parsed.city) cleanData.city = row.parsed.city;
          if (row.parsed.province) cleanData.province = row.parsed.province;
          if (row.parsed.phone) cleanData.phone = row.parsed.phone;
          if (row.parsed.email) cleanData.email = row.parsed.email;
          if (row.parsed.iban) cleanData.iban = row.parsed.iban;
          // Categoria per defecte (FIX: ara s'importa correctament)
          if (row.parsed.defaultCategoryId) cleanData.defaultCategoryId = row.parsed.defaultCategoryId;

          batch.set(newDocRef, cleanData);
          imported++;
        }

        await batch.commit();
        setImportProgress(Math.round((imported / validRows.length) * 100));
      }

      setImportedCount(imported);
      setStep('complete');
      onImportComplete?.(imported);

      toast({
        title: t.importers.supplier.importSuccess,
        description: t.importers.supplier.importSuccessDescription(imported),
      });
    } catch (error) {
      console.error('Error important:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.importers.common.importError,
      });
      setStep('preview');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  const validCount = importRows.filter(r => r.status === 'valid').length;
  const duplicateCount = importRows.filter(r => r.status === 'duplicate').length;
  const invalidCount = importRows.filter(r => r.status === 'invalid').length;
  const warningCount = importRows.filter(r => r.warning).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[min(96vw,78rem)] overflow-y-auto sm:w-[min(calc(100vw-3rem),78rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {t.importers.supplier.title}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && t.importers.supplier.uploadDescription}
            {step === 'preview' && t.importers.supplier.previewDescription}
            {step === 'importing' && t.importers.supplier.importingDescription}
            {step === 'complete' && t.importers.supplier.completeDescription}
          </DialogDescription>
        </DialogHeader>

        {/* STEP: UPLOAD */}
        {step === 'upload' && (
          <div className="py-6 space-y-6">
            {/* Error de plantilla no oficial */}
            {templateError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="font-medium">{templateError}</p>
                    <p className="text-red-600">
                      {tr('suppliers.importer.templateErrorHint')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div
              className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => document.getElementById('supplier-file-input')?.click()}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-1">{t.importers.common.dragOrClick}</p>
              <p className="text-sm text-muted-foreground">{t.importers.common.acceptedFormats}</p>
              <input
                id="supplier-file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadSuppliersTemplate}>
                <Download className="h-4 w-4 mr-2" />
                {t.importers.common.downloadTemplate}
              </Button>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-3">
              <p className="font-medium">{tr('suppliers.importer.officialTemplateRequired')}</p>
              <div className="space-y-1 text-muted-foreground">
                <p><strong>{t.importers.common.requiredColumns}</strong> {t.importers.supplier.requiredColumnsText}</p>
                <p><strong>{t.importers.common.optionalColumns}</strong> {t.importers.supplier.optionalColumnsText}</p>
              </div>
              <div className="pt-2 border-t border-muted space-y-1 text-muted-foreground">
                <p>{tr('suppliers.importer.defaultCategoryHint')}</p>
              </div>
            </div>
          </div>
        )}

        {/* STEP: PREVIEW */}
        {step === 'preview' && (
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-2 text-green-700 mb-1">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">{t.importers.common.valid}</span>
                </div>
                <p className="text-2xl font-bold text-green-700">{validCount}</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-2 text-yellow-700 mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">{t.importers.common.duplicates}</span>
                </div>
                <p className="text-2xl font-bold text-yellow-700">{duplicateCount}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-2 text-red-700 mb-1">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">{t.importers.common.invalid}</span>
                </div>
                <p className="text-2xl font-bold text-red-700">{invalidCount}</p>
              </div>
            </div>

            {warningCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                {warningCount} fila(es) amb categoria no reconeguda. S'importaran sense categoria per defecte.
              </div>
            )}

            <div className="border rounded-lg max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">{t.importers.common.row}</TableHead>
                    <TableHead>{t.importers.common.name}</TableHead>
                    <TableHead>{t.importers.supplier.tableHeaders.cif}</TableHead>
                    <TableHead className="w-24">{t.importers.common.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importRows.slice(0, 50).map((row) => (
                    <TableRow
                      key={row.rowIndex}
                      className={cn(
                        row.status === 'duplicate' && 'bg-yellow-50',
                        row.status === 'invalid' && 'bg-red-50'
                      )}
                    >
                      <TableCell className="text-muted-foreground">{row.rowIndex}</TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{row.parsed.name || '-'}</span>
                          {row.warning && (
                            <div className="text-xs text-amber-600 mt-0.5">{row.warning}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{row.parsed.taxId || '-'}</TableCell>
                      <TableCell>
                        {row.status === 'valid' && (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        )}
                        {row.status === 'duplicate' && (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {t.importers.common.duplicate}
                          </Badge>
                        )}
                        {row.status === 'invalid' && (
                          <Badge className="bg-red-100 text-red-800">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {row.error}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {importRows.length > 50 && (
                <div className="p-2 text-center text-sm text-muted-foreground bg-muted/50">
                  {t.importers.common.showing(50, importRows.length)}
                </div>
              )}
            </div>

            {duplicateCount > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                {t.importers.common.duplicatesWillNotImport(duplicateCount)}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('upload')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t.importers.common.back}
              </Button>
              <Button
                onClick={executeImport}
                disabled={validCount === 0}
              >
                {t.importers.supplier.importButton(validCount)}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP: IMPORTING */}
        {step === 'importing' && (
          <div className="py-8 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg font-medium">{t.importers.common.importing}</p>
            </div>
            <Progress value={importProgress} className="h-2" />
            <p className="text-center text-muted-foreground">
              {t.importers.common.percentComplete(importProgress)}
            </p>
          </div>
        )}

        {/* STEP: COMPLETE */}
        {step === 'complete' && (
          <div className="py-8 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">{t.importers.common.importComplete}</p>
                <p className="text-muted-foreground mt-1">
                  {t.importers.supplier.importedCount(importedCount)}
                </p>
              </div>
            </div>
            <DialogFooter className="justify-center">
              <Button onClick={() => onOpenChange(false)}>
                {t.importers.common.close}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
