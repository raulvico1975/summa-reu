import { NextRequest, NextResponse } from 'next/server';
import { ref, getDownloadURL } from 'firebase/storage';
import { getStorage } from 'firebase/storage';
import { getApp } from 'firebase/app';
import { resolveGoogleGenAiApiKey } from '@/ai/config';
import { extractTicketImage, type ExtractTicketImageOutput } from '@/ai/flows/extract-ticket-image';

// =============================================================================
// TYPES
// =============================================================================

interface ExtractTicketRequest {
  /** URL directa de la imatge (signada o pública) */
  fileUrl?: string;
  /** Path a Firebase Storage (alternativa a fileUrl) */
  storagePath?: string;
  /** ID del document (opcional, per logging) */
  docId?: string;
}

type SuccessResponse = {
  ok: true;
  date: string | null;
  amount: number | null;
  currency: string | null;
  merchant: string | null;
  concept: string | null;
  confidence: number;
};

type ErrorResponse = {
  ok: false;
  code: 'QUOTA_EXCEEDED' | 'RATE_LIMITED' | 'TRANSIENT' | 'INVALID_INPUT' | 'AI_ERROR' | 'FETCH_ERROR';
  message: string;
};

type ApiResponse = SuccessResponse | ErrorResponse;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Converteix un ArrayBuffer a string Base64.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Detecta el tipus MIME d'una imatge basant-se en els primers bytes (magic bytes).
 */
function detectMimeType(buffer: ArrayBuffer): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | null {
  const bytes = new Uint8Array(buffer);

  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png';
  }

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp';
  }

  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }

  return null;
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * POST /api/ai/extract-ticket
 *
 * Extreu dades d'un ticket/rebut en format imatge (JPEG/PNG).
 *
 * Input:
 * - fileUrl: URL directa de la imatge
 * - storagePath: Path a Firebase Storage (alternativa)
 * - docId: ID del document (opcional, per logging)
 *
 * Output (200 OK):
 * - ok: true
 * - date: string | null (YYYY-MM-DD)
 * - amount: number | null
 * - currency: string | null (ISO 4217)
 * - merchant: string | null
 * - concept: string | null
 * - confidence: number (0-1)
 *
 * En cas d'error de IA, retorna 200 amb camps null i confidence: 0.
 * Això permet que la UI segueixi funcionant.
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    // Verify API key is available
    const apiKey = resolveGoogleGenAiApiKey();
    if (!apiKey) {
      console.error('[extract-ticket] No API key found');
      return NextResponse.json({
        ok: false,
        code: 'AI_ERROR',
        message: 'API key not configured',
      });
    }

    const body: ExtractTicketRequest = await request.json();

    // Validate input: necessitem fileUrl o storagePath
    if (!body.fileUrl && !body.storagePath) {
      return NextResponse.json({
        ok: false,
        code: 'INVALID_INPUT',
        message: 'Cal proporcionar fileUrl o storagePath',
      });
    }

    // Obtenir URL de descàrrega
    let downloadUrl: string;

    if (body.fileUrl) {
      downloadUrl = body.fileUrl;
    } else {
      // Obtenir URL signada de Storage
      try {
        const app = getApp();
        const storage = getStorage(app);
        const storageRef = ref(storage, body.storagePath);
        downloadUrl = await getDownloadURL(storageRef);
      } catch (storageError) {
        console.error('[extract-ticket] Storage error:', storageError);
        return NextResponse.json({
          ok: false,
          code: 'FETCH_ERROR',
          message: 'No s\'ha pogut obtenir la URL de Storage',
        });
      }
    }

    // Descarregar la imatge
    console.log('[extract-ticket] Fetching image:', downloadUrl.substring(0, 80));
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      console.error('[extract-ticket] Fetch failed:', response.status);
      return NextResponse.json({
        ok: false,
        code: 'FETCH_ERROR',
        message: `Error descarregant imatge: ${response.status}`,
      });
    }

    const arrayBuffer = await response.arrayBuffer();

    // Detectar tipus MIME
    const mimeType = detectMimeType(arrayBuffer);
    if (!mimeType) {
      // Si no és una imatge suportada, retornem èxit amb camps buits
      // (la UI pot mostrar el fitxer però sense extracció)
      console.warn('[extract-ticket] Unsupported image type');
      return NextResponse.json({
        ok: true,
        date: null,
        amount: null,
        currency: null,
        merchant: null,
        concept: null,
        confidence: 0,
      });
    }

    // Convertir a base64
    const imageBase64 = arrayBufferToBase64(arrayBuffer);

    // Cridar el flow de Gemini
    console.log('[extract-ticket] Calling AI, docId:', body.docId ?? 'none');
    const aiOutput: ExtractTicketImageOutput = await extractTicketImage({
      imageBase64,
      mimeType,
    });

    return NextResponse.json({
      ok: true,
      date: aiOutput.date,
      amount: aiOutput.amount,
      currency: aiOutput.currency,
      merchant: aiOutput.merchant,
      concept: aiOutput.concept,
      confidence: aiOutput.confidence,
    });

  } catch (error: unknown) {
    console.error('[extract-ticket] Error:', error);

    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorMsgLower = errorMsg.toLowerCase();

    // Detect quota/rate limit errors
    if (
      errorMsg.includes('429') ||
      errorMsgLower.includes('quota') ||
      errorMsgLower.includes('resource_exhausted') ||
      errorMsgLower.includes('exceeded')
    ) {
      return NextResponse.json({
        ok: false,
        code: 'QUOTA_EXCEEDED',
        message: "Quota d'IA esgotada. Torna-ho a provar més tard.",
      });
    }

    if (errorMsgLower.includes('rate limit') || errorMsgLower.includes('rate_limit')) {
      return NextResponse.json({
        ok: false,
        code: 'RATE_LIMITED',
        message: 'Rate limited. Espera uns segons.',
      });
    }

    // Detect transient errors
    if (
      errorMsg.includes('503') ||
      errorMsg.includes('504') ||
      errorMsgLower.includes('timeout') ||
      errorMsgLower.includes('unavailable')
    ) {
      return NextResponse.json({
        ok: false,
        code: 'TRANSIENT',
        message: 'Error temporal. Tornant a intentar...',
      });
    }

    // Per errors genèrics de IA, retornem èxit amb camps buits
    // perquè la UI pugui continuar funcionant
    return NextResponse.json({
      ok: true,
      date: null,
      amount: null,
      currency: null,
      merchant: null,
      concept: null,
      confidence: 0,
    });
  }
}
