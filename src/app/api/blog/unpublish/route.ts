import { type NextRequest, type NextResponse } from 'next/server'

import { handleBlogUnpublish, type UnpublishBlogResponse } from './handler'

export async function POST(
  request: NextRequest
): Promise<NextResponse<UnpublishBlogResponse>> {
  return handleBlogUnpublish(request)
}
