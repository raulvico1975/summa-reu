import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPublicMcpProtectedResourceMetadata,
  PublicMcpAuthError,
  resolvePublicMcpOAuthActor,
  type PublicMcpActorAccess,
  type PublicMcpGrant,
  type PublicMcpOAuthDependencies,
  type VerifiedPublicMcpAccessToken,
} from '@/lib/public-mcp/oauth';
import { createStytchPublicMcpTokenVerifier } from '@/lib/public-mcp/stytch-token-verifier';

const ISSUER = 'https://auth.example.test';
const RESOURCE = 'https://mcp.example.test/mcp';
const PROJECT_ID = 'project-test-id';
const NOW = 1_800_000_000;

const verifiedToken: VerifiedPublicMcpAccessToken = {
  issuer: ISSUER,
  subject: 'oauth-user-1',
  audiences: ['chatgpt-client'],
  clientId: 'chatgpt-client',
  scopes: ['mcp.session.read', 'contacts.search'],
  expiresAt: NOW + 300,
  tokenId: 'token-1',
};

const grant: PublicMcpGrant = {
  id: 'grant-1',
  issuer: ISSUER,
  subject: 'oauth-user-1',
  userId: 'summa-user-1',
  organizationId: 'org-1',
  clientId: 'chatgpt-client',
  scopes: ['mcp.session.read', 'contacts.search'],
  allowedTools: ['get_session_context', 'search_contacts'],
  status: 'active',
};

const access: PublicMcpActorAccess = {
  userId: 'summa-user-1',
  organizationId: 'org-1',
  membershipExists: true,
  firebaseUserDisabled: false,
  pilotEnabled: true,
  role: 'viewer',
  userOverrides: { deny: ['sections.moviments'] },
  userGrants: ['sections.donants'],
};

function request(token = 'test-token') {
  return { headers: new Headers({ authorization: `Bearer ${token}` }) };
}

function fakeStytchAccessToken(clientId: string) {
  const payload = Buffer.from(JSON.stringify({ client_id: clientId })).toString('base64url');
  return `e30.${payload}.test-signature`;
}

function dependencies(overrides: Partial<{
  token: VerifiedPublicMcpAccessToken;
  grant: PublicMcpGrant | null;
  access: PublicMcpActorAccess | null;
}> = {}): PublicMcpOAuthDependencies {
  return {
    expectedIssuer: ISSUER,
    expectedAudiences: ['chatgpt-client'],
    resource: RESOURCE,
    now: () => NOW,
    async verifyAccessToken() { return overrides.token ?? verifiedToken; },
    async findGrant() { return overrides.grant === undefined ? grant : overrides.grant; },
    async loadActorAccess() { return overrides.access === undefined ? access : overrides.access; },
  };
}

async function expectAuthFailure(
  promise: Promise<unknown>,
  code: PublicMcpAuthError['code']
) {
  await assert.rejects(promise, (error: unknown) => {
    assert.equal(error instanceof PublicMcpAuthError, true);
    assert.equal((error as PublicMcpAuthError).code, code);
    return true;
  });
}

test('M2 publishes standard protected-resource metadata without provider secrets', () => {
  assert.deepEqual(buildPublicMcpProtectedResourceMetadata({
    resource: RESOURCE,
    authorizationServer: ISSUER,
    documentationUrl: 'https://summa.example.test/docs/mcp',
  }), {
    resource: RESOURCE,
    authorization_servers: [ISSUER],
    scopes_supported: [
      'mcp.session.read',
      'bank_accounts.search',
      'contacts.search',
      'transactions.search',
    ],
    bearer_methods_supported: ['header'],
    resource_name: 'Summa Social',
    resource_documentation: 'https://summa.example.test/docs/mcp',
  });
});

test('M2 derives an immutable actor from verified identity binding and canonical permissions', async () => {
  const actor = await resolvePublicMcpOAuthActor(request(), dependencies());
  assert.equal(actor.userId, 'summa-user-1');
  assert.equal(actor.organizationId, 'org-1');
  assert.deepEqual(actor.scopes, ['mcp.session.read', 'contacts.search']);
  assert.equal(actor.permissions.includes('sections.donants'), true);
  assert.equal(actor.permissions.includes('sections.moviments'), false);
  assert.equal(actor.entitlements.includes('mcp.read'), true);
  assert.deepEqual(actor.allowedTools, ['get_session_context', 'search_contacts']);
  assert.equal(Object.isFrozen(actor), true);
  assert.equal(Object.isFrozen(actor.allowedTools), true);
});

test('M2 rejects expired, wrong-issuer and wrong Connected App audience tokens', async () => {
  await expectAuthFailure(resolvePublicMcpOAuthActor(request(), dependencies({
    token: { ...verifiedToken, expiresAt: NOW },
  })), 'TOKEN_EXPIRED');
  await expectAuthFailure(resolvePublicMcpOAuthActor(request(), dependencies({
    token: { ...verifiedToken, issuer: 'https://wrong.example.test' },
  })), 'ISSUER_MISMATCH');
  await expectAuthFailure(resolvePublicMcpOAuthActor(request(), dependencies({
    token: { ...verifiedToken, audiences: [RESOURCE] },
  })), 'AUDIENCE_MISMATCH');
});

test('M2 rejects revoked bindings, missing scopes and cross-organization access drift', async () => {
  await expectAuthFailure(resolvePublicMcpOAuthActor(request(), dependencies({
    token: { ...verifiedToken, scopes: ['unknown.scope'] },
  })), 'INSUFFICIENT_SCOPE');
  await expectAuthFailure(resolvePublicMcpOAuthActor(request(), dependencies({
    grant: { ...grant, status: 'revoked' },
  })), 'IDENTITY_REVOKED');
  await expectAuthFailure(resolvePublicMcpOAuthActor(request(), dependencies({
    access: { ...access, organizationId: 'org-2' },
  })), 'CROSS_ORG_DENIED');
});

test('M2 binds every grant to one OAuth client and requires a real organization membership', async () => {
  await expectAuthFailure(resolvePublicMcpOAuthActor(request(), dependencies({
    grant: { ...grant, clientId: 'claude-client' },
  })), 'CLIENT_MISMATCH');
  await expectAuthFailure(resolvePublicMcpOAuthActor(request(), dependencies({
    access: { ...access, membershipExists: false },
  })), 'CROSS_ORG_DENIED');
  await expectAuthFailure(resolvePublicMcpOAuthActor(request(), dependencies({
    access: { ...access, firebaseUserDisabled: true },
  })), 'IDENTITY_REVOKED');
});

test('M2 Stytch verifier uses RFC 7662 introspection without a new runtime dependency', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const verify = createStytchPublicMcpTokenVerifier({
    projectDomain: ISSUER,
    allowedClientIds: ['chatgpt-client', 'claude-client'],
    fetchFn: async (input, init) => {
      capturedUrl = input.toString();
      capturedInit = init;
      return Response.json({
        active: true,
        aud: [PROJECT_ID],
        client_id: 'chatgpt-client',
        exp: NOW + 300,
        iss: ISSUER,
        scope: 'mcp.session.read contacts.search',
        sub: 'oauth-user-1',
      });
    },
  });

  const accessToken = fakeStytchAccessToken('chatgpt-client');
  const token = await verify(accessToken);
  assert.equal(capturedUrl, `${ISSUER}/v1/oauth2/introspect`);
  assert.equal(capturedInit?.method, 'POST');
  assert.equal((capturedInit?.headers as Record<string, string>).authorization, undefined);
  const body = new URLSearchParams(capturedInit?.body?.toString());
  assert.equal(body.get('token'), accessToken);
  assert.equal(body.get('client_id'), 'chatgpt-client');
  assert.equal(body.get('token_type_hint'), 'access_token');
  assert.deepEqual(token, {
    issuer: ISSUER,
    subject: 'oauth-user-1',
    audiences: [PROJECT_ID],
    clientId: 'chatgpt-client',
    scopes: ['mcp.session.read', 'contacts.search'],
    expiresAt: NOW + 300,
  });
});

test('M2 Stytch verifier fails closed on inactive or malformed introspection', async () => {
  const verify = createStytchPublicMcpTokenVerifier({
    projectDomain: ISSUER,
    allowedClientIds: ['chatgpt-client'],
    fetchFn: async () => Response.json({ active: false }),
  });
  await assert.rejects(
    verify(fakeStytchAccessToken('chatgpt-client')),
    /STYTCH_ACCESS_TOKEN_INACTIVE/
  );
  await assert.rejects(verify('opaque-test-token'), /STYTCH_ACCESS_TOKEN_MALFORMED/);
});

test('M2 Stytch verifier rejects unknown clients before network access', async () => {
  let fetchCalls = 0;
  const verify = createStytchPublicMcpTokenVerifier({
    projectDomain: ISSUER,
    allowedClientIds: ['chatgpt-client'],
    fetchFn: async () => {
      fetchCalls += 1;
      return Response.json({ active: false });
    },
  });

  await assert.rejects(
    verify(fakeStytchAccessToken('unknown-client')),
    /STYTCH_ACCESS_TOKEN_CLIENT_DENIED/
  );
  assert.equal(fetchCalls, 0);
});

test('M2 Stytch verifier treats the introspection response as authoritative', async () => {
  const verify = createStytchPublicMcpTokenVerifier({
    projectDomain: ISSUER,
    allowedClientIds: ['chatgpt-client'],
    fetchFn: async () => Response.json({
      active: true,
      aud: [RESOURCE],
      client_id: 'different-client',
      exp: NOW + 300,
      iss: ISSUER,
      scope: 'mcp.session.read',
      sub: 'oauth-user-1',
    }),
  });

  await assert.rejects(
    verify(fakeStytchAccessToken('chatgpt-client')),
    /STYTCH_ACCESS_TOKEN_CLIENT_MISMATCH/
  );
});
