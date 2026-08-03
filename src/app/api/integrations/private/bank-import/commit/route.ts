import { type NextRequest } from 'next/server';
import { handlePrivateBankImportCommit } from './handler';

export async function POST(request: NextRequest) {
  return handlePrivateBankImportCommit(request);
}
