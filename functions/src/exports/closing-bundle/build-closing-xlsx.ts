/**
 * Generació dels fitxers Excel per al Paquet de Tancament
 * - moviments.xlsx: Simplificat per a l'entitat (sense IDs ni status)
 * - debug.xlsx: Diagnòstics tècnics complets
 */

import * as XLSX from 'xlsx';
import {
  ClosingManifestRow,
  ClosingIncidentRow,
  DocumentDiagnosticStatus,
} from './closing-types';

/**
 * Fila de debug amb informació completa de diagnòstic.
 */
export interface DebugRow {
  txId: string;
  rawDocumentValue: string | null;
  extractedPath: string | null;
  bucketConfigured: string | null;
  bucketInUrl: string | null;
  status: DocumentDiagnosticStatus;
  kind: string | null;
  // Camps d'error per a DOWNLOAD_ERROR
  errorCode: string | null;
  errorMessage: string | null;
  errorAt: string | null;
}

/**
 * Formata una data a DD/MM/YYYY.
 * Accepta:
 * - YYYY-MM-DD (format esperat)
 * - YYYY-MM-DDTHH:mm:ss... (ISO complet)
 * - Timestamp de Firestore (objecte amb seconds/nanoseconds)
 */
function formatDateEU(isoDate: string | unknown): string {
  if (!isoDate) return '';

  // Si és un objecte Timestamp de Firestore
  if (typeof isoDate === 'object' && isoDate !== null) {
    const ts = isoDate as { seconds?: number; toDate?: () => Date };
    if (typeof ts.toDate === 'function') {
      const d = ts.toDate();
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    if (typeof ts.seconds === 'number') {
      const d = new Date(ts.seconds * 1000);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  }

  if (typeof isoDate !== 'string') return '';

  // Extreure només la part YYYY-MM-DD (abans de T si existeix)
  const dateOnly = isoDate.split('T')[0];

  if (!dateOnly || dateOnly.length < 10) return isoDate;

  const parts = dateOnly.split('-');
  if (parts.length !== 3) return isoDate;

  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

/**
 * Formata un import amb format europeu (coma decimal, sense símbol).
 */
function formatAmountEU(amount: number): string {
  return amount.toFixed(2).replace('.', ',');
}

/**
 * Genera el buffer de moviments.xlsx (simplificat per a l'entitat).
 * Columnes: Ordre, Data (DD/MM/YYYY), Import (format EU), Concepte, Categoria, Contacte, Document
 * Sense IDs, sense status tècnics.
 */
export function buildMovimentsXlsx(rows: ClosingManifestRow[]): Buffer {
  const data = rows.map((row) => ({
    Ordre: row.ordre,
    Data: formatDateEU(row.data),
    Import: formatAmountEU(row.import),
    Concepte: row.concepte,
    Categoria: row.categoria || '',
    Contacte: row.contacte || '',
    Document: row.nomDocument || '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);

  // Ajustar amplades de columna
  ws['!cols'] = [
    { wch: 6 },   // Ordre
    { wch: 12 },  // Data
    { wch: 12 },  // Import
    { wch: 50 },  // Concepte
    { wch: 25 },  // Categoria
    { wch: 25 },  // Contacte
    { wch: 50 },  // Document
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Moviments');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Genera el buffer de debug.xlsx (diagnòstics tècnics).
 * Només per a la carpeta debug/.
 */
export function buildDebugXlsx(debugRows: DebugRow[]): Buffer {
  const data = debugRows.map((row) => ({
    txId: row.txId,
    rawDocumentValue: row.rawDocumentValue || '—',
    extractedPath: row.extractedPath || '—',
    bucketConfigured: row.bucketConfigured || '—',
    bucketInUrl: row.bucketInUrl || '—',
    status: row.status,
    kind: row.kind || '—',
    errorCode: row.errorCode || '—',
    errorMessage: row.errorMessage || '—',
    errorAt: row.errorAt || '—',
  }));

  const ws = XLSX.utils.json_to_sheet(data);

  ws['!cols'] = [
    { wch: 24 },  // txId
    { wch: 80 },  // rawDocumentValue
    { wch: 60 },  // extractedPath
    { wch: 30 },  // bucketConfigured
    { wch: 30 },  // bucketInUrl
    { wch: 18 },  // status
    { wch: 10 },  // kind
    { wch: 15 },  // errorCode
    { wch: 50 },  // errorMessage
    { wch: 20 },  // errorAt
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Debug');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Genera el buffer de incidencies.xlsx (visible per a l'entitat).
 * Una fila per incidència, incloent el context del moviment.
 */
export function buildIncidenciesXlsx(rows: ClosingIncidentRow[]): Buffer {
  const data = rows.map((row) => ({
    Ordre: row.ordre,
    Data: formatDateEU(row.data),
    Import: formatAmountEU(row.import),
    Concepte: row.concepte,
    Categoria: row.categoria || '',
    Contacte: row.contacte || '',
    Tipus: row.tipus,
    Severitat: row.severitat,
    Missatge: row.missatge,
    txId: row.txId,
    documentStatus: row.documentStatus || '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);

  ws['!cols'] = [
    { wch: 6 },   // Ordre
    { wch: 12 },  // Data
    { wch: 12 },  // Import
    { wch: 50 },  // Concepte
    { wch: 25 },  // Categoria
    { wch: 25 },  // Contacte
    { wch: 24 },  // Tipus
    { wch: 12 },  // Severitat
    { wch: 50 },  // Missatge
    { wch: 28 },  // txId
    { wch: 20 },  // documentStatus
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Incidencies');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * @deprecated Usar buildMovimentsXlsx i buildDebugXlsx per separat
 */
export function buildManifestXlsx(
  rows: ClosingManifestRow[],
  _debugRows?: DebugRow[]
): Buffer {
  // Mantenim per compatibilitat, però ara genera el format simplificat
  return buildMovimentsXlsx(rows);
}
