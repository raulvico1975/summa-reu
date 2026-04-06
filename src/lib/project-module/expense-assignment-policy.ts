import type { ExpenseStatus, UnifiedExpenseWithLink } from '@/lib/project-module-types';

export type ProjectExpenseTableFilter =
  | 'all'
  | 'withDocument'
  | 'withoutDocument'
  | 'noContact'
  | 'bank'
  | 'offBank'
  | 'assigned'
  | 'unassigned'
  | 'needsReview';

export function matchesProjectExpenseTableFilter(
  item: UnifiedExpenseWithLink,
  filter: ProjectExpenseTableFilter
): boolean {
  const exp = item.expense;

  switch (filter) {
    case 'needsReview':
      return exp.needsReview === true;
    case 'withDocument':
      return !!exp.documentUrl;
    case 'withoutDocument':
      return !exp.documentUrl;
    case 'noContact':
      return !exp.counterpartyName;
    case 'bank':
      return exp.source === 'bank';
    case 'offBank':
      return exp.source === 'offBank';
    case 'assigned':
      return item.status === 'assigned';
    case 'unassigned':
      return item.status === 'unassigned';
    case 'all':
    default:
      return true;
  }
}

export function canSelectExpenseForProjectAssignment(_item: UnifiedExpenseWithLink): boolean {
  return true;
}

export function shouldAutoOpenProjectAssignmentEditor(options: {
  hasAutoOpened: boolean;
  isLoading: boolean;
  assignedAmount: number;
  totalAmount: number;
}): boolean {
  if (options.isLoading || options.hasAutoOpened) return false;
  return (options.totalAmount - options.assignedAmount) > 0.01;
}
