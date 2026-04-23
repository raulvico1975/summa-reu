import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { handleRelinkDocumentPost } from '@/app/api/pending-documents/relink-document/handler';
import { requireOperationalAccess } from '@/lib/api/require-operational-access';

type FakeDocData = Record<string, unknown> | null;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/pending-documents/relink-document', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer fake-token',
    },
    body: JSON.stringify(body),
  });
}

class FakeDocSnapshot {
  constructor(private readonly dataValue: FakeDocData) {}

  get exists() {
    return this.dataValue !== null;
  }

  data() {
    return this.dataValue;
  }
}

function setNestedValue(target: Record<string, unknown>, path: string, value: unknown) {
  const segments = path.split('.');
  let current = target;

  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    const nested = current[segment];
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }

  current[segments[segments.length - 1]] = value;
}

class FakeDb {
  constructor(private readonly docs: Record<string, FakeDocData>) {}

  doc(path: string) {
    return {
      get: async () => new FakeDocSnapshot(this.docs[path] ?? null),
      update: async (payload: Record<string, unknown>) => {
        const current = this.docs[path];
        if (!current) {
          throw new Error(`missing-doc:${path}`);
        }

        const next = { ...current };
        for (const [key, value] of Object.entries(payload)) {
          if (key.includes('.')) {
            setNestedValue(next, key, value);
          } else {
            next[key] = value;
          }
        }

        this.docs[path] = next;
      },
    };
  }
}

class FakeFile {
  constructor(
    private readonly files: Map<string, string>,
    readonly path: string
  ) {}

  async exists() {
    return [this.files.has(this.path)] as const;
  }

  async copy(destination: FakeFile) {
    if (!this.files.has(this.path)) {
      throw new Error(`missing-file:${this.path}`);
    }

    this.files.set(destination.path, this.files.get(this.path) ?? '');
  }

  async getSignedUrl() {
    return [`https://example.test/${encodeURIComponent(this.path)}`] as const;
  }
}

class FakeBucket {
  readonly name = 'fake-bucket';
  private readonly files: Map<string, string>;

  constructor(files: Record<string, string>) {
    this.files = new Map(Object.entries(files));
  }

  file(path: string) {
    return new FakeFile(this.files, path);
  }
}

function makeDeps(args: {
  docs: Record<string, FakeDocData>;
  files?: Record<string, string>;
}) {
  return {
    verifyIdTokenFn: async () => ({
      uid: 'user-1',
      email: 'user@test.com',
    }),
    getAdminDbFn: () => new FakeDb(args.docs) as any,
    getAdminStorageFn: () => new FakeBucket(args.files ?? {}) as any,
    validateUserMembershipFn: async () => ({
      valid: true,
      role: 'admin',
      userOverrides: null,
      userGrants: null,
    }) as any,
    requireOperationalAccessFn: requireOperationalAccess,
  };
}

test('POST /api/pending-documents/relink-document retorna 403 per role viewer', async () => {
  const response = await handleRelinkDocumentPost(
    makeRequest({
      orgId: 'org-1',
      pendingId: 'pending-1',
    }),
    {
      ...makeDeps({ docs: {} }),
      validateUserMembershipFn: async () => ({
        valid: true,
        role: 'viewer',
        userOverrides: null,
        userGrants: null,
      }) as any,
    }
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    success: false,
    error: 'READ_ONLY_ROLE',
    code: 'READ_ONLY_ROLE',
  });
});

test('POST /api/pending-documents/relink-document deixa continuar a role user', async () => {
  const docs: Record<string, FakeDocData> = {
    'organizations/org-1/pendingDocuments/pending-1': {
      matchedTransactionId: 'tx-1',
      file: {
        filename: 'ticket.pdf',
        storagePath: 'organizations/org-1/pendingDocuments/pending-1/ticket.pdf',
      },
    },
    'organizations/org-1/transactions/tx-1': {
      document: null,
    },
  };

  const response = await handleRelinkDocumentPost(
    makeRequest({
      orgId: 'org-1',
      pendingId: 'pending-1',
    }),
    {
      ...makeDeps({
        docs,
        files: {
          'organizations/org-1/pendingDocuments/pending-1/ticket.pdf': 'ticket-data',
        },
      }),
      validateUserMembershipFn: async () => ({
        valid: true,
        role: 'user',
        userOverrides: null,
        userGrants: null,
      }) as any,
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
  });
});

test('POST /api/pending-documents/relink-document bloqueja si el pending apunta a un fitxer d una altra organitzacio', async () => {
  const response = await handleRelinkDocumentPost(
    makeRequest({
      orgId: 'org-1',
      pendingId: 'pending-1',
    }),
    makeDeps({
      docs: {
        'organizations/org-1/members/user-1': {
          role: 'admin',
        },
        'organizations/org-1/pendingDocuments/pending-1': {
          matchedTransactionId: 'tx-1',
          file: {
            filename: 'ticket.pdf',
            storagePath: 'organizations/org-2/pendingDocuments/pending-x/secret.pdf',
          },
        },
        'organizations/org-1/transactions/tx-1': {
          document: null,
        },
      },
      files: {
        'organizations/org-2/pendingDocuments/pending-x/secret.pdf': 'secret',
      },
    })
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    success: false,
    error: 'El document pendent referencia un fitxer fora de la seva organització.',
    code: 'PENDING_DOCUMENT_FILE_FORBIDDEN',
  });
});
