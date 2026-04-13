export type CalendarPostKind = 'historical' | 'monthly'
export type CalendarSourceStatus = 'provided' | 'inferred_from_missing_exact_yaml_block'
export type ApprovalChannel = 'telegram' | 'web'
export type PublishMode = 'live' | 'mock'

export type QueueBlogStatus =
  | 'planned'
  | 'draft_ready'
  | 'pending_approval'
  | 'approved'
  | 'published'
  | 'mock_published'

export type QueueLinkedInStatus =
  | 'not_started'
  | 'derived'
  | 'pending_approval'
  | 'approved'
  | 'published'
  | 'mock_published'

export type ApprovalStatus =
  | 'not_requested'
  | 'pending_telegram'
  | 'approved'
  | 'rejected'

export interface EditorialCalendarPost {
  id: string
  kind: CalendarPostKind
  state: 'published' | 'planned'
  title: string
  slug: string
  month: string
  plannedDate: string
  publishedAt: string
  category: string
  tags: string[]
  sectorPrimary: string
  sectorSecondary?: string
  objective: string
  brief: string
  sourceStatus: CalendarSourceStatus
}

export interface EditorialCalendar {
  version: number
  calendarId: string
  calendarOrigin: string
  criteriaSources: {
    sectorKnowledgeBasePath: string
    blogPublishContractPath: string
    octaviStructurePaths: string[]
  }
  defaults: {
    blogLocale: string
    approvalChannel: ApprovalChannel
    linkedinMode: PublishMode
    derivativesPerPost: number
    requiresHumanApproval: boolean
  }
  posts: EditorialCalendarPost[]
}

export interface CriteriaSourceSnapshot {
  path: string
  exists: boolean
  content: string | null
  error?: string
}

export interface EditorialCriteriaContext {
  sources: {
    sectorKnowledgeBase: CriteriaSourceSnapshot
    blogPublishContract: CriteriaSourceSnapshot
    octaviStructure: CriteriaSourceSnapshot[]
  }
  kbTerms: string[]
  warnings: string[]
}

export interface BlogDraftArtifact {
  id: string
  title: string
  slug: string
  seoTitle: string
  metaDescription: string
  excerpt: string
  category: string
  tags: string[]
  publishedAt: string
  language: string
  sectorPrimary: string
  sectorSecondary?: string
  objective: string
  brief: string
  criteriaWarnings: string[]
  contentMarkdown: string
  contentHtml: string
}

export interface LinkedInVariant {
  id: string
  angle: string
  body: string
}

export interface LinkedInArtifact {
  id: string
  postId: string
  sourceTitle: string
  mode: PublishMode
  variants: LinkedInVariant[]
  criteriaWarnings: string[]
}

export interface QueueItemArtifactPaths {
  draftJson?: string
  draftMarkdown?: string
  linkedinJson?: string
  linkedinMarkdown?: string
  approvalJson?: string
}

export interface QueueItem {
  id: string
  title: string
  kind: CalendarPostKind
  month: string
  plannedDate: string
  publishedAt: string
  sectorPrimary: string
  sectorSecondary?: string
  blogStatus: QueueBlogStatus
  linkedinStatus: QueueLinkedInStatus
  approvalStatus: ApprovalStatus
  sourceStatus: CalendarSourceStatus
  artifactPaths: QueueItemArtifactPaths
  notes: string[]
  lastAction?: string
  lastActionAt?: string
}

export interface QueueState {
  version: number
  calendarId: string
  updatedAt: string
  kbPath: string
  kbAvailable: boolean
  warnings: string[]
  items: QueueItem[]
}

export interface EditorialLogEntry {
  timestamp: string
  action: string
  itemId?: string
  level: 'info' | 'warning' | 'error'
  detail: string
  payload?: Record<string, unknown>
}
