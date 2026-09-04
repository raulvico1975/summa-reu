import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createCanonicalPublicMcpReadService,
  type ConversationalSearchDataSource,
} from '@/lib/private-integrations/conversational-pilot-read-service';
import { createPublicMcpM2HttpDependencies } from '@/lib/public-mcp/m2-runtime';
import type { PublicMcpPilotConfig } from '@/lib/public-mcp/pilot-config';

const config: PublicMcpPilotConfig = {
  resource: 'https://mcp.example.test/mcp',
  issuer: 'https://auth.example.test',
  allowedClientIds: ['chatgpt-client'],
  stytchProjectDomain: 'https://auth.example.test',
  stytchProjectId: 'project-test-id',
  stytchProjectSecret: 'project-test-secret',
  summaUserId: 'summa-user-1',
  summaOrganizationId: 'summa-org-1',
  stytchMemberId: 'stytch-member-1',
  stytchOrganizationId: 'stytch-org-1',
};

function createDataSource(onOrganization: (orgId: string) => void): ConversationalSearchDataSource {
  return {
    async listBankAccounts(orgId) {
      onOrganization(orgId);
      return [];
    },
    async listContacts(orgId) {
      onOrganization(orgId);
      return [{
        id: 'contact-1', name: 'Contacte de prova', type: 'donor',
        taxId: '12345678Z', email: 'contacte@example.test',
      }];
    },
    async listTransactions({ orgId }) {
      onOrganization(orgId);
      return [];
    },
  };
}

function dependencies(subject = config.stytchMemberId) {
  const organizations: string[] = [];
  const readService = createCanonicalPublicMcpReadService(createDataSource((orgId) => organizations.push(orgId)));
  return {
    organizations,
    dependencies: createPublicMcpM2HttpDependencies({} as NodeJS.ProcessEnv, {
      readConfigFn: () => config,
      createTokenVerifierFn: () => async () => ({
        issuer: config.issuer,
        subject,
        audiences: ['chatgpt-client'],
        clientId: 'chatgpt-client',
        scopes: ['mcp.session.read', 'contacts.search'],
        expiresAt: Math.floor(Date.now() / 1000) + 60,
        tokenId: 'token-test-1',
      }),
      getAdminAuthFn: () => ({ async getUser() { return { disabled: false }; } }) as never,
      getAdminDbFn: () => ({
        doc(path: string) {
          assert.equal(path, 'organizations/summa-org-1/members/summa-user-1');
          return { async get() { return { exists: true, data: () => ({ role: 'viewer' }) }; } };
        },
      }) as never,
      createReadServiceFn: () => readService,
      logFn: () => undefined,
    }),
  };
}

test('M2 runtime derives the pilot actor and binds canonical reads to its organization', async () => {
  const runtime = dependencies();
  const actor = await runtime.dependencies.resolveActor(new Request(config.resource, {
    headers: { authorization: 'Bearer opaque-test-token' },
  }));

  assert.deepEqual(actor.scopes, ['mcp.session.read', 'contacts.search']);
  assert.deepEqual(actor.allowedTools, [
    'get_session_context',
    'search_bank_accounts',
    'search_contacts',
    'search_transactions',
    'get_entity_operational_summary',
  ]);
  const result = await runtime.dependencies.readService.searchContacts(actor, {
    q: 'prova', role: 'any', limit: 10,
  });
  assert.equal(result[0]?.emailMasked, 'c•••@example.test');
  assert.deepEqual(runtime.organizations, ['summa-org-1']);
});

test('M2 runtime rejects an unbound Stytch subject before canonical reads', async () => {
  const runtime = dependencies('different-stytch-member');
  await assert.rejects(
    runtime.dependencies.resolveActor(new Request(config.resource, {
      headers: { authorization: 'Bearer opaque-test-token' },
    })),
    /IDENTITY_NOT_BOUND/
  );
  assert.deepEqual(runtime.organizations, []);
});

test('M2 runtime depends on the canonical library service, not a private HTTP route', async () => {
  const source = await readFile(new URL('../public-mcp/m2-runtime.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /@\/app\/api\/integrations\/private/);
  assert.match(source, /conversational-pilot-read-service/);
});
