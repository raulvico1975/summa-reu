import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { handlePrivateDonationClassificationPlan } from '@/app/api/integrations/private/donations/classification/plan/handler';
import { handlePrivateDonationClassificationApply } from '@/app/api/integrations/private/donations/classification/apply/handler';
import {
  hashIntegrationToken,
  type IntegrationAuditEntry,
  type IntegrationAuthRepository,
  type IntegrationScope,
  type IntegrationTokenRecord,
} from '@/lib/api/integration-auth';
import type { Firestore } from 'firebase-admin/firestore';
import type { AnyContact, Transaction } from '@/lib/data';
import {
  applyDonationClassificationPlan,
  prepareDonationClassificationPlan,
  validateDonationClassificationClaim,
  type DonationClassificationAtomicExecutor,
  type DonationClassificationClaimArgs,
  type DonationClassificationPlan,
  type DonationClassificationPlanStore,
} from '@/lib/private-integrations/donation-classification-plan';
import { createFirestoreDonationClassificationExecutor } from '@/lib/private-integrations/firestore-donation-classification';
import type { PrepareEntityDataSource } from '@/lib/private-integrations/prepare-only';

const NOW = new Date('2026-08-03T13:00:00.000Z');

function movement(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-a',
    date: '2026-08-01T00:00:00.000Z',
    description: 'TRANSFERENCIA FUNDACION TIPSA',
    amount: 20_000,
    bankAccountId: 'bank-main',
    source: 'bank',
    transactionType: 'normal',
    ...overrides,
  } as Transaction;
}

function donor(overrides: Partial<AnyContact> = {}): AnyContact {
  return {
    id: 'donor-a',
    name: 'Fundación Tipsa',
    type: 'donor',
    roles: { donor: true },
    ...overrides,
  } as AnyContact;
}

function dataSource(tx: Transaction | null = movement(), contact: AnyContact | null = donor()): PrepareEntityDataSource {
  return {
    async getTransaction() { return tx; },
    async getContact() { return contact; },
    async getOrganization() { return null; },
  };
}

class MemoryStore implements DonationClassificationPlanStore {
  plan: DonationClassificationPlan | null = null;
  async create(plan: DonationClassificationPlan) { this.plan = structuredClone(plan); }
  async claim(args: DonationClassificationClaimArgs) {
    if (!this.plan) return { ok: false as const, code: 'PLAN_NOT_FOUND' };
    const code = validateDonationClassificationClaim(this.plan, args);
    if (code) return { ok: false as const, code };
    this.plan.status = 'processing';
    return { ok: true as const, plan: structuredClone(this.plan) };
  }
  async complete(args: { planId: string; now: string; before: Record<string, unknown>; after: Record<string, unknown> }) {
    assert.equal(this.plan?.planId, args.planId);
    if (!this.plan) return;
    this.plan.status = 'consumed';
    this.plan.consumedAt = args.now;
    this.plan.before = args.before;
    this.plan.after = args.after;
  }
  async block(args: { planId: string; now: string; reason: string }) {
    assert.equal(this.plan?.planId, args.planId);
    if (!this.plan) return;
    this.plan.status = 'blocked';
    this.plan.blockedAt = args.now;
    this.plan.blockedReason = args.reason;
  }
}

class MemoryAuth implements IntegrationAuthRepository {
  audits: IntegrationAuditEntry[] = [];
  constructor(readonly token: IntegrationTokenRecord) {}
  async findTokenByHash(value: string) { return value === this.token.tokenHash ? this.token : null; }
  async touchTokenLastUsed() { /* no-op */ }
  async recordAudit(entry: IntegrationAuditEntry) { this.audits.push(entry); }
}
function authToken(scopes: IntegrationScope[], orgId = 'org-a'): IntegrationTokenRecord {
  return {
    id: 'token-a', tokenType: 'private_integration', orgId,
    tokenHash: hashIntegrationToken('secret-a'), scopes, status: 'active',
    createdAt: null, createdBy: 'test', lastUsedAt: null, label: 'test', sourceRepo: 'test',
  };
}
function request(path: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST', headers: { Authorization: 'Bearer secret-a', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function prepared(store = new MemoryStore(), source = dataSource()) {
  const result = await prepareDonationClassificationPlan({
    orgId: 'org-a', tokenId: 'token-a', transactionId: 'tx-a', donorId: 'donor-a',
    now: NOW, planIdFactory: () => 'fixed-plan',
  }, source, store);
  assert.equal(result.prepared, true);
  if (!result.prepared) throw new Error('prepare failed');
  return { store, plan: result.plan };
}

function applyInput(plan: DonationClassificationPlan): DonationClassificationClaimArgs {
  return {
    planId: plan.planId, orgId: plan.orgId, tokenId: plan.tokenId,
    transactionId: plan.transactionId, donorId: plan.donorId,
    preconditionToken: plan.preconditionToken,
    confirmationText: plan.confirmationText,
    humanConfirmed: true,
    now: '2026-08-03T13:05:00.000Z',
  };
}

test('prepare creates a 15-minute single-movement plan without business mutation', async () => {
  const { plan } = await prepared();
  assert.equal(plan.status, 'prepared');
  assert.equal(plan.expiresAt, '2026-08-03T13:15:00.000Z');
  assert.equal(plan.transactionId, 'tx-a');
  assert.equal(plan.donorId, 'donor-a');
  assert.deepEqual(Object.keys(plan.proposedPatch).sort(), ['contactId', 'contactType', 'fiscalKind', 'transactionType']);
  assert.equal(plan.before, null);
  assert.equal(plan.after, null);
});

test('prepare reuses canonical guards for ineligible movements and donors', async () => {
  const cases: Array<[PrepareEntityDataSource, string]> = [
    [dataSource(movement({ archivedAt: '2026-01-01' })), 'TRANSACTION_ARCHIVED'],
    [dataSource(movement({ donationStatus: 'returned' })), 'TRANSACTION_RETURNED'],
    [dataSource(movement({ amount: 0 })), 'NON_POSITIVE_AMOUNT'],
    [dataSource(movement({ contactId: 'other' })), 'TRANSACTION_LINKED_TO_OTHER_CONTACT'],
    [dataSource(movement(), null), 'DONOR_NOT_FOUND'],
    [dataSource(movement(), donor({ archivedAt: '2026-01-01' })), 'DONOR_ARCHIVED'],
    [dataSource(movement(), donor({ type: 'supplier', roles: { donor: false } } as Partial<AnyContact>)), 'CONTACT_NOT_DONOR'],
  ];
  for (const [source, blocker] of cases) {
    const result = await prepareDonationClassificationPlan({
      orgId: 'org-a', tokenId: 'token-a', transactionId: 'tx-a', donorId: 'donor-a', now: NOW,
    }, source, new MemoryStore());
    assert.equal(result.prepared, false);
    assert.equal(result.blockers.includes(blocker), true);
  }
});

test('apply rejects confirmation, expiry and every plan binding mismatch', async () => {
  const { store, plan } = await prepared();
  const base = applyInput(plan);
  const cases: Array<[DonationClassificationClaimArgs, string]> = [
    [{ ...base, humanConfirmed: false }, 'HUMAN_CONFIRMATION_REQUIRED'],
    [{ ...base, confirmationText: 'sí' }, 'HUMAN_CONFIRMATION_REQUIRED'],
    [{ ...base, tokenId: 'token-b' }, 'PLAN_TOKEN_MISMATCH'],
    [{ ...base, orgId: 'org-b' }, 'PLAN_ORG_MISMATCH'],
    [{ ...base, transactionId: 'tx-b' }, 'PLAN_TRANSACTION_MISMATCH'],
    [{ ...base, donorId: 'donor-b' }, 'PLAN_DONOR_MISMATCH'],
    [{ ...base, preconditionToken: 'pre_wrong' }, 'PRECONDITION_MISMATCH'],
    [{ ...base, now: '2026-08-03T13:16:00.000Z' }, 'PLAN_EXPIRED'],
  ];
  const never: DonationClassificationAtomicExecutor = { async apply() { throw new Error('must not apply'); } };
  for (const [input, code] of cases) {
    const result = await applyDonationClassificationPlan(input, store, never);
    assert.deepEqual(result, { applied: false, code });
    assert.equal(store.plan?.status, 'prepared');
  }
});

class FakeAtomicFirestore {
  readonly records = new Map<string, Record<string, unknown>>();
  readonly updates: Array<{ path: string; patch: Record<string, unknown> }> = [];
  doc(path: string) { return { path, id: path.split('/').at(-1) ?? '' }; }
  async runTransaction<T>(callback: (tx: {
    get(ref: { path: string; id: string }): Promise<{ exists: boolean; id: string; data(): Record<string, unknown> | undefined }>;
    update(ref: { path: string }, patch: Record<string, unknown>): void;
  }) => Promise<T>) {
    return callback({
      get: async (ref) => {
        const value = this.records.get(ref.path);
        return { exists: Boolean(value), id: ref.id, data: () => value };
      },
      update: (ref, patch) => {
        this.updates.push({ path: ref.path, patch });
        this.records.set(ref.path, { ...(this.records.get(ref.path) ?? {}), ...patch });
      },
    });
  }
}

function fakeWith(tx = movement(), contact = donor()) {
  const fake = new FakeAtomicFirestore();
  const { id: _txId, ...txData } = tx;
  const { id: _donorId, ...donorData } = contact;
  fake.records.set('organizations/org-a/transactions/tx-a', txData as Record<string, unknown>);
  fake.records.set('organizations/org-a/contacts/donor-a', donorData as Record<string, unknown>);
  return fake;
}

test('atomic executor writes exactly the four authorized fields and detects drift', async () => {
  const { plan } = await prepared();
  const successDb = fakeWith();
  const executor = createFirestoreDonationClassificationExecutor(successDb as unknown as Firestore);
  const success = await executor.apply(plan);
  assert.equal(success.ok, true);
  assert.equal(successDb.updates.length, 1);
  assert.deepEqual(Object.keys(successDb.updates[0].patch).sort(), ['contactId', 'contactType', 'fiscalKind', 'transactionType']);
  assert.equal(Object.values(successDb.updates[0].patch).includes(undefined), false);

  const driftDb = fakeWith(movement({ amount: 19_999 }));
  const drift = await createFirestoreDonationClassificationExecutor(driftDb as unknown as Firestore).apply(plan);
  assert.deepEqual(drift, { ok: false, code: 'PRECONDITION_DRIFT' });
  assert.equal(driftDb.updates.length, 0);
});

test('successful apply consumes the plan once and records before/after', async () => {
  const { store, plan } = await prepared();
  let calls = 0;
  const executor: DonationClassificationAtomicExecutor = {
    async apply() {
      calls += 1;
      return {
        ok: true,
        before: { transactionType: 'normal' },
        after: { transactionType: 'donation', contactId: 'donor-a' },
      };
    },
  };
  const first = await applyDonationClassificationPlan(applyInput(plan), store, executor);
  assert.equal(first.applied, true);
  const second = await applyDonationClassificationPlan(applyInput(plan), store, executor);
  assert.deepEqual(second, { applied: false, code: 'PLAN_ALREADY_USED' });
  assert.equal(calls, 1);
  assert.equal(store.plan?.status, 'consumed');
  assert.equal(store.plan?.after?.transactionType, 'donation');
});

test('private plan/apply handlers enforce separate scopes, org isolation and audit', async () => {
  const body = { orgId: 'org-a', transactionId: 'tx-a', donorId: 'donor-a' };
  const deniedAuth = new MemoryAuth(authToken(['donation_classification.prepare']));
  const denied = await handlePrivateDonationClassificationApply(
    request('/api/integrations/private/donations/classification/apply', {
      ...body, planId: 'plan-a', preconditionToken: 'pre-a', confirmationText: 'CONFIRMO', humanConfirmed: true,
    }),
    { authRepository: deniedAuth, planStore: new MemoryStore(), executor: { async apply() { throw new Error('no'); } } }
  );
  assert.equal(denied.status, 403);
  assert.equal(deniedAuth.audits[0]?.result, 'scope_denied');

  const wrongOrgAuth = new MemoryAuth(authToken(['donation_classification.prepare'], 'org-b'));
  const wrongOrg = await handlePrivateDonationClassificationPlan(
    request('/api/integrations/private/donations/classification/plan', body),
    { authRepository: wrongOrgAuth, dataSource: dataSource(), planStore: new MemoryStore() }
  );
  assert.equal(wrongOrg.status, 403);
  assert.equal(wrongOrgAuth.audits[0]?.result, 'org_denied');

  const store = new MemoryStore();
  const prepareAuth = new MemoryAuth(authToken(['donation_classification.prepare']));
  const preparedResponse = await handlePrivateDonationClassificationPlan(
    request('/api/integrations/private/donations/classification/plan', body),
    {
      authRepository: prepareAuth, dataSource: dataSource(), planStore: store,
      now: NOW, planIdFactory: () => 'handler-plan',
    }
  );
  assert.equal(preparedResponse.status, 201);
  const preparedBody = await preparedResponse.json();
  assert.equal(preparedBody.effects.businessDataMutated, false);
  assert.equal(prepareAuth.audits[0]?.code, 'PLAN_PREPARED');

  const plan = store.plan!;
  const applyAuth = new MemoryAuth(authToken(['donation_classification.apply']));
  const appliedResponse = await handlePrivateDonationClassificationApply(
    request('/api/integrations/private/donations/classification/apply', {
      orgId: plan.orgId, planId: plan.planId, transactionId: plan.transactionId,
      donorId: plan.donorId, preconditionToken: plan.preconditionToken,
      confirmationText: plan.confirmationText, humanConfirmed: true,
    }),
    {
      authRepository: applyAuth, planStore: store,
      executor: {
        async apply() {
          return {
            ok: true, before: { transactionType: 'normal' },
            after: { contactId: 'donor-a', contactType: 'donor', transactionType: 'donation', fiscalKind: 'donation' },
          };
        },
      },
      now: new Date('2026-08-03T13:05:00.000Z'),
    }
  );
  assert.equal(appliedResponse.status, 200);
  const appliedBody = await appliedResponse.json();
  assert.deepEqual(appliedBody.effects.fieldsWritten, ['contactId', 'contactType', 'transactionType', 'fiscalKind']);
  assert.equal(applyAuth.audits[0]?.code, 'CLASSIFICATION_APPLIED');
});
