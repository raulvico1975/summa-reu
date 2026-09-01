import assert from 'node:assert/strict';
import test from 'node:test';
import { readPublicMcpPilotConfig } from '@/lib/public-mcp/pilot-config';

function env(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    SUMMA_MCP_RESOURCE: 'https://mcp.example.test/mcp',
    SUMMA_MCP_OAUTH_ISSUER: 'https://auth.example.test',
    SUMMA_MCP_OAUTH_CLIENT_IDS: 'chatgpt-client,claude-client',
    SUMMA_MCP_STYTCH_PROJECT_DOMAIN: 'https://auth.example.test/',
    SUMMA_MCP_STYTCH_PROJECT_ID: 'project-test-id',
    SUMMA_MCP_STYTCH_PROJECT_SECRET: 'project-test-secret',
    SUMMA_MCP_PILOT_USER_ID: 'summa-user-1',
    SUMMA_MCP_PILOT_ORGANIZATION_ID: 'summa-org-1',
    SUMMA_MCP_STYTCH_MEMBER_ID: 'stytch-member-1',
    SUMMA_MCP_STYTCH_ORGANIZATION_ID: 'stytch-org-1',
    ...overrides,
  } as unknown as NodeJS.ProcessEnv;
}

test('M2 pilot configuration requires its OAuth issuer and Stytch project domain to share one origin', () => {
  assert.equal(readPublicMcpPilotConfig(env()).issuer, 'https://auth.example.test');
  assert.throws(
    () => readPublicMcpPilotConfig(env({ SUMMA_MCP_STYTCH_PROJECT_DOMAIN: 'https://other-auth.example.test' })),
    /PUBLIC_MCP_PILOT_NOT_CONFIGURED/
  );
});
