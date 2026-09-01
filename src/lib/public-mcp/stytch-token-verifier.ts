import type { VerifiedPublicMcpAccessToken } from '@/lib/public-mcp/oauth';

interface StytchIntrospectionPayload {
  active?: unknown;
  aud?: unknown;
  client_id?: unknown;
  exp?: unknown;
  iss?: unknown;
  scope?: unknown;
  sub?: unknown;
}

export interface StytchPublicMcpVerifierConfig {
  projectDomain: string;
  clientId: string;
  clientSecret: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

function requireHttpsOrigin(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
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

function parseVerifiedToken(payload: StytchIntrospectionPayload): VerifiedPublicMcpAccessToken {
  if (payload.active !== true
    || typeof payload.iss !== 'string'
    || typeof payload.sub !== 'string'
    || typeof payload.client_id !== 'string'
    || typeof payload.exp !== 'number') {
    throw new Error('STYTCH_ACCESS_TOKEN_INACTIVE');
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
  };
}

export function createStytchPublicMcpTokenVerifier(config: StytchPublicMcpVerifierConfig) {
  const projectOrigin = requireHttpsOrigin(config.projectDomain);
  const endpoint = new URL('/v1/oauth2/introspect', projectOrigin);
  const fetchFn = config.fetchFn ?? fetch;
  const timeoutMs = config.timeoutMs ?? 3_000;
  if (!config.clientId || !config.clientSecret || timeoutMs < 100 || timeoutMs > 10_000) {
    throw new Error('STYTCH_VERIFIER_CONFIG_INVALID');
  }

  return async function verifyAccessToken(token: string): Promise<VerifiedPublicMcpAccessToken> {
    if (!token) throw new Error('STYTCH_ACCESS_TOKEN_MISSING');
    const body = new URLSearchParams({ token, token_type_hint: 'access_token' });
    const authorization = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    const response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Basic ${authorization}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error('STYTCH_INTROSPECTION_UNAVAILABLE');
    return parseVerifiedToken(await response.json() as StytchIntrospectionPayload);
  };
}
