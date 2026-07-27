import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
  normalizeIndexNowUrls,
  submitIndexNowUrls,
} from '@/lib/marketing/indexnow';

test('IndexNow only accepts canonical Summa Social URLs', () => {
  assert.deepEqual(
    normalizeIndexNowUrls([
      '/ca',
      'https://summasocial.app/ca#section',
      'https://summasocial.app/es/blog/prova',
      'https://example.com/copied',
      'not a valid absolute URL',
    ]),
    [
      'https://summasocial.app/ca',
      'https://summasocial.app/es/blog/prova',
    ]
  );
});

test('IndexNow submission uses the public root key and deduplicated URLs', async () => {
  let capturedUrl = '';
  let capturedBody: Record<string, unknown> | null = null;
  const fetchFn: typeof fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
    return new Response(null, { status: 200 });
  };

  const result = await submitIndexNowUrls(
    ['https://summasocial.app/ca', 'https://summasocial.app/ca'],
    { fetchFn, force: true }
  );

  assert.deepEqual(result, { status: 'submitted', urlCount: 1 });
  assert.equal(capturedUrl, INDEXNOW_ENDPOINT);
  assert.deepEqual(capturedBody, {
    host: 'summasocial.app',
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList: ['https://summasocial.app/ca'],
  });
  assert.equal(
    readFileSync(`public/${INDEXNOW_KEY}.txt`, 'utf8').trim(),
    INDEXNOW_KEY
  );
});
