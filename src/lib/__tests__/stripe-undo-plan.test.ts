import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Transaction } from '@/lib/data';
import type { Donation } from '@/lib/types/donations';
import {
  buildStripeUndoPlan,
  type StripeUndoChildRecord,
  type StripeUndoDonationRecord,
} from '../fiscal/stripe-undo-plan';

function makeParent(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'parent-1',
    date: '2026-03-24',
    description: 'Payout Stripe',
    amount: 100,
    category: null,
    document: null,
    ...overrides,
  };
}

function makeChild(
  id: string,
  overrides: Partial<Transaction> = {}
): StripeUndoChildRecord {
  return {
    id,
    data: {
      id,
      date: '2026-03-24',
      description: `Child ${id}`,
      amount: 25,
      category: null,
      document: null,
      archivedAt: null,
      ...overrides,
    },
  };
}

function makeDonation(
  id: string,
  overrides: Partial<Donation> = {}
): StripeUndoDonationRecord {
  return {
    id,
    data: {
      id,
      date: '2026-03-24',
      type: 'donation',
      source: 'stripe',
      contactId: 'donor-1',
      amountGross: 25,
      parentTransactionId: 'parent-1',
      archivedAt: null,
      ...overrides,
    },
  };
}

describe('buildStripeUndoPlan', () => {
  it('marca com idempotent un pare sense marques ni filles actives', () => {
    const plan = buildStripeUndoPlan({
      parent: makeParent(),
      children: [],
      donations: [],
    });

    assert.equal(plan.isIdempotent, true);
    assert.equal(plan.shouldResetParent, false);
    assert.deepEqual(plan.archiveChildIds, []);
    assert.deepEqual(plan.deleteChildIds, []);
    assert.deepEqual(plan.archiveDonationIds, []);
  });

  it('arxiva donacions i filles fiscals, i elimina filles no fiscals', () => {
    const plan = buildStripeUndoPlan({
      parent: makeParent({ stripeTransferId: 'po_123', remittanceId: 'remit-1', isRemittance: true }),
      children: [
        makeChild('child-fiscal', {
          source: 'stripe',
          transactionType: 'donation',
          contactId: 'donor-1',
        }),
        makeChild('child-non-fiscal', {
          source: 'stripe',
          transactionType: 'fee',
          contactId: null,
          amount: -1.45,
        }),
      ],
      donations: [
        makeDonation('donation-1'),
        makeDonation('donation-archived', {
          archivedAt: '2026-03-24T10:00:00.000Z',
        }),
      ],
    });

    assert.equal(plan.isIdempotent, false);
    assert.equal(plan.shouldResetParent, true);
    assert.equal(plan.shouldDeleteRemittance, true);
    assert.deepEqual(plan.archiveChildIds, ['child-fiscal']);
    assert.deepEqual(plan.deleteChildIds, ['child-non-fiscal']);
    assert.deepEqual(plan.archiveDonationIds, ['donation-1']);
  });

  it('neteja marques del pare encara que ja no quedin filles actives', () => {
    const plan = buildStripeUndoPlan({
      parent: makeParent({ stripeTransferId: 'po_456' }),
      children: [
        makeChild('child-archived', {
          source: 'stripe',
          transactionType: 'donation',
          contactId: 'donor-1',
          archivedAt: '2026-03-24T10:00:00.000Z',
        }),
      ],
      donations: [
        makeDonation('donation-archived', {
          archivedAt: '2026-03-24T10:00:00.000Z',
        }),
      ],
    });

    assert.equal(plan.isIdempotent, false);
    assert.equal(plan.shouldResetParent, true);
    assert.deepEqual(plan.archiveChildIds, []);
    assert.deepEqual(plan.deleteChildIds, []);
    assert.deepEqual(plan.archiveDonationIds, []);
  });
});
