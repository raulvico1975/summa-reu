import test from 'node:test';
import assert from 'node:assert/strict';
import type { Firestore } from 'firebase-admin/firestore';
import { executeCanonicalBankImport } from '@/lib/bank-import/execute-canonical-import';
import type { CanonicalBankImportTx } from '@/lib/bank-import/idempotency';

class FakeFirestore {
  readonly store = new Map<string, Record<string, unknown>>();
  readonly batchSizes: number[] = [];

  doc(path: string) {
    const store = this.store;
    return {
      path,
      id: path.split('/').at(-1) ?? '',
      async get() {
        const data = store.get(path);
        return { exists: Boolean(data), data: () => data };
      },
      async set(payload: Record<string, unknown>, options?: { merge?: boolean }) {
        store.set(path, options?.merge ? { ...(store.get(path) ?? {}), ...payload } : payload);
      },
    };
  }

  async runTransaction<T>(callback: (tx: {
    get(ref: ReturnType<FakeFirestore['doc']>): Promise<{ data(): Record<string, unknown> | undefined }>;
    set(ref: ReturnType<FakeFirestore['doc']>, payload: Record<string, unknown>, options?: { merge?: boolean }): void;
  }) => Promise<T>) {
    return callback({
      get: async (ref) => ref.get(),
      set: (ref, payload, options) => { void ref.set(payload, options); },
    });
  }

  batch() {
    const operations: Array<{
      ref: ReturnType<FakeFirestore['doc']>;
      payload: Record<string, unknown>;
      options?: { merge?: boolean };
    }> = [];
    return {
      set(ref: ReturnType<FakeFirestore['doc']>, payload: Record<string, unknown>, options?: { merge?: boolean }) {
        operations.push({ ref, payload, options });
      },
      commit: async () => {
        this.batchSizes.push(operations.length);
        for (const operation of operations) {
          await operation.ref.set(operation.payload, operation.options);
        }
      },
    };
  }
}

function transaction(index: number): CanonicalBankImportTx {
  return {
    date: new Date(Date.UTC(2026, 7, 1 + (index % 20))).toISOString(),
    operationDate: `2026-08-${String(1 + (index % 20)).padStart(2, '0')}`,
    description: `MOVIMENT ${index}`,
    amount: index + 1,
    category: null,
    document: null,
    contactId: null,
    contactType: null,
    transactionType: 'normal',
    bankAccountId: 'bank-main',
    source: 'bank',
  };
}

function hasUndefined(value: unknown): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.some(hasUndefined);
  if (value && typeof value === 'object') return Object.values(value).some(hasUndefined);
  return false;
}

test('shared canonical executor keeps batches <=50, omits undefined and is inputHash-idempotent', async () => {
  const fake = new FakeFirestore();
  const input = {
    db: fake as unknown as Firestore,
    orgId: 'org-a',
    bankAccountId: 'bank-main',
    fileName: 'extracte.csv',
    source: 'csv' as const,
    totalRows: 101,
    stats: { duplicateSkippedCount: 0 },
    transactions: Array.from({ length: 101 }, (_, index) => transaction(index)),
    requestedBy: 'integration:token-a',
  };
  const first = await executeCanonicalBankImport(input);
  assert.equal(first.ok, true);
  if (!first.ok) throw new Error('first import failed');
  assert.equal(first.createdCount, 101);
  assert.deepEqual(fake.batchSizes, [50, 50, 1]);
  assert.equal(Math.max(...fake.batchSizes) <= 50, true);
  assert.equal([...fake.store.values()].some(hasUndefined), false);

  const second = await executeCanonicalBankImport(input);
  assert.equal(second.ok, true);
  if (!second.ok) throw new Error('idempotent retry failed');
  assert.equal(second.idempotent, true);
  assert.equal(second.createdCount, 101);
  assert.deepEqual(second.createdTransactions, []);
  assert.deepEqual(fake.batchSizes, [50, 50, 1]);
});
