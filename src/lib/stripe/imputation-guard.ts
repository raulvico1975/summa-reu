export const ERR_STRIPE_PAYOUT_CONTAINS_ACTIVE_DUPLICATES =
  'ERR_STRIPE_PAYOUT_CONTAINS_ACTIVE_DUPLICATES';

export async function assertStripePayoutHasNoActiveDuplicates<
  T extends { stripePaymentId?: string | null }
>(
  payments: T[],
  isStripePaymentIdActive: (stripePaymentId: string) => Promise<boolean>
): Promise<void> {
  const uniqueStripePaymentIds = Array.from(
    new Set(
      payments
        .map((payment) => payment.stripePaymentId?.trim() ?? '')
        .filter((stripePaymentId) => stripePaymentId.length > 0)
    )
  );

  for (const stripePaymentId of uniqueStripePaymentIds) {
    if (await isStripePaymentIdActive(stripePaymentId)) {
      throw new Error(ERR_STRIPE_PAYOUT_CONTAINS_ACTIVE_DUPLICATES);
    }
  }
}
