import assert from 'node:assert/strict';
import test from 'node:test';

import type { Donation } from '@/lib/types/donations';
import { __stripeImputationWritesTestUtils } from '@/lib/stripe/commitStripeImputationWrites';

type TestRef = {
  id: string;
};

type Operation =
  | { type: 'set'; ref: TestRef; data: Donation }
  | { type: 'update'; ref: TestRef; data: { stripeTransferId: string } }
  | { type: 'delete'; ref: TestRef };

function makeDonation(index: number): Donation {
  return {
    date: '2026-03-18',
    contactId: `donor-${index}`,
    amountGross: 10 + index,
    source: 'stripe',
    parentTransactionId: 'parent-tx-1',
    imputationOrigin: 'csv',
    type: 'donation',
    description: `Donacio ${index}`,
    archivedAt: null,
    stripePaymentId: `pay-${index}`,
  };
}

function makeAdjustment(): Donation {
  return {
    date: '2026-03-18',
    contactId: null,
    amount: 0.42,
    source: 'stripe',
    parentTransactionId: 'parent-tx-1',
    imputationOrigin: 'csv',
    type: 'stripe_adjustment',
    description: 'Ajust Stripe',
    archivedAt: null,
  };
}

function createHarness(options?: { failOnCommitNumber?: number }) {
  const committedBatches: Operation[][] = [];
  const attemptedBatches: Operation[][] = [];
  let donationRefCounter = 0;
  let commitCounter = 0;

  return {
    committedBatches,
    attemptedBatches,
    deps: {
      createDonationRef: (): TestRef => ({ id: `don-${++donationRefCounter}` }),
      createParentTransactionRef: (): TestRef => ({ id: 'parent-ref' }),
      createBatch: () => {
        const operations: Operation[] = [];

        return {
          set(ref: TestRef, data: Donation) {
            operations.push({ type: 'set', ref, data });
          },
          update(ref: TestRef, data: { stripeTransferId: string }) {
            operations.push({ type: 'update', ref, data });
          },
          delete(ref: TestRef) {
            operations.push({ type: 'delete', ref });
          },
          async commit() {
            commitCounter += 1;
            attemptedBatches.push([...operations]);

            if (options?.failOnCommitNumber === commitCounter) {
              throw new Error(`COMMIT_FAIL_${commitCounter}`);
            }

            committedBatches.push([...operations]);
          },
        };
      },
    },
  };
}

test('cas curt: 6 linies entren en una sola tanda i el pare es marca al final', async () => {
  const harness = createHarness();

  await __stripeImputationWritesTestUtils.persistStripeImputationWritesCore({
    donations: Array.from({ length: 6 }, (_, index) => makeDonation(index + 1)),
    adjustment: null,
    stripeTransferId: 'po_123',
    deps: harness.deps,
  });

  assert.deepEqual(harness.committedBatches.map((batch) => batch.length), [7]);
  assert.equal(harness.committedBatches[0].filter((op) => op.type === 'set').length, 6);
  assert.equal(harness.committedBatches[0].at(-1)?.type, 'update');
});

test('cas 50+ linies: chunking manté totes les tandes dins el limit intern', async () => {
  const harness = createHarness();

  await __stripeImputationWritesTestUtils.persistStripeImputationWritesCore({
    donations: Array.from({ length: 55 }, (_, index) => makeDonation(index + 1)),
    adjustment: null,
    stripeTransferId: 'po_456',
    deps: harness.deps,
  });

  const committedSizes = harness.committedBatches.map((batch) => batch.length);
  assert.deepEqual(committedSizes, [49, 7]);
  assert.equal(committedSizes.every((size) => size <= 50), true);
  assert.equal(harness.committedBatches[0].some((op) => op.type === 'update'), false);
  assert.equal(harness.committedBatches[1].at(-1)?.type, 'update');
});

test('adjustment opcional també queda dins el limit reservant la darrera tanda', async () => {
  const harness = createHarness();

  await __stripeImputationWritesTestUtils.persistStripeImputationWritesCore({
    donations: Array.from({ length: 50 }, (_, index) => makeDonation(index + 1)),
    adjustment: makeAdjustment(),
    stripeTransferId: 'po_789',
    deps: harness.deps,
  });

  const committedSizes = harness.committedBatches.map((batch) => batch.length);
  assert.deepEqual(committedSizes, [49, 3]);
  assert.equal(committedSizes.every((size) => size <= 50), true);
});

test('si falla una tanda intermèdia, es fa rollback de les anteriors i el pare no queda marcat', async () => {
  const harness = createHarness({ failOnCommitNumber: 2 });

  await assert.rejects(
    () =>
      __stripeImputationWritesTestUtils.persistStripeImputationWritesCore({
        donations: Array.from({ length: 55 }, (_, index) => makeDonation(index + 1)),
        adjustment: null,
        stripeTransferId: 'po_fail',
        deps: harness.deps,
      }),
    /COMMIT_FAIL_2/
  );

  assert.deepEqual(harness.committedBatches.map((batch) => batch.map((op) => op.type)), [
    Array.from({ length: 49 }, () => 'set'),
    Array.from({ length: 49 }, () => 'delete'),
  ]);
  assert.equal(
    harness.attemptedBatches.some((batch) => batch.some((op) => op.type === 'update' && op.data.stripeTransferId === 'po_fail')),
    true
  );
  assert.equal(
    harness.committedBatches.some((batch) => batch.some((op) => op.type === 'update')),
    false
  );
});
