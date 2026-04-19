import type { Donor } from '@/lib/data';
import type { StripePayoutGroup } from '@/lib/stripe/types';

export interface EditableStripeImputationLine {
  localId: string;
  stripePaymentId: string | null;
  amountGross: number | null;
  feeAmount: number | null;
  contactId: string | null;
  date: string | null;
  customerEmail: string | null;
  description: string | null;
  imputationOrigin: 'csv' | 'manual';
}

export interface StripeDonorUsageStats {
  [donorId: string]: {
    count: number;
    lastDate: string | null;
  };
}

export function calculateEditableStripeImputationSummary(input: {
  lines: EditableStripeImputationLine[];
  bankAmount: number;
}) {
  const totalImputed = input.lines.reduce((sum, line) => sum + (line.amountGross ?? 0), 0);
  const duplicateStripePaymentIds = Array.from(
    input.lines
      .reduce((acc, line) => {
        if (!line.stripePaymentId) return acc;
        acc.set(line.stripePaymentId, (acc.get(line.stripePaymentId) ?? 0) + 1);
        return acc;
      }, new Map<string, number>())
      .entries()
  )
    .filter(([, count]) => count > 1)
    .map(([stripePaymentId]) => stripePaymentId);

  return {
    totalImputed,
    difference: totalImputed - input.bankAmount,
    hasInvalidLines: input.lines.some((line) => !line.contactId || !(line.amountGross && line.amountGross > 0)),
    duplicateStripePaymentIds,
  };
}

export function createManualEditableStripeImputationLine(localId: string): EditableStripeImputationLine {
  return {
    localId,
    stripePaymentId: null,
    amountGross: null,
    feeAmount: null,
    contactId: null,
    date: null,
    customerEmail: null,
    description: null,
    imputationOrigin: 'manual',
  };
}

export function resolveInitialSelectedTransferId(groups: StripePayoutGroup[]): string | null {
  if (groups.length === 0) return null;
  return groups[0]?.transferId ?? null;
}

export function shouldPromptCsvReplacement(lines: EditableStripeImputationLine[]): boolean {
  return lines.length > 0;
}

export function resetEditableStripeImputationLinesFromCsv(input: {
  matchingGroups: StripePayoutGroup[];
  selectedTransferId: string | null;
  donorByEmail: Map<string, string>;
  createLocalId: () => string;
}): EditableStripeImputationLine[] {
  const selectedGroup = input.matchingGroups.find((group) => group.transferId === input.selectedTransferId)
    ?? input.matchingGroups[0]
    ?? null;

  if (!selectedGroup) {
    return [];
  }

  return selectedGroup.rows.map((row) => ({
    localId: input.createLocalId(),
    stripePaymentId: row.id,
    amountGross: row.amount,
    feeAmount: row.fee,
    contactId: row.customerEmail ? input.donorByEmail.get(row.customerEmail.toLowerCase().trim()) ?? null : null,
    date: row.createdDate,
    customerEmail: row.customerEmail,
    description: row.description ?? null,
    imputationOrigin: 'csv',
  }));
}

export function sortDonorsForStripeImputation(
  donors: Donor[],
  usageById: StripeDonorUsageStats
): Donor[] {
  return [...donors].sort((left, right) => {
    const leftUsage = usageById[left.id]?.count ?? 0;
    const rightUsage = usageById[right.id]?.count ?? 0;

    if (leftUsage !== rightUsage) {
      return rightUsage - leftUsage;
    }

    const leftDate = usageById[left.id]?.lastDate ?? '';
    const rightDate = usageById[right.id]?.lastDate ?? '';
    if (leftDate !== rightDate) {
      return rightDate.localeCompare(leftDate);
    }

    return left.name.localeCompare(right.name);
  });
}
