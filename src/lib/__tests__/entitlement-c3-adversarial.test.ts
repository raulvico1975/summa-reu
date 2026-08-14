import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveServerEntitlement, type EntitlementDbLike } from '@/lib/api/require-entitlement';
import { getMembershipPermissions } from '@/lib/api/require-permission';
import {
  ENTITLEMENTS_CATALOG_VERSION,
  PLAN_ENTITLEMENTS_CATALOG,
  catalogFingerprintFor,
} from '@/lib/entitlements/catalog';
import type { CanonicalPlanId, EntitlementCapability } from '@/lib/entitlements/types';
import { canExportClosingBundleWithEntitlement } from '../../../functions/src/exports/closing-bundle/closing-entitlements';

function fakeDb(docs: Record<string, Record<string, unknown> | null>): EntitlementDbLike {
  return {
    doc(path: string) {
      return {
        async get() {
          const value = docs[path] ?? null;
          return { exists: value !== null, data: () => value ?? undefined };
        },
      };
    },
  };
}

function activePlanDb(
  planId: CanonicalPlanId,
  overrides: Record<string, Record<string, unknown> | null> = {}
): EntitlementDbLike {
  return fakeDb({
    'system/entitlements': { enforcementMode: 'active', catalogVersion: ENTITLEMENTS_CATALOG_VERSION },
    'organizations/org-1': {
      billingPlan: planId,
      features: {
        pendingDocs: true,
        projectModule: true,
        transactionDocuments: true,
      },
    },
    'organizations/org-1/subscription/current': {
      planId,
      status: 'active',
      catalogVersion: ENTITLEMENTS_CATALOG_VERSION,
      catalogFingerprint: catalogFingerprintFor(planId),
      entitlements: PLAN_ENTITLEMENTS_CATALOG[planId].entitlements,
    },
    ...overrides,
  });
}

async function allowed(
  db: EntitlementDbLike,
  capability: EntitlementCapability,
  userAllowed = true
): Promise<boolean> {
  return (await resolveServerEntitlement({
    db,
    orgId: 'org-1',
    capability,
    userAllowed,
  })).allowed;
}

test('C3a: 347 i categoritzacio IA son Management+ i el permís personal preval', async () => {
  for (const capability of [
    'model347.read',
    'model347.export',
    'aiCategorization.execute',
  ] as const) {
    assert.equal(await allowed(activePlanDb('control'), capability), false, `${capability}: Control`);
    assert.equal(await allowed(activePlanDb('management'), capability), true, `${capability}: Management`);
    assert.equal(await allowed(activePlanDb('complete'), capability), true, `${capability}: Complete`);
    assert.equal(await allowed(activePlanDb('management'), capability, false), false, `${capability}: deny personal`);
  }
});

test('C3a: grants poden obrir i deny override preval sobre rol o grant', async () => {
  const viewerGranted = getMembershipPermissions({
    valid: true,
    role: 'viewer',
    userOverrides: null,
    userGrants: ['moviments.editar', 'fiscal.model347.generar', 'informes.exportar'],
  });
  assert.equal(viewerGranted['moviments.editar'], true);
  assert.equal(viewerGranted['fiscal.model347.generar'], true);
  assert.equal(viewerGranted['informes.exportar'], true);
  assert.equal(await allowed(
    activePlanDb('management'),
    'aiCategorization.execute',
    viewerGranted['moviments.editar']
  ), true);

  const adminDenied = getMembershipPermissions({
    valid: true,
    role: 'admin',
    userOverrides: { deny: ['moviments.editar', 'fiscal.model347.generar'] },
    userGrants: ['moviments.editar', 'fiscal.model347.generar'],
  });
  assert.equal(adminDenied['moviments.editar'], false);
  assert.equal(adminDenied['fiscal.model347.generar'], false);
  assert.equal(await allowed(
    activePlanDb('management'),
    'aiCategorization.execute',
    adminDenied['moviments.editar']
  ), false);
});

test('C3b: operativa premium es Complete, amb lectura historica independent dels flags', async () => {
  const completeOnly: EntitlementCapability[] = [
    'pendingDocuments.mutate',
    'pendingDocuments.match',
    'pendingDocuments.ocr',
    'closingBundle.export',
    'projects.mutate',
    'projectBudgets.mutate',
    'multicurrency.mutate',
    'grantJustification.export',
  ];

  for (const capability of completeOnly) {
    assert.equal(await allowed(activePlanDb('control'), capability), false, `${capability}: Control`);
    assert.equal(await allowed(activePlanDb('management'), capability), false, `${capability}: Management`);
    assert.equal(await allowed(activePlanDb('complete'), capability), true, `${capability}: Complete`);
  }

  const flagsDisabled = activePlanDb('control', {
    'organizations/org-1': {
      billingPlan: 'control',
      features: {
        pendingDocs: false,
        projectModule: false,
        transactionDocuments: false,
      },
    },
  });
  assert.equal(await allowed(flagsDisabled, 'transactionDocuments.readHistorical'), true);
  assert.equal(await allowed(flagsDisabled, 'pendingDocuments.readHistorical'), true);
  assert.equal(await allowed(flagsDisabled, 'projects.readHistorical'), true);
});

test('C3: config absent, v1 o corrupta falla a Control segur per premium', async () => {
  const premiumCapabilities: EntitlementCapability[] = [
    'transactionDocuments.mutate',
    'model347.export',
    'aiCategorization.execute',
    'pendingDocuments.ocr',
    'closingBundle.export',
    'projects.mutate',
    'grantJustification.export',
  ];
  const completeSubscription = {
    planId: 'complete',
    status: 'active',
    catalogVersion: ENTITLEMENTS_CATALOG_VERSION,
    catalogFingerprint: catalogFingerprintFor('complete'),
    entitlements: PLAN_ENTITLEMENTS_CATALOG.complete.entitlements,
  };

  for (const config of [
    null,
    { enforcementMode: 'active', catalogVersion: 1 },
    { enforcementMode: 'unknown', catalogVersion: ENTITLEMENTS_CATALOG_VERSION },
  ]) {
    const db = fakeDb({
      'system/entitlements': config,
      'organizations/org-1': {
        billingPlan: 'complete',
        features: { pendingDocs: true, projectModule: true, transactionDocuments: true },
      },
      'organizations/org-1/subscription/current': completeSubscription,
    });
    for (const capability of premiumCapabilities) {
      assert.equal(await allowed(db, capability), false, `${capability}: ${JSON.stringify(config)}`);
    }
  }
});

test('C3: explicit compatible off conserva funcionalitat, pero mai salta permisos ni flags operatius', async () => {
  const offDb = fakeDb({
    'system/entitlements': { enforcementMode: 'off', catalogVersion: ENTITLEMENTS_CATALOG_VERSION },
    'organizations/org-1': {
      billingPlan: 'control',
      features: { pendingDocs: true, projectModule: true, transactionDocuments: true },
    },
  });
  assert.equal(await allowed(offDb, 'aiCategorization.execute'), true);
  assert.equal(await allowed(offDb, 'aiCategorization.execute', false), false);
  assert.equal(await allowed(offDb, 'pendingDocuments.ocr'), true);

  const flagsDisabled = fakeDb({
    'system/entitlements': { enforcementMode: 'off', catalogVersion: ENTITLEMENTS_CATALOG_VERSION },
    'organizations/org-1': {
      billingPlan: 'control',
      features: { pendingDocs: false, projectModule: false, transactionDocuments: false },
    },
  });
  assert.equal(await allowed(flagsDisabled, 'pendingDocuments.ocr'), false);
  assert.equal(await allowed(flagsDisabled, 'projects.mutate'), false);
  assert.equal(await allowed(flagsDisabled, 'transactionDocuments.mutate'), false);
});

test('C3: una subscription premium orfena mai autoritza sense arrel d organitzacio', async () => {
  const completeSubscription = {
    planId: 'complete' as const,
    status: 'active' as const,
    catalogVersion: ENTITLEMENTS_CATALOG_VERSION,
    catalogFingerprint: catalogFingerprintFor('complete'),
    entitlements: PLAN_ENTITLEMENTS_CATALOG.complete.entitlements,
  };
  const orphanDb = fakeDb({
    'system/entitlements': { enforcementMode: 'active', catalogVersion: ENTITLEMENTS_CATALOG_VERSION },
    'organizations/org-1': null,
    'organizations/org-1/subscription/current': completeSubscription,
  });

  for (const capability of [
    'closingBundle.export',
    'pendingDocuments.ocr',
    'projects.mutate',
    'grantJustification.export',
  ] as const) {
    assert.equal(await allowed(orphanDb, capability), false, capability);
  }

  assert.equal(canExportClosingBundleWithEntitlement({
    organizationData: null,
    subscriptionData: completeSubscription,
    systemConfigData: { enforcementMode: 'active', catalogVersion: ENTITLEMENTS_CATALOG_VERSION },
    permissionAllowed: true,
  }), false, 'direct closing Function');
});

test('C3 v3: fingerprint és autoritatiu i el mapa informatiu no decideix accés', async () => {
  const wrongFingerprint = activePlanDb('complete', {
    'organizations/org-1/subscription/current': {
      planId: 'complete',
      status: 'active',
      catalogVersion: ENTITLEMENTS_CATALOG_VERSION,
      catalogFingerprint: catalogFingerprintFor('management'),
      entitlements: PLAN_ENTITLEMENTS_CATALOG.complete.entitlements,
    },
  });
  assert.equal(await allowed(wrongFingerprint, 'projects.mutate'), false);
  assert.equal(await allowed(wrongFingerprint, 'closingBundle.export'), false);

  const tamperedInformationalMap = activePlanDb('complete', {
    'organizations/org-1/subscription/current': {
      planId: 'complete',
      status: 'active',
      catalogVersion: ENTITLEMENTS_CATALOG_VERSION,
      catalogFingerprint: catalogFingerprintFor('complete'),
      entitlements: {
        ...PLAN_ENTITLEMENTS_CATALOG.control.entitlements,
        'projects.mutate': false,
      },
    },
  });
  assert.equal(await allowed(tamperedInformationalMap, 'projects.mutate'), true);
  assert.equal(await allowed(tamperedInformationalMap, 'closingBundle.export'), true);
});
