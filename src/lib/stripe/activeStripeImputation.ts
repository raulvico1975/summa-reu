import { collection, getDocs, query, where, type Firestore } from 'firebase/firestore';

import type { Donation } from '@/lib/types/donations';

export const ERR_STRIPE_PARENT_ALREADY_IMPUTED = 'ERR_STRIPE_PARENT_ALREADY_IMPUTED';

export interface StripeImputationLineSummary {
  id: string;
  date: string;
  amountGross: number;
  contactId: string | null;
  donorDisplayName: string | null;
  stripePaymentId: string | null;
  customerEmail: string | null;
  description: string | null;
  imputationOrigin: string | null;
}

export interface StripeImputationSummary {
  parentTransactionId: string;
  donationCount: number;
  adjustmentCount: number;
  totalAmount: number;
  donorNames: string[];
  donorPreview: string;
  lines: StripeImputationLineSummary[];
}

function hasValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeStripeDonationAmount(donation: Donation): number {
  if (typeof donation.amountGross === 'number' && Number.isFinite(donation.amountGross)) {
    return donation.amountGross;
  }

  if (typeof donation.amount === 'number' && Number.isFinite(donation.amount)) {
    return donation.amount;
  }

  return 0;
}

export function isActiveStripeImputationRecord(donation: Donation): boolean {
  return donation.source === 'stripe' && hasValue(donation.parentTransactionId) && !donation.archivedAt;
}

export function isVisibleStripeImputationDonation(donation: Donation): boolean {
  return Boolean(
    isActiveStripeImputationRecord(donation) &&
      donation.type !== 'stripe_adjustment' &&
      donation.contactId &&
      normalizeStripeDonationAmount(donation) > 0
  );
}

export function formatStripeImputationDonorName(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, ' ');
  if (!cleaned) return cleaned;

  const parts = cleaned.split(' ');
  if (parts.length === 1) {
    return cleaned;
  }

  const firstName = parts[0];
  const lastNameInitial = parts[parts.length - 1]?.charAt(0).toUpperCase();
  return lastNameInitial ? `${firstName} ${lastNameInitial}.` : firstName;
}

export function buildStripeImputationDonorPreview(donorNames: string[]): string {
  if (donorNames.length === 0) return 'Sense donant';
  if (donorNames.length === 1) return donorNames[0];
  if (donorNames.length === 2) return `${donorNames[0]}, ${donorNames[1]}`;
  return `${donorNames[0]}, ${donorNames[1]} +${donorNames.length - 2}`;
}

export function formatStripeImputationStatus(summary: StripeImputationSummary): string {
  const donationLabel = `${summary.donationCount} donaci${summary.donationCount === 1 ? 'o' : 'ons'}`;
  return `Stripe imputat · ${donationLabel} · ${summary.donorPreview}`;
}

export function getStripeParentAlreadyImputedMessage(): string {
  return 'Aquest moviment ja té una imputació Stripe activa. Obre el detall "Stripe imputat" i fes "Desfer imputació Stripe" abans de tornar-ho a provar.';
}

export function summarizeActiveStripeImputation(input: {
  parentTransactionId: string;
  donations: Donation[];
  donorNameById?: Record<string, string | null | undefined>;
}): StripeImputationSummary | null {
  const activeLines = input.donations
    .filter((donation) => donation.parentTransactionId === input.parentTransactionId)
    .filter(isActiveStripeImputationRecord);

  if (activeLines.length === 0) {
    return null;
  }

  const donationLines = activeLines.filter(isVisibleStripeImputationDonation);
  const donorNames = Array.from(
    new Set(
      donationLines
        .map((donation) => {
          const donorName = donation.contactId ? input.donorNameById?.[donation.contactId] : null;
          if (hasValue(donorName)) {
            return formatStripeImputationDonorName(donorName);
          }
          if (hasValue(donation.customerEmail)) {
            return donation.customerEmail.trim();
          }
          return null;
        })
        .filter((value): value is string => hasValue(value))
    )
  );

  const lines: StripeImputationLineSummary[] = donationLines
    .map((donation) => ({
      id: donation.id ?? donation.stripePaymentId ?? `${input.parentTransactionId}-${donation.date}`,
      date: donation.date,
      amountGross: normalizeStripeDonationAmount(donation),
      contactId: donation.contactId ?? null,
      donorDisplayName: donation.contactId ? input.donorNameById?.[donation.contactId] ?? null : null,
      stripePaymentId: donation.stripePaymentId ?? null,
      customerEmail: donation.customerEmail ?? null,
      description: donation.description ?? null,
      imputationOrigin: donation.imputationOrigin ?? null,
    }))
    .sort((left, right) => {
      if (left.date !== right.date) {
        return right.date.localeCompare(left.date);
      }
      return left.id.localeCompare(right.id);
    });

  return {
    parentTransactionId: input.parentTransactionId,
    donationCount: donationLines.length,
    adjustmentCount: activeLines.filter((donation) => donation.type === 'stripe_adjustment').length,
    totalAmount: donationLines.reduce((sum, donation) => sum + normalizeStripeDonationAmount(donation), 0),
    donorNames,
    donorPreview: buildStripeImputationDonorPreview(donorNames),
    lines,
  };
}

export function summarizeActiveStripeImputationsByParent(input: {
  donations: Donation[];
  donorNameById?: Record<string, string | null | undefined>;
}): Record<string, StripeImputationSummary> {
  const parentIds = Array.from(
    new Set(
      input.donations
        .filter(isActiveStripeImputationRecord)
        .map((donation) => donation.parentTransactionId)
        .filter((parentTransactionId): parentTransactionId is string => hasValue(parentTransactionId))
    )
  );

  return parentIds.reduce((accumulator, parentTransactionId) => {
    const summary = summarizeActiveStripeImputation({
      parentTransactionId,
      donations: input.donations,
      donorNameById: input.donorNameById,
    });

    if (summary) {
      accumulator[parentTransactionId] = summary;
    }

    return accumulator;
  }, {} as Record<string, StripeImputationSummary>);
}

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
    return isActiveStripeImputationRecord(donation);
  });

  if (hasActiveImputation) {
    throw new Error(ERR_STRIPE_PARENT_ALREADY_IMPUTED);
  }
}
