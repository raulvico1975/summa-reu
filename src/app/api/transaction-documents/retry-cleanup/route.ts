import { NextRequest } from 'next/server';
import { handleRetryTransactionDocumentCleanupPost } from './handler';

export async function POST(request: NextRequest) {
  return handleRetryTransactionDocumentCleanupPost(request);
}
