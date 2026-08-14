import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';
import { PUBLIC_SHELL_X, PUBLIC_WIDE_SHELL } from '@/components/public/public-shell';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { PUBLIC_SITE_URL } from '@/lib/public-seo';
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

  const locale = lang as PublicLocale;
  const t = getPublicTranslations(locale);
  const seoMeta = generatePublicPageMetadata(locale, '/preus', {
    title: t.pricing.metaTitle,
    description: t.pricing.metaDescription,
  });

  return {
    title: t.pricing.metaTitle,
    description: t.pricing.metaDescription,
    ...seoMeta,
  };
}

export default async function PricingPage({ params }: PageProps) {
  const { lang } = await params;

  if (!isValidPublicLocale(lang)) {
    notFound();
  }

  const locale = lang as PublicLocale;
  const t = getPublicTranslations(locale);
  const pricingUrl = `${PUBLIC_SITE_URL}/${locale}/preus`;
  const pricingStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${pricingUrl}#faq`,
    mainEntity: t.pricing.faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingStructuredData).replace(/</g, '\\u003c') }}
      />
      <PublicSiteHeader locale={locale} currentSection="pricing" />

      <section className={`${PUBLIC_WIDE_SHELL} py-14 sm:py-20`}>
        <div className="max-w-4xl space-y-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{t.pricing.navLabel}</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {t.pricing.title}
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-muted-foreground">{t.pricing.subtitle}</p>
          <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center">
            <Button asChild size="lg">
              <Link href={`/${locale}/contact`}>
                {t.pricing.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            {t.pricing.claim ? <p className="text-sm font-medium text-foreground">{t.pricing.claim}</p> : null}
          </div>
        </div>
      </section>

      <section className={`${PUBLIC_WIDE_SHELL} pb-10`}>
        <div className="grid gap-4 border-y border-border/70 py-6 lg:grid-cols-[1.1fr_1.4fr] lg:items-center">
          <div>
            <h2 className="text-xl font-semibold">{t.pricing.orientationTitle}</h2>
            {t.pricing.orientationText ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.pricing.orientationText}</p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {t.pricing.orientationPoints.map((point) => (
              <div key={point} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${PUBLIC_WIDE_SHELL} pb-10`}>
        <div className="rounded-lg border border-primary/25 bg-primary/5 p-5 sm:p-6">
          <h2 className="text-lg font-semibold">{t.pricing.differentiatorTitle}</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
            {t.pricing.differentiatorText}
          </p>
        </div>
      </section>

      <section className={`${PUBLIC_WIDE_SHELL} pb-16`}>
        <div className="grid gap-5 lg:grid-cols-3 lg:items-stretch">
          {t.pricing.plans.map((plan) => (
            <article
              key={plan.id}
              className={`flex min-h-[27rem] flex-col rounded-lg border bg-white p-6 shadow-[0_18px_50px_-38px_rgba(15,23,42,0.35)] ${
                plan.recommended
                  ? 'border-primary/45 ring-1 ring-primary/25 lg:-mt-4 lg:mb-4'
                  : 'border-border/70'
              }`}
            >
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className={`mb-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        plan.recommended
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {plan.badge}
                    </p>
                    <h2 className="text-xl font-semibold">{plan.name}</h2>
                  </div>
                  <CheckCircle2
                    className={`mt-1 h-5 w-5 shrink-0 ${
                      plan.recommended ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  />
                </div>
                <p className="mt-4 text-3xl font-semibold tracking-tight">{plan.price}</p>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{plan.description}</p>
                <ul className="mt-6 space-y-3 border-t border-border/60 pt-5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm leading-6 text-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.limit ? (
                  <p className="mt-5 rounded-md border border-border/70 bg-muted/45 px-3 py-2 text-xs leading-5 text-muted-foreground">
                    {plan.limit}
                  </p>
                ) : null}
                <div className="mt-auto pt-6">
                  <Button asChild className="w-full">
                    <Link href={`/${locale}/contact?plan=${plan.id}`}>{plan.cta}</Link>
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-5">
          <h2 className="text-base font-semibold">{t.pricing.implantationNoteTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.pricing.implantationNoteText}</p>
        </div>
      </section>

      <section className={`${PUBLIC_WIDE_SHELL} pb-16`}>
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight">{t.pricing.comparisonTitle}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{t.pricing.comparisonDescription}</p>
        </div>
        <div className="mt-7 overflow-x-auto rounded-lg border border-border/70 bg-white">
          <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
            <thead className="bg-muted/55">
              <tr>
                <th scope="col" className="px-4 py-4 font-semibold">{t.pricing.comparisonFeatureLabel}</th>
                {t.pricing.plans.map((plan) => (
                  <th key={plan.id} scope="col" className="px-4 py-4 text-center font-semibold">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.pricing.comparisonRows.map((row) => (
                <tr key={row.feature} className="border-t border-border/60">
                  <th scope="row" className="px-4 py-4 font-medium text-foreground">{row.feature}</th>
                  {(['control', 'management', 'complete'] as const).map((planId) => (
                    <td key={planId} className="px-4 py-4 text-center">
                      {row[planId] ? (
                        <CheckCircle2
                          className="mx-auto h-5 w-5 text-primary"
                          aria-label={t.pricing.comparisonIncludedLabel}
                        />
                      ) : (
                        <span className="text-muted-foreground" aria-label={t.pricing.comparisonNotIncludedLabel}>—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${PUBLIC_SHELL_X} pb-10`}>
        <div className="mx-auto grid max-w-4xl gap-5 rounded-lg border border-border/70 bg-muted/35 p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-xl font-semibold">{t.pricing.implantationTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{t.pricing.implantationText}</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{t.pricing.implantationSubtext}</p>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{t.pricing.implantationPrice}</p>
        </div>
      </section>

      <section className={`${PUBLIC_SHELL_X} pb-20`}>
        <div className="mx-auto mb-16 max-w-4xl">
          <h2 className="text-2xl font-semibold tracking-tight">{t.pricing.faqTitle}</h2>
          <div className="mt-6 divide-y divide-border/70 rounded-lg border border-border/70 bg-white px-5 sm:px-6">
            {t.pricing.faqItems.map((item) => (
              <details key={item.question} className="group py-5">
                <summary className="cursor-pointer list-none pr-6 font-medium text-foreground">
                  {item.question}
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight">{t.pricing.decisionTitle}</h2>
          {t.pricing.decisionText ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{t.pricing.decisionText}</p>
          ) : null}
        </div>
        <div className="mx-auto mt-8 flex max-w-3xl justify-center">
          <Button asChild size="lg">
            <Link href={`/${locale}/contact`}>
              {t.pricing.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
