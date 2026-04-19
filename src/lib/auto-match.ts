// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-MATCH - Sistema d'assignació automàtica de contactes
// ═══════════════════════════════════════════════════════════════════════════════
// Matching local sense IA: cerca el nom del contacte a la descripció bancària
// ═══════════════════════════════════════════════════════════════════════════════

import type { AnyContact, Category } from './data';

/**
 * Normalitza un text per a comparació (minúscules, sense accents, sense caràcters especials)
 */
export function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Elimina accents
    .replace(/[^a-z0-9\s]/g, ' ')    // Substitueix caràcters especials per espais
    .replace(/\s+/g, ' ')            // Normalitza espais múltiples
    .trim();
}

/**
 * Extreu els tokens significatius d'un nom (ignorant paraules curtes com "de", "la", "sl", etc.)
 */
export function extractNameTokens(name: string): string[] {
  const normalized = normalizeForMatching(name);
  const stopWords = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'i', 'y', 'a', 'en', 'amb', 'per', 'sl', 'sa', 'slu', 'sll', 'sc', 'cb', 'coop']);

  return normalized
    .split(' ')
    .filter(token => token.length >= 2 && !stopWords.has(token));
}

/**
 * Calcula quants tokens del nom apareixen a la descripció
 */
function countMatchingTokens(nameTokens: string[], descriptionNormalized: string): number {
  return nameTokens.filter(token => descriptionNormalized.includes(token)).length;
}

/**
 * Resultat del matching
 */
export interface MatchResult {
  contactId: string;
  contactType: 'donor' | 'supplier' | 'employee';
  contactName: string;
  confidence: number;      // 0-1, percentatge de tokens que coincideixen
  matchedTokens: string[]; // Tokens que han coincidit
}

/**
 * Intenta trobar un contacte que coincideixi amb la descripció bancària
 *
 * Estratègia:
 * 1. Normalitza la descripció
 * 2. Per cada contacte, extreu els tokens significatius del nom
 * 3. Compta quants tokens apareixen a la descripció
 * 4. Retorna el contacte amb més coincidències (si supera el llindar mínim)
 *
 * @param description Descripció bancària del moviment
 * @param contacts Llista de contactes disponibles
 * @param minTokensRequired Mínim de tokens que han de coincidir (default: 2, o 1 si el nom té un sol token)
 * @returns MatchResult o null si no hi ha coincidència
 */
export function findMatchingContact(
  description: string,
  contacts: AnyContact[],
  minTokensRequired: number = 2
): MatchResult | null {
  if (!description || !contacts || contacts.length === 0) {
    return null;
  }

  const descNormalized = normalizeForMatching(description);

  let bestMatch: MatchResult | null = null;
  let bestScore = 0;

  for (const contact of contacts) {
    if (!contact.name) continue;

    const nameTokens = extractNameTokens(contact.name);
    if (nameTokens.length === 0) continue;

    // Per noms d'un sol token (ex: "Amazon"), baixem el llindar
    const effectiveMinTokens = Math.min(minTokensRequired, nameTokens.length);

    const matchedTokens = nameTokens.filter(token => descNormalized.includes(token));
    const matchCount = matchedTokens.length;

    // Si no arriba al mínim, saltar
    if (matchCount < effectiveMinTokens) continue;

    // Calcular confiança: % de tokens que coincideixen
    const confidence = matchCount / nameTokens.length;

    // Prioritzar per: més tokens coincidits, després per major confiança
    const score = matchCount * 100 + confidence * 10;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        contactId: contact.id,
        contactType: contact.type as 'donor' | 'supplier' | 'employee',
        contactName: contact.name,
        confidence,
        matchedTokens,
      };
    }
  }

  return bestMatch;
}

/**
 * Processa múltiples transaccions i retorna les que han tingut match
 */
export function batchFindMatchingContacts(
  transactions: Array<{ description: string; [key: string]: any }>,
  contacts: AnyContact[]
): Map<number, MatchResult> {
  const results = new Map<number, MatchResult>();

  transactions.forEach((tx, index) => {
    const match = findMatchingContact(tx.description, contacts);
    if (match) {
      results.set(index, match);
    }
  });

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORCED CATEGORY BY DESCRIPTION
// ═══════════════════════════════════════════════════════════════════════════════
// Detecta ingressos especials (loteria, voluntariat) per la descripció bancària
// i retorna la categoria forçada corresponent
// ═══════════════════════════════════════════════════════════════════════════════

type ForcedCategoryRule = {
  keywords: string[];
  categoryNames: string[];
};

const INCOME_RULES: ForcedCategoryRule[] = [
  {
    keywords: ['loteria', 'papeleta', 'papeletas', 'rifa', 'sorteo', 'sorteig'],
    categoryNames: ['loteria'],
  },
  {
    keywords: ['voluntario', 'voluntarios', 'voluntari', 'voluntaris', 'voluntariat', 'voluntariado', 'volunfair'],
    categoryNames: ['voluntarios', 'voluntaris', 'voluntariat', 'voluntariado'],
  },
  {
    keywords: ['bizum'],
    categoryNames: ['donacion', 'donaciones', 'donacio', 'donacions'],
  },
  {
    keywords: ['subvencion', 'subvencio', 'aecid', 'accd'],
    categoryNames: ['subvencion', 'subvenciones', 'subvencio', 'subvencions'],
  },
];

const EXPENSE_RULES: ForcedCategoryRule[] = [
  {
    keywords: ['nomina', 'salari', 'salario'],
    categoryNames: ['nomina', 'nominas', 'nomines', 'salari', 'salaris', 'salario', 'salarios'],
  },
  {
    keywords: ['seg social', 'seguretat social', 'seguridad social'],
    categoryNames: ['seguretat social', 'seguridad social'],
  },
  {
    keywords: ['hacienda', 'aeat', 'agencia tributaria'],
    categoryNames: ['impost', 'impuestos', 'hisenda', 'hacienda'],
  },
  {
    keywords: ['alquiler', 'lloguer'],
    categoryNames: ['alquiler', 'lloguer'],
  },
  {
    keywords: ['endesa', 'iberdrola', 'naturgy', 'repsol'],
    categoryNames: ['subministrament', 'subministraments', 'suministro', 'suministros'],
  },
  {
    keywords: ['vodafone', 'movistar', 'orange', 'telefonica'],
    categoryNames: ['telecomunicacio', 'telecomunicacions', 'telecomunicacion', 'telecomunicaciones'],
  },
];

function categoryMatchesNormalizedNames(category: Category, normalizedNames: string[]): boolean {
  const searchableNames = [normalizeForMatching(category.name)];
  return searchableNames.some((searchableName) =>
    normalizedNames.some((normalizedName) => searchableName.includes(normalizedName))
  );
}

function findCategoryIdByNormalizedNames(
  categories: Category[],
  type: Category['type'],
  names: string[]
): string | null {
  const normalizedNames = names.map(normalizeForMatching);
  const category = categories.find((candidate) =>
    candidate.type === type && categoryMatchesNormalizedNames(candidate, normalizedNames)
  );
  return category?.id ?? null;
}

function getForcedCategoryIdFromRules(
  description: string,
  categories: Category[],
  type: Category['type'],
  rules: ForcedCategoryRule[]
): string | null {
  if (!description || !categories || categories.length === 0) {
    return null;
  }

  const descNormalized = normalizeForMatching(description);

  for (const rule of rules) {
    const matchesRule = rule.keywords.some((keyword) => descNormalized.includes(keyword));
    if (!matchesRule) {
      continue;
    }

    const categoryId = findCategoryIdByNormalizedNames(categories, type, rule.categoryNames);
    if (categoryId) {
      return categoryId;
    }
  }

  return null;
}

/**
 * Detecta si una descripció bancària correspon a un ingrés especial
 * (loteria o voluntariat) i retorna el categoryId corresponent.
 *
 * Ordre de prioritat:
 * 1. Si la descripció conté keywords de loteria → cerca categoria "loteria"
 * 2. Si la descripció conté keywords de voluntariat → cerca categoria "voluntarios/voluntaris/..."
 *
 * @param description Descripció bancària del moviment
 * @param categories Llista de categories disponibles
 * @returns categoryId si hi ha match, null altrament
 */
export function getForcedIncomeCategoryIdByBankDescription(
  description: string,
  categories: Category[]
): string | null {
  return getForcedCategoryIdFromRules(description, categories, 'income', INCOME_RULES);
}

export function getForcedExpenseCategoryIdByBankDescription(
  description: string,
  categories: Category[]
): string | null {
  return getForcedCategoryIdFromRules(description, categories, 'expense', EXPENSE_RULES);
}

export function getForcedCategoryIdByBankDescription(
  description: string,
  amount: number,
  categories: Category[]
): string | null {
  if (amount > 0) {
    return getForcedIncomeCategoryIdByBankDescription(description, categories);
  }

  if (amount < 0) {
    return getForcedExpenseCategoryIdByBankDescription(description, categories);
  }

  return null;
}
