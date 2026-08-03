import { basename } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { parseBankStatementFile } from './bank-statement-file';

export interface SummaAgentMcpConfig {
  baseUrl: string;
  token: string;
  defaultOrgId?: string;
  sourceRepo?: string;
  fetchFn?: typeof fetch;
}

export interface SearchContactsInput {
  orgId?: string;
  q: string;
  limit?: number;
  includeArchived?: boolean;
}

export interface SearchTransactionsInput {
  orgId?: string;
  q?: string;
  contactId?: string;
  bankAccountId?: string;
  dateFrom?: string;
  dateTo?: string;
  cursor?: string;
  limit?: number;
  includeArchived?: boolean;
}

export interface UploadPendingDocumentInput {
  orgId?: string;
  filePath: string;
  idempotencyKey: string;
  supplierName?: string;
  invoiceDate?: string;
  amount?: number;
  sourceRepo?: string;
  externalMessageId?: string;
  contentType?: string;
}

export interface LinkPendingDocumentToTransactionInput {
  orgId?: string;
  pendingDocumentId: string;
  transactionId: string;
  caseId: string;
  documentHash: string;
  expectedAmount: number;
  expectedDate: string;
  reviewerLabel: string;
  note: string;
}

export interface OperationalSummaryInput {
  orgId?: string;
  dateFrom?: string;
  dateTo?: string;
  contactQuery?: string;
  limit?: number;
}

export interface PreviewBankStatementImportInput {
  orgId?: string;
  bankAccountId: string;
  filePath: string;
}

export interface PrepareDonationClassificationInput {
  orgId?: string;
  transactionId: string;
  donorId: string;
}

export interface PrepareIndividualDonationCertificateInput
  extends PrepareDonationClassificationInput {
  useProposedClassification?: boolean;
}

type JsonObject = Record<string, unknown>;

const DEFAULT_RECENT_LIMIT = 20;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function cleanBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) throw new Error('SUMMA_BASE_URL is required');
  return trimmed;
}

function requiredToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) throw new Error('SUMMA_PRIVATE_INTEGRATION_TOKEN is required');
  return trimmed;
}

function resolveOrgId(inputOrgId: string | undefined, defaultOrgId: string | undefined): string {
  const orgId = (inputOrgId ?? defaultOrgId ?? '').trim();
  if (!orgId) throw new Error('orgId is required');
  return orgId;
}

function appendOptional(params: URLSearchParams, key: string, value: unknown): void {
  if (value === undefined || value === null || value === '') return;
  params.set(key, String(value));
}

function assertIsoDate(name: string, value: string | undefined): void {
  if (value === undefined || /^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  throw new Error(`${name} must use YYYY-MM-DD`);
}

async function parseJsonResponse(response: Response): Promise<JsonObject> {
  const text = await response.text();
  let body: JsonObject = {};
  if (text.trim()) {
    try {
      body = JSON.parse(text) as JsonObject;
    } catch {
      body = { success: false, code: 'INVALID_JSON_RESPONSE' };
    }
  }

  if (!response.ok) {
    const code = typeof body.code === 'string' ? body.code : `HTTP_${response.status}`;
    throw new Error(code);
  }

  return body;
}

export class SummaPrivateIntegrationClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly defaultOrgId?: string;
  private readonly sourceRepo?: string;
  private readonly fetchFn: typeof fetch;

  constructor(config: SummaAgentMcpConfig) {
    this.baseUrl = cleanBaseUrl(config.baseUrl);
    this.token = requiredToken(config.token);
    this.defaultOrgId = config.defaultOrgId;
    this.sourceRepo = config.sourceRepo;
    this.fetchFn = config.fetchFn ?? fetch;
  }

  async searchContacts(input: SearchContactsInput): Promise<JsonObject> {
    const orgId = resolveOrgId(input.orgId, this.defaultOrgId);
    const q = input.q.trim();
    if (q.length < 2) throw new Error('q must contain at least 2 characters');

    const params = new URLSearchParams({ orgId, q });
    appendOptional(params, 'limit', input.limit);
    appendOptional(params, 'includeArchived', input.includeArchived === true ? 'true' : undefined);

    const response = await this.fetchFn(
      `${this.baseUrl}/api/integrations/private/contacts/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );

    return parseJsonResponse(response);
  }

  async searchTransactions(input: SearchTransactionsInput): Promise<JsonObject> {
    const orgId = resolveOrgId(input.orgId, this.defaultOrgId);
    assertIsoDate('dateFrom', input.dateFrom);
    assertIsoDate('dateTo', input.dateTo);

    const params = new URLSearchParams({ orgId });
    appendOptional(params, 'q', input.q?.trim());
    appendOptional(params, 'contactId', input.contactId?.trim());
    appendOptional(params, 'bankAccountId', input.bankAccountId?.trim());
    appendOptional(params, 'dateFrom', input.dateFrom);
    appendOptional(params, 'dateTo', input.dateTo);
    appendOptional(params, 'cursor', input.cursor);
    appendOptional(params, 'limit', input.limit);
    appendOptional(params, 'includeArchived', input.includeArchived === true ? 'true' : undefined);

    const response = await this.fetchFn(
      `${this.baseUrl}/api/integrations/private/transactions/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );

    return parseJsonResponse(response);
  }

  async previewBankStatementImport(input: PreviewBankStatementImportInput): Promise<JsonObject> {
    const orgId = resolveOrgId(input.orgId, this.defaultOrgId);
    const bankAccountId = input.bankAccountId.trim();
    if (!bankAccountId) throw new Error('bankAccountId is required');
    const parsed = await parseBankStatementFile(input.filePath, bankAccountId);
    return this.postJson('/api/integrations/private/bank-import/preview', {
      orgId,
      bankAccountId,
      file: parsed.file,
      rows: parsed.rows,
    });
  }

  async prepareDonationClassification(input: PrepareDonationClassificationInput): Promise<JsonObject> {
    const orgId = resolveOrgId(input.orgId, this.defaultOrgId);
    const transactionId = input.transactionId.trim();
    const donorId = input.donorId.trim();
    if (!transactionId || !donorId) throw new Error('transactionId and donorId are required');
    return this.postJson('/api/integrations/private/donations/classification/prepare', {
      orgId,
      transactionId,
      donorId,
    });
  }

  async prepareIndividualDonationCertificate(
    input: PrepareIndividualDonationCertificateInput
  ): Promise<JsonObject> {
    const orgId = resolveOrgId(input.orgId, this.defaultOrgId);
    const transactionId = input.transactionId.trim();
    const donorId = input.donorId.trim();
    if (!transactionId || !donorId) throw new Error('transactionId and donorId are required');
    return this.postJson('/api/integrations/private/certificates/individual/prepare', {
      orgId,
      transactionId,
      donorId,
      useProposedClassification: input.useProposedClassification === true,
    });
  }

  private async postJson(path: string, body: JsonObject): Promise<JsonObject> {
    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return parseJsonResponse(response);
  }

  async uploadPendingDocument(input: UploadPendingDocumentInput): Promise<JsonObject> {
    const orgId = resolveOrgId(input.orgId, this.defaultOrgId);
    assertIsoDate('invoiceDate', input.invoiceDate);

    const idempotencyKey = input.idempotencyKey.trim();
    if (!idempotencyKey) throw new Error('idempotencyKey is required');

    const fileInfo = await stat(input.filePath);
    if (!fileInfo.isFile()) throw new Error('filePath must point to a file');
    if (fileInfo.size > MAX_UPLOAD_BYTES) throw new Error('file exceeds 20MB upload limit');

    const bytes = await readFile(input.filePath);
    const filename = basename(input.filePath);
    const form = new FormData();
    form.set('orgId', orgId);
    form.set(
      'file',
      new File([bytes], filename, {
        type: input.contentType ?? 'application/octet-stream',
      })
    );
    if (input.supplierName) form.set('supplierName', input.supplierName);
    if (input.invoiceDate) form.set('invoiceDate', input.invoiceDate);
    if (input.amount !== undefined) form.set('amount', String(input.amount));
    if (input.sourceRepo ?? this.sourceRepo) form.set('sourceRepo', input.sourceRepo ?? this.sourceRepo ?? '');
    if (input.externalMessageId) form.set('externalMessageId', input.externalMessageId);

    const params = new URLSearchParams({ orgId });
    const response = await this.fetchFn(
      `${this.baseUrl}/api/integrations/private/pending-documents/upload?${params.toString()}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: form,
      }
    );

    return parseJsonResponse(response);
  }

  async linkPendingDocumentToTransaction(input: LinkPendingDocumentToTransactionInput): Promise<JsonObject> {
    const orgId = resolveOrgId(input.orgId, this.defaultOrgId);
    assertIsoDate('expectedDate', input.expectedDate);

    const body = {
      orgId,
      pendingDocumentId: input.pendingDocumentId,
      transactionId: input.transactionId,
      caseId: input.caseId,
      documentHash: input.documentHash,
      expectedAmount: input.expectedAmount,
      expectedDate: input.expectedDate,
      reviewerLabel: input.reviewerLabel,
      note: input.note,
    };

    const params = new URLSearchParams({ orgId });
    const response = await this.fetchFn(
      `${this.baseUrl}/api/integrations/private/pending-documents/link-transaction?${params.toString()}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    return parseJsonResponse(response);
  }

  async getEntityOperationalSummary(input: OperationalSummaryInput): Promise<JsonObject> {
    const orgId = resolveOrgId(input.orgId, this.defaultOrgId);
    const limit = Math.min(Math.max(input.limit ?? DEFAULT_RECENT_LIMIT, 1), 50);
    const transactionsBody = await this.searchTransactions({
      orgId,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      limit,
    });

    const transactions = Array.isArray(transactionsBody.transactions)
      ? transactionsBody.transactions as Array<Record<string, unknown>>
      : [];

    const amounts = transactions
      .map((tx) => (typeof tx.amount === 'number' ? tx.amount : null))
      .filter((amount): amount is number => amount !== null);
    const inflow = amounts.filter((amount) => amount > 0).reduce((sum, amount) => sum + amount, 0);
    const outflow = amounts.filter((amount) => amount < 0).reduce((sum, amount) => sum + amount, 0);
    const withoutContact = transactions.filter((tx) => tx.contactId == null).length;
    const withoutBankAccount = transactions.filter((tx) => tx.bankAccountId == null).length;

    const summary: JsonObject = {
      success: true,
      orgId,
      scope: 'private_integration_api_v1',
      recentTransactions: {
        count: transactions.length,
        inflow,
        outflow,
        nextCursor: transactionsBody.nextCursor ?? null,
      },
      simpleAnomalies: {
        transactionsWithoutContact: withoutContact,
        transactionsWithoutBankAccount: withoutBankAccount,
      },
      pendingDocuments: {
        readable: false,
        reason: 'private integration API v1 does not expose pending_documents.read',
      },
    };

    if (input.contactQuery && input.contactQuery.trim().length >= 2) {
      const contactsBody = await this.searchContacts({
        orgId,
        q: input.contactQuery,
        limit: 10,
      });
      summary.contacts = {
        query: input.contactQuery,
        count: Array.isArray(contactsBody.contacts) ? contactsBody.contacts.length : 0,
        sample: contactsBody.contacts,
      };
    }

    return summary;
  }
}

export function createClientFromEnv(env: NodeJS.ProcessEnv = process.env): SummaPrivateIntegrationClient {
  return new SummaPrivateIntegrationClient({
    baseUrl: env.SUMMA_BASE_URL ?? env.SUMMA_SOCIAL_BASE_URL ?? '',
    token: env.SUMMA_PRIVATE_INTEGRATION_TOKEN ?? '',
    defaultOrgId: env.SUMMA_ORG_ID,
    sourceRepo: env.SUMMA_SOURCE_REPO ?? 'summa-agent-mcp',
  });
}
