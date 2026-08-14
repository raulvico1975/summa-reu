import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { handleExtractTicketPost } from '@/app/api/ai/extract-ticket/handler';
import { catalogEntitlementsFor, catalogFingerprintFor, ENTITLEMENTS_CATALOG_VERSION } from '@/lib/entitlements/catalog';
import type { CanonicalPlanId } from '@/lib/entitlements/types';
import type { MembershipValidation } from '@/lib/api/admin-sdk';

class FakeSnapshot {
  constructor(private readonly value: Record<string, unknown> | null) {}
  get exists() { return this.value !== null; }
  data() { return this.value ?? undefined; }
}

function fakeDb(input: {
  planId: CanonicalPlanId;
  config?: Record<string, unknown> | null;
  pendingDocs?: boolean;
}) {
  const values: Record<string, Record<string, unknown> | null> = {
    'organizations/org-1': {
      billingPlan: input.planId,
      features: { pendingDocs: input.pendingDocs ?? true },
    },
    'organizations/org-1/subscription/current': {
      planId: input.planId,
      status: 'active',
      catalogVersion: ENTITLEMENTS_CATALOG_VERSION,
      catalogFingerprint: catalogFingerprintFor(input.planId),
      entitlements: catalogEntitlementsFor(input.planId),
    },
    'system/entitlements': input.config === undefined
      ? { enforcementMode: 'active', catalogVersion: ENTITLEMENTS_CATALOG_VERSION }
      : input.config,
    'organizations/org-1/pendingDocuments/pending-1': {
      file: { storagePath: 'organizations/org-1/pendingDocuments/pending-1/ticket.jpg' },
    },
  };
  const db = {
    doc(path: string) {
      return { path, get: async () => new FakeSnapshot(values[path] ?? null) };
    },
    async runTransaction<T>(callback: (transaction: {
      get(ref: { get(): Promise<FakeSnapshot> }): Promise<FakeSnapshot>;
      update(ref: unknown, updates: Record<string, unknown>): void;
    }) => Promise<T>) {
      return callback({
        get: (ref) => ref.get(),
        update: () => undefined,
      });
    },
  };
  return db;
}

function member(input: Partial<MembershipValidation> = {}): MembershipValidation {
  return {
    valid: true,
    role: 'admin',
    userOverrides: null,
    userGrants: null,
    ...input,
  };
}

function request() {
  return new NextRequest('http://localhost/api/ai/extract-ticket', {
    method: 'POST',
    headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orgId: 'org-1',
      docId: 'pending-1',
      storagePath: 'organizations/org-1/pendingDocuments/pending-1/ticket.jpg',
      context: 'movements',
      target: 'pending',
    }),
  });
}

const rateAllowed = () => ({
  allowed: true as const,
  remaining: 29,
  resetAt: Date.now() + 60_000,
  retryAfterSeconds: 0,
});

test('OCR exigeix Complete, permís efectiu i feature abans de key/rate/fetch/IA', async () => {
  const previousBucket = process.env.FIREBASE_STORAGE_BUCKET;
  process.env.FIREBASE_STORAGE_BUCKET = 'test-bucket';
  try {
    const scenarios = [
      { name: 'Control admin', plan: 'control' as const, membership: member(), pendingDocs: true, status: 403 },
      { name: 'Management admin', plan: 'management' as const, membership: member(), pendingDocs: true, status: 403 },
      { name: 'Complete viewer', plan: 'complete' as const, membership: member({ role: 'viewer' }), pendingDocs: true, status: 403 },
      { name: 'Complete deny override', plan: 'complete' as const, membership: member({ userOverrides: { deny: ['moviments.editar', 'projectes.manage'] } }), pendingDocs: true, status: 403 },
      { name: 'Complete feature off', plan: 'complete' as const, membership: member(), pendingDocs: false, status: 403 },
      { name: 'Complete admin', plan: 'complete' as const, membership: member(), pendingDocs: true, status: 200 },
    ];

    for (const scenario of scenarios) {
      let apiKeyCalls = 0;
      let rateCalls = 0;
      let fetchCalls = 0;
      let aiCalls = 0;
      const response = await handleExtractTicketPost(request(), {
        requireOrgMembershipFn: (async () => ({
          ok: true as const,
          auth: { uid: 'user-1' },
          membership: scenario.membership,
          orgId: 'org-1',
        })) as never,
        getAdminDbFn: () => fakeDb({ planId: scenario.plan, pendingDocs: scenario.pendingDocs }) as never,
        resolveApiKeyFn: () => { apiKeyCalls += 1; return 'test-key'; },
        checkRateLimitFn: () => { rateCalls += 1; return rateAllowed(); },
        getStorageFileFn: () => ({
          getMetadata: async () => [{ size: 4 }],
          download: async () => {
          fetchCalls += 1;
            return [Buffer.from([0xff, 0xd8, 0xff, 0x00])];
          },
        }),
        extractTicketFn: async () => {
          aiCalls += 1;
          return { date: null, amount: 12, currency: 'EUR', merchant: 'Botiga', concept: 'Material', confidence: 0.9 };
        },
      });
      assert.equal(response.status, scenario.status, scenario.name);
      const expectedCalls = scenario.status === 200 ? 1 : 0;
      assert.equal(apiKeyCalls, expectedCalls, `${scenario.name}: API key post-gate`);
      assert.equal(rateCalls, expectedCalls, `${scenario.name}: rate post-gate`);
      assert.equal(fetchCalls, expectedCalls, `${scenario.name}: fetch post-gate`);
      assert.equal(aiCalls, expectedCalls, `${scenario.name}: AI post-gate`);
    }
  } finally {
    if (previousBucket === undefined) delete process.env.FIREBASE_STORAGE_BUCKET;
    else process.env.FIREBASE_STORAGE_BUCKET = previousBucket;
  }
});

test('OCR fail-safe amb config absent/v1/v2/corrupt; off v3 conserva la funció', async () => {
  const previousBucket = process.env.FIREBASE_STORAGE_BUCKET;
  process.env.FIREBASE_STORAGE_BUCKET = 'test-bucket';
  try {
    const configs: Array<{ name: string; config: Record<string, unknown> | null; status: number }> = [
      { name: 'absent', config: null, status: 403 },
      { name: 'v1', config: { enforcementMode: 'active', catalogVersion: 1 }, status: 403 },
      { name: 'v2 incompatible', config: { enforcementMode: 'off', catalogVersion: 2 }, status: 403 },
      { name: 'corrupt', config: { enforcementMode: 'broken', catalogVersion: 3 }, status: 403 },
      { name: 'explicit v3 off', config: { enforcementMode: 'off', catalogVersion: 3 }, status: 200 },
    ];
    for (const scenario of configs) {
      let aiCalls = 0;
      const response = await handleExtractTicketPost(request(), {
        requireOrgMembershipFn: (async () => ({
          ok: true as const,
          auth: { uid: 'user-1' },
          membership: member(),
          orgId: 'org-1',
        })) as never,
        getAdminDbFn: () => fakeDb({ planId: 'control', config: scenario.config }) as never,
        resolveApiKeyFn: () => 'test-key',
        checkRateLimitFn: rateAllowed,
        getStorageFileFn: () => ({
          getMetadata: async () => [{ size: 4 }],
          download: async () => [Buffer.from([0xff, 0xd8, 0xff, 0x00])],
        }),
        extractTicketFn: async () => {
          aiCalls += 1;
          return { date: null, amount: null, currency: null, merchant: null, concept: null, confidence: 0 };
        },
      });
      assert.equal(response.status, scenario.status, scenario.name);
      assert.equal(aiCalls, scenario.status === 200 ? 1 : 0, scenario.name);
    }
  } finally {
    if (previousBucket === undefined) delete process.env.FIREBASE_STORAGE_BUCKET;
    else process.env.FIREBASE_STORAGE_BUCKET = previousBucket;
  }
});

test('UI OCR no fa fetch si no hi ha capability i no mostra el trigger', async () => {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const [tickets, quickExpense, quickPage] = await Promise.all([
    readFile(path.join(process.cwd(), 'src/components/expense-reports/tickets-inbox.tsx'), 'utf8'),
    readFile(path.join(process.cwd(), 'src/components/project-module/quick-expense-screen.tsx'), 'utf8'),
    readFile(path.join(process.cwd(), 'src/app/[orgSlug]/quick-expense/page.tsx'), 'utf8'),
  ]);
  const ticketHandler = tickets.slice(tickets.indexOf('const handleProcessWithAI'), tickets.indexOf('// Aplicar resultats'));
  const quickHandler = quickExpense.slice(quickExpense.indexOf('const extractWithAI'), quickExpense.indexOf('// ---------------------------------------------------------------------------\n  // FILE UPLOAD'));
  assert.ok(ticketHandler.indexOf('if (!canUseOcr) return') < ticketHandler.indexOf("fetch('/api/ai/extract-ticket'"));
  assert.match(tickets, /\{canUseOcr && \([\s\S]*?handleProcessWithAI/);
  assert.ok(quickHandler.indexOf('if (!canUseOcr) return') < quickHandler.indexOf("fetch('/api/ai/extract-ticket'"));
  assert.match(quickPage, /canUseCapability\('pendingDocuments\.ocr',[\s\S]*?userAllowed:/);
});
