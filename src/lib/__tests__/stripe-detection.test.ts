import test from 'node:test';
import assert from 'node:assert/strict';
import type { Transaction } from '@/lib/data';
import {
  canSplitStripeRemittance,
  hasStripeKeyword,
  isStripeLikeTransaction,
} from '../transactions/stripe-detection';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    date: '2026-03-12',
    description: 'Moviment bancari',
    amount: 100,
    category: null,
    document: null,
    ...overrides,
  };
}

test('detecta Stripe pel concepte encara que source sigui bank', () => {
  const tx = makeTransaction({
    source: 'bank',
    description: 'Transf de Stripe stripe',
  });

  assert.equal(hasStripeKeyword(tx.description), true);
  assert.equal(isStripeLikeTransaction(tx), true);
  assert.equal(canSplitStripeRemittance(tx), true);
});

test('detecta Stripe amb variants reals de descripcio bancaria', () => {
  const transferTx = makeTransaction({
    source: 'bank',
    description: 'Transferencia de Stripe payout setmanal',
  });
  const paymentsTx = makeTransaction({
    source: 'bank',
    description: 'STRIPE PAYMENTS 2026-03-15',
  });

  assert.equal(hasStripeKeyword(transferTx.description), true);
  assert.equal(isStripeLikeTransaction(transferTx), true);
  assert.equal(hasStripeKeyword(paymentsTx.description), true);
  assert.equal(canSplitStripeRemittance(paymentsTx), true);
});

test('no tracta com Stripe un ingrés bancari sense keyword', () => {
  const tx = makeTransaction({
    source: 'bank',
    description: 'Transferència rebuda de client',
  });

  assert.equal(isStripeLikeTransaction(tx), false);
  assert.equal(canSplitStripeRemittance(tx), false);
});

test('un pare ja processat amb stripeTransferId manté identitat Stripe però no es pot tornar a dividir', () => {
  const tx = makeTransaction({
    source: 'bank',
    description: 'Abonament Stripe',
    stripeTransferId: 'tr_123',
  });

  assert.equal(isStripeLikeTransaction(tx), true);
  assert.equal(canSplitStripeRemittance(tx), false);
});
