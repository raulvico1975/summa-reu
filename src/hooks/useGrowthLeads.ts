'use client'

import * as React from 'react'

import { useFirebase } from '@/firebase'
import { fetchGrowthBoard } from '@/lib/growth/firestore'
import { type GrowthJobRecord, type GrowthLeadGroups, type GrowthLeadRecord } from '@/lib/growth/types'

export function useGrowthLeads() {
  const { firestore } = useFirebase()
  const [leads, setLeads] = React.useState<GrowthLeadRecord[]>([])
  const [jobs, setJobs] = React.useState<GrowthJobRecord[]>([])
  const [groups, setGroups] = React.useState<GrowthLeadGroups>({
    pendingReview: [],
    approvedReady: [],
    contactedOrReplied: [],
    discarded: [],
  })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const next = await fetchGrowthBoard(firestore)
      setLeads(next.leads)
      setJobs(next.jobs)
      setGroups(next.groups)
    } catch (cause) {
      const message = (cause as Error).message || 'No s’han pogut carregar els leads.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [firestore])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    leads,
    jobs,
    groups,
    loading,
    error,
    refresh,
  }
}
