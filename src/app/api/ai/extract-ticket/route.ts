import { NextRequest } from 'next/server';
import { handleExtractTicketPost } from './handler';
import { extractTicketImage } from '@/ai/flows/extract-ticket-image';

export async function POST(request: NextRequest) {
  return handleExtractTicketPost(request, { extractTicketFn: extractTicketImage });
}
