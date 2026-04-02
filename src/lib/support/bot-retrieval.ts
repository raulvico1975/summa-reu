import { loadGuideContent, type KBCard } from './load-kb'
import { cardMatchesScreenContext, isFollowUpMessage, type SupportContext } from './support-context'

const DIRECT_MATCH_THRESHOLD = 36
const CLARIFY_MIN_SCORE = 24
const CLARIFY_MAX_GAP = 14
const SPECIFIC_CASE_SCORE_PENALTY = 120

export const HIGH_CONFIDENCE: RetrievalConfidence = 'high'
export const MEDIUM_CONFIDENCE: RetrievalConfidence = 'medium'
export const LOW_CONFIDENCE: RetrievalConfidence = 'low'

export type KbLang = 'ca' | 'es'
export type RetrievalConfidence = 'high' | 'medium' | 'low'

export type RetrievalResult = {
  card: KBCard
  mode: 'card' | 'fallback'
  clarifyOptions?: KBCard[]
  bestCardId?: string
  bestScore?: number
  secondCardId?: string
  secondScore?: number
  confidence?: RetrievalConfidence
  confidenceBand?: RetrievalConfidence
  decisionReason?: string
  specificCaseDetected?: boolean
  questionDomain?: QuestionDomain
}

export type RetrievalTraceCandidate = {
  cardId: string
  score: number
  type: KBCard['type']
  answerMode: KBCard['answerMode']
  reason: string
}

export type RetrievalTraceDiscard = {
  cardId: string
  score?: number
  reason: string
}

export type RetrievalDebugTrace = {
  normalizedMessage: string
  tokens: string[]
  questionDomain: QuestionDomain
  specificCaseDetected: boolean
  cardsConsidered: string[]
  directIntent: { cardId: string; minScore: number } | null
  topCandidates: RetrievalTraceCandidate[]
  discarded: RetrievalTraceDiscard[]
  predictedMode: RetrievalResult['mode']
  predictedCardId: string
  predictedDecisionReason?: string
  predictedConfidence?: RetrievalConfidence
}

export type SmallTalkResponse = {
  cardId: string
  answer: string
}

type DirectIntentMatch = {
  cardId: string
  minScore?: number
}

type RetrievalOverride =
  | { kind: 'card'; cardId: string; minScore?: number; decisionReason: string }
  | { kind: 'fallback'; cardId: string; decisionReason: string }

const STOPWORDS = new Set([
  // CA
  'com', 'que', 'quin', 'quina', 'quins', 'quines', 'de', 'del', 'dels', 'la', 'el', 'els', 'les',
  'un', 'una', 'uns', 'unes', 'al', 'als', 'a', 'i', 'o', 'en', 'per', 'amb', 'sense',
  'es', 'mes', 'més', 'entre', 'dun', "d'un", 'sobre', 'fer', 'faig',
  'tinc', 'problema', 'problemes', 'ajuda', 'necessito', 'vull', 'puc', 'pots', 'sisplau', 'siusplau',
  // ES
  'como', 'qué', 'que', 'cual', 'cuál', 'de', 'del', 'la', 'el', 'los', 'las',
  'un', 'una', 'unos', 'unas', 'al', 'a', 'y', 'o', 'en', 'por', 'con', 'sin',
  'es', 'entre', 'sobre', 'hacer',
  'tengo', 'problema', 'problemas', 'ayuda', 'necesito', 'quiero', 'puedo', 'puedes', 'porfavor',
])

const SYNONYM_GROUPS: Array<{ canon: string; variants: string[] }> = [
  { canon: 'certificat', variants: ['certificados', 'certificado', 'certificats', 'certficat', 'certificatio', 'certificados'] },
  { canon: 'donacio', variants: ['donacio', 'donacio', 'donacions', 'donacion', 'donaciones', 'donativo', 'donativos'] },
  { canon: 'soci', variants: ['socis', 'socio', 'socios', 'donant', 'donants', 'donante', 'donantes'] },
  { canon: 'remesa', variants: ['remeses', 'remessa', 'remessas', 'remesas'] },
  { canon: 'dividir', variants: ['divideixo', 'dividir', 'divido', 'divide', 'fraccionar', 'fracciono', 'repartir', 'separar', 'separo', 'desglossar', 'desglosar', 'partir'] },
  { canon: 'desfer', variants: ['desfer', 'desfaig', 'desfem', 'desfeta', 'deshacer', 'deshago', 'anullar', 'anulo', 'anular', 'undo'] },
  { canon: 'importar', variants: ['importo', 'importar', 'importacio', 'importacion', 'importat', 'importada', 'importado', 'carregar', 'carrego', 'cargar', 'cargo', 'pujar', 'pujo', 'subir', 'subo'] },
  { canon: 'extracte', variants: ['extractes', 'extracte', 'extracto', 'extractos', 'moviments', 'movimiento', 'movimientos'] },
  { canon: 'duplicat', variants: ['duplicats', 'duplicat', 'duplicados', 'duplicado', 'repetit', 'repetits', 'repetido', 'repetidos', 'duplicada', 'duplicades', 'duplicadas', 'mateix', 'mateixos', 'mismo', 'mismos'] },
  { canon: 'devolucio', variants: ['devolucions', 'devolucion', 'devoluciones', 'retorn', 'retorns', 'retorno', 'retornos', 'rebutjada', 'rechazo', 'devuelto', 'devueltos', 'tornat', 'tornats', 'vuelto', 'vueltos'] },
  { canon: 'crear', variants: ['crear', 'creo', 'crea', 'nou', 'nova', 'nueva', 'nuevo', 'afegir', 'afegeixo', 'añadir', 'anadir', 'anado', 'agregar', 'alta', 'introduir', 'introdueixo', 'introducir', 'introduzco'] },
  { canon: 'document', variants: ['document', 'documents', 'factura', 'factures', 'facturas', 'rebut', 'rebuts', 'recibo', 'recibos', 'justificant', 'justificante', 'nomina', 'nomines', 'nómina', 'archivo', 'archivos'] },
  { canon: 'contrasenya', variants: ['contrasenya', 'contraseña', 'contrasena', 'password', 'clau'] },
  { canon: 'historial', variants: ['historial', 'resum', 'resumen', 'summary'] },
  { canon: 'entrar', variants: ['entrar', 'entro', 'accedir', 'accedo', 'acceso', 'login', 'sessio', 'sesion', 'iniciar', 'inicio'] },
  { canon: 'fitxer', variants: ['fitxer', 'fitxers', 'fichero', 'ficheros', 'archivo', 'archivos', 'detalle', 'detall'] },
  { canon: 'correcte', variants: ['correcte', 'correctament', 'correcto', 'correctamente', 'quadra', 'cuadra', 'resum', 'resumen', 'previsualitzacio', 'previsualizacion', 'confirmar', 'confirmo'] },
  { canon: 'imputar', variants: ['imputo', 'imputar', 'imputacio', 'imputacion', 'prorratejar', 'prorratear', 'prorrateo', 'distribuir'] },
  { canon: 'projecte', variants: ['projectes', 'proyecto', 'proyectos'] },
  { canon: 'despesa', variants: ['despeses', 'despesses', 'gasto', 'gastos'] },
  { canon: 'moviment', variants: ['moviments', 'movimiento', 'movimientos'] },
  { canon: 'banc', variants: ['banco', 'compte', 'cuenta', 'iban'] },
  { canon: 'quota', variants: ['quotes', 'cuota', 'cuotas'] },
]

const COMMON_TYPO_MAP: Record<string, string> = {
  remessa: 'remesa',
  remessas: 'remesa',
  remeses: 'remeses',
  remesaa: 'remesa',
  certficat: 'certificat',
  certficats: 'certificats',
  despesses: 'despeses',
  proytecto: 'proyecto',
  movimients: 'moviments',
}

const TOKEN_CANONICAL_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const group of SYNONYM_GROUPS) {
    map[group.canon] = group.canon
    for (const variant of group.variants) {
      map[variant] = group.canon
    }
  }
  return map
})()

function normalizePlain(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const SPECIFIC_CASE_PATTERNS = [
  /aquesta remesa/,
  /aquesta factura/,
  /el meu donant/,
  /no em quadra/,
  /a mi em surt/,
  /no em surt/,
  /aquesta transaccio/,
  /esta remesa/,
  /esta factura/,
  /mi donante/,
  /no me cuadra/,
  /a mi me sale/,
  /no me sale/,
  /esta transaccion/,
]

export function detectSpecificCase(query: string): boolean {
  const normalized = normalizePlain(query)
  if (!normalized) return false
  return SPECIFIC_CASE_PATTERNS.some(pattern => pattern.test(normalized))
}

export function detectSmallTalkResponse(message: string, lang: KbLang): SmallTalkResponse | null {
  const normalized = normalizePlain(message)
  if (!normalized) return null

  const cleaned = normalized.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!cleaned) return null
  const tokens = cleaned.split(' ').filter(Boolean)
  if (!tokens.length) return null
  const padded = ` ${cleaned} `

  const hasAnyPhrase = (phrases: string[]): boolean =>
    phrases.some(phrase => padded.includes(` ${phrase} `))

  const greetingPhrases = [
    'hola', 'bon dia', 'bona tarda', 'bona nit', 'hey', 'hi', 'hello', 'ei',
    'buenos dias', 'buenas tardes', 'buenas noches',
  ]
  if (tokens.length <= 10 && hasAnyPhrase(greetingPhrases)) {
    return {
      cardId: 'smalltalk-greeting',
      answer: lang === 'es'
        ? 'Hola! Soy el asistente de Summa Social. Te puedo ayudar con dudas de donantes, movimientos, remesas, modelos fiscales y proyectos. ¿Qué quieres hacer ahora?'
        : 'Hola! Soc l’assistent de Summa Social. Et puc ajudar amb dubtes de donants, moviments, remeses, models fiscals i projectes. Què vols fer ara?',
    }
  }

  if (hasAnyPhrase(['gracies', 'gracies molt', 'moltes gracies', 'merci', 'gracias', 'muchas gracias', 'thanks'])) {
    return {
      cardId: 'smalltalk-thanks',
      answer: lang === 'es'
        ? 'De nada! Cuando quieras, cuéntame qué estás intentando hacer y te guío paso a paso.'
        : 'De res! Quan vulguis, explica’m què estàs intentant fer i et guio pas a pas.',
    }
  }

  if (tokens.length <= 6 && hasAnyPhrase(['ok', 'd acord', 'vale', 'perfecte', 'perfecto', 'genial', 'entes', 'entesos', 'entendido'])) {
    return {
      cardId: 'smalltalk-ack',
      answer: lang === 'es'
        ? 'Perfecto. Cuando quieras, dime el siguiente paso que necesitas y te ayudo.'
        : 'Perfecte. Quan vulguis, digue’m el següent pas que necessites i t’ajudo.',
    }
  }

  if (hasAnyPhrase(['adeu', 'fins aviat', 'fins despres', 'bye', 'adios', 'hasta luego'])) {
    return {
      cardId: 'smalltalk-bye',
      answer: lang === 'es'
        ? 'Hasta luego! Si más tarde necesitas ayuda con Summa Social, aquí estaré.'
        : 'Fins aviat! Si després necessites ajuda amb Summa Social, aquí em tens.',
    }
  }

  if (hasAnyPhrase(['qui ets', 'que ets', 'qui eres', 'quien eres', 'que puedes hacer', 'que pots fer'])) {
    return {
      cardId: 'smalltalk-about',
      answer: lang === 'es'
        ? 'Soy el asistente de Summa Social. Te ayudo a resolver dudas de uso de la app y a llevarte al procedimiento o manual correcto.'
        : 'Soc l’assistent de Summa Social. T’ajudo a resoldre dubtes d’ús de l’app i a portar-te al procediment o manual correcte.',
    }
  }

  if (hasAnyPhrase(['com estas', 'que tal', 'como estas'])) {
    return {
      cardId: 'smalltalk-status',
      answer: lang === 'es'
        ? 'Muy bien, gracias! Preparado para ayudarte con Summa Social. ¿Qué necesitas?'
        : 'Molt bé, gràcies! Preparat per ajudar-te amb Summa Social. Què necessites?',
    }
  }

  return null
}

function canonicalizeToken(token: string): string {
  const normalizedRaw = normalizePlain(token)
  const normalized = COMMON_TYPO_MAP[normalizedRaw] ?? normalizedRaw
  if (!normalized) return normalized

  if (TOKEN_CANONICAL_MAP[normalized]) return TOKEN_CANONICAL_MAP[normalized]

  // Simple singularització (best-effort).
  if (normalized.length > 4 && normalized.endsWith('es')) {
    const singular = normalized.slice(0, -2)
    if (TOKEN_CANONICAL_MAP[singular]) return TOKEN_CANONICAL_MAP[singular]
  }
  if (normalized.length > 4 && normalized.endsWith('s')) {
    const singular = normalized.slice(0, -1)
    if (TOKEN_CANONICAL_MAP[singular]) return TOKEN_CANONICAL_MAP[singular]
  }

  return normalized
}

function normalize(text: string): string[] {
  const rawTokens = normalizePlain(text)
    .split(/[\s,;:.!?¿¡()\[\]{}"']+/)
    .filter(Boolean)

  const normalized: string[] = []
  for (const rawToken of rawTokens) {
    if (rawToken.length <= 2 || STOPWORDS.has(rawToken)) continue
    const canon = canonicalizeToken(rawToken)
    if (!canon || canon.length <= 2 || STOPWORDS.has(canon)) continue
    normalized.push(canon)
    if (canon.length > 4 && canon.endsWith('s')) {
      normalized.push(canon.slice(0, -1))
    }
  }

  return Array.from(new Set(normalized))
}

function buildTrigrams(text: string): Set<string> {
  const clean = normalizePlain(text).replace(/\s+/g, ' ')
  if (!clean) return new Set()
  if (clean.length < 3) return new Set([clean])
  const out = new Set<string>()
  for (let i = 0; i <= clean.length - 3; i++) {
    out.add(clean.slice(i, i + 3))
  }
  return out
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const item of a) {
    if (b.has(item)) intersection++
  }
  const union = a.size + b.size - intersection
  return union > 0 ? intersection / union : 0
}

function levenshteinDistance(a: string, b: string, maxDistance = 1): number {
  if (a === b) return 0
  if (!a) return b.length
  if (!b) return a.length
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1

  const prev = new Array(b.length + 1).fill(0).map((_, i) => i)

  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    let minInRow = curr[0]

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const val = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      )
      curr.push(val)
      if (val < minInRow) minInRow = val
    }

    if (minInRow > maxDistance) return maxDistance + 1
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]
  }

  return prev[b.length]
}

function isApproxTokenMatch(token: string, candidate: string): boolean {
  if (token === candidate) return true
  if (token.length < 4 || candidate.length < 4) return false
  const maxDistance = Math.min(2, Math.max(1, Math.floor(Math.max(token.length, candidate.length) / 6)))
  if (Math.abs(token.length - candidate.length) > maxDistance) return false
  return levenshteinDistance(token, candidate, maxDistance) <= maxDistance
}

function collectSearchPhrases(card: KBCard, lang: KbLang): string[] {
  const title = normalizePlain(card.title?.[lang] ?? card.title?.ca ?? card.title?.es ?? '')
  const errorKey = normalizePlain(card.error_key ?? '')
  const intents = (card.intents?.[lang] ?? []).map(normalizePlain)
  const keywords = (card.keywords ?? []).map(normalizePlain)
  const uiPaths = (card.uiPaths ?? []).map(normalizePlain)
  const symptom = normalizePlain(card.symptom?.[lang] ?? card.symptom?.ca ?? card.symptom?.es ?? '')
  const domain = normalizePlain(card.domain ?? '')
  const answerText = card.guideId
    ? loadGuideContent(card.guideId, lang)
    : (card.answer?.[lang] ?? card.answer?.ca ?? card.answer?.es ?? '')
  const answerPhrases = answerText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .map(line => line.replace(/^\d+\.\s+/, ''))
    .map(line => line.replace(/^-\s+/, ''))
    .map(line => line.replace(/^(què passa|qué pasa|què fer ara|qué hacer ahora|com comprovar-ho|cómo comprobarlo|abans de continuar|antes de continuar|comprovacio final|comprobacion final)\s*:\s*/i, ''))
    .map(normalizePlain)
    .filter(line => line.length >= 8)
    .filter(line => !['que passa', 'qué pasa', 'que fer ara', 'qué hacer ahora'].includes(line))
    .slice(0, 4)

  return [
    title,
    errorKey,
    symptom,
    domain,
    ...intents,
    ...keywords,
    ...uiPaths,
    ...answerPhrases,
  ].filter(Boolean)
}

function scoreTokenOverlap(tokens: string[], phrases: string[]): number {
  if (!tokens.length || !phrases.length) return 0
  const tokenSet = new Set(tokens)
  const phraseTokenSet = new Set(phrases.flatMap(normalize))

  let overlap = 0
  for (const token of tokenSet) {
    if (phraseTokenSet.has(token)) overlap++
  }
  if (overlap === 0) return 0

  const coverage = overlap / Math.max(1, tokenSet.size)
  return overlap * 12 + Math.round(coverage * 24)
}

function countTokenEvidence(tokens: string[], phrases: string[]): number {
  if (!tokens.length || !phrases.length) return 0
  const tokenSet = new Set(tokens)
  const phraseTokenSet = new Set(phrases.flatMap(normalize))

  let overlap = 0
  for (const token of tokenSet) {
    if (phraseTokenSet.has(token)) {
      overlap++
      continue
    }

    let approxHit = false
    for (const candidate of phraseTokenSet) {
      if (isApproxTokenMatch(token, candidate)) {
        approxHit = true
        break
      }
    }
    if (approxHit) overlap++
  }

  return overlap
}

function scorePhraseSimilarity(normalizedMessage: string, phrases: string[]): number {
  if (!normalizedMessage || !phrases.length) return 0
  const messageTrigrams = buildTrigrams(normalizedMessage)
  let best = 0

  for (const phrase of phrases) {
    const similarity = jaccard(messageTrigrams, buildTrigrams(phrase))
    if (similarity > best) best = similarity
  }

  return Math.round(best * 30)
}

type QuestionDomain = 'fiscal' | 'sepa' | 'remittances' | 'returns' | 'permissions' | 'danger' | 'general'

function normalizeCardDomain(domain: string): string {
  const normalized = normalizePlain(domain)
  if (!normalized) return 'general'
  if (normalized === 'superadmin') return 'danger'
  return normalized
}

function scoreDomainAlignment(questionDomain: QuestionDomain, cardDomainRaw: string): number {
  if (questionDomain === 'general') return 0

  const cardDomain = normalizeCardDomain(cardDomainRaw)
  const preferred: Record<QuestionDomain, string[]> = {
    fiscal: ['fiscal'],
    sepa: ['sepa', 'remittances'],
    remittances: ['remittances', 'sepa'],
    returns: ['remittances', 'sepa'],
    permissions: ['config'],
    danger: ['danger'],
    general: ['general'],
  }

  if (preferred[questionDomain].includes(cardDomain)) return 26
  if (cardDomain === 'general') return -10
  return -32
}

type RetrievalSupportHints = {
  followUp: boolean
  routeHintText: string
  routeTokens: string[]
  conversationHintText: string
  conversationTokens: string[]
  evidenceTokens: string[]
  previousCardId?: string
  supportContext?: SupportContext
}

function uniquePhrases(items: string[], max = 6): string[] {
  return Array.from(new Set(items.map(item => item.trim()).filter(Boolean))).slice(0, max)
}

function buildSupportHints(
  message: string,
  lang: KbLang,
  cards: KBCard[],
  supportContext?: SupportContext
): RetrievalSupportHints {
  const followUp = isFollowUpMessage(message)
  const lexicalTokens = normalize(message)
  const shortQuery = lexicalTokens.length <= 4
  const routeHintText = supportContext?.screen?.routeUiPath ?? ''
  const routeTokens = normalize(routeHintText)
  const conversationPhrases: string[] = []

  if (supportContext && (followUp || shortQuery)) {
    for (const turn of supportContext.recentTurns.slice(-4)) {
      if (turn.role === 'user') {
        conversationPhrases.push(turn.text)
        continue
      }

      if (!turn.cardId) continue
      const card = cards.find(candidate => candidate.id === turn.cardId)
      if (!card) continue

      conversationPhrases.push(card.title?.[lang] ?? card.title?.ca ?? card.title?.es ?? '')
      conversationPhrases.push(...(card.intents?.[lang] ?? card.intents?.ca ?? card.intents?.es ?? []).slice(0, 2))
      conversationPhrases.push(...(card.uiPaths ?? []).slice(0, 1))
    }

    if (supportContext.previousCardId) {
      const previousCard = cards.find(card => card.id === supportContext.previousCardId)
      if (previousCard) {
        conversationPhrases.push(previousCard.title?.[lang] ?? previousCard.title?.ca ?? previousCard.title?.es ?? '')
        conversationPhrases.push(...(previousCard.intents?.[lang] ?? previousCard.intents?.ca ?? previousCard.intents?.es ?? []).slice(0, 2))
        conversationPhrases.push(...(previousCard.uiPaths ?? []).slice(0, 1))
      }
    }
  }

  const conversationHintText = uniquePhrases(conversationPhrases, 8).join(' ')
  const conversationTokens = normalize(conversationHintText)
  const evidenceTokens = uniquePhrases(
    [...lexicalTokens, ...conversationTokens],
    followUp || shortQuery ? 12 : 8
  )

  return {
    followUp,
    routeHintText,
    routeTokens,
    conversationHintText,
    conversationTokens,
    evidenceTokens,
    previousCardId: supportContext?.previousCardId,
    supportContext,
  }
}

function scoreRouteContext(card: KBCard, hints: RetrievalSupportHints): number {
  if (!hints.routeHintText || !cardMatchesScreenContext(card, hints.supportContext?.screen)) return 0
  return 18
}

function scoreConversationContinuity(card: KBCard, hints: RetrievalSupportHints): number {
  const previousCardBoost = hints.previousCardId === card.id
    ? (hints.followUp ? 52 : 18)
    : 0
  const recentCardBoost = hints.supportContext?.recentTurns.some(turn => turn.role === 'bot' && turn.cardId === card.id)
    ? (hints.followUp ? 18 : 6)
    : 0
  return previousCardBoost + recentCardBoost
}

function scoreCard(
  tokens: string[],
  normalizedMessage: string,
  questionDomain: QuestionDomain,
  specificCaseDetected: boolean,
  card: KBCard,
  lang: KbLang,
  hints: RetrievalSupportHints
): number {
  let score = 0
  const intents = (card.intents?.[lang] ?? []).map(normalizePlain).filter(Boolean)
  const title = normalizePlain(card.title?.[lang] ?? '')
  const keywords = (card.keywords ?? []).map(normalizePlain).filter(Boolean)
  const errorKey = normalizePlain(card.error_key ?? '')
  const intentTokens = intents.flatMap(intent => intent.split(' ').filter(Boolean))
  const keywordTokens = keywords.flatMap(kw => kw.split(' ').filter(Boolean))
  const searchPhrases = collectSearchPhrases(card, lang)

  for (const intent of intents) {
    if (intent.length > 3 && normalizedMessage.includes(intent)) {
      score += 90
    }
  }

  for (const keyword of keywords) {
    if (keyword.length > 2 && normalizedMessage.includes(keyword)) {
      score += 35
    }
  }

  if (title && normalizedMessage.includes(title)) {
    score += 45
  }

  if (errorKey && normalizedMessage.includes(errorKey)) {
    score += 20
  }

  for (const token of tokens) {
    for (const intent of intents) {
      if (intent.includes(token)) {
        score += 50
        break
      }
    }

    for (const intentToken of intentTokens) {
      if (isApproxTokenMatch(token, intentToken)) {
        score += 25
        break
      }
    }

    for (const keyword of keywords) {
      if (
        keyword === token ||
        token.includes(keyword) ||
        keyword.includes(token)
      ) {
        score += 20
        break
      }
    }

    for (const keywordToken of keywordTokens) {
      if (isApproxTokenMatch(token, keywordToken)) {
        score += 10
        break
      }
    }

    if (title.includes(token)) {
      score += 10
    }

    if (errorKey) {
      if (errorKey.includes(token) || token.includes(errorKey)) {
        score += 5
      }
    }
  }

  score += scoreTokenOverlap(tokens, searchPhrases)
  score += scorePhraseSimilarity(normalizedMessage, searchPhrases)
  score += Math.round(scoreTokenOverlap(hints.routeTokens, searchPhrases) * 0.35)
  score += Math.round(scoreTokenOverlap(hints.conversationTokens, searchPhrases) * 0.55)
  score += Math.round(scorePhraseSimilarity(hints.conversationHintText, searchPhrases) * 0.45)
  score += scoreDomainAlignment(questionDomain, card.domain ?? '')
  score += scoreRouteContext(card, hints)
  score += scoreConversationContinuity(card, hints)
  if (specificCaseDetected) {
    score -= SPECIFIC_CASE_SCORE_PENALTY
  }

  return score
}

export function inferQuestionDomain(message: string): QuestionDomain {
  const tokens = normalize(message)
  const joined = tokens.join(' ')

  if (/fiscal|182|347|aeat|hisenda|hacienda|certificat|model|modelo|donacio/.test(joined)) {
    return 'fiscal'
  }
  if (/sepa|pain|pain008|pain001|domiciliacio|xml|banc|banco/.test(joined)) {
    return 'sepa'
  }
  if (/devoluci|devolucion|retorn|retorno|rebutjada|rechazo|devuelto/.test(joined)) {
    return 'returns'
  }
  if (/permis|permiso|permisos|acces|acceso|accessos|seguretat|seguridad|rol|roles/.test(joined)) {
    return 'permissions'
  }
  if (/remesa|remesas|remessa|dividir|desglossar|desglosar|processar|procesar|desfer|deshacer/.test(joined)) {
    return 'remittances'
  }
  if (/esborrar|borrar|eliminar|perill|peligro|irreversible|superadmin/.test(joined)) {
    return 'danger'
  }

  return 'general'
}

export function suggestKeywordsFromMessage(message: string, max = 6): string[] {
  return normalize(message).slice(0, max)
}

function detectFallbackDomain(tokens: string[]): string {
  const domain = inferQuestionDomain(tokens.join(' '))
  if (domain === 'fiscal') return 'fallback-fiscal-unclear'
  if (domain === 'sepa') return 'fallback-sepa-unclear'
  if (domain === 'returns') return 'fallback-remittances-unclear'
  if (domain === 'remittances') return 'fallback-remittances-unclear'
  if (domain === 'danger') return 'fallback-danger-unclear'
  return 'fallback-no-answer'
}

function hasToken(tokens: Set<string>, ...candidates: string[]): boolean {
  return candidates.some(candidate => tokens.has(candidate))
}

function detectProtectedOverride(message: string): RetrievalOverride | null {
  const normalized = normalizePlain(message)

  if (/\b(zona de perill|zona de peligro)\b/.test(normalized)) {
    return { kind: 'card', cardId: 'manual-danger-zone', minScore: 720, decisionReason: 'danger_zone_explainer' }
  }

  if (/\b(esborrar|esborro|borrar|borro|eliminar)\b/.test(normalized) && /\bultima\b/.test(normalized) && /\bremesa\b/.test(normalized)) {
    return { kind: 'card', cardId: 'guide-danger-delete-remittance', minScore: 710, decisionReason: 'danger_last_remittance_exact' }
  }

  if (/\b(presento|presentar|declaracio|declaracion)\b/.test(normalized) && /\b(donatius|donativos)\b/.test(normalized) && /\b(hisenda|hacienda|aeat)\b/.test(normalized)) {
    return { kind: 'fallback', cardId: 'fallback-fiscal-unclear', decisionReason: 'fiscal_filing_out_of_scope' }
  }

  if (/\b(comissions?|comisiones?)\b/.test(normalized) && /\bstripe\b/.test(normalized) && /\b182\b/.test(normalized)) {
    return { kind: 'fallback', cardId: 'fallback-fiscal-unclear', decisionReason: 'fiscal_complex_stripe_182' }
  }

  if (/\b(no em surt|no me sale|no sale)\b/.test(normalized) && /\b(donant|donante)\b/.test(normalized) && /\b182\b/.test(normalized)) {
    return { kind: 'card', cardId: 'ts-model-182-donor-missing', minScore: 720, decisionReason: 'specific_case_safe_checklist' }
  }

  if (/\b(anullar|anul[·l]?lar|anular)\b/.test(normalized) && /\bremesa\b/.test(normalized) && /\bsepa\b/.test(normalized)) {
    return { kind: 'fallback', cardId: 'fallback-sepa-unclear', decisionReason: 'sepa_cancellation_ambiguous' }
  }

  if (/\b(envio|enviar|envío)\b/.test(normalized) && /\b(fitxer|archivo|xml)\b/.test(normalized) && /\bsepa\b/.test(normalized) && /\b(error|errors|errores)\b/.test(normalized)) {
    return { kind: 'fallback', cardId: 'fallback-sepa-unclear', decisionReason: 'sepa_external_bank_consequence' }
  }

  if (/\b(dividit|dividida|dividido|dividida|dividir)\b/.test(normalized) && /\bremesa\b/.test(normalized) && /\b(desfer|desfaig|deshacer|deshago)\b/.test(normalized)) {
    return { kind: 'card', cardId: 'guide-split-remittance', minScore: 700, decisionReason: 'split_remittance_followup' }
  }

  return null
}

function detectDirectIntentMatch(tokens: string[]): DirectIntentMatch | null {
  const set = new Set(tokens)

  // "Com canvio la categoria per defecte d'un donant?"
  if (
    hasToken(set, 'categoria') &&
    hasToken(set, 'defecte', 'defecto', 'default') &&
    hasToken(set, 'soci', 'donant', 'socio', 'donante') &&
    hasToken(set, 'canviar', 'canvio', 'cambiar', 'cambio', 'editar', 'edito', 'assignar', 'asignar', 'actualitzar', 'actualizar')
  ) {
    return { cardId: 'howto-donor-default-category', minScore: 690 }
  }

  // "Com modifico l'IBAN d'un soci?"
  if (
    hasToken(set, 'soci', 'donant', 'socio', 'donante') &&
    hasToken(set, 'iban', 'banc', 'banco', 'compte', 'cuenta') &&
    hasToken(set, 'actualitzar', 'actualitzo', 'actualizar', 'actualizo', 'editar', 'edito', 'edit', 'update', 'canviar', 'cambiar', 'cambio', 'modificar', 'modifico')
  ) {
    return { cardId: 'howto-donor-update-iban', minScore: 680 }
  }

  // "Com importo l'extracte del banc?" / "Com carrego els moviments del banc?"
  if (
    hasToken(set, 'importar', 'importo', 'importat', 'carregar', 'carrego', 'cargar', 'cargo', 'pujar', 'pujo', 'subir', 'subo') &&
    hasToken(set, 'extracte', 'extracto', 'moviment', 'moviments', 'movimiento', 'movimientos') &&
    hasToken(set, 'banc', 'banco', 'compte', 'cuenta') &&
    !hasToken(set, 'duplicat', 'duplicats', 'duplicado', 'duplicados', 'repetit', 'repetits', 'repetido', 'repetidos', 'mateix', 'mateixos', 'mismo', 'mismos', 'devolucio', 'devolucions', 'devolucion', 'devoluciones', 'retorn', 'retorno', 'tornat', 'tornats', 'vuelto', 'vueltos')
  ) {
    return { cardId: 'guide-import-movements', minScore: 690 }
  }

  // "Com sé si s'ha importat bé l'extracte?"
  if (
    hasToken(set, 'importar', 'importo', 'importat', 'importado') &&
    hasToken(set, 'extracte', 'extracto', 'moviment', 'moviments', 'movimiento', 'movimientos') &&
    hasToken(set, 'correcte', 'correctament', 'correcto', 'correctamente', 'quadra', 'cuadra', 'resum', 'resumen', 'previsualitzacio', 'previsualizacion', 'confirmar', 'confirmo')
  ) {
    return { cardId: 'guide-import-movements', minScore: 680 }
  }

  // "He importat l'extracte dues vegades" / "No vull duplicats al banc"
  if (
    hasToken(set, 'importar', 'importo', 'importat', 'importado', 'carregar', 'carrego', 'cargar', 'cargo', 'pujar', 'pujo', 'subir', 'subo') &&
    hasToken(set, 'extracte', 'extracto', 'moviment', 'moviments', 'movimiento', 'movimientos') &&
    (
      hasToken(set, 'duplicat', 'duplicats', 'duplicado', 'duplicados', 'repetit', 'repetits', 'repetido', 'repetidos') ||
      hasToken(set, 'mateix', 'mateixos', 'mismo', 'mismos', 'tornar', 'volver', 'repetir')
    )
  ) {
    return { cardId: 'howto-import-safe-duplicates', minScore: 675 }
  }

  // "M'han tornat uns rebuts del banc" / "Com entro devolucions?"
  if (
    hasToken(set, 'devolucio', 'devolucions', 'devolucion', 'devoluciones', 'retorn', 'retorno', 'rebutjada', 'rechazo', 'devuelto') &&
    hasToken(set, 'importar', 'importo', 'importat', 'importado', 'carregar', 'carrego', 'cargar', 'cargo', 'pujar', 'pujo', 'subir', 'subo', 'entrar', 'entro', 'meter', 'meto', 'fitxer', 'fichero', 'archivo', 'detalle', 'detall')
  ) {
    return { cardId: 'howto-import-bank-returns', minScore: 690 }
  }

  // "Tinc devolucions al banc, com les gestiono?"
  if (
    hasToken(set, 'devolucio', 'devolucions', 'devolucion', 'devoluciones', 'retorn', 'retorno', 'impagat', 'impagats', 'devuelto', 'rebut', 'rebuts', 'recibo', 'recibos') &&
    !hasToken(set, 'importar', 'importo', 'importat', 'importado', 'carregar', 'carrego', 'cargar', 'cargo', 'pujar', 'pujo', 'subir', 'subo', 'entrar', 'entro', 'meter', 'meto', 'fitxer', 'fichero', 'archivo', 'detalle', 'detall')
  ) {
    return { cardId: 'guide-returns', minScore: 680 }
  }

  // "Vull donar d'alta un soci nou"
  if (
    hasToken(set, 'soci', 'socio') &&
    hasToken(set, 'crear', 'creo', 'crea', 'alta', 'nou', 'nuevo', 'afegir', 'añadir', 'anadir', 'agregar')
  ) {
    return { cardId: 'howto-member-create', minScore: 685 }
  }

  // "He oblidat la contrasenya"
  if (
    hasToken(set, 'contrasenya', 'contrasena', 'contraseña', 'password', 'reset', 'recuperar', 'oblidat', 'olvidado', 'recordo', 'recuerdo')
  ) {
    return { cardId: 'guide-reset-password', minScore: 690 }
  }

  // "Com veig l'historial d'un soci?"
  if (
    hasToken(set, 'soci', 'donant', 'socio', 'donante') &&
    hasToken(set, 'historial', 'resum', 'resumen', 'summary') &&
    !hasToken(set, 'canviar', 'cambiar', 'modificar', 'editar', 'actualitzar', 'actualizar')
  ) {
    return { cardId: 'howto-donor-history-summary', minScore: 680 }
  }

  // "Com actualitzo les dades d'un donant?" / "Editar fitxa donant"
  if (
    hasToken(set, 'soci', 'donant', 'socio', 'donante') &&
    hasToken(set, 'actualitzar', 'actualitzo', 'actualizar', 'actualizo', 'editar', 'edito', 'edit', 'update', 'canviar', 'cambiar', 'cambio', 'modificar', 'modifico') &&
    !hasToken(set, 'quota', 'cuota', 'periodicitat', 'periodicidad', 'iban', 'banc', 'banco', 'compte', 'cuenta', 'historial', 'pagat', 'pagar', 'alta', 'baja', 'baixa', 'inactiu', 'inactivo', 'categoria', 'defecte', 'defecto', 'default')
  ) {
    return { cardId: 'howto-donor-update-details', minScore: 680 }
  }

  // "Com canvio els permisos d'un usuari?"
  if (
    hasToken(set, 'canviar', 'canvio', 'cambiar', 'cambio', 'modificar', 'modifico', 'editar', 'actualitzar', 'actualizar') &&
    hasToken(set, 'permis', 'permiso', 'permisos', 'rol', 'roles') &&
    hasToken(set, 'usuari', 'usuario', 'user')
  ) {
    return { cardId: 'howto-member-user-permissions', minScore: 680 }
  }

  // "Com canvio de mes per veure moviments anteriors?"
  if (
    hasToken(set, 'canviar', 'canvio', 'cambiar', 'cambio') &&
    hasToken(set, 'moviment', 'moviments', 'movimiento', 'movimientos') &&
    hasToken(set, 'anterior', 'anteriors', 'anteriores', 'periode', 'periodo')
  ) {
    return { cardId: 'guide-change-period', minScore: 670 }
  }

  // "Com edito un moviment?"
  if (
    hasToken(set, 'editar', 'edito', 'edit', 'actualitzar', 'actualizar', 'modificar', 'modifico') &&
    hasToken(set, 'moviment', 'moviments', 'movimiento', 'movimientos') &&
    !hasToken(set, 'document', 'factura', 'rebut', 'recibo')
  ) {
    return { cardId: 'guide-edit-movement', minScore: 670 }
  }

  // "Com gestiono els accessos i permisos?"
  if (
    hasToken(set, 'acces', 'acceso', 'permis', 'permiso', 'permisos', 'rol', 'roles', 'seguretat', 'seguridad') &&
    !hasToken(set, 'contrasenya', 'contrasena', 'contraseña', 'password', 'usuari', 'usuario', 'user')
  ) {
    return { cardId: 'guide-access-security', minScore: 670 }
  }

  // "Com introdueixo una nova despesa?"
  if (
    hasToken(set, 'despesa', 'gasto') &&
    hasToken(set, 'crear', 'creo', 'crea', 'nou', 'nova', 'nuevo', 'nueva', 'afegir', 'afegeixo', 'añadir', 'anadir', 'agregar', 'introduir', 'introdueixo', 'introducir', 'introduzco', 'entrar', 'entro', 'meter', 'meto') &&
    !hasToken(set, 'projecte', 'proyecto', 'imputar', 'repartir', 'dividir', 'remesa', 'sepa', 'devolucio', 'devolucion', 'retorn', 'retorno')
  ) {
    return { cardId: 'howto-enter-expense', minScore: 690 }
  }

  // "La remesa no quadra"
  if (
    hasToken(set, 'remesa') &&
    hasToken(set, 'correcte', 'correcto', 'quadra', 'cuadra')
  ) {
    return { cardId: 'ts-remittance-not-matching', minScore: 690 }
  }

  // "Com desfer una remesa?" / "Puc reprocessar una remesa?"
  if (
    hasToken(set, 'desfer', 'desfaig', 'deshacer', 'deshago', 'anullar', 'anulo', 'anular', 'reprocessar', 'reprocesar', 'undo') &&
    hasToken(set, 'remesa')
  ) {
    return { cardId: 'howto-remittance-undo', minScore: 680 }
  }

  // "Per què no surt un soci a la remesa?"
  if (
    hasToken(set, 'remesa') &&
    hasToken(set, 'soci', 'donant', 'socio', 'donante') &&
    hasToken(set, 'surt', 'sale', 'apareix', 'aparece', 'falten', 'faltan')
  ) {
    return { cardId: 'ts-remittance-member-not-identified', minScore: 685 }
  }

  // "Com generar una remesa SEPA?"
  if (
    hasToken(set, 'generar', 'crear', 'creo', 'genera', 'treure', 'sacar') &&
    hasToken(set, 'remesa') &&
    hasToken(set, 'sepa', 'cobrament', 'cobro')
  ) {
    return { cardId: 'howto-remittance-create-sepa', minScore: 680 }
  }

  // "Com canvio la quota d'un soci?"
  if (
    hasToken(set, 'canviar', 'canvio', 'cambiar', 'cambio', 'modificar', 'modifico', 'editar', 'actualitzar', 'actualizar') &&
    hasToken(set, 'quota', 'cuota', 'periodicitat', 'periodicidad') &&
    hasToken(set, 'soci', 'donant', 'socio', 'donante')
  ) {
    return { cardId: 'howto-donor-update-fee', minScore: 680 }
  }

  // "Com trec/genero el model 182?"
  if (
    hasToken(set, '182') &&
    hasToken(set, 'generar', 'genero', 'crear', 'presentar', 'treure', 'trec', 'sacar', 'exportar')
  ) {
    return { cardId: 'guide-model-182-generate', minScore: 680 }
  }

  // "No puc entrar"
  if (
    hasToken(set, 'entrar', 'accedir', 'login', 'sessio', 'sesion', 'contrasenya', 'contrasena', 'password') &&
    !hasToken(set, 'projecte', 'proyecto')
  ) {
    return { cardId: 'manual-login-access', minScore: 660 }
  }

  // "Tinc problemes per dividir una remesa"
  if (
    hasToken(set, 'dividir', 'separar', 'repartir') &&
    hasToken(set, 'remesa', 'quota', 'cuota')
  ) {
    return { cardId: 'guide-split-remittance', minScore: 650 }
  }

  // "Com s'obre un projecte?" / "Como abrir un proyecto?"
  if (
    hasToken(set, 'obrir', 'obre', 'obro', 'abrir', 'abre', 'abro', 'entrar', 'accedir', 'accede') &&
    hasToken(set, 'projecte', 'proyecto')
  ) {
    return { cardId: 'project-open', minScore: 650 }
  }

  // "Com creo un projecte?" / "Como crear un proyecto?"
  if (
    hasToken(set, 'crear', 'creo', 'crea', 'alta', 'nou', 'nuevo') &&
    hasToken(set, 'projecte', 'proyecto')
  ) {
    return { cardId: 'guide-projects', minScore: 620 }
  }

  // "Com imputo una despesa a diferents projectes?"
  if (
    hasToken(set, 'imputar', 'repartir', 'distribuir') &&
    hasToken(set, 'despesa', 'gasto') &&
    hasToken(set, 'projecte', 'proyecto') &&
    !hasToken(set, 'llistat', 'falten', 'surten', 'filtre')
  ) {
    return { cardId: 'guide-projects', minScore: 600 }
  }

  // "Com pujo una factura o rebut o nomina?"
  if (
    hasToken(set, 'pujar', 'pujo', 'subir', 'subo', 'importar', 'importo', 'adjuntar', 'adjunto', 'vincular', 'arrossegar', 'arrastrar') &&
    hasToken(set, 'factura', 'factures', 'facturas', 'document', 'documents', 'rebut', 'rebuts', 'recibo', 'recibos', 'nomina', 'nomines')
  ) {
    return { cardId: 'guide-attach-document', minScore: 600 }
  }

  // "Com puc saber les quotes que un soci ha pagat?"
  if (
    hasToken(set, 'quote', 'quota', 'pagat', 'pagar', 'historial', 'aportacio') &&
    hasToken(set, 'soci', 'donant') &&
    !hasToken(set, 'canviar', 'canvio', 'cambiar', 'cambio', 'modificar', 'editar', 'actualitzar', 'actualizar')
  ) {
    return { cardId: 'manual-member-paid-quotas', minScore: 500 }
  }

  return null
}

function detectFollowUpDirectIntent(currentTokens: string[], contextTokens: string[]): DirectIntentMatch | null {
  if (currentTokens.length === 0 || contextTokens.length === 0) return null

  const currentSet = new Set(currentTokens)
  const contextSet = new Set(contextTokens)

  if (
    hasToken(currentSet, 'desfer', 'desfaig', 'deshacer', 'deshago', 'anullar', 'anulo', 'anular', 'undo') &&
    hasToken(contextSet, 'remesa')
  ) {
    return { cardId: 'howto-remittance-undo', minScore: 705 }
  }

  if (
    hasToken(currentSet, 'editar', 'edito', 'edit', 'modificar', 'modifico', 'actualitzar', 'actualizar') &&
    hasToken(contextSet, 'moviment', 'movimiento')
  ) {
    return { cardId: 'guide-edit-movement', minScore: 690 }
  }

  if (
    hasToken(currentSet, 'pujar', 'pujo', 'subir', 'subo', 'adjuntar', 'adjunto') &&
    hasToken(contextSet, 'document', 'factura', 'rebut', 'recibo', 'nomina')
  ) {
    return { cardId: 'guide-attach-document', minScore: 690 }
  }

  if (
    hasToken(currentSet, 'importar', 'importo', 'carregar', 'carrego', 'cargar', 'cargo') &&
    hasToken(contextSet, 'extracte', 'extracto', 'moviment', 'movimiento', 'banc', 'banco')
  ) {
    return { cardId: 'guide-import-movements', minScore: 690 }
  }

  if (
    hasToken(currentSet, 'canviar', 'canvio', 'cambiar', 'cambio', 'editar', 'edito', 'actualitzar', 'actualizar') &&
    hasToken(contextSet, 'permis', 'permiso', 'permisos', 'rol', 'roles') &&
    hasToken(contextSet, 'usuari', 'usuario', 'user')
  ) {
    return { cardId: 'howto-member-user-permissions', minScore: 690 }
  }

  return null
}

function buildRetrievalConfidence(bestScore = 0, secondScore = 0): RetrievalConfidence {
  const gap = bestScore - secondScore
  if (bestScore >= 56 && gap >= 14) return HIGH_CONFIDENCE
  if (bestScore >= DIRECT_MATCH_THRESHOLD) return MEDIUM_CONFIDENCE
  return LOW_CONFIDENCE
}

function findGenericFallback(cards: KBCard[]): KBCard | null {
  return cards.find(c => c.id === 'fallback-no-answer') ?? null
}

function isRetrievableCard(card: KBCard): boolean {
  if (card.type === 'fallback') return false
  // Safety: ignore only guide cards that truly have no renderable content.
  if (card.id.startsWith('guide-') && !card.guideId && !card.answer?.ca && !card.answer?.es) return false
  return true
}

function hasMinimumEvidenceForDirectMatch(tokens: string[], card: KBCard, lang: KbLang): boolean {
  if (tokens.length === 0) return false
  const overlap = countTokenEvidence(tokens, collectSearchPhrases(card, lang))
  if (tokens.length <= 2) return overlap >= 1
  if (tokens.length <= 4) return overlap >= 1
  return overlap >= 2
}

export function retrieveCard(
  message: string,
  lang: KbLang,
  cards: KBCard[],
  supportContext?: SupportContext
): RetrievalResult {
  const tokens = normalize(message)
  const normalizedMessage = normalizePlain(message)
  const hints = buildSupportHints(message, lang, cards, supportContext)
  const contextualQuestion = hints.followUp && hints.conversationHintText
    ? `${message} ${hints.conversationHintText}`
    : message
  const questionDomain = inferQuestionDomain(contextualQuestion)
  const specificCaseDetected = detectSpecificCase(message)
  const evidenceTokens = hints.evidenceTokens.length > 0 ? hints.evidenceTokens : tokens

  const override = detectProtectedOverride(message)
  if (override) {
    const matchedCard = cards.find(card => card.id === override.cardId)
    if (matchedCard) {
      return {
        card: matchedCard,
        mode: override.kind === 'fallback' ? 'fallback' : 'card',
        bestCardId: matchedCard.id,
        bestScore: override.kind === 'card' ? (override.minScore ?? 999) : 0,
        secondCardId: undefined,
        secondScore: 0,
        confidence: HIGH_CONFIDENCE,
        confidenceBand: HIGH_CONFIDENCE,
        decisionReason: override.decisionReason,
        specificCaseDetected,
        questionDomain,
      }
    }
  }

  const followUpDirectIntent = specificCaseDetected ? null : detectFollowUpDirectIntent(tokens, hints.conversationTokens)
  const directIntent = specificCaseDetected ? null : detectDirectIntentMatch(tokens)
  const resolvedDirectIntent = followUpDirectIntent ?? directIntent

  if (resolvedDirectIntent) {
    const directCard = cards.find(card => card.id === resolvedDirectIntent.cardId)
    if (directCard) {
      return {
        card: directCard,
        mode: 'card',
        bestCardId: directCard.id,
        bestScore: resolvedDirectIntent.minScore ?? 999,
        secondCardId: undefined,
        secondScore: 0,
        confidence: HIGH_CONFIDENCE,
        confidenceBand: HIGH_CONFIDENCE,
        decisionReason: followUpDirectIntent ? 'follow_up_direct_intent' : 'direct_intent_high_confidence',
        specificCaseDetected,
        questionDomain,
      }
    }
  }

  const regularCards = cards.filter(isRetrievableCard)
  const ranked = regularCards
    .map(card => ({
      card,
      score: scoreCard(tokens, normalizedMessage, questionDomain, specificCaseDetected, card, lang, hints),
    }))
    .sort((a, b) => b.score - a.score)

  const best = ranked[0]
  const second = ranked[1]
  const bestScore = best?.score ?? 0
  const secondScore = second?.score ?? 0
  const confidence = buildRetrievalConfidence(bestScore, secondScore)
  const baseMeta = {
    bestCardId: best?.card.id,
    bestScore,
    secondCardId: second?.card.id,
    secondScore,
    confidence,
    confidenceBand: confidence,
    specificCaseDetected,
    questionDomain,
  } satisfies Omit<RetrievalResult, 'card' | 'mode'>

  if (
    best &&
    confidence === HIGH_CONFIDENCE &&
    bestScore >= DIRECT_MATCH_THRESHOLD &&
    hasMinimumEvidenceForDirectMatch(evidenceTokens, best.card, lang)
  ) {
    return {
      card: best.card,
      mode: 'card',
      ...baseMeta,
      bestCardId: best.card.id,
      decisionReason: specificCaseDetected
        ? 'specific_case_penalty_but_high_confidence'
        : 'high_confidence_match',
      }
  }

  if (
    best &&
    confidence === MEDIUM_CONFIDENCE &&
    bestScore >= DIRECT_MATCH_THRESHOLD &&
    hasMinimumEvidenceForDirectMatch(evidenceTokens, best.card, lang) &&
    (!second || secondScore < CLARIFY_MIN_SCORE || bestScore - secondScore > CLARIFY_MAX_GAP)
  ) {
    return {
      card: best.card,
      mode: 'card',
      ...baseMeta,
      bestCardId: best.card.id,
      decisionReason: specificCaseDetected
        ? 'specific_case_medium_confidence_card'
        : 'medium_confidence_card',
    }
  }

  if (
    best &&
    second &&
    confidence === MEDIUM_CONFIDENCE &&
    bestScore >= CLARIFY_MIN_SCORE &&
    secondScore >= CLARIFY_MIN_SCORE &&
    bestScore - secondScore <= CLARIFY_MAX_GAP
  ) {
    const genericFallback = findGenericFallback(cards)
    if (genericFallback) {
      return {
        card: genericFallback,
        mode: 'fallback',
        clarifyOptions: [best.card, second.card],
        ...baseMeta,
        bestCardId: best.card.id,
        secondCardId: second.card.id,
        decisionReason: specificCaseDetected
          ? 'specific_case_disambiguation'
          : 'medium_confidence_disambiguation',
      }
    }
  }

  const fallbackId = detectFallbackDomain(tokens)
  const fallbackCard = cards.find(c => c.id === fallbackId)
  if (fallbackCard) {
    return {
      card: fallbackCard,
      mode: 'fallback',
      ...baseMeta,
      decisionReason: specificCaseDetected
        ? 'specific_case_fallback'
        : confidence === MEDIUM_CONFIDENCE
          ? 'medium_confidence_fallback'
          : 'low_confidence_fallback',
    }
  }

  const genericFallback = findGenericFallback(cards)
  if (genericFallback) {
    return {
      card: genericFallback,
      mode: 'fallback',
      ...baseMeta,
      decisionReason: specificCaseDetected
        ? 'specific_case_fallback'
        : confidence === MEDIUM_CONFIDENCE
          ? 'medium_confidence_fallback'
          : 'low_confidence_fallback',
    }
  }

  if (cards[0]) {
    return {
      card: cards[0],
      mode: 'fallback',
      ...baseMeta,
      decisionReason: specificCaseDetected
        ? 'specific_case_fallback'
        : confidence === MEDIUM_CONFIDENCE
          ? 'medium_confidence_fallback'
          : 'low_confidence_fallback',
    }
  }

  throw new Error('No KB cards available for retrieval')
}

export function debugRetrieveCard(
  message: string,
  lang: KbLang,
  cards: KBCard[],
  supportContext?: SupportContext
): RetrievalDebugTrace {
  const tokens = normalize(message)
  const normalizedMessage = normalizePlain(message)
  const hints = buildSupportHints(message, lang, cards, supportContext)
  const contextualQuestion = hints.followUp && hints.conversationHintText
    ? `${message} ${hints.conversationHintText}`
    : message
  const questionDomain = inferQuestionDomain(contextualQuestion)
  const specificCaseDetected = detectSpecificCase(message)
  const override = detectProtectedOverride(message)
  const followUpDirectIntent = specificCaseDetected ? null : detectFollowUpDirectIntent(tokens, hints.conversationTokens)
  const directIntent = specificCaseDetected ? null : detectDirectIntentMatch(tokens)
  const resolvedDirectIntent = followUpDirectIntent ?? directIntent
  const regularCards = cards.filter(isRetrievableCard)
  const ranked = regularCards
    .map(card => ({
      card,
      score: scoreCard(tokens, normalizedMessage, questionDomain, specificCaseDetected, card, lang, hints),
    }))
    .sort((a, b) => b.score - a.score)

  const topCandidates = ranked.slice(0, 5).map((entry, index) => ({
    cardId: entry.card.id,
    score: entry.score,
    type: entry.card.type,
    answerMode: entry.card.answerMode,
    reason: index === 0 ? 'best_ranked' : 'tie_break_loss',
  }))

  const discarded: RetrievalTraceDiscard[] = cards
    .filter(card => !isRetrievableCard(card))
    .map(card => ({
      cardId: card.id,
      reason: card.type === 'fallback'
        ? 'policy:fallback_excluded_from_ranking'
        : 'policy:guide_missing_guide_id',
    }))

  const result = retrieveCard(message, lang, cards, supportContext)

  if (resolvedDirectIntent) {
    for (const entry of ranked.slice(0, 5)) {
      if (entry.card.id !== resolvedDirectIntent.cardId) {
        discarded.push({
          cardId: entry.card.id,
          score: entry.score,
          reason: 'direct_intent_bypassed',
        })
      }
    }
  } else {
    for (const entry of ranked.slice(0, 5)) {
      if (entry.card.id !== result.card.id) {
        discarded.push({
          cardId: entry.card.id,
          score: entry.score,
          reason: entry.score < DIRECT_MATCH_THRESHOLD
            ? 'low_confidence'
            : 'tie_break_loss',
        })
      }
    }
  }

  return {
    normalizedMessage,
    tokens,
    questionDomain,
    specificCaseDetected,
    cardsConsidered: regularCards.map(card => card.id),
    directIntent: override && override.kind === 'card'
      ? { cardId: override.cardId, minScore: override.minScore ?? 999 }
      : resolvedDirectIntent
        ? { cardId: resolvedDirectIntent.cardId, minScore: resolvedDirectIntent.minScore ?? 999 }
        : null,
    topCandidates,
    discarded,
    predictedMode: result.mode,
    predictedCardId: result.card.id,
    predictedDecisionReason: result.decisionReason,
    predictedConfidence: result.confidenceBand ?? result.confidence,
  }
}
