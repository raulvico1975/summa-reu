import test from 'node:test';
import assert from 'node:assert/strict';
import { getCurrentQuarterRange } from '@/lib/closing-bundle/closing-bundle-types';

test('getCurrentQuarterRange returns Q1 boundaries', () => {
  assert.deepEqual(getCurrentQuarterRange(new Date('2026-02-14T12:00:00Z')), {
    dateFrom: '2026-01-01',
    dateTo: '2026-03-31',
  });
});

test('getCurrentQuarterRange returns Q3 boundaries', () => {
  assert.deepEqual(getCurrentQuarterRange(new Date('2026-08-02T12:00:00Z')), {
    dateFrom: '2026-07-01',
    dateTo: '2026-09-30',
  });
});
