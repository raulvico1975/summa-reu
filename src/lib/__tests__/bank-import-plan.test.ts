import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { handlePrivateBankImportPlan } from '@/app/api/integrations/private/bank-import/plan/handler';
import { handlePrivateBankImportCommit } from '@/app/api/integrations/private/bank-import/commit/handler';
import {
  hashIntegrationToken,
  type IntegrationAuditEntry,
  type IntegrationAuthRepository,
  type IntegrationScope,
  type IntegrationTokenRecord,
} from '@/lib/api/integration-auth';
import {
  commitBankImportPlan,
  prepareBankImportPlan,
  validateBankImportPlanClaim,
  type BankImportExecutor,
  type BankImportPlan,
  type BankImportPlanClaimArgs,
  type BankImportPlanStore,
} from '@/lib/private-integrations/bank-import-plan';
import type { BankStatementPreviewDataSource } from '@/lib/private-integrations/prepare-only';
import type { Transaction } from '@/lib/data';

const NOW = new Date('2026-08-03T12:00:00.000Z');
const SHA = 'a'.repeat(64);

function file() {
  return {
    name: 'extracte-agost.csv',
    sha256: SHA,
    sizeBytes: 1234,
    source: 'csv' as const,
    sheetName: 'CSV',
    sourceRowsCount: 3,
    dataRowsCount: 2,
    dateRange: { from: '2026-08-01', to: '2026-08-02' },
    totals: { income: 20_100, expense: 0, net: 20_100 },
    balances: null,
    warnings: { datesInvalid: 0, amountInvalid: 0, balanceMismatchCount: 0 },
    riskSignals: {},
  };
}

function rows() {
  return [
    {
      rowIndex: 2,
      tx: {
        date: '2026-08-01T00:00:00.000Z',
        operationDate: '2026-08-01',
        description: 'TRANSFERENCIA FUNDACION TIPSA',
        amount: 20_000,
        category: null,
        document: null,
        contactId: null,
        contactType: null,
        transactionType: 'normal' as const,
        bankAccountId: 'bank-main',
        source: 'bank' as const,
      },
      rawRow: { concept: 'TRANSFERENCIA FUNDACION TIPSA' },
    },
    {
      rowIndex: 3,
      tx: {
        date: '2026-08-02T00:00:00.000Z',
        operationDate: '2026-08-02',
        description: 'INGRES ALTRE',
        amount: 100,
        category: null,
        document: null,
        contactId: null,
        contactType: null,
        transactionType: 'normal' as const,
        bankAccountId: 'bank-main',
        source: 'bank' as const,
      },
      rawRow: { concept: 'INGRES ALTRE' },
    },
  ];
}

function dataSource(existing: Transaction[] = []): BankStatementPreviewDataSource {
  return {
    async getBankAccount() {
      return {
        id: 'bank-main',
        name: 'Compte principal',
        iban: 'ES1200000000000012345678',
        bankName: 'Caixa Social',
        isActive: true,
      } as Awaited<ReturnType<BankStatementPreviewDataSource['getBankAccount']>>;
    },
    async listTransactions() { return existing; },
  };
}

class MemoryPlanStore implements BankImportPlanStore {
  plan: BankImportPlan | null = null;

  async create(plan: BankImportPlan) { this.plan = structuredClone(plan); }
  async get(planId: string) {
    return this.plan?.planId === planId ? structuredClone(this.plan) : null;
  }
  async claim(args: BankImportPlanClaimArgs) {
    if (!this.plan) return { ok: false as const, code: 'PLAN_NOT_FOUND' };
    const code = validateBankImportPlanClaim(this.plan, args);
    if (code) return { ok: false as const, code };
    this.plan.status = 'processing';
    return { ok: true as const, plan: structuredClone(this.plan) };
  }
  async complete(args: { planId: string; now: string; importRunId: string; importedIds: string[] }) {
    assert.equal(this.plan?.planId, args.planId);
    if (!this.plan) return;
    this.plan.status = 'consumed';
    this.plan.consumedAt = args.now;
    this.plan.importRunId = args.importRunId;
    this.plan.importedIds = [...args.importedIds];
  }
  async block(args: { planId: string; now: string; reason: string }) {
    assert.equal(this.plan?.planId, args.planId);
    if (!this.plan) return;
    this.plan.status = 'blocked';
    this.plan.blockedAt = args.now;
    this.plan.blockedReason = args.reason;
  }
}

class MemoryAuthStore implements IntegrationAuthRepository {
  audits: IntegrationAuditEntry[] = [];
  constructor(readonly token: IntegrationTokenRecord) {}
  async findTokenByHash(hash: string) { return hash === this.token.tokenHash ? this.token : null; }
  async touchTokenLastUsed() { /* observed through successful authentication */ }
  async recordAudit(entry: IntegrationAuditEntry) { this.audits.push(entry); }
}

function integrationToken(scopes: IntegrationScope[], orgId = 'org-a'): IntegrationTokenRecord {
  return {
    id: 'token-a', tokenType: 'private_integration', orgId,
    tokenHash: hashIntegrationToken('secret-a'), scopes, status: 'active',
    createdAt: null, createdBy: 'test', lastUsedAt: null,
    label: 'test', sourceRepo: 'test',
  };
}

function apiRequest(path: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer secret-a', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function prepared(store = new MemoryPlanStore(), selection = [2]) {
  const result = await prepareBankImportPlan({
    orgId: 'org-a',
    tokenId: 'token-a',
    bankAccountId: 'bank-main',
    file: file(),
    rows: rows(),
    selectedRowIndexes: selection,
    now: NOW,
    planIdFactory: () => 'fixed-plan',
  }, dataSource(), store);
  assert.equal(result.prepared, true);
  if (!result.prepared) throw new Error('plan preparation failed');
  return { store, plan: result.plan };
}

function commitInput(plan: BankImportPlan) {
  return {
    orgId: plan.orgId,
    tokenId: plan.tokenId,
    planId: plan.planId,
    bankAccountId: plan.bankAccountId,
    fileSha256: plan.fileSha256,
    inputHash: plan.inputHash,
    selectedRowIndexes: plan.selectedRowIndexes,
    confirmationText: plan.confirmationText,
    humanConfirmed: true as const,
    now: new Date('2026-08-03T12:05:00.000Z'),
  };
}

test('prepare persists an exact, token-bound 15-minute plan without importing', async () => {
  const { store, plan } = await prepared();
  assert.equal(plan.status, 'prepared');
  assert.equal(plan.orgId, 'org-a');
  assert.equal(plan.tokenId, 'token-a');
  assert.equal(plan.selectedRows.length, 1);
  assert.deepEqual(plan.selectedRowIndexes, [2]);
  assert.equal(plan.expiresAt, '2026-08-03T12:15:00.000Z');
  assert.match(plan.confirmationText, /CONFIRMO IMPORTAR 1 MOVIMENTS/);
  assert.equal(plan.importedIds.length, 0);
  assert.equal((await store.get(plan.planId))?.status, 'prepared');
});

test('prepare rejects implicit, missing and non-NEW row selections', async () => {
  const missing = await prepareBankImportPlan({
    orgId: 'org-a', tokenId: 'token-a', bankAccountId: 'bank-main',
    file: file(), rows: rows(), selectedRowIndexes: [], now: NOW,
  }, dataSource(), new MemoryPlanStore());
  assert.deepEqual(missing, { prepared: false, code: 'EXPLICIT_SELECTION_REQUIRED' });

  const duplicate = { id: 'existing-3', ...rows()[1].tx } as unknown as Transaction;
  const nonNew = await prepareBankImportPlan({
    orgId: 'org-a', tokenId: 'token-a', bankAccountId: 'bank-main',
    file: file(), rows: rows(), selectedRowIndexes: [3], now: NOW,
  }, dataSource([duplicate]), new MemoryPlanStore());
  assert.equal(nonNew.prepared, false);
  assert.equal(nonNew.code, 'SELECTION_NOT_NEW');
});

test('claim rejects missing confirmation, expiry and every binding mismatch before execution', async () => {
  const { store, plan } = await prepared();
  const base = commitInput(plan);
  const cases: Array<[Parameters<typeof commitBankImportPlan>[0], string]> = [
    [{ ...base, humanConfirmed: false }, 'HUMAN_CONFIRMATION_REQUIRED'],
    [{ ...base, confirmationText: 'sí' }, 'HUMAN_CONFIRMATION_REQUIRED'],
    [{ ...base, tokenId: 'token-b' }, 'PLAN_TOKEN_MISMATCH'],
    [{ ...base, orgId: 'org-b' }, 'PLAN_ORG_MISMATCH'],
    [{ ...base, bankAccountId: 'bank-other' }, 'PLAN_BANK_ACCOUNT_MISMATCH'],
    [{ ...base, fileSha256: 'b'.repeat(64) }, 'PLAN_FILE_HASH_MISMATCH'],
    [{ ...base, inputHash: 'b'.repeat(64) }, 'PLAN_INPUT_HASH_MISMATCH'],
    [{ ...base, selectedRowIndexes: [3] as number[] }, 'PLAN_SELECTION_MISMATCH'],
    [{ ...base, now: new Date('2026-08-03T12:16:00.000Z') }, 'PLAN_EXPIRED'],
  ];
  const never: BankImportExecutor = { async execute() { throw new Error('must not execute'); } };
  for (const [input, expected] of cases) {
    const result = await commitBankImportPlan(input, dataSource(), store, never);
    assert.deepEqual(result, { committed: false, code: expected });
    assert.equal(store.plan?.status, 'prepared');
  }
});

test('commit revalidates dedupe, blocks drift and never calls the executor', async () => {
  const { store, plan } = await prepared();
  let called = false;
  const executor: BankImportExecutor = {
    async execute() { called = true; throw new Error('must not execute'); },
  };
  const existing = { id: 'new-duplicate', ...plan.selectedRows[0].tx } as Transaction;
  const result = await commitBankImportPlan(commitInput(plan), dataSource([existing]), store, executor);
  assert.deepEqual(result, { committed: false, code: 'DEDUPE_DRIFT' });
  assert.equal(called, false);
  assert.equal(store.plan?.status, 'blocked');
  assert.equal(store.plan?.blockedReason, 'DEDUPE_DRIFT');
});

test('successful commit consumes the plan once and a second attempt is rejected', async () => {
  const { store, plan } = await prepared();
  let calls = 0;
  const executor: BankImportExecutor = {
    async execute() {
      calls += 1;
      return { ok: true, idempotent: false, importRunId: 'run-1', importedIds: ['tx-1'] };
    },
  };
  const first = await commitBankImportPlan(commitInput(plan), dataSource(), store, executor);
  assert.deepEqual(first, {
    committed: true,
    idempotent: false,
    importRunId: 'run-1',
    importedIds: ['tx-1'],
  });
  const second = await commitBankImportPlan(commitInput(plan), dataSource(), store, executor);
  assert.deepEqual(second, { committed: false, code: 'PLAN_ALREADY_USED' });
  assert.equal(calls, 1);
  assert.equal(store.plan?.status, 'consumed');
});

test('private handlers enforce separate scopes, org isolation and audit prepare/commit', async () => {
  const body = {
    orgId: 'org-a', bankAccountId: 'bank-main', file: file(), rows: rows(), selectedRowIndexes: [2],
  };
  const deniedAuth = new MemoryAuthStore(integrationToken(['bank_import.preview']));
  const denied = await handlePrivateBankImportPlan(
    apiRequest('/api/integrations/private/bank-import/plan', body),
    { authRepository: deniedAuth, dataSource: dataSource(), planStore: new MemoryPlanStore() }
  );
  assert.equal(denied.status, 403);
  assert.equal(deniedAuth.audits[0]?.result, 'scope_denied');

  const wrongOrgAuth = new MemoryAuthStore(integrationToken(['bank_import.prepare'], 'org-b'));
  const wrongOrg = await handlePrivateBankImportPlan(
    apiRequest('/api/integrations/private/bank-import/plan', body),
    { authRepository: wrongOrgAuth, dataSource: dataSource(), planStore: new MemoryPlanStore() }
  );
  assert.equal(wrongOrg.status, 403);
  assert.equal(wrongOrgAuth.audits[0]?.result, 'org_denied');

  const store = new MemoryPlanStore();
  const prepareAuth = new MemoryAuthStore(integrationToken(['bank_import.prepare']));
  const response = await handlePrivateBankImportPlan(
    apiRequest('/api/integrations/private/bank-import/plan', body),
    {
      authRepository: prepareAuth,
      dataSource: dataSource(),
      planStore: store,
      now: NOW,
      planIdFactory: () => 'handler-plan',
    }
  );
  assert.equal(response.status, 201);
  const preparedBody = await response.json();
  assert.equal(preparedBody.effects.businessDataMutated, false);
  assert.equal(preparedBody.effects.planPersisted, true);
  assert.equal(prepareAuth.audits[0]?.scope, 'bank_import.prepare');
  assert.equal(prepareAuth.audits[0]?.resourceId, store.plan?.planId);

  const plan = store.plan!;
  const commitAuth = new MemoryAuthStore(integrationToken(['bank_import.commit']));
  const committed = await handlePrivateBankImportCommit(
    apiRequest('/api/integrations/private/bank-import/commit', {
      orgId: plan.orgId,
      planId: plan.planId,
      bankAccountId: plan.bankAccountId,
      fileSha256: plan.fileSha256,
      inputHash: plan.inputHash,
      selectedRowIndexes: plan.selectedRowIndexes,
      confirmationText: plan.confirmationText,
      humanConfirmed: true,
    }),
    {
      authRepository: commitAuth,
      dataSource: dataSource(),
      planStore: store,
      executor: {
        async execute() {
          return { ok: true, idempotent: false, importRunId: 'run-handler', importedIds: ['tx-handler'] };
        },
      },
      now: new Date('2026-08-03T12:05:00.000Z'),
    }
  );
  assert.equal(committed.status, 200);
  const committedBody = await committed.json();
  assert.equal(committedBody.effects.businessDataMutated, true);
  assert.equal(committedBody.createdCount, 1);
  assert.equal(commitAuth.audits[0]?.scope, 'bank_import.commit');
  assert.equal(commitAuth.audits[0]?.code, 'IMPORT_COMMITTED');
});
