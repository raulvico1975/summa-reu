import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertStripePayoutPaid,
  fetchStripePayout,
  fetchStripePayoutPayments,
  getStripeSecretKeyFromEnv,
  listRecentPaidStripePayouts,
  StripeApiError,
} from '@/lib/stripe/payout-api';
import {
  buildStripePayoutGroupFromPayments,
  stripeMinorAmountToMajor,
} from '@/lib/stripe/payout-sync';

test('listRecentPaidStripePayouts filters non-paid payouts and maps amounts', async () => {
  const seenUrls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    seenUrls.push(String(input));

    return new Response(
      JSON.stringify({
        object: 'list',
        has_more: false,
        data: [
          {
            id: 'po_paid_1',
            amount: 12345,
            currency: 'eur',
            arrival_date: 1713360000,
            created: 1713273600,
            status: 'paid',
          },
          {
            id: 'po_pending_1',
            amount: 5000,
            currency: 'eur',
            arrival_date: 1713446400,
            created: 1713446400,
            status: 'pending',
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  };

  const payouts = await listRecentPaidStripePayouts({
    secretKey: 'sk_test_123',
    fetchImpl,
    timeoutMs: 250,
  });

  assert.equal(payouts.length, 1);
  assert.deepEqual(payouts[0], {
    id: 'po_paid_1',
    amount: 123.45,
    currency: 'eur',
    arrivalDate: 1713360000,
    created: 1713273600,
    status: 'paid',
  });
  assert.equal(seenUrls.length, 1);
  assert.match(seenUrls[0], /\/payouts\?limit=10/);
});

test('fetchStripePayout normalizes payout data and assertStripePayoutPaid blocks unpaid payouts', async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        id: 'po_pending_1',
        amount: 5000,
        currency: 'eur',
        arrival_date: 1713446400,
        created: 1713446400,
        status: 'pending',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

  const payout = await fetchStripePayout({
    secretKey: 'sk_test_123',
    payoutId: 'po_pending_1',
    fetchImpl,
    timeoutMs: 250,
  });

  assert.deepEqual(payout, {
    id: 'po_pending_1',
    amount: 50,
    currency: 'eur',
    arrivalDate: 1713446400,
    created: 1713446400,
    status: 'pending',
  });

  assert.throws(
    () => assertStripePayoutPaid(payout),
    (error: unknown) =>
      error instanceof StripeApiError &&
      error.code === 'STRIPE_PAYOUT_NOT_PAID' &&
      error.status === 409
  );
});

test('fetchStripePayoutPayments paginates, filters non-charge rows and maps amounts', async () => {
  const responses = [
    {
      object: 'list',
      has_more: true,
      data: [
        {
          id: 'txn_1',
          type: 'charge',
          fee: 125,
          net: 9875,
          currency: 'eur',
          source: {
            object: 'charge',
            id: 'ch_1',
            amount: 10000,
            currency: 'eur',
            created: 1713273600,
            description: 'Donació web',
            billing_details: { email: 'anna@example.org' },
          },
        },
        {
          id: 'txn_fee',
          type: 'stripe_fee',
          fee: 0,
          net: -125,
          currency: 'eur',
          source: null,
        },
      ],
    },
    {
      object: 'list',
      has_more: false,
      data: [
        {
          id: 'txn_2',
          type: 'charge',
          fee: 60,
          net: 4940,
          currency: 'eur',
          source: {
            object: 'charge',
            id: 'ch_2',
            amount: 5000,
            currency: 'eur',
            created: 1713360000,
            description: null,
            receipt_email: 'pol@example.org',
          },
        },
      ],
    },
  ];

  const seenUrls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    seenUrls.push(String(input));
    const payload = responses.shift();
    assert.ok(payload, 'expected a mocked Stripe response');

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const payments = await fetchStripePayoutPayments({
    secretKey: 'sk_test_123',
    payoutId: 'po_123',
    fetchImpl,
    timeoutMs: 250,
  });

  assert.equal(payments.length, 2);
  assert.deepEqual(payments[0], {
    stripePaymentId: 'ch_1',
    amountGross: 100,
    fee: 1.25,
    net: 98.75,
    currency: 'eur',
    customerEmail: 'anna@example.org',
    description: 'Donació web',
    created: 1713273600,
  });
  assert.deepEqual(payments[1], {
    stripePaymentId: 'ch_2',
    amountGross: 50,
    fee: 0.6,
    net: 49.4,
    currency: 'eur',
    customerEmail: 'pol@example.org',
    description: null,
    created: 1713360000,
  });

  assert.equal(seenUrls.length, 2);
  assert.match(seenUrls[0], /payout=po_123/);
  assert.match(seenUrls[1], /starting_after=txn_fee/);
});

test('getStripeSecretKeyFromEnv reads only STRIPE_SECRET_KEY from env', () => {
  assert.equal(
    getStripeSecretKeyFromEnv({ STRIPE_SECRET_KEY: '  sk_live_env  ' } as unknown as NodeJS.ProcessEnv),
    'sk_live_env'
  );
  assert.equal(getStripeSecretKeyFromEnv({} as unknown as NodeJS.ProcessEnv), null);
});

test('stripeMinorAmountToMajor supports zero and three-decimal currencies', () => {
  assert.equal(stripeMinorAmountToMajor(12345, 'eur'), 123.45);
  assert.equal(stripeMinorAmountToMajor(12345, 'jpy'), 12345);
  assert.equal(stripeMinorAmountToMajor(12345, 'kwd'), 12.345);
});

test('buildStripePayoutGroupFromPayments adapts API payload to the current imputation flow', () => {
  const group = buildStripePayoutGroupFromPayments('po_abc', [
    {
      stripePaymentId: 'ch_1',
      amountGross: 40,
      fee: 1.2,
      net: 38.8,
      currency: 'eur',
      customerEmail: 'donor1@example.org',
      description: 'Aportació 1',
      created: 1713273600,
    },
    {
      stripePaymentId: 'ch_2',
      amountGross: 60,
      fee: 1.8,
      net: 58.2,
      currency: 'eur',
      customerEmail: 'donor2@example.org',
      description: 'Aportació 2',
      created: 1713360000,
    },
  ]);

  assert.equal(group.transferId, 'po_abc');
  assert.equal(group.rows.length, 2);
  assert.equal(group.gross, 100);
  assert.equal(group.fees, 3);
  assert.equal(group.net, 97);
  assert.equal(group.rows[0]?.id, 'ch_1');
  assert.equal(group.rows[0]?.transfer, 'po_abc');
  assert.equal(group.rows[0]?.createdDate, '2024-04-16');
});
