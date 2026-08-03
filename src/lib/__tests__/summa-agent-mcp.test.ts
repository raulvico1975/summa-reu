import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as XLSX from 'xlsx';
import { SummaPrivateIntegrationClient } from '@/lib/summa-agent-mcp/client';
import {
  parseEnabledToolNames,
  SummaAgentMcpServer,
} from '@/lib/summa-agent-mcp/server';
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
    'search_bank_accounts',
    'search_contacts',
    'search_transactions',
    'preview_bank_statement_import',
    'prepare_bank_statement_import_plan',
    'commit_bank_statement_import',
    'prepare_donation_classification',
    'prepare_donation_classification_plan',
    'apply_donation_classification',
    'prepare_individual_donation_certificate',
    'generate_individual_donation_certificate',
    'upload_pending_document',
    'link_pending_document_to_transaction',
    'get_entity_operational_summary',
  ]);
});

test('MCP allowlist exposes and dispatches only the three prepare-only tools', async () => {
  const calls: string[] = [];
  const client = new SummaPrivateIntegrationClient({
    baseUrl: 'http://summa.local',
    token: 'token-a',
    defaultOrgId: 'org-a',
    fetchFn: async (url) => {
      calls.push(String(url));
      return jsonResponse({ success: true, preparation: { prepared: false } });
    },
  });
  const enabled = parseEnabledToolNames([
    'preview_bank_statement_import',
    'prepare_donation_classification',
    'prepare_individual_donation_certificate',
  ].join(','));
  const server = new SummaAgentMcpServer(client, enabled);

  const listResponse = await server.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const tools = (listResponse?.result as { tools: Array<{ name: string }> }).tools;
  assert.deepEqual(tools.map((tool) => tool.name), [
    'preview_bank_statement_import',
    'prepare_donation_classification',
    'prepare_individual_donation_certificate',
  ]);

  const blockedResponse = await server.handle({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'search_contacts', arguments: { q: 'tipsa' } },
  });
  assert.equal(blockedResponse?.error && (blockedResponse.error as { message: string }).message,
    'Tool not enabled: search_contacts');
  assert.deepEqual(calls, []);
});

test('MCP allowlist rejects unknown tool names', () => {
  assert.throws(
    () => parseEnabledToolNames('preview_bank_statement_import,generate_certificate'),
    /Unknown SUMMA_MCP_ENABLED_TOOLS: generate_certificate/
  );
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

test('bank import plan and commit use separate endpoints and require exact human confirmation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'summa-mcp-bank-plan-'));
  const filePath = join(dir, 'extracte.csv');
  await writeFile(filePath, [
    'Fecha operación;Concepto;Importe;Saldo',
    '01/08/2026;Fundacion Tipsa;20000,00;25000,00',
  ].join('\n'));
  try {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const client = new SummaPrivateIntegrationClient({
      baseUrl: 'http://summa.local',
      token: 'token-a',
      defaultOrgId: 'org-a',
      fetchFn: async (url, init) => {
        calls.push({ url: String(url), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
        return jsonResponse({ success: true });
      },
    });
    await client.prepareBankStatementImportPlan({
      bankAccountId: 'bank-a',
      filePath,
      selectedRowIndexes: [2],
    });
    await assert.rejects(
      () => client.commitBankStatementImport({
        planId: 'plan-a',
        bankAccountId: 'bank-a',
        fileSha256: 'a'.repeat(64),
        inputHash: 'b'.repeat(64),
        selectedRowIndexes: [2],
        confirmationText: 'CONFIRMO',
        humanConfirmed: false as never,
      }),
      /humanConfirmed must be true/
    );
    await client.commitBankStatementImport({
      planId: 'plan-a',
      bankAccountId: 'bank-a',
      fileSha256: 'a'.repeat(64),
      inputHash: 'b'.repeat(64),
      selectedRowIndexes: [2],
      confirmationText: 'CONFIRMO',
      humanConfirmed: true,
    });

    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'http://summa.local/api/integrations/private/bank-import/plan');
    assert.deepEqual(calls[0].body.selectedRowIndexes, [2]);
    assert.equal(calls[1].url, 'http://summa.local/api/integrations/private/bank-import/commit');
    assert.equal(calls[1].body.humanConfirmed, true);
    assert.equal(calls[1].body.confirmationText, 'CONFIRMO');
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
      },
    },
  });

  assert.deepEqual(calls, [
    'http://summa.local/api/integrations/private/donations/classification/prepare',
    'http://summa.local/api/integrations/private/certificates/individual/plan',
  ]);
  assert.equal(calls.some((url) => /commit|apply|generate|send|transactions\/import/.test(url)), false);
});

test('individual certificate generate requires confirmation and writes one new verified PDF inside the configured directory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'summa-mcp-cert-'));
  const outputPath = join(dir, 'tipsa.pdf');
  const pdfBytes = Buffer.from('%PDF-1.3 canonical summa test');
  const { createHash } = await import('node:crypto');
  const pdfSha256 = createHash('sha256').update(pdfBytes).digest('hex');
  const calls: string[] = [];
  try {
    const client = new SummaPrivateIntegrationClient({
      baseUrl: 'http://summa.local', token: 'token-a', defaultOrgId: 'org-a', outputDir: dir,
      fetchFn: async (url) => {
        calls.push(String(url));
        return jsonResponse({ success: true, generated: true, filename: 'canonical.pdf', pdfBase64: pdfBytes.toString('base64'), pdfSha256, pdfSizeBytes: pdfBytes.length, warnings: [] });
      },
    });
    const base = { planId: 'plan-a', transactionId: 'tx-a', donorId: 'donor-a', preconditionToken: 'pre-a', confirmationText: 'CONFIRMO', outputPath };
    await assert.rejects(() => client.generateIndividualDonationCertificate({ ...base, humanConfirmed: false as never }), /humanConfirmed must be true/);
    const result = await client.generateIndividualDonationCertificate({ ...base, humanConfirmed: true });
    assert.equal(calls[0], 'http://summa.local/api/integrations/private/certificates/individual/generate');
    assert.equal(result.outputPath, outputPath);
    assert.equal(result.pdfSha256, pdfSha256);
    assert.equal(await readFile(outputPath, 'utf8'), pdfBytes.toString());
    await assert.rejects(() => client.generateIndividualDonationCertificate({ ...base, humanConfirmed: true }), /OUTPUT_FILE_ALREADY_EXISTS/);
    await assert.rejects(() => client.generateIndividualDonationCertificate({ ...base, humanConfirmed: true, outputPath: join(tmpdir(), 'outside.pdf') }), /SUMMA_MCP_OUTPUT_DIR/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('donation classification plan and apply are separate and apply requires confirmation', async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const client = new SummaPrivateIntegrationClient({
    baseUrl: 'http://summa.local', token: 'token-a', defaultOrgId: 'org-a',
    fetchFn: async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
      return jsonResponse({ success: true });
    },
  });
  await client.prepareDonationClassificationPlan({ transactionId: 'tx-a', donorId: 'donor-a' });
  await assert.rejects(
    () => client.applyDonationClassification({
      planId: 'plan-a', transactionId: 'tx-a', donorId: 'donor-a',
      preconditionToken: 'pre-a', confirmationText: 'CONFIRMO', humanConfirmed: false as never,
    }),
    /humanConfirmed must be true/
  );
  await client.applyDonationClassification({
    planId: 'plan-a', transactionId: 'tx-a', donorId: 'donor-a',
    preconditionToken: 'pre-a', confirmationText: 'CONFIRMO', humanConfirmed: true,
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'http://summa.local/api/integrations/private/donations/classification/plan');
  assert.equal(calls[1].url, 'http://summa.local/api/integrations/private/donations/classification/apply');
  assert.equal(calls[1].body.humanConfirmed, true);
  assert.equal(calls[1].body.preconditionToken, 'pre-a');
});

test('search tools call only the private integration API with org isolation headers', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new SummaPrivateIntegrationClient({
    baseUrl: 'http://summa.local',
    token: 'token-a',
    defaultOrgId: 'org-a',
    fetchFn: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({ success: true, candidates: [] });
    },
  });

  await client.searchBankAccounts({ q: 'caixa', limit: 5 });
  await client.searchContacts({ q: 'alpha', limit: 5 });
  await client.searchTransactions({ q: 'tipsa', amount: 20_000, limit: 5 });

  assert.equal(calls.length, 3);
  assert.match(calls[0].url, /\/api\/integrations\/private\/conversational-search\/bank-accounts\?/);
  assert.match(calls[0].url, /q=caixa/);
  assert.match(calls[1].url, /\/api\/integrations\/private\/conversational-search\/contacts\?/);
  assert.match(calls[1].url, /q=alpha/);
  assert.match(calls[2].url, /\/api\/integrations\/private\/conversational-search\/transactions\?/);
  assert.match(calls[2].url, /q=tipsa/);
  assert.match(calls[2].url, /amount=20000/);
  for (const call of calls) {
    assert.match(call.url, /orgId=org-a/);
    assert.equal((call.init?.headers as Record<string, string>).Authorization, 'Bearer token-a');
    assert.doesNotMatch(call.url, /commit|apply|generate|send|import/);
  }
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
