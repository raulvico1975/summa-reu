import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { PublicDirectContact } from '@/components/public/PublicDirectContact';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, Upload, Settings, FileCheck, Download, CalendarDays } from 'lucide-react';
import {
  PUBLIC_LOCALES,
  isValidPublicLocale,
  generatePublicPageMetadata,
  type PublicLocale,
} from '@/lib/public-locale';
import { SUPPORT_EMAIL } from '@/lib/constants';
import { getPublicTranslations } from '@/i18n/public';
import { getLatestPublicProductUpdate } from '@/lib/product-updates/public';

export const dynamic = 'force-dynamic';

const frameClass =
  'overflow-hidden rounded-[1.75rem] border border-border/60 bg-white/90 shadow-[0_28px_80px_-44px_rgba(15,23,42,0.28)] backdrop-blur';

const surfaceClass =
  'rounded-[1.75rem] border border-border/60 bg-white/90 shadow-[0_22px_60px_-40px_rgba(15,23,42,0.18)] backdrop-blur';

const HERO_HIGHLIGHTS: Record<PublicLocale, string> = {
  ca: 'informes fiscals',
  es: 'informes fiscales',
  fr: 'rapports fiscaux',
  pt: 'relatórios fiscais',
};

const LANDING_COPY: Record<
  PublicLocale,
  {
    heroSupport: string;
    valueRailIntro: {
      eyebrow: string;
      title: string;
    };
    valueRail: {
      conciliation: { title: string; description: string };
      remittances: { title: string; description: string };
      fiscal: { title: string; description: string };
      projects: { title: string; description: string };
    };
    trust: {
      eyebrow: string;
      title: string;
      description: string;
      panelLead: string;
      points: string[];
    };
    howWeWorkLead: string;
    profiles: {
      eyebrow: string;
      title: string;
      description: string;
      coreLabel: string;
      optionalLabel: string;
    };
    finalEyebrow: string;
    finalNote: string;
  }
> = {
  ca: {
    heroSupport:
      'Centralitza banc, quotes, donacions i fiscalitat des d’un sol lloc.',
    valueRailIntro: {
      eyebrow: 'On et treu feina',
      title: 'El nucli que resol el dia a dia econòmic',
    },
    valueRail: {
      conciliation: {
        title: 'Quadra el banc',
        description: 'Relaciona extractes i comprovants sense repassar-los un a un.',
      },
      remittances: {
        title: 'Controla quotes i retorns',
        description: 'Divideix remeses agrupades i resol devolucions amb traçabilitat.',
      },
      fiscal: {
        title: 'Tanca fiscalitat',
        description: "Prepara 182, 347 i certificats sense reconstruir l'històric.",
      },
      projects: {
        title: 'Segueix projectes',
        description: 'Afegeix execució pressupostària i justificació quan realment us cal.',
      },
    },
    trust: {
      eyebrow: 'Què canvia quan entreu a Summa',
      title: 'Deixeu de perseguir dades disperses i passeu a treballar amb criteri operatiu.',
      description:
        'No és només fer menys feina manual. És saber què està pendent, què està conciliat i què ja està llest per tancar.',
      panelLead:
        "Primer s'ordena la base econòmica. Després tot l'equip treballa sobre el mateix estat de la informació.",
      points: [
        'Cada cobrament, quota o donació queda connectat amb el seu moviment i document.',
        'L’equip veu el mateix estat de la informació, sense versions paral·leles.',
        'Quan arriba fiscalitat o una justificació, la base ja està preparada.',
      ],
    },
    howWeWorkLead:
      "Abans d'activar Summa, valorem si encaixa amb la vostra manera de treballar.",
    profiles: {
      eyebrow: 'Nucli i mòdul',
      title: "Summa s'adapta a qui porta la gestió",
      description:
        'El nucli cobreix tresoreria i administració. El mòdul de projectes només entra en joc quan hi ha execució, subvencions o cooperació.',
      coreLabel: 'Nucli base',
      optionalLabel: 'Mòdul opcional',
    },
    finalEyebrow: 'Si voleu valorar si encaixa',
    finalNote:
      'Si hi ha encaix, us ensenyem una demo centrada en el vostre cas real i no en una presentació genèrica.',
  },
  es: {
    heroSupport:
      'Centraliza banco, cuotas, donaciones y fiscalidad desde un solo lugar.',
    valueRailIntro: {
      eyebrow: 'Dónde te ahorra trabajo',
      title: 'El núcleo que resuelve el día a día económico',
    },
    valueRail: {
      conciliation: {
        title: 'Cuadra el banco',
        description: 'Relaciona extractos y comprobantes sin revisarlos uno a uno.',
      },
      remittances: {
        title: 'Controla cuotas y retornos',
        description: 'Divide remesas agrupadas y resuelve devoluciones con trazabilidad.',
      },
      fiscal: {
        title: 'Cierra fiscalidad',
        description: 'Prepara 182, 347 y certificados sin reconstruir el histórico.',
      },
      projects: {
        title: 'Sigue proyectos',
        description: 'Añade ejecución presupuestaria y justificación cuando de verdad os haga falta.',
      },
    },
    trust: {
      eyebrow: 'Qué cambia cuando entráis en Summa',
      title: 'Dejáis de perseguir datos dispersos y pasáis a trabajar con criterio operativo.',
      description:
        'No es solo hacer menos trabajo manual. Es saber qué está pendiente, qué está conciliado y qué ya está listo para cerrar.',
      panelLead:
        'Primero se ordena la base económica. Después todo el equipo trabaja sobre el mismo estado de la información.',
      points: [
        'Cada cobro, cuota o donación queda conectado con su movimiento y documento.',
        'El equipo ve el mismo estado de la información, sin versiones paralelas.',
        'Cuando llega fiscalidad o una justificación, la base ya está preparada.',
      ],
    },
    howWeWorkLead:
      'Antes de activar Summa, valoramos si encaja con vuestra manera de trabajar.',
    profiles: {
      eyebrow: 'Núcleo y módulo',
      title: 'Summa se adapta a quien lleva la gestión',
      description:
        'El núcleo cubre tesorería y administración. El módulo de proyectos solo entra en juego cuando hay ejecución, subvenciones o cooperación.',
      coreLabel: 'Núcleo base',
      optionalLabel: 'Módulo opcional',
    },
    finalEyebrow: 'Si queréis valorar encaje',
    finalNote:
      'Si vemos encaje, os enseñamos una demo centrada en vuestro caso real y no en una presentación genérica.',
  },
  fr: {
    heroSupport:
      'Centralisez banque, cotisations, dons et fiscalité depuis un seul endroit.',
    valueRailIntro: {
      eyebrow: 'Là où cela vous fait gagner du temps',
      title: 'Le noyau qui résout le quotidien économique',
    },
    valueRail: {
      conciliation: {
        title: 'Cadrez la banque',
        description: 'Reliez relevés et justificatifs sans les revoir un par un.',
      },
      remittances: {
        title: 'Pilotez cotisations et rejets',
        description: 'Décomposez les prélèvements groupés et gérez les rejets avec traçabilité.',
      },
      fiscal: {
        title: 'Clôturez la fiscalité',
        description: 'Préparez 182, 347 et certificats sans reconstituer l’historique.',
      },
      projects: {
        title: 'Suivez les projets',
        description: 'Ajoutez exécution budgétaire et justification quand cela devient nécessaire.',
      },
    },
    trust: {
      eyebrow: 'Ce qui change quand vous passez sur Summa',
      title: 'Vous cessez de courir après des données dispersées et gagnez un cadre opérationnel partagé.',
      description:
        'Ce n’est pas seulement moins de travail manuel. C’est savoir ce qui est en attente, rapproché ou prêt à être clôturé.',
      panelLead:
        'D’abord, la base économique est mise en ordre. Ensuite, toute l’équipe travaille sur le même état de l’information.',
      points: [
        'Chaque encaissement, cotisation ou don reste lié à son mouvement et à son justificatif.',
        'L’équipe voit le même état de l’information, sans versions parallèles.',
        'Quand arrive la fiscalité ou une justification, la base est déjà prête.',
      ],
    },
    howWeWorkLead:
      'Avant d’activer Summa, nous vérifions si cela correspond à votre façon de travailler.',
    profiles: {
      eyebrow: 'Noyau et module',
      title: 'Summa s’adapte à la personne qui pilote la gestion',
      description:
        'Le noyau couvre trésorerie et administration. Le module projets n’intervient que lorsqu’il faut suivre exécution, subventions ou coopération.',
      coreLabel: 'Noyau de base',
      optionalLabel: 'Module optionnel',
    },
    finalEyebrow: 'Si vous voulez vérifier le fit',
    finalNote:
      'S’il y a un bon fit, nous vous montrons une démo centrée sur votre cas réel et non une présentation générique.',
  },
  pt: {
    heroSupport:
      'Centraliza banco, quotas, doações e fiscalidade num só lugar.',
    valueRailIntro: {
      eyebrow: 'Onde vos tira trabalho',
      title: 'O núcleo que resolve o dia a dia económico',
    },
    valueRail: {
      conciliation: {
        title: 'Fechar o banco',
        description: 'Relaciona extratos e comprovativos sem os rever um a um.',
      },
      remittances: {
        title: 'Controlar quotas e devoluções',
        description: 'Divide remessas agrupadas e resolve devoluções com rastreabilidade.',
      },
      fiscal: {
        title: 'Fechar fiscalidade',
        description: 'Prepara 182, 347 e certificados sem reconstruir o histórico.',
      },
      projects: {
        title: 'Acompanhar projetos',
        description: 'Acrescenta execução orçamental e justificação quando isso fizer mesmo falta.',
      },
    },
    trust: {
      eyebrow: 'O que muda quando entram no Summa',
      title: 'Deixam de perseguir dados dispersos e passam a trabalhar com critério operativo.',
      description:
        'Não é só fazer menos trabalho manual. É saber o que está pendente, conciliado e pronto para fechar.',
      panelLead:
        'Primeiro organiza-se a base económica. Depois toda a equipa trabalha sobre o mesmo estado da informação.',
      points: [
        'Cada cobrança, quota ou doação fica ligada ao seu movimento e comprovativo.',
        'A equipa vê o mesmo estado da informação, sem versões paralelas.',
        'Quando chega a fiscalidade ou uma justificação, a base já está preparada.',
      ],
    },
    howWeWorkLead:
      'Antes de ativar o Summa, avaliamos se encaixa na vossa forma de trabalhar.',
    profiles: {
      eyebrow: 'Núcleo e módulo',
      title: 'O Summa adapta-se a quem conduz a gestão',
      description:
        'O núcleo cobre tesouraria e administração. O módulo de projetos só entra quando há execução, subsídios ou cooperação.',
      coreLabel: 'Núcleo base',
      optionalLabel: 'Módulo opcional',
    },
    finalEyebrow: 'Se quiserem avaliar o encaixe',
    finalNote:
      'Se houver encaixe, mostramos-vos uma demo centrada no vosso caso real e não numa apresentação genérica.',
  },
};

const FOOTER_COPY: Record<
  PublicLocale,
  {
    sitemap: string;
    socials: string;
    socialsNote: string;
  }
> = {
  ca: {
    sitemap: 'Mapa del web',
    socials: 'Xarxes',
    socialsNote: 'LinkedIn i Instagram aviat.',
  },
  es: {
    sitemap: 'Mapa del sitio',
    socials: 'Redes',
    socialsNote: 'LinkedIn e Instagram pronto.',
  },
  fr: {
    sitemap: 'Plan du site',
    socials: 'Réseaux',
    socialsNote: 'LinkedIn et Instagram bientôt.',
  },
  pt: {
    sitemap: 'Mapa do site',
    socials: 'Redes',
    socialsNote: 'LinkedIn e Instagram em breve.',
  },
};

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

const SECTION_ANCHORS: Record<
  PublicLocale,
  {
    conciliation: string;
    remittances: string;
    onlineDonations: string;
    fiscalCertificates: string;
    projects: string;
  }
> = {
  ca: {
    conciliation: 'conciliacio-bancaria',
    remittances: 'remeses-devolucions',
    onlineDonations: 'donacions-online',
    fiscalCertificates: 'fiscalitat-certificats',
    projects: 'modul-projectes',
  },
  es: {
    conciliation: 'conciliacion-bancaria',
    remittances: 'remesas-devoluciones',
    onlineDonations: 'donaciones-online',
    fiscalCertificates: 'fiscalidad-certificados',
    projects: 'modulo-proyectos',
  },
  fr: {
    conciliation: 'rapprochement-bancaire',
    remittances: 'prelevements-rejets',
    onlineDonations: 'dons-en-ligne',
    fiscalCertificates: 'fiscalite-certificats',
    projects: 'module-projets',
  },
  pt: {
    conciliation: 'reconciliacao-bancaria',
    remittances: 'remessas-devolucoes',
    onlineDonations: 'doacoes-online',
    fiscalCertificates: 'fiscalidade-certificados',
    projects: 'modulo-projetos',
  },
};

const FEATURES_PATH: Record<PublicLocale, string> = {
  ca: 'funcionalitats',
  es: 'funcionalitats',
  fr: 'fonctionnalites',
  pt: 'funcionalidades',
};

const HOME_VISUALS = {
  default: {
    conciliation: '/visuals/web/web_concilia_bancaria.webp',
    remittances: '/visuals/web/web_divide_remeses.webp',
    donations: '/visuals/web/web_divide_stripe.webp',
    fiscal: '/visuals/web/web_certificats_182.webp',
    admin: '/visuals/web/web_gestio_docs.webp',
    projects: '/visuals/web/web_seguiment_projectes.webp',
  },
  ca: {
    conciliation: '/visuals/web/web_concilia_bancaria_ca.webp',
    remittances: '/visuals/web/web_divideix_remeses_ca.webp',
    donations: '/visuals/web/web_divideix_stripe_ca.webp',
    fiscal: '/visuals/web/web_certificats_182_ca.webp',
    admin: '/visuals/web/web_gestio_docs_ca.webp',
    projects: '/visuals/web/web_seguiment_projectes_ca.webp',
  },
} as const;

function splitTextAroundPhrase(text: string, phrase: string) {
  const index = text.indexOf(phrase);

  if (index === -1) {
    return {
      before: text,
      highlight: '',
      after: '',
    };
  }

  return {
    before: text.slice(0, index),
    highlight: phrase,
    after: text.slice(index + phrase.length),
  };
}

function getLeadSentence(text: string) {
  const match = text.match(/.*?[.!?](?:\s|$)/);
  return match?.[0]?.trim() ?? text;
}

function formatPublicDate(value: string | null, locale: PublicLocale): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const localeMap: Record<PublicLocale, string> = {
    ca: 'ca-ES',
    es: 'es-ES',
    fr: 'fr-FR',
    pt: 'pt-PT',
  };

  return new Intl.DateTimeFormat(localeMap[locale], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export default async function HomePage({ params }: PageProps) {
  const { lang } = await params;

  if (!isValidPublicLocale(lang)) {
    notFound();
  }

  const locale = lang as PublicLocale;
  const t = getPublicTranslations(locale);
  const landingCopy = LANDING_COPY[locale];
  const anchors = SECTION_ANCHORS[locale];
  const featuresPath = FEATURES_PATH[locale];
  const capabilitiesHref = `/${locale}#capabilities`;
  const howWeWorkHref = `/${locale}#how-we-work`;
  const updatesHref = `/${locale}/novetats`;
  const visuals = locale === 'ca' ? HOME_VISUALS.ca : HOME_VISUALS.default;
  const headlineParts = splitTextAroundPhrase(t.home.heroTagline, HERO_HIGHLIGHTS[locale]);
  let latestUpdate: Awaited<ReturnType<typeof getLatestPublicProductUpdate>> = null;

  try {
    latestUpdate = await getLatestPublicProductUpdate({ locale });
  } catch (error) {
    console.warn('[public-home] latest product update unavailable:', error);
  }

  const valueRail = [
    {
      title: landingCopy.valueRail.conciliation.title,
      description: landingCopy.valueRail.conciliation.description,
      icon: Upload,
      href: `/${locale}/${featuresPath}#${anchors.conciliation}`,
    },
    {
      title: landingCopy.valueRail.remittances.title,
      description: landingCopy.valueRail.remittances.description,
      icon: Settings,
      href: `/${locale}/${featuresPath}#${anchors.remittances}`,
    },
    {
      title: landingCopy.valueRail.fiscal.title,
      description: landingCopy.valueRail.fiscal.description,
      icon: FileCheck,
      href: `/${locale}/${featuresPath}#${anchors.fiscalCertificates}`,
    },
    {
      title: landingCopy.valueRail.projects.title,
      description: landingCopy.valueRail.projects.description,
      icon: Download,
      href: `/${locale}/${featuresPath}#${anchors.projects}`,
    },
  ] as const;

  const heroPanels = [
    {
      badge: t.home.stats.movements,
      title: t.home.capabilities.conciliation.title,
      description: getLeadSentence(t.home.capabilities.conciliation.description),
      icon: Upload,
      className: 'left-3 top-4 sm:left-5 sm:top-6 lg:-left-10 lg:top-12',
    },
    {
      badge: 'SEPA',
      title: t.home.capabilities.remittances.title,
      description: getLeadSentence(t.home.capabilities.remittances.description),
      icon: Settings,
      className: 'right-3 top-6 hidden sm:block lg:-right-10 lg:top-20',
    },
    {
      badge: '182 · 347',
      title: t.home.capabilities.fiscal.title,
      description: getLeadSentence(t.home.capabilities.fiscal.description),
      icon: FileCheck,
      className:
        'bottom-4 left-1/2 -translate-x-1/2 sm:bottom-6 lg:bottom-6 lg:left-8 lg:translate-x-0',
    },
  ] as const;

  const capabilityCards = [
    {
      eyebrow: t.home.nav.conciliation,
      title: t.home.capabilities.conciliation.title,
      description: t.home.capabilities.conciliation.description,
      image: visuals.conciliation,
      href: `/${locale}/${featuresPath}#${anchors.conciliation}`,
      wide: true,
      imageFirst: false,
      toneClass:
        'bg-[linear-gradient(135deg,rgba(240,249,255,0.92),rgba(255,255,255,0.92))]',
    },
    {
      eyebrow: t.home.nav.remittances,
      title: t.home.capabilities.remittances.title,
      description: t.home.capabilities.remittances.description,
      image: visuals.remittances,
      href: `/${locale}/${featuresPath}#${anchors.remittances}`,
      wide: false,
      imageFirst: false,
      toneClass:
        'bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,250,252,0.95))]',
    },
    {
      eyebrow: t.home.nav.onlineDonations,
      title: t.home.capabilities.donations.title,
      description: t.home.capabilities.donations.description,
      image: visuals.donations,
      href: `/${locale}/${featuresPath}#${anchors.onlineDonations}`,
      wide: false,
      imageFirst: false,
      toneClass:
        'bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(240,249,255,0.75))]',
    },
    {
      eyebrow: t.home.nav.fiscalCertificates,
      title: t.home.capabilities.fiscal.title,
      description: t.home.capabilities.fiscal.description,
      image: visuals.fiscal,
      href: `/${locale}/${featuresPath}#${anchors.fiscalCertificates}`,
      wide: true,
      imageFirst: true,
      toneClass:
        'bg-[linear-gradient(135deg,rgba(255,251,235,0.9),rgba(255,255,255,0.94))]',
    },
  ] as const;

  const profileSpotlights = [
    {
      label: landingCopy.profiles.coreLabel,
      title: t.home.profiles.admin.title,
      description: t.home.profiles.admin.description,
      image: visuals.admin,
      href: `/${locale}/${featuresPath}#${anchors.conciliation}`,
      reverse: false,
      toneClass:
        'bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,249,255,0.72))]',
    },
    {
      label: landingCopy.profiles.optionalLabel,
      title: t.home.profiles.projects.title,
      description: t.home.profiles.projects.description,
      image: visuals.projects,
      href: `/${locale}/${featuresPath}#${anchors.projects}`,
      reverse: true,
      toneClass:
        'bg-[linear-gradient(135deg,rgba(248,250,252,0.96),rgba(255,255,255,0.96))]',
    },
  ] as const;

  const proofPoints = landingCopy.trust.points;

  return (
    <main className="flex min-h-screen flex-col">
      <a
        href="#capabilities"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        {t.home.skipToContent}
      </a>

      <PublicSiteHeader locale={locale} />

      <section className="relative overflow-hidden bg-background px-6 pb-12 pt-12 lg:pb-16 lg:pt-16">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-5rem] top-[-4rem] h-52 w-52 rounded-full bg-sky-100/85 blur-3xl" />
          <div className="absolute right-[8%] top-[12%] h-72 w-72 rounded-full bg-amber-100/70 blur-3xl" />
          <div className="absolute bottom-[-5rem] right-[-1rem] h-60 w-60 rounded-full bg-cyan-100/70 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            <div className="space-y-5 text-center lg:space-y-6 lg:text-left">
              <div className="space-y-5">
                <p className="mx-auto inline-flex w-fit items-center rounded-full border border-sky-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-primary/90 shadow-[0_16px_40px_-28px_rgba(14,165,233,0.55)] lg:mx-0">
                  {t.home.hero.bridgeLine}
                </p>

                <h1 className="mx-auto max-w-3xl text-[2.65rem] font-black leading-[0.98] tracking-[-0.04em] text-foreground sm:text-[3.25rem] lg:mx-0 lg:text-[4.1rem] 2xl:text-[4.85rem]">
                  {headlineParts.before}
                  {headlineParts.highlight ? (
                    <span className="relative inline-block px-1">
                      <span className="relative z-10">{headlineParts.highlight}</span>
                      <span className="absolute inset-x-0 bottom-[0.1em] h-[0.34em] rounded-full bg-amber-200/90" />
                    </span>
                  ) : null}
                  {headlineParts.after}
                </h1>

                <p className="mx-auto max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl lg:mx-0">
                  {landingCopy.heroSupport}
                </p>
              </div>

              <div className="flex items-center justify-center lg:justify-start">
                <Button asChild size="lg">
                  <Link href={capabilitiesHref}>
                    {t.common.features}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
              <div className="pointer-events-none absolute inset-x-10 top-8 h-32 rounded-full bg-sky-100/80 blur-3xl" />
              <div className="pointer-events-none absolute bottom-8 left-8 h-24 w-24 rounded-full bg-amber-100/80 blur-3xl" />

              <div className="relative mx-auto max-w-[46rem] pt-2">
                <div className={`${frameClass} border-white/70 p-2 shadow-[0_40px_120px_-52px_rgba(15,23,42,0.42)]`}>
                  <div className="rounded-[1.35rem] border border-border/50 bg-white/95 px-4 py-3">
                    <div className="mb-3 flex items-center justify-between text-xs font-medium text-muted-foreground">
                      <span>Summa Social</span>
                      <span>{t.home.workflow.title}</span>
                    </div>
                    <div className="overflow-hidden rounded-[1.2rem] border border-border/50">
                      <Image
                        src="/visuals/web/web_pantalla_summa.webp"
                        alt={t.home.hero.visualAlt}
                        width={800}
                        height={500}
                        sizes="(min-width: 1024px) 50vw, 100vw"
                        className="h-auto w-full"
                        priority
                      />
                    </div>
                  </div>
                </div>

                <div className="hidden lg:block">
                  {heroPanels.map((panel) => {
                    const Icon = panel.icon;

                    return (
                      <div
                        key={panel.title}
                        className={`absolute w-[11.5rem] rounded-[1.35rem] border border-white/80 bg-white/95 p-4 shadow-[0_24px_65px_-44px_rgba(15,23,42,0.45)] backdrop-blur xl:w-[13rem] ${panel.className}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-primary">
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            {panel.badge}
                          </span>
                        </div>
                        <p className="mt-4 text-sm font-semibold leading-5 text-foreground">{panel.title}</p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{panel.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-14 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                {landingCopy.valueRailIntro.eyebrow}
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
                {landingCopy.valueRailIntro.title}
              </h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {valueRail.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group rounded-[1.55rem] border border-border/60 bg-white/80 p-5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.32)] backdrop-blur motion-safe:transition-all motion-safe:duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[0_26px_70px_-44px_rgba(15,23,42,0.34)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-50 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
                  </div>
                  <h2 className="mt-5 text-lg font-semibold tracking-tight">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

	      {latestUpdate ? (
        <section className="border-y border-border/50 bg-[linear-gradient(180deg,rgba(240,249,255,0.75),rgba(255,255,255,0.92))] px-6 py-6">
          <div className="mx-auto max-w-6xl">
            <div className="rounded-[1.75rem] border border-sky-100 bg-white/90 p-5 shadow-[0_24px_60px_-44px_rgba(14,165,233,0.55)] backdrop-blur sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-3">
                  {formatPublicDate(latestUpdate.publishedAt, locale) ? (
                    <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      {formatPublicDate(latestUpdate.publishedAt, locale)}
                    </p>
                  ) : null}
                  <h2 className="text-2xl font-semibold tracking-tight">{latestUpdate.title}</h2>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                    {latestUpdate.excerpt ?? t.updates.latestDescription}
                  </p>
                </div>

                <div className="flex sm:flex-row lg:items-end">
                  <Button asChild size="sm">
                    <Link href={`/${locale}/novetats/${latestUpdate.slug}`}>
                      {t.updates.readMore}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-6xl rounded-[2.25rem] border border-border/60 bg-[linear-gradient(135deg,rgba(248,250,252,0.96),rgba(240,249,255,0.78))] p-6 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.28)] sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                {landingCopy.trust.eyebrow}
              </p>
              <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground lg:text-[2.4rem]">
                {landingCopy.trust.title}
              </h2>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                {landingCopy.trust.description}
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[1.4rem] border border-border/60 bg-white/90 p-5">
                  <p className="text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
                    {t.home.stats.entities}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.home.stats.entitiesLabel}</p>
                </div>
                <div className="rounded-[1.4rem] border border-border/60 bg-white/90 p-5">
                  <p className="text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
                    {t.home.stats.movements}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.home.stats.movementsLabel}</p>
                </div>
                <div className="rounded-[1.4rem] border border-border/60 bg-white/90 p-5">
                  <p className="text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
                    {t.home.stats.countries}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.home.stats.countriesLabel}</p>
                </div>
              </div>
            </div>

            <div className={`${surfaceClass} p-6 sm:p-7`}>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                {t.home.workflow.title}
              </p>
              <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
                {landingCopy.trust.panelLead}
              </p>
              <div className="mt-6 space-y-3">
                {proofPoints.map((point) => (
                  <div key={point} className="flex gap-3 rounded-[1.25rem] border border-border/50 bg-background/80 p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <p className="text-sm leading-6 text-muted-foreground">{point}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="capabilities"
        className="scroll-mt-24 bg-[linear-gradient(180deg,rgba(248,250,252,0.85),rgba(255,255,255,1))] px-6 py-16 lg:py-20"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
              {t.common.features}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">{t.home.systemOverview.title}</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
              {t.home.systemOverview.subtitle}
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-6">
            {capabilityCards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className={`group overflow-hidden rounded-[1.9rem] border border-border/60 ${card.toneClass} shadow-[0_22px_65px_-46px_rgba(15,23,42,0.28)] motion-safe:transition-all motion-safe:duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[0_30px_80px_-44px_rgba(15,23,42,0.34)] ${card.wide ? 'lg:col-span-4' : 'lg:col-span-2'}`}
              >
                {card.wide ? (
                  <div className="grid h-full gap-0 lg:grid-cols-[1fr_1.05fr]">
                    <div
                      className={`relative flex min-h-[280px] items-center justify-center overflow-hidden bg-white/70 p-6 ${card.imageFirst ? 'border-b border-border/60 lg:order-1 lg:border-b-0 lg:border-r' : 'border-b border-border/60 lg:order-2 lg:border-b-0 lg:border-l'}`}
                    >
                      <Image
                        src={card.image}
                        alt={card.title}
                        width={900}
                        height={640}
                        sizes="(min-width: 1024px) 42vw, 100vw"
                        className="max-h-[320px] h-auto w-full object-contain object-center"
                      />
                    </div>
                    <div className={`flex flex-col justify-between p-7 sm:p-8 ${card.imageFirst ? 'lg:order-2' : 'lg:order-1'}`}>
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                          {card.eyebrow}
                        </p>
                        <h3 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                          {card.title}
                        </h3>
                        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
                          {card.description}
                        </p>
                      </div>
                      <span className="mt-8 inline-flex items-center text-sm font-semibold text-primary">
                        {t.home.readMore}
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full flex-col">
                    <div className="flex min-h-[230px] items-center justify-center overflow-hidden border-b border-border/60 bg-white/72 p-6">
                      <Image
                        src={card.image}
                        alt={card.title}
                        width={700}
                        height={580}
                        sizes="(min-width: 1024px) 22vw, (min-width: 768px) 50vw, 100vw"
                        className="max-h-[220px] h-auto w-full object-contain object-center"
                      />
                    </div>
                    <div className="flex flex-1 flex-col justify-between p-6">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                          {card.eyebrow}
                        </p>
                        <h3 className="mt-3 text-xl font-semibold tracking-tight">{card.title}</h3>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">{card.description}</p>
                      </div>
                      <span className="mt-6 inline-flex items-center text-sm font-semibold text-primary">
                        {t.home.readMore}
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
              {landingCopy.profiles.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              {landingCopy.profiles.title}
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
              {landingCopy.profiles.description}
            </p>
          </div>

          <div className="mt-12 space-y-6">
            {profileSpotlights.map((profile) => (
              <div
                key={profile.title}
                className={`grid items-center gap-8 rounded-[2rem] border border-border/60 ${profile.toneClass} p-5 shadow-[0_20px_60px_-48px_rgba(15,23,42,0.24)] sm:p-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10 lg:p-8`}
              >
                <div className={profile.reverse ? 'lg:order-2' : ''}>
                  <div className={`${frameClass} border-white/70`}>
                    <Image
                      src={profile.image}
                      alt={profile.title}
                      width={900}
                      height={620}
                      sizes="(min-width: 1024px) 45vw, 100vw"
                      className="h-auto w-full"
                    />
                  </div>
                </div>

                <div className={`space-y-5 ${profile.reverse ? 'lg:order-1' : ''}`}>
                  <span className="inline-flex items-center rounded-full border border-sky-200/80 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary/85">
                    {profile.label}
                  </span>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
                    {profile.title}
                  </h2>
                  <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                    {profile.description}
                  </p>
                  <Link
                    href={profile.href}
                    className="inline-flex items-center text-sm font-semibold text-primary"
                  >
                    {t.home.readMore}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-we-work" className="bg-muted/30 px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                {t.home.howWeWork.title}
              </p>
              <h2 className="max-w-3xl text-[1.12rem] font-medium leading-7 text-foreground sm:text-[1.2rem] lg:text-[1.35rem]">
                {landingCopy.howWeWorkLead}
              </h2>
              <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                {t.home.howWeWork.paragraph1}
              </p>
              <div className="rounded-[1.5rem] border border-border/60 bg-white/80 p-5 text-sm leading-6 text-muted-foreground shadow-[0_20px_50px_-44px_rgba(15,23,42,0.2)]">
                {t.home.howWeWork.note}
              </div>
            </div>

            <div className={`${frameClass} border-white/70 p-3`}>
              <Image
                src={locale === 'es' ? '/visuals/web/web_como_trabajamos.webp' : '/visuals/web/web_com_treballem.webp'}
                alt={t.home.howWeWork.imageAlt}
                width={1200}
                height={600}
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="h-auto w-full rounded-[1.35rem]"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-20 pt-16 lg:pt-20">
        <div className="mx-auto max-w-6xl rounded-[2.4rem] border border-sky-200/70 bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(255,255,255,0.96)_45%,rgba(240,249,255,0.92))] p-6 shadow-[0_30px_90px_-56px_rgba(14,165,233,0.45)] sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-10">
            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                {landingCopy.finalEyebrow}
              </p>
              <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground lg:text-[2.45rem]">
                {t.home.finalCta.title}
              </h2>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                {t.home.finalCta.subtitle}
              </p>
              <Button asChild size="lg" variant="outline">
                <Link href={capabilitiesHref}>{t.common.features}</Link>
              </Button>
            </div>

            <div className="rounded-[1.9rem] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.28)] sm:p-7">
              <p className="text-sm font-medium text-primary">{t.contact.responseTime}</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {t.contact.title}
              </h3>
              <p className="mt-3 text-base leading-7 text-muted-foreground">{t.contact.description}</p>
              <div className="mt-6">
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link href={`/${locale}/contact`}>{t.cta.primary}</Link>
                </Button>
              </div>
              <PublicDirectContact locale={locale} className="mt-6 border-t border-border/60 pt-6" />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t bg-muted/20 px-6 py-12">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3">
          <div className="space-y-4">
            <Link
              href={`/${locale}`}
              className="inline-flex items-center text-lg font-semibold tracking-tight text-foreground transition-opacity hover:opacity-90"
            >
              {t.common.appName}
            </Link>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">{t.common.tagline}</p>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
              {FOOTER_COPY[locale].sitemap}
            </p>
            <nav className="grid gap-3 text-sm text-muted-foreground">
              <Link href={capabilitiesHref} className="hover:text-foreground hover:underline">
                {t.common.features}
              </Link>
              <Link href={howWeWorkHref} className="hover:text-foreground hover:underline">
                {t.home.howWeWork.title}
              </Link>
              <Link href={updatesHref} className="hover:text-foreground hover:underline">
                {t.updates.navLabel}
              </Link>
              <Link href="/blog" className="hover:text-foreground hover:underline">
                {t.common.blog}
              </Link>
              <Link href={`/${locale}/privacy`} className="hover:text-foreground hover:underline">
                {t.common.privacy}
              </Link>
            </nav>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
              {t.common.contact}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">{t.contact.responseTime}</p>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex text-sm font-medium text-primary hover:underline">
              {SUPPORT_EMAIL}
            </a>
            <div className="pt-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/85">
                {FOOTER_COPY[locale].socials}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{FOOTER_COPY[locale].socialsNote}</p>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
