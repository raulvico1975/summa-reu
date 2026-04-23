import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { NextRequest } from 'next/server';
import { handleClosingBundleZipPost } from '@/app/api/exports/closing-bundle-zip/handler';

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/exports/closing-bundle-zip', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function makeUserModeZip(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('moviments.xlsx', 'xlsx');
  zip.file('resum.txt', 'summary');
  return zip.generateAsync({ type: 'uint8array' });
}

test('POST /api/exports/closing-bundle-zip força mode user encara que el client enviï full', async () => {
  const previousProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'summa-social-test';
  const zipBytes = await makeUserModeZip();
  let forwardedBody: Record<string, unknown> | null = null;

  try {
    const response = await handleClosingBundleZipPost(
      makeRequest({
        orgId: 'org-1',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        mode: 'full',
      }),
      {
        verifyIdTokenFn: async () => ({ uid: 'user-1', email: 'user-1@test.com' }),
        getAdminDbFn: () => ({}) as never,
        validateUserMembershipFn: async () => ({ role: 'user' }) as never,
        requirePermissionFn: () => null,
        fetchFn: async (_url, init) => {
          forwardedBody = JSON.parse(String(init?.body));
          return new Response(Buffer.from(zipBytes), {
            status: 200,
            headers: {
              'Content-Type': 'application/zip',
              'Content-Disposition': 'attachment; filename="bundle.zip"',
            },
          });
        },
      },
    );

    assert.equal(response.status, 200);
    assert.ok(forwardedBody);
    assert.equal((forwardedBody as Record<string, unknown>).mode, 'user');

    const loadedZip = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()));
    assert.ok(loadedZip.file('moviments.xlsx'));
    assert.equal(loadedZip.file('manifest.json'), null);
    assert.equal(loadedZip.file('debug/debug.xlsx'), null);
  } finally {
    if (previousProjectId === undefined) {
      delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    } else {
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = previousProjectId;
    }
  }
});

test('cloud function exportClosingBundleZip also clamps mode to user server-side', () => {
  const source = readFileSync(
    join(process.cwd(), 'functions/src/exports/closingBundleZip.ts'),
    'utf8',
  );

  assert.match(source, /const mode: ClosingBundleMode = 'user';/m);
});
