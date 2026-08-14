'use client';

import { useCurrentOrganization } from './organization-provider';
import { resolveCapabilityAccess } from '@/lib/entitlements/resolve-entitlements';
import type { EntitlementCapability } from '@/lib/entitlements/types';

export function useEntitlements() {
  const { entitlements } = useCurrentOrganization();

  return {
    entitlements,
    canUseCapability(
      capability: EntitlementCapability,
      options: { operationalEnabled?: boolean; userAllowed?: boolean } = {}
    ) {
      return resolveCapabilityAccess({
        entitlements,
        capability,
        operationalEnabled: options.operationalEnabled ?? true,
        userAllowed: options.userAllowed ?? true,
      }).allowed;
    },
  };
}
