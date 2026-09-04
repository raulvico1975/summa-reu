import {
  PUBLIC_MCP_OAUTH_SCOPES,
  type PublicMcpOAuthScope,
} from '@/lib/public-mcp/oauth';

const PKCE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const OIDC_AUTHORIZATION_SCOPES = ['openid', 'email', 'offline_access'] as const;

type OidcAuthorizationScope = typeof OIDC_AUTHORIZATION_SCOPES[number];
type PublicMcpAuthorizationScope = PublicMcpOAuthScope | OidcAuthorizationScope;

export interface PublicMcpAuthorizationRequest {
  clientId: string;
  redirectUri: string;
  responseType: 'code';
  // OIDC protocol scopes may be required by ChatGPT during authorization, but
  // only PublicMcpOAuthScope values can become MCP permissions downstream.
  scopes: PublicMcpAuthorizationScope[];
  state: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  resource: string;
  nonce?: string;
  prompt?: string;
}

export interface StytchPublicMcpIdentity {
  memberId: string;
  organizationId: string;
}

export interface PublicMcpConsentManifest {
  client: {
    id: string;
    name: string;
    description?: string;
    type?: string;
  };
  consentRequired: boolean;
  scopes: Array<{
    scope: PublicMcpOAuthScope;
    description?: string;
    isGrantable: boolean;
  }>;
}

interface StytchConnectedAppsConfig {
  projectDomain: string;
  projectId: string;
  projectSecret: string;
  allowedClientIds: string[];
  resource: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export class StytchConnectedAppsProviderError extends Error {
  constructor(readonly providerFailure: {
    status: number;
    code?: string;
    requestId?: string;
  }) {
    super('STYTCH_CONNECTED_APPS_UNAVAILABLE');
    this.name = 'StytchConnectedAppsProviderError';
  }
}

function requireHttpsOrigin(value: string, errorCode: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:'
    || url.username
    || url.password
    || (url.pathname && url.pathname !== '/')
    || url.search
    || url.hash) {
    throw new Error(errorCode);
  }
  url.pathname = '';
  return url;
}

function requireHttpsUrl(value: string, errorCode: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error(errorCode);
  }
  return url;
}

function requireBounded(value: string | null, max: number, errorCode: string): string {
  if (!value || value.length > max) throw new Error(errorCode);
  return value;
}

function parseKnownScopes(value: string | null): PublicMcpAuthorizationScope[] {
  const knownScopes = new Set<string>([
    ...PUBLIC_MCP_OAUTH_SCOPES,
    ...OIDC_AUTHORIZATION_SCOPES,
  ]);
  const scopes = Array.from(new Set((value ?? '').split(/\s+/).filter(Boolean)));
  if (scopes.length === 0
    || !scopes.some((scope) => (PUBLIC_MCP_OAUTH_SCOPES as readonly string[]).includes(scope))
    || scopes.some((scope) => !knownScopes.has(scope))) {
    throw new Error('PUBLIC_MCP_OAUTH_SCOPE_INVALID');
  }
  return scopes as PublicMcpAuthorizationScope[];
}

export function parsePublicMcpAuthorizationRequest(
  params: URLSearchParams,
  config: { allowedClientIds: string[]; resource: string }
): PublicMcpAuthorizationRequest {
  const allowedClientIds = new Set(config.allowedClientIds);
  if (allowedClientIds.size === 0 || allowedClientIds.size !== config.allowedClientIds.length) {
    throw new Error('PUBLIC_MCP_OAUTH_CONFIG_INVALID');
  }
  const clientId = requireBounded(params.get('client_id'), 256, 'PUBLIC_MCP_OAUTH_CLIENT_INVALID');
  if (!allowedClientIds.has(clientId)) throw new Error('PUBLIC_MCP_OAUTH_CLIENT_DENIED');
  if (params.get('response_type') !== 'code') throw new Error('PUBLIC_MCP_OAUTH_RESPONSE_TYPE_INVALID');

  const redirectUriValue = requireBounded(
    params.get('redirect_uri'),
    2_048,
    'PUBLIC_MCP_OAUTH_REDIRECT_INVALID'
  );
  requireHttpsUrl(redirectUriValue, 'PUBLIC_MCP_OAUTH_REDIRECT_INVALID');
  const state = requireBounded(params.get('state'), 1_024, 'PUBLIC_MCP_OAUTH_STATE_INVALID');
  const codeChallenge = requireBounded(
    params.get('code_challenge'),
    128,
    'PUBLIC_MCP_OAUTH_PKCE_INVALID'
  );
  if (!PKCE_CHALLENGE_PATTERN.test(codeChallenge)
    || params.get('code_challenge_method') !== 'S256') {
    throw new Error('PUBLIC_MCP_OAUTH_PKCE_INVALID');
  }

  const requestedResources = params.getAll('resource');
  const normalizedResource = requireHttpsUrl(config.resource, 'PUBLIC_MCP_OAUTH_CONFIG_INVALID').toString();
  if (requestedResources.length !== 1
    || requireHttpsUrl(requestedResources[0], 'PUBLIC_MCP_OAUTH_RESOURCE_INVALID').toString()
      !== normalizedResource) {
    throw new Error('PUBLIC_MCP_OAUTH_RESOURCE_INVALID');
  }

  const nonce = params.get('nonce');
  const prompt = params.get('prompt');
  if ((nonce && nonce.length > 1_024) || (prompt && prompt.length > 128)) {
    throw new Error('PUBLIC_MCP_OAUTH_PARAMETER_INVALID');
  }

  return {
    clientId,
    redirectUri: redirectUriValue,
    responseType: 'code',
    scopes: parseKnownScopes(params.get('scope')),
    state,
    codeChallenge,
    codeChallengeMethod: 'S256',
    resource: normalizedResource,
    ...(nonce ? { nonce } : {}),
    ...(prompt ? { prompt } : {}),
  };
}

function stringField(value: unknown, errorCode: string): string {
  if (typeof value !== 'string' || !value) throw new Error(errorCode);
  return value;
}

function safeProviderIdentifier(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Za-z0-9._-]{1,128}$/.test(value)
    ? value
    : undefined;
}

function parseConsentManifest(
  value: unknown,
  request: PublicMcpAuthorizationRequest
): PublicMcpConsentManifest {
  if (!value || typeof value !== 'object') throw new Error('STYTCH_AUTHORIZE_RESPONSE_INVALID');
  const root = value as Record<string, unknown>;
  // Stytch returns the connected-app manifest under `client` in its current
  // OAuth authorize-start response. Keep the prior key for compatibility,
  // while applying the same strict client and scope validation below.
  const client = root.client ?? root.connected_app;
  if (!client || typeof client !== 'object' || !Array.isArray(root.scope_results)) {
    throw new Error('STYTCH_AUTHORIZE_RESPONSE_INVALID');
  }
  const clientRecord = client as Record<string, unknown>;
  const clientId = stringField(clientRecord.client_id ?? clientRecord.id, 'STYTCH_AUTHORIZE_RESPONSE_INVALID');
  if (clientId !== request.clientId) throw new Error('STYTCH_AUTHORIZE_CLIENT_MISMATCH');

  const requestedScopes = new Set<string>(request.scopes);
  const scopes = root.scope_results.map((scopeValue) => {
    if (!scopeValue || typeof scopeValue !== 'object') {
      throw new Error('STYTCH_AUTHORIZE_RESPONSE_INVALID');
    }
    const scopeRecord = scopeValue as Record<string, unknown>;
    const scope = stringField(scopeRecord.scope, 'STYTCH_AUTHORIZE_RESPONSE_INVALID');
    if (!requestedScopes.has(scope) || typeof scopeRecord.is_grantable !== 'boolean') {
      throw new Error('STYTCH_AUTHORIZE_SCOPE_MISMATCH');
    }
    return {
      scope: scope as PublicMcpAuthorizationScope,
      ...(typeof scopeRecord.description === 'string' && scopeRecord.description
        ? { description: scopeRecord.description }
        : {}),
      isGrantable: scopeRecord.is_grantable,
    };
  });
  if (scopes.length !== requestedScopes.size
    || scopes.some((scope) => !scope.isGrantable)) {
    throw new Error('STYTCH_AUTHORIZE_SCOPE_NOT_GRANTABLE');
  }

  const operationalScopes = scopes.filter(
    (scope): scope is PublicMcpConsentManifest['scopes'][number] =>
      (PUBLIC_MCP_OAUTH_SCOPES as readonly string[]).includes(scope.scope)
  );

  return {
    client: {
      id: clientId,
      name: stringField(clientRecord.client_name ?? clientRecord.name, 'STYTCH_AUTHORIZE_RESPONSE_INVALID'),
      ...(typeof clientRecord.client_description === 'string' && clientRecord.client_description
        ? { description: clientRecord.client_description }
        : {}),
      ...(typeof clientRecord.client_type === 'string' && clientRecord.client_type
        ? { type: clientRecord.client_type }
        : {}),
    },
    consentRequired: root.consent_required !== false,
    scopes: operationalScopes,
  };
}

function validateAuthorizationRedirect(value: unknown, registeredRedirectUri: string): string {
  const redirect = requireHttpsUrl(
    stringField(value, 'STYTCH_AUTHORIZE_REDIRECT_INVALID'),
    'STYTCH_AUTHORIZE_REDIRECT_INVALID'
  );
  const registered = requireHttpsUrl(registeredRedirectUri, 'STYTCH_AUTHORIZE_REDIRECT_INVALID');
  if (redirect.origin !== registered.origin || redirect.pathname !== registered.pathname) {
    throw new Error('STYTCH_AUTHORIZE_REDIRECT_MISMATCH');
  }
  for (const [key, expectedValue] of registered.searchParams) {
    if (redirect.searchParams.get(key) !== expectedValue) {
      throw new Error('STYTCH_AUTHORIZE_REDIRECT_MISMATCH');
    }
  }
  return redirect.toString();
}

export function createStytchConnectedAppsClient(config: StytchConnectedAppsConfig) {
  const projectOrigin = requireHttpsOrigin(config.projectDomain, 'STYTCH_CONNECTED_APPS_CONFIG_INVALID');
  const resource = requireHttpsUrl(config.resource, 'STYTCH_CONNECTED_APPS_CONFIG_INVALID').toString();
  const allowedClientIds = new Set(config.allowedClientIds);
  const timeoutMs = config.timeoutMs ?? 5_000;
  if (!config.projectId
    || !config.projectSecret
    || allowedClientIds.size === 0
    || allowedClientIds.size !== config.allowedClientIds.length
    || timeoutMs < 100
    || timeoutMs > 10_000) {
    throw new Error('STYTCH_CONNECTED_APPS_CONFIG_INVALID');
  }
  const fetchFn = config.fetchFn ?? fetch;
  const authorization = `Basic ${Buffer.from(`${config.projectId}:${config.projectSecret}`).toString('base64')}`;

  async function post(path: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await fetchFn(new URL(path, projectOrigin), {
      method: 'POST',
      headers: {
        authorization,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      let payload: Record<string, unknown> | undefined;
      try {
        const value = await response.json();
        payload = value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
      } catch {
        // Stytch failures without JSON still map to the same fail-closed response.
      }
      throw new StytchConnectedAppsProviderError({
        status: response.status,
        ...(safeProviderIdentifier(payload?.error_type)
          ? { code: safeProviderIdentifier(payload?.error_type) }
          : {}),
        ...(safeProviderIdentifier(payload?.request_id)
          ? { requestId: safeProviderIdentifier(payload?.request_id) }
          : {}),
      });
    }
    return response.json();
  }

  function validateRequest(request: PublicMcpAuthorizationRequest) {
    if (!allowedClientIds.has(request.clientId) || request.resource !== resource) {
      throw new Error('STYTCH_CONNECTED_APPS_REQUEST_DENIED');
    }
  }

  return {
    async startAuthorization(
      request: PublicMcpAuthorizationRequest,
      identity: StytchPublicMcpIdentity
    ): Promise<PublicMcpConsentManifest> {
      validateRequest(request);
      const response = await post('/v1/b2b/idp/oauth/authorize/start', {
        client_id: request.clientId,
        redirect_uri: request.redirectUri,
        response_type: request.responseType,
        scopes: request.scopes,
        member_id: identity.memberId,
        organization_id: identity.organizationId,
        ...(request.prompt ? { prompt: request.prompt } : {}),
      });
      return parseConsentManifest(response, request);
    },

    async submitAuthorization(
      request: PublicMcpAuthorizationRequest,
      identity: StytchPublicMcpIdentity,
      consentGranted: boolean
    ): Promise<string> {
      validateRequest(request);
      const response = await post('/v1/b2b/idp/oauth/authorize', {
        client_id: request.clientId,
        redirect_uri: request.redirectUri,
        response_type: request.responseType,
        scopes: request.scopes,
        state: request.state,
        code_challenge: request.codeChallenge,
        member_id: identity.memberId,
        organization_id: identity.organizationId,
        consent_granted: consentGranted,
        ...(request.nonce ? { nonce: request.nonce } : {}),
        ...(request.prompt ? { prompt: request.prompt } : {}),
      }) as Record<string, unknown>;
      return validateAuthorizationRedirect(response.redirect_uri, request.redirectUri);
    },
  };
}
