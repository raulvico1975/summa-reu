import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import { finalizeTransactionDocumentStorageCleanupAdmin } from './transaction-document-registry';

export async function processTransactionDocumentStorageCleanupAdmin(input: {
  db: Firestore;
  bucket: Bucket;
  orgId: string;
  transactionId: string;
  storageCleanupPaths: string[];
}): Promise<{
  cleanupPending: boolean;
  storageCleanupPaths: string[];
  cleanupErrors: string[];
}> {
  const requested = [...new Set(input.storageCleanupPaths)];
  if (requested.length === 0) {
    return { cleanupPending: false, storageCleanupPaths: [], cleanupErrors: [] };
  }

  const cleaned: string[] = [];
  const cleanupErrors: string[] = [];
  for (const path of requested) {
    try {
      await input.bucket.file(path).delete({ ignoreNotFound: true });
      cleaned.push(path);
    } catch {
      cleanupErrors.push(path);
    }
  }

  if (cleaned.length > 0) {
    try {
      const finalized = await finalizeTransactionDocumentStorageCleanupAdmin({
        db: input.db,
        orgId: input.orgId,
        transactionId: input.transactionId,
        cleanedPaths: cleaned,
      });
      return {
        ...finalized,
        cleanupErrors,
      };
    } catch {
      return {
        cleanupPending: true,
        storageCleanupPaths: requested,
        cleanupErrors: [...new Set([...cleanupErrors, ...cleaned])],
      };
    }
  }

  return {
    cleanupPending: true,
    storageCleanupPaths: requested,
    cleanupErrors,
  };
}
