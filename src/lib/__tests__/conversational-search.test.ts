import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NextRequest } from 'next/server';
import {
  handleConversationalBankAccountsSearch,
  handleConversationalContactsSearch,
  handleConversationalTransactionsSearch,
  type ConversationalSearchDataSource,
} from '@/app/api/integrations/private/conversational-search/handler';
import {
  searchBankAccountCandidates,
  searchContactCandidates,
  searchTransactionCandidates,
} from '@/lib/private-integrations/conversational-search';
import {
  hashIntegrationToken,
  type IntegrationAuditEntry,
  type IntegrationAuthRepository,
  type IntegrationScope,
  type IntegrationTokenRecord,
} from '@/lib/api/integration-auth';

class InMemoryAuthRepository implements IntegrationAuthRepository {
  readonly audits: IntegrationAuditEntry[] = [];
  readonly touched: string[] = [];

  constructor(private readonly tokens: IntegrationTokenRecord[]) {}

  async findTokenByHash(tokenHash: string) {
    return this.tokens.find((token) => token.tokenHash === tokenHash) ?? null;
  }

  async touchTokenLastUsed(tokenId: string) {
    this.touched.push(tokenId);
  }

  async recordAudit(entry: IntegrationAuditEntry) {
    this.audits.push(entry);
  }
}

function token(scope: IntegrationScope, orgId = 'org-a'): IntegrationTokenRecord {
  return {
    id: `token-${scope}`,
    tokenType: 'private_integration',
    orgId,
    tokenHash: hashIntegrationToken('secret-a'),
    scopes: [scope],
    status: 'active',
    createdAt: null,
    createdBy: 'test',
    lastUsedAt: null,
    label: 'test token',
    sourceRepo: 'test',
  };
}

function request(path: string, secret = 'secret-a') {
  return new NextRequest(`http://localhost${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
}

function dataSource(overrides: Partial<ConversationalSearchDataSource> = {}): ConversationalSearchDataSource {
  return {
    async listBankAccounts() {
      return [{
        id: 'bank-main',
        name: 'Compte principal',
        bankName: 'Caixa Social',
        iban: 'ES1200000000000012345678',
        isDefault: true,
        isActive: true,
      }];
    },
    async listContacts() {
      return [{
        id: 'donor-tipsa',
        name: 'Fundación Tipsa',
        taxId: 'G12345678',
        email: 'administracion@tipsa.example',
        type: 'donor',
        roles: { donor: true },
        status: 'active',
        aliases: ['Tipsa'],
      }];
    },
    async listTransactions() {
      return [{
        id: 'tx-tipsa',
        date: '2026-08-01T00:00:00.000Z',
        amount: 20_000,
        description: 'TRANSFERENCIA FUNDACION TIPSA DONACION',
        bankAccountId: 'bank-main',
        source: 'bank',
        transactionType: 'normal',
      }];
    },
    ...overrides,
  };
}

test('bank account search returns zero, one or multiple candidates without selecting one', () => {
  const records = [
    {
      id: 'bank-a',
      name: 'Compte principal',
      bankName: 'Caixa Social',
      iban: 'ES1200000000000012345678',
      isDefault: true,
      isActive: true,
    },
    {
      id: 'bank-b',
      name: 'Compte projectes',
      bankName: 'Banc Cooperatiu',
      iban: 'ES3400000000000098765432',
      isDefault: false,
      isActive: true,
    },
  ];

  assert.equal(searchBankAccountCandidates(records, { q: 'inexistent', limit: 20 }).length, 0);
  const one = searchBankAccountCandidates(records, { q: 'principal', limit: 20 });
  assert.equal(one.length, 1);
  assert.equal(one[0].decision, 'candidate_only');
  assert.equal(one[0].isDefault, true);
  assert.match(one[0].ibanMasked ?? '', /^ES12/);
  assert.doesNotMatch(one[0].ibanMasked ?? '', /00000000000012345678/);

  const many = searchBankAccountCandidates(records, { q: 'compte', limit: 20 });
  assert.equal(many.length, 2);
  assert.equal(many.every((candidate) => candidate.decision === 'candidate_only'), true);
});

test('contact search ranks name, tax id and aliases while masking personal data', () => {
  const records = [
    {
      id: 'tipsa',
      name: 'Fundación Tipsa',
      taxId: 'G12345678',
      email: 'administracion@tipsa.example',
      type: 'donor' as const,
      aliases: ['Tipsa'],
      roles: { donor: true },
    },
    {
      id: 'supplier',
      name: 'Tipsa Proveïdor',
      taxId: 'B87654321',
      email: 'factures@tipsa.example',
      type: 'supplier' as const,
      roles: { supplier: true },
    },
  ];

  const donors = searchContactCandidates(records, {
    q: 'Tipsa',
    role: 'donor',
    limit: 20,
  });
  assert.equal(donors.length, 1);
  assert.equal(donors[0].id, 'tipsa');
  assert.equal(donors[0].donor, true);
  assert.match(donors[0].taxIdMasked ?? '', /^G1/);
  assert.notEqual(donors[0].taxIdMasked, 'G12345678');
  assert.equal(donors[0].emailMasked, 'a•••@tipsa.example');
  assert.equal(donors[0].matchReasons.includes('alias_exact'), true);
  assert.equal(donors[0].decision, 'candidate_only');

  const byTaxId = searchContactCandidates(records, {
    q: 'G12345678',
    role: 'any',
    limit: 20,
  });
  assert.equal(byTaxId[0]?.confidence, 'exact');
  assert.equal(byTaxId[0]?.matchReasons.includes('tax_id_exact'), true);
});

test('transaction search combines amount, dates, account, direction and concept as candidate reasons', () => {
  const longDescription = `DONACIO ${'X'.repeat(200)}`;
  const records = [
    {
      id: 'tx-a',
      date: '2026-08-01T00:00:00.000Z',
      amount: 20_000,
      description: longDescription,
      bankAccountId: 'bank-a',
      source: 'bank' as const,
      transactionType: 'normal' as const,
    },
    {
      id: 'tx-b',
      date: '2026-08-01T00:00:00.000Z',
      amount: -20_000,
      description: 'PAGAMENT TIPSA',
      bankAccountId: 'bank-a',
      source: 'bank' as const,
      transactionType: 'normal' as const,
    },
  ];
  const candidates = searchTransactionCandidates(
    records,
    [{ id: 'bank-a', name: 'Compte principal', iban: 'ES1200000000000012345678' }],
    {
      q: 'donacio',
      amount: 20_000,
      amountTolerance: 0.01,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-02',
      bankAccountId: 'bank-a',
      direction: 'income',
      limit: 20,
    }
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].id, 'tx-a');
  assert.equal(candidates[0].direction, 'income');
  assert.equal(candidates[0].description.length <= 160, true);
  assert.equal(candidates[0].matchReasons.includes('amount_exact'), true);
  assert.equal(candidates[0].matchReasons.includes('bank_account_exact'), true);
  assert.equal(candidates[0].matchReasons.includes('direction_income'), true);
  assert.equal(candidates[0].decision, 'candidate_only');
});

test('conversational handlers enforce new scopes, org isolation and read-only audit', async () => {
  const bankAuth = new InMemoryAuthRepository([token('bank_accounts.search')]);
  const bankResponse = await handleConversationalBankAccountsSearch(
    request('/api/integrations/private/conversational-search/bank-accounts?orgId=org-a&q=principal'),
    { authRepository: bankAuth, dataSource: dataSource() }
  );
  assert.equal(bankResponse.status, 200);
  const bankBody = await bankResponse.json();
  assert.equal(bankBody.effects.businessDataMutated, false);
  assert.equal(bankBody.resolution.requiresHumanChoice, true);
  assert.equal('planId' in bankBody, false);
  assert.equal(bankAuth.audits[0]?.scope, 'bank_accounts.search');
  assert.equal(bankAuth.audits[0]?.result, 'allowed');

  const insufficient = new InMemoryAuthRepository([token('contacts.read')]);
  const denied = await handleConversationalContactsSearch(
    request('/api/integrations/private/conversational-search/contacts?orgId=org-a&q=Tipsa'),
    { authRepository: insufficient, dataSource: dataSource() }
  );
  assert.equal(denied.status, 403);
  assert.equal(insufficient.audits[0]?.result, 'scope_denied');

  let loadedOrg: string | null = null;
  const orgDataSource = dataSource({
    async listContacts(orgId) {
      loadedOrg = orgId;
      return [];
    },
  });
  const wrongOrgAuth = new InMemoryAuthRepository([token('contacts.search', 'org-a')]);
  const wrongOrg = await handleConversationalContactsSearch(
    request('/api/integrations/private/conversational-search/contacts?orgId=org-b&q=Tipsa'),
    { authRepository: wrongOrgAuth, dataSource: orgDataSource }
  );
  assert.equal(wrongOrg.status, 403);
  assert.equal(loadedOrg, null);
  assert.equal(wrongOrgAuth.audits[0]?.result, 'org_denied');
});

test('contact and transaction handlers return explicit zero or multiple candidate states', async () => {
  const contactAuth = new InMemoryAuthRepository([token('contacts.search')]);
  const noContacts = await handleConversationalContactsSearch(
    request('/api/integrations/private/conversational-search/contacts?orgId=org-a&q=Nobody&role=donor'),
    { authRepository: contactAuth, dataSource: dataSource({ async listContacts() { return []; } }) }
  );
  const noContactsBody = await noContacts.json();
  assert.equal(noContactsBody.resolution.status, 'no_candidates');
  assert.equal(noContactsBody.resolution.requiresHumanChoice, true);

  const transactionAuth = new InMemoryAuthRepository([token('transactions.search')]);
  const transactions = await handleConversationalTransactionsSearch(
    request('/api/integrations/private/conversational-search/transactions?orgId=org-a&amount=20000&direction=income'),
    { authRepository: transactionAuth, dataSource: dataSource() }
  );
  const transactionBody = await transactions.json();
  assert.equal(transactionBody.count, 1);
  assert.equal(transactionBody.resolution.status, 'single_candidate');
  assert.equal(transactionBody.resolution.requiresHumanChoice, true);
  assert.equal(transactionBody.candidates[0].amount, 20_000);
  assert.equal(transactionAuth.audits[0]?.scope, 'transactions.search');
  assert.equal(transactionAuth.audits[0]?.requestKeyHash?.length, 64);
});

test('transaction search rejects unbounded queries before loading business data', async () => {
  let loaded = false;
  const auth = new InMemoryAuthRepository([token('transactions.search')]);
  const response = await handleConversationalTransactionsSearch(
    request('/api/integrations/private/conversational-search/transactions?orgId=org-a'),
    {
      authRepository: auth,
      dataSource: dataSource({
        async listTransactions() {
          loaded = true;
          return [];
        },
      }),
    }
  );
  assert.equal(response.status, 400);
  assert.equal(loaded, false);
  assert.equal(auth.audits[0]?.result, 'bad_request');
});

test('MCP transport has no direct Firestore dependency', async () => {
  const [clientSource, serverSource] = await Promise.all([
    readFile(new URL('../summa-agent-mcp/client.ts', import.meta.url), 'utf8'),
    readFile(new URL('../summa-agent-mcp/server.ts', import.meta.url), 'utf8'),
  ]);
  const source = `${clientSource}\n${serverSource}`;
  assert.doesNotMatch(source, /firebase-admin\/firestore|getFirestore\(|getAdminDb\(/);
  assert.match(source, /conversational-search\/bank-accounts/);
  assert.match(source, /conversational-search\/transactions/);
  assert.match(source, /conversational-search\/contacts/);
});
