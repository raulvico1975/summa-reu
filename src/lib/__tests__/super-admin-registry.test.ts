import test from 'node:test';
import assert from 'node:assert/strict';
import { isSuperAdminInRegistry } from '@/lib/api/super-admin-registry';

class FakeAdminDb {
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

test('isSuperAdminInRegistry: sense doc al registre no dona accés encara que coincideixi amb env', async () => {
  const originalSuperAdminUid = process.env.SUPER_ADMIN_UID;
  process.env.SUPER_ADMIN_UID = 'env-super-admin';

  try {
    const result = await isSuperAdminInRegistry(
      new FakeAdminDb() as never,
      'env-super-admin'
    );

    assert.equal(result, false);
  } finally {
    if (originalSuperAdminUid === undefined) {
      delete process.env.SUPER_ADMIN_UID;
    } else {
      process.env.SUPER_ADMIN_UID = originalSuperAdminUid;
    }
  }
});

test('isSuperAdminInRegistry: amb doc al registre dona accés', async () => {
  const db = new FakeAdminDb(
    new Map([
      ['systemSuperAdmins/uid-super-admin', { createdAt: '2026-03-23T00:00:00.000Z' }],
    ])
  );

  const result = await isSuperAdminInRegistry(db as never, 'uid-super-admin');

  assert.equal(result, true);
});
