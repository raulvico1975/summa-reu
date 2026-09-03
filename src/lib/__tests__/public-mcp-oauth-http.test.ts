import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInMemoryPublicMcpRateLimiter,
  createPublicMcpOAuthHttpHandler,
} from '@/lib/public-mcp/oauth-http';
import { PublicMcpAuthError } from '@/lib/public-mcp/oauth';
import {
  createFixturePublicMcpReadService,
  createLocalFixtureActor,
} from '@/lib/public-mcp/server';

const initializeRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'summa-m2-http-test', version: '0.1.0' },
  },
};

function request(body: unknown = initializeRequest, headers: HeadersInit = {}) {
  return new Request('https://mcp.example.test/mcp', {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      authorization: 'Bearer fixture-token',
      'content-type': 'application/json',
      ...Object.fromEntries(new Headers(headers).entries()),
    },
    body: JSON.stringify(body),
  });
}

function handler(overrides: Partial<Parameters<typeof createPublicMcpOAuthHttpHandler>[0]> = {}) {
  return createPublicMcpOAuthHttpHandler({
    async resolveActor() { return createLocalFixtureActor(); },
    readService: createFixturePublicMcpReadService(),
    resourceMetadataUrl: 'https://mcp.example.test/.well-known/oauth-protected-resource/mcp',
    rateLimiter: createInMemoryPublicMcpRateLimiter({ maxRequests: 10, windowMs: 60_000 }),
    ...overrides,
  });
}

test('M2 HTTP boundary returns an OAuth discovery challenge before MCP processing', async () => {
  const response = await handler({
    async resolveActor() { throw new PublicMcpAuthError('MISSING_ACCESS_TOKEN', 401); },
  })(request());
  assert.equal(response.status, 401);
  assert.match(response.headers.get('www-authenticate') ?? '', /resource_metadata="https:\/\/mcp\.example\.test/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('M2 HTTP boundary rejects oversized payloads before resolving identity', async () => {
  let resolved = false;
  const response = await handler({
    maxPayloadBytes: 32,
    async resolveActor() { resolved = true; return createLocalFixtureActor(); },
  })(request({ q: 'x'.repeat(100) }));
  assert.equal(response.status, 413);
  assert.equal(resolved, false);
});

test('M2 HTTP boundary rate-limits by a hashed actor reference', async () => {
  const rateLimiter = createInMemoryPublicMcpRateLimiter({ maxRequests: 1, windowMs: 60_000 });
  const handle = handler({ rateLimiter, nowMs: () => 1_000 });
  assert.equal((await handle(request())).status, 200);
  assert.equal((await handle(request())).status, 429);
});

test('M2 HTTP boundary keeps the authenticated fixture loop stateless and no-store', async () => {
  const response = await handler()(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const payload = await response.json() as { result?: { capabilities?: { tools?: unknown } } };
  assert.equal(typeof payload.result?.capabilities?.tools, 'object');
});
