import { type NextRequest, type NextResponse } from 'next/server';
import {
  handleProductUpdatesUnpublish,
  type UnpublishProductUpdateResponse,
} from './handler';

export async function POST(
  request: NextRequest
): Promise<NextResponse<UnpublishProductUpdateResponse>> {
  return handleProductUpdatesUnpublish(request);
}
