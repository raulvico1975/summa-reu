import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeImportTransactionTypeForPersist } from '../importers/bank/normalize-import-transaction-type';

describe('normalizeImportTransactionTypeForPersist', () => {
  it('preserva return', () => {
    assert.strictEqual(normalizeImportTransactionTypeForPersist('return'), 'return');
  });

  it('manté normal i donation sense canvis', () => {
    assert.strictEqual(normalizeImportTransactionTypeForPersist('normal'), 'normal');
    assert.strictEqual(normalizeImportTransactionTypeForPersist('donation'), 'donation');
  });
});
