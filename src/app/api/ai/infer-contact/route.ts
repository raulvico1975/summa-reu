import { NextRequest } from 'next/server';
import { inferContact } from '@/ai/flows/infer-contact';
import { handleInferContactPost } from './handler';

export async function POST(request: NextRequest) {
  return handleInferContactPost(request, { inferContactFn: inferContact });
}
