export interface PublicMcpPilotConfig {
  resource: string;
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

  return {
    resource: requireValue(env, 'SUMMA_MCP_RESOURCE'),
    allowedClientIds,
    stytchProjectDomain: requireValue(env, 'SUMMA_MCP_STYTCH_PROJECT_DOMAIN'),
    stytchProjectId: requireValue(env, 'SUMMA_MCP_STYTCH_PROJECT_ID'),
    stytchProjectSecret: requireValue(env, 'SUMMA_MCP_STYTCH_PROJECT_SECRET'),
    summaUserId: requireValue(env, 'SUMMA_MCP_PILOT_USER_ID'),
    summaOrganizationId: requireValue(env, 'SUMMA_MCP_PILOT_ORGANIZATION_ID'),
    stytchMemberId: requireValue(env, 'SUMMA_MCP_STYTCH_MEMBER_ID'),
    stytchOrganizationId: requireValue(env, 'SUMMA_MCP_STYTCH_ORGANIZATION_ID'),
  };
}
