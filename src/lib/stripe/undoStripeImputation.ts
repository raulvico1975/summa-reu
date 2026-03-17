import { collection, getDocs, query, where, writeBatch, type Firestore } from 'firebase/firestore';
import type { Donation } from '@/lib/types/donations';

interface UndoStripeImputationStore {
  listByParentTransactionId: (parentTransactionId: string) => Promise<Donation[]>;
  deleteById: (id: string) => Promise<void>;
}

interface UndoStripeImputationInput {
  parentTransactionId: string;
  store: UndoStripeImputationStore;
}

export async function undoStripeImputation({
  parentTransactionId,
  store,
}: UndoStripeImputationInput): Promise<{ deletedCount: number }> {
  const donations = await store.listByParentTransactionId(parentTransactionId);
  const stripeDonations = donations.filter((donation) => donation.source === 'stripe' && donation.id);

  for (const donation of stripeDonations) {
    await store.deleteById(donation.id!);
  }

  return { deletedCount: stripeDonations.length };
}

export async function undoStripeImputationInFirestore({
  firestore,
  organizationId,
  parentTransactionId,
}: {
  firestore: Firestore;
  organizationId: string;
  parentTransactionId: string;
}): Promise<{ deletedCount: number }> {
  const donationsRef = collection(firestore, 'organizations', organizationId, 'donations');
  const snapshot = await getDocs(
    query(
      donationsRef,
      where('parentTransactionId', '==', parentTransactionId),
      where('source', '==', 'stripe')
    )
  );

  const batch = writeBatch(firestore);
  snapshot.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });
  await batch.commit();

  return { deletedCount: snapshot.size };
}
