import { NextRequest } from 'next/server';
import { handleTransactionDocumentMutationPost } from './handler';

export async function POST(request: NextRequest) {
  return handleTransactionDocumentMutationPost(request);
}
