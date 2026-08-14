import assert from 'node:assert/strict';
import test from 'node:test';
import { handleOpenOrgDocument } from '@/app/api/org-documents/open/handler';

const MEMBER_PATH = 'organizations/org-a/members/user-1';
const OFFBANK_STORAGE_PATH = 'organizations/org-a/offBankExpenses/off-1/receipt.pdf';
const TRANSACTION_STORAGE_PATH = 'organizations/org-a/documents/tx-1/invoice.pdf';

class FakeDb {
  constructor(private readonly docs: Record<string, Record<string, unknown>>) {}

  doc(path: string) {
    const docs = this.docs;
    return {
      async get() {
        const data = docs[path];
        return {
          exists: Boolean(data),
          data: () => data,
        };
      },
    };
  }
}

class FakeBucket {
  readonly signedUrlCalls: Array<{ path: string; expires: number }> = [];
  readonly fileCalls: string[] = [];

  constructor(private readonly existingPath = OFFBANK_STORAGE_PATH) {}

  file(path: string) {
    this.fileCalls.push(path);
    return {
      exists: async () => {
        return [path === this.existingPath] as [boolean];
      },
      getSignedUrl: async (options: { action: 'read'; expires: number }) => {
        this.signedUrlCalls.push({ path, expires: options.expires });
        return [`https://signed.local/${encodeURIComponent(path)}`] as [string];
      },
    };
  }
}

function requestFor(params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return {
    headers: new Headers({ Authorization: 'Bearer token' }),
    nextUrl: new URL(`http://localhost/api/org-documents/open?${search.toString()}`),
  } as never;
}

test('open org document regenerates a fresh URL for off-bank attachments', async () => {
  const db = new FakeDb({ [MEMBER_PATH]: { role: 'viewer', userGrants: ['projectes.expenseInput'] } });
  const bucket = new FakeBucket();

  const response = await handleOpenOrgDocument(requestFor({
    orgId: 'org-a',
    storagePath: OFFBANK_STORAGE_PATH,
  }), {
    db: db as never,
    storageBucket: bucket,
    nowMs: () => 1_000,
    verifyIdTokenFn: async () => ({ uid: 'user-1', email: 'user@example.org' }),
  });

  assert.equal(response.status, 200);
  const body = await response.json() as { success: boolean; url: string; durable: boolean };
  assert.equal(body.success, true);
  assert.equal(body.durable, true);
  assert.equal(body.url, `https://signed.local/${encodeURIComponent(OFFBANK_STORAGE_PATH)}`);
  assert.deepEqual(bucket.signedUrlCalls, [{ path: OFFBANK_STORAGE_PATH, expires: 901_000 }]);
});

test('open org document aplica deny de projectes abans de tocar Storage', async () => {
  const db = new FakeDb({
    [MEMBER_PATH]: { role: 'admin', userOverrides: { deny: ['sections.projectes'] } },
  });
  const bucket = new FakeBucket();
  const response = await handleOpenOrgDocument(requestFor({
    orgId: 'org-a', storagePath: OFFBANK_STORAGE_PATH,
  }), {
    db: db as never,
    storageBucket: bucket,
    verifyIdTokenFn: async () => ({ uid: 'user-1' }),
  });
  assert.equal(response.status, 403);
  assert.equal(bucket.fileCalls.length, 0);
});

test('pending prebank i SEPA exigeixen lectura efectiva de moviments', async () => {
  for (const area of ['pendingDocuments', 'prebankRemittances', 'sepaCollectionRuns']) {
    const path = `organizations/org-a/${area}/item-1/file.pdf`;
    const deniedBucket = new FakeBucket(path);
    const denied = await handleOpenOrgDocument(requestFor({ orgId: 'org-a', storagePath: path }), {
      db: new FakeDb({ [MEMBER_PATH]: { role: 'viewer', userOverrides: { deny: ['moviments.read'] } } }) as never,
      storageBucket: deniedBucket,
      verifyIdTokenFn: async () => ({ uid: 'user-1' }),
    });
    assert.equal(denied.status, 403);
    assert.equal(deniedBucket.fileCalls.length, 0);

    const allowed = await handleOpenOrgDocument(requestFor({ orgId: 'org-a', storagePath: path }), {
      db: new FakeDb({ [MEMBER_PATH]: { role: 'viewer' } }) as never,
      storageBucket: new FakeBucket(path),
      verifyIdTokenFn: async () => ({ uid: 'user-1' }),
    });
    assert.equal(allowed.status, 200);
  }
});

test('open org document exigeix moviments.read per documents de transacció', async () => {
  const db = new FakeDb({
    [MEMBER_PATH]: { role: 'viewer', userOverrides: { deny: ['moviments.read'] } },
  });
  const response = await handleOpenOrgDocument(requestFor({
    orgId: 'org-a',
    storagePath: TRANSACTION_STORAGE_PATH,
  }), {
    db: db as never,
    storageBucket: new FakeBucket(TRANSACTION_STORAGE_PATH),
    verifyIdTokenFn: async () => ({ uid: 'user-1', email: 'user@example.org' }),
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json() as { code: string }).code, 'MOVIMENTS_ROUTE_REQUIRED');
});

test('open org document manté lectura històrica per membre amb moviments.read', async () => {
  const db = new FakeDb({ [MEMBER_PATH]: { role: 'viewer' } });
  const response = await handleOpenOrgDocument(requestFor({
    orgId: 'org-a',
    storagePath: TRANSACTION_STORAGE_PATH,
  }), {
    db: db as never,
    storageBucket: new FakeBucket(TRANSACTION_STORAGE_PATH),
    verifyIdTokenFn: async () => ({ uid: 'user-1', email: 'user@example.org' }),
  });
  assert.equal(response.status, 200);
});

test('open org document rejects non-document organization paths', async () => {
  const db = new FakeDb({ [MEMBER_PATH]: { role: 'admin' } });
  const response = await handleOpenOrgDocument(requestFor({
    orgId: 'org-a',
    storagePath: 'organizations/org-a/logo',
  }), {
    db: db as never,
    storageBucket: new FakeBucket(),
    verifyIdTokenFn: async () => ({ uid: 'user-1', email: 'user@example.org' }),
  });

  assert.equal(response.status, 400);
  const body = await response.json() as { code: string };
  assert.equal(body.code, 'INVALID_STORAGE_PATH');
});
