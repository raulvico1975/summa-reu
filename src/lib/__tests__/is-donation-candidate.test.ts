import test from 'node:test';
import assert from 'node:assert/strict';

import type { Transaction } from '@/lib/data';
import { isDonationCandidate } from '@/lib/transactions/is-donation-candidate';

function buildTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    date: '2026-04-14',
    description: 'Moviment prova',
    amount: 50,
    category: 'cat-1',
    document: null,
    contactId: 'donor-1',
    contactType: 'donor',
    transactionType: 'normal',
    ...overrides,
  };
}

test('isDonationCandidate returns true for a positive classified donor income not yet marked as donation', () => {
  assert.equal(isDonationCandidate(buildTransaction()), true);
});

test('isDonationCandidate returns false when there is no donor assigned', () => {
  assert.equal(isDonationCandidate(buildTransaction({ contactId: null })), false);
});

test('isDonationCandidate returns false for non-donor contact types', () => {
  assert.equal(isDonationCandidate(buildTransaction({ contactType: 'supplier' })), false);
});

test('isDonationCandidate returns false for negative amounts', () => {
  assert.equal(isDonationCandidate(buildTransaction({ amount: -50 })), false);
});

test('isDonationCandidate returns false when the movement is still uncategorized', () => {
  assert.equal(isDonationCandidate(buildTransaction({ category: null })), false);
});

test('isDonationCandidate returns false when already marked as donation', () => {
  assert.equal(isDonationCandidate(buildTransaction({ transactionType: 'donation' })), false);
});
