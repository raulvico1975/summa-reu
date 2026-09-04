import { createHash } from 'node:crypto';
import {
  resolveEffectivePermissions,
  type PermissionKey,
  type UserPermissionOverrides,
} from '@/lib/permissions';
import type { PublicMcpActorContext } from '@/lib/public-mcp/server';

export const PUBLIC_MCP_OAUTH_SCOPES = [
  'mcp.session.read',
  'bank_accounts.search',
  'contacts.search',
  'transactions.search',
] as const;

export type PublicMcpOAuthScope = typeof PUBLIC_MCP_OAUTH_SCOPES[number];
export type PublicMcpOrganizationRole = 'admin' | 'user' | 'viewer';

export interface VerifiedPublicMcpAccessToken {
  issuer: string;
  subject: string;
  audiences: string[];
  clientId: string;
  scopes: string[];
  expiresAt: number;
  tokenId?: string | null;
}

export interface PublicMcpGrant {
  id: string;
  issuer: string;
  subject: string;
  userId: string;
  organizationId: string;
  clientId: string;
  scopes: PublicMcpOAuthScope[];
  allowedTools: PublicMcpActorContext['allowedTools'];
  status: 'active' | 'revoked';
}

export interface PublicMcpActorAccess {
  userId: string;
  organizationId: string;
  membershipExists: boolean;
  firebaseUserDisabled: boolean;
  pilotEnabled: boolean;
  role: PublicMcpOrganizationRole | null;
  userOverrides?: UserPermissionOverrides | null;
  userGrants?: string[] | null;
}

export interface PublicMcpOAuthDependencies {
  expectedIssuer: string;
  expectedAudience: string;
  resource: string;
  verifyAccessToken(token: string): Promise<VerifiedPublicMcpAccessToken>;
  findGrant(issuer: string, subject: string, clientId: string): Promise<PublicMcpGrant | null>;
  loadActorAccess(userId: string, organizationId: string): Promise<PublicMcpActorAccess | null>;
  now?: () => number;
}

export type PublicMcpAuthFailureCode =
  | 'MISSING_ACCESS_TOKEN'
  | 'INVALID_ACCESS_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'ISSUER_MISMATCH'
  | 'AUDIENCE_MISMATCH'
  | 'INSUFFICIENT_SCOPE'
  | 'IDENTITY_NOT_BOUND'
  | 'IDENTITY_REVOKED'
  | 'CLIENT_MISMATCH'
  | 'CROSS_ORG_DENIED'
  | 'MCP_NOT_ENABLED';

export class PublicMcpAuthError extends Error {
  constructor(
    readonly code: PublicMcpAuthFailureCode,
    readonly status: 401 | 403
  ) {
    super(code);
    this.name = 'PublicMcpAuthError';
  }
}

function requireHttpsUrl(value: string, label: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hash) {
    throw new Error(`${label} must be an HTTPS URL without a fragment`);
  }
  return url.toString().replace(/\/$/, '');
}

export function buildPublicMcpProtectedResourceMetadata(input: {
  resource: string;
  authorizationServer: string;
  documentationUrl?: string;
}) {
  const resource = requireHttpsUrl(input.resource, 'resource');
  const authorizationServer = requireHttpsUrl(input.authorizationServer, 'authorizationServer');
  const documentationUrl = input.documentationUrl
    ? requireHttpsUrl(input.documentationUrl, 'documentationUrl')
    : undefined;

  return {
    resource,
    authorization_servers: [authorizationServer],
    scopes_supported: [...PUBLIC_MCP_OAUTH_SCOPES],
    bearer_methods_supported: ['header'],
    resource_name: 'Summa Social',
    ...(documentationUrl ? { resource_documentation: documentationUrl } : {}),
  };
}

export function extractPublicMcpBearerToken(request: { headers: Headers }): string {
  const header = request.headers.get('authorization');
  const match = header?.match(/^Bearer\s+([^\s,]+)$/i);
  if (!match) throw new PublicMcpAuthError('MISSING_ACCESS_TOKEN', 401);
  return match[1];
}

function normalizeKnownScopes(scopes: string[]): PublicMcpOAuthScope[] {
  const known = new Set<string>(PUBLIC_MCP_OAUTH_SCOPES);
  return Array.from(new Set(scopes.filter((scope): scope is PublicMcpOAuthScope => known.has(scope))));
}

function enabledPermissionKeys(access: PublicMcpActorAccess): PermissionKey[] {
  const effective = resolveEffectivePermissions({
    role: access.role,
    userOverrides: access.userOverrides,
    userGrants: access.userGrants,
  });
  return (Object.entries(effective) as [PermissionKey, boolean][])
    .filter(([, enabled]) => enabled)
    .map(([permission]) => permission);
}

function fallbackTokenId(token: string): string {
  return `sha256:${createHash('sha256').update(token).digest('hex')}`;
}

export async function resolvePublicMcpOAuthActor(
  request: { headers: Headers },
  dependencies: PublicMcpOAuthDependencies
): Promise<PublicMcpActorContext> {
  const token = extractPublicMcpBearerToken(request);
  let verified: VerifiedPublicMcpAccessToken;
  try {
    verified = await dependencies.verifyAccessToken(token);
  } catch {
    throw new PublicMcpAuthError('INVALID_ACCESS_TOKEN', 401);
  }

  if (verified.issuer !== dependencies.expectedIssuer) {
    throw new PublicMcpAuthError('ISSUER_MISMATCH', 401);
  }
  if (verified.expiresAt <= (dependencies.now?.() ?? Math.floor(Date.now() / 1000))) {
    throw new PublicMcpAuthError('TOKEN_EXPIRED', 401);
  }
  if (!verified.audiences.includes(dependencies.expectedAudience)) {
    throw new PublicMcpAuthError('AUDIENCE_MISMATCH', 401);
  }

  const scopes = normalizeKnownScopes(verified.scopes);
  if (scopes.length === 0) {
    throw new PublicMcpAuthError('INSUFFICIENT_SCOPE', 403);
  }

  if (!verified.subject || !verified.clientId) {
    throw new PublicMcpAuthError('INVALID_ACCESS_TOKEN', 401);
  }

  const grant = await dependencies.findGrant(verified.issuer, verified.subject, verified.clientId);
  if (!grant) throw new PublicMcpAuthError('IDENTITY_NOT_BOUND', 403);
  if (grant.status !== 'active') throw new PublicMcpAuthError('IDENTITY_REVOKED', 401);
  if (grant.issuer !== verified.issuer || grant.subject !== verified.subject) {
    throw new PublicMcpAuthError('IDENTITY_NOT_BOUND', 403);
  }
  if (grant.clientId !== verified.clientId) throw new PublicMcpAuthError('CLIENT_MISMATCH', 403);

  const grantScopes = new Set(grant.scopes);
  const effectiveScopes = scopes.filter((scope) => grantScopes.has(scope));
  if (effectiveScopes.length === 0) throw new PublicMcpAuthError('INSUFFICIENT_SCOPE', 403);

  const access = await dependencies.loadActorAccess(grant.userId, grant.organizationId);
  if (!access
    || access.userId !== grant.userId
    || access.organizationId !== grant.organizationId
    || !access.membershipExists
    || !access.role) {
    throw new PublicMcpAuthError('CROSS_ORG_DENIED', 403);
  }
  if (access.firebaseUserDisabled) throw new PublicMcpAuthError('IDENTITY_REVOKED', 401);
  if (!access.pilotEnabled) throw new PublicMcpAuthError('MCP_NOT_ENABLED', 403);

  const actor: PublicMcpActorContext = {
    userId: grant.userId,
    organizationId: grant.organizationId,
    // M2 uses an explicit staging-pilot grant. This internal marker is not a
    // commercial plan entitlement and must not be persisted in a token.
    entitlements: Object.freeze(['mcp.read']) as string[],
    permissions: Object.freeze(enabledPermissionKeys(access)) as PermissionKey[],
    scopes: Object.freeze(effectiveScopes) as string[],
    clientId: verified.clientId,
    tokenId: verified.tokenId || fallbackTokenId(token),
    allowedTools: Object.freeze([...grant.allowedTools]) as PublicMcpActorContext['allowedTools'],
  };
  return Object.freeze(actor);
}
