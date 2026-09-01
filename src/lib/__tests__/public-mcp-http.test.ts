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

test('M2 /mcp fails closed when its OAuth pilot is not configured', { concurrency: false }, async () => {
  const previous = process.env.SUMMA_MCP_FIXTURE_MODE;
  delete process.env.SUMMA_MCP_FIXTURE_MODE;
  try {
    const disabled = await POST(new Request('http://localhost/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(initializeRequest),
    }));
    assert.equal(disabled.status, 503);
    assert.equal((await disabled.json()).error, 'MCP_OAUTH_NOT_CONFIGURED');
  } finally {
    if (previous === undefined) delete process.env.SUMMA_MCP_FIXTURE_MODE;
    else process.env.SUMMA_MCP_FIXTURE_MODE = previous;
  }
});
