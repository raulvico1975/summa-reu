import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { handleSavedRemittanceLoadPost } from '@/app/api/remittances/in/saved-run/handler';

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/remittances/in/saved-run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer fake-token',
    },
    body: JSON.stringify(body),
  });
}

type FakeDocData = Record<string, unknown> | null;

class FakeDocSnapshot {
  constructor(private readonly dataValue: FakeDocData) {}

  get exists() {
    return this.dataValue !== null;
  }

  data() {
    return this.dataValue;
  }
}

class FakeDb {
  constructor(private readonly docs: Record<string, FakeDocData>) {}

  doc(path: string) {
    return {
      get: async () => new FakeDocSnapshot(this.docs[path] ?? null),
    };
  }
}

class FakeBucket {
  constructor(private readonly files: Record<string, string>) {}

  file(path: string) {
    return {
      exists: async () => [Object.prototype.hasOwnProperty.call(this.files, path)],
      download: async () => [Buffer.from(this.files[path] ?? '', 'utf8')],
    };
  }
}

function makeDeps(args: {
  docs: Record<string, FakeDocData>;
  files?: Record<string, string>;
}) {
  return {
    verifyAdminMembership: async () => ({
      success: true as const,
      uid: 'user-1',
      email: 'user@test.com',
      db: new FakeDb(args.docs) as any,
    }),
    getStorageBucket: () => new FakeBucket(args.files ?? {}) as any,
  };
}

test('POST /api/remittances/in/saved-run retorna l xml quan la remesa guardada és coherent amb el moviment', async () => {
  const response = await handleSavedRemittanceLoadPost(
    makeRequest({
      orgId: 'org-1',
      parentTxId: 'tx-1',
      savedRunId: 'run-1',
    }),
    makeDeps({
      docs: {
        'organizations/org-1/transactions/tx-1': {
          amount: 125,
          bankAccountId: 'bank-1',
          isRemittance: false,
        },
        'organizations/org-1/sepaCollectionRuns/run-1': {
          bankAccountId: 'bank-1',
          collectionDate: '2026-04-20',
          totalCents: 12500,
          itemCount: 4,
          messageId: 'MSG-1',
          sepaFile: {
            storagePath: 'organizations/org-1/sepaCollectionRuns/run-1/remesa.xml',
            filename: 'remesa.xml',
            messageId: 'MSG-1',
          },
        },
      },
      files: {
        'organizations/org-1/sepaCollectionRuns/run-1/remesa.xml': '<Document>pain.008</Document>',
      },
    })
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    xmlContent: '<Document>pain.008</Document>',
  });
});

test('POST /api/remittances/in/saved-run bloqueja si el moviment ja està processat com a remesa', async () => {
  const response = await handleSavedRemittanceLoadPost(
    makeRequest({
      orgId: 'org-1',
      parentTxId: 'tx-processed',
      savedRunId: 'run-1',
    }),
    makeDeps({
      docs: {
        'organizations/org-1/transactions/tx-processed': {
          amount: 125,
          bankAccountId: 'bank-1',
          isRemittance: true,
        },
      },
    })
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    success: false,
    error: 'Remesa ja processada. Cal desfer abans de tornar a processar.',
    code: 'REMITTANCE_ALREADY_PROCESSED',
  });
});

test('POST /api/remittances/in/saved-run bloqueja si el compte bancari de la remesa guardada no coincideix', async () => {
  const response = await handleSavedRemittanceLoadPost(
    makeRequest({
      orgId: 'org-1',
      parentTxId: 'tx-1',
      savedRunId: 'run-2',
    }),
    makeDeps({
      docs: {
        'organizations/org-1/transactions/tx-1': {
          amount: 125,
          bankAccountId: 'bank-1',
          isRemittance: false,
        },
        'organizations/org-1/sepaCollectionRuns/run-2': {
          bankAccountId: 'bank-2',
          collectionDate: '2026-04-20',
          totalCents: 12500,
          itemCount: 4,
          messageId: 'MSG-2',
          sepaFile: {
            storagePath: 'organizations/org-1/sepaCollectionRuns/run-2/remesa.xml',
            filename: 'remesa.xml',
            messageId: 'MSG-2',
          },
        },
      },
      files: {
        'organizations/org-1/sepaCollectionRuns/run-2/remesa.xml': '<Document>pain.008</Document>',
      },
    })
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    error: 'El compte bancari de la remesa guardada no coincideix amb el moviment bancari.',
    code: 'BANK_ACCOUNT_MISMATCH',
  });
});
