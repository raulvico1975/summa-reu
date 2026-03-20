import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Transaction } from '../data';
import { getUndoChildMutation } from '../fiscal/undoProcessing';
import {
  buildManualReturnSplitPlan,
  getSplitValidationError,
  validateSplit,
} from '../returns/createReturnSplit';

function makeParentTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'parent-return-1',
    date: '2026-03-20',
    description: 'DEVOLUCIO QUOTA SOCI',
    amount: -60,
    category: null,
    document: null,
    bankAccountId: 'bank-1',
    ...overrides,
  };
}

describe('returns manual split', () => {
  it('accepts a single donor split', () => {
    const plan = buildManualReturnSplitPlan({
      parentTransaction: makeParentTx(),
      rows: [{ contactId: 'donor-1', amount: 60 }],
      donorNamesById: new Map([['donor-1', 'Donant 1']]),
    });

    assert.equal(validateSplit(60, [{ contactId: 'donor-1', amount: 60 }]), true);
    assert.equal(plan.children.length, 1);
    assert.equal(plan.children[0].contactId, 'donor-1');
    assert.equal(plan.children[0].amount, -60);
    assert.equal(plan.parentUpdate.remittanceResolvedCount, 1);
  });

  it('accepts multiple donors when the sum matches exactly', () => {
    const rows = [
      { contactId: 'donor-1', amount: 10 },
      { contactId: 'donor-2', amount: 20 },
      { contactId: 'donor-3', amount: 30 },
    ];

    const plan = buildManualReturnSplitPlan({
      parentTransaction: makeParentTx(),
      rows,
      donorNamesById: new Map([
        ['donor-1', 'Donant 1'],
        ['donor-2', 'Donant 2'],
        ['donor-3', 'Donant 3'],
      ]),
    });

    assert.equal(validateSplit(60, rows), true);
    assert.equal(plan.children.length, 3);
    assert.deepEqual(plan.children.map((child) => child.amount), [-10, -20, -30]);
    assert.equal(plan.parentUpdate.remittanceItemCount, 3);
  });

  it('fails validation when the sum is incorrect', () => {
    const rows = [
      { contactId: 'donor-1', amount: 10 },
      { contactId: 'donor-2', amount: 25 },
    ];

    assert.equal(validateSplit(60, rows), false);
    assert.equal(getSplitValidationError(60, rows), 'TOTAL_MISMATCH');
    assert.throws(
      () => buildManualReturnSplitPlan({
        parentTransaction: makeParentTx(),
        rows,
      }),
      /TOTAL_MISMATCH/
    );
  });

  it('simulates undo by deleting all generated children', () => {
    const plan = buildManualReturnSplitPlan({
      parentTransaction: makeParentTx(),
      rows: [
        { contactId: 'donor-1', amount: 15 },
        { contactId: 'donor-2', amount: 45 },
      ],
    });

    const remainingChildren = plan.children.filter((child) => (
      getUndoChildMutation('returns', child as unknown as Transaction) !== 'delete'
    ));

    assert.equal(remainingChildren.length, 0);
  });
});
