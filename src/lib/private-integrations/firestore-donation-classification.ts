import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { AnyContact, Transaction } from '@/lib/data';
import { safeSet, safeUpdate } from '@/lib/safe-write';
import { buildDonationClassificationPreparation } from './prepare-only';
import {
  classificationSnapshotHashes,
  transactionClassificationSnapshot,
  validateDonationClassificationClaim,
  type DonationClassificationAtomicExecutor,
  type DonationClassificationPlan,
  type DonationClassificationPlanStore,
} from './donation-classification-plan';

const COLLECTION = 'integrationActionPlans';

function asPlan(planId: string, raw: FirebaseFirestore.DocumentData | undefined): DonationClassificationPlan | null {
  return raw?.planId === planId && raw.type === 'donation_classification'
    ? raw as DonationClassificationPlan
    : null;
}

export function createFirestoreDonationClassificationPlanStore(
  db: Firestore
): DonationClassificationPlanStore {
  const ref = (planId: string) => db.doc(`${COLLECTION}/${planId}`);
  return {
    async create(plan) {
      await safeSet({
        data: plan as unknown as Record<string, unknown>,
        context: {
          updatedBy: plan.tokenId,
          source: 'system',
          updatedAtFactory: () => FieldValue.serverTimestamp(),
          requiredFields: [
            'planId', 'type', 'status', 'orgId', 'tokenId', 'transactionId', 'donorId',
            'preconditionToken', 'transactionSnapshotHash', 'donorSnapshotHash',
            'confirmationText', 'expiresAt',
          ],
          amountFields: ['amount'],
        },
        write: (payload) => ref(plan.planId).create(payload),
      });
    },
    async claim(args) {
      const planRef = ref(args.planId);
      const claimed = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(planRef);
        const plan = asPlan(args.planId, snapshot.data());
        if (!plan) return { ok: false as const, code: 'PLAN_NOT_FOUND' };
        const code = validateDonationClassificationClaim(plan, args);
        if (code) return { ok: false as const, code };
        transaction.update(planRef, {
          status: 'processing',
          processingAt: args.now,
          confirmationRecorded: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { ok: true as const, plan: { ...plan, status: 'processing' as const } };
      });
      return claimed;
    },
    async complete(args) {
      await safeUpdate({
        data: {
          status: 'consumed',
          consumedAt: args.now,
          blockedAt: null,
          blockedReason: null,
          before: args.before,
          after: args.after,
        },
        context: {
          source: 'system',
          updatedAtFactory: () => FieldValue.serverTimestamp(),
          requiredFields: ['status', 'consumedAt', 'before', 'after'],
        },
        write: (payload) => ref(args.planId).set(payload, { merge: true }),
      });
    },
    async block(args) {
      await safeUpdate({
        data: { status: 'blocked', blockedAt: args.now, blockedReason: args.reason },
        context: {
          source: 'system',
          updatedAtFactory: () => FieldValue.serverTimestamp(),
          requiredFields: ['status', 'blockedAt', 'blockedReason'],
        },
        write: (payload) => ref(args.planId).set(payload, { merge: true }),
      });
    },
  };
}

export function createFirestoreDonationClassificationExecutor(
  db: Firestore
): DonationClassificationAtomicExecutor {
  return {
    async apply(plan) {
      return db.runTransaction(async (transaction) => {
        const transactionRef = db.doc(`organizations/${plan.orgId}/transactions/${plan.transactionId}`);
        const donorRef = db.doc(`organizations/${plan.orgId}/contacts/${plan.donorId}`);
        const [transactionSnapshot, donorSnapshot] = await Promise.all([
          transaction.get(transactionRef),
          transaction.get(donorRef),
        ]);
        const movement = transactionSnapshot.exists
          ? { id: transactionSnapshot.id, ...transactionSnapshot.data() } as Transaction
          : null;
        const donor = donorSnapshot.exists
          ? { id: donorSnapshot.id, ...donorSnapshot.data() } as AnyContact
          : null;
        const preparation = buildDonationClassificationPreparation({
          orgId: plan.orgId,
          transactionId: plan.transactionId,
          donorId: plan.donorId,
        }, movement, donor);
        if (!preparation.prepared || !movement || !donor) {
          return { ok: false as const, code: preparation.blockers[0] ?? 'CLASSIFICATION_BLOCKED' };
        }
        if (preparation.preconditionToken !== plan.preconditionToken) {
          return { ok: false as const, code: 'PRECONDITION_DRIFT' };
        }
        const hashes = classificationSnapshotHashes(movement, donor);
        if (
          hashes.transactionSnapshotHash !== plan.transactionSnapshotHash
          || hashes.donorSnapshotHash !== plan.donorSnapshotHash
        ) {
          return { ok: false as const, code: 'SNAPSHOT_DRIFT' };
        }
        const before = transactionClassificationSnapshot(movement);
        const after = { ...before, ...plan.proposedPatch };
        transaction.update(transactionRef, plan.proposedPatch);
        return { ok: true as const, before, after };
      });
    },
  };
}
