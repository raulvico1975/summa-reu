import test from 'node:test';
import assert from 'node:assert/strict';

import type { Contact, Transaction } from '@/lib/data';
import {
  computeBalance,
  computeExpenseByCategory,
  computeIncomeComposition,
  computeMonthlyEvolution,
  filterDashboardLedgerTransactions,
  filterSocialTransactions,
  UNCATEGORIZED_EXPENSE_LABEL,
} from '@/lib/read-models/analytics';

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? 'tx',
    date: overrides.date ?? '2026-01-15',
    description: overrides.description ?? 'Moviment',
    amount: overrides.amount ?? 0,
    category: overrides.category ?? null,
    document: overrides.document ?? null,
    contactId: overrides.contactId,
    contactType: overrides.contactType,
    projectId: overrides.projectId,
    transactionType: overrides.transactionType,
    donationStatus: overrides.donationStatus,
    linkedTransactionId: overrides.linkedTransactionId,
    linkedTransactionIds: overrides.linkedTransactionIds,
    isSplit: overrides.isSplit,
    parentTransactionId: overrides.parentTransactionId ?? null,
    isRemittance: overrides.isRemittance ?? false,
    isRemittanceItem: overrides.isRemittanceItem ?? false,
    source: overrides.source,
    archivedAt: overrides.archivedAt ?? null,
    remittanceId: overrides.remittanceId,
    remittanceType: overrides.remittanceType,
    remittanceDirection: overrides.remittanceDirection,
  };
}

function makeContact(overrides: Partial<Contact>): Contact {
  return {
    id: overrides.id ?? 'contact-1',
    type: overrides.type ?? 'donor',
    name: overrides.name ?? 'Contacte',
    taxId: overrides.taxId ?? '12345678A',
    zipCode: overrides.zipCode ?? '08001',
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    archivedAt: overrides.archivedAt,
    roles: overrides.roles,
  };
}

test('filterDashboardLedgerTransactions reuses canonical ledger semantics', () => {
  const items = filterDashboardLedgerTransactions([
    makeTx({ id: 'visible-income', amount: 100, source: 'bank' }),
    makeTx({
      id: 'child',
      amount: 50,
      source: 'remittance',
      parentTransactionId: 'parent-1',
      isRemittanceItem: true,
    }),
    makeTx({
      id: 'archived',
      amount: -20,
      source: 'bank',
      archivedAt: '2026-02-01T00:00:00.000Z',
    }),
    makeTx({
      id: 'stripe-donation-child',
      amount: 80,
      source: 'stripe',
      transactionType: 'donation',
    }),
    makeTx({
      id: 'stripe-fee-child',
      amount: -3,
      source: 'stripe',
      transactionType: 'fee',
    }),
  ]);

  assert.deepEqual(items.map((item) => item.id), ['visible-income']);
});

test('filterSocialTransactions keeps non-archived contact transactions including remittance children', () => {
  const items = filterSocialTransactions([
    makeTx({
      id: 'child-remittance',
      amount: 25,
      contactId: 'donor-1',
      contactType: 'donor',
      parentTransactionId: 'parent-1',
      isRemittanceItem: true,
      source: 'remittance',
    }),
    makeTx({
      id: 'archived',
      amount: 40,
      contactId: 'donor-2',
      archivedAt: '2026-01-10T00:00:00.000Z',
    }),
    makeTx({
      id: 'without-contact',
      amount: 30,
      contactId: null,
      source: 'bank',
    }),
  ]);

  assert.deepEqual(items.map((item) => item.id), ['child-remittance']);
});

test('computeBalance matches dashboard money block semantics', () => {
  const result = computeBalance(
    [
      makeTx({ id: 'income', amount: 200, category: null }),
      makeTx({ id: 'expense', amount: -75, category: 'office' }),
      makeTx({ id: 'mission', amount: -40, category: 'mission' }),
    ],
    'mission'
  );

  assert.deepEqual(result, {
    incomeTotal: 200,
    operatingExpenseTotal: -75,
    missionTransfersTotal: -40,
    operatingBalance: 85,
  });
});

test('computeMonthlyEvolution includes empty months with zeros', () => {
  const result = computeMonthlyEvolution(
    [
      makeTx({ id: 'jan-income', date: '2026-01-05', amount: 120 }),
      makeTx({ id: 'mar-expense', date: '2026-03-10', amount: -20, category: 'office' }),
    ],
    '2026-01-01',
    '2026-03-31',
    'mission'
  );

  assert.deepEqual(result.items, [
    { month: '2026-01', income: 120, expenses: 0, missionTransfers: 0, balance: 120 },
    { month: '2026-02', income: 0, expenses: 0, missionTransfers: 0, balance: 0 },
    { month: '2026-03', income: 0, expenses: -20, missionTransfers: 0, balance: -20 },
  ]);
});

test('computeExpenseByCategory excludes fee, return_fee and mission transfers', () => {
  const result = computeExpenseByCategory(
    [
      makeTx({ id: 'office-a', amount: -50, category: 'office' }),
      makeTx({ id: 'office-b', amount: -20, category: 'office' }),
      makeTx({ id: 'uncategorized', amount: -10, category: null }),
      makeTx({ id: 'fee', amount: -5, transactionType: 'fee', category: 'fees' }),
      makeTx({ id: 'return-fee', amount: -7, transactionType: 'return_fee', category: 'fees' }),
      makeTx({ id: 'mission', amount: -40, category: 'mission' }),
    ],
    [
      { id: 'office', name: 'Oficina', type: 'expense', systemKey: null },
      { id: 'fees', name: 'Comissions', type: 'expense', systemKey: null },
      { id: 'mission', name: 'Terreny', type: 'expense', systemKey: 'missionTransfers' },
    ],
    'mission'
  );

  assert.equal(result.total, 80);
  assert.deepEqual(result.items, [
    {
      categoryId: 'office',
      categoryName: 'Oficina',
      amount: 70,
      percentage: 87.5,
      movementCount: 2,
    },
    {
      categoryId: null,
      categoryName: UNCATEGORIZED_EXPENSE_LABEL,
      amount: 10,
      percentage: 12.5,
      movementCount: 1,
    },
  ]);
});

test('computeIncomeComposition keeps dashboard residual logic for other income', () => {
  const result = computeIncomeComposition({
    incomeTotal: 200,
    socialTxs: [
      makeTx({
        id: 'member-fee',
        amount: 70,
        contactId: 'member-1',
        contactType: 'donor',
        parentTransactionId: 'parent-1',
        isRemittanceItem: true,
      }),
      makeTx({
        id: 'one-time',
        amount: 50,
        contactId: 'donor-1',
        contactType: 'donor',
      }),
      makeTx({
        id: 'ignored-supplier',
        amount: 999,
        contactId: 'supplier-1',
        contactType: 'supplier',
      }),
      makeTx({
        id: 'ignored-negative',
        amount: -10,
        contactId: 'donor-1',
        contactType: 'donor',
      }),
    ],
    contacts: [
      { ...makeContact({ id: 'member-1', type: 'donor' }), membershipType: 'recurring' },
      { ...makeContact({ id: 'donor-1', type: 'donor' }), membershipType: 'one-time' },
    ],
  });

  assert.deepEqual(result, {
    memberFees: 70,
    oneTimeDonations: 50,
    otherIncome: 80,
    percentages: {
      memberFees: 35,
      oneTimeDonations: 25,
      otherIncome: 40,
    },
  });
});

test('computeIncomeComposition never returns negative otherIncome', () => {
  const result = computeIncomeComposition({
    incomeTotal: 20,
    socialTxs: [
      makeTx({
        id: 'member-fee',
        amount: 15,
        contactId: 'member-1',
        contactType: 'donor',
      }),
      makeTx({
        id: 'one-time',
        amount: 10,
        contactId: 'donor-1',
        contactType: 'donor',
      }),
    ],
    contacts: [
      { ...makeContact({ id: 'member-1', type: 'donor' }), membershipType: 'recurring' },
      { ...makeContact({ id: 'donor-1', type: 'donor' }), membershipType: 'one-time' },
    ],
  });

  assert.equal(result.otherIncome, 0);
});
