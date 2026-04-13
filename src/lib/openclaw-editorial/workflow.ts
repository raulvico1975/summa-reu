import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  appendEditorialLog,
  editorialPaths,
  ensureEditorialDirs,
  getEditorialKbPath,
  hasEditorialQueueState,
  loadCalendar,
  loadCriteriaContext,
  loadQueueState,
  nowIso,
  resolveWorkspacePath,
  saveQueueState,
  toWorkspaceRelativePath,
  writeJsonArtifact,
  writeTextArtifact,
} from './files'
import { buildBlogDraft, buildLinkedInArtifact } from './content'
import type {
  ApprovalStatus,
  BlogDraftArtifact,
  EditorialCalendar,
  EditorialCalendarPost,
  EditorialCriteriaContext,
  LinkedInArtifact,
  PublishMode,
  QueueItem,
  QueueState,
} from './types'

function findQueueItem(queueState: QueueState, postId: string) {
  return queueState.items.find((item) => item.id === postId)
}

function upsertQueueItem(queueState: QueueState, queueItem: QueueItem) {
  const existingIndex = queueState.items.findIndex((item) => item.id === queueItem.id)

  if (existingIndex >= 0) {
    queueState.items[existingIndex] = queueItem
  } else {
    queueState.items.push(queueItem)
  }

  queueState.items.sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
}

function buildInitialQueueItem(post: EditorialCalendarPost): QueueItem {
  return {
    id: post.id,
    title: post.title,
    kind: post.kind,
    month: post.month,
    plannedDate: post.plannedDate,
    publishedAt: post.publishedAt,
    sectorPrimary: post.sectorPrimary,
    sectorSecondary: post.sectorSecondary,
    blogStatus: post.state === 'published' ? 'published' : 'planned',
    linkedinStatus: post.state === 'published' ? 'not_started' : 'not_started',
    approvalStatus: post.state === 'published' ? 'approved' : 'not_requested',
    sourceStatus: post.sourceStatus,
    artifactPaths: {},
    notes:
      post.sourceStatus === 'inferred_from_missing_exact_yaml_block'
        ? ['Calendari inferit perquè el bloc YAML exacte no ha arribat en aquest encàrrec.']
        : [],
  }
}

function getPersistentNotes(notes: string[]) {
  return notes.filter((note) => note.startsWith('Calendari inferit'))
}

function refreshQueueNotes(queueItem: QueueItem, currentWarnings: string[]) {
  queueItem.notes = Array.from(new Set([...getPersistentNotes(queueItem.notes), ...currentWarnings]))
}

function selectNextPlannedPost(posts: EditorialCalendarPost[]) {
  return posts
    .filter((post) => post.kind === 'monthly' && post.state === 'planned')
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))[0]
}

function renderDraftMarkdown(draft: BlogDraftArtifact) {
  return [
    '---',
    `id: ${draft.id}`,
    `slug: ${draft.slug}`,
    `title: ${draft.title}`,
    `publishedAt: ${draft.publishedAt}`,
    `category: ${draft.category}`,
    `tags: ${draft.tags.join(', ')}`,
    `criteriaWarnings: ${draft.criteriaWarnings.length}`,
    '---',
    '',
    draft.contentMarkdown,
  ].join('\n')
}

function renderLinkedInMarkdown(artifact: LinkedInArtifact) {
  const blocks = artifact.variants.map((variant, index) =>
    [`## Variant ${index + 1} - ${variant.angle}`, '', variant.body].join('\n')
  )

  return [
    `# Derivades LinkedIn - ${artifact.sourceTitle}`,
    '',
    ...blocks.flatMap((block) => [block, '']),
  ].join('\n')
}

function mergeWarnings(queueState: QueueState, warnings: string[]) {
  queueState.warnings = Array.from(new Set(warnings))
}

export function seedQueueStateFromCalendar(
  calendar: EditorialCalendar,
  criteriaContext: EditorialCriteriaContext,
  existingQueueState?: QueueState
) {
  const queueState: QueueState =
    existingQueueState ?? {
      version: 1,
      calendarId: calendar.calendarId,
      updatedAt: nowIso(),
      kbPath: getEditorialKbPath(calendar.criteriaSources.sectorKnowledgeBasePath),
      kbAvailable: false,
      warnings: [],
      items: [],
    }

  queueState.calendarId = calendar.calendarId
  queueState.updatedAt = nowIso()
  queueState.kbPath = getEditorialKbPath(calendar.criteriaSources.sectorKnowledgeBasePath)
  queueState.kbAvailable = criteriaContext.sources.sectorKnowledgeBase.exists
  mergeWarnings(queueState, criteriaContext.warnings)

  for (const post of calendar.posts) {
    const existing = findQueueItem(queueState, post.id)
    const nextQueueItem = existing
      ? {
          ...existing,
          title: post.title,
          kind: post.kind,
          month: post.month,
          plannedDate: post.plannedDate,
          publishedAt: post.publishedAt,
          sectorPrimary: post.sectorPrimary,
          sectorSecondary: post.sectorSecondary,
          sourceStatus: post.sourceStatus,
        }
      : buildInitialQueueItem(post)
    refreshQueueNotes(nextQueueItem, criteriaContext.warnings)
    upsertQueueItem(queueState, nextQueueItem)
  }

  return queueState
}

export async function seedHistoricalQueue() {
  await ensureEditorialDirs()
  const calendar = await loadCalendar()
  const criteriaContext = await loadCriteriaContext(calendar)
  const queueState = await loadQueueState(
    calendar.calendarId,
    getEditorialKbPath(calendar.criteriaSources.sectorKnowledgeBasePath)
  )
  const seededQueueState = seedQueueStateFromCalendar(calendar, criteriaContext, queueState)

  await saveQueueState(seededQueueState)
  await appendEditorialLog({
    timestamp: seededQueueState.updatedAt,
    action: 'seed_historical_queue',
    level: 'info',
    detail: `Queue seeded from ${calendar.posts.length} calendar posts.`,
    payload: {
      historicalPosts: calendar.posts.filter((post) => post.kind === 'historical').length,
      plannedMonthlyPosts: calendar.posts.filter((post) => post.kind === 'monthly').length,
    },
  })

  return seededQueueState
}

export async function loadOrSeedRuntimeQueueState() {
  await ensureEditorialDirs()
  const calendar = await loadCalendar()

  if (!(await hasEditorialQueueState())) {
    return seedHistoricalQueue()
  }

  return loadQueueState(
    calendar.calendarId,
    getEditorialKbPath(calendar.criteriaSources.sectorKnowledgeBasePath)
  )
}

export async function generateMonthlyDraft(postId?: string) {
  await ensureEditorialDirs()
  const calendar = await loadCalendar()
  const criteriaContext = await loadCriteriaContext(calendar)
  const queueState = await loadQueueState(
    calendar.calendarId,
    getEditorialKbPath(calendar.criteriaSources.sectorKnowledgeBasePath)
  )
  queueState.kbPath = getEditorialKbPath(calendar.criteriaSources.sectorKnowledgeBasePath)
  mergeWarnings(queueState, criteriaContext.warnings)

  const post =
    calendar.posts.find((entry) => entry.id === postId) ?? selectNextPlannedPost(calendar.posts)

  if (!post) {
    throw new Error('No monthly post available to generate.')
  }

  const draft = buildBlogDraft(
    post,
    criteriaContext,
    calendar.defaults.derivativesPerPost,
    calendar.defaults.blogLocale
  )
  const draftJsonFilePath = path.join(editorialPaths.blogArtifactsDir, `${post.id}.json`)
  const draftMarkdownFilePath = path.join(editorialPaths.blogArtifactsDir, `${post.id}.md`)

  await writeJsonArtifact(draftJsonFilePath, draft)
  await writeTextArtifact(draftMarkdownFilePath, renderDraftMarkdown(draft))

  const queueItem = findQueueItem(queueState, post.id) ?? buildInitialQueueItem(post)
  queueItem.blogStatus = 'draft_ready'
  queueItem.approvalStatus = 'not_requested'
  queueItem.artifactPaths.draftJson = toWorkspaceRelativePath(draftJsonFilePath)
  queueItem.artifactPaths.draftMarkdown = toWorkspaceRelativePath(draftMarkdownFilePath)
  queueItem.lastAction = 'generate_monthly_draft'
  queueItem.lastActionAt = nowIso()
  refreshQueueNotes(queueItem, draft.criteriaWarnings)

  upsertQueueItem(queueState, queueItem)
  queueState.updatedAt = queueItem.lastActionAt
  queueState.kbAvailable = criteriaContext.sources.sectorKnowledgeBase.exists
  await saveQueueState(queueState)
  await appendEditorialLog({
    timestamp: queueItem.lastActionAt,
    action: 'generate_monthly_draft',
    itemId: post.id,
    level: 'info',
    detail: `Draft generated for ${post.title}.`,
  })

  return {
    draft,
    queueState,
  }
}

export async function deriveLinkedIn(postId: string) {
  const calendar = await loadCalendar()
  const criteriaContext = await loadCriteriaContext(calendar)
  const queueState = await loadQueueState(
    calendar.calendarId,
    getEditorialKbPath(calendar.criteriaSources.sectorKnowledgeBasePath)
  )
  queueState.kbPath = getEditorialKbPath(calendar.criteriaSources.sectorKnowledgeBasePath)
  mergeWarnings(queueState, criteriaContext.warnings)

  const queueItem = findQueueItem(queueState, postId)
  if (!queueItem?.artifactPaths.draftJson) {
    throw new Error(`Draft JSON not found for ${postId}. Generate the monthly draft first.`)
  }

  const draftJsonPath = resolveWorkspacePath(queueItem.artifactPaths.draftJson)
  const rawDraft = await import(pathToFileURL(draftJsonPath).href, {
    with: { type: 'json' },
  }).catch(async () => {
    const fs = await import('node:fs/promises')
    const raw = await fs.readFile(draftJsonPath, 'utf8')
    return { default: JSON.parse(raw) as BlogDraftArtifact }
  })

  const draft = rawDraft.default as BlogDraftArtifact
  const artifact = buildLinkedInArtifact(
    draft,
    calendar.defaults.linkedinMode,
    calendar.defaults.derivativesPerPost
  )

  const linkedInJsonFilePath = path.join(editorialPaths.linkedInArtifactsDir, `${postId}.json`)
  const linkedInMarkdownFilePath = path.join(editorialPaths.linkedInArtifactsDir, `${postId}.md`)
  await writeJsonArtifact(linkedInJsonFilePath, artifact)
  await writeTextArtifact(linkedInMarkdownFilePath, renderLinkedInMarkdown(artifact))

  queueItem.linkedinStatus = 'derived'
  queueItem.artifactPaths.linkedinJson = toWorkspaceRelativePath(linkedInJsonFilePath)
  queueItem.artifactPaths.linkedinMarkdown = toWorkspaceRelativePath(linkedInMarkdownFilePath)
  queueItem.lastAction = 'derive_linkedin'
  queueItem.lastActionAt = nowIso()
  refreshQueueNotes(queueItem, artifact.criteriaWarnings)

  upsertQueueItem(queueState, queueItem)
  queueState.updatedAt = queueItem.lastActionAt
  queueState.kbAvailable = criteriaContext.sources.sectorKnowledgeBase.exists
  await saveQueueState(queueState)
  await appendEditorialLog({
    timestamp: queueItem.lastActionAt,
    action: 'derive_linkedin',
    itemId: postId,
    level: 'info',
    detail: `LinkedIn derivatives generated for ${postId}.`,
  })

  return {
    artifact,
    queueState,
  }
}

type ApprovalRequestResult = {
  mode: PublishMode
  approvalPath: string
  approvalStatus: ApprovalStatus
}

async function createApprovalRequest(
  postId: string,
  channel: 'telegram' | 'web'
): Promise<{
  queueState: QueueState
  queueItem: QueueItem
  approvalPayload: {
    itemId: string
    title: string
    requestedAt: string
    channel: 'telegram' | 'web'
    status: 'pending'
    draftJsonPath: string | undefined
    linkedInJsonPath: string | undefined
    summary: string
  }
  approvalFilePath: string
}> {
  const calendar = await loadCalendar()
  const queueState = await loadQueueState(
    calendar.calendarId,
    getEditorialKbPath(calendar.criteriaSources.sectorKnowledgeBasePath)
  )
  queueState.kbPath = getEditorialKbPath(calendar.criteriaSources.sectorKnowledgeBasePath)
  const queueItem = findQueueItem(queueState, postId)
  if (!queueItem?.artifactPaths.draftJson) {
    throw new Error(`Draft missing for ${postId}.`)
  }

  const approvalPayload = {
    itemId: postId,
    title: queueItem.title,
    requestedAt: nowIso(),
    channel,
    status: 'pending' as const,
    draftJsonPath: queueItem.artifactPaths.draftJson,
    linkedInJsonPath: queueItem.artifactPaths.linkedinJson,
    summary:
      'Revisar to sectorial, absència de frases SaaS i coherència amb el contracte de publicació del blog.',
  }

  const approvalFilePath = path.join(editorialPaths.approvalsDir, `${postId}.json`)
  await writeJsonArtifact(approvalFilePath, approvalPayload)

  return {
    queueState,
    queueItem,
    approvalPayload,
    approvalFilePath,
  }
}

async function persistPendingApproval(
  queueState: QueueState,
  queueItem: QueueItem,
  approvalRequestedAt: string,
  approvalFilePath: string,
  action: 'request_telegram_approval' | 'request_web_approval',
  detail: string,
  level: 'info' | 'warning'
) {
  queueItem.approvalStatus = 'pending_telegram'
  queueItem.blogStatus = queueItem.blogStatus === 'draft_ready' ? 'pending_approval' : queueItem.blogStatus
  queueItem.linkedinStatus =
    queueItem.linkedinStatus === 'derived' ? 'pending_approval' : queueItem.linkedinStatus
  queueItem.artifactPaths.approvalJson = toWorkspaceRelativePath(approvalFilePath)
  queueItem.lastAction = action
  queueItem.lastActionAt = approvalRequestedAt

  upsertQueueItem(queueState, queueItem)
  queueState.updatedAt = approvalRequestedAt
  await saveQueueState(queueState)
  await appendEditorialLog({
    timestamp: approvalRequestedAt,
    action,
    itemId: queueItem.id,
    level,
    detail,
  })
}

export async function requestTelegramApproval(postId: string): Promise<ApprovalRequestResult> {
  const { queueState, queueItem, approvalPayload, approvalFilePath } = await createApprovalRequest(
    postId,
    'telegram'
  )

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim()
  let mode: PublishMode = 'mock'

  if (token && chatId) {
    const message = [
      `Aprovació editorial pendent`,
      `Post: ${queueItem.title}`,
      `ID: ${postId}`,
      'Revisa draft + derivades a l\'workspace.',
    ].join('\n')

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    })

    if (!response.ok) {
      throw new Error(`Telegram approval request failed with ${response.status}`)
    }

    mode = 'live'
  }

  await persistPendingApproval(
    queueState,
    queueItem,
    approvalPayload.requestedAt,
    approvalFilePath,
    'request_telegram_approval',
    mode === 'live'
      ? `Telegram approval requested for ${postId}.`
      : `Telegram credentials not available. Approval request stored in mock mode for ${postId}.`,
    mode === 'live' ? 'info' : 'warning'
  )

  return {
    mode,
    approvalPath: toWorkspaceRelativePath(approvalFilePath),
    approvalStatus: queueItem.approvalStatus,
  }
}

export async function requestWebApproval(postId: string): Promise<ApprovalRequestResult> {
  const { queueState, queueItem, approvalPayload, approvalFilePath } = await createApprovalRequest(
    postId,
    'web'
  )

  await persistPendingApproval(
    queueState,
    queueItem,
    approvalPayload.requestedAt,
    approvalFilePath,
    'request_web_approval',
    `Web approval requested for ${postId}.`,
    'info'
  )

  return {
    mode: 'live',
    approvalPath: toWorkspaceRelativePath(approvalFilePath),
    approvalStatus: queueItem.approvalStatus,
  }
}

async function recordApprovalDecision(
  postId: string,
  decision: 'approved' | 'rejected',
  decidedBy: string,
  channel: 'telegram' | 'web'
) {
  const calendar = await loadCalendar()
  const queueState = await loadQueueState(
    calendar.calendarId,
    getEditorialKbPath(calendar.criteriaSources.sectorKnowledgeBasePath)
  )
  queueState.kbPath = getEditorialKbPath(calendar.criteriaSources.sectorKnowledgeBasePath)
  const queueItem = findQueueItem(queueState, postId)
  if (!queueItem?.artifactPaths.approvalJson) {
    throw new Error(`Approval request missing for ${postId}.`)
  }

  const fs = await import('node:fs/promises')
  const approvalJsonPath = resolveWorkspacePath(queueItem.artifactPaths.approvalJson)
  const raw = await fs.readFile(approvalJsonPath, 'utf8')
  const approvalPayload = JSON.parse(raw) as Record<string, unknown>
  const decidedAt = nowIso()

  approvalPayload.status = decision
  approvalPayload.decidedBy = decidedBy
  approvalPayload.decidedAt = decidedAt
  await writeJsonArtifact(approvalJsonPath, approvalPayload)

  queueItem.approvalStatus = decision
  if (decision === 'approved') {
    if (queueItem.blogStatus === 'pending_approval') {
      queueItem.blogStatus = 'approved'
    }
    if (queueItem.linkedinStatus === 'pending_approval') {
      queueItem.linkedinStatus = 'approved'
    }
  } else {
    if (queueItem.blogStatus === 'pending_approval') {
      queueItem.blogStatus = 'draft_ready'
    }
    if (queueItem.linkedinStatus === 'pending_approval') {
      queueItem.linkedinStatus = 'derived'
    }
  }
  queueItem.lastAction = channel === 'web' ? 'record_web_approval' : 'record_telegram_approval'
  queueItem.lastActionAt = decidedAt

  upsertQueueItem(queueState, queueItem)
  queueState.updatedAt = decidedAt
  await saveQueueState(queueState)
  await appendEditorialLog({
    timestamp: decidedAt,
    action: channel === 'web' ? 'record_web_approval' : 'record_telegram_approval',
    itemId: postId,
    level: 'info',
    detail:
      channel === 'web'
        ? `Web approval recorded as ${decision} by ${decidedBy}.`
        : `Telegram approval recorded as ${decision} by ${decidedBy}.`,
  })

  return {
    approvalStatus: queueItem.approvalStatus,
    approvalPath: queueItem.artifactPaths.approvalJson,
  }
}

export async function recordTelegramApprovalDecision(
  postId: string,
  decision: 'approved' | 'rejected',
  decidedBy: string
) {
  return recordApprovalDecision(postId, decision, decidedBy, 'telegram')
}

export async function recordWebApprovalDecision(
  postId: string,
  decision: 'approved' | 'rejected',
  decidedBy: string
) {
  return recordApprovalDecision(postId, decision, decidedBy, 'web')
}

type PublishableDraftLike = {
  title: string
  slug: string
  seoTitle: string
  metaDescription: string
  excerpt: string
  tags: string[]
  contentHtml?: string | null
  category?: string | null
  publishedAt?: string | null
  workflow?: {
    publishedAt?: string | null
    scheduledAt?: string | null
  } | null
}

function toPublishPayload(draft: PublishableDraftLike) {
  return {
    title: draft.title,
    slug: draft.slug,
    seoTitle: draft.seoTitle,
    metaDescription: draft.metaDescription,
    excerpt: draft.excerpt,
    contentHtml: draft.contentHtml ?? '',
    tags: draft.tags,
    category: draft.category ?? 'Blog',
    publishedAt: draft.publishedAt ?? draft.workflow?.publishedAt ?? draft.workflow?.scheduledAt ?? nowIso(),
  }
}

type PublishResult = {
  mode: PublishMode
  status: 'published' | 'mock_published'
  responsePath: string
}

async function postJson(url: string, payload: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(payload),
  })

  const text = await response.text()
  return {
    ok: response.ok,
    status: response.status,
    body: text,
  }
}

export async function publishBlog(postId: string, force = false): Promise<PublishResult> {
  const calendar = await loadCalendar()
  const queueState = await loadQueueState(
    calendar.calendarId,
    getEditorialKbPath(calendar.criteriaSources.sectorKnowledgeBasePath)
  )
  queueState.kbPath = getEditorialKbPath(calendar.criteriaSources.sectorKnowledgeBasePath)
  const queueItem = findQueueItem(queueState, postId)
  if (!queueItem?.artifactPaths.draftJson) {
    throw new Error(`Draft missing for ${postId}.`)
  }
  if (queueItem.approvalStatus !== 'approved' && !force) {
    throw new Error(`Approval required before publishing blog for ${postId}.`)
  }

  const draftJsonPath = resolveWorkspacePath(queueItem.artifactPaths.draftJson)
  const rawDraft = await import(pathToFileURL(draftJsonPath).href, {
    with: { type: 'json' },
  }).catch(async () => {
    const fs = await import('node:fs/promises')
    const raw = await fs.readFile(draftJsonPath, 'utf8')
    return { default: JSON.parse(raw) as BlogDraftArtifact & PublishableDraftLike }
  })
  const draft = rawDraft.default as BlogDraftArtifact & PublishableDraftLike

  const baseUrl = process.env.BLOG_PUBLISH_BASE_URL?.trim()
  const secret =
    process.env.BLOG_PUBLISH_LOCAL_SECRET?.trim() || process.env.BLOG_PUBLISH_SECRET?.trim()
  const liveRequested = process.env.EDITORIAL_BLOG_PUBLISH_MODE?.trim() === 'live'
  const responseFilePath = path.join(editorialPaths.approvalsDir, `${postId}.blog-publish.json`)
  let mode: PublishMode = 'mock'
  let status: 'published' | 'mock_published' = 'mock_published'

  const payload = toPublishPayload(draft)

  if (liveRequested && baseUrl && secret) {
    const response = await postJson(`${baseUrl.replace(/\/+$/, '')}/api/blog/publish`, payload, {
      Authorization: `Bearer ${secret}`,
    })
    if (!response.ok) {
      throw new Error(`Blog publish failed with ${response.status}: ${response.body}`)
    }
    await writeJsonArtifact(responseFilePath, {
      mode: 'live',
      payload,
      response,
    })
    mode = 'live'
    status = 'published'
  } else {
    await writeJsonArtifact(responseFilePath, {
      mode: 'mock',
      payload,
      note: 'BLOG_PUBLISH_BASE_URL/BLOG_PUBLISH_SECRET absent or live mode not requested.',
    })
  }

  queueItem.blogStatus = status
  if (status === 'published' || status === 'mock_published') {
    queueItem.publishedAt = payload.publishedAt
  }
  queueItem.lastAction = 'publish_blog'
  queueItem.lastActionAt = nowIso()
  upsertQueueItem(queueState, queueItem)
  queueState.updatedAt = queueItem.lastActionAt
  await saveQueueState(queueState)
  await appendEditorialLog({
    timestamp: queueItem.lastActionAt,
    action: 'publish_blog',
    itemId: postId,
    level: mode === 'live' ? 'info' : 'warning',
    detail:
      mode === 'live'
        ? `Blog published for ${postId}.`
        : `Blog publish stored in mock mode for ${postId}.`,
  })

  return {
    mode,
    status,
    responsePath: toWorkspaceRelativePath(responseFilePath),
  }
}

export async function publishLinkedIn(postId: string, force = false): Promise<PublishResult> {
  const calendar = await loadCalendar()
  const queueState = await loadQueueState(
    calendar.calendarId,
    getEditorialKbPath(calendar.criteriaSources.sectorKnowledgeBasePath)
  )
  queueState.kbPath = getEditorialKbPath(calendar.criteriaSources.sectorKnowledgeBasePath)
  const queueItem = findQueueItem(queueState, postId)
  if (!queueItem?.artifactPaths.linkedinJson) {
    throw new Error(`LinkedIn derivatives missing for ${postId}.`)
  }
  if (queueItem.approvalStatus !== 'approved' && !force) {
    throw new Error(`Approval required before publishing LinkedIn for ${postId}.`)
  }

  const fs = await import('node:fs/promises')
  const linkedInJsonPath = resolveWorkspacePath(queueItem.artifactPaths.linkedinJson)
  const raw = await fs.readFile(linkedInJsonPath, 'utf8')
  const artifact = JSON.parse(raw) as LinkedInArtifact

  const endpoint = process.env.LINKEDIN_PUBLISH_ENDPOINT?.trim()
  const token = process.env.LINKEDIN_PUBLISH_TOKEN?.trim()
  const liveRequested = process.env.EDITORIAL_LINKEDIN_PUBLISH_MODE?.trim() === 'live'
  const responseFilePath = path.join(editorialPaths.approvalsDir, `${postId}.linkedin-publish.json`)
  let mode: PublishMode = 'mock'
  let status: 'published' | 'mock_published' = 'mock_published'

  if (liveRequested && endpoint) {
    const response = await postJson(
      endpoint,
      {
        postId,
        variants: artifact.variants,
      },
      token ? { Authorization: `Bearer ${token}` } : {}
    )
    if (!response.ok) {
      throw new Error(`LinkedIn publish failed with ${response.status}: ${response.body}`)
    }
    await writeJsonArtifact(responseFilePath, {
      mode: 'live',
      response,
    })
    mode = 'live'
    status = 'published'
  } else {
    await writeJsonArtifact(responseFilePath, {
      mode: 'mock',
      variants: artifact.variants,
      note: 'LINKEDIN_PUBLISH_ENDPOINT absent or live mode not requested.',
    })
  }

  queueItem.linkedinStatus = status
  queueItem.lastAction = 'publish_linkedin'
  queueItem.lastActionAt = nowIso()
  upsertQueueItem(queueState, queueItem)
  queueState.updatedAt = queueItem.lastActionAt
  await saveQueueState(queueState)
  await appendEditorialLog({
    timestamp: queueItem.lastActionAt,
    action: 'publish_linkedin',
    itemId: postId,
    level: mode === 'live' ? 'info' : 'warning',
    detail:
      mode === 'live'
        ? `LinkedIn published for ${postId}.`
        : `LinkedIn publish stored in mock mode for ${postId}.`,
  })

  return {
    mode,
    status,
    responsePath: toWorkspaceRelativePath(responseFilePath),
  }
}
