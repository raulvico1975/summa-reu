import type { ContactRoles, ContactType } from '@/lib/data';

export interface ContactRoleSelectable {
  id: string;
  name: string;
  type: ContactType;
  roles?: ContactRoles;
}

export interface ContactRoleOption {
  key: string;
  contactId: string;
  contactName: string;
  contactType: ContactType;
  isMultiRole: boolean;
}

export const CONTACT_ROLE_ORDER: readonly ContactType[] = ['donor', 'supplier', 'employee'];

function toRoleFlags(roles: ContactType[]): ContactRoles {
  return roles.reduce<ContactRoles>((acc, role) => {
    acc[role] = true;
    return acc;
  }, {});
}

export function getEffectiveContactRoles(
  contact: ContactRoleSelectable,
  allowedRoles: readonly ContactType[] = CONTACT_ROLE_ORDER
): ContactType[] {
  const explicitRoles = allowedRoles.filter((role) => contact.roles?.[role] === true);
  if (explicitRoles.length > 0) {
    return explicitRoles;
  }

  return allowedRoles.includes(contact.type) ? [contact.type] : [];
}

export function hasEffectiveContactRole(
  contact: ContactRoleSelectable,
  role: ContactType
): boolean {
  return getEffectiveContactRoles(contact).includes(role);
}

export function mergeContactRoleSelectables<T extends ContactRoleSelectable>(contacts: T[]): T[] {
  const byId = new Map<string, T>();

  for (const contact of contacts) {
    const existing = byId.get(contact.id);
    if (!existing) {
      byId.set(contact.id, contact);
      continue;
    }

    const mergedRoles = Array.from(
      new Set([
        ...getEffectiveContactRoles(existing),
        ...getEffectiveContactRoles(contact),
      ])
    );

    byId.set(contact.id, {
      ...existing,
      ...contact,
      type: existing.type,
      roles: toRoleFlags(mergedRoles),
    });
  }

  return Array.from(byId.values());
}

export function buildContactRoleOptions<T extends ContactRoleSelectable>(
  contacts: T[],
  options?: {
    allowedRoles?: readonly ContactType[];
  }
): ContactRoleOption[] {
  const allowedRoles = options?.allowedRoles ?? CONTACT_ROLE_ORDER;
  const uniqueContacts = mergeContactRoleSelectables(contacts);

  return uniqueContacts.flatMap((contact) => {
    const roles = getEffectiveContactRoles(contact, allowedRoles);
    const isMultiRole = roles.length > 1;

    return roles.map((contactType) => ({
      key: serializeContactRoleValue(contact.id, contactType),
      contactId: contact.id,
      contactName: contact.name,
      contactType,
      isMultiRole,
    }));
  });
}

export function resolveContactRoleOption<T extends ContactRoleSelectable>(
  contacts: T[],
  contactId: string | null | undefined,
  contactType: ContactType | null | undefined,
  options?: {
    allowedRoles?: readonly ContactType[];
  }
): ContactRoleOption | null {
  if (!contactId) return null;

  const allowedRoles = options?.allowedRoles ?? CONTACT_ROLE_ORDER;
  const uniqueContacts = mergeContactRoleSelectables(contacts);
  const roleOptions = buildContactRoleOptions(uniqueContacts, { allowedRoles }).filter(
    (option) => option.contactId === contactId
  );

  if (roleOptions.length === 0) return null;

  if (contactType) {
    return roleOptions.find((option) => option.contactType === contactType) ?? roleOptions[0];
  }

  const contact = uniqueContacts.find((item) => item.id === contactId);
  if (!contact) return roleOptions[0];

  return roleOptions.find((option) => option.contactType === contact.type) ?? roleOptions[0];
}

export function serializeContactRoleValue(contactId: string, contactType: ContactType): string {
  return `${contactId}::${contactType}`;
}

export function parseContactRoleValue(
  value: string
): { contactId: string | null; contactType: ContactType | null } {
  const [contactId, contactType] = value.split('::');
  if (!contactId) {
    return { contactId: null, contactType: null };
  }

  if (contactType === 'donor' || contactType === 'supplier' || contactType === 'employee') {
    return { contactId, contactType };
  }

  return { contactId: null, contactType: null };
}
