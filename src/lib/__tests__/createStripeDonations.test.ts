import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createStripeDonations,
  ERR_STRIPE_DUPLICATE_PAYMENT,
} from '@/lib/stripe/createStripeDonations';

test('bloqueja tota la imputacio si el payout conte un stripePaymentId ja actiu', async () => {
  await assert.rejects(
    () =>
      createStripeDonations({
        parentTransactionId: 'parent-tx-1',
        payments: [
          {
            stripePaymentId: 'ch_existing',
            amount: 80,
            fee: 2.5,
            contactId: 'contact-1',
            date: '2026-04-16',
            customerEmail: 'existing@example.org',
            description: 'Pagament existent',
            imputationOrigin: 'csv',
          },
          {
            stripePaymentId: 'ch_new',
            amount: 20,
            fee: 0.7,
            contactId: 'contact-2',
            date: '2026-04-16',
            customerEmail: 'new@example.org',
            description: 'Pagament nou',
            imputationOrigin: 'csv',
          },
        ],
        bankAmount: 96.8,
        adjustmentDate: '2026-04-16',
        findDonationByStripePaymentId: async (stripePaymentId) =>
          stripePaymentId === 'ch_existing'
            ? {
                id: 'don-1',
                date: '2026-04-15',
                type: 'donation',
                source: 'stripe',
                contactId: 'contact-1',
                amountGross: 80,
                feeAmount: 2.5,
                parentTransactionId: 'another-parent',
                stripePaymentId: 'ch_existing',
                archivedAt: null,
              }
            : null,
      }),
    (error: unknown) =>
      error instanceof Error && error.message === ERR_STRIPE_DUPLICATE_PAYMENT
  );
});

test('permet adjustment nomes quan totes les linies son noves i la diferencia es real', async () => {
  const result = await createStripeDonations({
    parentTransactionId: 'parent-tx-2',
    payments: [
      {
        stripePaymentId: 'ch_1',
        amount: 60,
        fee: 1.8,
        contactId: 'contact-1',
        date: '2026-04-16',
        customerEmail: 'donor1@example.org',
        description: 'Pagament 1',
        imputationOrigin: 'csv',
      },
      {
        stripePaymentId: 'ch_2',
        amount: 40,
        fee: 1.2,
        contactId: 'contact-2',
        date: '2026-04-16',
        customerEmail: 'donor2@example.org',
        description: 'Pagament 2',
        imputationOrigin: 'csv',
      },
    ],
    bankAmount: 96.5,
    adjustmentDate: '2026-04-16',
    findDonationByStripePaymentId: async () => null,
  });

  assert.equal(result.donations.length, 2);
  assert.equal(result.adjustment?.type, 'stripe_adjustment');
  assert.equal(result.adjustment?.amount, -0.5);
});
