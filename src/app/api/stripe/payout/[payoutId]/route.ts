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
  getStripeSecretKeyFromEnv,
  StripeApiError,
} from '@/lib/stripe/payout-api';

interface ErrorResponse {
  success: false;
  code: string;
  error: string;
}

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json<ErrorResponse>(
    { success: false, code, error },
    { status }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ payoutId: string }> }
) {
  const auth = await verifyIdToken(request);
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

  const db = getAdminDb();
  const membership = await validateUserMembership(db, auth.uid, orgId);
  const permissionResponse = requirePermission(membership, {
    code: 'MOVIMENTS_EDITAR_REQUIRED',
    check: (permissions) => permissions['moviments.editar'],
  });
  if (permissionResponse) {
    return permissionResponse;
  }

  const secretKey = getStripeSecretKeyFromEnv();
  if (!secretKey) {
    return jsonError(
      'STRIPE_NOT_CONFIGURED',
      'Stripe Sync no està configurat al servidor.',
      412
    );
  }

  try {
    const payout = await fetchStripePayout({
      secretKey,
      payoutId,
    });
    assertStripePayoutPaid(payout);

    const payments = await fetchStripePayoutPayments({
      secretKey,
      payoutId,
    });

    return NextResponse.json(payments);
  } catch (error) {
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
