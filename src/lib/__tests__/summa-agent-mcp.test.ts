import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as XLSX from 'xlsx';
import { SummaPrivateIntegrationClient } from '@/lib/summa-agent-mcp/client';
import { SummaAgentMcpServer } from '@/lib/summa-agent-mcp/server';
import {
  MAX_BANK_STATEMENT_BYTES,
  parseBankStatementFile,
} from '@/lib/summa-agent-mcp/bank-statement-file';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('MCP lists the private Summa Agent tools', async () => {
  const client = new SummaPrivateIntegrationClient({
    baseUrl: 'http://summa.local',
    token: 'token-a',
    defaultOrgId: 'org-a',
    fetchFn: async () => jsonResponse({ success: true }),
  });
  const server = new SummaAgentMcpServer(client);

  const response = await server.handle({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
  });

  const tools = (response?.result as { tools: Array<{ name: string }> }).tools;
  assert.deepEqual(tools.map((tool) => tool.name), [
    'search_contacts',
    'search_transactions',
    'preview_bank_statement_import',
    'prepare_donation_classification',
    'prepare_individual_donation_certificate',
    'upload_pending_document',
    'link_pending_document_to_transaction',
    'get_entity_operational_summary',
  ]);
});

test('bank statement local reader rejects missing, unsupported and oversized files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'summa-mcp-bank-invalid-'));
  const unsupported = join(dir, 'extracte.txt');
  const oversized = join(dir, 'extracte.csv');
  await writeFile(unsupported, 'data');
  await writeFile(oversized, Buffer.alloc(MAX_BANK_STATEMENT_BYTES + 1));

  try {
    await assert.rejects(
      () => parseBankStatementFile(join(dir, 'missing.csv'), 'bank-a'),
      /ENOENT/
    );
    await assert.rejects(
      () => parseBankStatementFile(unsupported, 'bank-a'),
      /UNSUPPORTED_BANK_STATEMENT_FILE_TYPE/
    );
    await assert.rejects(
      () => parseBankStatementFile(oversized, 'bank-a'),
      /BANK_STATEMENT_FILE_TOO_LARGE/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('bank statement local reader parses an Excel workbook and reports the selected sheet', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'summa-mcp-bank-xlsx-'));
  const filePath = join(dir, 'extracte.xlsx');
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Fecha operación', 'Concepto', 'Importe', 'Saldo'],
      ['01/08/2026', 'Fundacion Tipsa', 20_000, 25_000],
    ]),
    'Movimientos'
  );
  await writeFile(filePath, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));

  try {
    const parsed = await parseBankStatementFile(filePath, 'bank-a');
    assert.equal(parsed.file.source, 'xlsx');
    assert.equal(parsed.file.sheetName, 'Movimientos');
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0].tx.amount, 20_000);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('bank statement preview requires one absolute file, parses it locally and calls only the prepare endpoint', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'summa-mcp-bank-'));
  const filePath = join(dir, 'extracte.csv');
  await writeFile(filePath, [
    'Fecha operación;Concepto;Importe;Saldo',
    '01/08/2026;Fundacion Tipsa;20000,00;25000,00',
  ].join('\n'));

  try {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const client = new SummaPrivateIntegrationClient({
      baseUrl: 'http://summa.local',
      token: 'token-a',
      defaultOrgId: 'org-a',
      fetchFn: async (url, init) => {
        calls.push({ url: String(url), init });
        return jsonResponse({ success: true, preview: { prepared: true } });
      },
    });

    await client.previewBankStatementImport({ bankAccountId: 'bank-a', filePath });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://summa.local/api/integrations/private/bank-import/preview');
    assert.doesNotMatch(calls[0].url, /transactions\/import|commit|apply|generate|send/);
    const body = JSON.parse(String(calls[0].init?.body)) as {
      orgId: string;
      bankAccountId: string;
      file: { name: string; sha256: string; sheetName: string };
      rows: Array<{ tx: { amount: number; bankAccountId: string } }>;
    };
    assert.equal(body.orgId, 'org-a');
    assert.equal(body.bankAccountId, 'bank-a');
    assert.equal(body.file.name, 'extracte.csv');
    assert.match(body.file.sha256, /^[a-f0-9]{64}$/);
    assert.equal(body.rows.length, 1);
    assert.equal(body.rows[0].tx.amount, 20_000);
    assert.equal(body.rows[0].tx.bankAccountId, 'bank-a');

    await assert.rejects(
      () => parseBankStatementFile('extracte.csv', 'bank-a'),
      /absolute path/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('prepare tool dispatch calls only classification and certificate prepare endpoints', async () => {
  const calls: string[] = [];
  const client = new SummaPrivateIntegrationClient({
    baseUrl: 'http://summa.local',
    token: 'token-a',
    defaultOrgId: 'org-a',
    fetchFn: async (url) => {
      calls.push(String(url));
      return jsonResponse({ success: true, preparation: { prepared: true } });
    },
  });
  const server = new SummaAgentMcpServer(client);

  await server.handle({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'prepare_donation_classification',
      arguments: { transactionId: 'tx-a', donorId: 'donor-a' },
    },
  });
  await server.handle({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'prepare_individual_donation_certificate',
      arguments: {
        transactionId: 'tx-a',
        donorId: 'donor-a',
        useProposedClassification: true,
      },
    },
  });

  assert.deepEqual(calls, [
    'http://summa.local/api/integrations/private/donations/classification/prepare',
    'http://summa.local/api/integrations/private/certificates/individual/prepare',
  ]);
  assert.equal(calls.some((url) => /commit|apply|generate|send|transactions\/import/.test(url)), false);
});

test('search tools call only the private integration API with org isolation headers', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new SummaPrivateIntegrationClient({
    baseUrl: 'http://summa.local',
    token: 'token-a',
    defaultOrgId: 'org-a',
    fetchFn: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({ success: true, contacts: [] });
    },
  });

  await client.searchContacts({ q: 'alpha', limit: 5 });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/integrations\/private\/contacts\/search\?/);
  assert.match(calls[0].url, /orgId=org-a/);
  assert.match(calls[0].url, /q=alpha/);
  assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, 'Bearer token-a');
});

test('operational summary does not use pending documents read or fiscal endpoints', async () => {
  const urls: string[] = [];
  const client = new SummaPrivateIntegrationClient({
    baseUrl: 'http://summa.local',
    token: 'token-a',
    defaultOrgId: 'org-a',
    fetchFn: async (url) => {
      urls.push(String(url));
      return jsonResponse({
        success: true,
        transactions: [
          {
            id: 'tx-1',
            amount: 100,
            contactId: 'contact-1',
            bankAccountId: 'bank-1',
          },
          {
            id: 'tx-2',
            amount: -25,
            contactId: null,
            bankAccountId: 'bank-1',
          },
        ],
        nextCursor: null,
      });
    },
  });

  const summary = await client.getEntityOperationalSummary({ limit: 10 });

  assert.equal(urls.length, 1);
  assert.match(urls[0], /\/api\/integrations\/private\/transactions\/search\?/);
  assert.doesNotMatch(urls[0], /pending-documents|fiscal|remittances|donations/);
  assert.deepEqual(summary.pendingDocuments, {
    readable: false,
    reason: 'private integration API v1 does not expose pending_documents.read',
  });
  assert.deepEqual(summary.simpleAnomalies, {
    transactionsWithoutContact: 1,
    transactionsWithoutBankAccount: 0,
  });
});

test('upload pending document uses idempotency and never calls ledger routes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'summa-mcp-'));
  const filePath = join(dir, 'invoice.pdf');
  await writeFile(filePath, Buffer.from('invoice'));

  try {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const client = new SummaPrivateIntegrationClient({
      baseUrl: 'http://summa.local',
      token: 'token-a',
      defaultOrgId: 'org-a',
      sourceRepo: 'baruma-admin-agent',
      fetchFn: async (url, init) => {
        calls.push({ url: String(url), init });
        return jsonResponse({
          success: true,
          idempotent: false,
          pendingDocument: { id: 'intpd_1', status: 'draft' },
        }, 201);
      },
    });

    await client.uploadPendingDocument({
      filePath,
      idempotencyKey: 'mail-123',
      supplierName: 'ACME',
      amount: 10.5,
      invoiceDate: '2026-04-15',
    });

    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/api\/integrations\/private\/pending-documents\/upload\?/);
    assert.doesNotMatch(calls[0].url, /transactions|remittances|donations|fiscal/);
    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer token-a');
    assert.equal(headers['Idempotency-Key'], 'mail-123');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('link pending document calls only the private linking endpoint', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new SummaPrivateIntegrationClient({
    baseUrl: 'http://summa.local',
    token: 'token-a',
    defaultOrgId: 'org-a',
    fetchFn: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({
        success: true,
        linked: true,
        pendingDocumentId: 'intpd_1',
        transactionId: 'tx_1',
      });
    },
  });

  await client.linkPendingDocumentToTransaction({
    pendingDocumentId: 'intpd_1',
    transactionId: 'tx_1',
    caseId: 'case-1',
    documentHash: 'a'.repeat(64),
    expectedAmount: 90,
    expectedDate: '2026-05-04',
    reviewerLabel: 'Raul',
    note: 'OK granular pilot Baruma',
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/integrations\/private\/pending-documents\/link-transaction\?/);
  assert.doesNotMatch(calls[0].url, /remittances|donations|fiscal/);
  const headers = calls[0].init?.headers as Record<string, string>;
  assert.equal(headers.Authorization, 'Bearer token-a');
  assert.equal(headers['Content-Type'], 'application/json');
  const body = JSON.parse(String(calls[0].init?.body)) as Record<string, unknown>;
  assert.equal(body.orgId, 'org-a');
  assert.equal(body.pendingDocumentId, 'intpd_1');
  assert.equal(body.transactionId, 'tx_1');
});
