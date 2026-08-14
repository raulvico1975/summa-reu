import { NextRequest } from 'next/server';
import { handleLinkPendingDocumentPost } from './handler';

export async function POST(request: NextRequest) {
  return handleLinkPendingDocumentPost(request);
}
