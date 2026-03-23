import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAdminMembership } from '../fiscal/remittances/admin-auth';

const fakeRequest = {} as any;

class FakeDb {
  constructor(private readonly docs = new Map<string, Record<string, unknown>>()) {}

  doc(path: string) {
    return {
      get: async () => ({
        exists: this.docs.has(path),
        data: () => this.docs.get(path),
      }),
    };
  }
}

test('verifyAdminMembership: SuperAdmin sense membership -> success', async () => {
  const fakeDb = new FakeDb(
    new Map([
      ['systemSuperAdmins/super-uid', { createdAt: '2026-03-23T00:00:00.000Z' }],
    ])
  );

  const result = await verifyAdminMembership(fakeRequest, 'org-test', {
    verifyIdTokenFn: async () => ({ uid: 'super-uid', email: 'super@test.com' }),
    getAdminDbFn: () => fakeDb as any,
    loadMemberDataFn: async () => null,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.uid, 'super-uid');
  }
});

test('verifyAdminMembership: usuari sense membership -> NOT_MEMBER', async () => {
  const originalSuperAdminUid = process.env.SUPER_ADMIN_UID;
  process.env.SUPER_ADMIN_UID = 'user-uid';

  try {
    const fakeDb = new FakeDb();

    const result = await verifyAdminMembership(fakeRequest, 'org-test', {
      verifyIdTokenFn: async () => ({ uid: 'user-uid', email: 'user@test.com' }),
      getAdminDbFn: () => fakeDb as any,
      loadMemberDataFn: async () => null,
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.code, 'NOT_MEMBER');
      assert.equal(result.status, 403);
    }
  } finally {
    if (originalSuperAdminUid === undefined) {
      delete process.env.SUPER_ADMIN_UID;
    } else {
      process.env.SUPER_ADMIN_UID = originalSuperAdminUid;
    }
  }
});

test('verifyAdminMembership: admin membre -> success', async () => {
  const fakeDb = new FakeDb();

  const result = await verifyAdminMembership(fakeRequest, 'org-test', {
    verifyIdTokenFn: async () => ({ uid: 'admin-uid', email: 'admin@test.com' }),
    getAdminDbFn: () => fakeDb as any,
    loadMemberDataFn: async () => ({ role: 'admin' }),
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.uid, 'admin-uid');
  }
});
