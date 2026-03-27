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

test('listPublicProductUpdates only returns updates localized for the requested locale', async () => {
  const store = new Map<string, DocData>();
  store.set('productUpdates/update-ca-only', {
    title: 'Millora en la gestió',
    description: 'Text base en català',
    isActive: true,
    publishedAt: buildTimestamp('2026-03-24T10:00:00.000Z'),
    web: {
      enabled: true,
      locale: 'ca',
      slug: 'millora-gestio',
      title: 'Millora en la gestió',
      excerpt: 'Text base en català',
      content: 'Detall base en català',
    },
  });
  store.set('productUpdates/update-with-es', {
    title: 'Millora de projectes',
    description: 'Base en català',
    isActive: true,
    publishedAt: buildTimestamp('2026-03-25T10:00:00.000Z'),
    web: {
      enabled: true,
      locale: 'ca',
      slug: 'millora-projectes',
      title: 'Millora de projectes',
      excerpt: 'Base en català',
      content: 'Detall base en català',
      locales: {
        es: {
          title: 'Mejora de proyectos',
          excerpt: 'Versión pública en español',
          content: 'Detalle público en español',
        },
      },
    },
  });

  const updates = await listPublicProductUpdates({
    locale: 'es',
    getAdminDbFn: () => new FakeProductUpdatesDb(store) as never,
  });

  assert.deepEqual(updates.map((update) => update.slug), ['millora-projectes']);
  assert.equal(updates[0]?.title, 'Mejora de proyectos');
  assert.equal(updates[0]?.excerpt, 'Versión pública en español');
  assert.equal(updates[0]?.content, 'Detalle público en español');
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

test('getPublicProductUpdateBySlug reuses spanish copy for fr/pt locales', async () => {
  const store = new Map<string, DocData>();
  store.set('productUpdates/update-1', {
    title: 'Millora A',
    description: 'Descripció A',
    isActive: true,
    publishedAt: buildTimestamp('2026-03-20T10:00:00.000Z'),
    web: {
      enabled: true,
      locale: 'ca',
      slug: 'millora-a',
      title: 'Millora A',
      excerpt: 'Resum A',
      locales: {
        es: {
          title: 'Mejora A',
          excerpt: 'Resumen A',
          content: 'Contenido A',
        },
      },
    },
  });

  const foundEs = await getPublicProductUpdateBySlug('millora-a', {
    locale: 'es',
    getAdminDbFn: () => new FakeProductUpdatesDb(store) as never,
  });
  const foundFr = await getPublicProductUpdateBySlug('millora-a', {
    locale: 'fr',
    getAdminDbFn: () => new FakeProductUpdatesDb(store) as never,
  });

  assert.equal(foundEs?.title, 'Mejora A');
  assert.equal(foundEs?.excerpt, 'Resumen A');
  assert.equal(foundFr?.title, 'Mejora A');
  assert.equal(foundFr?.excerpt, 'Resumen A');
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

test('getLatestPublicProductUpdate skips non-localized items for the requested locale', async () => {
  const store = new Map<string, DocData>();
  store.set('productUpdates/update-1', {
    title: 'Novetat només en català',
    isActive: true,
    publishedAt: buildTimestamp('2026-03-26T10:00:00.000Z'),
    web: {
      enabled: true,
      locale: 'ca',
      slug: 'novetat-ca',
      title: 'Novetat només en català',
    },
  });
  store.set('productUpdates/update-2', {
    title: 'Novetat traduïda',
    isActive: true,
    publishedAt: buildTimestamp('2026-03-25T10:00:00.000Z'),
    web: {
      enabled: true,
      locale: 'ca',
      slug: 'novetat-es',
      title: 'Novetat traduïda',
      locales: {
        es: {
          title: 'Novedad traducida',
          excerpt: 'Resumen en español',
        },
      },
    },
  });

  const latest = await getLatestPublicProductUpdate({
    locale: 'es',
    getAdminDbFn: () => new FakeProductUpdatesDb(store) as never,
  });

  assert.equal(latest?.slug, 'novetat-es');
  assert.equal(latest?.title, 'Novedad traducida');
});
