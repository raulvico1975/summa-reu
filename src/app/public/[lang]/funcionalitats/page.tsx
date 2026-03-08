import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PUBLIC_LOCALES,
  isValidPublicLocale,
  generatePublicPageMetadata,
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
  const seoMeta = generatePublicPageMetadata(lang, '/funcionalitats');

  return {
    title: t.features.metaTitle,
    description: t.features.metaDescription,
    ...seoMeta,
  };
}

// Section anchors per locale
const SECTION_ANCHORS: Record<
  PublicLocale,
  {
    conciliation: string;
    remittances: string;
    expensesSepa: string;
    ticketsSettlements: string;
    fiscal: string;
    onlineDonations: string;
    projects: string;
  }
> = {
  ca: {
    conciliation: 'conciliacio-bancaria',
    remittances: 'remeses-devolucions',
    expensesSepa: 'despeses-pagaments-sepa',
    ticketsSettlements: 'tiquets-liquidacions',
    fiscal: 'fiscalitat-certificats',
    onlineDonations: 'donacions-online',
    projects: 'modul-projectes',
  },
  es: {
    conciliation: 'conciliacion-bancaria',
    remittances: 'remesas-devoluciones',
    expensesSepa: 'gastos-pagos-sepa',
    ticketsSettlements: 'tickets-liquidaciones',
    fiscal: 'fiscalidad-certificados',
    onlineDonations: 'donaciones-online',
    projects: 'modulo-proyectos',
  },
  fr: {
    conciliation: 'rapprochement-bancaire',
    remittances: 'prelevements-rejets',
    expensesSepa: 'factures-sepa',
    ticketsSettlements: 'tickets-notes-frais',
    fiscal: 'fiscalite-certificats',
    onlineDonations: 'dons-en-ligne',
    projects: 'module-projets',
  },
  pt: {
    conciliation: 'reconciliacao-bancaria',
    remittances: 'remessas-devolucoes',
    expensesSepa: 'faturas-sepa',
    ticketsSettlements: 'tickets-liquidacoes',
    fiscal: 'fiscalidade-certificados',
    onlineDonations: 'doacoes-online',
    projects: 'modulo-projetos',
  },
};

export default async function FeaturesPage({ params }: PageProps) {
  const { lang } = await params;

  if (!isValidPublicLocale(lang)) {
    notFound();
  }

  const locale = lang as PublicLocale;
  const t = getPublicTranslations(locale);
  const anchors = SECTION_ANCHORS[locale];
  const f = t.features.list;

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/${locale}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t.features.back}
            </Link>
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Intro */}
        <section id="summa-social" className="mb-16">
          <h1 className="text-3xl font-bold tracking-tight mb-4">{t.features.intro.title}</h1>

          <p className="text-lg text-muted-foreground mb-4">
            <strong className="text-foreground">{t.features.intro.subtitle}</strong>
          </p>

          <p className="text-muted-foreground">{t.features.intro.tagline}</p>
        </section>

        {/* Funcionalitats */}
        <section id="funcionalitats">
          <h2 className="text-2xl font-bold mb-10">{t.features.mainTitle}</h2>

          <div className="space-y-12">
            {/* 1. Conciliació Bancària Automàtica */}
            <article id={anchors.conciliation}>
              <h3 className="text-xl font-semibold mb-3">{f.conciliation.title}</h3>
              <p className="text-muted-foreground mb-4">{f.conciliation.description}</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                {f.conciliation.bullets.map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            </article>

            {/* 2. Auto-assignació Intel·ligent amb IA */}
            <article>
              <h3 className="text-xl font-semibold mb-3">{f.aiAssignment.title}</h3>
              <p className="text-muted-foreground mb-4">{f.aiAssignment.description}</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                {f.aiAssignment.bullets.map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            </article>

            {/* 3. Divisor de Remeses IN */}
            <article id={anchors.remittances}>
              <h3 className="text-xl font-semibold mb-3">{f.remittancesDivider.title}</h3>
              <p className="text-muted-foreground mb-4">{f.remittancesDivider.description}</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                {f.remittancesDivider.bullets.map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            </article>

            {/* 4. Gestor de Despeses i Nòmines amb SEPA */}
            <article id={anchors.expensesSepa}>
              <h3 className="text-xl font-semibold mb-3">{f.expensesSepa.title}</h3>
              <p className="text-muted-foreground mb-4">{f.expensesSepa.description}</p>
              <p id={anchors.ticketsSettlements} className="text-muted-foreground mb-4">
                <strong className="text-foreground">{f.expensesSepa.ticketsNote}</strong>
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                {f.expensesSepa.bullets.map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            </article>

            {/* 5. Gestió Fiscal Automatitzada */}
            <article id={anchors.fiscal}>
              <h3 className="text-xl font-semibold mb-3">{f.fiscal.title}</h3>
              <p className="text-muted-foreground mb-4">{f.fiscal.description}</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                {f.fiscal.bullets.map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            </article>

            {/* 6. Certificats de Donació Automàtics */}
            <article>
              <h3 className="text-xl font-semibold mb-3">{f.donationCertificates.title}</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                {f.donationCertificates.bullets.map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            </article>

            {/* 7. Classificació de Moviments amb Memòria */}
            <article>
              <h3 className="text-xl font-semibold mb-3">{f.movementClassification.title}</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                {f.movementClassification.bullets.map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            </article>

            {/* 8. Dashboard Directiu */}
            <article>
              <h3 className="text-xl font-semibold mb-3">{f.dashboard.title}</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                {f.dashboard.bullets.map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            </article>

            {/* 9. Gestió Multi-contacte */}
            <article>
              <h3 className="text-xl font-semibold mb-3">{f.multiContact.title}</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                {f.multiContact.bullets.map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            </article>

            {/* 10. Gestió de Devolucions Bancàries */}
            <article>
              <h3 className="text-xl font-semibold mb-3">{f.bankReturns.title}</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                {f.bankReturns.bullets.map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            </article>

            {/* 11. Integració Stripe */}
            <article id={anchors.onlineDonations}>
              <h3 className="text-xl font-semibold mb-3">{f.stripeIntegration.title}</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                {f.stripeIntegration.bullets.map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            </article>

            {/* 12. Mòdul de Projectes i Subvencions */}
            <article id={anchors.projects}>
              <h3 className="text-xl font-semibold mb-3">{f.projectsModule.title}</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                {f.projectsModule.bullets.map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            </article>

            {/* 13. Arquitectura Multi-organització */}
            <article>
              <h3 className="text-xl font-semibold mb-3">{f.multiOrg.title}</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                {f.multiOrg.bullets.map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            </article>

            {/* 14. Exportació de Dades i Informes */}
            <article>
              <h3 className="text-xl font-semibold mb-3">{f.exports.title}</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                {f.exports.bullets.map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            </article>

            {/* 15. Sistema d'Alertes Intel·ligent */}
            <article>
              <h3 className="text-xl font-semibold mb-3">{f.alerts.title}</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                {f.alerts.bullets.map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        {/* CTA */}
        <div className="mt-16 text-center">
          <Button asChild size="lg">
            <Link href={`/${locale}/contact`}>{t.cta.primary}</Link>
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-6 px-4">
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
