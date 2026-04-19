import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertStripePayoutHasNoActiveDuplicates,
  ERR_STRIPE_PAYOUT_CONTAINS_ACTIVE_DUPLICATES,
} from '@/lib/stripe/imputation-guard';
import type { StripePayoutPayment } from '@/lib/stripe/payout-sync';

test('bloqueja tot el payout si qualsevol stripePaymentId ja existeix actiu', async () => {
  const payments: StripePayoutPayment[] = [
    {
      stripePaymentId: 'ch_existing',
      amountGross: 80,
      fee: 2.5,
      net: 77.5,
      currency: 'eur',
      customerEmail: 'existing@example.org',
      description: 'Pagament existent',
      created: 1713273600,
    },
    {
      stripePaymentId: 'ch_new',
      amountGross: 20,
      fee: 0.7,
      net: 19.3,
      currency: 'eur',
      customerEmail: 'new@example.org',
      description: 'Pagament nou',
      created: 1713277200,
    },
  ];

  await assert.rejects(
    () =>
      assertStripePayoutHasNoActiveDuplicates(payments, async (stripePaymentId) => stripePaymentId === 'ch_existing'),
    (error: unknown) =>
      error instanceof Error && error.message === ERR_STRIPE_PAYOUT_CONTAINS_ACTIVE_DUPLICATES
  );
});
