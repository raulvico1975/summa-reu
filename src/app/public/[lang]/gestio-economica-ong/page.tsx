import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { PublicDirectContact } from '@/components/public/PublicDirectContact';
import { Button } from '@/components/ui/button';
import {
  generatePublicPageMetadata,
  isValidPublicLocale,
} from '@/lib/public-locale';
import {
  getPublicLandingBySlug,
  getPublicLandingContent,
  getPublicLandingMetadata,
} from '@/lib/public-landings';

interface PageProps {
  params: Promise<{ lang: string }>;
}

const HUB_METADATA = {
  title: 'Gestió econòmica per a ONG | Ordre en donacions, quotes i fiscalitat | Summa Social',
  description:
    'Ordena la gestió econòmica de la teva ONG: donacions, quotes, conciliació bancària i fiscalitat amb menys feina manual i una visió clara del dia a dia.',
};

const HUB_GROUPS = [
  {
    title: 'Moviments i conciliació bancària',
    intro:
      "Per deixar enrere extractes dispersos i quadrar els moviments amb més criteri, control i traçabilitat.",
    slugs: ['conciliacio-bancaria-ong', 'importar-extracte-bancari'],
  },
  {
    title: 'Socis, donants i quotes',
    intro:
      'Per seguir quotes, aportacions i incidències recurrents sense dependre de fulls separats ni revisions manuals.',
    slugs: ['gestio-donants', 'control-donacions-ong', 'remeses-sepa', 'devolucions-rebuts-socis'],
  },
  {
    title: 'Fiscalitat',
    intro:
      'Per arribar al tancament fiscal amb la informació preparada, revisada i més fàcil de justificar.',
    slugs: ['model-182', 'certificats-donacio', 'model-347-ong'],
  },
  {
    title: 'Visió general',
    intro:
      'Per a entitats que volen una visió clara de com ordenar tota la gestió econòmica i reduir feina manual.',
    slugs: ['software-gestion-ong', 'programa-associacions'],
  },
] as const;

export function generateStaticParams() {
  return [{ lang: 'ca' }];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isValidPublicLocale(lang) || lang !== 'ca') return {};

  return {
    title: HUB_METADATA.title,
    description: HUB_METADATA.description,
    ...generatePublicPageMetadata('ca', '/gestio-economica-ong'),
  };
}

export default async function GestioEconomicaOngHubPage({ params }: PageProps) {
  const { lang } = await params;

  if (!isValidPublicLocale(lang) || lang !== 'ca') {
    notFound();
  }

  const groups = HUB_GROUPS.map((group) => ({
    ...group,
    items: group.slugs.map((slug) => {
      const landing = getPublicLandingBySlug(slug);
      if (!landing) {
        throw new Error(`Landing no trobada al recorregut públic: ${slug}`);
      }

      const content = getPublicLandingContent(landing, 'ca');
      const metadata = getPublicLandingMetadata(landing, 'ca');

      return {
        slug,
        title: content.hero.title,
        description: metadata.description,
      };
    }),
  }));

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/ca">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Tornar a l&apos;inici
            </Link>
          </Button>
        </div>
      </div>

      <article className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-16 space-y-6">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Posa ordre a la gestió econòmica de la teva ONG
            </h1>
            <p className="text-lg text-muted-foreground">
              Si avui combines Excel, extractes bancaris i eines disperses per gestionar donacions, quotes i
              fiscalitat, aquí tens per on començar a simplificar-ho.
            </p>
          </div>

          <div className="space-y-4 text-muted-foreground">
            <p>
              Aquí trobaràs els processos que més acostumen a encallar el dia a dia d&apos;una entitat:
              conciliació bancària, seguiment de donants i quotes, devolucions i preparació fiscal amb la
              informació al seu lloc.
            </p>
            <p>
              L&apos;objectiu és tenir més control, menys feina manual i una visió clara del que passa, sense
              haver d&apos;anar saltant entre fulls, correus i eines separades.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/ca/contact">
                  Demana una demostració
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link href="/ca/funcionalitats">Veure funcionalitats generals</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Sessió breu, amb exemples reals i sense compromís.
            </p>
          </div>
        </header>

        <div className="space-y-12">
          {groups.map((group) => (
            <section key={group.title}>
              <h2 className="text-2xl font-bold mb-3">{group.title}</h2>
              <p className="text-muted-foreground mb-6">{group.intro}</p>

              <div className="grid gap-4 md:grid-cols-2">
                {group.items.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/ca/${item.slug}`}
                    className="rounded-xl border border-border/60 p-5 transition-colors hover:border-primary/40 hover:bg-muted/30"
                  >
                    <p className="font-medium mb-2">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}

          <section className="border-t pt-10">
            <h2 className="text-2xl font-bold mb-3">Demana una demostració</h2>
            <p className="text-muted-foreground mb-4">
              T&apos;ensenyem com ordenar donacions, quotes, bancs i fiscalitat segons la realitat de la teva
              entitat, perquè puguis valorar si et resol els colls d&apos;ampolla reals.
            </p>
            <div className="space-y-6">
              <Button asChild size="lg">
                <Link href="/ca/contact">Demana una demostració</Link>
              </Button>
              <p className="text-sm text-muted-foreground">
                Sessió breu, amb exemples reals i sense compromís.
              </p>
              <PublicDirectContact locale="ca" className="pt-2" />
            </div>
          </section>
        </div>
      </article>
    </main>
  );
}
