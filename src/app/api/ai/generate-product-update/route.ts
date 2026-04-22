// src/app/api/ai/generate-product-update/route.ts
// Endpoint per generar contingut de novetats del producte amb IA
// Output sempre TEXT PLA estructurat (NO HTML)

import { NextRequest, NextResponse } from 'next/server';
import {
  generateProductUpdateContent,
  type GenerateProductUpdateRequest,
} from '@/lib/product-updates/generate-product-update';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as GenerateProductUpdateRequest;
    const generated = await generateProductUpdateContent(body);
    return NextResponse.json(generated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error intern generant contingut';
    const status = message === 'Títol i descripció són obligatoris' ? 400 : 500;

    console.error('[ai/generate-product-update] Error:', error);
    return NextResponse.json(
      { error: status === 400 ? message : 'Error intern generant contingut' },
      { status }
    );
  }
}
