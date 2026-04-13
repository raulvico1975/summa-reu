import type { GrowthLeadGroups, GrowthLeadRecord } from '@/lib/growth/types'

export const GROWTH_QUEUE_SLUGS = ['pending', 'ready', 'errors', 'replies', 'contacted', 'discarded'] as const

export type GrowthQueueSlug = (typeof GROWTH_QUEUE_SLUGS)[number]

export type GrowthQueueMeta = {
  title: string
  description: string
  empty: string
}

export const GROWTH_QUEUE_META: Record<GrowthQueueSlug, GrowthQueueMeta> = {
  pending: {
    title: 'Correus per revisar',
    description: 'Leads que necessiten edició humana.',
    empty: 'Tot al dia! No hi ha correus per revisar.',
  },
  ready: {
    title: 'Preparats per enviar',
    description: 'Esborranys aprovats i llestos per enviar.',
    empty: 'Tot net. Cap lead llest per enviar ara mateix.',
  },
  errors: {
    title: "Errors d'enviament",
    description: 'Correus rebotats o dades invàlides.',
    empty: "No hi ha errors d'enviament.",
  },
  replies: {
    title: 'Noves respostes',
    description: "Leads que han contestat a l'outbound.",
    empty: 'Encara no hi ha respostes inbound.',
  },
  contacted: {
    title: 'Contactats (Sense resposta)',
    description: 'Seguiment de correus enviats sense retorn encara.',
    empty: 'No hi ha contactats pendents de seguiment.',
  },
  discarded: {
    title: 'Descartats',
    description: 'Entrades descartades del flux actiu.',
    empty: 'No hi ha leads descartats.',
  },
}

export function isGrowthQueueSlug(value: string): value is GrowthQueueSlug {
  return GROWTH_QUEUE_SLUGS.includes(value as GrowthQueueSlug)
}

export function getAllGrowthLeads(groups: GrowthLeadGroups): GrowthLeadRecord[] {
  return [...groups.pendingReview, ...groups.approvedReady, ...groups.contactedOrReplied, ...groups.discarded]
}

export function getGrowthQueueLeads(queue: GrowthQueueSlug, groups: GrowthLeadGroups): GrowthLeadRecord[] {
  const allLeads = getAllGrowthLeads(groups)

  if (queue === 'pending') {
    return groups.pendingReview
  }

  if (queue === 'ready') {
    return groups.approvedReady.filter((lead) => lead.outreach.status !== 'send_failed')
  }

  if (queue === 'errors') {
    return allLeads.filter((lead) => lead.outreach.status === 'send_failed')
  }

  if (queue === 'replies') {
    return allLeads.filter((lead) => lead.status === 'replied')
  }

  if (queue === 'contacted') {
    return allLeads.filter((lead) => lead.status === 'contacted')
  }

  return allLeads.filter((lead) => lead.status === 'discarded')
}
