import { findSystemCategoryId } from '@/lib/constants';
import type { Contact, Category, Donor, Transaction } from '@/lib/data';
import {
  buildDashboardSummary,
  isArchivedTransaction,
  isDashboardLedgerTransaction,
} from '@/lib/read-models/transactions';

export interface AnalyticsRequestBody {
  orgSlug: string;
  from: string;
  to: string;
}

export type ParseAnalyticsRequestBodyResult =
  | { ok: true; value: AnalyticsRequestBody }
  | { ok: false; code: 'INVALID_BODY' | 'INVALID_DATE' | 'INVALID_DATE_RANGE' };

export interface BalanceResult {
  incomeTotal: number;
  operatingExpenseTotal: number;
  missionTransfersTotal: number;
  operatingBalance: number;
}

export interface MonthlyEvolutionItem {
  month: string;
  income: number;
  expenses: number;
  missionTransfers: number;
  balance: number;
}

export interface MonthlyEvolutionResult {
  items: MonthlyEvolutionItem[];
}

export interface ExpenseByCategoryItem {
  categoryId: string | null;
  categoryName: string;
  amount: number;
  percentage: number;
  movementCount: number;
}

export interface ExpenseByCategoryResult {
  total: number;
  items: ExpenseByCategoryItem[];
}

export interface IncomeCompositionResult {
  memberFees: number;
  oneTimeDonations: number;
  otherIncome: number;
  percentages: {
    memberFees: number;
    oneTimeDonations: number;
    otherIncome: number;
  };
}

type AnalyticsCategory = Pick<Category, 'id' | 'name' | 'type' | 'systemKey'>;
type AnalyticsContact = Pick<Contact, 'id' | 'type'> & Partial<Pick<Donor, 'membershipType'>>;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const UNCATEGORIZED_EXPENSE_LABEL = 'Sense categoria';

function isValidAnalyticsDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function compareIsoDates(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function buildMonthKey(year: number, monthIndexZeroBased: number): string {
  return `${year}-${String(monthIndexZeroBased + 1).padStart(2, '0')}`;
}

function listMonthKeys(from: string, to: string): string[] {
  const [fromYear, fromMonth] = from.split('-').map(Number);
  const [toYear, toMonth] = to.split('-').map(Number);
  const result: string[] = [];

  let year = fromYear;
  let monthIndex = fromMonth - 1;
  const lastYear = toYear;
  const lastMonthIndex = toMonth - 1;

  while (year < lastYear || (year === lastYear && monthIndex <= lastMonthIndex)) {
    result.push(buildMonthKey(year, monthIndex));
    monthIndex += 1;
    if (monthIndex > 11) {
      monthIndex = 0;
      year += 1;
    }
  }

  return result;
}

function toPercentage(amount: number, total: number): number {
  if (total <= 0) return 0;
  return (amount / total) * 100;
}

export function parseAnalyticsRequestBody(body: unknown): ParseAnalyticsRequestBodyResult {
  if (!body || typeof body !== "object") {
    return { ok: false, code: 'INVALID_BODY' };
  }

  const record = body as Record<string, unknown>;
  const orgSlug = typeof record.orgSlug === 'string' ? record.orgSlug.trim() : '';
  const from = typeof record.from === 'string' ? record.from.trim() : '';
  const to = typeof record.to === 'string' ? record.to.trim() : '';

  if (!orgSlug || !from || !to) {
    return { ok: false, code: 'INVALID_BODY' };
  }

  if (!isValidAnalyticsDate(from) || !isValidAnalyticsDate(to)) {
    return { ok: false, code: 'INVALID_DATE' };
  }

  if (compareIsoDates(from, to) > 0) {
    return { ok: false, code: 'INVALID_DATE_RANGE' };
  }

  return {
    ok: true,
    value: { orgSlug, from, to },
  };
}

export async function getOrgIdFromSlug(
  db: FirebaseFirestore.Firestore,
  slug: string
): Promise<string | null> {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return null;

  const slugSnap = await db.doc(`slugs/${normalizedSlug}`).get();
  if (!slugSnap.exists) return null;

  const orgId = slugSnap.get('orgId');
  return typeof orgId === 'string' && orgId.trim() ? orgId : null;
}

export async function getOrganizationCategories(
  db: FirebaseFirestore.Firestore,
  orgId: string
): Promise<AnalyticsCategory[]> {
  const snapshot = await db.collection(`organizations/${orgId}/categories`).get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    name: String(doc.get('name') ?? ''),
    type: doc.get('type') === 'income' ? 'income' : 'expense',
    systemKey: typeof doc.get('systemKey') === 'string' ? doc.get('systemKey') : null,
  }));
}

export async function getOrganizationContacts(
  db: FirebaseFirestore.Firestore,
  orgId: string
): Promise<AnalyticsContact[]> {
  const snapshot = await db.collection(`organizations/${orgId}/contacts`).get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    type: doc.get('type') === 'donor' ? 'donor' : doc.get('type') === 'employee' ? 'employee' : 'supplier',
    membershipType:
      doc.get('membershipType') === 'recurring' ? 'recurring' : 'one-time',
  }));
}

export function resolveMissionTransferCategoryId(
  categories: AnalyticsCategory[]
): string | null {
  return findSystemCategoryId(categories, 'missionTransfers');
}

export function filterDashboardLedgerTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter((tx) => isDashboardLedgerTransaction(tx));
}

export async function getDashboardLedgerTransactions(
  db: FirebaseFirestore.Firestore,
  orgId: string,
  from: string,
  to: string
): Promise<Transaction[]> {
  const snapshot = await db
    .collection(`organizations/${orgId}/transactions`)
    .orderBy('date', 'desc')
    .where('date', '>=', from)
    .where('date', '<=', to)
    .get();

  const transactions = snapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as Transaction
  );

  return filterDashboardLedgerTransactions(transactions);
}

export function filterSocialTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter((tx) => !isArchivedTransaction(tx) && Boolean(tx.contactId));
}

export async function getSocialTransactions(
  db: FirebaseFirestore.Firestore,
  orgId: string,
  from: string,
  to: string
): Promise<Transaction[]> {
  const snapshot = await db
    .collection(`organizations/${orgId}/transactions`)
    .orderBy('date', 'desc')
    .where('date', '>=', from)
    .where('date', '<=', to)
    .get();

  const transactions = snapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as Transaction
  );

  return filterSocialTransactions(transactions);
}

export function computeBalance(
  ledgerTxs: Transaction[],
  missionTransferCategoryId: string | null
): BalanceResult {
  const summary = buildDashboardSummary(ledgerTxs, missionTransferCategoryId);
  return {
    incomeTotal: summary.income,
    operatingExpenseTotal: summary.expense,
    missionTransfersTotal: summary.missionTransfers,
    operatingBalance: summary.balance,
  };
}

export function computeMonthlyEvolution(
  ledgerTxs: Transaction[],
  from: string,
  to: string,
  missionTransferCategoryId: string | null
): MonthlyEvolutionResult {
  const byMonth = new Map<string, MonthlyEvolutionItem>();

  for (const month of listMonthKeys(from, to)) {
    byMonth.set(month, {
      month,
      income: 0,
      expenses: 0,
      missionTransfers: 0,
      balance: 0,
    });
  }

  for (const tx of ledgerTxs) {
    const month = tx.date.slice(0, 7);
    const entry = byMonth.get(month);
    if (!entry) continue;

    if (tx.amount > 0) {
      entry.income += tx.amount;
    } else if (missionTransferCategoryId && tx.category === missionTransferCategoryId) {
      entry.missionTransfers += tx.amount;
    } else {
      entry.expenses += tx.amount;
    }
  }

  const items = Array.from(byMonth.values()).map((entry) => ({
    ...entry,
    balance: entry.income + entry.expenses + entry.missionTransfers,
  }));

  return { items };
}

export function computeExpenseByCategory(
  ledgerTxs: Transaction[],
  categories: AnalyticsCategory[],
  missionTransferCategoryId: string | null
): ExpenseByCategoryResult {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const itemsByCategory = new Map<string, ExpenseByCategoryItem>();
  let total = 0;

  for (const tx of ledgerTxs) {
    if (tx.amount >= 0) continue;
    if (missionTransferCategoryId && tx.category === missionTransferCategoryId) continue;
    if (tx.transactionType === 'fee' || tx.transactionType === 'return_fee') continue;

    const rawCategory = tx.category ? categoriesById.get(tx.category) : null;
    const category = rawCategory?.type === 'expense' ? rawCategory : null;
    const key = category?.id ?? '__uncategorized__';
    const amount = Math.abs(tx.amount);
    total += amount;

    if (!itemsByCategory.has(key)) {
      itemsByCategory.set(key, {
        categoryId: category?.id ?? null,
        categoryName: category?.name || UNCATEGORIZED_EXPENSE_LABEL,
        amount: 0,
        percentage: 0,
        movementCount: 0,
      });
    }

    const item = itemsByCategory.get(key)!;
    item.amount += amount;
    item.movementCount += 1;
  }

  const items = Array.from(itemsByCategory.values())
    .map((item) => ({
      ...item,
      percentage: toPercentage(item.amount, total),
    }))
    .sort(
      (left, right) =>
        right.amount - left.amount ||
        left.categoryName.localeCompare(right.categoryName, 'ca')
    );

  return { total, items };
}

export function computeIncomeComposition({
  incomeTotal,
  socialTxs,
  contacts,
}: {
  incomeTotal: number;
  socialTxs: Transaction[];
  contacts: AnalyticsContact[];
}): IncomeCompositionResult {
  const membershipTypeByContactId = new Map<string, Donor['membershipType']>();

  for (const contact of contacts) {
    if (contact.type !== 'donor') continue;
    membershipTypeByContactId.set(contact.id, contact.membershipType === 'recurring' ? 'recurring' : 'one-time');
  }

  let memberFees = 0;
  let oneTimeDonations = 0;

  for (const tx of socialTxs) {
    if (tx.contactType !== 'donor') continue;
    if (tx.amount <= 0) continue;
    if (!tx.contactId) continue;

    const membershipType = membershipTypeByContactId.get(tx.contactId) ?? 'one-time';
    if (membershipType === 'recurring') {
      memberFees += tx.amount;
      continue;
    }
    oneTimeDonations += tx.amount;
  }

  const otherIncome = Math.max(0, incomeTotal - memberFees - oneTimeDonations);

  return {
    memberFees,
    oneTimeDonations,
    otherIncome,
    percentages: {
      memberFees: toPercentage(memberFees, incomeTotal),
      oneTimeDonations: toPercentage(oneTimeDonations, incomeTotal),
      otherIncome: toPercentage(otherIncome, incomeTotal),
    },
  };
}
