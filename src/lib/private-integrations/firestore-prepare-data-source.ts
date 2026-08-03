import type { Firestore } from 'firebase-admin/firestore';
import type { AnyContact, BankAccount, Organization, Transaction } from '@/lib/data';
import type {
  BankStatementPreviewDataSource,
  PrepareEntityDataSource,
} from './prepare-only';

export interface FirestorePrepareDataSource
  extends BankStatementPreviewDataSource, PrepareEntityDataSource {}

export function createFirestorePrepareDataSource(db: Firestore): FirestorePrepareDataSource {
  return {
    async getBankAccount(orgId, bankAccountId) {
      const snapshot = await db.doc(`organizations/${orgId}/bankAccounts/${bankAccountId}`).get();
      if (!snapshot.exists) return null;
      return { id: snapshot.id, ...snapshot.data() } as BankAccount;
    },

    async listTransactions({ orgId, bankAccountId, dateFrom, dateTo }) {
      const snapshot = await db
        .collection(`organizations/${orgId}/transactions`)
        .where('bankAccountId', '==', bankAccountId)
        .where('date', '>=', dateFrom)
        .where('date', '<=', `${dateTo}T23:59:59.999Z`)
        .get();
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Transaction);
    },

    async getTransaction(orgId, transactionId) {
      const snapshot = await db.doc(`organizations/${orgId}/transactions/${transactionId}`).get();
      if (!snapshot.exists) return null;
      return { id: snapshot.id, ...snapshot.data() } as Transaction;
    },

    async getContact(orgId, contactId) {
      const snapshot = await db.doc(`organizations/${orgId}/contacts/${contactId}`).get();
      if (!snapshot.exists) return null;
      return { id: snapshot.id, ...snapshot.data() } as AnyContact;
    },

    async getOrganization(orgId) {
      const snapshot = await db.doc(`organizations/${orgId}`).get();
      if (!snapshot.exists) return null;
      return { id: snapshot.id, ...snapshot.data() } as Organization;
    },
  };
}
