import type { ContactRoles, ContactType } from '@/lib/data';
import { normalizeIBAN, normalizeTaxId } from '@/lib/normalize';
import {
  buildContactRoleOptions,
  hasEffectiveContactRole,
  mergeContactRoleSelectables,
  resolveContactRoleOption,
  type ContactRoleOption,
  type ContactRoleSelectable,
} from '@/lib/contacts/contact-role-options';

export type PaymentContactType = 'supplier' | 'employee';

export interface PaymentContactSelectable extends ContactRoleSelectable {
  taxId: string;
  iban?: string | null;
  roles?: ContactRoles;
}

function normalizeName(value: string): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function buildPaymentContactOptions(
  contacts: PaymentContactSelectable[]
): ContactRoleOption[] {
  return buildContactRoleOptions(contacts, {
    allowedRoles: ['supplier', 'employee'],
  });
}

export function resolvePaymentContactOption(
  contacts: PaymentContactSelectable[],
  contactId: string | null | undefined,
  contactType: PaymentContactType | null | undefined
): ContactRoleOption | null {
  return resolveContactRoleOption(contacts, contactId, contactType, {
    allowedRoles: ['supplier', 'employee'],
  });
}

export function findPaymentBeneficiary(input: {
  name: string;
  taxId: string;
  iban: string;
  contacts: PaymentContactSelectable[];
}): { contact: PaymentContactSelectable | null; contactType: PaymentContactType | undefined } {
  const contacts = mergeContactRoleSelectables(input.contacts) as PaymentContactSelectable[];
  const normalizedName = normalizeName(input.name);
  const normalizedTaxId = normalizeTaxId(input.taxId);
  const normalizedIban = normalizeIBAN(input.iban);

  const rolePriority: PaymentContactType[] = ['employee', 'supplier'];

  const findByRole = (
    role: PaymentContactType,
    predicate: (contact: PaymentContactSelectable) => boolean
  ) => contacts.find((contact) => hasEffectiveContactRole(contact, role) && predicate(contact)) ?? null;

  if (normalizedIban) {
    for (const role of rolePriority) {
      const match = findByRole(role, (contact) => normalizeIBAN(contact.iban) === normalizedIban);
      if (match) return { contact: match, contactType: role };
    }
  }

  if (normalizedTaxId) {
    for (const role of rolePriority) {
      const match = findByRole(role, (contact) => normalizeTaxId(contact.taxId) === normalizedTaxId);
      if (match) return { contact: match, contactType: role };
    }
  }

  if (normalizedName) {
    for (const role of rolePriority) {
      const match = findByRole(role, (contact) => normalizeName(contact.name) === normalizedName);
      if (match) return { contact: match, contactType: role };
    }
  }

  return { contact: null, contactType: undefined };
}

export function resolvePaymentChildContactType(input: {
  contactId: string | null;
  status: string;
  manualMatchContactType?: PaymentContactType | null;
  matchedContactType?: ContactType;
}): PaymentContactType | null {
  if (!input.contactId) return null;

  if (input.manualMatchContactType) {
    return input.manualMatchContactType;
  }

  if (input.matchedContactType === 'employee' || input.matchedContactType === 'supplier') {
    return input.matchedContactType;
  }

  if (input.status === 'new_with_taxid') {
    return 'supplier';
  }

  return null;
}
