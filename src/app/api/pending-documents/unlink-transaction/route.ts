import { NextRequest } from 'next/server';
import { handleUnlinkPendingDocumentPost } from './handler';

export async function POST(request: NextRequest) {
  return handleUnlinkPendingDocumentPost(request);
}
