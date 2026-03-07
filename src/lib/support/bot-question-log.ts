/**
 * Bot Question Logger — Summa Social Support Bot
 *
 * Logs user questions to Firestore with dedup (hash-based docId).
 * Zero reads: setDoc({ merge: true }) + FieldValue.increment(1).
 *
 * Firestore path: organizations/{orgId}/supportBotQuestions/{hash}
 *
 * @see CLAUDE.md — src/lib/** = RISC MITJÀ (helper no crític)
 */

import { createHash } from 'crypto'
import { type Firestore, FieldValue } from 'firebase-admin/firestore'

// =============================================================================
// NORMALIZE
// =============================================================================

/**
 * Normalitza text per generar hash estable:
 * lowercase + NFD strip diacritics + whitespace collapse + trim
 */
export function normalizeForHash(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/\s+/g, ' ')
    .trim()
}

// =============================================================================
// HASH
// =============================================================================

/**
 * Genera hash SHA-256 (hex) per dedup de preguntes.
 * Inclou lang al hash per separar preguntes iguals en idiomes diferents.
 */
export function createQuestionHash(lang: string, normalized: string): string {
  return createHash('sha256')
    .update(`${lang}:${normalized}`)
    .digest('hex')
}

// =============================================================================
// PII MASKING
// =============================================================================

/**
 * Emmascara dades personals (PII) abans de guardar a Firestore.
 * Substitueix: IBAN, NIF/CIF/DNI/NIE, email, telèfon.
 */
export function maskPII(text: string): string {
  return text
    // IBAN (ES/FR/PT/AD + qualsevol 2-letter prefix): 2 lletres + 2 dígits + 4-30 alfanumèrics
    .replace(/\b[A-Z]{2}\d{2}[\s]?[\dA-Z]{4,30}\b/gi, '[IBAN]')
    // NIF/CIF/DNI/NIE espanyol: 8 dígits + lletra, o lletra + 7 dígits + lletra
    .replace(/\b\d{8}[A-Za-z]\b/g, '[NIF]')
    .replace(/\b[XYZxyz]\d{7}[A-Za-z]\b/g, '[NIF]')
    .replace(/\b[A-Ha-h]\d{8}\b/g, '[NIF]')
    // Email
    .replace(/\b[\w.+-]+@[\w.-]+\.\w{2,}\b/g, '[EMAIL]')
    // Telèfon (format internacional o local): +34 612345678, 612 345 678, etc.
    .replace(/(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3}[\s.-]?\d{3,4}\b/g, '[PHONE]')
}

export interface BotQuestionLogMeta {
  bestCardId?: string
  bestScore?: number
  secondCardId?: string
  secondScore?: number
  retrievalConfidence?: 'high' | 'medium' | 'low'
  confidenceBand?: 'high' | 'medium' | 'low'
  decisionReason?: string
  intent?: 'operational' | 'informational'
  specificCaseDetected?: boolean
  clarifyShownCount?: number
  clarifySelectedCount?: number
  clarifyAbandonedCount?: number
  reformulatedAfterFallbackCount?: number
  reformulatedAfterClarifyCount?: number
}

export type BotQuestionCounterIncrements = Pick<
  BotQuestionLogMeta,
  | 'clarifyShownCount'
  | 'clarifySelectedCount'
  | 'clarifyAbandonedCount'
  | 'reformulatedAfterFallbackCount'
  | 'reformulatedAfterClarifyCount'
>

function buildCounterIncrementPayload(meta: BotQuestionLogMeta | BotQuestionCounterIncrements): Record<string, FieldValue> {
  const payload: Record<string, FieldValue> = {}

  const counters: Array<keyof BotQuestionCounterIncrements> = [
    'clarifyShownCount',
    'clarifySelectedCount',
    'clarifyAbandonedCount',
    'reformulatedAfterFallbackCount',
    'reformulatedAfterClarifyCount',
  ]

  for (const key of counters) {
    const value = meta[key]
    if (typeof value === 'number' && value !== 0) {
      payload[key] = FieldValue.increment(value)
    }
  }

  return payload
}

// =============================================================================
// LOG
// =============================================================================

/**
 * Registra una pregunta del bot a Firestore (fire-and-forget).
 *
 * - docId = SHA-256 hash de (lang + normalized message) → dedup automàtic
 * - setDoc({ merge: true }) + increment(1) → zero reads
 * - createdAt s'actualitza cada vegada (acceptable: zero reads prioritari)
 * - lastSeenAt + count per tracking temporal
 *
 * @param db - Firestore Admin SDK instance
 * @param orgId - Organization ID
 * @param message - Raw user message
 * @param lang - Language code ('ca' | 'es' | 'fr' | 'pt')
 * @param resultMode - 'card' | 'fallback'
 * @param cardIdOrFallbackId - Matched card ID or fallback ID
 */
export async function logBotQuestion(
  db: Firestore,
  orgId: string,
  message: string,
  lang: string,
  resultMode: 'card' | 'fallback',
  cardIdOrFallbackId: string,
  meta?: BotQuestionLogMeta
): Promise<void> {
  const normalized = normalizeForHash(message)
  const hash = createQuestionHash(lang, normalized)
  const masked = maskPII(message)

  const docRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('supportBotQuestions')
    .doc(hash)

  await docRef.set(
    {
      lang,
      messageRaw: masked,
      messageNormalized: normalized,
      resultMode,
      cardIdOrFallbackId,
      bestCardId: meta?.bestCardId ?? null,
      bestScore: meta?.bestScore ?? null,
      secondCardId: meta?.secondCardId ?? null,
      secondScore: meta?.secondScore ?? null,
      retrievalConfidence: meta?.retrievalConfidence ?? meta?.confidenceBand ?? null,
      confidenceBand: meta?.confidenceBand ?? meta?.retrievalConfidence ?? null,
      decisionReason: meta?.decisionReason ?? null,
      intent: meta?.intent ?? null,
      specificCaseDetected: meta?.specificCaseDetected ?? null,
      count: FieldValue.increment(1),
      lastSeenAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      ...buildCounterIncrementPayload(meta ?? {}),
    },
    { merge: true }
  )
}

export async function incrementBotQuestionCounters(
  db: Firestore,
  orgId: string,
  message: string,
  lang: string,
  counters: BotQuestionCounterIncrements
): Promise<void> {
  const normalized = normalizeForHash(message)
  const hash = createQuestionHash(lang, normalized)
  const masked = maskPII(message)

  const docRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('supportBotQuestions')
    .doc(hash)

  await docRef.set(
    {
      lang,
      messageRaw: masked,
      messageNormalized: normalized,
      ...buildCounterIncrementPayload(counters),
    },
    { merge: true }
  )
}
