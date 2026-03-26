import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLatestPublicProductUpdate,
  getPublicProductUpdateBySlug,
  listPublicProductUpdates,
} from '@/lib/product-updates/public';

type DocData = Record<string, unknown>;

class FakeProductUpdatesDb {
  constructor(private readonly store: Map<string, DocData>) {}

  collection(path: string) {
    assert.equal(path, 'productUpdates');

    return {
      get: async () => ({
        docs: Array.from(this.store.entries())
          .filter(([docPath]) => docPath.startsWith('productUpdates/'))
          .map(([docPath, data]) => ({
            id: docPath.slice('productUpdates/'.length),
            data: () => data,
          })),
      }),
    };
  }
}

function buildTimestamp(iso: string) {
  return {
    toDate: () => new Date(iso),
  };
}

test('listPublicProductUpdates returns only active web updates sorted by publishedAt desc', async () => {
  const store = new Map<string, DocData>();
  store.set('productUpdates/update-1', {
    title: 'Millora A',
    description: 'Descripcio A',
    isActive: true,
    publishedAt: buildTimestamp('2026-03-20T10:00:00.000Z'),
    web: {
      enabled: true,
      slug: 'millora-a',
      excerpt: 'Resum A',
      content: 'Contingut A',
    },
  });
  store.set('productUpdates/update-2', {
    title: 'Millora B',
    description: 'Descripcio B',
    isActive: true,
    publishedAt: buildTimestamp('2026-03-25T10:00:00.000Z'),
    web: {
      enabled: true,
      slug: 'millora-b',
    },
    contentLong: 'Contingut llarg B',
  });
  store.set('productUpdates/update-3', {
    title: 'No web',
    description: 'No surt',
    isActive: true,
    web: {
      enabled: false,
      slug: 'no-web',
    },
  });
  store.set('productUpdates/update-4', {
    title: 'Inactiva',
    description: 'No surt',
    isActive: false,
    web: {
      enabled: true,
      slug: 'inactiva',
    },
  });

  const updates = await listPublicProductUpdates({
    getAdminDbFn: () => new FakeProductUpdatesDb(store) as never,
  });

  assert.deepEqual(
    updates.map((update) => update.slug),
    ['millora-b', 'millora-a']
  );
  assert.equal(updates[0]?.excerpt, 'Descripcio B');
  assert.equal(updates[0]?.content, 'Contingut llarg B');
  assert.equal(updates[0]?.publishedAt, '2026-03-25');
});

test('getPublicProductUpdateBySlug returns null for invalid or missing slug', async () => {
  const store = new Map<string, DocData>();
  store.set('productUpdates/update-1', {
    title: 'Millora A',
    description: 'Descripcio A',
    isActive: true,
    publishedAt: buildTimestamp('2026-03-20T10:00:00.000Z'),
    web: {
      enabled: true,
      slug: 'millora-a',
      excerpt: 'Resum A',
      content: 'Contingut A',
    },
  });

  const found = await getPublicProductUpdateBySlug('millora-a', {
    getAdminDbFn: () => new FakeProductUpdatesDb(store) as never,
  });
  const missing = await getPublicProductUpdateBySlug('missing', {
    getAdminDbFn: () => new FakeProductUpdatesDb(store) as never,
  });
  const invalid = await getPublicProductUpdateBySlug('slug invalid', {
    getAdminDbFn: () => new FakeProductUpdatesDb(store) as never,
  });

  assert.equal(found?.title, 'Millora A');
  assert.equal(missing, null);
  assert.equal(invalid, null);
});

test('getLatestPublicProductUpdate returns the newest published web update', async () => {
  const store = new Map<string, DocData>();
  store.set('productUpdates/update-1', {
    title: 'Millora antiga',
    isActive: true,
    publishedAt: buildTimestamp('2026-03-20T10:00:00.000Z'),
    web: {
      enabled: true,
      slug: 'millora-antiga',
    },
  });
  store.set('productUpdates/update-2', {
    title: 'Millora nova',
    isActive: true,
    publishedAt: buildTimestamp('2026-03-25T10:00:00.000Z'),
    web: {
      enabled: true,
      slug: 'millora-nova',
      excerpt: 'Resum nou',
    },
  });

  const latest = await getLatestPublicProductUpdate({
    getAdminDbFn: () => new FakeProductUpdatesDb(store) as never,
  });

  assert.equal(latest?.slug, 'millora-nova');
  assert.equal(latest?.excerpt, 'Resum nou');
});
