import type { CanonicalPlanId, EntitlementSnapshot } from './types';

export const ENTITLEMENTS_CATALOG_VERSION = 1;

export interface PlanCatalogEntry {
  id: CanonicalPlanId;
  entitlements: EntitlementSnapshot;
}

export const PLAN_ENTITLEMENTS_CATALOG: Record<CanonicalPlanId, PlanCatalogEntry> = {
  control: {
    id: 'control',
    entitlements: {
      'transactionDocuments.readHistorical': true,
      'transactionDocuments.mutate': false,
      'pendingDocuments.mutate': false,
    },
  },
  management: {
    id: 'management',
    entitlements: {
      'transactionDocuments.readHistorical': true,
      'transactionDocuments.mutate': true,
      'pendingDocuments.mutate': false,
    },
  },
  complete: {
    id: 'complete',
    entitlements: {
      'transactionDocuments.readHistorical': true,
      'transactionDocuments.mutate': true,
      'pendingDocuments.mutate': true,
    },
  },
};

export function catalogEntitlementsFor(planId: CanonicalPlanId): EntitlementSnapshot {
  return { ...PLAN_ENTITLEMENTS_CATALOG[planId].entitlements };
}
