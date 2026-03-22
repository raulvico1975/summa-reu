import { type NextRequest, type NextResponse } from 'next/server'
import { handleBlogCoverUpload, type UploadBlogCoverResponse } from './handler'

export async function POST(
  request: NextRequest
): Promise<NextResponse<UploadBlogCoverResponse>> {
  return handleBlogCoverUpload(request)
}
