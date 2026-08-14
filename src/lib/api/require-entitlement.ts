import type { EntitlementCapability, OrganizationSubscriptionProjection } from '@/lib/entitlements/types';
import { resolveCapabilityAccess, resolveOrganizationEntitlements } from '@/lib/entitlements/resolve-entitlements';
import { buildShadowDecisionRecord } from '@/lib/entitlements/shadow-report';

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
  if (!organizationSnap.exists) {
    return {
      allowed: false,
      diagnostics: ['organization_absent'],
      enforcementMode: 'active',
    };
  }
  const organization = organizationSnap.data() ?? {};
  const subscription = subscriptionSnap.exists
    ? subscriptionSnap.data() as Partial<OrganizationSubscriptionProjection>
    : null;
  const config = configSnap.exists ? configSnap.data() ?? {} : null;
  const entitlements = resolveOrganizationEntitlements({
    subscription,
    legacyPlanId: organization.billingPlan,
    systemConfig: config,
  });
  const features = organization.features as Record<string, unknown> | undefined;
  const operationalEnabled = input.capability.startsWith('pendingDocuments.')
    && input.capability !== 'pendingDocuments.readHistorical'
    ? features?.pendingDocs === true
    : input.capability === 'transactionDocuments.mutate'
      ? features?.transactionDocuments !== false
      : (input.capability.startsWith('projects.') && input.capability !== 'projects.readHistorical')
        || input.capability === 'projectBudgets.mutate'
        || input.capability === 'multicurrency.mutate'
        || input.capability === 'grantJustification.export'
        ? features?.projectModule === true
      : true;
  const access = resolveCapabilityAccess({
    entitlements,
    capability: input.capability,
    operationalEnabled,
    userAllowed: input.userAllowed ?? true,
  });

  if (entitlements.enforcementMode === 'shadow' || entitlements.source === 'legacy_missing') {
    console.info('[ENTITLEMENTS_SHADOW]', JSON.stringify({
      ...buildShadowDecisionRecord({
        organizationId: input.orgId,
        capability: input.capability,
        resolved: entitlements,
        legacyPlanId: organization.billingPlan,
      }),
    }));
  }

  return {
    allowed: access.allowed,
    diagnostics: entitlements.diagnostics,
    enforcementMode: entitlements.enforcementMode,
  };
}
