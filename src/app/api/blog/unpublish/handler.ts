import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'

import { getAdminDb } from '@/lib/api/admin-sdk'
import {
  getBlogOrgId,
  getBlogPostsCollectionPath,
  resolveBlogOrgId,
} from '@/lib/blog/firestore'
import {
  assertNoLocalBlogPublishStorageInProduction,
  deleteLocalBlogPost,
  isLocalBlogPublishStorageEnabled,
} from '@/lib/blog/publish-local-store'
import { PUBLIC_LOCALES } from '@/lib/public-locale'

type RequestLike = Pick<NextRequest, 'headers' | 'json'>

type BlogUnpublishDocRef = {
  get: () => Promise<{
    exists: boolean
  }>
  delete: () => Promise<void>
}

type BlogUnpublishDb = {
  doc: (path: string) => BlogUnpublishDocRef
}

type UnpublishBlogSuccessResponse = {
  success: true
  slug: string
  orgId?: string
  alreadyMissing?: boolean
}

type UnpublishBlogErrorResponse = {
  success: false
  error: string
}

export type UnpublishBlogResponse = UnpublishBlogSuccessResponse | UnpublishBlogErrorResponse

export interface UnpublishBlogDeps {
  getAdminDbFn: () => BlogUnpublishDb
  getPublishSecretFn: () => string | null
  getBlogOrgIdFn: () => string
  getPublicLocalesFn: () => string[]
  revalidatePathsFn: (paths: string[]) => void | Promise<void>
}

function getPublishSecretFromEnv(): string | null {
  if (isLocalBlogPublishStorageEnabled()) {
    return process.env.BLOG_PUBLISH_LOCAL_SECRET?.trim() || 'local-blog-publish-secret'
  }

  return process.env.BLOG_PUBLISH_SECRET?.trim() || null
}

const DEFAULT_DEPS: UnpublishBlogDeps = {
  getAdminDbFn: () => getAdminDb() as unknown as BlogUnpublishDb,
  getPublishSecretFn: getPublishSecretFromEnv,
  getBlogOrgIdFn: getBlogOrgId,
  getPublicLocalesFn: () => [...PUBLIC_LOCALES],
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

function hasValidAuthorization(request: RequestLike, secret: string | null): boolean {
  if (!secret) return false
  const token = extractBearerToken(request)
  if (!token) return false
  return safeCompare(token, secret)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function buildRevalidationPaths(locales: string[], slug: string): string[] {
  const paths = new Set<string>(['/blog', `/blog/${slug}`])

  for (const locale of locales) {
    const normalized = locale.trim()
    if (!normalized) continue
    paths.add(`/${normalized}/blog`)
    paths.add(`/${normalized}/blog/${slug}`)
  }

  return [...paths]
}

async function safeRevalidateBlogPaths(
  slug: string,
  deps: Pick<UnpublishBlogDeps, 'getPublicLocalesFn' | 'revalidatePathsFn'>
): Promise<void> {
  try {
    await deps.revalidatePathsFn(buildRevalidationPaths(deps.getPublicLocalesFn(), slug))
  } catch (error) {
    console.warn('[blog/unpublish] revalidate warning:', error)
  }
}

export async function handleBlogUnpublish(
  request: RequestLike,
  deps: UnpublishBlogDeps = DEFAULT_DEPS
): Promise<NextResponse<UnpublishBlogResponse>> {
  try {
    assertNoLocalBlogPublishStorageInProduction()
  } catch (error) {
    console.error('[blog/unpublish] misconfiguration:', error)
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

    const slug = isRecord(rawBody) ? normalizeString(rawBody.slug) : null
    if (!slug) {
      return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
    }

    const requestedOrgId = deps.getBlogOrgIdFn()
    let effectiveOrgId = requestedOrgId
    let alreadyMissing = false

    if (isLocalBlogPublishStorageEnabled()) {
      const deleted = await deleteLocalBlogPost(requestedOrgId, slug)
      alreadyMissing = !deleted
    } else {
      const db = deps.getAdminDbFn()
      const orgId = await resolveBlogOrgId(
        db as unknown as ReturnType<typeof getAdminDb>,
        requestedOrgId
      )
      effectiveOrgId = orgId
      const postRef = db.doc(`${getBlogPostsCollectionPath(orgId)}/${slug}`)
      const existing = await postRef.get()

      if (!existing.exists) {
        alreadyMissing = true
      } else {
        await postRef.delete()
      }
    }

    await safeRevalidateBlogPaths(slug, {
      getPublicLocalesFn: deps.getPublicLocalesFn,
      revalidatePathsFn: (paths) => deps.revalidatePathsFn(paths),
    })

    return NextResponse.json({
      success: true,
      slug,
      orgId: effectiveOrgId,
      alreadyMissing,
    })
  } catch (error) {
    console.error('[blog/unpublish] error:', error)
    return NextResponse.json({ success: false, error: 'internal_error' }, { status: 500 })
  }
}
