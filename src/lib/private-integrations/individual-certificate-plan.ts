import { createHash, randomUUID } from 'node:crypto';
import type { AnyContact, Organization, Transaction } from '@/lib/data';
import {
  buildIndividualDonationCertificatePreparation,
  type PrepareEntityDataSource,
} from './prepare-only';

export const INDIVIDUAL_CERTIFICATE_PLAN_TTL_MS = 15 * 60 * 1000;

export interface IndividualCertificatePlan {
  planId: string;
  type: 'individual_donation_certificate';
  status: 'prepared' | 'processing' | 'consumed' | 'blocked';
  orgId: string;
  tokenId: string;
  transactionId: string;
  donorId: string;
  donorName: string;
  amount: number;
  movementDate: string;
  preconditionToken: string;
  confirmationText: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
  blockedAt: string | null;
  blockedReason: string | null;
  pdfSha256: string | null;
  pdfSizeBytes: number | null;
}

export interface IndividualCertificateClaimArgs {
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

export interface IndividualCertificatePlanStore {
  create(plan: IndividualCertificatePlan): Promise<void>;
  claim(args: IndividualCertificateClaimArgs): Promise<{ ok: true; plan: IndividualCertificatePlan } | { ok: false; code: string }>;
  complete(args: { planId: string; now: string; pdfSha256: string; pdfSizeBytes: number }): Promise<void>;
  block(args: { planId: string; now: string; reason: string }): Promise<void>;
}

export interface IndividualCertificateGenerator {
  generate(plan: IndividualCertificatePlan, issueDate: Date): Promise<
    { ok: true; pdfBase64: string; pdfSha256: string; pdfSizeBytes: number; filename: string; warnings: string[] }
    | { ok: false; code: string }
  >;
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function certificateSnapshot(input: {
  organization: Organization;
  transaction: Transaction;
  donor: AnyContact;
}) {
  const { organization, transaction, donor } = input;
  return {
    organization: {
      id: organization.id, status: organization.status, name: organization.name,
      taxId: organization.taxId, address: organization.address ?? null,
      zipCode: organization.zipCode ?? null, city: organization.city ?? null,
      province: organization.province ?? null, signatoryName: organization.signatoryName ?? null,
      signatoryRole: organization.signatoryRole ?? null, language: organization.language ?? 'es',
      logoUrl: organization.logoUrl ?? null, signatureUrl: organization.signatureUrl ?? null,
    },
    transaction: {
      id: transaction.id, date: transaction.date, amount: transaction.amount,
      contactId: transaction.contactId ?? null, contactType: transaction.contactType ?? null,
      transactionType: transaction.transactionType ?? null, fiscalKind: transaction.fiscalKind ?? null,
      archivedAt: transaction.archivedAt ?? null, donationStatus: transaction.donationStatus ?? null,
    },
    donor: {
      id: donor.id, type: donor.type, donorRole: donor.type === 'donor' || donor.roles?.donor === true,
      name: donor.name, taxId: donor.taxId, address: 'address' in donor ? donor.address ?? null : null,
      zipCode: donor.zipCode, city: donor.city ?? null, province: donor.province ?? null,
      archivedAt: donor.archivedAt ?? null,
    },
  };
}

export function certificatePrecondition(input: { organization: Organization; transaction: Transaction; donor: AnyContact }): string {
  return `cert_pre_${hash(certificateSnapshot(input)).slice(0, 32)}`;
}

export function validateIndividualCertificateClaim(plan: IndividualCertificatePlan, args: IndividualCertificateClaimArgs): string | null {
  if (plan.planId !== args.planId) return 'PLAN_NOT_FOUND';
  if (plan.orgId !== args.orgId) return 'PLAN_ORG_MISMATCH';
  if (plan.tokenId !== args.tokenId) return 'PLAN_TOKEN_MISMATCH';
  if (plan.transactionId !== args.transactionId) return 'PLAN_TRANSACTION_MISMATCH';
  if (plan.donorId !== args.donorId) return 'PLAN_DONOR_MISMATCH';
  if (plan.preconditionToken !== args.preconditionToken) return 'PRECONDITION_MISMATCH';
  if (!args.humanConfirmed || plan.confirmationText !== args.confirmationText) return 'HUMAN_CONFIRMATION_REQUIRED';
  if (plan.status !== 'prepared') return plan.status === 'consumed' ? 'PLAN_ALREADY_USED' : 'PLAN_NOT_PREPARED';
  if (Date.parse(plan.expiresAt) <= Date.parse(args.now)) return 'PLAN_EXPIRED';
  return null;
}

export async function prepareIndividualCertificatePlan(
  input: { orgId: string; tokenId: string; transactionId: string; donorId: string; now?: Date; planIdFactory?: () => string },
  dataSource: PrepareEntityDataSource,
  store: IndividualCertificatePlanStore
) {
  const [organization, transaction, donor] = await Promise.all([
    dataSource.getOrganization(input.orgId), dataSource.getTransaction(input.orgId, input.transactionId),
    dataSource.getContact(input.orgId, input.donorId),
  ]);
  const preparation = buildIndividualDonationCertificatePreparation(
    { orgId: input.orgId, transactionId: input.transactionId, donorId: input.donorId },
    organization, transaction, donor
  );
  if (!preparation.prepared || !organization || !transaction || !donor) {
    return { prepared: false as const, code: 'CERTIFICATE_BLOCKED', blockers: preparation.blockers, preparation };
  }
  const now = input.now ?? new Date();
  const planId = `icp_${(input.planIdFactory?.() ?? randomUUID()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 28)}`;
  const preconditionToken = certificatePrecondition({ organization, transaction, donor });
  const plan: IndividualCertificatePlan = {
    planId, type: 'individual_donation_certificate', status: 'prepared', orgId: input.orgId,
    tokenId: input.tokenId, transactionId: input.transactionId, donorId: input.donorId,
    donorName: donor.name, amount: transaction.amount, movementDate: transaction.date, preconditionToken,
    confirmationText: `CONFIRMO GENERAR EL CERTIFICAT DE LA DONACIO ${input.transactionId} DE ${transaction.amount} PER A ${donor.name} AMB EL PLA ${planId}`,
    createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + INDIVIDUAL_CERTIFICATE_PLAN_TTL_MS).toISOString(),
    consumedAt: null, blockedAt: null, blockedReason: null, pdfSha256: null, pdfSizeBytes: null,
  };
  await store.create(plan);
  return { prepared: true as const, plan, preparation };
}

export async function generateIndividualCertificatePlan(
  input: IndividualCertificateClaimArgs,
  store: IndividualCertificatePlanStore,
  generator: IndividualCertificateGenerator
) {
  const claimed = await store.claim(input);
  if (!claimed.ok) return { generated: false as const, code: claimed.code };
  const result = await generator.generate(claimed.plan, new Date(input.now));
  if (!result.ok) {
    await store.block({ planId: input.planId, now: input.now, reason: result.code });
    return { generated: false as const, code: result.code };
  }
  await store.complete({ planId: input.planId, now: input.now, pdfSha256: result.pdfSha256, pdfSizeBytes: result.pdfSizeBytes });
  return { generated: true as const, ...result };
}
