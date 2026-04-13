import { randomUUID } from 'node:crypto'

import type { Firestore } from 'firebase-admin/firestore'

import type {
  NativeBlogDraft,
  NativeBlogGenerateInput,
  NativeBlogPost,
  NativeBlogPostStatus,
  NativeBlogQueueSummary,
} from '@/lib/editorial-native/types'

export const NATIVE_BLOG_COLLECTION = 'ops_editorial_blog_posts'

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function emptyDraft(): NativeBlogDraft {
  return {
    title: null,
    slug: null,
    seoTitle: null,
    metaDescription: null,
    excerpt: null,
    contentMarkdown: null,
    contentHtml: null,
    tags: [],
    category: null,
    coverImageUrl: null,
    coverImageAlt: null,
    imagePrompt: null,
    translations: null,
  }
}

export function createNativeBlogPostId(): string {
  return `blogdraft-${Date.now()}-${randomUUID().slice(0, 8)}`
}

export function createNativeBlogPostSeed(input: NativeBlogGenerateInput): NativeBlogPost {
  const now = new Date().toISOString()

  return {
    id: createNativeBlogPostId(),
    source: 'manual',
    status: 'idea',
    idea: {
      prompt: input.prompt.trim(),
      audience: input.audience?.trim() || null,
      problem: input.problem?.trim() || null,
      objective: input.objective?.trim() || null,
    },
    draft: emptyDraft(),
    context: {
      kbPath: null,
      kbAvailable: false,
      kbRefs: [],
      kbSnippets: [],
      model: null,
      llmApplied: null,
      validationStatus: null,
      validationVerdict: null,
      reviewNotes: [],
      generatedAt: null,
      translatedAt: null,
    },
    review: {
      approvedAt: null,
      approvedBy: null,
      publishedAt: null,
      publishedUrl: null,
      localizedUrls: null,
      lastError: null,
    },
    createdAt: now,
    updatedAt: now,
  }
}

export function mapNativeBlogPost(rawId: string, raw: unknown): NativeBlogPost | null {
  if (!isRecord(raw)) return null

  const idea = isRecord(raw.idea) ? raw.idea : {}
  const draft = isRecord(raw.draft) ? raw.draft : {}
  const context = isRecord(raw.context) ? raw.context : {}
  const review = isRecord(raw.review) ? raw.review : {}
  const translations = isRecord(draft.translations) ? draft.translations : {}
  const es = isRecord(translations.es) ? translations.es : null
  const localizedUrls = isRecord(review.localizedUrls) ? review.localizedUrls : null

  const status = asString(raw.status) as NativeBlogPostStatus | null
  if (!status) return null

  return {
    id: rawId,
    source: (asString(raw.source) as NativeBlogPost['source']) ?? 'manual',
    status,
    idea: {
      prompt: asString(idea.prompt) ?? '',
      audience: asString(idea.audience),
      problem: asString(idea.problem),
      objective: asString(idea.objective),
    },
    draft: {
      title: asString(draft.title),
      slug: asString(draft.slug),
      seoTitle: asString(draft.seoTitle),
      metaDescription: asString(draft.metaDescription),
      excerpt: asString(draft.excerpt),
      contentMarkdown: asString(draft.contentMarkdown),
      contentHtml: asString(draft.contentHtml),
      tags: asStringArray(draft.tags),
      category: asString(draft.category),
      coverImageUrl: asString(draft.coverImageUrl),
      coverImageAlt: asString(draft.coverImageAlt),
      imagePrompt: asString(draft.imagePrompt),
      translations: es
        ? {
            es: {
              title: asString(es.title) ?? '',
              seoTitle: asString(es.seoTitle) ?? '',
              metaDescription: asString(es.metaDescription) ?? '',
              excerpt: asString(es.excerpt) ?? '',
              contentMarkdown: asString(es.contentMarkdown) ?? '',
              contentHtml: asString(es.contentHtml) ?? '',
            },
          }
        : null,
    },
    context: {
      kbPath: asString(context.kbPath),
      kbAvailable: Boolean(context.kbAvailable),
      kbRefs: asStringArray(context.kbRefs),
      kbSnippets: asStringArray(context.kbSnippets),
      model: asString(context.model),
      llmApplied: typeof context.llmApplied === 'boolean' ? context.llmApplied : null,
      validationStatus:
        asString(context.validationStatus) === 'OK' ||
        asString(context.validationStatus) === 'NEEDS_FIX' ||
        asString(context.validationStatus) === 'REJECT'
          ? (asString(context.validationStatus) as NativeBlogPost['context']['validationStatus'])
          : null,
      validationVerdict:
        asString(context.validationVerdict) === 'publishable' ||
        asString(context.validationVerdict) === 'publishable_with_edits' ||
        asString(context.validationVerdict) === 'not_publishable'
          ? (asString(context.validationVerdict) as NativeBlogPost['context']['validationVerdict'])
          : null,
      reviewNotes: asStringArray(context.reviewNotes),
      generatedAt: asString(context.generatedAt),
      translatedAt: asString(context.translatedAt),
    },
    review: {
      approvedAt: asString(review.approvedAt),
      approvedBy: asString(review.approvedBy),
      publishedAt: asString(review.publishedAt),
      publishedUrl: asString(review.publishedUrl),
      localizedUrls: localizedUrls
        ? {
            ca: asString(localizedUrls.ca),
            es: asString(localizedUrls.es),
          }
        : null,
      lastError: asString(review.lastError),
    },
    createdAt: asString(raw.createdAt) ?? new Date(0).toISOString(),
    updatedAt: asString(raw.updatedAt) ?? new Date(0).toISOString(),
  }
}

export async function listNativeBlogPosts(db: Firestore): Promise<NativeBlogPost[]> {
  const snap = await db.collection(NATIVE_BLOG_COLLECTION).get()

  return snap.docs
    .map((doc) => mapNativeBlogPost(doc.id, doc.data()))
    .filter((item): item is NativeBlogPost => item !== null)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function getNativeBlogPost(db: Firestore, postId: string): Promise<NativeBlogPost | null> {
  const snap = await db.collection(NATIVE_BLOG_COLLECTION).doc(postId).get()
  if (!snap.exists) return null
  return mapNativeBlogPost(snap.id, snap.data())
}

export async function saveNativeBlogPost(db: Firestore, post: NativeBlogPost): Promise<void> {
  await db.collection(NATIVE_BLOG_COLLECTION).doc(post.id).set(post)
}

export async function buildNativeBlogQueueSummary(db: Firestore): Promise<NativeBlogQueueSummary> {
  const posts = await listNativeBlogPosts(db)

  return {
    updatedAt: posts[0]?.updatedAt ?? null,
    draftReady: posts.filter((post) => post.status === 'draft_ready').length,
    approved: posts.filter((post) => post.status === 'approved').length,
    published: posts.filter((post) => post.status === 'published').length,
    failed: posts.filter((post) => post.status === 'publish_failed').length,
  }
}
