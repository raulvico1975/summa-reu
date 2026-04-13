'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { GrowthLeadRecord } from '@/lib/growth/types'
import { ExternalLink, FileText, Inbox, MessageSquareText, Sparkles, TriangleAlert, User } from 'lucide-react'

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

function formatContextNote(lead: GrowthLeadRecord): string {
  const parts = [lead.context.summary, lead.context.mission, lead.context.painPoints].filter(Boolean) as string[]
  if (!parts.length) return 'Sense context encara.'

  const joined = parts.join(' · ').replace(/\s+/g, ' ').trim()
  return joined.length > 160 ? `${joined.slice(0, 157)}...` : joined
}

function formatResponsePreview(lead: GrowthLeadRecord): string {
  const message = lead.inbound.lastMessage?.trim().replace(/\s+/g, ' ') ?? ''
  if (!message) return 'Resposta rebuda, però encara no hi ha text disponible.'

  return message.length > 240 ? `${message.slice(0, 237)}...` : message
}

function statusLabel(lead: GrowthLeadRecord): string {
  if (lead.outreach.status === 'send_failed') return 'Error d’enviament'
  if (lead.status === 'pending_review') return 'Pendent de revisar'
  if (lead.status === 'approved_for_sending') return 'Llest per enviar'
  if (lead.status === 'contacted') return 'Contactat'
  if (lead.status === 'replied') return 'Resposta rebuda'
  if (lead.status === 'discarded') return 'Descartat'
  if (lead.status === 'discovered') return 'Descobert'
  if (lead.status === 'enriched') return 'Enriquit'
  return lead.status
}

function statusVariant(
  lead: GrowthLeadRecord
): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' {
  if (lead.outreach.status === 'send_failed') return 'destructive'
  if (lead.status === 'approved_for_sending' || lead.status === 'replied') return 'success'
  if (lead.status === 'contacted') return 'secondary'
  if (lead.status === 'discarded') return 'destructive'
  return 'outline'
}

function statusBadgeClass(lead: GrowthLeadRecord): string {
  if (lead.outreach.status === 'send_failed') return 'border-red-200 bg-red-50 text-red-600'
  if (lead.status === 'pending_review') return 'border-orange-100 bg-orange-50 text-orange-600'
  if (lead.status === 'approved_for_sending') return 'border-emerald-100 bg-emerald-50 text-emerald-700'
  if (lead.status === 'contacted') return 'border-slate-200 bg-slate-100 text-slate-600'
  if (lead.status === 'replied') return 'border-emerald-200 bg-emerald-100 text-emerald-700'
  if (lead.status === 'discarded') return 'border-rose-100 bg-rose-50 text-rose-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function actionLabel(lead: GrowthLeadRecord): string {
  if (lead.outreach.status === 'send_failed') return 'Reintentar'
  if (lead.status === 'replied') return 'Respondre'
  if (lead.status === 'contacted') return 'Respondre'
  if (lead.status === 'approved_for_sending') return 'Veure cua'
  return 'Revisar'
}

function actionButtonClass(lead: GrowthLeadRecord): string {
  if (lead.outreach.status === 'send_failed') {
    return '!border-red-200 !bg-red-600 !text-white hover:!bg-red-700 hover:!text-white'
  }

  if (lead.status === 'replied') {
    return '!border-emerald-500 !bg-emerald-500 !text-white hover:!bg-emerald-600 hover:!text-white'
  }

  if (lead.status === 'contacted') {
    return '!border-slate-200 !bg-slate-50 !text-slate-700 hover:!bg-slate-100 hover:!text-slate-900'
  }

  if (lead.status === 'approved_for_sending') {
    return '!border-slate-200 !bg-white !text-slate-900 hover:!bg-slate-50 hover:!text-slate-950'
  }

  if (lead.status === 'discarded') {
    return '!border-rose-200 !bg-rose-50 !text-rose-700 hover:!bg-rose-100 hover:!text-rose-800'
  }

  return '!border-slate-950 !bg-slate-950 !text-white hover:!bg-slate-800 hover:!text-white'
}

function sourceIcon(source: GrowthLeadRecord['source']) {
  if (source === 'manual') return <User className="h-3.5 w-3.5" />
  if (source === 'job') return <Sparkles className="h-3.5 w-3.5" />
  return <Inbox className="h-3.5 w-3.5" />
}

function outreachIcon(lead: GrowthLeadRecord) {
  if (lead.outreach.status === 'send_failed') return <TriangleAlert className="h-3.5 w-3.5" />
  if (lead.outreach.status === 'none') return null
  return <FileText className="h-3.5 w-3.5" />
}

function iconChipClass(kind: 'source' | 'draft' | 'error') {
  if (kind === 'source') return 'border-slate-200 bg-slate-50 text-slate-500'
  if (kind === 'draft') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-red-200 bg-red-50 text-red-600'
}

export function LeadCard({
  lead,
  onReview,
}: {
  lead: GrowthLeadRecord
  onReview: (lead: GrowthLeadRecord) => void
}) {
  const showResponsePreview = lead.status === 'replied'
  const showErrorPreview = lead.outreach.status === 'send_failed'

  return (
      <article
      className={[
        'group rounded-xl border px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
        showErrorPreview
          ? 'border-red-200 bg-red-50/60 hover:border-red-300'
          : showResponsePreview
            ? 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-300'
            : 'border-slate-200 bg-white hover:border-slate-300',
      ].join(' ')}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.4fr)_auto] md:items-start">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold text-slate-950">{lead.name}</h3>
              <a
                href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 truncate text-xs text-slate-500 underline-offset-4 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {lead.website}
              </a>
            </div>
            <Badge
              variant={statusVariant(lead)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${statusBadgeClass(lead)}`}
            >
              {statusLabel(lead)}
            </Badge>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-[10px] font-semibold uppercase tracking-widest ${iconChipClass('source')}`}
              title={lead.source === 'manual' ? 'Manual' : lead.source === 'job' ? 'IA' : 'Inbound'}
              aria-label={lead.source === 'manual' ? 'Manual' : lead.source === 'job' ? 'IA' : 'Inbound'}
            >
              {sourceIcon(lead.source)}
            </span>

            {lead.outreach.status !== 'none' ? (
              <span
                className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-[10px] font-semibold uppercase tracking-widest ${
                  lead.outreach.status === 'send_failed' ? iconChipClass('error') : iconChipClass('draft')
                }`}
                title={lead.outreach.status === 'send_failed' ? 'Error' : 'Draft'}
                aria-label={lead.outreach.status === 'send_failed' ? 'Error' : 'Draft'}
              >
                {outreachIcon(lead)}
              </span>
            ) : null}
          </div>
        </div>

        <div
          className={[
            'rounded-2xl border px-4 py-3 text-sm leading-6',
            showErrorPreview
              ? 'border-red-200 bg-red-50/70 text-red-950 shadow-sm'
              : showResponsePreview
                ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950 shadow-sm'
                : 'border-slate-200 bg-slate-50 text-slate-500',
          ].join(' ')}
        >
          {showResponsePreview ? (
            <>
              <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                <MessageSquareText className="h-3.5 w-3.5" />
                Resposta rebuda
              </div>
              <p className="line-clamp-3 font-medium italic">{formatResponsePreview(lead)}</p>
              {lead.inbound.lastMessageAt ? (
                <p className="mt-1 text-[11px] font-medium text-emerald-700">
                  Rebut {formatRelativeTime(lead.inbound.lastMessageAt)}
                </p>
              ) : null}
            </>
          ) : showErrorPreview ? (
            <>
              <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-red-700">
                <TriangleAlert className="h-3.5 w-3.5" />
                Error d'enviament
              </div>
              <p className="line-clamp-3 font-medium italic">{lead.outreach.lastError}</p>
              <p className="mt-1 text-[11px] font-medium text-red-700">Cal reintentar o revisar la cua.</p>
            </>
          ) : (
            <p className="line-clamp-3 italic">{formatContextNote(lead)}</p>
          )}
        </div>

        <div className="flex items-start justify-end md:pt-1">
          <Button size="sm" onClick={() => onReview(lead)} variant="outline" className={actionButtonClass(lead)}>
            {actionLabel(lead)}
          </Button>
        </div>
      </div>
    </article>
  )
}
