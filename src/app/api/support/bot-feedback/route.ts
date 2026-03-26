/**
 * API Route: Support Bot Feedback
 *
 * Stores per-question helpful feedback (yes/no) for continuous KB improvement.
 * Firestore path: organizations/{orgId}/supportBotQuestions/{hash}
 *
 */

import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb, validateUserMembership, verifyIdToken } from '@/lib/api/admin-sdk'
import { requireOperationalAccess } from '@/lib/api/require-operational-access'
import { createQuestionHash, maskPII, normalizeForHash } from '@/lib/support/bot-question-log'

type InputLang = 'ca' | 'es' | 'fr' | 'pt'

type ApiResponse =
  | { ok: true }
  | { ok: false; error: string }

function normalizeLang(rawLang: unknown): InputLang {
  const allowedLangs = ['ca', 'es', 'fr', 'pt'] as const
  return allowedLangs.includes(rawLang as InputLang) ? (rawLang as InputLang) : 'ca'
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const authResult = await verifyIdToken(request)
    if (!authResult) {
      return NextResponse.json({ ok: false, error: 'Token invàlid o absent' }, { status: 401 })
    }

    const body = await request.json() as {
      question?: string
      lang?: string
      helpful?: boolean
      cardId?: string
      mode?: 'card' | 'fallback'
    }

    const question = typeof body.question === 'string' ? body.question.trim() : ''
    if (!question) {
      return NextResponse.json({ ok: false, error: 'question obligatòria' }, { status: 400 })
    }

    const helpful = body.helpful === true
    const lang = normalizeLang(body.lang)
    const mode = body.mode === 'card' ? 'card' : 'fallback'
    const cardId = typeof body.cardId === 'string' ? body.cardId : null

    const db = getAdminDb()

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

    const normalized = normalizeForHash(question)
    const hash = createQuestionHash(lang, normalized)

    const ref = db
      .collection('organizations')
      .doc(orgId)
      .collection('supportBotQuestions')
      .doc(hash)

    await ref.set(
      {
        lang,
        messageRaw: maskPII(question),
        messageNormalized: normalized,
        resultMode: mode,
        cardIdOrFallbackId: cardId,
        helpfulYes: helpful ? FieldValue.increment(1) : FieldValue.increment(0),
        helpfulNo: helpful ? FieldValue.increment(0) : FieldValue.increment(1),
        lastFeedbackHelpful: helpful,
        lastFeedbackAt: FieldValue.serverTimestamp(),
        lastSeenAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    console.error('[API] support/bot-feedback error:', error)
    return NextResponse.json(
      { ok: false, error: (error as Error)?.message?.slice(0, 200) ?? 'Error intern' },
      { status: 500 }
    )
  }
}
