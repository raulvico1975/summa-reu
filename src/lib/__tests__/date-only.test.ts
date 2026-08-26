import test from 'node:test';
import assert from 'node:assert/strict';
import { getCalendarDateParts, getCalendarMonth, getCalendarYear } from '../date-only';

test('calendar parts preserve the declared date for ISO values', () => {
  assert.deepEqual(getCalendarDateParts('2026-01-01T00:00:00.000Z'), {
    year: 2026,
    month: 1,
    day: 1,
  });
});

test('calendar year and month do not depend on local timezone for date-only values', () => {
  assert.equal(getCalendarYear('2026-01-01'), 2026);
  assert.equal(getCalendarMonth('2026-01-01'), 1);
});

test('invalid calendar prefixes return null', () => {
  assert.equal(getCalendarYear('not-a-date'), null);
  assert.equal(getCalendarMonth('2026-13-01'), null);
});
