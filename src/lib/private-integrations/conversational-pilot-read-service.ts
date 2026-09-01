import { getAdminDb } from '@/lib/api/admin-sdk';
import {
  searchBankAccountCandidates,
  searchContactCandidates,
  searchTransactionCandidates,
  type BankAccountSearchInput,
  type ContactSearchInput,
  type ConversationalBankAccountRecord,
  type ConversationalContactRecord,
  type ConversationalTransactionRecord,
  type TransactionSearchInput,
} from '@/lib/private-integrations/conversational-search';

const MAX_TRANSACTION_SCAN = 1_000;
const TRANSACTION_PAGE_SIZE = 250;

export interface ConversationalSearchDataSource {
  listBankAccounts(orgId: string): Promise<ConversationalBankAccountRecord[]>;
  listContacts(orgId: string): Promise<ConversationalContactRecord[]>;
  listTransactions(args: {
    orgId: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<ConversationalTransactionRecord[]>;
}

export interface CanonicalPublicMcpReadService {
  searchBankAccounts(orgId: string, input: BankAccountSearchInput): Promise<ReturnType<typeof searchBankAccountCandidates>>;
  searchContacts(orgId: string, input: ContactSearchInput): Promise<ReturnType<typeof searchContactCandidates>>;
  searchTransactions(orgId: string, input: TransactionSearchInput): Promise<ReturnType<typeof searchTransactionCandidates>>;
  getOperationalSummary(orgId: string, input: { dateFrom: string; dateTo: string }): Promise<{
    dateFrom: string;
    dateTo: string;
    transactionCount: number;
    incomeCount: number;
    expenseCount: number;
  }>;
}

function timestampToComparable(value: unknown): unknown {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const toDate = (value as { toDate?: () => Date }).toDate;
    if (typeof toDate === 'function') return toDate.call(value).toISOString();
  }
  return value;
}

/** Server-only data source used by the canonical, read-only pilot service. */
export function createFirestoreConversationalSearchDataSource(): ConversationalSearchDataSource {
  return {
    async listBankAccounts(orgId) {
      const snapshot = await getAdminDb()
        .collection(`organizations/${orgId}/bankAccounts`)
        .select('name', 'bankName', 'iban', 'isDefault', 'isActive', 'archivedAt')
        .limit(100)
        .get();
      return snapshot.docs.flatMap((doc) => {
        const data = doc.data();
        if (typeof data.name !== 'string' || !data.name.trim()) return [];
        return [{
          id: doc.id,
          name: data.name,
          bankName: typeof data.bankName === 'string' ? data.bankName : null,
          iban: typeof data.iban === 'string' ? data.iban : null,
          isDefault: data.isDefault === true,
          isActive: data.isActive !== false,
          archivedAt: timestampToComparable(data.archivedAt),
        }];
      });
    },
    async listContacts(orgId) {
      const snapshot = await getAdminDb()
        .collection(`organizations/${orgId}/contacts`)
        .select('name', 'taxId', 'email', 'type', 'roles', 'status', 'aliases', 'archivedAt')
        .limit(1_000)
        .get();
      return snapshot.docs.flatMap((doc) => {
        const data = doc.data();
        if (typeof data.name !== 'string'
          || (data.type !== 'donor' && data.type !== 'supplier' && data.type !== 'employee')) return [];
        return [{
          id: doc.id,
          name: data.name,
          taxId: typeof data.taxId === 'string' ? data.taxId : null,
          email: typeof data.email === 'string' ? data.email : null,
          type: data.type,
          roles: data.roles && typeof data.roles === 'object'
            ? data.roles as ConversationalContactRecord['roles']
            : null,
          status: typeof data.status === 'string' ? data.status : null,
          aliases: Array.isArray(data.aliases)
            ? data.aliases.filter((alias): alias is string => typeof alias === 'string')
            : null,
          archivedAt: timestampToComparable(data.archivedAt),
        }];
      });
    },
    async listTransactions({ orgId, dateFrom, dateTo }) {
      const db = getAdminDb();
      const results: ConversationalTransactionRecord[] = [];
      let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
      while (results.length < MAX_TRANSACTION_SCAN) {
        let query: FirebaseFirestore.Query = db.collection(`organizations/${orgId}/transactions`).orderBy('date', 'desc');
        if (dateFrom) query = query.where('date', '>=', dateFrom);
        if (dateTo) query = query.where('date', '<=', `${dateTo}T23:59:59.999Z`);
        if (cursor) query = query.startAfter(cursor);
        const snapshot = await query.limit(TRANSACTION_PAGE_SIZE).get();
        if (snapshot.empty) break;
        for (const doc of snapshot.docs) {
          const data = doc.data();
          if (typeof data.date !== 'string' || typeof data.amount !== 'number'
            || !Number.isFinite(data.amount) || typeof data.description !== 'string') continue;
          results.push({
            id: doc.id, date: data.date, amount: data.amount, description: data.description,
            bankAccountId: typeof data.bankAccountId === 'string' ? data.bankAccountId : null,
            contactId: typeof data.contactId === 'string' ? data.contactId : null,
            contactType: data.contactType === 'donor' || data.contactType === 'supplier' || data.contactType === 'employee'
              ? data.contactType : null,
            source: data.source === 'bank' || data.source === 'remittance' || data.source === 'manual' || data.source === 'stripe'
              ? data.source : null,
            transactionType: data.transactionType === 'normal' || data.transactionType === 'return'
              || data.transactionType === 'return_fee' || data.transactionType === 'donation' || data.transactionType === 'fee'
              ? data.transactionType : null,
            donationStatus: data.donationStatus === 'completed' || data.donationStatus === 'returned' || data.donationStatus === 'partial'
              ? data.donationStatus : null,
            archivedAt: timestampToComparable(data.archivedAt),
          });
          if (results.length >= MAX_TRANSACTION_SCAN) break;
        }
        cursor = snapshot.docs[snapshot.docs.length - 1] ?? null;
        if (snapshot.size < TRANSACTION_PAGE_SIZE) break;
      }
      return results;
    },
  };
}

/**
 * One canonical, server-side read service. Channel-specific authentication is
 * complete before this boundary; callers cannot choose an organization here.
 */
export function createCanonicalPublicMcpReadService(
  dataSource: ConversationalSearchDataSource = createFirestoreConversationalSearchDataSource()
): CanonicalPublicMcpReadService {
  return {
    async searchBankAccounts(orgId, input) {
      return searchBankAccountCandidates(await dataSource.listBankAccounts(orgId), input);
    },
    async searchContacts(orgId, input) {
      return searchContactCandidates(await dataSource.listContacts(orgId), input);
    },
    async searchTransactions(orgId, input) {
      const [transactions, accounts] = await Promise.all([
        dataSource.listTransactions({ orgId, ...(input.dateFrom ? { dateFrom: input.dateFrom } : {}), ...(input.dateTo ? { dateTo: input.dateTo } : {}) }),
        dataSource.listBankAccounts(orgId),
      ]);
      return searchTransactionCandidates(transactions, accounts, input);
    },
    async getOperationalSummary(orgId, input) {
      const transactions = await dataSource.listTransactions({ orgId, dateFrom: input.dateFrom, dateTo: input.dateTo });
      return {
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        transactionCount: transactions.length,
        incomeCount: transactions.filter((transaction) => transaction.amount >= 0).length,
        expenseCount: transactions.filter((transaction) => transaction.amount < 0).length,
      };
    },
  };
}
