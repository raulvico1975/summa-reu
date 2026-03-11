import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { Transaction } from '../data';
import { canDeleteTransaction, getDeleteTransactionBlockedReason } from '../transactions/can-delete-transaction';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    date: '2026-02-28',
    description: 'Moviment test',
    amount: 10,
    category: null,
    document: null,
    ...overrides,
  };
}

describe('canDeleteTransaction', () => {
  it('retorna false per pare de remesa/desglossament', () => {
    const tx = makeTx({ isRemittance: true });
    assert.equal(canDeleteTransaction(tx), false);
    assert.equal(getDeleteTransactionBlockedReason(tx), 'parentRemittance');
  });

  it('retorna false per pare bancari de Stripe ja processat', () => {
    const tx = makeTx({ stripeTransferId: 'tr_123' });
    assert.equal(canDeleteTransaction(tx), false);
    assert.equal(getDeleteTransactionBlockedReason(tx), 'parentRemittance');
  });

  it('retorna false per filla de remesa/desglossament', () => {
    const tx = makeTx({ isRemittanceItem: true, parentTransactionId: 'parent-1' });
    assert.equal(canDeleteTransaction(tx), false);
    assert.equal(getDeleteTransactionBlockedReason(tx), 'childRemittance');
  });

  it('retorna true per moviment normal', () => {
    const tx = makeTx();
    assert.equal(canDeleteTransaction(tx), true);
    assert.equal(getDeleteTransactionBlockedReason(tx), null);
  });
});
