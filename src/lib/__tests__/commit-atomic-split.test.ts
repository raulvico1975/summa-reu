import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SplitTooLargeError,
  assertSplitWithinLimit,
  commitAtomicSplit,
} from '@/lib/transactions/commit-atomic-split';
import { MAX_SPLIT_CHILDREN } from '@/lib/transactions/split-contract';

type StoredDoc = Record<string, unknown>;

class FakeDocRef {
  constructor(
    readonly path: string,
    readonly id: string
  ) {}
}

class FakeBatch {
  private readonly operations: Array<() => void> = [];

  constructor(private readonly db: FakeFirestore) {}

  set(ref: FakeDocRef, value: StoredDoc) {
    this.operations.push(() => {
      this.db.store.set(ref.path, value);
    });
  }

  update(ref: FakeDocRef, value: StoredDoc) {
    this.operations.push(() => {
      this.db.store.set(ref.path, {
        ...(this.db.store.get(ref.path) ?? {}),
        ...value,
      });
    });
  }

  async commit(): Promise<void> {
    this.db.commitAttempts += 1;
    if (this.db.failCommit) {
      throw new Error('forced commit failure');
    }

    for (const operation of this.operations) {
      operation();
    }
  }
}

class FakeCollectionRef {
  constructor(
    private readonly db: FakeFirestore,
    private readonly path: string
  ) {}

  doc(id?: string): FakeDocRef {
    const nextId = id ?? `tx-child-${++this.db.nextId}`;
    return new FakeDocRef(`${this.path}/${nextId}`, nextId);
  }
}

class FakeFirestore {
  readonly store = new Map<string, StoredDoc>();
  nextId = 0;
  failCommit = false;
  commitAttempts = 0;

  batch(): FakeBatch {
    return new FakeBatch(this);
  }

  collection(path: string): FakeCollectionRef {
    return new FakeCollectionRef(this, path);
  }
}

function buildLines(count: number) {
  return Array.from({ length: count }, (_value, index) => ({
    amountCents: 100 + index,
    kind: index % 2 === 0 ? 'donation' as const : 'nonDonation' as const,
    categoryId: index % 2 === 0 ? null : `cat-${index}`,
    contactId: index % 2 === 0 ? `contact-${index}` : null,
    note: `nota-${index}`,
  }));
}

describe('commitAtomicSplit', () => {
  it('manté el límit dur a 49 filles', () => {
    assert.equal(MAX_SPLIT_CHILDREN, 49);
    assert.doesNotThrow(() => assertSplitWithinLimit(49));
    assert.throws(() => assertSplitWithinLimit(50), SplitTooLargeError);
  });

  it('amb <=49 filles crea filles i marca el pare en una sola commit coherent', async () => {
    const db = new FakeFirestore();
    const parentPath = 'organizations/org-1/transactions/parent-1';
    db.store.set(parentPath, { id: 'parent-1', description: 'Pare original', amount: 5 });

    const result = await commitAtomicSplit({
      db: db as never,
      orgId: 'org-1',
      parentTxId: 'parent-1',
      parentDate: '2026-03-23',
      parentDescription: 'Moviment bancari',
      parentBankAccountId: 'bank-1',
      lines: buildLines(3),
      contactsMap: new Map([
        ['contact-0', { id: 'contact-0', name: 'Donant 0', type: 'donor' }],
        ['contact-2', { id: 'contact-2', name: 'Donant 2', type: 'donor' }],
      ]),
      categoriesMap: new Map([
        ['cat-1', { id: 'cat-1', name: 'Categoria 1' }],
      ]),
      uid: 'admin-1',
      nowIso: '2026-03-23T10:00:00.000Z',
    });

    assert.equal(db.commitAttempts, 1);
    assert.equal(result.createdCount, 3);
    assert.equal(result.childTransactionIds.length, 3);

    const parentDoc = db.store.get(parentPath);
    assert.equal(parentDoc?.isSplit, true);
    assert.deepEqual(parentDoc?.linkedTransactionIds, result.childTransactionIds);

    for (const childId of result.childTransactionIds) {
      const childDoc = db.store.get(`organizations/org-1/transactions/${childId}`);
      assert.equal(childDoc?.parentTransactionId, 'parent-1');
      assert.equal(childDoc?.bankAccountId, 'bank-1');
      assert.equal(childDoc?.createdAt, '2026-03-23T10:00:00.000Z');
    }
  });

  it('amb >49 filles retorna error controlat i no escriu res', async () => {
    const db = new FakeFirestore();

    await assert.rejects(
      commitAtomicSplit({
        db: db as never,
        orgId: 'org-1',
        parentTxId: 'parent-1',
        parentDate: '2026-03-23',
        parentDescription: 'Moviment bancari',
        parentBankAccountId: 'bank-1',
        lines: buildLines(MAX_SPLIT_CHILDREN + 1),
        contactsMap: new Map(),
        categoriesMap: new Map(),
        uid: 'admin-1',
      }),
      (error: unknown) => error instanceof SplitTooLargeError && error.code === 'SPLIT_TOO_LARGE'
    );

    assert.equal(db.commitAttempts, 0);
    assert.equal(db.store.size, 0);
  });

  it('si la commit falla no deixa estat parcial visible', async () => {
    const db = new FakeFirestore();
    const parentPath = 'organizations/org-1/transactions/parent-1';
    db.store.set(parentPath, { id: 'parent-1', description: 'Pare original', amount: 5 });
    db.failCommit = true;

    await assert.rejects(
      commitAtomicSplit({
        db: db as never,
        orgId: 'org-1',
        parentTxId: 'parent-1',
        parentDate: '2026-03-23',
        parentDescription: 'Moviment bancari',
        parentBankAccountId: 'bank-1',
        lines: buildLines(2),
        contactsMap: new Map(),
        categoriesMap: new Map(),
        uid: 'admin-1',
      }),
      /forced commit failure/
    );

    assert.equal(db.commitAttempts, 1);
    assert.deepEqual(db.store.get(parentPath), {
      id: 'parent-1',
      description: 'Pare original',
      amount: 5,
    });
    assert.equal(db.store.size, 1);
  });
});
