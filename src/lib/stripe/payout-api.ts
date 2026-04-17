import {
  stripeMinorAmountToMajor,
  type StripePayoutPayment,
} from '@/lib/stripe/payout-sync';

const STRIPE_API_BASE_URL = 'https://api.stripe.com/v1';
const STRIPE_PAYOUT_LIST_LIMIT = 10;
const STRIPE_PAGE_LIMIT = 100;
const STRIPE_REQUEST_TIMEOUT_MS = 8_000;
const STRIPE_MAX_PAGE_LOOPS = 25;

interface StripeBalanceTransaction {
  id: string;
  type: string;
  fee: number;
  net: number;
  currency?: string | null;
  reporting_category?: string | null;
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

interface StripePayout {
  id: string;
  amount: number;
  currency?: string | null;
  arrival_date?: number | null;
  created: number;
  status?: string | null;
}

interface StripePayoutListResponse {
  object: 'list';
  data: StripePayout[];
  has_more: boolean;
}

type StripeFetch = typeof fetch;

export interface StripeRecentPayout {
  id: string;
  amount: number;
  currency: string;
  arrivalDate: number;
  created: number;
  status: 'paid';
}

export interface StripePayoutDetails {
  id: string;
  amount: number;
  currency: string;
  arrivalDate: number;
  created: number;
  status: string;
}

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

export function getStripeSecretKeyFromEnv(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  return secretKey ? secretKey : null;
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

async function stripeGet<T>(input: {
  path: string;
  secretKey: string;
  searchParams?: URLSearchParams;
  fetchImpl?: StripeFetch;
  timeoutMs?: number;
}): Promise<T> {
  const fetchFn = input.fetchImpl ?? fetch;
  const search = input.searchParams?.toString();
  const url = search
    ? `${STRIPE_API_BASE_URL}${input.path}?${search}`
    : `${STRIPE_API_BASE_URL}${input.path}`;

  const response = await fetchFn(url, {
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

  return response.json() as Promise<T>;
}

function normalizeStripePayout(payout: StripePayout): StripePayoutDetails | null {
  const currency = payout.currency?.trim().toLowerCase();
  const status = payout.status?.trim().toLowerCase();

  if (!currency || !status) {
    return null;
  }

  return {
    id: payout.id,
    amount: stripeMinorAmountToMajor(payout.amount, currency),
    currency,
    arrivalDate: payout.arrival_date ?? payout.created,
    created: payout.created,
    status,
  };
}

function mapBalanceTransactionToPayment(
  balanceTransaction: StripeBalanceTransaction
): StripePayoutPayment | null {
  const type = balanceTransaction.type.trim().toLowerCase();
  const reportingCategory = balanceTransaction.reporting_category?.trim().toLowerCase() ?? null;

  const isChargeLikeBalanceTransaction =
    type === 'charge' ||
    type === 'payment' ||
    reportingCategory === 'charge';

  if (!isChargeLikeBalanceTransaction || !isStripeCharge(balanceTransaction.source)) {
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

export function assertStripePayoutPaid(payout: StripePayoutDetails): void {
  if (payout.status === 'paid') {
    return;
  }

  throw new StripeApiError(
    'Aquest payout de Stripe encara no està en estat paid.',
    409,
    'STRIPE_PAYOUT_NOT_PAID'
  );
}

export async function fetchStripePayout(input: {
  secretKey: string;
  payoutId: string;
  fetchImpl?: StripeFetch;
  timeoutMs?: number;
}): Promise<StripePayoutDetails> {
  const payout = await stripeGet<StripePayout>({
    path: `/payouts/${encodeURIComponent(input.payoutId)}`,
    secretKey: input.secretKey,
    fetchImpl: input.fetchImpl,
    timeoutMs: input.timeoutMs,
  });

  const normalized = normalizeStripePayout(payout);
  if (!normalized) {
    throw new StripeApiError(
      'Stripe ha retornat un payout invàlid o incomplet.',
      502,
      'STRIPE_INVALID_PAYOUT'
    );
  }

  return normalized;
}

export async function listRecentPaidStripePayouts(input: {
  secretKey: string;
  fetchImpl?: StripeFetch;
  timeoutMs?: number;
}): Promise<StripeRecentPayout[]> {
  const searchParams = new URLSearchParams({
    limit: String(STRIPE_PAYOUT_LIST_LIMIT),
  });

  const response = await stripeGet<StripePayoutListResponse>({
    path: '/payouts',
    secretKey: input.secretKey,
    searchParams,
    fetchImpl: input.fetchImpl,
    timeoutMs: input.timeoutMs,
  });

  return response.data
    .map(normalizeStripePayout)
    .filter((payout): payout is StripePayoutDetails => Boolean(payout))
    .filter((payout) => payout.status === 'paid')
    .map((payout) => ({
      ...payout,
      status: 'paid' as const,
    }));
}

async function fetchStripeBalanceTransactionsPage(input: {
  secretKey: string;
  payoutId: string;
  startingAfter?: string | null;
  fetchImpl?: StripeFetch;
  timeoutMs?: number;
}): Promise<StripeBalanceTransactionListResponse> {
  const searchParams = new URLSearchParams({
    payout: input.payoutId,
    limit: String(STRIPE_PAGE_LIMIT),
  });
  searchParams.append('expand[]', 'data.source');
  if (input.startingAfter) {
    searchParams.set('starting_after', input.startingAfter);
  }

  return stripeGet<StripeBalanceTransactionListResponse>({
    path: '/balance_transactions',
    secretKey: input.secretKey,
    searchParams,
    fetchImpl: input.fetchImpl,
    timeoutMs: input.timeoutMs,
  });
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
