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
  title: 'Gestió econòmica per a ONG | Hub de landings públiques | Summa Social',
  description:
    "Hub central de gestió econòmica per a ONG i associacions: conciliació bancària, donants, remeses SEPA, devolucions, Model 182, certificats i Model 347.",
};

const HUB_GROUPS = [
  {
    title: 'Moviments i conciliació bancària',
    intro:
      "Pàgines orientades a ordenar l'entrada d'extractes, la lectura dels moviments i la conciliació del dia a dia.",
    slugs: ['conciliacio-bancaria-ong', 'importar-extracte-bancari'],
  },
  {
    title: 'Socis, donants i quotes',
    intro:
      'Peces per entendre la base de donants, cobrar quotes i controlar devolucions o incidències recurrents.',
    slugs: ['gestio-donants', 'control-donacions-ong', 'remeses-sepa', 'devolucions-rebuts-socis'],
  },
  {
    title: 'Fiscalitat',
    intro:
      'Landings centrades en el tancament fiscal i en la preparació de la informació que després va a la gestoria o a l’AEAT.',
    slugs: ['model-182', 'certificats-donacio', 'model-347-ong'],
  },
  {
    title: 'Visió general',
    intro:
      'Entrades més àmplies per a entitats que encara estan valorant el sistema complet o una alternativa a Excel.',
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
        throw new Error(`Landing no trobada al hub: ${slug}`);
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
              Gestió econòmica per a ONG i associacions
            </h1>
            <p className="text-lg text-muted-foreground">
              Un hub central per entendre com encaixen la conciliació bancària, la gestió de donants, les
              remeses i la fiscalitat dins de Summa Social.
            </p>
          </div>

          <div className="space-y-4 text-muted-foreground">
            <p>
              Aquest clúster agrupa les pàgines públiques que expliquen el nucli del producte: importar i
              conciliar moviments, controlar socis i donants, resoldre devolucions i arribar als models fiscals
              amb la informació ordenada.
            </p>
            <p>
              Si estàs valorant Summa Social o vols ubicar una funcionalitat concreta dins del conjunt, des
              d&apos;aquí tens tots els punts d&apos;entrada del sistema.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/ca/contact">
                Demana una demostració
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/ca/funcionalitats">Veure funcionalitats generals</Link>
            </Button>
          </div>

          <PublicDirectContact locale="ca" />
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
            <h2 className="text-2xl font-bold mb-3">Vols veure com encaixa a la teva entitat?</h2>
            <p className="text-muted-foreground mb-4">
              Si avui la gestió econòmica encara depèn d&apos;extractes, Excels i revisions manuals, aquest
              clúster et mostra les peces que Summa Social ordena dins d&apos;un únic sistema.
            </p>
            <div className="space-y-6">
              <Button asChild size="lg">
                <Link href="/ca/contact">Demana una demostració per a la teva entitat.</Link>
              </Button>
              <PublicDirectContact locale="ca" />
            </div>
          </section>
        </div>
      </article>
    </main>
  );
}
