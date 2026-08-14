import {
  ENTITLEMENTS_CATALOG_VERSION,
  catalogEntitlementsFor,
  catalogFingerprintFor,
} from './catalog';
import { normalizePlanId } from './normalize-plan';
import { resolveEntitlementSystemConfig } from './system-config';
import type {
  EntitlementCapability,
  EntitlementSnapshot,
  OrganizationSubscriptionProjection,
  ResolvedEntitlements,
  EntitlementSystemConfig,
} from './types';
import { ENTITLEMENT_CAPABILITIES } from './types';

const ALLOW_ALL = Object.fromEntries(
  ENTITLEMENT_CAPABILITIES.map((capability) => [capability, true])
) as EntitlementSnapshot;

function safeControlProjection(): EntitlementSnapshot {
  return catalogEntitlementsFor('control');
}

export function resolveOrganizationEntitlements(input: {
  subscription?: Partial<OrganizationSubscriptionProjection> | null;
  legacyPlanId?: unknown;
  systemConfig?: Partial<EntitlementSystemConfig> | null;
}): ResolvedEntitlements {
  const subscription = input.subscription;
  const config = resolveEntitlementSystemConfig(input.systemConfig);
  const mode = config.enforcementMode;

  if (!subscription) {
    const legacyPlan = normalizePlanId(input.legacyPlanId);
    const projected = config.compatible && legacyPlan
      ? catalogEntitlementsFor(legacyPlan)
      : safeControlProjection();
    const diagnostics = [...config.diagnostics, 'subscription_absent'];
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

  const plan = subscription.planId === 'control' || subscription.planId === 'management' || subscription.planId === 'complete'
    ? subscription.planId
    : null;
  const expected = plan ? catalogEntitlementsFor(plan) : safeControlProjection();
  const validStatus = subscription.status === 'active' || subscription.status === 'trial';
  const validVersion = subscription.catalogVersion === ENTITLEMENTS_CATALOG_VERSION;
  const validFingerprint = !!plan && subscription.catalogFingerprint === catalogFingerprintFor(plan);
  const diagnostics: string[] = [...config.diagnostics];
  if (!plan) diagnostics.push('plan_unknown');
  if (!validVersion) diagnostics.push('catalog_version_mismatch');
  if (!validFingerprint) diagnostics.push('catalog_fingerprint_mismatch');
  if (!validStatus) diagnostics.push('subscription_inactive');

  const projected = config.compatible && plan && validVersion && validFingerprint && validStatus
    ? expected
    : safeControlProjection();

  if (mode === 'shadow') {
    for (const [capability, allowed] of Object.entries(projected)) {
      if (!allowed) diagnostics.push(`shadow_would_deny:${capability}`);
    }
  }

  return {
    planId: plan ?? 'control',
    status: plan && validVersion && validFingerprint ? (subscription.status ?? 'invalid') : 'invalid',
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
