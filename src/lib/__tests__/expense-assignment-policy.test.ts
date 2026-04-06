import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canSelectExpenseForProjectAssignment,
  matchesProjectExpenseTableFilter,
  shouldAutoOpenProjectAssignmentEditor,
} from '@/lib/project-module/expense-assignment-policy';
import type { UnifiedExpenseWithLink } from '@/lib/project-module-types';

function buildExpense(
  overrides: Omit<Partial<UnifiedExpenseWithLink>, 'expense'> & {
    expense?: Partial<UnifiedExpenseWithLink['expense']>;
  } = {}
): UnifiedExpenseWithLink {
  const { expense: expenseOverrides = {}, ...restOverrides } = overrides;

  return {
    expense: {
      txId: 'tx-1',
      source: 'bank',
      date: '2026-04-06',
      description: 'Despesa bancària',
      amountEUR: -100,
      categoryName: null,
      counterpartyName: 'Proveidor',
      documentUrl: null,
      ...expenseOverrides,
    },
    link: null,
    status: 'unassigned',
    assignedAmount: 0,
    remainingAmount: 100,
    ...restOverrides,
  };
}

test('allows selecting bank expenses without a global category', () => {
  const withoutCategory = buildExpense({
    expense: { categoryName: null },
  });
  const reviewCategory = buildExpense({
    expense: { categoryName: 'Revisar' },
  });

  assert.equal(canSelectExpenseForProjectAssignment(withoutCategory), true);
  assert.equal(canSelectExpenseForProjectAssignment(reviewCategory), true);
});

test('keeps uncategorized bank expenses visible in the unassigned filter', () => {
  const uncategorizedExpense = buildExpense({
    expense: { categoryName: null },
    status: 'unassigned',
  });

  assert.equal(matchesProjectExpenseTableFilter(uncategorizedExpense, 'all'), true);
  assert.equal(matchesProjectExpenseTableFilter(uncategorizedExpense, 'bank'), true);
  assert.equal(matchesProjectExpenseTableFilter(uncategorizedExpense, 'unassigned'), true);
});

test('does not exclude review-category bank expenses from the unassigned filter', () => {
  const reviewExpense = buildExpense({
    expense: { categoryName: 'Revisar' },
    status: 'unassigned',
  });

  assert.equal(matchesProjectExpenseTableFilter(reviewExpense, 'unassigned'), true);
  assert.equal(canSelectExpenseForProjectAssignment(reviewExpense), true);
});

test('detail editor auto-opens for pending assignments regardless of global category state', () => {
  assert.equal(
    shouldAutoOpenProjectAssignmentEditor({
      isLoading: false,
      hasAutoOpened: false,
      assignedAmount: 0,
      totalAmount: 100,
    }),
    true
  );

  assert.equal(
    shouldAutoOpenProjectAssignmentEditor({
      isLoading: false,
      hasAutoOpened: false,
      assignedAmount: 100,
      totalAmount: 100,
    }),
    false
  );
});
