import { type NextRequest, type NextResponse } from 'next/server';
import {
  handleProductUpdatesPublish,
  type PublishProductUpdateResponse,
} from './handler';

export async function POST(
  request: NextRequest
): Promise<NextResponse<PublishProductUpdateResponse>> {
  return handleProductUpdatesPublish(request);
}
