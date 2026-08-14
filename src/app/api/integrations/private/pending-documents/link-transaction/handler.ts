import { NextResponse, type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAdminApp, getAdminDb } from '@/lib/api/admin-sdk';
import {
  authenticateIntegrationRequest,
  createFirestoreIntegrationAuthRepository,
  recordIntegrationAudit,
  type IntegrationAuditResult,
  type IntegrationAuthRepository,
  type IntegrationContext,
} from '@/lib/api/integration-auth';
import { resolveServerEntitlement, type EntitlementDbLike } from '@/lib/api/require-entitlement';

const ROUTE_PATH = '/api/integrations/private/pending-documents/link-transaction';
const AMOUNT_TOLERANCE = 0.01;
export const LINKED_TRANSACTION_DOCUMENT_SIGNED_URL_EXPIRES = '03-01-2500';

type RequestLike = Pick<NextRequest, 'headers' | 'json' | 'nextUrl'>;

interface LinkInput {
  orgId: string;
  pendingDocumentId: string;
  transactionId: string;
  caseId: string;
  documentHash: string;
  expectedAmount: number;
  expectedDate: string;
  reviewerLabel: string;
  note: string;
}

export interface PendingDocumentLinkRecord {
  id: string;
  status: string;
  matchedTransactionId: string | null;
  amount: number | null;
  file: {
    storagePath: string | null;
    finalStoragePath: string | null;
    filename: string | null;
    sha256: string | null;
  } | null;
}

export interface TransactionLinkRecord {
  id: string;
  amount: number | null;
  date: string | null;
  document: string | null;
}

export interface PendingDocumentLinkStore {
  getPendingDocument(orgId: string, pendingDocumentId: string): Promise<PendingDocumentLinkRecord | null>;
  getTransaction(orgId: string, transactionId: string): Promise<TransactionLinkRecord | null>;
  linkDocumentToTransaction(args: {
    orgId: string;
    pendingDocumentId: string;
    transactionId: string;
    documentUrl: string;
    finalStoragePath: string;
    context: IntegrationContext;
    input: LinkInput;
  }): Promise<void>;
}

export interface PendingDocumentLinkStorage {
  ensureLinkedFile(args: {
    orgId: string;
    pendingDocumentId: string;
    transactionId: string;
    file: NonNullable<PendingDocumentLinkRecord['file']>;
  }): Promise<{ documentUrl: string; finalStoragePath: string; copied: boolean }>;
}

interface PendingDocumentLinkDeps {
  authRepository?: IntegrationAuthRepository;
  store?: PendingDocumentLinkStore;
  storage?: PendingDocumentLinkStorage;
  resolveEntitlementFn?: typeof resolveServerEntitlement;
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function cleanSha256(value: unknown): string | null {
  const raw = cleanString(value);
  if (!raw) return null;
  const normalized = raw.toLowerCase().replace(/^sha256:/, '');
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null;
}

function cleanAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function isIsoDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dateOnly(value: string | null): string | null {
  if (!value) return null;
  const candidate = value.slice(0, 10);
  return isIsoDateOnly(candidate) ? candidate : null;
}

function amountsMatch(left: number, right: number): boolean {
  return Math.abs(Math.abs(left) - Math.abs(right)) <= AMOUNT_TOLERANCE;
}

function storagePathBelongsToOrg(path: string | null, orgId: string): boolean {
  return typeof path === 'string' && path.startsWith(`organizations/${orgId}/`);
}

async function auditRoute(
  repository: IntegrationAuthRepository,
  audit: Awaited<ReturnType<typeof authenticateIntegrationRequest>>['audit'],
  result: IntegrationAuditResult,
  status: number,
  code: string,
  resourceId?: string | null
): Promise<void> {
  await recordIntegrationAudit(
    {
      ...audit,
      resourceId: resourceId ?? audit.resourceId ?? null,
      result,
      status,
      code,
    },
    repository
  );
}

async function parseInput(request: RequestLike, orgIdFromUrl: string): Promise<LinkInput | { code: string; status: 400 }> {
  let raw: Record<string, unknown>;
  try {
    raw = await request.json() as Record<string, unknown>;
  } catch {
    return { code: 'INVALID_JSON', status: 400 };
  }

  const orgId = cleanString(raw.orgId) ?? orgIdFromUrl;
  if (orgId !== orgIdFromUrl) {
    return { code: 'ORG_ID_MISMATCH', status: 400 };
  }

  const pendingDocumentId = cleanString(raw.pendingDocumentId);
  const transactionId = cleanString(raw.transactionId);
  const caseId = cleanString(raw.caseId);
  const documentHash = cleanSha256(raw.documentHash);
  const expectedAmount = cleanAmount(raw.expectedAmount);
  const expectedDate = cleanString(raw.expectedDate);
  const reviewerLabel = cleanString(raw.reviewerLabel);
  const note = cleanString(raw.note);

  if (!pendingDocumentId) return { code: 'MISSING_PENDING_DOCUMENT_ID', status: 400 };
  if (!transactionId) return { code: 'MISSING_TRANSACTION_ID', status: 400 };
  if (!caseId) return { code: 'MISSING_CASE_ID', status: 400 };
  if (!documentHash) return { code: 'INVALID_DOCUMENT_HASH', status: 400 };
  if (expectedAmount === null) return { code: 'INVALID_EXPECTED_AMOUNT', status: 400 };
  if (!expectedDate || !isIsoDateOnly(expectedDate)) return { code: 'INVALID_EXPECTED_DATE', status: 400 };
  if (!reviewerLabel) return { code: 'MISSING_REVIEWER_LABEL', status: 400 };
  if (!note) return { code: 'MISSING_NOTE', status: 400 };

  return {
    orgId,
    pendingDocumentId,
    transactionId,
    caseId,
    documentHash,
    expectedAmount,
    expectedDate,
    reviewerLabel,
    note,
  };
}

function createFirestoreLinkStore(): PendingDocumentLinkStore {
  const db = getAdminDb();

  return {
    async getPendingDocument(orgId, pendingDocumentId) {
      const snap = await db.doc(`organizations/${orgId}/pendingDocuments/${pendingDocumentId}`).get();
      if (!snap.exists) return null;
      const data = snap.data() ?? {};
      const file = data.file && typeof data.file === 'object'
        ? data.file as Record<string, unknown>
        : null;

      return {
        id: snap.id,
        status: typeof data.status === 'string' ? data.status : 'draft',
        matchedTransactionId: typeof data.matchedTransactionId === 'string' ? data.matchedTransactionId : null,
        amount: typeof data.amount === 'number' ? data.amount : null,
        file: file
          ? {
              storagePath: typeof file.storagePath === 'string' ? file.storagePath : null,
              finalStoragePath: typeof file.finalStoragePath === 'string' ? file.finalStoragePath : null,
              filename: typeof file.filename === 'string' ? file.filename : null,
              sha256: typeof file.sha256 === 'string' ? file.sha256 : null,
            }
          : null,
      };
    },

    async getTransaction(orgId, transactionId) {
      const snap = await db.doc(`organizations/${orgId}/transactions/${transactionId}`).get();
      if (!snap.exists) return null;
      const data = snap.data() ?? {};

      return {
        id: snap.id,
        amount: typeof data.amount === 'number' ? data.amount : null,
        date: typeof data.date === 'string' ? data.date : null,
        document: typeof data.document === 'string' && data.document.trim() ? data.document : null,
      };
    },

    async linkDocumentToTransaction({ orgId, pendingDocumentId, transactionId, documentUrl, finalStoragePath, context, input }) {
      const batch = db.batch();
      const pendingRef = db.doc(`organizations/${orgId}/pendingDocuments/${pendingDocumentId}`);
      const transactionRef = db.doc(`organizations/${orgId}/transactions/${transactionId}`);
      const transactionDocumentRef = transactionRef.collection('documents').doc();
      const nowIso = new Date().toISOString();

      batch.update(pendingRef, {
        status: 'matched',
        matchedTransactionId: transactionId,
        suggestedTransactionIds: [],
        'file.finalStoragePath': finalStoragePath,
        updatedAt: FieldValue.serverTimestamp(),
        integrationLinkMeta: {
          tokenId: context.tokenId,
          label: context.label,
          sourceRepo: context.sourceRepo,
          caseId: input.caseId,
          reviewerLabel: input.reviewerLabel,
          note: input.note,
          linkedVia: 'private_integration_api',
          linkedAt: FieldValue.serverTimestamp(),
        },
      });

      batch.update(transactionRef, {
        document: documentUrl,
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.set(transactionDocumentRef, {
        url: documentUrl,
        storagePath: finalStoragePath,
        filename: finalStoragePath.split('/').filter(Boolean).pop() ?? 'document',
        contentType: null,
        size: null,
        isPrimary: true,
        createdAt: nowIso,
        createdByUid: null,
        source: 'transaction-upload',
      });

      await batch.commit();
    },
  };
}

function createFirebaseLinkStorage(): PendingDocumentLinkStorage {
  const bucket = getStorage(getAdminApp()).bucket();

  return {
    async ensureLinkedFile({ orgId, pendingDocumentId, transactionId, file }) {
      if (!file.filename) {
        throw new Error('MISSING_FILE_NAME');
      }

      const finalStoragePath =
        file.finalStoragePath && storagePathBelongsToOrg(file.finalStoragePath, orgId)
          ? file.finalStoragePath
          : `organizations/${orgId}/documents/${transactionId}/${file.filename}`;

      const destination = bucket.file(finalStoragePath);
      const [destinationExists] = await destination.exists();
      let copied = false;

      if (!destinationExists) {
        const sourcePath = file.storagePath ?? `organizations/${orgId}/pendingDocuments/${pendingDocumentId}/${file.filename}`;
        if (!storagePathBelongsToOrg(sourcePath, orgId)) {
          throw new Error('STORAGE_PATH_OUTSIDE_ORG');
        }
        const source = bucket.file(sourcePath);
        const [sourceExists] = await source.exists();
        if (!sourceExists) {
          throw new Error('SOURCE_FILE_NOT_FOUND');
        }
        await source.copy(destination);
        copied = true;
      }

      const [documentUrl] = await destination.getSignedUrl({
        action: 'read',
        expires: LINKED_TRANSACTION_DOCUMENT_SIGNED_URL_EXPIRES,
      });

      return { documentUrl, finalStoragePath, copied };
    },
  };
}

async function validateAndLink(
  store: PendingDocumentLinkStore,
  storage: PendingDocumentLinkStorage,
  context: IntegrationContext,
  input: LinkInput
) {
  const pendingDocument = await store.getPendingDocument(input.orgId, input.pendingDocumentId);
  if (!pendingDocument) {
    return { ok: false as const, status: 404 as const, code: 'PENDING_DOCUMENT_NOT_FOUND' };
  }

  const transaction = await store.getTransaction(input.orgId, input.transactionId);
  if (!transaction) {
    return { ok: false as const, status: 404 as const, code: 'TRANSACTION_NOT_FOUND' };
  }

  const previous = {
    pendingStatus: pendingDocument.status,
    matchedTransactionId: pendingDocument.matchedTransactionId,
    transactionHadDocument: Boolean(transaction.document),
  };

  if (
    pendingDocument.matchedTransactionId &&
    pendingDocument.matchedTransactionId !== input.transactionId
  ) {
    return { ok: false as const, status: 409 as const, code: 'PENDING_DOCUMENT_ALREADY_MATCHED', previous };
  }

  if (transaction.document && pendingDocument.matchedTransactionId === input.transactionId) {
    return {
      ok: true as const,
      status: 200 as const,
      idempotent: true,
      copied: false,
      finalStoragePath: pendingDocument.file?.finalStoragePath ?? null,
      documentUrl: transaction.document,
      previous,
    };
  }

  if (transaction.document) {
    return { ok: false as const, status: 409 as const, code: 'TRANSACTION_ALREADY_HAS_DOCUMENT', previous };
  }

  if (!pendingDocument.file?.sha256) {
    return { ok: false as const, status: 409 as const, code: 'PENDING_DOCUMENT_WITHOUT_HASH', previous };
  }

  if (cleanSha256(pendingDocument.file.sha256) !== input.documentHash) {
    return { ok: false as const, status: 409 as const, code: 'DOCUMENT_HASH_MISMATCH', previous };
  }

  if (!storagePathBelongsToOrg(pendingDocument.file.storagePath, input.orgId)) {
    return { ok: false as const, status: 409 as const, code: 'STORAGE_PATH_OUTSIDE_ORG', previous };
  }

  if (pendingDocument.amount !== null && !amountsMatch(pendingDocument.amount, input.expectedAmount)) {
    return { ok: false as const, status: 409 as const, code: 'PENDING_AMOUNT_MISMATCH', previous };
  }

  if (transaction.amount === null || !amountsMatch(transaction.amount, input.expectedAmount)) {
    return { ok: false as const, status: 409 as const, code: 'TRANSACTION_AMOUNT_MISMATCH', previous };
  }

  if (dateOnly(transaction.date) !== input.expectedDate) {
    return { ok: false as const, status: 409 as const, code: 'TRANSACTION_DATE_MISMATCH', previous };
  }

  const linkedFile = await storage.ensureLinkedFile({
    orgId: input.orgId,
    pendingDocumentId: input.pendingDocumentId,
    transactionId: input.transactionId,
    file: pendingDocument.file,
  });

  await store.linkDocumentToTransaction({
    orgId: input.orgId,
    pendingDocumentId: input.pendingDocumentId,
    transactionId: input.transactionId,
    documentUrl: linkedFile.documentUrl,
    finalStoragePath: linkedFile.finalStoragePath,
    context,
    input,
  });

  return {
    ok: true as const,
    status: 200 as const,
    idempotent: false,
    copied: linkedFile.copied,
    finalStoragePath: linkedFile.finalStoragePath,
    documentUrl: linkedFile.documentUrl,
    previous,
  };
}

export async function handlePrivatePendingDocumentLinkTransaction(
  request: RequestLike,
  deps: PendingDocumentLinkDeps = {}
) {
  const authRepository = deps.authRepository ?? createFirestoreIntegrationAuthRepository(getAdminDb());
  const orgId = request.nextUrl.searchParams.get('orgId')?.trim() ?? null;
  const auth = await authenticateIntegrationRequest({
    request,
    orgId,
    requiredScope: 'pending_documents.link',
    route: `POST ${ROUTE_PATH}`,
    repository: authRepository,
  });

  if (!auth.ok) {
    const result = auth.code === 'ORG_NOT_ALLOWED'
      ? 'org_denied'
      : auth.code === 'SCOPE_DENIED'
        ? 'scope_denied'
        : auth.code === 'MISSING_ORG_ID'
          ? 'bad_request'
          : 'unauthorized';
    await auditRoute(authRepository, auth.audit, result, auth.status, auth.code);
    return NextResponse.json({ success: false, code: auth.code }, { status: auth.status });
  }

  const resolveEntitlementFn = deps.resolveEntitlementFn ?? resolveServerEntitlement;
  const entitlementDb = deps.resolveEntitlementFn
    ? ({} as EntitlementDbLike)
    : getAdminDb() as unknown as EntitlementDbLike;
  const [pendingEntitlement, transactionDocumentEntitlement] = await Promise.all([
    resolveEntitlementFn({
      db: entitlementDb,
      orgId: auth.context.orgId,
      capability: 'pendingDocuments.mutate',
      userAllowed: true,
    }),
    resolveEntitlementFn({
      db: entitlementDb,
      orgId: auth.context.orgId,
      capability: 'transactionDocuments.mutate',
      userAllowed: true,
    }),
  ]);
  if (!pendingEntitlement.allowed || !transactionDocumentEntitlement.allowed) {
    await auditRoute(authRepository, auth.audit, 'scope_denied', 403, 'ENTITLEMENT_DENIED');
    return NextResponse.json({ success: false, code: 'ENTITLEMENT_DENIED' }, { status: 403 });
  }

  const input = await parseInput(request, auth.context.orgId);
  if ('code' in input) {
    await auditRoute(authRepository, auth.audit, 'bad_request', input.status, input.code);
    return NextResponse.json({ success: false, code: input.code }, { status: input.status });
  }

  try {
    const store = deps.store ?? createFirestoreLinkStore();
    const storage = deps.storage ?? createFirebaseLinkStorage();
    const result = await validateAndLink(store, storage, auth.context, input);
    const resourceId = `${input.pendingDocumentId}:${input.transactionId}`;

    if (!result.ok) {
      const auditResult: IntegrationAuditResult = result.status === 404 ? 'not_found' : 'conflict';
      await auditRoute(authRepository, auth.audit, auditResult, result.status, result.code, resourceId);
      return NextResponse.json(
        { success: false, code: result.code, previousState: result.previous ?? null },
        { status: result.status }
      );
    }

    await auditRoute(
      authRepository,
      auth.audit,
      'allowed',
      result.status,
      result.idempotent ? 'IDEMPOTENT_OK' : 'LINKED',
      resourceId
    );

    return NextResponse.json(
      {
        success: true,
        linked: true,
        idempotent: result.idempotent,
        orgId: input.orgId,
        pendingDocumentId: input.pendingDocumentId,
        transactionId: input.transactionId,
        previousState: result.previous,
        newState: {
          pendingStatus: 'matched',
          matchedTransactionId: input.transactionId,
          transactionHasDocument: true,
        },
        storage: {
          finalStoragePath: result.finalStoragePath,
          copied: result.copied,
        },
      },
      { status: result.status }
    );
  } catch (error) {
    console.error('[private pending document link transaction] error', error);
    await auditRoute(authRepository, auth.audit, 'error', 500, 'INTERNAL_ERROR');
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
