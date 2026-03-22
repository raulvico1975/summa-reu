import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getStorage } from 'firebase-admin/storage'
import { NextResponse, type NextRequest } from 'next/server'
import { getAdminApp } from '@/lib/api/admin-sdk'
import { buildBlogUrl } from '@/lib/blog/firestore'
import {
  assertNoLocalBlogPublishStorageInProduction,
  isLocalBlogPublishStorageEnabled,
} from '@/lib/blog/publish-local-store'

type UploadBlogCoverSuccessResponse = {
  success: true
  coverImageUrl: string
  path: string
  storage: 'local' | 'firebase'
}

type UploadBlogCoverErrorResponse = {
  success: false
  error: string
  details?: string[]
}

export type UploadBlogCoverResponse =
  | UploadBlogCoverSuccessResponse
  | UploadBlogCoverErrorResponse

type RequestLike = Pick<NextRequest, 'headers' | 'json'>

type UploadResult = {
  coverImageUrl: string
  path: string
  storage: 'local' | 'firebase'
}

interface UploadDeps {
  getUploadSecretFn: () => string | null
  saveLocalFileFn: (params: SaveFileParams) => Promise<UploadResult>
  saveFirebaseFileFn: (params: SaveFileParams) => Promise<UploadResult>
}

type SaveFileParams = {
  slug: string
  buffer: Buffer
  mimeType: string
  extension: string
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const SAFE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DATA_URL_PATTERN = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i

function getUploadSecretFromEnv(): string | null {
  if (isLocalBlogPublishStorageEnabled()) {
    return process.env.BLOG_PUBLISH_LOCAL_SECRET?.trim() || process.env.BLOG_PUBLISH_SECRET?.trim() || null
  }

  return process.env.BLOG_PUBLISH_SECRET?.trim() || null
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

function isSafeSlug(slug: string): boolean {
  return SAFE_SLUG_PATTERN.test(slug)
}

function normalizeRequiredString(value: unknown, field: string, errors: string[]): string {
  if (typeof value !== 'string') {
    errors.push(`${field} must be a string`)
    return ''
  }

  const normalized = value.trim()
  if (!normalized) {
    errors.push(`${field} is required`)
    return ''
  }

  return normalized
}

function normalizeMimeType(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  return normalized || undefined
}

function getExtensionForMimeType(mimeType: string): string | null {
  switch (mimeType) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    default:
      return null
  }
}

function parseImagePayload(
  payload: unknown
):
  | { ok: true; value: { slug: string; buffer: Buffer; mimeType: string; extension: string } }
  | { ok: false; errors: string[] } {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { ok: false, errors: ['payload must be an object'] }
  }

  const body = payload as Record<string, unknown>
  const errors: string[] = []

  const slug = normalizeRequiredString(body.slug, 'slug', errors)
  const imageBase64 = normalizeRequiredString(body.imageBase64, 'imageBase64', errors)
  let mimeType = normalizeMimeType(body.mimeType)
  let base64Data = imageBase64

  const dataUrlMatch = imageBase64.match(DATA_URL_PATTERN)
  if (dataUrlMatch) {
    mimeType = mimeType || dataUrlMatch[1].toLowerCase()
    base64Data = dataUrlMatch[2]
  }

  if (slug && !isSafeSlug(slug)) {
    errors.push('slug must be URL-safe')
  }

  if (!mimeType || !mimeType.startsWith('image/')) {
    errors.push('mimeType must be a supported image MIME type')
  }

  const extension = mimeType ? getExtensionForMimeType(mimeType) : null
  if (!extension) {
    errors.push('mimeType must be png, jpeg, webp or gif')
  }

  let buffer = Buffer.alloc(0)
  if (base64Data) {
    try {
      buffer = Buffer.from(base64Data, 'base64')
    } catch {
      errors.push('imageBase64 must be valid base64')
    }
  }

  if (buffer.length === 0) {
    errors.push('imageBase64 must decode to a non-empty image')
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    errors.push('image exceeds max size of 10MB')
  }

  if (errors.length > 0 || !mimeType || !extension) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      slug,
      buffer,
      mimeType,
      extension,
    },
  }
}

function buildAssetBaseUrl(): string {
  const blogPostUrl = buildBlogUrl('placeholder')
  return blogPostUrl.replace(/\/blog\/placeholder$/, '')
}

async function saveLocalFile({
  slug,
  buffer,
  mimeType,
  extension,
}: SaveFileParams): Promise<UploadResult> {
  const fileName = `${slug}-${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`
  const relativePath = `blog-covers/${fileName}`
  const absolutePath = path.join(process.cwd(), 'public', relativePath)

  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, buffer)

  return {
    coverImageUrl: `${buildAssetBaseUrl()}/${relativePath}`,
    path: relativePath,
    storage: 'local',
  }
}

async function saveFirebaseFile({
  slug,
  buffer,
  mimeType,
  extension,
}: SaveFileParams): Promise<UploadResult> {
  const bucket = getStorage(getAdminApp()).bucket()
  const objectPath = `blog/covers/${slug}-${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`
  const downloadToken = randomUUID()
  const file = bucket.file(objectPath)

  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  })

  return {
    coverImageUrl:
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${downloadToken}`,
    path: objectPath,
    storage: 'firebase',
  }
}

const DEFAULT_DEPS: UploadDeps = {
  getUploadSecretFn: getUploadSecretFromEnv,
  saveLocalFileFn: saveLocalFile,
  saveFirebaseFileFn: saveFirebaseFile,
}

export async function handleBlogCoverUpload(
  request: RequestLike,
  deps: UploadDeps = DEFAULT_DEPS
): Promise<NextResponse<UploadBlogCoverResponse>> {
  try {
    assertNoLocalBlogPublishStorageInProduction()
  } catch (error) {
    console.error('[blog/upload-cover] misconfiguration:', error)
    return NextResponse.json({ success: false, error: 'misconfigured_storage' }, { status: 503 })
  }

  try {
    const secret = deps.getUploadSecretFn()
    if (!secret || !hasValidAuthorization(request, secret)) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    }

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
    }

    const validation = parseImagePayload(rawBody)
    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: 'invalid_payload', details: validation.errors },
        { status: 400 }
      )
    }

    const saveFn = isLocalBlogPublishStorageEnabled() ? deps.saveLocalFileFn : deps.saveFirebaseFileFn
    const result = await saveFn(validation.value)

    console.log('[blog/upload-cover] uploaded', {
      slug: validation.value.slug,
      path: result.path,
      storage: result.storage,
    })

    return NextResponse.json({
      success: true,
      coverImageUrl: result.coverImageUrl,
      path: result.path,
      storage: result.storage,
    })
  } catch (error) {
    console.error('[blog/upload-cover] error:', error)
    return NextResponse.json({ success: false, error: 'internal_error' }, { status: 500 })
  }
}
