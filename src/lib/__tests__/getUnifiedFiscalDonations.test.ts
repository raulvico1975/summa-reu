import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AnyContact, Transaction } from '@/lib/data';
import type { Donation } from '@/lib/types/donations';
import {
  mergeUnifiedFiscalDonations,
} from '../fiscal/getUnifiedFiscalDonations';
import { buildModel182Candidates } from '../model182-aggregation';
import { calculateDonorSummary } from '../fiscal/calculateDonorSummary';
import { calculateTransactionNetAmount } from '../model182';
import { filterActiveStripeDonationsForUndo } from '../fiscal/undoProcessing';

const donorContact = {
  id: 'donor-1',
  type: 'donor',
  name: 'Donant Stripe',
  taxId: '12345678A',
  zipCode: '08001',
  donorType: 'individual',
  membershipType: 'one-time',
} as AnyContact;

function legacyStripeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-legacy-1',
    date: '2026-03-18',
    description: 'Stripe legacy',
    amount: 40,
    category: null,
    document: null,
    contactId: 'donor-1',
    contactType: 'donor',
    source: 'stripe',
    transactionType: 'donation',
    stripePaymentId: 'pay_1',
    archivedAt: null,
    ...overrides,
  };
}

function stripeDonation(overrides: Partial<Donation> = {}): Donation {
  return {
    id: 'donation-1',
    date: '2026-03-18',
    type: 'donation',
    source: 'stripe',
    contactId: 'donor-1',
    amountGross: 50,
    parentTransactionId: 'parent-1',
    stripePaymentId: 'pay_1',
    description: 'Stripe donation',
    archivedAt: null,
    ...overrides,
  };
}

function buildCertificateNet(transactions: Transaction[], donorId: string, year: number): number {
  const donorTransactions = transactions.filter(
    (tx) => tx.contactId === donorId && tx.date.startsWith(String(year))
  );

  const gross = donorTransactions.reduce((sum, tx) => {
    const netAmount = calculateTransactionNetAmount(tx);
    return netAmount > 0 ? sum + netAmount : sum;
  }, 0);
  const returned = donorTransactions.reduce((sum, tx) => {
    const netAmount = calculateTransactionNetAmount(tx);
    return netAmount < 0 ? sum + Math.abs(netAmount) : sum;
  }, 0);

  return Math.max(0, gross - returned);
}

describe('mergeUnifiedFiscalDonations', () => {
  it('fa aparèixer una Stripe donation de donations al Model 182', () => {
    const merged = mergeUnifiedFiscalDonations({
      transactions: [],
      donations: [stripeDonation()],
    });

    const candidates = buildModel182Candidates(merged, [donorContact], 2026);

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].totalAmount, 50);
    assert.equal(candidates[0].donor.taxId, donorContact.taxId);
  });

  it('fa aparèixer una Stripe donation de donations al certificat i a la fitxa del donant', () => {
    const merged = mergeUnifiedFiscalDonations({
      transactions: [],
      donations: [stripeDonation()],
    });

    assert.equal(buildCertificateNet(merged, 'donor-1', 2026), 50);

    const donorSummary = calculateDonorSummary({
      transactions: merged,
      donorId: 'donor-1',
      year: 2026,
    });
    assert.equal(donorSummary.currentYearNet, 50);
  });

  it('exclou stripe_adjustment del còmput fiscal', () => {
    const merged = mergeUnifiedFiscalDonations({
      transactions: [],
      donations: [
        stripeDonation(),
        stripeDonation({
          id: 'adj-1',
          type: 'stripe_adjustment',
          contactId: null,
          amount: -0.42,
          stripePaymentId: null,
        }),
      ],
    });

    assert.equal(merged.length, 1);
    assert.equal(merged[0].amount, 50);
  });

  it('deduplica legacy vs donations per stripePaymentId i prefereix donations', () => {
    const merged = mergeUnifiedFiscalDonations({
      transactions: [legacyStripeTx()],
      donations: [stripeDonation()],
    });

    assert.equal(merged.length, 1);
    assert.equal(merged[0].amount, 50);
    assert.equal(merged[0].id, 'donation-1');
  });
});

describe('filterActiveStripeDonationsForUndo', () => {
  it('selecciona només donations actives i les arxivades desapareixen del còmput fiscal', () => {
    const active = stripeDonation({ id: 'active-1' });
    const archived = stripeDonation({ id: 'archived-1', archivedAt: '2026-03-19T10:00:00.000Z' });

    const activeDonations = filterActiveStripeDonationsForUndo([active, archived]);
    assert.deepEqual(activeDonations.map((donation) => donation.id), ['active-1']);

    const mergedAfterUndo = mergeUnifiedFiscalDonations({
      transactions: [],
      donations: [{ ...active, archivedAt: '2026-03-19T10:00:00.000Z' }],
    });
    assert.equal(mergedAfterUndo.length, 0);
  });
});
