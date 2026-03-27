// src/app/public/[lang]/novetats/page.tsx
// Pàgina pública de novetats del producte
// Llegeix server-side de Firestore via Admin SDK

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, Sparkles } from 'lucide-react';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  PUBLIC_LOCALES,
  isValidPublicLocale,
  generatePublicPageMetadata,
  type PublicLocale,
} from '@/lib/public-locale';
import { listPublicProductUpdates } from '@/lib/product-updates/public';
import { cn } from '@/lib/utils';
import { getPublicTranslations } from '@/i18n/public';

interface PageProps {
  params: Promise<{ lang: string }>;
}

const pageShellClass =
  'min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#ffffff_26%,#ffffff_100%)]';

const updateCardClass =
  'group rounded-[1.9rem] border border-border/60 bg-white/92 p-6 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_32px_90px_-54px_rgba(15,23,42,0.26)]';

const UPDATES_PANEL_COPY: Record<PublicLocale, string> = {
  ca: 'Aquí recollim canvis de producte que afecten l’operativa i els publiquem amb context útil, sense soroll.',
  es: 'Aquí recogemos cambios de producto que afectan a la operativa y los publicamos con contexto útil, sin ruido.',
  fr: 'Ici, nous rassemblons les évolutions produit qui touchent l’opératif et nous les publions avec un contexte utile, sans bruit.',
  pt: 'Aqui reunimos alterações de produto que afetam a operação e publicamo-las com contexto útil, sem ruído.',
};

export function generateStaticParams() {
  return PUBLIC_LOCALES.map((lang) => ({ lang }));
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
  const updates = await listPublicProductUpdates({ locale });
  const latestPublishedAt = formatPublicDate(updates[0]?.publishedAt ?? null, locale);

  return (
    <main className={pageShellClass}>
      <PublicSiteHeader locale={locale} />

      <section className="px-6 pb-12 pt-8 lg:pt-12">
        <div className="mx-auto max-w-6xl">
          <Button asChild variant="ghost" size="sm" className="rounded-full px-4 text-muted-foreground hover:text-foreground">
            <Link href={`/${locale}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t.common.backToHome}
            </Link>
          </Button>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
            <div className="space-y-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                {t.updates.navLabel}
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                {t.updates.title}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                {t.updates.latestDescription}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href={`/${locale}#capabilities`}>{t.common.features}</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href={`/${locale}#how-we-work`}>{t.home.howWeWork.title}</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-sky-200/70 bg-white/90 p-6 shadow-[0_30px_90px_-56px_rgba(14,165,233,0.36)] sm:p-7">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                {t.updates.latestLabel}
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                {t.updates.latestTitle}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
                {UPDATES_PANEL_COPY[locale]}
              </p>

              {latestPublishedAt && (
                <div className="mt-6 rounded-[1.35rem] border border-sky-100 bg-sky-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
                    {t.common.lastUpdated}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-foreground">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {latestPublishedAt}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="mx-auto max-w-6xl">
          {updates.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2">
              {updates.map((update, index) => {
                const publishedAt = formatPublicDate(update.publishedAt, locale);
                const featured = index === 0;

                return (
                  <article
                    key={update.id}
                    className={cn(
                      updateCardClass,
                      featured &&
                        'border-sky-200/70 bg-[linear-gradient(135deg,rgba(14,165,233,0.1),rgba(255,255,255,0.96)_45%,rgba(240,249,255,0.9))] md:col-span-2 p-7 sm:p-8'
                    )}
                  >
                    <Link href={`/${locale}/novetats/${update.slug}`} className="block">
                      <div className="space-y-5">
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge variant="outline" className="border-sky-200 bg-sky-50 text-primary">
                            {t.updates.navLabel}
                          </Badge>
                          {publishedAt && (
                            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                              <CalendarDays className="h-4 w-4" />
                              {publishedAt}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                          <div className="space-y-3">
                            <h2
                              className={cn(
                                'max-w-3xl text-2xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary',
                                featured && 'text-[2rem] sm:text-[2.4rem]'
                              )}
                            >
                              {update.title}
                            </h2>
                            {update.excerpt && (
                              <p className="max-w-3xl text-base leading-7 text-muted-foreground">
                                {update.excerpt}
                              </p>
                            )}
                          </div>

                          <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                            {t.updates.readMore}
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-border/70 bg-white/75 px-6 py-16 text-center shadow-[0_22px_70px_-50px_rgba(15,23,42,0.18)]">
              <p className="text-base text-muted-foreground">{t.updates.noUpdates}</p>
            </div>
          )}
        </div>
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
        </div>
      </footer>
    </main>
  );
}
