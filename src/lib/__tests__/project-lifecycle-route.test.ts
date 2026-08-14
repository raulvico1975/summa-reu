import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { handleProjectLifecyclePost } from '@/lib/project-module/project-lifecycle-route-handler';

type DocData = Record<string, unknown> | null;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/project-module/projects/lifecycle', {
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

  collection(name: string) {
    return new FakeCollectionRef(this.store, `${this.path}/${name}`);
  }

  async update(payload: Record<string, unknown>) {
    const current = this.store.get(this.path);
    if (!current) throw new Error(`missing-doc:${this.path}`);
    this.store.set(this.path, { ...current, ...payload });
  }

  async delete() {
    this.store.delete(this.path);
  }
}

class FakeCollectionRef {
  constructor(
    private readonly store: Map<string, Record<string, unknown>>,
    private readonly path: string,
    private readonly filters: Array<{ field: string; op: string; value: unknown }> = [],
    private readonly limitValue: number | null = null
  ) {}

  where(field: string, op: string, value: unknown) {
    return new FakeCollectionRef(this.store, this.path, [...this.filters, { field, op, value }], this.limitValue);
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
      docs = docs.filter((doc) => {
        const value = doc.data()[filter.field];
        if (filter.op === 'array-contains') {
          return Array.isArray(value) && value.includes(filter.value);
        }
        return value === filter.value;
      });
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

function makeDeps(
  store: Map<string, Record<string, unknown>>,
  membership: { valid: boolean; role: 'admin' | 'user' | 'viewer' | null; userOverrides: { deny?: string[] } | null; userGrants: string[] | null } = {
    valid: true,
    role: 'admin',
    userOverrides: null,
    userGrants: null,
  }
) {
  return {
    verifyIdTokenFn: async () => ({ uid: 'uid-1', email: 'user@test.com' }),
    getAdminDbFn: () => new FakeDb(store) as any,
    validateUserMembershipFn: async () => membership as any,
    resolveEntitlementFn: async () => ({ allowed: true, diagnostics: [], enforcementMode: 'active' as const }),
  };
}

test('project lifecycle API rejects missing token', async () => {
  const response = await handleProjectLifecyclePost(
    makeRequest({ action: 'inspectDelete', orgId: 'org-1', projectId: 'project-1' }),
    {
      verifyIdTokenFn: async () => null,
      getAdminDbFn: () => new FakeDb(new Map()) as any,
      validateUserMembershipFn: async () => ({ valid: false, role: null, userOverrides: null, userGrants: null }) as any,
    }
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    success: false,
    code: 'UNAUTHORIZED',
    error: 'No autenticat',
  });
});

test('project lifecycle API rejects users without projectes.manage', async () => {
  const store = new Map<string, Record<string, unknown>>();
  store.set('organizations/org-1/projectModule/_/projects/project-1', { name: 'Projecte 1', status: 'active' });

  const response = await handleProjectLifecyclePost(
    makeRequest({ action: 'inspectDelete', orgId: 'org-1', projectId: 'project-1' }),
    makeDeps(store, { valid: true, role: 'viewer', userOverrides: null, userGrants: null })
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    success: false,
    error: 'PERMISSION_DENIED',
    code: 'PROJECTES_MANAGE_REQUIRED',
  });
});

test('project lifecycle API aplica deny de sections.projectes abans de llegir el projecte', async () => {
  const store = new Map<string, Record<string, unknown>>();
  store.set('organizations/org-1/projectModule/_/projects/project-1', { name: 'Projecte 1', status: 'active' });

  const response = await handleProjectLifecyclePost(
    makeRequest({ action: 'close', orgId: 'org-1', projectId: 'project-1' }),
    makeDeps(store, {
      valid: true,
      role: 'admin',
      userOverrides: { deny: ['sections.projectes'] },
      userGrants: null,
    })
  );

  assert.equal(response.status, 403);
  assert.equal(store.get('organizations/org-1/projectModule/_/projects/project-1')?.status, 'active');
});

test('project lifecycle API aplica entitlement abans de llegir o mutar el projecte', async () => {
  let projectReads = 0;
  const db = {
    doc() {
      projectReads += 1;
      throw new Error('PROJECT_READ_MUST_NOT_RUN');
    },
  };
  const response = await handleProjectLifecyclePost(
    makeRequest({ action: 'close', orgId: 'org-1', projectId: 'project-1' }),
    {
      verifyIdTokenFn: async () => ({ uid: 'uid-1', email: 'user@test.com' }),
      getAdminDbFn: () => db as any,
      validateUserMembershipFn: async () => ({
        valid: true,
        role: 'admin',
        userOverrides: null,
        userGrants: null,
      }),
      resolveEntitlementFn: async () => ({
        allowed: false,
        diagnostics: ['plan'],
        enforcementMode: 'active' as const,
      }),
    }
  );
  assert.equal(response.status, 403);
  assert.equal(projectReads, 0);
});

test('project lifecycle API blocks delete when a transaction references the project', async () => {
  const store = new Map<string, Record<string, unknown>>();
  store.set('organizations/org-1/projectModule/_/projects/project-1', { name: 'Projecte 1', status: 'active' });
  store.set('organizations/org-1/transactions/tx-1', { projectId: 'project-1' });

  const response = await handleProjectLifecyclePost(
    makeRequest({ action: 'delete', orgId: 'org-1', projectId: 'project-1' }),
    makeDeps(store)
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    code: 'PROJECT_HAS_LINKED_DATA',
    error: 'Aquest projecte té dades vinculades i no es pot eliminar.',
    usage: {
      assignmentCount: 0,
      budgetLineCount: 0,
      fxTransferCount: 0,
      transactionCount: 1,
    },
    policy: {
      canDelete: false,
      blockers: ['transactions'],
    },
  });
  assert.equal(store.has('organizations/org-1/projectModule/_/projects/project-1'), true);
});

test('project lifecycle API deletes only an empty project', async () => {
  const store = new Map<string, Record<string, unknown>>();
  store.set('organizations/org-1/projectModule/_/projects/project-1', { name: 'Projecte 1', status: 'active' });

  const response = await handleProjectLifecyclePost(
    makeRequest({ action: 'delete', orgId: 'org-1', projectId: 'project-1' }),
    makeDeps(store)
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    usage: {
      assignmentCount: 0,
      budgetLineCount: 0,
      fxTransferCount: 0,
      transactionCount: 0,
    },
    policy: {
      canDelete: true,
      blockers: [],
    },
  });
  assert.equal(store.has('organizations/org-1/projectModule/_/projects/project-1'), false);
});
