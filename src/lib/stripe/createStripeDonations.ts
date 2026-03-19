import type { Donation, DonationImputationOrigin } from '@/lib/types/donations';

export const ERR_STRIPE_DUPLICATE_PAYMENT = 'ERR_STRIPE_DUPLICATE_PAYMENT';
export const ERR_STRIPE_CONTACT_REQUIRED = 'ERR_STRIPE_CONTACT_REQUIRED';

export interface StripePaymentInput {
  stripePaymentId?: string | null;
  amount: number;
  fee?: number | null;
  contactId: string | null;
  date: string;
  customerEmail?: string | null;
  description?: string | null;
  imputationOrigin: DonationImputationOrigin;
}

interface CreateStripeDonationsInput {
  parentTransactionId: string;
  payments: StripePaymentInput[];
  bankAmount: number;
  adjustmentDate: string;
  findDonationByStripePaymentId?: (stripePaymentId: string) => Promise<Donation | null>;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function createStripeDonations(input: CreateStripeDonationsInput): Promise<{
  donations: Donation[];
  adjustment: Donation | null;
}> {
  const seenStripePaymentIds = new Set<string>();
  const donations: Donation[] = [];

  let grossTotal = 0;
  let feeTotal = 0;

  for (const payment of input.payments) {
    if (!payment.contactId) {
      throw new Error(ERR_STRIPE_CONTACT_REQUIRED);
    }

    const amountGross = roundCurrency(payment.amount);
    if (!(amountGross > 0)) {
      continue;
    }

    const feeAmount = roundCurrency(payment.fee ?? 0);
    const stripePaymentId = payment.stripePaymentId?.trim() || null;
    if (stripePaymentId) {
      if (seenStripePaymentIds.has(stripePaymentId)) {
        throw new Error(ERR_STRIPE_DUPLICATE_PAYMENT);
      }
      seenStripePaymentIds.add(stripePaymentId);

      const existingDonation = await input.findDonationByStripePaymentId?.(stripePaymentId);
      if (existingDonation && !existingDonation.archivedAt) {
        throw new Error(ERR_STRIPE_DUPLICATE_PAYMENT);
      }
    }

    donations.push({
      date: payment.date,
      type: 'donation',
      source: 'stripe',
      contactId: payment.contactId,
      amountGross,
      feeAmount,
      parentTransactionId: input.parentTransactionId,
      stripePaymentId,
      customerEmail: payment.customerEmail ?? null,
      description: payment.description ?? null,
      imputationOrigin: payment.imputationOrigin,
      archivedAt: null,
    });

    grossTotal += amountGross;
    feeTotal += feeAmount;
  }

  const netTotal = roundCurrency(grossTotal - feeTotal);
  const difference = roundCurrency(input.bankAmount - netTotal);
  const adjustment = Math.abs(difference) > 0.009
    ? {
        date: input.adjustmentDate,
        type: 'stripe_adjustment',
        source: 'stripe',
        contactId: null,
        amount: difference,
        parentTransactionId: input.parentTransactionId,
        description: 'Ajust Stripe',
        imputationOrigin: 'system',
        archivedAt: null,
      }
    : null;

  return {
    donations,
    adjustment,
  };
}
