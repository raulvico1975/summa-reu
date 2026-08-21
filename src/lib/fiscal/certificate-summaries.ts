import type { Donor, Transaction } from '@/lib/data';
import { buildCanonicalFiscalContributions } from '@/lib/fiscal/canonical-fiscal-contributions';

export interface CertificateDonor {
  id: string;
  name: string;
  taxId: string;
  zipCode: string;
  city?: string;
  province?: string;
  donorType: 'individual' | 'company';
  address?: string;
  email?: string;
}

export interface CertificateFiscalMovement {
  id: string;
  date: string;
  amount: number;
  transactionType: 'donation' | 'return';
  donationStatus?: 'completed' | 'returned' | 'partial';
}

export interface CertificateDonorSummary {
  donor: CertificateDonor;
  donations: CertificateFiscalMovement[];
  returns: CertificateFiscalMovement[];
  totalAmount: number;
  grossAmount: number;
  returnedAmount: number;
  donationCount: number;
  returnCount: number;
  hasEmail: boolean;
}

function toCertificateDonor(donor: Donor): CertificateDonor {
  const result: CertificateDonor = {
    id: donor.id,
    name: donor.name,
    taxId: donor.taxId,
    zipCode: donor.zipCode,
    donorType: donor.donorType,
  };

  if (donor.city) result.city = donor.city;
  if (donor.province) result.province = donor.province;
  if (donor.address) result.address = donor.address;
  if (donor.email) result.email = donor.email;

  return result;
}

function toCertificateFiscalMovement(
  tx: Transaction,
  index: number,
  amount: number
): CertificateFiscalMovement {
  const transactionType: 'donation' | 'return' = amount >= 0 ? 'donation' : 'return';
  const result: CertificateFiscalMovement = {
    id: `cert-${transactionType}-${tx.date}-${index}`,
    date: tx.date,
    amount,
    transactionType,
  };

  if (tx.donationStatus) result.donationStatus = tx.donationStatus;

  return result;
}

export function buildCertificateDonorSummaries(input: {
  donors: Donor[];
  fiscalTransactions: Transaction[];
}): CertificateDonorSummary[] {
  const summaries: CertificateDonorSummary[] = [];

  for (const donor of input.donors) {
    const donorTransactions = input.fiscalTransactions.filter(tx => tx.contactId === donor.id);
    const canonicalContributions = buildCanonicalFiscalContributions(donorTransactions).contributions;
    const donorDonations = canonicalContributions.filter((contribution) => contribution.canonicalAmount > 0);
    const donorReturns = canonicalContributions.filter((contribution) => contribution.canonicalAmount < 0);

    const grossAmount = donorDonations.reduce((sum, contribution) => {
      return sum + contribution.canonicalAmount;
    }, 0);
    const returnedAmount = donorReturns.reduce((sum, contribution) => {
      return sum + Math.abs(contribution.canonicalAmount);
    }, 0);
    const netAmount = Math.max(0, grossAmount - returnedAmount);

    if (netAmount <= 0) continue;

    summaries.push({
      donor: toCertificateDonor(donor),
      donations: donorDonations
        .map((contribution) => toCertificateFiscalMovement(
          contribution.tx,
          contribution.sourceIndex,
          contribution.canonicalAmount
        ))
        .sort((left, right) => left.date.localeCompare(right.date)),
      returns: donorReturns
        .map((contribution) => toCertificateFiscalMovement(
          contribution.tx,
          contribution.sourceIndex,
          contribution.canonicalAmount
        ))
        .sort((left, right) => left.date.localeCompare(right.date)),
      totalAmount: netAmount,
      grossAmount,
      returnedAmount,
      donationCount: donorDonations.length,
      returnCount: donorReturns.length,
      hasEmail: Boolean(donor.email),
    });
  }

  return summaries.sort((left, right) => right.totalAmount - left.totalAmount);
}

export function certificateMovementToTransaction(movement: CertificateFiscalMovement): Transaction {
  return {
    id: movement.id,
    date: movement.date,
    description: '',
    note: null,
    amount: movement.amount,
    category: null,
    document: null,
    transactionType: movement.transactionType,
    donationStatus: movement.donationStatus,
  };
}
