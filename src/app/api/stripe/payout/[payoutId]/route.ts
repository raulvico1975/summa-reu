import { NextRequest } from 'next/server';
import { handleStripePayoutGet } from './handler';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ payoutId: string }> }
) {
  return handleStripePayoutGet(request, context);
}
