export type NativeBlogPostSource = 'manual' | 'calendar' | 'ai'

export type NativeBlogPostStatus =
  | 'idea'
  | 'draft_ready'
  | 'approved'
  | 'published'
  | 'publish_failed'
  | 'discarded'

export type NativeBlogValidationStatus = 'OK' | 'NEEDS_FIX' | 'REJECT' | null
export type NativeBlogValidationVerdict =
  | 'publishable'
  | 'publishable_with_edits'
  | 'not_publishable'
  | null

export interface NativeBlogIdea {
  prompt: string
  audience: string | null
  problem: string | null
  objective: string | null
}

export interface NativeBlogDraftTranslation {
  title: string
  seoTitle: string
  metaDescription: string
  excerpt: string
  contentMarkdown: string
  contentHtml: string
}

export interface NativeBlogDraft {
  title: string | null
  slug: string | null
  seoTitle: string | null
  metaDescription: string | null
  excerpt: string | null
  contentMarkdown: string | null
  contentHtml: string | null
  tags: string[]
  category: string | null
  coverImageUrl: string | null
  coverImageAlt: string | null
  imagePrompt: string | null
  translations: {
    es: NativeBlogDraftTranslation | null
  } | null
}

export interface NativeBlogContext {
  kbPath: string | null
  kbAvailable: boolean
  kbRefs: string[]
  kbSnippets: string[]
  model: string | null
  llmApplied: boolean | null
  validationStatus: NativeBlogValidationStatus
  validationVerdict: NativeBlogValidationVerdict
  reviewNotes: string[]
  generatedAt: string | null
  translatedAt: string | null
}

export interface NativeBlogReview {
  approvedAt: string | null
  approvedBy: string | null
  publishedAt: string | null
  publishedUrl: string | null
  localizedUrls: {
    ca: string | null
    es: string | null
  } | null
  lastError: string | null
}

export interface NativeBlogPost {
  id: string
  source: NativeBlogPostSource
  status: NativeBlogPostStatus
  idea: NativeBlogIdea
  draft: NativeBlogDraft
  context: NativeBlogContext
  review: NativeBlogReview
  createdAt: string
  updatedAt: string
}

export interface NativeBlogQueueSummary {
  updatedAt: string | null
  draftReady: number
  approved: number
  published: number
  failed: number
}

export interface NativeBlogGenerateInput {
  prompt: string
  audience?: string | null
  problem?: string | null
  objective?: string | null
}

