import type { Transaction } from '@/lib/data';

export function isDonationCandidate(tx: Transaction): boolean {
  return (
    tx.amount > 0 &&
    !!tx.contactId &&
    tx.contactType === 'donor' &&
    tx.transactionType !== 'donation' &&
    !!tx.category
  );
}
