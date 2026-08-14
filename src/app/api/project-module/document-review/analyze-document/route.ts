import { NextRequest } from 'next/server';
import { handleAnalyzeDocumentPost } from './handler';

export async function POST(request: NextRequest) {
  return handleAnalyzeDocumentPost(request);
}
