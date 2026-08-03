import type { NextRequest } from 'next/server';
import { handlePrivateDonationClassificationApply } from './handler';

export async function POST(request: NextRequest) {
  return handlePrivateDonationClassificationApply(request);
}
