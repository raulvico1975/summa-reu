import type { Firestore } from 'firebase-admin/firestore';
import {
  stripeMinorAmountToMajor,
  type StripePayoutPayment,
} from '@/lib/stripe/payout-sync';

const STRIPE_API_BASE_URL = 'https://api.stripe.com/v1';
const STRIPE_PAGE_LIMIT = 100;
const STRIPE_REQUEST_TIMEOUT_MS = 8_000;
const STRIPE_MAX_PAGE_LOOPS = 25;

interface StripeBalanceTransaction {
  id: string;
  type: string;
  fee: number;
  net: number;
  currency?: string | null;
  source?: StripeCharge | string | null;
}

interface StripeCharge {
  object: 'charge';
  id: string;
  amount: number;
  currency: string;
  created: number;
  description?: string | null;
  billing_details?: {
    email?: string | null;
  } | null;
  receipt_email?: string | null;
}

interface StripeBalanceTransactionListResponse {
  object: 'list';
  data: StripeBalanceTransaction[];
  has_more: boolean;
}

interface StripeErrorResponse {
  error?: {
    code?: string;
    message?: string;
    type?: string;
  };
}

type StripeFetch = typeof fetch;

export class StripeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
    this.name = 'StripeApiError';
  }
}

function isStripeCharge(source: StripeBalanceTransaction['source']): source is StripeCharge {
  return Boolean(
    source &&
      typeof source === 'object' &&
      (source as { object?: string }).object === 'charge' &&
      typeof (source as { id?: unknown }).id === 'string'
  );
}

async function parseStripeError(response: Response): Promise<StripeApiError> {
  let payload: StripeErrorResponse | null = null;

  try {
    payload = (await response.json()) as StripeErrorResponse;
  } catch {
    payload = null;
  }

  const message = payload?.error?.message?.trim() || `Stripe error ${response.status}`;
  const code = payload?.error?.code?.trim() || payload?.error?.type?.trim() || 'STRIPE_REQUEST_FAILED';

  return new StripeApiError(message, response.status, code);
}

async function fetchStripeBalanceTransactionsPage(input: {
  secretKey: string;
  payoutId: string;
  startingAfter?: string | null;
  fetchImpl?: StripeFetch;
  timeoutMs?: number;
}): Promise<StripeBalanceTransactionListResponse> {
  const fetchFn = input.fetchImpl ?? fetch;
  const searchParams = new URLSearchParams({
    payout: input.payoutId,
    limit: String(STRIPE_PAGE_LIMIT),
  });
  searchParams.append('expand[]', 'data.source');
  if (input.startingAfter) {
    searchParams.set('starting_after', input.startingAfter);
  }

  const response = await fetchFn(`${STRIPE_API_BASE_URL}/balance_transactions?${searchParams.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
    },
    signal: AbortSignal.timeout(input.timeoutMs ?? STRIPE_REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw await parseStripeError(response);
  }

  return response.json() as Promise<StripeBalanceTransactionListResponse>;
}

function mapBalanceTransactionToPayment(
  balanceTransaction: StripeBalanceTransaction
): StripePayoutPayment | null {
  if (balanceTransaction.type !== 'charge' || !isStripeCharge(balanceTransaction.source)) {
    return null;
  }

  const charge = balanceTransaction.source;
  const currency = (charge.currency || balanceTransaction.currency || '').trim().toLowerCase();
  if (!currency) {
    return null;
  }

  return {
    stripePaymentId: charge.id,
    amountGross: stripeMinorAmountToMajor(charge.amount, currency),
    fee: stripeMinorAmountToMajor(balanceTransaction.fee, currency),
    net: stripeMinorAmountToMajor(balanceTransaction.net, currency),
    currency,
    customerEmail: charge.billing_details?.email?.trim() || charge.receipt_email?.trim() || null,
    description: charge.description?.trim() || null,
    created: charge.created,
  };
}

export async function fetchStripePayoutPayments(input: {
  secretKey: string;
  payoutId: string;
  fetchImpl?: StripeFetch;
  timeoutMs?: number;
}): Promise<StripePayoutPayment[]> {
  const payments: StripePayoutPayment[] = [];
  let startingAfter: string | null = null;

  for (let page = 0; page < STRIPE_MAX_PAGE_LOOPS; page += 1) {
    const pageResponse = await fetchStripeBalanceTransactionsPage({
      secretKey: input.secretKey,
      payoutId: input.payoutId,
      startingAfter,
      fetchImpl: input.fetchImpl,
      timeoutMs: input.timeoutMs,
    });

    for (const balanceTransaction of pageResponse.data) {
      const payment = mapBalanceTransactionToPayment(balanceTransaction);
      if (payment) {
        payments.push(payment);
      }
    }

    if (!pageResponse.has_more) {
      return payments;
    }

    startingAfter = pageResponse.data.at(-1)?.id ?? null;
    if (!startingAfter) {
      return payments;
    }
  }

  throw new StripeApiError(
    'Stripe ha retornat massa pàgines per aquest payout. Redueix el volum o revisa el compte.',
    422,
    'STRIPE_PAGINATION_LIMIT'
  );
}

export async function readStripeSecretKeyForOrganization(
  db: Firestore,
  orgId: string
): Promise<string | null> {
  const integrationRef = db.doc(`organizations/${orgId}/integrations/stripe`);
  const integrationSnap = await integrationRef.get();
  const integrationSecret = integrationSnap.get('secretKey');

  if (typeof integrationSecret === 'string' && integrationSecret.trim()) {
    return integrationSecret.trim();
  }

  const organizationSnap = await db.doc(`organizations/${orgId}`).get();
  const legacySecret = organizationSnap.get('stripeSecretKey');

  if (typeof legacySecret === 'string' && legacySecret.trim()) {
    return legacySecret.trim();
  }

  return null;
}
