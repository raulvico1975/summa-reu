#!/usr/bin/env node

import { submitIndexNowUrls } from '@/lib/marketing/indexnow';
import { PUBLIC_SITE_URL } from '@/lib/public-seo';

function parseArgs(argv: string[]) {
  const urls: string[] = [];
  let fromSitemap = argv.length === 0;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--from-sitemap') {
      fromSitemap = true;
    } else if (arg === '--url') {
      const value = argv[++index];
      if (!value) throw new Error('Falta el valor de --url');
      urls.push(value);
    } else if (arg === '--help') {
      process.stdout.write(
        [
          'Ús: npm run marketing:indexnow -- [--from-sitemap] [--url URL]',
          '',
          'Sense opcions, envia les URL canòniques del sitemap públic.',
          'La notificació és gratuïta i no implica indexació ni millor posicionament.',
          '',
        ].join('\n')
      );
      process.exit(0);
    } else {
      throw new Error(`Opció desconeguda: ${arg}`);
    }
  }

  return { urls, fromSitemap };
}

function decodeXmlText(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

export function extractSitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) =>
    decodeXmlText(match[1].trim())
  );
}

async function readSitemapUrls(): Promise<string[]> {
  const response = await fetch(`${PUBLIC_SITE_URL}/sitemap.xml`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`No s'ha pogut llegir sitemap.xml: ${response.status}`);
  }
  return extractSitemapUrls(await response.text());
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sitemapUrls = options.fromSitemap ? await readSitemapUrls() : [];
  const result = await submitIndexNowUrls([...sitemapUrls, ...options.urls], { force: true });

  if (result.status === 'submitted') {
    process.stdout.write(`IndexNow ha rebut ${result.urlCount} URL.\n`);
  } else {
    process.stdout.write(`IndexNow omès: ${result.reason ?? 'sense URL'}.\n`);
  }
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
