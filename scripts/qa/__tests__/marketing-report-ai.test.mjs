import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isIpv4InCidr,
  renderMarketingMarkdown,
  summarizeHostingEntries,
} from '../../marketing/report-lib.mjs';

test('OAI-SearchBot is only verified when its IP is inside an official CIDR', () => {
  assert.equal(isIpv4InCidr('104.210.140.130', '104.210.140.128/28'), true);
  assert.equal(isIpv4InCidr('104.210.140.160', '104.210.140.128/28'), false);
  assert.equal(isIpv4InCidr('invalid', '104.210.140.128/28'), false);

  const entries = [
    {
      timestamp: '2026-07-01T10:00:00Z',
      httpRequest: {
        requestUrl: 'https://summasocial.app/ca/model-182',
        userAgent: 'Mozilla/5.0 OAI-SearchBot/1.0',
        remoteIp: '104.210.140.130',
        status: 200,
      },
    },
    {
      timestamp: '2026-07-01T10:01:00Z',
      httpRequest: {
        requestUrl: 'https://summasocial.app/.env',
        userAgent: 'OAI-SearchBot',
        remoteIp: '203.0.113.10',
        status: 404,
      },
    },
    {
      timestamp: '2026-07-01T10:02:00Z',
      httpRequest: {
        requestUrl: 'https://summasocial.app/es',
        userAgent: 'ClaudeBot',
        remoteIp: '203.0.113.11',
        status: 200,
      },
    },
  ];

  const summary = summarizeHostingEntries(entries, {
    openAiSearchBotPrefixes: ['104.210.140.128/28'],
  });

  assert.deepEqual(summary.aiCrawlers, [
    {
      crawler: 'oai-searchbot',
      label: 'OAI-SearchBot',
      declaredRequests: 2,
      successfulRequests: 1,
      verifiedRequests: 1,
      uniquePaths: 2,
    },
    {
      crawler: 'claudebot',
      label: 'ClaudeBot',
      declaredRequests: 1,
      successfulRequests: 1,
      verifiedRequests: 0,
      uniquePaths: 1,
    },
  ]);
});

test('marketing Markdown clearly separates AI referrals and declared crawlers', () => {
  const report = {
    periods: {
      current: { startDate: '2026-07-01', endDate: '2026-07-28' },
      previous: { startDate: '2026-06-03', endDate: '2026-06-30' },
    },
    searchConsole: { status: 'unavailable', reason: 'test' },
    ga4: {
      status: 'ok',
      current: { activeUsers: 4, sessions: 5, screenPageViews: 7 },
      previous: { activeUsers: 2, sessions: 3, screenPageViews: 4 },
      events: {},
      aiReferrals: {
        status: 'ok',
        current: { sessions: 1, activeUsers: 1, bySource: [] },
        previous: { sessions: 0, activeUsers: 0, bySource: [] },
        topLandingPages: [
          {
            source: 'chatgpt.com',
            landingPage: '/ca',
            sessions: 1,
            activeUsers: 1,
          },
        ],
      },
    },
    hosting: {
      status: 'ok',
      openAiVerification: { status: 'ok' },
      current: {
        requestCount: 1,
        obviousBotRequests: 1,
        publicPageRequests: 0,
        uniqueIpDays: 0,
        truncated: false,
        aiCrawlers: [
          {
            crawler: 'oai-searchbot',
            label: 'OAI-SearchBot',
            declaredRequests: 1,
            successfulRequests: 1,
            verifiedRequests: 1,
            uniquePaths: 1,
          },
        ],
      },
    },
  };

  const markdown = renderMarketingMarkdown(report);
  assert.match(markdown, /Visites procedents d’assistents d’IA/);
  assert.match(markdown, /chatgpt\.com/);
  assert.match(markdown, /Rastreig declarat per assistents d’IA/);
  assert.match(markdown, /IP verificada/);
});
