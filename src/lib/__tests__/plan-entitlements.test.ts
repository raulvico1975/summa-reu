import assert from 'node:assert/strict';
import test from 'node:test';
import { ENTITLEMENTS_CATALOG_VERSION, PLAN_ENTITLEMENTS_CATALOG, catalogFingerprintFor } from '@/lib/entitlements/catalog';
import { normalizePlanId } from '@/lib/entitlements/normalize-plan';
import { resolveCapabilityAccess, resolveOrganizationEntitlements } from '@/lib/entitlements/resolve-entitlements';
import { buildEntitlementBackfillDryRun } from '@/lib/entitlements/backfill';

test('catàleg v3 usa plans canònics, fingerprint per pla i mapes legacy explícits', () => {
  assert.equal(ENTITLEMENTS_CATALOG_VERSION, 3);
  assert.deepEqual(Object.keys(PLAN_ENTITLEMENTS_CATALOG), ['control', 'management', 'complete']);
  assert.equal(normalizePlanId('initial'), 'control');
  assert.equal(normalizePlanId('fiscal_documents'), 'complete');
  assert.equal(normalizePlanId('unknown'), null);
  assert.equal(PLAN_ENTITLEMENTS_CATALOG.control.entitlements['transactionDocuments.mutate'], false);
  assert.equal(PLAN_ENTITLEMENTS_CATALOG.management.entitlements['transactionDocuments.mutate'], true);
  assert.equal(PLAN_ENTITLEMENTS_CATALOG.management.entitlements['pendingDocuments.mutate'], false);
  assert.equal(PLAN_ENTITLEMENTS_CATALOG.complete.entitlements['pendingDocuments.mutate'], true);
});

test('subscription absent és fail-open en off, shadow calcula denegació i active és Control segur', () => {
  for (const mode of ['off', 'shadow'] as const) {
    const result = resolveOrganizationEntitlements({
      subscription: null,
      legacyPlanId: 'management',
      systemConfig: { enforcementMode: mode, catalogVersion: 3 },
    });
    assert.equal(result.applied['transactionDocuments.mutate'], true);
    assert.equal(result.projected['transactionDocuments.mutate'], true);
  }

  const active = resolveOrganizationEntitlements({
    subscription: null,
    legacyPlanId: 'management',
    systemConfig: { enforcementMode: 'active', catalogVersion: 3 },
  });
  assert.equal(active.applied['transactionDocuments.readHistorical'], true);
  assert.equal(active.applied['transactionDocuments.mutate'], false);
});

test('mode global active i snapshot corrupta no reobren mutacions', () => {
  const result = resolveOrganizationEntitlements({
    systemConfig: { enforcementMode: 'active', catalogVersion: 3 },
    subscription: {
      planId: 'complete',
      status: 'active',
      catalogVersion: 999,
      catalogFingerprint: catalogFingerprintFor('complete'),
      entitlements: PLAN_ENTITLEMENTS_CATALOG.complete.entitlements,
    },
  });
  assert.equal(result.enforcementMode, 'active');
  assert.equal(result.applied['transactionDocuments.mutate'], false);
  assert.ok(result.diagnostics.includes('catalog_version_mismatch'));
});

test('el mapa auditable no és autoritat i alterar-ne bits no canvia l’accés', () => {
  const expected = PLAN_ENTITLEMENTS_CATALOG.management.entitlements;
  for (const capability of Object.keys(expected) as Array<keyof typeof expected>) {
    const result = resolveOrganizationEntitlements({
      systemConfig: { enforcementMode: 'active', catalogVersion: 3 },
      subscription: {
        planId: 'management',
        status: 'active',
        catalogVersion: 3,
        catalogFingerprint: catalogFingerprintFor('management'),
        entitlements: { ...expected, [capability]: !expected[capability] },
      },
    });
    assert.equal(result.applied['transactionDocuments.mutate'], true, capability);
    assert.equal(result.diagnostics.includes('catalog_fingerprint_mismatch'), false);
  }
});

test('fingerprint absent, incorrecte o d’un altre pla cau a Control segur', () => {
  for (const catalogFingerprint of [undefined, 'wrong', catalogFingerprintFor('complete')]) {
    const result = resolveOrganizationEntitlements({
      systemConfig: { enforcementMode: 'active', catalogVersion: 3 },
      subscription: {
        planId: 'management',
        status: 'active',
        catalogVersion: 3,
        catalogFingerprint,
        entitlements: PLAN_ENTITLEMENTS_CATALOG.management.entitlements,
      },
    });
    assert.equal(result.applied['transactionDocuments.mutate'], false);
    assert.ok(result.diagnostics.includes('catalog_fingerprint_mismatch'));
  }
});

test('accés final és AND comercial, configuració operativa i permís personal', () => {
  const entitlements = resolveOrganizationEntitlements({
    systemConfig: { enforcementMode: 'active', catalogVersion: 3 },
    subscription: {
      planId: 'management',
      status: 'active',
      catalogVersion: 3,
      catalogFingerprint: catalogFingerprintFor('management'),
      entitlements: PLAN_ENTITLEMENTS_CATALOG.management.entitlements,
    },
  });
  assert.equal(resolveCapabilityAccess({
    entitlements,
    capability: 'transactionDocuments.mutate',
    operationalEnabled: true,
    userAllowed: true,
  }).allowed, true);
  assert.deepEqual(resolveCapabilityAccess({
    entitlements,
    capability: 'transactionDocuments.mutate',
    operationalEnabled: false,
    userAllowed: false,
  }).reasons, ['operational', 'permission']);
});

test('dry-run de backfill és idempotent, sense undefined i amb chunks màxim de 50', () => {
  const records = Array.from({ length: 101 }, (_, index) => ({
    id: `org-${index}`,
    billingPlan: index === 0 ? 'initial' : 'management',
    billingStatus: 'active',
  }));
  const report = buildEntitlementBackfillDryRun(records);
  assert.deepEqual(report.chunks.map((chunk) => chunk.length), [50, 50, 1]);
  assert.equal(JSON.stringify(report).includes('undefined'), false);

  const first = report.chunks[0][0];
  const second = buildEntitlementBackfillDryRun([{
    ...records[0],
    currentSubscription: first.projection,
  }]);
  assert.equal(second.plannedWrites, 0);
  assert.deepEqual(second.skippedOrgIds, ['org-0']);
});

test('dry-run bloqueja plans o estats ambigus i no els converteix en writes', () => {
  const report = buildEntitlementBackfillDryRun([
    { id: 'missing-plan', billingStatus: 'active' },
    { id: 'unknown-status', billingPlan: 'management', billingStatus: 'mystery' },
  ]);
  assert.equal(report.canApply, false);
  assert.equal(report.plannedWrites, 0);
  assert.equal(report.blocked.length, 2);
  assert.equal(report.distribution.missingPlan, 1);
  assert.equal(report.distribution.unknownStatus, 1);
});
