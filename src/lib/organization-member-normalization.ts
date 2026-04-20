import type { OrganizationMember, OrganizationRole } from '@/lib/data'

type MemberDefaults = {
  userId?: string
  email?: string
  displayName?: string
  joinedAt?: string
}

function normalizeRole(role: unknown): OrganizationRole {
  return role === 'admin' || role === 'user' || role === 'viewer' ? role : 'viewer'
}

function normalizeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function normalizeCapabilities(capabilities: unknown): Record<string, boolean> {
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) {
    return {}
  }

  const normalized: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(capabilities as Record<string, unknown>)) {
    if (value === true) normalized[key] = true
  }
  return normalized
}

function normalizeStringArray(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) return undefined
  const normalized = values.filter((value): value is string => typeof value === 'string' && value.trim() !== '')
  return normalized.length > 0 ? normalized : undefined
}

export function normalizeOrganizationMember(
  raw: unknown,
  defaults: MemberDefaults = {}
): OrganizationMember {
  const data = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const deny = data.userOverrides && typeof data.userOverrides === 'object'
    ? normalizeStringArray((data.userOverrides as { deny?: unknown }).deny)
    : undefined

  return {
    userId: normalizeString(data.userId, defaults.userId ?? ''),
    email: normalizeString(data.email, defaults.email ?? ''),
    displayName: normalizeString(data.displayName, defaults.displayName ?? ''),
    role: normalizeRole(data.role),
    joinedAt: normalizeString(data.joinedAt, defaults.joinedAt ?? ''),
    capabilities: normalizeCapabilities(data.capabilities),
    invitedBy: typeof data.invitedBy === 'string' ? data.invitedBy : undefined,
    invitationId: typeof data.invitationId === 'string' ? data.invitationId : undefined,
    userOverrides: deny ? { deny } : undefined,
    userGrants: normalizeStringArray(data.userGrants),
  }
}
