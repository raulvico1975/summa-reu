import type { AnyContact, Category, ClassificationMemoryEntry, ContactType } from '@/lib/data';
import { isCategoryIdCompatibleStrict } from '@/lib/constants';
import {
  normalizeEmail,
  normalizeIBAN,
  normalizeTaxId,
} from '@/lib/contact-matching';
import { getForcedCategoryIdByBankDescription } from '@/lib/auto-match';
import {
  extractDecisionEmails,
  extractDecisionIbans,
  extractDecisionSpanishTaxIds,
  normalizeDecisionDescription,
  normalizeDecisionText,
  tokenizeDecisionDescription,
} from './normalize';
import {
  findClassificationMemoryEntry,
  isConfirmedClassificationMemoryEntry,
} from './memory';

export const CONTACT_AI_CONFIDENCE_THRESHOLD = 0.85;
export const CATEGORY_AI_CONFIDENCE_THRESHOLD = 0.85;

const CONTACT_STOP_WORDS = new Set([
  'de',
  'del',
  'la',
  'las',
  'el',
  'els',
  'los',
  'i',
  'y',
  'a',
  'en',
  'amb',
  'per',
  'por',
  'para',
  'sl',
  'sa',
  'slu',
  'sll',
  'sc',
  'cb',
  'coop',
]);

export type ContactDecisionSource = 'hard' | 'memory' | 'rule' | 'ai';
export type CategoryDecisionSource = 'contact' | 'memory' | 'rule' | 'ai';

export interface ContactDecision {
  contactId: string;
  contactType: ContactType;
  source: ContactDecisionSource;
}

export interface CategoryDecision {
  categoryId: string;
  source: CategoryDecisionSource;
}

type DecisionContext = {
  description: string;
  rawValues?: unknown[];
  amount: number;
  contacts: AnyContact[];
  categories: Category[];
  memoryEntries?: ClassificationMemoryEntry[] | null;
};

type StrongIdentifierSource = 'taxId' | 'iban' | 'email';

type StrongIdentifierMatch = {
  contact: AnyContact;
  source: StrongIdentifierSource;
};

function collectEvidenceTexts(description: string, rawValues?: unknown[]): string[] {
  const values = [description, ...(rawValues ?? []).map((value) => String(value ?? ''))];
  return values.filter((value) => value.trim().length > 0);
}

function findUniqueContactByStrongIdentifier(
  contacts: AnyContact[],
  source: StrongIdentifierSource,
  normalizedValue: string
): AnyContact | null {
  const matches = contacts.filter((contact) => {
    if (source === 'taxId') {
      return normalizeTaxId(contact.taxId) === normalizedValue;
    }
    if (source === 'iban') {
      return normalizeIBAN('iban' in contact ? (contact as { iban?: string | null }).iban : '') === normalizedValue;
    }
    return normalizeEmail('email' in contact ? (contact as { email?: string | null }).email : '') === normalizedValue;
  });

  return matches.length === 1 ? matches[0] : null;
}

function resolveStrongIdentifierMatch(
  contacts: AnyContact[],
  evidenceTexts: string[]
): StrongIdentifierMatch | null {
  for (const value of evidenceTexts) {
    for (const taxId of extractDecisionSpanishTaxIds(value)) {
      const match = findUniqueContactByStrongIdentifier(contacts, 'taxId', normalizeTaxId(taxId));
      if (match) return { contact: match, source: 'taxId' };
    }

    for (const iban of extractDecisionIbans(value)) {
      const match = findUniqueContactByStrongIdentifier(contacts, 'iban', normalizeIBAN(iban));
      if (match) return { contact: match, source: 'iban' };
    }

    for (const email of extractDecisionEmails(value)) {
      const match = findUniqueContactByStrongIdentifier(contacts, 'email', normalizeEmail(email));
      if (match) return { contact: match, source: 'email' };
    }
  }

  return null;
}

function extractContactNameTokens(name: string): string[] {
  return normalizeDecisionText(name)
    .split(' ')
    .filter((token) => token.length >= 2)
    .filter((token) => !CONTACT_STOP_WORDS.has(token));
}

function resolveUniqueNameMatch(description: string, contacts: AnyContact[]): AnyContact | null {
  const normalizedDescription = normalizeDecisionDescription(description);
  const descriptionTokens = new Set(tokenizeDecisionDescription(description));
  const candidates = contacts.filter((contact) => {
    const normalizedName = normalizeDecisionText(contact.name);
    const nameTokens = extractContactNameTokens(contact.name);

    if (normalizedName.length >= 6 && normalizedDescription.includes(normalizedName)) {
      return true;
    }

    if (nameTokens.length >= 2) {
      return nameTokens.every((token) => descriptionTokens.has(token));
    }

    if (nameTokens.length === 1) {
      return nameTokens[0].length >= 5 && descriptionTokens.has(nameTokens[0]);
    }

    return false;
  });

  return candidates.length === 1 ? candidates[0] : null;
}

function resolveMemoryContact(
  description: string,
  contacts: AnyContact[],
  memoryEntries?: ClassificationMemoryEntry[] | null
): AnyContact | null {
  const normalizedDescription = normalizeDecisionDescription(description);
  const entry = findClassificationMemoryEntry(memoryEntries, normalizedDescription);
  if (!isConfirmedClassificationMemoryEntry(entry) || !entry.contactId) {
    return null;
  }

  return contacts.find((contact) => contact.id === entry.contactId) ?? null;
}

function resolveMemoryCategory(
  description: string,
  amount: number,
  categories: Category[],
  memoryEntries?: ClassificationMemoryEntry[] | null
): string | null {
  const normalizedDescription = normalizeDecisionDescription(description);
  const entry = findClassificationMemoryEntry(memoryEntries, normalizedDescription);
  if (!isConfirmedClassificationMemoryEntry(entry) || !entry.categoryId) {
    return null;
  }

  if (!isCategoryIdCompatibleStrict(amount, entry.categoryId, categories)) {
    return null;
  }

  return entry.categoryId;
}

export function resolveAutomaticContactDecision(context: DecisionContext): ContactDecision | null {
  const evidenceTexts = collectEvidenceTexts(context.description, context.rawValues);
  const strongMatch = resolveStrongIdentifierMatch(context.contacts, evidenceTexts);
  if (strongMatch) {
    return {
      contactId: strongMatch.contact.id,
      contactType: strongMatch.contact.type,
      source: 'hard',
    };
  }

  const memoryContact = resolveMemoryContact(
    context.description,
    context.contacts,
    context.memoryEntries
  );
  if (memoryContact) {
    return {
      contactId: memoryContact.id,
      contactType: memoryContact.type,
      source: 'memory',
    };
  }

  const uniqueNameMatch = resolveUniqueNameMatch(context.description, context.contacts);
  if (uniqueNameMatch) {
    return {
      contactId: uniqueNameMatch.id,
      contactType: uniqueNameMatch.type,
      source: 'rule',
    };
  }

  return null;
}

export function resolveAutomaticCategoryDecision(input: {
  description: string;
  amount: number;
  categories: Category[];
  memoryEntries?: ClassificationMemoryEntry[] | null;
  confirmedContact?: AnyContact | null;
}): CategoryDecision | null {
  if (input.confirmedContact?.defaultCategoryId) {
    const categoryId = input.confirmedContact.defaultCategoryId;
    if (isCategoryIdCompatibleStrict(input.amount, categoryId, input.categories)) {
      return {
        categoryId,
        source: 'contact',
      };
    }
  }

  const memoryCategoryId = resolveMemoryCategory(
    input.description,
    input.amount,
    input.categories,
    input.memoryEntries
  );
  if (memoryCategoryId) {
    return {
      categoryId: memoryCategoryId,
      source: 'memory',
    };
  }

  const forcedCategoryId = getForcedCategoryIdByBankDescription(
    input.description,
    input.amount,
    input.categories
  );
  if (forcedCategoryId) {
    return {
      categoryId: forcedCategoryId,
      source: 'rule',
    };
  }

  return null;
}

export function canAutoApplyAiContactDecision(input: {
  contactId: string | null | undefined;
  confidence: number | null | undefined;
}): boolean {
  return Boolean(input.contactId) && (input.confidence ?? 0) >= CONTACT_AI_CONFIDENCE_THRESHOLD;
}

export function canAutoApplyAiCategoryDecision(input: {
  categoryId: string | null | undefined;
  confidence: number | null | undefined;
}): boolean {
  return Boolean(input.categoryId) && (input.confidence ?? 0) >= CATEGORY_AI_CONFIDENCE_THRESHOLD;
}
