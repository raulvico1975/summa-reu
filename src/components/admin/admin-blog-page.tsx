'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  Edit3,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Rocket,
  Sparkles,
  Trash2,
  WandSparkles,
} from 'lucide-react'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useAdminBlogDraftActions } from '@/hooks/useAdminBlogDraftActions'
import { useAdminBlogDrafts } from '@/hooks/useAdminBlogDrafts'
import type { NativeBlogPost } from '@/lib/editorial-native/types'

type DraftFormState = {
  title: string
  slug: string
  seoTitle: string
  metaDescription: string
  excerpt: string
  contentMarkdown: string
  category: string
  tagsText: string
  coverImageUrl: string
  coverImageAlt: string
  imagePrompt: string
}

type GenerateFormState = {
  prompt: string
}

type StatusSection = {
  key: string
  title: string
  description: string
  statuses: NativeBlogPost['status'][]
  accent: string
}

const STATUS_SECTIONS: StatusSection[] = [
  {
    key: 'idea',
    title: 'Idees',
    description: 'Peces encara sense draft final.',
    statuses: ['idea'],
    accent: 'border-slate-200',
  },
  {
    key: 'draft_ready',
    title: 'Drafts llestos',
    description: 'Ja tenen contingut generat i es poden revisar.',
    statuses: ['draft_ready'],
    accent: 'border-blue-200',
  },
  {
    key: 'approved',
    title: 'Aprovats',
    description: 'Peces validades i a punt per publicar.',
    statuses: ['approved'],
    accent: 'border-emerald-200',
  },
  {
    key: 'published',
    title: 'Publicats',
    description: 'Ja visibles al blog públic.',
    statuses: ['published'],
    accent: 'border-green-200',
  },
  {
    key: 'publish_failed',
    title: 'Errors de publicació',
    description: 'Peces que han fallat i necessiten revisió.',
    statuses: ['publish_failed'],
    accent: 'border-rose-200',
  },
  {
    key: 'discarded',
    title: 'Descartats',
    description: 'Peces que s’han descartat o arxivat.',
    statuses: ['discarded'],
    accent: 'border-slate-200',
  },
]

function asTrimmed(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

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

function formatDate(value: string | null): string {
  if (!value) return 'sense data'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'sense data'

  return date.toLocaleDateString('ca-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function statusLabel(status: NativeBlogPost['status']): string {
  if (status === 'idea') return 'Idea'
  if (status === 'draft_ready') return 'Draft llest'
  if (status === 'approved') return 'Aprovat'
  if (status === 'published') return 'Publicat'
  if (status === 'publish_failed') return 'Error de publicació'
  if (status === 'discarded') return 'Descartat'
  return status
}

function statusBadgeClass(status: NativeBlogPost['status']): string {
  if (status === 'idea') return 'border-slate-200 bg-slate-50 text-slate-700'
  if (status === 'draft_ready') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (status === 'approved') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'published') return 'border-green-200 bg-green-50 text-green-700'
  if (status === 'publish_failed') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (status === 'discarded') return 'border-slate-200 bg-slate-100 text-slate-600'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

function sourceLabel(source: NativeBlogPost['source']): string {
  if (source === 'manual') return 'Manual'
  if (source === 'calendar') return 'Calendari'
  return 'IA'
}

function verdictLabel(verdict: NativeBlogPost['context']['validationVerdict']): string | null {
  if (verdict === 'publishable') return 'Publicable'
  if (verdict === 'publishable_with_edits') return 'Publicable amb retocs'
  if (verdict === 'not_publishable') return 'No publicable'
  return null
}

function verdictBadgeClass(verdict: NativeBlogPost['context']['validationVerdict']): string {
  if (verdict === 'publishable') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (verdict === 'publishable_with_edits') return 'border-violet-200 bg-violet-50 text-violet-700'
  if (verdict === 'not_publishable') return 'border-rose-200 bg-rose-50 text-rose-700'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

function buildDraftForm(post: NativeBlogPost): DraftFormState {
  return {
    title: asTrimmed(post.draft.title),
    slug: asTrimmed(post.draft.slug),
    seoTitle: asTrimmed(post.draft.seoTitle),
    metaDescription: asTrimmed(post.draft.metaDescription),
    excerpt: asTrimmed(post.draft.excerpt),
    contentMarkdown: asTrimmed(post.draft.contentMarkdown),
    category: asTrimmed(post.draft.category) || 'criteri-operatiu',
    tagsText: (post.draft.tags ?? []).join(', '),
    coverImageUrl: asTrimmed(post.draft.coverImageUrl),
    coverImageAlt: asTrimmed(post.draft.coverImageAlt),
    imagePrompt: asTrimmed(post.draft.imagePrompt),
  }
}

function buildGenerateForm(): GenerateFormState {
  return {
    prompt: '',
  }
}

function buildUpdateDraftPayload(form: DraftFormState) {
  return {
    title: form.title,
    slug: form.slug,
    seoTitle: form.seoTitle,
    metaDescription: form.metaDescription,
    excerpt: form.excerpt,
    contentMarkdown: form.contentMarkdown,
    category: form.category,
    tags: form.tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    coverImageUrl: form.coverImageUrl || null,
    coverImageAlt: form.coverImageAlt || null,
    imagePrompt: form.imagePrompt || null,
  }
}

function postTitle(post: NativeBlogPost): string {
  return asTrimmed(post.draft.title) || asTrimmed(post.idea.prompt) || 'Nou article'
}

function postExcerpt(post: NativeBlogPost): string {
  return (
    asTrimmed(post.draft.excerpt) ||
    asTrimmed(post.idea.problem) ||
    asTrimmed(post.idea.objective) ||
    asTrimmed(post.draft.contentMarkdown) ||
    'Sense resum disponible.'
  )
}

function postMeta(post: NativeBlogPost): string {
  const parts = [post.draft.category, formatRelativeTime(post.updatedAt)]
    .filter(Boolean)
    .map((part) => asTrimmed(part as string))
    .filter(Boolean)
  return parts.join(' · ')
}

function DraftCard({
  post,
  busy,
  locked,
  onEdit,
  onApprove,
  onPublish,
  onUnpublish,
}: {
  post: NativeBlogPost
  busy: boolean
  locked: boolean
  onEdit: (post: NativeBlogPost) => void
  onApprove: (postId: string) => void
  onPublish: (postId: string) => void
  onUnpublish: (postId: string) => void
}) {
  const canApprove = post.status === 'idea' || post.status === 'draft_ready'
  const canPublish = post.status === 'approved' || post.status === 'publish_failed'
  const canUnpublish = post.status === 'published'

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={statusBadgeClass(post.status)}>
              {statusLabel(post.status)}
            </Badge>
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">{postTitle(post)}</h3>
            <p className="text-sm text-slate-500">{postMeta(post) || 'Sense metadades encara'}</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            <p className="line-clamp-2 whitespace-pre-wrap">{postExcerpt(post)}</p>
          </div>

          {post.review.lastError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Error
              </div>
              <p className="text-sm">{post.review.lastError}</p>
            </div>
          ) : null}

          {post.context.reviewNotes.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <FileText className="h-4 w-4" />
                Cal revisar
              </div>
              <p>{post.context.reviewNotes[0]}</p>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2 lg:w-[220px]">
          <Button variant="outline" onClick={() => onEdit(post)} className="justify-start rounded-full">
            <Edit3 className="mr-2 h-4 w-4" />
            Editar
          </Button>

          {canApprove ? (
            <Button
              onClick={() => onApprove(post.id)}
              disabled={locked}
              className="justify-start rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Aprovar
            </Button>
          ) : null}

          {canPublish ? (
            <Button
              onClick={() => onPublish(post.id)}
              disabled={locked}
              className="justify-start rounded-full bg-slate-950 text-white hover:bg-slate-800"
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
              Publicar
            </Button>
          ) : null}

          {canUnpublish ? (
            <Button
              variant="outline"
              onClick={() => onUnpublish(post.id)}
              disabled={locked}
              className="justify-start rounded-full border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowLeft className="mr-2 h-4 w-4" />}
              Despublicar
            </Button>
          ) : null}

          {post.review.publishedUrl ? (
            <Button asChild variant="ghost" className="justify-start rounded-full text-slate-600 hover:text-slate-900">
              <Link href={post.review.publishedUrl} target="_blank" rel="noreferrer">
                <ChevronRight className="mr-2 h-4 w-4" />
                Veure publicat
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function GenerateDraftModal({
  open,
  onOpenChange,
  form,
  onFormChange,
  onGenerate,
  isGenerating,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: GenerateFormState
  onFormChange: (next: GenerateFormState) => void
  onGenerate: () => void
  isGenerating: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-2xl tracking-[-0.03em]">Generar peça nativa</DialogTitle>
            <DialogDescription>
              Escriu el tema del post. Et prepararem una primera base editable perquè la puguis revisar i adaptar abans de publicar-la.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="native-prompt">Tema o angle</Label>
            <Textarea
              id="native-prompt"
              value={form.prompt}
              onChange={(event) => onFormChange({ ...form, prompt: event.target.value })}
              placeholder="Ex: Com conciliar cobraments de Stripe sense perdre el detall de cada aportació"
              className="min-h-[140px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancel·lar
          </Button>
          <Button
            onClick={onGenerate}
            disabled={isGenerating || !form.prompt.trim()}
            className="bg-violet-600 text-white hover:bg-violet-700"
          >
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
            Generar peça
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BlogDraftEditor({
  open,
  post,
  form,
  onFormChange,
  onClose,
  onSave,
  onGenerateCover,
  onApprove,
  onPublish,
  onUnpublish,
  onDiscard,
  isBusy,
}: {
  open: boolean
  post: NativeBlogPost | null
  form: DraftFormState | null
  onFormChange: (next: DraftFormState) => void
  onClose: () => void
  onSave: () => void
  onGenerateCover: () => void
  onApprove: () => void
  onPublish: () => void
  onUnpublish: () => void
  onDiscard: () => void
  isBusy: boolean
}) {
  const canApprove = post ? post.status === 'idea' || post.status === 'draft_ready' : false
  const canPublish = post ? post.status === 'approved' || post.status === 'publish_failed' : false
  const canUnpublish = post ? post.status === 'published' : false

  return (
    <Sheet open={open && Boolean(post) && Boolean(form)} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent side="right" className="!w-[min(100vw,920px)] !max-w-[920px] !overflow-hidden !p-0">
        {post && form ? (
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-slate-200 px-6 py-5 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={statusBadgeClass(post.status)}>
                  {statusLabel(post.status)}
                </Badge>
                {post.context.validationVerdict ? (
                  <Badge variant="outline" className={verdictBadgeClass(post.context.validationVerdict)}>
                    {verdictLabel(post.context.validationVerdict)}
                  </Badge>
                ) : null}
              </div>

              <div className="space-y-1">
                <SheetTitle className="text-2xl tracking-[-0.03em]">{postTitle(post)}</SheetTitle>
                <SheetDescription className="text-sm text-slate-500">
                  {asTrimmed(post.idea.prompt) || 'Sense idea inicial'}
                </SheetDescription>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-6">
                {post.context.reviewNotes.length > 0 ? (
                  <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-900">
                      <FileText className="h-4 w-4" />
                      Notes de revisió
                    </div>
                    <ul className="space-y-2 text-sm text-amber-900">
                      {post.context.reviewNotes.map((note) => (
                        <li key={note} className="rounded-xl border border-amber-200 bg-white px-3 py-2">
                          {note}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {post.review.lastError ? (
                  <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                    <div className="mb-2 flex items-center gap-2 font-semibold">
                      <AlertTriangle className="h-4 w-4" />
                      Error actual
                    </div>
                    <p>{post.review.lastError}</p>
                  </section>
                ) : null}

                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <FileText className="h-4 w-4 text-slate-500" />
                    Contingut
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="native-title">Títol</Label>
                      <Input
                        id="native-title"
                        value={form.title}
                        onChange={(event) => onFormChange({ ...form, title: event.target.value })}
                        placeholder="Títol del post"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="native-excerpt">Resum</Label>
                      <Textarea
                        id="native-excerpt"
                        value={form.excerpt}
                        onChange={(event) => onFormChange({ ...form, excerpt: event.target.value })}
                        className="min-h-[88px]"
                        placeholder="Resum curt"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="native-markdown">Text del post</Label>
                      <Textarea
                        id="native-markdown"
                        value={form.contentMarkdown}
                        onChange={(event) => onFormChange({ ...form, contentMarkdown: event.target.value })}
                        className="min-h-[360px] font-mono text-[13px] leading-6"
                        placeholder="# Títol\n\nText..."
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <WandSparkles className="h-4 w-4 text-slate-500" />
                    Portada
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        {form.coverImageUrl ? (
                          <img
                            src={form.coverImageUrl}
                            alt={form.coverImageAlt || form.title || 'Portada del blog'}
                            className="h-auto w-full rounded-xl border border-slate-200 bg-white object-contain"
                          />
                        ) : (
                          <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-400">
                            Encara no hi ha portada generada
                          </div>
                        )}
                      </div>
                      <Button variant="outline" onClick={onGenerateCover} disabled={isBusy} className="rounded-full">
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generar portada
                      </Button>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="native-cover-image-alt">Text alternatiu</Label>
                        <Input
                          id="native-cover-image-alt"
                          value={form.coverImageAlt}
                          onChange={(event) => onFormChange({ ...form, coverImageAlt: event.target.value })}
                          placeholder="Text breu de la portada"
                        />
                      </div>
                      <p className="text-sm leading-6 text-slate-500">
                        Si no tens una portada bona, la pots generar i després ajustar només aquest text.
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                  <Accordion type="single" collapsible>
                    <AccordionItem value="seo" className="border-b border-slate-200">
                      <AccordionTrigger className="py-1 text-sm font-semibold text-slate-900 hover:no-underline">
                        SEO i URL
                      </AccordionTrigger>
                      <AccordionContent className="pt-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="native-slug">Slug</Label>
                            <Input
                              id="native-slug"
                              value={form.slug}
                              onChange={(event) => onFormChange({ ...form, slug: event.target.value })}
                              placeholder="slug-url-safe"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="native-category">Categoria</Label>
                            <Input
                              id="native-category"
                              value={form.category}
                              onChange={(event) => onFormChange({ ...form, category: event.target.value })}
                              placeholder="criteri-operatiu"
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="native-tags">Tags</Label>
                            <Input
                              id="native-tags"
                              value={form.tagsText}
                              onChange={(event) => onFormChange({ ...form, tagsText: event.target.value })}
                              placeholder="tag1, tag2"
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="native-seo-title">SEO title</Label>
                            <Input
                              id="native-seo-title"
                              value={form.seoTitle}
                              onChange={(event) => onFormChange({ ...form, seoTitle: event.target.value })}
                              placeholder="Títol SEO"
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="native-meta-description">Meta description</Label>
                            <Textarea
                              id="native-meta-description"
                              value={form.metaDescription}
                              onChange={(event) => onFormChange({ ...form, metaDescription: event.target.value })}
                              className="min-h-[88px]"
                              placeholder="Meta description"
                            />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="internal" className="border-b-0">
                      <AccordionTrigger className="py-1 text-sm font-semibold text-slate-900 hover:no-underline">
                        Detall intern
                      </AccordionTrigger>
                      <AccordionContent className="pt-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <Card className="rounded-2xl border-slate-200 shadow-sm">
                            <CardHeader className="pb-2">
                              <CardDescription>Origen editorial</CardDescription>
                              <CardTitle className="text-lg">{sourceLabel(post.source)}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 pt-0 text-sm text-slate-600">
                              <p>Creat: {formatDate(post.createdAt)}</p>
                              <p>Actualitzat: {formatDate(post.updatedAt)}</p>
                              <p>Publicat: {formatDate(post.review.publishedAt)}</p>
                            </CardContent>
                          </Card>

                          <Card className="rounded-2xl border-slate-200 shadow-sm">
                            <CardHeader className="pb-2">
                              <CardDescription>Motor i validació</CardDescription>
                              <CardTitle className="text-lg">
                                {post.context.llmApplied ? post.context.model || 'LLM' : 'Mode de continuïtat'}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 pt-0 text-sm text-slate-600">
                              <p>{post.context.llmApplied ? 'Generació LLM aplicada' : 'Mode de continuïtat / fallback'}</p>
                              <p>{post.context.validationVerdict ? verdictLabel(post.context.validationVerdict) : 'Sense veredicte'}</p>
                              <p>{post.context.kbAvailable ? `KB disponible · ${post.context.kbRefs.length} refs` : 'KB no detectada'}</p>
                            </CardContent>
                          </Card>

                          <Card className="rounded-2xl border-slate-200 shadow-sm md:col-span-2">
                            <CardHeader className="pb-2">
                              <CardDescription>Traducció i portada</CardDescription>
                              <CardTitle className="text-lg">
                                {post.draft.translations?.es ? 'Disponible' : 'No generada'}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 pt-0 text-sm text-slate-600">
                              <div className="space-y-2">
                                <Label htmlFor="native-image-prompt">Prompt d'imatge</Label>
                                <Textarea
                                  id="native-image-prompt"
                                  value={form.imagePrompt}
                                  onChange={(event) => onFormChange({ ...form, imagePrompt: event.target.value })}
                                  className="min-h-[92px]"
                                  placeholder="Prompt per a la portada"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="native-cover-image-url">Cover image URL</Label>
                                <Input
                                  id="native-cover-image-url"
                                  value={form.coverImageUrl}
                                  onChange={(event) => onFormChange({ ...form, coverImageUrl: event.target.value })}
                                  placeholder="https://..."
                                />
                              </div>
                              {post.draft.translations?.es ? (
                                <>
                                  <p className="font-medium text-slate-900">{post.draft.translations.es.title}</p>
                                  <p>{post.draft.translations.es.excerpt}</p>
                                </>
                              ) : (
                                <p>Quan es publiqui, el sistema intentarà generar-la i guardar-la al mateix registre.</p>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </section>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white px-6 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  variant="destructive"
                  onClick={onDiscard}
                  disabled={isBusy || post.status === 'published'}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Descarta
                </Button>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="outline" onClick={onSave} disabled={isBusy} className="border-slate-300">
                    <Edit3 className="mr-2 h-4 w-4" />
                    Guardar esborrany
                  </Button>
                  {canApprove ? (
                    <Button onClick={onApprove} disabled={isBusy} className="bg-emerald-600 text-white hover:bg-emerald-700">
                      <Check className="mr-2 h-4 w-4" />
                      Aprovar
                    </Button>
                  ) : null}
                  {canPublish ? (
                    <Button onClick={onPublish} disabled={isBusy} className="bg-slate-950 text-white hover:bg-slate-800">
                      <Rocket className="mr-2 h-4 w-4" />
                      Publicar
                    </Button>
                  ) : null}
                  {canUnpublish ? (
                    <Button
                      variant="outline"
                      onClick={onUnpublish}
                      disabled={isBusy}
                      className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Despublicar
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

export function AdminBlogPage() {
  const { toast } = useToast()
  const { posts, loading, error, refresh } = useAdminBlogDrafts()
  const { pendingId, generatePost, updateDraft, approvePost, generateCover, publishPost, unpublishPost, discardPost } =
    useAdminBlogDraftActions()

  const [isGenerateOpen, setIsGenerateOpen] = React.useState(false)
  const [generateForm, setGenerateForm] = React.useState<GenerateFormState>(buildGenerateForm())
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editorPost, setEditorPost] = React.useState<NativeBlogPost | null>(null)
  const [draftForm, setDraftForm] = React.useState<DraftFormState | null>(null)

  const sections = React.useMemo(
    () =>
      STATUS_SECTIONS.map((section) => ({
        ...section,
        items: posts.filter((post) => section.statuses.includes(post.status)),
      })),
    [posts]
  )

  const counts = React.useMemo(
    () => ({
      draftReady: posts.filter((post) => post.status === 'draft_ready').length,
      approved: posts.filter((post) => post.status === 'approved').length,
      published: posts.filter((post) => post.status === 'published').length,
      errors: posts.filter((post) => post.status === 'publish_failed').length,
    }),
    [posts]
  )

  const latestUpdate = posts[0]?.updatedAt ?? null

  const isBusy = pendingId !== null

  const openEditor = React.useCallback((post: NativeBlogPost) => {
    setEditorPost(post)
    setDraftForm(buildDraftForm(post))
    setEditorOpen(true)
  }, [])

  const closeEditor = React.useCallback(() => {
    setEditorOpen(false)
    setEditorPost(null)
    setDraftForm(null)
  }, [])

  const refreshWithToast = React.useCallback(async () => {
    await refresh()
  }, [refresh])

  const notifySuccess = React.useCallback(
    async (message: string) => {
      toast({
        title: 'Blog natiu actualitzat',
        description: message,
      })
      await refreshWithToast()
    },
    [refreshWithToast, toast]
  )

  const handleGenerate = React.useCallback(async () => {
    try {
      const result = await generatePost({
        prompt: generateForm.prompt.trim(),
      })

      setIsGenerateOpen(false)
      setGenerateForm(buildGenerateForm())
      setEditorPost(result.result.post)
      setDraftForm(buildDraftForm(result.result.post))
      setEditorOpen(true)

      await notifySuccess(result.message)
    } catch (cause) {
      toast({
        variant: 'destructive',
        title: 'No s’ha pogut generar la peça',
        description: (cause as Error).message || 'Error desconegut',
      })
    }
  }, [generateForm.prompt, generatePost, notifySuccess, toast])

  const handleSaveDraft = React.useCallback(async () => {
    if (!editorPost || !draftForm) return

    try {
      const result = await updateDraft(editorPost.id, buildUpdateDraftPayload(draftForm))

      setEditorPost(result.result.post)
      setDraftForm(buildDraftForm(result.result.post))
      await notifySuccess(result.message)
    } catch (cause) {
      toast({
        variant: 'destructive',
        title: 'No s’ha pogut guardar el draft',
        description: (cause as Error).message || 'Error desconegut',
      })
    }
  }, [draftForm, editorPost, notifySuccess, toast, updateDraft])

  const handleApprove = React.useCallback(async () => {
    if (!editorPost) return

    try {
      const result = await approvePost(editorPost.id)

      setEditorPost(result.result.post)
      setDraftForm(buildDraftForm(result.result.post))
      await notifySuccess(result.message)
    } catch (cause) {
      toast({
        variant: 'destructive',
        title: 'No s’ha pogut aprovar',
        description: (cause as Error).message || 'Error desconegut',
      })
    }
  }, [approvePost, editorPost, notifySuccess, toast])

  const handlePublish = React.useCallback(async () => {
    if (!editorPost) return

    try {
      const result = await publishPost(editorPost.id)

      setEditorPost(result.result.post)
      setDraftForm(buildDraftForm(result.result.post))
      await notifySuccess(result.message)
    } catch (cause) {
      toast({
        variant: 'destructive',
        title: 'No s’ha pogut publicar',
        description: (cause as Error).message || 'Error desconegut',
      })
    }
  }, [editorPost, notifySuccess, publishPost, toast])

  const handleUnpublish = React.useCallback(async () => {
    if (!editorPost) return

    if (!window.confirm('Vols retirar aquest post del blog públic?')) return

    try {
      const result = await unpublishPost(editorPost.id)

      setEditorPost(result.result.post)
      setDraftForm(buildDraftForm(result.result.post))
      await notifySuccess(result.message)
    } catch (cause) {
      toast({
        variant: 'destructive',
        title: 'No s’ha pogut despublicar',
        description: (cause as Error).message || 'Error desconegut',
      })
    }
  }, [editorPost, notifySuccess, toast, unpublishPost])

  const handleGenerateCover = React.useCallback(async () => {
    if (!editorPost) return

    try {
      const result = await generateCover(editorPost.id)
      setEditorPost(result.result.post)
      setDraftForm(buildDraftForm(result.result.post))
      await notifySuccess(result.message)
    } catch (cause) {
      toast({
        variant: 'destructive',
        title: 'No s’ha pogut generar la portada',
        description: (cause as Error).message || 'Error desconegut',
      })
    }
  }, [editorPost, generateCover, notifySuccess, toast])

  const handleDiscard = React.useCallback(async () => {
    if (!editorPost) return

    if (!window.confirm('Vols descartar aquest draft?')) return

    try {
      const result = await discardPost(editorPost.id)

      closeEditor()
      await notifySuccess(result.message)
    } catch (cause) {
      toast({
        variant: 'destructive',
        title: 'No s’ha pogut descartar',
        description: (cause as Error).message || 'Error desconegut',
      })
    }
  }, [closeEditor, discardPost, editorPost, notifySuccess, toast])

  const handleCardApprove = React.useCallback(
    async (postId: string) => {
      try {
        const result = await approvePost(postId)
        await notifySuccess(result.message)
        if (editorPost?.id === postId) {
          setEditorPost(result.result.post)
          setDraftForm(buildDraftForm(result.result.post))
        }
      } catch (cause) {
        toast({
          variant: 'destructive',
          title: 'No s’ha pogut aprovar',
          description: (cause as Error).message || 'Error desconegut',
        })
      }
    },
    [approvePost, editorPost?.id, notifySuccess, toast]
  )

  const handleCardPublish = React.useCallback(
    async (postId: string) => {
      try {
        const result = await publishPost(postId)
        await notifySuccess(result.message)
        if (editorPost?.id === postId) {
          setEditorPost(result.result.post)
          setDraftForm(buildDraftForm(result.result.post))
        }
      } catch (cause) {
        toast({
          variant: 'destructive',
          title: 'No s’ha pogut publicar',
          description: (cause as Error).message || 'Error desconegut',
        })
      }
    },
    [editorPost?.id, notifySuccess, publishPost, toast]
  )

  const handleCardUnpublish = React.useCallback(
    async (postId: string) => {
      if (!window.confirm('Vols retirar aquest post del blog públic?')) return

      try {
        const result = await unpublishPost(postId)
        await notifySuccess(result.message)
        if (editorPost?.id === postId) {
          setEditorPost(result.result.post)
          setDraftForm(buildDraftForm(result.result.post))
        }
      } catch (cause) {
        toast({
          variant: 'destructive',
          title: 'No s’ha pogut despublicar',
          description: (cause as Error).message || 'Error desconegut',
        })
      }
    },
    [editorPost?.id, notifySuccess, toast, unpublishPost]
  )

  const hasPosts = posts.length > 0

  return (
    <div className="min-w-0 bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-[1560px] px-5 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Link
              href="/admin/contingut"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Tornar a Blog i Novetats
            </Link>
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              Blog natiu
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950">Blog</h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-500">
                Aquí generes una proposta, la revises amb calma i la publiques quan la dones per bona.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void refresh()}
              disabled={loading || isBusy}
              className="rounded-full border-slate-300"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refrescar
            </Button>
            <Button
              onClick={() => setIsGenerateOpen(true)}
              className="rounded-full bg-violet-600 text-white hover:bg-violet-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Generar peça
            </Button>
          </div>
        </header>

        <div className="mb-6 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">Resum del blog</div>
              <p className="text-sm text-slate-500">
                {counts.draftReady} drafts per revisar · {counts.approved} aprovats · {counts.published} publicats
                {counts.errors > 0 ? ` · ${counts.errors} amb error` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                <Clock3 className="h-4 w-4" />
                {latestUpdate ? `Actualitzat ${formatRelativeTime(latestUpdate) ?? 'fa poc'}` : 'Sense actualització'}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                <FileText className="h-4 w-4" />
                {hasPosts ? `${posts.length} peces al registre` : 'Cap peça encara'}
              </span>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <div className="mb-1 font-semibold">No s’ha pogut carregar el blog natiu</div>
            <p>{error}</p>
          </div>
        ) : null}

        {loading && !hasPosts ? (
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500 shadow-sm">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              Carregant drafts natius...
            </div>
          </div>
        ) : null}

        {!loading && !hasPosts ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-sm text-slate-500 shadow-sm">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-violet-600" />
              <div className="space-y-2">
                <p className="font-semibold text-slate-900">Encara no hi ha peces natives</p>
                <p className="max-w-2xl">
                  Genera la primera peça amb la IA nativa i el draft quedarà guardat a Firestore per editar-lo i publicar-lo
                  des d’aquí mateix.
                </p>
                <Button onClick={() => setIsGenerateOpen(true)} className="rounded-full bg-violet-600 text-white hover:bg-violet-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Generar primera peça
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-2">
          {sections.map((section) => (
            <Card key={section.key} className={`rounded-3xl border ${section.accent} shadow-sm`}>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl tracking-[-0.03em]">{section.title}</CardTitle>
                    <CardDescription className="mt-1">{section.description}</CardDescription>
                  </div>
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] font-semibold">
                    {section.items.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {section.items.length > 0 ? (
                  section.items.map((post) => (
                    <DraftCard
                      key={post.id}
                      post={post}
                      busy={pendingId === post.id}
                      locked={Boolean(pendingId)}
                      onEdit={openEditor}
                      onApprove={(postId) => void handleCardApprove(postId)}
                      onPublish={(postId) => void handleCardPublish(postId)}
                      onUnpublish={(postId) => void handleCardUnpublish(postId)}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    Sense peces en aquesta cua.
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <GenerateDraftModal
        open={isGenerateOpen}
        onOpenChange={setIsGenerateOpen}
        form={generateForm}
        onFormChange={(next) => setGenerateForm(next)}
        onGenerate={() => void handleGenerate()}
        isGenerating={pendingId === 'new-post'}
      />

      <BlogDraftEditor
        open={editorOpen}
        post={editorPost}
        form={draftForm}
        onFormChange={(next) => setDraftForm(next)}
        onClose={closeEditor}
        onSave={() => void handleSaveDraft()}
        onGenerateCover={() => void handleGenerateCover()}
        onApprove={() => void handleApprove()}
        onPublish={() => void handlePublish()}
        onUnpublish={() => void handleUnpublish()}
        onDiscard={() => void handleDiscard()}
        isBusy={Boolean(pendingId)}
      />
    </div>
  )
}
