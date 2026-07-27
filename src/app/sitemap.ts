import type { MetadataRoute } from 'next';
import { PUBLIC_LOCALES, type PublicLocale } from '@/lib/public-locale';
import { listBlogPosts } from '@/lib/blog/firestore';
import { listPublicProductUpdates } from '@/lib/product-updates/public';
import { getPublicLandingSitemapEntries } from '@/lib/public-landings';

const BASE_URL = 'https://summasocial.app';
const CONTENT_LOCALES: PublicLocale[] = ['ca', 'es'];
const PUBLIC_RESOURCE_ROUTES: Array<{ locale: PublicLocale; path: string }> = [
  { locale: 'ca', path: '/recursos/plantilla-conciliacio-bancaria' },
  { locale: 'es', path: '/recursos/plantilla-conciliacion-bancaria' },
];
const PUBLIC_STATIC_ROUTES: Array<{
  path: string;
  locales: PublicLocale[];
  changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: number;
}> = [
  { path: '', locales: PUBLIC_LOCALES, changeFrequency: 'weekly', priority: 1 },
  { path: '/funcionalitats', locales: PUBLIC_LOCALES, changeFrequency: 'monthly', priority: 0.8 },
  { path: '/preus', locales: PUBLIC_LOCALES, changeFrequency: 'monthly', priority: 0.8 },
  { path: '/qui-som', locales: PUBLIC_LOCALES, changeFrequency: 'monthly', priority: 0.6 },
  { path: '/contact', locales: PUBLIC_LOCALES, changeFrequency: 'yearly', priority: 0.5 },
  { path: '/privacy', locales: PUBLIC_LOCALES, changeFrequency: 'yearly', priority: 0.2 },
  { path: '/novetats', locales: CONTENT_LOCALES, changeFrequency: 'daily', priority: 0.7 },
  { path: '/blog', locales: CONTENT_LOCALES, changeFrequency: 'weekly', priority: 0.75 },
  { path: '/gestio-economica-ong', locales: CONTENT_LOCALES, changeFrequency: 'monthly', priority: 0.85 },
  { path: '/casos/flores-de-kiskeya', locales: CONTENT_LOCALES, changeFrequency: 'monthly', priority: 0.72 },
  { path: '/confianza', locales: CONTENT_LOCALES, changeFrequency: 'monthly', priority: 0.65 },
];

// Dynamic entries come from Firestore. Generate the sitemap at request time so
// a slow content backend cannot block an otherwise unrelated application build.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = PUBLIC_STATIC_ROUTES.flatMap((route) =>
    route.locales.map((locale) => ({
      url: `${BASE_URL}/${locale}${route.path}`,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    }))
  );

  const landingEntries: MetadataRoute.Sitemap = getPublicLandingSitemapEntries().map((entry) => ({
    url: `${BASE_URL}/${entry.locale}/${entry.slug}`,
    changeFrequency: 'monthly',
    priority: entry.locale === 'ca' ? 0.82 : 0.74,
  }));
  const resourceEntries: MetadataRoute.Sitemap = PUBLIC_RESOURCE_ROUTES.map((entry) => ({
    url: `${BASE_URL}/${entry.locale}${entry.path}`,
    changeFrequency: 'monthly',
    priority: 0.78,
  }));

  let updatesByLocale: Array<{
    locale: PublicLocale;
    updates: Awaited<ReturnType<typeof listPublicProductUpdates>>;
  }> = [];
  let blogPosts: Awaited<ReturnType<typeof listBlogPosts>> = [];

  try {
    const localizedUpdates = await Promise.all(
      CONTENT_LOCALES.map(async (locale) => ({
        locale,
        updates: await listPublicProductUpdates({ locale }),
      }))
    );
    updatesByLocale = localizedUpdates;
  } catch (error) {
    console.warn('[sitemap] product updates unavailable:', error);
  }

  try {
    blogPosts = await listBlogPosts();
  } catch (error) {
    console.warn('[sitemap] blog posts unavailable:', error);
  }

  const updateEntries: MetadataRoute.Sitemap = updatesByLocale.flatMap(({ locale, updates }) =>
    updates.map((update) => ({
      url: `${BASE_URL}/${locale}/novetats/${update.slug}`,
      ...(update.publishedAt ? { lastModified: new Date(update.publishedAt) } : {}),
      changeFrequency: 'monthly',
      priority: 0.6,
    }))
  );

  const localizedBlogEntries: MetadataRoute.Sitemap = blogPosts.flatMap((post) => {
    const locales: PublicLocale[] = post.baseLocale === 'es'
      ? ['es']
      : post.translations?.es
        ? ['ca', 'es']
        : ['ca'];

    return locales.map((locale) => ({
      url: `${BASE_URL}/${locale}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt || post.publishedAt),
      changeFrequency: 'monthly',
      priority: 0.65,
    }));
  });

  return [
    ...staticEntries,
    ...landingEntries,
    ...resourceEntries,
    ...updateEntries,
    ...localizedBlogEntries,
  ];
}
