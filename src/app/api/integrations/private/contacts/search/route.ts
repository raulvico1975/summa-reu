import { type NextRequest } from 'next/server';
import { handlePrivateContactsSearch } from './handler';

export async function GET(request: NextRequest) {
  return handlePrivateContactsSearch(request);
}
