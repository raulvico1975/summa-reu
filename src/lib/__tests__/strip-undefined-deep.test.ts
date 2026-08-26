import test from 'node:test';
import assert from 'node:assert/strict';
import { stripUndefinedDeep } from '../strip-undefined-deep';

test('stripUndefinedDeep removes nested undefined and compacts arrays', () => {
  const result = stripUndefinedDeep({
    keep: true,
    remove: undefined,
    nested: { remove: undefined, keep: 'ok' },
    items: [1, undefined, { remove: undefined, keep: 2 }],
  });

  assert.deepEqual(result, {
    keep: true,
    nested: { keep: 'ok' },
    items: [1, { keep: 2 }],
  });
});

test('stripUndefinedDeep preserves non-plain Firestore-like values', () => {
  const timestampLike = Object.create({
    toDate: () => new Date('2026-01-01T00:00:00.000Z'),
  });
  const sentinelLike = Object.create({ _methodName: 'serverTimestamp' });
  const result = stripUndefinedDeep({ timestampLike, sentinelLike });

  assert.equal(result.timestampLike, timestampLike);
  assert.equal(result.sentinelLike, sentinelLike);
});
