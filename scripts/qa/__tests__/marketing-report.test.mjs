import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildComparisonPeriods,
  mapSearchConsoleRows,
  percentChange,
  summarizeHostingEntries,
  summarizeSearchConsoleResponse,
} from '../../marketing/report-lib.mjs';

test('buildComparisonPeriods creates two adjacent inclusive ranges', () => {
  assert.deepEqual(buildComparisonPeriods('2026-07-24', 7), {
    current: { startDate: '2026-07-18', endDate: '2026-07-24' },
    previous: { startDate: '2026-07-11', endDate: '2026-07-17' },
  });
});

test('Search Console helpers preserve clicks, impressions, CTR and position', () => {
  const response = {
    rows: [
      {
        keys: ['certificados de donacion'],
        clicks: 3,
        impressions: 31,
        ctr: 3 / 31,
        position: 7,
      },
    ],
  };

  assert.deepEqual(summarizeSearchConsoleResponse(response), {
    clicks: 3,
    impressions: 31,
    ctr: 3 / 31,
    position: 7,
  });
  assert.deepEqual(mapSearchConsoleRows(response, 'query'), [
    {
      query: 'certificados de donacion',
      clicks: 3,
      impressions: 31,
      ctr: 3 / 31,
      position: 7,
    },
  ]);
  assert.ok(Math.abs(percentChange(31, 20) - 55) < Number.EPSILON * 100);
});

test('hosting summary excludes obvious bots, assets and non-public routes', () => {
  const entries = [
    {
      timestamp: '2026-07-24T10:00:00Z',
      httpRequest: {
        remoteIp: '203.0.113.10',
        requestUrl: 'https://summasocial.app/ca',
        userAgent: 'Mozilla/5.0 Chrome/140',
        status: 200,
      },
    },
    {
      timestamp: '2026-07-24T10:01:00Z',
      httpRequest: {
        remoteIp: '203.0.113.10',
        requestUrl: 'https://summasocial.app/ca/contact?plan=initial',
        userAgent: 'Mozilla/5.0 Chrome/140',
        status: 200,
      },
    },
    {
      timestamp: '2026-07-24T10:02:00Z',
      httpRequest: {
        remoteIp: '203.0.113.11',
        requestUrl: 'https://summasocial.app/robots.txt',
        userAgent: 'Googlebot/2.1',
        status: 200,
      },
    },
    {
      timestamp: '2026-07-24T10:03:00Z',
      httpRequest: {
        remoteIp: '203.0.113.12',
        requestUrl: 'https://summasocial.app/_next/static/app.js',
        userAgent: 'Mozilla/5.0 Chrome/140',
        status: 200,
      },
    },
    {
      timestamp: '2026-07-24T10:04:00Z',
      httpRequest: {
        remoteIp: '203.0.113.13',
        requestUrl: 'https://summasocial.app/login',
        userAgent: 'Mozilla/5.0 Chrome/140',
        status: 200,
      },
    },
  ];

  const summary = summarizeHostingEntries(entries);
  assert.equal(summary.requestCount, 5);
  assert.equal(summary.obviousBotRequests, 1);
  assert.equal(summary.publicPageRequests, 2);
  assert.equal(summary.uniqueIpDays, 1);
  assert.equal(summary.uniqueIps, 1);
  assert.deepEqual(summary.topPages, [
    { page: '/ca', requests: 1 },
    { page: '/ca/contact', requests: 1 },
  ]);
  assert.equal(JSON.stringify(summary).includes('203.0.113.10'), false);
});
