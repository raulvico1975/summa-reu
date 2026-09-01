import { NextRequest } from 'next/server';
import { handlePublicMcpAuthorizationSubmit } from '../handler';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  return handlePublicMcpAuthorizationSubmit(request);
}
