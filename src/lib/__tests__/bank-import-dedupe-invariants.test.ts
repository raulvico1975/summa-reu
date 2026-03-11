import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { Transaction } from '../data';
import { classifyTransactions, type ClassifiedRow } from '../transaction-dedupe';
import { buildImportSelection, computeDedupeSearchRange } from '../bank-import/dedupe-invariants';

function makeBaseTx(overrides: Partial<Omit<Transaction, 'id'>> = {}): Omit<Transaction, 'id'> {
  return {
    date: '2025-12-30T00:00:00.000Z',
    description: 'Transferencia fina manent segimon',
    amount: 500,
    category: null,
    document: null,
    bankAccountId: 'acc-1',
    source: 'bank',
    ...overrides,
  };
}

function makeClassifiedRow(
  status: ClassifiedRow['status'],
  txOverrides: Partial<Omit<Transaction, 'id'>> = {}
): ClassifiedRow {
  const tx = makeBaseTx(txOverrides);
  return {
    tx,
    status,
    reason: status === 'DUPLICATE_SAFE' ? 'INTRA_FILE' : status === 'DUPLICATE_CANDIDATE' ? 'HEURISTIC_BASE_KEY' : null,
    matchedExistingIds: [],
    matchedExisting: [],
    rawRow: {},
    userDecision: null,
  };
}

describe('bank import dedupe invariants', () => {
  it('T1: mismatch date vs operationDate no pot classificar com NEW i rang cobreix ambdues dates', () => {
    const existing: Transaction[] = [{
      id: 'tx-existing',
      date: '2025-12-30T00:00:00.000Z',
      description: 'Transferencia fina manent segimon',
      amount: 500,
      category: null,
      document: null,
      bankAccountId: 'acc-1',
      source: 'bank',
    }];

    const incomingTx = makeBaseTx({
      date: '2025-12-30T00:00:00.000Z',
      operationDate: '2026-01-02',
    });

    const range = computeDedupeSearchRange([{
      date: incomingTx.date,
      operationDate: incomingTx.operationDate,
    }]);

    assert.ok(range);
    assert.equal(range?.from, '2025-12-30');
    assert.equal(range?.to, '2026-01-02');

    const classified = classifyTransactions(
      [{ tx: incomingTx, rawRow: { operationDate: '2026-01-02' } }],
      existing,
      'acc-1',
      ['operationDate']
    );

    assert.equal(classified.length, 1);
    assert.notEqual(classified[0].status, 'NEW');
  });

  it('T2: candidats no entren sense opt-in', () => {
    const classified: ClassifiedRow[] = [
      makeClassifiedRow('DUPLICATE_CANDIDATE', { description: 'Cand-1' }),
    ];

    const selection = buildImportSelection(classified, []);

    assert.equal(selection.transactionsToImport.length, 0);
    assert.equal(selection.stats.candidateCount, 1);
    assert.equal(selection.stats.candidateUserImportedCount, 0);
    assert.equal(selection.stats.candidateUserSkippedCount, 1);
  });

  it('T3: opt-in importa només els candidats marcats', () => {
    const classified: ClassifiedRow[] = [
      makeClassifiedRow('NEW', { description: 'Nou-1' }),
      makeClassifiedRow('DUPLICATE_CANDIDATE', { description: 'Cand-1' }),
      makeClassifiedRow('DUPLICATE_CANDIDATE', { description: 'Cand-2' }),
      makeClassifiedRow('DUPLICATE_CANDIDATE', { description: 'Cand-3' }),
    ];

    const selection = buildImportSelection(classified, [1]);

    assert.equal(selection.transactionsToImport.length, 2);
    assert.equal(selection.transactionsToImport[0].description, 'Nou-1');
    assert.equal(selection.transactionsToImport[1].description, 'Cand-2');
    assert.equal(selection.stats.candidateCount, 3);
    assert.equal(selection.stats.candidateUserImportedCount, 1);
    assert.equal(selection.stats.candidateUserSkippedCount, 2);
  });

  it('T4: el rang de dedupe es pot ampliar amb tolerància de dies', () => {
    const range = computeDedupeSearchRange(
      [{
        date: '2026-02-10T00:00:00.000Z',
        operationDate: '2026-02-10',
      }],
      { toleranceDays: 3 }
    );

    assert.ok(range);
    assert.equal(range?.from, '2026-02-07');
    assert.equal(range?.to, '2026-02-13');
  });
});
