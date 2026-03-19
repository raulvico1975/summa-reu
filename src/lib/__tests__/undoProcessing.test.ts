import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  detectUndoOperationType,
  getUndoChildMutation,
  getUndoConfirmationText,
  getUndoDialogDescription,
  getUndoDialogTitle,
  planUndoChunkSizes,
  resolveUndoChildCount,
} from '../fiscal/undoProcessing';
import type { Transaction } from '../data';

function makeParentTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'parent-1',
    date: '2026-02-01',
    description: 'Parent tx',
    amount: 100,
    category: null,
    document: null,
    ...overrides,
  };
}

describe('detectUndoOperationType', () => {
  it('detects stripe by stripeTransferId', () => {
    const tx = makeParentTx({ stripeTransferId: 'tr_1', isRemittance: false });
    assert.equal(detectUndoOperationType(tx), 'stripe');
  });

  it('detects remittance_in for positive remittance without explicit subtype', () => {
    const tx = makeParentTx({ isRemittance: true, amount: 150, remittanceType: undefined });
    assert.equal(detectUndoOperationType(tx), 'remittance_in');
  });

  it('detects returns and payments from remittanceType', () => {
    assert.equal(
      detectUndoOperationType(makeParentTx({ isRemittance: true, remittanceType: 'returns' })),
      'returns',
    );
    assert.equal(
      detectUndoOperationType(makeParentTx({ isRemittance: true, remittanceType: 'payments', amount: -30 })),
      'payments',
    );
  });

  it('returns null when transaction is not remittance and not stripe', () => {
    assert.equal(detectUndoOperationType(makeParentTx({ isRemittance: false })), null);
  });
});

describe('resolveUndoChildCount', () => {
  it('prefers parentTransactionId count when > 0', () => {
    assert.equal(resolveUndoChildCount(3, ['a', 'b'], 'parent-1', 'remit-1'), 3);
  });

  it('falls back to remittance docs and excludes parent id', () => {
    assert.equal(
      resolveUndoChildCount(0, ['parent-1', 'c1', 'c2'], 'parent-1', 'remit-1'),
      2,
    );
  });

  it('returns 0 without remittance fallback', () => {
    assert.equal(resolveUndoChildCount(0, ['c1', 'c2'], 'parent-1', null), 0);
  });
});

describe('planUndoChunkSizes', () => {
  it('keeps all chunks within batch limit and reserves extra ops in last batch', () => {
    const chunks = planUndoChunkSizes(120, 50, 2);
    assert.deepEqual(chunks, [50, 50, 20]);
    assert.equal(chunks[chunks.length - 1] <= 48, true);
    assert.equal(chunks.every((n) => n <= 50), true);
  });

  it('returns empty array when there are no children', () => {
    assert.deepEqual(planUndoChunkSizes(0, 50, 1), []);
  });
});

describe('undo UI texts', () => {
  it('returns non-empty confirmation/title/description for every type', () => {
    const types = ['remittance_in', 'returns', 'payments', 'stripe'] as const;

    for (const type of types) {
      const confirmation = getUndoConfirmationText(type);
      const title = getUndoDialogTitle(type);
      const description = getUndoDialogDescription(type, 2);

      assert.equal(confirmation.length > 0, true);
      assert.equal(title.length > 0, true);
      assert.equal(description.length > 0, true);
    }
  });

  it('changes description depending on operation type', () => {
    const returnsText = getUndoDialogDescription('returns', 1);
    const paymentsText = getUndoDialogDescription('payments', 1);

    assert.notEqual(returnsText, paymentsText);
    assert.equal(returnsText.includes('s\'eliminaran'), true);
    assert.equal(paymentsText.includes('ELIMINARÀ permanentment'), true);
  });
});

describe('getUndoChildMutation', () => {
  it('uses hard-delete for returns OUT', () => {
    assert.equal(
      getUndoChildMutation('returns', makeParentTx({ amount: -25, transactionType: 'return' })),
      'delete',
    );
  });
});
