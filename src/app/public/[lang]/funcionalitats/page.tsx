import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { PublicEditorialMark } from '@/components/public/PublicEditorialMark';
import { PublicFeatureDemo } from '@/components/public/PublicFeatureDemo';
import type { PublicFeaturesExplorerItem, PublicFeaturesExplorerSection } from '@/components/public/PublicFeaturesExplorer';
import { PublicDirectContact } from '@/components/public/PublicDirectContact';
import { PUBLIC_SHELL_X } from '@/components/public/public-shell';
import { PublicSiteFooter } from '@/components/public/PublicSiteFooter';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';
import { Button } from '@/components/ui/button';
import {
  getPublicLandingPreviewBySlug,
  type PublicLandingHeroMedia,
} from '@/lib/public-landings';
import {
  PUBLIC_LOCALES,
  generatePublicPageMetadata,
  isValidPublicLocale,
  type PublicLocale,
} from '@/lib/public-locale';
import {
  getPublicDetailedGuidesLocale,
  getPublicEconomicGuideHref,
  hasPublicDetailedGuides,
} from '@/lib/public-site-paths';
import { getPublicTranslations } from '@/i18n/public';

interface PageProps {
  params: Promise<{ lang: string }>;
}

type FeatureSectionKey =
  | 'control'
  | 'conciliation'
  | 'donorsMembers'
  | 'payments'
  | 'fiscal'
  | 'projects';

type PageCopy = {
  eyebrow: string;
  title: string;
  lead: string;
  helper: string;
  detailCta: string;
  contactCta: string;
  demoBadge: string;
  landingBadge: string;
  screenBadge: string;
  footerEyebrow: string;
  footerTitle: string;
  footerDescription: string;
  footerSupportNote: string;
  sections: Record<
    FeatureSectionKey,
    {
      label: string;
      title: string;
      description: string;
      items?: Record<string, { title: string; description: string }>;
    }
  >;
};

const pageShellClass =
  'min-h-screen bg-[linear-gradient(180deg,#f7f8fa_0%,#fcfcfd_26%,#ffffff_100%)]';

const FEATURES_LAYOUT_COPY: Record<
  PublicLocale,
  {
    title: string;
    lead: string;
  }
> = {
  ca: {
    title: 'Funcionalitats de Summa',
    lead: 'Sis blocs de treball per entendre ràpidament què cobreix Summa i anar directament a la part que us interessa.',
  },
  es: {
    title: 'Funcionalidades de Summa',
    lead: 'Seis bloques de trabajo para entender rápido qué cubre Summa e ir directamente a la parte que os interesa.',
  },
  fr: {
    title: 'Fonctionnalités de Summa',
    lead: 'Six blocs de travail pour comprendre rapidement ce que couvre Summa et aller directement à la partie qui vous intéresse.',
  },
  pt: {
    title: 'Funcionalidades do Summa',
    lead: 'Seis blocos de trabalho para perceber rapidamente o que cobre o Summa e ir diretamente à parte que vos interessa.',
  },
};

const WEB_VISUALS = {
  default: {
    dashboard: '/visuals/web/web_dashboard.webp',
    summary: '/visuals/web/web_pantalla_summa.webp',
    conciliation: '/visuals/web/web_concilia_bancaria.webp',
    remittances: '/visuals/web/web_divide_remeses.webp',
    donations: '/visuals/web/web_divide_stripe.webp',
    fiscal: '/visuals/web/web_certificats_182.webp',
    expenses: '/visuals/web/web_gestio_docs.webp',
    liquidations: '/visuals/web/web_liquidacions.webp',
    returns: '/visuals/web/web_gestiona_devolucions.webp',
    pending: '/visuals/web/web_pendents.webp',
    reports: '/visuals/web/web_informes_juntes.webp',
    projects: '/visuals/web/web_seguiment_projectes.webp',
  },
  ca: {
    dashboard: '/visuals/web/web_dashboard.webp',
    summary: '/visuals/web/web_pantalla_summa.webp',
    conciliation: '/visuals/web/web_concilia_bancaria_ca.webp',
    remittances: '/visuals/web/web_divideix_remeses_ca.webp',
    donations: '/visuals/web/web_divideix_stripe_ca.webp',
    fiscal: '/visuals/web/web_certificats_182_ca.webp',
    expenses: '/visuals/web/web_gestio_docs_ca.webp',
    liquidations: '/visuals/web/web_liquidacions.webp',
    returns: '/visuals/web/web_gestiona_devolucions.webp',
    pending: '/visuals/web/web_pendents.webp',
    reports: '/visuals/web/web_informes_juntes.webp',
    projects: '/visuals/web/web_seguiment_projectes_ca.webp',
  },
} as const;

const FEATURES_PAGE_COPY: Record<PublicLocale, PageCopy> = {
  ca: {
    eyebrow: 'Funcionalitats',
    title: 'Explora Summa per blocs de treball',
    lead:
      'Tria un bloc, obre una funcionalitat i mira la pantalla real de Summa abans d’entrar al detall.',
    helper:
      'Les targetes de l’esquerra canvien el panell visual de la dreta i et porten cap a la landing o la demo quan toca.',
    detailCta: 'Més informació',
    contactCta: 'Demana una demo',
    demoBadge: 'Vídeo demo',
    landingBadge: 'Landing',
    screenBadge: 'Pantalla',
    footerEyebrow: 'Parla amb nosaltres',
    footerTitle: 'Parla amb nosaltres',
    footerDescription: 'Valorem si Summa encaixa amb la vostra entitat.',
    footerSupportNote:
      'Ens agrada entendre primer la realitat de cada entitat abans de proposar res.',
    sections: {
      control: {
        label: 'Control i visibilitat',
        title: 'Dashboard, informes i exportació',
        description:
          "És la pantalla per seguir l'estat econòmic, el període actiu i les diferents àrees de control sense sortir del mateix panell.",
        items: {
          metrics: {
            title: "Què hi veieu d'un cop d'ull",
            description:
              "Ingressos, despeses, saldo, pendents i les diferents seccions del panell per entendre ràpidament la situació de l'entitat en el període escollit.",
          },
          reports: {
            title: 'Informe econòmic per a junta o patronat',
            description:
              "Comparteix el que veus en pantalla en un informe econòmic personalitzable i exporta'l a Excel o prepara'l per enviar-lo per email abans de reunions, patronats o assemblees.",
          },
        },
      },
      conciliation: {
        label: 'Conciliació bancària (amb IA)',
        title: 'Moviments, extractes i conciliació',
        description:
          'Del banc a la pantalla de treball: importes, assignes i deixes cada moviment connectat amb el seu context.',
        items: {
          assignment: {
            title: 'Assignació intel·ligent',
            description:
              'Summa aprèn de les decisions anteriors i proposa contactes, categories i relacions abans que hagis d’entrar manualment.',
          },
        },
      },
      donorsMembers: {
        label: 'Socis i donants',
        title: 'Base de socis, donants i historial',
        description:
          'Fitxes, imports, historial i dades fiscals de socis i donants dins d’una sola base viva.',
      },
      payments: {
        label: 'Cobraments i pagaments',
        title: 'Remeses, devolucions i cobrament recurrent',
        description:
          'Quotes, remeses, devolucions i cobrament de donacions dins d’un mateix flux econòmic.',
      },
      fiscal: {
        label: 'Fiscalitat (models AEAT ready)',
        title: 'Donacions, certificats i models fiscals',
        description:
          'Quan arriba el moment fiscal, la informació ja està preparada per generar certificats i models sense reconstruccions finals.',
      },
      projects: {
        label: 'Gestió de projectes',
        title: 'Projectes, subvencions i justificació',
        description:
          'Seguiment pressupostari, imputació de despesa i material de justificació perquè la part econòmica del projecte no vagi per lliure.',
        items: {
          budget: {
            title: 'Seguiment pressupostari',
            description:
              'Comparativa entre pressupostat i executat per veure ràpidament on està cada projecte.',
          },
          grants: {
            title: 'Subvencions i imputació',
            description:
              'Assignació parcial de despeses i lectura clara de quina despesa pertany a cada projecte.',
          },
          reporting: {
            title: 'Justificació i exportació',
            description:
              'Preparació de la justificació amb materials exportables i documentació agrupada.',
          },
        },
      },
    },
  },
  es: {
    eyebrow: 'Funcionalidades',
    title: 'Explora Summa por bloques de trabajo',
    lead:
      'Elige un bloque, abre una funcionalidad y mira la pantalla real de Summa antes de entrar en detalle.',
    helper:
      'Las tarjetas de la izquierda cambian el panel visual de la derecha y te llevan a la landing o la demo cuando toca.',
    detailCta: 'Más información',
    contactCta: 'Pide una demo',
    demoBadge: 'Vídeo demo',
    landingBadge: 'Landing',
    screenBadge: 'Pantalla',
    footerEyebrow: 'Habla con nosotros',
    footerTitle: 'Habla con nosotros',
    footerDescription: 'Valoramos si Summa encaja con vuestra entidad.',
    footerSupportNote:
      'Nos gusta entender primero la realidad de cada entidad antes de proponer nada.',
    sections: {
      control: {
        label: 'Control y visibilidad',
        title: 'Dashboard, informes y exportación',
        description:
          'Es la pantalla para seguir el estado económico, el periodo activo y las distintas áreas de control sin salir del mismo panel.',
        items: {
          metrics: {
            title: 'Lo que veis de un vistazo',
            description:
              'Ingresos, gastos, saldo, pendientes y las distintas secciones del panel para entender rápidamente la situación de la entidad en el periodo escogido.',
          },
          reports: {
            title: 'Informe económico para junta o patronato',
            description:
              'Comparte lo que ves en pantalla en un informe económico personalizable y expórtalo a Excel o prepáralo para enviarlo por email antes de reuniones, patronatos o asambleas.',
          },
        },
      },
      conciliation: {
        label: 'Conciliación bancaria (con IA)',
        title: 'Movimientos, extractos y conciliación',
        description:
          'Del banco a la pantalla de trabajo: importas, asignas y dejas cada movimiento conectado con su contexto.',
        items: {
          assignment: {
            title: 'Asignación inteligente',
            description:
              'Summa aprende de decisiones anteriores y propone contactos, categorías y relaciones antes de que tengas que entrar manualmente.',
          },
        },
      },
      donorsMembers: {
        label: 'Socios y donantes',
        title: 'Base de socios, donantes e histórico',
        description:
          'Fichas, importes, histórico y datos fiscales de socios y donantes dentro de una sola base viva.',
      },
      payments: {
        label: 'Cobros y pagos',
        title: 'Remesas, devoluciones y cobro recurrente',
        description:
          'Cuotas, remesas, devoluciones y cobro de donaciones dentro de un mismo flujo económico.',
      },
      fiscal: {
        label: 'Fiscalidad (modelos AEAT ready)',
        title: 'Donaciones, certificados y modelos fiscales',
        description:
          'Cuando llega el momento fiscal, la información ya está preparada para generar certificados y modelos sin reconstrucciones finales.',
      },
      projects: {
        label: 'Gestión de proyectos',
        title: 'Proyectos, subvenciones y justificación',
        description:
          'Seguimiento presupuestario, imputación de gasto y material de justificación para que la parte económica del proyecto no vaya por libre.',
        items: {
          budget: {
            title: 'Seguimiento presupuestario',
            description:
              'Comparativa entre presupuestado y ejecutado para ver rápidamente dónde está cada proyecto.',
          },
          grants: {
            title: 'Subvenciones e imputación',
            description:
              'Asignación parcial de gastos y lectura clara de qué gasto pertenece a cada proyecto.',
          },
          reporting: {
            title: 'Justificación y exportación',
            description:
              'Preparación de la justificación con materiales exportables y documentación agrupada.',
          },
        },
      },
    },
  },
  fr: {
    eyebrow: 'Fonctionnalités',
    title: 'Explorez Summa par blocs de travail',
    lead:
      'Choisissez un bloc, ouvrez une fonctionnalité et regardez l’écran réel de Summa avant d’aller plus loin.',
    helper:
      'Les cartes de gauche changent le panneau visuel de droite et vous mènent vers la landing ou la démo quand il le faut.',
    detailCta: 'Plus d’informations',
    contactCta: 'Demander une démo',
    demoBadge: 'Démo vidéo',
    landingBadge: 'Landing',
    screenBadge: 'Écran',
    footerEyebrow: 'Parlez avec nous',
    footerTitle: 'Parlez avec nous',
    footerDescription: 'Nous évaluons si Summa convient à votre structure.',
    footerSupportNote:
      "Nous aimons comprendre d'abord la réalité de chaque structure avant de proposer quoi que ce soit.",
    sections: {
      control: {
        label: 'Contrôle et visibilité',
        title: 'Tableau de bord, rapports et export',
        description:
          "C'est l'écran pour suivre l'état économique, la période active et les différentes zones de contrôle sans quitter le tableau de bord.",
        items: {
          metrics: {
            title: "Ce que l'on voit d'un coup d'oeil",
            description:
              "Revenus, dépenses, solde, éléments en attente et différentes sections du tableau pour comprendre rapidement la situation de la structure sur la période choisie.",
          },
          reports: {
            title: 'Rapport économique pour conseil ou bureau',
            description:
              "Partagez ce que vous voyez à l'écran dans un rapport économique personnalisable et exportez-le en Excel ou préparez-le pour envoi par email avant une réunion ou un conseil.",
          },
        },
      },
      conciliation: {
        label: 'Rapprochement bancaire (avec IA)',
        title: 'Mouvements, relevés et rapprochement',
        description:
          'De la banque à l’écran de travail : vous importez, assignez et reliez chaque mouvement à son contexte.',
        items: {
          assignment: {
            title: 'Affectation intelligente',
            description:
              'Summa apprend des décisions précédentes et propose contacts, catégories et relations avant la saisie manuelle.',
          },
        },
      },
      donorsMembers: {
        label: 'Membres et donateurs',
        title: 'Base membres, donateurs et historique',
        description:
          'Fiches, montants, historique et données fiscales des membres et donateurs dans une base unique.',
      },
      payments: {
        label: 'Encaissements et paiements',
        title: 'Prélèvements, rejets et encaissement récurrent',
        description:
          'Cotisations, remises, rejets et encaissement des dons dans un même flux économique.',
      },
      fiscal: {
        label: 'Fiscalité (modèles AEAT ready)',
        title: 'Dons, certificats et modèles fiscaux',
        description:
          'Quand arrive le moment fiscal, les données sont déjà prêtes pour certificats et déclarations.',
      },
      projects: {
        label: 'Gestion des projets',
        title: 'Projets, subventions et justification',
        description:
          'Suivi budgétaire, affectation des dépenses et matière de justification pour que l’économique du projet reste aligné.',
        items: {
          budget: {
            title: 'Suivi budgétaire',
            description:
              'Comparaison entre budgeté et exécuté pour voir rapidement où en est chaque projet.',
          },
          grants: {
            title: 'Subventions et affectation',
            description:
              'Affectation partielle des dépenses et lecture claire de la dépense par projet.',
          },
          reporting: {
            title: 'Justification et export',
            description:
              'Préparation de la justification avec matériaux exportables et documentation groupée.',
          },
        },
      },
    },
  },
  pt: {
    eyebrow: 'Funcionalidades',
    title: 'Explora o Summa por blocos de trabalho',
    lead:
      'Escolhe um bloco, abre uma funcionalidade e vê o ecrã real do Summa antes de entrares no detalhe.',
    helper:
      'Os cartões da esquerda mudam o painel visual da direita e levam-te para a landing ou para a demo quando faz sentido.',
    detailCta: 'Mais informação',
    contactCta: 'Pedir demo',
    demoBadge: 'Vídeo demo',
    landingBadge: 'Landing',
    screenBadge: 'Ecrã',
    footerEyebrow: 'Fale connosco',
    footerTitle: 'Fale connosco',
    footerDescription: 'Avaliamos se o Summa encaixa com a vossa entidade.',
    footerSupportNote:
      'Gostamos de perceber primeiro a realidade de cada entidade antes de propor seja o que for.',
    sections: {
      control: {
        label: 'Controlo e visibilidade',
        title: 'Dashboard, relatórios e exportação',
        description:
          'É o ecrã para seguir o estado económico, o período ativo e as diferentes áreas de controlo sem sair do mesmo painel.',
        items: {
          metrics: {
            title: 'O que se vê num relance',
            description:
              'Receitas, despesas, saldo, pendentes e as diferentes secções do painel para perceber rapidamente a situação da entidade no período escolhido.',
          },
          reports: {
            title: 'Relatório económico para direção ou patronato',
            description:
              'Partilha o que vês no ecrã num relatório económico personalizável e exporta-o para Excel ou prepara-o para enviar por email antes de reuniões, patronatos ou assembleias.',
          },
        },
      },
      conciliation: {
        label: 'Reconciliação bancária (com IA)',
        title: 'Movimentos, extratos e reconciliação',
        description:
          'Do banco ao ecrã de trabalho: importas, atribuis e ligas cada movimento ao contexto certo.',
        items: {
          assignment: {
            title: 'Atribuição inteligente',
            description:
              'O Summa aprende com decisões anteriores e propõe contactos, categorias e relações antes da introdução manual.',
          },
        },
      },
      donorsMembers: {
        label: 'Sócios e doadores',
        title: 'Base de sócios, doadores e histórico',
        description:
          'Fichas, montantes, histórico e dados fiscais de sócios e doadores numa única base viva.',
      },
      payments: {
        label: 'Cobranças e pagamentos',
        title: 'Remessas, devoluções e cobrança recorrente',
        description:
          'Quotas, remessas, devoluções e cobrança de doações dentro do mesmo fluxo económico.',
      },
      fiscal: {
        label: 'Fiscalidade (modelos AEAT ready)',
        title: 'Doações, certificados e modelos fiscais',
        description:
          'Quando chega a fiscalidade, a informação já está pronta para certificados e modelos sem reconstruções finais.',
      },
      projects: {
        label: 'Gestão de projetos',
        title: 'Projetos, subsídios e justificação',
        description:
          'Seguimento orçamental, imputação de despesa e material de justificação para que a parte económica do projeto não ande separada.',
        items: {
          budget: {
            title: 'Seguimento orçamental',
            description:
              'Comparação entre orçamentado e executado para ver rapidamente onde está cada projeto.',
          },
          grants: {
            title: 'Subsídios e imputação',
            description:
              'Atribuição parcial de despesas e leitura clara da despesa por projeto.',
          },
          reporting: {
            title: 'Justificação e exportação',
            description:
              'Preparação da justificação com materiais exportáveis e documentação agrupada.',
          },
        },
      },
    },
  },
};

export function generateStaticParams() {
  return PUBLIC_LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isValidPublicLocale(lang)) return {};

  const t = getPublicTranslations(lang);

  return {
    title: t.features.metaTitle,
    description: t.features.metaDescription,
    ...generatePublicPageMetadata(lang, '/funcionalitats'),
  };
}

function getLocaleVisuals(locale: PublicLocale) {
  return locale === 'ca' ? WEB_VISUALS.ca : WEB_VISUALS.default;
}

function createImageMedia(src: string, alt: string): PublicLandingHeroMedia {
  return {
    type: 'image',
    src,
    alt,
  };
}

function getSectionShowcaseMedia(
  locale: PublicLocale,
  visuals: ReturnType<typeof getLocaleVisuals>,
  copy: PageCopy
): Record<FeatureSectionKey, PublicLandingHeroMedia> {
  return {
    control: createImageMedia(visuals.dashboard, copy.sections.control.title),
    conciliation: createImageMedia(visuals.conciliation, copy.sections.conciliation.title),
    donorsMembers: createImageMedia('/visuals/web/features-v3/block2_historic_donant_start_4k.webp', copy.sections.donorsMembers.title),
    payments: createImageMedia(visuals.remittances, copy.sections.payments.title),
    fiscal: createImageMedia(visuals.fiscal, copy.sections.fiscal.title),
    projects: createImageMedia(visuals.projects, copy.sections.projects.title),
  };
}

function buildLandingItem({
  slug,
  previewLocale,
  detailLocale,
  fallbackImage,
  ctaLabel,
  demoBadge,
  landingBadge,
}: {
  slug: string;
  previewLocale: PublicLocale;
  detailLocale: PublicLocale;
  fallbackImage: string;
  ctaLabel: string;
  demoBadge: string;
  landingBadge: string;
}): PublicFeaturesExplorerItem {
  const preview = getPublicLandingPreviewBySlug(slug, previewLocale);

  if (!preview) {
    throw new Error(`Landing pública no trobada: ${slug}`);
  }

  return {
    id: slug,
    title: preview.title,
    description: preview.description,
    href: `/${detailLocale}/${slug}`,
    ctaLabel,
    badgeLabel: preview.media?.type === 'video' ? demoBadge : landingBadge,
    media: preview.media ?? createImageMedia(fallbackImage, preview.title),
  };
}

function buildStaticItem({
  id,
  title,
  description,
  image,
  href,
  ctaLabel,
  badgeLabel,
}: {
  id: string;
  title: string;
  description: string;
  image: string;
  href?: string;
  ctaLabel?: string;
  badgeLabel?: string;
}): PublicFeaturesExplorerItem {
  return {
    id,
    title,
    description,
    href,
    ctaLabel,
    badgeLabel,
    media: createImageMedia(image, title),
  };
}

export default async function FeaturesPage({ params }: PageProps) {
  const { lang } = await params;

  if (!isValidPublicLocale(lang)) {
    notFound();
  }

  const locale = lang as PublicLocale;
  const t = getPublicTranslations(locale);
  const copy = FEATURES_PAGE_COPY[locale];
  const layoutCopy = FEATURES_LAYOUT_COPY[locale];
  const detailLocale = getPublicDetailedGuidesLocale(locale);
  const visuals = getLocaleVisuals(locale);
  const showcaseMedia = getSectionShowcaseMedia(locale, visuals, copy);
  const guideHref = getPublicEconomicGuideHref(locale);
  const showDetailedGuides = hasPublicDetailedGuides(locale);
  const contactHref = `/${locale}/contact`;

  const sections: PublicFeaturesExplorerSection[] = [
    {
      id: 'conciliation',
      label: copy.sections.conciliation.label,
      title: copy.sections.conciliation.title,
      description: copy.sections.conciliation.description,
      items: [
        buildLandingItem({
          slug: 'importar-extracte-bancari',
          previewLocale: locale,
          detailLocale,
          fallbackImage: visuals.conciliation,
          ctaLabel: copy.detailCta,
          demoBadge: copy.demoBadge,
          landingBadge: copy.landingBadge,
        }),
        buildLandingItem({
          slug: 'conciliacio-bancaria-ong',
          previewLocale: locale,
          detailLocale,
          fallbackImage: visuals.conciliation,
          ctaLabel: copy.detailCta,
          demoBadge: copy.demoBadge,
          landingBadge: copy.landingBadge,
        }),
        buildStaticItem({
          id: 'ai-assignment',
          title: copy.sections.conciliation.items!.assignment.title,
          description: copy.sections.conciliation.items!.assignment.description,
          image: visuals.pending,
          href: `/${detailLocale}/conciliacio-bancaria-ong`,
          ctaLabel: copy.detailCta,
          badgeLabel: copy.screenBadge,
        }),
      ],
    },
    {
      id: 'donorsMembers',
      label: copy.sections.donorsMembers.label,
      title: copy.sections.donorsMembers.title,
      description: copy.sections.donorsMembers.description,
      items: [
        buildLandingItem({
          slug: 'gestio-donants',
          previewLocale: locale,
          detailLocale,
          fallbackImage: visuals.remittances,
          ctaLabel: copy.detailCta,
          demoBadge: copy.demoBadge,
          landingBadge: copy.landingBadge,
        }),
        buildStaticItem({
          id: 'donorsMembers-bulkImport',
          title: locale === 'ca' ? 'Importació massiva' : locale === 'es' ? 'Importación masiva' : locale === 'fr' ? 'Import massif' : 'Importação massiva',
          description: locale === 'ca'
            ? 'Carrega base inicial de socis o donants sense crear fitxes una a una.'
            : locale === 'es'
              ? 'Carga la base inicial de socios o donantes sin crear fichas una a una.'
              : locale === 'fr'
                ? 'Chargez la base initiale de membres ou donateurs sans créer chaque fiche.'
                : 'Carrega a base inicial de sócios ou doadores sem criar fichas uma a uma.',
          image: '/visuals/web/features-v3/block2_importacio_massiva_start_4k.webp',
          href: `/${detailLocale}/gestio-donants`,
          ctaLabel: copy.detailCta,
          badgeLabel: copy.screenBadge,
        }),
        buildStaticItem({
          id: 'donorsMembers-history',
          title: locale === 'ca' ? 'Històric del donant' : locale === 'es' ? 'Histórico del donante' : locale === 'fr' ? 'Historique du donateur' : 'Histórico do doador',
          description: locale === 'ca'
            ? 'Consulta aportacions, incidències i dades fiscals dins de la mateixa fitxa.'
            : locale === 'es'
              ? 'Consulta aportaciones, incidencias y datos fiscales dentro de la misma ficha.'
              : locale === 'fr'
                ? 'Consultez contributions, incidents et données fiscales dans la même fiche.'
                : 'Consulta contribuições, incidências e dados fiscais na mesma ficha.',
          image: '/visuals/web/features-v3/block2_historic_donant_start_4k.webp',
          href: `/${detailLocale}/gestio-donants`,
          ctaLabel: copy.detailCta,
          badgeLabel: copy.screenBadge,
        }),
      ],
    },
    {
      id: 'payments',
      label: copy.sections.payments.label,
      title: copy.sections.payments.title,
      description: copy.sections.payments.description,
      items: [
        buildLandingItem({
          slug: 'remeses-sepa',
          previewLocale: locale,
          detailLocale,
          fallbackImage: visuals.remittances,
          ctaLabel: copy.detailCta,
          demoBadge: copy.demoBadge,
          landingBadge: copy.landingBadge,
        }),
        buildLandingItem({
          slug: 'devolucions-rebuts-socis',
          previewLocale: locale,
          detailLocale,
          fallbackImage: visuals.returns,
          ctaLabel: copy.detailCta,
          demoBadge: copy.demoBadge,
          landingBadge: copy.landingBadge,
        }),
        buildLandingItem({
          slug: 'control-donacions-ong',
          previewLocale: locale,
          detailLocale,
          fallbackImage: visuals.donations,
          ctaLabel: copy.detailCta,
          demoBadge: copy.demoBadge,
          landingBadge: copy.landingBadge,
        }),
      ],
    },
    {
      id: 'fiscal',
      label: copy.sections.fiscal.label,
      title: copy.sections.fiscal.title,
      description: copy.sections.fiscal.description,
      items: [
        buildLandingItem({
          slug: 'certificats-donacio',
          previewLocale: locale,
          detailLocale,
          fallbackImage: visuals.fiscal,
          ctaLabel: copy.detailCta,
          demoBadge: copy.demoBadge,
          landingBadge: copy.landingBadge,
        }),
        buildLandingItem({
          slug: 'model-182',
          previewLocale: locale,
          detailLocale,
          fallbackImage: visuals.fiscal,
          ctaLabel: copy.detailCta,
          demoBadge: copy.demoBadge,
          landingBadge: copy.landingBadge,
        }),
        buildLandingItem({
          slug: 'model-347-ong',
          previewLocale: locale,
          detailLocale,
          fallbackImage: visuals.fiscal,
          ctaLabel: copy.detailCta,
          demoBadge: copy.demoBadge,
          landingBadge: copy.landingBadge,
        }),
        buildStaticItem({
          id: 'fiscal-export',
          title: locale === 'ca' ? 'Excel per a gestoria' : locale === 'es' ? 'Excel para gestoría' : locale === 'fr' ? 'Excel pour le cabinet' : 'Excel para contabilidade',
          description: locale === 'ca'
            ? 'Prepara la sortida final perquè la gestoria treballi amb una base neta.'
            : locale === 'es'
              ? 'Prepara la salida final para que la gestoría trabaje con una base limpia.'
              : locale === 'fr'
                ? 'Prépare la sortie finale pour que le cabinet travaille avec une base propre.'
                : 'Prepara a saída final para que a contabilidade trabalhe com uma base limpa.',
          image: '/visuals/web/features-v3/block4_excel_gestoria_start_4k.webp',
          href: `/${detailLocale}/model-182`,
          ctaLabel: copy.detailCta,
          badgeLabel: copy.screenBadge,
        }),
      ],
    },
    {
      id: 'projects',
      label: copy.sections.projects.label,
      title: copy.sections.projects.title,
      description: copy.sections.projects.description,
      items: [
        buildLandingItem({
          slug: 'gestio-projectes-justificacio',
          previewLocale: locale,
          detailLocale,
          fallbackImage: visuals.projects,
          ctaLabel: copy.detailCta,
          demoBadge: copy.demoBadge,
          landingBadge: copy.landingBadge,
        }),
        buildStaticItem({
          id: 'projects-grants',
          title: copy.sections.projects.items!.grants.title,
          description: copy.sections.projects.items!.grants.description,
          image: visuals.projects,
          href: `/${detailLocale}/gestio-projectes-justificacio`,
          ctaLabel: copy.detailCta,
          badgeLabel: copy.screenBadge,
        }),
        buildStaticItem({
          id: 'projects-reporting',
          title: copy.sections.projects.items!.reporting.title,
          description: copy.sections.projects.items!.reporting.description,
          image: visuals.projects,
          href: `/${detailLocale}/gestio-projectes-justificacio`,
          ctaLabel: copy.detailCta,
          badgeLabel: copy.screenBadge,
        }),
      ],
    },
    {
      id: 'control',
      label: copy.sections.control.label,
      title: copy.sections.control.title,
      description: copy.sections.control.description,
      items: [
        buildLandingItem({
          slug: 'control-visibilitat-entitats',
          previewLocale: locale,
          detailLocale,
          fallbackImage: visuals.dashboard,
          ctaLabel: copy.detailCta,
          demoBadge: copy.demoBadge,
          landingBadge: copy.landingBadge,
        }),
        buildStaticItem({
          id: 'control-metrics',
          title: copy.sections.control.items!.metrics.title,
          description: copy.sections.control.items!.metrics.description,
          image: visuals.dashboard,
          href: `/${detailLocale}/control-visibilitat-entitats`,
          ctaLabel: copy.detailCta,
          badgeLabel: copy.screenBadge,
        }),
        buildStaticItem({
          id: 'control-reports',
          title: copy.sections.control.items!.reports.title,
          description: copy.sections.control.items!.reports.description,
          image: visuals.reports,
          href: `/${detailLocale}/control-visibilitat-entitats`,
          ctaLabel: copy.detailCta,
          badgeLabel: copy.screenBadge,
        }),
      ],
    },
  ];

  return (
    <main className={pageShellClass}>
      <PublicSiteHeader locale={locale} currentSection="features" />

      <section className={`pb-8 pt-8 lg:pt-12 ${PUBLIC_SHELL_X}`}>
        <div className="mx-auto max-w-6xl">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="rounded-full px-4 text-muted-foreground hover:text-foreground"
          >
            <Link href={`/${locale}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t.common.backToHome}
            </Link>
          </Button>

          <div className="mt-6 max-w-4xl space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
              {copy.eyebrow}
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-[3.4rem] lg:leading-[1.02]">
              {layoutCopy.title}
            </h1>
            <PublicEditorialMark size="sm" className="-mt-2 opacity-70" />
            <p className="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              {layoutCopy.lead}
            </p>
          </div>
        </div>
      </section>

      <section className={`pb-16 ${PUBLIC_SHELL_X}`}>
        <div className="mx-auto max-w-6xl space-y-6">
          {sections.map((section, index) => {
            const media = section.items[0]?.media ?? showcaseMedia[section.id as FeatureSectionKey];

            return (
              <article
                key={section.id}
                id={section.id}
                className="scroll-mt-24 py-4 sm:py-5"
              >
                <div className="grid gap-7 lg:grid-cols-[0.76fr_1.24fr] lg:items-start lg:gap-10">
                  <div>
                    <div className="space-y-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {locale === 'ca'
                          ? `Bloc ${index + 1}`
                          : locale === 'es'
                            ? `Bloque ${index + 1}`
                            : locale === 'fr'
                              ? `Bloc ${index + 1}`
                              : `Bloco ${index + 1}`}
                      </p>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {section.label}
                      </p>
                      <h2 className="text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-[2.15rem] sm:leading-[1.04]">
                        {section.title}
                      </h2>
                      <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                        {section.description}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="rounded-[2.05rem] bg-[radial-gradient(circle_at_top_right,rgba(191,219,254,0.36),rgba(255,255,255,0)_34%),linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.96))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_28px_70px_-56px_rgba(15,23,42,0.16)] ring-1 ring-black/[0.04] sm:p-4">
                      <div className="mb-3 flex items-center justify-between gap-3 px-1">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          {section.items.slice(0, 2).map((item) => (
                            <span
                              key={item.id}
                              className="inline-flex items-center rounded-full bg-white/72 px-3 py-1.5 text-[11px] font-medium text-slate-500 ring-1 ring-black/[0.05] backdrop-blur"
                            >
                              {item.title}
                            </span>
                          ))}
                        </div>
                      </div>
                      <PublicFeatureDemo
                        locale={locale}
                        media={media}
                        variant="stage"
                        showDemoBadge={false}
                        showCaptionsBadge={false}
                        expandOnPlay={false}
                        dialogTitle={section.title}
                        dialogDescription={section.description}
                        className="bg-transparent"
                      />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={`pb-20 ${PUBLIC_SHELL_X}`}>
        <div className="mx-auto max-w-6xl rounded-[2.4rem] border border-sky-200/70 bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(255,255,255,0.96)_45%,rgba(240,249,255,0.92))] p-6 shadow-[0_30px_90px_-56px_rgba(14,165,233,0.45)] sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.92fr] lg:items-center">
            <div className="space-y-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                {copy.footerEyebrow}
              </p>
              <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2.45rem]">
                {copy.footerTitle}
              </h2>
              <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                {copy.footerDescription}
              </p>
              <Button asChild size="lg" className="rounded-full px-8">
                <Link href={contactHref}>
                  {t.cta.primary}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="rounded-[1.9rem] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.28)] sm:p-7">
              <p className="text-sm leading-6 text-slate-600">{copy.footerSupportNote}</p>
              <PublicDirectContact locale={locale} className="mt-6 border-t border-border/60 pt-6" />
            </div>
          </div>
        </div>
      </section>

      <PublicSiteFooter locale={locale} />
    </main>
  );
}
