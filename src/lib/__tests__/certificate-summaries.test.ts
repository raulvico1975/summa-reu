import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCertificateDonorSummaries,
  certificateMovementToTransaction,
} from '@/lib/fiscal/certificate-summaries';
import type { Donor, Transaction } from '@/lib/data';

const donor: Donor = {
  id: 'donor-1',
  type: 'donor',
  name: 'Rocio Fiscal',
  taxId: '12345678Z',
  zipCode: '08001',
  donorType: 'individual',
  membershipType: 'recurring',
  address: 'Carrer Fiscal 1',
  email: 'rocio@example.org',
  iban: 'ES9121000418450200051332',
  notes: 'nota interna sensible',
  createdAt: '2026-01-01',
};

test('certificate summaries expose only fiscal certificate data, not ledger details', () => {
  const transactions: Transaction[] = [
    {
      id: 'tx-donation',
      date: '2025-02-01',
      description: 'Transferencia terreno sensible',
      note: 'Factura pagada sensible',
      amount: 100,
      category: 'secret',
      document: 'invoice.pdf',
      bankAccountId: 'bank-secret',
      sepaMandate: 'sepa-secret',
      contactId: 'donor-1',
      transactionType: 'donation',
    } as Transaction,
    {
      id: 'tx-return',
      date: '2025-03-01',
      description: 'Devolucion banco sensible',
      amount: -20,
      category: 'secret',
      document: null,
      contactId: 'donor-1',
      transactionType: 'return',
    },
  ];

  const [summary] = buildCertificateDonorSummaries({
    donors: [donor],
    fiscalTransactions: transactions,
  });

  assert.equal(summary.totalAmount, 80);
  assert.equal(summary.grossAmount, 100);
  assert.equal(summary.returnedAmount, 20);
  assert.equal(summary.donationCount, 1);
  assert.equal(summary.returnCount, 1);
  assert.equal('iban' in summary.donor, false);
  assert.equal('notes' in summary.donor, false);
  assert.equal('description' in summary.donations[0], false);
  assert.notEqual(summary.donations[0].id, 'tx-donation');
  assert.equal('note' in summary.donations[0], false);
  assert.equal('category' in summary.donations[0], false);
  assert.equal('document' in summary.donations[0], false);
  assert.deepEqual(Object.keys(summary.donor).sort(), [
    'address',
    'donorType',
    'email',
    'id',
    'name',
    'taxId',
    'zipCode',
  ]);
  assert.deepEqual(Object.keys(summary.donations[0]).sort(), [
    'amount',
    'date',
    'id',
    'transactionType',
  ]);
});

test('certificate movement conversion keeps generated PDFs on sanitized data', () => {
  const [summary] = buildCertificateDonorSummaries({
    donors: [donor],
    fiscalTransactions: [
      {
        id: 'tx-donation',
        date: '2025-02-01',
        description: 'not exposed',
        amount: 100,
        category: null,
        document: null,
        contactId: 'donor-1',
        transactionType: 'donation',
      },
    ],
  });

  const tx = certificateMovementToTransaction(summary.donations[0]);

  assert.equal(tx.amount, 100);
  assert.equal(tx.description, '');
  assert.equal(tx.note, null);
  assert.equal(tx.category, null);
  assert.equal(tx.document, null);
});

test('certificate summaries no compten dues vegades una devolució enllaçada (returned + return)', () => {
  const [summary] = buildCertificateDonorSummaries({
    donors: [donor],
    fiscalTransactions: [
      {
        id: 'd-normal',
        date: '2025-01-01',
        description: 'Donació inicial',
        amount: 200,
        category: null,
        document: null,
        contactId: 'donor-1',
        transactionType: 'donation',
      },
      {
        id: 'd-return',
        date: '2025-02-01',
        description: 'Donació retornada',
        amount: 100,
        category: null,
        document: null,
        contactId: 'donor-1',
        transactionType: 'donation',
        donationStatus: 'returned',
        linkedTransactionId: 'r-return',
      },
      {
        id: 'r-return',
        date: '2025-02-02',
        description: 'Devolució bancària',
        amount: -100,
        category: null,
        document: null,
        contactId: 'donor-1',
        transactionType: 'return',
        linkedTransactionId: 'd-return',
      },
    ],
  });

  assert.equal(summary.grossAmount, 200);
  assert.equal(summary.returnedAmount, 100);
  assert.equal(summary.totalAmount, 100);
  assert.equal(summary.donations.length, 1);
  assert.equal(summary.returns.length, 1);
  assert.equal(summary.returns[0].id.startsWith('cert-return-'), true);
});
