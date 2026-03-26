// src/app/public/[lang]/novetats/page.tsx
// Pàgina pública de novetats del producte
// Llegeix server-side de Firestore via Admin SDK

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PUBLIC_LOCALES,
  isValidPublicLocale,
  generatePublicPageMetadata,
  type PublicLocale,
} from '@/lib/public-locale';
import { listPublicProductUpdates } from '@/lib/product-updates/public';
import { getPublicTranslations } from '@/i18n/public';

interface PageProps {
  params: Promise<{ lang: string }>;
}

export function generateStaticParams() {
  return PUBLIC_LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isValidPublicLocale(lang)) return {};

  const t = getPublicTranslations(lang);
  const seoMeta = generatePublicPageMetadata(lang, '/novetats');

  return {
    title: t.updates.metaTitle,
    description: t.updates.metaDescription,
    ...seoMeta,
  };
}

export default async function NovetatsPage({ params }: PageProps) {
  const { lang } = await params;

  if (!isValidPublicLocale(lang)) {
    notFound();
  }

  const locale = lang as PublicLocale;
  const t = getPublicTranslations(locale);
  const updates = await listPublicProductUpdates();

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/${locale}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t.updates.back}
            </Link>
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-8">{t.updates.title}</h1>

        {updates.length > 0 ? (
          <div className="space-y-6">
            {updates.map((update) => (
              <article
                key={update.id}
                className="border rounded-lg p-6 hover:bg-muted/30 transition-colors"
              >
                <Link href={`/${locale}/novetats/${update.slug}`} className="block group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-semibold group-hover:text-primary transition-colors">
                        {update.title}
                      </h2>
                      {update.excerpt && (
                        <p className="text-muted-foreground mt-2 line-clamp-2">
                          {update.excerpt}
                        </p>
                      )}
                      {update.publishedAt && (
                        <p className="text-sm text-muted-foreground mt-3">
                          {t.updates.publishedAt} {update.publishedAt}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                  </div>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t.updates.noUpdates}</p>
          </div>
        )}
      </div>

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
