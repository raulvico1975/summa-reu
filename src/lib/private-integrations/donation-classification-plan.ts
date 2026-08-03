import { createHash, randomUUID } from 'node:crypto';
import type { AnyContact, Transaction } from '@/lib/data';
import {
  buildDonationClassificationPreparation,
  type PrepareEntityDataSource,
} from './prepare-only';

export const DONATION_CLASSIFICATION_PLAN_TTL_MS = 15 * 60 * 1000;

export interface DonationClassificationPlan {
  planId: string;
  type: 'donation_classification';
  status: 'prepared' | 'processing' | 'consumed' | 'blocked';
  orgId: string;
  tokenId: string;
  transactionId: string;
  donorId: string;
  donorName: string;
  amount: number;
  preconditionToken: string;
  transactionSnapshotHash: string;
  donorSnapshotHash: string;
  proposedPatch: {
    contactId: string;
    contactType: 'donor';
    transactionType: 'donation';
    fiscalKind: 'donation';
  };
  confirmationText: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
  blockedAt: string | null;
  blockedReason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface DonationClassificationClaimArgs {
  planId: string;
  orgId: string;
  tokenId: string;
  transactionId: string;
  donorId: string;
  preconditionToken: string;
  confirmationText: string;
  humanConfirmed: boolean;
  now: string;
}

export interface DonationClassificationPlanStore {
  create(plan: DonationClassificationPlan): Promise<void>;
  claim(args: DonationClassificationClaimArgs): Promise<
    { ok: true; plan: DonationClassificationPlan } | { ok: false; code: string }
  >;
  complete(args: {
    planId: string;
    now: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  }): Promise<void>;
  block(args: { planId: string; now: string; reason: string }): Promise<void>;
}

export interface DonationClassificationAtomicExecutor {
  apply(plan: DonationClassificationPlan): Promise<{
    ok: true;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  } | { ok: false; code: string }>;
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function transactionClassificationSnapshot(transaction: Transaction) {
  return {
    id: transaction.id,
    contactId: transaction.contactId ?? null,
    contactType: transaction.contactType ?? null,
    transactionType: transaction.transactionType ?? null,
    fiscalKind: transaction.fiscalKind ?? null,
    amount: transaction.amount,
    archivedAt: transaction.archivedAt ?? null,
    donationStatus: transaction.donationStatus ?? null,
  };
}

export function donorClassificationSnapshot(donor: AnyContact) {
  return {
    id: donor.id,
    type: donor.type,
    donorRole: donor.type === 'donor' || donor.roles?.donor === true,
    archivedAt: donor.archivedAt ?? null,
  };
}

export function classificationSnapshotHashes(transaction: Transaction, donor: AnyContact) {
  return {
    transactionSnapshotHash: hash(transactionClassificationSnapshot(transaction)),
    donorSnapshotHash: hash(donorClassificationSnapshot(donor)),
  };
}

export function validateDonationClassificationClaim(
  plan: DonationClassificationPlan,
  args: DonationClassificationClaimArgs
): string | null {
  if (plan.planId !== args.planId) return 'PLAN_NOT_FOUND';
  if (plan.orgId !== args.orgId) return 'PLAN_ORG_MISMATCH';
  if (plan.tokenId !== args.tokenId) return 'PLAN_TOKEN_MISMATCH';
  if (plan.transactionId !== args.transactionId) return 'PLAN_TRANSACTION_MISMATCH';
  if (plan.donorId !== args.donorId) return 'PLAN_DONOR_MISMATCH';
  if (plan.preconditionToken !== args.preconditionToken) return 'PRECONDITION_MISMATCH';
  if (!args.humanConfirmed || plan.confirmationText !== args.confirmationText) {
    return 'HUMAN_CONFIRMATION_REQUIRED';
  }
  if (plan.status !== 'prepared') {
    return plan.status === 'consumed' ? 'PLAN_ALREADY_USED' : 'PLAN_NOT_PREPARED';
  }
  if (Date.parse(plan.expiresAt) <= Date.parse(args.now)) return 'PLAN_EXPIRED';
  return null;
}

export async function prepareDonationClassificationPlan(
  input: {
    orgId: string;
    tokenId: string;
    transactionId: string;
    donorId: string;
    now?: Date;
    planIdFactory?: () => string;
  },
  dataSource: PrepareEntityDataSource,
  store: DonationClassificationPlanStore
): Promise<{ prepared: true; plan: DonationClassificationPlan }
  | { prepared: false; code: string; blockers: string[] }> {
  const [transaction, donor] = await Promise.all([
    dataSource.getTransaction(input.orgId, input.transactionId),
    dataSource.getContact(input.orgId, input.donorId),
  ]);
  const preparation = buildDonationClassificationPreparation(input, transaction, donor);
  if (
    !preparation.prepared || !transaction || !donor
    || !preparation.preconditionToken || !preparation.proposedPatch
  ) {
    return { prepared: false, code: 'CLASSIFICATION_BLOCKED', blockers: preparation.blockers };
  }
  const now = input.now ?? new Date();
  const planId = `dcp_${(input.planIdFactory?.() ?? randomUUID()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 28)}`;
  const snapshots = classificationSnapshotHashes(transaction, donor);
  const plan: DonationClassificationPlan = {
    planId,
    type: 'donation_classification',
    status: 'prepared',
    orgId: input.orgId,
    tokenId: input.tokenId,
    transactionId: input.transactionId,
    donorId: input.donorId,
    donorName: donor.name,
    amount: transaction.amount,
    preconditionToken: preparation.preconditionToken,
    ...snapshots,
    proposedPatch: preparation.proposedPatch,
    confirmationText: `CONFIRMO CLASSIFICAR EL MOVIMENT ${input.transactionId} DE ${transaction.amount} COM A DONACIO DE ${donor.name} AMB EL PLA ${planId}`,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + DONATION_CLASSIFICATION_PLAN_TTL_MS).toISOString(),
    consumedAt: null,
    blockedAt: null,
    blockedReason: null,
    before: null,
    after: null,
  };
  await store.create(plan);
  return { prepared: true, plan };
}

export async function applyDonationClassificationPlan(
  input: DonationClassificationClaimArgs & { nowDate?: Date },
  store: DonationClassificationPlanStore,
  executor: DonationClassificationAtomicExecutor
): Promise<{ applied: true; before: Record<string, unknown>; after: Record<string, unknown> }
  | { applied: false; code: string }> {
  const claimed = await store.claim(input);
  if (!claimed.ok) return { applied: false, code: claimed.code };
  const result = await executor.apply(claimed.plan);
  const now = input.now;
  if (!result.ok) {
    await store.block({ planId: input.planId, now, reason: result.code });
    return { applied: false, code: result.code };
  }
  await store.complete({ planId: input.planId, now, before: result.before, after: result.after });
  return { applied: true, before: result.before, after: result.after };
}
