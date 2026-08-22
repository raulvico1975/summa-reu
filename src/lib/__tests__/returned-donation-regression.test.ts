import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Donor, Transaction } from '../data';
import { calculateDonorNet } from '../fiscal/calculateDonorNet';
import { calculateDonorSummary } from '../fiscal/calculateDonorSummary';
import { buildCertificateDonorSummaries } from '../fiscal/certificate-summaries';
import { calculateModel182Totals } from '../model182';

const donor: Donor = {
  id: 'donor-baruma-case',
  type: 'donor',
  name: 'Cas devolució remesa',
  taxId: '12345678Z',
  zipCode: '08001',
  donorType: 'individual',
  membershipType: 'recurring',
  createdAt: '2026-01-01',
};

function movement(input: {
  id: string;
  date: string;
  amount: number;
  donationStatus?: 'completed' | 'returned' | 'partial';
  transactionType?: 'donation' | 'return';
  linkedTransactionId?: string;
}): Transaction {
  return {
    id: input.id,
    date: input.date,
    description: input.id,
    amount: input.amount,
    category: null,
    document: null,
    contactId: donor.id,
    contactType: 'donor',
    transactionType: input.transactionType ?? 'donation',
    donationStatus: input.donationStatus,
    linkedTransactionId: input.linkedTransactionId,
  };
}

function barumaRegressionFixture(): Transaction[] {
  return [
    movement({
      id: 'jan-donation-returned',
      date: '2026-01-05',
      amount: 10,
      donationStatus: 'returned',
      linkedTransactionId: 'jan-bank-return',
    }),
    movement({
      id: 'jan-bank-return',
      date: '2026-01-05',
      amount: -10,
      transactionType: 'return',
      linkedTransactionId: 'jan-donation-returned',
    }),
    ...['02', '03', '04', '05', '06', '07'].map((month) => movement({
      id: `donation-${month}`,
      date: `2026-${month}-05`,
      amount: 10,
    })),
  ];
}

describe('returned donation fiscal regression', () => {
  it('dona 60 euros nets en el cas real: gener cancel·lat i febrer-juliol cobrats', () => {
    const transactions = barumaRegressionFixture();

    const donorNet = calculateDonorNet({ transactions, donorId: donor.id, year: 2026 });
    const donorSummary = calculateDonorSummary({ transactions, donorId: donor.id, year: 2026 });
    const [certificate] = buildCertificateDonorSummaries({
      donors: [donor],
      fiscalTransactions: transactions,
    });
    const model182 = calculateModel182Totals(transactions, [donor], 2026);

    assert.deepEqual(donorNet, {
      grossDonationsCents: 6000,
      returnsCents: 0,
      netCents: 6000,
      donationsCount: 6,
      returnsCount: 0,
    });
    assert.equal(donorSummary.currentYearNet, 60);
    assert.equal(donorSummary.returns.count, 1);
    assert.equal(donorSummary.returns.amount, 10);
    assert.equal(certificate.totalAmount, 60);
    assert.equal(certificate.donationCount, 6);
    assert.equal(certificate.returnCount, 0);
    assert.equal(model182.donorTotals[0].totalAmount, 60);
    assert.equal(model182.stats.totalAmount, 60);
  });

  it('manté el mateix net encara que els moviments arribin en ordre invers', () => {
    const transactions = barumaRegressionFixture();
    const ordered = calculateDonorNet({ transactions, donorId: donor.id, year: 2026 });
    const reversed = calculateDonorNet({
      transactions: [...transactions].reverse(),
      donorId: donor.id,
      year: 2026,
    });

    assert.deepEqual(reversed, ordered);
  });

  it('resta una devolució sense parella una sola vegada', () => {
    const result = calculateDonorNet({
      transactions: [
        movement({ id: 'donation-100', date: '2026-01-05', amount: 100 }),
        movement({ id: 'unpaired-return-30', date: '2026-02-05', amount: -30, transactionType: 'return' }),
      ],
      donorId: donor.id,
      year: 2026,
    });

    assert.equal(result.netCents, 7000);
    assert.equal(result.returnsCents, -3000);
  });

  it('calcula una devolució parcial com donació menys import retornat', () => {
    const result = calculateDonorNet({
      transactions: [
        movement({
          id: 'partial-donation-100',
          date: '2026-01-05',
          amount: 100,
          donationStatus: 'partial',
          linkedTransactionId: 'partial-return-30',
        }),
        movement({
          id: 'partial-return-30',
          date: '2026-02-05',
          amount: -30,
          transactionType: 'return',
          linkedTransactionId: 'partial-donation-100',
        }),
      ],
      donorId: donor.id,
      year: 2026,
    });

    assert.equal(result.grossDonationsCents, 10000);
    assert.equal(result.returnsCents, -3000);
    assert.equal(result.netCents, 7000);
  });
});
