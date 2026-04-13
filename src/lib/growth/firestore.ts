import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  type Firestore,
} from 'firebase/firestore'

import {
  inferGrowthLeadNameFromUrl,
  normalizeGrowthText,
  normalizeGrowthUrl,
  nowIso,
  type GrowthJobDoc,
  type GrowthJobRecord,
  type GrowthLeadDoc,
  type GrowthLeadDraft,
  type GrowthLeadGroups,
  type GrowthLeadRecord,
  type GrowthLeadStatus,
  type GrowthLeadWritePatch,
  groupGrowthLeads,
} from './types'

export const GROWTH_LEADS_COLLECTION = 'ops_leads'
export const GROWTH_JOBS_COLLECTION = 'ops_jobs'

export function growthLeadsCollection(firestore: Firestore) {
  return collection(firestore, GROWTH_LEADS_COLLECTION)
}

export function growthJobsCollection(firestore: Firestore) {
  return collection(firestore, GROWTH_JOBS_COLLECTION)
}

export function buildGrowthJobDoc(prompt: string, now = nowIso()): GrowthJobDoc {
  return {
    type: 'prospecting_search',
    prompt: normalizeGrowthText(prompt),
    status: 'queued',
    attemptCount: 0,
    claimedAt: null,
    claimedBy: null,
    resultsAdded: 0,
    lastError: null,
    createdAt: now,
    completedAt: null,
  }
}

export function buildGrowthLeadDraftPatch(input: GrowthLeadDraft, now = nowIso()): GrowthLeadWritePatch {
  return {
    'outreach.subject': input.subject || null,
    'outreach.draftBody': input.draftBody || null,
    updatedAt: now,
  }
}

export function buildGrowthLeadApprovalPatch(now = nowIso()): GrowthLeadWritePatch {
  return {
    status: 'approved_for_sending',
    'outreach.status': 'draft_ready',
    'outreach.approvedAt': now,
    'outreach.lastError': null,
    updatedAt: now,
  }
}

export function buildGrowthLeadDiscardPatch(now = nowIso()): GrowthLeadWritePatch {
  return {
    status: 'discarded',
    'outreach.status': 'none',
    'outreach.lastError': null,
    updatedAt: now,
  }
}

export function buildGrowthLeadManualDoc(input: {
  website: string
  name?: string
  status?: GrowthLeadStatus
  source?: GrowthLeadDoc['source']
  context?: Partial<GrowthLeadDoc['context']>
  outreach?: Partial<GrowthLeadDoc['outreach']>
  now?: string
}): GrowthLeadDoc {
  const now = input.now ?? nowIso()
  const website = normalizeGrowthUrl(input.website)

  return {
    name: normalizeGrowthText(input.name || inferGrowthLeadNameFromUrl(website)),
    website,
    status: input.status ?? 'pending_review',
    source: input.source ?? 'manual',
    context: {
      summary: input.context?.summary ?? null,
      mission: input.context?.mission ?? null,
      painPoints: input.context?.painPoints ?? null,
    },
    outreach: {
      subject: input.outreach?.subject ?? null,
      draftBody: input.outreach?.draftBody ?? null,
      status: input.outreach?.status ?? 'none',
      approvedAt: input.outreach?.approvedAt ?? null,
      sentAt: input.outreach?.sentAt ?? null,
      lastError: input.outreach?.lastError ?? null,
    },
    inbound: {
      lastMessage: null,
      lastMessageAt: null,
    },
    createdAt: now,
    updatedAt: now,
  }
}

export async function fetchGrowthLeads(firestore: Firestore): Promise<GrowthLeadRecord[]> {
  const snapshot = await getDocs(
    query(growthLeadsCollection(firestore), orderBy('updatedAt', 'desc'), limit(200))
  )

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<GrowthLeadRecord, 'id'>),
  }))
}

export async function fetchGrowthJobs(firestore: Firestore): Promise<GrowthJobRecord[]> {
  const snapshot = await getDocs(
    query(growthJobsCollection(firestore), orderBy('createdAt', 'desc'), limit(50))
  )

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<GrowthJobRecord, 'id'>),
  }))
}

export async function fetchGrowthBoard(firestore: Firestore): Promise<{
  leads: GrowthLeadRecord[]
  jobs: GrowthJobRecord[]
  groups: GrowthLeadGroups
}> {
  const [leads, jobs] = await Promise.all([fetchGrowthLeads(firestore), fetchGrowthJobs(firestore)])
  return {
    leads,
    jobs,
    groups: groupGrowthLeads(leads),
  }
}

export async function createGrowthJob(firestore: Firestore, prompt: string): Promise<void> {
  await addDoc(growthJobsCollection(firestore), buildGrowthJobDoc(prompt))
}

export async function createManualGrowthLead(firestore: Firestore, website: string): Promise<void> {
  await addDoc(growthLeadsCollection(firestore), buildGrowthLeadManualDoc({ website }))
}

export async function updateGrowthLeadDraft(
  firestore: Firestore,
  leadId: string,
  draft: GrowthLeadDraft
): Promise<void> {
  await updateDoc(doc(firestore, GROWTH_LEADS_COLLECTION, leadId), buildGrowthLeadDraftPatch(draft))
}

export async function approveGrowthLead(firestore: Firestore, leadId: string): Promise<void> {
  await updateDoc(doc(firestore, GROWTH_LEADS_COLLECTION, leadId), buildGrowthLeadApprovalPatch())
}

export async function discardGrowthLead(firestore: Firestore, leadId: string): Promise<void> {
  await updateDoc(doc(firestore, GROWTH_LEADS_COLLECTION, leadId), buildGrowthLeadDiscardPatch())
}
