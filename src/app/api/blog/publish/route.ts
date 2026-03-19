import { type NextRequest, type NextResponse } from 'next/server'
import { handleBlogPublish, type PublishBlogResponse } from './handler'

export async function POST(
  request: NextRequest
): Promise<NextResponse<PublishBlogResponse>> {
  return handleBlogPublish(request)
}
