import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runWeeklyProductUpdateJob,
  type PublishProductUpdateRequest,
} from '@/lib/product-updates/weekly-product-update-runner';

function buildCommit(overrides: Partial<{
  sha: string;
  message: string;
  committedAt: string;
  files: string[];
  url: string;
  areas: string[];
}> = {}) {
  return {
    sha: overrides.sha ?? 'abc123',
    message: overrides.message ?? 'feat: nou resum del dashboard',
    committedAt: overrides.committedAt ?? '2026-04-01T10:00:00.000Z',
    files: overrides.files ?? ['src/app/dashboard/page.tsx'],
    url: overrides.url ?? 'https://github.com/raulvico1975/summa-social/commit/abc123',
    areas: overrides.areas ?? ['dashboard'],
  };
}

function buildLogger() {
  const infoEvents: Array<{ event: string; payload: Record<string, unknown> }> = [];
  const errorEvents: Array<{ event: string; payload: Record<string, unknown> }> = [];

  return {
    infoEvents,
    errorEvents,
    logger: {
      info: (event: string, payload: Record<string, unknown>) => {
        infoEvents.push({ event, payload });
      },
      error: (event: string, payload: Record<string, unknown>) => {
        errorEvents.push({ event, payload });
      },
    },
  };
}

test('runWeeklyProductUpdateJob fa no-op si no hi ha commits rellevants', async () => {
  let generateCalled = false;
  let publishCalled = false;

  const result = await runWeeklyProductUpdateJob({
    now: () => new Date('2026-04-06T06:00:00.000Z'),
    listRelevantCommits: async () => [],
    hasExistingExternalId: async () => false,
    generateContent: async () => {
      generateCalled = true;
      throw new Error('should not generate');
    },
    publishProductUpdate: async () => {
      publishCalled = true;
      return { status: 'success' };
    },
  });

  assert.deepEqual(result, {
    status: 'no_changes',
    externalId: 'weekly-product-update-2026-03-30_2026-04-05',
    relevantCommitCount: 0,
  });
  assert.equal(generateCalled, false);
  assert.equal(publishCalled, false);
});

test('runWeeklyProductUpdateJob publica una sola peça setmanal quan hi ha canvis', async () => {
  let publishedPayload: PublishProductUpdateRequest | null = null;

  const result = await runWeeklyProductUpdateJob({
    now: () => new Date('2026-04-06T06:00:00.000Z'),
    listRelevantCommits: async () => [
      buildCommit(),
      buildCommit({
        sha: 'def456',
        message: 'fix: millor context en projectes',
        files: ['src/app/projectes/page.tsx'],
        areas: ['projectes'],
      }),
    ],
    hasExistingExternalId: async () => false,
    generateContent: async () => ({
      contentLong: '- Hem millorat la claredat del resum setmanal.\n- Els canvis es noten en l’ús del dia a dia.',
      web: {
        excerpt: 'Millores setmanals per treballar amb més claredat.',
        content: '- Resum web.\n- Detall web.',
      },
      locales: {
        es: {
          title: 'Mejoras semanales',
          description: 'Cambios útiles de la semana.',
          contentLong: '- Resumen.\n- Detalle.',
          web: {
            title: 'Mejoras semanales',
            excerpt: 'Cambios útiles de la semana.',
            content: '- Resumen web.\n- Detalle web.',
          },
        },
      },
    }),
    publishProductUpdate: async (payload) => {
      publishedPayload = payload;
      return { status: 'success' };
    },
  });

  assert.equal(result.status, 'success');
  assert.equal(result.relevantCommitCount, 2);
  assert.ok(publishedPayload);
  const payload = publishedPayload as PublishProductUpdateRequest;
  assert.equal(payload.externalId, 'weekly-product-update-2026-03-30_2026-04-05');
  assert.equal(payload.locale, 'ca');
  assert.equal(payload.web?.enabled, true);
  assert.equal(payload.isActive, true);
});

test('runWeeklyProductUpdateJob tracta com a duplicat una setmana ja publicada', async () => {
  let publishCalled = false;

  const result = await runWeeklyProductUpdateJob({
    now: () => new Date('2026-04-06T06:00:00.000Z'),
    listRelevantCommits: async () => [buildCommit()],
    hasExistingExternalId: async () => true,
    generateContent: async () => {
      throw new Error('should not generate');
    },
    publishProductUpdate: async () => {
      publishCalled = true;
      return { status: 'success' };
    },
  });

  assert.deepEqual(result, {
    status: 'duplicate',
    externalId: 'weekly-product-update-2026-03-30_2026-04-05',
    relevantCommitCount: 1,
  });
  assert.equal(publishCalled, false);
});

test('runWeeklyProductUpdateJob tracta com a segur un duplicate retornat per publish', async () => {
  const result = await runWeeklyProductUpdateJob({
    now: () => new Date('2026-04-06T06:00:00.000Z'),
    listRelevantCommits: async () => [buildCommit()],
    hasExistingExternalId: async () => false,
    generateContent: async () => ({
      contentLong: 'Contingut',
      web: {
        excerpt: 'Extracte',
        content: 'Contingut web',
      },
    }),
    publishProductUpdate: async () => ({ status: 'duplicate' }),
  });

  assert.equal(result.status, 'duplicate');
});

test('runWeeklyProductUpdateJob registra error controlat si GitHub falla', async () => {
  const { errorEvents, logger } = buildLogger();

  await assert.rejects(
    () =>
      runWeeklyProductUpdateJob({
        now: () => new Date('2026-04-06T06:00:00.000Z'),
        listRelevantCommits: async () => {
          throw new Error('GitHub request failed');
        },
        hasExistingExternalId: async () => false,
        generateContent: async () => ({
          contentLong: 'Contingut',
        }),
        publishProductUpdate: async () => ({ status: 'success' }),
        logger,
      }),
    /GitHub request failed/
  );

  assert.equal(errorEvents.at(-1)?.event, 'weekly_product_updates.error');
  assert.equal(errorEvents.at(-1)?.payload.errorMessage, 'GitHub request failed');
});

test('runWeeklyProductUpdateJob registra error controlat si la IA falla', async () => {
  const { errorEvents, logger } = buildLogger();

  await assert.rejects(
    () =>
      runWeeklyProductUpdateJob({
        now: () => new Date('2026-04-06T06:00:00.000Z'),
        listRelevantCommits: async () => [buildCommit()],
        hasExistingExternalId: async () => false,
        generateContent: async () => {
          throw new Error('AI route failed');
        },
        publishProductUpdate: async () => ({ status: 'success' }),
        logger,
      }),
    /AI route failed/
  );

  assert.equal(errorEvents.at(-1)?.event, 'weekly_product_updates.error');
  assert.equal(errorEvents.at(-1)?.payload.errorMessage, 'AI route failed');
});

test('runWeeklyProductUpdateJob registra error controlat si publish falla', async () => {
  const { errorEvents, logger } = buildLogger();

  await assert.rejects(
    () =>
      runWeeklyProductUpdateJob({
        now: () => new Date('2026-04-06T06:00:00.000Z'),
        listRelevantCommits: async () => [buildCommit()],
        hasExistingExternalId: async () => false,
        generateContent: async () => ({
          contentLong: 'Contingut',
          web: {
            excerpt: 'Extracte',
            content: 'Contingut web',
          },
        }),
        publishProductUpdate: async () => ({
          status: 'error',
          errorMessage: 'publish failed',
        }),
        logger,
      }),
    /publish failed/
  );

  assert.equal(errorEvents.at(-1)?.event, 'weekly_product_updates.error');
  assert.equal(errorEvents.at(-1)?.payload.errorMessage, 'publish failed');
});
