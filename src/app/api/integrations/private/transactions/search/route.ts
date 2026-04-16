import { type NextRequest } from 'next/server';
import { handlePrivateTransactionsSearch } from './handler';

export async function GET(request: NextRequest) {
  return handlePrivateTransactionsSearch(request);
}
