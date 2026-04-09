import test from 'node:test';
import assert from 'node:assert/strict';
import type { Category, Donor, Transaction } from '@/lib/data';
import {
  applyTransactionPatch,
  buildCategoryInlineUpdate,
  buildContactInlineUpdate,
  matchesInlineReactiveFilter,
} from '@/lib/transactions/inline-update-state';

const incomeCategory: Category = {
  id: 'cat-income',
  name: 'Donaciones',
  type: 'income',
};

const expenseCategory: Category = {
  id: 'cat-expense',
  name: 'Subministraments',
  type: 'expense',
};

const donorWithDefaultCategory: Donor = {
  id: 'donor-1',
  type: 'donor',
  roles: { donor: true, employee: true },
  donorType: 'individual',
  membershipType: 'one-time',
  name: 'Donant prova',
  taxId: '12345678A',
  zipCode: '08001',
  createdAt: '2026-03-12T10:00:00.000Z',
  defaultCategoryId: incomeCategory.id,
};

function buildTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    date: '2026-03-12',
    description: 'Moviment prova',
    amount: 100,
    category: null,
    document: null,
    ...overrides,
  };
}

test('buildCategoryInlineUpdate patches local and remote category consistently', () => {
  const result = buildCategoryInlineUpdate(incomeCategory.id);

  assert.deepEqual(result.localPatch, { category: incomeCategory.id });
  assert.deepEqual(result.remoteUpdate, { category: incomeCategory.id });
});

test('buildContactInlineUpdate mirrors default category auto-assignment', () => {
  const result = buildContactInlineUpdate({
    transaction: buildTransaction(),
    nextContactId: donorWithDefaultCategory.id,
    contactType: 'donor',
    availableContacts: [donorWithDefaultCategory],
    availableCategories: [incomeCategory, expenseCategory],
  });

  assert.equal(result.localPatch.contactId, donorWithDefaultCategory.id);
  assert.equal(result.localPatch.contactType, 'donor');
  assert.equal(result.localPatch.category, incomeCategory.id);
  assert.deepEqual(result.remoteUpdate, {
    contactId: donorWithDefaultCategory.id,
    contactType: 'donor',
    category: incomeCategory.id,
  });
});

test('buildContactInlineUpdate preserves an explicitly selected employee role', () => {
  const result = buildContactInlineUpdate({
    transaction: buildTransaction(),
    nextContactId: donorWithDefaultCategory.id,
    contactType: 'employee',
    availableContacts: [donorWithDefaultCategory],
    availableCategories: [incomeCategory, expenseCategory],
  });

  assert.equal(result.localPatch.contactId, donorWithDefaultCategory.id);
  assert.equal(result.localPatch.contactType, 'employee');
  assert.equal(result.localPatch.category, incomeCategory.id);
  assert.deepEqual(result.remoteUpdate, {
    contactId: donorWithDefaultCategory.id,
    contactType: 'employee',
    category: incomeCategory.id,
  });
});

test('buildContactInlineUpdate does not assign an incompatible default category', () => {
  const result = buildContactInlineUpdate({
    transaction: buildTransaction({ amount: -25 }),
    nextContactId: donorWithDefaultCategory.id,
    contactType: 'donor',
    availableContacts: [donorWithDefaultCategory],
    availableCategories: [incomeCategory, expenseCategory],
  });

  assert.equal(result.localPatch.contactId, donorWithDefaultCategory.id);
  assert.equal(result.localPatch.category, null);
  assert.deepEqual(result.remoteUpdate, {
    contactId: donorWithDefaultCategory.id,
    contactType: 'donor',
  });
});

test('applyTransactionPatch updates the row inside the current source-of-truth array', () => {
  const transactions = [buildTransaction()];
  const nextTransactions = applyTransactionPatch(transactions, 'tx-1', {
    contactId: donorWithDefaultCategory.id,
    category: incomeCategory.id,
  });

  assert.notEqual(nextTransactions, transactions);
  assert.equal(nextTransactions?.[0].contactId, donorWithDefaultCategory.id);
  assert.equal(nextTransactions?.[0].category, incomeCategory.id);
});

test('applyTransactionPatch can change only the role for the same contact', () => {
  const original = buildTransaction({
    contactId: donorWithDefaultCategory.id,
    contactType: 'donor',
  });
  const nextTransactions = applyTransactionPatch([original], 'tx-1', {
    contactId: donorWithDefaultCategory.id,
    contactType: 'employee',
  });

  assert.equal(nextTransactions?.[0].contactId, donorWithDefaultCategory.id);
  assert.equal(nextTransactions?.[0].contactType, 'employee');
  assert.equal(nextTransactions?.[0].description, original.description);
});

test('category update under uncategorized filter stops matching immediately', () => {
  const transactions = [buildTransaction()];
  const nextTransactions = applyTransactionPatch(transactions, 'tx-1', {
    category: incomeCategory.id,
  });

  assert.equal(matchesInlineReactiveFilter(transactions[0], 'uncategorized'), true);
  assert.equal(matchesInlineReactiveFilter(nextTransactions?.[0] as Transaction, 'uncategorized'), false);
});

test('rollback restores the previous category snapshot', () => {
  const original = buildTransaction({ category: null });
  const patched = applyTransactionPatch([original], 'tx-1', {
    category: incomeCategory.id,
  });
  const rolledBack = applyTransactionPatch(patched, 'tx-1', original);

  assert.equal(patched?.[0].category, incomeCategory.id);
  assert.equal(rolledBack?.[0].category, null);
  assert.equal(rolledBack?.[0].description, original.description);
});
