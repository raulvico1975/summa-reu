'use client'

import { AlertCircle, CheckCircle2, Loader2, Mail, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import type { GrowthLeadRecord } from '@/lib/growth/types'

function contextText(lead: GrowthLeadRecord): string {
  const parts = [lead.context.summary, lead.context.mission, lead.context.painPoints].filter(Boolean) as string[]
  return parts.length ? parts.join('\n\n') : 'Sense context disponible.'
}

function statusLabel(status: GrowthLeadRecord['status']): string {
  if (status === 'pending_review') return 'Pendent de revisar'
  if (status === 'approved_for_sending') return 'Llest per enviar'
  if (status === 'contacted') return 'Contactat'
  if (status === 'replied') return 'Resposta rebuda'
  if (status === 'discarded') return 'Descartat'
  if (status === 'discovered') return 'Descobert'
  if (status === 'enriched') return 'Enriquit'
  return status
}

function outreachLabel(status: GrowthLeadRecord['outreach']['status']): string {
  if (status === 'none') return 'Sense esborrany'
  if (status === 'draft_ready') return 'Esborrany llest'
  if (status === 'sending') return 'Enviant'
  if (status === 'sent') return 'Enviat'
  if (status === 'send_failed') return 'Error d’enviament'
  return status
}

function sourceLabel(source: GrowthLeadRecord['source']): string {
  if (source === 'manual') return 'Manual'
  if (source === 'job') return 'IA'
  return 'Inbound'
}

export function ReviewDrawer({
  open,
  lead,
  subject,
  draftBody,
  onSubjectChange,
  onDraftBodyChange,
  onClose,
  onSaveDraft,
  onApproveAndSend,
  onDiscard,
  isSavingDraft,
  isApproving,
  isDiscarding,
}: {
  open: boolean
  lead: GrowthLeadRecord | null
  subject: string
  draftBody: string
  onSubjectChange: (value: string) => void
  onDraftBodyChange: (value: string) => void
  onClose: () => void
  onSaveDraft: () => void
  onApproveAndSend: () => void
  onDiscard: () => void
  isSavingDraft: boolean
  isApproving: boolean
  isDiscarding: boolean
}) {
  const openState = open && Boolean(lead)

  return (
    <Sheet open={openState} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent side="right" className="!flex !w-[min(100vw,600px)] !max-w-[600px] !overflow-hidden !bg-white !p-0">
        {lead ? (
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-slate-200 px-6 py-5 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
                  {statusLabel(lead.status)}
                </Badge>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                  {sourceLabel(lead.source)}
                </Badge>
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                  {outreachLabel(lead.outreach.status)}
                </Badge>
              </div>
              <div className="space-y-1">
                <SheetTitle className="text-2xl tracking-[-0.03em]">Revisar lead</SheetTitle>
                <SheetDescription className="break-all text-sm text-slate-500">
                  {lead.name} · {lead.website}
                </SheetDescription>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-5">
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <AlertCircle className="h-4 w-4 text-slate-500" />
                    Context
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                    <p className="whitespace-pre-wrap">{contextText(lead)}</p>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-4 space-y-1">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900">Edició</h2>
                    <p className="text-sm text-slate-500">Ajusta l&apos;assumpte i el cos abans d&apos;aprovar.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="growth-subject">Subject</Label>
                      <Input
                        id="growth-subject"
                        value={subject}
                        onChange={(event) => onSubjectChange(event.target.value)}
                        placeholder="Subject del correu"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="growth-body">Draft body</Label>
                      <Textarea
                        id="growth-body"
                        value={draftBody}
                        onChange={(event) => onDraftBodyChange(event.target.value)}
                        placeholder="Cos del missatge"
                        className="min-h-[320px] font-mono text-[13px] leading-6"
                      />
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white px-6 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  variant="destructive"
                  onClick={onDiscard}
                  disabled={isSavingDraft || isApproving || isDiscarding}
                >
                  {isDiscarding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Descarta
                </Button>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    onClick={onSaveDraft}
                    disabled={isSavingDraft || isApproving || isDiscarding}
                    className="border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                  >
                    {isSavingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    Guardar Esborrany
                  </Button>
                  <Button
                    onClick={onApproveAndSend}
                    disabled={isSavingDraft || isApproving || isDiscarding}
                    variant="outline"
                    className="!border-orange-500 !bg-orange-500 !text-white hover:!bg-orange-600 hover:!text-white"
                  >
                    {isApproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    APROVAR I ENVIAR
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
