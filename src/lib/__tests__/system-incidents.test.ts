import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);

type SystemIncidentsModule = typeof import('../system-incidents');

class FakeTimestamp {
  static now(): { type: 'timestamp-now' } {
    return { type: 'timestamp-now' };
  }
}

function loadSystemIncidentsWithMockedFirestore(): {
  systemIncidents: SystemIncidentsModule;
  operations: string[];
  store: Map<string, Record<string, unknown>>;
  restore: () => void;
} {
  const firestoreModulePath = require.resolve('firebase/firestore');
  const systemIncidentsModulePath = require.resolve('../system-incidents.ts');
  const originalFirestoreModule = require.cache[firestoreModulePath];
  const originalSystemIncidentsModule = require.cache[systemIncidentsModulePath];
  const operations: string[] = [];
  const store = new Map<string, Record<string, unknown>>();

  const fakeFirestoreModule = {
    collection: () => ({ path: 'unused-collection' }),
    doc: (_firestore: unknown, ...segments: string[]) => ({
      path: segments.join('/'),
      id: segments[segments.length - 1],
    }),
    getDoc: async (ref: { path: string }) => {
      operations.push(`get:${ref.path}`);
      return {
        exists: () => store.has(ref.path),
        data: () => store.get(ref.path),
      };
    },
    setDoc: async (ref: { path: string }, value: Record<string, unknown>) => {
      operations.push(`set:${ref.path}`);
      store.set(ref.path, value);
    },
    updateDoc: async (ref: { path: string }, value: Record<string, unknown>) => {
      operations.push(`update:${ref.path}`);
      store.set(ref.path, {
        ...(store.get(ref.path) ?? {}),
        ...value,
      });
    },
    query: (...args: unknown[]) => ({ args }),
    where: (...args: unknown[]) => ({ args }),
    getDocs: async () => ({ docs: [] }),
    orderBy: (...args: unknown[]) => ({ args }),
    limit: (...args: unknown[]) => ({ args }),
    Timestamp: FakeTimestamp,
  };

  require.cache[firestoreModulePath] = {
    id: firestoreModulePath,
    filename: firestoreModulePath,
    loaded: true,
    exports: fakeFirestoreModule,
  } as NodeJS.Module;

  delete require.cache[systemIncidentsModulePath];

  const systemIncidents = require(systemIncidentsModulePath) as SystemIncidentsModule;

  return {
    systemIncidents,
    operations,
    store,
    restore: () => {
      if (originalFirestoreModule) {
        require.cache[firestoreModulePath] = originalFirestoreModule;
      } else {
        delete require.cache[firestoreModulePath];
      }

      if (originalSystemIncidentsModule) {
        require.cache[systemIncidentsModulePath] = originalSystemIncidentsModule;
      } else {
        delete require.cache[systemIncidentsModulePath];
      }
    },
  };
}

test('reportSystemIncident: sense orgId no intenta escriure cap incident', async () => {
  const { systemIncidents, operations, restore } = loadSystemIncidentsWithMockedFirestore();

  try {
    await systemIncidents.reportSystemIncident({
      firestore: {} as never,
      type: 'CLIENT_CRASH',
      message: 'Unexpected render error',
    });

    assert.deepEqual(operations, []);
  } finally {
    restore();
  }
});

test('reportSystemIncident: amb orgId vàlid prepara i crea l incident', async () => {
  const { systemIncidents, operations, store, restore } = loadSystemIncidentsWithMockedFirestore();

  try {
    await systemIncidents.reportSystemIncident({
      firestore: {} as never,
      type: 'INVARIANT_BROKEN',
      message: 'Invariant broken',
      orgId: ' org-123 ',
      orgSlug: ' demo-slug ',
      route: '/fiscalitat',
      meta: { foo: 'bar' },
    });

    assert.equal(operations.length, 2);
    assert.match(operations[0] ?? '', /^get:systemIncidents\//);
    assert.match(operations[1] ?? '', /^set:systemIncidents\//);
    assert.equal(store.size, 1);

    const [[path, incident]] = Array.from(store.entries());
    assert.match(path, /^systemIncidents\//);
    assert.equal(incident.orgId, 'org-123');
    assert.equal(incident.orgSlug, 'demo-slug');
    assert.equal(incident.status, 'OPEN');
  } finally {
    restore();
  }
});
