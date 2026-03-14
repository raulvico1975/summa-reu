/**
 * Runtime KB Loader with versioned cache
 *
 * Loads KB cards from filesystem (base) + Storage (override).
 * Cache invalidation based on version from Firestore.
 *
 * @see src/lib/support/load-kb.ts — Filesystem loader
 */

import { getStorage } from 'firebase-admin/storage'
import type { KBCard } from './load-kb'
import { loadAllCards } from './load-kb'
import { runKbQualityGate } from './kb-quality-gate'
import { CONTEXT_HELP_UI_PATHS } from '@/help/help-manual-links'

type CachedKB = {
  signature: string
  cards: KBCard[]
}

let cached: CachedKB | null = null

export function serializeKbCacheBustValue(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (value instanceof Date) return value.toISOString()

  if (typeof value === 'object') {
    const maybeTimestamp = value as {
      toMillis?: () => number
      seconds?: number
      nanoseconds?: number
    }

    if (typeof maybeTimestamp.toMillis === 'function') {
      return String(maybeTimestamp.toMillis())
    }

    if (typeof maybeTimestamp.seconds === 'number') {
      return `${maybeTimestamp.seconds}:${maybeTimestamp.nanoseconds ?? 0}`
    }
  }

  return String(value)
}

export function buildKbRuntimeCacheSignature(input: {
  version: number
  storageVersion: number | null
  deletedCardIds?: string[]
  publishedAtKey?: string | null
}): string {
  const deletedSignature = (input.deletedCardIds ?? []).slice().sort().join('|')
  return [
    String(input.version),
    String(input.storageVersion ?? 'null'),
    deletedSignature,
    input.publishedAtKey ?? 'no-published-at',
  ].join('::')
}

function buildEmergencyFallbackCards(): KBCard[] {
  const base = {
    type: 'fallback',
    domain: 'general',
    risk: 'safe',
    guardrail: 'none',
    answerMode: 'full',
    title: { ca: 'Fallback d’emergència', es: 'Fallback de emergencia' },
    intents: { ca: ['fallback'], es: ['fallback'] },
    guideId: null,
    uiPaths: [CONTEXT_HELP_UI_PATHS.ca, 'Manual > Resolució de problemes'],
    needsSnapshot: false,
    keywords: [],
    related: [],
    error_key: null,
    symptom: { ca: null, es: null },
  } as const satisfies Omit<KBCard, 'id' | 'answer'>

  return [
    {
      ...base,
      id: 'fallback-no-answer',
      answer: {
        ca: 'No he trobat informació exacta. Obre l’ajuda contextual de la pantalla o el manual abans de continuar.',
        es: 'No he encontrado información exacta. Abre la ayuda contextual de la pantalla o el manual antes de continuar.',
      },
    },
    {
      ...base,
      id: 'fallback-fiscal-unclear',
      domain: 'fiscal',
      risk: 'guarded',
      guardrail: 'b1_fiscal',
      answerMode: 'limited',
      answer: {
        ca: 'Consulta fiscal detectada. Revisa Informes i el manual fiscal corresponent abans de continuar.',
        es: 'Consulta fiscal detectada. Revisa Informes y el manual fiscal correspondiente antes de continuar.',
      },
    },
    {
      ...base,
      id: 'fallback-sepa-unclear',
      domain: 'sepa',
      risk: 'guarded',
      guardrail: 'b1_sepa',
      answerMode: 'limited',
      answer: {
        ca: 'Consulta SEPA detectada. Revisa Moviments i el manual abans de generar cap fitxer.',
        es: 'Consulta SEPA detectada. Revisa Movimientos y el manual antes de generar ningún fichero.',
      },
    },
    {
      ...base,
      id: 'fallback-remittances-unclear',
      domain: 'remittances',
      risk: 'guarded',
      guardrail: 'b1_remittances',
      answerMode: 'limited',
      answer: {
        ca: 'Consulta de remeses detectada. Revisa l’estat a Moviments i el manual abans de tocar res.',
        es: 'Consulta de remesas detectada. Revisa el estado en Movimientos y el manual antes de tocar nada.',
      },
    },
    {
      ...base,
      id: 'fallback-danger-unclear',
      domain: 'superadmin',
      risk: 'guarded',
      guardrail: 'b1_danger',
      answerMode: 'limited',
      answer: {
        ca: 'Acció sensible detectada. No facis canvis irreversibles sense revisar el manual i la pantalla correcta.',
        es: 'Acción sensible detectada. No hagas cambios irreversibles sin revisar el manual y la pantalla correcta.',
      },
    },
  ]
}

/**
 * Load KB cards with filesystem + Storage merge.
 * Cache per version: only reload if version changes.
 *
 * @param version - Current KB version from Firestore (system/supportKb.version)
 * @param storageVersion - Published storage version (must match version to use Storage)
 * @returns Merged KB cards (Storage published overrides filesystem by ID)
 */
export async function loadKbCards(
  version: number,
  storageVersion: number | null = null,
  deletedCardIds: string[] = [],
  publishedAtKey: string | null = null
): Promise<KBCard[]> {
  const signature = buildKbRuntimeCacheSignature({
    version,
    storageVersion,
    deletedCardIds,
    publishedAtKey,
  })
  // Cache hit: return if version hasn't changed
  if (cached && cached.signature === signature) {
    return cached.cards
  }

  // 1. Filesystem (base)
  const fsCards = await loadAllCards()

  // 2. Storage (override)
  const shouldUseStoragePublished = storageVersion === version
  const storageCards = shouldUseStoragePublished ? await loadKbFromStorage() : null

  // 3. Merge: Storage overrides filesystem by ID
  const merged = mergeKbCards(fsCards, storageCards ?? [])
  const deletedSet = new Set(deletedCardIds)
  const filtered = merged.filter(card => !deletedSet.has(card.id))

  // Runtime safety net:
  // if published KB is corrupt, keep serving a safe dataset instead of crashing/derailing answers.
  if (shouldUseStoragePublished && storageCards) {
    const mergedGate = runKbQualityGate(filtered)
    if (!mergedGate.ok) {
      console.error('[load-kb-runtime] Published KB failed quality gate, using fallback dataset', {
        errors: mergedGate.errors.slice(0, 5),
        cards: filtered.length,
      })

      const fsFiltered = fsCards.filter(card => !deletedSet.has(card.id))
      const fsGate = fsFiltered.length > 0 ? runKbQualityGate(fsFiltered) : null
      if (fsGate?.ok) {
        cached = { signature, cards: fsFiltered }
        return fsFiltered
      }

      const storageFiltered = (storageCards ?? []).filter(card => !deletedSet.has(card.id))
      const storageGate = storageFiltered.length > 0 ? runKbQualityGate(storageFiltered) : null
      if (storageGate?.ok) {
        cached = { signature, cards: storageFiltered }
        return storageFiltered
      }

      const emergencyCards = buildEmergencyFallbackCards()
      cached = { signature, cards: emergencyCards }
      return emergencyCards
    }
  }

  // 4. Cache per version
  cached = { signature, cards: filtered }
  return filtered
}

/**
 * Load cards from Storage (support-kb/kb.json).
 * Returns null if file doesn't exist or error occurs.
 */
async function loadKbFromStorage(): Promise<KBCard[] | null> {
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET

  if (!bucketName) {
    console.warn('[load-kb-runtime] No storage bucket configured')
    return null
  }

  try {
    const bucket = getStorage().bucket(bucketName)
    const file = bucket.file('support-kb/kb.json')

    const [exists] = await file.exists()
    if (!exists) return null

    const [data] = await file.download()
    return JSON.parse(data.toString('utf-8')) as KBCard[]
  } catch (error) {
    console.warn('[load-kb-runtime] Error loading from Storage:', error)
    return null
  }
}

/**
 * Merge cards: Storage overrides filesystem by ID.
 * Order: filesystem first, then Storage (override).
 */
function mergeKbCards(fs: KBCard[], storage: KBCard[]): KBCard[] {
  const map = new Map<string, KBCard>()

  // Base: cards from filesystem
  for (const card of fs) {
    map.set(card.id, card)
  }

  // Override: cards from Storage
  for (const card of storage) {
    map.set(card.id, card)
  }

  return Array.from(map.values())
}
