import type { Firestore } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/api/admin-sdk'
import type { BlogPost, BlogPostTranslation } from '@/lib/blog/types'
import {
  resolveLocalizedBlogPost,
  resolveLocalizedBlogPosts,
  type LocalizedBlogPost,
} from '@/lib/blog/localized'
import { normalizeBlogContentHtml } from '@/lib/blog/normalizeContentHtml'
import type { PublicLocale } from '@/lib/public-locale'

const BLOG_SITE_URL = 'https://summasocial.app'
const LOCAL_BLOG_ORG_ID = 'local-blog'
const BLOG_ORG_DISCOVERY_LIMIT = 25

export type BlogPublishLocalizedUrls = {
  ca: string
  es: string
}

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

function mapBlogTranslation(value: unknown): BlogPostTranslation | null {
  if (!isRecord(value)) return null

  const title = normalizeString(value.title)
  const seoTitle = normalizeString(value.seoTitle)
  const metaDescription = normalizeString(value.metaDescription)
  const excerpt = normalizeString(value.excerpt)
  const contentHtml = normalizeString(value.contentHtml)

  if (!title || !seoTitle || !metaDescription || !excerpt || !contentHtml) {
    return null
  }

  const coverImageAlt =
    value.coverImageAlt === null || value.coverImageAlt === undefined
      ? value.coverImageAlt
      : normalizeString(value.coverImageAlt)

  const translation: BlogPostTranslation = {
    title,
    seoTitle,
    metaDescription,
    excerpt,
    contentHtml: normalizeBlogContentHtml(contentHtml, title),
  }

  if (coverImageAlt !== undefined) {
    translation.coverImageAlt = coverImageAlt ?? null
  }

  return translation
}

export function getBlogOrgId(): string {
  const orgId =
    process.env.BLOG_ORG_ID?.trim() ||
    (process.env.NODE_ENV !== 'production' ? LOCAL_BLOG_ORG_ID : '')
  if (!orgId) {
    throw new Error('Missing BLOG_ORG_ID')
  }
  return orgId
}

function logBlogOrgWarning(message: string) {
  console.warn(`[blog] ${message}`)
}

export function getBlogPostsCollectionPath(orgId: string = getBlogOrgId()): string {
  return `organizations/${orgId}/blogPosts`
}

export function buildBlogUrl(slug: string): string {
  const baseUrl =
    process.env.BLOG_PUBLISH_BASE_URL?.trim() ||
    process.env.BLOG_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    BLOG_SITE_URL

  return `${baseUrl.replace(/\/+$/, '')}/blog/${slug}`
}

export function buildLocalizedBlogUrl(
  slug: string,
  locale: keyof BlogPublishLocalizedUrls
): string {
  const baseUrl =
    process.env.BLOG_PUBLISH_BASE_URL?.trim() ||
    process.env.BLOG_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    BLOG_SITE_URL

  return `${baseUrl.replace(/\/+$/, '')}/${locale}/blog/${slug}`
}

export function buildLocalizedBlogUrls(slug: string): BlogPublishLocalizedUrls {
  return {
    ca: buildLocalizedBlogUrl(slug, 'ca'),
    es: buildLocalizedBlogUrl(slug, 'es'),
  }
}

export function formatBlogDate(
  iso: string,
  locale: PublicLocale = 'ca'
): string {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return iso

  const localeMap: Record<PublicLocale, string> = {
    ca: 'ca-ES',
    es: 'es-ES',
    fr: 'fr-FR',
    pt: 'pt-PT',
  }

  return date.toLocaleDateString(localeMap[locale], {
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
  const coverImageAlt =
    value.coverImageAlt === null || value.coverImageAlt === undefined
      ? value.coverImageAlt
      : normalizeString(value.coverImageAlt)
  const baseLocale = normalizeString(value.baseLocale)
  const translations = isRecord(value.translations)
    ? {
        es: mapBlogTranslation(value.translations.es) ?? undefined,
      }
    : undefined

  return {
    id: docId,
    baseLocale: baseLocale === 'es' ? 'es' : 'ca',
    title,
    slug,
    seoTitle,
    metaDescription,
    excerpt,
    contentHtml: normalizeBlogContentHtml(contentHtml, title),
    tags,
    category,
    coverImageUrl: coverImageUrl ?? null,
    coverImageAlt: coverImageAlt ?? null,
    translations: translations?.es ? { es: translations.es } : undefined,
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

async function listBlogOrgIdsWithPosts(db: Firestore): Promise<string[]> {
  const snap = await db.collectionGroup('blogPosts').limit(BLOG_ORG_DISCOVERY_LIMIT).get()
  const orgIds = new Set<string>()

  for (const doc of snap.docs) {
    const orgId = doc.ref.parent.parent?.id
    if (orgId) {
      orgIds.add(orgId)
    }
  }

  return Array.from(orgIds)
}

export async function resolveBlogOrgId(
  db: Firestore = getAdminDb(),
  requestedOrgId: string = getBlogOrgId()
): Promise<string> {
  const normalizedRequestedOrgId = requestedOrgId.trim()
  const orgIdsWithPosts = await listBlogOrgIdsWithPosts(db)

  if (orgIdsWithPosts.length === 0) {
    return normalizedRequestedOrgId
  }

  if (orgIdsWithPosts.length === 1) {
    const establishedOrgId = orgIdsWithPosts[0]

    if (normalizedRequestedOrgId && normalizedRequestedOrgId !== establishedOrgId) {
      logBlogOrgWarning(
        `BLOG_ORG_ID=${normalizedRequestedOrgId} no coincideix amb l'org establerta del blog (${establishedOrgId}). S'usa ${establishedOrgId}.`
      )
    }

    return establishedOrgId
  }

  if (normalizedRequestedOrgId && orgIdsWithPosts.includes(normalizedRequestedOrgId)) {
    return normalizedRequestedOrgId
  }

  logBlogOrgWarning(
    `Hi ha múltiples orgs amb blog (${orgIdsWithPosts.join(', ')}), però BLOG_ORG_ID=${normalizedRequestedOrgId || '(buit)'} no n'identifica cap.`
  )

  return normalizedRequestedOrgId || orgIdsWithPosts[0]
}

export async function assertBlogOrganizationExists(
  db: Firestore = getAdminDb(),
  orgId: string = getBlogOrgId()
): Promise<void> {
  const orgRef = db.doc(`organizations/${orgId}`)
  const orgSnap = await orgRef.get()
  if (orgSnap.exists) {
    return
  }

  if (process.env.NODE_ENV !== 'production' && orgId === LOCAL_BLOG_ORG_ID) {
    const now = new Date().toISOString()

    try {
      await orgRef.create({
        id: orgId,
        name: 'Local Blog',
        slug: orgId,
        status: 'active',
        createdAt: now,
        createdBy: 'local-blog-bootstrap',
      })
      return
    } catch {
      const retrySnap = await orgRef.get()
      if (retrySnap.exists) {
        return
      }
    }
  }

  throw new Error(`BLOG_ORG_ID does not match an existing organization: ${orgId}`)
}

export async function getBlogPostBySlug(
  slug: string,
  db: Firestore = getAdminDb(),
  orgId: string = getBlogOrgId()
): Promise<BlogPost | null> {
  const resolvedOrgId = await resolveBlogOrgId(db, orgId)
  const postSnap = await db.doc(`${getBlogPostsCollectionPath(resolvedOrgId)}/${slug}`).get()
  if (!postSnap.exists) {
    try {
      const fallbackSnap = await db.collectionGroup('blogPosts').where('slug', '==', slug).limit(2).get()
      const fallbackPosts = fallbackSnap.docs
        .map((doc) => mapBlogPost(doc.id, doc.data()))
        .filter((post): post is BlogPost => post !== null)

      return fallbackPosts.length === 1 ? fallbackPosts[0] : null
    } catch (error) {
      console.warn('[blog] fallback slug lookup unavailable:', error)
      return null
    }
  }

  return mapBlogPost(postSnap.id, postSnap.data())
}

export async function listBlogPosts(
  db: Firestore = getAdminDb(),
  orgId: string = getBlogOrgId()
): Promise<BlogPost[]> {
  const resolvedOrgId = await resolveBlogOrgId(db, orgId)
  const collectionRef = db.collection(getBlogPostsCollectionPath(resolvedOrgId))
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

export async function getLocalizedBlogPostBySlug(
  slug: string,
  locale: PublicLocale = 'ca',
  db: Firestore = getAdminDb(),
  orgId: string = getBlogOrgId()
): Promise<LocalizedBlogPost | null> {
  const post = await getBlogPostBySlug(slug, db, orgId)
  return post ? resolveLocalizedBlogPost(post, locale) : null
}

export async function listLocalizedBlogPosts(
  locale: PublicLocale = 'ca',
  db: Firestore = getAdminDb(),
  orgId: string = getBlogOrgId()
): Promise<LocalizedBlogPost[]> {
  const posts = await listBlogPosts(db, orgId)
  return resolveLocalizedBlogPosts(posts, locale)
}
