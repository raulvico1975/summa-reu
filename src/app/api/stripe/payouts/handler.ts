import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminDb,
  validateUserMembership,
  verifyIdToken,
} from '@/lib/api/admin-sdk';
import { requirePermission } from '@/lib/api/require-permission';
import {
  getUnsupportedStripeCurrencyMessage,
  getStripeSecretKeyFromEnv,
  isUnsupportedStripeCurrencyError,
  listRecentPaidStripePayouts,
  StripeApiError,
} from '@/lib/stripe/payout-api';

interface ErrorResponse {
  success: false;
  code: string;
  error: string;
}

export type StripePayoutsRouteDeps = {
  verifyIdToken: typeof verifyIdToken;
  getAdminDb: typeof getAdminDb;
  validateUserMembership: typeof validateUserMembership;
  requirePermission: (...args: Parameters<typeof requirePermission>) => NextResponse | null;
  getStripeSecretKeyFromEnv: typeof getStripeSecretKeyFromEnv;
  listRecentPaidStripePayouts: typeof listRecentPaidStripePayouts;
};

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json<ErrorResponse>(
    { success: false, code, error },
    { status }
  );
}

const defaultDeps: StripePayoutsRouteDeps = {
  verifyIdToken,
  getAdminDb,
  validateUserMembership,
  requirePermission,
  getStripeSecretKeyFromEnv,
  listRecentPaidStripePayouts,
};

export async function handleStripePayoutsGet(
  request: NextRequest,
  deps: StripePayoutsRouteDeps = defaultDeps
) {
  const auth = await deps.verifyIdToken(request);
  if (!auth) {
    return jsonError('UNAUTHORIZED', 'No autenticat', 401);
  }

  const orgId = request.nextUrl.searchParams.get('orgId')?.trim() ?? '';
  if (!orgId) {
    return jsonError('MISSING_ORG_ID', 'orgId obligatori', 400);
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
    const payouts = await deps.listRecentPaidStripePayouts({
      secretKey,
    });

    return NextResponse.json(payouts);
  } catch (error) {
    if (isUnsupportedStripeCurrencyError(error)) {
      return jsonError(
        'STRIPE_UNSUPPORTED_CURRENCY',
        getUnsupportedStripeCurrencyMessage(error.currency),
        422
      );
    }

    if (error instanceof StripeApiError) {
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
      console.error(`[api/stripe/payouts] ${error.name}: ${error.message}`);
    } else {
      console.error('[api/stripe/payouts] Error inesperat');
    }

    return jsonError(
      'INTERNAL_ERROR',
      'No s han pogut carregar els payouts de Stripe.',
      500
    );
  }
}
