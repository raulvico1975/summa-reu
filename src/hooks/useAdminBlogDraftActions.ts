'use client'

import * as React from 'react'

import { useFirebase } from '@/firebase'
import type { NativeBlogPost } from '@/lib/editorial-native/types'

type GenerateActionInput = {
  action: 'generate_post'
  prompt: string
  audience?: string
  problem?: string
  objective?: string
}

type UpdateActionInput = {
  action: 'update_draft'
  postId: string
  draft: {
    title: string
    slug: string
    seoTitle: string
    metaDescription: string
    excerpt: string
    contentMarkdown: string
    category: string
    tags: string[]
    coverImageUrl?: string | null
    coverImageAlt?: string | null
    imagePrompt?: string | null
  }
}

type PostActionInput =
  | GenerateActionInput
  | UpdateActionInput
  | { action: 'approve_post'; postId: string }
  | { action: 'generate_cover'; postId: string }
  | { action: 'publish_post'; postId: string }
  | { action: 'unpublish_post'; postId: string }
  | { action: 'discard_post'; postId: string }

type ActionResult =
  | { action: 'generate_post'; post: NativeBlogPost }
  | { action: 'update_draft'; post: NativeBlogPost }
  | { action: 'approve_post'; post: NativeBlogPost }
  | { action: 'generate_cover'; post: NativeBlogPost }
  | { action: 'publish_post'; post: NativeBlogPost }
  | { action: 'unpublish_post'; post: NativeBlogPost }
  | { action: 'discard_post'; post: NativeBlogPost }

type ApiResponse =
  | { ok: true; result: ActionResult; message: string }
  | { ok: false; error: string }

export function useAdminBlogDraftActions() {
  const { user } = useFirebase()
  const [pendingId, setPendingId] = React.useState<string | null>(null)

  const runAction = React.useCallback(
    async (input: PostActionInput) => {
      if (!user) {
        throw new Error('Cal iniciar sessió per operar el blog editorial.')
      }

      setPendingId('postId' in input ? input.postId : 'new-post')

      try {
        const idToken = await user.getIdToken()
        const response = await fetch('/api/admin/blog-drafts/actions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        })

        const data = (await response.json()) as ApiResponse
        if (!response.ok || !data.ok) {
          throw new Error(data.ok ? 'No s’ha pogut completar l’acció.' : data.error)
        }

        return data
      } finally {
        setPendingId(null)
      }
    },
    [user]
  )

  return {
    pendingId,
    generatePost: (input: Omit<GenerateActionInput, 'action'>) => runAction({ action: 'generate_post', ...input }),
    updateDraft: (postId: string, draft: UpdateActionInput['draft']) =>
      runAction({ action: 'update_draft', postId, draft }),
    approvePost: (postId: string) => runAction({ action: 'approve_post', postId }),
    generateCover: (postId: string) => runAction({ action: 'generate_cover', postId }),
    publishPost: (postId: string) => runAction({ action: 'publish_post', postId }),
    unpublishPost: (postId: string) => runAction({ action: 'unpublish_post', postId }),
    discardPost: (postId: string) => runAction({ action: 'discard_post', postId }),
  }
}
