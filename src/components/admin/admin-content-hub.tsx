'use client'

import { BookOpenText, Loader2, Megaphone, RefreshCw } from 'lucide-react'

import { AdminEntryBox } from '@/components/admin/admin-entry-box'
import { Button } from '@/components/ui/button'
import { useAdminSummary } from '@/hooks/useAdminSummary'

function formatRelativeTime(value: string | null): string | null {
  if (!value) return null

  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return null

  const deltaMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000))
  if (deltaMinutes < 1) return 'ara mateix'
  if (deltaMinutes < 60) return `fa ${deltaMinutes} min`

  const deltaHours = Math.floor(deltaMinutes / 60)
  if (deltaHours < 24) return `fa ${deltaHours} h`

  const deltaDays = Math.floor(deltaHours / 24)
  return `fa ${deltaDays} d`
}

export function AdminContentHub() {
  const { summary, loading, error, refresh } = useAdminSummary()

  const communicationSummary = summary?.communicationSummary
  const blogSummary = summary?.blogSummary
  const blogQueue = blogSummary?.queue
  const blogQueueOpenCount = (blogQueue?.draftReady ?? 0) + (blogQueue?.pendingApproval ?? 0) + (blogQueue?.approved ?? 0)
  const pendingUpdatesCount = communicationSummary?.pendingDrafts ?? 0
  const blogQueueLine = blogQueue?.available
    ? `Articles en cua editorial: ${blogQueueOpenCount}`
    : 'Cua editorial no connectada en aquest entorn'

  return (
    <div className="min-w-0 bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-[1480px] px-5 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              Blog i Novetats
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">Blog i Novetats</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Porta única d’entrada per al contingut visible. Des d’aquí entres a Blog o a Novetats, sense traduccions ni mòduls abstractes.
              </p>
            </div>
          </div>

          <Button variant="outline" onClick={() => void refresh()} disabled={loading} className="self-start">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualitzar
          </Button>
        </header>

        <div className="grid gap-4 xl:grid-cols-2">
          <AdminEntryBox
            href="/admin/contingut/blog"
            icon={<BookOpenText className="h-5 w-5" />}
            title="Blog"
            description="Articles públics i estat del pipeline editorial."
            count={blogQueueOpenCount}
            tone="orange"
            lines={[
              blogQueueLine,
              `Darrer article publicat: ${formatRelativeTime(blogSummary?.latestPublishedAt ?? null) ?? 'sense article recent'}`,
              blogQueue?.available ? `Pendents d'aprovació: ${blogQueue.pendingApproval}` : 'Sense cua editorial connectada en aquest entorn',
            ]}
          />

          <AdminEntryBox
            href="/admin/contingut/novetats"
            icon={<Megaphone className="h-5 w-5" />}
            title="Novetats"
            description="Propostes, esborranys i publicació de novetats visibles al web i a l’app."
            count={pendingUpdatesCount}
            tone="purple"
            lines={[
              `Propostes pendents: ${pendingUpdatesCount}`,
              `Darrera novetat publicada: ${formatRelativeTime(communicationSummary?.latestPublishedAt ?? null) ?? 'sense novetat recent'}`,
              `${communicationSummary?.latestPublished.length ?? 0} novetat${(communicationSummary?.latestPublished.length ?? 0) === 1 ? '' : 's'} recent${(communicationSummary?.latestPublished.length ?? 0) === 1 ? '' : 's'} carregada${(communicationSummary?.latestPublished.length ?? 0) === 1 ? '' : 'es'}`,
            ]}
          />
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  )
}
