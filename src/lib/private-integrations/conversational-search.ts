export type SearchConfidence = 'exact' | 'high' | 'medium' | 'low';
export type ContactRoleFilter = 'donor' | 'supplier' | 'employee' | 'any';
export type TransactionDirection = 'income' | 'expense' | 'any';

export interface ConversationalSearchMetadata {
  matchReasons: string[];
  confidence: SearchConfidence;
  decision: 'candidate_only';
}

export interface ConversationalBankAccountRecord {
  id: string;
  name: string;
  bankName?: string | null;
  iban?: string | null;
  isDefault?: boolean | null;
  isActive?: boolean | null;
  archivedAt?: unknown;
}

export interface ConversationalContactRecord {
  id: string;
  name: string;
  taxId?: string | null;
  email?: string | null;
  type: 'donor' | 'supplier' | 'employee';
  roles?: {
    donor?: boolean;
    supplier?: boolean;
    employee?: boolean;
  } | null;
  status?: string | null;
  aliases?: string[] | null;
  archivedAt?: unknown;
}

export interface ConversationalTransactionRecord {
  id: string;
  date: string;
  amount: number;
  description: string;
  bankAccountId?: string | null;
  contactId?: string | null;
  contactType?: 'donor' | 'supplier' | 'employee' | null;
  source?: 'bank' | 'remittance' | 'manual' | 'stripe' | null;
  transactionType?: 'normal' | 'return' | 'return_fee' | 'donation' | 'fee' | null;
  donationStatus?: 'completed' | 'returned' | 'partial' | null;
  archivedAt?: unknown;
}

export interface BankAccountSearchInput {
  q?: string;
  includeArchived?: boolean;
  limit: number;
}

export interface ContactSearchInput {
  q: string;
  role: ContactRoleFilter;
  includeArchived?: boolean;
  limit: number;
}

export interface TransactionSearchInput {
  q?: string;
  amount?: number;
  amountTolerance: number;
  dateFrom?: string;
  dateTo?: string;
  bankAccountId?: string;
  direction: TransactionDirection;
  includeArchived?: boolean;
  limit: number;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function compact(value: string): string {
  return normalize(value).replace(/[^a-z0-9]/g, '');
}

function isArchived(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function confidenceFromScore(score: number): SearchConfidence {
  if (score >= 100) return 'exact';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function rankText(
  query: string,
  value: string | null | undefined,
  reasonPrefix: string,
  options: { compact?: boolean } = {}
): { score: number; reason: string | null } {
  if (!value) return { score: 0, reason: null };
  const normalizedQuery = options.compact ? compact(query) : normalize(query);
  const normalizedValue = options.compact ? compact(value) : normalize(value);
  if (!normalizedQuery || !normalizedValue) return { score: 0, reason: null };
  if (normalizedValue === normalizedQuery) {
    return { score: 100, reason: `${reasonPrefix}_exact` };
  }
  if (normalizedValue.startsWith(normalizedQuery)) {
    return { score: 75, reason: `${reasonPrefix}_prefix` };
  }
  if (normalizedValue.includes(normalizedQuery)) {
    return { score: 50, reason: `${reasonPrefix}_contains` };
  }
  return { score: 0, reason: null };
}

function maskIban(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, '').toUpperCase();
  if (normalized.length <= 8) return `${normalized.slice(0, 2)}••••${normalized.slice(-2)}`;
  return `${normalized.slice(0, 4)}••••••••${normalized.slice(-4)}`;
}

function maskTaxId(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, '').toUpperCase();
  if (normalized.length <= 4) return `${normalized.slice(0, 1)}••${normalized.slice(-1)}`;
  return `${normalized.slice(0, 2)}${'•'.repeat(Math.min(5, normalized.length - 4))}${normalized.slice(-2)}`;
}

function maskEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const [local, domain] = value.trim().toLowerCase().split('@');
  if (!local || !domain) return null;
  return `${local.slice(0, 1)}•••@${domain}`;
}

function rolesForContact(contact: ConversationalContactRecord) {
  return {
    donor: contact.type === 'donor' || contact.roles?.donor === true,
    supplier: contact.type === 'supplier' || contact.roles?.supplier === true,
    employee: contact.type === 'employee' || contact.roles?.employee === true,
  };
}

function sortRanked<T extends ConversationalSearchMetadata & { name?: string; _score: number }>(
  values: T[]
): Array<Omit<T, '_score'>> {
  return values
    .sort((a, b) => b._score - a._score || (a.name ?? '').localeCompare(b.name ?? '', 'ca'))
    .map(({ _score: _discarded, ...value }) => value);
}

export function searchBankAccountCandidates(
  records: ConversationalBankAccountRecord[],
  input: BankAccountSearchInput
) {
  const query = input.q?.trim() ?? '';
  const ranked = records.flatMap((account) => {
    if (!input.includeArchived && (isArchived(account.archivedAt) || account.isActive === false)) {
      return [];
    }

    const reasons: string[] = [];
    let score = query ? 0 : account.isDefault === true ? 25 : 10;
    if (!query) reasons.push(account.isDefault === true ? 'default_account' : 'available_account');

    for (const match of [
      rankText(query, account.name, 'name'),
      rankText(query, account.bankName, 'bank_name'),
      rankText(query, account.iban, 'iban', { compact: true }),
    ]) {
      if (match.reason) reasons.push(match.reason);
      score = Math.max(score, match.score);
    }
    if (query && reasons.length === 0) return [];
    if (account.isDefault === true) score += 5;

    return [{
      id: account.id,
      name: account.name,
      bankName: account.bankName ?? null,
      ibanMasked: maskIban(account.iban),
      isActive: account.isActive !== false && !isArchived(account.archivedAt),
      isDefault: account.isDefault === true,
      matchReasons: reasons,
      confidence: confidenceFromScore(score),
      decision: 'candidate_only' as const,
      _score: score,
    }];
  });

  return sortRanked(ranked).slice(0, input.limit);
}

export function searchContactCandidates(
  records: ConversationalContactRecord[],
  input: ContactSearchInput
) {
  const ranked = records.flatMap((contact) => {
    if (!input.includeArchived && isArchived(contact.archivedAt)) return [];
    const roles = rolesForContact(contact);
    if (input.role !== 'any' && !roles[input.role]) return [];

    const reasons: string[] = [];
    let score = 0;
    const fields = [
      rankText(input.q, contact.name, 'name'),
      rankText(input.q, contact.taxId, 'tax_id', { compact: true }),
      rankText(input.q, contact.email, 'email'),
      ...(contact.aliases ?? []).map((alias) => rankText(input.q, alias, 'alias')),
    ];
    for (const match of fields) {
      if (match.reason) reasons.push(match.reason);
      score = Math.max(score, match.score);
    }
    if (reasons.length === 0) return [];

    return [{
      id: contact.id,
      name: contact.name,
      type: contact.type,
      roles,
      donor: roles.donor,
      taxIdMasked: maskTaxId(contact.taxId),
      emailMasked: maskEmail(contact.email),
      status: contact.status ?? null,
      archived: isArchived(contact.archivedAt),
      matchReasons: reasons,
      confidence: confidenceFromScore(score),
      decision: 'candidate_only' as const,
      _score: score,
    }];
  });

  return sortRanked(ranked).slice(0, input.limit);
}

function truncateDescription(value: string): string {
  const trimmed = value.trim();
  return trimmed.length <= 160 ? trimmed : `${trimmed.slice(0, 157)}...`;
}

export function searchTransactionCandidates(
  records: ConversationalTransactionRecord[],
  bankAccounts: ConversationalBankAccountRecord[],
  input: TransactionSearchInput
) {
  const accountsById = new Map(bankAccounts.map((account) => [account.id, account]));
  const query = input.q?.trim() ?? '';
  const ranked = records.flatMap((transaction) => {
    if (!input.includeArchived && isArchived(transaction.archivedAt)) return [];
    if (input.bankAccountId && transaction.bankAccountId !== input.bankAccountId) return [];
    if (input.dateFrom && transaction.date < input.dateFrom) return [];
    if (input.dateTo && transaction.date > `${input.dateTo}T23:59:59.999Z`) return [];
    if (input.direction === 'income' && transaction.amount <= 0) return [];
    if (input.direction === 'expense' && transaction.amount >= 0) return [];

    const reasons: string[] = [];
    let score = 0;
    if (query) {
      const match = rankText(query, transaction.description, 'description');
      if (!match.reason) return [];
      reasons.push(match.reason);
      score += match.score;
    }
    if (input.amount !== undefined) {
      const difference = Math.abs(transaction.amount - input.amount);
      if (difference > input.amountTolerance) return [];
      const exact = difference < 0.000001;
      reasons.push(exact ? 'amount_exact' : 'amount_within_tolerance');
      score += exact ? 90 : 70;
    }
    if (input.dateFrom || input.dateTo) {
      reasons.push('date_in_range');
      score += 20;
    }
    if (input.bankAccountId) {
      reasons.push('bank_account_exact');
      score += 20;
    }
    if (input.direction !== 'any') {
      reasons.push(`direction_${input.direction}`);
      score += 10;
    }
    if (reasons.length === 0) return [];

    const account = transaction.bankAccountId
      ? accountsById.get(transaction.bankAccountId)
      : undefined;
    return [{
      id: transaction.id,
      date: transaction.date,
      amount: transaction.amount,
      direction: transaction.amount >= 0 ? 'income' as const : 'expense' as const,
      description: truncateDescription(transaction.description),
      bankAccount: transaction.bankAccountId
        ? {
            id: transaction.bankAccountId,
            name: account?.name ?? null,
            ibanMasked: maskIban(account?.iban),
          }
        : null,
      contact: transaction.contactId
        ? { id: transaction.contactId, type: transaction.contactType ?? null }
        : null,
      source: transaction.source ?? null,
      transactionType: transaction.transactionType ?? null,
      donationStatus: transaction.donationStatus ?? null,
      archived: isArchived(transaction.archivedAt),
      matchReasons: reasons,
      confidence: confidenceFromScore(score),
      decision: 'candidate_only' as const,
      _score: score,
    }];
  });

  return sortRanked(ranked).slice(0, input.limit);
}

export function resolutionStatus(count: number) {
  return {
    status: count === 0 ? 'no_candidates' as const
      : count === 1 ? 'single_candidate' as const
        : 'multiple_candidates' as const,
    requiresHumanChoice: true,
  };
}

export const conversationalSearchMasks = { maskEmail, maskIban, maskTaxId };
