import type { MetadataRoute } from 'next';
import { PUBLIC_LOCALES } from '@/lib/public-locale';
import { listPublicProductUpdates } from '@/lib/product-updates/public';

const BASE_URL = 'https://summasocial.app';
const PUBLIC_BASE_PATHS = ['', '/funcionalitats', '/qui-som', '/contact', '/privacy', '/novetats'] as const;

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = PUBLIC_LOCALES.flatMap((locale) =>
    PUBLIC_BASE_PATHS.map((path) => ({
      url: `${BASE_URL}/${locale}${path}`,
      lastModified: now,
      changeFrequency: path === '' ? 'weekly' : path === '/novetats' ? 'daily' : 'monthly',
      priority: path === '' ? 1 : path === '/novetats' ? 0.8 : 0.7,
    }))
  );

  const blogEntry: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/blog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];

  let updates: Awaited<ReturnType<typeof listPublicProductUpdates>> = [];

  try {
    updates = await listPublicProductUpdates();
  } catch (error) {
    console.warn('[sitemap] product updates unavailable:', error);
  }

  const updateEntries: MetadataRoute.Sitemap = PUBLIC_LOCALES.flatMap((locale) =>
    updates.map((update) => ({
      url: `${BASE_URL}/${locale}/novetats/${update.slug}`,
      lastModified: update.publishedAt ? new Date(update.publishedAt) : now,
      changeFrequency: 'monthly',
      priority: 0.6,
    }))
  );

  return [...staticEntries, ...blogEntry, ...updateEntries];
}
