import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  prepareDiagnostics,
  prepareDocuments,
  resolveClosingDocumentReferences,
} from '../../../functions/src/exports/closing-bundle/build-closing-data';
import {
  buildDebugSummaryText,
  buildIncidentRows,
  buildVisibleIncidents,
} from '../../../functions/src/exports/closing-bundle/build-closing-artifacts';
import { canExportClosingBundleWithEntitlement } from '../../../functions/src/exports/closing-bundle/closing-entitlements';
import { catalogEntitlementsFor, catalogFingerprintFor, ENTITLEMENTS_CATALOG_VERSION } from '@/lib/entitlements/catalog';
import type { CanonicalPlanId } from '@/lib/entitlements/types';

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-1',
    organizationId: 'org-1',
    date: '2026-08-01',
    amount: -100,
    description: 'Factura projecte',
    category: 'materials',
    categoryName: 'Materials',
    contactId: 'supplier-1',
    contactName: 'Supplier',
    document: null,
    transactionType: 'normal',
    isRemittance: false,
    remittanceStatus: null,
    source: 'bank',
    parentTransactionId: null,
    isRemittanceItem: false,
    ...overrides,
  } as never;
}

function subscription(planId: CanonicalPlanId) {
  return {
    planId,
    status: 'active' as const,
    catalogVersion: ENTITLEMENTS_CATALOG_VERSION,
    catalogFingerprint: catalogFingerprintFor(planId),
    entitlements: catalogEntitlementsFor(planId),
  };
}

test('closing entitlement es valida dins la capa Function: Complete sí, Control/Management/config corrupta no', () => {
  const activeConfig = { enforcementMode: 'active' as const, catalogVersion: ENTITLEMENTS_CATALOG_VERSION };
  for (const planId of ['control', 'management', 'complete'] as const) {
    assert.equal(canExportClosingBundleWithEntitlement({
      organizationData: { billingPlan: planId },
      subscriptionData: subscription(planId),
      systemConfigData: activeConfig,
      permissionAllowed: true,
    }), planId === 'complete', planId);
  }
  assert.equal(canExportClosingBundleWithEntitlement({
    organizationData: { billingPlan: 'complete' },
    subscriptionData: subscription('complete'),
    systemConfigData: { enforcementMode: 'active', catalogVersion: 1 },
    permissionAllowed: true,
  }), false);
  assert.equal(canExportClosingBundleWithEntitlement({
    organizationData: null,
    subscriptionData: subscription('complete'),
    systemConfigData: activeConfig,
    permissionAllowed: true,
  }), false, 'org root absent amb subscription orfe');
  assert.equal(canExportClosingBundleWithEntitlement({
    organizationData: { billingPlan: 'control' },
    subscriptionData: subscription('control'),
    systemConfigData: { enforcementMode: 'off', catalogVersion: ENTITLEMENTS_CATALOG_VERSION },
    permissionAllowed: true,
  }), true);
  assert.equal(canExportClosingBundleWithEntitlement({
    organizationData: { billingPlan: 'complete' },
    subscriptionData: subscription('complete'),
    systemConfigData: activeConfig,
    permissionAllowed: false,
  }), false);
});

test('multiadjunt usa metadata canònica, primary primer, fallback legacy només sense metadata i dedupe path/url', () => {
  const references = resolveClosingDocumentReferences({
    legacyDocument: 'organizations/org-1/documents/tx-1/legacy.pdf',
    metadataDocuments: [
      { id: 'secondary', storagePath: 'organizations/org-1/documents/tx-1/b.pdf', url: 'https://signed/b', isPrimary: false, filename: 'b.pdf' },
      { id: 'primary', storagePath: 'organizations/org-1/documents/tx-1/a.pdf', isPrimary: true, filename: 'a.pdf' },
      { id: 'duplicate-url', url: 'https://firebasestorage.googleapis.com/v0/b/bucket/o/organizations%2Forg-1%2Fdocuments%2Ftx-1%2Fa.pdf?alt=media' },
    ],
  });
  assert.deepEqual(references.map((reference) => reference.id), ['primary', 'secondary']);
  assert.equal(references.some((reference) => reference.source === 'legacy'), false);

  const legacy = resolveClosingDocumentReferences({
    legacyDocument: 'organizations/org-1/documents/tx-1/legacy.pdf',
    metadataDocuments: [],
  });
  assert.equal(legacy.length, 1);
  assert.equal(legacy[0].source, 'legacy');
});

test('prepareDocuments inclou primary i secondary amb noms únics i límits comptaran tots', () => {
  const documents = resolveClosingDocumentReferences({
    legacyDocument: null,
    metadataDocuments: [
      { id: 'b', storagePath: 'organizations/org-1/documents/tx-1/b.pdf', isPrimary: false, filename: 'b.pdf' },
      { id: 'a', storagePath: 'organizations/org-1/documents/tx-1/a.pdf', isPrimary: true, filename: 'a.pdf' },
    ],
  });
  const tx = transaction({ documents });
  const diagnostics = prepareDiagnostics([tx], 'bucket');
  const prepared = prepareDocuments([tx], diagnostics);
  assert.equal(prepared.docs.length, 2);
  assert.equal(new Set(prepared.docs.map((document) => document.storagePath)).size, 2);
  assert.equal(new Set(prepared.docs.map((document) => document.fileName)).size, 2);
  assert.match(prepared.docs[0].fileName, /_adjunt_01\.pdf$/);
  assert.match(prepared.docs[1].fileName, /_adjunt_02\.pdf$/);
});

test('path cross-org/tx i metadata buida generen incidència visible i mai document descarregable', () => {
  for (const documents of [
    resolveClosingDocumentReferences({ legacyDocument: null, metadataDocuments: [{ id: 'cross-org', storagePath: 'organizations/org-2/documents/tx-1/x.pdf' }] }),
    resolveClosingDocumentReferences({ legacyDocument: null, metadataDocuments: [{ id: 'empty' }] }),
  ]) {
    const tx = transaction({ documents });
    const diagnostics = prepareDiagnostics([tx], 'bucket');
    const prepared = prepareDocuments([tx], diagnostics);
    const incidents = buildVisibleIncidents([tx], [], diagnostics);
    assert.equal(prepared.docs.length, 0);
    assert.equal(incidents.some((incident) => incident.type === 'DOCUMENT_NO_RESOLUBLE'), true);
  }
});

test('resum multiadjunt separa moviments i documents i incidències conserven el seu status', () => {
  const summary = buildDebugSummaryText({
    runId: 'run-1',
    orgSlug: 'org-1',
    dateFrom: '2026-08-01',
    dateTo: '2026-08-31',
    totalTransactions: 1,
    totalWithDocRef: 1,
    totalDocumentRefs: 2,
    totalIncluded: 2,
    statusCounts: { ok: 2, noDocument: 0, urlNotParseable: 0, bucketMismatch: 0, notFound: 0, downloadError: 0 },
  });
  assert.match(summary, /Moviments amb document referenciat: 1/);
  assert.match(summary, /Documents referenciats: 2/);
  assert.match(summary, /Documents no inclosos: 0/);
  assert.doesNotMatch(summary, /Documents no inclosos: -/);

  const diagnostics = new Map([
    ['tx-1::a', { txId: 'tx-1', rawDocumentValue: 'a', extractedPath: 'a', bucketConfigured: 'bucket', bucketInUrl: null, status: 'NOT_FOUND' as const }],
    ['tx-1::b', { txId: 'tx-1', rawDocumentValue: 'b', extractedPath: 'b', bucketConfigured: 'bucket', bucketInUrl: null, status: 'DOWNLOAD_ERROR' as const }],
  ]);
  const incidents = buildVisibleIncidents([{ id: 'tx-1' }], [], diagnostics);
  const rows = buildIncidentRows(incidents, new Map(), diagnostics);
  assert.deepEqual(rows.map((row) => row.documentStatus).sort(), ['DOWNLOAD_ERROR', 'NOT_FOUND']);
});

test('Function aplica entitlement abans de carregar transaccions i la càrrega de metadata és acotada i determinista', async () => {
  const [functionSource, dataSource] = await Promise.all([
    readFile(path.join(process.cwd(), 'functions/src/exports/closingBundleZip.ts'), 'utf8'),
    readFile(path.join(process.cwd(), 'functions/src/exports/closing-bundle/build-closing-data.ts'), 'utf8'),
  ]);
  assert.ok(functionSource.indexOf('canExportClosingBundleWithEntitlement') < functionSource.indexOf('loadTransactions(orgId'));
  assert.match(dataSource, /const concurrency = 20;/);
  assert.match(dataSource, /eligibleDocs\.slice\(offset, offset \+ concurrency\)/);
  assert.match(dataSource, /for \(const doc of eligibleDocs\)/);
  assert.match(dataSource, /const sizes = await Promise\.all\(chunk\.map/);
});
