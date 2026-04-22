import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPreviousWeeklyWindow } from '@/lib/product-updates/weekly-window';

test('buildPreviousWeeklyWindow calcula la setmana natural anterior a dilluns 08:00 Europe/Madrid', () => {
  const window = buildPreviousWeeklyWindow(
    new Date('2026-04-06T06:00:00.000Z'),
    'Europe/Madrid'
  );

  assert.deepEqual(window, {
    weekStart: '2026-03-29T22:00:00.000Z',
    weekEnd: '2026-04-05T21:59:59.999Z',
    weekStartLabel: '2026-03-30',
    weekEndLabel: '2026-04-05',
  });
});

test('buildPreviousWeeklyWindow cobreix correctament el canvi d’horari de primavera', () => {
  const window = buildPreviousWeeklyWindow(
    new Date('2026-03-30T06:00:00.000Z'),
    'Europe/Madrid'
  );

  assert.deepEqual(window, {
    weekStart: '2026-03-22T23:00:00.000Z',
    weekEnd: '2026-03-29T21:59:59.999Z',
    weekStartLabel: '2026-03-23',
    weekEndLabel: '2026-03-29',
  });
});
