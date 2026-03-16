import type { Transaction } from '@/lib/data';

type StripeLikeTransaction = Pick<
  Transaction,
  | 'amount'
  | 'description'
  | 'isRemittance'
  | 'isRemittanceItem'
  | 'isSplit'
  | 'parentTransactionId'
  | 'source'
  | 'stripeTransferId'
  | 'transactionType'
>;

const STRIPE_PATTERNS = [
  'stripe',
  'transf de stripe',
  'transferencia de stripe',
  'stripe payments',
];

function normalizeDescription(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function hasStripeKeyword(description: string | null | undefined): boolean {
  const normalizedDescription = normalizeDescription(description);
  return STRIPE_PATTERNS.some(pattern => normalizedDescription.includes(pattern));
}

export function isStripeLikeTransaction(tx: StripeLikeTransaction): boolean {
  if (tx.source === 'stripe' || !!tx.stripeTransferId) return true;

  if (tx.amount <= 0) return false;
  if (tx.transactionType === 'donation' || tx.transactionType === 'fee') return false;

  return hasStripeKeyword(tx.description);
}

export function canSplitStripeRemittance(tx: StripeLikeTransaction): boolean {
  if (tx.amount <= 0) return false;
  if (tx.isRemittance || tx.isRemittanceItem) return false;
  if (tx.isSplit || !!tx.parentTransactionId || !!tx.stripeTransferId) return false;
  if (tx.transactionType === 'donation' || tx.transactionType === 'fee') return false;
  if (tx.source === 'remittance') return false;

  return tx.source === 'stripe' || hasStripeKeyword(tx.description);
}
