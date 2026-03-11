import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { Transaction } from '../data';
import { classifyTransactions } from '../transaction-dedupe';
import { buildImportSelection } from '../bank-import/dedupe-invariants';
import { computeBankImportHash, type CanonicalBankImportTx } from '../bank-import/idempotency';

function makeExisting(id: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    date: '2026-02-15T00:00:00.000Z',
    description: 'Quota soci febrer',
    amount: 25,
    category: null,
    document: null,
    bankAccountId: 'acc-1',
    source: 'bank',
    ...overrides,
  };
}

function makeIncoming(
  overrides: Partial<Omit<Transaction, 'id'>> = {},
  rawRow: Record<string, unknown> = {}
): { tx: Omit<Transaction, 'id'>; rawRow: Record<string, unknown> } {
  return {
    tx: {
      date: '2026-02-15T00:00:00.000Z',
      description: 'Quota soci febrer',
      amount: 25,
      category: null,
      document: null,
      bankAccountId: 'acc-1',
      source: 'bank',
      ...overrides,
    },
    rawRow,
  };
}

function makeImportTx(overrides: Partial<CanonicalBankImportTx> = {}): CanonicalBankImportTx {
  return {
    date: '2026-02-15T00:00:00.000Z',
    description: 'Quota soci febrer',
    amount: 25,
    operationDate: '2026-02-15',
    category: null,
    document: null,
    contactId: 'donor-1',
    contactType: 'donor',
    transactionType: 'normal',
    bankAccountId: 'acc-1',
    source: 'bank',
    ...overrides,
  };
}

describe('transaction dedupe real life scenarios', () => {
  it('solapament parcial: importa només nous quan els candidats no tenen opt-in', () => {
    const existing = [makeExisting('tx-existing')];
    const parsed = [
      makeIncoming(),
      makeIncoming({
        date: '2026-02-16T00:00:00.000Z',
        description: 'Donació puntual',
        amount: 40,
      }),
    ];

    const classified = classifyTransactions(parsed, existing, 'acc-1');
    assert.equal(classified.length, 2);
    assert.equal(classified[0].status, 'DUPLICATE_CANDIDATE');
    assert.equal(classified[1].status, 'NEW');

    const selection = buildImportSelection(classified, []);
    assert.equal(selection.transactionsToImport.length, 1);
    assert.equal(selection.transactionsToImport[0].description, 'Donació puntual');
    assert.equal(selection.stats.candidateCount, 1);
    assert.equal(selection.stats.candidateUserImportedCount, 0);
    assert.equal(selection.stats.candidateUserSkippedCount, 1);
  });

  it('mateix moviment en compte bancari diferent: es considera NEW', () => {
    const existing = [makeExisting('tx-existing', { bankAccountId: 'acc-1' })];
    const parsed = [
      makeIncoming({ bankAccountId: 'acc-2' }),
    ];

    const classified = classifyTransactions(parsed, existing, 'acc-2');
    assert.equal(classified.length, 1);
    assert.equal(classified[0].status, 'NEW');
  });

  it('mateixa descripció+import amb data propera (<=3 dies): és DUPLICATE_CANDIDATE', () => {
    const existing = [makeExisting('tx-existing', { date: '2026-02-15T00:00:00.000Z' })];
    const parsed = [
      makeIncoming({ date: '2026-02-17T00:00:00.000Z' }),
    ];

    const classified = classifyTransactions(parsed, existing, 'acc-1');
    assert.equal(classified.length, 1);
    assert.equal(classified[0].status, 'DUPLICATE_CANDIDATE');
    assert.equal(classified[0].reason, 'HEURISTIC_NEAR_DATE');
    assert.ok(classified[0].tx.duplicateReason?.includes('nearDate'));
  });

  it('mateixa descripció+import amb data llunyana (>3 dies): es considera NEW', () => {
    const existing = [makeExisting('tx-existing', { date: '2026-02-15T00:00:00.000Z' })];
    const parsed = [
      makeIncoming({ date: '2026-02-25T00:00:00.000Z' }),
    ];

    const classified = classifyTransactions(parsed, existing, 'acc-1');
    assert.equal(classified.length, 1);
    assert.equal(classified[0].status, 'NEW');
  });

  it('mateix amount+balanceAfter+operationDate amb data comptable diferent: DUPLICATE_SAFE', () => {
    const existing = [
      makeExisting('tx-existing', {
        date: '2026-02-15T00:00:00.000Z',
        amount: -18.5,
        balanceAfter: 2010.3,
        operationDate: '2026-02-14',
      }),
    ];
    const parsed = [
      makeIncoming({
        date: '2026-02-17T00:00:00.000Z',
        amount: -18.5,
        balanceAfter: 2010.3,
        operationDate: '2026-02-14',
      }),
    ];

    const classified = classifyTransactions(parsed, existing, 'acc-1');
    assert.equal(classified.length, 1);
    assert.equal(classified[0].status, 'DUPLICATE_SAFE');
    assert.equal(classified[0].reason, 'BALANCE_AMOUNT_DATE');
  });

  it('intra-fitxer amb bankRef igual: la segona fila és DUPLICATE_SAFE', () => {
    const existing: Transaction[] = [];
    const parsed = [
      makeIncoming({ bankRef: 'ABC-001' } as Partial<Omit<Transaction, 'id'>>),
      makeIncoming({ bankRef: 'ABC-001' } as Partial<Omit<Transaction, 'id'>>),
    ];

    const classified = classifyTransactions(parsed, existing, 'acc-1');
    assert.equal(classified.length, 2);
    assert.equal(classified[0].status, 'NEW');
    assert.equal(classified[1].status, 'DUPLICATE_SAFE');
    assert.equal(classified[1].reason, 'INTRA_FILE');
  });

  it('idempotència backend: el hash canvia si canvia fileName o source', () => {
    const tx = makeImportTx();

    const base = computeBankImportHash({
      orgId: 'org-1',
      bankAccountId: 'acc-1',
      source: 'xlsx',
      fileName: 'MovimientosCuenta-Febrero2026.xlsx',
      totalRows: 1,
      transactions: [tx],
    });

    const changedFileName = computeBankImportHash({
      orgId: 'org-1',
      bankAccountId: 'acc-1',
      source: 'xlsx',
      fileName: 'MovimientosCuenta-Febrero2026-v2.xlsx',
      totalRows: 1,
      transactions: [tx],
    });

    const changedSource = computeBankImportHash({
      orgId: 'org-1',
      bankAccountId: 'acc-1',
      source: 'csv',
      fileName: 'MovimientosCuenta-Febrero2026.xlsx',
      totalRows: 1,
      transactions: [tx],
    });

    assert.notEqual(base, changedFileName);
    assert.notEqual(base, changedSource);
  });
});
