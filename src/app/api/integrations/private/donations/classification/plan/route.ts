import type { NextRequest } from 'next/server';
import { handlePrivateDonationClassificationPlan } from './handler';

export async function POST(request: NextRequest) {
  return handlePrivateDonationClassificationPlan(request);
}
