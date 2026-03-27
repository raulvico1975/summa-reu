import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';
import { PublicDirectContact } from '@/components/public/PublicDirectContact';
import { Button } from '@/components/ui/button';
import {
  PUBLIC_LOCALES,
  generatePublicPageMetadata,
  isValidPublicLocale,
  type PublicLocale,
} from '@/lib/public-locale';
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

  return {
    title: t.about.metaTitle,
    description: t.about.metaDescription,
    ...generatePublicPageMetadata(lang, '/qui-som'),
  };
}

export default async function AboutPage({ params }: PageProps) {
  const { lang } = await params;

  if (!isValidPublicLocale(lang)) {
    notFound();
  }

  const locale = lang as PublicLocale;
  const t = getPublicTranslations(locale);
  const capabilitiesHref = `/${locale}#capabilities`;

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <PublicSiteHeader locale={locale} />

      <section className="relative overflow-hidden px-6 py-16 lg:py-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-4rem] top-[-2rem] h-44 w-44 rounded-full bg-sky-100 blur-3xl" />
          <div className="absolute right-0 top-8 h-56 w-56 rounded-full bg-amber-100/70 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-5">
              <span className="inline-flex items-center rounded-full border border-sky-200 bg-background/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {t.home.whoWeAre.status}
              </span>
              <h1 className="max-w-2xl text-3xl font-bold tracking-tight lg:text-5xl">
                {t.home.whoWeAre.title}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                {t.home.whoWeAre.lead}
              </p>
              <p className="max-w-2xl text-muted-foreground">{t.home.whoWeAre.description}</p>
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-gradient-to-br from-background via-background to-sky-50/90 p-8 shadow-[0_28px_80px_-50px_rgba(14,165,233,0.45)]">
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sky-100/80 blur-3xl" />
              <div className="absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-amber-100/80 blur-3xl" />

              <div className="relative space-y-5">
                <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/90 px-4 py-3">
                  <span className="text-sm font-medium text-foreground">{t.home.whoWeAre.status}</span>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-4">
                    <div className="h-2.5 w-20 rounded-full bg-sky-200" />
                    <div className="mt-4 h-2.5 w-full rounded-full bg-muted" />
                    <div className="mt-2 h-2.5 w-5/6 rounded-full bg-muted" />
                    <div className="mt-2 h-2.5 w-2/3 rounded-full bg-muted" />
                  </div>
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-4">
                    <div className="h-2.5 w-24 rounded-full bg-amber-200" />
                    <div className="mt-4 h-2.5 w-full rounded-full bg-muted" />
                    <div className="mt-2 h-2.5 w-4/5 rounded-full bg-muted" />
                    <div className="mt-2 h-2.5 w-3/5 rounded-full bg-muted" />
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/90 p-4">
                  <div className="h-2.5 w-28 rounded-full bg-sky-200" />
                  <div className="mt-4 h-2.5 w-full rounded-full bg-muted" />
                  <div className="mt-2 h-2.5 w-11/12 rounded-full bg-muted" />
                  <div className="mt-2 h-2.5 w-3/4 rounded-full bg-muted" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-16 lg:pb-20">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.75rem] border border-border/60 bg-muted/20 p-8">
            <p className="text-sm font-medium text-primary">{t.home.howWeWork.title}</p>
            <h2 className="mt-2 text-2xl font-semibold">{t.home.howWeWork.lead}</h2>
            <div className="mt-5 space-y-4 text-muted-foreground">
              <p>{t.home.howWeWork.paragraph1}</p>
              <p>{t.home.howWeWork.paragraph2}</p>
            </div>
            <p className="mt-5 rounded-2xl border border-border/60 bg-background/80 px-4 py-4 text-sm text-muted-foreground">
              {t.home.howWeWork.note}
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-border/60 bg-background p-8 shadow-sm">
            <p className="text-sm font-medium text-primary">{t.cta.secondary}</p>
            <h2 className="mt-2 text-2xl font-semibold">{t.contact.title}</h2>
            <p className="mt-3 text-muted-foreground">{t.contact.description}</p>
            <div className="mt-6">
              <Button asChild size="lg">
                <Link href={`/${locale}/contact`}>
                  {t.cta.primary}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-6 border-t border-border/60 pt-6">
              <PublicDirectContact locale={locale} />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t px-4 py-6">
        <div className="mx-auto flex max-w-lg items-center justify-center gap-6 text-sm text-muted-foreground">
          <Link href={capabilitiesHref} className="hover:underline">
            {t.common.features}
          </Link>
          <span>·</span>
          <Link href={`/${locale}/blog`} className="hover:underline">
            {t.common.blog}
          </Link>
          <span>·</span>
          <Link href={`/${locale}/privacy`} className="hover:underline">
            {t.common.privacy}
          </Link>
        </div>
      </footer>
    </main>
  );
}
