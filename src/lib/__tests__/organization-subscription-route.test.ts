import assert from 'node:assert/strict';
import test from 'node:test';
import { handleOrganizationSubscriptionPost, parseSubscriptionUpdateInput } from '@/app/api/admin/organization-subscription/handler';

class FakeDb {
  readonly docs = new Map<string, Record<string, unknown>>();

  constructor(seed: Record<string, Record<string, unknown>>, private readonly failWrites = false) {
    for (const [path, data] of Object.entries(seed)) this.docs.set(path, structuredClone(data));
  }

  doc(path: string) { return { path }; }

  async runTransaction<T>(callback: (transaction: {
    get(ref: { path: string }): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
    update(ref: { path: string }, data: Record<string, unknown>): void;
    set(ref: { path: string }, data: Record<string, unknown>): void;
    create(ref: { path: string }, data: Record<string, unknown>): void;
  }) => Promise<T>): Promise<T> {
    const staged = new Map(this.docs);
    const result = await callback({
      get: async (ref) => {
        const data = staged.get(ref.path);
        return { exists: !!data, data: () => data };
      },
      update: (ref, data) => {
        if (this.failWrites) throw new Error('injected write failure');
        const current = staged.get(ref.path);
        if (!current) throw new Error('missing update');
        staged.set(ref.path, { ...current, ...structuredClone(data) });
      },
      set: (ref, data) => staged.set(ref.path, structuredClone(data)),
      create: (ref, data) => {
        if (staged.has(ref.path)) throw new Error('already exists');
        staged.set(ref.path, structuredClone(data));
      },
    });
    this.docs.clear();
    for (const [path, data] of staged) this.docs.set(path, data);
    return result;
  }
}

function request(body: Record<string, unknown>) {
  return {
    headers: new Headers({ Authorization: 'Bearer token' }),
    json: async () => body,
  } as never;
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    orgId: 'org-1',
    planId: 'management',
    status: 'active',
    reason: 'Canvi aprovat',
    idempotencyKey: 'change_12345678',
    billingMonthlyAmount: 79,
    billingImplantationAmount: 0,
    billingContactEmail: null,
    billingStartedAt: null,
    billingNotes: null,
    ...overrides,
  };
}

const deps = (db: FakeDb) => ({
  db: db as never,
  now: () => new Date('2026-08-14T10:00:00.000Z'),
  verifyIdTokenFn: async () => ({ uid: 'super-1', email: 'admin@example.org' }),
  isSuperAdminFn: async () => true,
});

test('valida aliases legacy però rebutja none i estats desconeguts', () => {
  assert.equal(parseSubscriptionUpdateInput(validBody({ planId: 'initial' }))?.planId, 'control');
  assert.equal(parseSubscriptionUpdateInput(validBody({ planId: 'fiscal_documents' }))?.planId, 'complete');
  assert.equal(parseSubscriptionUpdateInput(validBody({ planId: 'none' })), null);
  assert.equal(parseSubscriptionUpdateInput(validBody({ status: 'mystery' })), null);
  for (const status of ['trial', 'active', 'past_due', 'cancelled']) {
    assert.equal(parseSubscriptionUpdateInput(validBody({ status }))?.status, status);
  }
});

test('upgrade escriu root legacy, snapshot canònic i auditoria en una transacció', async () => {
  const db = new FakeDb({ 'organizations/org-1': { billingPlan: 'initial', billingStatus: 'active' } });
  const response = await handleOrganizationSubscriptionPost(request(validBody()), deps(db));
  assert.equal(response.status, 200);
  assert.equal(db.docs.get('organizations/org-1')?.billingPlan, 'management');
  const subscription = db.docs.get('organizations/org-1/subscription/current');
  assert.equal(subscription?.planId, 'management');
  assert.equal(subscription?.catalogVersion, 1);
  assert.deepEqual((subscription?.entitlements as Record<string, boolean>)['transactionDocuments.mutate'], true);
  assert.equal(db.docs.get('adminAuditLogs/plan-change_12345678')?.actorUid, 'super-1');
  assert.equal(JSON.stringify([...db.docs.values()]).includes('undefined'), false);
});

test('downgrade només actualitza root subscription i audit, sense tocar dades documentals', async () => {
  const db = new FakeDb({
    'organizations/org-1': { billingPlan: 'fiscal_documents', billingStatus: 'active' },
    'organizations/org-1/transactions/tx-1': { document: 'historic.pdf' },
  });
  await handleOrganizationSubscriptionPost(request(validBody({ planId: 'control' })), deps(db));
  assert.equal(db.docs.get('organizations/org-1')?.billingPlan, 'initial');
  assert.equal(db.docs.get('organizations/org-1/subscription/current')?.planId, 'control');
  assert.deepEqual(db.docs.get('organizations/org-1/transactions/tx-1'), { document: 'historic.pdf' });
});

test('Complete activa pending documents a l snapshot exacte del catàleg', async () => {
  const db = new FakeDb({ 'organizations/org-1': { billingPlan: 'management', billingStatus: 'active' } });
  await handleOrganizationSubscriptionPost(request(validBody({ planId: 'complete' })), deps(db));
  const entitlements = db.docs.get('organizations/org-1/subscription/current')?.entitlements as Record<string, boolean>;
  assert.equal(entitlements['transactionDocuments.mutate'], true);
  assert.equal(entitlements['pendingDocuments.mutate'], true);
});

test('replay idèntic és idempotent i mateix key amb payload diferent retorna 409', async () => {
  const db = new FakeDb({ 'organizations/org-1': { billingPlan: 'initial', billingStatus: 'active' } });
  await handleOrganizationSubscriptionPost(request(validBody()), deps(db));
  const replay = await handleOrganizationSubscriptionPost(request(validBody()), deps(db));
  assert.equal((await replay.json() as { idempotent: boolean }).idempotent, true);
  const conflict = await handleOrganizationSubscriptionPost(
    request(validBody({ planId: 'complete' })),
    deps(db)
  );
  assert.equal(conflict.status, 409);
});

test('auth i organització absent fallen sense escriptures parcials', async () => {
  const db = new FakeDb({});
  const unauthorized = await handleOrganizationSubscriptionPost(request(validBody()), {
    ...deps(db), verifyIdTokenFn: async () => null,
  });
  assert.equal(unauthorized.status, 401);
  const forbidden = await handleOrganizationSubscriptionPost(request(validBody()), {
    ...deps(db), isSuperAdminFn: async () => false,
  });
  assert.equal(forbidden.status, 403);
  const missing = await handleOrganizationSubscriptionPost(request(validBody()), deps(db));
  assert.equal(missing.status, 404);
  assert.equal(db.docs.size, 0);
});

test('fallada interna de la transacció fa rollback sense projecció ni audit parcial', async () => {
  const db = new FakeDb({
    'organizations/org-1': { billingPlan: 'initial', billingStatus: 'active' },
  }, true);
  const response = await handleOrganizationSubscriptionPost(request(validBody()), deps(db));
  assert.equal(response.status, 500);
  assert.deepEqual(db.docs.get('organizations/org-1'), { billingPlan: 'initial', billingStatus: 'active' });
  assert.equal(db.docs.has('organizations/org-1/subscription/current'), false);
  assert.equal(db.docs.has('adminAuditLogs/plan-change_12345678'), false);
});
