import assert from 'node:assert/strict';
import test from 'node:test';

import { NextRequest } from 'next/server';

import { handleArchiveExpenseReportPost } from '@/app/api/expense-reports/archive/handler';
import { handleAnalyzeDocumentPost } from '@/app/api/project-module/document-review/analyze-document/handler';
import type { MembershipValidation } from '@/lib/api/admin-sdk';
import { resolveServerEntitlement } from '@/lib/api/require-entitlement';
import {
  ENTITLEMENTS_CATALOG_VERSION,
  PLAN_ENTITLEMENTS_CATALOG,
  catalogFingerprintFor,
} from '@/lib/entitlements/catalog';
import type { CanonicalPlanId } from '@/lib/entitlements/types';

type DocumentMap = Record<string, Record<string, unknown> | null>;

const adminMembership: MembershipValidation = {
  valid: true,
  role: 'admin',
  userOverrides: null,
  userGrants: null,
};

const projectSectionDeniedMembership: MembershipValidation = {
  valid: true,
  role: 'admin',
  userOverrides: { deny: ['sections.projectes'] },
  userGrants: null,
};

function entitlementDocuments(planId: CanonicalPlanId, corruptConfig = false): DocumentMap {
  return {
    'system/entitlements': corruptConfig
      ? { enforcementMode: 'active', catalogVersion: 'corrupt' }
      : { enforcementMode: 'active', catalogVersion: ENTITLEMENTS_CATALOG_VERSION },
    'organizations/org-1': {
      billingPlan: planId,
      features: { projectModule: true },
    },
    'organizations/org-1/subscription/current': {
      planId,
      status: 'active',
      catalogVersion: ENTITLEMENTS_CATALOG_VERSION,
      catalogFingerprint: catalogFingerprintFor(planId),
      entitlements: PLAN_ENTITLEMENTS_CATALOG[planId].entitlements,
    },
    'organizations/org-1/projectModule/_/offBankExpenses/expense-1': {
      attachments: [{
        storagePath: 'organizations/org-1/offBankExpenses/expense-1/invoice.pdf',
        url: 'https://example.test/invoice.pdf',
        name: 'invoice.pdf',
      }],
    },
  };
}

function archiveRequest(body: Record<string, unknown> = { orgId: 'org-1', reportId: 'report-1' }) {
  return new NextRequest('http://localhost/api/expense-reports/archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    body: JSON.stringify(body),
  });
}

function documentReviewRequest(overrides: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/project-module/document-review/analyze-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    body: JSON.stringify({
      orgId: 'org-1',
      txId: 'off_expense-1',
      storagePath: 'organizations/org-1/offBankExpenses/expense-1/invoice.pdf',
      documentName: 'invoice.pdf',
      rowContext: { source: 'offBank', concept: 'Material', amountAssignedEUR: 42 },
      ...overrides,
    }),
  });
}

function fakeArchiveDb(docs: DocumentMap, counters: { entitlementReads: number; functionalReads: number; writes: number }) {
  return {
    doc(path: string) {
      if (path === 'organizations/org-1/expenseReports/report-1') {
        return {
          async get() {
            counters.functionalReads += 1;
            return { exists: true, data: () => ({ status: 'open' }) };
          },
          async update() {
            counters.writes += 1;
          },
        };
      }
      return {
        async get() {
          counters.entitlementReads += 1;
          const value = docs[path] ?? null;
          return { exists: value !== null, data: () => value ?? undefined };
        },
        async update() {
          throw new Error(`Unexpected update: ${path}`);
        },
      };
    },
    collection(path: string) {
      assert.equal(path, 'organizations/org-1/pendingDocuments');
      return {
        where() {
          return {
            async get() {
              counters.functionalReads += 1;
              return { docs: [] };
            },
          };
        },
      };
    },
  };
}

function fakeEntitlementDb(docs: DocumentMap, counters: { entitlementReads: number; targetReads?: number }) {
  return {
    doc(path: string) {
      return {
        async get() {
          if (
            path === 'system/entitlements'
            || path === 'organizations/org-1'
            || path === 'organizations/org-1/subscription/current'
          ) {
            counters.entitlementReads += 1;
          } else if (counters.targetReads !== undefined) {
            counters.targetReads += 1;
          }
          const value = docs[path] ?? null;
          return { exists: value !== null, data: () => value ?? undefined };
        },
      };
    },
  };
}

test('C3b archive: Control, Management, config corrupta i section deny paren abans de reads funcionals i writes', async () => {
  const scenarios = [
    { label: 'Control', docs: entitlementDocuments('control'), membership: adminMembership },
    { label: 'Management', docs: entitlementDocuments('management'), membership: adminMembership },
    { label: 'config corrupta', docs: entitlementDocuments('complete', true), membership: adminMembership },
    { label: 'section deny', docs: entitlementDocuments('complete'), membership: projectSectionDeniedMembership },
  ];

  for (const scenario of scenarios) {
    const counters = { entitlementReads: 0, functionalReads: 0, writes: 0 };
    const db = fakeArchiveDb(scenario.docs, counters);
    const response = await handleArchiveExpenseReportPost(archiveRequest(), {
      verifyIdTokenFn: async () => ({ uid: 'user-1' }),
      getAdminDbFn: () => db as never,
      validateUserMembershipFn: async () => scenario.membership,
      resolveEntitlementFn: resolveServerEntitlement,
      serverTimestampFn: () => 'server-time',
    });

    assert.equal(response.status, 403, scenario.label);
    assert.equal(counters.functionalReads, 0, `${scenario.label}: functional reads`);
    assert.equal(counters.writes, 0, `${scenario.label}: writes`);
    assert.equal(
      counters.entitlementReads,
      scenario.label === 'section deny' ? 0 : 3,
      `${scenario.label}: only entitlement projection reads are allowed`
    );
  }
});

test('C3b archive: Complete llegeix la liquidació i arxiva una sola vegada', async () => {
  const counters = { entitlementReads: 0, functionalReads: 0, writes: 0 };
  const db = fakeArchiveDb(entitlementDocuments('complete'), counters);
  const response = await handleArchiveExpenseReportPost(archiveRequest(), {
    verifyIdTokenFn: async () => ({ uid: 'user-1' }),
    getAdminDbFn: () => db as never,
    validateUserMembershipFn: async () => adminMembership,
    resolveEntitlementFn: resolveServerEntitlement,
    serverTimestampFn: () => 'server-time',
    nowFn: () => new Date('2026-08-14T10:00:00.000Z'),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(counters.entitlementReads, 3);
  assert.equal(counters.functionalReads, 2);
  assert.equal(counters.writes, 1);
});

test('C3b archive: IDs amb slash o més de 160 caràcters fallen abans de resoldre Firestore', async () => {
  const invalidBodies = [
    { orgId: 'org/other', reportId: 'report-1' },
    { orgId: 'org-1', reportId: 'x'.repeat(161) },
  ];

  for (const body of invalidBodies) {
    let getDbCalls = 0;
    const response = await handleArchiveExpenseReportPost(archiveRequest(body), {
      verifyIdTokenFn: async () => ({ uid: 'user-1' }),
      getAdminDbFn: () => {
        getDbCalls += 1;
        throw new Error('DB must not be resolved for invalid resource IDs');
      },
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json() as { code: string }).code, 'INVALID_ID');
    assert.equal(getDbCalls, 0);
  }
});

test('C3b document review: Control, Management, config corrupta i section deny no toquen key, rate, Storage, IA ni persistència', async () => {
  const scenarios = [
    { label: 'Control', docs: entitlementDocuments('control'), membership: adminMembership },
    { label: 'Management', docs: entitlementDocuments('management'), membership: adminMembership },
    { label: 'config corrupta', docs: entitlementDocuments('complete', true), membership: adminMembership },
    { label: 'section deny', docs: entitlementDocuments('complete'), membership: projectSectionDeniedMembership },
  ];

  for (const scenario of scenarios) {
    const counters = {
      entitlementReads: 0,
      targetReads: 0,
      getDb: 0,
      apiKey: 0,
      rateLimit: 0,
      storageReads: 0,
      ai: 0,
      persistence: 0,
    };
    const db = fakeEntitlementDb(scenario.docs, counters);
    const response = await handleAnalyzeDocumentPost(documentReviewRequest(), {
      requireOrgMembershipFn: async () => ({
        ok: true,
        auth: { uid: 'user-1' },
        membership: scenario.membership,
        orgId: 'org-1',
      }),
      getAdminDbFn: () => {
        counters.getDb += 1;
        return db as never;
      },
      resolveEntitlementFn: resolveServerEntitlement,
      resolveApiKeyFn: () => {
        counters.apiKey += 1;
        return 'test-key';
      },
      checkRateLimitFn: () => {
        counters.rateLimit += 1;
        return { allowed: true, remaining: 1, retryAfterSeconds: 0, resetAt: Date.now() + 1_000 };
      },
      loadDocumentFn: async () => {
        counters.storageReads += 1;
        return { buffer: Buffer.from('%PDF-1.7'), metadataContentType: 'application/pdf', metadataSize: 8 };
      },
      analyzeDocumentFn: async () => {
        counters.ai += 1;
        return { docType: 'invoice', confidence: 0.95, fields: {}, errors: [] };
      },
      persistDetectionFn: async () => {
        counters.persistence += 1;
        return true;
      },
    });

    assert.equal(response.status, 403, scenario.label);
    assert.equal(counters.apiKey, 0, `${scenario.label}: API key`);
    assert.equal(counters.rateLimit, 0, `${scenario.label}: rate limit`);
    assert.equal(counters.storageReads, 0, `${scenario.label}: Storage reads`);
    assert.equal(counters.ai, 0, `${scenario.label}: AI`);
    assert.equal(counters.persistence, 0, `${scenario.label}: persistence`);
    assert.equal(counters.targetReads, 0, `${scenario.label}: target reads`);
    assert.equal(counters.getDb, scenario.label === 'section deny' ? 0 : 1, `${scenario.label}: DB resolution`);
    assert.equal(counters.entitlementReads, scenario.label === 'section deny' ? 0 : 3, `${scenario.label}: entitlement reads`);
  }
});

test('C3b document review: Complete valida l’adjunt i executa Storage, IA i persistència una sola vegada', async () => {
  const counters = { entitlementReads: 0, targetReads: 0, apiKey: 0, rateLimit: 0, storageReads: 0, ai: 0, persistence: 0 };
  const db = fakeEntitlementDb(entitlementDocuments('complete'), counters);
  const response = await handleAnalyzeDocumentPost(documentReviewRequest(), {
    requireOrgMembershipFn: async () => ({
      ok: true,
      auth: { uid: 'user-1' },
      membership: adminMembership,
      orgId: 'org-1',
    }),
    getAdminDbFn: () => db as never,
    resolveEntitlementFn: resolveServerEntitlement,
    resolveApiKeyFn: () => {
      counters.apiKey += 1;
      return 'test-key';
    },
    checkRateLimitFn: () => {
      counters.rateLimit += 1;
      return { allowed: true, remaining: 1, retryAfterSeconds: 0, resetAt: Date.now() + 1_000 };
    },
    loadDocumentFn: async () => {
      counters.storageReads += 1;
      return { buffer: Buffer.from('%PDF-1.7'), metadataContentType: 'application/pdf', metadataSize: 8 };
    },
    resolveModelFn: () => 'gpt-test',
    analyzeDocumentFn: async () => {
      counters.ai += 1;
      return { docType: 'invoice', confidence: 0.95, fields: {}, errors: [] };
    },
    persistDetectionFn: async () => {
      counters.persistence += 1;
      return true;
    },
  });

  assert.equal(response.status, 200);
  const json = await response.json() as { ok: boolean; persisted: boolean; detection: { docType: string } };
  assert.equal(json.ok, true);
  assert.equal(json.persisted, true);
  assert.equal(json.detection.docType, 'invoice');
  assert.deepEqual(counters, {
    entitlementReads: 3,
    targetReads: 1,
    apiKey: 1,
    rateLimit: 1,
    storageReads: 1,
    ai: 1,
    persistence: 1,
  });
});

test('C3b document review: cross-expense i mateix filename A/B fallen abans de key, rate, Storage, IA i writes', async () => {
  const baseDocs = entitlementDocuments('complete');
  const scenarios = [
    {
      label: 'txId creuat amb el segment del path',
      request: documentReviewRequest({ txId: 'off_expense-2' }),
      docs: baseDocs,
      expectedTargetReads: 0,
    },
    {
      label: 'mateix filename però adjunt d’una altra despesa',
      request: documentReviewRequest(),
      docs: {
        ...baseDocs,
        'organizations/org-1/projectModule/_/offBankExpenses/expense-1': {
          attachments: [{
            storagePath: 'organizations/org-1/offBankExpenses/expense-2/invoice.pdf',
            url: 'https://example.test/expense-2/invoice.pdf',
            name: 'invoice.pdf',
          }],
        },
      },
      expectedTargetReads: 1,
    },
    {
      label: 'temp path consultat contra una altra despesa',
      request: documentReviewRequest({
        txId: 'off_expense-2',
        storagePath: 'organizations/org-1/offBankExpenses/temp/upload-1_invoice.pdf',
      }),
      docs: {
        ...baseDocs,
        'organizations/org-1/projectModule/_/offBankExpenses/expense-1': {
          attachments: [{
            storagePath: 'organizations/org-1/offBankExpenses/temp/upload-1_invoice.pdf',
            name: 'invoice.pdf',
          }],
        },
      },
      expectedTargetReads: 1,
    },
  ];

  for (const scenario of scenarios) {
    const counters = { entitlementReads: 0, targetReads: 0, apiKey: 0, rate: 0, storage: 0, ai: 0, writes: 0 };
    const db = fakeEntitlementDb(scenario.docs, counters);
    const response = await handleAnalyzeDocumentPost(scenario.request, {
      requireOrgMembershipFn: async () => ({
        ok: true,
        auth: { uid: 'user-1' },
        membership: adminMembership,
        orgId: 'org-1',
      }),
      getAdminDbFn: () => db as never,
      resolveEntitlementFn: resolveServerEntitlement,
      resolveApiKeyFn: () => { counters.apiKey += 1; return 'test-key'; },
      checkRateLimitFn: () => {
        counters.rate += 1;
        return { allowed: true, remaining: 1, retryAfterSeconds: 0, resetAt: Date.now() + 1_000 };
      },
      loadDocumentFn: async () => {
        counters.storage += 1;
        return { buffer: Buffer.from('%PDF-1.7'), metadataContentType: 'application/pdf', metadataSize: 8 };
      },
      analyzeDocumentFn: async () => {
        counters.ai += 1;
        return { docType: 'invoice', confidence: 0.95, fields: {}, errors: [] };
      },
      persistDetectionFn: async () => { counters.writes += 1; return true; },
    });

    assert.equal(response.status, 400, scenario.label);
    assert.equal(counters.entitlementReads, 3, scenario.label);
    assert.equal(counters.targetReads, scenario.expectedTargetReads, scenario.label);
    assert.equal(counters.apiKey, 0, `${scenario.label}: API key`);
    assert.equal(counters.rate, 0, `${scenario.label}: rate limit`);
    assert.equal(counters.storage, 0, `${scenario.label}: Storage`);
    assert.equal(counters.ai, 0, `${scenario.label}: AI`);
    assert.equal(counters.writes, 0, `${scenario.label}: writes`);
  }
});

test('C3b document review: temp path és vàlid només quan consta a la despesa real del txId', async () => {
  const tempPath = 'organizations/org-1/offBankExpenses/temp/upload-1_invoice.pdf';
  const docs = {
    ...entitlementDocuments('complete'),
    'organizations/org-1/projectModule/_/offBankExpenses/expense-1': {
      attachments: [{ storagePath: tempPath, name: 'invoice.pdf' }],
    },
  };
  const counters = { entitlementReads: 0, targetReads: 0, apiKey: 0, rate: 0, storage: 0, ai: 0, writes: 0 };
  const db = fakeEntitlementDb(docs, counters);
  const response = await handleAnalyzeDocumentPost(documentReviewRequest({ storagePath: tempPath }), {
    requireOrgMembershipFn: async () => ({
      ok: true,
      auth: { uid: 'user-1' },
      membership: adminMembership,
      orgId: 'org-1',
    }),
    getAdminDbFn: () => db as never,
    resolveEntitlementFn: resolveServerEntitlement,
    resolveApiKeyFn: () => { counters.apiKey += 1; return 'test-key'; },
    checkRateLimitFn: () => {
      counters.rate += 1;
      return { allowed: true, remaining: 1, retryAfterSeconds: 0, resetAt: Date.now() + 1_000 };
    },
    loadDocumentFn: async () => {
      counters.storage += 1;
      return { buffer: Buffer.from('%PDF-1.7'), metadataContentType: 'application/pdf', metadataSize: 8 };
    },
    analyzeDocumentFn: async () => {
      counters.ai += 1;
      return { docType: 'invoice', confidence: 0.95, fields: {}, errors: [] };
    },
    persistDetectionFn: async () => { counters.writes += 1; return true; },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(counters, {
    entitlementReads: 3,
    targetReads: 1,
    apiKey: 1,
    rate: 1,
    storage: 1,
    ai: 1,
    writes: 1,
  });
});

test('C3b document review: document bancari exigeix moviments.read abans del target i serveis externs', async () => {
  const docs = {
    ...entitlementDocuments('complete'),
    'organizations/org-1/exports/projectExpenses/items/tx-1': {
      documents: [{ storagePath: 'organizations/org-1/documents/tx-1/invoice.pdf' }],
    },
  };
  const counters = { entitlementReads: 0, targetReads: 0, apiKey: 0, rate: 0, storage: 0, ai: 0, writes: 0 };
  const db = fakeEntitlementDb(docs, counters);
  const response = await handleAnalyzeDocumentPost(documentReviewRequest({
    txId: 'tx-1',
    storagePath: 'organizations/org-1/documents/tx-1/invoice.pdf',
    rowContext: { source: 'bank', concept: 'Factura bancària' },
  }), {
    requireOrgMembershipFn: async () => ({
      ok: true,
      auth: { uid: 'user-1' },
      membership: {
        valid: true,
        role: 'viewer',
        userGrants: ['projectes.expenseInput'],
        userOverrides: { deny: ['moviments.read'] },
      },
      orgId: 'org-1',
    }),
    getAdminDbFn: () => db as never,
    resolveEntitlementFn: resolveServerEntitlement,
    resolveApiKeyFn: () => { counters.apiKey += 1; return 'test-key'; },
    checkRateLimitFn: () => {
      counters.rate += 1;
      return { allowed: true, remaining: 1, retryAfterSeconds: 0, resetAt: Date.now() + 1_000 };
    },
    loadDocumentFn: async () => {
      counters.storage += 1;
      return { buffer: Buffer.from('%PDF-1.7'), metadataContentType: 'application/pdf', metadataSize: 8 };
    },
    analyzeDocumentFn: async () => {
      counters.ai += 1;
      return { docType: 'invoice', confidence: 0.95, fields: {}, errors: [] };
    },
    persistDetectionFn: async () => { counters.writes += 1; return true; },
  });

  assert.equal(response.status, 403);
  assert.equal(counters.entitlementReads, 3);
  assert.equal(counters.targetReads, 0);
  assert.equal(counters.apiKey, 0);
  assert.equal(counters.rate, 0);
  assert.equal(counters.storage, 0);
  assert.equal(counters.ai, 0);
  assert.equal(counters.writes, 0);
});
