#!/usr/bin/env node
import {
  FISCAL_ORACLE_DEMO_IDS,
  FISCAL_ORACLE_EXPECTED,
  calculateFiscalOracleMetrics,
  createFiscalOracleFixtureTransactions,
  diffFiscalOracle,
} from '@/lib/fiscal/fiscal-oracle';
import { calculateDonorNet } from '@/lib/fiscal/calculateDonorNet';
import { buildCertificateDonorSummaries } from '@/lib/fiscal/certificate-summaries';
import { calculateModel182Totals } from '@/lib/model182';
import type { Donor, Transaction } from '@/lib/data';

type Stage = 'predeploy' | 'postdeploy' | 'ci';

function parseStage(argv: string[]): Stage {
  const found = argv.find((arg) => arg.startsWith('--stage='));
  const stageValue = found?.split('=')[1];
  if (stageValue === 'predeploy' || stageValue === 'postdeploy' || stageValue === 'ci') {
    return stageValue;
  }
  return 'ci';
}

function run(): number {
  const stage = parseStage(process.argv.slice(2));
  const year = new Date().getFullYear();

  const fixtureTxs = createFiscalOracleFixtureTransactions({
    year,
    donorId: FISCAL_ORACLE_DEMO_IDS.donorId,
    donationCategoryId: 'oracle-category-donations',
    membershipFeeCategoryId: 'oracle-category-member-fees',
  });

  const actual = calculateFiscalOracleMetrics(fixtureTxs, year, FISCAL_ORACLE_DEMO_IDS.donorId);
  const diffs = diffFiscalOracle(actual, FISCAL_ORACLE_EXPECTED);

  const returnedPairDonor: Donor = {
    id: 'oracle-returned-pair-donor',
    type: 'donor',
    name: 'Oracle returned pair',
    taxId: '12345678Z',
    zipCode: '08001',
    donorType: 'individual',
    membershipType: 'recurring',
    createdAt: `${year}-01-01`,
  };
  const returnedPairTransactions: Transaction[] = [
    {
      id: 'oracle-returned-donation',
      date: `${year}-01-05`,
      description: 'Returned donation',
      amount: 10,
      category: null,
      document: null,
      contactId: returnedPairDonor.id,
      transactionType: 'donation',
      donationStatus: 'returned',
      linkedTransactionId: 'oracle-bank-return',
    },
    {
      id: 'oracle-bank-return',
      date: `${year}-01-05`,
      description: 'Bank return',
      amount: -10,
      category: null,
      document: null,
      contactId: returnedPairDonor.id,
      transactionType: 'return',
      linkedTransactionId: 'oracle-returned-donation',
    },
    ...['02', '03', '04', '05', '06', '07'].map((month): Transaction => ({
      id: `oracle-donation-${month}`,
      date: `${year}-${month}-05`,
      description: `Donation ${month}`,
      amount: 10,
      category: null,
      document: null,
      contactId: returnedPairDonor.id,
      transactionType: 'donation',
    })),
  ];
  const returnedPairNet = calculateDonorNet({
    transactions: returnedPairTransactions,
    donorId: returnedPairDonor.id,
    year,
  }).netCents / 100;
  const returnedPairCertificate = buildCertificateDonorSummaries({
    donors: [returnedPairDonor],
    fiscalTransactions: returnedPairTransactions,
  })[0]?.totalAmount ?? 0;
  const returnedPairModel182 = calculateModel182Totals(
    returnedPairTransactions,
    [returnedPairDonor],
    year
  ).stats.totalAmount;

  if (returnedPairNet !== 60) {
    diffs.push(`returnedPairNet: expected=60 actual=${returnedPairNet}`);
  }
  if (returnedPairCertificate !== 60) {
    diffs.push(`returnedPairCertificate: expected=60 actual=${returnedPairCertificate}`);
  }
  if (returnedPairModel182 !== 60) {
    diffs.push(`returnedPairModel182: expected=60 actual=${returnedPairModel182}`);
  }

  if (diffs.length > 0) {
    console.error(`[fiscal-oracle] FISCAL_ORACLE_FAIL (${stage})`);
    for (const diff of diffs) {
      console.error(`[fiscal-oracle]   ${diff}`);
    }
    return 1;
  }

  console.log(`[fiscal-oracle] OK (${stage})`);
  console.log(`[fiscal-oracle] donorNet=${actual.donorNet} total182=${actual.total182} certificateNet=${actual.certificateNet} pendingExcluded=${actual.pendingExcludedCount}`);
  console.log(`[fiscal-oracle] returnedPairNet=${returnedPairNet} returnedPairCertificate=${returnedPairCertificate} returnedPairModel182=${returnedPairModel182}`);
  return 0;
}

process.exit(run());
