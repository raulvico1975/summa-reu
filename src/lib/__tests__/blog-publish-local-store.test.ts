import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {
  ensureLocalBlogOrganization,
  getLocalBlogPost,
  getLocalBlogPublishStoreFilePath,
} from '@/lib/blog/publish-local-store'

test('ensureLocalBlogOrganization tolerates an empty local store file', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'blog-local-store-'))
  const storeFile = path.join(tempDir, 'store.json')
  await writeFile(storeFile, '')

  const previousFile = process.env.BLOG_PUBLISH_LOCAL_STORE_FILE
  const previousMode = process.env.BLOG_PUBLISH_STORAGE_MODE

  process.env.BLOG_PUBLISH_LOCAL_STORE_FILE = storeFile
  process.env.BLOG_PUBLISH_STORAGE_MODE = 'local-file'

  try {
    assert.equal(getLocalBlogPublishStoreFilePath(), storeFile)
    await ensureLocalBlogOrganization('local-blog')
    const post = await getLocalBlogPost('local-blog', 'missing-slug')
    assert.equal(post, null)
  } finally {
    if (previousFile === undefined) {
      delete process.env.BLOG_PUBLISH_LOCAL_STORE_FILE
    } else {
      process.env.BLOG_PUBLISH_LOCAL_STORE_FILE = previousFile
    }

    if (previousMode === undefined) {
      delete process.env.BLOG_PUBLISH_STORAGE_MODE
    } else {
      process.env.BLOG_PUBLISH_STORAGE_MODE = previousMode
    }
  }
})
