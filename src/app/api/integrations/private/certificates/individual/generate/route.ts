import type { NextRequest } from 'next/server';
import { handlePrivateIndividualCertificateGenerate } from './handler';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return handlePrivateIndividualCertificateGenerate(request);
}
