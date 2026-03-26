import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isExpenseCategoryPending,
  isPendingExpenseCategoryName,
} from '@/lib/project-module/expense-category-pending';

test('treats missing and review categories as pending', () => {
  assert.equal(isPendingExpenseCategoryName(null), true);
  assert.equal(isPendingExpenseCategoryName(''), true);
  assert.equal(isPendingExpenseCategoryName('Revisar'), true);
  assert.equal(isPendingExpenseCategoryName('sense categoria'), true);
});

test('keeps real categories out of pending state', () => {
  assert.equal(isPendingExpenseCategoryName('bankFees'), false);
  assert.equal(isPendingExpenseCategoryName('oNKBHfQeKNUK0W9G4O3k'), false);
});

test('only bank expenses use the pending-category blocking state', () => {
  assert.equal(isExpenseCategoryPending({ source: 'bank', categoryName: null }), true);
  assert.equal(isExpenseCategoryPending({ source: 'bank', categoryName: 'Revisar' }), true);
  assert.equal(isExpenseCategoryPending({ source: 'bank', categoryName: 'bankFees' }), false);
  assert.equal(isExpenseCategoryPending({ source: 'offBank', categoryName: null }), false);
});
