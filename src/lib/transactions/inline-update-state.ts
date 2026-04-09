import type { AnyContact, Category, ContactType, Transaction } from '@/lib/data';
import { isCategoryIdCompatibleStrict } from '@/lib/constants';

type TransactionPatch = Partial<Transaction>;
type InlineReactiveFilter = 'all' | 'uncategorized' | 'noContact' | 'donationsNoContact';

export interface BuiltInlineTransactionUpdate {
  localPatch: TransactionPatch;
  remoteUpdate: Record<string, unknown>;
}

interface BuildContactInlineUpdateParams {
  transaction: Transaction;
  nextContactId: string | null;
  contactType: ContactType | null;
  availableContacts?: AnyContact[] | null;
  availableCategories?: Category[] | null;
}

export function buildContactInlineUpdate({
  transaction,
  nextContactId,
  contactType,
  availableContacts,
  availableCategories,
}: BuildContactInlineUpdateParams): BuiltInlineTransactionUpdate {
  const selectedContact = nextContactId
    ? availableContacts?.find((contact) => contact.id === nextContactId) ?? null
    : null;

  const resolvedContactType = nextContactId
    ? contactType
    : null;

  const nextCategory = (
    nextContactId &&
    selectedContact?.defaultCategoryId &&
    !transaction.category &&
    availableCategories &&
    isCategoryIdCompatibleStrict(transaction.amount, selectedContact.defaultCategoryId, availableCategories)
  )
    ? selectedContact.defaultCategoryId
    : transaction.category;

  return {
    localPatch: {
      contactId: nextContactId,
      contactType: resolvedContactType ?? undefined,
      category: nextCategory,
    },
    remoteUpdate: {
      contactId: nextContactId,
      contactType: resolvedContactType,
      ...(nextCategory !== transaction.category ? { category: nextCategory } : {}),
    },
  };
}

export function buildCategoryInlineUpdate(categoryId: string): BuiltInlineTransactionUpdate {
  return {
    localPatch: {
      category: categoryId,
    },
    remoteUpdate: {
      category: categoryId,
    },
  };
}

export function applyTransactionPatch(
  transactions: Transaction[] | null,
  txId: string,
  patch: TransactionPatch
): Transaction[] | null {
  if (!transactions) return transactions;

  const txIndex = transactions.findIndex((transaction) => transaction.id === txId);
  if (txIndex === -1) return transactions;

  const currentTx = transactions[txIndex];
  const nextTransactions = [...transactions];
  nextTransactions[txIndex] = {
    ...currentTx,
    ...patch,
  };

  return nextTransactions;
}

export function matchesInlineReactiveFilter(
  transaction: Transaction,
  filter: InlineReactiveFilter
): boolean {
  switch (filter) {
    case 'uncategorized':
      return transaction.category === null || transaction.category === 'Revisar';
    case 'noContact':
      return !transaction.contactId && Math.abs(transaction.amount) > 50;
    case 'donationsNoContact':
      return (
        !transaction.contactId &&
        transaction.amount > 0 &&
        (transaction.category === 'Donaciones' || transaction.category === 'Cuotas socios')
      );
    case 'all':
    default:
      return true;
  }
}
