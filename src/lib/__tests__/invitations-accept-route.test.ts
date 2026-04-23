import test from 'node:test';
import assert from 'node:assert/strict';
import { handleInvitationAccept } from '@/app/api/invitations/accept/handler';

type DocData = Record<string, unknown>;

class FakeDocRef {
  constructor(
    private readonly store: Map<string, DocData>,
    public readonly path: string
  ) {}

  async get() {
    const data = this.store.get(this.path);
    return {
      exists: data !== undefined,
      data: () => data,
    };
  }
}

class FakeBatch {
  private readonly ops: Array<() => void> = [];

  constructor(private readonly store: Map<string, DocData>) {}

  set(ref: FakeDocRef, payload: DocData) {
    this.ops.push(() => {
      this.store.set(ref.path, { ...payload });
    });
  }

  update(ref: FakeDocRef, payload: DocData) {
    this.ops.push(() => {
      const existing = this.store.get(ref.path);
      if (!existing) {
        throw new Error(`missing_doc:${ref.path}`);
      }
      this.store.set(ref.path, { ...existing, ...payload });
    });
  }

  async commit() {
    for (const op of this.ops) {
      op();
    }
  }
}

class FakeDb {
  constructor(private readonly store: Map<string, DocData>) {}

  doc(path: string) {
    return new FakeDocRef(this.store, path);
  }

  batch() {
    return new FakeBatch(this.store);
  }
}

function createRequest(body: unknown) {
  return {
    json: async () => body,
  } as any;
}

test('POST /api/invitations/accept writes granular permissions and capabilities for role user invitation', async () => {
  const store = new Map<string, DocData>();
  store.set('invitations/inv-1', {
    organizationId: 'org-1',
    email: 'new.user@test.com',
    role: 'user',
    userOverrides: { deny: ['moviments.read', 'projectes.manage'] },
    userGrants: ['projectes.expenseInput'],
  });

  const response = await handleInvitationAccept(
    createRequest({
      invitationId: 'inv-1',
      organizationId: 'org-1',
      displayName: 'New User',
      email: 'new.user@test.com',
      role: 'user',
    }),
    {
      verifyIdTokenFn: async () => ({ uid: 'uid-1', email: 'new.user@test.com' }),
      getAdminDbFn: () => new FakeDb(store) as any,
      nowIsoFn: () => '2026-03-05T12:00:00.000Z',
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json() as { success: boolean };
  assert.equal(body.success, true);

  const member = store.get('organizations/org-1/members/uid-1');
  assert.ok(member);
  assert.deepEqual(member?.userOverrides, { deny: ['moviments.read', 'projectes.manage'] });
  assert.deepEqual(member?.userGrants, ['projectes.expenseInput']);
  assert.equal((member?.capabilities as Record<string, boolean>)['projectes.expenseInput'], true);
  assert.equal((member?.capabilities as Record<string, boolean>)['projectes.manage'], undefined);
  assert.equal((member?.capabilities as Record<string, boolean>)['moviments.read'], undefined);

  const invitation = store.get('invitations/inv-1');
  assert.equal(invitation?.usedBy, 'uid-1');
  assert.ok(invitation?.usedAt);
});

test('POST /api/invitations/accept keeps legacy behavior when invitation has no granular permissions', async () => {
  const store = new Map<string, DocData>();
  store.set('invitations/inv-2', {
    organizationId: 'org-2',
    email: 'legacy.user@test.com',
    role: 'user',
  });

  const response = await handleInvitationAccept(
    createRequest({
      invitationId: 'inv-2',
      organizationId: 'org-2',
      displayName: 'Legacy User',
      email: 'legacy.user@test.com',
      role: 'user',
    }),
    {
      verifyIdTokenFn: async () => ({ uid: 'uid-2', email: 'legacy.user@test.com' }),
      getAdminDbFn: () => new FakeDb(store) as any,
      nowIsoFn: () => '2026-03-05T12:00:00.000Z',
    }
  );

  assert.equal(response.status, 200);
  const member = store.get('organizations/org-2/members/uid-2');
  assert.ok(member);
  assert.equal((member?.capabilities as Record<string, boolean>)['moviments.read'], true);
  assert.deepEqual(member?.userOverrides, undefined);
  assert.deepEqual(member?.userGrants, undefined);
});

test('POST /api/invitations/accept canonicalizes project none and removes project capabilities', async () => {
  const store = new Map<string, DocData>();
  store.set('invitations/inv-none', {
    organizationId: 'org-none',
    email: 'none.user@test.com',
    role: 'user',
    userOverrides: { deny: ['projectes.manage', 'projectes.expenseInput'] },
  });

  const response = await handleInvitationAccept(
    createRequest({
      invitationId: 'inv-none',
      organizationId: 'org-none',
      displayName: 'None User',
      email: 'none.user@test.com',
      role: 'user',
    }),
    {
      verifyIdTokenFn: async () => ({ uid: 'uid-none', email: 'none.user@test.com' }),
      getAdminDbFn: () => new FakeDb(store) as any,
      nowIsoFn: () => '2026-03-05T12:00:00.000Z',
    }
  );

  assert.equal(response.status, 200);
  const member = store.get('organizations/org-none/members/uid-none');
  assert.ok(member);
  assert.deepEqual(member?.userOverrides, { deny: ['projectes.expenseInput', 'projectes.manage', 'sections.projectes'] });
  assert.equal((member?.capabilities as Record<string, boolean>)['projectes.manage'], undefined);
  assert.equal((member?.capabilities as Record<string, boolean>)['projectes.expenseInput'], undefined);
  assert.equal((member?.capabilities as Record<string, boolean>)['sections.projectes'], undefined);
  assert.ok(store.get('invitations/inv-none')?.usedAt);
});

test('POST /api/invitations/accept rejects invalid granular payload and does not consume invitation', async () => {
  const store = new Map<string, DocData>();
  store.set('invitations/inv-3', {
    organizationId: 'org-3',
    email: 'broken.user@test.com',
    role: 'user',
    userGrants: 'not-an-array',
  });

  const response = await handleInvitationAccept(
    createRequest({
      invitationId: 'inv-3',
      organizationId: 'org-3',
      displayName: 'Broken User',
      email: 'broken.user@test.com',
      role: 'user',
    }),
    {
      verifyIdTokenFn: async () => ({ uid: 'uid-3', email: 'broken.user@test.com' }),
      getAdminDbFn: () => new FakeDb(store) as any,
      nowIsoFn: () => '2026-03-05T12:00:00.000Z',
    }
  );

  assert.equal(response.status, 400);
  const body = await response.json() as { success: boolean; error?: string };
  assert.equal(body.success, false);
  assert.equal(body.error, 'invalid_invitation_permissions');
  assert.equal(store.get('organizations/org-3/members/uid-3'), undefined);
  assert.equal(store.get('invitations/inv-3')?.usedAt, undefined);
});

test('POST /api/invitations/accept returns invitation_expired when expiresAt is in the past', async () => {
  const store = new Map<string, DocData>();
  store.set('invitations/inv-4', {
    organizationId: 'org-4',
    email: 'expired.user@test.com',
    role: 'user',
    expiresAt: '2026-03-01T00:00:00.000Z',
  });

  const response = await handleInvitationAccept(
    createRequest({
      invitationId: 'inv-4',
      organizationId: 'org-4',
      displayName: 'Expired User',
      email: 'expired.user@test.com',
      role: 'user',
    }),
    {
      verifyIdTokenFn: async () => ({ uid: 'uid-4', email: 'expired.user@test.com' }),
      getAdminDbFn: () => new FakeDb(store) as any,
      nowIsoFn: () => '2026-03-05T12:00:00.000Z',
    }
  );

  assert.equal(response.status, 410);
  const body = await response.json() as { success: boolean; error?: string };
  assert.equal(body.success, false);
  assert.equal(body.error, 'invitation_expired');
  assert.equal(store.get('organizations/org-4/members/uid-4'), undefined);
  assert.equal(store.get('invitations/inv-4')?.usedAt, undefined);
});

test('POST /api/invitations/accept returns already_member and does not consume invitation', async () => {
  const store = new Map<string, DocData>();
  store.set('invitations/inv-5', {
    organizationId: 'org-5',
    email: 'member@test.com',
    role: 'admin',
  });
  store.set('organizations/org-5/members/uid-5', {
    userId: 'uid-5',
    email: 'member@test.com',
    displayName: 'Existing Member',
    role: 'viewer',
    capabilities: { 'moviments.read': true },
  });

  const response = await handleInvitationAccept(
    createRequest({
      invitationId: 'inv-5',
      organizationId: 'org-5',
      displayName: 'Existing Member',
      email: 'member@test.com',
      role: 'admin',
    }),
    {
      verifyIdTokenFn: async () => ({ uid: 'uid-5', email: 'member@test.com' }),
      getAdminDbFn: () => new FakeDb(store) as any,
      nowIsoFn: () => '2026-03-05T12:00:00.000Z',
    }
  );

  assert.equal(response.status, 409);
  const body = await response.json() as { success: boolean; error?: string };
  assert.equal(body.success, false);
  assert.equal(body.error, 'already_member');
  assert.equal(store.get('invitations/inv-5')?.usedAt, undefined);
  assert.equal((store.get('organizations/org-5/members/uid-5')?.role as string), 'viewer');
});

test('POST /api/invitations/accept rejects invitation when token email does not match invitation email', async () => {
  const store = new Map<string, DocData>();
  store.set('invitations/inv-6', {
    organizationId: 'org-6',
    email: 'victim@test.com',
    role: 'user',
  });

  const response = await handleInvitationAccept(
    createRequest({
      invitationId: 'inv-6',
      organizationId: 'org-6',
      displayName: 'Attacker',
      email: 'victim@test.com',
      role: 'user',
    }),
    {
      verifyIdTokenFn: async () => ({ uid: 'uid-6', email: 'attacker@test.com' }),
      getAdminDbFn: () => new FakeDb(store) as any,
      nowIsoFn: () => '2026-03-05T12:00:00.000Z',
    }
  );

  assert.equal(response.status, 403);
  const body = await response.json() as { success: boolean; error?: string };
  assert.equal(body.success, false);
  assert.equal(body.error, 'email_mismatch');
  assert.equal(store.get('organizations/org-6/members/uid-6'), undefined);
  assert.equal(store.get('invitations/inv-6')?.usedAt, undefined);
});
