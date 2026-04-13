import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { BlogPost } from '@/lib/blog/types'

type LocalStoreOrganization = {
  id: string
  createdAt: string
}

type LocalBlogPublishStore = {
  organizations: Record<string, LocalStoreOrganization>
  posts: Record<string, Record<string, BlogPost>>
}

const DEFAULT_STORE: LocalBlogPublishStore = {
  organizations: {},
  posts: {},
}

export type BlogPublishStorageMode = 'firestore' | 'local-file'

function getStoreFilePath(): string {
  const customPath = process.env.BLOG_PUBLISH_LOCAL_STORE_FILE?.trim()
  if (customPath) return customPath

  return path.join(process.cwd(), 'tmp', 'blog-publish-local-store.json')
}

function sanitizeBlogPost(post: BlogPost): BlogPost {
  return Object.fromEntries(
    Object.entries(post).filter(([, value]) => value !== undefined)
  ) as BlogPost
}

async function readStore(): Promise<LocalBlogPublishStore> {
  try {
    const raw = await readFile(getStoreFilePath(), 'utf8')
    if (!raw.trim()) {
      return { ...DEFAULT_STORE }
    }
    const parsed = JSON.parse(raw) as Partial<LocalBlogPublishStore>

    return {
      organizations: parsed.organizations ?? {},
      posts: parsed.posts ?? {},
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ...DEFAULT_STORE }
    }

    throw error
  }
}

async function writeStore(store: LocalBlogPublishStore): Promise<void> {
  const filePath = getStoreFilePath()
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(store, null, 2))
}

export function isLocalBlogPublishStorageEnabled(): boolean {
  return getBlogPublishStorageMode() === 'local-file'
}

export function getBlogPublishStorageMode(): BlogPublishStorageMode {
  const mode = process.env.BLOG_PUBLISH_STORAGE_MODE?.trim().toLowerCase()
  if (mode === 'firestore') return 'firestore'
  if (mode === 'local' || mode === 'local-file') return 'local-file'
  return process.env.NODE_ENV === 'production' ? 'firestore' : 'local-file'
}

export function assertNoLocalBlogPublishStorageInProduction(): void {
  if (process.env.NODE_ENV !== 'production') {
    return
  }

  if (getBlogPublishStorageMode() === 'local-file') {
    throw new Error('BLOG_LOCAL_STORAGE_FORBIDDEN_IN_PRODUCTION')
  }
}

export function getLocalBlogPublishStoreFilePath(): string {
  return getStoreFilePath()
}

export async function ensureLocalBlogOrganization(orgId: string): Promise<void> {
  const store = await readStore()
  if (store.organizations[orgId]) return

  store.organizations[orgId] = {
    id: orgId,
    createdAt: new Date().toISOString(),
  }
  await writeStore(store)
}

export async function getLocalBlogPost(orgId: string, slug: string): Promise<BlogPost | null> {
  const store = await readStore()
  return store.posts[orgId]?.[slug] ?? null
}

export async function createLocalBlogPost(orgId: string, post: BlogPost): Promise<void> {
  const store = await readStore()
  const postsByOrg = store.posts[orgId] ?? {}

  if (postsByOrg[post.slug]) {
    throw new Error('duplicate_slug')
  }

  store.posts[orgId] = {
    ...postsByOrg,
    [post.slug]: sanitizeBlogPost(post),
  }

  await writeStore(store)
}

export async function updateLocalBlogPost(orgId: string, post: BlogPost): Promise<boolean> {
  const store = await readStore()
  const postsByOrg = store.posts[orgId] ?? {}

  if (!postsByOrg[post.slug]) {
    return false
  }

  store.posts[orgId] = {
    ...postsByOrg,
    [post.slug]: sanitizeBlogPost(post),
  }

  await writeStore(store)
  return true
}

export async function deleteLocalBlogPost(orgId: string, slug: string): Promise<boolean> {
  const store = await readStore()
  const postsByOrg = store.posts[orgId] ?? {}

  if (!postsByOrg[slug]) {
    return false
  }

  const { [slug]: _removed, ...rest } = postsByOrg
  store.posts[orgId] = rest

  await writeStore(store)
  return true
}

export async function readLocalBlogPublishStore(): Promise<LocalBlogPublishStore> {
  return readStore()
}
