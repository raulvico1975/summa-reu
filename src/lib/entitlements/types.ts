export const ENTITLEMENT_CAPABILITIES = [
  'transactionDocuments.readHistorical',
  'transactionDocuments.mutate',
  'pendingDocuments.mutate',
] as const;

export type EntitlementCapability = typeof ENTITLEMENT_CAPABILITIES[number];
export type CanonicalPlanId = 'control' | 'management' | 'complete';
export type LegacyPlanId = 'initial' | 'fiscal_documents';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'cancelled';
export type EntitlementEnforcementMode = 'off' | 'shadow' | 'active';

export type EntitlementSnapshot = Record<EntitlementCapability, boolean>;

export interface OrganizationSubscriptionProjection {
  planId: CanonicalPlanId;
  status: SubscriptionStatus;
  catalogVersion: number;
  entitlements: EntitlementSnapshot;
  effectiveAt?: string | null;
  updatedAt?: string | null;
  origin?: string | null;
  changeReason?: string | null;
}

export interface EntitlementSystemConfig {
  enforcementMode: EntitlementEnforcementMode;
  catalogVersion: number;
}

export interface ResolvedEntitlements {
  planId: CanonicalPlanId;
  status: SubscriptionStatus | 'missing' | 'invalid';
  enforcementMode: EntitlementEnforcementMode;
  applied: EntitlementSnapshot;
  projected: EntitlementSnapshot;
  diagnostics: string[];
  source: 'subscription' | 'legacy_missing';
}
