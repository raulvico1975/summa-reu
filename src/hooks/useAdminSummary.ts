'use client'

import * as React from 'react'

import { useFirebase } from '@/firebase'
import type { AdminControlTowerSummary } from '@/lib/admin/control-tower-summary'

export function useAdminSummary() {
  const { user } = useFirebase()
  const [summary, setSummary] = React.useState<AdminControlTowerSummary | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    if (!user) {
      setSummary(null)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const idToken = await user.getIdToken()
      const response = await fetch('/api/admin/control-tower/summary', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      })

      const data = (await response.json()) as
        | { ok: true; summary: AdminControlTowerSummary }
        | { ok: false; error: string }

      if (!response.ok || !data.ok) {
        throw new Error(data.ok ? 'No s’ha pogut carregar el resum admin.' : data.error)
      }

      setSummary(data.summary)
    } catch (cause) {
      setError((cause as Error).message || 'No s’ha pogut carregar el resum admin.')
    } finally {
      setLoading(false)
    }
  }, [user])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    summary,
    loading,
    error,
    refresh,
  }
}
