import type { NextRequest } from 'next/server';

import { handleGrantJustificationExportPost } from './handler';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<Response> {
  return handleGrantJustificationExportPost(request);
}
