import test from 'node:test';
import assert from 'node:assert/strict';

import { createStripeDonations, STRIPE_DUPLICATE_PAYMENT_ERROR } from '@/lib/stripe/createStripeDonations';
import { undoStripeImputation } from '@/lib/stripe/undoStripeImputation';
import type { Donation } from '@/lib/types/donations';

test('imputacio simple crea una donacio', async () => {
  const result = await createStripeDonations({
    parentTransactionId: 'tx-parent-1',
    bankAmount: 11.49,
    payments: [
      {
        stripePaymentId: 'pay_1',
        amount: 12,
        fee: 0.51,
        contactId: 'donor-1',
        date: '2026-03-17',
        customerEmail: 'emilio@example.org',
      },
    ],
    findDonationByStripePaymentId: async () => null,
  });

  assert.equal(result.donations.length, 1);
  assert.equal(result.donations[0].amountGross, 12);
  assert.equal(result.donations[0].contactId, 'donor-1');
  assert.equal(result.donations[0].stripePaymentId, 'pay_1');
  assert.equal(result.adjustment, null);
});

test('imputacio multiple crea tres donacions per tres donants', async () => {
  const result = await createStripeDonations({
    parentTransactionId: 'tx-parent-2',
    bankAmount: 46.8,
    payments: [
      { stripePaymentId: 'pay_1', amount: 12, fee: 0.4, contactId: 'emilio', date: '2026-03-17' },
      { stripePaymentId: 'pay_2', amount: 12, fee: 0.4, contactId: 'patricia', date: '2026-03-17' },
      { stripePaymentId: 'pay_3', amount: 24, fee: 0.4, contactId: 'josep', date: '2026-03-17' },
    ],
    findDonationByStripePaymentId: async () => null,
  });

  assert.equal(result.donations.length, 3);
  assert.deepEqual(result.donations.map((donation) => donation.contactId), ['emilio', 'patricia', 'josep']);
});

test('duplicat Stripe queda bloquejat', async () => {
  await assert.rejects(
    () =>
      createStripeDonations({
        parentTransactionId: 'tx-parent-3',
        payments: [
          { stripePaymentId: 'pay_dup', amount: 20, fee: 1, contactId: 'donor-1', date: '2026-03-17' },
        ],
        findDonationByStripePaymentId: async () => ({ id: 'existing', parentTransactionId: 'other-parent', source: 'stripe', date: '2026-03-16' }),
      }),
    (error: unknown) => {
      assert.equal(error instanceof Error, true);
      assert.equal((error as Error).message, STRIPE_DUPLICATE_PAYMENT_ERROR);
      return true;
    }
  );
});

test('undo elimina totes les donacions Stripe del parent', async () => {
  const deletedIds: string[] = [];
  const result = await undoStripeImputation({
    parentTransactionId: 'tx-parent-4',
    store: {
      listByParentTransactionId: async (): Promise<Donation[]> => [
        { id: 'd-1', parentTransactionId: 'tx-parent-4', source: 'stripe', date: '2026-03-17' },
        { id: 'd-2', parentTransactionId: 'tx-parent-4', source: 'stripe', date: '2026-03-17' },
      ],
      deleteById: async (id: string) => {
        deletedIds.push(id);
      },
    },
  });

  assert.equal(result.deletedCount, 2);
  assert.deepEqual(deletedIds, ['d-1', 'd-2']);
});

test('ajust Stripe es crea correctament quan el net no quadra exactament amb el banc', async () => {
  const result = await createStripeDonations({
    parentTransactionId: 'tx-parent-5',
    bankAmount: 48,
    payments: [
      { stripePaymentId: 'pay_1', amount: 12, fee: 0.5, contactId: 'emilio', date: '2026-03-17' },
      { stripePaymentId: 'pay_2', amount: 12, fee: 0.5, contactId: 'patricia', date: '2026-03-17' },
      { stripePaymentId: 'pay_3', amount: 24, fee: 1, contactId: 'josep', date: '2026-03-17' },
    ],
    findDonationByStripePaymentId: async () => null,
  });

  assert.equal(result.adjustment?.type, 'stripe_adjustment');
  assert.equal(result.adjustment?.amount, 2);
  assert.equal(result.adjustment?.parentTransactionId, 'tx-parent-5');
});
