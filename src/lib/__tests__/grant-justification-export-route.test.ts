import assert from 'node:assert/strict';
import test from 'node:test';

import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';

import {
  handleGrantJustificationExportPost,
  loadGrantJustificationExportData,
} from '@/app/api/project-module/grant-justification/export/handler';
import type { MembershipValidation } from '@/lib/api/admin-sdk';

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/project-module/grant-justification/export', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const member: MembershipValidation = {
  valid: true,
  role: 'admin' as const,
  userOverrides: null,
  userGrants: null,
};

function deps(input: { allowed: boolean; access?: MembershipValidation; exportData?: Record<string, unknown> }) {
  let functionalReads = 0;
  const value = {
    verifyIdTokenFn: async () => ({ uid: 'user-1' }),
    getAdminDbFn: () => ({}) as never,
    validateUserMembershipFn: async () => input.access ?? member,
    resolveEntitlementFn: async () => ({
      allowed: input.allowed,
      diagnostics: [],
      enforcementMode: 'active' as const,
    }),
    loadExportDataFn: async () => {
      functionalReads += 1;
      return (input.exportData ?? {
        project: { id: 'project-1', name: 'Projecte', code: 'P-1', fxRate: null },
        budgetLines: [],
        expenseLinks: [],
        expenses: new Map(),
        fxTransfers: [],
        fundingSources: [],
        budgetAllocations: [],
        expenseAllocations: [],
      }) as never;
    },
  };
  return { value, getFunctionalReads: () => functionalReads };
}

test('Control o Management denegat no llegeix dades funcionals ni genera export', async () => {
  const scenario = deps({ allowed: false });
  const response = await handleGrantJustificationExportPost(request({
    orgId: 'org-1',
    projectId: 'project-1',
    kind: 'funding-xlsx',
  }), scenario.value);

  assert.equal(response.status, 403);
  assert.equal(scenario.getFunctionalReads(), 0);
});

test('multi-funding localitza filename full i capçalera amb mapa server-owned', async () => {
  const scenarios = [
    { locale: 'es', prefix: 'justificacion_proyecto_varios_financiadores', sheet: 'Gastos', header: 'Fecha gasto' },
    { locale: 'pt', prefix: 'justificacao_projeto_varios_financiadores', sheet: 'Despesas', header: 'Data da despesa' },
  ] as const;
  for (const scenario of scenarios) {
    const routeDeps = deps({ allowed: true });
    const response = await handleGrantJustificationExportPost(request({
      orgId: 'org-1', projectId: 'project-1', kind: 'multi-funding-xlsx', locale: scenario.locale,
    }), routeDeps.value);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-disposition') ?? '', new RegExp(scenario.prefix));
    const workbook = XLSX.read(await response.arrayBuffer(), { type: 'array' });
    assert.equal(workbook.SheetNames[0], scenario.sheet);
    const firstRow = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[scenario.sheet], { header: 1 })[0];
    assert.equal(firstRow?.[1], scenario.header);
  }
});

test('deny de secció projectes preval abans de l entitlement i les dades', async () => {
  const scenario = deps({
    allowed: true,
    access: { ...member, userOverrides: { deny: ['sections.projectes'] } },
  });
  const response = await handleGrantJustificationExportPost(request({
    orgId: 'org-1',
    projectId: 'project-1',
    kind: 'funding-xlsx',
  }), scenario.value);

  assert.equal(response.status, 403);
  assert.equal(scenario.getFunctionalReads(), 0);
});

test('Complete amb permís genera XLSX server-side', async () => {
  const scenario = deps({ allowed: true });
  const response = await handleGrantJustificationExportPost(request({
    orgId: 'org-1',
    projectId: 'project-1',
    kind: 'funding-xlsx',
    orderMode: 'chronological',
    locale: 'ca',
  }), scenario.value);

  assert.equal(response.status, 200);
  assert.equal(scenario.getFunctionalReads(), 1);
  assert.match(response.headers.get('content-type') ?? '', /spreadsheetml/);
  assert.ok((await response.arrayBuffer()).byteLength > 100);
});

test('locale XLSX és una allowlist server-owned CA ES FR PT', async () => {
  const expectedPrefixes = {
    ca: 'justificacio_financador',
    es: 'justificacion_financiador',
    fr: 'justification_financeur',
    pt: 'justificacao_financiador',
  } as const;

  for (const [locale, prefix] of Object.entries(expectedPrefixes)) {
    const scenario = deps({ allowed: true });
    const response = await handleGrantJustificationExportPost(request({
      orgId: 'org-1',
      projectId: 'project-1',
      kind: 'funding-xlsx',
      locale,
    }), scenario.value);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-disposition') ?? '', new RegExp(prefix));
  }

  const invalid = deps({ allowed: true });
  const response = await handleGrantJustificationExportPost(request({
    orgId: 'org-1', projectId: 'project-1', kind: 'funding-xlsx', locale: 'en',
  }), invalid.value);
  assert.equal(response.status, 400);
  assert.equal(invalid.getFunctionalReads(), 0);
});

test('IDs hostils es rebutgen abans de membership i dades', async () => {
  const scenario = deps({ allowed: true });
  const response = await handleGrantJustificationExportPost(request({
    orgId: '../org-1',
    projectId: 'project-1',
    kind: 'funding-xlsx',
  }), scenario.value);

  assert.equal(response.status, 400);
  assert.equal(scenario.getFunctionalReads(), 0);
});

test('loader server conserva primary i secondary del feed bancari', async () => {
  const documents = [
    { id: 'line-1', data: () => ({ name: 'Partida', code: '1', budgetedAmountEUR: 10, order: 1 }) },
  ];
  const link = {
    id: 'tx-1',
    data: () => ({
      projectIds: ['project-1'],
      assignments: [{ projectId: 'project-1', budgetLineId: 'line-1', amountEUR: 10 }],
      note: null,
    }),
  };
  const empty = { docs: [] };
  const db = {
    doc: (path: string) => ({
      get: async () => {
        if (path.endsWith('/projects/project-1')) {
          return { exists: true, id: 'project-1', data: () => ({ name: 'Projecte', code: 'P1', fxRate: null }) };
        }
        if (path.endsWith('/exports/projectExpenses/items/tx-1')) {
          return {
            exists: true,
            id: 'tx-1',
            data: () => ({
              date: '2026-01-01',
              description: 'Despesa',
              amountEUR: -10,
              categoryName: null,
              counterpartyName: 'Proveïdor',
              documents: [
                { fileUrl: 'https://example.test/secondary', storagePath: 'organizations/org-1/documents/tx-1/b.pdf', name: 'b.pdf', isPrimary: false },
                { fileUrl: 'https://example.test/primary', storagePath: 'organizations/org-1/documents/tx-1/a.pdf', name: 'a.pdf', isPrimary: true },
              ],
            }),
          };
        }
        return { exists: false, id: '', data: () => undefined };
      },
      collection: (name: string) => ({
        get: async () => name === 'budgetLines' ? { docs: documents } : empty,
      }),
    }),
    collection: (path: string) => ({
      where: () => ({ get: async () => ({ docs: [link] }) }),
      get: async () => path.endsWith('/expenseLinks') ? { docs: [link] } : empty,
    }),
  };

  const data = await loadGrantJustificationExportData(db as never, 'org-1', 'project-1');
  const expense = data?.expenses.get('tx-1');
  assert.equal(expense?.attachments?.length, 2);
  assert.equal(expense?.attachments?.[0]?.name, 'a.pdf');
  assert.equal(expense?.attachments?.[1]?.name, 'b.pdf');
});

test('XLSX server preserva TC ponderat i assignment FX null del flux canònic', async () => {
  const exportData = {
    project: { id: 'project-1', name: 'Projecte', code: 'P-1', fxRate: 10 },
    budgetLines: [{ id: 'line-1', name: 'Partida', code: '1', budgetedAmountEUR: 100, order: 1 }],
    expenseLinks: [{
      id: 'off_expense-1',
      projectIds: ['project-1'],
      assignments: [{ projectId: 'project-1', projectName: 'Projecte', budgetLineId: 'line-1', amountEUR: null, localPct: 100 }],
      note: null,
    }],
    expenses: new Map([['off_expense-1', {
      txId: 'off_expense-1', source: 'offBank', date: '2026-01-01', description: 'Material', amountEUR: 0,
      categoryName: null, counterpartyName: 'Proveïdor', documentUrl: null,
      originalCurrency: 'USD', originalAmount: 200, fxRate: null,
    }]]),
    fxTransfers: [{ id: 'fx-1', date: '2026-01-01', eurSent: 100, localReceived: 200, localCurrency: 'USD' }],
    fundingSources: [], budgetAllocations: [], expenseAllocations: [],
  };
  for (const kind of ['funding-xlsx', 'multi-funding-xlsx'] as const) {
    const routeDeps = deps({ allowed: true, exportData });
    const response = await handleGrantJustificationExportPost(request({
      orgId: 'org-1', projectId: 'project-1', kind, locale: 'ca',
    }), routeDeps.value);
    assert.equal(response.status, 200);
    const workbook = XLSX.read(await response.arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json<Array<string | number>>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    if (kind === 'funding-xlsx') {
      assert.equal(rows[1]?.[6], 0.5);
      assert.equal(rows[1]?.[12], 100);
    } else {
      assert.equal(rows[1]?.[14], 100);
    }
  }
});
