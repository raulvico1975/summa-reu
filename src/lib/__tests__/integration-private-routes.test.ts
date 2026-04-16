import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handlePrivateContactsSearch,
  type IntegrationContactRecord,
} from '@/app/api/integrations/private/contacts/search/handler';
import {
  handlePrivateTransactionsSearch,
  type IntegrationTransactionPageDoc,
  type TransactionsSearchDataSource,
} from '@/app/api/integrations/private/transactions/search/handler';
import {
  handlePrivatePendingDocumentsUpload,
  type PendingDocumentsUploadStorage,
  type PendingDocumentsUploadStore,
} from '@/app/api/integrations/private/pending-documents/upload/handler';
import {
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
    if (token) token.lastUsedAt = 'now';
  }

  async recordAudit(entry: IntegrationAuditEntry): Promise<void> {
    this.auditLog.push(entry);
  }
}

class InMemoryTransactionsDataSource implements TransactionsSearchDataSource {
  constructor(
    private readonly transactionsByOrg: Record<string, IntegrationTransactionPageDoc[]>,
    private readonly contactNamesByOrg: Record<string, Record<string, string>>
  ) {}

  async fetchPage(args: {
    orgId: string;
    limit: number;
    cursorId: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  }): Promise<IntegrationTransactionPageDoc[]> {
    const rows = [...(this.transactionsByOrg[args.orgId] ?? [])]
      .filter((doc) => {
        const date = typeof doc.data.date === 'string' ? doc.data.date : '';
        if (args.dateFrom && date < args.dateFrom) return false;
        if (args.dateTo && date > args.dateTo) return false;
        return true;
      })
      .sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)));

    const startIndex = args.cursorId
      ? rows.findIndex((doc) => doc.id === args.cursorId) + 1
      : 0;

    return rows.slice(startIndex, startIndex + args.limit);
  }

  async loadSearchContext(orgId: string) {
    return {
      contactNamesById: this.contactNamesByOrg[orgId] ?? {},
      categoryLabelsById: {},
      projectNamesById: {},
    };
  }
}

class InMemoryUploadStore implements PendingDocumentsUploadStore {
  readonly docs = new Map<string, Record<string, unknown>>();
  private readonly claims = new Map<string, {
    requestHash: string;
    pendingDocumentId: string;
    status: 'pending' | 'completed';
  }>();

  async claimIdempotency(args: {
    idempotencyId: string;
    requestHash: string;
    pendingDocumentId: string;
  }) {
    const existing = this.claims.get(args.idempotencyId);
    if (!existing) {
      this.claims.set(args.idempotencyId, {
        requestHash: args.requestHash,
        pendingDocumentId: args.pendingDocumentId,
        status: 'pending',
      });
      return {
        kind: 'new' as const,
        pendingDocumentId: args.pendingDocumentId,
      };
    }

    if (existing.requestHash !== args.requestHash) {
      return {
        kind: 'conflict' as const,
        pendingDocumentId: existing.pendingDocumentId,
      };
    }

    return {
      kind: existing.status === 'completed' ? 'completed' as const : 'pending' as const,
      pendingDocumentId: existing.pendingDocumentId,
    };
  }

  async getPendingDocument(orgId: string, pendingDocumentId: string) {
    const record = this.docs.get(`${orgId}/${pendingDocumentId}`);
    return (record as never) ?? null;
  }

  async createPendingDocument(args: {
    orgId: string;
    pendingDocumentId: string;
    input: {
      file: {
        name: string;
        contentType: string;
        sizeBytes: number;
        sha256: string;
      };
      supplierName: string | null;
      invoiceDate: string | null;
      amount: number | null;
      sourceRepo: string | null;
      externalMessageId: string | null;
    };
    storagePath: string;
  }) {
    const key = `${args.orgId}/${args.pendingDocumentId}`;
    if (this.docs.has(key)) {
      return 'existing' as const;
    }

    this.docs.set(key, {
      id: args.pendingDocumentId,
      status: 'draft',
      type: 'unknown',
      file: {
        storagePath: args.storagePath,
        filename: args.input.file.name,
        contentType: args.input.file.contentType,
        sizeBytes: args.input.file.sizeBytes,
        sha256: args.input.file.sha256,
      },
      invoiceDate: args.input.invoiceDate,
      amount: args.input.amount,
      integrationMeta: {
        sourceRepo: args.input.sourceRepo,
        externalMessageId: args.input.externalMessageId,
        supplierName: args.input.supplierName,
      },
    });

    return 'created' as const;
  }

  async markCompleted(args: { idempotencyId: string }) {
    const claim = this.claims.get(args.idempotencyId);
    if (claim) {
      claim.status = 'completed';
    }
  }
}

class InMemoryUploadStorage implements PendingDocumentsUploadStorage {
  readonly saved = new Map<string, Buffer>();

  async saveFile(args: { storagePath: string; bytes: Buffer }) {
    this.saved.set(args.storagePath, args.bytes);
  }
}

function buildToken(overrides: Partial<IntegrationTokenRecord> = {}, clearToken = 'valid-token') {
  return {
    id: overrides.id ?? 'token-1',
    tokenType: 'private_integration' as const,
    orgId: overrides.orgId ?? 'org-a',
    tokenHash: overrides.tokenHash ?? hashIntegrationToken(clearToken),
    scopes: overrides.scopes ?? ['contacts.read', 'transactions.read', 'pending_documents.write'],
    status: overrides.status ?? 'active',
    createdAt: null,
    createdBy: 'raul',
    lastUsedAt: null,
    label: overrides.label ?? 'baruma',
    sourceRepo: overrides.sourceRepo ?? 'baruma-admin-agent',
  } satisfies IntegrationTokenRecord;
}

test('contacts search stays isolated per org', async () => {
  const authRepository = new InMemoryAuthRepository([
    buildToken({ scopes: ['contacts.read'] }, 'contacts-token'),
  ]);

  const contactsByOrg: Record<string, IntegrationContactRecord[]> = {
    'org-a': [
      {
        id: 'contact-a',
        name: 'Proveidor Alpha',
        taxId: 'B12345678',
        email: 'alpha@example.com',
        iban: 'ES1122334455667788990011',
        type: 'supplier',
      },
      {
        id: 'contact-a-archived',
        name: 'Proveidor Arxivat',
        taxId: 'B99999999',
        email: 'archived@example.com',
        iban: null,
        type: 'supplier',
        archivedAt: '2026-04-01T10:00:00.000Z',
      },
    ],
    'org-b': [
      {
        id: 'contact-b',
        name: 'Proveidor Beta',
        taxId: 'B87654321',
        email: 'beta@example.com',
        iban: null,
        type: 'supplier',
      },
    ],
  };

  const response = await handlePrivateContactsSearch(
    {
      headers: new Headers({
        Authorization: 'Bearer contacts-token',
      }),
      nextUrl: new URL('http://localhost/api/integrations/private/contacts/search?orgId=org-a&q=proveidor'),
    } as never,
    {
      authRepository,
      listContactsFn: async (orgId) => contactsByOrg[orgId] ?? [],
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json() as {
    success: boolean;
    contacts: Array<{ id: string }>;
  };

  assert.equal(body.success, true);
  assert.deepEqual(body.contacts.map((contact) => contact.id), ['contact-a']);
});

test('transactions search stays isolated per org and excludes remittance children', async () => {
  const authRepository = new InMemoryAuthRepository([
    buildToken({ scopes: ['transactions.read'] }, 'transactions-token'),
  ]);

  const dataSource = new InMemoryTransactionsDataSource(
    {
      'org-a': [
        {
          id: 'tx-a-visible',
          data: {
            date: '2026-04-15',
            amount: -120.5,
            description: 'Factura Alpha serveis',
            contactId: 'contact-a',
            contactType: 'supplier',
            category: 'services',
            projectId: 'project-a',
            bankAccountId: 'bank-a',
            source: 'bank',
            transactionType: 'normal',
            document: 'doc-a',
          },
        },
        {
          id: 'tx-a-child',
          data: {
            date: '2026-04-14',
            amount: -50,
            description: 'Factura Alpha filla',
            contactId: 'contact-a',
            contactType: 'supplier',
            category: 'services',
            projectId: null,
            bankAccountId: 'bank-a',
            source: 'remittance',
            transactionType: 'normal',
            document: 'doc-child',
            parentTransactionId: 'parent-1',
            isRemittanceItem: true,
          },
        },
      ],
      'org-b': [
        {
          id: 'tx-b-visible',
          data: {
            date: '2026-04-15',
            amount: -90,
            description: 'Factura Alpha altre org',
            contactId: 'contact-b',
            contactType: 'supplier',
            category: 'services',
            projectId: 'project-b',
            bankAccountId: 'bank-b',
            source: 'bank',
            transactionType: 'normal',
            document: 'doc-b',
          },
        },
      ],
    },
    {
      'org-a': { 'contact-a': 'Proveidor Alpha' },
      'org-b': { 'contact-b': 'Proveidor Beta' },
    }
  );

  const response = await handlePrivateTransactionsSearch(
    {
      headers: new Headers({
        Authorization: 'Bearer transactions-token',
      }),
      nextUrl: new URL('http://localhost/api/integrations/private/transactions/search?orgId=org-a&q=alpha'),
    } as never,
    {
      authRepository,
      dataSource,
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json() as {
    success: boolean;
    transactions: Array<{ id: string }>;
  };

  assert.equal(body.success, true);
  assert.deepEqual(body.transactions.map((transaction) => transaction.id), ['tx-a-visible']);
});

function createUploadRequest(idempotencyKey: string) {
  const headers = new Headers({
    Authorization: 'Bearer upload-token',
    'Idempotency-Key': idempotencyKey,
  });
  const formData = new FormData();
  formData.set('orgId', 'org-a');
  formData.set(
    'file',
    new File([Buffer.from('invoice-payload')], 'invoice.pdf', {
      type: 'application/pdf',
    })
  );
  formData.set('supplierName', 'ACME, S.L.');
  formData.set('invoiceDate', '2026-04-15');
  formData.set('amount', '123.45');
  formData.set('externalMessageId', 'gmail-msg-1');

  return {
    headers,
    nextUrl: new URL('http://localhost/api/integrations/private/pending-documents/upload?orgId=org-a'),
    async formData() {
      return formData;
    },
  } as never;
}

test('pending documents upload is idempotent and does not duplicate the document', async () => {
  const authRepository = new InMemoryAuthRepository([
    buildToken({ scopes: ['pending_documents.write'] }, 'upload-token'),
  ]);
  const store = new InMemoryUploadStore();
  const storage = new InMemoryUploadStorage();

  const firstResponse = await handlePrivatePendingDocumentsUpload(createUploadRequest('mail-1'), {
    authRepository,
    store,
    storage,
  });
  const firstBody = await firstResponse.json() as {
    success: boolean;
    idempotent: boolean;
    pendingDocument: { id: string };
  };

  const secondResponse = await handlePrivatePendingDocumentsUpload(createUploadRequest('mail-1'), {
    authRepository,
    store,
    storage,
  });
  const secondBody = await secondResponse.json() as {
    success: boolean;
    idempotent: boolean;
    pendingDocument: { id: string };
  };

  assert.equal(firstResponse.status, 201);
  assert.equal(firstBody.success, true);
  assert.equal(firstBody.idempotent, false);

  assert.equal(secondResponse.status, 200);
  assert.equal(secondBody.success, true);
  assert.equal(secondBody.idempotent, true);
  assert.equal(secondBody.pendingDocument.id, firstBody.pendingDocument.id);
  assert.equal(store.docs.size, 1);
});
