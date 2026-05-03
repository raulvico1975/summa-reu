import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkRateLimit,
  clearRateLimitStateForTests,
} from '@/lib/api/rate-limit';
import { escapeHtml } from '@/lib/security/html';
import {
  isExpectedFirebaseStorageBucket,
  isOrgStoragePath,
  parseFirebaseStorageDownloadUrl,
} from '@/lib/security/storage-url';

test('rate limit blocks requests after the configured window allowance', () => {
  clearRateLimitStateForTests();

  assert.equal(checkRateLimit({ key: 'user:ai', limit: 2, windowMs: 1000, nowMs: 100 }).allowed, true);
  assert.equal(checkRateLimit({ key: 'user:ai', limit: 2, windowMs: 1000, nowMs: 200 }).allowed, true);

  const blocked = checkRateLimit({ key: 'user:ai', limit: 2, windowMs: 1000, nowMs: 300 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);

  assert.equal(checkRateLimit({ key: 'user:ai', limit: 2, windowMs: 1000, nowMs: 1200 }).allowed, true);
});

test('HTML escaping protects incident alert content from injection', () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)"> & test'),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; test'
  );
});

test('Firebase Storage URL parsing only accepts canonical download URLs', () => {
  const parsed = parseFirebaseStorageDownloadUrl(
    'https://firebasestorage.googleapis.com/v0/b/summa.appspot.com/o/organizations%2Forg-1%2FpendingDocuments%2Fdoc-1%2Fticket.png?alt=media&token=abc'
  );

  assert.deepEqual(parsed, {
    bucket: 'summa.appspot.com',
    storagePath: 'organizations/org-1/pendingDocuments/doc-1/ticket.png',
  });
  assert.equal(isOrgStoragePath(parsed?.storagePath, 'org-1'), true);
  assert.equal(isOrgStoragePath(parsed?.storagePath, 'org-2'), false);
  assert.equal(parseFirebaseStorageDownloadUrl('http://127.0.0.1:8080/private.png'), null);
});

test('Firebase Storage bucket validation requires the configured project bucket', () => {
  const previousPrivate = process.env.FIREBASE_STORAGE_BUCKET;
  const previousPublic = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  try {
    delete process.env.FIREBASE_STORAGE_BUCKET;
    delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    assert.equal(isExpectedFirebaseStorageBucket('summa.appspot.com'), false);

    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'summa.appspot.com';
    assert.equal(isExpectedFirebaseStorageBucket('summa.appspot.com'), true);
    assert.equal(isExpectedFirebaseStorageBucket('other.appspot.com'), false);
  } finally {
    if (previousPrivate === undefined) {
      delete process.env.FIREBASE_STORAGE_BUCKET;
    } else {
      process.env.FIREBASE_STORAGE_BUCKET = previousPrivate;
    }

    if (previousPublic === undefined) {
      delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    } else {
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = previousPublic;
    }
  }
});
