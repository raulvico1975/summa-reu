import { collection, getDocs, query, where, type Firestore } from 'firebase/firestore';

import type { Donation } from '@/lib/types/donations';

export const ERR_STRIPE_PARENT_ALREADY_IMPUTED = 'ERR_STRIPE_PARENT_ALREADY_IMPUTED';

export async function assertNoActiveStripeImputationByParentTransactionId(input: {
  firestore: Firestore;
  organizationId: string;
  parentTransactionId: string;
}): Promise<void> {
  const donationsRef = collection(input.firestore, 'organizations', input.organizationId, 'donations');
  const snapshot = await getDocs(
    query(donationsRef, where('parentTransactionId', '==', input.parentTransactionId))
  );

  const hasActiveImputation = snapshot.docs.some((docSnap) => {
    const donation = docSnap.data() as Donation;
    return !donation.archivedAt;
  });

  if (hasActiveImputation) {
    throw new Error(ERR_STRIPE_PARENT_ALREADY_IMPUTED);
  }
}
