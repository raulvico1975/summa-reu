import assert from 'node:assert/strict';
import test from 'node:test';

import { NextRequest } from 'next/server';

import { handleDeleteMovementsFamilyPost } from '@/app/api/danger-zone/delete-movements-family/handler';
import { requireOperationalAccess } from '@/lib/api/require-operational-access';

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/danger-zone/delete-movements-family', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer fake-token',
    },
    body: JSON.stringify(body),
  });
}

function makeEmptyDb() {
  return {
    collection: () => ({
      get: async () => ({ docs: [], empty: true }),
      limit: () => ({
        get: async () => ({ docs: [], empty: true }),
      }),
      doc: () => ({
        collection: () => ({
          get: async () => ({ docs: [], empty: true }),
        }),
      }),
    }),
  };
}

function makeBaseDeps() {
  return {
    verifyIdToken: async () => ({ uid: 'user-1', email: 'user@test.com' }),
    isSuperAdmin: async () => false,
    getAdminDb: () => makeEmptyDb() as any,
    validateUserMembership: async () => ({
      valid: true,
      role: 'admin',
      userOverrides: null,
      userGrants: null,
    }) as any,
    requireOperationalAccess,
    buildDeleteMovementsFamilyPlan: () => ({
      transactionPaths: [],
      remittancePendingPaths: [],
      remittancePaths: [],
      prebankRemittancePaths: [],
      pendingDocumentPaths: [],
      importRunPaths: [],
      importJobPaths: [],
      totalDeletes: 0,
    }),
    executeDeleteMovementsFamilyPlan: async () => {},
  };
}

test('POST /api/danger-zone/delete-movements-family retorna 403 per user no SuperAdmin', async () => {
  let dbCalls = 0;
  let membershipCalls = 0;

  const response = await handleDeleteMovementsFamilyPost(
    makeRequest({ orgId: 'org-1' }),
    {
      ...makeBaseDeps(),
      isSuperAdmin: async () => false,
      getAdminDb: () => {
        dbCalls += 1;
        return makeEmptyDb() as any;
      },
      validateUserMembership: async () => {
        membershipCalls += 1;
        return {
          valid: true,
          role: 'user',
          userOverrides: null,
          userGrants: null,
        } as any;
      },
    }
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    success: false,
    error: 'Només SuperAdmin pot esborrar aquesta família de moviments.',
    code: 'SUPERADMIN_REQUIRED',
  });
  assert.equal(dbCalls, 0);
  assert.equal(membershipCalls, 0);
});

test('POST /api/danger-zone/delete-movements-family retorna 403 per admin d org que no es SuperAdmin', async () => {
  let dbCalls = 0;
  let membershipCalls = 0;

  const response = await handleDeleteMovementsFamilyPost(
    makeRequest({ orgId: 'org-1' }),
    {
      ...makeBaseDeps(),
      isSuperAdmin: async () => false,
      getAdminDb: () => {
        dbCalls += 1;
        return makeEmptyDb() as any;
      },
      validateUserMembership: async () => {
        membershipCalls += 1;
        return {
          valid: true,
          role: 'admin',
          userOverrides: null,
          userGrants: null,
        } as any;
      },
    }
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    success: false,
    error: 'Només SuperAdmin pot esborrar aquesta família de moviments.',
    code: 'SUPERADMIN_REQUIRED',
  });
  assert.equal(dbCalls, 0);
  assert.equal(membershipCalls, 0);
});

test('POST /api/danger-zone/delete-movements-family deixa continuar a SuperAdmin i retorna idempotent si no hi ha res a esborrar', async () => {
  let membershipCalls = 0;

  const response = await handleDeleteMovementsFamilyPost(
    makeRequest({ orgId: 'org-1' }),
    {
      ...makeBaseDeps(),
      isSuperAdmin: async () => true,
      validateUserMembership: async () => {
        membershipCalls += 1;
        return {
          valid: true,
          role: 'admin',
          userOverrides: null,
          userGrants: null,
        } as any;
      },
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    idempotent: true,
    deleted: {
      transactions: 0,
      remittancesPending: 0,
      remittances: 0,
      prebankRemittances: 0,
      pendingDocuments: 0,
      importRuns: 0,
      importJobs: 0,
      total: 0,
    },
  });
  assert.equal(membershipCalls, 1);
});
