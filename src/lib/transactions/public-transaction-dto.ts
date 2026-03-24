import type { ContactType, DonationStatus, Transaction, TransactionType } from '@/lib/data';

type PublicTransactionSource = NonNullable<Transaction['source']>;
type PublicTransactionRemittanceType = NonNullable<Transaction['remittanceType']>;
type PublicTransactionRemittanceStatus = NonNullable<Transaction['remittanceStatus']>;

export interface PublicTransactionDto {
  id: string;
  date: string;
  operationDate: string | null;
  description: string;
  amount: number;
  balanceAfter: number | null;
  category: string | null;
  contactId: string | null;
  contactType: ContactType | null;
  projectId: string | null;
  document: string | null;
  note: string | null;
  source: PublicTransactionSource | null;
  transactionType: TransactionType | null;
  isSplit: boolean;
  parentTransactionId: string | null;
  isRemittance: boolean;
  isRemittanceItem: boolean;
  remittanceId: string | null;
  remittanceType: PublicTransactionRemittanceType | null;
  remittanceStatus: PublicTransactionRemittanceStatus | null;
  remittanceItemCount: number | null;
  remittanceResolvedCount: number | null;
  remittancePendingCount: number | null;
  remittancePendingTotalAmount: number | null;
  bankAccountId: string | null;
  archivedAt: string | null;
  donationStatus: DonationStatus | null;
  stripeTransferId: string | null;
}

export const PUBLIC_TRANSACTION_DTO_KEYS = [
  'id',
  'date',
  'operationDate',
  'description',
  'amount',
  'balanceAfter',
  'category',
  'contactId',
  'contactType',
  'projectId',
  'document',
  'note',
  'source',
  'transactionType',
  'isSplit',
  'parentTransactionId',
  'isRemittance',
  'isRemittanceItem',
  'remittanceId',
  'remittanceType',
  'remittanceStatus',
  'remittanceItemCount',
  'remittanceResolvedCount',
  'remittancePendingCount',
  'remittancePendingTotalAmount',
  'bankAccountId',
  'archivedAt',
  'donationStatus',
  'stripeTransferId',
] as const satisfies ReadonlyArray<keyof PublicTransactionDto>;

const ALLOWED_CONTACT_TYPES = new Set<ContactType>(['donor', 'supplier', 'employee']);
const ALLOWED_SOURCES = new Set<PublicTransactionSource>(['bank', 'remittance', 'manual', 'stripe']);
const ALLOWED_TRANSACTION_TYPES = new Set<TransactionType>(['normal', 'return', 'return_fee', 'donation', 'fee']);
const ALLOWED_REMITTANCE_TYPES = new Set<PublicTransactionRemittanceType>(['returns', 'donations', 'payments']);
const ALLOWED_REMITTANCE_STATUSES = new Set<PublicTransactionRemittanceStatus>(['complete', 'partial', 'pending']);
const ALLOWED_DONATION_STATUSES = new Set<DonationStatus>(['completed', 'returned', 'partial']);

function getString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function getNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function getNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getAllowedValue<T extends string>(value: unknown, allowed: Set<T>): T | null {
  return typeof value === 'string' && allowed.has(value as T) ? (value as T) : null;
}

function getNote(data: Record<string, unknown>): string | null {
  if (typeof data.note === 'string') return data.note;
  if (typeof data.notes === 'string') return data.notes;
  return null;
}

export function serializePublicTransaction(
  id: string,
  data: Record<string, unknown>
): PublicTransactionDto {
  return {
    id,
    date: getString(data.date),
    operationDate: getNullableString(data.operationDate),
    description: getString(data.description),
    amount: getNullableNumber(data.amount) ?? 0,
    balanceAfter: getNullableNumber(data.balanceAfter),
    category: getNullableString(data.category),
    contactId: getNullableString(data.contactId),
    contactType: getAllowedValue(data.contactType, ALLOWED_CONTACT_TYPES),
    projectId: getNullableString(data.projectId),
    document: getNullableString(data.document),
    note: getNote(data),
    source: getAllowedValue(data.source, ALLOWED_SOURCES),
    transactionType: getAllowedValue(data.transactionType, ALLOWED_TRANSACTION_TYPES),
    isSplit: data.isSplit === true,
    parentTransactionId: getNullableString(data.parentTransactionId),
    isRemittance: data.isRemittance === true,
    isRemittanceItem: data.isRemittanceItem === true,
    remittanceId: getNullableString(data.remittanceId),
    remittanceType: getAllowedValue(data.remittanceType, ALLOWED_REMITTANCE_TYPES),
    remittanceStatus: getAllowedValue(data.remittanceStatus, ALLOWED_REMITTANCE_STATUSES),
    remittanceItemCount: getNullableNumber(data.remittanceItemCount),
    remittanceResolvedCount: getNullableNumber(data.remittanceResolvedCount),
    remittancePendingCount: getNullableNumber(data.remittancePendingCount),
    remittancePendingTotalAmount: getNullableNumber(data.remittancePendingTotalAmount),
    bankAccountId: getNullableString(data.bankAccountId),
    archivedAt: getNullableString(data.archivedAt),
    donationStatus: getAllowedValue(data.donationStatus, ALLOWED_DONATION_STATUSES),
    stripeTransferId: getNullableString(data.stripeTransferId),
  };
}
