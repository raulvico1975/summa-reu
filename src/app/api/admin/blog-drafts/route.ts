import { NextRequest, NextResponse } from 'next/server'

import { getAdminDb, isSuperAdmin, verifyIdToken } from '@/lib/api/admin-sdk'
import { buildNativeBlogQueueSummary, listNativeBlogPosts } from '@/lib/editorial-native/store'
import type { NativeBlogPost, NativeBlogQueueSummary } from '@/lib/editorial-native/types'

type ApiResponse =
  | { ok: true; posts: NativeBlogPost[]; summary: NativeBlogQueueSummary }
  | { ok: false; error: string }

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const authResult = await verifyIdToken(request)
    if (!authResult) {
      return NextResponse.json({ ok: false, error: 'Token invàlid o absent' }, { status: 401 })
    }

    const superOk = await isSuperAdmin(authResult.uid)
    if (!superOk) {
      return NextResponse.json({ ok: false, error: 'Només SuperAdmin pot veure els drafts del blog' }, { status: 403 })
    }

    const db = getAdminDb()
    const [posts, summary] = await Promise.all([
      listNativeBlogPosts(db),
      buildNativeBlogQueueSummary(db),
    ])

    return NextResponse.json({ ok: true, posts, summary })
  } catch (error: unknown) {
    console.error('[admin/blog-drafts] error:', error)
    const message = (error as Error)?.message || String(error)
    return NextResponse.json({ ok: false, error: message.substring(0, 240) }, { status: 500 })
  }
}

