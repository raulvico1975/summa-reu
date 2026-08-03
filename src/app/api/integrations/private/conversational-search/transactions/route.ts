import { type NextRequest } from 'next/server';
import { handleConversationalTransactionsSearch } from '../handler';

export async function GET(request: NextRequest) {
  return handleConversationalTransactionsSearch(request);
}
