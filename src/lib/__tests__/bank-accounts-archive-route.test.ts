import assert from 'node:assert/strict';
import test from 'node:test';

import { NextRequest } from 'next/server';

import { handleArchiveBankAccountPost } from '@/app/api/bank-accounts/archive/handler';

type DocData = Record<string, unknown> | null;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/bank-accounts/archive', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer fake-token',
    },
    body: JSON.stringify(body),
  });
}

class FakeDocSnapshot {
  constructor(private readonly dataValue: DocData) {}

  get exists() {
    return this.dataValue !== null;
  }

  data() {
    return this.dataValue;
  }
}

class FakeDocRef {
  constructor(
    private readonly store: Map<string, Record<string, unknown>>,
    readonly path: string
  ) {}

  async get() {
    return new FakeDocSnapshot(this.store.get(this.path) ?? null);
  }

  async update(payload: Record<string, unknown>) {
    const current = this.store.get(this.path);
    if (!current) {
      throw new Error(`missing-doc:${this.path}`);
    }
    this.store.set(this.path, { ...current, ...payload });
  }
}

class FakeCollectionRef {
  constructor(
    private readonly store: Map<string, Record<string, unknown>>,
    private readonly path: string,
    private readonly filters: Array<{ field: string; value: unknown }> = [],
    private readonly limitValue: number | null = null
  ) {}

  where(field: string, _op: string, value: unknown) {
    return new FakeCollectionRef(this.store, this.path, [...this.filters, { field, value }], this.limitValue);
  }

  limit(value: number) {
    return new FakeCollectionRef(this.store, this.path, this.filters, value);
  }

  async get() {
    const prefix = `${this.path}/`;
    let docs = Array.from(this.store.entries())
      .filter(([docPath]) => docPath.startsWith(prefix))
      .filter(([docPath]) => !docPath.slice(prefix.length).includes('/'))
      .map(([docPath, data]) => ({
        id: docPath.slice(prefix.length),
        ref: new FakeDocRef(this.store, docPath),
        data: () => data,
      }));

    for (const filter of this.filters) {
      docs = docs.filter((doc) => doc.data()[filter.field] === filter.value);
    }

    if (this.limitValue !== null) {
      docs = docs.slice(0, this.limitValue);
    }

    return {
      docs,
      size: docs.length,
      empty: docs.length === 0,
    };
  }
}

class FakeDb {
  constructor(private readonly store: Map<string, Record<string, unknown>>) {}

  doc(path: string) {
    return new FakeDocRef(this.store, path);
  }

  collection(path: string) {
    return new FakeCollectionRef(this.store, path);
  }
}

function makeDeps(store: Map<string, Record<string, unknown>>) {
  return {
    verifyIdTokenFn: async () => ({ uid: 'uid-1', email: 'user@test.com' }),
    getAdminDbFn: () => new FakeDb(store) as any,
    validateUserMembershipFn: async () => ({
      valid: true,
      role: 'admin',
      userOverrides: null,
      userGrants: null,
    }) as any,
  };
}

test('POST /api/bank-accounts/archive retorna 403 per role user', async () => {
  const store = new Map<string, Record<string, unknown>>();
  let dbCalls = 0;

  const response = await handleArchiveBankAccountPost(
    makeRequest({ orgId: 'org-1', bankAccountId: 'acc-1' }),
    {
      verifyIdTokenFn: async () => ({ uid: 'uid-user', email: 'user@test.com' }),
      getAdminDbFn: () => {
        dbCalls += 1;
        return new FakeDb(store) as any;
      },
      validateUserMembershipFn: async () => ({
        valid: true,
        role: 'user',
        userOverrides: null,
        userGrants: null,
      }) as any,
    }
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    success: false,
    error: 'Només administradors poden arxivar comptes bancaris.',
    code: 'ADMIN_REQUIRED',
  });
  assert.equal(dbCalls, 1);
});

test('POST /api/bank-accounts/archive deixa continuar a admin i arxiva si no hi ha transaccions', async () => {
  const store = new Map<string, Record<string, unknown>>();
  store.set('organizations/org-1/bankAccounts/acc-1', {
    name: 'Compte 1',
    archivedAt: null,
    isActive: true,
  });
  store.set('organizations/org-1/bankAccounts/acc-2', {
    name: 'Compte 2',
    archivedAt: null,
    isActive: true,
  });

  const response = await handleArchiveBankAccountPost(
    makeRequest({ orgId: 'org-1', bankAccountId: 'acc-1' }),
    makeDeps(store)
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
  });
  const archived = store.get('organizations/org-1/bankAccounts/acc-1');
  assert.ok(archived?.archivedAt);
  assert.equal(archived?.archivedFromAction, 'archive-bankaccount-api');
  assert.equal(archived?.isActive, false);
});
