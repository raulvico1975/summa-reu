import type { Transaction } from '@/lib/data';

export type DonationSource = 'stripe';
export type DonationType = 'donation' | 'stripe_adjustment';

export interface Donation {
  id?: string;
  date: string;
  contactId?: string | null;
  amountGross?: number;
  amount?: number;
  source?: DonationSource;
  stripePaymentId?: string;
  parentTransactionId: string;
  type?: DonationType;
  archivedAt?: string | null;
  description?: string | null;
  customerEmail?: string | null;
}

export function isStripeAdjustmentDonation(donation: Donation): boolean {
  return donation.type === 'stripe_adjustment';
}

export function getDonationAmount(donation: Donation): number {
  if (typeof donation.amountGross === 'number') {
    return donation.amountGross;
  }
  return donation.amount ?? 0;
}

export function donationToTransactionLike(donation: Donation): Transaction {
  const amount = isStripeAdjustmentDonation(donation)
    ? donation.amount ?? 0
    : getDonationAmount(donation);

  return {
    id: donation.id ?? '',
    date: donation.date,
    description: donation.description ?? (isStripeAdjustmentDonation(donation) ? 'Ajust Stripe' : 'Donacio Stripe'),
    note: null,
    amount,
    category: null,
    document: null,
    contactId: donation.contactId ?? null,
    contactType: donation.contactId ? 'donor' : undefined,
    transactionType: isStripeAdjustmentDonation(donation) ? 'normal' : 'donation',
    source: donation.source,
    parentTransactionId: donation.parentTransactionId,
    stripePaymentId: donation.stripePaymentId ?? null,
    archivedAt: donation.archivedAt ?? null,
  };
}

