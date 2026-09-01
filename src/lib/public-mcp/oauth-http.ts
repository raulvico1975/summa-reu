import { createHash } from 'node:crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {
  createPublicMcpServer,
  type PublicMcpActorContext,
  type PublicMcpReadService,
} from '@/lib/public-mcp/server';
import { PublicMcpAuthError } from '@/lib/public-mcp/oauth';

export interface PublicMcpRateLimiter {
  consume(key: string, nowMs: number): boolean;
}

export interface PublicMcpSafeLogEntry {
  event: 'allowed' | 'denied' | 'rate_limited' | 'payload_rejected' | 'timeout' | 'error';
  status: number;
  actorRef?: string;
  code?: string;
}

export interface PublicMcpOAuthHttpDependencies {
  resolveActor(request: Request): Promise<PublicMcpActorContext>;
  readService: PublicMcpReadService;
  resourceMetadataUrl: string;
  rateLimiter: PublicMcpRateLimiter;
  maxPayloadBytes?: number;
  authTimeoutMs?: number;
  nowMs?: () => number;
  log?: (entry: PublicMcpSafeLogEntry) => void;
}

function responseWithNoStore(body: BodyInit | null, status: number, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('cache-control', 'no-store');
  return new Response(body, { status, headers: responseHeaders });
}

function jsonError(status: number, code: string, headers?: HeadersInit) {
  return responseWithNoStore(JSON.stringify({ error: code }), status, {
    'content-type': 'application/json',
    ...Object.fromEntries(new Headers(headers).entries()),
  });
}

function authChallenge(resourceMetadataUrl: string, code: string) {
  return `Bearer resource_metadata="${resourceMetadataUrl}", error="invalid_token", error_description="${code}"`;
}

function requireHttpsMetadataUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error('MCP_RESOURCE_METADATA_URL_INVALID');
  }
  return url.toString();
}

function actorReference(actor: PublicMcpActorContext): string {
  return createHash('sha256')
    .update(`${actor.userId}\0${actor.organizationId}\0${actor.tokenId}`)
    .digest('hex')
    .slice(0, 20);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('MCP_AUTH_TIMEOUT')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function parseRequestBody(request: Request, maxPayloadBytes: number): Promise<unknown | undefined> {
  if (request.method !== 'POST') return undefined;
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxPayloadBytes) {
    throw new Error('MCP_PAYLOAD_TOO_LARGE');
  }
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > maxPayloadBytes) throw new Error('MCP_PAYLOAD_TOO_LARGE');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('MCP_PAYLOAD_INVALID_JSON');
  }
}

export function createInMemoryPublicMcpRateLimiter(input: {
  maxRequests: number;
  windowMs: number;
}): PublicMcpRateLimiter {
  const counters = new Map<string, { start: number; count: number }>();
  return {
    consume(key, nowMs) {
      const current = counters.get(key);
      if (!current || nowMs - current.start >= input.windowMs) {
        counters.set(key, { start: nowMs, count: 1 });
        return true;
      }
      if (current.count >= input.maxRequests) return false;
      current.count += 1;
      return true;
    },
  };
}

export function createPublicMcpOAuthHttpHandler(dependencies: PublicMcpOAuthHttpDependencies) {
  const resourceMetadataUrl = requireHttpsMetadataUrl(dependencies.resourceMetadataUrl);
  const maxPayloadBytes = dependencies.maxPayloadBytes ?? 64 * 1024;
  const authTimeoutMs = dependencies.authTimeoutMs ?? 3_000;
  const nowMs = dependencies.nowMs ?? Date.now;
  const log = dependencies.log ?? (() => undefined);

  return async function handle(request: Request): Promise<Response> {
    let parsedBody: unknown | undefined;
    try {
      parsedBody = await parseRequestBody(request, maxPayloadBytes);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'MCP_BAD_REQUEST';
      const status = code === 'MCP_PAYLOAD_TOO_LARGE' ? 413 : 400;
      log({ event: 'payload_rejected', status, code });
      return jsonError(status, code);
    }

    let actor: PublicMcpActorContext;
    try {
      actor = await withTimeout(dependencies.resolveActor(request), authTimeoutMs);
    } catch (error) {
      if (error instanceof PublicMcpAuthError) {
        log({ event: 'denied', status: error.status, code: error.code });
        return jsonError(error.status, error.code, error.status === 401 ? {
          'www-authenticate': authChallenge(resourceMetadataUrl, error.code),
        } : undefined);
      }
      const code = error instanceof Error && error.message === 'MCP_AUTH_TIMEOUT'
        ? 'MCP_AUTH_TIMEOUT'
        : 'MCP_AUTH_UNAVAILABLE';
      const status = code === 'MCP_AUTH_TIMEOUT' ? 504 : 401;
      log({ event: code === 'MCP_AUTH_TIMEOUT' ? 'timeout' : 'error', status, code });
      return jsonError(status, code, status === 401 ? {
        'www-authenticate': authChallenge(resourceMetadataUrl, code),
      } : undefined);
    }

    const actorRef = actorReference(actor);
    if (!dependencies.rateLimiter.consume(actorRef, nowMs())) {
      log({ event: 'rate_limited', status: 429, actorRef, code: 'MCP_RATE_LIMITED' });
      return jsonError(429, 'MCP_RATE_LIMITED', { 'retry-after': '60' });
    }

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const server = createPublicMcpServer({ actor, readService: dependencies.readService });
    await server.connect(transport);
    try {
      const response = await transport.handleRequest(request, { parsedBody });
      const headers = new Headers(response.headers);
      headers.set('cache-control', 'no-store');
      log({ event: 'allowed', status: response.status, actorRef });
      return new Response(response.body, { status: response.status, headers });
    } catch {
      log({ event: 'error', status: 500, actorRef, code: 'MCP_REQUEST_FAILED' });
      return jsonError(500, 'MCP_REQUEST_FAILED');
    } finally {
      await server.close();
    }
  };
}
