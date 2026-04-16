import { createHash, timingSafeEqual } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/api/admin-sdk';

export const INTEGRATION_TOKENS_COLLECTION = 'integrationTokens';
export const INTEGRATION_AUDIT_LOGS_COLLECTION = 'integrationAuditLogs';
export const PRIVATE_INTEGRATION_TOKEN_TYPE = 'private_integration';

export type IntegrationScope =
  | 'contacts.read'
  | 'transactions.read'
  | 'pending_documents.write';

export type IntegrationTokenStatus = 'active' | 'revoked';

export interface IntegrationTokenRecord {
  id: string;
  tokenType: typeof PRIVATE_INTEGRATION_TOKEN_TYPE;
  orgId: string;
  tokenHash: string;
  scopes: IntegrationScope[];
  status: IntegrationTokenStatus;
  createdAt: unknown;
  createdBy: string;
  lastUsedAt: unknown | null;
  label: string;
  sourceRepo: string | null;
}

export interface IntegrationContext {
  tokenId: string;
  label: string;
  sourceRepo: string | null;
  orgId: string;
  scope: IntegrationScope;
}

export interface IntegrationAuditBase {
  tokenId: string | null;
  label: string | null;
  sourceRepo: string | null;
  orgId: string | null;
  route: string;
  scope: IntegrationScope;
  requestKeyHash?: string | null;
  resourceId?: string | null;
}

export type IntegrationAuditResult =
  | 'allowed'
  | 'unauthorized'
  | 'org_denied'
  | 'scope_denied'
  | 'bad_request'
  | 'conflict'
  | 'not_found'
  | 'error';

export interface IntegrationAuditEntry extends IntegrationAuditBase {
  result: IntegrationAuditResult;
  code: string;
  status: number;
}

export interface IntegrationAuthRepository {
  findTokenByHash(tokenHash: string): Promise<IntegrationTokenRecord | null>;
  touchTokenLastUsed(tokenId: string): Promise<void>;
  recordAudit(entry: IntegrationAuditEntry): Promise<void>;
}

export interface IntegrationRequestLike {
  headers: Headers;
}

export interface AuthenticateIntegrationRequestArgs {
  request: IntegrationRequestLike;
  orgId: string | null | undefined;
  requiredScope: IntegrationScope;
  route: string;
  repository?: IntegrationAuthRepository;
}

export type IntegrationAuthFailureCode =
  | 'MISSING_ORG_ID'
  | 'UNAUTHORIZED'
  | 'ORG_NOT_ALLOWED'
  | 'SCOPE_DENIED';

export type IntegrationAuthResult =
  | {
      ok: true;
      context: IntegrationContext;
      audit: IntegrationAuditBase;
    }
  | {
      ok: false;
      status: 400 | 401 | 403;
      code: IntegrationAuthFailureCode;
      audit: IntegrationAuditBase;
    };

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeScopes(value: unknown): IntegrationScope[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (scope): scope is IntegrationScope =>
      scope === 'contacts.read' ||
      scope === 'transactions.read' ||
      scope === 'pending_documents.write'
  );
}

function toTokenRecord(
  id: string,
  raw: FirebaseFirestore.DocumentData | undefined
): IntegrationTokenRecord | null {
  if (!raw) return null;

  const tokenType = normalizeString(raw.tokenType);
  const orgId = normalizeString(raw.orgId);
  const tokenHash = normalizeString(raw.tokenHash);
  const status = normalizeString(raw.status);
  const label = normalizeString(raw.label);
  const createdBy = normalizeString(raw.createdBy);

  if (
    tokenType !== PRIVATE_INTEGRATION_TOKEN_TYPE ||
    !orgId ||
    !tokenHash ||
    (status !== 'active' && status !== 'revoked') ||
    !label ||
    !createdBy
  ) {
    return null;
  }

  return {
    id,
    tokenType,
    orgId,
    tokenHash,
    scopes: normalizeScopes(raw.scopes),
    status,
    createdAt: raw.createdAt ?? null,
    createdBy,
    lastUsedAt: raw.lastUsedAt ?? null,
    label,
    sourceRepo: normalizeString(raw.sourceRepo),
  };
}

function safeEqualStrings(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, 'utf8');
  const bBuffer = Buffer.from(b, 'utf8');
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function defaultRepository(): IntegrationAuthRepository {
  return createFirestoreIntegrationAuthRepository(getAdminDb());
}

export function hashIntegrationToken(token: string): string {
  return `sha256:${createHash('sha256').update(token).digest('hex')}`;
}

export function hashOpaqueValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function extractBearerToken(request: IntegrationRequestLike): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

export async function authenticateIntegrationRequest({
  request,
  orgId,
  requiredScope,
  route,
  repository = defaultRepository(),
}: AuthenticateIntegrationRequestArgs): Promise<IntegrationAuthResult> {
  const normalizedOrgId = normalizeString(orgId);
  const audit: IntegrationAuditBase = {
    tokenId: null,
    label: null,
    sourceRepo: null,
    orgId: normalizedOrgId,
    route,
    scope: requiredScope,
  };

  if (!normalizedOrgId) {
    return {
      ok: false,
      status: 400,
      code: 'MISSING_ORG_ID',
      audit,
    };
  }

  const clearToken = extractBearerToken(request);
  if (!clearToken) {
    return {
      ok: false,
      status: 401,
      code: 'UNAUTHORIZED',
      audit,
    };
  }

  const tokenHash = hashIntegrationToken(clearToken);
  const token = await repository.findTokenByHash(tokenHash);
  if (!token || !safeEqualStrings(token.tokenHash, tokenHash) || token.status !== 'active') {
    return {
      ok: false,
      status: 401,
      code: 'UNAUTHORIZED',
      audit,
    };
  }

  audit.tokenId = token.id;
  audit.label = token.label;
  audit.sourceRepo = token.sourceRepo;

  await repository.touchTokenLastUsed(token.id);

  if (token.orgId !== normalizedOrgId) {
    return {
      ok: false,
      status: 403,
      code: 'ORG_NOT_ALLOWED',
      audit,
    };
  }

  if (!token.scopes.includes(requiredScope)) {
    return {
      ok: false,
      status: 403,
      code: 'SCOPE_DENIED',
      audit,
    };
  }

  return {
    ok: true,
    context: {
      tokenId: token.id,
      label: token.label,
      sourceRepo: token.sourceRepo,
      orgId: normalizedOrgId,
      scope: requiredScope,
    },
    audit,
  };
}

export async function recordIntegrationAudit(
  entry: IntegrationAuditEntry,
  repository: IntegrationAuthRepository = defaultRepository()
): Promise<void> {
  await repository.recordAudit(entry);
}

export function createFirestoreIntegrationAuthRepository(
  db: Firestore
): IntegrationAuthRepository {
  return {
    async findTokenByHash(tokenHash) {
      const snapshot = await db
        .collection(INTEGRATION_TOKENS_COLLECTION)
        .where('tokenHash', '==', tokenHash)
        .limit(2)
        .get();

      if (snapshot.size > 1) {
        console.error('[integration-auth] Duplicate tokenHash detected; refusing ambiguous token lookup');
        return null;
      }

      const doc = snapshot.docs[0];
      if (!doc) return null;
      return toTokenRecord(doc.id, doc.data());
    },

    async touchTokenLastUsed(tokenId) {
      await db.doc(`${INTEGRATION_TOKENS_COLLECTION}/${tokenId}`).set(
        {
          lastUsedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    },

    async recordAudit(entry) {
      await db.collection(INTEGRATION_AUDIT_LOGS_COLLECTION).add({
        tokenId: entry.tokenId,
        label: entry.label,
        sourceRepo: entry.sourceRepo,
        orgId: entry.orgId,
        route: entry.route,
        scope: entry.scope,
        requestKeyHash: entry.requestKeyHash ?? null,
        resourceId: entry.resourceId ?? null,
        result: entry.result,
        code: entry.code,
        status: entry.status,
        timestamp: FieldValue.serverTimestamp(),
      });
    },
  };
}
