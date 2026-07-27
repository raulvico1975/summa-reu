#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildComparisonPeriods,
  mapSearchConsoleRows,
  renderMarketingMarkdown,
  summarizeHostingEntries,
  summarizeSearchConsoleResponse,
} from './report-lib.mjs';

const DEFAULT_SITE_URL = 'sc-domain:summasocial.app';
const LOG_LIMIT = 50_000;
const OPENAI_SEARCHBOT_IP_RANGES_URL = 'https://openai.com/searchbot.json';
const AI_REFERRAL_SOURCE_PARTS = [
  'chatgpt.com',
  'chat.openai.com',
  'perplexity.ai',
  'claude.ai',
  'gemini.google.com',
  'copilot.microsoft.com',
  'chat.mistral.ai',
  'poe.com',
];

function parseArgs(argv) {
  const options = {
    days: 28,
    endDate: null,
    outDir: 'tmp/marketing',
    write: true,
    includeHosting: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--days') options.days = Number(argv[++index]);
    else if (arg === '--end-date') options.endDate = argv[++index];
    else if (arg === '--out-dir') options.outDir = argv[++index];
    else if (arg === '--no-write') options.write = false;
    else if (arg === '--no-hosting') options.includeHosting = false;
    else if (arg === '--help') {
      process.stdout.write(
        [
          'Ús: npm run marketing:report -- [opcions]',
          '',
          '  --days N             Període actual i anterior (1-180; per defecte 28)',
          '  --end-date YYYY-MM-DD  Últim dia del període (per defecte fa 2 dies)',
          '  --out-dir PATH       Carpeta de sortida (per defecte tmp/marketing)',
          '  --no-write           Mostra Markdown sense escriure artefactes',
          '  --no-hosting         Omet la consulta de logs d’App Hosting',
          '',
          'Variables opcionals:',
          '  GOOGLE_MARKETING_ACCESS_TOKEN  OAuth amb webmasters.readonly i analytics.readonly',
          '  SEARCH_CONSOLE_SITE_URL        Per defecte sc-domain:summasocial.app',
          '  GA4_PROPERTY_ID                ID numèric de la propietat GA4',
          '',
        ].join('\n')
      );
      process.exit(0);
    } else {
      throw new Error(`Opció desconeguda: ${arg}`);
    }
  }

  if (!options.endDate) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 2);
    options.endDate = date.toISOString().slice(0, 10);
  }

  return options;
}

async function fetchJson(url, init, sourceName) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.error?.message || `${response.status} ${response.statusText}`;
    throw new Error(`${sourceName}: ${message}`);
  }
  return payload;
}

async function querySearchConsole(accessToken, siteUrl, period, dimensions = []) {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  return fetchJson(
    endpoint,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: period.startDate,
        endDate: period.endDate,
        dimensions,
        type: 'web',
        aggregationType: dimensions.includes('page') ? 'auto' : 'byProperty',
        dataState: 'final',
        rowLimit: dimensions.length ? 10 : 1,
      }),
    },
    'Search Console'
  );
}

async function readSearchConsole(accessToken, siteUrl, periods) {
  if (!accessToken) {
    return { status: 'unavailable', reason: 'falta GOOGLE_MARKETING_ACCESS_TOKEN' };
  }

  try {
    const [current, previous, queryRows, pageRows] = await Promise.all([
      querySearchConsole(accessToken, siteUrl, periods.current),
      querySearchConsole(accessToken, siteUrl, periods.previous),
      querySearchConsole(accessToken, siteUrl, periods.current, ['query']),
      querySearchConsole(accessToken, siteUrl, periods.current, ['page']),
    ]);

    return {
      status: 'ok',
      current: summarizeSearchConsoleResponse(current),
      previous: summarizeSearchConsoleResponse(previous),
      topQueries: mapSearchConsoleRows(queryRows, 'query'),
      topPages: mapSearchConsoleRows(pageRows, 'page'),
    };
  } catch (error) {
    return { status: 'unavailable', reason: error instanceof Error ? error.message : String(error) };
  }
}

function mapGa4MetricRow(response) {
  const headers = (response?.metricHeaders || []).map((header) => header.name);
  const values = response?.rows?.[0]?.metricValues || [];
  return Object.fromEntries(
    headers.map((name, index) => [name, Number(values[index]?.value || 0)])
  );
}

function mapGa4AiReferralRows(response) {
  return (response?.rows || []).map((row) => ({
    source: row.dimensionValues?.[0]?.value || '(desconeguda)',
    landingPage: row.dimensionValues?.[1]?.value || '/',
    sessions: Number(row.metricValues?.[0]?.value || 0),
    activeUsers: Number(row.metricValues?.[1]?.value || 0),
  }));
}

function buildAiReferralFilter() {
  return {
    orGroup: {
      expressions: AI_REFERRAL_SOURCE_PARTS.map((value) => ({
        filter: {
          fieldName: 'sessionSource',
          stringFilter: {
            matchType: 'CONTAINS',
            value,
            caseSensitive: false,
          },
        },
      })),
    },
  };
}

async function queryGa4(accessToken, propertyId, body) {
  return fetchJson(
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    'Google Analytics 4'
  );
}

async function readGa4(accessToken, propertyId, periods) {
  if (!propertyId) return { status: 'unavailable', reason: 'falta GA4_PROPERTY_ID' };
  if (!accessToken) {
    return { status: 'unavailable', reason: 'falta GOOGLE_MARKETING_ACCESS_TOKEN' };
  }

  const metrics = ['activeUsers', 'sessions', 'screenPageViews'].map((name) => ({ name }));

  try {
    const [currentResponse, previousResponse, eventResponse, landingResponse] = await Promise.all([
      queryGa4(accessToken, propertyId, {
        dateRanges: [periods.current],
        metrics,
      }),
      queryGa4(accessToken, propertyId, {
        dateRanges: [periods.previous],
        metrics,
      }),
      queryGa4(accessToken, propertyId, {
        dateRanges: [periods.current],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            inListFilter: { values: ['generate_lead', 'contact_intent'] },
          },
        },
      }),
      queryGa4(accessToken, propertyId, {
        dateRanges: [periods.current],
        dimensions: [{ name: 'landingPagePlusQueryString' }, { name: 'sessionSourceMedium' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),
    ]);

    const events = Object.fromEntries(
      (eventResponse.rows || []).map((row) => [
        row.dimensionValues?.[0]?.value || 'unknown',
        Number(row.metricValues?.[0]?.value || 0),
      ])
    );
    const landingPages = (landingResponse.rows || []).map((row) => ({
      landingPage: row.dimensionValues?.[0]?.value || '',
      sourceMedium: row.dimensionValues?.[1]?.value || '',
      sessions: Number(row.metricValues?.[0]?.value || 0),
      activeUsers: Number(row.metricValues?.[1]?.value || 0),
    }));
    let aiReferrals;
    try {
      const [currentAiSummary, previousAiSummary, currentAiDetail] = await Promise.all([
        queryGa4(accessToken, propertyId, {
          dateRanges: [periods.current],
          metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
          dimensionFilter: buildAiReferralFilter(),
        }),
        queryGa4(accessToken, propertyId, {
          dateRanges: [periods.previous],
          metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
          dimensionFilter: buildAiReferralFilter(),
        }),
        queryGa4(accessToken, propertyId, {
          dateRanges: [periods.current],
          dimensions: [{ name: 'sessionSource' }, { name: 'landingPagePlusQueryString' }],
          metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
          dimensionFilter: buildAiReferralFilter(),
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 100,
        }),
      ]);

      aiReferrals = {
        status: 'ok',
        current: mapGa4MetricRow(currentAiSummary),
        previous: mapGa4MetricRow(previousAiSummary),
        topLandingPages: mapGa4AiReferralRows(currentAiDetail).slice(0, 10),
      };
    } catch (error) {
      aiReferrals = {
        status: 'unavailable',
        reason: error instanceof Error ? error.message : String(error),
      };
    }

    return {
      status: 'ok',
      current: mapGa4MetricRow(currentResponse),
      previous: mapGa4MetricRow(previousResponse),
      events,
      landingPages,
      aiReferrals,
    };
  } catch (error) {
    return { status: 'unavailable', reason: error instanceof Error ? error.message : String(error) };
  }
}

function queryHostingPeriodEntries(period) {
  const exclusiveEnd = new Date(`${period.endDate}T00:00:00Z`);
  exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
  const endTimestamp = exclusiveEnd.toISOString();
  const startTimestamp = `${period.startDate}T00:00:00Z`;
  const filter = [
    'resource.type="firebaseapphosting.googleapis.com/Backend"',
    'logName="projects/summa-social/logs/firebaseapphosting.googleapis.com%2Frequests"',
    'httpRequest.requestUrl:"https://summasocial.app/"',
    'httpRequest.requestMethod="GET"',
    `timestamp>="${startTimestamp}"`,
    `timestamp<"${endTimestamp}"`,
  ].join(' AND ');

  const output = execFileSync(
    'gcloud',
    [
      'logging',
      'read',
      filter,
      '--project=summa-social',
      `--limit=${LOG_LIMIT}`,
      '--order=asc',
      '--format=json(timestamp,httpRequest.remoteIp,httpRequest.requestUrl,httpRequest.userAgent,httpRequest.status)',
    ],
    {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 120_000,
    }
  );

  return JSON.parse(output || '[]');
}

async function readOpenAiSearchBotPrefixes() {
  try {
    const payload = await fetchJson(
      OPENAI_SEARCHBOT_IP_RANGES_URL,
      {},
      'Rangs IP oficials d’OAI-SearchBot'
    );
    const prefixes = (payload?.prefixes || [])
      .map((entry) => entry?.ipv4Prefix)
      .filter((value) => typeof value === 'string' && value.includes('/'));

    if (prefixes.length === 0) {
      throw new Error('la resposta oficial no conté rangs IPv4');
    }

    return {
      status: 'ok',
      source: OPENAI_SEARCHBOT_IP_RANGES_URL,
      creationTime: payload.creationTime || null,
      prefixes,
    };
  } catch (error) {
    return {
      status: 'unavailable',
      source: OPENAI_SEARCHBOT_IP_RANGES_URL,
      reason: error instanceof Error ? error.message : String(error),
      prefixes: [],
    };
  }
}

async function readHosting(periods, includeHosting) {
  if (!includeHosting) return { status: 'unavailable', reason: 'omès amb --no-hosting' };

  try {
    const openAiVerification = await readOpenAiSearchBotPrefixes();
    const currentEntries = queryHostingPeriodEntries(periods.current);
    const previousEntries = queryHostingPeriodEntries(periods.previous);
    const summarizeOptions = {
      limit: LOG_LIMIT,
      openAiSearchBotPrefixes: openAiVerification.prefixes,
    };

    return {
      status: 'ok',
      openAiVerification: {
        status: openAiVerification.status,
        source: openAiVerification.source,
        creationTime: openAiVerification.creationTime ?? null,
        reason: openAiVerification.reason ?? null,
      },
      current: summarizeHostingEntries(currentEntries, summarizeOptions),
      previous: summarizeHostingEntries(previousEntries, summarizeOptions),
    };
  } catch (error) {
    return { status: 'unavailable', reason: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const periods = buildComparisonPeriods(options.endDate, options.days);
  const accessToken = process.env.GOOGLE_MARKETING_ACCESS_TOKEN || '';
  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL || DEFAULT_SITE_URL;
  const propertyId = process.env.GA4_PROPERTY_ID || '';

  const [searchConsole, ga4, hosting] = await Promise.all([
    readSearchConsole(accessToken, siteUrl, periods),
    readGa4(accessToken, propertyId, periods),
    readHosting(periods, options.includeHosting),
  ]);
  const report = {
    generatedAt: new Date().toISOString(),
    periods,
    searchConsole,
    ga4,
    hosting,
  };
  const markdown = renderMarketingMarkdown(report);

  if (options.write) {
    const outDir = resolve(options.outDir);
    mkdirSync(outDir, { recursive: true });
    const baseName = `summa-marketing-${periods.current.endDate}-${options.days}d`;
    writeFileSync(resolve(outDir, `${baseName}.json`), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(resolve(outDir, `${baseName}.md`), `${markdown}\n`);
    process.stdout.write(`Informe escrit a ${resolve(outDir, `${baseName}.md`)}\n`);
  } else {
    process.stdout.write(`${markdown}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
