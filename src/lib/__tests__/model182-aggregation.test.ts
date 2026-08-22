import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Donor, Transaction } from '../data';
import { buildModel182Candidates } from '../model182-aggregation';

const donor: Donor = {
  id: 'donor-model182-breakdown',
  type: 'donor',
  name: 'Donant de prova',
  taxId: '12345678Z',
  zipCode: '08001',
  donorType: 'individual',
  membershipType: 'recurring',
  createdAt: '2024-01-01',
};

let nextTransactionId = 1;

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx-${nextTransactionId++}`,
    date: '2026-01-05',
    description: 'Moviment de prova',
    amount: 10,
    category: null,
    document: null,
    contactId: donor.id,
    contactType: 'donor',
    transactionType: 'donation',
    ...overrides,
  };
}

describe('buildModel182Candidates — desglossament fiscal visible', () => {
  it('mostra 70 donats, -10 de devolució i 60 nets en una parella retornada', () => {
    const transactions: Transaction[] = [
      transaction({
        id: 'donation-returned',
        donationStatus: 'returned',
        linkedTransactionId: 'bank-return',
      }),
      transaction({
        id: 'bank-return',
        amount: -10,
        transactionType: 'return',
        linkedTransactionId: 'donation-returned',
      }),
      ...['02', '03', '04', '05', '06', '07'].map((month) => transaction({
        id: `donation-${month}`,
        date: `2026-${month}-05`,
      })),
    ];

    const [candidate] = buildModel182Candidates(transactions, [donor], 2026);

    assert.equal(candidate.grossAmount, 70);
    assert.equal(candidate.returnsAmount, -10);
    assert.equal(candidate.returnCount, 1);
    assert.equal(candidate.totalAmount, 60);
  });

  it('resta una devolució sense parella una sola vegada', () => {
    const [candidate] = buildModel182Candidates([
      transaction({ id: 'donation-100', amount: 100 }),
      transaction({
        id: 'return-30',
        amount: -30,
        transactionType: 'return',
        linkedTransactionId: null,
      }),
    ], [donor], 2026);

    assert.equal(candidate.grossAmount, 100);
    assert.equal(candidate.returnsAmount, -30);
    assert.equal(candidate.returnCount, 1);
    assert.equal(candidate.totalAmount, 70);
  });

  it('suma diversos retornats amb signe negatiu i ignora pares arxivats o de remesa', () => {
    const [candidate] = buildModel182Candidates([
      transaction({ id: 'donation-100', amount: 100 }),
      transaction({ id: 'return-10', amount: -10, transactionType: 'return' }),
      transaction({ id: 'return-5', amount: -5, transactionType: 'return' }),
      transaction({ id: 'archived-donation', amount: 50, archivedAt: '2026-02-01' }),
      transaction({ id: 'remittance-donation', amount: 40, isRemittance: true }),
      transaction({ id: 'split-donation', amount: 30, isSplit: true }),
      transaction({ id: 'archived-return', amount: -20, transactionType: 'return', archivedAt: '2026-02-01' }),
    ], [donor], 2026);

    assert.equal(candidate.grossAmount, 100);
    assert.equal(candidate.returnsAmount, -15);
    assert.equal(candidate.returnCount, 2);
    assert.equal(candidate.totalAmount, 85);
  });

  it('mostra una devolució parcial una sola vegada i conserva el brut complet', () => {
    const [candidate] = buildModel182Candidates([
      transaction({ id: 'donation-partial', amount: 100, donationStatus: 'partial' }),
      transaction({ id: 'return-partial', amount: -25, transactionType: 'return' }),
    ], [donor], 2026);

    assert.equal(candidate.grossAmount, 100);
    assert.equal(candidate.returnsAmount, -25);
    assert.equal(candidate.returnCount, 1);
    assert.equal(candidate.totalAmount, 75);
  });

  it('manté el criteri temporal quan la devolució arriba en un exercici diferent', () => {
    const [candidate] = buildModel182Candidates([
      transaction({ id: 'donation-previous-year', amount: 100, date: '2025-12-20' }),
      transaction({ id: 'donation-current-year', amount: 50, date: '2026-01-05' }),
      transaction({ id: 'return-current-year', amount: -20, date: '2026-02-05', transactionType: 'return' }),
    ], [donor], 2026);

    assert.equal(candidate.grossAmount, 50);
    assert.equal(candidate.returnsAmount, -20);
    assert.equal(candidate.totalAmount, 30);
    assert.equal(candidate.previousYearAmount, 100);
  });

  it('exclou de la llista oficial un donant amb net fiscal zero', () => {
    const candidates = buildModel182Candidates([
      transaction({
        id: 'donation-returned-zero',
        amount: 100,
        donationStatus: 'returned',
        linkedTransactionId: 'bank-return-zero',
      }),
      transaction({
        id: 'bank-return-zero',
        amount: -100,
        transactionType: 'return',
        linkedTransactionId: 'donation-returned-zero',
      }),
    ], [donor], 2026);

    assert.equal(candidates.length, 0);
  });

  it('manté els imports històrics separats del desglossament de l any actual', () => {
    const [candidate] = buildModel182Candidates([
      transaction({ id: 'current', amount: 10, date: '2026-01-05' }),
      transaction({ id: 'previous', amount: 20, date: '2025-01-05' }),
      transaction({ id: 'two-years-ago', amount: 30, date: '2024-01-05' }),
    ], [donor], 2026);

    assert.equal(candidate.grossAmount, 10);
    assert.equal(candidate.returnsAmount, 0);
    assert.equal(candidate.totalAmount, 10);
    assert.equal(candidate.previousYearAmount, 20);
    assert.equal(candidate.twoYearsAgoAmount, 30);
  });
});
