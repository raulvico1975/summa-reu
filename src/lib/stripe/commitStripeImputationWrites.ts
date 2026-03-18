import { collection, doc, writeBatch, type Firestore } from 'firebase/firestore';

import type { Donation } from '@/lib/types/donations';
import { planStripeImportChunkSizes } from '@/lib/stripe/import-chunking';

type ParentStripeUpdate = {
  stripeTransferId: string;
};

type ChildWrite<Ref> = {
  ref: Ref;
  data: Donation;
};

type BatchLike<Ref> = {
  set: (ref: Ref, data: Donation) => void;
  update: (ref: Ref, data: ParentStripeUpdate) => void;
  delete: (ref: Ref) => void;
  commit: () => Promise<void>;
};

type PersistStripeImputationDeps<Ref> = {
  createDonationRef: () => Ref;
  createParentTransactionRef: () => Ref;
  createBatch: () => BatchLike<Ref>;
  planChunkSizes?: (totalChildWrites: number) => number[];
  rollbackChunkSize?: number;
};

interface PersistStripeImputationCoreInput<Ref> {
  donations: Donation[];
  adjustment: Donation | null;
  stripeTransferId?: string | null;
  deps: PersistStripeImputationDeps<Ref>;
}

export interface PersistStripeImputationWritesInput {
  firestore: Firestore;
  organizationId: string;
  parentTransactionId: string;
  donations: Donation[];
  adjustment: Donation | null;
  stripeTransferId?: string | null;
}

const ROLLBACK_CHUNK_SIZE = 50;

async function persistStripeImputationWritesCore<Ref>({
  donations,
  adjustment,
  stripeTransferId,
  deps,
}: PersistStripeImputationCoreInput<Ref>): Promise<void> {
  const childWrites: ChildWrite<Ref>[] = donations.map((donation) => ({
    ref: deps.createDonationRef(),
    data: donation,
  }));

  if (adjustment) {
    childWrites.push({
      ref: deps.createDonationRef(),
      data: adjustment,
    });
  }

  const planChunkSizes = deps.planChunkSizes ?? planStripeImportChunkSizes;
  const rollbackChunkSize = deps.rollbackChunkSize ?? ROLLBACK_CHUNK_SIZE;
  const chunkSizes = planChunkSizes(childWrites.length);
  const parentTransactionRef = deps.createParentTransactionRef();
  const committedChildRefs: Ref[] = [];

  try {
    if (chunkSizes.length === 0) {
      if (!stripeTransferId) return;

      const batch = deps.createBatch();
      batch.update(parentTransactionRef, { stripeTransferId });
      await batch.commit();
      return;
    }

    let cursor = 0;
    for (let index = 0; index < chunkSizes.length; index += 1) {
      const chunkSize = chunkSizes[index];
      const chunk = childWrites.slice(cursor, cursor + chunkSize);
      const isLastChunk = index === chunkSizes.length - 1;
      const batch = deps.createBatch();

      for (const item of chunk) {
        batch.set(item.ref, item.data);
      }

      if (isLastChunk && stripeTransferId) {
        batch.update(parentTransactionRef, { stripeTransferId });
      }

      await batch.commit();
      committedChildRefs.push(...chunk.map((item) => item.ref));
      cursor += chunkSize;
    }
  } catch (error) {
    if (committedChildRefs.length > 0) {
      for (let index = 0; index < committedChildRefs.length; index += rollbackChunkSize) {
        const rollbackBatch = deps.createBatch();
        const rollbackChunk = committedChildRefs.slice(index, index + rollbackChunkSize);

        for (const ref of rollbackChunk) {
          rollbackBatch.delete(ref);
        }

        await rollbackBatch.commit();
      }
    }

    throw error;
  }
}

export async function persistStripeImputationWrites({
  firestore,
  organizationId,
  parentTransactionId,
  donations,
  adjustment,
  stripeTransferId = null,
}: PersistStripeImputationWritesInput): Promise<void> {
  const donationsRef = collection(firestore, 'organizations', organizationId, 'donations');
  const parentTransactionRef = doc(
    firestore,
    'organizations',
    organizationId,
    'transactions',
    parentTransactionId
  );

  await persistStripeImputationWritesCore({
    donations,
    adjustment,
    stripeTransferId,
    deps: {
      createDonationRef: () => doc(donationsRef),
      createParentTransactionRef: () => parentTransactionRef,
      createBatch: () => writeBatch(firestore),
    },
  });
}

export const __stripeImputationWritesTestUtils = {
  persistStripeImputationWritesCore,
};
