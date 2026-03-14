/**
 * API Route: Support Bot
 *
 * Deterministic retrieval over KB cards with strict operational guardrails.
 * Auth: verifyIdToken + validateUserMembership + requireOperationalAccess.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getStorage } from 'firebase-admin/storage'
import { ai } from '@/ai/genkit'
import { z } from 'genkit'
import { verifyIdToken, getAdminDb, validateUserMembership, isSuperAdmin } from '@/lib/api/admin-sdk'
import { requireOperationalAccess } from '@/lib/api/require-operational-access'
import { loadGuideContent, type KBCard } from '@/lib/support/load-kb'
import { loadKbCards, serializeKbCacheBustValue } from '@/lib/support/load-kb-runtime'
import { incrementBotQuestionCounters, logBotQuestion, normalizeForHash } from '@/lib/support/bot-question-log'
import { debugRetrieveCard, detectSmallTalkResponse, type KbLang, type RetrievalTraceDiscard } from '@/lib/support/bot-retrieval'
import { orchestrator } from '@/lib/support/engine/orchestrator'
import { buildEmergencyFallback } from '@/lib/support/engine/renderer'
import { extractOperationalSteps, normalizeUiPathsAgainstCatalog } from '@/lib/support/engine/policy'
import { clampTimeout, normalizeAssistantTone, normalizeLang, parseClarifyOptionIds, withTimeout } from '@/lib/support/engine/normalize'
import type { ApiResponse, AssistantTone, InputLang } from '@/lib/support/engine/types'
import guideProjectsCardRaw from '../../../../../docs/kb/cards/guides/guide-projects.json'
import guideAttachDocumentCardRaw from '../../../../../docs/kb/cards/guides/guide-attach-document.json'
import manualMemberPaidQuotasCardRaw from '../../../../../docs/kb/cards/manual/manual-member-paid-quotas.json'

const DEFAULT_REFORMAT_TIMEOUT_MS = 3500
const MIN_REFORMAT_TIMEOUT_MS = 1500
const MAX_REFORMAT_TIMEOUT_MS = 8000
const DEFAULT_INTENT_TIMEOUT_MS = 1800
const MIN_INTENT_TIMEOUT_MS = 800
const MAX_INTENT_TIMEOUT_MS = 4000
const MAX_INTENT_CANDIDATES = 14
const BOT_TRACE_HEADER = 'x-summa-bot-trace'

const CRITICAL_BUNDLED_CARDS = [
  {
    id: 'project-open',
    type: 'howto',
    domain: 'projects',
    risk: 'safe',
    guardrail: 'none',
    answerMode: 'full',
    title: { ca: 'Obrir un projecte', es: 'Abrir un proyecto' },
    intents: {
      ca: ['com s obre un projecte', 'com obro un projecte', 'obrir projecte a summa'],
      es: ['como se abre un proyecto', 'como abro un proyecto', 'abrir proyecto en summa'],
    },
    guideId: null,
    answer: {
      ca: `Ruta dins Summa: Projectes -> Llistat -> Selecciona projecte

Passos exactes:
1. Ves a Dashboard -> Projectes.
2. Revisa el llistat i localitza el projecte pel nom.
3. Clica el projecte per obrir la vista de detall.
4. Dins del detall, tria la pestanya de despeses o pressupost segons la tasca.

Comprovacio final: Veus el nom del projecte a la capcalera i el seu detall carregat sense errors.
Error tipic: Entrar a Moviments en lloc de Projectes i intentar obrir el projecte des d alla.`,
      es: `Ruta en Summa: Proyectos -> Listado -> Selecciona proyecto

Pasos exactos:
1. Ve a Dashboard -> Proyectos.
2. Revisa el listado y localiza el proyecto por nombre.
3. Haz clic en el proyecto para abrir su detalle.
4. Dentro del detalle, elige la pestana de gastos o presupuesto segun tu tarea.

Comprobacion final: Ves el nombre del proyecto en la cabecera y su detalle cargado sin errores.
Error tipico: Entrar en Movimientos en lugar de Proyectos e intentar abrir el proyecto desde alli.`,
    },
    uiPaths: [
      'Projectes -> Llistat -> Selecciona projecte',
      'Proyectos -> Listado -> Selecciona proyecto',
    ],
    needsSnapshot: false,
    keywords: ['projecte', 'obrir', 'llistat', 'despeses', 'proyecto', 'abrir', 'listado', 'gastos'],
    related: [],
    error_key: null,
    symptom: { ca: null, es: null },
  } as KBCard,
  guideProjectsCardRaw as KBCard,
  guideAttachDocumentCardRaw as KBCard,
  manualMemberPaidQuotasCardRaw as KBCard,
]

const HIDDEN_FOR_ORG_CARD_IDS = new Set([
  'fallback-danger-unclear',
  'manual-danger-zone',
  'guide-danger-delete-remittance',
])

type IntentCandidate = {
  id: string
  title: string
  hints: string
}

type PreviousBotContext = {
  previousQuestion?: string
  previousCardId?: string
  previousMode?: 'card' | 'fallback'
  previousClarifyOptionIds?: string[]
  previousWasClarify?: boolean
}

type BotDebugTrace = {
  orgId: string
  kbLang: KbLang
  userRole: string | null
  superAdmin: boolean
  kbSource: 'storage' | 'filesystem'
  version: number
  storageVersion: number | null
  cardsLoaded: number
  cardsAfterCritical: number
  cardsAfterSupportAccess: number
  cardsFilteredOutByAccess: Array<{ cardId: string; reason: string }>
  cardsConsidered: string[]
  allowAiIntent: boolean
  allowAiReformat: boolean
  retrieval: ReturnType<typeof debugRetrieveCard>
  policy: {
    decisionReason?: string
    confidenceBand?: string
    intentType: string
    questionDomain?: string
    specificCaseDetected?: boolean
    trustedOperationalCard: boolean
    selectedAnswerMode: string | null
    selectedCardIdOrFallbackId: string
    selectedCardType: string | null
    selectedCardUiPathsRaw: string[]
    selectedCardUiPathsNormalized: string[]
    invalidUiPath: boolean
    stepsCount: number
    discarded: RetrievalTraceDiscard[]
    clarifyOptions: Array<{ index: 1 | 2 | 3; cardId: string; label: string }>
    finalMode: 'card' | 'fallback'
    finalUiPaths: string[]
  }
}

const BotInputSchema = z.object({
  userQuestion: z.string().describe('The user question in natural language.'),
  rawAnswer: z.string().describe('The raw KB answer content to reformulate.'),
  isGuarded: z.boolean().describe('True if the question is about a sensitive topic (risk=guarded).'),
  isLimited: z.boolean().describe('True if only general guidance should be given (answerMode=limited).'),
  isWarm: z.boolean().describe('True to use a warmer, more human tone.'),
  lang: z.string().describe('Response language: ca or es.'),
  uiPathHint: z.string().describe('Best UI location hint in Summa for this answer.'),
})

const BotOutputSchema = z.object({
  answer: z.string().describe('The reformulated answer for the user.'),
})

const IntentCandidateSchema = z.object({
  id: z.string(),
  title: z.string(),
  hints: z.string(),
})

const IntentInputSchema = z.object({
  userQuestion: z.string().describe('The original user question.'),
  lang: z.string().describe('Language hint: ca or es.'),
  candidates: z.array(IntentCandidateSchema).describe('Shortlisted KB card candidates.'),
})

const IntentOutputSchema = z.object({
  cardId: z.string().describe('Exact candidate id, or empty string if no reliable match.'),
  confidence: z.enum(['high', 'medium', 'low']).describe('Confidence for the selected card.'),
})

const reformatPrompt = ai.definePrompt({
  name: 'supportBotReformat',
  input: { schema: BotInputSchema },
  output: { schema: BotOutputSchema },
  prompt: `Ets l'assistent de Summa Social, una eina de gestió per a ONGs.
Reformata la resposta proporcionada per respondre la pregunta de l'usuari amb claredat i to humà.

REGLES ESTRICTES:
- NO inventis passos nous, contingut extra ni procediments que no estiguin al text original.
- NO parlis de suport humà, reports, formularis ni IDs de seguiment.
- NO donis consells fiscals; només mostra els procediments documentats.
- Pots reordenar, simplificar i fer més llegible el text original.
- Respon sempre en l'idioma indicat ({{lang}}).
- Prioritza la utilitat pràctica: primer què ha de fer ara mateix l'usuari.
{{#if isWarm}}
- Usa un to proper i empàtic, sense ser informal en excés.
- Pots començar amb una frase curta que faci sentir acompanyada la persona usuària.
{{/if}}
{{#if isGuarded}}
- IMPORTANT: Aquesta és una consulta sobre un tema sensible.
{{#if isLimited}}
- Dona NOMÉS orientació general. MAI donis passos operatius concrets.
{{/if}}
{{/if}}

Pregunta de l'usuari:
{{{userQuestion}}}

Contingut de referència:
{{{rawAnswer}}}

Ubicació útil dins Summa (si aplica):
{{{uiPathHint}}}
`,
})

const classifyIntentPrompt = ai.definePrompt({
  name: 'supportBotClassifyIntent',
  input: { schema: IntentInputSchema },
  output: { schema: IntentOutputSchema },
  prompt: `You classify user intent for a support bot.

RULES:
- You MUST select exactly one cardId from candidates, or return empty cardId if no clear fit.
- Never invent IDs.
- Use semantic meaning, not exact wording.
- Prefer operational "how-to" cards over generic fallback behavior.
- If two cards are close, choose the more actionable one.
- confidence must be: high, medium, or low.

User language: {{lang}}
User question:
{{{userQuestion}}}

Candidates:
{{#each candidates}}
- {{id}} | {{title}} | {{hints}}
{{/each}}
`,
})

const INTENT_STOPWORDS = new Set([
  'com', 'que', 'què', 'quin', 'quina', 'quins', 'quines', 'como', 'qué', 'cual', 'cuál',
  'de', 'del', 'dels', 'des', 'la', 'el', 'els', 'les', 'los', 'las', 'un', 'una', 'uns', 'unes',
  'a', 'al', 'als', 'en', 'per', 'por', 'amb', 'con', 'i', 'y', 'o', 'u',
  'es', 'son', 'se', 'me', 'mi', 'my', 'ha', 'he', 'sóc', 'soc', 'soy',
  'puc', 'puedo', 'vull', 'quiero', 'necessito', 'necesito',
  'summa', 'social',
])

function tokenizeIntentText(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(token => token.trim())
    .filter(token => token.length > 2 && !INTENT_STOPWORDS.has(token))
}

function buildIntentCandidates(message: string, lang: KbLang, cards: KBCard[]): IntentCandidate[] {
  const messageTokens = tokenizeIntentText(message)
  if (messageTokens.length === 0) return []

  const messageSet = new Set(messageTokens)
  const scored = cards
    .filter(card => card.type !== 'fallback')
    .map(card => {
      const title = card.title?.[lang] ?? card.title?.ca ?? card.title?.es ?? card.id
      const intents = (card.intents?.[lang] ?? card.intents?.ca ?? card.intents?.es ?? []).slice(0, 6)
      const keywords = (card.keywords ?? []).slice(0, 8)
      const domain = card.domain ?? ''
      const uiPath = (card.uiPaths ?? []).slice(0, 2).join(' · ')

      const bag = [title, ...intents, ...keywords, domain, uiPath].join(' ')
      const cardTokens = new Set(tokenizeIntentText(bag))

      let overlap = 0
      for (const token of messageSet) {
        if (cardTokens.has(token)) {
          overlap += 4
          continue
        }

        for (const cardToken of cardTokens) {
          if (cardToken.startsWith(token) || token.startsWith(cardToken)) {
            overlap += 1
            break
          }
        }
      }

      const normalizedTitle = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      const normalizedMessage = message
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

      if (normalizedTitle && normalizedMessage.includes(normalizedTitle)) {
        overlap += 8
      }

      const hints = [
        intents.slice(0, 3).join(' | '),
        keywords.slice(0, 4).join(' | '),
        uiPath,
      ].filter(Boolean).join(' | ')

      return {
        id: card.id,
        title,
        hints,
        score: overlap,
      }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, MAX_INTENT_CANDIDATES).map(({ id, title, hints }) => ({ id, title, hints }))
}

async function classifyIntentCard(
  message: string,
  lang: KbLang,
  cards: KBCard[],
  timeoutMs: number
): Promise<{ card: KBCard; confidence: 'high' | 'medium' | 'low' } | null> {
  const candidates = buildIntentCandidates(message, lang, cards)
  if (candidates.length < 2) return null

  const { output } = await withTimeout(
    classifyIntentPrompt({
      userQuestion: message,
      lang,
      candidates,
    }),
    timeoutMs
  )

  const selectedId = output?.cardId?.trim()
  const confidence = output?.confidence ?? 'low'
  if (!selectedId || confidence === 'low') return null
  if (!candidates.some(c => c.id === selectedId)) return null

  const selectedCard = cards.find(card => card.id === selectedId && card.type !== 'fallback')
  if (!selectedCard) return null

  return { card: selectedCard, confidence }
}

function ensureCriticalCardsPresent(cards: KBCard[]): KBCard[] {
  const map = new Map<string, KBCard>()
  for (const card of cards) {
    map.set(card.id, card)
  }

  const hasRenderableSteps = (card: KBCard): boolean => {
    const rawCa = card.guideId
      ? loadGuideContent(card.guideId, 'ca')
      : (card.answer?.ca ?? card.answer?.es ?? '')
    const rawEs = card.guideId
      ? loadGuideContent(card.guideId, 'es')
      : (card.answer?.es ?? card.answer?.ca ?? '')

    return extractOperationalSteps(rawCa).length > 0 || extractOperationalSteps(rawEs).length > 0
  }

  const isUsableCriticalCard = (card: KBCard): boolean => {
    const hasGuide = Boolean(card.guideId && String(card.guideId).trim())
    const hasAnswer = Boolean(card.answer?.ca || card.answer?.es)

    if (card.id.startsWith('guide-')) {
      return hasGuide && !hasAnswer && hasRenderableSteps(card)
    }

    return (hasGuide || hasAnswer) && hasRenderableSteps(card)
  }

  for (const bundled of CRITICAL_BUNDLED_CARDS) {
    const existing = map.get(bundled.id)
    if (!existing || !isUsableCriticalCard(existing)) {
      if (existing) {
        console.warn('[bot] critical card invalid in runtime KB, using bundled fallback', {
          cardId: bundled.id,
        })
      }
      map.set(bundled.id, bundled)
    }
  }

  return Array.from(map.values())
}

function filterCardsForSupportAccess(cards: KBCard[], isSuperAdminUser: boolean): KBCard[] {
  if (isSuperAdminUser) return cards

  return cards.filter(card => {
    if (!card?.id) return false
    if (HIDDEN_FOR_ORG_CARD_IDS.has(card.id)) return false
    if ((card.domain ?? '').toLowerCase() === 'superadmin') return false
    if ((card.guardrail ?? '').toLowerCase() === 'b1_danger') return false
    return true
  })
}

function shouldTraceBotRequest(
  request: NextRequest,
  superAdminUser: boolean,
  body: Record<string, unknown>
): boolean {
  if (!superAdminUser) return false
  if (request.headers.get(BOT_TRACE_HEADER) === '1') return true
  if (request.nextUrl.searchParams.get('trace') === '1') return true
  return body.debugTrace === true
}

async function resolveTraceKbSource(version: number, storageVersion: number | null): Promise<'storage' | 'filesystem'> {
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET

  if (!bucketName) return 'filesystem'
  if (storageVersion !== version) return 'filesystem'

  try {
    const bucket = getStorage().bucket(bucketName)
    const file = bucket.file('support-kb/kb.json')
    const [exists] = await file.exists()
    return exists ? 'storage' : 'filesystem'
  } catch {
    return 'filesystem'
  }
}

function getCardRawAnswer(card: KBCard | null | undefined, kbLang: KbLang): string {
  if (!card) return ''
  if (card.guideId) return loadGuideContent(card.guideId, kbLang)
  return card.answer?.[kbLang] ?? card.answer?.ca ?? card.answer?.es ?? ''
}

function buildPolicyDiscards(input: {
  decisionReason?: string
  confidenceBand?: string
  selectedCard: KBCard | null
  selectedUiPathsRaw: string[]
  selectedUiPathsNormalized: string[]
  stepsCount: number
}): RetrievalTraceDiscard[] {
  const { decisionReason, confidenceBand, selectedCard, selectedUiPathsRaw, selectedUiPathsNormalized, stepsCount } = input
  const selectedCardId = selectedCard?.id ?? 'runtime-fallback'
  const discards: RetrievalTraceDiscard[] = []

  if (selectedUiPathsRaw.length > 0 && selectedUiPathsNormalized.length === 0) {
    discards.push({ cardId: selectedCardId, reason: 'invalid_uiPath' })
  }

  if (stepsCount === 0 && selectedCard?.type !== 'fallback') {
    discards.push({ cardId: selectedCardId, reason: 'no_steps_renderitzables' })
  }

  if (confidenceBand && confidenceBand !== 'high') {
    discards.push({ cardId: selectedCardId, reason: 'low_confidence' })
  }

  if (decisionReason?.includes('sensitive')) {
    discards.push({ cardId: selectedCardId, reason: 'sensitive' })
  }

  if (decisionReason && (
    decisionReason.includes('guardrail') ||
    decisionReason.includes('fallback') ||
    decisionReason.includes('clarify') ||
    decisionReason.includes('navigation')
  )) {
    discards.push({ cardId: selectedCardId, reason: `policy:${decisionReason}` })
  }

  return discards
}

function normalizePreviousBotContext(body: Record<string, unknown>): PreviousBotContext {
  const previousQuestion = typeof body.previousQuestion === 'string' ? body.previousQuestion.trim() : undefined
  const previousCardId = typeof body.previousCardId === 'string' ? body.previousCardId.trim() : undefined
  const previousMode = body.previousMode === 'card' ? 'card' : body.previousMode === 'fallback' ? 'fallback' : undefined
  const previousClarifyOptionIds = parseClarifyOptionIds(body.previousClarifyOptionIds)
  const previousWasClarify = body.previousWasClarify === true

  return {
    previousQuestion: previousQuestion || undefined,
    previousCardId: previousCardId || undefined,
    previousMode,
    previousClarifyOptionIds,
    previousWasClarify,
  }
}

function isClarifySelectionMessage(message: string, previousClarifyOptionIds: string[]): boolean {
  const normalized = message.trim()
  if (!['1', '2', '3'].includes(normalized)) return false
  return previousClarifyOptionIds.length >= 2
}

function tokenizeForSimilarity(message: string): string[] {
  return normalizeForHash(message)
    .split(' ')
    .map(token => token.trim())
    .filter(token => token.length >= 3)
}

function areQueriesSimilar(previousQuestion: string, nextQuestion: string): boolean {
  const previousNormalized = normalizeForHash(previousQuestion)
  const nextNormalized = normalizeForHash(nextQuestion)
  if (!previousNormalized || !nextNormalized || previousNormalized === nextNormalized) return false

  const previousTokens = new Set(tokenizeForSimilarity(previousQuestion))
  const nextTokens = new Set(tokenizeForSimilarity(nextQuestion))
  if (!previousTokens.size || !nextTokens.size) return false

  let overlap = 0
  for (const token of previousTokens) {
    if (nextTokens.has(token)) overlap += 1
  }

  const minSize = Math.min(previousTokens.size, nextTokens.size)
  return overlap >= Math.max(1, Math.ceil(minSize / 2))
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  let kbLang: KbLang = 'ca'
  let inputLang: InputLang = 'ca'
  let hasOperationalAccess = false

  try {
    const authResult = await verifyIdToken(request)
    if (!authResult) {
      return NextResponse.json({ ok: false, code: 'UNAUTHORIZED', message: 'Token invàlid o absent' }, { status: 401 })
    }

    const body = await request.json()
    const { message, lang: rawLang, clarifyOptionIds: rawClarifyOptionIds } = body as {
      message?: string
      lang?: string
      clarifyOptionIds?: unknown
    } & Record<string, unknown>

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ ok: false, code: 'INVALID_INPUT', message: 'message obligatori' }, { status: 400 })
    }

    const parsedLang = normalizeLang(rawLang)
    inputLang = parsedLang.inputLang
    kbLang = parsedLang.kbLang
    const clarifyOptionIds = parseClarifyOptionIds(rawClarifyOptionIds)
    const previousContext = normalizePreviousBotContext(body)

    const db = getAdminDb()
    const userDoc = await db.doc(`users/${authResult.uid}`).get()
    const orgId = userDoc.data()?.organizationId as string | undefined
    if (!orgId) {
      return NextResponse.json({ ok: false, code: 'INVALID_INPUT', message: 'Usuari sense organització assignada' }, { status: 400 })
    }

    const membership = await validateUserMembership(db, authResult.uid, orgId)
    const accessDenied = requireOperationalAccess(membership)
    if (accessDenied) {
      return NextResponse.json({ ok: false, code: 'FORBIDDEN', message: 'Accés denegat' }, { status: 403 })
    }
    hasOperationalAccess = true
    const superAdminUser = await isSuperAdmin(authResult.uid)
    const traceEnabled = shouldTraceBotRequest(request, superAdminUser, body)

    const smallTalk = detectSmallTalkResponse(message, kbLang)
    if (smallTalk) {
      const observabilityWrites: Promise<void>[] = []
      if (previousContext.previousQuestion && previousContext.previousWasClarify && !isClarifySelectionMessage(message, previousContext.previousClarifyOptionIds ?? [])) {
        observabilityWrites.push(incrementBotQuestionCounters(db, orgId, previousContext.previousQuestion, inputLang, {
          clarifyAbandonedCount: 1,
          reformulatedAfterClarifyCount: 1,
        }))
      } else if (
        previousContext.previousQuestion &&
        previousContext.previousMode === 'fallback' &&
        areQueriesSimilar(previousContext.previousQuestion, message)
      ) {
        observabilityWrites.push(incrementBotQuestionCounters(db, orgId, previousContext.previousQuestion, inputLang, {
          reformulatedAfterFallbackCount: 1,
        }))
      }

      void logBotQuestion(db, orgId, message, inputLang, 'fallback', smallTalk.cardId, {
        retrievalConfidence: 'high',
        confidenceBand: 'high',
        decisionReason: 'smalltalk_response',
        intent: 'informational',
        specificCaseDetected: false,
      }).catch(e => console.error('[bot] log error:', e))
      void Promise.all(observabilityWrites).catch(e => console.error('[bot] observability error:', e))

      return NextResponse.json({
        ok: true,
        mode: 'fallback',
        cardId: smallTalk.cardId,
        answer: smallTalk.answer,
        guideId: null,
        uiPaths: [],
      })
    }

    const supportSnap = await db.doc('system/supportKb').get()
    const version = supportSnap.exists ? (supportSnap.data()?.version ?? 0) : 0
    const storageVersion = supportSnap.exists ? (supportSnap.data()?.storageVersion ?? null) : null
    const deletedCardIds = supportSnap.exists && Array.isArray(supportSnap.data()?.deletedCardIds)
      ? (supportSnap.data()?.deletedCardIds as string[]).filter(item => typeof item === 'string')
      : []
    const supportData = supportSnap.data() ?? {}
    const aiIntentEnabled = supportSnap.exists ? (supportData.aiIntentEnabled !== false) : true
    const aiReformatEnabled = supportSnap.exists ? (supportData.aiReformatEnabled !== false) : true
    const assistantTone: AssistantTone = normalizeAssistantTone(supportData.assistantTone)
    const publishedAtKey = serializeKbCacheBustValue(
      supportData.publishedAt ?? supportData.updatedAt ?? supportData.storageUpdatedAt ?? null
    )

    const intentTimeoutMs = clampTimeout(
      supportData.intentTimeoutMs,
      DEFAULT_INTENT_TIMEOUT_MS,
      MIN_INTENT_TIMEOUT_MS,
      MAX_INTENT_TIMEOUT_MS
    )

    const reformatTimeoutMs = clampTimeout(
      supportData.reformatTimeoutMs,
      DEFAULT_REFORMAT_TIMEOUT_MS,
      MIN_REFORMAT_TIMEOUT_MS,
      MAX_REFORMAT_TIMEOUT_MS
    )

    let cards: KBCard[] = []
    try {
      cards = await loadKbCards(version, storageVersion, deletedCardIds, publishedAtKey)
    } catch (cardsError) {
      console.error('[bot] loadKbCards error:', cardsError)
    }

    const criticalCards = ensureCriticalCardsPresent(cards)
    const retrievableCards = filterCardsForSupportAccess(criticalCards, superAdminUser)
    const cardsFilteredOutByAccess = traceEnabled
      ? criticalCards
        .filter(card => !retrievableCards.some(allowed => allowed.id === card.id))
        .map(card => ({
          cardId: card.id,
          reason: HIDDEN_FOR_ORG_CARD_IDS.has(card.id)
            ? 'role_org_filter:hidden_for_org_support_access'
            : (card.domain ?? '').toLowerCase() === 'superadmin'
              ? 'role_org_filter:superadmin_domain'
              : (card.guardrail ?? '').toLowerCase() === 'b1_danger'
                ? 'role_org_filter:danger_guardrail'
                : 'role_org_filter:unknown',
        }))
      : []

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY
    const allowAiIntent = Boolean(apiKey) && aiIntentEnabled
    const allowAiReformat = Boolean(apiKey) && aiReformatEnabled

    const result = await orchestrator({
      message,
      kbLang,
      cards: retrievableCards,
      clarifyOptionIds,
      assistantTone,
      allowAiIntent,
      allowAiReformat,
      classifyIntent: async ({ message: question, lang, cards }) =>
        classifyIntentCard(question, lang, cards, intentTimeoutMs),
      reformat: async input => {
        const { output } = await withTimeout(reformatPrompt(input), reformatTimeoutMs)
        return output?.answer ?? input.rawAnswer
      },
    })

    let responsePayload: ApiResponse | (ApiResponse & { debugTrace?: BotDebugTrace }) = result.response
    if (traceEnabled) {
      const kbSource = await resolveTraceKbSource(version, storageVersion)
      const retrieval = debugRetrieveCard(message, kbLang, retrievableCards)
      const selectedCard = retrievableCards.find(card => card.id === result.response.cardId) ?? null
      const selectedUiPathsRaw = selectedCard?.uiPaths ?? []
      const selectedUiPathsNormalized = normalizeUiPathsAgainstCatalog(selectedUiPathsRaw)
      const stepsCount = extractOperationalSteps(getCardRawAnswer(selectedCard, kbLang)).length
      const policyDiscards = buildPolicyDiscards({
        decisionReason: result.meta.decisionReason,
        confidenceBand: result.meta.confidenceBand,
        selectedCard,
        selectedUiPathsRaw,
        selectedUiPathsNormalized,
        stepsCount,
      })

      responsePayload = {
        ...result.response,
        debugTrace: {
          orgId,
          kbLang,
          userRole: membership.role,
          superAdmin: superAdminUser,
          kbSource,
          version,
          storageVersion,
          cardsLoaded: cards.length,
          cardsAfterCritical: criticalCards.length,
          cardsAfterSupportAccess: retrievableCards.length,
          cardsFilteredOutByAccess,
          cardsConsidered: retrievableCards.map(card => card.id),
          allowAiIntent,
          allowAiReformat,
          retrieval,
          policy: {
            decisionReason: result.meta.decisionReason,
            confidenceBand: result.meta.confidenceBand ?? result.meta.retrievalConfidence,
            intentType: result.meta.intentType,
            questionDomain: result.meta.questionDomain,
            specificCaseDetected: result.meta.specificCaseDetected,
            trustedOperationalCard: result.meta.trustedOperationalCard,
            selectedAnswerMode: selectedCard?.answerMode ?? null,
            selectedCardIdOrFallbackId: result.response.cardId,
            selectedCardType: selectedCard?.type ?? null,
            selectedCardUiPathsRaw: selectedUiPathsRaw,
            selectedCardUiPathsNormalized: selectedUiPathsNormalized,
            invalidUiPath: selectedUiPathsRaw.length > 0 && selectedUiPathsNormalized.length === 0,
            stepsCount,
            discarded: [...retrieval.discarded, ...policyDiscards],
            clarifyOptions: result.response.clarifyOptions ?? [],
            finalMode: result.response.mode,
            finalUiPaths: result.response.uiPaths,
          },
        },
      }
    }

    const observabilityWrites: Promise<void>[] = []
    if (result.response.cardId === 'clarify-disambiguation') {
      observabilityWrites.push(incrementBotQuestionCounters(db, orgId, message, inputLang, {
        clarifyShownCount: 1,
      }))
    }

    if (previousContext.previousQuestion && previousContext.previousWasClarify) {
      if (isClarifySelectionMessage(message, previousContext.previousClarifyOptionIds ?? [])) {
        observabilityWrites.push(incrementBotQuestionCounters(db, orgId, previousContext.previousQuestion, inputLang, {
          clarifySelectedCount: 1,
        }))
      } else {
        observabilityWrites.push(incrementBotQuestionCounters(db, orgId, previousContext.previousQuestion, inputLang, {
          clarifyAbandonedCount: 1,
          reformulatedAfterClarifyCount: 1,
        }))
      }
    } else if (
      previousContext.previousQuestion &&
      previousContext.previousMode === 'fallback' &&
      areQueriesSimilar(previousContext.previousQuestion, message)
    ) {
      observabilityWrites.push(incrementBotQuestionCounters(db, orgId, previousContext.previousQuestion, inputLang, {
        reformulatedAfterFallbackCount: 1,
      }))
    }

    // Formal guardrail signal for observability.
    if (result.meta.intentType === 'operational' && result.response.mode !== 'card') {
      console.info('[bot] operational query answered without card (guardrail-safe)', {
        selectedCardId: result.response.cardId,
        confidence: result.meta.confidenceBand ?? result.meta.retrievalConfidence ?? 'low',
      })
    }

    void logBotQuestion(db, orgId, message, inputLang, result.response.mode, result.response.cardId, {
      bestCardId: result.meta.bestCardId,
      bestScore: result.meta.bestScore,
      secondCardId: result.meta.secondCardId,
      secondScore: result.meta.secondScore,
      retrievalConfidence: result.meta.retrievalConfidence,
      confidenceBand: result.meta.confidenceBand ?? result.meta.retrievalConfidence,
      decisionReason: result.meta.decisionReason,
      intent: result.meta.intentType,
      specificCaseDetected: result.meta.specificCaseDetected,
    }).catch(e => console.error('[bot] log error:', e))
    void Promise.all(observabilityWrites).catch(e => console.error('[bot] observability error:', e))

    if (traceEnabled) {
      console.info('[bot-trace]', JSON.stringify((responsePayload as ApiResponse & { debugTrace?: BotDebugTrace }).debugTrace ?? null))
    }

    return NextResponse.json(responsePayload as ApiResponse, {
      headers: traceEnabled
        ? {
            'x-summa-bot-trace': 'enabled',
          }
        : undefined,
    })
  } catch (error: unknown) {
    console.error('[API] support/bot error:', error)

    if (!hasOperationalAccess) {
      return NextResponse.json(
        { ok: false, code: 'AI_ERROR', message: 'Error intern abans de validar accés' },
        { status: 500 }
      )
    }

    return NextResponse.json(buildEmergencyFallback(kbLang, 'runtime-fallback'))
  }
}
