import expectedCaRaw from '../../../docs/kb/_eval/expected.json'
import expectedEsRaw from '../../../docs/kb/_eval/expected-es.json'
import { loadGuideContent, type KBCard } from './load-kb'
import { validateKbCards } from './validate-kb-cards'
import { retrieveCard } from './bot-retrieval'
import { evaluateGoldenSet, GOLDEN_SET_MIN_CRITICAL_TOP1 } from './eval/golden-set'
import { extractOperationalSteps } from './engine/policy'

type ExpectedRow = {
  q: string
  expectedCardId?: string
  expectedFallbackId?: string
}

const REQUIRED_FALLBACK_IDS = [
  'fallback-no-answer',
  'fallback-fiscal-unclear',
  'fallback-sepa-unclear',
  'fallback-remittances-unclear',
  'fallback-danger-unclear',
] as const

const REQUIRED_CRITICAL_CARD_IDS = [
  'project-open',
  'guide-projects',
  'guide-attach-document',
  'manual-member-paid-quotas',
] as const

const REQUIRED_CRITICAL_QUERIES: Array<{ lang: 'ca' | 'es'; q: string; expectedCardId: string }> = [
  { lang: 'ca', q: 'com obro un projecte?', expectedCardId: 'project-open' },
  { lang: 'ca', q: "com s'obre un projecte?", expectedCardId: 'project-open' },
  { lang: 'ca', q: 'com imputo una despesa a diversos projectes?', expectedCardId: 'guide-projects' },
  { lang: 'ca', q: 'com pujo una factura o rebut o nòmina?', expectedCardId: 'guide-attach-document' },
  { lang: 'ca', q: 'com puc saber les quotes que un soci ha pagat?', expectedCardId: 'manual-member-paid-quotas' },
  { lang: 'es', q: 'como abro un proyecto?', expectedCardId: 'project-open' },
  { lang: 'es', q: 'como se abre un proyecto?', expectedCardId: 'project-open' },
  { lang: 'es', q: 'como imputo un gasto a varios proyectos?', expectedCardId: 'guide-projects' },
  { lang: 'es', q: 'como subo una factura o recibo o nomina?', expectedCardId: 'guide-attach-document' },
  { lang: 'es', q: 'como puedo saber las cuotas que un socio ha pagado?', expectedCardId: 'manual-member-paid-quotas' },
]

const MAX_MISMATCH_ERRORS = 30
const MIN_EVAL_ACCURACY = 0.78

type EvalStats = {
  total: number
  passed: number
  failed: number
}

export type KbQualityGateResult = {
  ok: boolean
  errors: string[]
  warnings: string[]
  stats: {
    cards: number
    structuralErrors: number
    structuralWarnings: number
    evalCa: EvalStats
    evalEs: EvalStats
    golden: {
      total: number
      top1Hits: number
      top1Accuracy: number
      criticalTotal: number
      criticalTop1Hits: number
      criticalTop1Accuracy: number
      fallbackCount: number
      fallbackRate: number
      operationalWithoutCard: number
    }
  }
}

function evaluateRequiredCriticalQueries(cards: KBCard[]): string[] {
  const errors: string[] = []

  for (const check of REQUIRED_CRITICAL_QUERIES) {
    try {
      const result = retrieveCard(check.q, check.lang, cards)
      const actualId = result.clarifyOptions?.length ? 'clarify-disambiguation' : result.card.id
      if (actualId !== check.expectedCardId) {
        errors.push(
          `[critical][${check.lang}] "${check.q}" -> expected "${check.expectedCardId}" but got "${actualId}" (${result.mode})`
        )
      }
    } catch (error) {
      errors.push(
        `[critical][${check.lang}] "${check.q}" -> retrieval error: ${(error as Error)?.message || String(error)}`
      )
    }
  }

  return errors
}

function hasRenderableOperationalSteps(card: KBCard): boolean {
  const rawCa = card.guideId
    ? loadGuideContent(card.guideId, 'ca')
    : (card.answer?.ca ?? card.answer?.es ?? '')
  const rawEs = card.guideId
    ? loadGuideContent(card.guideId, 'es')
    : (card.answer?.es ?? card.answer?.ca ?? '')

  return extractOperationalSteps(rawCa).length > 0 || extractOperationalSteps(rawEs).length > 0
}

function evaluateCriticalOperationalCards(cards: KBCard[]): string[] {
  const errors: string[] = []

  for (const criticalId of REQUIRED_CRITICAL_CARD_IDS) {
    const card = cards.find(c => c.id === criticalId)
    if (!card) continue

    if (!hasRenderableOperationalSteps(card)) {
      errors.push(`Critical card has no renderable operational steps: ${criticalId}`)
    }
  }

  return errors
}

function toExpectedRows(raw: unknown): ExpectedRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((row): row is ExpectedRow => {
      if (!row || typeof row !== 'object') return false
      const rec = row as Record<string, unknown>
      return typeof rec.q === 'string'
    })
    .map(row => ({
      q: row.q,
      expectedCardId: row.expectedCardId,
      expectedFallbackId: row.expectedFallbackId,
    }))
}

function evaluateExpectedSet(cards: KBCard[], lang: 'ca' | 'es', rows: ExpectedRow[]) {
  const errors: string[] = []
  let passed = 0

  for (const row of rows) {
    const expectedId = row.expectedCardId ?? row.expectedFallbackId
    if (!expectedId) {
      passed++
      continue
    }

    try {
      const result = retrieveCard(row.q, lang, cards)
      const actualId = result.clarifyOptions?.length ? 'clarify-disambiguation' : result.card.id

      if (actualId === expectedId) {
        passed++
      } else if (errors.length < MAX_MISMATCH_ERRORS) {
        errors.push(
          `[${lang}] "${row.q}" -> expected "${expectedId}" but got "${actualId}" (${result.mode})`
        )
      }
    } catch (error) {
      if (errors.length < MAX_MISMATCH_ERRORS) {
        errors.push(
          `[${lang}] "${row.q}" -> retrieval error: ${(error as Error)?.message || String(error)}`
        )
      }
    }
  }

  return {
    errors,
    stats: {
      total: rows.length,
      passed,
      failed: rows.length - passed,
    } satisfies EvalStats,
  }
}

export function runKbQualityGate(cards: KBCard[]): KbQualityGateResult {
  const validation = validateKbCards(cards)
  const errors = [...validation.errors]
  const warnings = [...validation.warnings]

  const cardIds = new Set(cards.map(c => c.id))
  for (const fallbackId of REQUIRED_FALLBACK_IDS) {
    if (!cardIds.has(fallbackId)) {
      errors.push(`Missing required fallback card: ${fallbackId}`)
    }
  }
  for (const criticalId of REQUIRED_CRITICAL_CARD_IDS) {
    if (!cardIds.has(criticalId)) {
      errors.push(`Missing required critical card: ${criticalId}`)
    }
  }

  const expectedCa = toExpectedRows(expectedCaRaw)
  const expectedEs = toExpectedRows(expectedEsRaw)

  const evalCa = evaluateExpectedSet(cards, 'ca', expectedCa)
  const evalEs = evaluateExpectedSet(cards, 'es', expectedEs)

  const caAccuracy = evalCa.stats.total > 0 ? evalCa.stats.passed / evalCa.stats.total : 0
  const esAccuracy = evalEs.stats.total > 0 ? evalEs.stats.passed / evalEs.stats.total : 0

  if (caAccuracy < MIN_EVAL_ACCURACY) {
    errors.push(
      `Eval CA sota mínim (${(caAccuracy * 100).toFixed(1)}% < ${(MIN_EVAL_ACCURACY * 100).toFixed(0)}%)`
    )
  }

  if (esAccuracy < MIN_EVAL_ACCURACY) {
    errors.push(
      `Eval ES sota mínim (${(esAccuracy * 100).toFixed(1)}% < ${(MIN_EVAL_ACCURACY * 100).toFixed(0)}%)`
    )
  }

  // Keep detailed mismatches as warnings for operator visibility.
  warnings.push(...evalCa.errors, ...evalEs.errors)

  const criticalQueryErrors = evaluateRequiredCriticalQueries(cards)
  errors.push(...criticalQueryErrors)
  errors.push(...evaluateCriticalOperationalCards(cards))
  const golden = evaluateGoldenSet(cards)

  if (golden.metrics.criticalTop1Accuracy < GOLDEN_SET_MIN_CRITICAL_TOP1) {
    errors.push(
      `Golden critical Top1 sota mínim (${(golden.metrics.criticalTop1Accuracy * 100).toFixed(1)}% < ${(GOLDEN_SET_MIN_CRITICAL_TOP1 * 100).toFixed(0)}%)`
    )
  }

  if (golden.metrics.operationalWithoutCard > 0) {
    warnings.push(
      `Golden: ${golden.metrics.operationalWithoutCard} consultes operatives han caigut a fallback (sense card)`
    )
  }

  warnings.push(...golden.errors.slice(0, 30))

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      cards: cards.length,
      structuralErrors: validation.errors.length,
      structuralWarnings: validation.warnings.length,
      evalCa: evalCa.stats,
      evalEs: evalEs.stats,
      golden: golden.metrics,
    },
  }
}
