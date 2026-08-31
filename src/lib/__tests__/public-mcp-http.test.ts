import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '@/app/mcp/route';

const initializeRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'summa-m1-http-test', version: '0.1.0' },
  },
};

test('M1 /mcp is disabled unless explicitly started in fixture mode', { concurrency: false }, async () => {
  const previous = process.env.SUMMA_MCP_FIXTURE_MODE;
  delete process.env.SUMMA_MCP_FIXTURE_MODE;
  try {
    const disabled = await POST(new Request('http://localhost/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(initializeRequest),
    }));
    assert.equal(disabled.status, 404);

    process.env.SUMMA_MCP_FIXTURE_MODE = '1';
    const enabled = await POST(new Request('http://localhost/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify(initializeRequest),
    }));
    assert.equal(enabled.status, 200);
    const payload = await enabled.json() as { result?: { capabilities?: { tools?: unknown } } };
    assert.equal(typeof payload.result?.capabilities?.tools, 'object');
  } finally {
    if (previous === undefined) delete process.env.SUMMA_MCP_FIXTURE_MODE;
    else process.env.SUMMA_MCP_FIXTURE_MODE = previous;
  }
});
