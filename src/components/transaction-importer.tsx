'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { FileUp, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Transaction, AnyContact, Category } from '@/lib/data';
import { detectReturnType } from '@/lib/data';
import { isCategoryIdCompatibleStrict } from '@/lib/constants';
import Papa from 'papaparse';
import { inferContact } from '@/ai/flows/infer-contact';
import { findMatchingContact } from '@/lib/auto-match';
import { normalizeTransaction } from '@/lib/normalize';
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
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { useCurrentOrganization, useOrgUrl } from '@/hooks/organization-provider';
import { useTranslations } from '@/i18n';
import { useBankAccounts } from '@/hooks/use-bank-accounts';
import Link from 'next/link';
import { suggestPendingDocumentMatches } from '@/lib/pending-documents';
import { classifyTransactions, type ClassifiedRow } from '@/lib/transaction-dedupe';
import { buildImportSelection, computeDedupeSearchRange } from '@/lib/bank-import/dedupe-invariants';
import { DedupeCandidateResolver } from '@/components/dedupe-candidate-resolver';
import { RemittanceStyleMappingStep } from '@/components/importers/remittance-style-mapping-step';
import {
  BankStatementParseError,
  parseBankStatementRows,
  shouldOpenManualMapping,
  type ColumnMappingOverride,
  type ParseBankStatementResult,
  type ParseRiskSignals,
  type ParseSummary,
  type ParsedBankStatementRow,
} from '@/lib/importers/bank/bankStatementParser';
import {
  buildBankMappingColumnOptions,
  buildBankMappingPreviewRows,
  getBankMappingColumnCount,
  type BankMappingFieldId,
} from '@/lib/importers/bank/mapping-ui';
import { normalizeImportTransactionTypeForPersist } from '@/lib/importers/bank/normalize-import-transaction-type';

interface ImportTransactionsApiResponse {
  success: boolean;
  idempotent?: boolean;
  createdCount?: number;
  importRunId?: string;
  inputHash?: string;
  createdTransactions?: Transaction[];
  error?: string;
  code?: string;
}

interface TransactionImporterProps {
  availableCategories?: Category[] | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS PER DEDUPE GLOBAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch global de transaccions existents per (orgId, bankAccountId, rang de dates)
 * Paginat per si hi ha >500 moviments al rang
 */
async function fetchExistingTransactionsForDedupe(
  firestore: ReturnType<typeof import('@/firebase').useFirebase>['firestore'],
  orgId: string,
  bankAccountId: string,
  minDate: string,
  maxDate: string
): Promise<Transaction[]> {
  const txRef = collection(firestore, 'organizations', orgId, 'transactions');
  const results: Transaction[] = [];
  let lastDoc: any = null;

  // Loop paginat amb limit(500)
  while (true) {
    const baseConstraints = [
      where('bankAccountId', '==', bankAccountId),
      where('date', '>=', minDate),
      where('date', '<=', maxDate + '\uf8ff'), // Inclou YYYY-MM-DD i YYYY-MM-DDT...
      orderBy('date', 'asc'),
      limit(500)
    ];

    const q = lastDoc
      ? query(txRef, ...baseConstraints, startAfter(lastDoc))
      : query(txRef, ...baseConstraints);

    const snapshot = await getDocs(q);
    if (snapshot.empty) break;

    snapshot.docs.forEach(doc => {
      results.push({ id: doc.id, ...doc.data() } as Transaction);
    });

    if (snapshot.docs.length < 500) break;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════

const toIsoDateTime = (dateOnly: string): string => `${dateOnly}T00:00:00.000Z`;

const mapParseErrorToMessage = (
  error: unknown,
  t: ReturnType<typeof useTranslations>['t'],
  tr: ReturnType<typeof useTranslations>['tr']
): string => {
  if (error instanceof BankStatementParseError) {
    if (error.code === 'HEADER_NOT_FOUND') {
      return t.importers.transaction.errors.headerNotFound;
    }
    if (error.code === 'MISSING_REQUIRED_COLUMNS') {
      const missing = Array.isArray(error.details.missingColumns)
        ? error.details.missingColumns.map((v) => String(v)).join(', ')
        : 'Data, Concepte, Import';
      return t.importers.transaction.errors.requiredColumnsNotFound(missing);
    }
    if (error.code === 'OPERATION_DATE_REQUIRED') {
      const row = typeof error.details.rowIndex === 'number' ? ` (fila ${error.details.rowIndex})` : '';
      return `${tr('import.errors.operationDateRequired')}${row}`;
    }
    if (error.code === 'NO_VALID_TRANSACTIONS') {
      return t.importers.transaction.noValidTransactions;
    }
    if (error.code === 'INVALID_ROW') {
      const row = typeof error.details.rowIndex === 'number' ? ` (fila ${error.details.rowIndex})` : '';
      return `${t.importers.transaction.errors.cannotProcessContent}${row}`;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t.importers.transaction.errors.cannotProcessContent;
};

export function TransactionImporter({ availableCategories }: TransactionImporterProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [selectedBankAccountId, setSelectedBankAccountId] = React.useState<string | null>(null);
  // UX: Avís inline i fricció per solapament
  const [lastImportedDate, setLastImportedDate] = React.useState<string | null>(null);
  const [overlapAcknowledged, setOverlapAcknowledged] = React.useState(false);
  // Dedupe 3 estats: candidats pendents de resolució
  const [classifiedResults, setClassifiedResults] = React.useState<ClassifiedRow[] | null>(null);
  const [isCandidateDialogOpen, setIsCandidateDialogOpen] = React.useState(false);
  const [pendingImportContext, setPendingImportContext] = React.useState<{
    bankAccountId: string;
    fileName: string | null;
    totalRawRows: number;
  } | null>(null);
  const [previewSummary, setPreviewSummary] = React.useState<ParseSummary | null>(null);
  const [previewRows, setPreviewRows] = React.useState<ParsedBankStatementRow[]>([]);
  const [previewHasMappedBalance, setPreviewHasMappedBalance] = React.useState(false);
  const [mappingState, setMappingState] = React.useState<{
    rows: unknown[][];
    bankAccountId: string | null;
    fileName: string | null;
    headerRowIndex: number;
    columns: ReturnType<typeof buildBankMappingColumnOptions>;
    previewRows: string[][];
    previewColumnCount: number;
    selectedMapping: {
      operationDate: number;
      valueDate: number;
      description: number;
      amount: number;
      balanceAfter: number;
    };
    riskSignals: ParseRiskSignals;
  } | null>(null);
  const { toast } = useToast();
  const { firestore, auth } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const { buildUrl } = useOrgUrl();
  const { t, tr } = useTranslations();

  // Bank accounts
  const { bankAccounts, defaultAccountId, isLoading: isLoadingBankAccounts } = useBankAccounts();

  // Pre-seleccionar el compte per defecte quan es carreguen
  React.useEffect(() => {
    if (defaultAccountId && !selectedBankAccountId) {
      setSelectedBankAccountId(defaultAccountId);
    } else if (bankAccounts.length > 0 && !selectedBankAccountId) {
      setSelectedBankAccountId(bankAccounts[0].id);
    }
  }, [defaultAccountId, bankAccounts, selectedBankAccountId]);

  // Obtenir última data importada del compte seleccionat
  React.useEffect(() => {
    if (!organizationId || !selectedBankAccountId) {
      setLastImportedDate(null);
      return;
    }

    const fetchLastImportedDate = async () => {
      try {
        const txRef = collection(firestore, 'organizations', organizationId, 'transactions');
        const q = query(
          txRef,
          where('bankAccountId', '==', selectedBankAccountId),
          orderBy('date', 'desc'),
          limit(1)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const lastTx = snapshot.docs[0].data();
          // Normalitzar a YYYY-MM-DD
          const dateStr = lastTx.date?.split('T')[0] || null;
          setLastImportedDate(dateStr);
        } else {
          setLastImportedDate(null);
        }
      } catch (error) {
        console.error('Error obtenint última data importada:', error);
        setLastImportedDate(null);
      }
    };

    fetchLastImportedDate();
  }, [organizationId, selectedBankAccountId, firestore]);

  // Reset checkbox quan canvia el compte o el fitxer
  React.useEffect(() => {
    setOverlapAcknowledged(false);
  }, [selectedBankAccountId, pendingFile]);

  const contactsQuery = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'contacts') : null,
    [firestore, organizationId]
  );
  const { data: availableContacts } = useCollection<AnyContact>(contactsQuery);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        setPendingFile(file);
        // Si només hi ha 1 compte, pre-seleccionar-lo
        if (bankAccounts.length === 1) {
          setSelectedBankAccountId(bankAccounts[0].id);
        }
        // Sempre mostrar el diàleg per garantir que l'usuari veu l'avís de fricció
        setIsAccountDialogOpen(true);
    }
    // Reset file input to allow re-uploading the same file
    event.target.value = '';
  };

  const handleAccountSelected = () => {
    setIsAccountDialogOpen(false);
    if (!pendingFile) return;
    startImportProcess(pendingFile, selectedBankAccountId);
    setPendingFile(null);
  };

  const handleImportClick = () => {
    if (bankAccounts.length === 0) {
      setIsAccountDialogOpen(true);
      return;
    }
    fileInputRef.current?.click();
  };

  const startImportProcess = (file: File, bankAccountId: string | null) => {
    setMappingState(null);
    setPreviewSummary(null);
    setPreviewRows([]);
    setPreviewHasMappedBalance(false);
    setIsImporting(true);
    if (file.name.endsWith('.csv')) {
      parseCsv(file, bankAccountId);
    } else if (file.name.endsWith('.xlsx')) {
      parseXlsx(file, bankAccountId);
    } else {
      toast({
        variant: 'destructive',
        title: t.importers.transaction.errors.unsupportedFormat,
        description: t.importers.transaction.errors.unsupportedFormatDescription,
      });
      setIsImporting(false);
    }
  };

  const checkOverlapAndConfirm = async (
    parseResult: ParseBankStatementResult,
    bankAccountId: string | null,
    fileName: string | null
  ) => {
    return classifyParsedData(parseResult, bankAccountId, fileName);
  };

  const processRowsMatrix = async (
    rows: unknown[][],
    bankAccountId: string | null,
    fileName: string | null,
    options: {
      headerRowIndexOverride?: number;
      columnMappingOverride?: ColumnMappingOverride;
      skipMappingDialog?: boolean;
    } = {}
  ): Promise<'processed' | 'deferred'> => {
    const normalizedRows = rows.map((row) => (Array.isArray(row) ? row : []));
    const parsed = parseBankStatementRows(normalizedRows, {
      headerRowIndex: options.headerRowIndexOverride,
      columnMappingOverride: options.columnMappingOverride,
    });

    if (!options.skipMappingDialog && shouldOpenManualMapping(parsed)) {
      const columns = buildBankMappingColumnOptions(normalizedRows, parsed.headerRowIndex, parsed.header);
      const mappingPreviewRows = buildBankMappingPreviewRows(normalizedRows, parsed.headerRowIndex);
      const previewColumnCount = getBankMappingColumnCount(parsed.header, mappingPreviewRows);

      setMappingState({
        rows: normalizedRows,
        bankAccountId,
        fileName,
        headerRowIndex: parsed.headerRowIndex,
        columns,
        previewRows: mappingPreviewRows,
        previewColumnCount,
        selectedMapping: {
          operationDate: parsed.columnMapping.operationDate,
          valueDate: parsed.columnMapping.valueDate,
          description: parsed.columnMapping.description,
          amount: parsed.columnMapping.amount,
          balanceAfter: parsed.columnMapping.balanceAfter,
        },
        riskSignals: parsed.riskSignals,
      });
      setIsImporting(false);
      return 'deferred';
    }

    await checkOverlapAndConfirm(parsed, bankAccountId, fileName);
    return 'processed';
  };

  const parseXlsx = (file: File, bankAccountId: string | null) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!json || json.length === 0) {
          throw new Error(t.importers.transaction.errors.emptyXlsx);
        }

        const rows = (json as unknown[][]).map((row) => (Array.isArray(row) ? row : []));
        await processRowsMatrix(rows, bankAccountId, file.name);
      } catch (error: any) {
        console.error('Error processing XLSX data:', error);
        toast({
          variant: 'destructive',
          title: t.importers.transaction.errors.importError,
          description: mapParseErrorToMessage(error, t, tr) || t.importers.transaction.errors.cannotProcessXlsx,
          duration: 9000,
        });
        setIsImporting(false);
      }
    };
    reader.onerror = () => {
      toast({
        variant: 'destructive',
        title: t.importers.transaction.errors.readError,
        description: t.importers.transaction.errors.cannotReadFile,
      });
      setIsImporting(false);
    };
    reader.readAsArrayBuffer(file);
  };

  /**
   * Detecta el separador més probable d'un CSV (`;` o `,`)
   */
  const detectCsvDelimiter = (text: string): string => {
    const firstLine = text.split('\n')[0] || '';
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    return semicolonCount > commaCount ? ';' : ',';
  };

  /**
   * Parseja CSV amb suport per Triodos i altres bancs espanyols:
   * - Encoding: UTF-8 o ISO-8859-1 (latin1)
   * - Separador: `;` o `,` (autodetectat)
   * - Headers alternatius: F. ejecución, F. valor, Concepto, Importe
   */
  const parseCsv = async (file: File, bankAccountId: string | null) => {
    // Funció auxiliar per llegir amb un encoding específic
    const readWithEncoding = (encoding: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file, encoding);
      });
    };

    // Funció auxiliar per parsejar el text CSV
    const parseText = (text: string): Promise<unknown[][]> => {
      return new Promise((resolve) => {
        const delimiter = detectCsvDelimiter(text);

        Papa.parse(text, {
          header: false,
          skipEmptyLines: false,
          delimiter,
          complete: (results) => {
            const matrix = (results.data as unknown[]).map((row) => (Array.isArray(row) ? row : []));
            resolve(matrix);
          },
          error: () => {
            resolve([]);
          },
        });
      });
    };

    try {
      const tryEncoding = async (encoding: string): Promise<'processed' | 'deferred'> => {
        const text = await readWithEncoding(encoding);
        const rows = await parseText(text);
        return processRowsMatrix(rows, bankAccountId, file.name);
      };

      try {
        await tryEncoding('UTF-8');
      } catch (firstError) {
        try {
          await tryEncoding('ISO-8859-1');
        } catch (secondError) {
          throw secondError || firstError;
        }
      }
    } catch (error) {
      console.error('CSV parse error:', error);
      toast({
        variant: 'destructive',
        title: t.importers.transaction.errors.importError,
        description: mapParseErrorToMessage(error, t, tr) || t.importers.transaction.errors.cannotReadCsv,
      });
      setIsImporting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // FASE 1: CLASSIFICACIÓ (parse + dedupe 3 estats)
  // ═══════════════════════════════════════════════════════════════════════════════

  const classifyParsedData = async (
    parseResult: ParseBankStatementResult,
    bankAccountId: string | null,
    fileName: string | null
  ) => {
     if (!organizationId) {
        toast({ variant: 'destructive', title: t.importers.transaction.errors.processingError, description: t.importers.transaction.errors.cannotIdentifyOrg });
        setIsImporting(false);
        return;
     }

     // GUARD: bankAccountId és obligatori per importar
     if (!bankAccountId) {
        toast({ variant: 'destructive', title: t.importers.transaction.errors.processingError, description: 'Selecciona un compte bancari per importar' });
        setIsImporting(false);
        return;
     }

    try {
        // Parsejar files a transaccions, preservant rawRow per enrichment
        const allParsedWithRaw = parseResult.rows
        .map((row) => {
          const rawRow: Record<string, any> = { ...(row.rawRow || {}) };
          rawRow.operationDate = row.operationDate;
          if (row.balanceAfter !== undefined && Number.isFinite(row.balanceAfter)) {
            rawRow.balanceAfter = row.balanceAfter;
          }

          const transactionType = detectReturnType(row.description) || 'normal';
          const tx = {
            id: '',
            date: toIsoDateTime(row.date),
            description: row.description,
            amount: row.amount,
            category: null,
            document: null,
            contactId: null,
            transactionType,
            bankAccountId: bankAccountId ?? null,
            source: 'bank' as const,
            ...(row.balanceAfter !== undefined && Number.isFinite(row.balanceAfter) ? { balanceAfter: row.balanceAfter } : {}),
            operationDate: row.operationDate,
          } as Omit<Transaction, 'id'>;

          return { tx, rawRow };
        });

        // Classificar amb dedupe (Mode A: cap bloqueig)
        const dedupeSearchRange = computeDedupeSearchRange(allParsedWithRaw.map((r) => ({
          date: r.tx.date,
          operationDate: r.tx.operationDate,
        })));
        if (!dedupeSearchRange) {
            toast({ variant: 'destructive', title: t.importers.transaction.errors.processingError, description: 'No s\'han trobat dates vàlides al fitxer' });
            setIsImporting(false);
            return;
        }

        const existingInRange = await fetchExistingTransactionsForDedupe(
            firestore,
            organizationId,
            bankAccountId,
            dedupeSearchRange.from,
            dedupeSearchRange.to
        );

        // Classificar: 3 estats amb enrichment F. ejecución + Saldo
        const extraFields = ['operationDate', 'balanceAfter'];

        const classified = classifyTransactions(allParsedWithRaw, existingInRange, bankAccountId, extraFields);

        const safeDupes = classified.filter(c => c.status === 'DUPLICATE_SAFE');
        const candidates = classified.filter(c => c.status === 'DUPLICATE_CANDIDATE');
        const newTxs = classified.filter(c => c.status === 'NEW');
        const summary = {
          newCount: newTxs.length,
          safeDuplicatesCount: safeDupes.length,
          candidateCount: candidates.length,
          totalCount: classified.length,
        };

        const transactionsToImport = summary.newCount + summary.candidateCount;
        if (transactionsToImport === 0) {
          toast({
            title: t.importers.transaction.noTransactionsFound,
            description: t.importers.transaction.noValidTransactions,
          });
          setIsImporting(false);
          return;
        }

        // Mostrar sempre resum previ abans d'importar
        setClassifiedResults(classified);
        setPendingImportContext({
          bankAccountId,
          fileName,
          totalRawRows: parseResult.summary.dataRowsCount,
        });
        setPreviewSummary(parseResult.summary);
        setPreviewRows(parseResult.sampleRows);
        setPreviewHasMappedBalance(parseResult.columnMapping.balanceAfter !== -1);
        setIsCandidateDialogOpen(true);
        setIsImporting(false);
        return;
    } catch (error: any) {
        console.error('Error classifying parsed data:', error);
        toast({
          variant: 'destructive',
          title: t.importers.transaction.errors.processingError,
          description: mapParseErrorToMessage(error, t, tr),
        });
        setIsImporting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // HANDLER: Resolució de candidats
  // ═══════════════════════════════════════════════════════════════════════════════

  const handleCandidatesContinue = (options: { selectedCandidateIndexes: number[] }) => {
    setIsCandidateDialogOpen(false);

    if (!pendingImportContext || !classifiedResults) {
      setIsImporting(false);
      return;
    }

    setIsImporting(true);

    const selection = buildImportSelection(classifiedResults, options.selectedCandidateIndexes);
    const transactionsToImport = selection.transactionsToImport;
    const stats = selection.stats;

    if (transactionsToImport.length > 0) {
      executeImport(
        transactionsToImport,
        pendingImportContext.bankAccountId,
        pendingImportContext.fileName,
        pendingImportContext.totalRawRows,
        stats
      );
    } else {
      toast({
        title: t.importers.transaction.noNewTransactions,
        description: t.importers.transaction.noValidTransactions,
      });
      setClassifiedResults(null);
      setPendingImportContext(null);
      setPreviewSummary(null);
      setPreviewRows([]);
      setPreviewHasMappedBalance(false);
      setIsImporting(false);
    }
  };

  const handleCandidatesCancelled = () => {
    setIsCandidateDialogOpen(false);
    setClassifiedResults(null);
    setPendingImportContext(null);
    setPreviewSummary(null);
    setPreviewRows([]);
    setPreviewHasMappedBalance(false);
    setIsImporting(false);
  };

  const handleMappingFieldChange = (
    field: BankMappingFieldId,
    value: string
  ) => {
    const selectedValue = Number.parseInt(value, 10);
    setMappingState((prev) => {
      if (!prev || Number.isNaN(selectedValue)) return prev;
      return {
        ...prev,
        selectedMapping: {
          ...prev.selectedMapping,
          [field]: selectedValue,
        },
      };
    });
  };

  const handleMappingCancel = () => {
    setMappingState(null);
    setIsImporting(false);
  };

  const handleMappingContinue = async () => {
    if (!mappingState) return;
    setIsImporting(true);

    try {
      await processRowsMatrix(
        mappingState.rows,
        mappingState.bankAccountId,
        mappingState.fileName,
        {
          headerRowIndexOverride: mappingState.headerRowIndex,
          columnMappingOverride: {
            operationDate: mappingState.selectedMapping.operationDate,
            valueDate: mappingState.selectedMapping.valueDate,
            description: mappingState.selectedMapping.description,
            amount: mappingState.selectedMapping.amount,
            balanceAfter: mappingState.selectedMapping.balanceAfter,
          },
          skipMappingDialog: true,
        }
      );
      setMappingState(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t.importers.transaction.errors.processingError,
        description: mapParseErrorToMessage(error, t, tr),
      });
      setIsImporting(false);
    }
  };

  const canContinueWithMapping = React.useMemo(() => {
    if (!mappingState) return false;
    const hasAmountMapping = mappingState.selectedMapping.amount !== -1 || mappingState.riskSignals.hasDebitCredit;
    return (
      mappingState.selectedMapping.operationDate !== -1
      && mappingState.selectedMapping.description !== -1
      && hasAmountMapping
    );
  }, [mappingState]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // FASE 2: EXECUCIÓ (contact matching + batch write + importRun)
  // ═══════════════════════════════════════════════════════════════════════════════

  const executeImport = async (
    transactionsToProcess: Array<Omit<Transaction, 'id'>>,
    bankAccountId: string,
    fileName: string | null,
    totalRawRows: number,
    stats: {
      duplicateSkippedCount: number;
      candidateCount?: number;
      candidateUserImportedCount?: number;
      candidateUserSkippedCount?: number;
    }
  ) => {
    // Netejar estat de classificació
    setClassifiedResults(null);
    setPendingImportContext(null);
    setPreviewSummary(null);
    setPreviewRows([]);
    setPreviewHasMappedBalance(false);

    if (!organizationId) {
      setIsImporting(false);
      return;
    }

    try {
        // ═══════════════════════════════════════════════════════════════════
        // MATCHING PER NOM (instantani, sense IA)
        // ═══════════════════════════════════════════════════════════════════

        let matchedCount = 0;
        let unmatchedTransactions: Array<{ tx: any; index: number }> = [];

        const transactionsAfterNameMatch = transactionsToProcess.map((tx, index) => {
            if (!availableContacts || availableContacts.length === 0) {
                unmatchedTransactions.push({ tx, index });
                return tx;
            }

            const match = findMatchingContact(tx.description, availableContacts);

            if (match) {
                matchedCount++;
                const contact = availableContacts.find(c => c.id === match.contactId);
                const defaultCategory = contact?.defaultCategoryId;
                const willAssignCategory = defaultCategory && !tx.category
                  && availableCategories
                  && isCategoryIdCompatibleStrict(tx.amount, defaultCategory, availableCategories);
                return {
                    ...tx,
                    contactId: match.contactId,
                    contactType: match.contactType,
                    ...(willAssignCategory ? { category: defaultCategory } : {}),
                };
            } else {
                unmatchedTransactions.push({ tx, index });
                return tx;
            }
        });

        // ═══════════════════════════════════════════════════════════════════
        // IA com a fallback (només per les no matchejades, si són poques)
        // ═══════════════════════════════════════════════════════════════════
        const AI_THRESHOLD = 20;
        const useAI = unmatchedTransactions.length > 0 && unmatchedTransactions.length <= AI_THRESHOLD;

        let transactionsWithContacts = [...transactionsAfterNameMatch];

        if (useAI && unmatchedTransactions.length > 0) {
            const contactsForAI = availableContacts?.map(c => ({ id: c.id, name: c.name })) || [];

            const BATCH_SIZE = 10;
            const DELAY_MS = 60000;
            let quotaExceeded = false;
            let aiMatchedCount = 0;

            for (let i = 0; i < unmatchedTransactions.length; i += BATCH_SIZE) {
                if (quotaExceeded) break;

                const batch = unmatchedTransactions.slice(i, i + BATCH_SIZE);

                await Promise.all(batch.map(async ({ tx, index }) => {
                    if (quotaExceeded) return;

                    try {
                        const result = await inferContact({ description: tx.description, contacts: contactsForAI });
                        if (result.contactId) {
                            const contact = availableContacts?.find(c => c.id === result.contactId);
                            if (contact) {
                                aiMatchedCount++;
                                const defaultCategory = contact.defaultCategoryId;
                                const willAssignCategory = defaultCategory && !tx.category
                                  && availableCategories
                                  && isCategoryIdCompatibleStrict(tx.amount, defaultCategory, availableCategories);
                                transactionsWithContacts[index] = {
                                    ...tx,
                                    contactId: result.contactId,
                                    contactType: contact.type,
                                    ...(willAssignCategory ? { category: defaultCategory } : {}),
                                };
                            }
                        }
                    } catch (error: any) {
                        console.error("Error inferring contact:", error);

                        const errorMsg = error?.message || error?.toString() || '';
                        if (!quotaExceeded && (errorMsg.includes('429') || errorMsg.toLowerCase().includes('quota') || errorMsg.toLowerCase().includes('rate limit'))) {
                            quotaExceeded = true;
                            toast({
                                variant: 'destructive',
                                title: t.importers.transaction.errors.aiQuotaExceeded,
                                description: t.importers.transaction.errors.aiQuotaExceededDescription,
                                duration: 10000,
                            });
                        }
                    }
                }));

                if (!quotaExceeded && i + BATCH_SIZE < unmatchedTransactions.length) {
                    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
                }
            }

        }

        // ═══════════════════════════════════════════════════════════════════
        // RESUM FINAL
        // ═══════════════════════════════════════════════════════════════════

        const authUser = auth.currentUser;
        if (!authUser) {
          throw new Error('Sessió no vàlida. Torna a iniciar sessió.');
        }

        const idToken = await authUser.getIdToken();
        const normalizedTransactions = transactionsWithContacts.map((tx) => {
          const normalizedTx = normalizeTransaction(tx) as Record<string, unknown>;
          const { id: _ignored, ...withoutId } = normalizedTx as { id?: string } & Record<string, unknown>;
          const sanitizedTx = { ...withoutId };
          sanitizedTx.transactionType = normalizeImportTransactionTypeForPersist(sanitizedTx.transactionType);

          return sanitizedTx;
        });

        const source: 'csv' | 'xlsx' = fileName?.endsWith('.xlsx') ? 'xlsx' : 'csv';

        const apiResponse = await fetch('/api/transactions/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            orgId: organizationId,
            bankAccountId,
            fileName,
            source,
            totalRows: totalRawRows,
            stats,
            transactions: normalizedTransactions,
          }),
        });

        let result: ImportTransactionsApiResponse | null = null;
        try {
          result = await apiResponse.json() as ImportTransactionsApiResponse;
        } catch {
          result = null;
        }

        if (!apiResponse.ok || !result?.success) {
          const errorMessage = result?.error || `Error importació (${apiResponse.status})`;
          throw new Error(errorMessage);
        }

        const newTransactions = (result.createdTransactions || []) as Transaction[];

        // Post-import: suggerir conciliació amb documents pendents
        if (newTransactions.length > 0 && availableContacts) {
          try {
            await suggestPendingDocumentMatches(
              firestore,
              organizationId,
              newTransactions,
              availableContacts
            );
          } catch (error) {
            console.error('Error suggesting matches:', error);
          }
        }

        // Missatge d'èxit
          const totalDuplicatesSkipped = stats.duplicateSkippedCount + (stats.candidateUserSkippedCount ?? 0);
        const createdCount = result.createdCount ?? transactionsToProcess.length;

        if (result.idempotent) {
          toast({
            title: t.importers.transaction.noNewTransactions,
            description: 'Aquest fitxer ja s’havia importat prèviament (idempotent).',
          });
        } else {
          toast({
            title: t.importers.transaction.importSuccess,
            description: t.importers.transaction.importSuccessDescription(createdCount, totalDuplicatesSkipped),
          });
        }

    } catch (error: any) {
        console.error("Error executing import:", error);
        toast({
          variant: 'destructive',
          title: t.importers.transaction.errors.processingError,
          description: error.message || t.importers.transaction.errors.cannotProcessContent,
        });
    } finally {
      setIsImporting(false);
    }
  }



  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        className="hidden"
        disabled={isImporting}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={isImporting} onClick={handleImportClick}>
          {isImporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileUp className="mr-2 h-4 w-4" />
          )}
          {t.importers.transaction.title}
        </Button>
      </div>

      {/* Diàleg de selecció de compte bancari */}
      <Dialog open={isAccountDialogOpen} onOpenChange={(open) => {
        setIsAccountDialogOpen(open);
        if (!open) setPendingFile(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.settings.bankAccounts.selectAccount}</DialogTitle>
            <DialogDescription>
              {t.settings.bankAccounts.selectAccountRequired}
            </DialogDescription>
          </DialogHeader>

          {isLoadingBankAccounts ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : bankAccounts.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                <span>{t.settings.bankAccounts.noAccountsWarning}</span>
              </div>
              <Button asChild variant="outline">
                <Link href={buildUrl('/configuracion')}>
                  {t.settings.bankAccounts.goToSettings}
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">{t.settings.bankAccounts.name}</Label>
                  <Select
                    value={selectedBankAccountId ?? ''}
                    onValueChange={(value) => setSelectedBankAccountId(value)}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder={t.settings.bankAccounts.selectAccount} />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                          {account.isDefault && ` (${t.settings.bankAccounts.default})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="col-span-3 col-start-2 text-xs text-muted-foreground">
                    {t.movements.import.formatsHelp}
                  </div>
                </div>

                {/* Avís inline persistent: recomanació d'importació */}
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        {t.importers.transaction.importRecommendationTitle || 'Recomanació d\'importació'}
                      </p>
                      <p className="text-amber-700 dark:text-amber-300">
                        {t.importers.transaction.importRecommendationText ||
                         'Per garantir un registre net i ràpid, recomanem importar només extractes no solapats.'}
                      </p>
                      <p className="text-amber-600 dark:text-amber-400">
                        {t.importers.transaction.dedupeNote ||
                         'Summa detecta i evita duplicats, però no és la manera òptima de treballar.'}
                      </p>
                      {lastImportedDate && (
                        <>
                          <p className="mt-2 font-medium text-amber-800 dark:text-amber-200">
                            {t.importers.transaction.lastImportedUntil || 'Últim import registrat fins al:'}{' '}
                            {new Date(lastImportedDate).toLocaleDateString('ca-ES')}
                          </p>
                          <p className="text-amber-600 dark:text-amber-400">
                            {t.importers.transaction.recommendedFrom || 'Extracte recomanat: a partir del'}{' '}
                            {new Date(new Date(lastImportedDate).getTime() + 86400000).toLocaleDateString('ca-ES')}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Checkbox de fricció si hi ha dades existents (potencial solapament) */}
                {lastImportedDate && (
                  <div className="rounded-md border border-muted bg-muted/50 p-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="overlap-acknowledge"
                        checked={overlapAcknowledged}
                        onCheckedChange={(checked) => setOverlapAcknowledged(checked === true)}
                      />
                      <div className="space-y-1">
                        <label
                          htmlFor="overlap-acknowledge"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {t.importers.transaction.overlapAcknowledge ||
                           'Entenc que aquest extracte pot solapar períodes ja importats i que només l\'estic important perquè és necessari.'}
                        </label>
                        <p className="text-xs text-muted-foreground">
                          {t.importers.transaction.overlapAcknowledgeNote ||
                           'Això pot augmentar el temps d\'importació i generar avisos innecessaris.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAccountDialogOpen(false);
                    setPendingFile(null);
                  }}
                >
                  {t.common.cancel}
                </Button>
                <Button
                  onClick={handleAccountSelected}
                  disabled={!selectedBankAccountId || (lastImportedDate !== null && !overlapAcknowledged)}
                >
                  {t.common.continue}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(mappingState)}
        onOpenChange={(open) => {
          if (!open) handleMappingCancel();
        }}
      >
        <DialogContent className="w-[95vw] max-h-[90vh] overflow-x-hidden overflow-y-auto p-4 sm:max-w-5xl sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {tr('importers.transaction.mapping.title', 'Configuració del mapeig')}
            </DialogTitle>
            <DialogDescription>
              {tr(
                'importers.transaction.mapping.description',
                'Revisa la previsualització i indica quina columna correspon a cada camp.'
              )}
            </DialogDescription>
          </DialogHeader>

          {mappingState && (
            <RemittanceStyleMappingStep
              fields={[
                {
                  id: 'operationDate',
                  label: tr('importers.transaction.mapping.field.operationDate', 'Data (requerit)'),
                  required: true,
                  dotClassName: 'bg-purple-500',
                  headerClassName: 'bg-purple-100 dark:bg-purple-900/30',
                  cellClassName: 'bg-purple-50 dark:bg-purple-900/20',
                },
                {
                  id: 'valueDate',
                  label: tr('importers.transaction.mapping.field.valueDate', 'Data valor (opcional)'),
                  required: false,
                  allowUnavailable: true,
                  dotClassName: 'bg-gray-400',
                  headerClassName: 'bg-gray-100 dark:bg-gray-800/30',
                  cellClassName: 'bg-gray-50 dark:bg-gray-800/20',
                },
                {
                  id: 'description',
                  label: tr('importers.transaction.mapping.field.description', 'Descripció (requerit)'),
                  required: true,
                  dotClassName: 'bg-blue-500',
                  headerClassName: 'bg-blue-100 dark:bg-blue-900/30',
                  cellClassName: 'bg-blue-50 dark:bg-blue-900/20',
                },
                {
                  id: 'amount',
                  label: tr('importers.transaction.mapping.field.amount', 'Import (requerit)'),
                  required: true,
                  allowUnavailable: mappingState.riskSignals.hasDebitCredit,
                  dotClassName: 'bg-green-500',
                  headerClassName: 'bg-green-100 dark:bg-green-900/30',
                  cellClassName: 'bg-green-50 dark:bg-green-900/20',
                },
                {
                  id: 'balanceAfter',
                  label: tr('importers.transaction.mapping.field.balanceAfter', 'Saldo (opcional)'),
                  required: false,
                  allowUnavailable: true,
                  dotClassName: 'bg-cyan-500',
                  headerClassName: 'bg-cyan-100 dark:bg-cyan-900/30',
                  cellClassName: 'bg-cyan-50 dark:bg-cyan-900/20',
                },
              ]}
              selectedMapping={mappingState.selectedMapping}
              columns={mappingState.columns}
              previewRows={mappingState.previewRows}
              previewColumnCount={mappingState.previewColumnCount}
              previewStartRow={mappingState.headerRowIndex + 2}
              labels={{
                previewTitle: tr('importers.transaction.mapping.previewTitle', 'Previsualització (primeres 8 files)'),
                fieldMappingTitle: tr('importers.transaction.mapping.fieldMappingTitle', 'Mapejat de camps'),
                columnOptionTemplate: tr('importers.transaction.mapping.columnOption', 'Columna {index}: {example}'),
                columnHeaderPrefix: tr('importers.transaction.mapping.columnHeaderPrefix', 'Col.'),
                notAvailable: tr('importers.transaction.mapping.notAvailable', 'No disponible'),
                back: tr('common.back', 'Tornar'),
                continue: tr('common.continue', 'Continuar'),
              }}
              isSubmitting={isImporting}
              continueDisabled={!canContinueWithMapping}
              onBack={handleMappingCancel}
              onContinue={handleMappingContinue}
              onMappingChange={(field, nextValue) => handleMappingFieldChange(field, String(nextValue))}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Diàleg de resolució de candidats a duplicat */}
      <DedupeCandidateResolver
        open={isCandidateDialogOpen}
        candidates={classifiedResults?.filter(c => c.status === 'DUPLICATE_CANDIDATE') ?? []}
        safeDuplicates={classifiedResults?.filter(c => c.status === 'DUPLICATE_SAFE') ?? []}
        newCount={classifiedResults?.filter(c => c.status === 'NEW').length ?? 0}
        parseSummary={previewSummary}
        sampleRows={previewRows}
        hasMappedBalance={previewHasMappedBalance}
        onContinue={handleCandidatesContinue}
        onCancel={handleCandidatesCancelled}
      />
    </>
  );
}
