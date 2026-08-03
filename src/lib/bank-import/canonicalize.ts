import { normalizeBankDescription } from '@/lib/normalize';
import type { CanonicalBankImportTx } from '@/lib/bank-import/idempotency';

export type BankImportContactType = 'donor' | 'supplier' | 'employee';
export type BankImportTransactionType = 'normal' | 'return' | 'return_fee' | 'donation' | 'fee';

export interface BankImportTransactionInput {
  date: string;
  description: string;
  amount: number;
  balanceAfter?: number;
  operationDate: string;
  category?: string | null;
  document?: string | null;
  contactId?: string | null;
  contactType?: BankImportContactType | null;
  transactionType?: BankImportTransactionType;
  bankAccountId?: string | null;
  source?: 'bank' | 'manual' | 'remittance' | 'stripe';
}

export type CanonicalizeBankImportResult =
  | { ok: true; tx: CanonicalBankImportTx }
  | { ok: false; error: string; code: string };

const ISO_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_CONTACT_TYPES: readonly BankImportContactType[] = ['donor', 'supplier', 'employee'];
const ALLOWED_TRANSACTION_TYPES: readonly BankImportTransactionType[] = [
  'normal', 'return', 'return_fee', 'donation', 'fee',
];

function normalizeIsoDateOnly(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!ISO_DATE_ONLY_RE.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === trimmed
    ? trimmed
    : null;
}

export function canonicalizeBankImportTransaction(
  tx: BankImportTransactionInput,
  bankAccountId: string,
  index: number
): CanonicalizeBankImportResult {
  if (!tx || typeof tx !== 'object') {
    return { ok: false, error: `transactions[${index}] ha de ser un objecte vàlid`, code: 'INVALID_TRANSACTION' };
  }
  if (typeof tx.date !== 'string' || !tx.date.trim()) {
    return { ok: false, error: `transactions[${index}] ha de tenir date vàlida`, code: 'INVALID_DATE' };
  }
  if (typeof tx.description !== 'string' || !tx.description.trim()) {
    return { ok: false, error: `transactions[${index}] ha de tenir description vàlida`, code: 'INVALID_DESCRIPTION' };
  }
  if (typeof tx.amount !== 'number' || !Number.isFinite(tx.amount)) {
    return { ok: false, error: `transactions[${index}] ha de tenir amount vàlid`, code: 'INVALID_AMOUNT' };
  }
  if (tx.source !== undefined && tx.source !== 'bank') {
    return { ok: false, error: `transactions[${index}] només permet source='bank' a l'import bancari directe`, code: 'INVALID_SOURCE_CONTRACT' };
  }
  if (typeof tx.bankAccountId === 'string' && tx.bankAccountId.trim() && tx.bankAccountId !== bankAccountId) {
    return { ok: false, error: `transactions[${index}] bankAccountId no coincideix amb el compte seleccionat`, code: 'BANK_ACCOUNT_MISMATCH' };
  }

  const operationDate = normalizeIsoDateOnly(tx.operationDate);
  if (!operationDate) {
    return { ok: false, error: `transactions[${index}] cal Data d'operació (F. execució)`, code: 'OPERATION_DATE_REQUIRED' };
  }
  const date = new Date(tx.date);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: `transactions[${index}] date invàlida`, code: 'INVALID_DATE' };
  }

  const transactionType = tx.transactionType ?? 'normal';
  const contactType = tx.contactType ?? null;
  if (!ALLOWED_TRANSACTION_TYPES.includes(transactionType)) {
    return { ok: false, error: `transactions[${index}].transactionType invàlid`, code: 'INVALID_TRANSACTION_TYPE' };
  }
  if (contactType !== null && !ALLOWED_CONTACT_TYPES.includes(contactType)) {
    return { ok: false, error: `transactions[${index}].contactType invàlid`, code: 'INVALID_CONTACT_TYPE' };
  }
  if (contactType !== null && !tx.contactId) {
    return { ok: false, error: `transactions[${index}] té contactType però no contactId`, code: 'CONTACT_TYPE_WITHOUT_CONTACT' };
  }
  if (tx.contactId && contactType === null) {
    return { ok: false, error: `transactions[${index}] té contactId però no contactType`, code: 'CONTACT_ID_WITHOUT_TYPE' };
  }
  if (transactionType === 'fee' && tx.contactId) {
    return { ok: false, error: `transactions[${index}] (fee) no pot tenir contactId`, code: 'A1_FEE_FORBIDS_CONTACT' };
  }
  if (transactionType === 'return' && tx.amount >= 0) {
    return { ok: false, error: `transactions[${index}] (return) ha de tenir import negatiu`, code: 'A2_RETURN_SIGN_INVALID' };
  }
  if (transactionType === 'donation' && tx.amount <= 0) {
    return { ok: false, error: `transactions[${index}] (donation) ha de tenir import positiu`, code: 'A2_DONATION_SIGN_INVALID' };
  }
  if (transactionType === 'fee' && tx.amount >= 0) {
    return { ok: false, error: `transactions[${index}] (fee) ha de tenir import negatiu`, code: 'A2_FEE_SIGN_INVALID' };
  }

  const balanceAfter = typeof tx.balanceAfter === 'number' && Number.isFinite(tx.balanceAfter)
    ? tx.balanceAfter
    : undefined;
  return {
    ok: true,
    tx: {
      date: date.toISOString(),
      description: normalizeBankDescription(tx.description),
      amount: tx.amount,
      ...(balanceAfter === undefined ? {} : { balanceAfter }),
      operationDate,
      category: tx.category ?? null,
      document: null,
      contactId: tx.contactId ?? null,
      contactType,
      transactionType,
      bankAccountId,
      source: 'bank',
    },
  };
}
