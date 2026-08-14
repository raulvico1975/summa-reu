import type { CanonicalPlanId, EntitlementSnapshot } from './types';

export const ENTITLEMENTS_CATALOG_VERSION = 3;

export const PLAN_CATALOG_FINGERPRINTS: Record<CanonicalPlanId, string> = {
  control: 'summa-entitlements-v3-control',
  management: 'summa-entitlements-v3-management',
  complete: 'summa-entitlements-v3-complete',
};

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
      'pendingDocuments.readHistorical': true,
      'pendingDocuments.mutate': false,
      'pendingDocuments.match': false,
      'pendingDocuments.ocr': false,
      'model347.read': false,
      'model347.export': false,
      'aiCategorization.execute': false,
      'closingBundle.export': false,
      'projects.readHistorical': true,
      'projects.mutate': false,
      'projectBudgets.mutate': false,
      'multicurrency.mutate': false,
      'grantJustification.export': false,
    },
  },
  management: {
    id: 'management',
    entitlements: {
      'transactionDocuments.readHistorical': true,
      'transactionDocuments.mutate': true,
      'pendingDocuments.readHistorical': true,
      'pendingDocuments.mutate': false,
      'pendingDocuments.match': false,
      'pendingDocuments.ocr': false,
      'model347.read': true,
      'model347.export': true,
      'aiCategorization.execute': true,
      'closingBundle.export': false,
      'projects.readHistorical': true,
      'projects.mutate': false,
      'projectBudgets.mutate': false,
      'multicurrency.mutate': false,
      'grantJustification.export': false,
    },
  },
  complete: {
    id: 'complete',
    entitlements: {
      'transactionDocuments.readHistorical': true,
      'transactionDocuments.mutate': true,
      'pendingDocuments.readHistorical': true,
      'pendingDocuments.mutate': true,
      'pendingDocuments.match': true,
      'pendingDocuments.ocr': true,
      'model347.read': true,
      'model347.export': true,
      'aiCategorization.execute': true,
      'closingBundle.export': true,
      'projects.readHistorical': true,
      'projects.mutate': true,
      'projectBudgets.mutate': true,
      'multicurrency.mutate': true,
      'grantJustification.export': true,
    },
  },
};

export function catalogEntitlementsFor(planId: CanonicalPlanId): EntitlementSnapshot {
  return { ...PLAN_ENTITLEMENTS_CATALOG[planId].entitlements };
}

export function catalogFingerprintFor(planId: CanonicalPlanId): string {
  return PLAN_CATALOG_FINGERPRINTS[planId];
}
