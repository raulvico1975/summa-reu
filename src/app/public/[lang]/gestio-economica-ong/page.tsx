import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { PublicDirectContact } from '@/components/public/PublicDirectContact';
import { PublicSiteFooter } from '@/components/public/PublicSiteFooter';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';
import { Button } from '@/components/ui/button';
import {
  generatePublicPageMetadata,
  isValidPublicLocale,
  type PublicLocale,
} from '@/lib/public-locale';
import {
  getPublicLandingBySlug,
  getPublicLandingContent,
  getPublicLandingMetadata,
} from '@/lib/public-landings';

interface PageProps {
  params: Promise<{ lang: string }>;
}

type SupportedGuideLocale = 'ca' | 'es';

type HubGroupDefinition = {
  id: string;
  title: string;
  intro: string;
  slugs: string[];
};

const pageShellClass =
  'min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#ffffff_28%,#ffffff_100%)]';

const HUB_COPY: Record<
  SupportedGuideLocale,
  {
    metadata: { title: string; description: string };
    backToHome: string;
    eyebrow: string;
    title: string;
    lead: string;
    note: string;
    primaryCta: string;
    secondaryCta: string;
    helper: string;
    demoReady: string;
    demoSoon: string;
    finalTitle: string;
    finalDescription: string;
    finalSupport: string;
    groups: HubGroupDefinition[];
  }
> = {
  ca: {
    metadata: {
      title: 'Gestió econòmica per a ONG | Ordre en donacions, quotes i fiscalitat | Summa Social',
      description:
        'Ordena la gestió econòmica de la teva ONG: donacions, quotes, conciliació bancària i fiscalitat amb menys feina manual i una visió clara del dia a dia.',
    },
    backToHome: "Tornar a l'inici",
    eyebrow: 'Guia detallada',
    title: 'Posa ordre a la gestió econòmica de la teva ONG',
    lead:
      'Si avui combineu Excel, extractes bancaris i eines disperses per gestionar donacions, quotes i fiscalitat, aquí tens el recorregut més útil per entendre com quedaria ordenat dins de Summa.',
    note:
      'Cada pàgina de detall ja queda preparada per afegir-hi el vídeo de demo quan el tingueu a punt, de manera que la navegació i el relat comercial queden tancats des d’ara.',
    primaryCta: 'Demana una demostració',
    secondaryCta: 'Veure funcionalitats generals',
    helper: 'Sessió breu, amb exemples reals i sense compromís.',
    demoReady: 'Demo visual disponible',
    demoSoon: 'Vídeo de demo aviat',
    finalTitle: 'Vols veure només el bloc que avui us genera més fricció?',
    finalDescription:
      'Us podem ensenyar la part de conciliació, remeses, devolucions o fiscalitat sense fer una demo genèrica. Així podreu valorar ràpidament si l’encaix és real.',
    finalSupport: 'Si després hi afegiu els vídeos, aquesta guia ja queda preparada per actuar com a porta d’entrada principal al detall.',
    groups: [
      {
        id: 'moviments-conciliacio',
        title: 'Moviments i conciliació bancària',
        intro:
          'Per deixar enrere extractes dispersos i quadrar ingressos i despeses amb més criteri, control i traçabilitat.',
        slugs: ['conciliacio-bancaria-ong', 'importar-extracte-bancari'],
      },
      {
        id: 'quotes-devolucions-donacions',
        title: 'Quotes, devolucions i donacions',
        intro:
          'Per seguir cobraments recurrents, incidències i historial de donants sense dependre de fulls separats ni revisions manuals.',
        slugs: ['remeses-sepa', 'devolucions-rebuts-socis', 'control-donacions-ong'],
      },
      {
        id: 'fiscalitat',
        title: 'Fiscalitat i certificats',
        intro:
          'Per arribar al tancament amb la informació preparada, revisada i molt més fàcil d’explicar a la gestoria o a l’equip.',
        slugs: ['model-182', 'certificats-donacio', 'model-347-ong'],
      },
    ],
  },
  es: {
    metadata: {
      title: 'Gestión económica para ONG | Orden en donaciones, cuotas y fiscalidad | Summa Social',
      description:
        'Ordena la gestión económica de tu ONG: donaciones, cuotas, conciliación bancaria y fiscalidad con menos trabajo manual y una visión clara del día a día.',
    },
    backToHome: 'Volver al inicio',
    eyebrow: 'Guía detallada',
    title: 'Pon orden en la gestión económica de tu ONG',
    lead:
      'Si hoy combináis Excel, extractos bancarios y herramientas dispersas para gestionar donaciones, cuotas y fiscalidad, aquí tenéis el recorrido más útil para entender cómo quedaría ordenado dentro de Summa.',
    note:
      'Cada página de detalle queda ya preparada para añadir el vídeo de demo cuando lo tengáis listo, de forma que la navegación y el relato comercial quedan montados desde ahora.',
    primaryCta: 'Pedir una demostración',
    secondaryCta: 'Ver funcionalidades generales',
    helper: 'Sesión breve, con ejemplos reales y sin compromiso.',
    demoReady: 'Demo visual disponible',
    demoSoon: 'Vídeo demo próximamente',
    finalTitle: '¿Queréis ver solo el bloque que hoy os genera más fricción?',
    finalDescription:
      'Podemos enseñaros la parte de conciliación, remesas, devoluciones o fiscalidad sin hacer una demo genérica. Así podréis valorar rápido si el encaje es real.',
    finalSupport:
      'Cuando añadáis los vídeos, esta guía ya quedará preparada para actuar como puerta de entrada principal al detalle.',
    groups: [
      {
        id: 'movimientos-conciliacion',
        title: 'Movimientos y conciliación bancaria',
        intro:
          'Para dejar atrás extractos dispersos y cuadrar ingresos y gastos con más criterio, control y trazabilidad.',
        slugs: ['conciliacio-bancaria-ong', 'importar-extracte-bancari'],
      },
      {
        id: 'cuotas-devoluciones-donaciones',
        title: 'Cuotas, devoluciones y donaciones',
        intro:
          'Para seguir cobros recurrentes, incidencias e historial de donantes sin depender de hojas separadas ni revisiones manuales.',
        slugs: ['remeses-sepa', 'devolucions-rebuts-socis', 'control-donacions-ong'],
      },
      {
        id: 'fiscalidad',
        title: 'Fiscalidad y certificados',
        intro:
          'Para llegar al cierre con la información preparada, revisada y mucho más fácil de explicar a la gestoría o al equipo.',
        slugs: ['model-182', 'certificats-donacio', 'model-347-ong'],
      },
    ],
  },
};

function isSupportedGuideLocale(locale: string): locale is SupportedGuideLocale {
  return locale === 'ca' || locale === 'es';
}

export function generateStaticParams() {
  return [{ lang: 'ca' }, { lang: 'es' }];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isValidPublicLocale(lang) || !isSupportedGuideLocale(lang)) return {};

  const copy = HUB_COPY[lang];

  return {
    title: copy.metadata.title,
    description: copy.metadata.description,
    ...generatePublicPageMetadata(lang, '/gestio-economica-ong'),
  };
}

export default async function GestioEconomicaOngHubPage({ params }: PageProps) {
  const { lang } = await params;

  if (!isValidPublicLocale(lang) || !isSupportedGuideLocale(lang)) {
    notFound();
  }

  const locale = lang as SupportedGuideLocale;
  const copy = HUB_COPY[locale];
  const groups = copy.groups.map((group) => ({
    ...group,
    items: group.slugs.map((slug) => {
      const landing = getPublicLandingBySlug(slug);

      if (!landing) {
        throw new Error(`Landing no trobada al recorregut públic: ${slug}`);
      }

      const content = getPublicLandingContent(landing, locale);
      const metadata = getPublicLandingMetadata(landing, locale);

      return {
        slug,
        title: content.hero.title,
        description: metadata.description,
        hasDemoVideo: Boolean(content.hero.media),
      };
    }),
  }));

  return (
    <main className={pageShellClass}>
      <PublicSiteHeader locale={locale} currentSection="features" />

      <section className="px-6 pb-10 pt-8 lg:pt-12">
        <div className="mx-auto max-w-6xl">
          <Button asChild variant="ghost" size="sm" className="rounded-full px-4 text-muted-foreground hover:text-foreground">
            <Link href={`/${locale}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {copy.backToHome}
            </Link>
          </Button>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-end">
            <div className="space-y-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                {copy.eyebrow}
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                {copy.title}
              </h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                {copy.lead}
              </p>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                {copy.note}
              </p>
            </div>

            <div className="rounded-[2rem] border border-sky-200/70 bg-white/92 p-6 shadow-[0_30px_90px_-56px_rgba(14,165,233,0.36)] sm:p-7">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                {copy.eyebrow}
              </p>
              <div className="mt-5 space-y-4">
                {groups.map((group) => (
                  <a
                    key={group.id}
                    href={`#${group.id}`}
                    className="group block rounded-[1.25rem] border border-sky-100 bg-sky-50/70 px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white"
                  >
                    <p className="text-sm font-medium leading-6 text-foreground">{group.title}</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-sm leading-6 text-muted-foreground">{group.intro}</p>
                      <ArrowRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={`/${locale}/contact`}>
                {copy.primaryCta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={`/${locale}/funcionalitats`}>{copy.secondaryCta}</Link>
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{copy.helper}</p>
        </div>
      </section>

      <section className="px-6 pb-8">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
          {groups.map((group) => (
            <div
              key={group.id}
              className="rounded-[1.5rem] border border-border/60 bg-white/85 p-5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.16)]"
            >
              <p className="text-sm font-semibold text-foreground">{group.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{group.intro}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-6 px-6 pb-10">
        {groups.map((group, index) => (
          <section key={group.id} id={group.id} className="mx-auto max-w-6xl scroll-mt-24">
            <div
              className={
                index % 2 === 0
                  ? 'rounded-[2.2rem] border border-border/60 bg-white/92 p-6 shadow-[0_28px_80px_-56px_rgba(15,23,42,0.2)] sm:p-8 lg:p-10'
                  : 'rounded-[2.2rem] border border-sky-200/70 bg-[linear-gradient(135deg,rgba(14,165,233,0.08),rgba(255,255,255,0.96)_45%,rgba(240,249,255,0.9))] p-6 shadow-[0_30px_90px_-56px_rgba(14,165,233,0.3)] sm:p-8 lg:p-10'
              }
            >
              <div className="max-w-3xl space-y-3">
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">{group.title}</h2>
                <p className="text-base leading-7 text-muted-foreground">{group.intro}</p>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/${locale}/${item.slug}`}
                    className="group rounded-[1.4rem] border border-border/60 bg-white/92 p-5 shadow-[0_20px_60px_-44px_rgba(15,23,42,0.14)] transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-foreground">{item.title}</p>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
                    <span className="mt-4 inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/90">
                      {item.hasDemoVideo ? copy.demoReady : copy.demoSoon}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="px-6 pb-20 pt-4">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-sky-200/70 bg-[linear-gradient(135deg,rgba(14,165,233,0.14),rgba(255,255,255,0.96)_45%,rgba(240,249,255,0.92))] p-6 shadow-[0_30px_90px_-56px_rgba(14,165,233,0.42)] sm:p-8 lg:p-10">
          <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground lg:text-[2.2rem]">
            {copy.finalTitle}
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            {copy.finalDescription}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{copy.finalSupport}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={`/${locale}/contact`}>
                {copy.primaryCta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/${locale}/funcionalitats`}>{copy.secondaryCta}</Link>
            </Button>
          </div>
          <div className="mt-8 border-t border-sky-200/80 pt-6">
            <PublicDirectContact locale={locale} className="pt-0" />
          </div>
        </div>
      </section>

      <PublicSiteFooter locale={locale} />
    </main>
  );
}
