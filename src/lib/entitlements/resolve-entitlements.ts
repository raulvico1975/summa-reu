import {
  ENTITLEMENTS_CATALOG_VERSION,
  catalogEntitlementsFor,
} from './catalog';
import { normalizePlanId } from './normalize-plan';
import type {
  EntitlementCapability,
  EntitlementEnforcementMode,
  EntitlementSnapshot,
  OrganizationSubscriptionProjection,
  ResolvedEntitlements,
} from './types';

const ALLOW_ALL: EntitlementSnapshot = {
  'transactionDocuments.readHistorical': true,
  'transactionDocuments.mutate': true,
  'pendingDocuments.mutate': true,
};

function snapshotsEqual(left: EntitlementSnapshot, right: EntitlementSnapshot): boolean {
  return left['transactionDocuments.readHistorical'] === right['transactionDocuments.readHistorical']
    && left['transactionDocuments.mutate'] === right['transactionDocuments.mutate']
    && left['pendingDocuments.mutate'] === right['pendingDocuments.mutate'];
}

function safeControlProjection(): EntitlementSnapshot {
  return catalogEntitlementsFor('control');
}

export function resolveOrganizationEntitlements(input: {
  subscription?: Partial<OrganizationSubscriptionProjection> | null;
  legacyPlanId?: unknown;
  defaultEnforcementMode?: EntitlementEnforcementMode;
}): ResolvedEntitlements {
  const subscription = input.subscription;

  if (!subscription) {
    const mode = input.defaultEnforcementMode ?? 'off';
    const legacyPlan = normalizePlanId(input.legacyPlanId);
    const projected = legacyPlan ? catalogEntitlementsFor(legacyPlan) : safeControlProjection();
    const diagnostics = ['subscription_absent'];
    if (!legacyPlan) diagnostics.push('legacy_plan_unknown');
    return {
      planId: legacyPlan ?? 'control',
      status: 'missing',
      enforcementMode: mode,
      // En active, una projecció absent no és autoritativa: fallback segur a Control.
      // El legacy només informa el shadow/backfill, mai reobre mutacions al cutover.
      applied: mode === 'active' ? safeControlProjection() : { ...ALLOW_ALL },
      projected,
      diagnostics,
      source: 'legacy_missing',
    };
  }

  const mode: EntitlementEnforcementMode = input.defaultEnforcementMode ?? 'off';
  const plan = normalizePlanId(subscription.planId);
  const expected = plan ? catalogEntitlementsFor(plan) : safeControlProjection();
  const validStatus = subscription.status === 'active' || subscription.status === 'trial';
  const validVersion = subscription.catalogVersion === ENTITLEMENTS_CATALOG_VERSION;
  const validSnapshot = !!subscription.entitlements && snapshotsEqual(
    subscription.entitlements as EntitlementSnapshot,
    expected
  );
  const diagnostics: string[] = [];
  if (!plan) diagnostics.push('plan_unknown');
  if (!validVersion) diagnostics.push('catalog_version_mismatch');
  if (!validSnapshot) diagnostics.push('snapshot_mismatch');
  if (!validStatus) diagnostics.push('subscription_inactive');

  const projected = plan && validVersion && validSnapshot && validStatus
    ? expected
    : safeControlProjection();

  if (mode === 'shadow') {
    for (const [capability, allowed] of Object.entries(projected)) {
      if (!allowed) diagnostics.push(`shadow_would_deny:${capability}`);
    }
  }

  return {
    planId: plan ?? 'control',
    status: plan && validVersion && validSnapshot ? (subscription.status ?? 'invalid') : 'invalid',
    enforcementMode: mode,
    applied: mode === 'active' ? projected : { ...ALLOW_ALL },
    projected,
    diagnostics,
    source: 'subscription',
  };
}

export interface CapabilityAccessDecision {
  allowed: boolean;
  reasons: Array<'commercial' | 'operational' | 'permission'>;
}

export function resolveCapabilityAccess(input: {
  entitlements: ResolvedEntitlements;
  capability: EntitlementCapability;
  operationalEnabled: boolean;
  userAllowed: boolean;
}): CapabilityAccessDecision {
  const reasons: CapabilityAccessDecision['reasons'] = [];
  if (!input.entitlements.applied[input.capability]) reasons.push('commercial');
  if (!input.operationalEnabled) reasons.push('operational');
  if (!input.userAllowed) reasons.push('permission');
  return { allowed: reasons.length === 0, reasons };
}
