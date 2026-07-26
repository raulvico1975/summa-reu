const BOT_PATTERN =
  /bot|crawler|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|monitor|checkly|google-firebase|curl|wget|python|go-http|httpclient|scan|censys|expanse|headless|lighthouse|pagespeed|semrush|ahrefs|mj12|petal|bytespider|yandex|baiduspider|uptime|vercel|firebase/i;

const PUBLIC_PATH_PATTERN = /^\/(?:$|(?:ca|es|fr|pt|blog)(?:\/|$))/;
const ASSET_PATH_PATTERN =
  /(?:\/_next\/|\/api\/|\/__|\.(?:js|css|png|jpe?g|webp|svg|ico|woff2?|map|json|xml|txt|mp4|vtt|pdf)$)/i;

function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Data invàlida: ${value}. Format esperat: YYYY-MM-DD.`);
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Data invàlida: ${value}.`);
  }
  return parsed;
}

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value, days) {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatIsoDate(date);
}

export function buildComparisonPeriods(endDate, days) {
  if (!Number.isInteger(days) || days < 1 || days > 180) {
    throw new Error('El nombre de dies ha de ser un enter entre 1 i 180.');
  }

  const currentStart = addDays(endDate, -(days - 1));
  const previousEnd = addDays(currentStart, -1);
  const previousStart = addDays(previousEnd, -(days - 1));

  return {
    current: { startDate: currentStart, endDate },
    previous: { startDate: previousStart, endDate: previousEnd },
  };
}

export function percentChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function summarizeSearchConsoleResponse(response) {
  const row = response?.rows?.[0];
  if (!row) {
    return {
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: null,
    };
  }

  return {
    clicks: Number(row.clicks || 0),
    impressions: Number(row.impressions || 0),
    ctr: Number(row.ctr || 0),
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : null,
  };
}

export function mapSearchConsoleRows(response, dimension) {
  return (response?.rows || []).map((row) => ({
    [dimension]: row.keys?.[0] || '',
    clicks: Number(row.clicks || 0),
    impressions: Number(row.impressions || 0),
    ctr: Number(row.ctr || 0),
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : null,
  }));
}

export function summarizeHostingEntries(entries, { limit = 50_000 } = {}) {
  const uniqueIpDays = new Set();
  const uniqueIps = new Set();
  const topPages = new Map();
  let obviousBotRequests = 0;
  let publicPageRequests = 0;

  for (const entry of entries) {
    const request = entry?.httpRequest || {};
    const userAgent = String(request.userAgent || '');
    const status = Number(request.status || 0);
    let url;

    try {
      url = new URL(String(request.requestUrl || ''));
    } catch {
      continue;
    }

    if (url.hostname !== 'summasocial.app') continue;

    const isBot = BOT_PATTERN.test(userAgent);
    if (isBot) obviousBotRequests += 1;

    const isPublicDocument =
      PUBLIC_PATH_PATTERN.test(url.pathname) &&
      !ASSET_PATH_PATTERN.test(url.pathname) &&
      status > 0 &&
      status < 400;

    if (!isPublicDocument || isBot) continue;

    publicPageRequests += 1;
    const day = String(entry.timestamp || '').slice(0, 10);
    const remoteIp = String(request.remoteIp || '');
    if (day && remoteIp) uniqueIpDays.add(`${day}|${remoteIp}`);
    if (remoteIp) uniqueIps.add(remoteIp);

    const page = url.pathname.replace(/\/+$/, '') || '/';
    topPages.set(page, (topPages.get(page) || 0) + 1);
  }

  return {
    requestCount: entries.length,
    obviousBotRequests,
    publicPageRequests,
    uniqueIpDays: uniqueIpDays.size,
    uniqueIps: uniqueIps.size,
    truncated: entries.length >= limit,
    topPages: [...topPages.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([page, requests]) => ({ page, requests })),
  };
}

function formatNumber(value, maximumFractionDigits = 0) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('ca-ES', { maximumFractionDigits }).format(Number(value));
}

function formatPercent(value, maximumFractionDigits = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return `${formatNumber(Number(value) * 100, maximumFractionDigits)}%`;
}

function renderDelta(current, previous) {
  const delta = percentChange(Number(current), Number(previous));
  if (delta === null) return '—';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${formatNumber(delta, 1)}%`;
}

function renderSourceStatus(source) {
  if (source?.status === 'ok') return 'Disponible';
  return source?.reason ? `No disponible: ${source.reason}` : 'No disponible';
}

export function renderMarketingMarkdown(report) {
  const lines = [
    '# Seguiment de posicionament i visites de Summa Social',
    '',
    `Període actual: ${report.periods.current.startDate} — ${report.periods.current.endDate}`,
    `Comparació: ${report.periods.previous.startDate} — ${report.periods.previous.endDate}`,
    '',
    '## Estat de les fonts',
    '',
    `- Search Console: ${renderSourceStatus(report.searchConsole)}`,
    `- Google Analytics 4: ${renderSourceStatus(report.ga4)}`,
    `- App Hosting: ${renderSourceStatus(report.hosting)}`,
    '',
  ];

  if (report.searchConsole?.status === 'ok') {
    const current = report.searchConsole.current;
    const previous = report.searchConsole.previous;
    lines.push(
      '## Posicionament orgànic',
      '',
      '| Mètrica | Actual | Anterior | Canvi |',
      '|---|---:|---:|---:|',
      `| Clics | ${formatNumber(current.clicks)} | ${formatNumber(previous.clicks)} | ${renderDelta(current.clicks, previous.clicks)} |`,
      `| Impressions | ${formatNumber(current.impressions)} | ${formatNumber(previous.impressions)} | ${renderDelta(current.impressions, previous.impressions)} |`,
      `| CTR | ${formatPercent(current.ctr)} | ${formatPercent(previous.ctr)} | ${formatNumber((current.ctr - previous.ctr) * 100, 1)} pp |`,
      `| Posició mitjana | ${formatNumber(current.position, 1)} | ${formatNumber(previous.position, 1)} | ${current.position !== null && previous.position !== null ? `${formatNumber(previous.position - current.position, 1)} llocs` : '—'} |`,
      ''
    );
  }

  if (report.ga4?.status === 'ok') {
    const current = report.ga4.current;
    const previous = report.ga4.previous;
    lines.push(
      '## Visites i contactes',
      '',
      '| Mètrica | Actual | Anterior | Canvi |',
      '|---|---:|---:|---:|',
      `| Usuaris actius | ${formatNumber(current.activeUsers)} | ${formatNumber(previous.activeUsers)} | ${renderDelta(current.activeUsers, previous.activeUsers)} |`,
      `| Sessions | ${formatNumber(current.sessions)} | ${formatNumber(previous.sessions)} | ${renderDelta(current.sessions, previous.sessions)} |`,
      `| Pàgines vistes | ${formatNumber(current.screenPageViews)} | ${formatNumber(previous.screenPageViews)} | ${renderDelta(current.screenPageViews, previous.screenPageViews)} |`,
      `| Contactes confirmats | ${formatNumber(report.ga4.events.generate_lead || 0)} | — | — |`,
      `| Intencions de contacte | ${formatNumber(report.ga4.events.contact_intent || 0)} | — | — |`,
      ''
    );
  }

  if (report.hosting?.status === 'ok') {
    lines.push(
      '## Comprovació auxiliar del servidor',
      '',
      `- Peticions GET registrades: ${formatNumber(report.hosting.current.requestCount)}.`,
      `- Peticions de robots evidents: ${formatNumber(report.hosting.current.obviousBotRequests)}.`,
      `- Peticions de pàgina amb aparença humana: ${formatNumber(report.hosting.current.publicPageRequests)}.`,
      `- IP-dia amb aparença humana: ${formatNumber(report.hosting.current.uniqueIpDays)}.`,
      '- Aquestes xifres no són visites ni usuaris: inclouen precàrregues i robots que poden simular un navegador.',
      report.hosting.current.truncated
        ? '- ATENCIÓ: la consulta ha arribat al límit de registres i el recompte és parcial.'
        : '',
      ''
    );
  }

  lines.push(
    '## Criteri operatiu',
    '',
    '- Search Console és la font canònica per impressions, clics, CTR i posició.',
    '- GA4 és la font canònica per usuaris, sessions, pàgines i conversions.',
    '- Els logs d’App Hosting només serveixen per detectar anomalies i confirmar activitat.',
    '- No s’envien noms, correus, organitzacions ni missatges a l’analítica.',
    ''
  );

  return lines.filter((line, index, all) => line !== '' || all[index - 1] !== '').join('\n');
}
