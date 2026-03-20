import test from 'node:test';
import assert from 'node:assert/strict';

import type { Transaction } from '@/lib/data';
import {
  getIndividualDonationCertificateBlockMessage,
  getIndividualDonationCertificateBlockReason,
} from '@/lib/fiscal/individual-donation-certificate';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx_1',
    date: '2026-03-12',
    description: 'Donacio Stripe',
    amount: 24,
    category: null,
    document: null,
    source: 'stripe',
    transactionType: 'donation',
    archivedAt: null,
    ...overrides,
  };
}

test('una donacio Stripe assignada i fiscalment valida permet certificat individual', () => {
  const reason = getIndividualDonationCertificateBlockReason({
    transaction: makeTransaction(),
    donorHasTaxId: true,
    donorHasEmail: true,
  });

  assert.equal(reason, null);
});

test('stripe_adjustment no es certificable com a donacio individual', () => {
  const reason = getIndividualDonationCertificateBlockReason({
    transaction: makeTransaction({
      transactionType: 'fee',
      amount: 0.42,
      description: 'Ajust Stripe',
    }),
    donorHasTaxId: true,
    donorHasEmail: true,
  });

  assert.equal(reason, 'not_donation');
  assert.equal(
    getIndividualDonationCertificateBlockMessage(reason),
    'Aquest moviment no és una donació fiscal certificable.'
  );
});

test('una donacio arxivada no es certificable', () => {
  const reason = getIndividualDonationCertificateBlockReason({
    transaction: makeTransaction({
      archivedAt: '2026-03-13T10:00:00.000Z',
    }),
    donorHasTaxId: true,
    donorHasEmail: true,
  });

  assert.equal(reason, 'archived');
  assert.equal(
    getIndividualDonationCertificateBlockMessage(reason),
    'Aquesta donació està arxivada i no és certificable.'
  );
});
