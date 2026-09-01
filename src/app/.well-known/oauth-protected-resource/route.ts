import { GET as getProtectedResourceMetadata } from './mcp/route';

export const runtime = 'nodejs';

export function GET(): Response {
  return getProtectedResourceMetadata();
}
