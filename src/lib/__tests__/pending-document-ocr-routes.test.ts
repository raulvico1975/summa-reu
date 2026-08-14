import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { handleExtractPdfPost } from '@/app/api/ai/extract-pdf/handler';
import { handleExtractTicketPost } from '@/app/api/ai/extract-ticket/handler';

const pendingPath = 'organizations/org-1/pendingDocuments/pending-1/file.pdf';
const imagePath = 'organizations/org-1/pendingDocuments/pending-1/file.jpg';
const membership = { valid: true, role: 'admin', userOverrides: null, userGrants: null };
const rateAllowed = () => ({ allowed: true as const, remaining: 1, resetAt: Date.now() + 1_000, retryAfterSeconds: 0 });

function hasUndefined(value: unknown): boolean {
  return value === undefined
    || (Array.isArray(value)
      ? value.some(hasUndefined)
      : Boolean(value && typeof value === 'object' && Object.values(value).some(hasUndefined)));
}

function request(url: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function fakeDb(storagePath: string, offBankPath: string | null = null) {
  const state: Record<string, unknown> = {
    file: { storagePath }, type: 'unknown', extracted: null,
    invoiceNumber: null, invoiceDate: null, amount: null, supplierId: null, categoryId: null,
  };
  const writes: Record<string, unknown>[] = [];
  const reads = { collections: 0, transactions: 0 };
  const refs = new Map<string, { path: string; get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }> }>();
  const db = {
    doc(path: string) {
      if (!refs.has(path)) refs.set(path, {
        path,
        get: async () => {
          if (path === 'organizations/org-1') return { exists: true, data: () => ({ name: 'Entitat', taxId: 'G1' }) };
          if (path.endsWith('/pendingDocuments/pending-1')) return { exists: true, data: () => ({ ...state }) };
          if (path.endsWith('/offBankExpenses/expense-1')) {
            return { exists: offBankPath !== null, data: () => offBankPath ? { attachments: [{ storagePath: offBankPath }] } : undefined };
          }
          return { exists: false, data: () => undefined };
        },
      });
      return refs.get(path)!;
    },
    collection() {
      return { get: async () => { reads.collections += 1; return { docs: [] }; } };
    },
    async runTransaction<T>(callback: (tx: {
      get(ref: { get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }> }): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
      update(ref: unknown, update: Record<string, unknown>): void;
    }) => Promise<T>) {
      reads.transactions += 1;
      const pendingWrites: Record<string, unknown>[] = [];
      const result = await callback({
        get: (ref) => ref.get(),
        update: (_ref, update) => pendingWrites.push(update),
      });
      for (const update of pendingWrites) {
        writes.push(update);
        Object.assign(state, update);
      }
      return result;
    },
  };
  return { db, state, writes, reads };
}

const guard = async () => ({ ok: true as const, auth: { uid: 'user-1' }, membership, orgId: 'org-1' });
const entitlement = async (input: { userAllowed?: boolean }) => ({ allowed: input.userAllowed === true, diagnostics: [], enforcementMode: 'active' as const });

test('PDF OCR denega identitat aliena abans de key/Storage/IA', async () => {
  const fake = fakeDb('organizations/org-1/pendingDocuments/pending-2/file.pdf');
  let key = 0; let storage = 0; let ai = 0;
  const response = await handleExtractPdfPost(request('/api/ai/extract-pdf', {
    orgId: 'org-1', pendingDocumentId: 'pending-1', storagePath: pendingPath, context: 'movements',
  }), {
    requireOrgMembershipFn: guard as never,
    getAdminDbFn: () => fake.db as never,
    resolveEntitlementFn: entitlement as never,
    resolveApiKeyFn: () => { key += 1; return 'key'; },
    checkRateLimitFn: rateAllowed,
    getFileFn: () => { storage += 1; return { getMetadata: async () => [{ size: 100 }], download: async () => [Buffer.from('%PDF-content')] }; },
    extractPdfFn: async () => { ai += 1; throw new Error('unreachable'); },
  });
  assert.equal(response.status, 400);
  assert.deepEqual({ key, storage, ai, writes: fake.writes.length }, { key: 0, storage: 0, ai: 0, writes: 0 });
});

test('PDF OCR re-llegeix i preserva edició manual concurrent sense undefined', async () => {
  const fake = fakeDb(pendingPath);
  const response = await handleExtractPdfPost(request('/api/ai/extract-pdf', {
    orgId: 'org-1', pendingDocumentId: 'pending-1', storagePath: pendingPath, context: 'movements',
  }), {
    requireOrgMembershipFn: guard as never,
    getAdminDbFn: () => fake.db as never,
    resolveEntitlementFn: entitlement as never,
    resolveApiKeyFn: () => 'key',
    checkRateLimitFn: rateAllowed,
    getFileFn: () => ({
      getMetadata: async () => [{ size: 100 }] as [Record<string, unknown>],
      download: async () => [Buffer.from('%PDF-content')] as [Buffer],
    }),
    matchSupplierFn: () => null,
    extractPdfFn: async () => {
      fake.state.invoiceNumber = 'MANUAL';
      return {
        docType: 'invoice', invoiceNumber: { value: 'AI-1', evidence: null },
        invoiceDate: { value: '2026-01-01', evidence: 'data' }, amount: { value: 12, evidence: null },
        supplierName: { value: null, evidence: null }, supplierTaxId: { value: null, evidence: null }, confidence: 0.9,
      };
    },
  });
  assert.equal(response.status, 200);
  assert.equal(fake.state.invoiceNumber, 'MANUAL');
  assert.equal(fake.writes[0]?.invoiceNumber, undefined);
  assert.equal(hasUndefined(fake.writes[0]), false);
});

test('PDF OCR denega plans/permisos incompatibles abans de quota, Storage i IA', async (t) => {
  for (const scenario of ['Control', 'Management', 'config-v2', 'config-corrupt', 'moviments-deny']) {
    await t.test(scenario, async () => {
      const fake = fakeDb(pendingPath);
      let key = 0; let rate = 0; let storage = 0; let ai = 0;
      const deniedEntitlement = async () => ({ allowed: false, diagnostics: [scenario], enforcementMode: 'active' as const });
      const deniedGuard = scenario === 'moviments-deny'
        ? async () => ({ ok: true as const, auth: { uid: 'user-1' }, membership: {
          ...membership,
          userOverrides: { deny: ['moviments.editar'] },
        }, orgId: 'org-1' })
        : guard;
      const response = await handleExtractPdfPost(request('/api/ai/extract-pdf', {
        orgId: 'org-1', pendingDocumentId: 'pending-1', storagePath: pendingPath, context: 'movements',
      }), {
        requireOrgMembershipFn: deniedGuard as never,
        getAdminDbFn: () => fake.db as never,
        resolveEntitlementFn: deniedEntitlement as never,
        resolveApiKeyFn: () => { key += 1; return 'key'; },
        checkRateLimitFn: () => { rate += 1; return rateAllowed(); },
        getFileFn: () => { storage += 1; return { getMetadata: async () => [{ size: 100 }], download: async () => [Buffer.from('%PDF-content')] }; },
        extractPdfFn: async () => { ai += 1; throw new Error('unreachable'); },
      });
      assert.equal(response.status, 403);
      assert.deepEqual({ key, rate, storage, ai, writes: fake.writes.length }, { key: 0, rate: 0, storage: 0, ai: 0, writes: 0 });
    });
  }
});

test('PDF OCR no escriu amb confiança baixa i detecta canvi de path durant IA', async () => {
  const body = { orgId: 'org-1', pendingDocumentId: 'pending-1', storagePath: pendingPath, context: 'movements' };
  const lowFake = fakeDb(pendingPath);
  const common = {
    requireOrgMembershipFn: guard as never,
    resolveEntitlementFn: entitlement as never,
    resolveApiKeyFn: () => 'key',
    checkRateLimitFn: rateAllowed,
    getFileFn: () => ({
      getMetadata: async () => [{ size: 100 }] as [Record<string, unknown>],
      download: async () => [Buffer.from('%PDF-content')] as [Buffer],
    }),
  };
  const low = await handleExtractPdfPost(request('/api/ai/extract-pdf', body), {
    ...common,
    getAdminDbFn: () => lowFake.db as never,
    extractPdfFn: async () => ({
      docType: 'invoice', invoiceNumber: { value: 'AI-1', evidence: null },
      invoiceDate: { value: null, evidence: null }, amount: { value: null, evidence: null },
      supplierName: { value: null, evidence: null }, supplierTaxId: { value: null, evidence: null }, confidence: 0.2,
    }),
  });
  assert.equal(low.status, 200);
  assert.deepEqual(await low.json(), { ok: true, extracted: false });
  assert.equal(lowFake.writes.length, 0);

  const racedFake = fakeDb(pendingPath);
  const raced = await handleExtractPdfPost(request('/api/ai/extract-pdf', body), {
    ...common,
    getAdminDbFn: () => racedFake.db as never,
    matchSupplierFn: () => null,
    extractPdfFn: async () => {
      racedFake.state.file = { storagePath: 'organizations/org-1/pendingDocuments/pending-1/replaced.pdf' };
      return {
        docType: 'invoice', invoiceNumber: { value: 'AI-1', evidence: null },
        invoiceDate: { value: null, evidence: null }, amount: { value: null, evidence: null },
        supplierName: { value: null, evidence: null }, supplierTaxId: { value: null, evidence: null }, confidence: 0.9,
      };
    },
  });
  assert.equal(raced.status, 409);
  assert.equal(racedFake.writes.length, 0);
});

test('PDF OCR rebutja output IA no finit abans de contactes i transacció', async (t) => {
  const body = { orgId: 'org-1', pendingDocumentId: 'pending-1', storagePath: pendingPath, context: 'movements' };
  const validOutput = {
    docType: 'invoice' as const, invoiceNumber: { value: null, evidence: null },
    invoiceDate: { value: null, evidence: null }, amount: { value: null as number | null, evidence: null },
    supplierName: { value: null, evidence: null }, supplierTaxId: { value: null, evidence: null }, confidence: 0.9,
  };
  for (const hostileOutput of [
    { ...validOutput, confidence: Number.NaN },
    { ...validOutput, confidence: 2 },
    { ...validOutput, amount: { value: Number.POSITIVE_INFINITY, evidence: null } },
  ]) {
    await t.test(String(hostileOutput.confidence) + String(hostileOutput.amount.value), async () => {
      const fake = fakeDb(pendingPath);
      const response = await handleExtractPdfPost(request('/api/ai/extract-pdf', body), {
        requireOrgMembershipFn: guard as never,
        getAdminDbFn: () => fake.db as never,
        resolveEntitlementFn: entitlement as never,
        resolveApiKeyFn: () => 'key', checkRateLimitFn: rateAllowed,
        getFileFn: () => ({
          getMetadata: async () => [{ size: 100 }] as [Record<string, unknown>],
          download: async () => [Buffer.from('%PDF-content')] as [Buffer],
        }),
        extractPdfFn: async () => hostileOutput,
      });
      assert.equal(response.status, 502);
      assert.deepEqual({ ...fake.reads, writes: fake.writes.length }, { collections: 0, transactions: 0, writes: 0 });
    });
  }
});

test('imatge pending valida identitat, salta confiança baixa i preserva edició concurrent', async () => {
  const fake = fakeDb(imagePath);
  let output = { date: '2026-01-01', amount: 10, currency: 'EUR', merchant: 'Botiga', concept: 'Material', confidence: 0.2 };
  const deps = {
    requireOrgMembershipFn: guard as never,
    getAdminDbFn: () => fake.db as never,
    resolveEntitlementFn: entitlement as never,
    resolveApiKeyFn: () => 'key', checkRateLimitFn: rateAllowed,
    getStorageFileFn: () => ({
      getMetadata: async () => [{ size: 4 }] as [Record<string, unknown>],
      download: async () => [Buffer.from([0xff, 0xd8, 0xff, 0x00])] as [Buffer],
    }),
    extractTicketFn: async () => output,
  };
  const body = { orgId: 'org-1', docId: 'pending-1', storagePath: imagePath, context: 'movements', target: 'pending' };
  const low = await handleExtractTicketPost(request('/api/ai/extract-ticket', body), deps);
  assert.equal(low.status, 200);
  assert.equal(fake.writes.length, 0);

  output = { ...output, confidence: 0.9 };
  deps.extractTicketFn = async () => {
    fake.state.invoiceDate = 'MANUAL';
    return output;
  };
  const valid = await handleExtractTicketPost(request('/api/ai/extract-ticket', body), deps);
  assert.equal(valid.status, 200);
  assert.equal(fake.state.invoiceDate, 'MANUAL');
  assert.equal(fake.writes[0]?.invoiceDate, undefined);
  assert.equal(hasUndefined(fake.writes[0]), false);

  const changed = fakeDb('organizations/org-1/pendingDocuments/pending-2/file.jpg');
  const denied = await handleExtractTicketPost(request('/api/ai/extract-ticket', body), {
    ...deps,
    getAdminDbFn: () => changed.db as never,
    extractTicketFn: async () => { throw new Error('unreachable'); },
  });
  assert.equal(denied.status, 400);
  assert.equal(changed.writes.length, 0);

  const raced = fakeDb(imagePath);
  const racedResponse = await handleExtractTicketPost(request('/api/ai/extract-ticket', body), {
    ...deps,
    getAdminDbFn: () => raced.db as never,
    extractTicketFn: async () => {
      raced.state.file = { storagePath: 'organizations/org-1/pendingDocuments/pending-1/replaced.jpg' };
      return output;
    },
  });
  assert.equal(racedResponse.status, 409);
  assert.equal(raced.writes.length, 0);
});

test('imatge offBank exigeix target canònic i metadata/magic vàlids abans de la IA', async () => {
  const offBankPath = 'organizations/org-1/offBankExpenses/temp/random-file.jpg';
  const fake = fakeDb(imagePath, offBankPath);
  let aiCalls = 0;
  const baseDeps = {
    requireOrgMembershipFn: guard as never,
    getAdminDbFn: () => fake.db as never,
    resolveEntitlementFn: entitlement as never,
    resolveApiKeyFn: () => 'key', checkRateLimitFn: rateAllowed,
    getStorageFileFn: () => ({
      getMetadata: async () => [{ size: 4 }] as [Record<string, unknown>],
      download: async () => [Buffer.from([0xff, 0xd8, 0xff, 0x00])] as [Buffer],
    }),
    extractTicketFn: async () => {
      aiCalls += 1;
      return { date: null, amount: 1, currency: 'EUR', merchant: null, concept: null, confidence: 0.9 };
    },
  };
  const goodBody = { orgId: 'org-1', storagePath: offBankPath, context: 'projects', target: 'offBank', targetId: 'expense-1' };
  const good = await handleExtractTicketPost(request('/api/ai/extract-ticket', goodBody), baseDeps);
  assert.equal(good.status, 200);
  assert.equal(aiCalls, 1);
  assert.equal(fake.writes.length, 0);

  const wrong = await handleExtractTicketPost(request('/api/ai/extract-ticket', { ...goodBody, targetId: 'expense-2' }), baseDeps);
  assert.equal(wrong.status, 400);
  assert.equal(aiCalls, 1);

  const crossOrg = await handleExtractTicketPost(request('/api/ai/extract-ticket', {
    ...goodBody, orgId: 'org-2',
  }), {
    ...baseDeps,
    requireOrgMembershipFn: async () => ({
      ok: true as const, auth: { uid: 'user-1' }, membership, orgId: 'org-2',
    }) as never,
  });
  assert.equal(crossOrg.status, 400);
  assert.equal(aiCalls, 1);

  const badSize = await handleExtractTicketPost(request('/api/ai/extract-ticket', goodBody), {
    ...baseDeps,
    getStorageFileFn: () => ({
      getMetadata: async () => [{ size: 0 }] as [Record<string, unknown>],
      download: async () => { throw new Error('must not download'); },
    }),
  });
  assert.equal(badSize.status, 400);
  assert.equal(aiCalls, 1);

  const badMagic = await handleExtractTicketPost(request('/api/ai/extract-ticket', goodBody), {
    ...baseDeps,
    getStorageFileFn: () => ({
      getMetadata: async () => [{ size: 4 }] as [Record<string, unknown>],
      download: async () => [Buffer.from('nope')] as [Buffer],
    }),
  });
  assert.equal(badMagic.status, 200);
  assert.equal(aiCalls, 1);
});

test('PDF OCR rebutja mida i magic invàlids sense IA', async () => {
  const fake = fakeDb(pendingPath);
  let aiCalls = 0;
  const body = { orgId: 'org-1', pendingDocumentId: 'pending-1', storagePath: pendingPath, context: 'movements' };
  const base = {
    requireOrgMembershipFn: guard as never, getAdminDbFn: () => fake.db as never,
    resolveEntitlementFn: entitlement as never, resolveApiKeyFn: () => 'key', checkRateLimitFn: rateAllowed,
    extractPdfFn: async () => { aiCalls += 1; throw new Error('must not call'); },
  };
  const size = await handleExtractPdfPost(request('/api/ai/extract-pdf', body), {
    ...base,
    getFileFn: () => ({ getMetadata: async () => [{ size: 0 }], download: async () => { throw new Error('no download'); } }),
  });
  assert.equal(size.status, 400);
  const magic = await handleExtractPdfPost(request('/api/ai/extract-pdf', body), {
    ...base,
    getFileFn: () => ({ getMetadata: async () => [{ size: 10 }], download: async () => [Buffer.from('not-a-pdf')] }),
  });
  assert.equal(magic.status, 400);
  for (const invalidSize of [Number.NaN, Number.MAX_SAFE_INTEGER]) {
    const invalid = await handleExtractPdfPost(request('/api/ai/extract-pdf', body), {
      ...base,
      getFileFn: () => ({ getMetadata: async () => [{ size: invalidSize }], download: async () => { throw new Error('no download'); } }),
    });
    assert.equal(invalid.status, 400);
  }
  assert.equal(aiCalls, 0);
});

test('flows OCR són només server-side i cap client importa els flows', async () => {
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  for (const file of ['extract-pdf-invoice.ts', 'extract-ticket-image.ts', 'categorize-transactions.ts']) {
    const source = await readFile(join(process.cwd(), 'src/ai/flows', file), 'utf8');
    assert.doesNotMatch(source, /['"]use server['"]/);
    assert.match(source, /import ['"]server-only['"]/);
  }
});
