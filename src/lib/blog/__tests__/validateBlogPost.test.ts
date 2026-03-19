import test from 'node:test'
import assert from 'node:assert/strict'
import { handleBlogPublish } from '@/app/api/blog/publish/handler'
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
    publishedAt: '2026-03-19T10:00:00.000Z',
  }
}

test('validateBlogPost accepts a valid payload', () => {
  const result = validateBlogPost(buildValidPayload())

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.value.slug, 'primer-post')
    assert.deepEqual(result.value.tags, ['summa', 'blog'])
    assert.equal(result.value.publishedAt, '2026-03-19T10:00:00.000Z')
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

  const response = await handleBlogPublish(
    {
      headers: new Headers({
        Authorization: 'Bearer top-secret',
      }),
      json: async () => buildValidPayload(),
    } as never,
    {
      getAdminDbFn: () =>
        ({
          doc(path: string) {
            return {
              async get() {
                const data = store.get(path)
                return {
                  id: path.split('/').pop() || '',
                  exists: data !== undefined,
                  data: () => data,
                }
              },
              async create(payload: Record<string, unknown>) {
                if (store.has(path)) {
                  throw new Error('already-exists')
                }
                store.set(path, payload)
              },
            }
          },
        }) as never,
      nowIsoFn: () => '2026-03-19T12:00:00.000Z',
      getPublishSecretFn: () => 'top-secret',
      getBlogOrgIdFn: () => 'blog-org',
      assertBlogOrganizationExistsFn: async () => {},
    }
  )

  assert.equal(response.status, 409)
  const body = await response.json() as { success: boolean; error?: string }
  assert.equal(body.success, false)
  assert.equal(body.error, 'duplicate_slug')
})
