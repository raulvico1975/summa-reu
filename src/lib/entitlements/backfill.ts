import { ENTITLEMENTS_CATALOG_VERSION, catalogEntitlementsFor } from './catalog';
import { normalizePlanId } from './normalize-plan';
import type { OrganizationSubscriptionProjection, SubscriptionStatus } from './types';

export const ENTITLEMENT_BACKFILL_CHUNK_SIZE = 50;

export interface LegacyOrganizationBillingRecord {
  id: string;
  billingPlan?: unknown;
  billingStatus?: unknown;
  currentSubscription?: Partial<OrganizationSubscriptionProjection> | null;
}

export interface EntitlementBackfillItem {
  orgId: string;
  projection: OrganizationSubscriptionProjection;
  diagnostics: string[];
}

function normalizeStatus(value: unknown): SubscriptionStatus | null {
  return value === 'trial' || value === 'active' || value === 'past_due' || value === 'cancelled'
    ? value
    : null;
}

function sameProjection(
  current: Partial<OrganizationSubscriptionProjection> | null | undefined,
  next: OrganizationSubscriptionProjection
): boolean {
  return !!current
    && current.planId === next.planId
    && current.status === next.status
    && current.catalogVersion === next.catalogVersion
    && current.entitlements?.['transactionDocuments.readHistorical'] === next.entitlements['transactionDocuments.readHistorical']
    && current.entitlements?.['transactionDocuments.mutate'] === next.entitlements['transactionDocuments.mutate']
    && current.entitlements?.['pendingDocuments.mutate'] === next.entitlements['pendingDocuments.mutate'];
}

/**
 * Genera un pla idempotent i auditable. No connecta amb Firebase ni escriu dades.
 * L'executor futur haurà de mantenir els chunks <= 50 i usar Admin SDK.
 */
export function buildEntitlementBackfillDryRun(records: LegacyOrganizationBillingRecord[]) {
  const items: EntitlementBackfillItem[] = [];
  const skippedOrgIds: string[] = [];
  const blocked: Array<{ orgId: string; reasons: string[] }> = [];
  const distribution = {
    plans: { control: 0, management: 0, complete: 0 },
    statuses: { trial: 0, active: 0, past_due: 0, cancelled: 0 },
    missingPlan: 0,
    unknownPlan: 0,
    missingStatus: 0,
    unknownStatus: 0,
  };

  for (const record of records) {
    const normalizedPlan = normalizePlanId(record.billingPlan);
    const normalizedStatus = normalizeStatus(record.billingStatus);
    const reasons: string[] = [];
    if (!normalizedPlan) {
      if (record.billingPlan == null || record.billingPlan === '') distribution.missingPlan += 1;
      else distribution.unknownPlan += 1;
      reasons.push('legacy_plan_ambiguous');
    }
    if (!normalizedStatus) {
      if (record.billingStatus == null || record.billingStatus === '') distribution.missingStatus += 1;
      else distribution.unknownStatus += 1;
      reasons.push('billing_status_ambiguous');
    }
    if (!normalizedPlan || !normalizedStatus) {
      blocked.push({ orgId: record.id, reasons });
      continue;
    }
    distribution.plans[normalizedPlan] += 1;
    distribution.statuses[normalizedStatus] += 1;
    const projection: OrganizationSubscriptionProjection = {
      planId: normalizedPlan,
      status: normalizedStatus,
      catalogVersion: ENTITLEMENTS_CATALOG_VERSION,
      entitlements: catalogEntitlementsFor(normalizedPlan),
      effectiveAt: null,
      updatedAt: null,
      origin: 'legacy_backfill_dry_run',
      changeReason: 'catalog_v1_projection',
    };

    if (sameProjection(record.currentSubscription, projection)) {
      skippedOrgIds.push(record.id);
      continue;
    }
    items.push({ orgId: record.id, projection, diagnostics: [] });
  }

  const chunks: EntitlementBackfillItem[][] = [];
  for (let index = 0; index < items.length; index += ENTITLEMENT_BACKFILL_CHUNK_SIZE) {
    chunks.push(items.slice(index, index + ENTITLEMENT_BACKFILL_CHUNK_SIZE));
  }

  return {
    dryRun: true as const,
    canApply: blocked.length === 0,
    total: records.length,
    plannedWrites: items.length,
    skipped: skippedOrgIds.length,
    skippedOrgIds,
    blocked,
    distribution,
    chunks,
  };
}
