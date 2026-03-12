'use client';

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { collection, query, where, updateDoc, doc, increment, addDoc, getDocs, deleteDoc } from 'firebase/firestore';
import type { Transaction, Donor } from '@/lib/data';
import { normalizeIBAN, normalizeTaxId as normalizeLibTaxId } from '@/lib/normalize';
import { assertFiscalTxCanBeSaved } from '@/lib/fiscal/assertFiscalInvariant';
import { acquireProcessLock, releaseProcessLock, getLockFailureMessage } from '@/lib/fiscal/processLocks';
import { isActiveRemittanceChild } from '@/lib/remittances/is-active-child';

// ═══════════════════════════════════════════════════════════════════════════════
// TIPUS
// ═══════════════════════════════════════════════════════════════════════════════

export type Step = 'upload' | 'mapping' | 'preview' | 'processing';

export type DateConfidence = 'line' | 'file' | 'none';

export type NoMatchReason = 'no-date' | 'ambiguous' | 'no-match' | null;

export interface ColumnMapping {
  ibanColumn: number | null;
  amountColumn: number | null;
  dateColumn: number | null;
  dniColumn: number | null;
  nameColumn: number | null;
  reasonColumn: number | null;
  // Columnes bulk (format NET)
  liquidationDateColumn: number | null;
  liquidationNumberColumn: number | null;
}

export interface ParsedReturn {
  rowIndex: number;
  iban: string;
  amount: number;                          // SEMPRE POSITIU (Math.abs)
  date: Date | null;                       // null si no hi ha data (MAI new Date() com fallback)
  dateConfidence: DateConfidence;
  sourceFile?: string;
  dni: string | null;
  originalName: string | null;
  returnReason: string | null;
  // Bulk mode (format NET) - opcional
  liquidationDateISO?: string;             // YYYY-MM-DD
  liquidationNumber?: string;
  // Matching donant
  matchedDonorId: string | null;
  matchedDonor: Donor | null;              // Referència completa per conveniència
  matchedBy: 'iban' | 'dni' | 'name' | 'manual' | null;
  // Camp canònic P0: SI resolvedDonorId té valor, hi ha donant resolt
  resolvedDonorId: string | null;
  // Matching transacció
  matchType: 'grouped' | 'individual' | 'none';
  noMatchReason: NoMatchReason;
  groupId: string | null;
  groupedTransactionId: string | null;
  groupTotalAmount: number | null;
  matchedTransactionId: string | null;
  matchedTransaction: Transaction | null;  // Referència completa per conveniència
  // Status derivat (per UI)
  status: 'matched' | 'donor_found' | 'not_found';
}

export interface GroupedMatch {
  originalTransaction: Transaction;
  returns: ParsedReturn[];
  totalAmount: number;
  date: Date;
  groupId: string;
}

// Tipus per mode Bulk (format NET)
export type BulkGroupStatus = 'auto' | 'needsReview' | 'noMatch';
export type BulkGroupReason = 'multipleCandidates' | 'outsideWindow' | 'noCandidates' | null;

export interface BulkReturnGroup {
  key: string;                             // `${liquidationDateISO}|${liquidationNumber}`
  liquidationDateISO: string;              // YYYY-MM-DD
  liquidationNumber: string;
  totalAmount: number;                     // POSITIU (suma de amounts)
  rows: ParsedReturn[];
  candidates: Transaction[];               // Pares candidats (amount match)
  candidatesInWindow: Transaction[];       // Candidats dins ±2 dies
  candidatesOutsideWindow: Transaction[];  // Candidats fora finestra
  status: BulkGroupStatus;
  reason: BulkGroupReason;
  selectedParentId: string | null;         // Per UI quan needsReview
  matchedParent: Transaction | null;       // Quan status='auto'
}

export interface ReturnImporterStats {
  total: number;
  matched: number;
  donorFound: number;
  notFound: number;
  grouped: number;
  ambiguous: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAPEIG DE COLUMNES PER BANC
// ═══════════════════════════════════════════════════════════════════════════════

const COLUMN_MAPPINGS = {
  iban: [
    'cuenta de adeudo', 'cuenta destino', 'cuenta del deudor', 'cta destino',
    'cta. destino', 'cta adeudo', 'iban', 'cuenta', 'account', 'compte'
  ],
  amount: [
    'importe', 'cantidad', 'amount', 'monto', 'valor', 'import', 'quantitat'
  ],
  date: [
    'fecha de liquidación', 'fecha de liquidacion', 'fecha rechazo/devolución',
    'fecha rechazo', 'fecha devolución', 'fecha devolucion', 'fecha liquidacion',
    'fecha', 'date', 'data'
  ],
  dni: [
    'referencia externa', 'dni', 'nif', 'cif', 'referencia', 'ref', 'id cliente',
    'identificador', 'documento', 'tax id'
  ],
  name: [
    'nombre cliente', 'nombre del deudor', 'nombre deudor', 'nombre', 'titular',
    'cliente', 'name', 'nom', 'deudor', 'beneficiario'
  ],
  reason: [
    'motivo devolución', 'motivo devolucion', 'motivo rechazo', 'motivo',
    'razón', 'razon', 'reason', 'causa', 'descripción', 'descripcion'
  ]
} as const;

type ColumnType = keyof typeof COLUMN_MAPPINGS;

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITATS
// ═══════════════════════════════════════════════════════════════════════════════

const normalizeIban = (iban: string): string => {
  if (!iban) return '';
  return iban
    .replace(/^IBAN\s*/i, '')
    .replace(/\s/g, '')
    .toUpperCase();
};

const normalizeTaxId = (taxId: string): string => {
  if (!taxId) return '';
  return taxId
    .replace(/[\s-]/g, '')
    .toUpperCase();
};

const normalizeName = (name: string): string => {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Parseja un valor d'import (suporta formats EU i US)
 * Retorna SEMPRE valor absolut (positiu)
 */
const parseAmount = (value: string | number): number => {
  if (typeof value === 'number') return Math.abs(value);
  if (!value) return 0;

  const str = value.toString().trim();
  const cleaned = str.replace(/\s*(EUR|€|USD|\$|£)\s*/gi, '').trim();

  // Format EU: 1.234,56 → 1234.56
  if (/,\d{1,2}$/.test(cleaned)) {
    return Math.abs(parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))) || 0;
  }

  // Format US: 1,234.56 → 1234.56
  return Math.abs(parseFloat(cleaned.replace(/,/g, ''))) || 0;
};

/**
 * Parseja una data en múltiples formats
 * Retorna Date o null (MAI inventa dates)
 */
const parseDate = (value: string | number | Date | null | undefined): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  const str = value.toString().trim();
  if (!str) return null;

  // Format ISO: 2025-11-12 o 2025-11-12T00:00:00
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str.split(' ')[0].split('T')[0]);
    return isNaN(d.getTime()) ? null : d;
  }

  // Format EU: DD/MM/YYYY o DD-MM-YYYY
  const euMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (euMatch) {
    const [, day, month, year] = euMatch;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return isNaN(d.getTime()) ? null : d;
  }

  // Intentar parse directe com a últim recurs
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch {
    // Ignorar errors
  }

  return null;
};

/**
 * Extreu la data global de la capçalera del fitxer (per bancs com Santander)
 * Busca patrons com "Fecha de liquidación" i la data adjacent
 */
const extractGlobalDateFromHeaders = (rows: string[][]): Date | null => {
  const datePatterns = [
    'fecha de liquidación', 'fecha de liquidacion',
    'fecha liquidación', 'fecha liquidacion',
    'fecha rechazo', 'fecha devolución', 'fecha devolucion'
  ];

  // Buscar en les primeres 20 files
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;

    for (let j = 0; j < row.length; j++) {
      const cell = (row[j] || '').toString().toLowerCase().trim();

      if (datePatterns.some(pattern => cell.includes(pattern))) {
        // La data pot estar a cel·les adjacents
        const candidates = [
          row[j + 1],
          row[j + 2],
          rows[i + 1]?.[j],
          rows[i + 1]?.[j + 1],
          rows[i + 1]?.[j - 1]
        ];

        for (const val of candidates) {
          if (val) {
            const parsed = parseDate(val);
            if (parsed) {
              return parsed;
            }
          }
        }
      }
    }
  }

  return null;
};

/**
 * Obté la data d'una transacció (gestiona Firestore Timestamp)
 */
const getTxDate = (tx: Transaction): Date => {
  if (typeof tx.date === 'string') {
    return new Date(tx.date);
  } else if (tx.date && typeof (tx.date as any).toDate === 'function') {
    return (tx.date as any).toDate();
  }
  return tx.date as Date;
};

const detectStartRow = (rows: string[][]): number => {
  const ibanPattern = /^(IBAN\s*)?[A-Z]{2}[0-9]{2}[A-Z0-9\s]{10,30}$/i;

  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;

    const hasIban = row.some(cell => {
      const cleaned = (cell || '').toString().trim().replace(/\s/g, '');
      return ibanPattern.test(cleaned);
    });

    if (hasIban) return i;
  }

  return 0;
};

const detectColumnByHeader = (headers: string[], fieldType: ColumnType): number => {
  const normalizedHeaders = headers.map(h => (h || '').toString().toLowerCase().trim());
  const patterns = COLUMN_MAPPINGS[fieldType];

  for (const pattern of patterns) {
    const index = normalizedHeaders.findIndex(h => h.includes(pattern));
    if (index !== -1) return index;
  }
  return -1;
};

const detectColumns = (rows: string[][], startRow: number): ColumnMapping => {
  const headerRow = startRow > 0 ? rows[startRow - 1] : null;

  let ibanColumn: number | null = null;
  let amountColumn: number | null = null;
  let dateColumn: number | null = null;
  let dniColumn: number | null = null;
  let nameColumn: number | null = null;
  let reasonColumn: number | null = null;

  if (headerRow && headerRow.length > 0) {
    const ibanIdx = detectColumnByHeader(headerRow, 'iban');
    const amountIdx = detectColumnByHeader(headerRow, 'amount');
    const dateIdx = detectColumnByHeader(headerRow, 'date');
    const dniIdx = detectColumnByHeader(headerRow, 'dni');
    const nameIdx = detectColumnByHeader(headerRow, 'name');
    const reasonIdx = detectColumnByHeader(headerRow, 'reason');

    if (ibanIdx >= 0) ibanColumn = ibanIdx;
    if (amountIdx >= 0) amountColumn = amountIdx;
    if (dateIdx >= 0) dateColumn = dateIdx;
    if (dniIdx >= 0) dniColumn = dniIdx;
    if (nameIdx >= 0) nameColumn = nameIdx;
    if (reasonIdx >= 0) reasonColumn = reasonIdx;
  }

  const sampleRows = rows.slice(startRow, startRow + 10);
  if (sampleRows.length === 0 || sampleRows[0].length === 0) {
    return { ibanColumn, amountColumn, dateColumn, dniColumn, nameColumn, reasonColumn, liquidationDateColumn: null, liquidationNumberColumn: null };
  }

  const numCols = Math.max(...sampleRows.map(r => r.length));

  for (let col = 0; col < numCols; col++) {
    const values = sampleRows.map(row => (row[col] || '').toString().trim());
    const nonEmptyValues = values.filter(v => v.length > 0);
    if (nonEmptyValues.length === 0) continue;

    if (ibanColumn === null) {
      const ibanMatches = nonEmptyValues.filter(v => {
        const cleaned = v.replace(/^IBAN\s*/i, '').replace(/\s/g, '').toUpperCase();
        return /^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(cleaned);
      });
      if (ibanMatches.length > nonEmptyValues.length * 0.5) {
        ibanColumn = col;
        continue;
      }
    }

    if (amountColumn === null) {
      const amountMatches = nonEmptyValues.filter(v => {
        const amount = parseAmount(v);
        return amount > 0 && amount < 100000;
      });
      if (amountMatches.length > nonEmptyValues.length * 0.5) {
        amountColumn = col;
        continue;
      }
    }

    if (dateColumn === null) {
      const dateMatches = nonEmptyValues.filter(v => parseDate(v) !== null);
      if (dateMatches.length > nonEmptyValues.length * 0.5) {
        dateColumn = col;
        continue;
      }
    }

    if (dniColumn === null) {
      const dniMatches = nonEmptyValues.filter(v => {
        const cleaned = v.replace(/[\s-]/g, '').toUpperCase();
        return /^[0-9]{7,8}[A-Z]$/.test(cleaned) ||
               /^[A-Z][0-9]{7,8}$/.test(cleaned) ||
               /^[XYZ][0-9]{7}[A-Z]$/.test(cleaned);
      });
      if (dniMatches.length > nonEmptyValues.length * 0.3) {
        dniColumn = col;
      }
    }
  }

  return { ibanColumn, amountColumn, dateColumn, dniColumn, nameColumn, reasonColumn, liquidationDateColumn: null, liquidationNumberColumn: null };
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

interface UseReturnImporterOptions {
  /** Mode contextual: assignar devolucions directament a aquest pare */
  parentTransaction?: Transaction | null;
}

export function useReturnImporter(options: UseReturnImporterOptions = {}) {
  const { parentTransaction = null } = options;
  const isContextMode = !!parentTransaction;

  const { toast } = useToast();
  const { firestore, user } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const userId = user?.uid;

  // Estat de navegació
  const [step, setStep] = React.useState<Step>('upload');
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Estat dels fitxers
  const [files, setFiles] = React.useState<File[]>([]);
  const [allRows, setAllRows] = React.useState<string[][]>([]);
  const [startRow, setStartRow] = React.useState(0);

  // Estat de mapejat
  const [mapping, setMapping] = React.useState<ColumnMapping>({
    ibanColumn: null,
    amountColumn: null,
    dateColumn: null,
    dniColumn: null,
    nameColumn: null,
    reasonColumn: null,
    liquidationDateColumn: null,
    liquidationNumberColumn: null,
  });

  // Estat de resultats
  const [parsedReturns, setParsedReturns] = React.useState<ParsedReturn[]>([]);
  const [groupedMatches, setGroupedMatches] = React.useState<GroupedMatch[]>([]);
  const [bulkReturnGroups, setBulkReturnGroups] = React.useState<BulkReturnGroup[]>([]);

  // Carregar donants
  const donorsQuery = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'contacts') : null,
    [firestore, organizationId]
  );
  const { data: allContacts } = useCollection<Donor>(donorsQuery);

  const donors = React.useMemo(() => {
    return (allContacts || []).filter(c => c.type === 'donor');
  }, [allContacts]);

  // Carregar transaccions candidates per matching:
  // - Import negatiu (despeses/devolucions del banc)
  // - Sense contactId assignat
  // - NO filtrem per transactionType perquè les devolucions bancàries individuals
  //   NO tenen transactionType='return' fins que es processen
  const pendingReturnsQuery = useMemoFirebase(
    () => organizationId
      ? query(
          collection(firestore, 'organizations', organizationId, 'transactions'),
          where('contactId', '==', null)
        )
      : null,
    [firestore, organizationId]
  );
  const { data: pendingReturnsRaw } = useCollection<Transaction>(pendingReturnsQuery);

  // Filtrar en memòria per obtenir candidats vàlids:
  // - Exclou remittanceStatus === 'complete' (ja resoltes)
  // - Només imports negatius (devolucions = càrrecs al banc)
  // - Exclou splits i transferències internes
  const pendingReturns = React.useMemo(() => {
    if (!pendingReturnsRaw) return null;
    const filtered = pendingReturnsRaw.filter(tx => {
      // Excloure remeses completes
      if (tx.remittanceStatus === 'complete') return false;
      // Només imports negatius (devolucions són càrrecs)
      if (tx.amount >= 0) return false;
      // Excloure splits (transaccions dividides)
      if (tx.isSplit) return false;
      // Excloure fills de remeses (source === 'remittance')
      if (tx.source === 'remittance') return false;
      return true;
    });
    return filtered;
  }, [pendingReturnsRaw]);

  // Estadístiques
  const stats = React.useMemo<ReturnImporterStats>(() => {
    const matched = parsedReturns.filter(r => r.status === 'matched').length;
    const donorFound = parsedReturns.filter(r => r.status === 'donor_found').length;
    const notFound = parsedReturns.filter(r => r.status === 'not_found').length;
    const grouped = parsedReturns.filter(r => r.matchType === 'grouped').length;
    const ambiguous = parsedReturns.filter(r => r.noMatchReason === 'ambiguous').length;
    return { total: parsedReturns.length, matched, donorFound, notFound, grouped, ambiguous };
  }, [parsedReturns]);

  // Reset
  const reset = React.useCallback(() => {
    setStep('upload');
    setIsProcessing(false);
    setFiles([]);
    setAllRows([]);
    setStartRow(0);
    setMapping({ ibanColumn: null, amountColumn: null, dateColumn: null, dniColumn: null, nameColumn: null, reasonColumn: null, liquidationDateColumn: null, liquidationNumberColumn: null });
    setParsedReturns([]);
    setGroupedMatches([]);
    setBulkReturnGroups([]);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // PARSING DE FITXERS
  // ═══════════════════════════════════════════════════════════════════════════

  const parseFiles = React.useCallback(async (inputFiles: File[]) => {
    setIsProcessing(true);
    const allParsedRows: string[][] = [];

    try {
      for (const file of inputFiles) {
        const fileName = file.name.toLowerCase();
        const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

        if (isExcel) {
          const XLSX = await import('xlsx');
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: string[][] = XLSX.utils.sheet_to_json(firstSheet, {
            header: 1,
            defval: '',
            raw: false
          });

          const filteredRows = rows
            .filter(row => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ''))
            .map(row => row.map(cell => String(cell ?? '').trim()));

          allParsedRows.push(...filteredRows);
        } else {
          const text = await file.text();
          const delimiter = text.includes(';') ? ';' : ',';
          const lines = text.split('\n').filter(line => line.trim());
          const rows = lines.map(line => line.split(delimiter).map(cell => cell.trim()));
          allParsedRows.push(...rows);
        }
      }

      if (allParsedRows.length === 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Els fitxers estan buits' });
        setIsProcessing(false);
        return;
      }

      setAllRows(allParsedRows);
      setFiles(inputFiles);

      const detectedStartRow = detectStartRow(allParsedRows);
      setStartRow(detectedStartRow);

      const detectedMapping = detectColumns(allParsedRows, detectedStartRow);
      setMapping(detectedMapping);

      setStep('mapping');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  // ═══════════════════════════════════════════════════════════════════════════
  // MATCHING - FLUX COMPLET REFACTORITZAT
  // ═══════════════════════════════════════════════════════════════════════════

  const performMatching = React.useCallback(() => {
    if (mapping.ibanColumn === null || mapping.amountColumn === null) {
      toast({
        variant: 'destructive',
        title: 'Falten columnes',
        description: 'Has de seleccionar les columnes IBAN i Import'
      });
      return;
    }

    setIsProcessing(true);

    try {
      // ═══════════════════════════════════════════════════════════════════════
      // FASE 1: PARSEJAR DADES
      // ═══════════════════════════════════════════════════════════════════════

      const globalDate = extractGlobalDateFromHeaders(allRows);
      const results: ParsedReturn[] = [];
      const dataRows = allRows.slice(startRow);

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];

        const rawIban = mapping.ibanColumn !== null ? (row[mapping.ibanColumn] || '') : '';
        const iban = normalizeIban(rawIban);
        if (!iban) continue;

        const amount = parseAmount(row[mapping.amountColumn!] || '');
        if (amount <= 0) continue;

        // ═══════════════════════════════════════════════════════════════════
        // FASE 2: NORMALITZAR (dates + dateConfidence)
        // ═══════════════════════════════════════════════════════════════════

        const rawDate = mapping.dateColumn !== null ? (row[mapping.dateColumn] || '') : '';
        const lineDate = parseDate(rawDate);

        let date: Date | null = null;
        let dateConfidence: DateConfidence = 'none';

        if (lineDate) {
          date = lineDate;
          dateConfidence = 'line';
        } else if (globalDate) {
          date = globalDate;
          dateConfidence = 'file';
        }
        // Si no hi ha data, deixem date=null i dateConfidence='none' (MAI new Date())

        const rawDni = mapping.dniColumn !== null ? (row[mapping.dniColumn] || '') : '';
        const dni = normalizeTaxId(rawDni);

        const originalName = mapping.nameColumn !== null ? (row[mapping.nameColumn] || '').trim() : null;
        const returnReason = mapping.reasonColumn !== null ? (row[mapping.reasonColumn] || '').trim() : null;

        // Bulk mode (format NET): parsejar liquidationDate i liquidationNumber
        let liquidationDateISO: string | undefined;
        let liquidationNumber: string | undefined;
        if (mapping.liquidationDateColumn !== null && mapping.liquidationNumberColumn !== null) {
          const rawLiqDate = row[mapping.liquidationDateColumn] || '';
          const liqDate = parseDate(rawLiqDate);
          if (liqDate) {
            liquidationDateISO = liqDate.toISOString().split('T')[0]; // YYYY-MM-DD
          }
          liquidationNumber = (row[mapping.liquidationNumberColumn] || '').trim() || undefined;
        }

        results.push({
          rowIndex: startRow + i + 1,
          iban,
          amount,  // Ja és positiu (parseAmount fa Math.abs)
          date,
          dateConfidence,
          sourceFile: files[0]?.name,
          dni,
          originalName: originalName || null,
          returnReason: returnReason || null,
          matchedDonorId: null,
          matchedDonor: null,
          matchedBy: null,
          resolvedDonorId: null,  // Camp canònic P0
          matchType: 'none',
          noMatchReason: null,
          groupId: null,
          groupedTransactionId: null,
          groupTotalAmount: null,
          matchedTransactionId: null,
          matchedTransaction: null,
          status: 'not_found',
          // Bulk mode (format NET)
          liquidationDateISO,
          liquidationNumber,
        });
      }

      // ═══════════════════════════════════════════════════════════════════════
      // FASE 3: MATCHING DONANTS (sense tocar transaccions)
      // ═══════════════════════════════════════════════════════════════════════

      for (const r of results) {
        // Buscar per IBAN
        let matchedDonor = donors.find(d => d.iban && normalizeIban(d.iban) === r.iban);
        let matchedBy: ParsedReturn['matchedBy'] = matchedDonor ? 'iban' : null;

        // Buscar per DNI
        if (!matchedDonor && r.dni) {
          matchedDonor = donors.find(d => d.taxId && normalizeTaxId(d.taxId) === r.dni);
          if (matchedDonor) matchedBy = 'dni';
        }

        // Buscar per nom
        if (!matchedDonor && r.originalName && r.originalName.length > 3) {
          const normalizedFileName = normalizeName(r.originalName);
          matchedDonor = donors.find(d => {
            if (!d.name) return false;
            const normalizedDonorName = normalizeName(d.name);
            return normalizedFileName === normalizedDonorName ||
                   normalizedFileName.includes(normalizedDonorName) ||
                   normalizedDonorName.includes(normalizedFileName);
          });
          if (matchedDonor) matchedBy = 'name';
        }

        r.matchedDonor = matchedDonor || null;
        r.matchedDonorId = matchedDonor?.id || null;
        r.matchedBy = matchedBy;
        // Camp canònic P0: sempre s'omple si hi ha donant
        r.resolvedDonorId = matchedDonor?.id || null;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // MODE CONTEXTUAL: Assignar directament al pare (saltar matching tx)
      // ═══════════════════════════════════════════════════════════════════════

      if (isContextMode && parentTransaction) {
        // Validar que l'import quadra (±2 cèntims)
        const sumReturnsAbsCents = Math.round(results.reduce((sum, r) => sum + r.amount, 0) * 100);
        const parentAbsCents = Math.round(Math.abs(parentTransaction.amount) * 100);
        const deltaCents = Math.abs(sumReturnsAbsCents - parentAbsCents);

        if (deltaCents > 2) {
          const deltaEur = (sumReturnsAbsCents - parentAbsCents) / 100;
          toast({
            variant: 'destructive',
            title: 'Import no quadra',
            description: `El fitxer suma ${(sumReturnsAbsCents / 100).toFixed(2)}€, però l'apunt és ${(parentAbsCents / 100).toFixed(2)}€ (delta: ${deltaEur > 0 ? '+' : ''}${deltaEur.toFixed(2)}€)`,
          });
          setIsProcessing(false);
          return;
        }

        // Crear groupId per mode contextual
        const contextGroupId = `context_${parentTransaction.id}`;

        // Assignar totes les devolucions al pare directament
        for (const r of results) {
          r.matchType = 'grouped'; // Tractarem com agrupades
          r.groupId = contextGroupId;  // P0 FIX: cal groupId per processar!
          r.matchedTransactionId = parentTransaction.id;
          r.matchedTransaction = parentTransaction;
          r.groupedTransactionId = parentTransaction.id;
          r.groupTotalAmount = parentAbsCents / 100;
          r.noMatchReason = null;
          // Status segons si té donant o no (usa camp canònic P0)
          r.status = r.resolvedDonorId ? 'matched' : 'donor_found';
        }

        // Crear un grup únic pel pare
        const contextGroup: GroupedMatch = {
          originalTransaction: parentTransaction,
          returns: results,
          totalAmount: sumReturnsAbsCents / 100,
          date: new Date(parentTransaction.date),
          groupId: contextGroupId,
        };

        setParsedReturns(results);
        setGroupedMatches([contextGroup]);
        setBulkReturnGroups([]);

        setStep('preview');
        setIsProcessing(false);
        return; // Sortir aquí, no cal el matching normal
      }

      // ═══════════════════════════════════════════════════════════════════════
      // FASE 4: DETECTAR AGRUPACIONS (ABANS del matching individual!)
      // Mode BULK: agrupa per liquidationDateISO|liquidationNumber amb ±2 dies
      // Mode NORMAL: agrupa per data amb ±5 dies
      // ═══════════════════════════════════════════════════════════════════════

      const usedTransactionIds = new Set<string>();
      const foundGroups: GroupedMatch[] = [];
      const bulkGroups: BulkReturnGroup[] = [];

      // Detectar mode bulk: totes les columnes NET han d'estar definides
      const isBulkNetFormat = mapping.liquidationDateColumn !== null && mapping.liquidationNumberColumn !== null;

      if (isBulkNetFormat) {
        // ═══════════════════════════════════════════════════════════════════
        // MODE BULK: Agrupar per liquidationDateISO|liquidationNumber
        // ═══════════════════════════════════════════════════════════════════
        const DAY_MS = 24 * 60 * 60 * 1000;
        const BULK_WINDOW_DAYS = 2; // ±2 dies per bulk mode

        // Agrupar per clau de liquidació
        const liquidationGroups = new Map<string, ParsedReturn[]>();
        for (const r of results) {
          if (r.liquidationDateISO && r.liquidationNumber) {
            const key = `${r.liquidationDateISO}|${r.liquidationNumber}`;
            if (!liquidationGroups.has(key)) liquidationGroups.set(key, []);
            liquidationGroups.get(key)!.push(r);
          }
        }

        let bulkGroupCounter = 0;
        for (const [key, returns] of liquidationGroups) {
          const [liquidationDateISO, liquidationNumber] = key.split('|');
          const liquidationDate = new Date(liquidationDateISO);
          const totalAmount = returns.reduce((sum, r) => sum + r.amount, 0);

          // Buscar TOTS els candidats per import (sense filtre de data)
          const allCandidates = (pendingReturns || []).filter(tx => {
            if (usedTransactionIds.has(tx.id)) return false;
            if (tx.amount >= 0) return false; // Ha de ser negatiu

            const txAmount = Math.abs(tx.amount);
            const amountDiff = Math.abs(txAmount - totalAmount);
            return amountDiff <= 0.02;
          });

          // Separar candidats dins i fora de la finestra ±2 dies
          const candidatesInWindow: typeof allCandidates = [];
          const candidatesOutsideWindow: typeof allCandidates = [];

          for (const tx of allCandidates) {
            const txDate = getTxDate(tx);
            const diffMs = Math.abs(txDate.getTime() - liquidationDate.getTime());
            const diffDays = diffMs / DAY_MS;

            if (diffDays <= BULK_WINDOW_DAYS) {
              candidatesInWindow.push(tx);
            } else {
              candidatesOutsideWindow.push(tx);
            }
          }

          // Determinar status i reason
          let status: BulkGroupStatus;
          let reason: BulkGroupReason = null;
          let matchedParent: Transaction | null = null;

          if (candidatesInWindow.length === 1) {
            // Auto-match: 1 candidat dins la finestra
            status = 'auto';
            matchedParent = candidatesInWindow[0];
          } else if (candidatesInWindow.length > 1) {
            // Múltiples candidats dins la finestra
            status = 'needsReview';
            reason = 'multipleCandidates';
          } else if (candidatesOutsideWindow.length > 0) {
            // 0 dins finestra però hi ha fora
            status = 'needsReview';
            reason = 'outsideWindow';
          } else {
            // 0 candidats totals
            status = 'noMatch';
            reason = 'noCandidates';
          }

          bulkGroupCounter++;
          const groupId = `bulk-${bulkGroupCounter}`;

          // Si auto-match, assignar a les devolucions
          if (status === 'auto' && matchedParent) {
            returns.forEach(r => {
              r.matchType = 'grouped';
              r.groupId = groupId;
              r.groupedTransactionId = matchedParent!.id;
              r.groupTotalAmount = Math.abs(matchedParent!.amount);
              r.matchedTransactionId = matchedParent!.id;
              r.matchedTransaction = matchedParent;
              r.status = 'matched';
            });

            foundGroups.push({
              originalTransaction: matchedParent,
              returns,
              totalAmount,
              date: liquidationDate,
              groupId,
            });

            usedTransactionIds.add(matchedParent.id);
          }

          // Guardar el grup bulk per a la UI
          bulkGroups.push({
            key,
            liquidationDateISO,
            liquidationNumber,
            totalAmount,
            rows: returns,
            candidates: allCandidates,
            candidatesInWindow,
            candidatesOutsideWindow,
            status,
            reason,
            selectedParentId: matchedParent?.id || null,
            matchedParent,
          });

        }

      } else {
        // ═══════════════════════════════════════════════════════════════════
        // MODE NORMAL: Agrupar per data amb ±5 dies
        // ═══════════════════════════════════════════════════════════════════

        // Considerar TOTES les devolucions AMB data vàlida (NO exigim donant!)
        const withValidDate = results.filter(r =>
          r.dateConfidence !== 'none' &&
          r.date !== null
        );

        // Agrupar per data (YYYY-MM-DD) - NO agrupar les 'no-date'
        const dateGroups = new Map<string, ParsedReturn[]>();
        for (const r of withValidDate) {
          const dateKey = r.date!.toISOString().split('T')[0];
          if (!dateGroups.has(dateKey)) dateGroups.set(dateKey, []);
          dateGroups.get(dateKey)!.push(r);
        }

        let groupCounter = 0;
        for (const [dateKey, returns] of dateGroups) {
          // Ignorar grups amb <2 devolucions
          if (returns.length < 2) continue;

          const totalAmount = returns.reduce((sum, r) => sum + r.amount, 0);
          const groupDate = returns[0].date!;

          // Buscar transaccions candidates
          const candidates = (pendingReturns || []).filter(tx => {
            if (usedTransactionIds.has(tx.id)) return false;
            if (tx.amount >= 0) return false; // Ha de ser negatiu

            const txAmount = Math.abs(tx.amount);
            const amountDiff = Math.abs(txAmount - totalAmount);
            if (amountDiff > 0.02) return false;

            // Filtre de data: ±5 dies
            const txDate = getTxDate(tx);
            const diffMs = Math.abs(txDate.getTime() - groupDate.getTime());
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            if (diffDays > 5) return false;

            return true;
          });

          if (candidates.length === 1) {
            // Match únic -> assignar
            const matchingTx = candidates[0];
            groupCounter++;
            const groupId = `group-${groupCounter}`;

            returns.forEach(r => {
              r.matchType = 'grouped';
              r.groupId = groupId;
              r.groupedTransactionId = matchingTx.id;
              r.groupTotalAmount = Math.abs(matchingTx.amount);
              r.matchedTransactionId = matchingTx.id;
              r.matchedTransaction = matchingTx;
              r.status = 'matched';
            });

            foundGroups.push({
              originalTransaction: matchingTx,
              returns,
              totalAmount,
              date: groupDate,
              groupId,
            });

            usedTransactionIds.add(matchingTx.id);
          } else if (candidates.length > 1) {
            // Ambigüitat -> no assignar, marcar
            returns.forEach(r => {
              r.noMatchReason = 'ambiguous';
            });
          }
          // Si candidates.length === 0, no fem res (les devolucions queden per matching individual)
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // FASE 5: MATCHING INDIVIDUAL (només per les NO agrupades)
      // ═══════════════════════════════════════════════════════════════════════

      const nonGrouped = results.filter(r =>
        r.matchType !== 'grouped' &&
        r.resolvedDonorId &&  // Camp canònic P0
        r.noMatchReason !== 'ambiguous'
      );

      const DAY_MS = 24 * 60 * 60 * 1000;
      const MAX_DATE_DIFF_DAYS = 20;

      for (const r of nonGrouped) {
        const targetAmount = r.amount;

        // Buscar transaccions candidates
        const candidates = (pendingReturns || []).filter(tx => {
          if (usedTransactionIds.has(tx.id)) return false;

          const txAmount = Math.abs(tx.amount);
          const amountDiff = Math.abs(txAmount - targetAmount);
          if (amountDiff > 0.02) {
            // Log només per les primeres 3 per no saturar
            return false;
          }

          // Filtre de data
          if (r.dateConfidence !== 'none' && r.date) {
            const txDate = getTxDate(tx);
            const diffMs = Math.abs(txDate.getTime() - r.date.getTime());
            const diffDays = diffMs / DAY_MS;
            if (diffDays > MAX_DATE_DIFF_DAYS) {
              return false;
            }
          }
          // Si dateConfidence === 'none', NO apliquem filtre de data

          return true;
        });

        if (candidates.length >= 1) {
          // Si hi ha múltiples candidats, ordenar per proximitat de data (el més proper primer)
          let matchingTx = candidates[0];
          if (candidates.length > 1 && r.date) {
            const returnDate = r.date.getTime();
            candidates.sort((a, b) => {
              const diffA = Math.abs(getTxDate(a).getTime() - returnDate);
              const diffB = Math.abs(getTxDate(b).getTime() - returnDate);
              return diffA - diffB; // El més proper primer
            });
            matchingTx = candidates[0];
          }

          r.matchType = 'individual';
          r.matchedTransactionId = matchingTx.id;
          r.matchedTransaction = matchingTx;
          r.status = 'matched';
          usedTransactionIds.add(matchingTx.id);
        } else {
          // Cap candidat
          r.matchType = 'none';
          r.noMatchReason = r.dateConfidence === 'none' ? 'no-date' : 'no-match';
          r.status = 'donor_found';
        }
      }

      // Actualitzar status per les que no tenen donant (usa camp canònic P0)
      results.forEach(r => {
        if (!r.resolvedDonorId) {
          r.status = 'not_found';
        }
      });

      // ═══════════════════════════════════════════════════════════════════════
      // FASE 6: GUARDAR RESULTATS + STATS
      // ═══════════════════════════════════════════════════════════════════════

      setParsedReturns(results);
      setGroupedMatches(foundGroups);
      setBulkReturnGroups(bulkGroups);

      setStep('preview');

    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsProcessing(false);
    }
  }, [allRows, startRow, mapping, donors, pendingReturns, files, toast, isContextMode, parentTransaction]);

  // ═══════════════════════════════════════════════════════════════════════════
  // PROCESSAR DEVOLUCIONS (escriptura a Firestore)
  // ═══════════════════════════════════════════════════════════════════════════

  interface ProcessReturnsOptions {
    forceRecreateChildren?: boolean;
  }

  const processReturns = React.useCallback(async (options: ProcessReturnsOptions = {}) => {
    const { forceRecreateChildren = false } = options;
    if (!organizationId) return;

    // P0: Mapa donorsById per obtenir nom/taxId sense queries
    const donorsById = new Map(donors.map(d => [d.id, d]));

    // Helper P0: usa camp canònic resolvedDonorId
    const hasDonor = (r: ParsedReturn) => !!r.resolvedDonorId;

    // Separar individuals i agrupades
    // INDIVIDUAL = té donant + té transacció + NO és grouped
    const individualReturns = parsedReturns.filter(r => {
      const isIndividual = hasDonor(r) && r.matchedTransactionId && r.matchType !== 'grouped';
      return isIndividual;
    });

    // GROUPED = matchType === 'grouped' + té donant (resolvedDonorId)
    const groupedReturnsToProcess = parsedReturns.filter(r => {
      const isGrouped = r.matchType === 'grouped' && hasDonor(r);
      return isGrouped;
    });

    // Comptar quantes no tenen donant (per feedback)
    const withoutDonor = parsedReturns.filter(r => !hasDonor(r));

    if (individualReturns.length === 0 && groupedReturnsToProcess.length === 0) {
      // Missatge explicatiu segons el cas
      if (withoutDonor.length > 0) {
        toast({
          variant: 'destructive',
          title: 'No s\'han pogut assignar',
          description: `${withoutDonor.length} devolucions no tenen donant identificat. Cal assignar donant manualment.`
        });
      } else {
        toast({ variant: 'destructive', title: 'Res a processar', description: 'No hi ha devolucions per assignar' });
      }
      return;
    }

    setStep('processing');
    setIsProcessing(true);

    // Track locks to release in finally (declarat fora del try per accedir-hi al finally)
    const acquiredLocks: string[] = [];

    try {
      let processedIndividual = 0;
      let processedGrouped = 0;

      // 1. Processar devolucions individuals
      // Una devolució és "individual resoluble" si:
      // - matchType !== 'grouped'
      // - matchedTransactionId existeix (tx.id del banc)
      // - matchedDonorId existeix
      for (const returnItem of individualReturns) {
        // Només processar si tenim donant I transacció
        if (!returnItem.matchedDonor || !returnItem.matchedTransactionId) {
          continue;
        }

        const inferredAmount = returnItem.matchedTransaction?.amount ?? -Math.abs(returnItem.amount);
        const inferredSource = returnItem.matchedTransaction?.source ?? 'bank';

        // Guardrail fiscal P0 abans d'escriure return sobre el moviment original.
        assertFiscalTxCanBeSaved(
          {
            transactionType: 'return',
            amount: inferredAmount,
            contactId: returnItem.matchedDonor.id,
            source: inferredSource,
          },
          {
            firestore,
            orgId: organizationId,
            operation: 'createReturn',
            route: '/return-importer',
          }
        );

        // ACTUALITZAR LA TRANSACCIÓ DEL BANC amb contactId i transactionType
        const txRef = doc(firestore, 'organizations', organizationId, 'transactions', returnItem.matchedTransactionId);
        await updateDoc(txRef, {
          transactionType: 'return',
          contactId: returnItem.matchedDonor.id,
          contactType: 'donor',
        });

        // Actualitzar donant
        const donorRef = doc(firestore, 'organizations', organizationId, 'contacts', returnItem.matchedDonor.id);
        await updateDoc(donorRef, {
          returnCount: increment(1),
          lastReturnDate: returnItem.date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
          status: 'pending_return',
        });

        processedIndividual++;
      }

      // 2. Processar devolucions agrupades (patró remeses: pare + filles)
      const processedGroupIds = new Set<string>();

      for (const returnItem of groupedReturnsToProcess) {
        if (!returnItem.groupId || processedGroupIds.has(returnItem.groupId)) continue;
        processedGroupIds.add(returnItem.groupId);

        const group = groupedMatches.find(g => g.groupId === returnItem.groupId);
        if (!group) continue;

        const parentId = group.originalTransaction.id;

        // ═══════════════════════════════════════════════════════════════════
        // LOCK: Adquirir lock per evitar doble processament concurrent
        // ═══════════════════════════════════════════════════════════════════
        if (userId) {
          const lockResult = await acquireProcessLock({
            firestore,
            orgId: organizationId,
            parentTxId: parentId,
            operation: 'returnImport',
            uid: userId,
          });

          if (!lockResult.ok) {
            toast({
              variant: 'destructive',
              title: 'Operació bloquejada',
              description: getLockFailureMessage(lockResult),
            });
            continue; // Skip this group, try next
          }

          acquiredLocks.push(parentId);
        }

        // ═══════════════════════════════════════════════════════════════════
        // CARREGAR FILLS EXISTENTS
        // ═══════════════════════════════════════════════════════════════════
        const existingChildrenQuery = query(
          collection(firestore, 'organizations', organizationId, 'transactions'),
          where('parentTransactionId', '==', parentId)
        );
        const existingChildrenSnap = await getDocs(existingChildrenQuery);
        const existingActiveChildrenDocs = existingChildrenSnap.docs.filter((childDoc) =>
          isActiveRemittanceChild(childDoc.data())
        );
        const existingChildrenCount = existingActiveChildrenDocs.length;

        // ═══════════════════════════════════════════════════════════════════
        // MODE FORCE RECREATE: Eliminar TOTS els fills i crear des de zero
        // Aquest és el mode determinista per migracions - garanteix consistència
        // ═══════════════════════════════════════════════════════════════════
        if (forceRecreateChildren) {
          // 1. ELIMINAR tots els fills existents (devolucions)
          let deletedChildrenCount = 0;
          if (existingChildrenCount > 0) {
            for (const childDoc of existingActiveChildrenDocs) {
              await deleteDoc(doc(firestore, 'organizations', organizationId, 'transactions', childDoc.id));
              deletedChildrenCount++;
            }
          }
          // 2. CREAR TOTES les filles des de les devolucions parsejades
          const allReturnsInGroup = group.returns;
          // P0: usar resolvedDonorId com a criteri canònic
          const resolubles = allReturnsInGroup.filter(r => r.resolvedDonorId);
          const pendents = allReturnsInGroup.filter(r => !r.resolvedDonorId);

          // Crear filles per TOTES les devolucions (resolubles i pendents)
          let createdChildrenCount = 0;
          for (const ret of allReturnsInGroup) {
            // P0: usar camp canònic resolvedDonorId + mapa donorsById
            const hasContact = !!ret.resolvedDonorId;
            const donorId = ret.resolvedDonorId;
            const donor = hasContact ? donorsById.get(donorId!) : null;
            const donorName = donor?.name ?? 'Donant';

            const childTxData: Record<string, unknown> = {
              source: 'remittance',
              parentTransactionId: parentId,
              isRemittanceItem: true,
              amount: -Math.abs(ret.amount),  // Import SEMPRE negatiu (devolució)
              date: ret.date?.toISOString().split('T')[0] || group.date.toISOString().split('T')[0],
              transactionType: 'return',
              description: ret.returnReason || group.originalTransaction.description || 'Devolució',
              createdAt: new Date().toISOString(),
              // Heretar bankAccountId del pare
              bankAccountId: group.originalTransaction.bankAccountId ?? null,
            };

            // Si té donant assignat: contactId + contactType + contactName + legacy emisor*
            if (hasContact && donorId) {
              childTxData.contactId = donorId;
              childTxData.contactType = 'donor';
              childTxData.contactName = donorName;
              // Compat legacy (pantalles que llegeixen emisor*)
              childTxData.emisorId = donorId;
              childTxData.emisorName = donorName;
            } else {
              childTxData.contactId = null;
              childTxData.contactType = null;
              childTxData.contactName = null;
              childTxData.emisorId = null;
              childTxData.emisorName = null;
            }

            // P0: Validar invariants fiscals abans d'escriure
            assertFiscalTxCanBeSaved(
              {
                transactionType: childTxData.transactionType as 'return',
                amount: childTxData.amount as number,
                contactId: childTxData.contactId as string | null | undefined,
                source: childTxData.source as 'remittance',
              },
              {
                firestore,
                orgId: organizationId,
                operation: 'createReturn',
                route: '/return-importer',
              }
            );

            const newChildRef = await addDoc(
              collection(firestore, 'organizations', organizationId, 'transactions'),
              childTxData
            );
            createdChildrenCount++;

            // Actualitzar donant si té contactId (P0: usar resolvedDonorId)
            if (hasContact) {
              const donorRef = doc(firestore, 'organizations', organizationId, 'contacts', ret.resolvedDonorId!);
              await updateDoc(donorRef, {
                returnCount: increment(1),
                lastReturnDate: ret.date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
                status: 'pending_return',
              });
              processedGrouped++;
            }
          }

          // 3. ACTUALITZAR EL PARE amb comptadors correctes
          const itemCount = allReturnsInGroup.length;
          const resolvedCount = resolubles.length;
          const pendingCount = pendents.length;
          const pendingTotalAmount = pendents.reduce((sum, r) => sum + r.amount, 0);

          let remittanceStatus: 'complete' | 'partial' | 'pending';
          if (pendingCount === 0) {
            remittanceStatus = 'complete';
          } else if (resolvedCount === 0) {
            remittanceStatus = 'pending';
          } else {
            remittanceStatus = 'partial';
          }

          const pendingReturnsData = pendingCount > 0 ? pendents.map(r => {
            const item: {
              iban: string;
              amount: number;
              date: string;
              originalName?: string;
              returnReason?: string;
            } = {
              iban: r.iban,
              amount: r.amount,
              date: r.date?.toISOString().split('T')[0] || '',
            };
            if (r.originalName) item.originalName = r.originalName;
            if (r.returnReason) item.returnReason = r.returnReason;
            return item;
          }) : null;

          const parentUpdateData = {
            isRemittance: true,
            remittanceType: 'returns' as const,
            remittanceItemCount: itemCount,
            remittanceResolvedCount: resolvedCount,
            remittancePendingCount: pendingCount,
            remittancePendingTotalAmount: pendingTotalAmount,
            remittanceStatus,
            pendingReturns: pendingReturnsData,
          };

          const parentTxRef = doc(firestore, 'organizations', organizationId, 'transactions', parentId);
          await updateDoc(parentTxRef, parentUpdateData);

          continue; // Passar al següent grup, saltar la lògica normal
        }

        // ═══════════════════════════════════════════════════════════════════
        // MODE NORMAL (sense forceRecreate): idempotència tradicional
        // ═══════════════════════════════════════════════════════════════════

        // Si ja hi ha fills, només actualitzem el pare (no creem més fills)
        const skipChildCreation = existingChildrenCount > 0;

        // SEPARAR: resolubles (amb donant) vs pendents (sense donant) - P0: usar resolvedDonorId
        const resolubles = group.returns.filter(r => r.resolvedDonorId);
        const pendents = group.returns.filter(r => !r.resolvedDonorId);

        // Variables per l'estat del pare
        let remittanceStatus: 'complete' | 'partial' | 'pending';
        let itemCount: number;
        let resolvedCount: number;
        let pendingCount: number;
        let pendingTotalAmount: number;
        let pendingReturnsData: Array<{
          iban: string;
          amount: number;
          date: string;
          originalName?: string;
          returnReason?: string;
        }> | null;

        if (skipChildCreation) {
          // Ja hi ha fills - recalcular estat des de Firestore
          const existingChildren = existingActiveChildrenDocs.map(d => d.data());
          resolvedCount = existingChildren.filter(c => c.contactId).length;
          itemCount = group.originalTransaction.remittanceItemCount ?? existingChildrenCount;
          pendingCount = Math.max(0, itemCount - resolvedCount);

          if (pendingCount === 0 && itemCount > 0) {
            remittanceStatus = 'complete';
            pendingReturnsData = null;
            pendingTotalAmount = 0;
          } else if (resolvedCount === 0) {
            remittanceStatus = 'pending';
            pendingReturnsData = group.originalTransaction.pendingReturns ?? null;
            pendingTotalAmount = pendingReturnsData?.reduce((sum, r) => sum + r.amount, 0) ?? 0;
          } else {
            remittanceStatus = 'partial';
            const stillPending = existingChildren.filter(c => !c.contactId);
            pendingReturnsData = stillPending.length > 0 ? stillPending.map(c => ({
              iban: '',
              amount: Math.abs(c.amount || 0),
              date: c.date || '',
            })) : null;
            pendingTotalAmount = stillPending.reduce((sum, c) => sum + Math.abs(c.amount || 0), 0);
          }
        } else {
          // ═══════════════════════════════════════════════════════════════════
          // CALCULAR ESTAT DES DE DADES PARSEJADES (primer processament)
          // ═══════════════════════════════════════════════════════════════════

          itemCount = group.returns.length;
          resolvedCount = resolubles.length;
          pendingCount = pendents.length;
          pendingTotalAmount = pendents.reduce((sum, r) => sum + r.amount, 0);

          // Calcular remittanceStatus
          if (pendingCount === 0) {
            remittanceStatus = 'complete';
          } else if (resolvedCount === 0) {
            remittanceStatus = 'pending';
          } else {
            remittanceStatus = 'partial';
          }

          // Preparar pendingReturns (dades per assistència posterior)
          pendingReturnsData = pendingCount > 0 ? pendents.map(r => {
            const item: {
              iban: string;
              amount: number;
              date: string;
              originalName?: string;
              returnReason?: string;
            } = {
              iban: r.iban,
              amount: r.amount,
              date: r.date?.toISOString().split('T')[0] || '',
            };
            if (r.originalName) item.originalName = r.originalName;
            if (r.returnReason) item.returnReason = r.returnReason;
            return item;
          }) : null;
        }

        // MARCAR EL PARE com a remesa (NO esborrar! NO tocar amount/date/description/contactId)
        const parentTxRef = doc(firestore, 'organizations', organizationId, 'transactions', group.originalTransaction.id);

        // Construir payload sense undefined (Firestore no accepta undefined)
        const parentUpdateData = {
          isRemittance: true,
          remittanceType: 'returns' as const,
          remittanceItemCount: itemCount,
          remittanceResolvedCount: resolvedCount,
          remittancePendingCount: pendingCount,
          remittancePendingTotalAmount: pendingTotalAmount,
          remittanceStatus,
          pendingReturns: pendingReturnsData,
        };

        await updateDoc(parentTxRef, parentUpdateData);

        // Crear transaccions FILLES NOMÉS per resolubles (amb donant)
        // SKIP si ja existeixen fills (idempotency)
        if (!skipChildCreation) {
          for (const ret of resolubles) {
            // P0: usar camp canònic resolvedDonorId + mapa donorsById
            const donorId = ret.resolvedDonorId!;
            const donor = donorsById.get(donorId);
            const donorName = donor?.name ?? 'Donant';
            const childTxData = {
              // Camps de la filla
              source: 'remittance',
              parentTransactionId: group.originalTransaction.id,
              isRemittanceItem: true,
              amount: -Math.abs(ret.amount),  // Import SEMPRE negatiu (devolució)
              date: ret.date?.toISOString().split('T')[0] || group.date.toISOString().split('T')[0],
              transactionType: 'return',
              description: ret.returnReason || group.originalTransaction.description || 'Devolució',
              // Donant assignat: contactId + contactType + contactName + legacy
              contactId: donorId,
              contactType: 'donor',
              contactName: donorName,
              // Compat legacy (pantalles que llegeixen emisor*)
              emisorId: donorId,
              emisorName: donorName,
              // Heretar bankAccountId del pare
              bankAccountId: group.originalTransaction.bankAccountId ?? null,
            };

            // P0: Validar invariants fiscals abans d'escriure
            assertFiscalTxCanBeSaved(
              {
                transactionType: childTxData.transactionType as 'return',
                amount: childTxData.amount,
                contactId: childTxData.contactId,
                source: childTxData.source as 'remittance',
              },
              {
                firestore,
                orgId: organizationId,
                operation: 'createReturn',
                route: '/return-importer',
              }
            );

            await addDoc(
              collection(firestore, 'organizations', organizationId, 'transactions'),
              childTxData
            );

            // Actualitzar donant (P0: usar resolvedDonorId)
            const donorRef = doc(firestore, 'organizations', organizationId, 'contacts', ret.resolvedDonorId!);
            await updateDoc(donorRef, {
              returnCount: increment(1),
              lastReturnDate: ret.date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
              status: 'pending_return',
            });

            processedGrouped++;
          }
        }

        // Log de l'estat de la remesa
      }

      toast({
        title: 'Devolucions assignades',
        description: `S'han assignat ${processedIndividual + processedGrouped} devolucions correctament`
      });

      reset();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      setStep('preview');
    } finally {
      // Alliberar tots els locks adquirits
      if (userId) {
        for (const parentId of acquiredLocks) {
          await releaseProcessLock({ firestore, orgId: organizationId, parentTxId: parentId });
        }
      }
      setIsProcessing(false);
    }
  }, [organizationId, parsedReturns, groupedMatches, firestore, userId, toast, reset]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CREAR DONANT PER A DEVOLUCIÓ PENDENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Crea un nou donant i l'assigna a una devolució pendent.
   * - Dedupe per taxId: si ja existeix, assigna l'existent sense crear.
   * - IBAN opcional (pot ser buit).
   * - matchedBy: 'manual' per indicar creació manual.
   */
  const handleCreateDonorForReturn = React.useCallback(async (
    returnIndex: number,
    donorData: {
      name: string;
      taxId: string;
      zipCode?: string;
      iban?: string;
    }
  ): Promise<{ success: boolean; donorId?: string; error?: string }> => {
    if (!organizationId || !firestore) {
      return { success: false, error: 'No organization context' };
    }

    try {
      const normalizedTaxId = normalizeLibTaxId(donorData.taxId);
      const normalizedIban = donorData.iban ? normalizeIBAN(donorData.iban) : '';

      // 1. Dedupe: buscar si ja existeix un donant amb aquest taxId
      const existingDonor = donors?.find(d =>
        normalizeLibTaxId(d.taxId || '') === normalizedTaxId
      );

      let finalDonor: Donor;

      if (existingDonor) {
        // Ja existeix → usar-lo directament
        finalDonor = existingDonor;
      } else {
        // 2. Crear nou donant a Firestore
        const now = new Date().toISOString();
        const contactsRef = collection(firestore, `organizations/${organizationId}/contacts`);
        const newDonorDoc = await addDoc(contactsRef, {
          type: 'donor',
          name: donorData.name.trim(),
          taxId: normalizedTaxId,
          zipCode: donorData.zipCode?.trim() || '',
          ...(normalizedIban ? { iban: normalizedIban } : {}),
          donorType: 'individual',
          membershipType: 'one-time',
          status: 'inactive',
          createdAt: now,
          updatedAt: now,
        });

        finalDonor = {
          id: newDonorDoc.id,
          type: 'donor',
          name: donorData.name.trim(),
          taxId: normalizedTaxId,
          zipCode: donorData.zipCode?.trim() || '',
          iban: normalizedIban || undefined,
          donorType: 'individual',
          membershipType: 'one-time',
          status: 'inactive',
          createdAt: now,
          updatedAt: now,
        };
      }

      // 3. Actualitzar l'estat local: assignar el donant a la devolució
      setParsedReturns(prev => prev.map((item, idx) => {
        if (idx === returnIndex) {
          return {
            ...item,
            matchedDonor: finalDonor,
            matchedDonorId: finalDonor.id,
            resolvedDonorId: finalDonor.id,  // Camp canònic P0
            matchedBy: 'manual' as const,
            status: 'matched' as const,
          };
        }
        return item;
      }));

      return { success: true, donorId: finalDonor.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, [organizationId, firestore, donors]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const previewRows = React.useMemo(() => {
    return allRows.slice(startRow, startRow + 8);
  }, [allRows, startRow]);

  const numColumns = React.useMemo(() => {
    return Math.max(...allRows.map(r => r.length), 0);
  }, [allRows]);

  return {
    // Estat
    step,
    setStep,
    isProcessing,

    // Mode contextual
    isContextMode,
    parentTransaction,

    // Fitxers
    files,
    allRows,
    startRow,
    setStartRow,
    previewRows,
    numColumns,

    // Mapejat
    mapping,
    setMapping,

    // Resultats
    parsedReturns,
    groupedMatches,
    bulkReturnGroups,
    stats,

    // Accions
    parseFiles,
    performMatching,
    processReturns,
    reset,
    handleCreateDonorForReturn,
  };
}
