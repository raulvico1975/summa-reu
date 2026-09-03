import { buildPublicMcpProtectedResourceMetadata } from '@/lib/public-mcp/oauth';

export const runtime = 'nodejs';

export function GET(): Response {
  const resource = process.env.SUMMA_MCP_RESOURCE;
  const authorizationServer = process.env.SUMMA_MCP_OAUTH_ISSUER;
  if (!resource || !authorizationServer) {
    return Response.json({ error: 'MCP_OAUTH_NOT_CONFIGURED' }, { status: 404 });
  }

  try {
    return Response.json(buildPublicMcpProtectedResourceMetadata({
      resource,
      authorizationServer,
      documentationUrl: process.env.SUMMA_MCP_DOCUMENTATION_URL,
    }), {
      headers: { 'cache-control': 'public, max-age=300' },
    });
  } catch {
    return Response.json({ error: 'MCP_OAUTH_CONFIGURATION_INVALID' }, { status: 503 });
  }
}
