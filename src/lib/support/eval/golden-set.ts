import expectedCaRaw from '../../../../docs/kb/_eval/expected.json'
import expectedEsRaw from '../../../../docs/kb/_eval/expected-es.json'
import { retrieveCard, type KbLang } from '../bot-retrieval'
import type { KBCard } from '../load-kb'
import { isOperationalIntent } from '../engine/policy'

type ExpectedRow = {
  q: string
  expectedCardId?: string
  expectedFallbackId?: string
}

export interface GoldenCase {
  question: string
  expectedCardId: string
  critical: boolean
  lang: KbLang
}

export type GoldenSetMetrics = {
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

export const GOLDEN_SET_MIN_CRITICAL_TOP1 = 0.98

const CRITICAL_CASES: GoldenCase[] = [
  { lang: 'ca', question: 'com obro un projecte?', expectedCardId: 'project-open', critical: true },
  { lang: 'ca', question: "com s'obre un projecte?", expectedCardId: 'project-open', critical: true },
  { lang: 'ca', question: 'com imputo una despesa a diversos projectes?', expectedCardId: 'guide-projects', critical: true },
  { lang: 'ca', question: 'com imputo una despesa entre diferents projectes?', expectedCardId: 'guide-projects', critical: true },
  { lang: 'ca', question: 'com pujo una factura o rebut o nòmina?', expectedCardId: 'guide-attach-document', critical: true },
  { lang: 'ca', question: 'com puc saber les quotes que un soci ha pagat?', expectedCardId: 'manual-member-paid-quotas', critical: true },
  { lang: 'ca', question: 'com faig arribar el certificat de donatius a un soci?', expectedCardId: 'guide-donor-certificate', critical: true },
  { lang: 'ca', question: 'tinc problemes per dividir una remessa', expectedCardId: 'guide-split-remittance', critical: true },
  { lang: 'es', question: 'como abro un proyecto?', expectedCardId: 'project-open', critical: true },
  { lang: 'es', question: 'como se abre un proyecto?', expectedCardId: 'project-open', critical: true },
  { lang: 'es', question: 'como imputo un gasto a varios proyectos?', expectedCardId: 'guide-projects', critical: true },
  { lang: 'es', question: 'como subo una factura o recibo o nomina?', expectedCardId: 'guide-attach-document', critical: true },
  { lang: 'es', question: 'como puedo saber las cuotas que un socio ha pagado?', expectedCardId: 'manual-member-paid-quotas', critical: true },
  { lang: 'es', question: 'como envio el certificado de donacion a un socio?', expectedCardId: 'guide-donor-certificate', critical: true },
  { lang: 'es', question: 'tengo problemas para dividir una remesa', expectedCardId: 'guide-split-remittance', critical: true },
]

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

function buildDerivedCases(rows: ExpectedRow[], lang: KbLang, limit: number): GoldenCase[] {
  const cases: GoldenCase[] = []
  for (const row of rows) {
    const expected = row.expectedCardId ?? row.expectedFallbackId
    if (!expected) continue
    cases.push({
      question: row.q,
      expectedCardId: expected,
      critical: false,
      lang,
    })
    if (cases.length >= limit) break
  }
  return cases
}

function dedupeCases(cases: GoldenCase[]): GoldenCase[] {
  const byKey = new Map<string, GoldenCase>()
  for (const c of cases) {
    const key = `${c.lang}::${c.question.trim().toLowerCase()}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, c)
      continue
    }

    if (!existing.critical && c.critical) {
      byKey.set(key, c)
    }
  }
  return Array.from(byKey.values())
}

const derivedCa = buildDerivedCases(toExpectedRows(expectedCaRaw), 'ca', 80)
const derivedEs = buildDerivedCases(toExpectedRows(expectedEsRaw), 'es', 80)

export const GOLDEN_SET: GoldenCase[] = dedupeCases([
  ...CRITICAL_CASES,
  ...derivedCa,
  ...derivedEs,
])

export function evaluateGoldenSet(cards: KBCard[]): { metrics: GoldenSetMetrics; errors: string[] } {
  let top1Hits = 0
  let criticalTop1Hits = 0
  let criticalTotal = 0
  let fallbackCount = 0
  let operationalWithoutCard = 0
  const errors: string[] = []

  for (const testCase of GOLDEN_SET) {
    try {
      const result = retrieveCard(testCase.question, testCase.lang, cards)
      const actualCardId = result.clarifyOptions?.length ? 'clarify-disambiguation' : result.card.id

      if (actualCardId === testCase.expectedCardId) {
        top1Hits += 1
        if (testCase.critical) criticalTop1Hits += 1
      } else {
        errors.push(
          `[golden][${testCase.lang}] "${testCase.question}" -> expected "${testCase.expectedCardId}" but got "${actualCardId}" (${result.mode})`
        )
      }

      if (testCase.critical) {
        criticalTotal += 1
      }

      if (result.mode === 'fallback') {
        fallbackCount += 1
      }

      if (isOperationalIntent(testCase.question) && result.mode !== 'card') {
        operationalWithoutCard += 1
      }
    } catch (error) {
      errors.push(
        `[golden][${testCase.lang}] "${testCase.question}" -> retrieval error: ${(error as Error)?.message || String(error)}`
      )
      if (testCase.critical) criticalTotal += 1
    }
  }

  const total = GOLDEN_SET.length
  const top1Accuracy = total > 0 ? top1Hits / total : 0
  const criticalTop1Accuracy = criticalTotal > 0 ? criticalTop1Hits / criticalTotal : 0
  const fallbackRate = total > 0 ? fallbackCount / total : 0

  return {
    metrics: {
      total,
      top1Hits,
      top1Accuracy,
      criticalTotal,
      criticalTop1Hits,
      criticalTop1Accuracy,
      fallbackCount,
      fallbackRate,
      operationalWithoutCard,
    },
    errors,
  }
}
