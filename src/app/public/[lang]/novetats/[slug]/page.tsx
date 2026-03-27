// src/app/public/[lang]/novetats/[slug]/page.tsx
// Pàgina de detall d'una novetat
// Llegeix server-side de Firestore via Admin SDK
// Render text estructurat (NO HTML)

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';
import { Button } from '@/components/ui/button';
import {
  isValidPublicLocale,
  generatePublicPageMetadata,
  type PublicLocale,
} from '@/lib/public-locale';
import { getPublicProductUpdateBySlug } from '@/lib/product-updates/public';
import { getPublicTranslations } from '@/i18n/public';
import { renderStructuredText } from '@/lib/render-structured-text';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ lang: string; slug: string }>;
}

const pageShellClass =
  'min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#ffffff_26%,#ffffff_100%)]';

export function generateStaticParams() {
  return [];
}

function formatPublicDate(value: string | null, locale: PublicLocale): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const localeMap: Record<PublicLocale, string> = {
    ca: 'ca-ES',
    es: 'es-ES',
    fr: 'fr-FR',
    pt: 'pt-PT',
  };

  return new Intl.DateTimeFormat(localeMap[locale], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isValidPublicLocale(lang)) return {};

  const update = await getPublicProductUpdateBySlug(slug, { locale: lang as PublicLocale });
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
  const update = await getPublicProductUpdateBySlug(slug, { locale });

  if (!update) {
    notFound();
  }

  const publishedAt = formatPublicDate(update.publishedAt, locale);

  return (
    <main className={pageShellClass}>
      <PublicSiteHeader locale={locale} />

      <section className="px-6 pb-10 pt-8 lg:pt-12">
        <div className="mx-auto max-w-5xl">
          <Button asChild variant="ghost" size="sm" className="rounded-full px-4 text-muted-foreground hover:text-foreground">
            <Link href={`/${locale}/novetats`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t.updates.back}
            </Link>
          </Button>

          <div className="mt-6 space-y-5">
            {publishedAt && (
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4 text-primary" />
                {publishedAt}
              </p>
            )}
            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {update.title}
            </h1>
            {update.excerpt && (
              <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
                {update.excerpt}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="px-6 pb-20">
        <article className="mx-auto max-w-4xl rounded-[2rem] border border-border/60 bg-white/95 p-6 shadow-[0_28px_80px_-56px_rgba(15,23,42,0.22)] sm:p-10">
          {update.content ? (
            <div className="prose prose-neutral max-w-none text-base leading-8 prose-headings:tracking-tight prose-p:text-muted-foreground prose-li:text-muted-foreground">
              {renderStructuredText(update.content)}
            </div>
          ) : (
            <p className="text-base leading-7 text-muted-foreground">{update.excerpt}</p>
          )}
        </article>
      </section>

      <footer className="border-t py-6 px-4 mt-auto">
        <div className="max-w-lg mx-auto flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <Link href={`/${locale}/privacy`} className="hover:underline">
            {t.common.privacy}
          </Link>
          <span>·</span>
          <Link href={`/${locale}/contact`} className="hover:underline">
            {t.common.contact}
          </Link>
          <span>·</span>
          <Link href={`/${locale}/novetats`} className="hover:underline">
            {t.updates.navLabel}
          </Link>
        </div>
      </footer>
    </main>
  );
}
