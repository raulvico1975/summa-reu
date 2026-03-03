/**
 * KB Loader — Summa Social Support Bot
 *
 * Loads all KB cards (fallbacks + cards/) and guide content from i18n.
 * Cached in module memory (singleton) for performance.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

export interface KBCard {
  id: string
  type: string
  domain: string
  risk: string
  guardrail: string
  answerMode: string
  title: { ca?: string; es?: string }
  intents: { ca?: string[]; es?: string[] }
  guideId?: string | null
  answer?: { ca?: string; es?: string } | null
  uiPaths: string[]
  needsSnapshot: boolean
  keywords: string[]
  related: string[]
  error_key: string | null
  symptom: { ca?: string | null; es?: string | null }
}

// -------------------------------------------------------------------
// Paths
// -------------------------------------------------------------------

const __filename2 = fileURLToPath(import.meta.url)
const __dirname2 = dirname(__filename2)
const KB_DIR = join(__dirname2, '..', '..', '..', 'docs', 'kb')
const CARDS_DIR = join(KB_DIR, 'cards')
const FALLBACKS_PATH = join(KB_DIR, '_fallbacks.json')
const GENERATED_HELP_BOT_PATH = join(__dirname2, '..', '..', '..', 'docs', 'generated', 'help-bot.json')
const I18N_DIR = join(__dirname2, '..', '..', 'i18n', 'locales')

// -------------------------------------------------------------------
// Cache
// -------------------------------------------------------------------

let cachedCards: KBCard[] | null = null
const cachedI18n: Record<string, Record<string, string>> = {}

type GeneratedHelpBotCard = {
  id?: string
  title?: { ca?: string; es?: string } | string
  domain?: string
  risk?: string
  guardrail?: string
  answerMode?: string
  uiPaths?: string[]
  keywords?: string[]
  intents?: { ca?: string[]; es?: string[] }
  answer?: { ca?: string; es?: string } | string
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function findJsonFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      results.push(...findJsonFiles(full))
    } else if (entry.endsWith('.json')) {
      results.push(full)
    }
  }
  return results
}

function loadI18n(lang: string): Record<string, string> {
  if (cachedI18n[lang]) return cachedI18n[lang]
  try {
    const raw = JSON.parse(readFileSync(join(I18N_DIR, `${lang}.json`), 'utf-8'))
    // Flat JSON: keys are dot-separated like "guides.firstDay.title"
    cachedI18n[lang] = raw
    return raw
  } catch {
    return {}
  }
}

function collectIndexedSection(
  i18n: Record<string, string>,
  prefix: string,
  section: string,
  max = 30
): string[] {
  const items: string[] = []
  for (let i = 0; i < max; i++) {
    const value = i18n[`${prefix}.${section}.${i}`]
    if (!value) break
    items.push(value.trim())
  }
  return items.filter(Boolean)
}

function uniqueItems(items: string[], max = 8): string[] {
  return Array.from(new Set(items.map(item => item.trim()).filter(Boolean))).slice(0, max)
}

function extractStepsFromCardText(cardText: string): string[] {
  if (!cardText) return []
  const normalized = cardText.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n').map(line => line.trim()).filter(Boolean)

  const stepAnchor = lines.findIndex(line => /pas a pas|paso a paso/i.test(line))
  const targetLine = stepAnchor >= 0 ? lines[stepAnchor + 1] : ''
  if (!targetLine) return []

  const steps = targetLine
    .split(/→|->|>/)
    .map(part => part.trim())
    .filter(Boolean)

  return uniqueItems(steps, 8)
}

function normalizeDomain(domain?: string): string {
  const value = (domain ?? '').toLowerCase().trim()
  const allowed = new Set([
    'general',
    'config',
    'donors',
    'transactions',
    'remittances',
    'sepa',
    'fiscal',
    'documents',
    'projects',
    'superadmin',
  ])
  return allowed.has(value) ? value : 'general'
}

function normalizeRisk(risk?: string): string {
  const value = (risk ?? '').toLowerCase().trim()
  return value === 'guarded' ? 'guarded' : 'safe'
}

function normalizeGuardrail(guardrail?: string, domain = 'general'): string {
  const value = (guardrail ?? '').toLowerCase().trim()
  const allowed = new Set(['none', 'b1_fiscal', 'b1_sepa', 'b1_remittances', 'b1_danger'])
  if (allowed.has(value)) return value
  if (domain === 'fiscal') return 'b1_fiscal'
  if (domain === 'sepa') return 'b1_sepa'
  if (domain === 'remittances') return 'b1_remittances'
  if (domain === 'superadmin') return 'b1_danger'
  return 'none'
}

function normalizeAnswerMode(answerMode?: string): string {
  const value = (answerMode ?? '').toLowerCase().trim()
  return value === 'limited' ? 'limited' : 'full'
}

function toLocalizedText(
  value: { ca?: string; es?: string } | string | undefined,
  fallback = ''
): { ca?: string; es?: string } {
  if (typeof value === 'string') {
    return { ca: value || fallback, es: value || fallback }
  }
  return {
    ca: value?.ca ?? fallback,
    es: value?.es ?? fallback,
  }
}

function toStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return values
    .map(value => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
}

function convertGeneratedHelpCard(card: GeneratedHelpBotCard): KBCard | null {
  const id = typeof card.id === 'string' ? card.id.trim() : ''
  if (!id) return null

  const domain = normalizeDomain(card.domain)
  const risk = normalizeRisk(card.risk)
  const guardrail = normalizeGuardrail(card.guardrail, domain)
  const answerMode = normalizeAnswerMode(card.answerMode)
  const title = toLocalizedText(card.title, id)
  const answer = toLocalizedText(card.answer)
  const intents = card.intents && typeof card.intents === 'object'
    ? {
        ca: toStringArray(card.intents.ca),
        es: toStringArray(card.intents.es),
      }
    : { ca: [], es: [] }

  return {
    id,
    type: 'howto',
    domain,
    risk,
    guardrail,
    answerMode,
    title,
    intents,
    guideId: null,
    answer,
    uiPaths: toStringArray(card.uiPaths),
    needsSnapshot: false,
    keywords: toStringArray(card.keywords),
    related: [],
    error_key: null,
    symptom: { ca: null, es: null },
  }
}

function loadGeneratedHelpCards(): KBCard[] {
  try {
    const parsed = JSON.parse(readFileSync(GENERATED_HELP_BOT_PATH, 'utf-8')) as GeneratedHelpBotCard[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(convertGeneratedHelpCard)
      .filter((value): value is KBCard => value !== null)
  } catch (error) {
    // Optional artifact: runtime keeps working with legacy cards.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[load-kb] Cannot load generated help-bot.json:', error)
    }
    return []
  }
}

// -------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------

export function loadAllCards(): KBCard[] {
  if (cachedCards) return cachedCards

  const cards: KBCard[] = []

  // Fallbacks
  try {
    const fallbacks = JSON.parse(readFileSync(FALLBACKS_PATH, 'utf-8')) as KBCard[]
    cards.push(...fallbacks)
  } catch (e) {
    console.error('[load-kb] Cannot load fallbacks:', e)
  }

  // Cards from subdirectories
  try {
    const files = findJsonFiles(CARDS_DIR)
    for (const file of files) {
      try {
        const card = JSON.parse(readFileSync(file, 'utf-8')) as KBCard
        cards.push(card)
      } catch (e) {
        console.error(`[load-kb] Cannot parse ${file}:`, e)
      }
    }
  } catch (e) {
    console.error('[load-kb] Cannot read cards dir:', e)
  }

  // Generated operational layer for Help+Bot.
  // Priority: generated cards override legacy cards by ID.
  const generatedCards = loadGeneratedHelpCards()
  if (generatedCards.length > 0) {
    const byId = new Map<string, KBCard>()
    for (const card of cards) byId.set(card.id, card)
    for (const card of generatedCards) byId.set(card.id, card)
    cachedCards = Array.from(byId.values())
    return cachedCards
  }

  cachedCards = cards
  return cards
}

/**
 * Builds raw guide text from i18n for a given guideId.
 * Returns structured text with title, intro, steps, avoid, costlyError.
 */
export function loadGuideContent(guideId: string, lang: string): string {
  const i18n = loadI18n(lang)
  const prefix = `guides.${guideId}`

  const isEs = lang === 'es'
  const title = i18n[`${prefix}.title`] || ''
  const intro = i18n[`${prefix}.intro`] || ''
  const whatIs = i18n[`${prefix}.whatIs`] || ''
  const summary = i18n[`${prefix}.summary`] || ''
  const cardText = i18n[`${prefix}.cardText`] || ''
  const costlyError = i18n[`${prefix}.costlyError`] || ''

  const lookFirst = collectIndexedSection(i18n, prefix, 'lookFirst')
  const steps = collectIndexedSection(i18n, prefix, 'steps')
  const thenItems = collectIndexedSection(i18n, prefix, 'then')
  const doNext = collectIndexedSection(i18n, prefix, 'doNext')
  const notResolved = collectIndexedSection(i18n, prefix, 'notResolved')
  const checkBeforeExport = collectIndexedSection(i18n, prefix, 'checkBeforeExport')
  const avoid = collectIndexedSection(i18n, prefix, 'avoid')
  const dontFixYet = collectIndexedSection(i18n, prefix, 'dontFixYet')
  const tips = collectIndexedSection(i18n, prefix, 'tip')

  let actionable = uniqueItems([...lookFirst, ...steps, ...thenItems, ...doNext], 6)
  if (actionable.length === 0) {
    actionable = uniqueItems(notResolved, 6)
  }
  if (actionable.length === 0) {
    actionable = extractStepsFromCardText(cardText)
  }

  let checks = uniqueItems(checkBeforeExport, 4)
  if (checks.length === 0 && notResolved.length > 0) {
    checks = uniqueItems(notResolved, 4)
  }
  if (checks.length === 0 && avoid.length > 0) {
    checks = [avoid[0]]
  }

  const cautions = uniqueItems([
    ...dontFixYet,
    ...tips,
    ...avoid,
    costlyError ? (isEs ? `Error costoso: ${costlyError}` : `Error costós: ${costlyError}`) : '',
  ], 3)

  const whatHappens = [summary, intro, whatIs, title].map(v => v.trim()).find(Boolean) || ''
  const whatLabel = isEs ? 'Qué pasa' : 'Què passa'
  const doLabel = isEs ? 'Qué hacer ahora' : 'Què fer ara'
  const checkLabel = isEs ? 'Cómo comprobarlo' : 'Com comprovar-ho'
  const cautionLabel = isEs ? 'Antes de continuar' : 'Abans de continuar'

  const parts: string[] = []
  if (whatHappens) {
    parts.push(`${whatLabel}:`)
    parts.push(whatHappens)
  }

  parts.push('')
  parts.push(`${doLabel}:`)
  if (actionable.length > 0) {
    actionable.forEach((item, i) => parts.push(`${i + 1}. ${item}`))
  } else if (cardText) {
    parts.push(cardText)
  } else {
    parts.push(isEs ? '1. Revisa la guía de este proceso dentro de la app.' : '1. Revisa la guia d’aquest procés dins de l’app.')
  }

  parts.push('')
  parts.push(`${checkLabel}:`)
  if (checks.length > 0) {
    checks.forEach(item => parts.push(`- ${item}`))
  } else {
    parts.push(isEs
      ? '- Si completas los pasos sin errores, el proceso debería quedar resuelto.'
      : '- Si completes els passos sense errors, el procés hauria de quedar resolt.')
  }

  if (cautions.length > 0) {
    parts.push('')
    parts.push(`${cautionLabel}:`)
    cautions.forEach(item => parts.push(`- ${item}`))
  }

  return parts.join('\n').trim()
}
