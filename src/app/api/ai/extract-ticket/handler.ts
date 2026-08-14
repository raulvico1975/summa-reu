import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { FieldValue } from 'firebase-admin/firestore';
import { resolveGoogleGenAiApiKey } from '@/ai/config';
import type { ExtractTicketImageInput, ExtractTicketImageOutput } from '@/ai/flows/extract-ticket-image';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { requireOrgMembership, type ApiGuardCode } from '@/lib/api/request-guards';
import { getAdminApp, getAdminDb } from '@/lib/api/admin-sdk';
import { getMembershipPermissions } from '@/lib/api/require-permission';
import { resolveServerEntitlement, type EntitlementDbLike } from '@/lib/api/require-entitlement';
import {
  MAX_AI_IMAGE_BYTES,
} from '@/lib/security/storage-url';

// =============================================================================
// TYPES
// =============================================================================

interface ExtractTicketRequest {
  /** ID de l'organització propietària */
  orgId?: string;
  /** URL directa de la imatge (signada o pública) */
  fileUrl?: string;
  /** Path a Firebase Storage (alternativa a fileUrl) */
  storagePath?: string;
  /** ID del document (opcional, per logging) */
  docId?: string;
  context?: 'movements' | 'projects';
  target?: 'pending' | 'offBank';
  targetId?: string;
}

type SuccessResponse = {
  ok: true;
  date: string | null;
  amount: number | null;
  currency: string | null;
  merchant: string | null;
  concept: string | null;
  confidence: number;
  persisted?: boolean;
};

type ErrorResponse = {
  ok: false;
  code: 'QUOTA_EXCEEDED' | 'RATE_LIMITED' | 'TRANSIENT' | 'INVALID_INPUT' | 'AI_ERROR' | 'FETCH_ERROR' | 'PENDING_DOCUMENT_CHANGED' | 'WRITE_FAILED' | ApiGuardCode;
  message: string;
};

type ApiResponse = SuccessResponse | ErrorResponse;

export interface ExtractTicketRouteDeps {
  requireOrgMembershipFn?: typeof requireOrgMembership;
  getAdminDbFn?: typeof getAdminDb;
  resolveEntitlementFn?: typeof resolveServerEntitlement;
  resolveApiKeyFn?: typeof resolveGoogleGenAiApiKey;
  checkRateLimitFn?: typeof checkRateLimit;
  fetchFn?: typeof fetch;
  extractTicketFn?: (input: ExtractTicketImageInput) => Promise<ExtractTicketImageOutput>;
  getStorageFileFn?: (storagePath: string) => {
    getMetadata(): Promise<[Record<string, unknown>]>;
    download(): Promise<[Buffer]>;
  };
}

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

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
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
export async function handleExtractTicketPost(
  request: NextRequest,
  deps: ExtractTicketRouteDeps = {}
): Promise<NextResponse<ApiResponse>> {
  try {
    let input: unknown;
    try { input = await request.json(); } catch {
      return NextResponse.json({ ok: false, code: 'INVALID_INPUT', message: 'JSON invàlid' }, { status: 400 });
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return NextResponse.json({ ok: false, code: 'INVALID_INPUT', message: 'Payload invàlid' }, { status: 400 });
    }
    const raw = input as Record<string, unknown>;
    if (Object.keys(raw).some((key) => !['orgId', 'storagePath', 'docId', 'context', 'target', 'targetId'].includes(key))) {
      return NextResponse.json({ ok: false, code: 'INVALID_INPUT', message: 'Camps no admesos' }, { status: 400 });
    }
    const body = raw as ExtractTicketRequest;
    if (typeof body.orgId !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(body.orgId)
      || typeof body.storagePath !== 'string' || body.storagePath.length < 1 || body.storagePath.length > 1024) {
      return NextResponse.json({ ok: false, code: 'INVALID_INPUT', message: 'Identificadors invàlids' }, { status: 400 });
    }
    const guard = await (deps.requireOrgMembershipFn ?? requireOrgMembership)(request, body.orgId);
    if (!guard.ok) {
      return NextResponse.json({
        ok: false,
        code: guard.code,
        message: guard.message,
      }, { status: guard.status });
    }
    if (body.context !== 'movements' && body.context !== 'projects') {
      return NextResponse.json({ ok: false, code: 'INVALID_INPUT', message: 'context invàlid' }, { status: 400 });
    }
    if (body.target !== 'pending' && body.target !== 'offBank') {
      return NextResponse.json({ ok: false, code: 'INVALID_INPUT', message: 'target invàlid' }, { status: 400 });
    }
    if (!body.storagePath || body.fileUrl) {
      return NextResponse.json({ ok: false, code: 'INVALID_INPUT', message: 'storagePath és obligatori' }, { status: 400 });
    }
    const permissions = getMembershipPermissions(guard.membership);
    const userAllowed = body.target === 'pending'
      ? permissions['sections.moviments'] === true && permissions['moviments.editar'] === true
      : permissions['sections.projectes'] === true && permissions['projectes.manage'] === true;
    const db = (deps.getAdminDbFn ?? getAdminDb)();
    const entitlement = await (deps.resolveEntitlementFn ?? resolveServerEntitlement)({
      db: db as unknown as EntitlementDbLike,
      orgId: guard.orgId,
      capability: 'pendingDocuments.ocr',
      userAllowed,
    });
    if (!entitlement.allowed) {
      return NextResponse.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'L’extracció OCR requereix el pla Complet.',
      }, { status: 403 });
    }

    if (body.target === 'pending') {
      if (body.context !== 'movements' || !body.docId || !/^[A-Za-z0-9_-]{1,160}$/.test(body.docId)) {
        return NextResponse.json({ ok: false, code: 'INVALID_INPUT', message: 'docId invàlid' }, { status: 400 });
      }
      const expectedPrefix = `organizations/${guard.orgId}/pendingDocuments/${body.docId}/`;
      const basename = body.storagePath.slice(expectedPrefix.length);
      if (!body.storagePath.startsWith(expectedPrefix) || !basename || basename.includes('/')) {
        return NextResponse.json({ ok: false, code: 'INVALID_INPUT', message: 'storagePath invàlid' }, { status: 400 });
      }
      const pendingSnap = await db.doc(`organizations/${guard.orgId}/pendingDocuments/${body.docId}`).get();
      const pending = pendingSnap.exists ? pendingSnap.data() ?? {} : null;
      const pendingFile = pending?.file && typeof pending.file === 'object' ? pending.file as Record<string, unknown> : {};
      if (!pending || pendingFile.storagePath !== body.storagePath) {
        return NextResponse.json({ ok: false, code: 'INVALID_INPUT', message: 'El path no correspon al document pendent' }, { status: 400 });
      }
    } else {
      if (body.context !== 'projects' || body.docId || !body.targetId || !/^[A-Za-z0-9_-]{1,160}$/.test(body.targetId)) {
        return NextResponse.json({ ok: false, code: 'INVALID_INPUT', message: 'Target off-bank invàlid' }, { status: 400 });
      }
      const expectedPrefix = `organizations/${guard.orgId}/offBankExpenses/temp/`;
      const basename = body.storagePath.slice(expectedPrefix.length);
      if (!body.storagePath.startsWith(expectedPrefix) || !basename || basename.includes('/')) {
        return NextResponse.json({ ok: false, code: 'INVALID_INPUT', message: 'Path temporal invàlid' }, { status: 400 });
      }
      const expenseSnap = await db.doc(`organizations/${guard.orgId}/projectModule/_/offBankExpenses/${body.targetId}`).get();
      const expense = expenseSnap.exists ? expenseSnap.data() ?? {} : null;
      const attachments = expense && Array.isArray(expense.attachments) ? expense.attachments : [];
      if (!expense || !attachments.some((attachment) => (
        attachment && typeof attachment === 'object'
          && (attachment as Record<string, unknown>).storagePath === body.storagePath
      ))) {
        return NextResponse.json({ ok: false, code: 'INVALID_INPUT', message: 'El path no correspon a la despesa' }, { status: 400 });
      }
    }

    // Verify API key is available only after auth, permission, entitlement and target identity.
    const apiKey = (deps.resolveApiKeyFn ?? resolveGoogleGenAiApiKey)();
    if (!apiKey) {
      console.error('[extract-ticket] No API key found');
      return NextResponse.json({
        ok: false,
        code: 'AI_ERROR',
        message: 'API key not configured',
      });
    }

    const rateLimit = (deps.checkRateLimitFn ?? checkRateLimit)({
      key: `ai:extract-ticket:${guard.auth.uid}:${guard.orgId}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json({
        ok: false,
        code: 'RATE_LIMITED',
        message: 'Rate limited. Espera uns segons.',
      }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    let arrayBuffer: ArrayBuffer;
    try {
        const file = (deps.getStorageFileFn ?? ((path) => getStorage(getAdminApp()).bucket().file(path) as never))(body.storagePath);
        const [metadata] = await file.getMetadata();
        const size = typeof metadata.size === 'string' ? Number(metadata.size) : Number(metadata.size ?? 0);
        if (!Number.isFinite(size) || size <= 0 || size > MAX_AI_IMAGE_BYTES) {
          return NextResponse.json({
            ok: false,
            code: 'INVALID_INPUT',
            message: 'La imatge supera la mida màxima permesa',
          }, { status: 400 });
        }

        const [buffer] = await file.download();
        arrayBuffer = bufferToArrayBuffer(buffer);
      } catch (storageError) {
        console.error('[extract-ticket] Storage error:', storageError);
        return NextResponse.json({
          ok: false,
          code: 'FETCH_ERROR',
          message: 'No s\'ha pogut obtenir la URL de Storage',
        });
      }

    if (arrayBuffer.byteLength > MAX_AI_IMAGE_BYTES) {
      return NextResponse.json({
        ok: false,
        code: 'INVALID_INPUT',
        message: 'La imatge supera la mida màxima permesa',
      }, { status: 400 });
    }

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
    if (!deps.extractTicketFn) {
      return NextResponse.json({ ok: false, code: 'AI_ERROR', message: 'AI handler unavailable' }, { status: 503 });
    }
    const aiOutput: ExtractTicketImageOutput = await deps.extractTicketFn({
      imageBase64,
      mimeType,
    });

    const nullableStringFields = [aiOutput.date, aiOutput.currency, aiOutput.merchant, aiOutput.concept];
    if (!Number.isFinite(aiOutput.confidence) || aiOutput.confidence < 0 || aiOutput.confidence > 1
      || nullableStringFields.some((value) => value !== null && typeof value !== 'string')
      || (aiOutput.amount !== null && (typeof aiOutput.amount !== 'number' || !Number.isFinite(aiOutput.amount)))) {
      return NextResponse.json({ ok: false, code: 'AI_ERROR', message: 'Resposta IA invàlida' }, { status: 500 });
    }

    if (aiOutput.confidence < 0.3) {
      return NextResponse.json({
        ok: true,
        date: aiOutput.date,
        amount: aiOutput.amount,
        currency: aiOutput.currency,
        merchant: aiOutput.merchant,
        concept: aiOutput.concept,
        confidence: aiOutput.confidence,
        persisted: false,
      });
    }

    if (body.target === 'pending' && body.docId) {
      const pendingRef = db.doc(`organizations/${guard.orgId}/pendingDocuments/${body.docId}`);
      try {
        await db.runTransaction(async (transaction) => {
          const currentSnap = await transaction.get(pendingRef);
          const current = currentSnap.exists ? currentSnap.data() ?? {} : null;
          const currentFile = current?.file && typeof current.file === 'object' ? current.file as Record<string, unknown> : {};
          if (!current || currentFile.storagePath !== body.storagePath) throw new Error('PENDING_DOCUMENT_CHANGED');
          const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
          if (current.extracted === null) {
            updates.extracted = {
              source: 'ai',
              confidence: aiOutput.confidence >= 0.8 ? 'high' : aiOutput.confidence >= 0.5 ? 'medium' : 'low',
              evidence: Object.fromEntries([
                ['invoiceDate', aiOutput.date],
                ['amount', aiOutput.amount?.toString() ?? null],
                ['supplierName', aiOutput.merchant],
              ].filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)),
            };
          }
          if (current.invoiceDate === null && aiOutput.date) updates.invoiceDate = aiOutput.date;
          if (current.amount === null && aiOutput.amount !== null) updates.amount = aiOutput.amount;
          transaction.update(pendingRef, updates as FirebaseFirestore.UpdateData<Record<string, unknown>>);
        });
      } catch (error) {
        const code: 'PENDING_DOCUMENT_CHANGED' | 'WRITE_FAILED' = error instanceof Error && error.message === 'PENDING_DOCUMENT_CHANGED'
          ? 'PENDING_DOCUMENT_CHANGED'
          : 'WRITE_FAILED';
        return NextResponse.json({ ok: false, code, message: 'No s’ha pogut persistir l’extracció' }, { status: code === 'PENDING_DOCUMENT_CHANGED' ? 409 : 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      date: aiOutput.date,
      amount: aiOutput.amount,
      currency: aiOutput.currency,
      merchant: aiOutput.merchant,
      concept: aiOutput.concept,
      confidence: aiOutput.confidence,
      persisted: body.target === 'pending',
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
      }, { status: 429 });
    }

    if (errorMsgLower.includes('rate limit') || errorMsgLower.includes('rate_limit')) {
      return NextResponse.json({
        ok: false,
        code: 'RATE_LIMITED',
        message: 'Rate limited. Espera uns segons.',
      }, { status: 429 });
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
      }, { status: 503 });
    }

    return NextResponse.json({
      ok: false,
      code: 'AI_ERROR',
      message: 'No s’ha pogut completar l’extracció.',
    }, { status: 500 });
  }
}
