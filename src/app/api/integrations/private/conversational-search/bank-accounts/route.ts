import { type NextRequest } from 'next/server';
import { handleConversationalBankAccountsSearch } from '../handler';

export async function GET(request: NextRequest) {
  return handleConversationalBankAccountsSearch(request);
}
