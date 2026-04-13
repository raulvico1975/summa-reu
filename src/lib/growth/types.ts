export const GROWTH_LEAD_STATUSES = [
  'discovered',
  'enriched',
  'pending_review',
  'approved_for_sending',
  'contacted',
  'replied',
  'discarded',
] as const

export type GrowthLeadStatus = (typeof GROWTH_LEAD_STATUSES)[number]

export const GROWTH_LEAD_SOURCES = ['manual', 'job', 'inbound'] as const
export type GrowthLeadSource = (typeof GROWTH_LEAD_SOURCES)[number]

export const GROWTH_OUTREACH_STATUSES = ['none', 'draft_ready', 'sending', 'sent', 'send_failed'] as const
export type GrowthOutreachStatus = (typeof GROWTH_OUTREACH_STATUSES)[number]

export const GROWTH_JOB_STATUSES = ['queued', 'processing', 'completed', 'failed'] as const
export type GrowthJobStatus = (typeof GROWTH_JOB_STATUSES)[number]

export type GrowthLeadContext = {
  summary: string | null
  mission: string | null
  painPoints: string | null
}

export type GrowthLeadOutreach = {
  subject: string | null
  draftBody: string | null
  status: GrowthOutreachStatus
  approvedAt: string | null
  sentAt: string | null
  lastError: string | null
}

export type GrowthLeadInbound = {
  lastMessage: string | null
  lastMessageAt: string | null
}

export type GrowthLeadDoc = {
  name: string
  website: string
  status: GrowthLeadStatus
  source: GrowthLeadSource
  context: GrowthLeadContext
  outreach: GrowthLeadOutreach
  inbound: GrowthLeadInbound
  createdAt: string
  updatedAt: string
}

export type GrowthLeadRecord = GrowthLeadDoc & { id: string }

export type GrowthJobDoc = {
  type: 'prospecting_search'
  prompt: string
  status: GrowthJobStatus
  attemptCount: number
  claimedAt: string | null
  claimedBy: string | null
  resultsAdded: number
  lastError: string | null
  createdAt: string
  completedAt: string | null
}

export type GrowthJobRecord = GrowthJobDoc & { id: string }

export type GrowthLeadGroups = {
  pendingReview: GrowthLeadRecord[]
  approvedReady: GrowthLeadRecord[]
  contactedOrReplied: GrowthLeadRecord[]
  discarded: GrowthLeadRecord[]
}

export type GrowthLeadDraft = {
  subject: string
  draftBody: string
}

export type GrowthLeadWritePatch = Record<string, string | number | boolean | null>

export function nowIso(date = new Date()): string {
  return date.toISOString()
}

export function normalizeGrowthText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeGrowthUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function inferGrowthLeadNameFromUrl(value: string): string {
  try {
    const parsed = new URL(normalizeGrowthUrl(value))
    const host = parsed.hostname.replace(/^www\./i, '')
    return host ? host.split('.')[0].replace(/[-_]/g, ' ') : value.trim()
  } catch {
    return value.trim()
  }
}

export function isLeadPendingReview(status: GrowthLeadStatus): boolean {
  return status === 'pending_review'
}

export function isLeadApprovedForSending(status: GrowthLeadStatus): boolean {
  return status === 'approved_for_sending'
}

export function isLeadContactedOrReplied(status: GrowthLeadStatus): boolean {
  return status === 'contacted' || status === 'replied'
}

export function groupGrowthLeads(leads: GrowthLeadRecord[]): GrowthLeadGroups {
  const groups: GrowthLeadGroups = {
    pendingReview: [],
    approvedReady: [],
    contactedOrReplied: [],
    discarded: [],
  }

  for (const lead of leads) {
    if (isLeadPendingReview(lead.status)) {
      groups.pendingReview.push(lead)
      continue
    }

    if (isLeadApprovedForSending(lead.status)) {
      groups.approvedReady.push(lead)
      continue
    }

    if (isLeadContactedOrReplied(lead.status)) {
      groups.contactedOrReplied.push(lead)
      continue
    }

    groups.discarded.push(lead)
  }

  return groups
}
