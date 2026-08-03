import type { NextRequest } from 'next/server';
import { handlePrivateIndividualCertificatePlan } from './handler';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return handlePrivateIndividualCertificatePlan(request);
}
