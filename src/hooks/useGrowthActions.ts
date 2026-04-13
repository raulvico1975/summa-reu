'use client'

import * as React from 'react'

import { useFirebase } from '@/firebase'
import { useToast } from '@/hooks/use-toast'
import {
  approveGrowthLead,
  createGrowthJob,
  createManualGrowthLead,
  discardGrowthLead,
  updateGrowthLeadDraft,
} from '@/lib/growth/firestore'
import type { GrowthLeadDraft } from '@/lib/growth/types'

export function useGrowthActions() {
  const { firestore } = useFirebase()
  const { toast } = useToast()
  const [isSavingDraft, setIsSavingDraft] = React.useState(false)
  const [isApproving, setIsApproving] = React.useState(false)
  const [isDiscarding, setIsDiscarding] = React.useState(false)
  const [isCreatingJob, setIsCreatingJob] = React.useState(false)
  const [isCreatingLead, setIsCreatingLead] = React.useState(false)

  const updateDraft = React.useCallback(
    async (leadId: string, draft: GrowthLeadDraft) => {
      setIsSavingDraft(true)
      try {
        await updateGrowthLeadDraft(firestore, leadId, draft)
        toast({
          title: 'Draft desat',
          description: 'Subject i cos actualitzats.',
        })
      } catch (cause) {
        toast({
          variant: 'destructive',
          title: 'No s’ha pogut desar el draft',
          description: (cause as Error).message || 'Torna-ho a provar.',
        })
        throw cause
      } finally {
        setIsSavingDraft(false)
      }
    },
    [firestore, toast]
  )

  const approveAndSend = React.useCallback(
    async (leadId: string) => {
      setIsApproving(true)
      try {
        await approveGrowthLead(firestore, leadId)
        toast({
          title: 'Lead aprovat',
          description: 'Ha quedat llest per enviar.',
        })
      } catch (cause) {
        toast({
          variant: 'destructive',
          title: 'No s’ha pogut aprovar',
          description: (cause as Error).message || 'Revisa permisos o connexió.',
        })
        throw cause
      } finally {
        setIsApproving(false)
      }
    },
    [firestore, toast]
  )

  const discardLead = React.useCallback(
    async (leadId: string) => {
      setIsDiscarding(true)
      try {
        await discardGrowthLead(firestore, leadId)
        toast({
          title: 'Lead descartat',
          description: 'S’ha tret del flux operatiu.',
        })
      } catch (cause) {
        toast({
          variant: 'destructive',
          title: 'No s’ha pogut descartar',
          description: (cause as Error).message || 'Torna-ho a provar.',
        })
        throw cause
      } finally {
        setIsDiscarding(false)
      }
    },
    [firestore, toast]
  )

  const createJobAction = React.useCallback(
    async (prompt: string) => {
      setIsCreatingJob(true)
      try {
        await createGrowthJob(firestore, prompt)
        toast({
          title: 'Cerca en marxa',
          description: 'El job ha quedat a la cua de processament.',
        })
      } catch (cause) {
        toast({
          variant: 'destructive',
          title: 'No s’ha pogut crear el job',
          description: (cause as Error).message || 'Revisa la connexió.',
        })
        throw cause
      } finally {
        setIsCreatingJob(false)
      }
    },
    [firestore, toast]
  )

  const createManualLead = React.useCallback(
    async (website: string) => {
      setIsCreatingLead(true)
      try {
        await createManualGrowthLead(firestore, website)
        toast({
          title: 'Lead creat',
          description: "L'entrada ha quedat a pending_review.",
        })
      } catch (cause) {
        toast({
          variant: 'destructive',
          title: 'No s’ha pogut crear el lead',
          description: (cause as Error).message || 'Torna-ho a provar.',
        })
        throw cause
      } finally {
        setIsCreatingLead(false)
      }
    },
    [firestore, toast]
  )

  return {
    approveAndSend,
    discardLead,
    updateDraft,
    createJob: createJobAction,
    createManualLead,
    isSavingDraft,
    isApproving,
    isDiscarding,
    isCreatingJob,
    isCreatingLead,
  }
}
