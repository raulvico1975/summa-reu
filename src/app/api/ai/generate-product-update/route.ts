// src/app/api/ai/generate-product-update/route.ts
// Endpoint per generar contingut de novetats del producte amb IA
// Output sempre TEXT PLA estructurat (NO HTML)

import { NextRequest, NextResponse } from 'next/server';
import {
  generateProductUpdateContent,
  type GenerateProductUpdateRequest,
} from '@/lib/product-updates/generate-product-update';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { requireSuperAdminRequest } from '@/lib/api/request-guards';

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSuperAdminRequest(request);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.message }, { status: guard.status });
    }

    const rateLimit = checkRateLimit({
      key: `ai:generate-product-update:${guard.auth.uid}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limited. Espera uns segons.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        }
      );
    }

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
