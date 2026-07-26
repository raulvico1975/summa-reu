/**
 * PublicLayout — Layout per pàgines públiques multi-idioma
 *
 * IMPORTANT (anti-regressió):
 * - NO renderitzar <html> ni <body> — ja ho fa RootLayout
 * - Aquesta ruta és pública: NO intentar carregar orgs ni auth
 * - El middleware reescriu /{lang}/... → /public/{lang}/...
 *
 * @see docs/DEV-SOLO-MANUAL.md secció "Arquitectura de rutes i layouts"
 */
import { notFound } from 'next/navigation';
import { PublicAnalytics } from '@/components/public/PublicAnalytics';
import { PUBLIC_LOCALES, isValidPublicLocale, type PublicLocale } from '@/lib/public-locale';
import { PublicJsonLd, buildPublicSiteJsonLd } from '@/lib/public-seo';

/**
 * Genera els params estàtics per a totes les pàgines públiques [lang].
 * Això permet SSG per ca/es/fr/pt.
 */
export function generateStaticParams() {
  return PUBLIC_LOCALES.map((lang) => ({ lang }));
}

interface PublicLayoutProps {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

/**
 * Layout per a les pàgines públiques amb suport multi-idioma.
 * Valida que el paràmetre `lang` sigui un idioma suportat.
 */
export default async function PublicLayout({ children, params }: PublicLayoutProps) {
  const { lang } = await params;
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

  // Validar que l'idioma sigui suportat
  if (!isValidPublicLocale(lang)) {
    notFound();
  }

  // No renderitzem <html> ni <body> aquí — ja ho fa src/app/layout.tsx
  return (
    <div className="font-sans antialiased">
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang=${JSON.stringify(lang)};`,
        }}
      />
      <PublicJsonLd data={buildPublicSiteJsonLd(lang as PublicLocale)} />
      {children}
      <PublicAnalytics locale={lang as PublicLocale} measurementId={measurementId} />
    </div>
  );
}
