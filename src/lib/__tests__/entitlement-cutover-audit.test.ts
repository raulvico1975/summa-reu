import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAN_ENTITLEMENTS_CATALOG, catalogFingerprintFor } from '@/lib/entitlements/catalog';
import { auditTransactionDocumentRegistry } from '@/lib/entitlements/transaction-document-audit';
import { buildEntitlementCutoverPreflight } from '@/lib/entitlements/cutover-preflight';
import {
  buildShadowDecisionRecord,
  summarizeShadowDecisions,
} from '@/lib/entitlements/shadow-report';
import { resolveOrganizationEntitlements } from '@/lib/entitlements/resolve-entitlements';

const baseAuditRecord = {
  organizationId: 'org-secret-name',
  transactionId: 'tx-1',
  mirrorDocument: 'https://storage.example/a',
  documents: [{
    id: 'doc-a',
    url: 'https://storage.example/a',
    storagePath: 'organizations/org-secret-name/documents/tx-1/a.pdf',
    isPrimary: true,
    source: 'transaction-upload' as const,
  }],
  storageObjectPaths: ['organizations/org-secret-name/documents/tx-1/a.pdf'],
  registry: {
    hasDocuments: true,
    documentCount: 1,
    primaryDocumentId: 'doc-a',
    registryVersion: 1,
  },
};

test('auditoria relacional coherent permet preflight documental', () => {
  const report = auditTransactionDocumentRegistry([baseAuditRecord]);
  assert.equal(report.canActivate, true);
  assert.equal(report.findings.length, 0);
});

test('auditoria detecta falsos verds de registry, primary, mirror i Storage', () => {
  const report = auditTransactionDocumentRegistry([{
    ...baseAuditRecord,
    mirrorDocument: 'https://storage.example/wrong',
    documents: [
      ...baseAuditRecord.documents,
      {
        id: 'doc-b', url: 'https://storage.example/b',
        storagePath: 'organizations/org-secret-name/documents/tx-1/missing.pdf',
        isPrimary: true, source: 'transaction-upload' as const,
      },
    ],
    storageObjectPaths: [
      'organizations/org-secret-name/documents/tx-1/a.pdf',
      'organizations/org-secret-name/documents/tx-1/orphan.pdf',
    ],
    registry: { hasDocuments: false, documentCount: 1, primaryDocumentId: 'wrong', registryVersion: 99 },
  }]);
  const codes = report.findings[0].codes;
  for (const code of [
    'REGISTRY_HAS_DOCUMENTS_MISMATCH', 'REGISTRY_VERSION_MISMATCH',
    'MULTIPLE_PRIMARIES', 'PRIMARY_MISMATCH', 'MIRROR_PRIMARY_MISMATCH',
    'STORAGE_ORPHAN', 'METADATA_STORAGE_MISSING',
  ]) assert.ok(codes.includes(code as never), code);
  assert.equal(report.canActivate, false);
  assert.equal(report.findings[0].deletableVulnerability, true);
});

test('auditoria bloqueja qualsevol cleanup pendent al registry', () => {
  const report = auditTransactionDocumentRegistry([{
    ...baseAuditRecord,
    registry: {
      ...baseAuditRecord.registry,
      pendingStorageCleanupPaths: ['organizations/org-secret-name/documents/tx-1/a.pdf'],
    },
  }]);
  assert.equal(report.canActivate, false);
  assert.ok(report.findings[0].codes.includes('STORAGE_CLEANUP_PENDING'));
});

test('audit només reconeix Storage preservat per pending confirmed amb relació canònica exacta', () => {
  const finalPath = 'organizations/org-secret-name/documents/tx-1/pending-1--renamed.pdf';
  const base = {
    organizationId: 'org-secret-name',
    transactionId: 'tx-1',
    mirrorDocument: null,
    documents: [],
    storageObjectPaths: [finalPath],
    registry: null,
  };
  const reference = {
    organizationId: 'org-secret-name',
    transactionId: 'tx-1',
    pendingDocumentId: 'pending-1',
    status: 'confirmed',
    filename: 'renamed.pdf',
    finalStoragePath: finalPath,
  };
  assert.equal(auditTransactionDocumentRegistry([{
    ...base,
    pendingDocumentStorageReferences: [reference],
  }]).canActivate, true);
  for (const invalid of [
    { ...reference, status: 'matched' },
    { ...reference, organizationId: 'org-other' },
    { ...reference, transactionId: 'tx-other' },
    { ...reference, finalStoragePath: 'organizations/org-secret-name/documents/tx-1/other.pdf' },
  ]) {
    const report = auditTransactionDocumentRegistry([{
      ...base,
      pendingDocumentStorageReferences: [invalid],
    }]);
    assert.equal(report.canActivate, false);
    assert.ok(report.findings[0].codes.includes('STORAGE_ORPHAN'));
  }
});

test('preflight exigeix config v3, pla canònic, status i fingerprint coherent', () => {
  const base = {
    systemConfig: { enforcementMode: 'shadow' as const, catalogVersion: 3 },
    subscriptions: [{
      organizationId: 'org-1',
      subscription: {
        planId: 'management' as const,
        status: 'active' as const,
        catalogVersion: 3,
        catalogFingerprint: catalogFingerprintFor('management'),
        entitlements: PLAN_ENTITLEMENTS_CATALOG.management.entitlements,
      },
    }],
    documentRegistryCanActivate: true,
  };
  assert.equal(buildEntitlementCutoverPreflight(base).canActivate, true);
  assert.equal(buildEntitlementCutoverPreflight({
    ...base,
    systemConfig: { enforcementMode: 'off', catalogVersion: 1 },
  }).canActivate, false);
  assert.equal(buildEntitlementCutoverPreflight({
    ...base,
    subscriptions: [{ ...base.subscriptions[0], subscription: {
      ...base.subscriptions[0].subscription,
      planId: 'initial' as never,
      entitlements: PLAN_ENTITLEMENTS_CATALOG.control.entitlements,
    } }],
  }).canActivate, false);
  assert.equal(buildEntitlementCutoverPreflight({
    ...base,
    subscriptions: [{ ...base.subscriptions[0], subscription: {
      ...base.subscriptions[0].subscription,
      catalogFingerprint: catalogFingerprintFor('complete'),
    } }],
  }).canActivate, false);
  assert.equal(buildEntitlementCutoverPreflight({
    ...base,
    subscriptions: [{ ...base.subscriptions[0], subscription: {
      ...base.subscriptions[0].subscription,
      entitlements: { ...PLAN_ENTITLEMENTS_CATALOG.management.entitlements, unknown: true } as never,
    } }],
  }).canActivate, true, 'el mapa auditable no és autoritat');
});

test('shadow report és determinista, pseudonimitzat i agrega absent/alias/diferències', () => {
  const resolved = resolveOrganizationEntitlements({
    subscription: null,
    legacyPlanId: 'fiscal_documents',
    systemConfig: { enforcementMode: 'shadow', catalogVersion: 3 },
  });
  const record = buildShadowDecisionRecord({
    organizationId: 'org-secret-name',
    capability: 'closingBundle.export',
    resolved,
    legacyPlanId: 'fiscal_documents',
  });
  const report = summarizeShadowDecisions([record, record]);
  assert.equal(report.containsPii, false);
  assert.equal(report.uniqueEvents, 1);
  assert.equal(report.bySubscriptionState.absent, 1);
  assert.equal(report.byLegacyAlias.fiscal_documents, 1);
  assert.equal(JSON.stringify(report).includes('org-secret-name'), false);
});

test('shadow classifica fingerprint missing, incorrecte i creuat com subscription corrupta', () => {
  for (const catalogFingerprint of [undefined, 'unknown', catalogFingerprintFor('complete')]) {
    const resolved = resolveOrganizationEntitlements({
      subscription: {
        planId: 'management',
        status: 'active',
        catalogVersion: 3,
        catalogFingerprint,
        entitlements: PLAN_ENTITLEMENTS_CATALOG.management.entitlements,
      },
      legacyPlanId: 'management',
      systemConfig: { enforcementMode: 'shadow', catalogVersion: 3 },
    });
    const record = buildShadowDecisionRecord({
      organizationId: 'org-secret-name',
      capability: 'model347.export',
      resolved,
      legacyPlanId: 'management',
    });
    assert.equal(record.subscriptionState, 'corrupt');
    assert.ok(record.diagnosticCodes.includes('catalog_fingerprint_mismatch'));
  }
});
