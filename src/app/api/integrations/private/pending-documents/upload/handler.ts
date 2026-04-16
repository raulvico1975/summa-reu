import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminApp, getAdminDb } from '@/lib/api/admin-sdk';
import {
  authenticateIntegrationRequest,
  createFirestoreIntegrationAuthRepository,
  hashOpaqueValue,
  recordIntegrationAudit,
  type IntegrationAuditResult,
  type IntegrationAuthRepository,
  type IntegrationContext,
} from '@/lib/api/integration-auth';

const ROUTE_PATH = '/api/integrations/private/pending-documents/upload';
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const INTEGRATION_IDEMPOTENCY_COLLECTION = 'integrationIdempotency';

type RequestLike = Pick<NextRequest, 'headers' | 'formData' | 'nextUrl'>;

interface UploadFormInput {
  orgId: string | null;
  file: File | null;
  supplierName: string | null;
  invoiceDate: string | null;
  amount: number | null;
  sourceRepo: string | null;
  externalMessageId: string | null;
  idempotencyKey: string | null;
}

interface PreparedUploadInput {
  orgId: string;
  file: {
    name: string;
    contentType: string;
    sizeBytes: number;
    bytes: Buffer;
    sha256: string;
  };
  supplierName: string | null;
  invoiceDate: string | null;
  amount: number | null;
  sourceRepo: string | null;
  externalMessageId: string | null;
  idempotencyKey: string;
}

interface UploadIdempotencyClaim {
  kind: 'new' | 'pending' | 'completed' | 'conflict';
  pendingDocumentId: string;
}

interface PendingDocumentStoredRecord {
  id: string;
  status: string;
  type: string;
  file: {
    storagePath: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    sha256: string | null;
  };
  invoiceDate: string | null;
  amount: number | null;
  integrationMeta: {
    sourceRepo: string | null;
    externalMessageId: string | null;
    supplierName: string | null;
  } | null;
}

export interface PendingDocumentsUploadStore {
  claimIdempotency(args: {
    idempotencyId: string;
    requestHash: string;
    pendingDocumentId: string;
    context: IntegrationContext;
    route: string;
  }): Promise<UploadIdempotencyClaim>;
  getPendingDocument(orgId: string, pendingDocumentId: string): Promise<PendingDocumentStoredRecord | null>;
  createPendingDocument(args: {
    orgId: string;
    pendingDocumentId: string;
    context: IntegrationContext;
    input: PreparedUploadInput;
    storagePath: string;
  }): Promise<'created' | 'existing'>;
  markCompleted(args: {
    idempotencyId: string;
    pendingDocumentId: string;
  }): Promise<void>;
}

export interface PendingDocumentsUploadStorage {
  saveFile(args: {
    storagePath: string;
    bytes: Buffer;
    contentType: string;
  }): Promise<void>;
}

interface PendingDocumentsUploadDeps {
  authRepository?: IntegrationAuthRepository;
  store?: PendingDocumentsUploadStore;
  storage?: PendingDocumentsUploadStorage;
}

function normalizeOptionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseOptionalAmount(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseUploadInput(formData: FormData, headers: Headers): UploadFormInput {
  const fileEntry = formData.get('file');
  return {
    orgId: normalizeOptionalString(formData.get('orgId')),
    file: fileEntry instanceof File ? fileEntry : null,
    supplierName: normalizeOptionalString(formData.get('supplierName')),
    invoiceDate: normalizeOptionalString(formData.get('invoiceDate')),
    amount: parseOptionalAmount(formData.get('amount')),
    sourceRepo: normalizeOptionalString(formData.get('sourceRepo')),
    externalMessageId: normalizeOptionalString(formData.get('externalMessageId')),
    idempotencyKey: headers.get('Idempotency-Key')?.trim() || null,
  };
}

function sanitizeFilename(filename: string): string {
  const trimmed = filename.trim();
  if (!trimmed) return 'document.bin';

  return trimmed
    .replace(/[\\/]/g, '-')
    .replace(/[^\w.\-() ]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 180) || 'document.bin';
}

function sha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function buildIdempotencyId(
  context: IntegrationContext,
  orgId: string,
  idempotencyKey: string
): string {
  return hashOpaqueValue(
    JSON.stringify({
      v: 1,
      tokenId: context.tokenId,
      orgId,
      route: ROUTE_PATH,
      idempotencyKey,
    })
  );
}

function buildUploadRequestHash(input: PreparedUploadInput): string {
  return hashOpaqueValue(
    JSON.stringify({
      v: 1,
      orgId: input.orgId,
      filename: input.file.name,
      contentType: input.file.contentType,
      sizeBytes: input.file.sizeBytes,
      sha256: input.file.sha256,
      supplierName: input.supplierName,
      invoiceDate: input.invoiceDate,
      amount: input.amount,
      sourceRepo: input.sourceRepo,
      externalMessageId: input.externalMessageId,
    })
  );
}

function buildPendingDocumentId(idempotencyId: string): string {
  return `intpd_${idempotencyId.slice(0, 28)}`;
}

function buildStoragePath(orgId: string, pendingDocumentId: string, filename: string): string {
  return `organizations/${orgId}/pendingDocuments/${pendingDocumentId}/${sanitizeFilename(filename)}`;
}

function isIsoDateOnly(value: string | null): boolean {
  return value == null || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toPendingDocumentResponse(record: PendingDocumentStoredRecord) {
  return {
    id: record.id,
    status: record.status,
    type: record.type,
    file: {
      filename: record.file.filename,
      contentType: record.file.contentType,
      sizeBytes: record.file.sizeBytes,
      sha256: record.file.sha256,
    },
    invoiceDate: record.invoiceDate,
    amount: record.amount,
    supplierName: record.integrationMeta?.supplierName ?? null,
    sourceRepo: record.integrationMeta?.sourceRepo ?? null,
    externalMessageId: record.integrationMeta?.externalMessageId ?? null,
  };
}

function createFieldSources(input: PreparedUploadInput) {
  const fieldSources: Record<string, 'manual'> = {};
  if (input.invoiceDate) fieldSources.invoiceDate = 'manual';
  if (input.amount !== null) fieldSources.amount = 'manual';
  return Object.keys(fieldSources).length > 0 ? fieldSources : null;
}

function createFirestoreUploadStore(): PendingDocumentsUploadStore {
  const db = getAdminDb();

  return {
    async claimIdempotency({ idempotencyId, requestHash, pendingDocumentId, context, route }) {
      const ref = db.doc(`${INTEGRATION_IDEMPOTENCY_COLLECTION}/${idempotencyId}`);

      return db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists) {
          transaction.create(ref, {
            status: 'pending',
            requestHash,
            pendingDocumentId,
            tokenId: context.tokenId,
            orgId: context.orgId,
            route,
            scope: context.scope,
            sourceRepo: context.sourceRepo,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });

          return {
            kind: 'new',
            pendingDocumentId,
          } satisfies UploadIdempotencyClaim;
        }

        const data = snap.data() ?? {};
        if (typeof data.requestHash !== 'string' || data.requestHash !== requestHash) {
          return {
            kind: 'conflict',
            pendingDocumentId,
          } satisfies UploadIdempotencyClaim;
        }

        return {
          kind: data.status === 'completed' ? 'completed' : 'pending',
          pendingDocumentId:
            typeof data.pendingDocumentId === 'string' ? data.pendingDocumentId : pendingDocumentId,
        } satisfies UploadIdempotencyClaim;
      });
    },

    async getPendingDocument(orgId, pendingDocumentId) {
      const snap = await db.doc(`organizations/${orgId}/pendingDocuments/${pendingDocumentId}`).get();
      if (!snap.exists) return null;

      const data = snap.data() ?? {};
      const file = data.file && typeof data.file === 'object'
        ? (data.file as Record<string, unknown>)
        : {};
      const integrationMeta = data.integrationMeta && typeof data.integrationMeta === 'object'
        ? (data.integrationMeta as Record<string, unknown>)
        : null;

      return {
        id: snap.id,
        status: typeof data.status === 'string' ? data.status : 'draft',
        type: typeof data.type === 'string' ? data.type : 'unknown',
        file: {
          storagePath: typeof file.storagePath === 'string' ? file.storagePath : '',
          filename: typeof file.filename === 'string' ? file.filename : '',
          contentType: typeof file.contentType === 'string'
            ? file.contentType
            : 'application/octet-stream',
          sizeBytes: typeof file.sizeBytes === 'number' ? file.sizeBytes : 0,
          sha256: typeof file.sha256 === 'string' ? file.sha256 : null,
        },
        invoiceDate: typeof data.invoiceDate === 'string' ? data.invoiceDate : null,
        amount: typeof data.amount === 'number' ? data.amount : null,
        integrationMeta: integrationMeta
          ? {
              sourceRepo:
                typeof integrationMeta.sourceRepo === 'string' ? integrationMeta.sourceRepo : null,
              externalMessageId:
                typeof integrationMeta.externalMessageId === 'string'
                  ? integrationMeta.externalMessageId
                  : null,
              supplierName:
                typeof integrationMeta.supplierName === 'string'
                  ? integrationMeta.supplierName
                  : null,
            }
          : null,
      };
    },

    async createPendingDocument({ orgId, pendingDocumentId, context, input, storagePath }) {
      const fieldSources = createFieldSources(input);
      const ref = db.doc(`organizations/${orgId}/pendingDocuments/${pendingDocumentId}`);

      try {
        await ref.create({
          status: 'draft',
          type: 'unknown',
          file: {
            storagePath,
            filename: input.file.name,
            contentType: input.file.contentType,
            sizeBytes: input.file.sizeBytes,
            sha256: input.file.sha256,
          },
          invoiceNumber: null,
          invoiceDate: input.invoiceDate,
          amount: input.amount,
          supplierId: null,
          categoryId: null,
          extracted: null,
          fieldSources,
          sepa: null,
          matchedTransactionId: null,
          reportId: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          confirmedAt: null,
          integrationMeta: {
            tokenId: context.tokenId,
            label: context.label,
            sourceRepo: input.sourceRepo,
            externalMessageId: input.externalMessageId,
            supplierName: input.supplierName,
            idempotencyKeyHash: `sha256:${hashOpaqueValue(input.idempotencyKey)}`,
            uploadedVia: 'private_integration_api',
          },
        });

        return 'created';
      } catch (error) {
        if (error instanceof Error && error.message.toLowerCase().includes('already exists')) {
          return 'existing';
        }
        throw error;
      }
    },

    async markCompleted({ idempotencyId, pendingDocumentId }) {
      await db.doc(`${INTEGRATION_IDEMPOTENCY_COLLECTION}/${idempotencyId}`).set(
        {
          status: 'completed',
          pendingDocumentId,
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    },
  };
}

function createFirebaseUploadStorage(): PendingDocumentsUploadStorage {
  const bucket = getStorage(getAdminApp()).bucket();

  return {
    async saveFile({ storagePath, bytes, contentType }) {
      const file = bucket.file(storagePath);
      await file.save(bytes, {
        resumable: false,
        metadata: {
          contentType,
          cacheControl: 'private, max-age=0, no-store',
        },
      });
    },
  };
}

async function auditRoute(
  repository: IntegrationAuthRepository,
  audit: Awaited<ReturnType<typeof authenticateIntegrationRequest>>['audit'],
  result: IntegrationAuditResult,
  status: number,
  code: string,
  metadata: {
    requestKeyHash?: string | null;
    resourceId?: string | null;
  } = {}
): Promise<void> {
  await recordIntegrationAudit(
    {
      ...audit,
      requestKeyHash: metadata.requestKeyHash ?? audit.requestKeyHash ?? null,
      resourceId: metadata.resourceId ?? audit.resourceId ?? null,
      result,
      status,
      code,
    },
    repository
  );
}

async function prepareUploadInput(
  raw: UploadFormInput,
  context: IntegrationContext
): Promise<PreparedUploadInput | { error: { code: string; message: string } }> {
  if (!raw.file) {
    return { error: { code: 'MISSING_FILE', message: 'file is required' } };
  }

  if (!raw.idempotencyKey) {
    return { error: { code: 'MISSING_IDEMPOTENCY_KEY', message: 'Idempotency-Key header is required' } };
  }

  if (raw.file.size <= 0) {
    return { error: { code: 'EMPTY_FILE', message: 'file must not be empty' } };
  }

  if (raw.file.size > MAX_FILE_BYTES) {
    return { error: { code: 'FILE_TOO_LARGE', message: 'file exceeds 20MB limit' } };
  }

  if (!isIsoDateOnly(raw.invoiceDate)) {
    return { error: { code: 'INVALID_INVOICE_DATE', message: 'invoiceDate must be YYYY-MM-DD' } };
  }

  if (raw.amount !== null && !Number.isFinite(raw.amount)) {
    return { error: { code: 'INVALID_AMOUNT', message: 'amount must be a finite number' } };
  }

  if (context.sourceRepo && raw.sourceRepo && context.sourceRepo !== raw.sourceRepo) {
    return { error: { code: 'SOURCE_REPO_MISMATCH', message: 'sourceRepo does not match token metadata' } };
  }

  const bytes = Buffer.from(await raw.file.arrayBuffer());
  const safeFileName = sanitizeFilename(raw.file.name);

  return {
    orgId: raw.orgId ?? context.orgId,
    file: {
      name: safeFileName,
      contentType: raw.file.type || 'application/octet-stream',
      sizeBytes: raw.file.size,
      bytes,
      sha256: sha256Hex(bytes),
    },
    supplierName: raw.supplierName,
    invoiceDate: raw.invoiceDate,
    amount: raw.amount,
    sourceRepo: raw.sourceRepo ?? context.sourceRepo ?? null,
    externalMessageId: raw.externalMessageId,
    idempotencyKey: raw.idempotencyKey,
  };
}

export async function uploadPendingDocument(
  store: PendingDocumentsUploadStore,
  storage: PendingDocumentsUploadStorage,
  context: IntegrationContext,
  input: PreparedUploadInput
): Promise<{ status: number; idempotent: boolean; pendingDocument: ReturnType<typeof toPendingDocumentResponse> } | { status: 409; conflict: true }> {
  const idempotencyId = buildIdempotencyId(context, input.orgId, input.idempotencyKey);
  const pendingDocumentId = buildPendingDocumentId(idempotencyId);
  const requestHash = buildUploadRequestHash(input);
  const claim = await store.claimIdempotency({
    idempotencyId,
    requestHash,
    pendingDocumentId,
    context,
    route: ROUTE_PATH,
  });

  if (claim.kind === 'conflict') {
    return { status: 409, conflict: true };
  }

  const resolvedPendingDocumentId = claim.pendingDocumentId;
  const existing = await store.getPendingDocument(input.orgId, resolvedPendingDocumentId);
  if (existing) {
    await store.markCompleted({
      idempotencyId,
      pendingDocumentId: resolvedPendingDocumentId,
    });

    return {
      status: 200,
      idempotent: true,
      pendingDocument: toPendingDocumentResponse(existing),
    };
  }

  const storagePath = buildStoragePath(input.orgId, resolvedPendingDocumentId, input.file.name);
  await storage.saveFile({
    storagePath,
    bytes: input.file.bytes,
    contentType: input.file.contentType,
  });

  await store.createPendingDocument({
    orgId: input.orgId,
    pendingDocumentId: resolvedPendingDocumentId,
    context,
    input,
    storagePath,
  });
  await store.markCompleted({ idempotencyId, pendingDocumentId: resolvedPendingDocumentId });

  const created = await store.getPendingDocument(input.orgId, resolvedPendingDocumentId);
  if (!created) {
    throw new Error('Pending document missing after create');
  }

  return {
    status: claim.kind === 'new' ? 201 : 200,
    idempotent: claim.kind !== 'new',
    pendingDocument: toPendingDocumentResponse(created),
  };
}

export async function handlePrivatePendingDocumentsUpload(
  request: RequestLike,
  deps: PendingDocumentsUploadDeps = {}
) {
  const authRepository = deps.authRepository ?? createFirestoreIntegrationAuthRepository(getAdminDb());
  const idempotencyKeyHeader = request.headers.get('Idempotency-Key')?.trim() || null;
  const requestKeyHash = idempotencyKeyHeader
    ? `sha256:${hashOpaqueValue(idempotencyKeyHeader)}`
    : null;
  const orgId = request.nextUrl.searchParams.get('orgId')?.trim() ?? null;
  const auth = await authenticateIntegrationRequest({
    request,
    orgId,
    requiredScope: 'pending_documents.write',
    route: `POST ${ROUTE_PATH}`,
    repository: authRepository,
  });

  if (!auth.ok) {
    await auditRoute(
      authRepository,
      auth.audit,
      auth.code === 'ORG_NOT_ALLOWED'
        ? 'org_denied'
        : auth.code === 'SCOPE_DENIED'
          ? 'scope_denied'
          : auth.code === 'MISSING_ORG_ID'
            ? 'bad_request'
            : 'unauthorized',
      auth.status,
      auth.code,
      { requestKeyHash }
    );

    return NextResponse.json(
      { success: false, code: auth.code },
      { status: auth.status }
    );
  }

  const formData = await request.formData();
  const rawInput = parseUploadInput(formData, request.headers);
  if (rawInput.orgId && rawInput.orgId !== auth.context.orgId) {
    await auditRoute(authRepository, auth.audit, 'bad_request', 400, 'ORG_ID_MISMATCH', {
      requestKeyHash,
    });
    return NextResponse.json(
      { success: false, code: 'ORG_ID_MISMATCH', error: 'orgId form field must match URL orgId' },
      { status: 400 }
    );
  }

  const prepared = await prepareUploadInput(rawInput, auth.context);
  if ('error' in prepared) {
    await auditRoute(authRepository, auth.audit, 'bad_request', 400, prepared.error.code, {
      requestKeyHash,
    });
    return NextResponse.json(
      { success: false, code: prepared.error.code, error: prepared.error.message },
      { status: 400 }
    );
  }

  try {
    const store = deps.store ?? createFirestoreUploadStore();
    const storage = deps.storage ?? createFirebaseUploadStorage();
    const result = await uploadPendingDocument(store, storage, auth.context, prepared);

    if ('conflict' in result) {
      await auditRoute(authRepository, auth.audit, 'conflict', 409, 'IDEMPOTENCY_CONFLICT', {
        requestKeyHash,
      });
      return NextResponse.json(
        { success: false, code: 'IDEMPOTENCY_CONFLICT' },
        { status: 409 }
      );
    }

    await auditRoute(
      authRepository,
      auth.audit,
      'allowed',
      result.status,
      result.idempotent ? 'IDEMPOTENT_OK' : 'CREATED',
      {
        requestKeyHash,
        resourceId: result.pendingDocument.id,
      }
    );
    return NextResponse.json(
      {
        success: true,
        idempotent: result.idempotent,
        pendingDocument: result.pendingDocument,
      },
      { status: result.status }
    );
  } catch (error) {
    console.error('[private pending document upload] error', error);
    await auditRoute(authRepository, auth.audit, 'error', 500, 'INTERNAL_ERROR', {
      requestKeyHash,
    });
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
