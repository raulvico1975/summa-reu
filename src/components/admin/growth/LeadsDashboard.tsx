'use client'

import * as React from 'react'
import {
  AlertCircle,
  Clock3,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react'

import { AdminEntryBox } from '@/components/admin/admin-entry-box'
import { Button } from '@/components/ui/button'
import { useGrowthActions } from '@/hooks/useGrowthActions'
import { useGrowthLeads } from '@/hooks/useGrowthLeads'
import { getGrowthQueueLeads } from '@/lib/growth/queues'

import { CreateJobModal } from './CreateJobModal'
export function LeadsDashboard() {
  const { groups, loading, error, refresh } = useGrowthLeads()
  const { createJob, createManualLead, isCreatingJob, isCreatingLead } = useGrowthActions()

  const [isJobModalOpen, setIsJobModalOpen] = React.useState(false)
  const [jobPrompt, setJobPrompt] = React.useState('')

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

  const pendingCount = getGrowthQueueLeads('pending', groups).length
  const readyCount = getGrowthQueueLeads('ready', groups).length
  const errorCount = getGrowthQueueLeads('errors', groups).length
  const repliesCount = getGrowthQueueLeads('replies', groups).length
  const contactedCount = getGrowthQueueLeads('contacted', groups).length
  const discardedCount = getGrowthQueueLeads('discarded', groups).length

  return (
    <div className="min-w-0 bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-[1680px] px-5 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">
              CRM / Leads
            </div>
            {loading ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Carregant mostres...
              </div>
            ) : null}
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                Pipeline de Prospecció
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Tauler d&apos;entrada operatiu. Cada caixa obre la seva pàgina específica de treball.
              </p>
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

        <div className="space-y-8">
          <div className="grid gap-5 md:grid-cols-2">
            <AdminEntryBox
              title="Correus per revisar"
              description="Leads que necessiten edició humana."
              count={loading ? 0 : pendingCount}
              icon={<Sparkles className="h-5 w-5" />}
              tone="orange"
              href="/admin/growth/leads/pending"
            />
            <AdminEntryBox
              title="Preparats per enviar"
              description="Esborranys aprovats i llestos per enviar."
              count={loading ? 0 : readyCount}
              icon={<Send className="h-5 w-5" />}
              tone="blue"
              href="/admin/growth/leads/ready"
            />
            <AdminEntryBox
              title="Errors d'enviament"
              description="Correus rebotats o dades invàlides."
              count={loading ? 0 : errorCount}
              icon={<AlertCircle className="h-5 w-5" />}
              tone="slate"
              href="/admin/growth/leads/errors"
            />
            <AdminEntryBox
              title="Noves Respostes"
              description="Leads que han contestat a l'outbound."
              count={loading ? 0 : repliesCount}
              icon={<MessageSquare className="h-5 w-5" />}
              tone="slate"
              href="/admin/growth/leads/replies"
            />
          </div>

          <div className="space-y-3">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Historic i seguiment</p>
            <div className="grid gap-4 md:grid-cols-2">
              <AdminEntryBox
                title="Contactats (Sense resposta)"
                description="Seguiment dels enviaments sense retorn."
                count={loading ? 0 : contactedCount}
                icon={<Clock3 className="h-5 w-5" />}
                tone="slate"
                href="/admin/growth/leads/contacted"
                size="small"
              />
              <AdminEntryBox
                title="Descartats"
                description="Leads fora del flux actiu."
                count={loading ? 0 : discardedCount}
                icon={<Trash2 className="h-5 w-5" />}
                tone="slate"
                href="/admin/growth/leads/discarded"
                size="small"
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          ) : null}
        </div>
      </div>

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
