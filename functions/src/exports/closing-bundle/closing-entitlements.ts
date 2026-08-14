import {
  resolveCapabilityAccess,
  resolveOrganizationEntitlements,
} from '../../../../src/lib/entitlements/resolve-entitlements';
import type {
  EntitlementSystemConfig,
  OrganizationSubscriptionProjection,
} from '../../../../src/lib/entitlements/types';

export function canExportClosingBundleWithEntitlement(input: {
  organizationData: Record<string, unknown> | null;
  subscriptionData: Partial<OrganizationSubscriptionProjection> | null;
  systemConfigData: Partial<EntitlementSystemConfig> | null;
  permissionAllowed: boolean;
}): boolean {
  if (!input.organizationData) return false;
  const resolved = resolveOrganizationEntitlements({
    subscription: input.subscriptionData,
    legacyPlanId: input.organizationData?.billingPlan,
    systemConfig: input.systemConfigData,
  });
  return resolveCapabilityAccess({
    entitlements: resolved,
    capability: 'closingBundle.export',
    operationalEnabled: true,
    userAllowed: input.permissionAllowed,
  }).allowed;
}
