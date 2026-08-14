import type { EntitlementCapability, OrganizationSubscriptionProjection } from '@/lib/entitlements/types';
import { resolveCapabilityAccess, resolveOrganizationEntitlements } from '@/lib/entitlements/resolve-entitlements';

interface SnapshotLike {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

export interface EntitlementDbLike {
  doc(path: string): { get(): Promise<SnapshotLike> };
}

export interface ServerEntitlementDecision {
  allowed: boolean;
  diagnostics: string[];
  enforcementMode: 'off' | 'shadow' | 'active';
}

export async function resolveServerEntitlement(input: {
  db: EntitlementDbLike;
  orgId: string;
  capability: EntitlementCapability;
  userAllowed?: boolean;
}): Promise<ServerEntitlementDecision> {
  const [organizationSnap, subscriptionSnap, configSnap] = await Promise.all([
    input.db.doc(`organizations/${input.orgId}`).get(),
    input.db.doc(`organizations/${input.orgId}/subscription/current`).get(),
    input.db.doc('system/entitlements').get(),
  ]);
  const organization = organizationSnap.data() ?? {};
  const subscription = subscriptionSnap.exists
    ? subscriptionSnap.data() as Partial<OrganizationSubscriptionProjection>
    : null;
  const config = configSnap.data() ?? {};
  const entitlements = resolveOrganizationEntitlements({
    subscription,
    legacyPlanId: organization.billingPlan,
    defaultEnforcementMode: config.enforcementMode === 'active' || config.enforcementMode === 'shadow'
      ? config.enforcementMode
      : 'off',
  });
  const features = organization.features as Record<string, unknown> | undefined;
  const operationalEnabled = input.capability === 'pendingDocuments.mutate'
    ? features?.pendingDocs === true
    : input.capability === 'transactionDocuments.mutate'
      ? features?.transactionDocuments !== false
      : true;
  const access = resolveCapabilityAccess({
    entitlements,
    capability: input.capability,
    operationalEnabled,
    userAllowed: input.userAllowed ?? true,
  });

  if (entitlements.enforcementMode === 'shadow' || entitlements.source === 'legacy_missing') {
    console.info('[ENTITLEMENTS_SHADOW]', JSON.stringify({
      orgId: input.orgId,
      capability: input.capability,
      diagnostics: entitlements.diagnostics,
      projectedAllowed: entitlements.projected[input.capability],
    }));
  }

  return {
    allowed: access.allowed,
    diagnostics: entitlements.diagnostics,
    enforcementMode: entitlements.enforcementMode,
  };
}
