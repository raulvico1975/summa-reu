import {
  addDoc,
  doc,
  increment,
  updateDoc,
  type CollectionReference,
} from 'firebase/firestore';
import type { Transaction } from '../data';
import { assertFiscalTxCanBeSaved } from '../fiscal/assertFiscalInvariant';
import { toCents, toEuros } from '../fiscal/remittance-invariants';

export type SplitRow = {
  contactId: string | null;
  amount: number;
};

export type SplitValidationError =
  | 'INVALID_TOTAL'
  | 'MISSING_ROWS'
  | 'MISSING_CONTACT'
  | 'INVALID_AMOUNT'
  | 'NON_POSITIVE_AMOUNT'
  | 'TOTAL_MISMATCH';

export type ValidatedSplitRow = {
  contactId: string;
  amount: number;
};

export type ReturnChildDraft = {
  source: 'remittance';
  parentTransactionId: string;
  isRemittanceItem: true;
  amount: number;
  date: string;
  transactionType: 'return';
  description: string;
  contactId: string;
  contactType: 'donor';
  contactName: string;
  emisorId: string;
  emisorName: string;
  bankAccountId: string | null;
};

export type ReturnParentProcessedUpdate = {
  isRemittance: true;
  remittanceType: 'returns';
  remittanceItemCount: number;
  remittanceResolvedCount: number;
  remittancePendingCount: 0;
  remittancePendingTotalAmount: 0;
  remittanceStatus: 'complete';
  pendingReturns: null;
  contactId: null;
  contactType: null;
  linkedTransactionId: null;
};

export type ManualReturnSplitPlan = {
  total: number;
  rows: ValidatedSplitRow[];
  children: ReturnChildDraft[];
  parentUpdate: ReturnParentProcessedUpdate;
};

function normalizeEuroAmount(amount: number): number {
  return toEuros(toCents(Math.abs(amount)));
}

export function validateSplit(total: number, rows: SplitRow[]): boolean {
  const normalizedTotal = toCents(Math.abs(total));
  const sum = rows.reduce((acc, row) => {
    if (!Number.isFinite(row.amount)) {
      return Number.NaN;
    }
    return acc + toCents(row.amount);
  }, 0);

  return Number.isFinite(sum) && normalizedTotal === sum;
}

export function getSplitValidationError(
  total: number,
  rows: SplitRow[]
): SplitValidationError | null {
  const normalizedTotal = normalizeEuroAmount(total);

  if (!Number.isFinite(normalizedTotal) || normalizedTotal <= 0) {
    return 'INVALID_TOTAL';
  }

  if (rows.length === 0) {
    return 'MISSING_ROWS';
  }

  if (rows.some((row) => !row.contactId)) {
    return 'MISSING_CONTACT';
  }

  if (rows.some((row) => !Number.isFinite(row.amount))) {
    return 'INVALID_AMOUNT';
  }

  if (rows.some((row) => row.amount <= 0)) {
    return 'NON_POSITIVE_AMOUNT';
  }

  if (!validateSplit(normalizedTotal, rows)) {
    return 'TOTAL_MISMATCH';
  }

  return null;
}

export function buildReturnChildDraft(params: {
  parentTransaction: Transaction;
  contactId: string;
  donorName?: string | null;
  amount: number;
  date?: string | null;
  description?: string | null;
}): ReturnChildDraft {
  const {
    parentTransaction,
    contactId,
    donorName,
    amount,
    date,
    description,
  } = params;

  const normalizedAmount = normalizeEuroAmount(amount);
  const resolvedDonorName = donorName?.trim() || 'Donant';

  return {
    source: 'remittance',
    parentTransactionId: parentTransaction.id,
    isRemittanceItem: true,
    amount: -normalizedAmount,
    date: date || parentTransaction.date || new Date().toISOString().split('T')[0],
    transactionType: 'return',
    description: description || parentTransaction.description || 'Devolució',
    contactId,
    contactType: 'donor',
    contactName: resolvedDonorName,
    emisorId: contactId,
    emisorName: resolvedDonorName,
    bankAccountId: parentTransaction.bankAccountId ?? null,
  };
}

export function buildReturnSplitParentUpdate(
  rowsCount: number
): ReturnParentProcessedUpdate {
  return {
    isRemittance: true,
    remittanceType: 'returns',
    remittanceItemCount: rowsCount,
    remittanceResolvedCount: rowsCount,
    remittancePendingCount: 0,
    remittancePendingTotalAmount: 0,
    remittanceStatus: 'complete',
    pendingReturns: null,
    contactId: null,
    contactType: null,
    linkedTransactionId: null,
  };
}

export function buildManualReturnSplitPlan(params: {
  parentTransaction: Transaction;
  rows: SplitRow[];
  donorNamesById?: ReadonlyMap<string, string>;
}): ManualReturnSplitPlan {
  const { parentTransaction, rows, donorNamesById } = params;
  const total = normalizeEuroAmount(parentTransaction.amount);
  const error = getSplitValidationError(total, rows);

  if (error) {
    throw new Error(`Manual return split validation failed: ${error}`);
  }

  const normalizedRows = rows.map((row) => ({
    contactId: row.contactId!,
    amount: normalizeEuroAmount(row.amount),
  }));

  return {
    total,
    rows: normalizedRows,
    children: normalizedRows.map((row) =>
      buildReturnChildDraft({
        parentTransaction,
        contactId: row.contactId,
        donorName: donorNamesById?.get(row.contactId) ?? null,
        amount: row.amount,
      })
    ),
    parentUpdate: buildReturnSplitParentUpdate(normalizedRows.length),
  };
}

export async function createReturnChild(params: {
  transactionsCollection: CollectionReference;
  contactsCollection?: CollectionReference | null;
  organizationId: string;
  childData: ReturnChildDraft;
  route?: string;
}): Promise<void> {
  const { transactionsCollection, contactsCollection, organizationId, childData, route } = params;

  assertFiscalTxCanBeSaved(
    {
      transactionType: childData.transactionType,
      amount: childData.amount,
      contactId: childData.contactId,
      source: childData.source,
    },
    {
      firestore: transactionsCollection.firestore,
      orgId: organizationId,
      operation: 'createReturn',
      route,
    }
  );

  await addDoc(transactionsCollection, childData);

  if (contactsCollection) {
    await updateDoc(doc(contactsCollection, childData.contactId), {
      returnCount: increment(1),
      lastReturnDate: childData.date || new Date().toISOString().split('T')[0],
      status: 'pending_return',
    });
  }
}

export async function createManualReturnSplit(params: {
  transactionsCollection: CollectionReference;
  contactsCollection?: CollectionReference | null;
  organizationId: string;
  parentTransaction: Transaction;
  rows: SplitRow[];
  donorNamesById?: ReadonlyMap<string, string>;
  route?: string;
}): Promise<ManualReturnSplitPlan> {
  const {
    transactionsCollection,
    contactsCollection,
    organizationId,
    parentTransaction,
    rows,
    donorNamesById,
    route,
  } = params;

  const plan = buildManualReturnSplitPlan({
    parentTransaction,
    rows,
    donorNamesById,
  });

  for (const childData of plan.children) {
    await createReturnChild({
      transactionsCollection,
      contactsCollection,
      organizationId,
      childData,
      route,
    });
  }

  await updateDoc(doc(transactionsCollection, parentTransaction.id), plan.parentUpdate);

  return plan;
}
