import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import {
  buildClosingBundleEntries,
  buildClosingBundleManifest,
  buildIncidentRows,
  buildVisibleIncidents,
} from '../../../functions/src/exports/closing-bundle/build-closing-artifacts';
import { canGenerateClosingBundle } from '../../../functions/src/exports/closing-bundle/closing-permissions';
import type {
  ClosingIncident,
  ClosingManifestRow,
  DocumentDiagnostic,
  DocumentStatusCounts,
} from '../../../functions/src/exports/closing-bundle/closing-types';

function createManifestRows(): ClosingManifestRow[] {
  return [
    {
      ordre: 1,
      data: '2026-01-14',
      import: -42.5,
      moneda: 'EUR',
      concepte: 'Factura hosting',
      categoria: '',
      contacte: 'Proveidor 1',
      txId: 'tx-expense-1',
      teDocument: false,
      nomDocument: '',
    },
    {
      ordre: 2,
      data: '2026-01-20',
      import: 120,
      moneda: 'EUR',
      concepte: 'Donatiu web',
      categoria: 'Donacions',
      contacte: 'Donant 1',
      txId: 'tx-income-1',
      teDocument: true,
      nomDocument: '002_2026.01.20_120.00_donatiu_web_me-1.pdf',
    },
  ];
}

function createDiagnostics(): Map<string, DocumentDiagnostic> {
  return new Map([
    ['tx-expense-1', {
      txId: 'tx-expense-1',
      rawDocumentValue: 'https://bad.example/doc.pdf',
      extractedPath: null,
      bucketConfigured: 'summa-test',
      bucketInUrl: null,
      status: 'URL_NOT_PARSEABLE',
      kind: 'generic',
      errorCode: null,
      errorMessage: null,
      errorAt: null,
    }],
    ['tx-income-1', {
      txId: 'tx-income-1',
      rawDocumentValue: 'organizations/org-1/documents/donatiu.pdf',
      extractedPath: 'organizations/org-1/documents/donatiu.pdf',
      bucketConfigured: 'summa-test',
      bucketInUrl: 'summa-test',
      status: 'OK',
      kind: 'path',
      errorCode: null,
      errorMessage: null,
      errorAt: null,
    }],
  ]);
}

function createExistingIncidents(): ClosingIncident[] {
  return [
    {
      txId: 'tx-expense-1',
      type: 'FALTA_DOCUMENT',
      severity: 'alta',
      message: 'Despesa sense document adjunt',
    },
    {
      txId: 'tx-expense-1',
      type: 'SENSE_CATEGORIA',
      severity: 'mitjana',
      message: 'Moviment sense categoria assignada',
    },
  ];
}

function createStatusCounts(): DocumentStatusCounts {
  return {
    ok: 1,
    noDocument: 0,
    urlNotParseable: 1,
    bucketMismatch: 0,
    notFound: 0,
    downloadError: 0,
  };
}

test('bundle permissions: allows informes.exportar, denies without it, honors grants/denies and systemSuperAdmin bypass', () => {
  assert.equal(canGenerateClosingBundle({
    memberData: { role: 'user' },
    isSystemSuperAdmin: false,
  }), true);

  assert.equal(canGenerateClosingBundle({
    memberData: { role: 'viewer' },
    isSystemSuperAdmin: false,
  }), false);

  assert.equal(canGenerateClosingBundle({
    memberData: { role: 'viewer', userGrants: ['informes.exportar'] },
    isSystemSuperAdmin: false,
  }), true);

  assert.equal(canGenerateClosingBundle({
    memberData: { role: 'admin', userOverrides: { deny: ['informes.exportar'] } },
    isSystemSuperAdmin: false,
  }), false);

  assert.equal(canGenerateClosingBundle({
    memberData: null,
    isSystemSuperAdmin: true,
  }), true);
});

test('visible incidents keep pipeline incidents and add DOCUMENT_NO_RESOLUBLE when diagnostic requires it', () => {
  const diagnostics = createDiagnostics();
  const visible = buildVisibleIncidents(
    [{ id: 'tx-expense-1' }, { id: 'tx-income-1' }],
    createExistingIncidents(),
    diagnostics
  );

  assert.equal(visible.some((incident) => incident.type === 'FALTA_DOCUMENT'), true);
  assert.equal(visible.some((incident) => incident.type === 'SENSE_CATEGORIA'), true);
  assert.equal(
    visible.some((incident) => incident.type === 'DOCUMENT_NO_RESOLUBLE' && incident.txId === 'tx-expense-1'),
    true
  );
});

async function buildZipEntryMap(mode: 'user' | 'full') {
  const manifestRows = createManifestRows();
  const diagnostics = createDiagnostics();
  const visibleIncidents = buildVisibleIncidents(
    [{ id: 'tx-expense-1' }, { id: 'tx-income-1' }],
    createExistingIncidents(),
    diagnostics
  );

  const manifestRowsByTxId = new Map(
    manifestRows.map((row) => [row.txId, {
      ordre: row.ordre,
      data: row.data,
      import: row.import,
      concepte: row.concepte,
      categoria: row.categoria,
      contacte: row.contacte,
    }])
  );

  const incidentRows = buildIncidentRows(visibleIncidents, manifestRowsByTxId, diagnostics);
  const manifest = buildClosingBundleManifest({
    runId: '20260407-160000-ABCD',
    generatedAt: '2026-04-07T16:00:00.000Z',
    orgSlug: 'org-test',
    dateFrom: '2026-01-01',
    dateTo: '2026-03-31',
    totalTransactions: 2,
    totalIncome: 120,
    totalExpense: -42.5,
    totalWithDocRef: 1,
    totalIncluded: 1,
    totalIncidents: visibleIncidents.length,
    statusCounts: createStatusCounts(),
  });

  const entries = buildClosingBundleEntries({
    mode,
    orgSlug: 'org-test',
    dateFrom: '2026-01-01',
    dateTo: '2026-03-31',
    manifestRows,
    incidentRows,
    debugRows: [
      {
        txId: 'tx-expense-1',
        rawDocumentValue: 'https://bad.example/doc.pdf',
        extractedPath: null,
        bucketConfigured: 'summa-test',
        bucketInUrl: null,
        status: 'URL_NOT_PARSEABLE',
        kind: 'generic',
        errorCode: null,
        errorMessage: null,
        errorAt: null,
      },
    ],
    manifest,
    summaryText: 'summary',
    debugSummaryText: 'debug summary',
  });

  const zip = new JSZip();
  for (const entry of entries) {
    zip.file(entry.name, entry.content);
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  return JSZip.loadAsync(buffer);
}

test('bundle user mode generates a clean zip for gestoria use', async () => {
  const loadedZip = await buildZipEntryMap('user');

  assert.ok(loadedZip.file('moviments.xlsx'));
  assert.ok(loadedZip.file('resum.txt'));
  assert.equal(loadedZip.file('manifest.json'), null);
  assert.equal(loadedZip.file('incidencies.xlsx'), null);
  assert.equal(loadedZip.file('README.txt'), null);
  assert.equal(loadedZip.file('debug/resum_debug.txt'), null);
  assert.equal(loadedZip.file('debug/debug.xlsx'), null);
});

test('bundle full mode generates manifest.json and incidencies.xlsx and keeps debug artifacts in the zip', async () => {
  const loadedZip = await buildZipEntryMap('full');

  assert.ok(loadedZip.file('manifest.json'));
  assert.ok(loadedZip.file('incidencies.xlsx'));
  assert.ok(loadedZip.file('README.txt'));
  assert.ok(loadedZip.file('moviments.xlsx'));
  assert.ok(loadedZip.file('resum.txt'));
  assert.ok(loadedZip.file('debug/resum_debug.txt'));
  assert.ok(loadedZip.file('debug/debug.xlsx'));

  const manifestJson = JSON.parse(await loadedZip.file('manifest.json')!.async('string')) as Record<string, unknown>;
  assert.equal(manifestJson.version, 1);
  assert.equal(manifestJson.orgSlug, 'org-test');
  assert.equal(manifestJson.dateFrom, '2026-01-01');
  assert.equal(manifestJson.dateTo, '2026-03-31');
  assert.equal(manifestJson.totalTransactions, 2);
  assert.equal(manifestJson.totalIncome, 120);
  assert.equal(manifestJson.totalExpense, -42.5);
  assert.equal(manifestJson.totalIncluded, 1);
  assert.equal((manifestJson.statusCounts as Record<string, unknown>).urlNotParseable, 1);
  assert.equal((manifestJson.limits as Record<string, unknown>).maxDocuments, 120);

  const incidenciesBuffer = await loadedZip.file('incidencies.xlsx')!.async('nodebuffer');
  const workbook = XLSX.read(incidenciesBuffer, { type: 'buffer' });
  const sheet = workbook.Sheets['Incidencies'];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  assert.equal(rows.some((row) => row.Tipus === 'DOCUMENT_NO_RESOLUBLE' && row.documentStatus === 'URL_NOT_PARSEABLE'), true);
  assert.equal(rows.some((row) => row.Tipus === 'FALTA_DOCUMENT'), true);
  assert.equal(rows.some((row) => row.Tipus === 'SENSE_CATEGORIA'), true);
});
