import { buildPendingDocumentStorageIdentity } from '@/lib/server/pending-document-storage-identity';
import { parseFirebaseStorageDownloadUrl } from '@/lib/security/storage-url';

export interface TransactionDocumentAuditRecord {
  organizationId: string;
  transactionId: string;
  mirrorDocument: string | null;
  documents: Array<{
    id: string;
    url: string;
    storagePath: string | null;
    isPrimary: boolean;
    source?: 'transaction-upload' | 'legacy-document';
  }>;
  storageObjectPaths?: string[];
  pendingDocumentStorageReferences?: Array<{
    organizationId: string;
    transactionId: string;
    pendingDocumentId: string;
    status: string;
    filename: string;
    finalStoragePath: string;
  }>;
  registry?: {
    hasDocuments?: boolean;
    documentCount?: number;
    primaryDocumentId?: string | null;
    registryVersion?: number;
    pendingStorageCleanupPaths?: string[];
  } | null;
}

export type TransactionDocumentInconsistencyCode =
  | 'MIRROR_WITHOUT_METADATA'
  | 'METADATA_WITHOUT_REGISTRY'
  | 'REGISTRY_WITHOUT_METADATA'
  | 'REGISTRY_COUNT_MISMATCH'
  | 'PRIMARY_MISMATCH'
  | 'REGISTRY_HAS_DOCUMENTS_MISMATCH'
  | 'REGISTRY_VERSION_MISMATCH'
  | 'NO_PRIMARY'
  | 'MULTIPLE_PRIMARIES'
  | 'MIRROR_PRIMARY_MISMATCH'
  | 'STORAGE_ORPHAN'
  | 'METADATA_STORAGE_MISSING'
  | 'LEGACY_TARGET_UNVERIFIED'
  | 'PATH_OUTSIDE_TRANSACTION'
  | 'URL_PATH_IDENTITY_MISMATCH'
  | 'DUPLICATE_STORAGE_IDENTITY'
  | 'STORAGE_CLEANUP_PENDING';

export interface TransactionDocumentAuditFinding {
  organizationId: string;
  transactionId: string;
  codes: TransactionDocumentInconsistencyCode[];
  deletableVulnerability: boolean;
  proposedRegistry: {
    hasDocuments: true;
    documentCount: number;
    primaryDocumentId: string | null;
    registryVersion: 1;
  } | null;
}

export interface TransactionDocumentAuditReport {
  dryRun: true;
  canActivate: boolean;
  scanned: number;
  consistent: number;
  findings: TransactionDocumentAuditFinding[];
  proposedWrites: number;
  chunks: TransactionDocumentAuditFinding[][];
}

/** Read-only, deterministic audit. It never receives a Firestore client. */
export function auditTransactionDocumentRegistry(
  records: TransactionDocumentAuditRecord[]
): TransactionDocumentAuditReport {
  const findings = records.flatMap((record) => {
    const codes: TransactionDocumentInconsistencyCode[] = [];
    const documents = [...new Map(record.documents.map((document) => [document.id, document])).values()]
      .sort((a, b) => a.id.localeCompare(b.id));
    const uniqueDocumentIds = documents.map((document) => document.id);
    const primaries = documents.filter((document) => document.isPrimary);
    const primaryIds = primaries.map((document) => document.id);
    const count = uniqueDocumentIds.length;
    const registry = record.registry ?? null;

    if (record.mirrorDocument && count === 0) codes.push('MIRROR_WITHOUT_METADATA');
    if (count > 0 && !registry) codes.push('METADATA_WITHOUT_REGISTRY');
    if (count === 0 && registry) codes.push('REGISTRY_WITHOUT_METADATA');
    if (registry && registry.documentCount !== count) codes.push('REGISTRY_COUNT_MISMATCH');
    if (registry && registry.hasDocuments !== (count > 0)) codes.push('REGISTRY_HAS_DOCUMENTS_MISMATCH');
    if (registry && registry.registryVersion !== 1) codes.push('REGISTRY_VERSION_MISMATCH');
    if (registry && Array.isArray(registry.pendingStorageCleanupPaths)
      && registry.pendingStorageCleanupPaths.length > 0) codes.push('STORAGE_CLEANUP_PENDING');
    if (count > 0 && primaries.length === 0) codes.push('NO_PRIMARY');
    if (primaries.length > 1) codes.push('MULTIPLE_PRIMARIES');
    const expectedPrimary = primaryIds[0] ?? null;
    if (registry && (registry.primaryDocumentId ?? null) !== expectedPrimary) codes.push('PRIMARY_MISMATCH');
    const primaryDocument = primaries.length === 1 ? primaries[0] : null;
    if ((record.mirrorDocument ?? null) !== (primaryDocument?.url ?? null)) codes.push('MIRROR_PRIMARY_MISMATCH');
    const storagePaths = new Set(record.storageObjectPaths ?? []);
    const metadataPaths = new Set(documents.flatMap((document) => document.storagePath ? [document.storagePath] : []));
    const metadataPathCounts = new Map<string, number>();
    for (const document of documents) {
      if (!document.storagePath) continue;
      metadataPathCounts.set(document.storagePath, (metadataPathCounts.get(document.storagePath) ?? 0) + 1);
      const parsedUrl = parseFirebaseStorageDownloadUrl(document.url);
      if (parsedUrl && parsedUrl.storagePath !== document.storagePath) {
        codes.push('URL_PATH_IDENTITY_MISMATCH');
      }
    }
    if ([...metadataPathCounts.values()].some((value) => value > 1)) {
      codes.push('DUPLICATE_STORAGE_IDENTITY');
    }
    const confirmedPendingPaths = new Set((record.pendingDocumentStorageReferences ?? []).flatMap((reference) => {
      if (reference.status !== 'confirmed'
        || reference.organizationId !== record.organizationId
        || reference.transactionId !== record.transactionId) return [];
      const identity = buildPendingDocumentStorageIdentity({
        orgId: reference.organizationId,
        pendingDocumentId: reference.pendingDocumentId,
        transactionId: reference.transactionId,
        filename: reference.filename,
      });
      return identity && reference.finalStoragePath === identity.finalPath
        ? [reference.finalStoragePath]
        : [];
    }));
    const transactionStoragePrefix = `organizations/${record.organizationId}/documents/${record.transactionId}/`;
    if ([...metadataPaths, ...storagePaths].some((path) => !path.startsWith(transactionStoragePrefix))) {
      codes.push('PATH_OUTSIDE_TRANSACTION');
    }
    if ([...storagePaths].some((path) => !metadataPaths.has(path) && !confirmedPendingPaths.has(path))) {
      codes.push('STORAGE_ORPHAN');
    }
    if ([...metadataPaths].some((path) => !storagePaths.has(path))) codes.push('METADATA_STORAGE_MISSING');
    if (documents.some((document) => document.source === 'legacy-document' && !document.storagePath)) {
      codes.push('LEGACY_TARGET_UNVERIFIED');
    }
    const uniqueCodes = [...new Set(codes)];
    if (uniqueCodes.length === 0) return [];

    return [{
      organizationId: record.organizationId,
      transactionId: record.transactionId,
      codes: uniqueCodes,
      deletableVulnerability: (count > 0 || Boolean(record.mirrorDocument) || storagePaths.size > 0)
        && (!registry || registry.hasDocuments !== true || registry.registryVersion !== 1),
      proposedRegistry: count > 0 ? {
        hasDocuments: true as const,
        documentCount: count,
        primaryDocumentId: expectedPrimary,
        registryVersion: 1 as const,
      } : null,
    }];
  });

  const chunks: TransactionDocumentAuditFinding[][] = [];
  for (let index = 0; index < findings.length; index += 50) {
    chunks.push(findings.slice(index, index + 50));
  }
  return {
    dryRun: true,
    canActivate: findings.length === 0,
    scanned: records.length,
    consistent: records.length - findings.length,
    findings,
    proposedWrites: findings.length,
    chunks,
  };
}
