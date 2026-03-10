import test from 'node:test';
import assert from 'node:assert/strict';
import { handleInvitationCreate } from '@/app/api/invitations/create/handler';

type DocData = Record<string, unknown>;

class FakeDocSnap {
  constructor(
    public readonly exists: boolean,
    private readonly payload: DocData | undefined
  ) {}

  data() {
    return this.payload;
  }
}

class FakeDocRef {
  constructor(
    private readonly store: Map<string, DocData>,
    public readonly path: string
  ) {}

  async get() {
    const data = this.store.get(this.path);
    return new FakeDocSnap(data !== undefined, data);
  }

  async set(payload: DocData) {
    this.store.set(this.path, { ...payload });
  }
}

class FakeQuerySnapshot {
  constructor(public readonly docs: Array<{ id: string; data: () => DocData }>) {}

  get empty() {
    return this.docs.length === 0;
  }
}

class FakeQuery {
  constructor(
    private readonly store: Map<string, DocData>,
    private readonly collectionPath: string,
    private readonly filters: Array<{ field: string; value: unknown }> = [],
    private readonly maxDocs: number | null = null
  ) {}

  where(field: string, _op: string, value: unknown) {
    return new FakeQuery(this.store, this.collectionPath, [...this.filters, { field, value }], this.maxDocs);
  }

  limit(maxDocs: number) {
    return new FakeQuery(this.store, this.collectionPath, this.filters, maxDocs);
  }

  doc(docId?: string) {
    const nextId = docId || `${this.collectionPath.split('/').pop()}-${Math.random().toString(36).slice(2, 10)}`;
    return new FakeDocRef(this.store, `${this.collectionPath}/${nextId}`);
  }

  async get() {
    const prefix = `${this.collectionPath}/`;
    const docs = Array.from(this.store.entries())
      .filter(([path]) => path.startsWith(prefix))
      .filter(([path]) => path.slice(prefix.length).indexOf('/') === -1)
      .filter(([, data]) => this.filters.every((filter) => data[filter.field] === filter.value))
      .slice(0, this.maxDocs ?? undefined)
      .map(([path, data]) => ({
        id: path.slice(prefix.length),
        data: () => data,
      }));

    return new FakeQuerySnapshot(docs);
  }
}

class FakeDb {
  constructor(private readonly store: Map<string, DocData>) {}

  doc(path: string) {
    return new FakeDocRef(this.store, path);
  }

  collection(path: string) {
    return new FakeQuery(this.store, path);
  }
}

function createRequest(body: unknown) {
  return {
    json: async () => body,
  } as any;
}

test('POST /api/invitations/create reuses existing pending invitation for same org/email', async () => {
  const store = new Map<string, DocData>();
  store.set('organizations/org-1', { name: 'Org 1' });
  store.set('invitations/inv-pending', {
    id: 'inv-pending',
    organizationId: 'org-1',
    email: 'pending@test.com',
    token: 'existing-token',
    role: 'user',
    createdAt: '2026-03-01T10:00:00.000Z',
    expiresAt: '2026-03-20T10:00:00.000Z',
    createdBy: 'admin-1',
  });

  const response = await handleInvitationCreate(
    createRequest({
      organizationId: 'org-1',
      email: 'pending@test.com',
      role: 'user',
    }),
    {
      verifyIdTokenFn: async () => ({ uid: 'admin-1', email: 'admin@test.com' }),
      validateUserMembershipFn: async () => ({ valid: true, role: 'admin', userOverrides: null, userGrants: null }),
      getAdminDbFn: () => new FakeDb(store) as any,
      nowIsoFn: () => '2026-03-10T12:00:00.000Z',
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json() as { success: boolean; reused?: boolean; token?: string };
  assert.equal(body.success, true);
  assert.equal(body.reused, true);
  assert.equal(body.token, 'existing-token');
  assert.equal(Array.from(store.keys()).filter((path) => path.startsWith('invitations/')).length, 1);
});

test('POST /api/invitations/create rejects email that is already a member', async () => {
  const store = new Map<string, DocData>();
  store.set('organizations/org-2', { name: 'Org 2' });
  store.set('organizations/org-2/members/member-1', {
    userId: 'member-1',
    email: 'member@test.com',
    role: 'user',
  });

  const response = await handleInvitationCreate(
    createRequest({
      organizationId: 'org-2',
      email: 'member@test.com',
      role: 'viewer',
    }),
    {
      verifyIdTokenFn: async () => ({ uid: 'admin-2', email: 'admin@test.com' }),
      validateUserMembershipFn: async () => ({ valid: true, role: 'admin', userOverrides: null, userGrants: null }),
      getAdminDbFn: () => new FakeDb(store) as any,
      nowIsoFn: () => '2026-03-10T12:00:00.000Z',
    }
  );

  assert.equal(response.status, 409);
  const body = await response.json() as { success: boolean; error?: string };
  assert.equal(body.success, false);
  assert.equal(body.error, 'member_already_exists');
});

test('POST /api/invitations/create creates new invitation when no conflicts exist', async () => {
  const store = new Map<string, DocData>();
  store.set('organizations/org-3', { name: 'Org 3' });

  const response = await handleInvitationCreate(
    createRequest({
      organizationId: 'org-3',
      email: 'new@test.com',
      role: 'user',
      userGrants: ['projectes.expenseInput'],
    }),
    {
      verifyIdTokenFn: async () => ({ uid: 'admin-3', email: 'admin@test.com' }),
      validateUserMembershipFn: async () => ({ valid: true, role: 'admin', userOverrides: null, userGrants: null }),
      getAdminDbFn: () => new FakeDb(store) as any,
      nowIsoFn: () => '2026-03-10T12:00:00.000Z',
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json() as { success: boolean; token?: string; reused?: boolean };
  assert.equal(body.success, true);
  assert.equal(body.reused, false);
  assert.ok(body.token);
  assert.equal(Array.from(store.keys()).filter((path) => path.startsWith('invitations/')).length, 1);
});
