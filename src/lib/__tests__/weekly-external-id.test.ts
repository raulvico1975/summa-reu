import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWeeklyProductUpdateExternalId,
  buildWeeklyProductUpdateSlug,
} from '@/lib/product-updates/weekly-external-id';

test('buildWeeklyProductUpdateExternalId retorna un id determinista per setmana', () => {
  const window = {
    weekStartLabel: '2026-03-30',
    weekEndLabel: '2026-04-05',
  };

  assert.equal(
    buildWeeklyProductUpdateExternalId(window),
    'weekly-product-update-2026-03-30_2026-04-05'
  );
  assert.equal(
    buildWeeklyProductUpdateExternalId(window),
    buildWeeklyProductUpdateExternalId({ ...window })
  );
});

test('buildWeeklyProductUpdateSlug genera un slug estable per la mateixa setmana', () => {
  assert.equal(
    buildWeeklyProductUpdateSlug({
      weekStartLabel: '2026-03-30',
      weekEndLabel: '2026-04-05',
    }),
    'novetats-setmanals-2026-03-30-2026-04-05'
  );
});
