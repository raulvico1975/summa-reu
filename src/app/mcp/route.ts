import {
  createPublicMcpOAuthHttpHandler,
} from '@/lib/public-mcp/oauth-http';
import { createPublicMcpM2HttpDependencies } from '@/lib/public-mcp/m2-runtime';

export const runtime = 'nodejs';

let handler: ReturnType<typeof createPublicMcpOAuthHttpHandler> | null = null;

async function handleMcpRequest(request: Request): Promise<Response> {
  try {
    handler ??= createPublicMcpOAuthHttpHandler(createPublicMcpM2HttpDependencies());
    return await handler(request);
  } catch {
    // Do not fall back to M1 fixtures or reveal configuration details.
    return Response.json(
      { error: 'MCP_OAUTH_NOT_CONFIGURED' },
      { status: 503, headers: { 'cache-control': 'no-store' } }
    );
  }
}

export const GET = handleMcpRequest;
export const POST = handleMcpRequest;
export const DELETE = handleMcpRequest;
