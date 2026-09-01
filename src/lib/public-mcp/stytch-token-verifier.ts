import type { VerifiedPublicMcpAccessToken } from '@/lib/public-mcp/oauth';

interface StytchIntrospectionPayload {
  active?: unknown;
  aud?: unknown;
  client_id?: unknown;
  exp?: unknown;
  iss?: unknown;
  jti?: unknown;
  scope?: unknown;
  sub?: unknown;
}

export interface StytchPublicMcpVerifierConfig {
  projectDomain: string;
  allowedClientIds: string[];
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

function requireHttpsOrigin(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:'
    || url.username
    || url.password
    || (url.pathname && url.pathname !== '/')
    || url.search
    || url.hash) {
    throw new Error('STYTCH_PROJECT_DOMAIN_INVALID');
  }
  url.pathname = '';
  return url;
}

function parseAudiences(value: unknown): string[] {
  if (typeof value === 'string' && value) return [value];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  }
  return [];
}

function parseScopes(value: unknown): string[] {
  return typeof value === 'string'
    ? value.split(/\s+/).filter(Boolean)
    : [];
}

function decodeUntrustedClientId(token: string): string {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) throw new Error('STYTCH_ACCESS_TOKEN_MALFORMED');

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      client_id?: unknown;
    };
    if (typeof payload.client_id !== 'string'
      || payload.client_id.length === 0
      || payload.client_id.length > 256) {
      throw new Error('STYTCH_ACCESS_TOKEN_CLIENT_MISSING');
    }
    return payload.client_id;
  } catch (error) {
    if (error instanceof Error && error.message === 'STYTCH_ACCESS_TOKEN_CLIENT_MISSING') {
      throw error;
    }
    throw new Error('STYTCH_ACCESS_TOKEN_MALFORMED');
  }
}

function parseVerifiedToken(
  payload: StytchIntrospectionPayload,
  expectedClientId: string
): VerifiedPublicMcpAccessToken {
  if (payload.active !== true
    || typeof payload.iss !== 'string'
    || typeof payload.sub !== 'string'
    || typeof payload.client_id !== 'string'
    || typeof payload.exp !== 'number') {
    throw new Error('STYTCH_ACCESS_TOKEN_INACTIVE');
  }
  if (payload.client_id !== expectedClientId) {
    throw new Error('STYTCH_ACCESS_TOKEN_CLIENT_MISMATCH');
  }
  const audiences = parseAudiences(payload.aud);
  if (audiences.length === 0) throw new Error('STYTCH_ACCESS_TOKEN_AUDIENCE_MISSING');

  return {
    issuer: payload.iss,
    subject: payload.sub,
    audiences,
    clientId: payload.client_id,
    scopes: parseScopes(payload.scope),
    expiresAt: payload.exp,
    ...(typeof payload.jti === 'string' && payload.jti ? { tokenId: payload.jti } : {}),
  };
}

export function createStytchPublicMcpTokenVerifier(config: StytchPublicMcpVerifierConfig) {
  const projectOrigin = requireHttpsOrigin(config.projectDomain);
  const endpoint = new URL('/v1/oauth2/introspect', projectOrigin);
  const fetchFn = config.fetchFn ?? fetch;
  const timeoutMs = config.timeoutMs ?? 3_000;
  const allowedClientIds = new Set(config.allowedClientIds);
  if (allowedClientIds.size === 0
    || allowedClientIds.size !== config.allowedClientIds.length
    || [...allowedClientIds].some((clientId) => !clientId || clientId.length > 256)
    || timeoutMs < 100
    || timeoutMs > 10_000) {
    throw new Error('STYTCH_VERIFIER_CONFIG_INVALID');
  }

  return async function verifyAccessToken(token: string): Promise<VerifiedPublicMcpAccessToken> {
    if (!token) throw new Error('STYTCH_ACCESS_TOKEN_MISSING');
    const clientId = decodeUntrustedClientId(token);
    if (!allowedClientIds.has(clientId)) throw new Error('STYTCH_ACCESS_TOKEN_CLIENT_DENIED');
    const body = new URLSearchParams({
      token,
      token_type_hint: 'access_token',
      client_id: clientId,
    });
    const response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error('STYTCH_INTROSPECTION_UNAVAILABLE');
    return parseVerifiedToken(await response.json() as StytchIntrospectionPayload, clientId);
  };
}
