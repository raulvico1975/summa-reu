import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createStytchConnectedAppsClient,
  parsePublicMcpAuthorizationRequest,
  StytchConnectedAppsProviderError,
} from '@/lib/public-mcp/stytch-connected-apps';

const ISSUER = 'https://auth.example.test';
const RESOURCE = 'https://mcp.example.test/mcp';
const CLIENT_ID = 'chatgpt-client';
const REDIRECT_URI = 'https://chatgpt.com/connector_platform_oauth_redirect';
const PKCE_CHALLENGE = 'a'.repeat(43);
const CHATGPT_SCOPES = [
  'openid',
  'email',
  'offline_access',
  'mcp.session.read',
  'bank_accounts.search',
  'contacts.search',
  'transactions.search',
].join(' ');

function authorizationParams(overrides: Record<string, string> = {}) {
  return new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'mcp.session.read contacts.search',
    state: 'state-1',
    code_challenge: PKCE_CHALLENGE,
    code_challenge_method: 'S256',
    resource: RESOURCE,
    ...overrides,
  });
}

test('M2 accepts ChatGPT OIDC protocol scopes without turning them into MCP permissions', () => {
  const parsed = parsePublicMcpAuthorizationRequest(authorizationParams({ scope: CHATGPT_SCOPES }), {
    allowedClientIds: [CLIENT_ID, 'claude-client'],
    resource: RESOURCE,
  });

  assert.deepEqual(parsed, {
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    responseType: 'code',
    scopes: [
      'openid',
      'email',
      'offline_access',
      'mcp.session.read',
      'bank_accounts.search',
      'contacts.search',
      'transactions.search',
    ],
    state: 'state-1',
    codeChallenge: PKCE_CHALLENGE,
    codeChallengeMethod: 'S256',
    resource: RESOURCE,
  });
});

test('M2 rejects unknown scopes, wrong resources, non-HTTPS redirects and PKCE downgrade', () => {
  const config = { allowedClientIds: [CLIENT_ID], resource: RESOURCE };
  assert.throws(
    () => parsePublicMcpAuthorizationRequest(authorizationParams({ scope: 'admin.write' }), config),
    /PUBLIC_MCP_OAUTH_SCOPE_INVALID/
  );
  assert.throws(
    () => parsePublicMcpAuthorizationRequest(authorizationParams({ scope: 'openid email offline_access unknown.scope mcp.session.read' }), config),
    /PUBLIC_MCP_OAUTH_SCOPE_INVALID/
  );
  assert.throws(
    () => parsePublicMcpAuthorizationRequest(authorizationParams({ resource: 'https://other.test/mcp' }), config),
    /PUBLIC_MCP_OAUTH_RESOURCE_INVALID/
  );
  assert.throws(
    () => parsePublicMcpAuthorizationRequest(authorizationParams({ redirect_uri: 'http://localhost/callback' }), config),
    /PUBLIC_MCP_OAUTH_REDIRECT_INVALID/
  );
  assert.throws(
    () => parsePublicMcpAuthorizationRequest(authorizationParams({ code_challenge_method: 'plain' }), config),
    /PUBLIC_MCP_OAUTH_PKCE_INVALID/
  );
});

test('M2 exchanges the real ChatGPT scope request server-side but exposes only MCP permissions', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = createStytchConnectedAppsClient({
    projectDomain: ISSUER,
    projectId: 'project-test-id',
    projectSecret: 'project-test-secret',
    allowedClientIds: [CLIENT_ID],
    resource: RESOURCE,
    fetchFn: async (input, init) => {
      calls.push({ url: input.toString(), init });
      if (input.toString().endsWith('/authorize/start')) {
        return Response.json({
          client: {
            client_id: CLIENT_ID,
            client_name: 'ChatGPT Work',
            client_description: 'Connector de Summa Social',
            client_type: 'third_party_public',
          },
          consent_required: true,
          scope_results: [
            { scope: 'openid', is_grantable: true },
            { scope: 'email', is_grantable: true },
            { scope: 'offline_access', is_grantable: true },
            { scope: 'mcp.session.read', description: 'Llegir context', is_grantable: true },
            { scope: 'bank_accounts.search', is_grantable: true },
            { scope: 'contacts.search', description: 'Cercar contactes', is_grantable: true },
            { scope: 'transactions.search', is_grantable: true },
          ],
        });
      }
      return Response.json({ redirect_uri: `${REDIRECT_URI}?code=code-1&state=state-1` });
    },
  });
  const request = parsePublicMcpAuthorizationRequest(authorizationParams({ scope: CHATGPT_SCOPES }), {
    allowedClientIds: [CLIENT_ID],
    resource: RESOURCE,
  });
  const identity = { memberId: 'member-1', organizationId: 'stytch-org-1' };

  const manifest = await client.startAuthorization(request, identity);
  const redirect = await client.submitAuthorization(request, identity, true);

  assert.equal(manifest.client.name, 'ChatGPT Work');
  assert.equal(manifest.scopes.every((scope) => scope.isGrantable), true);
  assert.deepEqual(
    manifest.scopes.map((scope) => scope.scope),
    ['mcp.session.read', 'bank_accounts.search', 'contacts.search', 'transactions.search']
  );
  assert.equal(redirect, `${REDIRECT_URI}?code=code-1&state=state-1`);
  assert.equal(calls.length, 2);
  const startBody = JSON.parse(calls[0].init?.body?.toString() ?? '{}');
  const submitBody = JSON.parse(calls[1].init?.body?.toString() ?? '{}');
  assert.equal(startBody.member_id, 'member-1');
  assert.deepEqual(startBody.scopes, CHATGPT_SCOPES.split(' '));
  assert.deepEqual(submitBody.scopes, CHATGPT_SCOPES.split(' '));
  assert.equal('resources' in submitBody, false);
  assert.equal(submitBody.code_challenge_method, 'S256');
  assert.equal(JSON.stringify(manifest).includes('project-test-secret'), false);
});

test('M2 captures only safe Stytch failure metadata and keeps the provider payload out of errors', async () => {
  const request = parsePublicMcpAuthorizationRequest(authorizationParams({ scope: CHATGPT_SCOPES }), {
    allowedClientIds: [CLIENT_ID],
    resource: RESOURCE,
  });
  const client = createStytchConnectedAppsClient({
    projectDomain: ISSUER,
    projectId: 'project-test-id',
    projectSecret: 'project-test-secret',
    allowedClientIds: [CLIENT_ID],
    resource: RESOURCE,
    fetchFn: async () => Response.json({
      request_id: 'request-test-1',
      error_type: 'invalid_request',
      error_message: 'must not be exposed',
      redirect_uri: 'https://attacker.example/secret',
    }, { status: 400 }),
  });

  await assert.rejects(
    client.submitAuthorization(request, { memberId: 'member-1', organizationId: 'stytch-org-1' }, true),
    (error: unknown) => {
      assert.ok(error instanceof StytchConnectedAppsProviderError);
      assert.deepEqual(error.providerFailure, {
        status: 400,
        code: 'invalid_request',
        requestId: 'request-test-1',
      });
      assert.equal(error.message.includes('attacker.example'), false);
      assert.equal(error.message.includes('must not be exposed'), false);
      return true;
    }
  );
});

test('M2 rejects ungrantable scopes and redirects outside the registered callback', async () => {
  const request = parsePublicMcpAuthorizationRequest(authorizationParams(), {
    allowedClientIds: [CLIENT_ID],
    resource: RESOURCE,
  });
  const identity = { memberId: 'member-1', organizationId: 'stytch-org-1' };
  const ungrantableClient = createStytchConnectedAppsClient({
    projectDomain: ISSUER,
    projectId: 'project-test-id',
    projectSecret: 'project-test-secret',
    allowedClientIds: [CLIENT_ID],
    resource: RESOURCE,
    fetchFn: async () => Response.json({
      connected_app: { client_id: CLIENT_ID, client_name: 'ChatGPT Work' },
      scope_results: [
        { scope: 'mcp.session.read', is_grantable: true },
        { scope: 'contacts.search', is_grantable: false },
      ],
    }),
  });
  await assert.rejects(
    ungrantableClient.startAuthorization(request, identity),
    /STYTCH_AUTHORIZE_SCOPE_NOT_GRANTABLE/
  );

  const redirectClient = createStytchConnectedAppsClient({
    projectDomain: ISSUER,
    projectId: 'project-test-id',
    projectSecret: 'project-test-secret',
    allowedClientIds: [CLIENT_ID],
    resource: RESOURCE,
    fetchFn: async () => Response.json({ redirect_uri: 'https://attacker.example/callback?code=x' }),
  });
  await assert.rejects(
    redirectClient.submitAuthorization(request, identity, true),
    /STYTCH_AUTHORIZE_REDIRECT_MISMATCH/
  );
});
