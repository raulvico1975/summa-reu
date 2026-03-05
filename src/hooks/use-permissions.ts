'use client';

import * as React from 'react';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import {
  can,
  canAccessProjectsArea,
  canAccessMovimentsRoute,
  canReadBankInProjectes,
  canUseProjectModule,
  getProjectCapability,
  resolveEffectivePermissions,
  type PermissionKey,
} from '@/lib/permissions';

export function usePermissions() {
  const { userRole, member } = useCurrentOrganization();

  const permissions = React.useMemo(
    () => resolveEffectivePermissions({
      role: userRole,
      userOverrides: member?.userOverrides,
      userGrants: member?.userGrants,
    }),
    [member?.userGrants, member?.userOverrides, userRole]
  );

  const canPermission = React.useCallback(
    (permission: PermissionKey) => can(permission, permissions),
    [permissions]
  );

  const projectCapability = React.useMemo(
    () => getProjectCapability(permissions),
    [permissions]
  );

  return {
    permissions,
    can: canPermission,
    projectCapability,
    canAccessMovimentsRoute: canAccessMovimentsRoute(permissions),
    canReadBankInProjectes: canReadBankInProjectes(permissions),
    canUseProjectModule: canUseProjectModule(permissions),
    canAccessProjectsArea: canAccessProjectsArea(permissions),
  };
}
