import { handleBlogPublish, type PublishBlogResponse } from '@/app/api/blog/publish/handler'
import { isLocalBlogPublishStorageEnabled } from '@/lib/blog/publish-local-store'
import type { BlogPostPublishInput } from '@/lib/blog/validateBlogPost'
import { buildMetaDescriptionFromMarkdown, renderEditorialMarkdownToHtml } from '@/lib/editorial-native/markdown'
import type { NativeBlogPost } from '@/lib/editorial-native/types'

function getInternalPublishSecret(): string {
  const secret = isLocalBlogPublishStorageEnabled()
    ? process.env.BLOG_PUBLISH_LOCAL_SECRET?.trim() || 'local-blog-publish-secret'
    : process.env.BLOG_PUBLISH_SECRET?.trim()

  if (!secret) {
    throw new Error('Falta BLOG_PUBLISH_SECRET per publicar el blog.')
  }

  return secret
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

  if (post.draft.translations?.es) {
    payload.translations = {
      es: {
        title: post.draft.translations.es.title,
        seoTitle: post.draft.translations.es.seoTitle,
        metaDescription: post.draft.translations.es.metaDescription,
        excerpt: post.draft.translations.es.excerpt,
        contentHtml:
          post.draft.translations.es.contentHtml ||
          renderEditorialMarkdownToHtml(post.draft.translations.es.contentMarkdown),
        ...(post.draft.coverImageUrl && post.draft.coverImageAlt
          ? { coverImageAlt: post.draft.coverImageAlt }
          : {}),
      },
    }
  }

  return payload
}

export async function publishNativeBlogPost(post: NativeBlogPost): Promise<Extract<PublishBlogResponse, { success: true }>> {
  const payload = buildPublishInputFromNativePost(post)
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
