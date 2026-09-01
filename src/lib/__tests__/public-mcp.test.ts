import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  createFixturePublicMcpReadService,
  createLocalFixtureActor,
  createPublicMcpServer,
  type PublicMcpActorContext,
} from '@/lib/public-mcp/server';

async function connectFixtureServer(actor: PublicMcpActorContext = createLocalFixtureActor()) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createPublicMcpServer({
    actor,
    readService: createFixturePublicMcpReadService(),
  });
  const client = new Client({ name: 'summa-m1-test-client', version: '0.1.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}

test('M1 exposes exactly the read-only allowlist with MCP annotations', async () => {
  const { client, server } = await connectFixtureServer();
  try {
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), [
      'get_entity_operational_summary',
      'get_session_context',
      'search_bank_accounts',
      'search_contacts',
      'search_transactions',
    ]);
    for (const tool of listed.tools) {
      assert.deepEqual(tool.annotations, {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
      const securitySchemes = tool._meta?.securitySchemes as Array<{
        type?: string;
        scopes?: string[];
      }> | undefined;
      assert.equal(securitySchemes?.[0]?.type, 'oauth2');
      assert.equal((securitySchemes?.[0]?.scopes?.length ?? 0) > 0, true);
    }
  } finally {
    await server.close();
  }
});

test('M1 advertises usable input schemas for every tool with arguments', async () => {
  const { client, server } = await connectFixtureServer();
  try {
    const listed = await client.listTools();
    const byName = new Map(listed.tools.map((tool) => [tool.name, tool]));

    assert.deepEqual(
      Object.keys(byName.get('search_transactions')?.inputSchema.properties ?? {}).sort(),
      ['amount', 'amountTolerance', 'bankAccountId', 'dateFrom', 'dateTo', 'direction', 'limit', 'q']
    );
    assert.deepEqual(
      Object.keys(byName.get('get_entity_operational_summary')?.inputSchema.properties ?? {}).sort(),
      ['dateFrom', 'dateTo']
    );
    assert.deepEqual(
      byName.get('get_entity_operational_summary')?.inputSchema.required,
      ['dateFrom', 'dateTo']
    );
  } finally {
    await server.close();
  }
});

test('M1 keeps cross-field input validation fail-closed without hiding the advertised schema', async () => {
  const { client, server } = await connectFixtureServer();
  try {
    const missingFilter = await client.callTool({ name: 'search_transactions', arguments: {} });
    assert.equal(missingFilter.isError, true);
    assert.match(JSON.stringify(missingFilter.content), /At least one search filter is required/);

    const reversedRange = await client.callTool({
      name: 'get_entity_operational_summary',
      arguments: { dateFrom: '2026-02-01', dateTo: '2026-01-01' },
    });
    assert.equal(reversedRange.isError, true);
    assert.match(JSON.stringify(reversedRange.content), /dateFrom must not be after dateTo/);
  } finally {
    await server.close();
  }
});

test('M1 applies schema validation and returns compact structured content', async () => {
  const { client, server } = await connectFixtureServer();
  try {
    const tooShort = await client.callTool({ name: 'search_contacts', arguments: { q: 'x' } });
    assert.equal(tooShort.isError, true);
    const attemptedOrgOverride = await client.callTool({
      name: 'search_contacts',
      arguments: { q: 'prova', organizationId: 'other-org' },
    });
    assert.equal(attemptedOrgOverride.isError, true);

    const result = await client.callTool({ name: 'search_contacts', arguments: { q: 'prova' } });
    assert.equal(result.isError, undefined);
    assert.deepEqual(result.structuredContent, {
      candidates: [{
        id: 'contact_fixture_donor',
        name: 'Donant de prova',
        type: 'donor',
        taxIdMasked: '12•••••8Z',
        emailMasked: 'p•••@example.test',
        status: 'active',
        confidence: 'high',
      }],
    });
    assert.equal(JSON.stringify(result.structuredContent).includes('matchReasons'), false);
    assert.equal(JSON.stringify(result.structuredContent).includes('prova@example.test'), false);
  } finally {
    await server.close();
  }
});

test('M1 removes tools not granted by the immutable actor context', async () => {
  const actor = createLocalFixtureActor();
  actor.allowedTools = ['search_contacts'];
  const { client, server } = await connectFixtureServer(actor);
  try {
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name), ['search_contacts']);
    const unavailable = await client.callTool({ name: 'search_transactions', arguments: { q: 'prova' } });
    assert.equal(unavailable.isError, true);
  } finally {
    await server.close();
  }
});

test('M1 reuses canonical Summa permissions and filters unauthorized contact roles', async () => {
  const actor = createLocalFixtureActor();
  actor.allowedTools = ['search_contacts'];
  actor.permissions = ['sections.proveidors'];
  const { client, server } = await connectFixtureServer(actor);
  try {
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name), ['search_contacts']);

    const anyRole = await client.callTool({ name: 'search_contacts', arguments: { q: 'prova' } });
    assert.deepEqual(anyRole.structuredContent, { candidates: [] });

    const forbiddenRole = await client.callTool({
      name: 'search_contacts',
      arguments: { q: 'prova', role: 'donor' },
    });
    assert.equal(forbiddenRole.isError, true);
    assert.match(JSON.stringify(forbiddenRole.content), /TOOL_NOT_AUTHORIZED/);
  } finally {
    await server.close();
  }
});

test('the public MCP transport has no direct Firestore dependency', async () => {
  const source = await readFile(new URL('../public-mcp/server.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /getAdminDb|firebase-admin|createFirestore/i);
});
