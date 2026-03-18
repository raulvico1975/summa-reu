import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

type ProcessLocksModule = typeof import('../fiscal/processLocks');

class FakeTimestamp {
  constructor(private readonly millis: number) {}

  toMillis(): number {
    return this.millis;
  }

  static now(): FakeTimestamp {
    return new FakeTimestamp(1_000);
  }

  static fromMillis(millis: number): FakeTimestamp {
    return new FakeTimestamp(millis);
  }
}

function loadProcessLocksWithMockedFirestore(): {
  processLocks: ProcessLocksModule;
  restore: () => void;
} {
  const firestoreModulePath = require.resolve('firebase/firestore');
  const processLocksModulePath = require.resolve('../fiscal/processLocks.ts');
  const originalFirestoreModule = require.cache[firestoreModulePath];
  const originalProcessLocksModule = require.cache[processLocksModulePath];
  const lockStore = new Map<string, unknown>();
  let transactionQueue = Promise.resolve();

  const fakeFirestoreModule = {
    doc: (_firestore: unknown, ...segments: string[]) => ({
      path: segments.join('/'),
    }),
    runTransaction: async (
      _firestore: unknown,
      updateFn: (transaction: {
        get: (ref: { path: string }) => Promise<{
          exists: () => boolean;
          data: () => unknown;
        }>;
        set: (ref: { path: string }, value: unknown) => void;
      }) => Promise<unknown>
    ) => {
      const previous = transactionQueue;
      let releaseQueue: (() => void) | undefined;
      transactionQueue = new Promise<void>((resolve) => {
        releaseQueue = resolve;
      });

      await previous;
      try {
        return await updateFn({
          get: async (ref) => ({
            exists: () => lockStore.has(ref.path),
            data: () => lockStore.get(ref.path),
          }),
          set: (ref, value) => {
            lockStore.set(ref.path, value);
          },
        });
      } finally {
        releaseQueue?.();
      }
    },
    deleteDoc: async (ref: { path: string }) => {
      lockStore.delete(ref.path);
    },
    Timestamp: FakeTimestamp,
  };

  require.cache[firestoreModulePath] = {
    id: firestoreModulePath,
    filename: firestoreModulePath,
    loaded: true,
    exports: fakeFirestoreModule,
  } as NodeJS.Module;

  delete require.cache[processLocksModulePath];

  const processLocks = require(processLocksModulePath) as ProcessLocksModule;

  return {
    processLocks,
    restore: () => {
      if (originalFirestoreModule) {
        require.cache[firestoreModulePath] = originalFirestoreModule;
      } else {
        delete require.cache[firestoreModulePath];
      }

      if (originalProcessLocksModule) {
        require.cache[processLocksModulePath] = originalProcessLocksModule;
      } else {
        delete require.cache[processLocksModulePath];
      }
    },
  };
}

test('simultaneous acquisitions on the same parentTxId allow only one winner', async () => {
  const { processLocks, restore } = loadProcessLocksWithMockedFirestore();

  try {
    const firestore = {} as never;
    const [firstAttempt, secondAttempt] = await Promise.all([
      processLocks.acquireProcessLock({
        firestore,
        orgId: 'org-1',
        parentTxId: 'tx-parent-1',
        operation: 'stripeSplit',
        uid: 'admin-1',
      }),
      processLocks.acquireProcessLock({
        firestore,
        orgId: 'org-1',
        parentTxId: 'tx-parent-1',
        operation: 'stripeSplit',
        uid: 'admin-2',
      }),
    ]);

    const winner = firstAttempt.ok ? firstAttempt : secondAttempt;
    const loser = firstAttempt.ok ? secondAttempt : firstAttempt;

    assert.equal(winner.ok, true);
    assert.deepEqual(loser, {
      ok: false,
      reason: 'locked_by_other',
      lockedByUid: firstAttempt.ok ? 'admin-1' : 'admin-2',
      operation: 'stripeSplit',
    });

    await processLocks.releaseProcessLock({
      firestore,
      orgId: 'org-1',
      parentTxId: 'tx-parent-1',
    });

    const retryAfterRelease = await processLocks.acquireProcessLock({
      firestore,
      orgId: 'org-1',
      parentTxId: 'tx-parent-1',
      operation: 'stripeSplit',
      uid: 'admin-3',
    });

    assert.deepEqual(retryAfterRelease, { ok: true });
  } finally {
    restore();
  }
});
