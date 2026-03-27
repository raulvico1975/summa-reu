import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { getAdminDb } from '@/lib/api/admin-sdk'
import {
  assertBlogOrganizationExists,
  buildBlogUrl,
  getBlogOrgId,
  getBlogPostsCollectionPath,
  resolveBlogOrgId,
} from '@/lib/blog/firestore'
import { PUBLIC_LOCALES } from '@/lib/public-locale'
import {
  assertNoLocalBlogPublishStorageInProduction,
  createLocalBlogPost,
  ensureLocalBlogOrganization,
  getLocalBlogPost,
  isLocalBlogPublishStorageEnabled,
} from '@/lib/blog/publish-local-store'
import type { BlogPost } from '@/lib/blog/types'
import { validateBlogPost } from '@/lib/blog/validateBlogPost'

type PublishBlogSuccessResponse = {
  success: true
  url: string
  orgId?: string
}

type PublishBlogErrorResponse = {
  success: false
  error: string
  details?: string[]
}

export type PublishBlogResponse = PublishBlogSuccessResponse | PublishBlogErrorResponse

type RequestLike = Pick<NextRequest, 'headers' | 'json'>

export interface PublishBlogDeps {
  getAdminDbFn: typeof getAdminDb
  nowIsoFn: () => string
  getPublishSecretFn: () => string | null
  getBlogOrgIdFn: () => string
  assertBlogOrganizationExistsFn: (db?: ReturnType<typeof getAdminDb>, orgId?: string) => Promise<void>
  revalidatePathsFn: (paths: string[]) => void | Promise<void>
}

function getPublishSecretFromEnv(): string | null {
  if (isLocalBlogPublishStorageEnabled()) {
    return process.env.BLOG_PUBLISH_LOCAL_SECRET?.trim() || 'local-blog-publish-secret'
  }

  return process.env.BLOG_PUBLISH_SECRET?.trim() || null
}

const DEFAULT_DEPS: PublishBlogDeps = {
  getAdminDbFn: getAdminDb,
  nowIsoFn: () => new Date().toISOString(),
  getPublishSecretFn: getPublishSecretFromEnv,
  getBlogOrgIdFn: getBlogOrgId,
  assertBlogOrganizationExistsFn: assertBlogOrganizationExists,
  revalidatePathsFn: (paths) => {
    for (const path of paths) {
      revalidatePath(path)
    }
  },
}

function safeCompare(a: string, b: string) {
  if (a.length !== b.length) return false

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

function extractBearerToken(request: RequestLike): string | null {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice('Bearer '.length).trim()
  return token || null
}

function isSafeSlug(slug: string): boolean {
  if (!slug) return false
  if (slug.includes('/') || slug.includes('..')) return false
  if (/\s/.test(slug)) return false
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

function hasValidAuthorization(request: RequestLike, secret: string | null): boolean {
  if (!secret) return false
  const token = extractBearerToken(request)
  if (!token) return false
  return safeCompare(token, secret)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function verifyPersistedBlogPost(
  postRef: { get: () => Promise<{ exists: boolean; data: () => unknown }> },
  expectedPost: Pick<BlogPost, 'slug' | 'title' | 'contentHtml' | 'publishedAt' | 'translations'>
): Promise<boolean> {
  const persistedSnap = await postRef.get()

  if (!persistedSnap.exists) {
    return false
  }

  const persistedData = persistedSnap.data()
  if (!isRecord(persistedData)) {
    return false
  }

  const persistedTranslations = isRecord(persistedData.translations)
    ? persistedData.translations
    : null
  const expectedEsTranslation = expectedPost.translations?.es
  const persistedEsTranslation = persistedTranslations && isRecord(persistedTranslations.es)
    ? persistedTranslations.es
    : null

  const translationsMatch =
    !expectedEsTranslation ||
    (persistedEsTranslation?.title === expectedEsTranslation.title &&
      persistedEsTranslation?.contentHtml === expectedEsTranslation.contentHtml &&
      persistedEsTranslation?.excerpt === expectedEsTranslation.excerpt)

  return (
    persistedData.slug === expectedPost.slug &&
    persistedData.title === expectedPost.title &&
    persistedData.contentHtml === expectedPost.contentHtml &&
    persistedData.publishedAt === expectedPost.publishedAt &&
    translationsMatch
  )
}

async function safeRevalidateBlogPaths(
  slug: string,
  deps: Pick<PublishBlogDeps, 'revalidatePathsFn'>
): Promise<void> {
  try {
    const localizedPaths = PUBLIC_LOCALES.flatMap((locale) => [
      `/${locale}/blog`,
      `/${locale}/blog/${slug}`,
    ])
    await deps.revalidatePathsFn(['/blog', `/blog/${slug}`, ...localizedPaths])
  } catch (error) {
    console.warn('[blog/publish] revalidate warning:', error)
  }
}

export async function handleBlogPublish(
  request: RequestLike,
  deps: PublishBlogDeps = DEFAULT_DEPS
): Promise<NextResponse<PublishBlogResponse>> {
  try {
    assertNoLocalBlogPublishStorageInProduction()
  } catch (error) {
    console.error('[blog/publish] misconfiguration:', error)
    return NextResponse.json({ success: false, error: 'misconfigured_storage' }, { status: 503 })
  }

  try {
    const publishSecret = deps.getPublishSecretFn()
    if (!publishSecret || !hasValidAuthorization(request, publishSecret)) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    }

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
    }

    const validation = validateBlogPost(rawBody)
    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: 'invalid_payload', details: validation.errors },
        { status: 400 }
      )
    }

    const requestedOrgId = deps.getBlogOrgIdFn()

    const slug = validation.value.slug
    if (!isSafeSlug(slug)) {
      return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
    }

    const now = deps.nowIsoFn()
    const blogPost: BlogPost = {
      id: slug,
      ...validation.value,
      baseLocale: validation.value.baseLocale ?? 'ca',
      publishedAt: validation.value.publishedAt,
      createdAt: now,
      updatedAt: now,
    }

    let effectiveOrgId = requestedOrgId

    if (isLocalBlogPublishStorageEnabled()) {
      const orgId = requestedOrgId
      await ensureLocalBlogOrganization(orgId)

      const existingPost = await getLocalBlogPost(orgId, slug)
      if (existingPost) {
        return NextResponse.json({ success: false, error: 'duplicate_slug' }, { status: 409 })
      }

      await createLocalBlogPost(orgId, blogPost)
    } else {
      const db = deps.getAdminDbFn()
      const orgId = await resolveBlogOrgId(db, requestedOrgId)
      effectiveOrgId = orgId
      await deps.assertBlogOrganizationExistsFn(db, orgId)

      const postRef = db.doc(`${getBlogPostsCollectionPath(orgId)}/${slug}`)
      const existingPost = await postRef.get()
      if (existingPost.exists) {
        return NextResponse.json({ success: false, error: 'duplicate_slug' }, { status: 409 })
      }

      try {
        await postRef.create(blogPost)
      } catch (error) {
        const duplicateCheck = await postRef.get()
        if (duplicateCheck.exists) {
          return NextResponse.json({ success: false, error: 'duplicate_slug' }, { status: 409 })
        }

        throw error
      }

      const persisted = await verifyPersistedBlogPost(postRef, blogPost)
      if (!persisted) {
        console.error(
          `[blog/publish] write verification failed for slug=${slug} orgId=${orgId}`
        )
        return NextResponse.json(
          { success: false, error: 'write_verification_failed' },
          { status: 503 }
        )
      }
    }

    await safeRevalidateBlogPaths(slug, deps)

    return NextResponse.json({
      success: true,
      url: buildBlogUrl(slug),
      orgId: effectiveOrgId,
    })
  } catch (error) {
    console.error('[blog/publish] error:', error)
    return NextResponse.json({ success: false, error: 'internal_error' }, { status: 500 })
  }
}
