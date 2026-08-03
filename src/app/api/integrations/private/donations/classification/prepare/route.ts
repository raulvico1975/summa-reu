import { type NextRequest } from 'next/server';
import { handlePrivateDonationClassificationPrepare } from './handler';

export async function POST(request: NextRequest) {
  return handlePrivateDonationClassificationPrepare(request);
}
