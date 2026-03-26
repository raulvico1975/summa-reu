/**
 * API Route: Export Bot Questions as CSV
 *
 * GET /api/support/bot-questions/export
 *
 * Query params:
 *   scope: 'fallbackOnly' | 'all' (default 'all')
 *   days: number (default 30)
 *
 * INVARIANT: orgId derivat exclusivament del token (users/{uid}.organizationId).
 * Mai headers, mai query params, mai body.
 *
 * Returns: CSV file download
 *
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyIdToken, getAdminDb, validateUserMembership } from '@/lib/api/admin-sdk'
import { requireOperationalAccess } from '@/lib/api/require-operational-access'
import { inferQuestionDomain, suggestKeywordsFromMessage } from '@/lib/support/bot-retrieval'

// Max results per export (TTL lògic)
const EXPORT_LIMIT = 500

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // --- Auth ---
    const authResult = await verifyIdToken(request)
    if (!authResult) {
      return NextResponse.json({ ok: false, error: 'Token invàlid o absent' }, { status: 401 })
    }

    const db = getAdminDb()

    // --- Derive orgId from user profile (INVARIANT: never from external input) ---
    const userDoc = await db.doc(`users/${authResult.uid}`).get()
    const orgId = userDoc.data()?.organizationId as string | undefined
    if (!orgId) {
      return NextResponse.json({ ok: false, error: 'Usuari sense organització assignada' }, { status: 400 })
    }

    const membership = await validateUserMembership(db, authResult.uid, orgId)
    const accessDenied = requireOperationalAccess(membership)
    if (accessDenied) {
      return NextResponse.json({ ok: false, error: 'Accés denegat' }, { status: 403 })
    }

    // --- Query params (only scope + days, never orgId) ---
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope') === 'fallbackOnly' ? 'fallbackOnly' : 'all'
    const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '30', 10) || 30, 1), 365)

    // --- Query Firestore ---
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    let query = db
      .collection(`organizations/${orgId}/supportBotQuestions`)
      .where('lastSeenAt', '>=', cutoff)
      .orderBy('lastSeenAt', 'desc')
      .limit(EXPORT_LIMIT)

    if (scope === 'fallbackOnly') {
      query = db
        .collection(`organizations/${orgId}/supportBotQuestions`)
        .where('resultMode', '==', 'fallback')
        .where('lastSeenAt', '>=', cutoff)
        .orderBy('lastSeenAt', 'desc')
        .limit(EXPORT_LIMIT)
    }

    const snapshot = await query.get()

    // --- Build CSV ---
    const header = 'question,lang,mode,matchedCardId,bestCardId,bestScore,retrievalConfidence,count,helpfulYes,helpfulNo,helpfulRate,lastSeen,suggestedDomain,suggestedKeywords,suggestedIntentsCa'
    const rows: string[] = [header]

    // Sort by count desc (client-side since Firestore can't order by two fields with inequality)
    type QuestionDoc = {
      id: string
      messageRaw?: string
      lang?: string
      resultMode?: string
      cardIdOrFallbackId?: string
      bestCardId?: string
      bestScore?: number
      retrievalConfidence?: 'high' | 'medium' | 'low'
      count?: number
      helpfulYes?: number
      helpfulNo?: number
      lastSeenAt?: { toDate: () => Date }
    }

    const docs: QuestionDoc[] = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }) as QuestionDoc)
      .sort((a, b) => ((b.count ?? 0) - (a.count ?? 0)))

    for (const data of docs) {
      const question = escapeCsvField(String(data.messageRaw ?? ''))
      const lang = escapeCsvField(String(data.lang ?? ''))
      const mode = escapeCsvField(String(data.resultMode ?? ''))
      const cardId = escapeCsvField(String(data.cardIdOrFallbackId ?? ''))
      const bestCardId = escapeCsvField(String(data.bestCardId ?? ''))
      const bestScore = data.bestScore == null ? '' : String(data.bestScore)
      const retrievalConfidence = escapeCsvField(String(data.retrievalConfidence ?? ''))
      const count = String(data.count ?? 0)
      const helpfulYes = data.helpfulYes ?? 0
      const helpfulNo = data.helpfulNo ?? 0
      const helpfulTotal = helpfulYes + helpfulNo
      const helpfulRate = helpfulTotal > 0 ? `${Math.round((helpfulYes / helpfulTotal) * 100)}%` : ''
      const lastSeen = data.lastSeenAt?.toDate?.()
        ? data.lastSeenAt.toDate().toISOString().slice(0, 10)
        : ''
      const suggestedDomain = escapeCsvField(inferQuestionDomain(String(data.messageRaw ?? '')))
      const suggestedKeywords = escapeCsvField(suggestKeywordsFromMessage(String(data.messageRaw ?? ''), 6).join(';'))
      const suggestedIntentsCa = escapeCsvField(String(data.messageRaw ?? ''))

      rows.push(
        `${question},${lang},${mode},${cardId},${bestCardId},${bestScore},${retrievalConfidence},${count},${helpfulYes},${helpfulNo},${helpfulRate},${lastSeen},${suggestedDomain},${suggestedKeywords},${suggestedIntentsCa}`
      )
    }

    const csv = rows.join('\n')
    const filename = `bot-questions-${orgId}-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: unknown) {
    console.error('[API] bot-questions/export error:', error)
    return NextResponse.json(
      { ok: false, error: (error as Error)?.message?.substring(0, 200) ?? 'Error intern' },
      { status: 500 }
    )
  }
}

/**
 * Escapa un camp CSV: si conté coma, cometes o salts de línia,
 * l'envolta amb cometes dobles i duplica les cometes internes.
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
