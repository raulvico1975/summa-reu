import test from 'node:test';
import assert from 'node:assert/strict';

import type { Donation } from '@/lib/types/donations';
import {
  formatStripeImputationStatus,
  getStripeParentAlreadyImputedMessage,
  summarizeActiveStripeImputation,
  summarizeActiveStripeImputationsByParent,
} from '@/lib/stripe/activeStripeImputation';

function makeDonation(overrides: Partial<Donation> = {}): Donation {
  return {
    id: 'don_1',
    date: '2026-03-12',
    type: 'donation',
    source: 'stripe',
    contactId: 'donor-1',
    amountGross: 10,
    parentTransactionId: 'parent-1',
    stripePaymentId: 'pay_1',
    ...overrides,
  };
}

test('moviment pare sense donations Stripe actives no te resum d imputacio', () => {
  const summary = summarizeActiveStripeImputation({
    parentTransactionId: 'parent-1',
    donations: [makeDonation({ archivedAt: '2026-03-13T10:00:00.000Z' })],
    donorNameById: { 'donor-1': 'Lourdes Herrera' },
  });

  assert.equal(summary, null);
});

test('moviment pare imputat retorna count i resum curt de donants', () => {
  const summary = summarizeActiveStripeImputation({
    parentTransactionId: 'parent-1',
    donations: [
      makeDonation({ id: 'don_1', contactId: 'donor-1', amountGross: 10 }),
      makeDonation({ id: 'don_2', contactId: 'donor-2', amountGross: 12, stripePaymentId: 'pay_2' }),
      makeDonation({ id: 'don_3', contactId: 'donor-3', amountGross: 8, stripePaymentId: 'pay_3' }),
      makeDonation({
        id: 'adj_1',
        type: 'stripe_adjustment',
        contactId: null,
        amountGross: 0.55,
        stripePaymentId: null,
      }),
    ],
    donorNameById: {
      'donor-1': 'Lourdes Herrera',
      'donor-2': 'Pere Martí',
      'donor-3': 'Anna Serra',
    },
  });

  assert.ok(summary);
  assert.equal(summary?.donationCount, 3);
  assert.equal(summary?.adjustmentCount, 1);
  assert.equal(summary?.donorPreview, 'Lourdes H., Pere M. +1');
  assert.equal(
    summary ? formatStripeImputationStatus(summary) : '',
    'Stripe imputat · 3 donacions · Lourdes H., Pere M. +1'
  );
});

test('la reimputacio bloquejada indica que es pot desfer des del detall Stripe', () => {
  assert.equal(
    getStripeParentAlreadyImputedMessage().includes('Desfer imputació Stripe'),
    true
  );
});

test('agrupa imputacions actives per parentTransactionId', () => {
  const grouped = summarizeActiveStripeImputationsByParent({
    donations: [
      makeDonation({ id: 'don_parent_1', parentTransactionId: 'parent-1' }),
      makeDonation({ id: 'don_parent_2', parentTransactionId: 'parent-2', stripePaymentId: 'pay_2' }),
    ],
    donorNameById: { 'donor-1': 'Lourdes Herrera' },
  });

  assert.deepEqual(Object.keys(grouped).sort(), ['parent-1', 'parent-2']);
});
