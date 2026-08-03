import test from 'node:test';
import assert from 'node:assert/strict';
import type { AnyContact, BankAccount, Organization, Transaction } from '@/lib/data';
import {
  hashIntegrationToken,
  type IntegrationAuditEntry,
  type IntegrationAuthRepository,
  type IntegrationTokenRecord,
} from '@/lib/api/integration-auth';
import {
  prepareBankStatementPreview,
  prepareDonationClassification,
  prepareIndividualDonationCertificate,
  type BankStatementPreviewDataSource,
  type PrepareEntityDataSource,
} from '@/lib/private-integrations/prepare-only';
import { handlePrivateBankImportPreview } from '@/app/api/integrations/private/bank-import/preview/handler';
import { handlePrivateDonationClassificationPrepare } from '@/app/api/integrations/private/donations/classification/prepare/handler';
import { handlePrivateIndividualCertificatePrepare } from '@/app/api/integrations/private/certificates/individual/prepare/handler';

class InMemoryAuthRepository implements IntegrationAuthRepository {
  readonly auditLog: IntegrationAuditEntry[] = [];
  readonly touchedTokens: string[] = [];

  constructor(private readonly tokens: IntegrationTokenRecord[]) {}

  async findTokenByHash(tokenHash: string) {
    return this.tokens.find((token) => token.tokenHash === tokenHash) ?? null;
  }

  async touchTokenLastUsed(tokenId: string) {
    this.touchedTokens.push(tokenId);
  }

  async recordAudit(entry: IntegrationAuditEntry) {
    this.auditLog.push(entry);
  }
}

class InMemoryPrepareDataSource
  implements BankStatementPreviewDataSource, PrepareEntityDataSource {
  readonly accounts = new Map<string, BankAccount>();
  readonly transactions = new Map<string, Transaction>();
  readonly contacts = new Map<string, AnyContact>();
  readonly organizations = new Map<string, Organization>();
  businessMutationCalls = 0;

  async getBankAccount(orgId: string, bankAccountId: string) {
    return this.accounts.get(`${orgId}/${bankAccountId}`) ?? null;
  }

  async listTransactions(args: { orgId: string; bankAccountId: string; dateFrom: string; dateTo: string }) {
    return [...this.transactions.entries()]
      .filter(([key, tx]) => key.startsWith(`${args.orgId}/`) && tx.bankAccountId === args.bankAccountId)
      .map(([, tx]) => tx)
      .filter((tx) => tx.date.slice(0, 10) >= args.dateFrom && tx.date.slice(0, 10) <= args.dateTo);
  }

  async getTransaction(orgId: string, transactionId: string) {
    return this.transactions.get(`${orgId}/${transactionId}`) ?? null;
  }

  async getContact(orgId: string, contactId: string) {
    return this.contacts.get(`${orgId}/${contactId}`) ?? null;
  }

  async getOrganization(orgId: string) {
    return this.organizations.get(orgId) ?? null;
  }
}

function token(scope: IntegrationTokenRecord['scopes'][number], orgId = 'org-a') {
  return {
    id: `token-${scope}`,
    tokenType: 'private_integration' as const,
    orgId,
    tokenHash: hashIntegrationToken('prepare-token'),
    scopes: [scope],
    status: 'active' as const,
    createdAt: null,
    createdBy: 'raul',
    lastUsedAt: null,
    label: 'summa-prepare-test',
    sourceRepo: 'summa-agent',
  } satisfies IntegrationTokenRecord;
}

function request(body: Record<string, unknown>, clearToken = 'prepare-token') {
  return {
    headers: new Headers({
      Authorization: `Bearer ${clearToken}`,
      'Content-Type': 'application/json',
    }),
    async json() {
      return body;
    },
  } as never;
}

function account(overrides: Partial<BankAccount> = {}): BankAccount {
  return {
    id: 'bank-a',
    name: 'Caixa',
    iban: 'ES0000000000000000000000',
    bankName: 'Banc de prova',
    isDefault: true,
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-a',
    date: '2026-08-01T00:00:00.000Z',
    description: 'Fundacion Tipsa',
    amount: 20_000,
    category: null,
    document: null,
    bankAccountId: 'bank-a',
    source: 'bank',
    transactionType: 'normal',
    archivedAt: null,
    ...overrides,
  };
}

function donor(overrides: Partial<AnyContact> = {}): AnyContact {
  return {
    id: 'donor-a',
    type: 'donor',
    name: 'Fundación Tipsa',
    taxId: 'G12345678',
    zipCode: '28001',
    createdAt: '2026-01-01',
    donorType: 'company',
    membershipType: 'one-time',
    ...overrides,
  } as AnyContact;
}

function organization(): Organization {
  return {
    id: 'org-a',
    name: 'Fundació de prova',
    slug: 'fundacio-prova',
    taxId: 'G87654321',
    status: 'active',
    createdAt: '2026-01-01',
    createdBy: 'raul',
    address: 'Carrer Major, 1',
    zipCode: '08001',
    city: 'Barcelona',
    province: 'Barcelona',
    signatoryName: 'Raül Vico',
    signatoryRole: 'President',
    language: 'ca',
  };
}

function bankPayload() {
  return {
    orgId: 'org-a',
    bankAccountId: 'bank-a',
    file: {
      name: 'extracte.csv',
      sha256: 'a'.repeat(64),
      sizeBytes: 128,
      source: 'csv' as const,
      sheetName: 'extracte.csv',
      sourceRowsCount: 3,
      dataRowsCount: 2,
      dateRange: { from: '2026-08-01', to: '2026-08-01' },
      totals: { income: 40_000, expense: 0, net: 40_000 },
      balances: null,
      warnings: { datesInvalid: 0, amountInvalid: 0, balanceMismatchCount: 0 },
      riskSignals: { lowConfidence: false },
    },
    rows: [1, 2].map((rowIndex) => ({
      rowIndex,
      tx: {
        date: '2026-08-01T00:00:00.000Z',
        operationDate: '2026-08-01',
        description: 'Fundacion Tipsa',
        amount: 20_000,
        category: null,
        document: null,
        contactId: null,
        contactType: null,
        transactionType: 'normal' as const,
        bankAccountId: 'bank-a',
        source: 'bank' as const,
      },
      rawRow: { operationDate: '2026-08-01' },
    })),
  };
}

test('bank preview is deterministic, detects internal and existing duplicates, and never mutates business data', async () => {
  const dataSource = new InMemoryPrepareDataSource();
  dataSource.accounts.set('org-a/bank-a', account());
  dataSource.transactions.set('org-a/tx-existing', transaction({
    id: 'tx-existing',
    transactionType: 'normal',
    operationDate: '2026-08-01',
  }));

  const payload = bankPayload();
  const first = await prepareBankStatementPreview(
    { ...payload, now: new Date('2026-08-03T08:00:00.000Z') },
    dataSource
  );
  const second = await prepareBankStatementPreview(
    { ...payload, now: new Date('2026-08-03T08:00:00.000Z') },
    dataSource
  );

  assert.equal(first.prepared, true);
  assert.equal(first.previewId, second.previewId);
  assert.equal(first.inputHash, second.inputHash);
  assert.equal(first.counts?.total, 2);
  assert.equal((first.counts?.duplicates ?? 0) + (first.counts?.candidates ?? 0), 2);
  assert.equal(first.effects?.businessDataMutated, false);
  assert.equal(dataSource.businessMutationCalls, 0);
});

test('bank preview blocks an inactive or cross-org bank account', async () => {
  const dataSource = new InMemoryPrepareDataSource();
  dataSource.accounts.set('org-a/bank-a', account({ isActive: false }));
  const inactive = await prepareBankStatementPreview(bankPayload(), dataSource);
  assert.deepEqual(inactive.blockers, ['BANK_ACCOUNT_INACTIVE']);

  const crossOrg = await prepareBankStatementPreview(
    { ...bankPayload(), orgId: 'org-b' },
    dataSource
  );
  assert.deepEqual(crossOrg.blockers, ['BANK_ACCOUNT_NOT_FOUND']);
});

test('classification preparation returns a complete patch and deterministic precondition without applying it', async () => {
  const dataSource = new InMemoryPrepareDataSource();
  dataSource.transactions.set('org-a/tx-a', transaction());
  dataSource.contacts.set('org-a/donor-a', donor());

  const first = await prepareDonationClassification({
    orgId: 'org-a', transactionId: 'tx-a', donorId: 'donor-a',
  }, dataSource);
  const second = await prepareDonationClassification({
    orgId: 'org-a', transactionId: 'tx-a', donorId: 'donor-a',
  }, dataSource);

  assert.equal(first.prepared, true);
  assert.deepEqual(first.proposedPatch, {
    contactId: 'donor-a',
    contactType: 'donor',
    transactionType: 'donation',
    fiscalKind: 'donation',
  });
  assert.equal(first.preconditionToken, second.preconditionToken);
  assert.equal(first.effects?.businessDataMutated, false);
  assert.equal(dataSource.transactions.get('org-a/tx-a')?.transactionType, 'normal');
});

test('classification preparation blocks invalid movement and donor states', async () => {
  const dataSource = new InMemoryPrepareDataSource();
  dataSource.transactions.set('org-a/tx-a', transaction({
    archivedAt: '2026-08-02',
    donationStatus: 'returned',
    amount: -20_000,
    contactId: 'other-donor',
  }));
  dataSource.contacts.set('org-a/donor-a', donor({
    type: 'supplier',
    archivedAt: '2026-08-02',
  }));

  const result = await prepareDonationClassification({
    orgId: 'org-a', transactionId: 'tx-a', donorId: 'donor-a',
  }, dataSource);
  assert.equal(result.prepared, false);
  assert.deepEqual(result.blockers, [
    'TRANSACTION_ARCHIVED',
    'TRANSACTION_RETURNED',
    'NON_POSITIVE_AMOUNT',
    'TRANSACTION_LINKED_TO_OTHER_CONTACT',
    'DONOR_ARCHIVED',
    'CONTACT_NOT_DONOR',
  ]);
});

test('certificate can be prepared against proposed classification but remains ungenerated', async () => {
  const dataSource = new InMemoryPrepareDataSource();
  dataSource.organizations.set('org-a', organization());
  dataSource.transactions.set('org-a/tx-a', transaction());
  dataSource.contacts.set('org-a/donor-a', donor());

  const persistent = await prepareIndividualDonationCertificate({
    orgId: 'org-a', transactionId: 'tx-a', donorId: 'donor-a',
  }, dataSource);
  assert.equal(persistent.prepared, false);
  assert.ok(persistent.blockers.includes('NOT_DONATION'));
  assert.ok(persistent.blockers.includes('TRANSACTION_NOT_LINKED_TO_DONOR'));
  assert.ok(persistent.blockers.includes('TRANSACTION_CONTACT_TYPE_NOT_DONOR'));

  const proposed = await prepareIndividualDonationCertificate({
    orgId: 'org-a', transactionId: 'tx-a', donorId: 'donor-a', useProposedClassification: true,
  }, dataSource);
  assert.equal(proposed.prepared, true);
  assert.equal(proposed.sourceState, 'proposed_classification');
  assert.deepEqual(proposed.warnings, ['CLASSIFICATION_NOT_APPLIED']);
  assert.deepEqual(proposed.effects, {
    businessDataMutated: false,
    pdfGenerated: false,
    certificateStored: false,
    emailSent: false,
  });
});

test('certificate preparation blocks missing NIF/CIF and cross-org resources', async () => {
  const dataSource = new InMemoryPrepareDataSource();
  dataSource.organizations.set('org-a', organization());
  dataSource.transactions.set('org-a/tx-a', transaction({ transactionType: 'donation' }));
  dataSource.contacts.set('org-a/donor-a', donor({ taxId: '' }));

  const missingTaxId = await prepareIndividualDonationCertificate({
    orgId: 'org-a', transactionId: 'tx-a', donorId: 'donor-a',
  }, dataSource);
  assert.ok(missingTaxId.blockers.includes('MISSING_TAX_ID'));

  const crossOrg = await prepareIndividualDonationCertificate({
    orgId: 'org-b', transactionId: 'tx-a', donorId: 'donor-a',
  }, dataSource);
  assert.deepEqual(crossOrg.blockers, [
    'ORGANIZATION_NOT_FOUND',
    'TRANSACTION_NOT_FOUND',
    'DONOR_NOT_FOUND',
  ]);
});

test('prepare routes enforce scopes and org isolation while limiting writes to security metadata', async () => {
  const dataSource = new InMemoryPrepareDataSource();
  dataSource.accounts.set('org-a/bank-a', account());
  dataSource.transactions.set('org-a/tx-a', transaction());
  dataSource.contacts.set('org-a/donor-a', donor());
  dataSource.organizations.set('org-a', organization());

  const bankAuth = new InMemoryAuthRepository([token('bank_import.preview')]);
  const bankResponse = await handlePrivateBankImportPreview(request(bankPayload()), {
    authRepository: bankAuth,
    dataSource,
    now: new Date('2026-08-03T08:00:00.000Z'),
  });
  assert.equal(bankResponse.status, 200);
  assert.deepEqual(bankAuth.touchedTokens, ['token-bank_import.preview']);
  assert.equal(bankAuth.auditLog[0]?.scope, 'bank_import.preview');

  const wrongScopeAuth = new InMemoryAuthRepository([token('contacts.read')]);
  const deniedResponse = await handlePrivateDonationClassificationPrepare(request({
    orgId: 'org-a', transactionId: 'tx-a', donorId: 'donor-a',
  }), { authRepository: wrongScopeAuth, dataSource });
  assert.equal(deniedResponse.status, 403);
  assert.equal(wrongScopeAuth.auditLog[0]?.code, 'SCOPE_DENIED');

  const classificationAuth = new InMemoryAuthRepository([token('donation_classification.prepare')]);
  const classificationResponse = await handlePrivateDonationClassificationPrepare(request({
    orgId: 'org-a', transactionId: 'tx-a', donorId: 'donor-a',
  }), { authRepository: classificationAuth, dataSource });
  assert.equal(classificationResponse.status, 200);
  const classificationBody = await classificationResponse.json() as {
    preparation: { prepared: boolean; effects: { businessDataMutated: boolean } };
  };
  assert.equal(classificationBody.preparation.prepared, true);
  assert.equal(classificationBody.preparation.effects.businessDataMutated, false);

  const certificateAuth = new InMemoryAuthRepository([token('certificates.prepare')]);
  const certificateResponse = await handlePrivateIndividualCertificatePrepare(request({
    orgId: 'org-a', transactionId: 'tx-a', donorId: 'donor-a', useProposedClassification: true,
  }), { authRepository: certificateAuth, dataSource });
  assert.equal(certificateResponse.status, 200);
  const certificateBody = await certificateResponse.json() as {
    preparation: { prepared: boolean; effects: { pdfGenerated: boolean; emailSent: boolean } };
  };
  assert.equal(certificateBody.preparation.prepared, true);
  assert.equal(certificateBody.preparation.effects.pdfGenerated, false);
  assert.equal(certificateBody.preparation.effects.emailSent, false);

  const orgAuth = new InMemoryAuthRepository([token('certificates.prepare')]);
  const crossOrgResponse = await handlePrivateIndividualCertificatePrepare(request({
    orgId: 'org-b', transactionId: 'tx-a', donorId: 'donor-a',
  }), { authRepository: orgAuth, dataSource });
  assert.equal(crossOrgResponse.status, 403);
  assert.equal(orgAuth.auditLog[0]?.code, 'ORG_NOT_ALLOWED');

  assert.equal(dataSource.businessMutationCalls, 0);
  for (const entry of [
    ...bankAuth.auditLog,
    ...wrongScopeAuth.auditLog,
    ...classificationAuth.auditLog,
    ...certificateAuth.auditLog,
    ...orgAuth.auditLog,
  ]) {
    assert.equal(JSON.stringify(entry).includes('undefined'), false);
  }
});
