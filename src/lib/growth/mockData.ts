import {
  groupGrowthLeads,
  inferGrowthLeadNameFromUrl,
  normalizeGrowthText,
  normalizeGrowthUrl,
  nowIso,
  type GrowthJobRecord,
  type GrowthLeadDraft,
  type GrowthLeadGroups,
  type GrowthLeadRecord,
  type GrowthLeadStatus,
  type GrowthLeadWritePatch,
} from './types'

type GrowthMockState = {
  leads: GrowthLeadRecord[]
  jobs: GrowthJobRecord[]
  loading: boolean
  ready: boolean
}

type GrowthMockLeadSeed = {
  id: string
  name: string
  website: string
  status: GrowthLeadStatus
  source: GrowthLeadRecord['source']
  summary: string | null
  mission: string | null
  painPoints: string | null
  subject: string | null
  draftBody: string | null
  outreachStatus: GrowthLeadRecord['outreach']['status']
  approvedAt?: string | null
  sentAt?: string | null
  lastError?: string | null
  lastMessage?: string | null
  lastMessageAt?: string | null
  createdAt: string
  updatedAt: string
}

let nextMockId = 1
let bootTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

function makeTimestamp(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString()
}

function makeMockLead(seed: GrowthMockLeadSeed): GrowthLeadRecord {
  return {
    id: seed.id,
    name: seed.name,
    website: seed.website,
    status: seed.status,
    source: seed.source,
    context: {
      summary: seed.summary,
      mission: seed.mission,
      painPoints: seed.painPoints,
    },
    outreach: {
      subject: seed.subject,
      draftBody: seed.draftBody,
      status: seed.outreachStatus,
      approvedAt: seed.approvedAt ?? null,
      sentAt: seed.sentAt ?? null,
      lastError: seed.lastError ?? null,
    },
    inbound: {
      lastMessage: seed.lastMessage ?? null,
      lastMessageAt: seed.lastMessageAt ?? null,
    },
    createdAt: seed.createdAt,
    updatedAt: seed.updatedAt,
  }
}

function makeMockJob(seed: Omit<GrowthJobRecord, 'id'> & { id: string }): GrowthJobRecord {
  return seed
}

const initialLeads: GrowthLeadRecord[] = [
  makeMockLead({
    id: 'lead-delta',
    name: 'Fundació Arrels del Delta',
    website: 'https://arrelsdelta.org',
    status: 'pending_review',
    source: 'job',
    summary: 'Organització local que acompanya famílies amb beques alimentàries i suport de barri.',
    mission: "Coordinar suport directe, derivacions i seguiment comunitari amb una sola porta d'entrada.",
    painPoints: 'El web actual explica la missió, però no converteix visites en consultes ni dona continuïtat als contactes.',
    subject: null,
    draftBody: null,
    outreachStatus: 'none',
    createdAt: makeTimestamp(180),
    updatedAt: makeTimestamp(22),
  }),
  makeMockLead({
    id: 'lead-llavor',
    name: 'Cooperativa Llavor Viva',
    website: 'https://llavorviva.coop',
    status: 'pending_review',
    source: 'manual',
    summary: 'Cooperativa amb projectes de proximitat, formacions i una base de socis petita però molt activa.',
    mission: 'Fer créixer la comunitat i activar més suport recurrent sense perdre el to proper.',
    painPoints: 'Les campanyes surten a cop de calendari i després es perden oportunitats de seguiment.',
    subject: null,
    draftBody: null,
    outreachStatus: 'none',
    createdAt: makeTimestamp(210),
    updatedAt: makeTimestamp(64),
  }),
  makeMockLead({
    id: 'lead-taller',
    name: 'Associació Taller Oberta',
    website: 'https://talleroberta.cat',
    status: 'pending_review',
    source: 'job',
    summary: 'Espai cultural i educatiu que combina tallers, acompanyament i activitats per joves.',
    mission: 'Obrir una línia estable de suport per cobrir materials, beques i activitats trimestrals.',
    painPoints: 'Molta energia a la programació, però el relat de captació és dispers i poc persistent.',
    subject: null,
    draftBody: null,
    outreachStatus: 'none',
    createdAt: makeTimestamp(250),
    updatedAt: makeTimestamp(41),
  }),
  makeMockLead({
    id: 'lead-pont-blau',
    name: 'Fundació Pont Blau',
    website: 'https://pontblau.org',
    status: 'approved_for_sending',
    source: 'job',
    summary: "Treballen amb suport socioeducatiu i tenen una base d'aliances molt bona però poc sistematitzada.",
    mission: "Convertir l'interès inicial en relacions útils i una via de suport estable.",
    painPoints: 'Els missatges són correctes però els faltava un angle curt i més directe per fer resposta.',
    subject: 'Una idea concreta per reforçar el suport a Pont Blau',
    draftBody:
      'Hola, he vist el vostre treball socioeducatiu i crec que hi ha una oportunitat clara per convertir més interès en suport estable.\n\nUs podria compartir una proposta curta per fer el primer contacte més fàcil i més accionable?\n\nSi us encaixa, us passo 2-3 idees pensades per al vostre cas concret.',
    outreachStatus: 'draft_ready',
    approvedAt: makeTimestamp(120),
    createdAt: makeTimestamp(260),
    updatedAt: makeTimestamp(16),
  }),
  makeMockLead({
    id: 'lead-ecomuseu',
    name: 'Ecomuseu de la Terra',
    website: 'https://ecomuseudelaterra.cat',
    status: 'approved_for_sending',
    source: 'job',
    summary: 'Projecte patrimonial amb molta sensibilitat territorial i una comunitat molt fidel.',
    mission: 'Obrir suport recurrent per sostenir activitats, visites i manteniment del projecte.',
    painPoints: 'El missatge és bonic però la primera aproximació no acaba de passar el filtre tècnic ni comercial.',
    subject: "Proposta breu per activar més suport a l'Ecomuseu",
    draftBody:
      'Bon dia, us escric perquè el vostre projecte té molt valor i crec que es pot explicar d’una manera més directa perquè generi més resposta.\n\nHe preparat una proposta breu per convertir més visites en converses útils i suport estable.\n\nSi us sembla bé, us la faig arribar avui mateix.',
    outreachStatus: 'send_failed',
    lastError: 'Resend 550: mailbox unavailable. El worker haurà de reintentar-ho.',
    approvedAt: makeTimestamp(95),
    createdAt: makeTimestamp(285),
    updatedAt: makeTimestamp(9),
  }),
  makeMockLead({
    id: 'lead-residencia-clara',
    name: 'Residència Clara',
    website: 'https://residenciaclara.org',
    status: 'contacted',
    source: 'job',
    summary: "Residència amb equip petit, processos molt humans i necessitat d'automatitzar la prospecció.",
    mission: 'Reforçar la captació de suport i establir una conversa comercial clara i amable.',
    painPoints: 'El seguiment és manual i les respostes entren desordenades entre consultes i derivacions.',
    subject: 'Una proposta curta per simplificar la captació de suport',
    draftBody:
      'Hola, he vist el vostre treball i crec que hi ha marge per simplificar la captació de suport sense perdre proximitat.\n\nSi us sembla, us faig arribar una proposta curta i molt concreta per revisar-la ràpidament.',
    outreachStatus: 'sent',
    sentAt: makeTimestamp(54),
    approvedAt: makeTimestamp(72),
    createdAt: makeTimestamp(300),
    updatedAt: makeTimestamp(5),
  }),
  makeMockLead({
    id: 'lead-biblioteca',
    name: 'Biblioteca Veïnal Can Port',
    website: 'https://bibliotecacanport.cat',
    status: 'replied',
    source: 'inbound',
    summary: 'Equip de barri amb sensibilitat comunitària i activitats de xarxa molt actives.',
    mission: 'Mantenir una relació fluida amb entitats veïnes i obrir suport per activitats periòdiques.',
    painPoints: 'Hi havia dubtes sobre pressupost i qui havia de rebre el missatge internament.',
    subject: 'Seguiment de la proposta per la Biblioteca Veïnal',
    draftBody:
      'Hola, gràcies per contestar. Em va bé adaptar la proposta a la vostra realitat i deixar-la encara més clara.\n\nSi us sembla, preparo una versió curta amb dos nivells de resposta perquè la pugueu compartir internament.',
    outreachStatus: 'sent',
    sentAt: makeTimestamp(140),
    approvedAt: makeTimestamp(170),
    lastMessage:
      'Ens ha interessat la proposta, però volem veure primer una versió més curta i entendre millor el retorn esperat.',
    lastMessageAt: makeTimestamp(25),
    createdAt: makeTimestamp(320),
    updatedAt: makeTimestamp(3),
  }),
]

const initialJobs: GrowthJobRecord[] = [
  makeMockJob({
    id: 'job-portal-entitats',
    type: 'prospecting_search',
    prompt:
      'Busca entitats socials i culturals amb web activa però missatge de captació poc clar. Prioritza projectes amb necessitat de suport recurrent.',
    status: 'completed',
    attemptCount: 1,
    claimedAt: makeTimestamp(200),
    claimedBy: 'worker-1',
    resultsAdded: 5,
    lastError: null,
    createdAt: makeTimestamp(220),
    completedAt: makeTimestamp(196),
  }),
  makeMockJob({
    id: 'job-fons-comunitat',
    type: 'prospecting_search',
    prompt:
      'Troba organitzacions amb missió molt clara però amb CTA feble o sense seguiment visible a la web.',
    status: 'failed',
    attemptCount: 2,
    claimedAt: makeTimestamp(80),
    claimedBy: 'worker-1',
    resultsAdded: 0,
    lastError: "Timeout en l'últim lot de resultats. Caldrà reintentar-ho.",
    createdAt: makeTimestamp(90),
    completedAt: null,
  }),
]

let state: GrowthMockState = {
  leads: initialLeads,
  jobs: initialJobs,
  loading: true,
  ready: false,
}

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

function setState(updater: (current: GrowthMockState) => GrowthMockState) {
  state = updater(state)
  emit()
}

export function getGrowthMockState(): GrowthMockState {
  return state
}

export function subscribeGrowthMockState(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function bootstrapGrowthMockState(delayMs = 320) {
  if (state.ready) return

  if (bootTimer) {
    clearTimeout(bootTimer)
  }

  state = {
    ...state,
    loading: true,
  }
  emit()

  bootTimer = setTimeout(() => {
    state = {
      ...state,
      loading: false,
      ready: true,
    }
    bootTimer = null
    emit()
  }, delayMs)
}

function nextLeadId(prefix: string): string {
  nextMockId += 1
  return `${prefix}-${nextMockId}`
}

function createLeadFromUrl(website: string): GrowthLeadRecord {
  const now = nowIso()
  const normalizedWebsite = normalizeGrowthUrl(website)

  return {
    id: nextLeadId('mock-lead'),
    name: normalizeGrowthText(inferGrowthLeadNameFromUrl(normalizedWebsite)),
    website: normalizedWebsite,
    status: 'pending_review',
    source: 'manual',
    context: {
      summary: "Lead afegit manualment per validar el flux d'edició ràpida.",
      mission: "Crear una oportunitat nova i revisar el missatge abans d'enviar-lo.",
      painPoints: "Per ara només hi ha URL i cal completar context abans de l'aprovació.",
    },
    outreach: {
      subject: null,
      draftBody: null,
      status: 'none',
      approvedAt: null,
      sentAt: null,
      lastError: null,
    },
    inbound: {
      lastMessage: null,
      lastMessageAt: null,
    },
    createdAt: now,
    updatedAt: now,
  }
}

function updateLead(leadId: string, updater: (lead: GrowthLeadRecord) => GrowthLeadRecord) {
  setState((current) => ({
    ...current,
    leads: current.leads.map((lead) => (lead.id === leadId ? updater(lead) : lead)),
  }))
}

export function updateGrowthMockLeadDraft(leadId: string, draft: GrowthLeadDraft) {
  const now = nowIso()
  updateLead(leadId, (lead) => ({
    ...lead,
    outreach: {
      ...lead.outreach,
      subject: draft.subject || null,
      draftBody: draft.draftBody || null,
    },
    updatedAt: now,
  }))
}

export function approveGrowthMockLead(leadId: string) {
  const now = nowIso()
  updateLead(leadId, (lead) => ({
    ...lead,
    status: 'approved_for_sending',
    outreach: {
      ...lead.outreach,
      status: 'draft_ready',
      approvedAt: now,
      lastError: null,
    },
    updatedAt: now,
  }))
}

export function discardGrowthMockLead(leadId: string) {
  const now = nowIso()
  updateLead(leadId, (lead) => ({
    ...lead,
    status: 'discarded',
    outreach: {
      ...lead.outreach,
      status: 'none',
      lastError: null,
    },
    updatedAt: now,
  }))
}

export function createGrowthMockJob(prompt: string) {
  const now = nowIso()
  const job: GrowthJobRecord = {
    id: nextLeadId('mock-job'),
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

  setState((current) => ({
    ...current,
    jobs: [job, ...current.jobs],
  }))
}

export function createGrowthMockLead(website: string) {
  const lead = createLeadFromUrl(website)

  setState((current) => ({
    ...current,
    leads: [lead, ...current.leads],
  }))
}

export function getGrowthMockGroups(): GrowthLeadGroups {
  return groupGrowthLeads(state.leads)
}

export function getGrowthMockLeadCount(): number {
  return state.leads.length
}

export function getGrowthMockJobCount(): number {
  return state.jobs.length
}

export function clearGrowthMockData() {
  setState((current) => ({
    ...current,
    leads: [],
    jobs: [],
  }))
}

export function resetGrowthMockData() {
  setState(() => ({
    leads: initialLeads,
    jobs: initialJobs,
    loading: false,
    ready: true,
  }))
}

export function buildGrowthMockLeadPatch(input: GrowthLeadDraft): GrowthLeadWritePatch {
  return {
    'outreach.subject': input.subject || null,
    'outreach.draftBody': input.draftBody || null,
    updatedAt: nowIso(),
  }
}
