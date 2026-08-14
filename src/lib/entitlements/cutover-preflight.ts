import { ENTITLEMENTS_CATALOG_VERSION } from './catalog';
import { resolveEntitlementSystemConfig } from './system-config';
import type { EntitlementSystemConfig, OrganizationSubscriptionProjection } from './types';
import { resolveOrganizationEntitlements } from './resolve-entitlements';

export interface EntitlementCutoverPreflightInput {
  systemConfig?: Partial<EntitlementSystemConfig> | null;
  subscriptions: Array<{
    organizationId: string;
    subscription?: Partial<OrganizationSubscriptionProjection> | null;
  }>;
  documentRegistryCanActivate: boolean;
}

export function buildEntitlementCutoverPreflight(input: EntitlementCutoverPreflightInput) {
  const config = resolveEntitlementSystemConfig(input.systemConfig);
  const blockedOrganizations = input.subscriptions.flatMap(({ organizationId, subscription }) => {
    const resolved = resolveOrganizationEntitlements({
      subscription,
      systemConfig: input.systemConfig,
    });
    const reasons = resolved.diagnostics.filter((diagnostic) =>
      !diagnostic.startsWith('shadow_would_deny:')
    );
    if (subscription?.catalogVersion !== ENTITLEMENTS_CATALOG_VERSION
      && !reasons.includes('subscription_version_incompatible')) {
      reasons.push('subscription_version_incompatible');
    }
    if (!['control', 'management', 'complete'].includes(String(subscription?.planId ?? ''))
      && !reasons.includes('subscription_plan_not_canonical')) {
      reasons.push('subscription_plan_not_canonical');
    }
    return reasons.length > 0 ? [{ organizationId, reasons }] : [];
  });
  const blockers = [
    ...config.diagnostics,
    ...(input.documentRegistryCanActivate ? [] : ['transaction_document_registry_inconsistent']),
    ...(blockedOrganizations.length === 0 ? [] : ['organization_subscriptions_incompatible']),
  ];
  return {
    catalogVersion: ENTITLEMENTS_CATALOG_VERSION,
    canDeployRules: config.compatible,
    canActivate: blockers.length === 0,
    blockers,
    blockedOrganizations,
  };
}
