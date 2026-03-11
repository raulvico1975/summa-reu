import { describe, it } from 'node:test';
import assert from 'node:assert';
import { classifyTransactions } from '../transaction-dedupe';
import type { Transaction } from '../data';

function makeExisting(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-existing',
    date: '2026-02-10T00:00:00.000Z',
    description: 'Quota soci',
    amount: 25,
    category: null,
    document: null,
    bankAccountId: 'acc-1',
    source: 'bank',
    ...overrides,
  };
}

function makeIncoming(overrides: Partial<Omit<Transaction, 'id'>> = {}): { tx: Omit<Transaction, 'id'>; rawRow: Record<string, unknown> } {
  return {
    tx: {
      date: '2026-02-10T00:00:00.000Z',
      description: 'Quota soci',
      amount: 25,
      category: null,
      document: null,
      bankAccountId: 'acc-1',
      source: 'bank',
      ...overrides,
    },
    rawRow: {},
  };
}

describe('transaction dedupe with balanceAfter strong rule', () => {
  it('saldo+amount+data igual classifica com DUPLICATE_SAFE', () => {
    const existing = [makeExisting({ id: 'tx-1', balanceAfter: 1000, operationDate: '2026-02-10' })];
    const parsed = [makeIncoming({ balanceAfter: 1000, operationDate: '2026-02-10' })];

    const result = classifyTransactions(parsed, existing, 'acc-1');

    assert.equal(result.length, 1);
    assert.equal(result[0].status, 'DUPLICATE_SAFE');
    assert.equal(result[0].reason, 'BALANCE_AMOUNT_DATE');
    assert.equal(result[0].tx.duplicateReason, 'balance+amount+date');
  });

  it('si l existent és legacy (sense operationDate o balanceAfter), no pot ser duplicate segur per saldo', () => {
    const existing = [makeExisting({ id: 'tx-legacy', balanceAfter: undefined, operationDate: undefined })];
    const parsed = [makeIncoming({ balanceAfter: 1000, operationDate: '2026-02-10' })];

    const result = classifyTransactions(parsed, existing, 'acc-1');

    assert.equal(result.length, 1);
    assert.equal(result[0].status, 'DUPLICATE_CANDIDATE');
    assert.notEqual(result[0].reason, 'BALANCE_AMOUNT_DATE');
  });

  it('si incoming no té saldo, no aplica la regla forta de saldo', () => {
    const existing = [makeExisting({ id: 'tx-1', balanceAfter: 1000, operationDate: '2026-02-10' })];
    const parsed = [makeIncoming()];

    const result = classifyTransactions(parsed, existing, 'acc-1');

    assert.equal(result.length, 1);
    assert.notEqual(result[0].reason, 'BALANCE_AMOUNT_DATE');
    assert.equal(result[0].status, 'DUPLICATE_CANDIDATE');
  });

  it('mateix saldo però amount diferent no és duplicate fort', () => {
    const existing = [makeExisting({ id: 'tx-1', balanceAfter: 1000, amount: 25, operationDate: '2026-02-10' })];
    const parsed = [makeIncoming({ balanceAfter: 1000, amount: 30, operationDate: '2026-02-10' })];

    const result = classifyTransactions(parsed, existing, 'acc-1');

    assert.equal(result.length, 1);
    assert.notEqual(result[0].reason, 'BALANCE_AMOUNT_DATE');
    assert.equal(result[0].status, 'NEW');
  });

  it('mateix saldo+amount però data operació diferent no és duplicate fort', () => {
    const existing = [makeExisting({ id: 'tx-1', balanceAfter: 1000, operationDate: '2026-02-10' })];
    const parsed = [makeIncoming({ balanceAfter: 1000, operationDate: '2026-02-11' })];

    const result = classifyTransactions(parsed, existing, 'acc-1');

    assert.equal(result.length, 1);
    assert.notEqual(result[0].reason, 'BALANCE_AMOUNT_DATE');
    assert.notEqual(result[0].status, 'DUPLICATE_SAFE');
  });

  it('si falta operationDate en el moviment nou, no és duplicate fort', () => {
    const existing = [makeExisting({ id: 'tx-1', balanceAfter: 1000, operationDate: undefined })];
    const parsed = [makeIncoming({ balanceAfter: 1000, operationDate: undefined })];

    const result = classifyTransactions(parsed, existing, 'acc-1');

    assert.equal(result.length, 1);
    assert.equal(result[0].status, 'DUPLICATE_CANDIDATE');
    assert.notEqual(result[0].reason, 'BALANCE_AMOUNT_DATE');
  });

  it('legacy proxy-date hit classifica com DUPLICATE_CANDIDATE', () => {
    const existing = [makeExisting({
      id: 'tx-legacy',
      date: '2026-02-10T00:00:00.000Z',
      balanceAfter: 1000,
      operationDate: undefined,
      amount: 25,
    })];
    const parsed = [makeIncoming({
      date: '2026-02-11T00:00:00.000Z',
      balanceAfter: 1000,
      operationDate: '2026-02-10',
      amount: 25,
    })];

    const result = classifyTransactions(parsed, existing, 'acc-1');

    assert.equal(result.length, 1);
    assert.equal(result[0].status, 'DUPLICATE_CANDIDATE');
    assert.equal(result[0].reason, 'HEURISTIC_LEGACY_BALANCE_PROXY');
    assert.equal(result[0].tx.duplicateReason, 'balance+amount+proxyDate');
    assert.deepEqual(result[0].matchedExistingIds, ['tx-legacy']);
  });

  it('legacy proxy-date miss per data entra com a candidat near-date', () => {
    const existing = [makeExisting({
      id: 'tx-legacy',
      date: '2026-02-10T00:00:00.000Z',
      balanceAfter: 1000,
      operationDate: undefined,
      amount: 25,
    })];
    const parsed = [makeIncoming({
      date: '2026-02-11T00:00:00.000Z',
      balanceAfter: 1000,
      operationDate: '2026-02-09',
      amount: 25,
    })];

    const result = classifyTransactions(parsed, existing, 'acc-1');

    assert.equal(result.length, 1);
    assert.equal(result[0].status, 'DUPLICATE_CANDIDATE');
    assert.equal(result[0].reason, 'HEURISTIC_NEAR_DATE');
    assert.notEqual(result[0].tx.duplicateReason, 'balance+amount+proxyDate');
    assert.ok(result[0].tx.duplicateReason?.includes('nearDate'));
  });

  it('legacy proxy-date miss per amount no fa match', () => {
    const existing = [makeExisting({
      id: 'tx-legacy',
      date: '2026-02-10T00:00:00.000Z',
      balanceAfter: 1000,
      operationDate: undefined,
      amount: 25,
    })];
    const parsed = [makeIncoming({
      date: '2026-02-11T00:00:00.000Z',
      balanceAfter: 1000,
      operationDate: '2026-02-10',
      amount: 30,
    })];

    const result = classifyTransactions(parsed, existing, 'acc-1');

    assert.equal(result.length, 1);
    assert.equal(result[0].status, 'NEW');
    assert.notEqual(result[0].tx.duplicateReason, 'balance+amount+proxyDate');
  });

  it('existing modern amb operationDate no entra al legacy map', () => {
    const existing = [makeExisting({
      id: 'tx-modern',
      date: '2026-02-10T00:00:00.000Z',
      balanceAfter: 1000,
      operationDate: '2026-02-10',
      amount: 25,
    })];
    const parsed = [makeIncoming({
      date: '2026-02-11T00:00:00.000Z',
      balanceAfter: 1000,
      operationDate: '2026-02-10',
      amount: 25,
    })];

    const result = classifyTransactions(parsed, existing, 'acc-1');

    assert.equal(result.length, 1);
    assert.equal(result[0].status, 'DUPLICATE_SAFE');
    assert.equal(result[0].reason, 'BALANCE_AMOUNT_DATE');
    assert.notEqual(result[0].tx.duplicateReason, 'balance+amount+proxyDate');
  });

  it('match exacte per clau base continua sent només heuristic candidate', () => {
    const existing = [makeExisting({ id: 'tx-base' })];
    const parsed = [makeIncoming()];

    const result = classifyTransactions(parsed, existing, 'acc-1');

    assert.equal(result.length, 1);
    assert.equal(result[0].status, 'DUPLICATE_CANDIDATE');
    assert.equal(result[0].reason, 'HEURISTIC_BASE_KEY');
  });
});
