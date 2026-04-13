'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Plus, RefreshCw, Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useGrowthActions } from '@/hooks/useGrowthActions'
import { useGrowthLeads } from '@/hooks/useGrowthLeads'
import { getAllGrowthLeads, getGrowthQueueLeads, GROWTH_QUEUE_META, type GrowthQueueSlug } from '@/lib/growth/queues'
import type { GrowthLeadRecord } from '@/lib/growth/types'

import { CreateJobModal } from './CreateJobModal'
import { LeadCard } from './LeadCard'
import { ReviewDrawer } from './ReviewDrawer'

function QueueSection({
  title,
  description,
  count,
  children,
}: {
  title: string
  description: string
  count: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
          {count}
        </Badge>
      </div>
      <div className="space-y-3 p-4 sm:p-5">{children}</div>
    </section>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
      {label}
    </div>
  )
}

function QueueSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="h-4 w-44 animate-pulse rounded-full bg-slate-200" />
              <div className="h-3 w-28 animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" />
          </div>
          <div className="mt-4 h-20 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

export function LeadsQueuePage({ queue }: { queue: GrowthQueueSlug }) {
  const meta = GROWTH_QUEUE_META[queue]
  const { groups, loading, error, refresh } = useGrowthLeads()
  const {
    approveAndSend,
    discardLead,
    updateDraft,
    createJob,
    createManualLead,
    isSavingDraft,
    isApproving,
    isDiscarding,
    isCreatingJob,
    isCreatingLead,
  } = useGrowthActions()

  const [selectedLeadId, setSelectedLeadId] = React.useState<string | null>(null)
  const [draftSubject, setDraftSubject] = React.useState('')
  const [draftBody, setDraftBody] = React.useState('')
  const [isJobModalOpen, setIsJobModalOpen] = React.useState(false)
  const [jobPrompt, setJobPrompt] = React.useState('')

  const allLeads = React.useMemo(() => getAllGrowthLeads(groups), [groups])
  const queueLeads = React.useMemo(() => getGrowthQueueLeads(queue, groups), [groups, queue])

  const selectedLead = React.useMemo(
    () => allLeads.find((lead) => lead.id === selectedLeadId) ?? null,
    [allLeads, selectedLeadId]
  )

  React.useEffect(() => {
    if (!selectedLead) {
      setDraftSubject('')
      setDraftBody('')
      return
    }

    setDraftSubject(selectedLead.outreach.subject ?? '')
    setDraftBody(selectedLead.outreach.draftBody ?? '')
  }, [selectedLead])

  const handleReview = React.useCallback((lead: GrowthLeadRecord) => {
    setSelectedLeadId(lead.id)
  }, [])

  const handleCloseDrawer = React.useCallback(() => {
    setSelectedLeadId(null)
  }, [])

  const handleSaveDraft = React.useCallback(async () => {
    if (!selectedLead) return
    await updateDraft(selectedLead.id, {
      subject: draftSubject,
      draftBody,
    })
    await refresh()
  }, [draftBody, draftSubject, refresh, selectedLead, updateDraft])

  const handleApproveAndSend = React.useCallback(async () => {
    if (!selectedLead) return
    await approveAndSend(selectedLead.id)
    setSelectedLeadId(null)
    await refresh()
  }, [approveAndSend, refresh, selectedLead])

  const handleDiscard = React.useCallback(async () => {
    if (!selectedLead) return
    await discardLead(selectedLead.id)
    setSelectedLeadId(null)
    await refresh()
  }, [discardLead, refresh, selectedLead])

  const handleCreateJob = React.useCallback(async () => {
    await createJob(jobPrompt)
    setJobPrompt('')
    setIsJobModalOpen(false)
    await refresh()
  }, [createJob, jobPrompt, refresh])

  const handleAddElement = React.useCallback(async () => {
    const input = window.prompt("Introdueix la URL de l'entitat")
    if (!input?.trim()) return

    await createManualLead(input)
    await refresh()
  }, [createManualLead, refresh])

  return (
    <div className="min-w-0 bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-[1480px] px-5 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <Link
              href="/admin/growth/leads"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Tornar al tauler
            </Link>
            <div className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">
              CRM / Leads
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">{meta.title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">{meta.description}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={handleAddElement}
              disabled={isCreatingLead}
              className="!border-slate-950 !bg-slate-950 !text-white hover:!bg-slate-800 hover:!text-white"
            >
              {isCreatingLead ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Nou Element
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsJobModalOpen(true)}
              className="!border-purple-200 !bg-purple-50 !text-purple-700 shadow-sm hover:!bg-purple-100 hover:!text-purple-800"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              ✨ Demanar Leads a l&apos;IA
            </Button>
            <Button variant="ghost" size="icon" onClick={() => void refresh()} disabled={loading} aria-label="Actualitzar">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </header>

        <QueueSection title={meta.title} description={meta.description} count={loading ? '…' : queueLeads.length}>
          {loading ? (
            <QueueSkeleton />
          ) : (
            <>
              {queueLeads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} onReview={handleReview} />
              ))}
              {!queueLeads.length ? <EmptyState label={meta.empty} /> : null}
            </>
          )}
        </QueueSection>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}
      </div>

      <ReviewDrawer
        open={Boolean(selectedLead)}
        lead={selectedLead}
        subject={draftSubject}
        draftBody={draftBody}
        onSubjectChange={setDraftSubject}
        onDraftBodyChange={setDraftBody}
        onClose={handleCloseDrawer}
        onSaveDraft={() => void handleSaveDraft()}
        onApproveAndSend={() => void handleApproveAndSend()}
        onDiscard={() => void handleDiscard()}
        isSavingDraft={isSavingDraft}
        isApproving={isApproving}
        isDiscarding={isDiscarding}
      />

      <CreateJobModal
        open={isJobModalOpen}
        onOpenChange={setIsJobModalOpen}
        prompt={jobPrompt}
        onPromptChange={setJobPrompt}
        onSubmit={() => void handleCreateJob()}
        isSubmitting={isCreatingJob}
      />
    </div>
  )
}
