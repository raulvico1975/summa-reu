import assert from 'node:assert/strict';
import test from 'node:test';
import * as admin from 'firebase-admin';
import { handleMigrateProjectModulePaths } from '../../../functions/src/migrations/migrateProjectModulePaths';

if (admin.apps.length === 0) admin.initializeApp({ projectId: 'test-project' });

const request = {
  orgId: 'org-1',
  reason: 'Migració de prova autoritzada',
  idempotencyKey: 'attempt-1',
};

function fakeDb(options: {
  superAdmin?: boolean;
  destinationExists?: boolean;
  failTransactionNumber?: number;
} = {}) {
  const state = {
    sourceExists: true,
    destinationExists: options.destinationExists ?? false,
    audit: new Map<string, Record<string, unknown>>(),
  };
  const counters = { reads: 0, scans: 0, functionalWrites: 0, auditWrites: 0, transactions: 0 };
  let transactionTail: Promise<void> = Promise.resolve();

  type Ref = ReturnType<typeof makeRef>;
  function snapshot(path: string) {
    if (path.startsWith('systemSuperAdmins/')) {
      return { exists: options.superAdmin !== false, data: () => ({}) };
    }
    if (path === 'organizations/org-1') {
      return { exists: true, data: () => ({ name: 'Entitat' }) };
    }
    if (path === 'organizations/org-1/projectModule/legacy-project') {
      return {
        exists: state.sourceExists,
        data: () => state.sourceExists ? { name: 'Projecte antic', status: 'active' } : undefined,
      };
    }
    if (path === 'organizations/org-1/projectModule/_/projects/legacy-project') {
      return { exists: state.destinationExists, data: () => state.destinationExists ? { name: 'Projecte nou' } : undefined };
    }
    const audit = state.audit.get(path);
    return { exists: Boolean(audit), data: () => audit };
  }

  function makeCollection(path: string) {
    return {
      async get() {
        counters.scans += 1;
        if (path.includes('/projectResults')) {
          const prefix = `${path}/`;
          const docs = [...state.audit.entries()]
            .filter(([auditPath]) => auditPath.startsWith(prefix))
            .map(([auditPath, data]) => ({ id: auditPath.slice(prefix.length), data: () => data, ref: makeRef(auditPath) }));
          return { size: docs.length, docs };
        }
        if (path === 'organizations/org-1/projectModule') {
          return {
            size: state.sourceExists ? 1 : 0,
            docs: state.sourceExists ? [{
              id: 'legacy-project',
              data: () => ({ name: 'Projecte antic', status: 'active' }),
              ref: makeRef('organizations/org-1/projectModule/legacy-project'),
            }] : [],
          };
        }
        return { size: state.destinationExists ? 1 : 0, docs: [] };
      },
      doc(id: string) { return makeRef(`${path}/${id}`); },
    };
  }

  function makeRef(path: string) {
    return {
      path,
      async get() { counters.reads += 1; return snapshot(path); },
      collection(name: string) { return makeCollection(`${path}/${name}`); },
    };
  }

  const value = {
    doc(path: string) { return makeRef(path); },
    async runTransaction<T>(callback: (tx: {
      get(ref: Ref): Promise<ReturnType<typeof snapshot>>;
      create(ref: Ref, data: Record<string, unknown>): void;
      delete(ref: Ref): void;
      set(ref: Ref, data: Record<string, unknown>, options?: { merge: boolean }): void;
    }) => Promise<T>) {
      const previous = transactionTail;
      let releaseTransaction!: () => void;
      transactionTail = new Promise<void>((resolve) => { releaseTransaction = resolve; });
      await previous;
      counters.transactions += 1;
      const operations: Array<() => void> = [];
      try {
        const result = await callback({
          get: async (ref) => { counters.reads += 1; return snapshot(ref.path); },
          create: (ref, data) => operations.push(() => {
            if (ref.path.includes('/projectModule/_/projects/')) {
              state.destinationExists = true;
              counters.functionalWrites += 1;
            } else {
              state.audit.set(ref.path, data);
              counters.auditWrites += 1;
            }
          }),
          delete: (ref) => operations.push(() => {
            if (ref.path === 'organizations/org-1/projectModule/legacy-project') state.sourceExists = false;
            counters.functionalWrites += 1;
          }),
          set: (ref, data, merge) => operations.push(() => {
            const prior = merge?.merge ? state.audit.get(ref.path) ?? {} : {};
            state.audit.set(ref.path, { ...prior, ...data });
            counters.auditWrites += 1;
          }),
        });
        if (options.failTransactionNumber === counters.transactions) throw new Error('Injected transaction failure');
        operations.forEach((operation) => operation());
        return result;
      } finally {
        releaseTransaction();
      }
    },
  };
  return { value, counters, state };
}

test('migració projectModule denega auth absent i admin ordinari abans de scan/write', async () => {
  const noAuth = fakeDb({ superAdmin: true });
  await assert.rejects(() => handleMigrateProjectModulePaths(request, {}, { db: noAuth.value as never }));
  assert.equal(noAuth.counters.reads, 0);
  assert.equal(noAuth.counters.functionalWrites, 0);

  const ordinary = fakeDb({ superAdmin: false });
  await assert.rejects(() => handleMigrateProjectModulePaths(request, { auth: { uid: 'user-1' } }, { db: ordinary.value as never }));
  assert.equal(ordinary.counters.scans, 0);
  assert.equal(ordinary.counters.functionalWrites, 0);
  assert.equal(ordinary.counters.auditWrites, 0);
});

test('migració valida scope, és dry-run per defecte i audita sense mutar dades funcionals', async () => {
  const invalid = fakeDb({ superAdmin: true });
  await assert.rejects(() => handleMigrateProjectModulePaths({ ...request, orgId: '../all' }, { auth: { uid: 'super-1' } }, { db: invalid.value as never }));
  assert.equal(invalid.counters.reads, 0);

  const dryRun = fakeDb({ superAdmin: true });
  const result = await handleMigrateProjectModulePaths(request, { auth: { uid: 'super-1' } }, { db: dryRun.value as never });
  assert.equal(result.details[0]?.status, 'skipped');
  assert.equal(dryRun.counters.functionalWrites, 0);
  assert.equal(dryRun.counters.auditWrites, 2);
});

test('apply migra origen i destí atòmicament i registra auditoria durable', async () => {
  const apply = fakeDb({ superAdmin: true });
  const applied = await handleMigrateProjectModulePaths(
    { ...request, dryRun: false },
    { auth: { uid: 'super-1' } },
    { db: apply.value as never }
  );
  assert.equal(applied.details[0]?.status, 'migrated');
  assert.equal(apply.state.sourceExists, false);
  assert.equal(apply.state.destinationExists, true);
  assert.equal(apply.counters.functionalWrites, 2);
  assert.ok(apply.counters.auditWrites >= 3);
});

test('conflicte no sobreescriu destí ni elimina origen', async () => {
  const conflict = fakeDb({ superAdmin: true, destinationExists: true });
  const conflicted = await handleMigrateProjectModulePaths(
    { ...request, dryRun: false },
    { auth: { uid: 'super-1' } },
    { db: conflict.value as never }
  );
  assert.equal(conflicted.details[0]?.status, 'skipped');
  assert.match(conflicted.details[0]?.message ?? '', /Conflicte/);
  assert.equal(conflict.state.sourceExists, true);
  assert.equal(conflict.counters.functionalWrites, 0);
});

test('fallada de transacció fa rollback total de create/delete/audit del projecte', async () => {
  const failing = fakeDb({ superAdmin: true, failTransactionNumber: 2 });
  const result = await handleMigrateProjectModulePaths(
    { ...request, dryRun: false },
    { auth: { uid: 'super-1' } },
    { db: failing.value as never }
  );
  assert.equal(result.success, false);
  assert.equal(failing.state.sourceExists, true);
  assert.equal(failing.state.destinationExists, false);
  assert.equal(failing.counters.functionalWrites, 0);
  assert.equal([...failing.state.audit.keys()].some((path) => path.endsWith('_legacy-project')), false);
});

test('crash després de migrar reprèn des de l’auditoria per projecte sense perdre el resultat', async () => {
  const recovering = fakeDb({ superAdmin: true, failTransactionNumber: 3 });
  await assert.rejects(() => handleMigrateProjectModulePaths(
    { ...request, dryRun: false },
    { auth: { uid: 'super-1' } },
    { db: recovering.value as never, now: () => 1_000, runToken: () => 'run-first' }
  ));
  assert.equal(recovering.state.sourceExists, false);
  assert.equal(recovering.state.destinationExists, true);

  const recovered = await handleMigrateProjectModulePaths(
    { ...request, dryRun: false },
    { auth: { uid: 'super-1' } },
    { db: recovering.value as never, now: () => 1_000_000, runToken: () => 'run-resume' }
  );
  assert.equal(recovered.migrated, 1);
  assert.equal(recovered.details.filter((detail) => detail.projectId === 'legacy-project').length, 1);
  assert.equal(recovering.counters.functionalWrites, 2);
});

test('dues peticions concurrents amb la mateixa clau no sobreescriuen el resultat canònic', async () => {
  const concurrent = fakeDb({ superAdmin: true });
  const attempts = await Promise.allSettled([
    handleMigrateProjectModulePaths(request, { auth: { uid: 'super-1' } }, {
      db: concurrent.value as never,
      now: () => 5_000,
      runToken: () => 'run-a',
    }),
    handleMigrateProjectModulePaths(request, { auth: { uid: 'super-1' } }, {
      db: concurrent.value as never,
      now: () => 5_000,
      runToken: () => 'run-b',
    }),
  ]);
  assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
  assert.equal(attempts.filter((attempt) => attempt.status === 'rejected').length, 1);
  assert.equal(concurrent.counters.functionalWrites, 0);
  const rootAudit = [...concurrent.state.audit.entries()].find(([path]) => path === 'adminAuditLogs/project-module-migration_attempt-1')?.[1];
  assert.equal(rootAudit?.status, 'completed');
});

test('mateixa clau i payload reprodueix resultat; payload diferent entra en conflicte', async () => {
  const replayDb = fakeDb({ superAdmin: true });
  const first = await handleMigrateProjectModulePaths(request, { auth: { uid: 'super-1' } }, { db: replayDb.value as never });
  const writesAfterFirst = replayDb.counters.auditWrites;
  const replay = await handleMigrateProjectModulePaths(request, { auth: { uid: 'super-1' } }, { db: replayDb.value as never });
  assert.deepEqual(replay, first);
  assert.equal(replayDb.counters.auditWrites, writesAfterFirst);
  await assert.rejects(() => handleMigrateProjectModulePaths(
    { ...request, reason: 'Un altre motiu' },
    { auth: { uid: 'super-1' } },
    { db: replayDb.value as never }
  ));
});
