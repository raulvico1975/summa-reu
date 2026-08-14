import { createHash } from 'node:crypto';
import type { EntitlementCapability, ResolvedEntitlements } from './types';
import { normalizePlanId } from './normalize-plan';
import { catalogEntitlementsFor } from './catalog';

export interface ShadowDecisionInput {
  organizationId: string;
  capability: EntitlementCapability;
  resolved: ResolvedEntitlements;
  legacyPlanId?: unknown;
}

export interface ShadowDecisionRecord {
  organizationKey: string;
  capability: EntitlementCapability;
  projectedAllowed: boolean;
  diagnosticCodes: string[];
  subscriptionState: 'absent' | 'corrupt' | 'incompatible' | 'valid';
  legacyAlias: 'initial' | 'fiscal_documents' | 'canonical' | 'unknown' | 'missing';
  legacyProjectionDiffers: boolean;
}

export function pseudonymizeOrganizationId(organizationId: string): string {
  return createHash('sha256').update(`summa-entitlements:${organizationId}`).digest('hex').slice(0, 16);
}

export function buildShadowDecisionRecord(input: ShadowDecisionInput): ShadowDecisionRecord {
  const diagnostics = [...new Set(input.resolved.diagnostics)].sort();
  const subscriptionState = diagnostics.includes('subscription_absent') ? 'absent'
    : diagnostics.includes('catalog_version_mismatch') || diagnostics.includes('system_config_version_incompatible') ? 'incompatible'
      : diagnostics.some((code) => [
        'plan_unknown',
        'catalog_version_mismatch',
        'catalog_fingerprint_mismatch',
        'snapshot_mismatch',
        'subscription_inactive',
      ].includes(code)) ? 'corrupt'
        : 'valid';
  const legacyAlias = input.legacyPlanId == null || input.legacyPlanId === '' ? 'missing'
    : input.legacyPlanId === 'initial' ? 'initial'
      : input.legacyPlanId === 'fiscal_documents' ? 'fiscal_documents'
        : normalizePlanId(input.legacyPlanId) ? 'canonical'
          : 'unknown';
  const legacyPlan = normalizePlanId(input.legacyPlanId);
  return {
    organizationKey: pseudonymizeOrganizationId(input.organizationId),
    capability: input.capability,
    projectedAllowed: input.resolved.projected[input.capability],
    diagnosticCodes: diagnostics,
    subscriptionState,
    legacyAlias,
    legacyProjectionDiffers: legacyPlan
      ? catalogEntitlementsFor(legacyPlan)[input.capability] !== input.resolved.projected[input.capability]
      : false,
  };
}

export function summarizeShadowDecisions(records: ShadowDecisionRecord[]) {
  const deduplicated = new Map<string, ShadowDecisionRecord>();
  for (const record of records) {
    const key = `${record.organizationKey}:${record.capability}:${record.projectedAllowed}:${record.diagnosticCodes.join(',')}`;
    deduplicated.set(key, record);
  }
  const events = [...deduplicated.values()].sort((a, b) =>
    `${a.organizationKey}:${a.capability}`.localeCompare(`${b.organizationKey}:${b.capability}`)
  );
  return {
    schemaVersion: 1,
    containsPii: false,
    inputEvents: records.length,
    uniqueEvents: events.length,
    projectedDenials: events.filter((event) => !event.projectedAllowed).length,
    legacyProjectionDifferences: events.filter((event) => event.legacyProjectionDiffers).length,
    bySubscriptionState: countBy(events, (event) => event.subscriptionState),
    byLegacyAlias: countBy(events, (event) => event.legacyAlias),
    events,
  };
}

function countBy<T>(records: T[], keyOf: (record: T) => string): Record<string, number> {
  return records.reduce<Record<string, number>>((counts, record) => {
    const key = keyOf(record);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}
