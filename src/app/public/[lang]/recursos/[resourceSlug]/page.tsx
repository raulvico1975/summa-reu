import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  ShieldCheck,
} from 'lucide-react';
import { PublicSiteFooter } from '@/components/public/PublicSiteFooter';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';
import { PUBLIC_WIDE_SHELL } from '@/components/public/public-shell';
import {
  PublicJsonLd,
  PUBLIC_SITE_URL,
  buildPublicBreadcrumbJsonLd,
} from '@/lib/public-seo';
import { isValidPublicLocale, type PublicLocale } from '@/lib/public-locale';

type ResourceLocale = Extract<PublicLocale, 'ca' | 'es'>;

interface PageProps {
  params: Promise<{ lang: string; resourceSlug: string }>;
}

const RESOURCE: Record<
  ResourceLocale,
  {
    slug: string;
    title: string;
    description: string;
    eyebrow: string;
    subtitle: string;
    downloadXlsx: string;
    downloadCsv: string;
    previewTitle: string;
    columns: string[];
    example: string[];
    whyTitle: string;
    whyIntro: string;
    benefits: string[];
    stepsTitle: string;
    steps: Array<{ title: string; body: string }>;
    checksTitle: string;
    checks: string[];
    disclaimer: string;
    productLink: string;
    productLinkLabel: string;
  }
> = {
  ca: {
    slug: 'plantilla-conciliacio-bancaria',
    title: 'Plantilla gratuïta de conciliació bancària per a ONG i associacions',
    description:
      'Descarrega una plantilla gratuïta en Excel o CSV per controlar la conciliació bancària d’una ONG o associació, detectar diferències i deixar cada moviment revisat.',
    eyebrow: 'Recurs gratuït · Excel i CSV',
    subtitle:
      'Un full simple per comparar l’extracte bancari amb el registre intern, detectar diferències i documentar què queda pendent.',
    downloadXlsx: 'Descarrega l’Excel',
    downloadCsv: 'Descarrega el CSV',
    previewTitle: 'Què trobaràs a la plantilla',
    columns: ['Data', 'Compte', 'Referència', 'Concepte', 'Import banc', 'Import intern', 'Diferència', 'Estat'],
    example: ['15/01/2026', 'Compte principal', 'EXEMPLE-001', 'Quota soci gener', '50,00 €', '50,00 €', '0,00 €', 'Conciliat'],
    whyTitle: 'Per què és útil',
    whyIntro:
      'La plantilla està pensada per a entitats petites i mitjanes que encara treballen amb extractes i fulls de càlcul.',
    benefits: [
      'Unifica en una sola fila el moviment bancari i el registre intern.',
      'Calcula la diferència i permet veure ràpidament què no quadra.',
      'Separa moviments conciliats, pendents, duplicats i no identificats.',
      'Deixa constància de la revisió, la persona responsable i les observacions.',
    ],
    stepsTitle: 'Com utilitzar-la',
    steps: [
      {
        title: 'Importa o copia els moviments',
        body: 'Afegeix una fila per cada moviment de l’extracte. No incloguis dades personals que no necessitis per al control.',
      },
      {
        title: 'Compara amb el registre intern',
        body: 'Indica l’import comptabilitzat o registrat per l’entitat. La plantilla calcula la diferència.',
      },
      {
        title: 'Assigna un estat',
        body: 'Marca cada fila com a conciliada, pendent, duplicada o no identificada i documenta el següent pas.',
      },
      {
        title: 'Tanca la revisió',
        body: 'Filtra les diferències diferents de zero i els estats pendents abans de donar el període per revisat.',
      },
    ],
    checksTitle: 'Comprovacions abans de tancar el mes',
    checks: [
      'El saldo inicial i el saldo final coincideixen amb l’extracte.',
      'No hi ha referències bancàries duplicades.',
      'Totes les diferències estan explicades o tenen una acció pendent.',
      'La data i la persona revisora han quedat registrades.',
    ],
    disclaimer:
      'És una eina de control intern. No substitueix la comptabilitat oficial ni l’assessorament professional que pugui necessitar l’entitat.',
    productLink: '/ca/conciliacio-bancaria-ong',
    productLinkLabel: 'Descobreix com Summa Social facilita la conciliació bancària',
  },
  es: {
    slug: 'plantilla-conciliacion-bancaria',
    title: 'Plantilla gratuita de conciliación bancaria para ONG y asociaciones',
    description:
      'Descarga una plantilla gratuita en Excel o CSV para controlar la conciliación bancaria de una ONG o asociación, detectar diferencias y dejar cada movimiento revisado.',
    eyebrow: 'Recurso gratuito · Excel y CSV',
    subtitle:
      'Una hoja sencilla para comparar el extracto bancario con el registro interno, detectar diferencias y documentar qué queda pendiente.',
    downloadXlsx: 'Descarga el Excel',
    downloadCsv: 'Descarga el CSV',
    previewTitle: 'Qué encontrarás en la plantilla',
    columns: ['Fecha', 'Cuenta', 'Referencia', 'Concepto', 'Importe banco', 'Importe interno', 'Diferencia', 'Estado'],
    example: ['15/01/2026', 'Cuenta principal', 'EJEMPLO-001', 'Cuota socio enero', '50,00 €', '50,00 €', '0,00 €', 'Conciliado'],
    whyTitle: 'Por qué es útil',
    whyIntro:
      'La plantilla está pensada para entidades pequeñas y medianas que todavía trabajan con extractos y hojas de cálculo.',
    benefits: [
      'Unifica en una sola fila el movimiento bancario y el registro interno.',
      'Calcula la diferencia y permite ver rápidamente qué no cuadra.',
      'Separa movimientos conciliados, pendientes, duplicados y no identificados.',
      'Deja constancia de la revisión, la persona responsable y las observaciones.',
    ],
    stepsTitle: 'Cómo utilizarla',
    steps: [
      {
        title: 'Importa o copia los movimientos',
        body: 'Añade una fila por cada movimiento del extracto. No incluyas datos personales que no necesites para el control.',
      },
      {
        title: 'Compara con el registro interno',
        body: 'Indica el importe contabilizado o registrado por la entidad. La plantilla calcula la diferencia.',
      },
      {
        title: 'Asigna un estado',
        body: 'Marca cada fila como conciliada, pendiente, duplicada o no identificada y documenta el siguiente paso.',
      },
      {
        title: 'Cierra la revisión',
        body: 'Filtra las diferencias distintas de cero y los estados pendientes antes de dar el periodo por revisado.',
      },
    ],
    checksTitle: 'Comprobaciones antes de cerrar el mes',
    checks: [
      'El saldo inicial y el saldo final coinciden con el extracto.',
      'No hay referencias bancarias duplicadas.',
      'Todas las diferencias están explicadas o tienen una acción pendiente.',
      'La fecha y la persona revisora han quedado registradas.',
    ],
    disclaimer:
      'Es una herramienta de control interno. No sustituye la contabilidad oficial ni el asesoramiento profesional que pueda necesitar la entidad.',
    productLink: '/es/conciliacio-bancaria-ong',
    productLinkLabel: 'Descubre cómo Summa Social facilita la conciliación bancaria',
  },
};

const RESOURCE_FILES: Record<ResourceLocale, { xlsx: string; csv: string }> = {
  ca: {
    xlsx: '/recursos/plantilla-conciliacio-bancaria-ong-ca.xlsx',
    csv: '/recursos/plantilla-conciliacio-bancaria-ong-ca.csv',
  },
  es: {
    xlsx: '/recursos/plantilla-conciliacion-bancaria-ong-es.xlsx',
    csv: '/recursos/plantilla-conciliacion-bancaria-ong-es.csv',
  },
};

function getResourceLocale(lang: string): ResourceLocale {
  return lang === 'ca' ? 'ca' : 'es';
}

function getResourceUrl(locale: ResourceLocale): string {
  return `${PUBLIC_SITE_URL}/${locale}/recursos/${RESOURCE[locale].slug}`;
}

export function generateStaticParams() {
  return (['ca', 'es'] as const).map((lang) => ({
    lang,
    resourceSlug: RESOURCE[lang].slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, resourceSlug } = await params;
  if (!isValidPublicLocale(lang)) return {};

  const locale = getResourceLocale(lang);
  const copy = RESOURCE[locale];
  const canonical = getResourceUrl(locale);
  const isCanonicalRoute = lang === locale && resourceSlug === copy.slug;

  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical,
      languages: {
        ca: getResourceUrl('ca'),
        es: getResourceUrl('es'),
        'x-default': getResourceUrl('ca'),
      },
    },
    robots: {
      index: isCanonicalRoute,
      follow: true,
    },
    openGraph: {
      title: copy.title,
      description: copy.description,
      url: canonical,
      siteName: 'Summa Social',
      locale: locale === 'ca' ? 'ca_ES' : 'es_ES',
      alternateLocale: [locale === 'ca' ? 'es_ES' : 'ca_ES'],
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: copy.title,
      description: copy.description,
    },
  };
}

export default async function BankReconciliationResourcePage({ params }: PageProps) {
  const { lang, resourceSlug } = await params;
  if (!isValidPublicLocale(lang)) notFound();

  const locale = getResourceLocale(lang);
  const copy = RESOURCE[locale];

  if (lang !== locale || resourceSlug !== copy.slug) {
    permanentRedirect(`/${locale}/recursos/${copy.slug}`);
  }

  const files = RESOURCE_FILES[locale];
  const pageUrl = getResourceUrl(locale);
  const jsonLd = [
    buildPublicBreadcrumbJsonLd({
      locale,
      path: `/recursos/${copy.slug}`,
      currentName: copy.title,
    }),
    {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      '@id': `${pageUrl}#resource`,
      name: copy.title,
      description: copy.description,
      url: pageUrl,
      inLanguage: locale,
      isAccessibleForFree: true,
      author: {
        '@id': `${PUBLIC_SITE_URL}/#organization`,
        '@type': 'Organization',
        name: 'Summa Social',
      },
      encoding: [
        {
          '@type': 'MediaObject',
          contentUrl: `${PUBLIC_SITE_URL}${files.xlsx}`,
          encodingFormat:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        {
          '@type': 'MediaObject',
          contentUrl: `${PUBLIC_SITE_URL}${files.csv}`,
          encodingFormat: 'text/csv',
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-950">
      <PublicJsonLd data={jsonLd} />
      <PublicSiteHeader locale={locale} currentSection="features" />

      <main>
        <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(186,230,253,0.5),transparent_42%),linear-gradient(180deg,#f8fafc_0%,#fff_100%)]">
          <div className={`${PUBLIC_WIDE_SHELL} py-20 sm:py-28`}>
            <div className="max-w-4xl">
              <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
                {copy.eyebrow}
              </p>
              <h1 className="text-4xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-6xl">
                {copy.title}
              </h1>
              <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-600 sm:text-xl">
                {copy.subtitle}
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  href={files.xlsx}
                  download
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <Download className="h-4 w-4" />
                  {copy.downloadXlsx}
                </a>
                <a
                  href={files.csv}
                  download
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 transition hover:border-sky-300 hover:bg-sky-50"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {copy.downloadCsv}
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className={`${PUBLIC_WIDE_SHELL} py-16 sm:py-24`}>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.65fr)]">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                {copy.previewTitle}
              </h2>
              <div className="mt-7 overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-[0_28px_80px_-50px_rgba(15,23,42,0.35)]">
                <table className="min-w-[850px] w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      {copy.columns.map((column) => (
                        <th key={column} className="px-4 py-3 font-semibold">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-200 text-slate-700">
                      {copy.example.map((value, index) => (
                        <td key={`${copy.columns[index]}-${value}`} className="whitespace-nowrap px-4 py-4">
                          {value}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="rounded-3xl border border-sky-100 bg-sky-50/70 p-7 sm:p-8">
              <ShieldCheck className="h-9 w-9 text-sky-700" />
              <h2 className="mt-5 text-2xl font-semibold text-slate-950">{copy.whyTitle}</h2>
              <p className="mt-3 leading-7 text-slate-600">{copy.whyIntro}</p>
              <ul className="mt-6 space-y-4">
                {copy.benefits.map((benefit) => (
                  <li key={benefit} className="flex gap-3 text-sm leading-6 text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-50">
          <div className={`${PUBLIC_WIDE_SHELL} py-16 sm:py-24`}>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
              {copy.stepsTitle}
            </h2>
            <div className="mt-9 grid gap-5 md:grid-cols-2">
              {copy.steps.map((step, index) => (
                <article key={step.title} className="rounded-3xl border border-slate-200 bg-white p-7">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-800">
                    {index + 1}
                  </span>
                  <h3 className="mt-5 text-xl font-semibold text-slate-950">{step.title}</h3>
                  <p className="mt-3 leading-7 text-slate-600">{step.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={`${PUBLIC_WIDE_SHELL} py-16 sm:py-24`}>
          <div className="grid gap-10 rounded-[2rem] bg-slate-950 p-8 text-white sm:p-12 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">{copy.checksTitle}</h2>
              <ul className="mt-7 grid gap-4 sm:grid-cols-2">
                {copy.checks.map((check) => (
                  <li key={check} className="flex gap-3 text-sm leading-6 text-slate-200">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
                    <span>{check}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-8 max-w-3xl text-sm leading-6 text-slate-400">{copy.disclaimer}</p>
            </div>
            <Link
              href={copy.productLink}
              className="inline-flex items-center gap-2 text-sm font-semibold text-sky-300 transition hover:text-sky-200"
            >
              {copy.productLinkLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <PublicSiteFooter locale={locale} />
    </div>
  );
}
