import type { ExpenseSource } from '@/lib/project-module-types';

const PENDING_CATEGORY_NAMES = new Set([
  'revisar',
  'sense categoria',
  'sin categoria',
]);

export function isPendingExpenseCategoryName(categoryName: string | null | undefined): boolean {
  const normalized = categoryName?.trim().toLowerCase() ?? '';
  if (!normalized) return true;
  return PENDING_CATEGORY_NAMES.has(normalized);
}

export function isExpenseCategoryPending(expense: {
  source: ExpenseSource;
  categoryName: string | null | undefined;
}): boolean {
  if (expense.source !== 'bank') return false;
  return isPendingExpenseCategoryName(expense.categoryName);
}
