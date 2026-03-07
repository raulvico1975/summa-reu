import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicLandingTemplate } from '@/components/public/PublicLandingTemplate';
import {
  PUBLIC_LOCALES,
  isValidPublicLocale,
  generatePublicPageMetadata,
  type PublicLocale,
} from '@/lib/public-locale';
import {
  getPublicLandingBySlug,
  getPublicLandingSlugs,
  getPublicLandingMetadata,
  getPublicLandingContent,
} from '@/lib/public-landings';
import { getPublicTranslations } from '@/i18n/public';

interface PageProps {
  params: Promise<{ lang: string; landingSlug: string }>;
}

export function generateStaticParams() {
  return PUBLIC_LOCALES.flatMap((lang) =>
    getPublicLandingSlugs().map((landingSlug) => ({ lang, landingSlug }))
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, landingSlug } = await params;
  if (!isValidPublicLocale(lang)) return {};

  const landing = getPublicLandingBySlug(landingSlug);
  if (!landing) return {};

  const locale = lang as PublicLocale;
  const metadata = getPublicLandingMetadata(landing, locale);
  const seoMeta = generatePublicPageMetadata(locale, `/${landingSlug}`);

  return {
    title: metadata.title,
    description: metadata.description,
    ...seoMeta,
  };
}

export default async function PublicLandingPage({ params }: PageProps) {
  const { lang, landingSlug } = await params;

  if (!isValidPublicLocale(lang)) {
    notFound();
  }

  const landing = getPublicLandingBySlug(landingSlug);
  if (!landing) {
    notFound();
  }

  const locale = lang as PublicLocale;
  const t = getPublicTranslations(locale);
  const content = getPublicLandingContent(landing, locale);

  return (
    <PublicLandingTemplate
      locale={locale}
      content={content}
      labels={{
        backToHome: t.common.backToHome,
        contact: t.common.contact,
        privacy: t.common.privacy,
        appName: t.common.appName,
      }}
    />
  );
}
