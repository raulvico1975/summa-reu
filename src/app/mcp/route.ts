import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {
  createFixturePublicMcpReadService,
  createLocalFixtureActor,
  createPublicMcpServer,
} from '@/lib/public-mcp/server';

export const runtime = 'nodejs';

function disabledResponse() {
  return Response.json({ error: 'MCP_M1_FIXTURE_MODE_REQUIRED' }, { status: 404 });
}

async function handleMcpRequest(request: Request): Promise<Response> {
  // M1 is deliberately limited to synthetic local/ephemeral fixtures. M2 adds
  // OAuth and an immutable actor resolved from the authorization grant.
  if (process.env.SUMMA_MCP_FIXTURE_MODE !== '1') return disabledResponse();

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createPublicMcpServer({
    actor: createLocalFixtureActor(),
    readService: createFixturePublicMcpReadService(),
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}

export const GET = handleMcpRequest;
export const POST = handleMcpRequest;
export const DELETE = handleMcpRequest;
