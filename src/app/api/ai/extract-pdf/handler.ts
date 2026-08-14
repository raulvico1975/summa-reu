import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { resolveGoogleGenAiApiKey } from '@/ai/config';
import type { ExtractPdfInvoiceInput, ExtractPdfInvoiceOutput } from '@/ai/flows/extract-pdf-invoice';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { getAdminApp, getAdminDb } from '@/lib/api/admin-sdk';
import { requireOrgMembership } from '@/lib/api/request-guards';
import { getMembershipPermissions } from '@/lib/api/require-permission';
import { resolveServerEntitlement, type EntitlementDbLike } from '@/lib/api/require-entitlement';
import { matchSupplier } from '@/lib/suppliers/match-supplier';
import type { Contact } from '@/lib/data';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;
const MAX_PDF_BYTES = 15 * 1024 * 1024;

interface PdfFileLike {
  getMetadata(): Promise<[Record<string, unknown>]>;
  download(): Promise<[Buffer]>;
}

interface ExtractPdfDeps {
  requireOrgMembershipFn?: typeof requireOrgMembership;
  getAdminDbFn?: typeof getAdminDb;
  resolveEntitlementFn?: typeof resolveServerEntitlement;
  resolveApiKeyFn?: typeof resolveGoogleGenAiApiKey;
  checkRateLimitFn?: typeof checkRateLimit;
  extractPdfFn?: (input: ExtractPdfInvoiceInput) => Promise<ExtractPdfInvoiceOutput>;
  getFileFn?: (storagePath: string) => PdfFileLike;
  matchSupplierFn?: typeof matchSupplier;
}

function compactEvidence(output: ExtractPdfInvoiceOutput): Record<string, string> {
  return Object.fromEntries([
    ['invoiceNumber', output.invoiceNumber.evidence],
    ['invoiceDate', output.invoiceDate.evidence],
    ['amount', output.amount.evidence],
    ['supplierName', output.supplierName.evidence],
    ['supplierTaxId', output.supplierTaxId.evidence],
  ].filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0));
}

function containsUndefined(value: unknown): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.some(containsUndefined);
  if (value && typeof value === 'object') return Object.values(value).some(containsUndefined);
  return false;
}

function isNullableBoundedString(value: unknown, maxLength: number): boolean {
  return value === null || (typeof value === 'string' && value.length <= maxLength);
}

function isValidExtractedTextField(
  value: unknown,
  maxValueLength: number,
): value is { value: string | null; evidence: string | null } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const field = value as Record<string, unknown>;
  return isNullableBoundedString(field.value, maxValueLength)
    && isNullableBoundedString(field.evidence, 4_000);
}

function isValidPdfOutput(value: unknown): value is ExtractPdfInvoiceOutput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const output = value as Record<string, unknown>;
  if (!['invoice', 'payroll', 'receipt', 'unknown'].includes(String(output.docType))) return false;
  if (typeof output.confidence !== 'number' || !Number.isFinite(output.confidence)
    || output.confidence < 0 || output.confidence > 1) return false;
  if (!isValidExtractedTextField(output.invoiceNumber, 200)
    || !isValidExtractedTextField(output.invoiceDate, 32)
    || !isValidExtractedTextField(output.supplierName, 500)
    || !isValidExtractedTextField(output.supplierTaxId, 64)) return false;
  if (!output.amount || typeof output.amount !== 'object' || Array.isArray(output.amount)) return false;
  const amount = output.amount as Record<string, unknown>;
  return (amount.value === null || (typeof amount.value === 'number' && Number.isFinite(amount.value)))
    && isNullableBoundedString(amount.evidence, 4_000);
}

export async function handleExtractPdfPost(request: NextRequest, deps: ExtractPdfDeps = {}) {
  let body: Record<string, unknown>;
  try {
    const input = await request.json();
    body = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
  } catch {
    return NextResponse.json({ ok: false, code: 'INVALID_INPUT' }, { status: 400 });
  }
  if (Object.keys(body).some((key) => !['orgId', 'pendingDocumentId', 'storagePath', 'context'].includes(key))) {
    return NextResponse.json({ ok: false, code: 'INVALID_INPUT' }, { status: 400 });
  }
  const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';
  const pendingDocumentId = typeof body.pendingDocumentId === 'string' ? body.pendingDocumentId.trim() : '';
  const storagePath = typeof body.storagePath === 'string' ? body.storagePath : '';
  const context = body.context === 'movements' ? 'movements' : null;
  if (!ID_PATTERN.test(orgId) || !ID_PATTERN.test(pendingDocumentId) || !context || storagePath.length > 1024) {
    return NextResponse.json({ ok: false, code: 'INVALID_INPUT' }, { status: 400 });
  }

  const guard = await (deps.requireOrgMembershipFn ?? requireOrgMembership)(request, orgId);
  if (!guard.ok) return NextResponse.json({ ok: false, code: guard.code }, { status: guard.status });
  const permissions = getMembershipPermissions(guard.membership);
  const userAllowed = permissions['sections.moviments'] === true && permissions['moviments.editar'] === true;
  const db = (deps.getAdminDbFn ?? getAdminDb)();
  const entitlement = await (deps.resolveEntitlementFn ?? resolveServerEntitlement)({
    db: db as unknown as EntitlementDbLike,
    orgId,
    capability: 'pendingDocuments.ocr',
    userAllowed,
  });
  if (!entitlement.allowed) {
    return NextResponse.json({ ok: false, code: 'FORBIDDEN' }, { status: 403 });
  }

  const expectedPrefix = `organizations/${orgId}/pendingDocuments/${pendingDocumentId}/`;
  const basename = storagePath.slice(expectedPrefix.length);
  if (!storagePath.startsWith(expectedPrefix) || !basename || basename.includes('/')) {
    return NextResponse.json({ ok: false, code: 'INVALID_INPUT' }, { status: 400 });
  }

  const [organizationSnap, pendingSnap] = await Promise.all([
    db.doc(`organizations/${orgId}`).get(),
    db.doc(`organizations/${orgId}/pendingDocuments/${pendingDocumentId}`).get(),
  ]);
  if (!organizationSnap.exists || !pendingSnap.exists) {
    return NextResponse.json({ ok: false, code: 'NOT_FOUND' }, { status: 404 });
  }
  const organization = organizationSnap.data() ?? {};
  const pending = pendingSnap.data() ?? {};
  const fileData = pending.file && typeof pending.file === 'object' ? pending.file as Record<string, unknown> : {};
  if (fileData.storagePath !== storagePath) {
    return NextResponse.json({ ok: false, code: 'INVALID_INPUT' }, { status: 400 });
  }

  const apiKey = (deps.resolveApiKeyFn ?? resolveGoogleGenAiApiKey)();
  if (!apiKey) return NextResponse.json({ ok: false, code: 'AI_UNAVAILABLE' }, { status: 503 });
  const rate = (deps.checkRateLimitFn ?? checkRateLimit)({
    key: `ai:extract-pdf:${guard.auth.uid}:${orgId}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.allowed) return NextResponse.json({ ok: false, code: 'RATE_LIMITED' }, { status: 429 });

  const file = (deps.getFileFn ?? ((path) => getStorage(getAdminApp()).bucket().file(path) as unknown as PdfFileLike))(storagePath);
  let buffer: Buffer;
  try {
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size ?? 0);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_PDF_BYTES) {
      return NextResponse.json({ ok: false, code: 'INVALID_INPUT' }, { status: 400 });
    }
    [buffer] = await file.download();
  } catch {
    return NextResponse.json({ ok: false, code: 'STORAGE_ERROR' }, { status: 404 });
  }
  if (buffer.length > MAX_PDF_BYTES || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    return NextResponse.json({ ok: false, code: 'INVALID_PDF' }, { status: 400 });
  }

  if (!deps.extractPdfFn) return NextResponse.json({ ok: false, code: 'AI_UNAVAILABLE' }, { status: 503 });
  const output: unknown = await deps.extractPdfFn({
    pdfBase64: buffer.toString('base64'),
    orgLegalName: typeof organization.name === 'string' ? organization.name : '',
    orgTaxId: typeof organization.taxId === 'string' ? organization.taxId : '',
  });
  if (!isValidPdfOutput(output)) {
    return NextResponse.json({ ok: false, code: 'INVALID_AI_OUTPUT' }, { status: 502 });
  }
  if (output.confidence < 0.3 || output.docType === 'unknown') {
    return NextResponse.json({ ok: true, extracted: false });
  }

  const contactsSnap = await db.collection(`organizations/${orgId}/contacts`).get();
  const contacts = contactsSnap.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() } as Contact));
  const supplierId = (deps.matchSupplierFn ?? matchSupplier)({
    taxId: output.supplierTaxId.value ?? undefined,
    name: output.supplierName.value ?? undefined,
  }, contacts);
  const supplier = supplierId ? contacts.find((contact) => contact.id === supplierId) : null;
  const categoryId = supplier?.defaultCategoryId || null;
  const pendingRef = db.doc(`organizations/${orgId}/pendingDocuments/${pendingDocumentId}`);
  try {
    await db.runTransaction(async (transaction) => {
      const currentSnap = await transaction.get(pendingRef);
      const current = currentSnap.exists ? currentSnap.data() ?? {} : null;
      const currentFile = current?.file && typeof current.file === 'object' ? current.file as Record<string, unknown> : {};
      if (!current || currentFile.storagePath !== storagePath) throw new Error('PENDING_DOCUMENT_CHANGED');
      const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
      if (current.extracted === null) {
        updates.extracted = {
          source: 'ai',
          confidence: output.confidence >= 0.8 ? 'high' : output.confidence >= 0.5 ? 'medium' : 'low',
          evidence: compactEvidence(output),
        };
      }
      if (current.type === 'unknown') updates.type = output.docType;
      if (current.invoiceNumber === null && output.invoiceNumber.value) updates.invoiceNumber = output.invoiceNumber.value;
      if (current.invoiceDate === null && output.invoiceDate.value) updates.invoiceDate = output.invoiceDate.value;
      if (current.amount === null && output.amount.value !== null) updates.amount = output.amount.value;
      if (current.supplierId === null && supplierId) updates.supplierId = supplierId;
      if (current.categoryId === null && categoryId) updates.categoryId = categoryId;
      if (containsUndefined(updates)) throw new Error('INVALID_AI_OUTPUT');
      transaction.update(pendingRef, updates as FirebaseFirestore.UpdateData<Record<string, unknown>>);
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'WRITE_FAILED';
    return NextResponse.json({ ok: false, code }, { status: code === 'PENDING_DOCUMENT_CHANGED' ? 409 : 500 });
  }
  return NextResponse.json({ ok: true, extracted: true });
}
