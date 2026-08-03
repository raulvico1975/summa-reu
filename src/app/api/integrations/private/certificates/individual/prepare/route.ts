import { type NextRequest } from 'next/server';
import { handlePrivateIndividualCertificatePrepare } from './handler';

export async function POST(request: NextRequest) {
  return handlePrivateIndividualCertificatePrepare(request);
}
