import { type NextRequest } from 'next/server';
import { handleConversationalContactsSearch } from '../handler';

export async function GET(request: NextRequest) {
  return handleConversationalContactsSearch(request);
}
