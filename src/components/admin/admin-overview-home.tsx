'use client'

import { AlertCircle, BookOpenText, Building2, Inbox, Loader2, RefreshCw } from 'lucide-react'

import { AdminEntryBox } from '@/components/admin/admin-entry-box'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

function SummaryLine({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <span className="text-right text-sm font-semibold text-slate-900">{value}</span>
    </div>
  )
}

export function AdminOverviewHome() {
  const { summary, loading, error, refresh } = useAdminSummary()

  const entities = summary?.entities ?? []
  const activeEntitiesCount = entities.filter((entity) => entity.status === 'active').length
  const pendingEntitiesCount = entities.filter((entity) => entity.status === 'pending').length
  const suspendedEntitiesCount = entities.filter((entity) => entity.status === 'suspended').length
  const incidentsCount = summary?.globalStatus.cards.find((card) => card.id === 'incidents')?.count ?? 0

  const growthSummary = summary?.growthSummary
  const communicationSummary = summary?.communicationSummary
  const blogSummary = summary?.blogSummary

  const blogQueueOpenCount =
    (blogSummary?.queue?.draftReady ?? 0) +
    (blogSummary?.queue?.pendingApproval ?? 0) +
    (blogSummary?.queue?.approved ?? 0)
  const blogQueueSummaryText = blogSummary?.queue?.available
    ? `${blogQueueOpenCount} article${blogQueueOpenCount === 1 ? '' : 's'} de blog en cua`
    : 'blog sense cua editorial connectada'

  return (
    <div className="min-w-0 bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-[1480px] px-5 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              Vista general
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">Panell Admin</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Resum informatiu del que està viu ara mateix a CRM, blog i novetats, entitats i incidències.
              </p>
            </div>
          </div>

          <Button variant="outline" onClick={() => void refresh()} disabled={loading} className="self-start">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualitzar
          </Button>
        </header>

        <div className="space-y-6">
          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl tracking-[-0.03em]">Resum informatiu</CardTitle>
              <CardDescription>Llegit en llenguatge humà, sense dir-te què has de fer.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 lg:grid-cols-2">
              {loading ? (
                <div className="col-span-full flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregant resum...
                </div>
              ) : (
                <>
                  <SummaryLine
                    label="CRM / Leads"
                    value={
                      growthSummary
                        ? `${growthSummary.pendingReview} per revisar · ${growthSummary.replies} resposta${growthSummary.replies === 1 ? '' : 's'} nova${growthSummary.replies === 1 ? '' : 'es'}`
                        : 'Sense dades'
                    }
                  />
                  <SummaryLine
                    label="Blog i Novetats"
                    value={
                      communicationSummary
                        ? `${communicationSummary.pendingDrafts} proposta${communicationSummary.pendingDrafts === 1 ? '' : 's'} de novetats · ${blogQueueSummaryText}`
                        : 'Sense dades'
                    }
                  />
                  <SummaryLine
                    label="Entitats"
                    value={`${pendingEntitiesCount} pendent${pendingEntitiesCount === 1 ? '' : 's'} · ${suspendedEntitiesCount} suspesa${suspendedEntitiesCount === 1 ? '' : 's'}`}
                  />
                  <SummaryLine
                    label="Incidències"
                    value={`${incidentsCount} oberta${incidentsCount === 1 ? '' : 'es'} · KB ${formatRelativeTime(summary?.kbBotSummary.kbUpdatedAt ?? null) ?? 'sense data'}`}
                  />
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <AdminEntryBox
              href="/admin/growth/leads"
              icon={<Inbox className="h-5 w-5" />}
              title="CRM / Leads"
              count={(growthSummary?.pendingReview ?? 0) + (growthSummary?.replies ?? 0)}
              tone="orange"
              description={
                growthSummary
                  ? `${growthSummary.pendingReview} per revisar, ${growthSummary.approvedReady} preparats per enviar i ${growthSummary.replies} respostes rebudes.`
                  : 'Sense dades de CRM.'
              }
              lines={[
                `Pendents de revisió: ${growthSummary?.pendingReview ?? 0}`,
                `Preparats per enviar: ${growthSummary?.approvedReady ?? 0}`,
                growthSummary && growthSummary.errors > 0
                  ? `${growthSummary.errors} error${growthSummary.errors === 1 ? '' : 's'} d'enviament`
                  : `Última resposta: ${formatRelativeTime(growthSummary?.latestReplyAt ?? null) ?? 'sense resposta recent'}`,
              ]}
            />

            <AdminEntryBox
              href="/admin/contingut"
              icon={<BookOpenText className="h-5 w-5" />}
              title="Blog i Novetats"
              count={(communicationSummary?.pendingDrafts ?? 0) + blogQueueOpenCount}
              tone="purple"
              description={
                communicationSummary
                  ? `${communicationSummary.pendingDrafts} proposta${communicationSummary.pendingDrafts === 1 ? '' : 's'} de novetats pendents i ${blogSummary?.queue?.available ? `${blogQueueOpenCount} article${blogQueueOpenCount === 1 ? '' : 's'} de blog en pipeline.` : 'el blog sense cua editorial connectada en aquest entorn.'}`
                  : 'Sense dades de contingut.'
              }
              lines={[
                `Novetats pendents: ${communicationSummary?.pendingDrafts ?? 0}`,
                `Darrera novetat publicada: ${formatRelativeTime(communicationSummary?.latestPublishedAt ?? null) ?? 'sense novetat recent'}`,
                `Darrer article publicat: ${formatRelativeTime(blogSummary?.latestPublishedAt ?? null) ?? 'sense article recent'}`,
              ]}
            />

            <AdminEntryBox
              href="/admin/entitats"
              icon={<Building2 className="h-5 w-5" />}
              title="Entitats"
              count={pendingEntitiesCount + suspendedEntitiesCount}
              tone="blue"
              description={`${activeEntitiesCount} actives, ${pendingEntitiesCount} pendents i ${suspendedEntitiesCount} suspeses.`}
              lines={[
                `Entitats actives: ${activeEntitiesCount}`,
                `Pendents d'alta: ${pendingEntitiesCount}`,
                `Suspeses: ${suspendedEntitiesCount}`,
              ]}
            />

            <AdminEntryBox
              href="/admin/manteniment"
              icon={<AlertCircle className="h-5 w-5" />}
              title="Incidències"
              count={incidentsCount}
              tone="slate"
              description={`${incidentsCount} incidència${incidentsCount === 1 ? '' : 's'} oberta${incidentsCount === 1 ? '' : 'es'} i ${summary?.kbBotSummary.botTodayQuestions ?? 0} consultes al bot avui.`}
              lines={[
                `Avisos tècnics oberts: ${incidentsCount}`,
                `Consultes al bot avui: ${summary?.kbBotSummary.botTodayQuestions ?? 0}`,
                `KB actualitzada: ${formatRelativeTime(summary?.kbBotSummary.kbUpdatedAt ?? null) ?? 'sense data'}`,
              ]}
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
