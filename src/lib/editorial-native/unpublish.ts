import {
  handleBlogUnpublish,
  type UnpublishBlogResponse,
} from '@/app/api/blog/unpublish/handler'
import { isLocalBlogPublishStorageEnabled } from '@/lib/blog/publish-local-store'
import type { NativeBlogPost } from '@/lib/editorial-native/types'

function getInternalPublishSecret(): string {
  const secret = isLocalBlogPublishStorageEnabled()
    ? process.env.BLOG_PUBLISH_LOCAL_SECRET?.trim() || 'local-blog-publish-secret'
    : process.env.BLOG_PUBLISH_SECRET?.trim()

  if (!secret) {
    throw new Error('Falta BLOG_PUBLISH_SECRET per despublicar el blog.')
  }

  return secret
}

export async function unpublishNativeBlogPost(
  post: Pick<NativeBlogPost, 'draft'>
): Promise<Extract<UnpublishBlogResponse, { success: true }>> {
  const slug = post.draft.slug?.trim()
  if (!slug) {
    throw new Error('Falta el slug del draft abans de despublicar-lo.')
  }

  const secret = getInternalPublishSecret()
  const response = await handleBlogUnpublish({
    headers: new Headers({
      Authorization: `Bearer ${secret}`,
    }),
    json: async () => ({ slug }),
  } as Parameters<typeof handleBlogUnpublish>[0])

  const body = (await response.json()) as UnpublishBlogResponse
  if (!response.ok || !body.success) {
    throw new Error(body.success ? 'No s’ha pogut despublicar el post.' : body.error)
  }

  return body
}
