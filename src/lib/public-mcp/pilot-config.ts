export interface PublicMcpPilotConfig {
  resource: string;
  issuer: string;
  allowedClientIds: string[];
  stytchProjectDomain: string;
  stytchProjectId: string;
  stytchProjectSecret: string;
  summaUserId: string;
  summaOrganizationId: string;
  stytchMemberId: string;
  stytchOrganizationId: string;
}

function requireValue(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error('PUBLIC_MCP_PILOT_NOT_CONFIGURED');
  return value;
}

function normalizeHttpsOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password
    || (url.pathname && url.pathname !== '/') || url.search || url.hash) {
    throw new Error('PUBLIC_MCP_PILOT_NOT_CONFIGURED');
  }
  return url.origin;
}

function requireSameHttpsOrigin(issuer: string, projectDomain: string): string {
  const normalizedIssuer = normalizeHttpsOrigin(issuer);
  if (normalizedIssuer !== normalizeHttpsOrigin(projectDomain)) {
    throw new Error('PUBLIC_MCP_PILOT_NOT_CONFIGURED');
  }
  return normalizedIssuer;
}

export function readPublicMcpPilotConfig(
  env: NodeJS.ProcessEnv = process.env
): PublicMcpPilotConfig {
  const allowedClientIds = requireValue(env, 'SUMMA_MCP_OAUTH_CLIENT_IDS')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowedClientIds.length === 0
    || allowedClientIds.length > 4
    || new Set(allowedClientIds).size !== allowedClientIds.length) {
    throw new Error('PUBLIC_MCP_PILOT_NOT_CONFIGURED');
  }

  const issuer = requireValue(env, 'SUMMA_MCP_OAUTH_ISSUER');
  const stytchProjectDomain = requireValue(env, 'SUMMA_MCP_STYTCH_PROJECT_DOMAIN');
  const normalizedIssuer = requireSameHttpsOrigin(issuer, stytchProjectDomain);

  return {
    resource: requireValue(env, 'SUMMA_MCP_RESOURCE'),
    issuer: normalizedIssuer,
    allowedClientIds,
    stytchProjectDomain: normalizedIssuer,
    stytchProjectId: requireValue(env, 'SUMMA_MCP_STYTCH_PROJECT_ID'),
    stytchProjectSecret: requireValue(env, 'SUMMA_MCP_STYTCH_PROJECT_SECRET'),
    summaUserId: requireValue(env, 'SUMMA_MCP_PILOT_USER_ID'),
    summaOrganizationId: requireValue(env, 'SUMMA_MCP_PILOT_ORGANIZATION_ID'),
    stytchMemberId: requireValue(env, 'SUMMA_MCP_STYTCH_MEMBER_ID'),
    stytchOrganizationId: requireValue(env, 'SUMMA_MCP_STYTCH_ORGANIZATION_ID'),
  };
}
