import {
  MAX_SPLIT_CHILDREN,
  SPLIT_TOO_LARGE_CODE,
  getSplitTooLargeMessage,
} from '@/lib/transactions/split-contract';

export type AtomicSplitLineKind = 'donation' | 'nonDonation';

export interface AtomicSplitLine {
  amountCents: number;
  kind: AtomicSplitLineKind;
  categoryId: string | null;
  contactId: string | null;
  note: string | null;
}

export interface AtomicSplitContactDoc {
  id: string;
  name?: string | null;
  type?: string | null;
}

export interface AtomicSplitCategoryDoc {
  id: string;
  name?: string | null;
}

export interface CommitAtomicSplitInput {
  db: Pick<FirebaseFirestore.Firestore, 'batch' | 'collection'>;
  orgId: string;
  parentTxId: string;
  parentDate: string;
  parentDescription: string;
  parentBankAccountId: string;
  lines: AtomicSplitLine[];
  contactsMap: Map<string, AtomicSplitContactDoc>;
  categoriesMap: Map<string, AtomicSplitCategoryDoc>;
  uid: string;
  nowIso?: string;
}

export interface CommitAtomicSplitResult {
  childTransactionIds: string[];
  createdCount: number;
}

export class SplitTooLargeError extends Error {
  code = SPLIT_TOO_LARGE_CODE;

  constructor(message: string = getSplitTooLargeMessage()) {
    super(message);
    this.name = 'SplitTooLargeError';
  }
}

function omitUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => omitUndefinedDeep(item))
      .filter((item) => item !== undefined) as T;
  }

  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry === undefined) continue;
      next[key] = omitUndefinedDeep(entry);
    }
    return next as T;
  }

  return value;
}

export function assertSplitWithinLimit(lineCount: number): void {
  if (lineCount > MAX_SPLIT_CHILDREN) {
    throw new SplitTooLargeError();
  }
}

export async function commitAtomicSplit(
  input: CommitAtomicSplitInput
): Promise<CommitAtomicSplitResult> {
  assertSplitWithinLimit(input.lines.length);

  const nowIso = input.nowIso ?? new Date().toISOString();
  const transactionsCollection = input.db.collection(`organizations/${input.orgId}/transactions`);
  const parentRef = transactionsCollection.doc(input.parentTxId);
  const batch = input.db.batch();
  const childTransactionIds: string[] = [];

  for (const line of input.lines) {
    const childRef = transactionsCollection.doc();
    const childId = childRef.id;
    childTransactionIds.push(childId);

    const contact = line.contactId ? input.contactsMap.get(line.contactId) : null;
    const category = line.categoryId ? input.categoriesMap.get(line.categoryId) : null;

    const childData = omitUndefinedDeep({
      id: childId,
      parentTransactionId: input.parentTxId,
      date: input.parentDate,
      description: input.parentDescription,
      amount: line.amountCents / 100,
      category: line.categoryId ?? null,
      categoryName: category?.name ?? null,
      document: null,
      contactId: line.contactId ?? null,
      contactType: line.kind === 'donation' ? 'donor' : contact?.type ?? null,
      contactName: line.contactId ? contact?.name ?? null : null,
      transactionType: line.kind === 'donation' ? 'donation' : null,
      source: 'bank',
      bankAccountId: input.parentBankAccountId,
      notes: line.note ?? null,
      createdAt: nowIso,
      createdByUid: input.uid,
      archivedAt: null,
    });

    batch.set(childRef, childData);
  }

  batch.update(
    parentRef,
    omitUndefinedDeep({
      isSplit: true,
      linkedTransactionIds: childTransactionIds,
    })
  );

  await batch.commit();

  return {
    childTransactionIds,
    createdCount: childTransactionIds.length,
  };
}
