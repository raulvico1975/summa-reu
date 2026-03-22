import assert from 'node:assert/strict'
import test from 'node:test'
import { handleBlogCoverUpload } from '@/app/api/blog/upload-cover/handler'

test('handleBlogCoverUpload rejects unauthorized requests', async () => {
  const response = await handleBlogCoverUpload(
    {
      headers: new Headers(),
      json: async () => ({}),
    } as never,
    {
      getUploadSecretFn: () => 'top-secret',
      saveLocalFileFn: async () => {
        throw new Error('should not save')
      },
      saveFirebaseFileFn: async () => {
        throw new Error('should not save')
      },
    }
  )

  assert.equal(response.status, 401)
})

test('handleBlogCoverUpload validates the payload', async () => {
  const response = await handleBlogCoverUpload(
    {
      headers: new Headers({
        Authorization: 'Bearer top-secret',
      }),
      json: async () => ({
        slug: 'Post Incorrecte',
        imageBase64: '',
      }),
    } as never,
    {
      getUploadSecretFn: () => 'top-secret',
      saveLocalFileFn: async () => {
        throw new Error('should not save')
      },
      saveFirebaseFileFn: async () => {
        throw new Error('should not save')
      },
    }
  )

  assert.equal(response.status, 400)
  const body = (await response.json()) as { success: boolean; details?: string[] }
  assert.equal(body.success, false)
  assert.ok(body.details?.includes('slug must be URL-safe'))
})

test('handleBlogCoverUpload saves the image and returns a cover URL', async () => {
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6kQAAAAASUVORK5CYII='
  let savedSlug = ''
  let savedMimeType = ''
  let savedBufferSize = 0

  const response = await handleBlogCoverUpload(
    {
      headers: new Headers({
        Authorization: 'Bearer top-secret',
      }),
      json: async () => ({
        slug: 'post-coberta',
        imageBase64: pngBase64,
        mimeType: 'image/png',
      }),
    } as never,
    {
      getUploadSecretFn: () => 'top-secret',
      saveLocalFileFn: async (params) => {
        savedSlug = params.slug
        savedMimeType = params.mimeType
        savedBufferSize = params.buffer.length
        return {
          coverImageUrl: 'http://localhost:9002/blog-covers/post-coberta-test.png',
          path: 'blog-covers/post-coberta-test.png',
          storage: 'local',
        }
      },
      saveFirebaseFileFn: async () => {
        throw new Error('firebase should not be used in this test')
      },
    }
  )

  assert.equal(response.status, 200)
  assert.equal(savedSlug, 'post-coberta')
  assert.equal(savedMimeType, 'image/png')
  assert.ok(savedBufferSize > 0)

  const body = (await response.json()) as {
    success: boolean
    coverImageUrl?: string
    path?: string
    storage?: string
  }

  assert.equal(body.success, true)
  assert.equal(body.coverImageUrl, 'http://localhost:9002/blog-covers/post-coberta-test.png')
  assert.equal(body.path, 'blog-covers/post-coberta-test.png')
  assert.equal(body.storage, 'local')
})
