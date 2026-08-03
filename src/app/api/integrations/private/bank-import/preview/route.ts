import { type NextRequest } from 'next/server';
import { handlePrivateBankImportPreview } from './handler';

export async function POST(request: NextRequest) {
  return handlePrivateBankImportPreview(request);
}
