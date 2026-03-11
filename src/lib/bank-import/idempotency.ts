import { createHash } from 'crypto';

export interface CanonicalBankImportTx {
  date: string;
  description: string;
  amount: number;
  balanceAfter?: number;
  operationDate: string;
  category: string | null;
  document: string | null;
  contactId: string | null;
  contactType: 'donor' | 'supplier' | 'employee' | null;
  transactionType: 'normal' | 'return' | 'return_fee' | 'donation' | 'fee';
  bankAccountId: string;
  source: 'bank';
}

export interface ComputeBankImportHashParams {
  orgId: string;
  bankAccountId: string;
  source: 'csv' | 'xlsx';
  fileName: string | null;
  totalRows: number;
  transactions: CanonicalBankImportTx[];
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function toAmountCents(amount: number): number {
  return Math.round(amount * 100);
}

const ISO_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertCanonicalBankImportTx(tx: CanonicalBankImportTx): void {
  if (tx.source !== 'bank') {
    throw new Error('CanonicalBankImportTx only supports source=bank');
  }

  if (typeof tx.bankAccountId !== 'string' || tx.bankAccountId.trim() === '') {
    throw new Error('CanonicalBankImportTx requires bankAccountId');
  }

  if (!ISO_DATE_ONLY_RE.test(tx.operationDate)) {
    throw new Error('CanonicalBankImportTx requires operationDate as ISO YYYY-MM-DD');
  }
}

export function buildCanonicalSignature(tx: CanonicalBankImportTx): string {
  assertCanonicalBankImportTx(tx);

  return JSON.stringify({
    d: tx.date,
    n: tx.description.trim().replace(/\s+/g, ' ').toUpperCase(),
    a: toAmountCents(tx.amount),
    ...(tx.balanceAfter !== undefined ? { ba: toAmountCents(tx.balanceAfter) } : {}),
    od: tx.operationDate,
    c: tx.category ?? null,
    x: tx.contactId ?? null,
    y: tx.contactType ?? null,
    t: tx.transactionType,
    b: tx.bankAccountId,
    s: tx.source,
  });
}

export function computeBankImportHash(
  params: ComputeBankImportHashParams
): string {
  const signatures = params.transactions
    .map(buildCanonicalSignature)
    .sort((a, b) => a.localeCompare(b));

  const payload = JSON.stringify({
    v: 1,
    orgId: params.orgId,
    bankAccountId: params.bankAccountId,
    source: params.source,
    fileName: params.fileName ?? null,
    totalRows: params.totalRows,
    txs: signatures,
  });

  return sha256Hex(payload);
}

export interface DeterministicPreparedTx<T> {
  id: string;
  signature: string;
  tx: T;
}

export function prepareDeterministicTransactions<T extends CanonicalBankImportTx>(
  transactions: T[],
  inputHash: string
): DeterministicPreparedTx<T>[] {
  const withSignature = transactions.map((tx) => ({
    tx,
    signature: buildCanonicalSignature(tx),
  }));

  withSignature.sort((a, b) => a.signature.localeCompare(b.signature));

  const counters = new Map<string, number>();

  return withSignature.map((item) => {
    const current = counters.get(item.signature) ?? 0;
    const ordinal = current + 1;
    counters.set(item.signature, ordinal);

    const id = `imp_${sha256Hex(`${inputHash}|${item.signature}|${ordinal}`).slice(0, 28)}`;

    return {
      id,
      signature: item.signature,
      tx: item.tx,
    };
  });
}
