import { NextRequest } from 'next/server';
import { handleStripePayoutsGet } from './handler';

export async function GET(request: NextRequest) {
  return handleStripePayoutsGet(request);
}
