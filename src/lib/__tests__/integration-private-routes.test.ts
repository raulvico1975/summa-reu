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
  handlePrivatePendingDocumentLinkTransaction,
  LINKED_TRANSACTION_DOCUMENT_SIGNED_URL_EXPIRES,
  type PendingDocumentLinkRecord,
  type PendingDocumentLinkStorage,
  type PendingDocumentLinkStore,
  type TransactionLinkRecord,
} from '@/app/api/integrations/private/pending-documents/link-transaction/handler';
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
      status: 'draft' | 'confirmed';
      type: 'invoice' | 'payroll' | 'receipt' | 'unknown';
      invoiceNumber: string | null;
      supplierName: string | null;
      supplierId: string | null;
      categoryId: string | null;
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
      status: args.input.status,
      type: args.input.type,
      file: {
        storagePath: args.storagePath,
        filename: args.input.file.name,
        contentType: args.input.file.contentType,
        sizeBytes: args.input.file.sizeBytes,
        sha256: args.input.file.sha256,
      },
      invoiceNumber: args.input.invoiceNumber,
      invoiceDate: args.input.invoiceDate,
      amount: args.input.amount,
      supplierId: args.input.supplierId,
      categoryId: args.input.categoryId,
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

class InMemoryLinkStore implements PendingDocumentLinkStore {
  readonly pendingDocuments = new Map<string, PendingDocumentLinkRecord>();
  readonly transactions = new Map<string, TransactionLinkRecord>();

  async getPendingDocument(orgId: string, pendingDocumentId: string) {
    return this.pendingDocuments.get(`${orgId}/${pendingDocumentId}`) ?? null;
  }

  async getTransaction(orgId: string, transactionId: string) {
    return this.transactions.get(`${orgId}/${transactionId}`) ?? null;
  }

  async linkDocumentToTransaction(args: {
    orgId: string;
    pendingDocumentId: string;
    transactionId: string;
    documentUrl: string;
    finalStoragePath: string;
  }) {
    const pendingKey = `${args.orgId}/${args.pendingDocumentId}`;
    const transactionKey = `${args.orgId}/${args.transactionId}`;
    const pending = this.pendingDocuments.get(pendingKey);
    const transaction = this.transactions.get(transactionKey);
    if (!pending || !transaction) throw new Error('missing test fixture');

    this.pendingDocuments.set(pendingKey, {
      ...pending,
      status: 'matched',
      matchedTransactionId: args.transactionId,
      file: pending.file
        ? {
            ...pending.file,
            finalStoragePath: args.finalStoragePath,
          }
        : pending.file,
    });
    this.transactions.set(transactionKey, {
      ...transaction,
      document: args.documentUrl,
    });
  }
}

class InMemoryLinkStorage implements PendingDocumentLinkStorage {
  cleanedPaths: string[] = [];
  async ensureLinkedFile(args: {
    orgId: string;
    pendingDocumentId: string;
    transactionId: string;
    file: NonNullable<PendingDocumentLinkRecord['file']>;
  }) {
    const finalStoragePath =
      args.file.finalStoragePath ??
      `organizations/${args.orgId}/documents/${args.transactionId}/${args.pendingDocumentId}--${args.file.filename ?? 'document.pdf'}`;
    return {
      documentUrl: `https://storage.local/${encodeURIComponent(finalStoragePath)}`,
      finalStoragePath,
      copied: true,
    };
  }
  async cleanupLinkedFile(finalStoragePath: string) {
    this.cleanedPaths.push(finalStoragePath);
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

function createLinkRequest(body: Record<string, unknown>, token = 'link-token') {
  return {
    headers: new Headers({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }),
    nextUrl: new URL('http://localhost/api/integrations/private/pending-documents/link-transaction?orgId=org-a'),
    async json() {
      return body;
    },
  } as never;
}

const allowEntitlement = async () => ({
  allowed: true,
  diagnostics: [],
  enforcementMode: 'active' as const,
});

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

function createUploadRequest(idempotencyKey: string, overrides: Record<string, string | null> = {}) {
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
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) {
      formData.delete(key);
    } else {
      formData.set(key, value);
    }
  }

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
    resolveEntitlementFn: allowEntitlement,
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
    resolveEntitlementFn: allowEntitlement,
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

test('pending documents upload can create a confirmed invoice when required fields are present', async () => {
  const authRepository = new InMemoryAuthRepository([
    buildToken({ scopes: ['pending_documents.write'] }, 'upload-token'),
  ]);
  const store = new InMemoryUploadStore();

  const response = await handlePrivatePendingDocumentsUpload(
    createUploadRequest('mail-confirmed-1', {
      status: 'confirmed',
      type: 'invoice',
      invoiceNumber: 'F-2026-15',
      supplierId: 'supplier-acme',
      categoryId: 'cat-services',
    }),
    {
      resolveEntitlementFn: allowEntitlement,
      authRepository,
      store,
      storage: new InMemoryUploadStorage(),
    }
  );

  const body = await response.json() as {
    success: boolean;
    pendingDocument: {
      status: string;
      type: string;
      invoiceNumber: string | null;
      supplierId: string | null;
      categoryId: string | null;
    };
  };

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.pendingDocument.status, 'confirmed');
  assert.equal(body.pendingDocument.type, 'invoice');
  assert.equal(body.pendingDocument.invoiceNumber, 'F-2026-15');
  assert.equal(body.pendingDocument.supplierId, 'supplier-acme');
  assert.equal(body.pendingDocument.categoryId, 'cat-services');
});

test('pending documents upload rejects confirmed invoices without Summa required fields', async () => {
  const authRepository = new InMemoryAuthRepository([
    buildToken({ scopes: ['pending_documents.write'] }, 'upload-token'),
  ]);

  const response = await handlePrivatePendingDocumentsUpload(
    createUploadRequest('mail-confirmed-missing-category', {
      status: 'confirmed',
      type: 'invoice',
      invoiceNumber: 'F-2026-15',
      supplierId: 'supplier-acme',
    }),
    {
      resolveEntitlementFn: allowEntitlement,
      authRepository,
      store: new InMemoryUploadStore(),
      storage: new InMemoryUploadStorage(),
    }
  );

  assert.equal(response.status, 400);
  const body = await response.json() as { code: string };
  assert.equal(body.code, 'CONFIRMED_CATEGORY_REQUIRED');
});

test('pending document link validates one reviewed match and updates transaction document', async () => {
  const authRepository = new InMemoryAuthRepository([
    buildToken({ scopes: ['pending_documents.link'] }, 'link-token'),
  ]);
  const store = new InMemoryLinkStore();
  const storage = new InMemoryLinkStorage();
  const hash = '4e437b126ebe1c5a4a7a7ff0a7c2f13d7805f34b7873c682c439c364c9ffdef4';

  store.pendingDocuments.set('org-a/intpd_la_teva_barra', {
    id: 'intpd_la_teva_barra',
    status: 'draft',
    matchedTransactionId: null,
    amount: 738.2,
    file: {
      storagePath: 'organizations/org-a/pendingDocuments/intpd_la_teva_barra/26.05.04_La_Teva_Barra.pdf',
      finalStoragePath: null,
      filename: '26.05.04_La_Teva_Barra.pdf',
      sha256: hash,
    },
  });
  store.transactions.set('org-a/tx_la_teva_barra', {
    id: 'tx_la_teva_barra',
    amount: -738.2,
    date: '2026-05-04',
    document: null,
  });

  const response = await handlePrivatePendingDocumentLinkTransaction(
    createLinkRequest({
      orgId: 'org-a',
      pendingDocumentId: 'intpd_la_teva_barra',
      transactionId: 'tx_la_teva_barra',
      caseId: 'baruma-case-la-teva-barra',
      documentHash: hash,
      expectedAmount: 738.2,
      expectedDate: '2026-05-04',
      reviewerLabel: 'Raul',
      note: 'OK granular pilot Baruma',
    }),
    { authRepository, store, storage, resolveEntitlementFn: allowEntitlement }
  );

  assert.equal(response.status, 200);
  const body = await response.json() as {
    success: boolean;
    linked: boolean;
    newState: { pendingStatus: string; transactionHasDocument: boolean };
  };
  assert.equal(body.success, true);
  assert.equal(body.linked, true);
  assert.equal(body.newState.pendingStatus, 'matched');
  assert.equal(body.newState.transactionHasDocument, true);
  assert.equal(store.pendingDocuments.get('org-a/intpd_la_teva_barra')?.matchedTransactionId, 'tx_la_teva_barra');
  assert.match(store.transactions.get('org-a/tx_la_teva_barra')?.document ?? '', /^https:\/\/storage\.local\//);
  assert.equal(LINKED_TRANSACTION_DOCUMENT_SIGNED_URL_EXPIRES, '03-01-2500');
  assert.equal(authRepository.auditLog.at(-1)?.code, 'LINKED');
});

test('pending document link requires the dedicated link scope', async () => {
  const authRepository = new InMemoryAuthRepository([
    buildToken({ scopes: ['pending_documents.write'] }, 'link-token'),
  ]);
  const response = await handlePrivatePendingDocumentLinkTransaction(
    createLinkRequest({
      pendingDocumentId: 'intpd_1',
      transactionId: 'tx_1',
      caseId: 'case-1',
      documentHash: 'a'.repeat(64),
      expectedAmount: 10,
      expectedDate: '2026-05-04',
      reviewerLabel: 'Raul',
      note: 'OK granular',
    }),
    { authRepository, store: new InMemoryLinkStore(), storage: new InMemoryLinkStorage() }
  );

  assert.equal(response.status, 403);
  const body = await response.json() as { code: string };
  assert.equal(body.code, 'SCOPE_DENIED');
});

test('pending document link blocks hash mismatches and existing transaction documents', async () => {
  const authRepository = new InMemoryAuthRepository([
    buildToken({ scopes: ['pending_documents.link'] }, 'link-token'),
  ]);
  const hash = 'b'.repeat(64);
  const store = new InMemoryLinkStore();
  store.pendingDocuments.set('org-a/intpd_1', {
    id: 'intpd_1',
    status: 'draft',
    matchedTransactionId: null,
    amount: 90,
    file: {
      storagePath: 'organizations/org-a/pendingDocuments/intpd_1/invoice.pdf',
      finalStoragePath: null,
      filename: 'invoice.pdf',
      sha256: hash,
    },
  });
  store.transactions.set('org-a/tx_1', {
    id: 'tx_1',
    amount: -90,
    date: '2026-05-04',
    document: null,
  });

  const hashMismatch = await handlePrivatePendingDocumentLinkTransaction(
    createLinkRequest({
      pendingDocumentId: 'intpd_1',
      transactionId: 'tx_1',
      caseId: 'case-1',
      documentHash: 'c'.repeat(64),
      expectedAmount: 90,
      expectedDate: '2026-05-04',
      reviewerLabel: 'Raul',
      note: 'OK granular',
    }),
    { authRepository, store, storage: new InMemoryLinkStorage(), resolveEntitlementFn: allowEntitlement }
  );
  assert.equal(hashMismatch.status, 409);
  assert.equal((await hashMismatch.json() as { code: string }).code, 'DOCUMENT_HASH_MISMATCH');

  store.transactions.set('org-a/tx_1', {
    id: 'tx_1',
    amount: -90,
    date: '2026-05-04',
    document: 'https://existing.local/document.pdf',
  });
  const existingDocument = await handlePrivatePendingDocumentLinkTransaction(
    createLinkRequest({
      pendingDocumentId: 'intpd_1',
      transactionId: 'tx_1',
      caseId: 'case-1',
      documentHash: hash,
      expectedAmount: 90,
      expectedDate: '2026-05-04',
      reviewerLabel: 'Raul',
      note: 'OK granular',
    }),
    { authRepository, store, storage: new InMemoryLinkStorage(), resolveEntitlementFn: allowEntitlement }
  );
  assert.equal(existingDocument.status, 409);
  assert.equal((await existingDocument.json() as { code: string }).code, 'TRANSACTION_ALREADY_HAS_DOCUMENT');
});

test('pending private link neteja el destí creat si falla la transacció Firestore', async () => {
  const authRepository = new InMemoryAuthRepository([
    buildToken({ scopes: ['pending_documents.link'] }, 'link-token'),
  ]);
  const hash = 'd'.repeat(64);
  const baseStore = new InMemoryLinkStore();
  baseStore.pendingDocuments.set('org-a/intpd_1', {
    id: 'intpd_1', status: 'draft', matchedTransactionId: null, amount: 90,
    file: {
      storagePath: 'organizations/org-a/pendingDocuments/intpd_1/invoice.pdf',
      finalStoragePath: null, filename: 'invoice.pdf', sha256: hash,
    },
  });
  baseStore.transactions.set('org-a/tx_1', {
    id: 'tx_1', amount: -90, date: '2026-05-04', document: null,
  });
  const store: PendingDocumentLinkStore = {
    getPendingDocument: (...args) => baseStore.getPendingDocument(...args),
    getTransaction: (...args) => baseStore.getTransaction(...args),
    linkDocumentToTransaction: async () => { throw new Error('INJECTED_FIRESTORE_FAILURE'); },
  };
  const storage = new InMemoryLinkStorage();
  const response = await handlePrivatePendingDocumentLinkTransaction(
    createLinkRequest({
      pendingDocumentId: 'intpd_1', transactionId: 'tx_1', caseId: 'case-1',
      documentHash: hash, expectedAmount: 90, expectedDate: '2026-05-04',
      reviewerLabel: 'Raul', note: 'OK granular',
    }),
    { authRepository, store, storage, resolveEntitlementFn: allowEntitlement }
  );
  assert.equal(response.status, 500);
  assert.deepEqual(storage.cleanedPaths, [
    'organizations/org-a/documents/tx_1/intpd_1--invoice.pdf',
  ]);
});

test('pending private link rebutja IDs amb slash i notes enormes abans de side effects', async () => {
  const authRepository = new InMemoryAuthRepository([
    buildToken({ scopes: ['pending_documents.link'] }, 'link-token'),
  ]);
  let reads = 0;
  const store: PendingDocumentLinkStore = {
    getPendingDocument: async () => { reads += 1; return null; },
    getTransaction: async () => { reads += 1; return null; },
    linkDocumentToTransaction: async () => { reads += 1; },
  };
  const response = await handlePrivatePendingDocumentLinkTransaction(
    createLinkRequest({
      pendingDocumentId: '../other', transactionId: 'tx_1', caseId: 'case-1',
      documentHash: 'e'.repeat(64), expectedAmount: 90, expectedDate: '2026-05-04',
      reviewerLabel: 'Raul', note: 'x'.repeat(4_001),
    }),
    { authRepository, store, storage: new InMemoryLinkStorage(), resolveEntitlementFn: allowEntitlement }
  );
  assert.equal(response.status, 400);
  assert.equal(reads, 0);
});
