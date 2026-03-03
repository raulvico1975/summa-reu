import { createHash } from 'crypto'
import { FieldValue, type Firestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { loadAllCards, type KBCard } from './load-kb'

export const SUPPORT_KB_DOC_PATH = 'system/supportKb'
export const KB_DRAFT_STORAGE_PATH = 'support-kb/kb-draft.json'
export const KB_PUBLISHED_STORAGE_PATH = 'support-kb/kb.json'

export const REQUIRED_FALLBACK_IDS = [
  'fallback-no-answer',
  'fallback-fiscal-unclear',
  'fallback-sepa-unclear',
  'fallback-remittances-unclear',
  'fallback-danger-unclear',
] as const

export const REQUIRED_CRITICAL_CARD_IDS = [
  'project-open',
  'guide-projects',
  'guide-attach-document',
  'manual-member-paid-quotas',
] as const

export const PROTECTED_CARD_IDS = [
  ...REQUIRED_FALLBACK_IDS,
  ...REQUIRED_CRITICAL_CARD_IDS,
] as const

type KbCardSource = 'base' | 'published' | 'draft'

export type KbMergedCard = {
  card: KBCard
  source: KbCardSource
  isDraftOverride: boolean
  isDeleted: boolean
  isRequiredCore: boolean
}

export type SupportKbSettings = {
  version: number
  storageVersion: number | null
  deletedCardIds: string[]
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function normalizeId(value: string): string {
  return value.trim()
}

function parseDeletedCardIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const ids = value
    .filter(item => typeof item === 'string')
    .map(item => normalizeId(item))
    .filter(Boolean)
  return Array.from(new Set(ids))
}

function getBucketName(): string {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  if (!bucketName) {
    throw new Error('Missing FIREBASE_STORAGE_BUCKET or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET')
  }
  return bucketName
}

async function readCardsFromStorage(path: string): Promise<KBCard[]> {
  try {
    const bucket = getStorage().bucket(getBucketName())
    const file = bucket.file(path)
    const [exists] = await file.exists()
    if (!exists) return []
    const [raw] = await file.download()
    const parsed = JSON.parse(raw.toString('utf-8'))
    return Array.isArray(parsed) ? (parsed as KBCard[]) : []
  } catch (error) {
    console.warn(`[kb-draft-store] could not load ${path}:`, error)
    return []
  }
}

async function writeCardsToStorage(path: string, cards: KBCard[], meta: Record<string, string>): Promise<void> {
  const bucket = getStorage().bucket(getBucketName())
  const file = bucket.file(path)

  await file.save(JSON.stringify(cards, null, 2), {
    contentType: 'application/json',
    metadata: {
      customMetadata: {
        ...meta,
        savedAt: new Date().toISOString(),
      },
    },
  })
}

export async function readSupportKbSettings(db: Firestore): Promise<SupportKbSettings> {
  const snap = await db.doc(SUPPORT_KB_DOC_PATH).get()
  const data = snap.data() ?? {}

  return {
    version: parseNumber(data.version),
    storageVersion: data.storageVersion == null ? null : parseNumber(data.storageVersion),
    deletedCardIds: parseDeletedCardIds(data.deletedCardIds),
  }
}

export async function writeSupportKbDeletedIds(
  db: Firestore,
  deletedCardIds: string[],
  uid: string
): Promise<void> {
  await db.doc(SUPPORT_KB_DOC_PATH).set(
    {
      deletedCardIds: Array.from(new Set(deletedCardIds.map(normalizeId).filter(Boolean))),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
    },
    { merge: true }
  )
}

export async function writeSupportKbDraftMetadata(
  db: Firestore,
  args: {
    draftCardCount: number
    uid: string
  }
): Promise<void> {
  await db.doc(SUPPORT_KB_DOC_PATH).set(
    {
      draftCardCount: args.draftCardCount,
      draftUpdatedAt: new Date().toISOString(),
      draftUpdatedBy: args.uid,
    },
    { merge: true }
  )
}

export async function loadKbStorageState(db: Firestore): Promise<{
  baseCards: KBCard[]
  publishedCards: KBCard[]
  draftCards: KBCard[]
  settings: SupportKbSettings
}> {
  const [publishedCards, draftCards, settings] = await Promise.all([
    readCardsFromStorage(KB_PUBLISHED_STORAGE_PATH),
    readCardsFromStorage(KB_DRAFT_STORAGE_PATH),
    readSupportKbSettings(db),
  ])

  return {
    baseCards: loadAllCards(),
    publishedCards,
    draftCards,
    settings,
  }
}

export function mergeKbCardsWithMetadata(args: {
  baseCards: KBCard[]
  publishedCards: KBCard[]
  draftCards: KBCard[]
  deletedCardIds: string[]
}): {
  rows: KbMergedCard[]
  activeCards: KBCard[]
} {
  const deletedSet = new Set(args.deletedCardIds.map(normalizeId))

  const map = new Map<string, KbMergedCard>()
  for (const card of args.baseCards) {
    map.set(card.id, {
      card,
      source: 'base',
      isDraftOverride: false,
      isDeleted: deletedSet.has(card.id),
      isRequiredCore: PROTECTED_CARD_IDS.includes(card.id as (typeof PROTECTED_CARD_IDS)[number]),
    })
  }

  for (const card of args.publishedCards) {
    const previous = map.get(card.id)
    map.set(card.id, {
      card,
      source: 'published',
      isDraftOverride: false,
      isDeleted: deletedSet.has(card.id),
      isRequiredCore: PROTECTED_CARD_IDS.includes(card.id as (typeof PROTECTED_CARD_IDS)[number]),
    })
    if (previous) {
      map.get(card.id)!.isDraftOverride = false
    }
  }

  for (const card of args.draftCards) {
    const previous = map.get(card.id)
    map.set(card.id, {
      card,
      source: 'draft',
      isDraftOverride: Boolean(previous),
      isDeleted: deletedSet.has(card.id),
      isRequiredCore: PROTECTED_CARD_IDS.includes(card.id as (typeof PROTECTED_CARD_IDS)[number]),
    })
  }

  const rows = Array.from(map.values()).sort((a, b) => a.card.id.localeCompare(b.card.id))
  const activeCards = rows.filter(row => !row.isDeleted).map(row => row.card)

  return { rows, activeCards }
}

export function upsertCard(cards: KBCard[], card: KBCard): KBCard[] {
  const map = new Map<string, KBCard>()
  for (const item of cards) map.set(item.id, item)
  map.set(card.id, card)
  return Array.from(map.values())
}

export function deleteCard(cards: KBCard[], cardId: string): KBCard[] {
  const normalized = normalizeId(cardId)
  return cards.filter(card => card.id !== normalized)
}

export async function saveDraftCards(cards: KBCard[], uid: string): Promise<void> {
  await writeCardsToStorage(KB_DRAFT_STORAGE_PATH, cards, {
    draftUpdatedBy: uid,
  })
}

export async function publishCards(args: {
  db: Firestore
  cards: KBCard[]
  uid: string
  deletedCardIds: string[]
  stats: {
    cards: number
    evalCa: { total: number; passed: number; failed: number }
    evalEs: { total: number; passed: number; failed: number }
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
}): Promise<number> {
  const { db, cards, uid, deletedCardIds } = args
  const supportKbRef = db.doc(SUPPORT_KB_DOC_PATH)

  const nextVersion = await db.runTransaction(async tx => {
    const snap = await tx.get(supportKbRef)
    const currentVersion = parseNumber(snap.data()?.version)
    const computed = currentVersion + 1

    tx.set(
      supportKbRef,
      {
        version: computed,
        storageVersion: computed,
        deletedCardIds: Array.from(new Set(deletedCardIds.map(normalizeId).filter(Boolean))),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        lastQualityGateAt: FieldValue.serverTimestamp(),
        lastQualityGateBy: uid,
        lastQualityGateStats: args.stats,
      },
      { merge: true }
    )

    return computed
  })

  await writeCardsToStorage(KB_PUBLISHED_STORAGE_PATH, cards, {
    publishedVersion: String(nextVersion),
    publishedBy: uid,
  })

  return nextVersion
}

export function computeDraftFingerprint(cards: KBCard[]): string {
  const ordered = [...cards].sort((a, b) => a.id.localeCompare(b.id))
  return createHash('sha256').update(JSON.stringify(ordered)).digest('hex')
}
