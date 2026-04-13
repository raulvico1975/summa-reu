import { NextRequest, NextResponse } from 'next/server'

import { getAdminDb, isSuperAdmin, verifyIdToken } from '@/lib/api/admin-sdk'
import { generateNativeBlogCover } from '@/lib/editorial-native/cover'
import { generateNativeBlogDraft, translateNativeBlogDraftToEs } from '@/lib/editorial-native/generator'
import { buildPublishInputFromNativePost, publishNativeBlogPost } from '@/lib/editorial-native/publish'
import { renderEditorialMarkdownToHtml, slugifyDraftTitle } from '@/lib/editorial-native/markdown'
import { unpublishNativeBlogPost } from '@/lib/editorial-native/unpublish'
import {
  createNativeBlogPostSeed,
  getNativeBlogPost,
  saveNativeBlogPost,
} from '@/lib/editorial-native/store'
import type { NativeBlogDraft, NativeBlogGenerateInput, NativeBlogPost } from '@/lib/editorial-native/types'

type GenerateBody = {
  action: 'generate_post'
  prompt: string
  audience?: string
  problem?: string
  objective?: string
}

type UpdateDraftBody = {
  action: 'update_draft'
  postId: string
  draft: {
    title: string
    slug: string
    seoTitle: string
    metaDescription: string
    excerpt: string
    contentMarkdown: string
    category: string
    tags: string[]
    coverImageUrl?: string | null
    coverImageAlt?: string | null
    imagePrompt?: string | null
  }
}

type ApproveBody = {
  action: 'approve_post'
  postId: string
}

type GenerateCoverBody = {
  action: 'generate_cover'
  postId: string
}

type PublishBody = {
  action: 'publish_post'
  postId: string
}

type UnpublishBody = {
  action: 'unpublish_post'
  postId: string
}

type DiscardBody = {
  action: 'discard_post'
  postId: string
}

type ActionBody =
  | GenerateBody
  | UpdateDraftBody
  | ApproveBody
  | GenerateCoverBody
  | PublishBody
  | UnpublishBody
  | DiscardBody

type ActionResult =
  | { action: 'generate_post'; post: NativeBlogPost }
  | { action: 'update_draft'; post: NativeBlogPost }
  | { action: 'approve_post'; post: NativeBlogPost }
  | { action: 'generate_cover'; post: NativeBlogPost }
  | { action: 'publish_post'; post: NativeBlogPost }
  | { action: 'unpublish_post'; post: NativeBlogPost }
  | { action: 'discard_post'; post: NativeBlogPost }

type ApiResponse =
  | { ok: true; result: ActionResult; message: string }
  | { ok: false; error: string }

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseBody(body: unknown): ActionBody {
  if (!body || typeof body !== 'object') {
    throw new Error('Cos de petició invàlid')
  }

  const action = (body as { action?: unknown }).action
  if (!isNonEmptyString(action)) {
    throw new Error('Acció invàlida')
  }

  if (action === 'generate_post') {
    const prompt = (body as { prompt?: unknown }).prompt
    if (!isNonEmptyString(prompt)) {
      throw new Error('Cal indicar un tema o angle per generar el post')
    }

    return {
      action,
      prompt: prompt.trim(),
      audience: asNullableString((body as { audience?: unknown }).audience) ?? undefined,
      problem: asNullableString((body as { problem?: unknown }).problem) ?? undefined,
      objective: asNullableString((body as { objective?: unknown }).objective) ?? undefined,
    }
  }

  const postId = (body as { postId?: unknown }).postId
  if (!isNonEmptyString(postId)) {
    throw new Error('Falta el postId')
  }

  if (action === 'update_draft') {
    const draft = (body as { draft?: unknown }).draft
    if (!draft || typeof draft !== 'object') {
      throw new Error('Falta el draft a guardar')
    }

      return {
        action,
        postId: postId.trim(),
        draft: {
        title: String((draft as Record<string, unknown>).title ?? ''),
        slug: String((draft as Record<string, unknown>).slug ?? ''),
        seoTitle: String((draft as Record<string, unknown>).seoTitle ?? ''),
        metaDescription: String((draft as Record<string, unknown>).metaDescription ?? ''),
        excerpt: String((draft as Record<string, unknown>).excerpt ?? ''),
        contentMarkdown: String((draft as Record<string, unknown>).contentMarkdown ?? ''),
          category: String((draft as Record<string, unknown>).category ?? ''),
          tags: Array.isArray((draft as Record<string, unknown>).tags)
            ? ((draft as Record<string, unknown>).tags as unknown[]).filter(
                (item): item is string => typeof item === 'string' && item.trim().length > 0
              )
            : [],
        coverImageUrl: asNullableString((draft as Record<string, unknown>).coverImageUrl),
        coverImageAlt: asNullableString((draft as Record<string, unknown>).coverImageAlt),
        imagePrompt: asNullableString((draft as Record<string, unknown>).imagePrompt),
      },
    }
  }

  if (
    action === 'approve_post' ||
    action === 'generate_cover' ||
    action === 'publish_post' ||
    action === 'unpublish_post' ||
    action === 'discard_post'
  ) {
    return { action, postId: postId.trim() }
  }

  throw new Error('Acció no suportada')
}

function applyDraftUpdate(current: NativeBlogPost, nextDraft: UpdateDraftBody['draft']): NativeBlogPost {
  const nextMarkdown = nextDraft.contentMarkdown.trim()
  const nextTitle = nextDraft.title.trim()
  const nextSlug = nextDraft.slug.trim() || slugifyDraftTitle(nextTitle)
  const now = new Date().toISOString()

  return {
    ...current,
    status: current.status === 'discarded' ? 'draft_ready' : current.status,
    draft: {
      ...current.draft,
      title: nextTitle,
      slug: nextSlug,
      seoTitle: nextDraft.seoTitle.trim(),
      metaDescription: nextDraft.metaDescription.trim(),
      excerpt: nextDraft.excerpt.trim(),
      contentMarkdown: nextMarkdown,
      contentHtml: renderEditorialMarkdownToHtml(nextMarkdown),
      category: nextDraft.category.trim() || 'criteri-operatiu',
      tags: nextDraft.tags.map((tag) => tag.trim()).filter(Boolean),
      coverImageUrl: nextDraft.coverImageUrl ?? null,
      coverImageAlt: nextDraft.coverImageAlt ?? null,
      imagePrompt: nextDraft.imagePrompt ?? null,
      translations: null,
    },
    review: {
      ...current.review,
      lastError: null,
    },
    updatedAt: now,
  }
}

async function buildGeneratedPost(input: NativeBlogGenerateInput): Promise<NativeBlogPost> {
  const seed = createNativeBlogPostSeed(input)
  const generated = await generateNativeBlogDraft(input)
  const now = new Date().toISOString()

  return {
    ...seed,
    source: 'ai',
    status: 'draft_ready',
    draft: generated.draft,
    context: generated.context,
    updatedAt: now,
  }
}

async function saveWithRetry(db: ReturnType<typeof getAdminDb>, post: NativeBlogPost, attempts = 3): Promise<void> {
  let lastError: unknown = null
  for (let index = 0; index < attempts; index += 1) {
    try {
      await saveNativeBlogPost(db, post)
      return
    } catch (error: unknown) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 120 * (index + 1)))
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No s’ha pogut guardar el registre editorial.')
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const authResult = await verifyIdToken(request)
    if (!authResult) {
      return NextResponse.json({ ok: false, error: 'Token invàlid o absent' }, { status: 401 })
    }

    const superOk = await isSuperAdmin(authResult.uid)
    if (!superOk) {
      return NextResponse.json({ ok: false, error: 'Només SuperAdmin pot modificar el blog editorial' }, { status: 403 })
    }

    const body = parseBody(await request.json())
    const db = getAdminDb()

    if (body.action === 'generate_post') {
      const post = await buildGeneratedPost(body)
      await saveWithRetry(db, post)

      return NextResponse.json({
        ok: true,
        result: { action: 'generate_post', post },
        message: post.context.llmApplied
          ? "S'ha generat un primer draft del blog amb la base de coneixement."
          : "S'ha creat una base editable del post. Convé revisar-la abans d'aprovar-la.",
      })
    }

    const current = await getNativeBlogPost(db, body.postId)
    if (!current) {
      return NextResponse.json({ ok: false, error: 'No s’ha trobat el draft editorial' }, { status: 404 })
    }

    if (body.action === 'update_draft') {
      const updated = applyDraftUpdate(current, body.draft)
      await saveWithRetry(db, updated)

      return NextResponse.json({
        ok: true,
        result: { action: 'update_draft', post: updated },
        message: "S'ha guardat el draft editorial.",
      })
    }

    if (body.action === 'approve_post') {
      const updated: NativeBlogPost = {
        ...current,
        status: 'approved',
        review: {
          ...current.review,
          approvedAt: new Date().toISOString(),
          approvedBy: authResult.email ?? authResult.uid,
          lastError: null,
        },
        updatedAt: new Date().toISOString(),
      }
      await saveWithRetry(db, updated)

      return NextResponse.json({
        ok: true,
        result: { action: 'approve_post', post: updated },
        message: "El draft queda aprovat i llest per publicar.",
      })
    }

    if (body.action === 'generate_cover') {
      const generatedCover = await generateNativeBlogCover(current)
      const updated: NativeBlogPost = {
        ...current,
        draft: {
          ...current.draft,
          coverImageUrl: generatedCover.coverImageUrl,
          coverImageAlt: generatedCover.coverImageAlt,
        },
        review: {
          ...current.review,
          lastError: null,
        },
        updatedAt: new Date().toISOString(),
      }
      await saveWithRetry(db, updated)

      return NextResponse.json({
        ok: true,
        result: { action: 'generate_cover', post: updated },
        message:
          generatedCover.kind === 'generated'
            ? "La portada s'ha generat i s'ha guardat al draft."
            : "S'ha creat una portada editorial automàtica i s'ha guardat al draft.",
      })
    }

    if (body.action === 'discard_post') {
      const updated: NativeBlogPost = {
        ...current,
        status: 'discarded',
        updatedAt: new Date().toISOString(),
      }
      await saveWithRetry(db, updated)

      return NextResponse.json({
        ok: true,
        result: { action: 'discard_post', post: updated },
        message: "El draft s'ha descartat.",
      })
    }

    if (body.action === 'unpublish_post') {
      if (current.status !== 'published') {
        return NextResponse.json(
          { ok: false, error: 'Només es poden despublicar peces publicades.' },
          { status: 409 }
        )
      }

      await unpublishNativeBlogPost(current)

      const updated: NativeBlogPost = {
        ...current,
        status: 'approved',
        review: {
          ...current.review,
          publishedAt: null,
          publishedUrl: null,
          localizedUrls: null,
          lastError: null,
        },
        updatedAt: new Date().toISOString(),
      }
      await saveWithRetry(db, updated)

      return NextResponse.json({
        ok: true,
        result: { action: 'unpublish_post', post: updated },
        message: 'El post s’ha retirat del blog públic i queda aprovat dins del panell.',
      })
    }

    const canPublish =
      current.status === 'approved' ||
      (current.status === 'publish_failed' && Boolean(current.review.approvedAt))

    if (!canPublish) {
      return NextResponse.json(
        { ok: false, error: 'Només es poden publicar peces aprovades.' },
        { status: 409 }
      )
    }

    let publishable = current
    if (!publishable.draft.translations?.es && publishable.draft.contentMarkdown) {
      try {
        const esTranslation = await translateNativeBlogDraftToEs(publishable.draft)
        publishable = {
          ...publishable,
          draft: {
              ...publishable.draft,
              translations: {
                es: esTranslation,
              },
            },
            context: {
              ...publishable.context,
              translatedAt: new Date().toISOString(),
            },
        }
      } catch (translationError: unknown) {
        publishable = {
          ...publishable,
          context: {
            ...publishable.context,
            reviewNotes: [
              ...publishable.context.reviewNotes,
              `La traducció ES no s'ha pogut generar en aquesta execució: ${(translationError as Error)?.message || String(translationError)}`,
            ].slice(0, 5),
          },
        }
      }
      await saveWithRetry(db, publishable)
    }

    // Validem el contracte abans de publicar per donar error més clar al panell.
    buildPublishInputFromNativePost(publishable)

    try {
      const published = await publishNativeBlogPost(publishable)
      const updated: NativeBlogPost = {
        ...publishable,
        status: 'published',
        review: {
          ...publishable.review,
          publishedAt: new Date().toISOString(),
          publishedUrl: published.url,
          localizedUrls: {
            ca: published.localizedUrls.ca,
            es: published.localizedUrls.es,
          },
          lastError: null,
        },
        updatedAt: new Date().toISOString(),
      }
      await saveWithRetry(db, updated)

      return NextResponse.json({
        ok: true,
        result: { action: 'publish_post', post: updated },
        message: "El post s'ha publicat directament al blog de Summa.",
      })
    } catch (error: unknown) {
      const updated: NativeBlogPost = {
        ...publishable,
        status: 'publish_failed',
        review: {
          ...publishable.review,
          lastError: (error as Error)?.message || String(error),
        },
        updatedAt: new Date().toISOString(),
      }
      await saveWithRetry(db, updated)
      throw error
    }
  } catch (error: unknown) {
    console.error('[admin/blog-drafts/actions] error:', error)
    const message = (error as Error)?.message || String(error)
    return NextResponse.json({ ok: false, error: message.substring(0, 260) }, { status: 500 })
  }
}
