import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminDb,
  validateUserMembership,
  verifyIdToken,
} from '@/lib/api/admin-sdk';
import { requirePermission } from '@/lib/api/require-permission';
import {
  assertStripePayoutPaid,
  fetchStripePayout,
  fetchStripePayoutPayments,
  getUnsupportedStripeCurrencyMessage,
  getStripeSecretKeyFromEnv,
  isUnsupportedStripeCurrencyError,
  StripeApiError,
} from '@/lib/stripe/payout-api';

interface ErrorResponse {
  success: false;
  code: string;
  error: string;
}

export type StripePayoutRouteDeps = {
  verifyIdToken: typeof verifyIdToken;
  getAdminDb: typeof getAdminDb;
  validateUserMembership: typeof validateUserMembership;
  requirePermission: (...args: Parameters<typeof requirePermission>) => NextResponse | null;
  getStripeSecretKeyFromEnv: typeof getStripeSecretKeyFromEnv;
  fetchStripePayout: typeof fetchStripePayout;
  assertStripePayoutPaid: typeof assertStripePayoutPaid;
  fetchStripePayoutPayments: typeof fetchStripePayoutPayments;
};

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json<ErrorResponse>(
    { success: false, code, error },
    { status }
  );
}

const defaultDeps: StripePayoutRouteDeps = {
  verifyIdToken,
  getAdminDb,
  validateUserMembership,
  requirePermission,
  getStripeSecretKeyFromEnv,
  fetchStripePayout,
  assertStripePayoutPaid,
  fetchStripePayoutPayments,
};

export async function handleStripePayoutGet(
  request: NextRequest,
  { params }: { params: Promise<{ payoutId: string }> },
  deps: StripePayoutRouteDeps = defaultDeps
) {
  const auth = await deps.verifyIdToken(request);
  if (!auth) {
    return jsonError('UNAUTHORIZED', 'No autenticat', 401);
  }

  const { payoutId: rawPayoutId } = await params;
  const payoutId = typeof rawPayoutId === 'string' ? rawPayoutId.trim() : '';
  const orgId = request.nextUrl.searchParams.get('orgId')?.trim() ?? '';

  if (!orgId) {
    return jsonError('MISSING_ORG_ID', 'orgId obligatori', 400);
  }

  if (!payoutId) {
    return jsonError('MISSING_PAYOUT_ID', 'payoutId obligatori', 400);
  }

  const db = deps.getAdminDb();
  const membership = await deps.validateUserMembership(db, auth.uid, orgId);
  const permissionResponse = deps.requirePermission(membership, {
    code: 'MOVIMENTS_EDITAR_REQUIRED',
    check: (permissions) => permissions['moviments.editar'],
  });
  if (permissionResponse) {
    return permissionResponse;
  }

  const secretKey = deps.getStripeSecretKeyFromEnv();
  if (!secretKey) {
    return jsonError(
      'STRIPE_NOT_CONFIGURED',
      'Stripe Sync no està configurat al servidor.',
      412
    );
  }

  try {
    const payout = await deps.fetchStripePayout({
      secretKey,
      payoutId,
    });
    deps.assertStripePayoutPaid(payout);

    const payments = await deps.fetchStripePayoutPayments({
      secretKey,
      payoutId,
    });

    return NextResponse.json(payments);
  } catch (error) {
    if (isUnsupportedStripeCurrencyError(error)) {
      return jsonError(
        'STRIPE_UNSUPPORTED_CURRENCY',
        getUnsupportedStripeCurrencyMessage(error.currency),
        422
      );
    }

    if (error instanceof StripeApiError) {
      if (error.status === 404) {
        return jsonError(
          'STRIPE_PAYOUT_NOT_FOUND',
          'No s ha trobat aquest payout a Stripe.',
          404
        );
      }

      if (error.code === 'STRIPE_PAYOUT_NOT_PAID') {
        return jsonError(
          'STRIPE_PAYOUT_NOT_PAID',
          error.message,
          409
        );
      }

      return jsonError('STRIPE_REQUEST_FAILED', error.message, 502);
    }

    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return jsonError(
        'STRIPE_TIMEOUT',
        'Stripe ha trigat massa a respondre. Torna-ho a provar.',
        504
      );
    }

    if (error instanceof Error) {
      console.error(`[api/stripe/payout] ${error.name}: ${error.message}`);
    } else {
      console.error('[api/stripe/payout] Error inesperat');
    }
    return jsonError(
      'INTERNAL_ERROR',
      'No s ha pogut carregar el payout de Stripe.',
      500
    );
  }
}
