import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAdminApp, getAdminDb } from '@/lib/api/admin-sdk';
import { getMembershipPermissions, requirePermission } from '@/lib/api/require-permission';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { requireOrgMembership, type ApiGuardCode } from '@/lib/api/request-guards';
import { canAccessProjectsArea, canReadBankInProjectes } from '@/lib/permissions';
import { resolveServerEntitlement, type EntitlementDbLike } from '@/lib/api/require-entitlement';
import {
  MAX_DOCUMENT_REVIEW_AI_BYTES,
  OpenAiDocumentReviewError,
  analyzeDocumentWithOpenAI,
  inferDocumentReviewContentType,
  isAllowedDocumentReviewStoragePath,
  isSupportedDocumentReviewContentType,
  resolveOpenAiApiKey,
  resolveOpenAiDocumentReviewModel,
  type DocumentReviewDetection,
  type DocumentReviewField,
} from '@/lib/document-review';
import { parseFirebaseStorageDownloadUrl } from '@/lib/security/storage-url';

type AnalyzeDocumentRequest = {
  orgId?: string;
  txId?: string;
  documentKey?: string;
  documentName?: string;
  storagePath?: string;
  rowContext?: {
    source?: 'bank' | 'offBank';
    dateExpense?: string;
    paymentDate?: string | null;
    counterpartyName?: string;
    concept?: string;
    amountAssignedEUR?: number | null;
    amountTotalEUR?: number | null;
    budgetLineCode?: string;
    budgetLineName?: string;
  };
};

type AnalyzeDocumentSuccess = {
  ok: true;
  documentKey: string;
  persisted: boolean;
  detection: DocumentReviewDetection;
};

type AnalyzeDocumentError = {
  ok: false;
  code:
    | 'AI_UNAVAILABLE'
    | 'QUOTA_EXCEEDED'
    | 'RATE_LIMITED'
    | 'TRANSIENT'
    | 'INVALID_INPUT'
    | 'UNSUPPORTED_FILE'
    | 'FETCH_ERROR'
    | 'AI_ERROR'
    | 'INVALID_OUTPUT'
    | ApiGuardCode;
  message: string;
};

type AnalyzeDocumentResponse = AnalyzeDocumentSuccess | AnalyzeDocumentError;

const DOCUMENT_TARGET_ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;

interface LoadedDocument {
  buffer: Buffer;
  metadataContentType: string | null;
  metadataSize: number | null;
}

class DocumentTooLargeError extends Error {}

interface PersistDocumentReviewParams {
  orgId: string;
  txId: string | undefined;
  source: 'bank' | 'offBank';
  storagePath: string;
  documentKey: string;
  documentName: string;
  detection: DocumentReviewDetection;
}

type DocumentReviewSource = 'bank' | 'offBank';

interface DocumentTargetIdentity {
  source: DocumentReviewSource;
  txId: string;
  storagePath: string;
  documentKey: string;
  firestorePath: string;
}

interface DocumentTargetDbLike {
  doc(path: string): {
    get(): Promise<{
      exists: boolean;
      data(): Record<string, unknown> | undefined;
    }>;
  };
}

export interface AnalyzeDocumentRouteDeps {
  requireOrgMembershipFn?: typeof requireOrgMembership;
  getAdminDbFn?: typeof getAdminDb;
  resolveEntitlementFn?: typeof resolveServerEntitlement;
  resolveApiKeyFn?: typeof resolveOpenAiApiKey;
  checkRateLimitFn?: typeof checkRateLimit;
  loadDocumentFn?: (storagePath: string) => Promise<LoadedDocument>;
  analyzeDocumentFn?: typeof analyzeDocumentWithOpenAI;
  persistDetectionFn?: (params: PersistDocumentReviewParams) => Promise<boolean>;
  resolveModelFn?: typeof resolveOpenAiDocumentReviewModel;
  validateDocumentTargetFn?: (
    db: DocumentTargetDbLike,
    identity: DocumentTargetIdentity
  ) => Promise<boolean>;
}

function errorResponse(code: AnalyzeDocumentError['code'], message: string, status = 200): NextResponse<AnalyzeDocumentError> {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function safeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeRowContext(body: AnalyzeDocumentRequest): Parameters<typeof analyzeDocumentWithOpenAI>[0]['rowContext'] {
  const rowContext = body.rowContext ?? {};
  return {
    source: rowContext.source === 'bank' ? 'bank' : 'offBank',
    dateExpense: safeString(rowContext.dateExpense),
    paymentDate: typeof rowContext.paymentDate === 'string' && rowContext.paymentDate.trim()
      ? rowContext.paymentDate.trim()
      : null,
    counterpartyName: safeString(rowContext.counterpartyName),
    concept: safeString(rowContext.concept),
    amountAssignedEUR: safeNumber(rowContext.amountAssignedEUR),
    amountTotalEUR: safeNumber(rowContext.amountTotalEUR),
    budgetLineCode: safeString(rowContext.budgetLineCode),
    budgetLineName: safeString(rowContext.budgetLineName),
  };
}

function fileNameFromPath(storagePath: string): string {
  const parts = storagePath.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? 'document';
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function serializeReviewField<T extends string | number>(
  field: DocumentReviewField<T> | undefined
): DocumentReviewField<T> {
  return {
    value: field?.value ?? null,
    confidence: nullableNumber(field?.confidence),
    evidence: nullableString(field?.evidence),
  };
}

function serializeDocumentReviewDetection(detection: DocumentReviewDetection): DocumentReviewDetection {
  const fields = detection.fields ?? {};
  return {
    docType: detection.docType,
    confidence: nullableNumber(detection.confidence),
    fields: {
      invoiceNumber: serializeReviewField(fields.invoiceNumber),
      invoiceDate: serializeReviewField(fields.invoiceDate),
      paymentDate: serializeReviewField(fields.paymentDate),
      amount: serializeReviewField(fields.amount),
      supplierName: serializeReviewField(fields.supplierName),
      supplierTaxId: serializeReviewField(fields.supplierTaxId),
    },
    provider: nullableString(detection.provider),
    model: nullableString(detection.model),
    processedAt: nullableString(detection.processedAt) ?? new Date().toISOString(),
    errors: Array.isArray(detection.errors)
      ? detection.errors.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [],
  };
}

function documentMatches(params: {
  candidate: Record<string, unknown>;
  storagePath: string;
  documentKey: string;
}): boolean {
  const candidateStoragePath = nullableString(params.candidate.storagePath);
  const candidateUrl = nullableString(params.candidate.url) ?? nullableString(params.candidate.fileUrl);
  if (candidateStoragePath) return candidateStoragePath === params.storagePath;
  if (!candidateUrl || candidateUrl !== params.documentKey) return false;
  if (params.documentKey === params.storagePath) return true;
  return parseFirebaseStorageDownloadUrl(candidateUrl)?.storagePath === params.storagePath;
}

function resolveDocumentTargetIdentity(params: {
  orgId: string;
  txId: string | undefined;
  source: 'bank' | 'offBank' | undefined;
  storagePath: string;
  documentKey: string;
}): DocumentTargetIdentity | null {
  const txId = params.txId?.trim() ?? '';
  const segments = params.storagePath.split('/');
  if (!txId || segments.length < 5 || segments[0] !== 'organizations' || segments[1] !== params.orgId) {
    return null;
  }

  const area = segments[2];
  const targetId = segments[3];
  if (!targetId || !segments.slice(4).every(Boolean)) return null;

  if (area === 'offBankExpenses') {
    if (params.source !== 'offBank' || !txId.startsWith('off_')) return null;
    const expenseId = txId.slice(4);
    if (
      !DOCUMENT_TARGET_ID_PATTERN.test(expenseId)
      || (targetId !== expenseId && targetId !== 'temp')
    ) return null;
    return {
      source: 'offBank',
      txId,
      storagePath: params.storagePath,
      documentKey: params.documentKey,
      firestorePath: `organizations/${params.orgId}/projectModule/_/offBankExpenses/${expenseId}`,
    };
  }

  if (area === 'documents' || area === 'transactions') {
    if (
      params.source !== 'bank'
      || txId !== targetId
      || !DOCUMENT_TARGET_ID_PATTERN.test(txId)
    ) return null;
    return {
      source: 'bank',
      txId,
      storagePath: params.storagePath,
      documentKey: params.documentKey,
      firestorePath: `organizations/${params.orgId}/exports/projectExpenses/items/${txId}`,
    };
  }

  return null;
}

async function validateDocumentTarget(
  db: DocumentTargetDbLike,
  identity: DocumentTargetIdentity
): Promise<boolean> {
  const snapshot = await db.doc(identity.firestorePath).get();
  if (!snapshot.exists) return false;
  const data = snapshot.data() ?? {};
  const candidates = identity.source === 'offBank'
    ? (Array.isArray(data.attachments) ? data.attachments : [])
    : (Array.isArray(data.documents) ? data.documents : []);

  return candidates.some((candidate) => candidate && typeof candidate === 'object' && documentMatches({
    candidate: candidate as Record<string, unknown>,
    storagePath: identity.storagePath,
    documentKey: identity.documentKey,
  }));
}

async function persistDocumentReviewDetection(params: PersistDocumentReviewParams): Promise<boolean> {
  const txId = params.txId?.trim();
  if (!txId || params.source !== 'offBank' || !txId.startsWith('off_')) return false;

  const expenseId = txId.slice(4).trim();
  if (!expenseId) return false;

  const db = getFirestore(getAdminApp());
  const ref = db.doc(`organizations/${params.orgId}/projectModule/_/offBankExpenses/${expenseId}`);
  const snap = await ref.get();
  if (!snap.exists) return false;

  const data = snap.data() ?? {};
  const attachments = Array.isArray(data.attachments) ? data.attachments : [];
  let found = false;
  const nextAttachments = attachments.map((attachment) => {
    if (!attachment || typeof attachment !== 'object') return attachment;
    const candidate = attachment as Record<string, unknown>;
    if (!documentMatches({
      candidate,
      storagePath: params.storagePath,
      documentKey: params.documentKey,
    })) {
      return attachment;
    }

    found = true;
    return { ...candidate, aiDocumentReview: serializeDocumentReviewDetection(params.detection) };
  });

  if (!found) return false;
  await ref.update({ attachments: nextAttachments, updatedAt: Timestamp.now() });
  return true;
}

async function loadDocumentFromStorage(storagePath: string): Promise<LoadedDocument> {
  const file = getStorage(getAdminApp()).bucket().file(storagePath);
  const [metadata] = await file.getMetadata();
  const rawSize = typeof metadata.size === 'string' ? Number(metadata.size) : Number(metadata.size ?? 0);
  if (Number.isFinite(rawSize) && rawSize > MAX_DOCUMENT_REVIEW_AI_BYTES) {
    throw new DocumentTooLargeError('Document exceeds the maximum review size.');
  }
  const [buffer] = await file.download();
  return {
    buffer,
    metadataContentType: typeof metadata.contentType === 'string' ? metadata.contentType : null,
    metadataSize: Number.isFinite(rawSize) ? rawSize : null,
  };
}

export async function handleAnalyzeDocumentPost(
  request: NextRequest,
  deps: AnalyzeDocumentRouteDeps = {}
): Promise<NextResponse<AnalyzeDocumentResponse>> {
  let body: AnalyzeDocumentRequest;
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_INPUT', 'Cos de petició invàlid.', 400);
  }

  const guard = await (deps.requireOrgMembershipFn ?? requireOrgMembership)(request, body.orgId);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, code: guard.code, message: guard.message }, { status: guard.status });
  }

  const denied = requirePermission(guard.membership, {
    code: 'PROJECT_MODULE_REQUIRED',
    check: canAccessProjectsArea,
  });
  if (denied) {
    return errorResponse('FORBIDDEN', 'No tens permisos per usar la revisió documental amb IA.', 403);
  }

  // Keep this guard before API-key lookup, rate limiting, Storage, AI, and persistence.
  const db = (deps.getAdminDbFn ?? getAdminDb)();
  const entitlement = await (deps.resolveEntitlementFn ?? resolveServerEntitlement)({
    db: db as unknown as EntitlementDbLike,
    orgId: guard.orgId,
    capability: 'projects.mutate',
    userAllowed: true,
  });
  if (!entitlement.allowed) {
    return errorResponse('FORBIDDEN', 'La revisió documental requereix el pla Complet.', 403);
  }

  const storagePath = body.storagePath?.trim();
  if (!storagePath || !isAllowedDocumentReviewStoragePath(storagePath, guard.orgId)) {
    return errorResponse('INVALID_INPUT', 'storagePath no pertany als documents revisables d’aquesta organització.', 400);
  }

  const documentKey = body.documentKey?.trim() || storagePath;
  const documentName = body.documentName?.trim() || fileNameFromPath(storagePath);

  const targetIdentity = resolveDocumentTargetIdentity({
    orgId: guard.orgId,
    txId: body.txId,
    source: body.rowContext?.source,
    storagePath,
    documentKey,
  });
  if (!targetIdentity) {
    return errorResponse('INVALID_INPUT', 'La transacció i el document no són coherents.', 400);
  }

  const permissions = getMembershipPermissions(guard.membership);
  if (
    targetIdentity.source === 'bank'
    && (!permissions['sections.moviments'] || !canReadBankInProjectes(permissions))
  ) {
    return errorResponse('FORBIDDEN', 'No tens permisos per llegir documents de moviments.', 403);
  }

  const targetIsValid = await (deps.validateDocumentTargetFn ?? validateDocumentTarget)(
    db as unknown as DocumentTargetDbLike,
    targetIdentity
  );
  if (!targetIsValid) {
    return errorResponse('INVALID_INPUT', 'El document no està vinculat a aquesta transacció.', 400);
  }

  const apiKey = (deps.resolveApiKeyFn ?? resolveOpenAiApiKey)();
  if (!apiKey) {
    return errorResponse('AI_UNAVAILABLE', 'OpenAI API key not configured.');
  }

  const rateLimit = (deps.checkRateLimitFn ?? checkRateLimit)({
    key: `ai:document-review:${guard.auth.uid}:${guard.orgId}`,
    limit: 20,
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

  let loaded: LoadedDocument;
  try {
    loaded = await (deps.loadDocumentFn ?? loadDocumentFromStorage)(storagePath);
  } catch (error) {
    if (error instanceof DocumentTooLargeError) {
      return errorResponse('INVALID_INPUT', 'El document supera la mida màxima permesa.', 400);
    }
    console.error('[document-review-ai] Storage error:', error);
    return errorResponse('FETCH_ERROR', 'No s’ha pogut llegir el document de Storage.');
  }

  if (
    (loaded.metadataSize !== null && loaded.metadataSize > MAX_DOCUMENT_REVIEW_AI_BYTES)
    || loaded.buffer.byteLength > MAX_DOCUMENT_REVIEW_AI_BYTES
  ) {
    return errorResponse('INVALID_INPUT', 'El document supera la mida màxima permesa.', 400);
  }

  const contentType = inferDocumentReviewContentType({
    contentType: loaded.metadataContentType,
    filename: documentName,
    storagePath,
    buffer: loaded.buffer,
  });
  if (!contentType || !isSupportedDocumentReviewContentType(contentType)) {
    return errorResponse('UNSUPPORTED_FILE', 'Aquest tipus de document encara no es pot analitzar amb IA.', 400);
  }

  try {
    const detection = await (deps.analyzeDocumentFn ?? analyzeDocumentWithOpenAI)({
      apiKey,
      model: (deps.resolveModelFn ?? resolveOpenAiDocumentReviewModel)(),
      file: {
        filename: documentName,
        contentType,
        base64: loaded.buffer.toString('base64'),
      },
      rowContext: normalizeRowContext(body),
    });

    let persisted = false;
    try {
      persisted = await (deps.persistDetectionFn ?? persistDocumentReviewDetection)({
        orgId: guard.orgId,
        txId: body.txId,
        source: body.rowContext?.source === 'bank' ? 'bank' : 'offBank',
        storagePath,
        documentKey,
        documentName,
        detection,
      });
    } catch (persistError) {
      console.warn('[document-review-ai] Could not persist detection:', persistError);
    }

    return NextResponse.json({ ok: true, documentKey, persisted, detection });
  } catch (error) {
    if (error instanceof OpenAiDocumentReviewError) {
      return errorResponse(error.code, error.message, error.status);
    }

    console.error('[document-review-ai] Error:', error);
    return errorResponse('AI_ERROR', error instanceof Error ? error.message : 'No s’ha pogut analitzar el document.');
  }
}
