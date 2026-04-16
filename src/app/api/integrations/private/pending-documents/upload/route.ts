import { type NextRequest } from 'next/server';
import { handlePrivatePendingDocumentsUpload } from './handler';

export async function POST(request: NextRequest) {
  return handlePrivatePendingDocumentsUpload(request);
}
