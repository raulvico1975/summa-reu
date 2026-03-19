import type { Firestore } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/api/admin-sdk'
import type { BlogPost } from '@/lib/blog/types'

const BLOG_SITE_URL = 'https://summasocial.app'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null

  const normalized = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)

  return normalized
}

export function getBlogOrgId(): string {
  const orgId = process.env.BLOG_ORG_ID?.trim()
  if (!orgId) {
    throw new Error('Missing BLOG_ORG_ID')
  }
  return orgId
}

export function getBlogPostsCollectionPath(orgId: string = getBlogOrgId()): string {
  return `organizations/${orgId}/blogPosts`
}

export function buildBlogUrl(slug: string): string {
  return `${BLOG_SITE_URL}/blog/${slug}`
}

export function formatBlogDate(iso: string): string {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return iso

  return date.toLocaleDateString('ca-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function mapBlogPost(docId: string, value: unknown): BlogPost | null {
  if (!isRecord(value)) return null

  const title = normalizeString(value.title)
  const slug = normalizeString(value.slug)
  const seoTitle = normalizeString(value.seoTitle)
  const metaDescription = normalizeString(value.metaDescription)
  const excerpt = normalizeString(value.excerpt)
  const contentHtml = normalizeString(value.contentHtml)
  const category = normalizeString(value.category)
  const publishedAt = normalizeString(value.publishedAt)
  const createdAt = normalizeString(value.createdAt)
  const updatedAt = normalizeString(value.updatedAt)
  const tags = normalizeStringArray(value.tags)

  if (
    !title ||
    !slug ||
    !seoTitle ||
    !metaDescription ||
    !excerpt ||
    !contentHtml ||
    !category ||
    !publishedAt ||
    !createdAt ||
    !updatedAt ||
    tags === null
  ) {
    return null
  }

  const coverImageUrl =
    value.coverImageUrl === null || value.coverImageUrl === undefined
      ? value.coverImageUrl
      : normalizeString(value.coverImageUrl)

  return {
    id: docId,
    title,
    slug,
    seoTitle,
    metaDescription,
    excerpt,
    contentHtml,
    tags,
    category,
    coverImageUrl: coverImageUrl ?? null,
    publishedAt,
    createdAt,
    updatedAt,
  }
}

function comparePublishedAtDesc(a: BlogPost, b: BlogPost): number {
  const aTime = Date.parse(a.publishedAt)
  const bTime = Date.parse(b.publishedAt)

  const safeATime = Number.isFinite(aTime) ? aTime : Number.NEGATIVE_INFINITY
  const safeBTime = Number.isFinite(bTime) ? bTime : Number.NEGATIVE_INFINITY

  return safeBTime - safeATime
}

export async function assertBlogOrganizationExists(
  db: Firestore = getAdminDb(),
  orgId: string = getBlogOrgId()
): Promise<void> {
  const orgSnap = await db.doc(`organizations/${orgId}`).get()
  if (!orgSnap.exists) {
    throw new Error(`BLOG_ORG_ID does not match an existing organization: ${orgId}`)
  }
}

export async function getBlogPostBySlug(
  slug: string,
  db: Firestore = getAdminDb(),
  orgId: string = getBlogOrgId()
): Promise<BlogPost | null> {
  const postSnap = await db.doc(`${getBlogPostsCollectionPath(orgId)}/${slug}`).get()
  if (!postSnap.exists) return null

  return mapBlogPost(postSnap.id, postSnap.data())
}

export async function listBlogPosts(
  db: Firestore = getAdminDb(),
  orgId: string = getBlogOrgId()
): Promise<BlogPost[]> {
  const collectionRef = db.collection(getBlogPostsCollectionPath(orgId))
  const orderedSnap = await collectionRef
    .orderBy('publishedAt', 'desc')
    .get()

  const orderedPosts = orderedSnap.docs
    .map((doc) => mapBlogPost(doc.id, doc.data()))
    .filter((post): post is BlogPost => post !== null)

  const allPostsSnap = await collectionRef.get()
  const orderedIds = new Set(orderedSnap.docs.map((doc) => doc.id))
  const fallbackPosts = allPostsSnap.docs
    .filter((doc) => !orderedIds.has(doc.id))
    .map((doc) => mapBlogPost(doc.id, doc.data()))
    .filter((post): post is BlogPost => post !== null)
    .sort(comparePublishedAtDesc)

  return [...orderedPosts, ...fallbackPosts]
}
