export type DonationType = 'donation' | 'stripe_adjustment';
export type DonationImputationOrigin = 'csv' | 'manual' | 'system';

export interface Donation {
  id?: string;
  date: string;
  type: DonationType | string;
  source?: 'stripe' | string | null;
  contactId?: string | null;
  amountGross?: number | null;
  amount?: number | null;
  feeAmount?: number | null;
  parentTransactionId?: string | null;
  stripePaymentId?: string | null;
  stripeTransferId?: string | null;
  customerEmail?: string | null;
  description?: string | null;
  imputationOrigin?: DonationImputationOrigin | string | null;
  archivedAt?: string | null;
  archivedByUid?: string | null;
  archivedReason?: string | null;
  archivedFromAction?: string | null;
}
