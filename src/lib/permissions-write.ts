import {
  isKnownPermissionKey,
  isUserGrantablePermission,
  sanitizePermissionList,
  type PermissionKey,
} from '@/lib/permissions';

export interface UserPermissionWriteInput {
  deny?: string[] | null;
  grants?: string[] | null;
}

export interface CanonicalUserPermissionWrite {
  deny: PermissionKey[];
  grants: PermissionKey[];
  projectCapability: 'manage' | 'expenseInput' | 'none';
}

export interface PermissionWriteValidationError {
  code: 'INVALID_PAYLOAD' | 'INVALID_PERMISSION_KEY' | 'NON_GRANTABLE_PERMISSION';
  message: string;
  details?: string[];
}

type ValidationResult =
  | { ok: true; value: CanonicalUserPermissionWrite }
  | { ok: false; error: PermissionWriteValidationError };

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function toStringArray(value: unknown): string[] | null {
  if (value == null) return [];
  if (!Array.isArray(value)) return null;
  if (!value.every((entry) => typeof entry === 'string')) return null;
  return value;
}

function findInvalidKeys(values: string[]): string[] {
  return uniqueStrings(values.filter((value) => !isKnownPermissionKey(value)));
}

function findNonGrantable(values: PermissionKey[]): PermissionKey[] {
  return uniqueStrings(
    values.filter((value) => !isUserGrantablePermission(value))
  ) as PermissionKey[];
}

export function memberPermissionsDocPath(orgId: string, userId: string): string {
  return `organizations/${orgId}/members/${userId}`;
}

export function validateAndCanonicalizeUserPermissionWrite(
  input: UserPermissionWriteInput
): ValidationResult {
  const rawDeny = toStringArray(input.deny);
  const rawGrants = toStringArray(input.grants);

  if (!rawDeny || !rawGrants) {
    return {
      ok: false,
      error: {
        code: 'INVALID_PAYLOAD',
        message: '`deny` i `grants` han de ser arrays de strings.',
      },
    };
  }

  const invalidKeys = uniqueStrings([
    ...findInvalidKeys(rawDeny),
    ...findInvalidKeys(rawGrants),
  ]);
  if (invalidKeys.length > 0) {
    return {
      ok: false,
      error: {
        code: 'INVALID_PERMISSION_KEY',
        message: 'S han rebut claus de permisos desconegudes.',
        details: invalidKeys,
      },
    };
  }

  const deny = sanitizePermissionList(rawDeny);
  const grants = sanitizePermissionList(rawGrants);

  const nonGrantable = findNonGrantable(grants);
  if (nonGrantable.length > 0) {
    return {
      ok: false,
      error: {
        code: 'NON_GRANTABLE_PERMISSION',
        message: 'Aquestes claus no es poden concedir via userGrants.',
        details: nonGrantable,
      },
    };
  }

  const denySet = new Set<PermissionKey>(deny);
  const grantSet = new Set<PermissionKey>(grants);

  // Precedència canònica: none > expenseInput > manage.
  const noneMode =
    denySet.has('projectes.manage') && denySet.has('projectes.expenseInput');
  const expenseInputMode =
    !noneMode && (grantSet.has('projectes.expenseInput') || denySet.has('projectes.manage'));

  if (noneMode) {
    denySet.add('sections.projectes');
    denySet.add('projectes.manage');
    denySet.add('projectes.expenseInput');
    grantSet.delete('projectes.expenseInput');
  } else if (expenseInputMode) {
    grantSet.add('projectes.expenseInput');
    denySet.add('projectes.manage');
    denySet.delete('projectes.expenseInput');
  } else {
    grantSet.delete('projectes.expenseInput');
    denySet.delete('projectes.manage');
    denySet.delete('projectes.expenseInput');
  }

  return {
    ok: true,
    value: {
      deny: Array.from(denySet).sort(),
      grants: Array.from(grantSet).sort(),
      projectCapability: noneMode ? 'none' : (expenseInputMode ? 'expenseInput' : 'manage'),
    },
  };
}
