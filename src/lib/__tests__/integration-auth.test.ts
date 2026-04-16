import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticateIntegrationRequest,
  hashIntegrationToken,
  type IntegrationAuditEntry,
  type IntegrationAuthRepository,
  type IntegrationTokenRecord,
} from '@/lib/api/integration-auth';

class InMemoryAuthRepository implements IntegrationAuthRepository {
  readonly auditLog: IntegrationAuditEntry[] = [];

  constructor(private readonly tokens: IntegrationTokenRecord[]) {}

  async findTokenByHash(tokenHash: string): Promise<IntegrationTokenRecord | null> {
    return this.tokens.find((token) => token.tokenHash === tokenHash) ?? null;
  }

  async touchTokenLastUsed(tokenId: string): Promise<void> {
    const token = this.tokens.find((entry) => entry.id === tokenId);
    if (token) {
      token.lastUsedAt = 'now';
    }
  }

  async recordAudit(entry: IntegrationAuditEntry): Promise<void> {
    this.auditLog.push(entry);
  }
}

function buildToken(overrides: Partial<IntegrationTokenRecord> = {}): IntegrationTokenRecord {
  const clearToken = overrides.tokenHash ? null : 'valid-token';

  return {
    id: overrides.id ?? 'token-1',
    tokenType: 'private_integration',
    orgId: overrides.orgId ?? 'org-a',
    tokenHash: overrides.tokenHash ?? hashIntegrationToken(clearToken ?? ''),
    scopes: overrides.scopes ?? ['contacts.read', 'transactions.read', 'pending_documents.write'],
    status: overrides.status ?? 'active',
    createdAt: null,
    createdBy: 'raul',
    lastUsedAt: null,
    label: overrides.label ?? 'baruma',
    sourceRepo: overrides.sourceRepo ?? 'baruma-admin-agent',
  };
}

function buildRequest(token: string | null) {
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return { headers };
}

test('integration auth rejects missing token with 401', async () => {
  const repository = new InMemoryAuthRepository([buildToken()]);
  const result = await authenticateIntegrationRequest({
    request: buildRequest(null),
    orgId: 'org-a',
    requiredScope: 'contacts.read',
    route: 'GET /api/integrations/private/contacts/search',
    repository,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(result.code, 'UNAUTHORIZED');
});

test('integration auth rejects invalid token with 401', async () => {
  const repository = new InMemoryAuthRepository([buildToken()]);
  const result = await authenticateIntegrationRequest({
    request: buildRequest('invalid-token'),
    orgId: 'org-a',
    requiredScope: 'contacts.read',
    route: 'GET /api/integrations/private/contacts/search',
    repository,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(result.code, 'UNAUTHORIZED');
});

test('integration auth rejects missing scope with 403', async () => {
  const repository = new InMemoryAuthRepository([
    buildToken({
      scopes: ['contacts.read'],
    }),
  ]);

  const result = await authenticateIntegrationRequest({
    request: buildRequest('valid-token'),
    orgId: 'org-a',
    requiredScope: 'transactions.read',
    route: 'GET /api/integrations/private/transactions/search',
    repository,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(result.code, 'SCOPE_DENIED');
});

test('integration auth rejects wrong org with 403', async () => {
  const repository = new InMemoryAuthRepository([
    buildToken({
      orgId: 'org-a',
    }),
  ]);

  const result = await authenticateIntegrationRequest({
    request: buildRequest('valid-token'),
    orgId: 'org-b',
    requiredScope: 'contacts.read',
    route: 'GET /api/integrations/private/contacts/search',
    repository,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(result.code, 'ORG_NOT_ALLOWED');
});
