import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDonorSummaryDatasetFingerprint,
  calculateDonorSummary,
  createEmptyDonorSummary,
  isDrawerDonationCandidate,
  isDrawerReturnCandidate,
  type DonorSummaryTransaction,
} from '../fiscal/calculateDonorSummary';

function tx(overrides: Partial<DonorSummaryTransaction> & Pick<DonorSummaryTransaction, 'id' | 'amount' | 'date'>): DonorSummaryTransaction {
  return {
    id: overrides.id,
    amount: overrides.amount,
    date: overrides.date,
    transactionType: overrides.transactionType ?? (overrides.amount > 0 ? 'donation' : undefined),
    donationStatus: overrides.donationStatus,
    linkedTransactionId: overrides.linkedTransactionId,
    archivedAt: overrides.archivedAt,
    isSplit: overrides.isSplit,
    isRemittance: overrides.isRemittance,
    note: overrides.note,
    description: overrides.description,
    contactId: overrides.contactId ?? 'donor-1',
  };
}

describe('calculateDonorSummary', () => {
  it('manté la semàntica actual de la fitxa i centralitza el net fiscal', () => {
    const transactions: DonorSummaryTransaction[] = [
      tx({ id: 'd1', amount: 100, date: '2026-01-10' }),
      tx({ id: 'd2', amount: 50, date: '2026-02-10', isSplit: true }),
      tx({ id: 'd3', amount: 80, date: '2025-03-10' }),
      tx({ id: 'r1', amount: -20, date: '2026-04-10', transactionType: 'return' }),
      tx({ id: 'r2', amount: 10, date: '2026-05-10', transactionType: 'donation', donationStatus: 'returned' }),
      tx({ id: 'rem1', amount: 40, date: '2026-06-10', isRemittance: true }),
      tx({ id: 'a1', amount: 70, date: '2026-08-01', archivedAt: '2026-08-02T00:00:00.000Z' }),
    ];

    const result = calculateDonorSummary({
      transactions,
      donorId: 'donor-1',
      year: 2026,
    });

    // Bloc històric/any: semàntica legacy del drawer
    assert.equal(result.currentYear, 150); // d1 + r2 + rem1
    assert.equal(result.currentYearCount, 3);
    assert.equal(result.previousYear, 80);
    assert.equal(result.previousYearCount, 1);

    // Bloc devolucions del drawer
    assert.equal(result.returns.count, 2);
    assert.equal(result.returns.amount, 30);
    assert.deepEqual(result.returns.items.map(item => item.id), ['r2', 'r1']);

    // Net fiscal: mateix criteri que calculateDonorNet/model182
    assert.equal(result.currentYearGross, 100);
    assert.equal(result.currentYearReturned, 30);
    assert.equal(result.currentYearNet, 70);

    // Traçabilitat d'IDs inclosos al còmput fiscal net
    assert.deepEqual(result.includedDonationIds, ['d1']);
    assert.deepEqual(result.includedReturnIds, ['r1', 'r2']);
    assert.equal(result.validDonationsCount, 1);
    assert.equal(result.currentYearDonationCandidatesCount, 3);

    // Traçabilitat d'exclosos (legacy donacions drawer)
    assert.deepEqual(result.excludedIdsByReason.splitParent, ['d2']);
    assert.deepEqual(result.excludedIdsByReason.archived, ['a1']);
    assert.deepEqual(result.excludedIdsByReason.nonPositiveAmount, ['r1']);

    assert.equal(result.scopeDonorId, 'donor-1');
    assert.equal(result.scopeYear, 2026);
  });

  it('usa scope de donant només per al net/IDs inclosos', () => {
    const transactions: DonorSummaryTransaction[] = [
      tx({ id: 'd1', amount: 100, date: '2026-01-10', contactId: 'donor-1' }),
      tx({ id: 'd2-other', amount: 200, date: '2026-01-11', contactId: 'donor-2' }),
    ];

    const result = calculateDonorSummary({
      transactions,
      donorId: 'donor-1',
      year: 2026,
    });

    // Bloc legacy (històric/any) consumeix el dataset que arriba al drawer
    assert.equal(result.currentYear, 300);
    assert.equal(result.currentYearCount, 2);
    assert.equal(result.currentYearDonationCandidatesCount, 2);

    // Bloc fiscal net i traçabilitat: sí va scoped per donorId
    assert.equal(result.currentYearGross, 100);
    assert.equal(result.currentYearNet, 100);
    assert.deepEqual(result.includedDonationIds, ['d1']);
  });

  it('genera fingerprint estable amb ids ordenats + any + donant', () => {
    const transactions: DonorSummaryTransaction[] = [
      tx({ id: 'b', amount: 20, date: '2026-01-01' }),
      tx({ id: 'a', amount: 10, date: '2026-01-02' }),
    ];

    const fingerprint = buildDonorSummaryDatasetFingerprint({
      transactions,
      donorId: 'donor-1',
      year: 2026,
    });

    assert.equal(fingerprint, 'donor-1|2026|a,b');
  });

  it('deduplica devolució enllaçada (return negatiu + donation returned) al bloc de devolucions del drawer', () => {
    const transactions: DonorSummaryTransaction[] = [
      tx({
        id: 'd-link',
        amount: 10,
        date: '2026-01-09',
        transactionType: 'donation',
        donationStatus: 'returned',
        linkedTransactionId: 'r-link',
      }),
      tx({
        id: 'r-link',
        amount: -10,
        date: '2026-01-09',
        transactionType: 'return',
        linkedTransactionId: 'd-link',
      }),
      tx({
        id: 'd-unlinked-returned',
        amount: 5,
        date: '2026-01-10',
        transactionType: 'donation',
        donationStatus: 'returned',
      }),
    ];

    const result = calculateDonorSummary({
      transactions,
      donorId: 'donor-1',
      year: 2026,
    });

    assert.equal(result.returns.count, 2);
    assert.equal(result.returns.amount, 15);
    assert.deepEqual(result.effectiveReturnIds, ['r-link', 'd-unlinked-returned']);
    assert.deepEqual(result.returns.items.map(item => item.id), ['d-unlinked-returned', 'r-link']);
  });

  it('usa la mateixa lògica canònica per a imports fiscals i evita el doble recompte returned+return', () => {
    const transactions: DonorSummaryTransaction[] = [
      tx({
        id: 'd-link',
        amount: 200,
        date: '2026-01-09',
        transactionType: 'donation',
        contactId: 'donor-1',
      }),
      tx({
        id: 'd-return',
        amount: 100,
        date: '2026-01-10',
        transactionType: 'donation',
        donationStatus: 'returned',
        linkedTransactionId: 'r-return',
        contactId: 'donor-1',
      }),
      tx({
        id: 'r-return',
        amount: -100,
        date: '2026-01-11',
        transactionType: 'return',
        linkedTransactionId: 'd-return',
        contactId: 'donor-1',
      }),
    ];

    const result = calculateDonorSummary({
      transactions,
      donorId: 'donor-1',
      year: 2026,
    });

    assert.equal(result.currentYearGross, 200);
    assert.equal(result.currentYearReturned, 100);
    assert.equal(result.currentYearNet, 100);
    assert.deepEqual(result.includedDonationIds, ['d-link']);
    assert.deepEqual(result.includedReturnIds, ['r-return']);
  });

  it('també evita el doble recompte en cas legacy sense linkedTransactionId', () => {
    const transactions: DonorSummaryTransaction[] = [
      tx({
        id: 'd-link',
        amount: 200,
        date: '2026-01-09',
        transactionType: 'donation',
        contactId: 'donor-1',
      }),
      tx({
        id: 'd-return',
        amount: 100,
        date: '2026-01-10',
        transactionType: 'donation',
        donationStatus: 'returned',
        contactId: 'donor-1',
      }),
      tx({
        id: 'r-return',
        amount: -100,
        date: '2026-01-10',
        transactionType: 'return',
        contactId: 'donor-1',
      }),
    ];

    const result = calculateDonorSummary({
      transactions,
      donorId: 'donor-1',
      year: 2026,
    });

    assert.equal(result.currentYearGross, 200);
    assert.equal(result.currentYearReturned, 100);
    assert.equal(result.currentYearNet, 100);
    assert.deepEqual(result.includedDonationIds, ['d-link']);
    assert.deepEqual(result.includedReturnIds, ['r-return']);
  });

  it('manté fingerprint estable sense id encara que canviï l’ordre del dataset', () => {
    const txA = tx({
      id: undefined,
      amount: 10,
      date: '2026-01-01',
      transactionType: 'donation',
      contactId: 'donor-1',
    });
    const txB = tx({
      id: undefined,
      amount: -5,
      date: '2026-01-02',
      transactionType: 'return',
      contactId: 'donor-1',
    });

    const fingerprintOrdered = buildDonorSummaryDatasetFingerprint({
      transactions: [txA, txB],
      donorId: 'donor-1',
      year: 2026,
    });

    const fingerprintReversed = buildDonorSummaryDatasetFingerprint({
      transactions: [txB, txA],
      donorId: 'donor-1',
      year: 2026,
    });

    assert.equal(fingerprintOrdered, fingerprintReversed);
  });

  it('retorna zeros i fingerprint coherent quan no hi ha transaccions', () => {
    const result = createEmptyDonorSummary({
      transactions: [],
      donorId: 'donor-1',
      year: 2026,
    });

    assert.equal(result.currentYearNet, 0);
    assert.equal(result.currentYearCount, 0);
    assert.equal(result.currentYearDonationCandidatesCount, 0);
    assert.deepEqual(result.includedDonationIds, []);
    assert.deepEqual(result.includedReturnIds, []);
    assert.deepEqual(result.excludedIdsByReason.nonPositiveAmount, []);
    assert.deepEqual(result.excludedIdsByReason.archived, []);
    assert.deepEqual(result.excludedIdsByReason.splitParent, []);
    assert.deepEqual(result.excludedIdsByReason.notFiscalDonationCandidate, []);
    assert.equal(result.datasetFingerprint, 'donor-1|2026|');
  });
});

describe('drawer fiscal predicates', () => {
  it('isDrawerDonationCandidate replica el criteri del drawer', () => {
    assert.equal(isDrawerDonationCandidate({ amount: 10, transactionType: 'donation' }), true);
    assert.equal(isDrawerDonationCandidate({ amount: 10, transactionType: 'donation', isSplit: true }), false);
    assert.equal(isDrawerDonationCandidate({ amount: 10, transactionType: 'donation', archivedAt: '2026-01-01' }), false);
    assert.equal(isDrawerDonationCandidate({ amount: 10, transactionType: 'return' }), false);
  });

  it('isDrawerReturnCandidate replica el criteri del drawer', () => {
    assert.equal(isDrawerReturnCandidate({ amount: -10, transactionType: 'return' }), true);
    assert.equal(isDrawerReturnCandidate({ amount: 10, donationStatus: 'returned', transactionType: 'donation' }), true);
    assert.equal(isDrawerReturnCandidate({ amount: 10, transactionType: 'donation', donationStatus: undefined }), false);
  });
});
