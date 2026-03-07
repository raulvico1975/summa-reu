import type { KBCard } from './load-kb'

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

export type SmallTalkResponse = {
  cardId: string
  answer: string
}

type DirectIntentMatch = {
  cardId: string
  minScore?: number
}

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
  { canon: 'remesa', variants: ['remeses', 'remessa', 'remessas', 'remesas', 'cuota', 'cuotas'] },
  { canon: 'dividir', variants: ['divideixo', 'dividir', 'fraccionar', 'fracciono', 'repartir', 'separar', 'desglossar', 'desglosar', 'partir'] },
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
  /no quadra/,
  /a mi em surt/,
  /no em surt/,
  /aquesta transaccio/,
  /esta remesa/,
  /esta factura/,
  /mi donante/,
  /no me cuadra/,
  /no cuadra/,
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
        ? 'Soy el asistente de Summa Social. Te ayudo a resolver dudas de uso de la app y a encontrar el procedimiento correcto dentro de las guías.'
        : 'Soc l’assistent de Summa Social. T’ajudo a resoldre dubtes d’ús de l’app i a trobar el procediment correcte dins de les guies.',
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

  return [
    title,
    errorKey,
    symptom,
    domain,
    ...intents,
    ...keywords,
    ...uiPaths,
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

function scoreCard(
  tokens: string[],
  normalizedMessage: string,
  questionDomain: QuestionDomain,
  specificCaseDetected: boolean,
  card: KBCard,
  lang: KbLang
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
  score += scoreDomainAlignment(questionDomain, card.domain ?? '')
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

function detectDirectIntentMatch(tokens: string[]): DirectIntentMatch | null {
  const set = new Set(tokens)

  // "Tinc problemes per dividir una remesa"
  if (
    hasToken(set, 'dividir', 'separar', 'repartir') &&
    hasToken(set, 'remesa', 'cuota')
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
    hasToken(set, 'pujar', 'adjuntar', 'vincular') &&
    hasToken(set, 'factura', 'document', 'rebut', 'recibo', 'nomina')
  ) {
    return { cardId: 'guide-attach-document', minScore: 600 }
  }

  // "Com puc saber les quotes que un soci ha pagat?"
  if (
    hasToken(set, 'quote', 'quota', 'pagat', 'pagar', 'historial', 'aportacio') &&
    hasToken(set, 'soci', 'donant')
  ) {
    return { cardId: 'manual-member-paid-quotas', minScore: 500 }
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
  // Safety: ignore corrupted guide cards (import mistakes).
  if (card.id.startsWith('guide-') && !card.guideId) return false
  return true
}

function hasMinimumEvidenceForDirectMatch(tokens: string[], card: KBCard, lang: KbLang): boolean {
  if (tokens.length === 0) return false
  const overlap = countTokenEvidence(tokens, collectSearchPhrases(card, lang))
  if (tokens.length <= 2) return overlap >= 1
  if (tokens.length <= 4) return overlap >= 1
  return overlap >= 2
}

export function retrieveCard(message: string, lang: KbLang, cards: KBCard[]): RetrievalResult {
  const tokens = normalize(message)
  const normalizedMessage = normalizePlain(message)
  const questionDomain = inferQuestionDomain(message)
  const specificCaseDetected = detectSpecificCase(message)

  const directIntent = specificCaseDetected ? null : detectDirectIntentMatch(tokens)
  if (directIntent) {
    const directCard = cards.find(card => card.id === directIntent.cardId)
    if (directCard) {
      return {
        card: directCard,
        mode: 'card',
        bestCardId: directCard.id,
        bestScore: directIntent.minScore ?? 999,
        secondCardId: undefined,
        secondScore: 0,
        confidence: HIGH_CONFIDENCE,
        confidenceBand: HIGH_CONFIDENCE,
        decisionReason: 'direct_intent_high_confidence',
        specificCaseDetected,
        questionDomain,
      }
    }
  }

  const regularCards = cards.filter(isRetrievableCard)
  const ranked = regularCards
    .map(card => ({
      card,
      score: scoreCard(tokens, normalizedMessage, questionDomain, specificCaseDetected, card, lang),
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
    hasMinimumEvidenceForDirectMatch(tokens, best.card, lang)
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
