import type { StripePayoutGroup, StripeRow } from '@/lib/stripe/types';

export interface StripePayoutPayment {
  stripePaymentId: string;
  amountGross: number;
  fee: number;
  net: number;
  currency: string;
  customerEmail: string | null;
  description: string | null;
  created: number;
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif',
  'clp',
  'djf',
  'gnf',
  'jpy',
  'kmf',
  'krw',
  'mga',
  'pyg',
  'rwf',
  'ugx',
  'vnd',
  'vuv',
  'xaf',
  'xof',
  'xpf',
]);

const UNSUPPORTED_THREE_DECIMAL_CURRENCIES = new Set([
  'bhd',
  'jod',
  'kwd',
  'omr',
  'tnd',
]);

export class UnsupportedStripeCurrencyError extends Error {
  constructor(readonly currency: string) {
    super(`STRIPE_UNSUPPORTED_CURRENCY: ${currency}`);
    this.name = 'UnsupportedStripeCurrencyError';
  }
}

export function stripeMinorAmountToMajor(amount: number, currency: string): number {
  const normalizedCurrency = currency.trim().toLowerCase();

  if (ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency)) {
    return amount;
  }

  if (UNSUPPORTED_THREE_DECIMAL_CURRENCIES.has(normalizedCurrency)) {
    throw new UnsupportedStripeCurrencyError(normalizedCurrency);
  }

  return Number((amount / 100).toFixed(2));
}

export function stripeUnixSecondsToDateOnly(created: number): string {
  if (!Number.isFinite(created) || created <= 0) {
    return '';
  }

  return new Date(created * 1000).toISOString().slice(0, 10);
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

export function buildStripePayoutGroupFromPayments(
  payoutId: string,
  payments: StripePayoutPayment[]
): StripePayoutGroup {
  const rows: StripeRow[] = payments.map((payment) => ({
    id: payment.stripePaymentId,
    createdDate: stripeUnixSecondsToDateOnly(payment.created),
    amount: payment.amountGross,
    fee: payment.fee,
    customerEmail: payment.customerEmail ?? '',
    status: 'succeeded',
    transfer: payoutId,
    description: payment.description,
  }));

  const gross = roundCurrency(rows.reduce((sum, row) => sum + row.amount, 0));
  const fees = roundCurrency(rows.reduce((sum, row) => sum + row.fee, 0));

  return {
    transferId: payoutId,
    rows,
    gross,
    fees,
    net: roundCurrency(gross - fees),
  };
}
