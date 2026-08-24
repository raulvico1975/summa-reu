import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getStorage } from 'firebase-admin/storage'
import { handleBlogPublish, type PublishBlogResponse } from '@/app/api/blog/publish/handler'
import { getAdminApp } from '@/lib/api/admin-sdk'
import { isLocalBlogPublishStorageEnabled } from '@/lib/blog/publish-local-store'
import type { BlogPostPublishInput } from '@/lib/blog/validateBlogPost'
import { buildMetaDescriptionFromMarkdown, renderEditorialMarkdownToHtml } from '@/lib/editorial-native/markdown'
import type { NativeBlogPost } from '@/lib/editorial-native/types'

function getInternalPublishSecret(): string {
  const secret = isLocalBlogPublishStorageEnabled()
    ? // SECURITY FIX (auditoria 2026-08-23): sense fallback hardcoded.
    process.env.BLOG_PUBLISH_LOCAL_SECRET?.trim()
    : process.env.BLOG_PUBLISH_SECRET?.trim()

  if (!secret) {
    throw new Error('Falta BLOG_PUBLISH_SECRET per publicar el blog.')
  }

  return secret
}

type PromoteLocalCoverImageParams = {
  slug: string
  coverImageUrl: string
}

type PrepareNativeBlogPostForPublishDeps = {
  isLocalStorageEnabled: () => boolean
  promoteLocalCoverImage: (params: PromoteLocalCoverImageParams) => Promise<string>
}

function isPromotableLocalCoverUrl(coverImageUrl: string): boolean {
  try {
    const parsed = new URL(coverImageUrl)
    return (
      ['localhost', '127.0.0.1'].includes(parsed.hostname) &&
      parsed.pathname.startsWith('/blog-covers/')
    )
  } catch {
    return false
  }
}

function detectCoverMimeType(absolutePath: string): string {
  switch (path.extname(absolutePath).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.svg':
      return 'image/svg+xml'
    default:
      throw new Error(`Format de portada no suportat: ${absolutePath}`)
  }
}

async function promoteLocalCoverImageToFirebase({
  slug,
  coverImageUrl,
}: PromoteLocalCoverImageParams): Promise<string> {
  const parsed = new URL(coverImageUrl)
  const relativePath = parsed.pathname.replace(/^\//, '')
  const absolutePath = path.join(process.cwd(), 'public', relativePath)
  const fileBuffer = await readFile(absolutePath)
  const extension = path.extname(absolutePath).replace(/^\./, '').toLowerCase()
  const mimeType = detectCoverMimeType(absolutePath)
  const bucket = getStorage(getAdminApp()).bucket()
  const objectPath = `blog/covers/${slug}-${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`
  const downloadToken = randomUUID()
  const file = bucket.file(objectPath)

  await file.save(fileBuffer, {
    resumable: false,
    metadata: {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  })

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${downloadToken}`
}

const DEFAULT_PREPARE_DEPS: PrepareNativeBlogPostForPublishDeps = {
  isLocalStorageEnabled: isLocalBlogPublishStorageEnabled,
  promoteLocalCoverImage: promoteLocalCoverImageToFirebase,
}

export async function prepareNativeBlogPostForPublish(
  post: NativeBlogPost,
  deps: PrepareNativeBlogPostForPublishDeps = DEFAULT_PREPARE_DEPS
): Promise<NativeBlogPost> {
  const coverImageUrl = post.draft.coverImageUrl?.trim()
  if (!coverImageUrl || deps.isLocalStorageEnabled() || !isPromotableLocalCoverUrl(coverImageUrl)) {
    return post
  }

  const promotedCoverImageUrl = await deps.promoteLocalCoverImage({
    slug: post.draft.slug?.trim() || post.id,
    coverImageUrl,
  })

  return {
    ...post,
    draft: {
      ...post.draft,
      coverImageUrl: promotedCoverImageUrl,
    },
  }
}

export function buildPublishInputFromNativePost(post: NativeBlogPost): BlogPostPublishInput {
  const title = post.draft.title?.trim()
  const slug = post.draft.slug?.trim()
  const seoTitle = post.draft.seoTitle?.trim()
  const metaDescription =
    post.draft.metaDescription?.trim() ||
    buildMetaDescriptionFromMarkdown(post.draft.contentMarkdown ?? '')
  const excerpt = post.draft.excerpt?.trim()
  const contentHtml =
    post.draft.contentHtml?.trim() ||
    renderEditorialMarkdownToHtml(post.draft.contentMarkdown ?? '')

  if (!title || !slug || !seoTitle || !metaDescription || !excerpt || !contentHtml) {
    throw new Error("Falten camps obligatoris del draft abans de publicar-lo.")
  }

  const esTranslation = post.draft.translations?.es
  if (!esTranslation) {
    throw new Error('Falta la traducció ES del draft abans de publicar-lo.')
  }

  if (post.draft.coverImageUrl && !esTranslation.coverImageAlt?.trim()) {
    throw new Error('Falta el text alternatiu ES de la portada abans de publicar el draft.')
  }

  const payload: BlogPostPublishInput = {
    title,
    slug,
    seoTitle,
    metaDescription,
    excerpt,
    contentHtml,
    tags: post.draft.tags,
    category: post.draft.category?.trim() || 'criteri-operatiu',
    publishedAt: new Date().toISOString(),
    baseLocale: 'ca',
  }

  if (post.draft.coverImageUrl) {
    payload.coverImageUrl = post.draft.coverImageUrl
    if (post.draft.coverImageAlt) {
      payload.coverImageAlt = post.draft.coverImageAlt
    }
  }

  payload.translations = {
    es: {
      title: esTranslation.title,
      seoTitle: esTranslation.seoTitle,
      metaDescription: esTranslation.metaDescription,
      excerpt: esTranslation.excerpt,
      contentHtml:
        esTranslation.contentHtml ||
        renderEditorialMarkdownToHtml(esTranslation.contentMarkdown),
      ...(post.draft.coverImageUrl
        ? { coverImageAlt: esTranslation.coverImageAlt?.trim() ?? '' }
        : {}),
    },
  }

  return payload
}

export async function publishNativeBlogPost(post: NativeBlogPost): Promise<Extract<PublishBlogResponse, { success: true }>> {
  const prepared = await prepareNativeBlogPostForPublish(post)
  const payload = buildPublishInputFromNativePost(prepared)
  const secret = getInternalPublishSecret()

  const response = await handleBlogPublish({
    headers: new Headers({
      Authorization: `Bearer ${secret}`,
    }),
    json: async () => payload,
  } as Parameters<typeof handleBlogPublish>[0])

  const body = (await response.json()) as PublishBlogResponse
  if (!response.ok || !body.success) {
    throw new Error(body.success ? 'No s’ha pogut publicar el post.' : body.error)
  }

  return body
}
