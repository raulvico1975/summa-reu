'use client'

import * as React from 'react'

import { useFirebase } from '@/firebase'
import type { NativeBlogPost, NativeBlogQueueSummary } from '@/lib/editorial-native/types'

type ApiResponse =
  | { ok: true; posts: NativeBlogPost[]; summary: NativeBlogQueueSummary }
  | { ok: false; error: string }

export function useAdminBlogDrafts() {
  const { user } = useFirebase()
  const [posts, setPosts] = React.useState<NativeBlogPost[]>([])
  const [summary, setSummary] = React.useState<NativeBlogQueueSummary | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    if (!user) {
      setPosts([])
      setSummary(null)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const idToken = await user.getIdToken()
      const response = await fetch('/api/admin/blog-drafts', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      })
      const data = (await response.json()) as ApiResponse
      if (!response.ok || !data.ok) {
        throw new Error(data.ok ? 'No s’han pogut carregar els drafts del blog.' : data.error)
      }

      setPosts(data.posts)
      setSummary(data.summary)
    } catch (cause) {
      setError((cause as Error).message || 'No s’han pogut carregar els drafts del blog.')
    } finally {
      setLoading(false)
    }
  }, [user])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    posts,
    summary,
    loading,
    error,
    refresh,
  }
}

