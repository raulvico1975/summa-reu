import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  FISCAL_ORACLE_DEMO_IDS,
  FISCAL_ORACLE_EXPECTED,
  calculateFiscalOracleMetrics,
  createFiscalOracleFixtureTransactions,
  resolveEffectiveFiscalKind,
  type FiscalOracleTransaction,
} from '../fiscal/fiscal-oracle';
import { isFiscalDonationCandidate } from '../fiscal/is-fiscal-donation-candidate';

describe('fiscal oracle fixture', () => {
  it('matches expected donor net, model 182 total, certificate net and pending exclusions', () => {
    const year = 2026;
    const txs = createFiscalOracleFixtureTransactions({
      year,
      donorId: FISCAL_ORACLE_DEMO_IDS.donorId,
      donationCategoryId: 'cat-don',
      membershipFeeCategoryId: 'cat-fee',
    });

    const metrics = calculateFiscalOracleMetrics(txs, year, FISCAL_ORACLE_DEMO_IDS.donorId);

    assert.deepStrictEqual(metrics, FISCAL_ORACLE_EXPECTED);
  });

  it('uses the same strict donation predicate as model 182/certificates', () => {
    const remittanceTx: FiscalOracleTransaction = {
      id: 'tx-remittance',
      date: '2026-01-01',
      amount: 10,
      contactId: 'd-1',
      contactType: 'donor',
      source: 'remittance',
      transactionType: 'normal',
    };

    const stripeLegacyTx: FiscalOracleTransaction = {
      id: 'tx-stripe',
      date: '2026-01-01',
      amount: 10,
      contactId: 'd-1',
      contactType: 'donor',
      source: 'stripe',
      transactionType: 'donation',
    };

    assert.strictEqual(isFiscalDonationCandidate(remittanceTx), false);
    assert.strictEqual(resolveEffectiveFiscalKind(remittanceTx), 'pending_review');
    assert.strictEqual(isFiscalDonationCandidate(stripeLegacyTx), true);
    assert.strictEqual(resolveEffectiveFiscalKind(stripeLegacyTx), 'donation');
  });

  it('return without donor contact does not reduce donor net', () => {
    const year = 2026;
    const txs: FiscalOracleTransaction[] = [
      {
        id: 'tx-donation',
        date: '2026-01-01',
        amount: 100,
        contactId: 'd-1',
        contactType: 'donor',
        transactionType: 'normal',
        fiscalKind: 'donation',
      },
      {
        id: 'tx-return-orphan',
        date: '2026-01-05',
        amount: -20,
        transactionType: 'return',
      },
    ];

    const metrics = calculateFiscalOracleMetrics(txs, year, 'd-1');
    assert.strictEqual(metrics.donorNet, 100);
    assert.strictEqual(metrics.total182, 100);
  });
});
