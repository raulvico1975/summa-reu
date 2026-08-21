import {
  doc,
  increment,
  runTransaction,
  type CollectionReference,
} from 'firebase/firestore';
import type { DonationStatus, Transaction } from '@/lib/data';
import { assertFiscalTxCanBeSaved } from '@/lib/fiscal/assertFiscalInvariant';

type ReturnUpdate = {
  transactionType: 'return';
  contactId: string;
  contactType: 'donor';
  linkedTransactionId: string | null;
};

type DonationUpdate = {
  donationStatus: DonationStatus;
  linkedTransactionId: string;
};

export type SingleReturnAssignmentPlan = {
  returnUpdate: ReturnUpdate;
  donationUpdate: DonationUpdate | null;
};

function toAbsoluteCents(amount: number): number {
  return Math.round(Math.abs(amount) * 100);
}

export function buildSingleReturnAssignmentPlan(input: {
  returnTransaction: Pick<Transaction, 'id' | 'amount'>;
  donorId: string;
  linkedDonation?: Pick<
    Transaction,
    'id' | 'amount' | 'contactId' | 'transactionType' | 'linkedTransactionId'
  > | null;
}): SingleReturnAssignmentPlan {
  const { returnTransaction, donorId, linkedDonation = null } = input;

  if (!donorId.trim()) {
    throw new Error('Return assignment requires a donor');
  }

  if (!Number.isFinite(returnTransaction.amount) || returnTransaction.amount >= 0) {
    throw new Error('Return assignment requires a negative amount');
  }

  if (linkedDonation) {
    if (!Number.isFinite(linkedDonation.amount) || linkedDonation.amount <= 0) {
      throw new Error('Linked donation requires a positive amount');
    }

    if (linkedDonation.contactId !== donorId) {
      throw new Error('Linked donation belongs to a different donor');
    }

    if (linkedDonation.transactionType !== 'donation') {
      throw new Error('Linked transaction is not a donation');
    }

    if (
      linkedDonation.linkedTransactionId &&
      linkedDonation.linkedTransactionId !== returnTransaction.id
    ) {
      throw new Error('Linked donation is already assigned to another return');
    }

    if (toAbsoluteCents(returnTransaction.amount) > toAbsoluteCents(linkedDonation.amount)) {
      throw new Error('Linked return amount cannot exceed the donation amount');
    }
  }

  return {
    returnUpdate: {
      transactionType: 'return',
      contactId: donorId,
      contactType: 'donor',
      linkedTransactionId: linkedDonation?.id ?? null,
    },
    donationUpdate: linkedDonation
      ? {
          donationStatus: toAbsoluteCents(linkedDonation.amount) === toAbsoluteCents(returnTransaction.amount)
            ? 'returned'
            : 'partial',
          linkedTransactionId: returnTransaction.id,
        }
      : null,
  };
}

/**
 * Assigna una devolució i, si escau, marca la donació original en una única
 * transacció Firestore. No es mostra èxit fins que totes les escriptures han
 * quedat confirmades.
 */
export async function assignReturnAtomically(input: {
  transactionsCollection: CollectionReference;
  contactsCollection?: CollectionReference | null;
  organizationId: string;
  returnTransactionId: string;
  donorId: string;
  linkedDonationId?: string | null;
  route?: string;
}): Promise<SingleReturnAssignmentPlan> {
  const {
    transactionsCollection,
    contactsCollection,
    organizationId,
    returnTransactionId,
    donorId,
    linkedDonationId = null,
    route,
  } = input;

  const returnRef = doc(transactionsCollection, returnTransactionId);
  const linkedDonationRef = linkedDonationId
    ? doc(transactionsCollection, linkedDonationId)
    : null;

  return runTransaction(transactionsCollection.firestore, async (firestoreTransaction) => {
    const returnSnapshot = await firestoreTransaction.get(returnRef);
    if (!returnSnapshot.exists()) {
      throw new Error('Return transaction does not exist');
    }

    const linkedDonationSnapshot = linkedDonationRef
      ? await firestoreTransaction.get(linkedDonationRef)
      : null;
    if (linkedDonationRef && !linkedDonationSnapshot?.exists()) {
      throw new Error('Linked donation does not exist');
    }

    const returnSource = {
      id: returnSnapshot.id,
      ...returnSnapshot.data(),
    } as Transaction;
    const linkedDonation = linkedDonationSnapshot
      ? ({ id: linkedDonationSnapshot.id, ...linkedDonationSnapshot.data() } as Transaction)
      : null;

    const plan = buildSingleReturnAssignmentPlan({
      returnTransaction: returnSource,
      donorId,
      linkedDonation,
    });

    assertFiscalTxCanBeSaved(
      {
        transactionType: plan.returnUpdate.transactionType,
        amount: returnSource.amount,
        contactId: plan.returnUpdate.contactId,
      },
      {
        firestore: transactionsCollection.firestore,
        orgId: organizationId,
        operation: 'createReturn',
        route,
      }
    );

    firestoreTransaction.update(returnRef, plan.returnUpdate);

    if (linkedDonationRef && plan.donationUpdate) {
      firestoreTransaction.update(linkedDonationRef, plan.donationUpdate);

      if (contactsCollection) {
        firestoreTransaction.update(doc(contactsCollection, donorId), {
          returnCount: increment(1),
          lastReturnDate: returnSource.date || new Date().toISOString(),
          status: 'pending_return',
        });
      }
    }

    return plan;
  });
}
