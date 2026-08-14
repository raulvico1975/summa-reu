import assert from 'node:assert/strict';
import test from 'node:test';

import { NextRequest } from 'next/server';

import { handleCategorizeTransactionPost } from '@/app/api/ai/categorize-transaction/handler';
import { handleModel347Post } from '@/app/api/fiscal/model347/generate/handler';
import type { MembershipValidation } from '@/lib/api/admin-sdk';
import { resolveServerEntitlement, type EntitlementDbLike } from '@/lib/api/require-entitlement';
import {
  ENTITLEMENTS_CATALOG_VERSION,
  PLAN_ENTITLEMENTS_CATALOG,
  catalogFingerprintFor,
} from '@/lib/entitlements/catalog';

const managementDocs: Record<string, Record<string, unknown> | null> = {
  'system/entitlements': { enforcementMode: 'active', catalogVersion: ENTITLEMENTS_CATALOG_VERSION },
  'organizations/org-1': { billingPlan: 'management' },
  'organizations/org-1/subscription/current': {
    planId: 'management',
    status: 'active',
    catalogVersion: ENTITLEMENTS_CATALOG_VERSION,
    catalogFingerprint: catalogFingerprintFor('management'),
    entitlements: PLAN_ENTITLEMENTS_CATALOG.management.entitlements,
  },
};

function fakeEntitlementDb(
  docs: Record<string, Record<string, unknown> | null>
): EntitlementDbLike {
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

function categorizeRequest() {
  return new NextRequest('http://localhost/api/ai/categorize-transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    body: JSON.stringify({
      orgId: 'org-1',
      description: 'FACTURA PROVEIDOR',
      amount: -42,
      expenseOptions: [{ id: 'supplies', name: 'Material' }],
      incomeOptions: [],
    }),
  });
}

function guardFor(membership: MembershipValidation) {
  return async () => ({
    ok: true as const,
    auth: { uid: 'user-1' },
    membership,
    orgId: 'org-1',
  });
}

test('C3a categorize: Control/config incompatible/deny personal no arriben mai a IA', async () => {
  const cases = [
    {
      label: 'Control',
      docs: {
        ...managementDocs,
        'organizations/org-1/subscription/current': {
          planId: 'control', status: 'active', catalogVersion: ENTITLEMENTS_CATALOG_VERSION,
          catalogFingerprint: catalogFingerprintFor('control'),
          entitlements: PLAN_ENTITLEMENTS_CATALOG.control.entitlements,
        },
      },
      membership: { valid: true, role: 'admin', userOverrides: null, userGrants: null } satisfies MembershipValidation,
    },
    {
      label: 'config v1',
      docs: { ...managementDocs, 'system/entitlements': { enforcementMode: 'active', catalogVersion: 1 } },
      membership: { valid: true, role: 'admin', userOverrides: null, userGrants: null } satisfies MembershipValidation,
    },
    {
      label: 'viewer sense editar',
      docs: managementDocs,
      membership: { valid: true, role: 'viewer', userOverrides: null, userGrants: null } satisfies MembershipValidation,
    },
    {
      label: 'deny override',
      docs: managementDocs,
      membership: {
        valid: true,
        role: 'admin',
        userOverrides: { deny: ['moviments.editar'] },
        userGrants: ['moviments.editar'],
      } satisfies MembershipValidation,
    },
  ];

  for (const scenario of cases) {
    let aiCalls = 0;
    let keyCalls = 0;
    const db = fakeEntitlementDb(scenario.docs);
    const response = await handleCategorizeTransactionPost(categorizeRequest(), {
      requireOrgMembershipFn: guardFor(scenario.membership),
      getAdminDbFn: () => db as never,
      resolveEntitlementFn: resolveServerEntitlement,
      resolveApiKeyFn: () => { keyCalls += 1; return 'test-key'; },
      checkRateLimitFn: () => ({ allowed: true, remaining: 1, retryAfterSeconds: 0, resetAt: Date.now() + 1_000 }),
      categorizeFn: async () => { aiCalls += 1; return { categoryId: 'supplies', confidence: 0.99 }; },
    });
    assert.equal(response.status, 403, scenario.label);
    assert.equal(keyCalls, 0, `${scenario.label}: API key`);
    assert.equal(aiCalls, 0, `${scenario.label}: AI`);
  }
});

test('C3a categorize: Management amb grant explícit arriba a IA', async () => {
  let aiCalls = 0;
  const db = fakeEntitlementDb(managementDocs);
  const response = await handleCategorizeTransactionPost(categorizeRequest(), {
    requireOrgMembershipFn: guardFor({
      valid: true,
      role: 'viewer',
      userOverrides: null,
      userGrants: ['moviments.editar'],
    }),
    getAdminDbFn: () => db as never,
    resolveEntitlementFn: resolveServerEntitlement,
    resolveApiKeyFn: () => 'test-key',
    checkRateLimitFn: () => ({ allowed: true, remaining: 1, retryAfterSeconds: 0, resetAt: Date.now() + 1_000 }),
    categorizeFn: async () => { aiCalls += 1; return { categoryId: 'supplies', confidence: 0.99 }; },
  });
  assert.equal(response.status, 200);
  assert.equal(aiCalls, 1);
  assert.deepEqual(await response.json(), { ok: true, categoryId: 'supplies', confidence: 0.99 });
});

function model347Request() {
  return new NextRequest('http://localhost/api/fiscal/model347/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    body: JSON.stringify({ orgId: 'org-1', year: 2025 }),
  });
}

function model347Db(docs: Record<string, Record<string, unknown> | null>) {
  const entitlementDb = fakeEntitlementDb(docs);
  return {
    doc: entitlementDb.doc,
    collection() {
      return { async get() { return { docs: [] }; } };
    },
  };
}

test('C3a Model 347: Control i deny personal no llegeixen dades ni generen fitxer', async () => {
  const cases = [
    {
      label: 'Control',
      docs: {
        ...managementDocs,
        'organizations/org-1/subscription/current': {
          planId: 'control', status: 'active', catalogVersion: ENTITLEMENTS_CATALOG_VERSION,
          catalogFingerprint: catalogFingerprintFor('control'),
          entitlements: PLAN_ENTITLEMENTS_CATALOG.control.entitlements,
        },
      },
      membership: { valid: true, role: 'admin', userOverrides: null, userGrants: null } satisfies MembershipValidation,
    },
    {
      label: 'deny fiscal',
      docs: managementDocs,
      membership: {
        valid: true,
        role: 'admin',
        userOverrides: { deny: ['fiscal.model347.generar'] },
        userGrants: null,
      } satisfies MembershipValidation,
    },
  ];

  for (const scenario of cases) {
    let generatorCalls = 0;
    let collectionReads = 0;
    const db = model347Db(scenario.docs);
    const response = await handleModel347Post(model347Request(), {
      verifyIdTokenFn: async () => ({ uid: 'user-1' }),
      getAdminDbFn: () => ({
        ...db,
        collection() {
          collectionReads += 1;
          return { async get() { return { docs: [] }; } };
        },
      }) as never,
      validateUserMembershipFn: async () => scenario.membership,
      resolveEntitlementFn: resolveServerEntitlement,
      generateExportFn: (() => {
        generatorCalls += 1;
        return { content: '', errors: [], excluded: [], includedCount: 0, excludedCount: 0 };
      }) as never,
    });
    assert.equal(response.status, 403, scenario.label);
    assert.equal(collectionReads, 0, `${scenario.label}: Firestore collections`);
    assert.equal(generatorCalls, 0, `${scenario.label}: generator`);
  }
});

test('C3a Model 347: Management amb grants complets genera server-side', async () => {
  let generatorCalls = 0;
  const db = model347Db(managementDocs);
  const response = await handleModel347Post(model347Request(), {
    verifyIdTokenFn: async () => ({ uid: 'user-1' }),
    getAdminDbFn: () => db as never,
    validateUserMembershipFn: async () => ({
      valid: true,
      role: 'viewer',
      userOverrides: null,
      userGrants: ['moviments.read', 'fiscal.model347.generar', 'informes.exportar'],
    }),
    resolveEntitlementFn: resolveServerEntitlement,
    generateExportFn: (() => {
      generatorCalls += 1;
      return { content: '347', errors: [], excluded: [], includedCount: 0, excludedCount: 0 };
    }) as never,
  });
  assert.equal(response.status, 200);
  assert.equal(generatorCalls, 1);
  assert.equal((await response.json() as { content: string }).content, '347');
});
