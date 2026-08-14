export const ENTITLEMENT_CAPABILITIES = [
  'transactionDocuments.readHistorical',
  'transactionDocuments.mutate',
  'pendingDocuments.readHistorical',
  'pendingDocuments.mutate',
  'pendingDocuments.match',
  'pendingDocuments.ocr',
  'model347.read',
  'model347.export',
  'aiCategorization.execute',
  'closingBundle.export',
  'projects.readHistorical',
  'projects.mutate',
  'projectBudgets.mutate',
  'multicurrency.mutate',
  'grantJustification.export',
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
  catalogFingerprint: string;
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

export interface ResolvedEntitlementSystemConfig {
  enforcementMode: EntitlementEnforcementMode;
  compatible: boolean;
  diagnostics: string[];
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
