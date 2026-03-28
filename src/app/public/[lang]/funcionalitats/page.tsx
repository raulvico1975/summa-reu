import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { PublicSiteFooter } from '@/components/public/PublicSiteFooter';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';
import { Button } from '@/components/ui/button';
import {
  PUBLIC_LOCALES,
  isValidPublicLocale,
  generatePublicPageMetadata,
  type PublicLocale,
} from '@/lib/public-locale';
import {
  getPublicLandingBySlug,
  getPublicLandingContent,
  getPublicLandingMetadata,
} from '@/lib/public-landings';
import {
  getPublicDetailedGuidesLocale,
  getPublicEconomicGuideHref,
  hasPublicDetailedGuides,
} from '@/lib/public-site-paths';
import { cn } from '@/lib/utils';
import { getPublicTranslations } from '@/i18n/public';

interface PageProps {
  params: Promise<{ lang: string }>;
}

type FeatureCard = {
  id?: string;
  title: string;
  description?: string;
  bullets: string[];
  note?: string;
};

type FeatureSectionKey = 'treasury' | 'remittances' | 'expenses' | 'donations' | 'projects' | 'platform';

type FeatureDetailLink = {
  href: string;
  title: string;
  description: string;
  hasDemoVideo: boolean;
};

type FeatureSection = {
  key: FeatureSectionKey;
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  cards: FeatureCard[];
  detailLinks?: FeatureDetailLink[];
};

const pageShellClass =
  'min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#ffffff_26%,#ffffff_100%)]';

const sectionSurfaceClass =
  'rounded-[2.2rem] border border-border/60 bg-white/92 p-6 shadow-[0_28px_80px_-56px_rgba(15,23,42,0.2)] sm:p-8 lg:p-10';

const tintedSectionSurfaceClass =
  'rounded-[2.2rem] border border-sky-200/70 bg-[linear-gradient(135deg,rgba(14,165,233,0.08),rgba(255,255,255,0.96)_45%,rgba(240,249,255,0.9))] p-6 shadow-[0_30px_90px_-56px_rgba(14,165,233,0.3)] sm:p-8 lg:p-10';

const cardClass =
  'rounded-[1.6rem] border border-border/60 bg-white/92 p-5 shadow-[0_20px_60px_-44px_rgba(15,23,42,0.14)]';

const detailPanelClass =
  'rounded-[1.55rem] border border-sky-100 bg-white/90 p-5 shadow-[0_20px_55px_-46px_rgba(14,165,233,0.32)]';

const FEATURE_DETAIL_SLUGS: Partial<Record<FeatureSectionKey, string[]>> = {
  treasury: ['conciliacio-bancaria-ong', 'importar-extracte-bancari'],
  remittances: ['remeses-sepa', 'devolucions-rebuts-socis'],
  donations: ['control-donacions-ong', 'model-182', 'certificats-donacio', 'model-347-ong'],
};

const DETAIL_PANEL_COPY: Record<
  PublicLocale,
  {
    eyebrow: string;
    lead: string;
    demoReady: string;
    demoSoon: string;
    guideCta: string;
  }
> = {
  ca: {
    eyebrow: 'Aprofundir',
    lead: 'Aquestes pàgines entren al detall del procés i quedaran preparades per incorporar-hi la demo en vídeo.',
    demoReady: 'Demo visual disponible',
    demoSoon: 'Vídeo de demo aviat',
    guideCta: 'Explorar totes les pàgines detallades',
  },
  es: {
    eyebrow: 'Profundizar',
    lead: 'Estas páginas entran en el detalle del proceso y quedarán listas para incorporar la demo en vídeo.',
    demoReady: 'Demo visual disponible',
    demoSoon: 'Vídeo demo próximamente',
    guideCta: 'Explorar todas las páginas detalladas',
  },
  fr: {
    eyebrow: 'Approfondir',
    lead: 'Ces pages détaillées sont déjà disponibles en espagnol et resteront prêtes à accueillir la démo vidéo.',
    demoReady: 'Démo visuelle disponible',
    demoSoon: 'Démo vidéo bientôt',
    guideCta: 'Explorer les pages détaillées en espagnol',
  },
  pt: {
    eyebrow: 'Aprofundar',
    lead: 'Estas páginas detalhadas já estão disponíveis em espanhol e ficam preparadas para receber a demo em vídeo.',
    demoReady: 'Demo visual disponível',
    demoSoon: 'Vídeo demo em breve',
    guideCta: 'Explorar páginas detalhadas em espanhol',
  },
};

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
    platform: string;
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
    platform: 'plataforma-informes-seguretat',
  },
  es: {
    conciliation: 'conciliacion-bancaria',
    remittances: 'remesas-devoluciones',
    expensesSepa: 'gastos-pagos-sepa',
    ticketsSettlements: 'tickets-liquidaciones',
    fiscal: 'fiscalidad-certificados',
    onlineDonations: 'donaciones-online',
    projects: 'modulo-proyectos',
    platform: 'plataforma-informes-seguridad',
  },
  fr: {
    conciliation: 'rapprochement-bancaire',
    remittances: 'prelevements-rejets',
    expensesSepa: 'factures-sepa',
    ticketsSettlements: 'tickets-notes-frais',
    fiscal: 'fiscalite-certificats',
    onlineDonations: 'dons-en-ligne',
    projects: 'module-projets',
    platform: 'plateforme-rapports-securite',
  },
  pt: {
    conciliation: 'reconciliacao-bancaria',
    remittances: 'remessas-devolucoes',
    expensesSepa: 'faturas-sepa',
    ticketsSettlements: 'tickets-liquidacoes',
    fiscal: 'fiscalidade-certificados',
    onlineDonations: 'doacoes-online',
    projects: 'modulo-projetos',
    platform: 'plataforma-relatorios-seguranca',
  },
};

const FEATURES_PAGE_COPY: Record<
  PublicLocale,
  {
    heroTitle: string;
    heroLead: string;
    heroNote: string;
    quickNavTitle: string;
    sectionLabels: {
      treasury: string;
      remittances: string;
      expenses: string;
      donations: string;
      projects: string;
      platform: string;
    };
    donationsTitle: string;
    donationsDescription: string;
    platformTitle: string;
    platformDescription: string;
    finalEyebrow: string;
    finalTitle: string;
    finalDescription: string;
  }
> = {
  ca: {
    heroTitle: 'Entendre Summa és més fàcil si ho mirem per blocs',
    heroLead:
      'El nucli resol tresoreria, quotes, donacions i fiscalitat. El mòdul de projectes només s’hi afegeix si realment el necessiteu.',
    heroNote:
      'Aquesta pàgina no enumera només funcionalitats: explica com s’ordena la gestió perquè un primer visitant entengui ràpidament per què li pot servir.',
    quickNavTitle: 'Mapa ràpid',
    sectionLabels: {
      treasury: 'Tresoreria',
      remittances: 'Quotes i devolucions',
      expenses: 'Pagaments i despeses',
      donations: 'Donacions i fiscalitat',
      projects: 'Projectes',
      platform: 'Plataforma',
    },
    donationsTitle: 'Donacions online, fiscalitat i seguiment de compliment',
    donationsDescription:
      'Quan entren donacions per web o toca preparar fiscalitat, Summa manté el vincle entre cada aportació, la persona que l’ha feta i el que després s’ha de declarar o certificar.',
    platformTitle: 'Plataforma, informes i seguretat',
    platformDescription:
      'A més del flux operatiu, Summa dona control d’accés, exportació i un marc segur perquè la informació es pugui compartir amb equip, junta o gestoria.',
    finalEyebrow: 'Si voleu valorar encaix',
    finalTitle: 'Us podem ensenyar només el bloc que avui us genera més fricció',
    finalDescription:
      'No cal començar per tot. Normalment l’entrada és tresoreria, remeses o fiscalitat, i la resta s’afegeix quan realment aporta valor.',
  },
  es: {
    heroTitle: 'Entender Summa es más fácil si lo miramos por bloques',
    heroLead:
      'El núcleo resuelve tesorería, cuotas, donaciones y fiscalidad. El módulo de proyectos solo se añade si de verdad lo necesitáis.',
    heroNote:
      'Esta página no enumera solo funcionalidades: explica cómo se ordena la gestión para que un primer visitante entienda rápido por qué puede servirle.',
    quickNavTitle: 'Mapa rápido',
    sectionLabels: {
      treasury: 'Tesorería',
      remittances: 'Cuotas y devoluciones',
      expenses: 'Pagos y gastos',
      donations: 'Donaciones y fiscalidad',
      projects: 'Proyectos',
      platform: 'Plataforma',
    },
    donationsTitle: 'Donaciones online, fiscalidad y seguimiento de cumplimiento',
    donationsDescription:
      'Cuando entran donaciones por web o toca preparar fiscalidad, Summa mantiene el vínculo entre cada aportación, la persona que la ha hecho y lo que después debe declararse o certificarse.',
    platformTitle: 'Plataforma, informes y seguridad',
    platformDescription:
      'Además del flujo operativo, Summa aporta control de acceso, exportación y un marco seguro para compartir la información con el equipo, la junta o la gestoría.',
    finalEyebrow: 'Si queréis valorar encaje',
    finalTitle: 'Podemos enseñaros solo el bloque que hoy os genera más fricción',
    finalDescription:
      'No hace falta empezar por todo. Normalmente la entrada es tesorería, remesas o fiscalidad, y el resto se añade cuando de verdad aporta valor.',
  },
  fr: {
    heroTitle: 'Comprendre Summa devient plus simple quand on le lit par blocs',
    heroLead:
      'Le noyau couvre trésorerie, cotisations, dons et fiscalité. Le module projets ne s’ajoute que lorsqu’il devient réellement utile.',
    heroNote:
      'Cette page ne se contente pas de lister des fonctions : elle explique comment la gestion s’ordonne pour qu’un premier visiteur comprenne vite l’utilité concrète du produit.',
    quickNavTitle: 'Vue rapide',
    sectionLabels: {
      treasury: 'Trésorerie',
      remittances: 'Cotisations et rejets',
      expenses: 'Paiements et dépenses',
      donations: 'Dons et fiscalité',
      projects: 'Projets',
      platform: 'Plateforme',
    },
    donationsTitle: 'Dons en ligne, fiscalité et suivi de conformité',
    donationsDescription:
      'Lorsque les dons arrivent depuis le web ou qu’il faut préparer la fiscalité, Summa garde le lien entre chaque contribution, la personne qui l’a faite et ce qui devra ensuite être déclaré ou certifié.',
    platformTitle: 'Plateforme, rapports et sécurité',
    platformDescription:
      'Au-delà du flux opérationnel, Summa apporte contrôle d’accès, export et cadre sécurisé pour partager l’information avec l’équipe, le conseil ou le cabinet comptable.',
    finalEyebrow: 'Si vous voulez vérifier le fit',
    finalTitle: 'Nous pouvons vous montrer uniquement le bloc qui vous crée le plus de friction aujourd’hui',
    finalDescription:
      'Il n’est pas nécessaire de tout activer d’un coup. En général, l’entrée se fait par la trésorerie, les prélèvements ou la fiscalité, puis le reste s’ajoute quand cela a du sens.',
  },
  pt: {
    heroTitle: 'Perceber o Summa é mais fácil quando o lemos por blocos',
    heroLead:
      'O núcleo resolve tesouraria, quotas, doações e fiscalidade. O módulo de projetos só entra quando faz mesmo sentido.',
    heroNote:
      'Esta página não se limita a enumerar funcionalidades: explica como a gestão se organiza para que um primeiro visitante perceba depressa por que motivo a aplicação lhe pode ser útil.',
    quickNavTitle: 'Mapa rápido',
    sectionLabels: {
      treasury: 'Tesouraria',
      remittances: 'Quotas e devoluções',
      expenses: 'Pagamentos e despesas',
      donations: 'Doações e fiscalidade',
      projects: 'Projetos',
      platform: 'Plataforma',
    },
    donationsTitle: 'Doações online, fiscalidade e acompanhamento de conformidade',
    donationsDescription:
      'Quando entram doações pelo site ou é preciso preparar a fiscalidade, o Summa mantém a ligação entre cada contribuição, a pessoa que a fez e aquilo que depois terá de ser declarado ou certificado.',
    platformTitle: 'Plataforma, relatórios e segurança',
    platformDescription:
      'Para além do fluxo operativo, o Summa traz controlo de acessos, exportação e um enquadramento seguro para partilhar a informação com a equipa, direção ou contabilidade externa.',
    finalEyebrow: 'Se quiserem avaliar o encaixe',
    finalTitle: 'Podemos mostrar-vos apenas o bloco que hoje vos cria mais fricção',
    finalDescription:
      'Não é preciso começar por tudo. Normalmente a entrada faz-se por tesouraria, remessas ou fiscalidade, e o restante junta-se quando realmente traz valor.',
  },
};

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

function stripOrdinalPrefix(title: string): string {
  return title.replace(/^\d+\.\s*/, '');
}

function buildDetailLinks(locale: PublicLocale, slugs: string[]): FeatureDetailLink[] {
  const detailLocale = getPublicDetailedGuidesLocale(locale);

  return slugs.flatMap((slug) => {
    const landing = getPublicLandingBySlug(slug);

    if (!landing) {
      return [];
    }

    const content = getPublicLandingContent(landing, detailLocale);
    const metadata = getPublicLandingMetadata(landing, detailLocale);

    return [
      {
        href: `/${detailLocale}/${slug}`,
        title: content.hero.title,
        description: metadata.description,
        hasDemoVideo: Boolean(content.hero.media),
      },
    ];
  });
}

function FeatureListCard({ card }: { card: FeatureCard }) {
  return (
    <article id={card.id} className={cardClass}>
      <h3 className="text-xl font-semibold tracking-tight text-foreground">{card.title}</h3>
      {card.description ? (
        <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">{card.description}</p>
      ) : null}
      {card.note ? (
        <div className="mt-4 rounded-[1.15rem] border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm leading-6 text-muted-foreground">
          {card.note}
        </div>
      ) : null}
      <ul className="mt-4 space-y-3">
        {card.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function SectionDetailLinks({
  locale,
  links,
}: {
  locale: PublicLocale;
  links: FeatureDetailLink[];
}) {
  const copy = DETAIL_PANEL_COPY[locale];

  if (links.length === 0) {
    return null;
  }

  return (
    <div className={detailPanelClass}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/85">{copy.eyebrow}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.lead}</p>

      <div className="mt-5 space-y-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group block rounded-[1.2rem] border border-sky-100 bg-sky-50/60 p-4 transition-all hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">{link.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{link.description}</p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
            </div>
            <span className="mt-4 inline-flex rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/90">
              {link.hasDemoVideo ? copy.demoReady : copy.demoSoon}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function FeaturesPage({ params }: PageProps) {
  const { lang } = await params;

  if (!isValidPublicLocale(lang)) {
    notFound();
  }

  const locale = lang as PublicLocale;
  const t = getPublicTranslations(locale);
  const anchors = SECTION_ANCHORS[locale];
  const copy = FEATURES_PAGE_COPY[locale];
  const f = t.features.list;
  const showDetailedGuides = hasPublicDetailedGuides(locale);
  const guideHref = getPublicEconomicGuideHref(locale);

  const sections: FeatureSection[] = [
    {
      key: 'treasury',
      id: anchors.conciliation,
      eyebrow: copy.sectionLabels.treasury,
      title: t.home.sections.conciliation.title,
      description: t.home.sections.conciliation.description,
      cards: [
        {
          id: anchors.conciliation,
          title: stripOrdinalPrefix(f.conciliation.title),
          description: f.conciliation.description,
          bullets: f.conciliation.bullets,
        },
        {
          title: stripOrdinalPrefix(f.aiAssignment.title),
          description: f.aiAssignment.description,
          bullets: f.aiAssignment.bullets,
        },
        {
          title: stripOrdinalPrefix(f.movementClassification.title),
          bullets: f.movementClassification.bullets,
        },
        {
          title: stripOrdinalPrefix(f.dashboard.title),
          bullets: f.dashboard.bullets,
        },
      ],
      detailLinks: showDetailedGuides ? buildDetailLinks(locale, FEATURE_DETAIL_SLUGS.treasury ?? []) : [],
    },
    {
      key: 'remittances',
      id: anchors.remittances,
      eyebrow: copy.sectionLabels.remittances,
      title: t.home.sections.remittances.title,
      description: t.home.sections.remittances.description,
      cards: [
        {
          id: anchors.remittances,
          title: stripOrdinalPrefix(f.remittancesDivider.title),
          description: f.remittancesDivider.description,
          bullets: f.remittancesDivider.bullets,
        },
        {
          title: stripOrdinalPrefix(f.bankReturns.title),
          bullets: f.bankReturns.bullets,
        },
        {
          title: stripOrdinalPrefix(f.multiContact.title),
          bullets: f.multiContact.bullets,
        },
      ],
      detailLinks: showDetailedGuides ? buildDetailLinks(locale, FEATURE_DETAIL_SLUGS.remittances ?? []) : [],
    },
    {
      key: 'expenses',
      id: anchors.expensesSepa,
      eyebrow: copy.sectionLabels.expenses,
      title: t.home.sections.invoicesSepa.title,
      description: t.home.sections.invoicesSepa.description,
      cards: [
        {
          id: anchors.expensesSepa,
          title: stripOrdinalPrefix(f.expensesSepa.title),
          description: f.expensesSepa.description,
          bullets: f.expensesSepa.bullets,
          note: f.expensesSepa.ticketsNote,
        },
        {
          id: anchors.ticketsSettlements,
          title: t.home.sections.ticketsSettlements.title,
          description: t.home.sections.ticketsSettlements.description,
          bullets: [f.expensesSepa.ticketsNote],
        },
      ],
    },
    {
      key: 'donations',
      id: anchors.onlineDonations,
      eyebrow: copy.sectionLabels.donations,
      title: copy.donationsTitle,
      description: copy.donationsDescription,
      cards: [
        {
          id: anchors.onlineDonations,
          title: stripOrdinalPrefix(f.stripeIntegration.title),
          description: t.home.sections.onlineDonations.description,
          bullets: f.stripeIntegration.bullets,
        },
        {
          id: anchors.fiscal,
          title: stripOrdinalPrefix(f.fiscal.title),
          description: f.fiscal.description,
          bullets: f.fiscal.bullets,
        },
        {
          title: stripOrdinalPrefix(f.donationCertificates.title),
          bullets: f.donationCertificates.bullets,
        },
        {
          title: stripOrdinalPrefix(f.alerts.title),
          bullets: f.alerts.bullets,
        },
      ],
      detailLinks: showDetailedGuides ? buildDetailLinks(locale, FEATURE_DETAIL_SLUGS.donations ?? []) : [],
    },
    {
      key: 'projects',
      id: anchors.projects,
      eyebrow: copy.sectionLabels.projects,
      title: t.home.sections.projects.title,
      description: t.home.sections.projects.description,
      cards: [
        {
          id: anchors.projects,
          title: stripOrdinalPrefix(f.projectsModule.title),
          bullets: f.projectsModule.bullets,
        },
      ],
    },
    {
      key: 'platform',
      id: anchors.platform,
      eyebrow: copy.sectionLabels.platform,
      title: copy.platformTitle,
      description: copy.platformDescription,
      cards: [
        {
          title: stripOrdinalPrefix(f.exports.title),
          bullets: f.exports.bullets,
        },
        {
          title: stripOrdinalPrefix(f.multiOrg.title),
          bullets: f.multiOrg.bullets,
        },
      ],
    },
  ];

  return (
    <main className={pageShellClass}>
      <PublicSiteHeader locale={locale} currentSection="features" />

      <section className="px-6 pb-12 pt-8 lg:pt-12">
        <div className="mx-auto max-w-6xl">
          <Button asChild variant="ghost" size="sm" className="rounded-full px-4 text-muted-foreground hover:text-foreground">
            <Link href={`/${locale}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t.common.backToHome}
            </Link>
          </Button>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-end">
            <div className="space-y-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                {t.common.features}
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                {copy.heroTitle}
              </h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                {copy.heroLead}
              </p>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                {copy.heroNote}
              </p>
            </div>

            <div className="rounded-[2rem] border border-sky-200/70 bg-white/92 p-6 shadow-[0_30px_90px_-56px_rgba(14,165,233,0.36)] sm:p-7">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                {copy.quickNavTitle}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {sections.map((section) => (
                  <Link
                    key={section.id}
                    href={`#${section.id}`}
                    className="group rounded-[1.25rem] border border-sky-100 bg-sky-50/70 px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/85">
                      {section.eyebrow}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-medium leading-6 text-foreground">{section.title}</p>
                      <ArrowRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-8">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-4">
          <div className="rounded-[1.5rem] border border-border/60 bg-white/85 p-5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.16)]">
            <p className="text-sm font-semibold text-foreground">{t.home.capabilities.conciliation.title}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t.home.capabilities.conciliation.description}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-border/60 bg-white/85 p-5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.16)]">
            <p className="text-sm font-semibold text-foreground">{t.home.capabilities.remittances.title}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t.home.capabilities.remittances.description}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-border/60 bg-white/85 p-5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.16)]">
            <p className="text-sm font-semibold text-foreground">{t.home.capabilities.donations.title}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t.home.capabilities.donations.description}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-border/60 bg-white/85 p-5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.16)]">
            <p className="text-sm font-semibold text-foreground">{t.home.capabilities.fiscal.title}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t.home.capabilities.fiscal.description}
            </p>
          </div>
        </div>
      </section>

      <div className="space-y-6 px-6 pb-8">
        {sections.map((section, index) => (
          <section key={section.id} id={section.id} className="mx-auto max-w-6xl">
            <div className={cn(index % 2 === 0 ? sectionSurfaceClass : tintedSectionSurfaceClass)}>
              <div className="grid gap-8 lg:grid-cols-[0.42fr_0.58fr] lg:items-start">
                <div className="space-y-4 lg:sticky lg:top-24">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                    {section.eyebrow}
                  </p>
                  <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-foreground lg:text-[2.4rem]">
                    {section.title}
                  </h2>
                  <p className="max-w-xl text-base leading-7 text-muted-foreground">
                    {section.description}
                  </p>
                  {section.detailLinks?.length ? (
                    <SectionDetailLinks locale={locale} links={section.detailLinks} />
                  ) : null}
                </div>

                <div
                  className={cn(
                    'grid gap-4',
                    section.cards.length > 1 && 'md:grid-cols-2',
                    section.cards.length === 1 && 'max-w-2xl'
                  )}
                >
                  {section.cards.map((card) => (
                    <FeatureListCard key={card.id ?? card.title} card={card} />
                  ))}
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="px-6 pb-20 pt-8">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-sky-200/70 bg-[linear-gradient(135deg,rgba(14,165,233,0.14),rgba(255,255,255,0.96)_45%,rgba(240,249,255,0.92))] p-6 shadow-[0_30px_90px_-56px_rgba(14,165,233,0.42)] sm:p-8 lg:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
            {copy.finalEyebrow}
          </p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-foreground lg:text-[2.35rem]">
            {copy.finalTitle}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            {copy.finalDescription}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={`/${locale}/contact`}>
                {t.cta.primary}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            {showDetailedGuides ? (
              <Button asChild size="lg" variant="outline">
                <Link href={guideHref}>{DETAIL_PANEL_COPY[locale].guideCta}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <PublicSiteFooter locale={locale} />
    </main>
  );
}
