import { NextRequest } from 'next/server';
import { extractPdfInvoice } from '@/ai/flows/extract-pdf-invoice';
import { handleExtractPdfPost } from './handler';

export async function POST(request: NextRequest) {
  return handleExtractPdfPost(request, { extractPdfFn: extractPdfInvoice });
}
