import { getAdminAuth, getAdminDb } from '@/lib/api/admin-sdk';
import {
  createCanonicalPublicMcpReadService,
} from '@/lib/private-integrations/conversational-pilot-read-service';
import {
  PUBLIC_MCP_OAUTH_SCOPES,
  resolvePublicMcpOAuthActor,
  type PublicMcpActorAccess,
  type PublicMcpGrant,
} from '@/lib/public-mcp/oauth';
import {
  createInMemoryPublicMcpRateLimiter,
  type PublicMcpOAuthHttpDependencies,
  type PublicMcpSafeLogEntry,
} from '@/lib/public-mcp/oauth-http';
import { readPublicMcpPilotConfig } from '@/lib/public-mcp/pilot-config';
import { PUBLIC_READ_TOOL_NAMES } from '@/lib/public-mcp/server';
import { createStytchPublicMcpTokenVerifier } from '@/lib/public-mcp/stytch-token-verifier';

type StoredMember = {
  role?: unknown;
  userOverrides?: unknown;
  userGrants?: unknown;
};

interface PublicMcpM2RuntimeOverrides {
  readConfigFn?: typeof readPublicMcpPilotConfig;
  createTokenVerifierFn?: typeof createStytchPublicMcpTokenVerifier;
  getAdminAuthFn?: typeof getAdminAuth;
  getAdminDbFn?: typeof getAdminDb;
  createReadServiceFn?: typeof createCanonicalPublicMcpReadService;
  logFn?: (entry: PublicMcpSafeLogEntry) => void;
}

function roleFromMember(value: unknown): PublicMcpActorAccess['role'] {
  return value === 'admin' || value === 'user' || value === 'viewer' ? value : null;
}

function memberAccess(
  userId: string,
  organizationId: string,
  exists: boolean,
  disabled: boolean,
  data: StoredMember | undefined
): PublicMcpActorAccess {
  return {
    userId,
    organizationId,
    membershipExists: exists,
    firebaseUserDisabled: disabled,
    pilotEnabled: true,
    role: roleFromMember(data?.role),
    userOverrides: data?.userOverrides && typeof data.userOverrides === 'object'
      ? data.userOverrides as { deny?: string[] }
      : null,
    userGrants: Array.isArray(data?.userGrants)
      ? data.userGrants.filter((value): value is string => typeof value === 'string')
      : null,
  };
}

function safeLog(entry: PublicMcpSafeLogEntry) {
  // `entry` only contains a hashed actor reference and stable internal codes.
  console.info('[public-mcp]', entry);
}

/**
 * Creates the only production boundary used by `/mcp`. It derives the actor
 * from the Stytch token and the fixed pilot binding; neither MCP arguments nor
 * the transport select a user, organization, client or scope.
 */
export function createPublicMcpM2HttpDependencies(
  env: NodeJS.ProcessEnv = process.env,
  overrides: PublicMcpM2RuntimeOverrides = {}
): PublicMcpOAuthHttpDependencies {
  const config = (overrides.readConfigFn ?? readPublicMcpPilotConfig)(env);
  const verifyAccessToken = (overrides.createTokenVerifierFn ?? createStytchPublicMcpTokenVerifier)({
    projectDomain: config.stytchProjectDomain,
    allowedClientIds: config.allowedClientIds,
  });
  const grant: PublicMcpGrant = {
    id: 'configured-stytch-pilot-grant',
    issuer: config.issuer,
    subject: config.stytchMemberId,
    userId: config.summaUserId,
    organizationId: config.summaOrganizationId,
    clientId: '',
    scopes: [...PUBLIC_MCP_OAUTH_SCOPES],
    // The contract has five read-only operations protected by four scopes:
    // the operational summary shares transactions.search.
    allowedTools: [...PUBLIC_READ_TOOL_NAMES],
    status: 'active',
  };
  const canonicalReadService = (overrides.createReadServiceFn ?? createCanonicalPublicMcpReadService)();

  return {
    async resolveActor(request) {
      return resolvePublicMcpOAuthActor(request, {
        expectedIssuer: config.issuer,
        // Stytch access tokens are addressed to the registered Connected App
        // client. Accept only the explicitly allowlisted pilot clients.
        expectedAudiences: config.allowedClientIds,
        resource: config.resource,
        verifyAccessToken,
        async findGrant(issuer, subject, clientId) {
          if (issuer !== grant.issuer
            || subject !== grant.subject
            || !config.allowedClientIds.includes(clientId)) {
            return null;
          }
          return { ...grant, clientId };
        },
        async loadActorAccess(userId, organizationId) {
          if (userId !== config.summaUserId || organizationId !== config.summaOrganizationId) {
            return null;
          }
          try {
            const [user, member] = await Promise.all([
              (overrides.getAdminAuthFn ?? getAdminAuth)().getUser(userId),
              (overrides.getAdminDbFn ?? getAdminDb)().doc(`organizations/${organizationId}/members/${userId}`).get(),
            ]);
            return memberAccess(
              userId,
              organizationId,
              member.exists,
              user.disabled === true,
              member.data() as StoredMember | undefined
            );
          } catch {
            // Do not distinguish an unavailable identity source from a missing
            // membership to an OAuth client.
            return null;
          }
        },
      });
    },
    // The MCP transport delegates all reads to this existing canonical pilot
    // service. It does not import or access Firestore itself.
    readService: {
      searchBankAccounts: (actor, input) => canonicalReadService.searchBankAccounts(actor.organizationId, input),
      searchContacts: (actor, input) => canonicalReadService.searchContacts(actor.organizationId, input),
      searchTransactions: (actor, input) => canonicalReadService.searchTransactions(actor.organizationId, input),
      getOperationalSummary: (actor, input) => canonicalReadService.getOperationalSummary(actor.organizationId, input),
    },
    resourceMetadataUrl: new URL(
      '/.well-known/oauth-protected-resource/mcp',
      config.resource
    ).toString(),
    rateLimiter: createInMemoryPublicMcpRateLimiter({ maxRequests: 30, windowMs: 60_000 }),
    log: overrides.logFn ?? safeLog,
  };
}
