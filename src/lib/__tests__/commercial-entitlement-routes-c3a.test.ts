import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { handleCategorizeTransactionPost } from '@/app/api/ai/categorize-transaction/handler';
import { handleInferContactPost } from '@/app/api/ai/infer-contact/handler';
import { handleModel347Post } from '@/app/api/fiscal/model347/generate/handler';
import { catalogEntitlementsFor, catalogFingerprintFor, ENTITLEMENTS_CATALOG_VERSION } from '@/lib/entitlements/catalog';
import type { CanonicalPlanId } from '@/lib/entitlements/types';
import type { MembershipValidation } from '@/lib/api/admin-sdk';

class FakeSnapshot {
  constructor(private readonly value: Record<string, unknown> | null) {}
  get exists() { return this.value !== null; }
  data() { return this.value ?? undefined; }
}

function subscription(planId: CanonicalPlanId) {
  return {
    planId,
    status: 'active',
    catalogVersion: ENTITLEMENTS_CATALOG_VERSION,
    catalogFingerprint: catalogFingerprintFor(planId),
    entitlements: catalogEntitlementsFor(planId),
  };
}

function fakeDb(input: {
  planId?: CanonicalPlanId;
  config?: object | null;
  features?: Record<string, unknown>;
}) {
  const org = { billingPlan: input.planId ?? 'control', features: input.features ?? {} };
  const values: Record<string, Record<string, unknown> | null> = {
    'organizations/org-1': org,
    'organizations/org-1/subscription/current': input.planId ? subscription(input.planId) : null,
    'system/entitlements': input.config === undefined
      ? { enforcementMode: 'active', catalogVersion: ENTITLEMENTS_CATALOG_VERSION }
      : input.config as Record<string, unknown> | null,
  };
  return {
    doc(path: string) {
      return { get: async () => new FakeSnapshot(values[path] ?? null) };
    },
    collection() {
      return { get: async () => ({ docs: [] }) };
    },
  };
}

const validConfig: Record<string, unknown> = {
  enforcementMode: 'active',
  catalogVersion: ENTITLEMENTS_CATALOG_VERSION,
};

function membership(input: Partial<MembershipValidation> = {}): MembershipValidation {
  return {
    valid: true,
    role: 'viewer',
    userOverrides: null,
    userGrants: null,
    ...input,
  };
}

function guard(membershipValue: MembershipValidation) {
  return async () => ({
    ok: true as const,
    auth: { uid: 'user-1' },
    membership: membershipValue,
    orgId: 'org-1',
  });
}

const rateAllowed = () => ({
  allowed: true as const,
  remaining: 59,
  resetAt: Date.now() + 60_000,
  retryAfterSeconds: 0,
});

const rateDenied = () => ({
  allowed: false as const,
  remaining: 0,
  resetAt: Date.now() + 2_000,
  retryAfterSeconds: 2,
});

function aiRequest(path: string) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify(path.includes('infer-contact') ? {
      orgId: 'org-1',
      description: 'Quota soci',
      contacts: [{ id: 'contact-1', name: 'Persona' }],
    } : {
      orgId: 'org-1',
      description: 'Material oficina',
      amount: -20,
      expenseOptions: [{ id: 'expense-1', name: 'Material' }],
      incomeOptions: [],
    }),
  });
}

test('categorize endpoint aplica pla AND moviments.editar abans de rate limit o IA', async () => {
  const scenarios = [
    { name: 'Control', planId: 'control' as const, member: membership({ role: 'admin' }), status: 403 },
    { name: 'Management viewer', planId: 'management' as const, member: membership(), status: 403 },
    { name: 'Management grant', planId: 'management' as const, member: membership({ role: 'user', userGrants: ['moviments.editar'] }), status: 200 },
    { name: 'Management deny override', planId: 'management' as const, member: membership({ role: 'admin', userOverrides: { deny: ['moviments.editar'] } }), status: 403 },
  ];

  for (const scenario of scenarios) {
    let rateLimitCalls = 0;
    let aiCalls = 0;
    const response = await handleCategorizeTransactionPost(aiRequest('/api/ai/categorize-transaction'), {
      requireOrgMembershipFn: guard(scenario.member) as never,
      getAdminDbFn: () => fakeDb({ planId: scenario.planId, config: validConfig }) as never,
      resolveApiKeyFn: () => 'test-key',
      checkRateLimitFn: () => { rateLimitCalls += 1; return rateAllowed(); },
      categorizeFn: async () => { aiCalls += 1; return { categoryId: 'expense-1', confidence: 0.9 }; },
    });
    assert.equal(response.status, scenario.status, scenario.name);
    assert.equal(rateLimitCalls, scenario.status === 200 ? 1 : 0, `${scenario.name}: rate limit post-gate`);
    assert.equal(aiCalls, scenario.status === 200 ? 1 : 0, `${scenario.name}: IA post-gate`);
  }
});

test('categorize endpoint denega config absent/v1/v2/corrupt i explicit v3 off conserva funció', async () => {
  const configs: Array<{ name: string; config: Record<string, unknown> | null; status: number }> = [
    { name: 'absent', config: null, status: 403 },
    { name: 'v1', config: { enforcementMode: 'active', catalogVersion: 1 }, status: 403 },
    { name: 'v2 incompatible', config: { enforcementMode: 'off', catalogVersion: 2 }, status: 403 },
    { name: 'corrupt', config: { enforcementMode: 'mystery', catalogVersion: 3 }, status: 403 },
    { name: 'v3 off', config: { enforcementMode: 'off', catalogVersion: 3 }, status: 200 },
  ];
  for (const scenario of configs) {
    let aiCalls = 0;
    const response = await handleCategorizeTransactionPost(aiRequest('/api/ai/categorize-transaction'), {
      requireOrgMembershipFn: guard(membership({ role: 'admin' })) as never,
      getAdminDbFn: () => fakeDb({ planId: 'control', config: scenario.config }) as never,
      resolveApiKeyFn: () => 'test-key',
      checkRateLimitFn: rateAllowed,
      categorizeFn: async () => { aiCalls += 1; return { categoryId: 'expense-1', confidence: 0.9 }; },
    });
    assert.equal(response.status, scenario.status, scenario.name);
    assert.equal(aiCalls, scenario.status === 200 ? 1 : 0, scenario.name);
  }
});

test('categorize endpoint valida auth/input i rate limit només després del gate', async () => {
  const unauthorized = await handleCategorizeTransactionPost(aiRequest('/api/ai/categorize-transaction'), {
    requireOrgMembershipFn: async () => ({ ok: false, status: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' }),
  });
  assert.equal(unauthorized.status, 401);

  const invalid = await handleCategorizeTransactionPost(new NextRequest('http://localhost/api/ai/categorize-transaction', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  }));
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, 'INVALID_INPUT');

  let aiCalls = 0;
  const limited = await handleCategorizeTransactionPost(aiRequest('/api/ai/categorize-transaction'), {
    requireOrgMembershipFn: guard(membership({ role: 'admin' })) as never,
    getAdminDbFn: () => fakeDb({ planId: 'management', config: validConfig }) as never,
    resolveApiKeyFn: () => 'test-key',
    checkRateLimitFn: rateDenied,
    categorizeFn: async () => { aiCalls += 1; return null; },
  });
  assert.equal(limited.status, 429);
  assert.equal(aiCalls, 0);
});

test('infer-contact endpoint replica permís, entitlement, config i ordre del rate limit', async () => {
  const scenarios = [
    { name: 'Control', planId: 'control' as const, member: membership({ role: 'admin' }), config: validConfig, status: 403 },
    { name: 'Management viewer', planId: 'management' as const, member: membership(), config: validConfig, status: 403 },
    { name: 'Management grant', planId: 'management' as const, member: membership({ role: 'user', userGrants: ['moviments.editar'] }), config: validConfig, status: 200 },
    { name: 'deny override', planId: 'management' as const, member: membership({ role: 'admin', userOverrides: { deny: ['moviments.editar'] } }), config: validConfig, status: 403 },
    { name: 'config absent', planId: 'management' as const, member: membership({ role: 'admin' }), config: null, status: 403 },
    { name: 'v3 off', planId: 'control' as const, member: membership({ role: 'admin' }), config: { enforcementMode: 'off', catalogVersion: 3 }, status: 200 },
  ];
  for (const scenario of scenarios) {
    let rateCalls = 0;
    let inferCalls = 0;
    const response = await handleInferContactPost(aiRequest('/api/ai/infer-contact'), {
      requireOrgMembershipFn: guard(scenario.member) as never,
      getAdminDbFn: () => fakeDb({ planId: scenario.planId, config: scenario.config }) as never,
      checkRateLimitFn: () => { rateCalls += 1; return rateAllowed(); },
      inferContactFn: async () => { inferCalls += 1; return { contactId: 'contact-1', confidence: 0.9 }; },
    });
    assert.equal(response.status, scenario.status, scenario.name);
    assert.equal(rateCalls, scenario.status === 200 ? 1 : 0, scenario.name);
    assert.equal(inferCalls, scenario.status === 200 ? 1 : 0, scenario.name);
  }
});

function model347Request() {
  return new NextRequest('http://localhost/api/fiscal/model347/generate', {
    method: 'POST',
    headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgId: 'org-1', year: 2025 }),
  });
}

test('Model347 endpoint exigeix permisos efectius i Management+ abans de generar', async () => {
  const allGrants = ['fiscal.model347.generar', 'moviments.read', 'informes.exportar'];
  const scenarios = [
    { name: 'Control admin', planId: 'control' as const, member: membership({ role: 'admin' }), status: 403 },
    { name: 'viewer', planId: 'management' as const, member: membership(), status: 403 },
    { name: 'grants explícits', planId: 'management' as const, member: membership({ role: 'user', userGrants: allGrants }), status: 200 },
    { name: 'deny fiscal', planId: 'management' as const, member: membership({ role: 'admin', userOverrides: { deny: ['fiscal.model347.generar'] } }), status: 403 },
    { name: 'deny export', planId: 'management' as const, member: membership({ role: 'admin', userOverrides: { deny: ['informes.exportar'] } }), status: 403 },
    { name: 'deny ledger read', planId: 'management' as const, member: membership({ role: 'admin', userOverrides: { deny: ['moviments.read'] } }), status: 403 },
  ];
  for (const scenario of scenarios) {
    let generateCalls = 0;
    const response = await handleModel347Post(model347Request(), {
      verifyIdTokenFn: async () => ({ uid: 'user-1' }),
      getAdminDbFn: () => fakeDb({ planId: scenario.planId, config: validConfig }) as never,
      validateUserMembershipFn: async () => scenario.member,
      generateExportFn: (() => { generateCalls += 1; return { content: '', excluded: [] }; }) as never,
    });
    assert.equal(response.status, scenario.status, scenario.name);
    assert.equal(generateCalls, scenario.status === 200 ? 1 : 0, scenario.name);
  }
});

test('Model347 endpoint fail-safe config i v3 off compatible sense saltar permisos', async () => {
  const configs: Array<{ name: string; config: Record<string, unknown> | null; role: MembershipValidation; status: number }> = [
    { name: 'absent', config: null, role: membership({ role: 'admin' }), status: 403 },
    { name: 'v1', config: { enforcementMode: 'active', catalogVersion: 1 }, role: membership({ role: 'admin' }), status: 403 },
    { name: 'v2 incompatible', config: { enforcementMode: 'off', catalogVersion: 2 }, role: membership({ role: 'admin' }), status: 403 },
    { name: 'corrupt', config: { enforcementMode: 'broken', catalogVersion: 3 }, role: membership({ role: 'admin' }), status: 403 },
    { name: 'v3 off admin', config: { enforcementMode: 'off', catalogVersion: 3 }, role: membership({ role: 'admin' }), status: 200 },
    { name: 'v3 off viewer', config: { enforcementMode: 'off', catalogVersion: 3 }, role: membership(), status: 403 },
  ];
  for (const scenario of configs) {
    let generateCalls = 0;
    const response = await handleModel347Post(model347Request(), {
      verifyIdTokenFn: async () => ({ uid: 'user-1' }),
      getAdminDbFn: () => fakeDb({ planId: 'control', config: scenario.config }) as never,
      validateUserMembershipFn: async () => scenario.role,
      generateExportFn: (() => { generateCalls += 1; return { content: '', excluded: [] }; }) as never,
    });
    assert.equal(response.status, scenario.status, scenario.name);
    assert.equal(generateCalls, scenario.status === 200 ? 1 : 0, scenario.name);
  }
});

test('UI i importador bloquegen IA abans de decisions locals, writes o fetch', async () => {
  const [hookSource, importerSource, rowSource, filtersSource] = await Promise.all([
    readFile(path.join(process.cwd(), 'src/components/transactions/hooks/useTransactionCategorization.ts'), 'utf8'),
    readFile(path.join(process.cwd(), 'src/components/transaction-importer.tsx'), 'utf8'),
    readFile(path.join(process.cwd(), 'src/components/transactions/components/TransactionRow.tsx'), 'utf8'),
    readFile(path.join(process.cwd(), 'src/components/transactions/components/TransactionsFilters.tsx'), 'utf8'),
  ]);
  const singleHandler = hookSource.slice(
    hookSource.indexOf('const handleCategorize ='),
    hookSource.indexOf('const handleBatchCategorize =')
  );
  assert.ok(singleHandler.indexOf('if (!canExecuteAiCategorization)') < singleHandler.indexOf('resolveAutomaticCategoryDecision'));
  assert.ok(singleHandler.indexOf('if (!canExecuteAiCategorization)') < singleHandler.indexOf('updateDocumentNonBlocking'));
  assert.match(importerSource, /canUseCapability\('aiCategorization\.execute',[\s\S]*?userAllowed: can\('moviments\.editar'\)/);
  assert.match(importerSource, /if \(canExecuteAiCategorization && availableContacts/);
  assert.match(importerSource, /if \(canExecuteAiCategorization && availableCategories/);
  assert.match(importerSource, /canUseCapability\('pendingDocuments\.match',[\s\S]*?operationalEnabled: organization\?\.features\?\.pendingDocs \?\? false,[\s\S]*?userAllowed: can\('moviments\.editar'\)/);
  assert.match(importerSource, /if \(canSuggestPendingDocumentMatches && newTransactions\.length > 0 && availableContacts\)/);
  assert.match(rowSource, /canCategorizeWithAi && <CommandGroup>/);
  assert.match(filtersSource, /canExecuteAiCategorization && <div/);
});
