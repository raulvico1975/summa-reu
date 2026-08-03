import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import type { AnyContact, Organization, Transaction } from '@/lib/data';
import { individualDonationCertificatePdfBytes } from '@/lib/fiscal/individual-donation-certificate-pdf';
import { hashIntegrationToken, type IntegrationAuditEntry, type IntegrationAuthRepository, type IntegrationScope, type IntegrationTokenRecord } from '@/lib/api/integration-auth';
import type { PrepareEntityDataSource } from '@/lib/private-integrations/prepare-only';
import {
  generateIndividualCertificatePlan,
  prepareIndividualCertificatePlan,
  validateIndividualCertificateClaim,
  type IndividualCertificateGenerator,
  type IndividualCertificatePlan,
  type IndividualCertificatePlanStore,
} from '@/lib/private-integrations/individual-certificate-plan';
import { handlePrivateIndividualCertificatePlan } from '@/app/api/integrations/private/certificates/individual/plan/handler';
import { handlePrivateIndividualCertificateGenerate } from '@/app/api/integrations/private/certificates/individual/generate/handler';
import { createFirestoreIndividualCertificateGenerator } from '@/lib/private-integrations/firestore-individual-certificate';

const organization: Organization = {
  id: 'org-a', name: 'Fundació Exemple', slug: 'fundacio-exemple', taxId: 'G12345678', status: 'active',
  createdAt: '2026-01-01', createdBy: 'raul', address: 'Carrer Major, 1', zipCode: '08001', city: 'Barcelona',
  province: 'Barcelona', signatoryName: 'Raül Vico', signatoryRole: 'President', language: 'ca',
};
const donor: AnyContact = {
  id: 'donor-a', type: 'donor', name: 'Fundación Tipsa', taxId: 'G87654321', zipCode: '28001', city: 'Madrid',
  address: 'Calle Uno, 2', createdAt: '2026-01-01', donorType: 'company', membershipType: 'one-time',
} as AnyContact;
const movement: Transaction = {
  id: 'tx-a', date: '2026-08-01T00:00:00.000Z', description: 'Donació Tipsa', amount: 20_000,
  category: null, document: null, contactId: 'donor-a', contactType: 'donor', transactionType: 'donation', fiscalKind: 'donation',
};

class DataSource implements PrepareEntityDataSource {
  org: Organization | null = organization; tx: Transaction | null = movement; contact: AnyContact | null = donor;
  async getOrganization() { return this.org; }
  async getTransaction() { return this.tx; }
  async getContact() { return this.contact; }
}

class Store implements IndividualCertificatePlanStore {
  plan: IndividualCertificatePlan | null = null;
  async create(plan: IndividualCertificatePlan) { this.plan = plan; }
  async claim(args: Parameters<IndividualCertificatePlanStore['claim']>[0]) {
    if (!this.plan) return { ok: false as const, code: 'PLAN_NOT_FOUND' };
    const code = validateIndividualCertificateClaim(this.plan, args);
    if (code) return { ok: false as const, code };
    this.plan = { ...this.plan, status: 'processing' };
    return { ok: true as const, plan: this.plan };
  }
  async complete(args: Parameters<IndividualCertificatePlanStore['complete']>[0]) { this.plan = { ...this.plan!, status: 'consumed', consumedAt: args.now, pdfSha256: args.pdfSha256, pdfSizeBytes: args.pdfSizeBytes }; }
  async block(args: Parameters<IndividualCertificatePlanStore['block']>[0]) { this.plan = { ...this.plan!, status: 'blocked', blockedAt: args.now, blockedReason: args.reason }; }
}

class AuthRepo implements IntegrationAuthRepository {
  auditLog: IntegrationAuditEntry[] = [];
  constructor(readonly scope: IntegrationScope, readonly orgId = 'org-a') {}
  async findTokenByHash(hash: string) {
    return hash === hashIntegrationToken('token-a') ? {
      id: 'token-shared', tokenType: 'private_integration', orgId: this.orgId, tokenHash: hash,
      scopes: [this.scope], status: 'active', createdAt: null, createdBy: 'raul', lastUsedAt: null, label: 'test', sourceRepo: 'summa-agent',
    } satisfies IntegrationTokenRecord : null;
  }
  async touchTokenLastUsed() {}
  async recordAudit(entry: IntegrationAuditEntry) { this.auditLog.push(entry); }
}
function request(body: Record<string, unknown>) { return { headers: new Headers({ Authorization: 'Bearer token-a' }), async json() { return body; } } as never; }

test('shared canonical builder creates a valid PDF with stable page structure', () => {
  const input = {
    language: 'ca' as const, issueDate: new Date('2026-08-03T00:00:00.000Z'),
    organization: { name: organization.name, taxId: organization.taxId, address: organization.address!, zipCode: organization.zipCode!, city: organization.city!, province: organization.province, signatoryName: organization.signatoryName!, signatoryRole: organization.signatoryRole! },
    donor: { name: donor.name, taxId: donor.taxId, address: 'address' in donor ? donor.address : null, zipCode: donor.zipCode, city: donor.city, province: donor.province, donorType: 'company' as const },
    movement: { date: movement.date, amount: movement.amount },
  };
  const first = individualDonationCertificatePdfBytes(input); const second = individualDonationCertificatePdfBytes(input);
  assert.equal(Buffer.from(first).subarray(0, 4).toString(), '%PDF');
  assert.equal(Buffer.from(second).subarray(0, 4).toString(), '%PDF');
  assert.equal(first.byteLength, second.byteLength);
});

test('certificate plan is 15-minute, one-time and bound to token org transaction donor and precondition', async () => {
  const store = new Store();
  const result = await prepareIndividualCertificatePlan({ orgId: 'org-a', tokenId: 'token-a', transactionId: 'tx-a', donorId: 'donor-a', now: new Date('2026-08-03T10:00:00Z'), planIdFactory: () => 'fixed' }, new DataSource(), store);
  assert.equal(result.prepared, true); if (!result.prepared) return;
  assert.equal(result.plan.expiresAt, '2026-08-03T10:15:00.000Z');
  const base = { planId: result.plan.planId, orgId: 'org-a', tokenId: 'token-a', transactionId: 'tx-a', donorId: 'donor-a', preconditionToken: result.plan.preconditionToken, confirmationText: result.plan.confirmationText, humanConfirmed: true, now: '2026-08-03T10:01:00.000Z' };
  assert.equal(validateIndividualCertificateClaim(result.plan, { ...base, tokenId: 'other' }), 'PLAN_TOKEN_MISMATCH');
  assert.equal(validateIndividualCertificateClaim(result.plan, { ...base, orgId: 'other' }), 'PLAN_ORG_MISMATCH');
  assert.equal(validateIndividualCertificateClaim(result.plan, { ...base, transactionId: 'other' }), 'PLAN_TRANSACTION_MISMATCH');
  assert.equal(validateIndividualCertificateClaim(result.plan, { ...base, donorId: 'other' }), 'PLAN_DONOR_MISMATCH');
  assert.equal(validateIndividualCertificateClaim(result.plan, { ...base, humanConfirmed: false }), 'HUMAN_CONFIRMATION_REQUIRED');
  assert.equal(validateIndividualCertificateClaim(result.plan, { ...base, now: '2026-08-03T10:15:00.000Z' }), 'PLAN_EXPIRED');
});

test('prepare blocks drift-prone or incomplete fiscal and institutional data', async () => {
  const cases: Array<[Partial<Organization>, Partial<Transaction>, Partial<AnyContact>, string]> = [
    [{ signatoryName: '' }, {}, {}, 'MISSING_SIGNATORY_NAME'], [{ address: '' }, {}, {}, 'MISSING_ORGANIZATION_ADDRESS'],
    [{}, { donationStatus: 'returned' }, {}, 'TRANSACTION_RETURNED'], [{}, { amount: 0 }, {}, 'NON_POSITIVE_AMOUNT'],
    [{}, { contactId: 'other' }, {}, 'TRANSACTION_LINKED_TO_OTHER_CONTACT'], [{}, {}, { taxId: '' }, 'MISSING_TAX_ID'],
  ];
  for (const [orgChange, txChange, donorChange, blocker] of cases) {
    const source = new DataSource(); source.org = { ...organization, ...orgChange }; source.tx = { ...movement, ...txChange }; source.contact = { ...donor, ...donorChange } as AnyContact;
    const result = await prepareIndividualCertificatePlan({ orgId: 'org-a', tokenId: 'token-a', transactionId: 'tx-a', donorId: 'donor-a' }, source, new Store());
    assert.equal(result.prepared, false); if (!result.prepared) assert.ok(result.blockers.includes(blocker as never));
  }
});

test('generate consumes one plan and returns hash without business writes, email or Storage', async () => {
  const store = new Store();
  const prepared = await prepareIndividualCertificatePlan({ orgId: 'org-a', tokenId: 'token-a', transactionId: 'tx-a', donorId: 'donor-a', now: new Date('2026-08-03T10:00:00Z') }, new DataSource(), store);
  assert.equal(prepared.prepared, true); if (!prepared.prepared) return;
  const bytes = Buffer.from('%PDF canonical'); const sha = createHash('sha256').update(bytes).digest('hex');
  const generator: IndividualCertificateGenerator = { async generate() { return { ok: true, pdfBase64: bytes.toString('base64'), pdfSha256: sha, pdfSizeBytes: bytes.length, filename: 'certificat.pdf', warnings: [] }; } };
  const input = { planId: prepared.plan.planId, orgId: 'org-a', tokenId: 'token-a', transactionId: 'tx-a', donorId: 'donor-a', preconditionToken: prepared.plan.preconditionToken, confirmationText: prepared.plan.confirmationText, humanConfirmed: true, now: '2026-08-03T10:01:00.000Z' };
  const result = await generateIndividualCertificatePlan(input, store, generator);
  assert.equal(result.generated, true); assert.equal(store.plan?.status, 'consumed'); assert.equal(store.plan?.pdfSha256, sha);
  assert.deepEqual(await generateIndividualCertificatePlan(input, store, generator), { generated: false, code: 'PLAN_ALREADY_USED' });
});

test('canonical generator re-reads Summa data and blocks snapshot drift before PDF generation', async () => {
  const source = new DataSource(); const store = new Store();
  const prepared = await prepareIndividualCertificatePlan({ orgId: 'org-a', tokenId: 'token-a', transactionId: 'tx-a', donorId: 'donor-a' }, source, store);
  assert.equal(prepared.prepared, true); if (!prepared.prepared) return;
  const current = new Map<string, { id: string; data: Record<string, unknown> }>([
    ['organizations/org-a', { id: 'org-a', data: { ...organization } }],
    ['organizations/org-a/transactions/tx-a', { id: 'tx-a', data: { ...movement, amount: 19_999 } }],
    ['organizations/org-a/contacts/donor-a', { id: 'donor-a', data: { ...donor } }],
  ]);
  const fakeDb = { doc(path: string) { return { async get() { const value = current.get(path); return { id: value?.id ?? '', exists: Boolean(value), data: () => value?.data }; } }; } };
  const result = await createFirestoreIndividualCertificateGenerator(fakeDb as never).generate(prepared.plan, new Date('2026-08-03T00:00:00Z'));
  assert.deepEqual(result, { ok: false, code: 'PRECONDITION_DRIFT' });
});

test('private certificate routes enforce separate prepare/generate scopes and audit sanitized results', async () => {
  const store = new Store(); const dataSource = new DataSource(); const prepareAuth = new AuthRepo('certificates.prepare');
  const planResponse = await handlePrivateIndividualCertificatePlan(request({ orgId: 'org-a', transactionId: 'tx-a', donorId: 'donor-a' }), { authRepository: prepareAuth, dataSource, planStore: store, now: new Date('2026-08-03T10:00:00Z'), planIdFactory: () => 'fixed' });
  assert.equal(planResponse.status, 201); const planBody = await planResponse.json();
  const denied = await handlePrivateIndividualCertificateGenerate(request({ orgId: 'org-a' }), { authRepository: prepareAuth, planStore: store, generator: { async generate() { throw new Error('not called'); } } });
  assert.equal(denied.status, 403);
  const generateAuth = new AuthRepo('certificates.generate'); const bytes = Buffer.from('%PDF route'); const sha = createHash('sha256').update(bytes).digest('hex');
  const generated = await handlePrivateIndividualCertificateGenerate(request({ orgId: 'org-a', planId: planBody.plan.planId, transactionId: 'tx-a', donorId: 'donor-a', preconditionToken: planBody.plan.preconditionToken, confirmationText: planBody.plan.confirmationText, humanConfirmed: true }), {
    authRepository: generateAuth, planStore: store, now: new Date('2026-08-03T10:01:00Z'),
    generator: { async generate() { return { ok: true, pdfBase64: bytes.toString('base64'), pdfSha256: sha, pdfSizeBytes: bytes.length, filename: 'certificat.pdf', warnings: [] }; } },
  });
  assert.equal(generated.status, 200); const body = await generated.json(); assert.equal(body.effects.emailSent, false); assert.equal(body.effects.certificateStored, false);
  assert.equal(generateAuth.auditLog[0].scope, 'certificates.generate');
  assert.equal(JSON.stringify(generateAuth.auditLog).includes('G87654321'), false);
  assert.equal(JSON.stringify(generateAuth.auditLog).includes(body.pdfBase64), false);
});
