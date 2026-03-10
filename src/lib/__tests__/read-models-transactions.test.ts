import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDashboardSummary,
  decodeTransactionPageCursor,
  encodeTransactionPageCursor,
  resolvePeriodRange,
} from '@/lib/read-models/transactions';

test('resolvePeriodRange supports explicit year and quarter filters', () => {
  const explicitYear = new URLSearchParams({ year: '2025' });
  assert.deepEqual(resolvePeriodRange(explicitYear), {
    start: '2025-01-01',
    end: '2025-12-31',
  });

  const quarter = new URLSearchParams({
    periodType: 'quarter',
    periodYear: '2024',
    periodQuarter: '2',
  });
  assert.deepEqual(resolvePeriodRange(quarter), {
    start: '2024-04-01',
    end: '2024-06-30',
  });
});

test('buildDashboardSummary keeps current ledger semantics', () => {
  const summary = buildDashboardSummary(
    [
      {
        amount: 100,
        category: null,
        archivedAt: null,
        parentTransactionId: null,
        source: 'bank',
        transactionType: 'normal',
        isRemittance: false,
        isRemittanceItem: false,
      },
      {
        amount: -20,
        category: 'mission',
        archivedAt: null,
        parentTransactionId: null,
        source: 'bank',
        transactionType: 'normal',
        isRemittance: false,
        isRemittanceItem: false,
      },
      {
        amount: -15,
        category: 'expense',
        archivedAt: null,
        parentTransactionId: null,
        source: 'bank',
        transactionType: 'normal',
        isRemittance: false,
        isRemittanceItem: false,
      },
      {
        amount: 40,
        category: null,
        archivedAt: null,
        parentTransactionId: null,
        source: 'bank',
        transactionType: 'donation',
        isRemittance: false,
        isRemittanceItem: false,
      },
      {
        amount: -10,
        category: 'expense',
        archivedAt: '2026-01-10T12:00:00.000Z',
        parentTransactionId: null,
        source: 'bank',
        transactionType: 'normal',
        isRemittance: false,
        isRemittanceItem: false,
      },
      {
        amount: 50,
        category: null,
        archivedAt: null,
        parentTransactionId: 'parent-1',
        source: 'remittance',
        transactionType: 'normal',
        isRemittance: false,
        isRemittanceItem: true,
      },
    ],
    'mission'
  );

  assert.deepEqual(summary, {
    income: 100,
    expense: -15,
    missionTransfers: -20,
    balance: 65,
    count: 3,
  });
});

test('transaction page cursor roundtrip is stable', () => {
  const encoded = encodeTransactionPageCursor({ id: 'tx_123' });
  assert.deepEqual(decodeTransactionPageCursor(encoded), { id: 'tx_123' });
  assert.equal(decodeTransactionPageCursor('not-base64'), null);
});
