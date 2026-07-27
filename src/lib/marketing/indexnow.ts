import { PUBLIC_SITE_URL } from '@/lib/public-seo';

export const INDEXNOW_KEY =
  'cb445bb381aa64e98288a2c5ede1869f51565e5f374385d9fd1765d146dedfcd';
export const INDEXNOW_KEY_LOCATION = `${PUBLIC_SITE_URL}/${INDEXNOW_KEY}.txt`;
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

export interface IndexNowSubmitOptions {
  fetchFn?: typeof fetch;
  force?: boolean;
  timeoutMs?: number;
}

export interface IndexNowSubmitResult {
  status: 'submitted' | 'skipped';
  urlCount: number;
  reason?: string;
}

export function normalizeIndexNowUrls(urls: string[]): string[] {
  const normalized = new Set<string>();

  for (const value of urls) {
    const candidate = value.trim();
    if (!candidate.startsWith('/') && !candidate.startsWith(`${PUBLIC_SITE_URL}/`)) {
      continue;
    }

    try {
      const url = new URL(candidate, PUBLIC_SITE_URL);
      if (url.origin !== PUBLIC_SITE_URL || url.protocol !== 'https:') continue;
      url.hash = '';
      normalized.add(url.toString());
    } catch {
      // Ignore malformed values. The caller receives a zero-URL skip when none remain.
    }
  }

  return [...normalized].slice(0, 10_000);
}

export async function submitIndexNowUrls(
  urls: string[],
  options: IndexNowSubmitOptions = {}
): Promise<IndexNowSubmitResult> {
  if (!options.force && process.env.NODE_ENV !== 'production') {
    return { status: 'skipped', urlCount: 0, reason: 'non-production' };
  }

  if (process.env.INDEXNOW_DISABLED === '1') {
    return { status: 'skipped', urlCount: 0, reason: 'disabled' };
  }

  const urlList = normalizeIndexNowUrls(urls);
  if (urlList.length === 0) {
    return { status: 'skipped', urlCount: 0, reason: 'no-canonical-urls' };
  }

  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      host: new URL(PUBLIC_SITE_URL).hostname,
      key: INDEXNOW_KEY,
      keyLocation: INDEXNOW_KEY_LOCATION,
      urlList,
    }),
    signal: AbortSignal.timeout(options.timeoutMs ?? 8_000),
  });

  if (!response.ok) {
    throw new Error(`IndexNow ${response.status} ${response.statusText}`.trim());
  }

  return { status: 'submitted', urlCount: urlList.length };
}
