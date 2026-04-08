export interface ClosingBundleMemberPermissions {
  role?: string | null;
  userOverrides?: {
    deny?: unknown;
  } | null;
  userGrants?: unknown;
}

export function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export function hasInformesExportarPermission(
  memberData: ClosingBundleMemberPermissions | null | undefined
): boolean {
  const role = memberData?.role;
  const userOverrides = memberData?.userOverrides;
  const userGrants = memberData?.userGrants;

  let canExport = role === 'admin' || role === 'user';

  if (sanitizeStringArray(userGrants).includes('informes.exportar')) {
    canExport = true;
  }

  const deny =
    userOverrides && typeof userOverrides === 'object'
      ? sanitizeStringArray(userOverrides.deny)
      : [];

  if (deny.includes('informes.exportar')) {
    canExport = false;
  }

  return canExport;
}

export function canGenerateClosingBundle(params: {
  memberData?: ClosingBundleMemberPermissions | null;
  isSystemSuperAdmin: boolean;
}): boolean {
  if (params.memberData) {
    return hasInformesExportarPermission(params.memberData);
  }

  return params.isSystemSuperAdmin;
}
