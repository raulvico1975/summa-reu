import type { OrganizationRole } from '@/lib/data';

export const CRITICAL_ACTION_KEYS = [
  'moviments.read',
  'moviments.importarExtractes',
  'moviments.editar',
  'informes.exportar',
  'fiscal.model182.generar',
  'fiscal.model347.generar',
  'fiscal.certificats.generar',
] as const;

export const SECTION_PERMISSION_KEYS = [
  'sections.dashboard',
  'sections.moviments',
  'sections.projectes',
  'sections.informes',
  'sections.donants',
  'sections.proveidors',
  'sections.treballadors',
  'sections.configuracio',
  'sections.guides',
] as const;

export const PROJECT_CAPABILITY_KEYS = [
  'projectes.manage',
  'projectes.expenseInput',
] as const;

const INTERNAL_PERMISSION_KEYS = [
  'configuracio.manage',
  'membres.manage',
  'categories.manage',
] as const;

export const PERMISSION_KEYS = [
  ...SECTION_PERMISSION_KEYS,
  ...CRITICAL_ACTION_KEYS,
  ...PROJECT_CAPABILITY_KEYS,
  ...INTERNAL_PERMISSION_KEYS,
] as const;

export type PermissionKey = typeof PERMISSION_KEYS[number];
export type ProjectCapability = 'manage' | 'expenseInput' | 'none';

export type PermissionMap = Record<PermissionKey, boolean>;

export interface UserPermissionOverrides {
  deny?: string[] | null;
}

export interface PermissionResolutionInput {
  role: OrganizationRole | null;
  userOverrides?: UserPermissionOverrides | null;
  userGrants?: string[] | null;
}

export const NEVER_USER_GRANTABLE_PREFIXES = ['configuracio.', 'membres.', 'categories.'] as const;

function createEmptyPermissions(): PermissionMap {
  const map = {} as PermissionMap;
  for (const key of PERMISSION_KEYS) {
    map[key] = false;
  }
  return map;
}

function createPermissionMap(enabled: PermissionKey[]): PermissionMap {
  const map = createEmptyPermissions();
  for (const key of enabled) {
    map[key] = true;
  }
  return map;
}

const ADMIN_DEFAULTS = createPermissionMap([
  ...SECTION_PERMISSION_KEYS,
  ...CRITICAL_ACTION_KEYS,
  'projectes.manage',
  'configuracio.manage',
  'membres.manage',
  'categories.manage',
]);

const USER_DEFAULTS = createPermissionMap([
  ...SECTION_PERMISSION_KEYS,
  ...CRITICAL_ACTION_KEYS,
  'projectes.manage',
]);

const VIEWER_DEFAULTS = createPermissionMap([
  ...SECTION_PERMISSION_KEYS,
  'moviments.read',
]);

const ROLE_DEFAULTS: Record<OrganizationRole, PermissionMap> = {
  admin: ADMIN_DEFAULTS,
  user: USER_DEFAULTS,
  viewer: VIEWER_DEFAULTS,
};

export function isKnownPermissionKey(key: string): key is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(key);
}

function dedupe<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function sanitizePermissionList(input: string[] | null | undefined): PermissionKey[] {
  if (!Array.isArray(input)) return [];
  const result: PermissionKey[] = [];
  for (const value of input) {
    if (typeof value !== 'string') continue;
    if (isKnownPermissionKey(value)) {
      result.push(value);
    }
  }
  return dedupe(result);
}

export function isUserGrantablePermission(permission: PermissionKey): boolean {
  return !NEVER_USER_GRANTABLE_PREFIXES.some(prefix => permission.startsWith(prefix));
}

export function sanitizeUserOverrides(overrides: UserPermissionOverrides | null | undefined): UserPermissionOverrides {
  if (!overrides || typeof overrides !== 'object') return { deny: [] };
  return {
    deny: sanitizePermissionList(overrides.deny ?? undefined),
  };
}

export function sanitizeUserGrants(grants: string[] | null | undefined): PermissionKey[] {
  return sanitizePermissionList(grants).filter(isUserGrantablePermission);
}

export function isUserPermissionsCustomized(
  userOverrides?: UserPermissionOverrides | null,
  userGrants?: string[] | null
): boolean {
  const deny = sanitizePermissionList(userOverrides?.deny ?? undefined);
  const grants = sanitizeUserGrants(userGrants);
  return deny.length > 0 || grants.length > 0;
}

export function getRoleDefaults(role: OrganizationRole | null): PermissionMap {
  if (!role) return createEmptyPermissions();
  return { ...ROLE_DEFAULTS[role] };
}

export function applyOverrides(
  roleDefaults: PermissionMap,
  userOverrides?: UserPermissionOverrides | null,
  userGrants?: string[] | null
): PermissionMap {
  const effective = { ...roleDefaults };
  const grants = sanitizeUserGrants(userGrants);
  const denied = sanitizePermissionList(sanitizeUserOverrides(userOverrides).deny ?? undefined);

  for (const permission of grants) {
    effective[permission] = true;
  }

  for (const permission of denied) {
    effective[permission] = false;
  }

  // projectes.manage i projectes.expenseInput són mútuament excloents.
  if (effective['projectes.manage'] && effective['projectes.expenseInput']) {
    effective['projectes.expenseInput'] = false;
  }

  return effective;
}

export function resolveEffectivePermissions(input: PermissionResolutionInput): PermissionMap {
  const roleDefaults = getRoleDefaults(input.role);
  return applyOverrides(roleDefaults, input.userOverrides, input.userGrants);
}

export function getProjectCapability(permissions: PermissionMap): ProjectCapability {
  if (permissions['projectes.expenseInput']) return 'expenseInput';
  if (permissions['projectes.manage']) return 'manage';
  return 'none';
}

export function canAccessMovimentsRoute(permissions: PermissionMap): boolean {
  return permissions['sections.moviments'] && permissions['moviments.read'];
}

export function canReadBankInProjectes(permissions: PermissionMap): boolean {
  return permissions['projectes.manage'] && permissions['moviments.read'];
}

export function canUseProjectModule(permissions: PermissionMap): boolean {
  return permissions['projectes.manage'] || permissions['projectes.expenseInput'];
}

export function canAccessProjectsArea(permissions: PermissionMap): boolean {
  return permissions['sections.projectes'] && canUseProjectModule(permissions);
}

export function can(permission: PermissionKey, permissions: PermissionMap): boolean {
  return permissions[permission] === true;
}

export function permissionsToCapabilities(permissions: PermissionMap): Record<string, boolean> {
  const capabilities: Record<string, boolean> = {};
  for (const key of PERMISSION_KEYS) {
    if (permissions[key] === true) {
      capabilities[key] = true;
    }
  }
  return capabilities;
}

/**
 * Capabilities per defecte que s'escriuen al document Firestore del membre
 * quan es crea o actualitza el seu rol.
 * Política D1 (conservador, opt-in): només moviments.read per defecte.
 * Qualsevol capacitat fiscal/export/edició s'ha de concedir explícitament.
 */
export const ROLE_DEFAULT_CAPABILITIES: Record<OrganizationRole, Record<string, boolean>> = {
  admin: {},  // admin fa bypass per rol a les Rules — no cal omplir
  user: { 'moviments.read': true },
  viewer: { 'moviments.read': true },
};
