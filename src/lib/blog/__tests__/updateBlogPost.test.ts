import test from 'node:test'
import assert from 'node:assert/strict'
import { handleBlogUpdate } from '@/app/api/blog/update/handler'
import { validateBlogPostUpdate } from '@/lib/blog/validateBlogPostUpdate'

function buildValidStoredPost() {
  return {
    id: 'primer-post',
    title: 'Primer post',
    slug: 'primer-post',
    seoTitle: 'Primer post | Summa Social',
    metaDescription: 'Meta description del primer post',
    excerpt: 'Resum curt del primer post',
    contentHtml: '<p>Contingut HTML</p>',
    tags: ['summa', 'blog'],
    category: 'Producte',
    coverImageUrl: 'https://example.com/cover.jpg',
    coverImageAlt: 'Portada del primer post',
    baseLocale: 'ca' as const,
    translations: {
      es: {
        title: 'Primer post en castellano',
        seoTitle: 'Primer post en castellano | Summa Social',
        metaDescription: 'Meta description del primer post en castellano',
        excerpt: 'Resumen corto del primer post',
        contentHtml: '<p>Contenido HTML en castellano</p>',
        coverImageAlt: 'Portada del primer post en castellano',
      },
    },
    publishedAt: '2026-03-19T10:00:00.000Z',
    createdAt: '2026-03-18T10:00:00.000Z',
    updatedAt: '2026-03-18T10:00:00.000Z',
  }
}

async function withFirestorePublishMode<T>(run: () => Promise<T>): Promise<T> {
  const previousMode = process.env.BLOG_PUBLISH_STORAGE_MODE
  process.env.BLOG_PUBLISH_STORAGE_MODE = 'firestore'

  try {
    return await run()
  } finally {
    if (previousMode === undefined) {
      delete process.env.BLOG_PUBLISH_STORAGE_MODE
    } else {
      process.env.BLOG_PUBLISH_STORAGE_MODE = previousMode
    }
  }
}

function getBlogPostDocEntries(store: Map<string, Record<string, unknown>>, orgId?: string) {
  return Array.from(store.entries())
    .filter(([path]) => path.startsWith('organizations/') && path.includes('/blogPosts/'))
    .filter(([path]) => (orgId ? path.startsWith(`organizations/${orgId}/blogPosts/`) : true))
}

function buildDocSnapshot(path: string, data: Record<string, unknown> | undefined) {
  const parts = path.split('/')
  const orgId = parts[1] || ''

  return {
    id: parts[parts.length - 1] || '',
    exists: data !== undefined,
    data: () => data,
    ref: {
      parent: {
        parent: {
          id: orgId,
        },
      },
    },
  }
}

function buildCollectionQuery(docs: Array<{ path: string; data: Record<string, unknown> }>) {
  return {
    limit(count: number) {
      return buildCollectionQuery(docs.slice(0, count))
    },
    where(field: string, op: string, value: unknown) {
      assert.equal(op, '==')
      return buildCollectionQuery(
        docs.filter((doc) => (doc.data as Record<string, unknown>)[field] === value)
      )
    },
    orderBy(field: string, direction: 'asc' | 'desc') {
      const sorted = [...docs].sort((a, b) => {
        const aValue = typeof a.data[field] === 'string' ? Date.parse(String(a.data[field])) : 0
        const bValue = typeof b.data[field] === 'string' ? Date.parse(String(b.data[field])) : 0
        return direction === 'desc' ? bValue - aValue : aValue - bValue
      })

      return buildCollectionQuery(sorted)
    },
    async get() {
      return {
        empty: docs.length === 0,
        docs: docs.map((doc) => buildDocSnapshot(doc.path, doc.data)),
      }
    },
  }
}

function buildFirestoreMock(store: Map<string, Record<string, unknown>>) {
  return {
    doc(path: string) {
      return {
        async get() {
          return buildDocSnapshot(path, store.get(path))
        },
        async update(payload: Record<string, unknown>) {
          const existing = store.get(path)
          if (!existing) {
            throw new Error('not-found')
          }

          const next = { ...existing }
          for (const [key, value] of Object.entries(payload)) {
            if (key.includes('.')) {
              const segments = key.split('.')
              let cursor: Record<string, unknown> = next
              for (let index = 0; index < segments.length - 1; index += 1) {
                const segment = segments[index]
                const nested = cursor[segment]
                if (typeof nested !== 'object' || nested === null || Array.isArray(nested)) {
                  cursor[segment] = {}
                }
                cursor = cursor[segment] as Record<string, unknown>
              }
              cursor[segments[segments.length - 1]] = value
            } else {
              next[key] = value
            }
          }

          store.set(path, next)
        },
      }
    },
    collection(path: string) {
      const parts = path.split('/')
      const orgId = parts[1]
      const docs = getBlogPostDocEntries(store, orgId).map(([docPath, data]) => ({ path: docPath, data }))
      return buildCollectionQuery(docs)
    },
    collectionGroup(name: string) {
      assert.equal(name, 'blogPosts')
      const docs = getBlogPostDocEntries(store).map(([path, data]) => ({ path, data }))
      return buildCollectionQuery(docs)
    },
  }
}

test('validateBlogPostUpdate requires at least one editable field', () => {
  const result = validateBlogPostUpdate({
    slug: 'primer-post',
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.deepEqual(result.errors, ['at least one field to update is required'])
  }
})

test('handleBlogUpdate rejects unauthorized requests', async () => {
  const response = await withFirestorePublishMode(async () =>
    handleBlogUpdate(
      {
        headers: new Headers(),
        json: async () => ({
          slug: 'primer-post',
          title: 'Nou títol',
        }),
      } as never,
      {
        getAdminDbFn: () => buildFirestoreMock(new Map()) as never,
        nowIsoFn: () => '2026-03-19T12:00:00.000Z',
        getPublishSecretFn: () => 'top-secret',
        getBlogOrgIdFn: () => 'blog-org',
        assertBlogOrganizationExistsFn: async () => {},
        revalidatePathsFn: async () => {},
      }
    )
  )

  assert.equal(response.status, 401)
  const body = await response.json() as { success: boolean; error?: string }
  assert.equal(body.success, false)
  assert.equal(body.error, 'unauthorized')
})

test('handleBlogUpdate returns 404 when slug does not exist', async () => {
  const store = new Map<string, Record<string, unknown>>()
  store.set('organizations/blog-org', { name: 'Blog org' })

  const response = await withFirestorePublishMode(async () =>
    handleBlogUpdate(
      {
        headers: new Headers({
          Authorization: 'Bearer top-secret',
        }),
        json: async () => ({
          slug: 'missing-post',
          title: 'Nou títol',
        }),
      } as never,
      {
        getAdminDbFn: () => buildFirestoreMock(store) as never,
        nowIsoFn: () => '2026-03-19T12:00:00.000Z',
        getPublishSecretFn: () => 'top-secret',
        getBlogOrgIdFn: () => 'blog-org',
        assertBlogOrganizationExistsFn: async () => {},
        revalidatePathsFn: async () => {},
      }
    )
  )

  assert.equal(response.status, 404)
  const body = await response.json() as { success: boolean; error?: string }
  assert.equal(body.success, false)
  assert.equal(body.error, 'not_found')
})

test('handleBlogUpdate updates partial fields, clears cover alt when cover is removed and revalidates public paths', async () => {
  const store = new Map<string, Record<string, unknown>>()
  store.set('organizations/real-blog-org', { name: 'Blog org' })
  store.set(
    'organizations/real-blog-org/blogPosts/primer-post',
    buildValidStoredPost() as unknown as Record<string, unknown>
  )
  const revalidatedPaths: string[][] = []

  const response = await withFirestorePublishMode(async () =>
    handleBlogUpdate(
      {
        headers: new Headers({
          Authorization: 'Bearer top-secret',
        }),
        json: async () => ({
          slug: 'primer-post',
          title: 'Primer post actualitzat',
          coverImageUrl: null,
          translations: {
            es: {
              excerpt: 'Resumen actualizado',
            },
          },
        }),
      } as never,
      {
        getAdminDbFn: () => buildFirestoreMock(store) as never,
        nowIsoFn: () => '2026-03-19T12:00:00.000Z',
        getPublishSecretFn: () => 'top-secret',
        getBlogOrgIdFn: () => 'wrong-blog-org',
        assertBlogOrganizationExistsFn: async () => {},
        revalidatePathsFn: async (paths) => {
          revalidatedPaths.push(paths)
        },
      }
    )
  )

  assert.equal(response.status, 200)
  const body = await response.json() as {
    success: boolean
    slug?: string
    orgId?: string
    url?: string
    localizedUrls?: { ca: string; es: string }
    legacyUrl?: string
  }
  assert.equal(body.success, true)
  assert.equal(body.slug, 'primer-post')
  assert.equal(body.orgId, 'real-blog-org')
  assert.equal(body.url, 'https://summasocial.app/ca/blog/primer-post')
  assert.deepEqual(body.localizedUrls, {
    ca: 'https://summasocial.app/ca/blog/primer-post',
    es: 'https://summasocial.app/es/blog/primer-post',
  })
  assert.equal(body.legacyUrl, 'https://summasocial.app/blog/primer-post')
  assert.deepEqual(revalidatedPaths, [[
    '/blog',
    '/blog/primer-post',
    '/ca/blog',
    '/ca/blog/primer-post',
    '/es/blog',
    '/es/blog/primer-post',
    '/fr/blog',
    '/fr/blog/primer-post',
    '/pt/blog',
    '/pt/blog/primer-post',
  ]])

  const updated = store.get('organizations/real-blog-org/blogPosts/primer-post')
  assert.equal(updated?.title, 'Primer post actualitzat')
  assert.equal(updated?.coverImageUrl, null)
  assert.equal(updated?.coverImageAlt, null)
  assert.equal(
    (updated?.translations as { es?: { excerpt?: string; coverImageAlt?: string | null } })?.es?.excerpt,
    'Resumen actualizado'
  )
  assert.equal(
    (updated?.translations as { es?: { coverImageAlt?: string | null } })?.es?.coverImageAlt,
    null
  )
  assert.equal(updated?.updatedAt, '2026-03-19T12:00:00.000Z')
})

test('handleBlogUpdate writes only defined fields and never persists undefined', async () => {
  const store = new Map<string, Record<string, unknown>>()
  store.set('organizations/blog-org', { name: 'Blog org' })
  store.set(
    'organizations/blog-org/blogPosts/primer-post',
    buildValidStoredPost() as unknown as Record<string, unknown>
  )

  const updatePayloads: Record<string, unknown>[] = []

  const response = await withFirestorePublishMode(async () =>
    handleBlogUpdate(
      {
        headers: new Headers({
          Authorization: 'Bearer top-secret',
        }),
        json: async () => ({
          slug: 'primer-post',
          tags: ['summa', 'actualitzat'],
          translations: {
            es: {
              excerpt: 'Resumen actualizado',
            },
          },
        }),
      } as never,
      {
        getAdminDbFn: () => {
          const db = buildFirestoreMock(store)
          return {
            ...db,
            doc(path: string) {
              const ref = db.doc(path)
              return {
                ...ref,
                async update(payload: Record<string, unknown>) {
                  updatePayloads.push(payload)
                  await ref.update(payload)
                },
              }
            },
          } as never
        },
        nowIsoFn: () => '2026-03-19T12:00:00.000Z',
        getPublishSecretFn: () => 'top-secret',
        getBlogOrgIdFn: () => 'blog-org',
        assertBlogOrganizationExistsFn: async () => {},
        revalidatePathsFn: async () => {},
      }
    )
  )

  assert.equal(response.status, 200)
  assert.equal(updatePayloads.length, 1)
  assert.equal(Object.values(updatePayloads[0]).includes(undefined), false)
  assert.deepEqual(updatePayloads[0], {
    tags: ['summa', 'actualitzat'],
    'translations.es.excerpt': 'Resumen actualizado',
    updatedAt: '2026-03-19T12:00:00.000Z',
  })
})

test('handleBlogUpdate persists normalized contentHtml for legacy posts when any update touches the post', async () => {
  const legacyPost = buildValidStoredPost()
  legacyPost.title = 'Gestió de quotes'
  legacyPost.contentHtml = '<h1>Gestió de quotes</h1><p>Text amb **negreta** i *cursiva*.</p>'
  legacyPost.translations.es.title = 'Gestión de cuotas'
  legacyPost.translations.es.contentHtml =
    '<h1>Gestión de cuotas</h1><p>Texto con **negrita** y *cursiva*.</p>'

  const store = new Map<string, Record<string, unknown>>()
  store.set('organizations/blog-org', { name: 'Blog org' })
  store.set(
    'organizations/blog-org/blogPosts/primer-post',
    legacyPost as unknown as Record<string, unknown>
  )

  const response = await withFirestorePublishMode(async () =>
    handleBlogUpdate(
      {
        headers: new Headers({
          Authorization: 'Bearer top-secret',
        }),
        json: async () => ({
          slug: 'primer-post',
          excerpt: 'Resum actualitzat',
        }),
      } as never,
      {
        getAdminDbFn: () => buildFirestoreMock(store) as never,
        nowIsoFn: () => '2026-03-19T12:00:00.000Z',
        getPublishSecretFn: () => 'top-secret',
        getBlogOrgIdFn: () => 'blog-org',
        assertBlogOrganizationExistsFn: async () => {},
        revalidatePathsFn: async () => {},
      }
    )
  )

  assert.equal(response.status, 200)

  const updated = store.get('organizations/blog-org/blogPosts/primer-post')
  assert.equal(updated?.excerpt, 'Resum actualitzat')
  assert.equal(
    updated?.contentHtml,
    '<p>Text amb <strong>negreta</strong> i <em>cursiva</em>.</p>'
  )
  assert.equal(
    (updated?.translations as { es?: { contentHtml?: string } })?.es?.contentHtml,
    '<p>Texto con <strong>negrita</strong> y <em>cursiva</em>.</p>'
  )
})
