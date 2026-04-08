/**
 * Tipus per al Paquet de Tancament (Closing Bundle)
 */

export interface ClosingBundleRequest {
  orgId: string;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
  mode?: ClosingBundleMode;
}

export type ClosingBundleMode = 'user' | 'full';

export type IncidentType =
  | 'FALTA_DOCUMENT'
  | 'SENSE_CATEGORIA'
  | 'SENSE_CONTACTE'
  | 'DEVOLUCIO_PENDENT'
  | 'REMESA_PARCIAL'
  | 'DOCUMENT_NO_RESOLUBLE';

export type IncidentSeverity = 'alta' | 'mitjana' | 'baixa';

/** @deprecated Usar DocumentDiagnosticStatus per a Debug */
export type DocumentStatus = 'OK' | 'FALTA' | 'FALLA_DESCARREGA';

/**
 * Estat de diagnòstic per a la pestanya Debug del manifest.
 * NO usar a la pestanya d'usuari.
 */
export type DocumentDiagnosticStatus =
  | 'OK'               // Descarregat correctament
  | 'NO_DOCUMENT'      // Transacció sense document referenciat
  | 'URL_NOT_PARSEABLE' // No s'ha pogut extreure path
  | 'BUCKET_MISMATCH'  // Bucket de la URL != bucket configurat
  | 'NOT_FOUND'        // Path vàlid però fitxer no existeix
  | 'DOWNLOAD_ERROR';  // Error de xarxa/timeout

/**
 * Diagnòstic complet d'un document per a Debug.
 */
export interface DocumentDiagnostic {
  txId: string;
  rawDocumentValue: string | null;
  extractedPath: string | null;
  bucketConfigured: string | null;
  bucketInUrl: string | null;
  status: DocumentDiagnosticStatus;
  kind?: string | null;
  // Camps d'error (només per a DOWNLOAD_ERROR o NOT_FOUND)
  errorCode?: string | null;
  errorMessage?: string | null;
  errorAt?: string | null;
}

export interface ClosingTransaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: string | null;
  categoryName: string | null;
  contactId: string | null;
  contactName: string | null;
  document: string | null; // URL de Firebase Storage
  transactionType: string | null;
  isRemittance: boolean;
  remittanceStatus: string | null;
  // Camps per filtre ledger-only
  source: string | null;
  parentTransactionId: string | null;
  isRemittanceItem: boolean;
}

export interface ClosingManifestRow {
  ordre: number;
  data: string;
  import: number;
  moneda: string;
  concepte: string;
  categoria: string;
  contacte: string;
  txId: string;
  teDocument: boolean;       // Té document referenciat?
  nomDocument: string;       // Nom del fitxer al ZIP (buit si no inclòs)
}

export interface ClosingIncident {
  txId: string;
  type: IncidentType;
  severity: IncidentSeverity;
  message: string;
}

export interface ClosingIncidentRow {
  ordre: number;
  data: string;
  import: number;
  concepte: string;
  categoria: string;
  contacte: string;
  tipus: IncidentType;
  severitat: IncidentSeverity;
  missatge: string;
  txId: string;
  documentStatus: DocumentDiagnosticStatus | '';
}

export interface ClosingDocumentInfo {
  txId: string;
  ordre: number;
  storagePath: string;
  fileName: string;
  contentType: string | null;
  size: number | null;
}

export interface ClosingBundleStats {
  totalTransactions: number;
  totalWithDocument: number;
  totalDownloaded: number;
  totalFailed: number;
  totalIncidents: number;
  totalIncome: number;
  totalExpense: number;
}

export interface DocumentStatusCounts {
  ok: number;
  noDocument: number;
  urlNotParseable: number;
  bucketMismatch: number;
  notFound: number;
  downloadError: number;
}

export interface ClosingBundleManifest {
  version: number;
  runId: string;
  generatedAt: string;
  orgSlug: string;
  dateFrom: string;
  dateTo: string;
  totalTransactions: number;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  totalWithDocRef: number;
  totalIncluded: number;
  totalIncidents: number;
  statusCounts: DocumentStatusCounts;
  limits: {
    maxDocuments: number;
    maxTotalSizeMb: number;
  };
}

export interface ClosingBundleError {
  code: 'UNAUTHENTICATED' | 'UNAUTHORIZED' | 'INVALID_REQUEST' | 'LIMIT_EXCEEDED' | 'NO_TRANSACTIONS' | 'INTERNAL_ERROR';
  message: string;
}

export const MAX_DOCUMENTS = 120;
export const MAX_TOTAL_SIZE_MB = 350;
