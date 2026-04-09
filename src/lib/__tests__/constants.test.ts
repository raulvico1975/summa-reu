import test from 'node:test';
import assert from 'node:assert/strict';

import { findSystemCategoryId } from '@/lib/constants';

test('findSystemCategoryId resolves by systemKey when present', () => {
  assert.equal(
    findSystemCategoryId(
      [
        { id: 'cat-1', name: 'missionTransfers', systemKey: null },
        { id: 'cat-2', name: 'custom', systemKey: 'missionTransfers' },
      ],
      'missionTransfers'
    ),
    'cat-2'
  );
});

test('findSystemCategoryId falls back to legacy name when systemKey is missing', () => {
  assert.equal(
    findSystemCategoryId(
      [
        { id: 'cat-1', name: 'travel', systemKey: null },
        { id: 'cat-2', name: 'missionTransfers', systemKey: null },
      ],
      'missionTransfers'
    ),
    'cat-2'
  );
});
