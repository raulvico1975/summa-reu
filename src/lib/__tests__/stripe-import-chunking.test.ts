import test from 'node:test';
import assert from 'node:assert/strict';

import {
  planStripeImportChunkSizes,
  STRIPE_IMPORT_CHILD_CHUNK_SIZE,
} from '@/lib/stripe/import-chunking';

test('planStripeImportChunkSizes respects the 49 child writes cap per batch', () => {
  const sizes = planStripeImportChunkSizes(120);

  assert.deepEqual(sizes, [49, 49, 22]);
  assert.equal(sizes.every((size) => size <= STRIPE_IMPORT_CHILD_CHUNK_SIZE), true);
});

test('planStripeImportChunkSizes keeps 50 total ops safe when parent update is added to last batch', () => {
  const sizes = planStripeImportChunkSizes(50);

  assert.deepEqual(sizes, [49, 1]);
  assert.equal(sizes.at(-1)! + 1 <= 50, true);
});

test('planStripeImportChunkSizes returns empty for zero child writes', () => {
  assert.deepEqual(planStripeImportChunkSizes(0), []);
});
