import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { handleArchiveContactPost } from '@/app/api/contacts/archive/handler';
import { requireOperationalAccess } from '@/lib/api/require-operational-access';

type DocData = Record<string, unknown> | null;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/contacts/archive', {
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
    private readonly filters: Array<{ field: string; value: unknown }> = []
  ) {}

  where(field: string, _op: string, value: unknown) {
    return new FakeCollectionRef(this.store, this.path, [...this.filters, { field, value }]);
  }

  async get() {
    const prefix = `${this.path}/`;
    let docs = Array.from(this.store.entries())
      .filter(([docPath]) => docPath.startsWith(prefix))
      .filter(([docPath]) => !docPath.slice(prefix.length).includes('/'))
      .map(([docPath, data]) => ({
        id: docPath.slice(prefix.length),
        data: () => data,
      }));

    for (const filter of this.filters) {
      docs = docs.filter((doc) => doc.data()[filter.field] === filter.value);
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
      role: 'user',
      userOverrides: null,
      userGrants: null,
    }) as any,
    requireOperationalAccessFn: requireOperationalAccess,
  };
}

test('POST /api/contacts/archive bloqueja donor amb moviments arxivats encara que el client enviï blockIfAnyTransaction=false', async () => {
  const store = new Map<string, Record<string, unknown>>();
  store.set('organizations/org-1/contacts/contact-1', {
    type: 'donor',
    name: 'Donant 1',
    archivedAt: null,
  });
  store.set('organizations/org-1/transactions/tx-1', {
    contactId: 'contact-1',
    archivedAt: '2026-04-01T10:00:00.000Z',
  });

  const response = await handleArchiveContactPost(
    makeRequest({
      orgId: 'org-1',
      contactId: 'contact-1',
      blockIfAnyTransaction: false,
    }),
    makeDeps(store)
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    error: 'Aquest contacte té 1 moviments associats. No es pot eliminar.',
    code: 'HAS_TRANSACTIONS',
    activeCount: 0,
    archivedCount: 1,
    transactionCount: 1,
  });
});

test('POST /api/contacts/archive permet arxivar donor sense cap moviment associat', async () => {
  const store = new Map<string, Record<string, unknown>>();
  store.set('organizations/org-1/contacts/contact-1', {
    type: 'donor',
    name: 'Donant 1',
    archivedAt: null,
  });

  const response = await handleArchiveContactPost(
    makeRequest({
      orgId: 'org-1',
      contactId: 'contact-1',
      blockIfAnyTransaction: false,
    }),
    makeDeps(store)
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
  });

  const archived = store.get('organizations/org-1/contacts/contact-1');
  assert.ok(archived?.archivedAt);
  assert.equal(archived?.archivedFromAction, 'archive-contact-api');
});
