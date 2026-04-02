/**
 * KB Cards Validator (Pure)
 *
 * Pure function validator extracted from docs/kb/validate-kb.ts
 * No filesystem, no process.exit, reusable in API routes.
 */

import type { KBCard } from './load-kb'

// --- Enums from _schema.json ---

const VALID_TYPES = ['howto', 'concept', 'troubleshooting', 'glossary', 'fallback'] as const
const VALID_DOMAINS = [
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
] as const
const VALID_RISKS = ['safe', 'guarded'] as const
const VALID_GUARDRAILS = ['none', 'b1_fiscal', 'b1_sepa', 'b1_remittances', 'b1_danger'] as const
const VALID_ANSWER_MODES = ['full', 'limited'] as const
const GUARDED_DOMAINS = new Set(['fiscal', 'sepa', 'remittances', 'superadmin'])
const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

// Verbs that limited-mode answers should NOT contain (best-effort regex, CA + ES)
const RISKY_VERBS_RE =
  /\b(processa|desfés|reprocessa|genera\b|exporta\b|esborra|elimina\b|confirma\b|procesa\b|deshaz|reprocesa|genera\b|exporta\b|borra\b|elimina\b|confirma\b)/i

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate an array of KB cards.
 * Returns validation result with errors and warnings.
 */
export function validateKbCards(cards: KBCard[]): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const seenIds = new Set<string>()

  for (const card of cards) {
    const cardLabel = `card:${card.id || 'unknown'}`

    // --- Required fields ---

    if (!card.id || typeof card.id !== 'string') {
      errors.push(`${cardLabel}: Missing or invalid id`)
      continue // Can't proceed without id
    }

    if (!KEBAB_RE.test(card.id)) {
      errors.push(`${cardLabel}: id "${card.id}" is not kebab-case`)
    }

    // Duplicate ID check
    if (seenIds.has(card.id)) {
      errors.push(`${cardLabel}: Duplicate id "${card.id}"`)
    }
    seenIds.add(card.id)

    // --- Enum validations ---

    if (!VALID_TYPES.includes(card.type as any)) {
      errors.push(`${cardLabel}: Invalid type "${card.type}"`)
    }

    if (!VALID_DOMAINS.includes(card.domain as any)) {
      errors.push(`${cardLabel}: Invalid domain "${card.domain}"`)
    }

    if (!VALID_RISKS.includes(card.risk as any)) {
      errors.push(`${cardLabel}: Invalid risk "${card.risk}"`)
    }

    if (!VALID_GUARDRAILS.includes(card.guardrail as any)) {
      errors.push(`${cardLabel}: Invalid guardrail "${card.guardrail}"`)
    }

    if (!VALID_ANSWER_MODES.includes(card.answerMode as any)) {
      errors.push(`${cardLabel}: Invalid answerMode "${card.answerMode}"`)
    }

    // --- Title ---

    if (!card.title?.ca) {
      errors.push(`${cardLabel}: Missing title.ca`)
    }
    if (!card.title?.es) {
      errors.push(`${cardLabel}: Missing title.es`)
    }

    // --- Intents (INTENTS_MIN) ---

    if (!card.intents?.ca?.length) {
      errors.push(`${cardLabel}: intents.ca must have at least 1 element`)
    }
    if (!card.intents?.es?.length) {
      errors.push(`${cardLabel}: intents.es must have at least 1 element`)
    }

    // --- Content (CONTENT_REQUIRED) ---

    const hasGuide = card.guideId != null && card.guideId !== ''
    const hasAnswer = card.answer != null && (card.answer.ca || card.answer.es)

    if (!hasGuide && !hasAnswer) {
      errors.push(`${cardLabel}: Must have guideId or answer (at least one)`)
    }

    if (hasAnswer) {
      if (!card.answer!.ca) {
        errors.push(`${cardLabel}: answer.ca is missing`)
      }
      if (!card.answer!.es) {
        errors.push(`${cardLabel}: answer.es is missing`)
      }
    }

    // Reliability rule: guide cards must stay renderable, either through guideId or inline answer.
    if (card.id.startsWith('guide-')) {
      if (!hasGuide && !hasAnswer) {
        errors.push(`${cardLabel}: guide-* cards must define guideId or inline answer text`)
      }
    }

    // --- uiPaths ---

    if (!Array.isArray(card.uiPaths)) {
      errors.push(`${cardLabel}: uiPaths must be an array`)
    }

    // --- Coherence rules ---

    // GUARDED_DOMAIN: guarded domains must have risk=guarded and guardrail!=none
    if (GUARDED_DOMAINS.has(card.domain)) {
      if (card.risk !== 'guarded') {
        errors.push(`${cardLabel}: domain "${card.domain}" requires risk="guarded"`)
      }
      if (card.guardrail === 'none') {
        errors.push(`${cardLabel}: domain "${card.domain}" requires guardrail != "none"`)
      }
    }

    // LIMITED_NO_RISKY_VERBS: limited answers shouldn't contain risky verbs
    if (card.answerMode === 'limited' && hasAnswer) {
      const combinedText = `${card.answer!.ca || ''} ${card.answer!.es || ''}`
      if (RISKY_VERBS_RE.test(combinedText)) {
        warnings.push(
          `${cardLabel}: answerMode=limited but answer contains risky verbs (best-effort check)`
        )
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
