import {
  ClosingBundleManifest,
  ClosingBundleMode,
  ClosingIncident,
  ClosingIncidentRow,
  ClosingManifestRow,
  DocumentDiagnostic,
  DocumentDiagnosticStatus,
  DocumentStatusCounts,
  MAX_DOCUMENTS,
  MAX_TOTAL_SIZE_MB,
} from './closing-types';
import {
  buildDebugXlsx,
  buildIncidenciesXlsx,
  buildMovimentsXlsx,
  DebugRow,
} from './build-closing-xlsx';

export type { DebugRow } from './build-closing-xlsx';

export interface ClosingBundleEntry {
  name: string;
  content: string | Buffer;
}

export function buildDocumentResolutionIncident(
  diagnostic: DocumentDiagnostic
): ClosingIncident | null {
  switch (diagnostic.status) {
    case 'URL_NOT_PARSEABLE':
      return {
        txId: diagnostic.txId,
        type: 'DOCUMENT_NO_RESOLUBLE',
        severity: 'alta',
        message: 'Document no resoluble: URL o referència no reconeguda',
      };
    case 'BUCKET_MISMATCH':
      return {
        txId: diagnostic.txId,
        type: 'DOCUMENT_NO_RESOLUBLE',
        severity: 'alta',
        message: 'Document no resoluble: bucket diferent del configurat',
      };
    case 'NOT_FOUND':
      return {
        txId: diagnostic.txId,
        type: 'DOCUMENT_NO_RESOLUBLE',
        severity: 'alta',
        message: 'Document no resoluble: fitxer no trobat al bucket',
      };
    case 'DOWNLOAD_ERROR':
      return {
        txId: diagnostic.txId,
        type: 'DOCUMENT_NO_RESOLUBLE',
        severity: 'alta',
        message: 'Document no resoluble: error descarregant el fitxer',
      };
    default:
      return null;
  }
}

export function buildVisibleIncidents(
  transactions: Array<{ id: string }>,
  incidents: ClosingIncident[],
  diagnostics: Map<string, DocumentDiagnostic>
): ClosingIncident[] {
  const visibleIncidents = [...incidents];

  for (const tx of transactions) {
    const diagnostic = diagnostics.get(tx.id);
    if (!diagnostic) continue;

    const incident = buildDocumentResolutionIncident(diagnostic);
    if (incident) {
      visibleIncidents.push(incident);
    }
  }

  return visibleIncidents;
}

export function getDocumentStatusForIncident(
  incident: ClosingIncident,
  diagnostics: Map<string, DocumentDiagnostic>
): DocumentDiagnosticStatus | '' {
  if (incident.type !== 'DOCUMENT_NO_RESOLUBLE') return '';
  const diagnostic = diagnostics.get(incident.txId);
  if (!diagnostic) return '';
  if (diagnostic.status === 'NO_DOCUMENT' || diagnostic.status === 'OK') return '';
  return diagnostic.status;
}

export function buildIncidentRows(
  incidents: ClosingIncident[],
  manifestRowsByTxId: Map<string, {
    ordre: number;
    data: string;
    import: number;
    concepte: string;
    categoria: string;
    contacte: string;
  }>,
  diagnostics: Map<string, DocumentDiagnostic>
): ClosingIncidentRow[] {
  return incidents.map((incident) => {
    const manifestRow = manifestRowsByTxId.get(incident.txId);

    return {
      ordre: manifestRow?.ordre ?? 0,
      data: manifestRow?.data ?? '',
      import: manifestRow?.import ?? 0,
      concepte: manifestRow?.concepte ?? '',
      categoria: manifestRow?.categoria ?? '',
      contacte: manifestRow?.contacte ?? '',
      tipus: incident.type,
      severitat: incident.severity,
      missatge: incident.message,
      txId: incident.txId,
      documentStatus: getDocumentStatusForIncident(incident, diagnostics),
    };
  });
}

export function buildClosingBundleManifest(params: {
  runId: string;
  generatedAt: string;
  orgSlug: string;
  dateFrom: string;
  dateTo: string;
  totalTransactions: number;
  totalIncome: number;
  totalExpense: number;
  totalWithDocRef: number;
  totalIncluded: number;
  totalIncidents: number;
  statusCounts: DocumentStatusCounts;
}): ClosingBundleManifest {
  const {
    runId,
    generatedAt,
    orgSlug,
    dateFrom,
    dateTo,
    totalTransactions,
    totalIncome,
    totalExpense,
    totalWithDocRef,
    totalIncluded,
    totalIncidents,
    statusCounts,
  } = params;

  return {
    version: 1,
    runId,
    generatedAt,
    orgSlug,
    dateFrom,
    dateTo,
    totalTransactions,
    totalIncome,
    totalExpense,
    balance: totalIncome + totalExpense,
    totalWithDocRef,
    totalIncluded,
    totalIncidents,
    statusCounts,
    limits: {
      maxDocuments: MAX_DOCUMENTS,
      maxTotalSizeMb: MAX_TOTAL_SIZE_MB,
    },
  };
}

export function buildReadmeText(
  orgSlug: string,
  dateFrom: string,
  dateTo: string
): string {
  return `PAQUET DE TANCAMENT - SUMMA SOCIAL
=====================================

Organització: ${orgSlug}
Període: ${dateFrom} a ${dateTo}

CONTINGUT DEL PAQUET
--------------------

📄 moviments.xlsx
   Llistat de tots els moviments del període amb:
   Ordre, Data, Import, Concepte, Categoria, Contacte, Document

📄 resum.txt
   Resum econòmic: totals d'ingressos, despeses i saldo

📁 documents/
   Fitxers adjunts vinculats als moviments
   Format del nom: ORDRE_DATA_IMPORT_CONCEPTE_TXID.ext

📁 debug/
   Informació tècnica per a diagnòstic (només si cal revisar problemes)

NOTA
----
La columna "Ordre" de moviments.xlsx correspon al prefix numèric
del nom dels fitxers a la carpeta documents/.
`;
}

export function buildSummaryText(params: {
  runId: string;
  orgSlug: string;
  dateFrom: string;
  dateTo: string;
  totalTransactions: number;
  totalIncome: number;
  totalExpense: number;
  totalWithDocRef: number;
  totalIncluded: number;
  statusCounts: DocumentStatusCounts;
  totalIncidents: number;
}): string {
  const {
    orgSlug,
    dateFrom,
    dateTo,
    totalTransactions,
    totalIncome,
    totalExpense,
    totalWithDocRef,
    totalIncluded,
    statusCounts,
  } = params;

  const saldo = totalIncome + totalExpense;
  const movimentsSenseDoc = statusCounts.noDocument;

  return `RESUM ECONÒMIC
==============

Organització: ${orgSlug}
Període: ${dateFrom} a ${dateTo}
Generat: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}

MOVIMENTS
---------
Total moviments: ${totalTransactions}
Total ingressos: ${totalIncome.toFixed(2)} EUR
Total despeses: ${totalExpense.toFixed(2)} EUR
Saldo: ${saldo.toFixed(2)} EUR

DOCUMENTS
---------
Moviments amb document adjunt: ${totalWithDocRef}
Documents inclosos al ZIP: ${totalIncluded}
Moviments sense document: ${movimentsSenseDoc}
`;
}

export function buildDebugSummaryText(params: {
  runId: string;
  orgSlug: string;
  dateFrom: string;
  dateTo: string;
  totalTransactions: number;
  totalWithDocRef: number;
  totalIncluded: number;
  statusCounts: DocumentStatusCounts;
}): string {
  const {
    runId,
    orgSlug,
    dateFrom,
    dateTo,
    totalTransactions,
    totalWithDocRef,
    totalIncluded,
    statusCounts,
  } = params;

  const totalNotIncluded = totalWithDocRef - totalIncluded;

  return `DIAGNÒSTIC TÈCNIC - PAQUET DE TANCAMENT
========================================
Run ID: ${runId}

Organització: ${orgSlug}
Període: ${dateFrom} a ${dateTo}
Generat: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}

TRANSACCIONS
------------
Total transaccions: ${totalTransactions}

DOCUMENTS - BREAKDOWN PER STATUS
--------------------------------
OK (descarregats): ${statusCounts.ok}
NO_DOCUMENT (sense referència): ${statusCounts.noDocument}
URL_NOT_PARSEABLE (URL no reconeguda): ${statusCounts.urlNotParseable}
BUCKET_MISMATCH (bucket diferent): ${statusCounts.bucketMismatch}
NOT_FOUND (fitxer no existeix): ${statusCounts.notFound}
DOWNLOAD_ERROR (error de xarxa): ${statusCounts.downloadError}

RESUM
-----
Moviments amb document referenciat: ${totalWithDocRef}
Documents inclosos al ZIP: ${totalIncluded}
Documents no inclosos: ${totalNotIncluded}

NOTA
----
Consulteu debug.xlsx per al detall complet de cada transacció.
`;
}

export function buildClosingBundleEntries(params: {
  mode: ClosingBundleMode;
  orgSlug: string;
  dateFrom: string;
  dateTo: string;
  manifestRows: ClosingManifestRow[];
  incidentRows: ClosingIncidentRow[];
  debugRows: DebugRow[];
  manifest: ClosingBundleManifest;
  summaryText: string;
  debugSummaryText: string;
}): ClosingBundleEntry[] {
  const {
    mode,
    orgSlug,
    dateFrom,
    dateTo,
    manifestRows,
    incidentRows,
    debugRows,
    manifest,
    summaryText,
    debugSummaryText,
  } = params;

  const userEntries: ClosingBundleEntry[] = [
    { name: 'moviments.xlsx', content: buildMovimentsXlsx(manifestRows) },
    { name: 'resum.txt', content: summaryText },
  ];

  if (mode === 'user') {
    return userEntries;
  }

  return [
    { name: 'README.txt', content: buildReadmeText(orgSlug, dateFrom, dateTo) },
    ...userEntries,
    { name: 'incidencies.xlsx', content: buildIncidenciesXlsx(incidentRows) },
    { name: 'manifest.json', content: JSON.stringify(manifest, null, 2) },
    { name: 'debug/resum_debug.txt', content: debugSummaryText },
    { name: 'debug/debug.xlsx', content: buildDebugXlsx(debugRows) },
  ];
}
