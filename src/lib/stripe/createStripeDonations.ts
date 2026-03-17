import type { Donation } from '@/lib/types/donations';

export const STRIPE_DUPLICATE_PAYMENT_ERROR = 'ERR_STRIPE_DUPLICATE_PAYMENT';

export interface StripeDonationPaymentInput {
  stripePaymentId: string;
  amount: number;
  fee: number;
  contactId: string | null;
  date: string;
  customerEmail?: string | null;
  description?: string | null;
}

interface CreateStripeDonationsInput {
  parentTransactionId: string;
  payments: StripeDonationPaymentInput[];
  bankAmount?: number | null;
  adjustmentDate?: string;
  findDonationByStripePaymentId: (stripePaymentId: string) => Promise<Donation | null>;
}

interface CreateStripeDonationsResult {
  donations: Donation[];
  adjustment: Donation | null;
}

export async function createStripeDonations({
  parentTransactionId,
  payments,
  bankAmount = null,
  adjustmentDate,
  findDonationByStripePaymentId,
}: CreateStripeDonationsInput): Promise<CreateStripeDonationsResult> {
  const seenStripePaymentIds = new Set<string>();
  const donations: Donation[] = [];

  for (const payment of payments) {
    const stripePaymentId = payment.stripePaymentId.trim();
    if (!stripePaymentId) {
      throw new Error('ERR_STRIPE_PAYMENT_ID_REQUIRED');
    }
    if (!payment.contactId) {
      throw new Error('ERR_STRIPE_CONTACT_REQUIRED');
    }
    if (seenStripePaymentIds.has(stripePaymentId)) {
      throw new Error(STRIPE_DUPLICATE_PAYMENT_ERROR);
    }
    seenStripePaymentIds.add(stripePaymentId);

    const exists = await findDonationByStripePaymentId(stripePaymentId);
    if (exists) {
      throw new Error(STRIPE_DUPLICATE_PAYMENT_ERROR);
    }

    donations.push({
      date: payment.date,
      contactId: payment.contactId,
      amountGross: payment.amount,
      source: 'stripe',
      stripePaymentId,
      parentTransactionId,
      type: 'donation',
      description: payment.description ?? `Donacio Stripe - ${payment.customerEmail ?? stripePaymentId}`,
      customerEmail: payment.customerEmail ?? null,
    });
  }

  const expectedNet = payments.reduce((sum, payment) => sum + (payment.amount - payment.fee), 0);
  const diff = bankAmount == null ? 0 : Number((bankAmount - expectedNet).toFixed(2));
  const adjustment =
    bankAmount != null && Math.abs(diff) > 0
      ? {
          date: adjustmentDate ?? donations[0]?.date ?? new Date().toISOString().slice(0, 10),
          amount: diff,
          source: 'stripe' as const,
          parentTransactionId,
          type: 'stripe_adjustment' as const,
          description: 'Ajust Stripe',
        }
      : null;

  return { donations, adjustment };
}

