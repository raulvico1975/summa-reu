import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { PublicDirectContact } from '@/components/public/PublicDirectContact';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { ArrowRight, Upload, Settings, FileCheck } from 'lucide-react';
import {
  PUBLIC_LOCALES,
  isValidPublicLocale,
  generatePublicPageMetadata,
  type PublicLocale,
} from '@/lib/public-locale';
import { getPublicTranslations } from '@/i18n/public';

const BASE_URL = 'https://summasocial.app';

// Classe consistent per "product window frame" a totes les captures
const frameClass = 'rounded-xl border border-border/50 shadow-sm overflow-hidden bg-background';

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
  const seoMeta = generatePublicPageMetadata(lang, '');

  return {
    title: t.home.metaTitle,
    description: t.home.metaDescription,
    ...seoMeta,
  };
}

// Section anchors per locale
const SECTION_ANCHORS: Record<
  PublicLocale,
  {
    conciliation: string;
    remittances: string;
    onlineDonations: string;
    fiscalCertificates: string;
  }
> = {
  ca: {
    conciliation: 'conciliacio-bancaria',
    remittances: 'remeses-devolucions',
    onlineDonations: 'donacions-online',
    fiscalCertificates: 'fiscalitat-certificats',
  },
  es: {
    conciliation: 'conciliacion-bancaria',
    remittances: 'remesas-devoluciones',
    onlineDonations: 'donaciones-online',
    fiscalCertificates: 'fiscalidad-certificados',
  },
  fr: {
    conciliation: 'rapprochement-bancaire',
    remittances: 'prelevements-rejets',
    onlineDonations: 'dons-en-ligne',
    fiscalCertificates: 'fiscalite-certificats',
  },
  pt: {
    conciliation: 'reconciliacao-bancaria',
    remittances: 'remessas-devolucoes',
    onlineDonations: 'doacoes-online',
    fiscalCertificates: 'fiscalidade-certificados',
  },
};

// Features page path per locale
const FEATURES_PATH: Record<PublicLocale, string> = {
  ca: 'funcionalitats',
  es: 'funcionalitats',
  fr: 'fonctionnalites',
  pt: 'funcionalidades',
};

export default async function HomePage({ params }: PageProps) {
  const { lang } = await params;

  if (!isValidPublicLocale(lang)) {
    notFound();
  }

  const locale = lang as PublicLocale;
  const t = getPublicTranslations(locale);
  const anchors = SECTION_ANCHORS[locale];
  const featuresPath = FEATURES_PATH[locale];

  return (
    <main className="flex min-h-screen flex-col">
      {/* Skip link for accessibility */}
      <a
        href="#capabilities"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        {t.home.skipToContent}
      </a>

      {/* ═══════════════════════════════════════════════════════════════════════
          A) HERO — 2 columnes desktop, 1 columna mòbil
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-background px-6 py-16 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 items-center">
            {/* Columna esquerra: Text */}
            <div className="space-y-6 text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start gap-3">
                <Logo className="h-12 w-12 lg:h-14 lg:w-14 text-primary" />
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                  {t.common.appName}
                </h1>
              </div>

              <p className="text-xl text-muted-foreground sm:text-2xl">
                {t.home.heroTagline}
              </p>

              <p className="text-base text-muted-foreground/80 sm:text-lg">
                {t.home.solves.intro}
              </p>

              <p className="text-sm text-muted-foreground/80">
                {t.home.hero.bridgeLine}
              </p>

              {/* Imatge en mòbil: entre text i CTAs */}
              <div className="lg:hidden">
                <div className={frameClass}>
                  <Image
                    src="/visuals/web/web_pantalla_summa.webp"
                    alt={t.home.hero.visualAlt}
                    width={800}
                    height={500}
                    sizes="100vw"
                    className="w-full h-auto"
                    priority
                  />
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
                <Button asChild size="lg">
                  <Link href={`/${locale}/${featuresPath}`}>{t.common.features}</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href={`/${locale}/contact`}>{t.common.contact}</Link>
                </Button>
              </div>

              <PublicDirectContact locale={locale} className="pt-2" />
            </div>

            {/* Columna dreta: Imatge (només desktop) */}
            <div className="hidden lg:block">
              <div className={frameClass}>
                <Image
                  src="/visuals/web/web_pantalla_summa.webp"
                  alt={t.home.hero.visualAlt}
                  width={800}
                  height={500}
                  sizes="50vw"
                  className="w-full h-auto"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          B) TRUST STRIP — Números clau
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="border-y border-border/50 bg-muted/30 px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-3 divide-x divide-border/50 text-center">
            <div className="px-4">
              <p className="text-3xl font-semibold text-primary sm:text-4xl">{t.home.stats.entities}</p>
              <p className="text-sm text-muted-foreground">{t.home.stats.entitiesLabel}</p>
            </div>
            <div className="px-4">
              <p className="text-3xl font-semibold text-primary sm:text-4xl">{t.home.stats.movements}</p>
              <p className="text-sm text-muted-foreground">{t.home.stats.movementsLabel}</p>
            </div>
            <div className="px-4">
              <p className="text-3xl font-semibold text-primary sm:text-4xl">{t.home.stats.countries}</p>
              <p className="text-sm text-muted-foreground">{t.home.stats.countriesLabel}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          C) WORKFLOW — 3 passos
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-semibold text-center mb-12">{t.home.workflow.title}</h2>

          <div className="grid gap-8 md:grid-cols-3">
            {/* Pas 1 */}
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Upload className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">{t.home.workflow.step1.title}</h3>
              <p className="text-sm text-muted-foreground">{t.home.workflow.step1.description}</p>
            </div>

            {/* Pas 2 */}
            <div className="text-center space-y-4">
              <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Settings className="h-6 w-6" />
                {/* Badge +IA estil Spark */}
                <span className="absolute -top-1 -right-1 flex items-center gap-0.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  +IA
                </span>
              </div>
              <h3 className="text-lg font-semibold">{t.home.workflow.step2.title}</h3>
              <p className="text-sm text-muted-foreground">{t.home.workflow.step2.description}</p>
            </div>

            {/* Pas 3 */}
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FileCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">{t.home.workflow.step3.title}</h3>
              <p className="text-sm text-muted-foreground">{t.home.workflow.step3.description}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          D) CAPABILITIES GRID — 2x2
          ═══════════════════════════════════════════════════════════════════════ */}
      <section id="capabilities" className="bg-muted/30 px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-semibold text-center">{t.home.systemOverview.title}</h2>
          <p className="mt-2 mb-12 text-center text-muted-foreground max-w-2xl mx-auto">
            {t.home.systemOverview.subtitle}
          </p>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Card 1: Conciliació */}
            <div className={frameClass}>
              <div className="aspect-video overflow-hidden bg-muted/20">
                <Image
                  src="/visuals/web/web_concilia_bancaria.webp"
                  alt={t.home.capabilities.conciliation.title}
                  width={600}
                  height={340}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 space-y-3">
                <h3 className="text-lg font-semibold">{t.home.capabilities.conciliation.title}</h3>
                <p className="text-sm text-muted-foreground">{t.home.capabilities.conciliation.description}</p>
                <Link
                  href={`/${locale}/${featuresPath}#${anchors.conciliation}`}
                  className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                >
                  {t.home.readMore}
                </Link>
              </div>
            </div>

            {/* Card 2: Remeses */}
            <div className={frameClass}>
              <div className="aspect-video overflow-hidden bg-muted/20">
                <Image
                  src="/visuals/web/web_divide_remeses.webp"
                  alt={t.home.capabilities.remittances.title}
                  width={600}
                  height={340}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 space-y-3">
                <h3 className="text-lg font-semibold">{t.home.capabilities.remittances.title}</h3>
                <p className="text-sm text-muted-foreground">{t.home.capabilities.remittances.description}</p>
                <Link
                  href={`/${locale}/${featuresPath}#${anchors.remittances}`}
                  className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                >
                  {t.home.readMore}
                </Link>
              </div>
            </div>

            {/* Card 3: Donacions */}
            <div className={frameClass}>
              <div className="aspect-video overflow-hidden bg-muted/20">
                <Image
                  src="/visuals/web/web_divide_stripe.webp"
                  alt={t.home.capabilities.donations.title}
                  width={600}
                  height={340}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 space-y-3">
                <h3 className="text-lg font-semibold">{t.home.capabilities.donations.title}</h3>
                <p className="text-sm text-muted-foreground">{t.home.capabilities.donations.description}</p>
                <Link
                  href={`/${locale}/${featuresPath}#${anchors.onlineDonations}`}
                  className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                >
                  {t.home.readMore}
                </Link>
              </div>
            </div>

            {/* Card 4: Fiscalitat */}
            <div className={frameClass}>
              <div className="aspect-video overflow-hidden bg-muted/20">
                <Image
                  src="/visuals/web/web_certificats_182.webp"
                  alt={t.home.capabilities.fiscal.title}
                  width={600}
                  height={340}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 space-y-3">
                <h3 className="text-lg font-semibold">{t.home.capabilities.fiscal.title}</h3>
                <p className="text-sm text-muted-foreground">{t.home.capabilities.fiscal.description}</p>
                <Link
                  href={`/${locale}/${featuresPath}#${anchors.fiscalCertificates}`}
                  className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                >
                  {t.home.readMore}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {locale === 'ca' && (
        <section className="px-6 py-12">
          <div className="mx-auto max-w-4xl rounded-2xl border border-border/60 bg-muted/20 p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-primary">Gestió econòmica per a ONG</p>
                <h2 className="text-2xl font-semibold">Accedeix al hub central del clúster SEO públic</h2>
                <p className="text-muted-foreground">
                  Recorregut complet per conciliació bancària, donants, remeses, devolucions i fiscalitat dins de
                  Summa Social.
                </p>
              </div>
              <Button asChild size="lg">
                <Link href="/ca/gestio-economica-ong">
                  Veure el hub
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          E) BLOCS "Per a qui és" — 2 blocs grans
          ═══════════════════════════════════════════════════════════════════════ */}
      {/* Bloc A: Admin/Tresoreria */}
      <section className="px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">{t.home.profiles.admin.title}</h2>
              <p className="text-muted-foreground">{t.home.profiles.admin.description}</p>
              <Link
                href={`/${locale}/${featuresPath}`}
                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                {t.home.readMore}
              </Link>
            </div>
            <div className={frameClass}>
              <Image
                src="/visuals/web/web_gestio_docs.webp"
                alt={t.home.profiles.admin.title}
                width={600}
                height={400}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Bloc B: Projectes */}
      <section className="bg-muted/30 px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <div className="order-2 lg:order-1">
              <div className={frameClass}>
                <Image
                  src="/visuals/web/web_seguiment_projectes.webp"
                  alt={t.home.profiles.projects.title}
                  width={600}
                  height={400}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="w-full h-auto"
                />
              </div>
            </div>
            <div className="order-1 lg:order-2 space-y-6">
              <h2 className="text-2xl font-semibold">{t.home.profiles.projects.title}</h2>
              <p className="text-muted-foreground">{t.home.profiles.projects.description}</p>
              <Link
                href={`/${locale}/${featuresPath}`}
                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                {t.home.readMore}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          F) COM TREBALLEM — Il·lustració doodle
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-5xl space-y-8 text-center">
          {/* Títol */}
          <h2 className="text-2xl font-semibold lg:text-3xl">{t.home.howWeWork.title}</h2>

          {/* Lead */}
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t.home.howWeWork.lead}
          </p>

          {/* Il·lustració */}
          <div className="py-6">
            <Image
              src={locale === 'es' ? '/visuals/web/web_como_trabajamos.webp' : '/visuals/web/web_com_treballem.webp'}
              alt={t.home.howWeWork.imageAlt}
              width={1200}
              height={600}
              sizes="(min-width: 1024px) 80vw, 100vw"
              className="w-full h-auto"
            />
          </div>

          {/* Paràgrafs addicionals */}
          <div className="space-y-4 max-w-3xl mx-auto text-left">
            <p className="text-muted-foreground">{t.home.howWeWork.paragraph1}</p>
            <p className="text-muted-foreground">{t.home.howWeWork.paragraph2}</p>
          </div>

          {/* Nota */}
          <p className="text-sm text-muted-foreground/70 italic">
            {t.home.howWeWork.note}
          </p>

          {/* CTA */}
          <div className="pt-4">
            <Button asChild variant="outline" size="lg">
              <Link href={`/${locale}/contact`}>{t.home.howWeWork.cta}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          G) FINAL CTA
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-primary px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-3xl text-center space-y-6">
          <h2 className="text-2xl font-semibold text-primary-foreground lg:text-3xl">
            {t.home.finalCta.title}
          </h2>
          <p className="text-primary-foreground/90">
            {t.home.finalCta.subtitle}
          </p>
          <Button asChild size="lg" variant="secondary">
            <Link href={`/${locale}/contact`}>
              {t.common.contact}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <div className="flex justify-center">
            <PublicDirectContact locale={locale} className="rounded-xl bg-background/95 p-5 text-left shadow-sm" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6 px-4">
        <div className="max-w-lg mx-auto flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <Link href={`/${locale}/${featuresPath}`} className="hover:underline">
            {t.common.features}
          </Link>
          <span>·</span>
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
