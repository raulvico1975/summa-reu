import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { handleBlogUnpublish } from '@/app/api/blog/unpublish/handler'
import {
  createLocalBlogPost,
  ensureLocalBlogOrganization,
  getLocalBlogPost,
} from '@/lib/blog/publish-local-store'
import type { BlogPost } from '@/lib/blog/types'

type DocData = Record<string, unknown>

class FakeDocSnap {
  constructor(public readonly exists: boolean, private readonly payload: DocData | undefined) {}

  data() {
    return this.payload
  }
}

class FakeDocRef {
  constructor(private readonly store: Map<string, DocData>, private readonly path: string) {}

  async get() {
    const data = this.store.get(this.path)
    return new FakeDocSnap(data !== undefined, data)
  }

  async delete() {
    this.store.delete(this.path)
  }
}

class FakeDb {
  constructor(private readonly store: Map<string, DocData>) {}

  doc(pathname: string) {
    return new FakeDocRef(this.store, pathname)
  }

  collectionGroup(collectionId: string) {
    assert.equal(collectionId, 'blogPosts')

    const docs = Array.from(this.store.keys())
      .filter((docPath) => docPath.startsWith('organizations/') && docPath.includes('/blogPosts/'))
      .map((docPath) => {
        const [, orgId] = docPath.split('/')
        return {
          ref: {
            parent: {
              parent: { id: orgId },
            },
          },
        }
      })

    return {
      limit: () => ({
        get: async () => ({ docs }),
      }),
    }
  }
}

function createRequest(body: unknown, token = 'top-secret') {
  return {
    headers: new Headers({
      Authorization: `Bearer ${token}`,
    }),
    json: async () => body,
  } as never
}

function buildLocalBlogPost(slug: string): BlogPost {
  const now = '2026-04-13T17:00:00.000Z'

  return {
    id: slug,
    baseLocale: 'ca',
    title: 'Post temporal de prova',
    slug,
    seoTitle: 'Post temporal de prova | Summa Social',
    metaDescription: 'Meta description de prova',
    excerpt: 'Excerpt de prova',
    contentHtml: '<p>Contingut de prova</p>',
    tags: ['prova'],
    category: 'criteri-operatiu',
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  }
}

async function withEnv<T>(
  overrides: Record<string, string | undefined>,
  run: () => Promise<T>
): Promise<T> {
  const previous = new Map<string, string | undefined>()

  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key])
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  try {
    return await run()
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

test('handleBlogUnpublish rejects unauthorized requests', async () => {
  const response = await withEnv(
    {
      BLOG_PUBLISH_STORAGE_MODE: 'firestore',
    },
    async () =>
      handleBlogUnpublish(createRequest({ slug: 'post-temporal' }, 'wrong-token'), {
        getAdminDbFn: () => new FakeDb(new Map()) as never,
        getPublishSecretFn: () => 'top-secret',
        getBlogOrgIdFn: () => 'summa-blog',
        getPublicLocalesFn: () => ['ca'],
        revalidatePathsFn: async () => {},
      })
  )

  assert.equal(response.status, 401)
})

test('handleBlogUnpublish validates payload', async () => {
  const response = await withEnv(
    {
      BLOG_PUBLISH_STORAGE_MODE: 'firestore',
    },
    async () =>
      handleBlogUnpublish(createRequest({}), {
        getAdminDbFn: () => new FakeDb(new Map()) as never,
        getPublishSecretFn: () => 'top-secret',
        getBlogOrgIdFn: () => 'summa-blog',
        getPublicLocalesFn: () => ['ca'],
        revalidatePathsFn: async () => {},
      })
  )

  assert.equal(response.status, 400)
})

test('handleBlogUnpublish deletes local blog post and revalidates paths', async (t) => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'summa-blog-unpublish-'))
  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  const storeFile = path.join(tempDir, 'blog-store.json')
  const orgId = 'local-blog-org'
  const slug = 'post-temporal-de-prova'
  const revalidatedPaths: string[] = []

  const response = await withEnv(
    {
      BLOG_PUBLISH_STORAGE_MODE: 'local-file',
      BLOG_PUBLISH_LOCAL_STORE_FILE: storeFile,
      NODE_ENV: 'test',
    },
    async () => {
      await ensureLocalBlogOrganization(orgId)
      await createLocalBlogPost(orgId, buildLocalBlogPost(slug))

      return handleBlogUnpublish(createRequest({ slug }), {
        getAdminDbFn: () => new FakeDb(new Map()) as never,
        getPublishSecretFn: () => 'top-secret',
        getBlogOrgIdFn: () => orgId,
        getPublicLocalesFn: () => ['ca', 'es'],
        revalidatePathsFn: async (paths) => {
          revalidatedPaths.push(...paths)
        },
      })
    }
  )

  assert.equal(response.status, 200)
  const body = (await response.json()) as {
    success: boolean
    slug?: string
    orgId?: string
    alreadyMissing?: boolean
  }
  assert.equal(body.success, true)
  assert.equal(body.slug, slug)
  assert.equal(body.orgId, orgId)
  assert.equal(body.alreadyMissing, false)

  const deleted = await withEnv(
    {
      BLOG_PUBLISH_STORAGE_MODE: 'local-file',
      BLOG_PUBLISH_LOCAL_STORE_FILE: storeFile,
      NODE_ENV: 'test',
    },
    async () => getLocalBlogPost(orgId, slug)
  )

  assert.equal(deleted, null)
  assert.deepEqual(revalidatedPaths, [
    '/blog',
    `/blog/${slug}`,
    '/ca/blog',
    `/ca/blog/${slug}`,
    '/es/blog',
    `/es/blog/${slug}`,
  ])
})

test('handleBlogUnpublish deletes Firestore-backed blog post and resolves established org', async () => {
  const slug = 'post-public-temporal'
  const store = new Map<string, DocData>()
  store.set(`organizations/real-blog-org/blogPosts/${slug}`, {
    slug,
    title: 'Post public temporal',
  })
  const revalidatedPaths: string[] = []

  const response = await withEnv(
    {
      BLOG_PUBLISH_STORAGE_MODE: 'firestore',
    },
    async () =>
      handleBlogUnpublish(createRequest({ slug }), {
        getAdminDbFn: () => new FakeDb(store) as never,
        getPublishSecretFn: () => 'top-secret',
        getBlogOrgIdFn: () => 'wrong-org-configured',
        getPublicLocalesFn: () => ['ca', 'es'],
        revalidatePathsFn: async (paths) => {
          revalidatedPaths.push(...paths)
        },
      })
  )

  assert.equal(response.status, 200)
  const body = (await response.json()) as {
    success: boolean
    orgId?: string
    alreadyMissing?: boolean
  }
  assert.equal(body.success, true)
  assert.equal(body.orgId, 'real-blog-org')
  assert.equal(body.alreadyMissing, false)
  assert.equal(store.has(`organizations/real-blog-org/blogPosts/${slug}`), false)
  assert.deepEqual(revalidatedPaths, [
    '/blog',
    `/blog/${slug}`,
    '/ca/blog',
    `/ca/blog/${slug}`,
    '/es/blog',
    `/es/blog/${slug}`,
  ])
})

test('handleBlogUnpublish is idempotent when blog post is already missing', async () => {
  const response = await withEnv(
    {
      BLOG_PUBLISH_STORAGE_MODE: 'firestore',
    },
    async () =>
      handleBlogUnpublish(createRequest({ slug: 'no-existeix' }), {
        getAdminDbFn: () => new FakeDb(new Map()) as never,
        getPublishSecretFn: () => 'top-secret',
        getBlogOrgIdFn: () => 'real-blog-org',
        getPublicLocalesFn: () => ['ca'],
        revalidatePathsFn: async () => {},
      })
  )

  assert.equal(response.status, 200)
  const body = (await response.json()) as {
    success: boolean
    alreadyMissing?: boolean
  }
  assert.equal(body.success, true)
  assert.equal(body.alreadyMissing, true)
})
