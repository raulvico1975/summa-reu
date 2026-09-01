import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import {
  handlePublicMcpAuthorizationStart,
  handlePublicMcpAuthorizationSubmit,
} from '@/app/api/mcp/oauth/authorize/handler';
import type { PublicMcpPilotConfig } from '@/lib/public-mcp/pilot-config';

const config: PublicMcpPilotConfig = {
  resource: 'https://mcp.example.test/mcp',
  allowedClientIds: ['chatgpt-client'],
  stytchProjectDomain: 'https://auth.example.test',
  stytchProjectId: 'project-test-id',
  stytchProjectSecret: 'project-test-secret',
  summaUserId: 'summa-user-1',
  summaOrganizationId: 'summa-org-1',
  stytchMemberId: 'stytch-member-1',
  stytchOrganizationId: 'stytch-org-1',
};

function request(body: Record<string, unknown>) {
  return new NextRequest('https://summa.example.test/api/mcp/oauth/authorize/start', {
    method: 'POST',
    headers: {
      authorization: 'Bearer firebase-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function mockDb(memberExists: boolean) {
  return {
    doc(path: string) {
      assert.equal(path, 'organizations/summa-org-1/members/summa-user-1');
      return { async get() { return { exists: memberExists }; } };
    },
  } as unknown as Firestore;
}

const baseDeps = {
  verifyIdTokenFn: async () => ({ uid: 'summa-user-1' }),
  getAdminDbFn: () => mockDb(true),
  readConfigFn: () => config,
};

test('M2 authorization handler binds Firebase identity to the configured pilot member', async () => {
  const response = await handlePublicMcpAuthorizationStart(request({ query: 'client_id=chatgpt-client' }), {
    ...baseDeps,
    startAuthorizationFn: async (receivedConfig, query, identity) => {
      assert.equal(receivedConfig.summaOrganizationId, 'summa-org-1');
      assert.equal(query.get('client_id'), 'chatgpt-client');
      assert.deepEqual(identity, {
        memberId: 'stytch-member-1',
        organizationId: 'stytch-org-1',
      });
      return {
        client: { id: 'chatgpt-client', name: 'ChatGPT Work' },
        consentRequired: true,
        scopes: [{ scope: 'mcp.session.read', isGrantable: true }],
      };
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).manifest.client.name, 'ChatGPT Work');
});

test('M2 authorization handler denies users outside the pilot before calling Stytch', async () => {
  let providerCalls = 0;
  const response = await handlePublicMcpAuthorizationStart(request({ query: 'client_id=chatgpt-client' }), {
    ...baseDeps,
    verifyIdTokenFn: async () => ({ uid: 'other-user' }),
    startAuthorizationFn: async () => {
      providerCalls += 1;
      throw new Error('should not run');
    },
  });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, 'MCP_PILOT_NOT_ENABLED');
  assert.equal(providerCalls, 0);
});

test('M2 authorization handler requires direct organization membership without SuperAdmin bypass', async () => {
  const response = await handlePublicMcpAuthorizationStart(request({ query: 'client_id=chatgpt-client' }), {
    ...baseDeps,
    getAdminDbFn: () => mockDb(false),
  });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, 'ORGANIZATION_ACCESS_DENIED');
});

test('M2 authorization submit accepts an explicit decision and returns only a validated redirect', async () => {
  const response = await handlePublicMcpAuthorizationSubmit(request({
    query: 'client_id=chatgpt-client',
    consentGranted: false,
  }), {
    ...baseDeps,
    submitAuthorizationFn: async (_receivedConfig, _query, identity, consentGranted) => {
      assert.equal(identity.memberId, 'stytch-member-1');
      assert.equal(consentGranted, false);
      return 'https://chatgpt.com/connector_platform_oauth_redirect?error=access_denied';
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    redirectUri: 'https://chatgpt.com/connector_platform_oauth_redirect?error=access_denied',
  });
});

test('M2 authorization submit rejects an implicit consent value', async () => {
  const response = await handlePublicMcpAuthorizationSubmit(request({
    query: 'client_id=chatgpt-client',
    consentGranted: 'yes',
  }), baseDeps);

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'INVALID_BODY');
});
