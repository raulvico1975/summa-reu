import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveServerEntitlement, type EntitlementDbLike } from '@/lib/api/require-entitlement';
import { PLAN_ENTITLEMENTS_CATALOG } from '@/lib/entitlements/catalog';

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

test('server active denega subscription absent independentment del legacy', async () => {
  const decision = await resolveServerEntitlement({
    db: fakeDb({
      'system/entitlements': { enforcementMode: 'active', catalogVersion: 1 },
      'organizations/org-1': { billingPlan: 'fiscal_documents' },
    }),
    orgId: 'org-1',
    capability: 'transactionDocuments.mutate',
  });
  assert.equal(decision.allowed, false);
});

test('server exigeix pla i snapshot coherents i configuració operativa', async () => {
  const base = {
    'system/entitlements': { enforcementMode: 'active', catalogVersion: 1 },
    'organizations/org-1': { features: { transactionDocuments: true } },
    'organizations/org-1/subscription/current': {
      planId: 'management',
      status: 'active',
      catalogVersion: 1,
      entitlements: PLAN_ENTITLEMENTS_CATALOG.management.entitlements,
    },
  };
  assert.equal((await resolveServerEntitlement({
    db: fakeDb(base), orgId: 'org-1', capability: 'transactionDocuments.mutate',
  })).allowed, true);
  assert.equal((await resolveServerEntitlement({
    db: fakeDb({ ...base, 'organizations/org-1': { features: { transactionDocuments: false } } }),
    orgId: 'org-1', capability: 'transactionDocuments.mutate',
  })).allowed, false);
});

test('pending documents és només Complete i respecta features.pendingDocs', async () => {
  const docs = {
    'system/entitlements': { enforcementMode: 'active', catalogVersion: 1 },
    'organizations/org-1': { features: { pendingDocs: true } },
    'organizations/org-1/subscription/current': {
      planId: 'complete',
      status: 'active',
      catalogVersion: 1,
      entitlements: PLAN_ENTITLEMENTS_CATALOG.complete.entitlements,
    },
  };
  assert.equal((await resolveServerEntitlement({
    db: fakeDb(docs), orgId: 'org-1', capability: 'pendingDocuments.mutate',
  })).allowed, true);
  assert.equal((await resolveServerEntitlement({
    db: fakeDb({ ...docs, 'organizations/org-1': { features: {} } }),
    orgId: 'org-1', capability: 'pendingDocuments.mutate',
  })).allowed, false);
  assert.equal((await resolveServerEntitlement({
    db: fakeDb({ ...docs, 'organizations/org-1': { features: { pendingDocs: false } } }),
    orgId: 'org-1', capability: 'pendingDocuments.mutate',
  })).allowed, false);
});
