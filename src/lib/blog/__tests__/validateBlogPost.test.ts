import test from 'node:test'
import assert from 'node:assert/strict'
import { handleBlogPublish } from '@/app/api/blog/publish/handler'
import { resolveBlogOrgId } from '@/lib/blog/firestore'
import { validateBlogPost } from '@/lib/blog/validateBlogPost'

function buildValidPayload() {
  return {
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
    publishedAt: '2026-03-19T10:00:00.000Z',
  }
}

function buildLocalizedPayload() {
  return {
    ...buildValidPayload(),
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

async function withEnv<T>(
  updates: Partial<Record<'BLOG_PUBLISH_STORAGE_MODE' | 'NODE_ENV', string | undefined>>,
  run: () => Promise<T>
): Promise<T> {
  const previousValues = {
    BLOG_PUBLISH_STORAGE_MODE: process.env.BLOG_PUBLISH_STORAGE_MODE,
    NODE_ENV: process.env.NODE_ENV,
  }

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  try {
    return await run()
  } finally {
    for (const [key, value] of Object.entries(previousValues)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
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
        async create(payload: Record<string, unknown>) {
          if (store.has(path)) {
            throw new Error('already-exists')
          }
          store.set(path, payload)
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

test('validateBlogPost accepts a valid payload', () => {
  const result = validateBlogPost(buildValidPayload())

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.value.slug, 'primer-post')
    assert.deepEqual(result.value.tags, ['summa', 'blog'])
    assert.equal(result.value.coverImageAlt, 'Portada del primer post')
    assert.equal(result.value.publishedAt, '2026-03-19T10:00:00.000Z')
  }
})

test('validateBlogPost accepts an es translation payload', () => {
  const result = validateBlogPost(buildLocalizedPayload())

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.value.baseLocale, 'ca')
    assert.equal(result.value.translations?.es?.title, 'Primer post en castellano')
    assert.equal(result.value.translations?.es?.contentHtml, '<p>Contenido HTML en castellano</p>')
  }
})

test('validateBlogPost normalizes duplicated lead headings and markdown emphasis markers', () => {
  const result = validateBlogPost({
    ...buildLocalizedPayload(),
    title: 'Gestió de quotes',
    contentHtml: '<h1>Gestió de quotes</h1><p>Text amb **negreta** i *cursiva*.</p>',
    translations: {
      es: {
        ...buildLocalizedPayload().translations.es,
        title: 'Gestión de cuotas',
        contentHtml: '<h1>Gestión de cuotas</h1><p>Texto con **negrita** y *cursiva*.</p>',
      },
    },
  })

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(
      result.value.contentHtml,
      '<p>Text amb <strong>negreta</strong> i <em>cursiva</em>.</p>'
    )
    assert.equal(
      result.value.translations?.es?.contentHtml,
      '<p>Texto con <strong>negrita</strong> y <em>cursiva</em>.</p>'
    )
  }
})

test('validateBlogPost rejects unsupported translations locales', () => {
  const payload = {
    ...buildLocalizedPayload(),
    translations: {
      es: buildLocalizedPayload().translations.es,
      fr: {
        title: 'Titre',
      },
    },
  }

  const result = validateBlogPost(payload)

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.errors.includes('translations only supports: es'))
  }
})

test('validateBlogPost omits cover fields when they are not provided', () => {
  const payload = buildValidPayload()
  delete (payload as Partial<typeof payload>).coverImageUrl
  delete (payload as Partial<typeof payload>).coverImageAlt

  const result = validateBlogPost(payload)

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal('coverImageUrl' in result.value, false)
    assert.equal('coverImageAlt' in result.value, false)
  }
})

test('validateBlogPost rejects coverImageAlt without coverImageUrl', () => {
  const payload = buildValidPayload()
  delete (payload as Partial<typeof payload>).coverImageUrl

  const result = validateBlogPost(payload)

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.errors.includes('coverImageAlt requires coverImageUrl'))
  }
})

test('validateBlogPost rejects an invalid slug', () => {
  const result = validateBlogPost({
    ...buildValidPayload(),
    slug: 'Primer Post',
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.errors.includes('slug must be URL-safe'))
  }
})

test('validateBlogPost rejects a missing required field', () => {
  const invalidPayload = buildValidPayload()
  delete (invalidPayload as Partial<typeof invalidPayload>).title

  const result = validateBlogPost(invalidPayload)

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.errors.includes('title must be a string'))
  }
})

test('handleBlogPublish returns 409 when slug already exists', async () => {
  const store = new Map<string, Record<string, unknown>>()
  store.set('organizations/blog-org', { name: 'Blog org' })
  store.set('organizations/blog-org/blogPosts/primer-post', {
    id: 'primer-post',
    ...buildValidPayload(),
    createdAt: '2026-03-18T10:00:00.000Z',
    updatedAt: '2026-03-18T10:00:00.000Z',
  })

  const response = await withFirestorePublishMode(async () =>
    handleBlogPublish(
      {
        headers: new Headers({
          Authorization: 'Bearer top-secret',
        }),
        json: async () => buildValidPayload(),
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

  assert.equal(response.status, 409)
  const body = await response.json() as { success: boolean; error?: string }
  assert.equal(body.success, false)
  assert.equal(body.error, 'duplicate_slug')
})

test('handleBlogPublish persists cover fields when provided', async () => {
  const store = new Map<string, Record<string, unknown>>()
  store.set('organizations/blog-org', { name: 'Blog org' })
  const createdPayloads: Record<string, unknown>[] = []

  const response = await withFirestorePublishMode(async () =>
    handleBlogPublish(
      {
        headers: new Headers({
          Authorization: 'Bearer top-secret',
        }),
        json: async () => buildValidPayload(),
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
                async create(payload: Record<string, unknown>) {
                  createdPayloads.push(payload)
                  await ref.create(payload)
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
  const body = await response.json() as {
    success: boolean
    url?: string
    localizedUrls?: { ca: string; es: string }
    legacyUrl?: string
  }
  assert.equal(body.success, true)
  assert.equal(body.url, 'https://summasocial.app/ca/blog/primer-post')
  assert.deepEqual(body.localizedUrls, {
    ca: 'https://summasocial.app/ca/blog/primer-post',
    es: 'https://summasocial.app/es/blog/primer-post',
  })
  assert.equal(body.legacyUrl, 'https://summasocial.app/blog/primer-post')
  assert.equal(createdPayloads.length, 1)
  assert.equal(createdPayloads[0].coverImageUrl, 'https://example.com/cover.jpg')
  assert.equal(createdPayloads[0].coverImageAlt, 'Portada del primer post')
})

test('handleBlogPublish persists es translation when provided', async () => {
  const store = new Map<string, Record<string, unknown>>()
  store.set('organizations/blog-org', { name: 'Blog org' })
  const createdPayloads: Record<string, unknown>[] = []

  const response = await withFirestorePublishMode(async () =>
    handleBlogPublish(
      {
        headers: new Headers({
          Authorization: 'Bearer top-secret',
        }),
        json: async () => buildLocalizedPayload(),
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
                async create(payload: Record<string, unknown>) {
                  createdPayloads.push(payload)
                  await ref.create(payload)
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
  assert.equal(createdPayloads.length, 1)
  assert.equal(createdPayloads[0].baseLocale, 'ca')
  assert.deepEqual(createdPayloads[0].translations, {
    es: {
      title: 'Primer post en castellano',
      seoTitle: 'Primer post en castellano | Summa Social',
      metaDescription: 'Meta description del primer post en castellano',
      excerpt: 'Resumen corto del primer post',
      contentHtml: '<p>Contenido HTML en castellano</p>',
      coverImageAlt: 'Portada del primer post en castellano',
    },
  })
})

test('handleBlogPublish does not persist empty cover fields when omitted', async () => {
  const store = new Map<string, Record<string, unknown>>()
  store.set('organizations/blog-org', { name: 'Blog org' })
  const createdPayloads: Record<string, unknown>[] = []
  const payload = buildValidPayload()
  delete (payload as Partial<typeof payload>).coverImageUrl
  delete (payload as Partial<typeof payload>).coverImageAlt

  const response = await withFirestorePublishMode(async () =>
    handleBlogPublish(
      {
        headers: new Headers({
          Authorization: 'Bearer top-secret',
        }),
        json: async () => payload,
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
                async create(payload: Record<string, unknown>) {
                  createdPayloads.push(payload)
                  await ref.create(payload)
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
  assert.equal(createdPayloads.length, 1)
  assert.equal('coverImageUrl' in createdPayloads[0], false)
  assert.equal('coverImageAlt' in createdPayloads[0], false)
})

test('resolveBlogOrgId falls back to the established blog org when BLOG_ORG_ID drifts', async () => {
  const store = new Map<string, Record<string, unknown>>()
  store.set('organizations/real-blog-org', { name: 'Real Blog org' })
  store.set('organizations/real-blog-org/blogPosts/post-real', {
    id: 'post-real',
    ...buildValidPayload(),
    slug: 'post-real',
    createdAt: '2026-03-18T10:00:00.000Z',
    updatedAt: '2026-03-18T10:00:00.000Z',
  })

  const resolved = await resolveBlogOrgId(buildFirestoreMock(store) as never, 'wrong-blog-org')

  assert.equal(resolved, 'real-blog-org')
})

test('handleBlogPublish writes to the established blog org and revalidates public paths', async () => {
  const store = new Map<string, Record<string, unknown>>()
  store.set('organizations/real-blog-org', { name: 'Real Blog org' })
  store.set('organizations/real-blog-org/blogPosts/post-real', {
    id: 'post-real',
    ...buildValidPayload(),
    slug: 'post-real',
    createdAt: '2026-03-18T10:00:00.000Z',
    updatedAt: '2026-03-18T10:00:00.000Z',
  })

  const revalidatedPaths: string[][] = []
  const response = await withFirestorePublishMode(async () =>
    handleBlogPublish(
      {
        headers: new Headers({
          Authorization: 'Bearer top-secret',
        }),
        json: async () => buildValidPayload(),
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
  assert.ok(store.has('organizations/real-blog-org/blogPosts/primer-post'))

  const body = await response.json() as {
    success: boolean
    orgId?: string
    url?: string
    localizedUrls?: { ca: string; es: string }
    legacyUrl?: string
  }
  assert.equal(body.success, true)
  assert.equal(body.orgId, 'real-blog-org')
  assert.equal(body.url, 'https://summasocial.app/ca/blog/primer-post')
  assert.deepEqual(body.localizedUrls, {
    ca: 'https://summasocial.app/ca/blog/primer-post',
    es: 'https://summasocial.app/es/blog/primer-post',
  })
  assert.equal(body.legacyUrl, 'https://summasocial.app/blog/primer-post')
})

test('handleBlogPublish blocks local publish storage in production', async () => {
  const response = await withEnv(
    {
      BLOG_PUBLISH_STORAGE_MODE: 'local-file',
      NODE_ENV: 'production',
    },
    async () =>
      handleBlogPublish(
        {
          headers: new Headers({
            Authorization: 'Bearer top-secret',
          }),
          json: async () => buildValidPayload(),
        } as never,
        {
          getAdminDbFn: () => {
            throw new Error('db should not be used')
          },
          nowIsoFn: () => '2026-03-19T12:00:00.000Z',
          getPublishSecretFn: () => 'top-secret',
          getBlogOrgIdFn: () => 'blog-org',
          assertBlogOrganizationExistsFn: async () => {},
          revalidatePathsFn: async () => {},
        }
      )
  )

  assert.equal(response.status, 503)
  const body = await response.json() as { success: boolean; error?: string }
  assert.equal(body.success, false)
  assert.equal(body.error, 'misconfigured_storage')
})

test('handleBlogPublish fails when firestore write cannot be verified', async () => {
  const store = new Map<string, Record<string, unknown>>()
  store.set('organizations/blog-org', { name: 'Blog org' })
  const revalidatedPaths: string[][] = []

  const response = await withFirestorePublishMode(async () =>
    handleBlogPublish(
      {
        headers: new Headers({
          Authorization: 'Bearer top-secret',
        }),
        json: async () => buildValidPayload(),
      } as never,
      {
        getAdminDbFn: () => {
          const db = buildFirestoreMock(store)
          return {
            ...db,
            doc(path: string) {
              const ref = db.doc(path)
              let created = false

              return {
                ...ref,
                async create(payload: Record<string, unknown>) {
                  created = true
                  await ref.create(payload)
                },
                async get() {
                  if (created && path.endsWith('/blogPosts/primer-post')) {
                    return buildDocSnapshot(path, undefined)
                  }

                  return ref.get()
                },
              }
            },
          } as never
        },
        nowIsoFn: () => '2026-03-19T12:00:00.000Z',
        getPublishSecretFn: () => 'top-secret',
        getBlogOrgIdFn: () => 'blog-org',
        assertBlogOrganizationExistsFn: async () => {},
        revalidatePathsFn: async (paths) => {
          revalidatedPaths.push(paths)
        },
      }
    )
  )

  assert.equal(response.status, 503)
  assert.deepEqual(revalidatedPaths, [])
  const body = await response.json() as { success: boolean; error?: string }
  assert.equal(body.success, false)
  assert.equal(body.error, 'write_verification_failed')
})
