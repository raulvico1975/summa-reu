import type { TransactionType } from '@/lib/data';

const ALLOWED_TRANSACTION_TYPES: readonly TransactionType[] = [
  'normal',
  'return',
  'return_fee',
  'donation',
  'fee',
] as const;

export function normalizeImportTransactionTypeForPersist(
  transactionType: unknown
): TransactionType {
  if (
    typeof transactionType === 'string' &&
    ALLOWED_TRANSACTION_TYPES.includes(transactionType as TransactionType)
  ) {
    return transactionType as TransactionType;
  }

  return 'normal';
}
