import test from 'node:test';
import assert from 'node:assert/strict';
import { handleProductUpdatesUnpublish } from '@/app/api/product-updates/unpublish/handler';

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
    private readonly path: string
  ) {}

  async get() {
    const data = this.store.get(this.path);
    return new FakeDocSnap(data !== undefined, data);
  }

  async set(payload: DocData, options: { merge: boolean }) {
    if (!options.merge) {
      this.store.set(this.path, { ...payload });
      return;
    }

    const previous = this.store.get(this.path) ?? {};
    this.store.set(this.path, { ...previous, ...payload });
  }
}

class FakeDb {
  constructor(private readonly store: Map<string, DocData>) {}

  doc(path: string) {
    return new FakeDocRef(this.store, path);
  }
}

function createRequest(body: unknown, token = 'top-secret') {
  return {
    headers: new Headers({
      Authorization: `Bearer ${token}`,
    }),
    json: async () => body,
  } as never;
}

test('handleProductUpdatesUnpublish rejects unauthorized requests', async () => {
  const response = await handleProductUpdatesUnpublish(
    createRequest({ externalId: 'novetat-1' }, 'wrong-token'),
    {
      getAdminDbFn: () => new FakeDb(new Map()) as never,
      nowTimestampFn: () => 'now',
      getPublishSecretFn: () => 'top-secret',
      getPublicLocalesFn: () => ['ca'],
      revalidatePathsFn: async () => {},
    }
  );

  assert.equal(response.status, 401);
});

test('handleProductUpdatesUnpublish returns 404 when doc does not exist', async () => {
  const response = await handleProductUpdatesUnpublish(
    createRequest({ externalId: 'missing' }),
    {
      getAdminDbFn: () => new FakeDb(new Map()) as never,
      nowTimestampFn: () => 'now',
      getPublishSecretFn: () => 'top-secret',
      getPublicLocalesFn: () => ['ca'],
      revalidatePathsFn: async () => {},
    }
  );

  assert.equal(response.status, 404);
});

test('handleProductUpdatesUnpublish deactivates product update and revalidates list/detail', async () => {
  const store = new Map<string, DocData>();
  store.set('productUpdates/novetat-1', {
    id: 'novetat-1',
    isActive: true,
    web: {
      enabled: true,
      slug: 'millora-detall-cobraments',
    },
  });
  const revalidatedPaths: string[] = [];

  const response = await handleProductUpdatesUnpublish(
    createRequest({ externalId: 'novetat-1' }),
    {
      getAdminDbFn: () => new FakeDb(store) as never,
      nowTimestampFn: () => ({ toDate: () => new Date('2026-03-26T12:00:00.000Z') }),
      getPublishSecretFn: () => 'top-secret',
      getPublicLocalesFn: () => ['ca', 'es'],
      revalidatePathsFn: async (paths) => {
        revalidatedPaths.push(...paths);
      },
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json() as { success: boolean; alreadyInactive?: boolean };
  assert.equal(body.success, true);
  assert.equal(body.alreadyInactive, false);
  assert.equal(store.get('productUpdates/novetat-1')?.isActive, false);
  assert.deepEqual(revalidatedPaths, [
    '/ca/novetats',
    '/ca/novetats/millora-detall-cobraments',
    '/es/novetats',
    '/es/novetats/millora-detall-cobraments',
  ]);
});

test('handleProductUpdatesUnpublish is idempotent when already inactive', async () => {
  const store = new Map<string, DocData>();
  store.set('productUpdates/novetat-1', {
    id: 'novetat-1',
    isActive: false,
    web: {
      enabled: true,
      slug: 'millora-detall-cobraments',
    },
  });

  const response = await handleProductUpdatesUnpublish(
    createRequest({ externalId: 'novetat-1' }),
    {
      getAdminDbFn: () => new FakeDb(store) as never,
      nowTimestampFn: () => 'now',
      getPublishSecretFn: () => 'top-secret',
      getPublicLocalesFn: () => ['ca'],
      revalidatePathsFn: async () => {},
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json() as { success: boolean; alreadyInactive?: boolean };
  assert.equal(body.success, true);
  assert.equal(body.alreadyInactive, true);
});
