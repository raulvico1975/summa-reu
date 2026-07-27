import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { getAdminDb } from '@/lib/api/admin-sdk'
import {
  assertBlogOrganizationExists,
  buildBlogUrl,
  buildLocalizedBlogUrls,
  getBlogOrgId,
  getBlogPostsCollectionPath,
  resolveBlogOrgId,
} from '@/lib/blog/firestore'
import {
  assertNoLocalBlogPublishStorageInProduction,
  ensureLocalBlogOrganization,
  getLocalBlogPost,
  isLocalBlogPublishStorageEnabled,
  updateLocalBlogPost,
} from '@/lib/blog/publish-local-store'
import type { BlogPost, BlogPostTranslation } from '@/lib/blog/types'
import {
  type BlogPostUpdatePatch,
  validateBlogPostUpdate,
} from '@/lib/blog/validateBlogPostUpdate'
import { validateBlogPost, type BlogPostPublishInput } from '@/lib/blog/validateBlogPost'
import { PUBLIC_LOCALES } from '@/lib/public-locale'
import { submitIndexNowUrls } from '@/lib/marketing/indexnow'

type UpdateBlogSuccessResponse = {
  success: true
  slug: string
  url: string
  localizedUrls: {
    ca: string
    es: string
  }
  legacyUrl: string
  orgId?: string
}

type UpdateBlogErrorResponse = {
  success: false
  error: string
  details?: string[]
}

export type UpdateBlogResponse = UpdateBlogSuccessResponse | UpdateBlogErrorResponse

type RequestLike = Pick<NextRequest, 'headers' | 'json'>

type BlogUpdateDocRef = {
  get: () => Promise<{
    exists: boolean
    data: () => unknown
  }>
  update: (payload: Record<string, unknown>) => Promise<void>
}

type BlogUpdateDb = {
  doc: (path: string) => BlogUpdateDocRef
}

export interface UpdateBlogDeps {
  getAdminDbFn: () => BlogUpdateDb
  nowIsoFn: () => string
  getPublishSecretFn: () => string | null
  getBlogOrgIdFn: () => string
  assertBlogOrganizationExistsFn: (db?: ReturnType<typeof getAdminDb>, orgId?: string) => Promise<void>
  revalidatePathsFn: (paths: string[]) => void | Promise<void>
  notifyIndexNowFn?: (urls: string[]) => Promise<unknown>
}

function getPublishSecretFromEnv(): string | null {
  if (isLocalBlogPublishStorageEnabled()) {
    return process.env.BLOG_PUBLISH_LOCAL_SECRET?.trim() || 'local-blog-publish-secret'
  }

  return process.env.BLOG_PUBLISH_SECRET?.trim() || null
}

const DEFAULT_DEPS: UpdateBlogDeps = {
  getAdminDbFn: () => getAdminDb() as unknown as BlogUpdateDb,
  nowIsoFn: () => new Date().toISOString(),
  getPublishSecretFn: getPublishSecretFromEnv,
  getBlogOrgIdFn: getBlogOrgId,
  assertBlogOrganizationExistsFn: assertBlogOrganizationExists,
  revalidatePathsFn: (paths) => {
    for (const path of paths) {
      revalidatePath(path)
    }
  },
  notifyIndexNowFn: (urls) => submitIndexNowUrls(urls),
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

function hasValidAuthorization(request: RequestLike, secret: string | null): boolean {
  if (!secret) return false
  const token = extractBearerToken(request)
  if (!token) return false
  return safeCompare(token, secret)
}

function normalizeExistingPublishInput(post: BlogPost): BlogPostPublishInput {
  const value: BlogPostPublishInput = {
    title: post.title,
    slug: post.slug,
    seoTitle: post.seoTitle,
    metaDescription: post.metaDescription,
    excerpt: post.excerpt,
    contentHtml: post.contentHtml,
    tags: post.tags,
    category: post.category,
    publishedAt: post.publishedAt,
  }

  if (post.baseLocale !== undefined) {
    value.baseLocale = post.baseLocale
  }

  if (post.coverImageUrl !== undefined && post.coverImageUrl !== null) {
    value.coverImageUrl = post.coverImageUrl
  } else if (post.coverImageUrl === null) {
    value.coverImageUrl = null
  }

  if (post.coverImageAlt !== undefined && post.coverImageAlt !== null) {
    value.coverImageAlt = post.coverImageAlt
  } else if (post.coverImageAlt === null) {
    value.coverImageAlt = null
  }

  if (post.translations?.es) {
    value.translations = {
      es: { ...post.translations.es },
    }
  }

  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function buildPublishCandidateFromStoredData(
  slug: string,
  value: unknown
): BlogPostPublishInput | null {
  if (!isRecord(value)) return null

  const candidate: Record<string, unknown> = {
    title: value.title,
    slug,
    seoTitle: value.seoTitle,
    metaDescription: value.metaDescription,
    excerpt: value.excerpt,
    contentHtml: value.contentHtml,
    tags: value.tags,
    category: value.category,
    publishedAt: value.publishedAt,
  }

  if ('baseLocale' in value) {
    candidate.baseLocale = value.baseLocale
  }
  if ('coverImageUrl' in value) {
    candidate.coverImageUrl = value.coverImageUrl
  }
  if ('coverImageAlt' in value) {
    candidate.coverImageAlt = value.coverImageAlt
  }
  if ('translations' in value) {
    candidate.translations = value.translations
  }

  const validation = validateBlogPost(candidate)
  if (!validation.ok) {
    return null
  }

  return validation.value
}

function mergeTranslation(
  existing: BlogPostTranslation | undefined,
  patch: Partial<BlogPostTranslation> | undefined
): BlogPostTranslation | undefined {
  if (!existing && !patch) return undefined

  return {
    title: patch?.title ?? existing?.title ?? '',
    seoTitle: patch?.seoTitle ?? existing?.seoTitle ?? '',
    metaDescription: patch?.metaDescription ?? existing?.metaDescription ?? '',
    excerpt: patch?.excerpt ?? existing?.excerpt ?? '',
    contentHtml: patch?.contentHtml ?? existing?.contentHtml ?? '',
    ...(patch?.coverImageAlt !== undefined
      ? { coverImageAlt: patch.coverImageAlt }
      : existing?.coverImageAlt !== undefined
        ? { coverImageAlt: existing.coverImageAlt }
        : {}),
  }
}

function mergeBlogPostUpdate(
  existing: BlogPost,
  patch: BlogPostUpdatePatch
): BlogPostPublishInput {
  const current = normalizeExistingPublishInput(existing)
  const nextCoverImageUrl =
    patch.coverImageUrl !== undefined ? patch.coverImageUrl : current.coverImageUrl
  let nextCoverImageAlt =
    patch.coverImageAlt !== undefined ? patch.coverImageAlt : current.coverImageAlt

  if (patch.coverImageUrl === null && patch.coverImageAlt === undefined) {
    nextCoverImageAlt = null
  }

  const nextEsTranslation = mergeTranslation(current.translations?.es, patch.translations?.es)

  if (patch.coverImageUrl === null && patch.translations?.es?.coverImageAlt === undefined && nextEsTranslation) {
    nextEsTranslation.coverImageAlt = null
  }

  const next: BlogPostPublishInput = {
    title: patch.title ?? current.title,
    slug: current.slug,
    seoTitle: patch.seoTitle ?? current.seoTitle,
    metaDescription: patch.metaDescription ?? current.metaDescription,
    excerpt: patch.excerpt ?? current.excerpt,
    contentHtml: patch.contentHtml ?? current.contentHtml,
    tags: patch.tags ?? current.tags,
    category: patch.category ?? current.category,
    publishedAt: patch.publishedAt ?? current.publishedAt,
  }

  const nextBaseLocale = patch.baseLocale ?? current.baseLocale
  if (nextBaseLocale !== undefined) {
    next.baseLocale = nextBaseLocale
  }

  if (nextCoverImageUrl !== undefined) {
    next.coverImageUrl = nextCoverImageUrl
  }

  if (nextCoverImageAlt !== undefined) {
    next.coverImageAlt = nextCoverImageAlt
  }

  if (nextEsTranslation) {
    next.translations = {
      es: nextEsTranslation,
    }
  }

  return next
}

function arraysEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  if (a === undefined && b === undefined) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

function readPathValue(source: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.')
  let cursor: unknown = source

  for (const segment of segments) {
    if (typeof cursor !== 'object' || cursor === null || Array.isArray(cursor)) {
      return undefined
    }
    cursor = (cursor as Record<string, unknown>)[segment]
  }

  return cursor
}

function assignIfChanged(
  out: Record<string, unknown>,
  key: string,
  currentValue: unknown,
  nextValue: unknown,
  comparer?: (a: unknown, b: unknown) => boolean
) {
  const isEqual = comparer ? comparer(currentValue, nextValue) : currentValue === nextValue
  if (!isEqual) {
    out[key] = nextValue
  }
}

function buildFirestoreUpdatePayload(
  existingStored: Record<string, unknown>,
  next: BlogPostPublishInput,
  nowIso: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  assignIfChanged(payload, 'title', readPathValue(existingStored, 'title'), next.title)
  assignIfChanged(payload, 'seoTitle', readPathValue(existingStored, 'seoTitle'), next.seoTitle)
  assignIfChanged(
    payload,
    'metaDescription',
    readPathValue(existingStored, 'metaDescription'),
    next.metaDescription
  )
  assignIfChanged(payload, 'excerpt', readPathValue(existingStored, 'excerpt'), next.excerpt)
  assignIfChanged(payload, 'contentHtml', readPathValue(existingStored, 'contentHtml'), next.contentHtml)
  assignIfChanged(
    payload,
    'tags',
    readPathValue(existingStored, 'tags'),
    next.tags,
    (a, b) => arraysEqual(a as string[] | undefined, b as string[] | undefined)
  )
  assignIfChanged(payload, 'category', readPathValue(existingStored, 'category'), next.category)
  assignIfChanged(payload, 'publishedAt', readPathValue(existingStored, 'publishedAt'), next.publishedAt)
  assignIfChanged(payload, 'baseLocale', readPathValue(existingStored, 'baseLocale'), next.baseLocale)
  assignIfChanged(
    payload,
    'coverImageUrl',
    readPathValue(existingStored, 'coverImageUrl') ?? null,
    next.coverImageUrl ?? null
  )
  assignIfChanged(
    payload,
    'coverImageAlt',
    readPathValue(existingStored, 'coverImageAlt') ?? null,
    next.coverImageAlt ?? null
  )

  const nextEs = next.translations?.es

  assignIfChanged(payload, 'translations.es.title', readPathValue(existingStored, 'translations.es.title'), nextEs?.title)
  assignIfChanged(
    payload,
    'translations.es.seoTitle',
    readPathValue(existingStored, 'translations.es.seoTitle'),
    nextEs?.seoTitle
  )
  assignIfChanged(
    payload,
    'translations.es.metaDescription',
    readPathValue(existingStored, 'translations.es.metaDescription'),
    nextEs?.metaDescription
  )
  assignIfChanged(payload, 'translations.es.excerpt', readPathValue(existingStored, 'translations.es.excerpt'), nextEs?.excerpt)
  assignIfChanged(
    payload,
    'translations.es.contentHtml',
    readPathValue(existingStored, 'translations.es.contentHtml'),
    nextEs?.contentHtml
  )
  assignIfChanged(
    payload,
    'translations.es.coverImageAlt',
    readPathValue(existingStored, 'translations.es.coverImageAlt') ?? null,
    nextEs?.coverImageAlt ?? null
  )

  payload.updatedAt = nowIso
  return payload
}

function buildUpdatedBlogPost(
  existing: BlogPost,
  next: BlogPostPublishInput,
  nowIso: string
): BlogPost {
  return {
    ...existing,
    ...next,
    id: existing.id,
    slug: existing.slug,
    createdAt: existing.createdAt,
    updatedAt: nowIso,
  }
}

async function safeRevalidateBlogPaths(
  slug: string,
  deps: Pick<UpdateBlogDeps, 'revalidatePathsFn'>
): Promise<void> {
  try {
    const localizedPaths = PUBLIC_LOCALES.flatMap((locale) => [
      `/${locale}/blog`,
      `/${locale}/blog/${slug}`,
    ])
    await deps.revalidatePathsFn(['/blog', `/blog/${slug}`, ...localizedPaths])
  } catch (error) {
    console.warn('[blog/update] revalidate warning:', error)
  }
}

async function safeNotifyIndexNow(
  urls: string[],
  deps: Pick<UpdateBlogDeps, 'notifyIndexNowFn'>
): Promise<void> {
  if (!deps.notifyIndexNowFn) return
  try {
    await deps.notifyIndexNowFn(urls)
  } catch (error) {
    console.warn('[blog/update] IndexNow warning:', error)
  }
}

export async function handleBlogUpdate(
  request: RequestLike,
  deps: UpdateBlogDeps = DEFAULT_DEPS
): Promise<NextResponse<UpdateBlogResponse>> {
  try {
    assertNoLocalBlogPublishStorageInProduction()
  } catch (error) {
    console.error('[blog/update] misconfiguration:', error)
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

    const validation = validateBlogPostUpdate(rawBody)
    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: 'invalid_payload', details: validation.errors },
        { status: 400 }
      )
    }

    const { slug, patch } = validation.value
    const requestedOrgId = deps.getBlogOrgIdFn()
    const now = deps.nowIsoFn()
    let effectiveOrgId = requestedOrgId

    if (isLocalBlogPublishStorageEnabled()) {
      await ensureLocalBlogOrganization(requestedOrgId)
      const existingPost = await getLocalBlogPost(requestedOrgId, slug)
      if (!existingPost) {
        return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 })
      }

      const mergedCandidate = mergeBlogPostUpdate(existingPost, patch)
      const mergedValidation = validateBlogPost(mergedCandidate)
      if (!mergedValidation.ok) {
        return NextResponse.json(
          { success: false, error: 'invalid_payload', details: mergedValidation.errors },
          { status: 400 }
        )
      }

      const nextPost = buildUpdatedBlogPost(existingPost, mergedValidation.value, now)
      await updateLocalBlogPost(requestedOrgId, nextPost)
    } else {
      const db = deps.getAdminDbFn()
      const orgId = await resolveBlogOrgId(db as never, requestedOrgId)
      effectiveOrgId = orgId
      await deps.assertBlogOrganizationExistsFn(db as never, orgId)

      const postRef = db.doc(`${getBlogPostsCollectionPath(orgId)}/${slug}`)
      const existingSnap = await postRef.get()
      if (!existingSnap.exists) {
        return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 })
      }

      const rawExistingData = existingSnap.data()
      const existingCandidate = buildPublishCandidateFromStoredData(slug, rawExistingData)
      if (!existingCandidate) {
        return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
      }

      const existingPost: BlogPost = {
        id: slug,
        ...existingCandidate,
        createdAt:
          typeof (rawExistingData as Record<string, unknown>)?.createdAt === 'string'
            ? String((rawExistingData as Record<string, unknown>).createdAt)
            : now,
        updatedAt:
          typeof (rawExistingData as Record<string, unknown>)?.updatedAt === 'string'
            ? String((rawExistingData as Record<string, unknown>).updatedAt)
            : now,
      }

      const mergedCandidate = mergeBlogPostUpdate(existingPost, patch)
      const mergedValidation = validateBlogPost(mergedCandidate)
      if (!mergedValidation.ok) {
        return NextResponse.json(
          { success: false, error: 'invalid_payload', details: mergedValidation.errors },
          { status: 400 }
        )
      }

      const updatePayload = buildFirestoreUpdatePayload(
        rawExistingData as Record<string, unknown>,
        mergedValidation.value,
        now
      )
      await postRef.update(updatePayload)
    }

    await safeRevalidateBlogPaths(slug, deps)
    const localizedUrls = buildLocalizedBlogUrls(slug)
    const legacyUrl = buildBlogUrl(slug)
    await safeNotifyIndexNow(Object.values(localizedUrls), deps)

    return NextResponse.json({
      success: true,
      slug,
      url: localizedUrls.ca,
      localizedUrls,
      legacyUrl,
      orgId: effectiveOrgId,
    })
  } catch (error) {
    console.error('[blog/update] error:', error)
    return NextResponse.json({ success: false, error: 'internal_error' }, { status: 500 })
  }
}
