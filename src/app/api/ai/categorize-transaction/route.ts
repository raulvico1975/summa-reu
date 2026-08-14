import { NextRequest } from 'next/server';
import { handleCategorizeTransactionPost } from './handler';

export async function POST(request: NextRequest) {
  return handleCategorizeTransactionPost(request);
}
