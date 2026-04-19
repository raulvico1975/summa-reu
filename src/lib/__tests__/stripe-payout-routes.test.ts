import assert from 'node:assert/strict';
import test from 'node:test';

import { NextRequest, NextResponse } from 'next/server';

import { handleStripePayoutGet } from '@/app/api/stripe/payout/[payoutId]/handler';
import { handleStripePayoutsGet } from '@/app/api/stripe/payouts/handler';
import { UnsupportedStripeCurrencyError } from '@/lib/stripe/payout-sync';

function makeRequest(url: string) {
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      Authorization: 'Bearer fake-token',
    },
  });
}

function makeBaseDeps() {
  return {
    verifyIdToken: async () => ({ uid: 'user-1', email: 'user@test.com' }),
    getAdminDb: () => ({}) as any,
    validateUserMembership: async () => ({ valid: true, role: 'admin', userOverrides: null, userGrants: null }) as any,
    requirePermission: () => null as NextResponse | null,
    getStripeSecretKeyFromEnv: () => 'sk_test_123',
  };
}

test('GET /api/stripe/payouts retorna 200 amb payouts quan la moneda es suportada', async () => {
  const response = await handleStripePayoutsGet(
    makeRequest('http://localhost/api/stripe/payouts?orgId=org-1'),
    {
      ...makeBaseDeps(),
      listRecentPaidStripePayouts: async () => [
        {
          id: 'po_1',
          date: 1713360000,
          amount: 97,
          currency: 'eur',
          arrivalDate: 1713360000,
          created: 1713273600,
          status: 'paid' as const,
          preview: {
            paymentCount: 1,
            firstDisplayName: 'Anna Serra',
            secondDisplayName: null,
          },
        },
      ],
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [
    {
      id: 'po_1',
      date: 1713360000,
      amount: 97,
      currency: 'eur',
      arrivalDate: 1713360000,
      created: 1713273600,
      status: 'paid',
      preview: {
        paymentCount: 1,
        firstDisplayName: 'Anna Serra',
        secondDisplayName: null,
      },
    },
  ]);
});

test('GET /api/stripe/payouts retorna 422 i missatge estable per moneda de 3 decimals', async () => {
  const response = await handleStripePayoutsGet(
    makeRequest('http://localhost/api/stripe/payouts?orgId=org-1'),
    {
      ...makeBaseDeps(),
      listRecentPaidStripePayouts: async () => {
        throw new UnsupportedStripeCurrencyError('kwd');
      },
    }
  );

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    success: false,
    code: 'STRIPE_UNSUPPORTED_CURRENCY',
    error: 'Aquest flux de payout Stripe no admet la moneda KWD.',
  });
});

test('GET /api/stripe/payout/[payoutId] retorna 200 amb pagaments quan la moneda es suportada', async () => {
  const response = await handleStripePayoutGet(
    makeRequest('http://localhost/api/stripe/payout/po_1?orgId=org-1'),
    { params: Promise.resolve({ payoutId: 'po_1' }) },
    {
      ...makeBaseDeps(),
      fetchStripePayout: async () => ({
        id: 'po_1',
        amount: 97,
        currency: 'eur',
        arrivalDate: 1713360000,
        created: 1713273600,
        status: 'paid',
      }),
      assertStripePayoutPaid: () => undefined,
      fetchStripePayoutPayments: async () => [
        {
          stripePaymentId: 'ch_1',
          amountGross: 100,
          fee: 3,
          net: 97,
          currency: 'eur',
          customerEmail: 'donor@example.org',
          description: 'Donacio web',
          created: 1713273600,
        },
      ],
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [
    {
      stripePaymentId: 'ch_1',
      amountGross: 100,
      fee: 3,
      net: 97,
      currency: 'eur',
      customerEmail: 'donor@example.org',
      description: 'Donacio web',
      created: 1713273600,
    },
  ]);
});

test('GET /api/stripe/payout/[payoutId] retorna 422 i missatge estable per moneda de 3 decimals', async () => {
  const response = await handleStripePayoutGet(
    makeRequest('http://localhost/api/stripe/payout/po_1?orgId=org-1'),
    { params: Promise.resolve({ payoutId: 'po_1' }) },
    {
      ...makeBaseDeps(),
      fetchStripePayout: async () => {
        throw new UnsupportedStripeCurrencyError('kwd');
      },
      assertStripePayoutPaid: () => undefined,
      fetchStripePayoutPayments: async () => [],
    }
  );

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    success: false,
    code: 'STRIPE_UNSUPPORTED_CURRENCY',
    error: 'Aquest flux de payout Stripe no admet la moneda KWD.',
  });
});
