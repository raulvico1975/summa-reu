// src/app/public/[lang]/novetats/[slug]/page.tsx
// Pàgina de detall d'una novetat
// Llegeix server-side de Firestore via Admin SDK
// Render text estructurat (NO HTML)

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  isValidPublicLocale,
  generatePublicPageMetadata,
  type PublicLocale,
} from '@/lib/public-locale';
import { getPublicProductUpdateBySlug } from '@/lib/product-updates/public';
import { getPublicTranslations } from '@/i18n/public';
import { renderStructuredText } from '@/lib/render-structured-text';

interface PageProps {
  params: Promise<{ lang: string; slug: string }>;
}

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isValidPublicLocale(lang)) return {};

  const update = await getPublicProductUpdateBySlug(slug);
  if (!update) return {};

  const seoMeta = generatePublicPageMetadata(lang, `/novetats/${slug}`);

  return {
    title: `${update.title} | Summa Social`,
    description: update.excerpt || update.title,
    ...seoMeta,
  };
}

export default async function NovetatsDetailPage({ params }: PageProps) {
  const { lang, slug } = await params;

  if (!isValidPublicLocale(lang)) {
    notFound();
  }

  const locale = lang as PublicLocale;
  const t = getPublicTranslations(locale);
  const update = await getPublicProductUpdateBySlug(slug);

  if (!update) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/${locale}/novetats`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t.updates.back}
            </Link>
          </Button>
        </div>
      </div>

      <article className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-4">{update.title}</h1>
          {update.publishedAt && (
            <p className="text-sm text-muted-foreground">
              {t.updates.publishedAt} {update.publishedAt}
            </p>
          )}
        </header>

        {update.excerpt && (
          <p className="text-lg text-muted-foreground mb-6 border-l-4 border-primary/20 pl-4">
            {update.excerpt}
          </p>
        )}

        {update.content && (
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            {renderStructuredText(update.content)}
          </div>
        )}
      </article>

      {/* Footer */}
      <footer className="border-t py-6 px-4 mt-auto">
        <div className="max-w-lg mx-auto flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <Link href={`/${locale}/privacy`} className="hover:underline">
            {t.common.privacy}
          </Link>
          <span>·</span>
          <Link href={`/${locale}/contact`} className="hover:underline">
            {t.common.contact}
          </Link>
        </div>
      </footer>
    </main>
  );
}
