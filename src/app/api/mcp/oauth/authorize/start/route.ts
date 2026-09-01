import { NextRequest } from 'next/server';
import { handlePublicMcpAuthorizationStart } from '../handler';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  return handlePublicMcpAuthorizationStart(request);
}
