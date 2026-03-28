import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { PublicFeaturesExplorer, type PublicFeaturesExplorerItem, type PublicFeaturesExplorerSection } from '@/components/public/PublicFeaturesExplorer';
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
  | 'dashboard'
  | 'conciliation'
  | 'expenses'
  | 'members'
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
  'min-h-screen bg-[linear-gradient(180deg,#f6f8fb_0%,#ffffff_24%,#ffffff_100%)]';

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
    footerEyebrow: 'Següent pas',
    footerTitle: 'Si un bloc ja et fa clic, baixem al detall',
    footerDescription:
      'Podem entrar directament a la landing d’aquella funcionalitat o ensenyar-te el flux en una demo curta.',
    sections: {
      dashboard: {
        label: 'Panell de control',
        title: 'Visió general del sistema',
        description:
          'Una entrada clara per veure estat, pendents i informació preparada per compartir amb l’equip o la junta.',
        items: {
          metrics: {
            title: 'Quadre de comandament',
            description:
              'Indicadors, alertes i visió general per saber què està passant sense navegar per deu pantalles.',
          },
          reports: {
            title: 'Informes i exports',
            description:
              'Informació llesta per baixar, revisar o compartir amb gestoria, junta o equip intern.',
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
      expenses: {
        label: 'Gestió de factures i liquidacions (amb IA)',
        title: 'Documents, pagaments i liquidacions',
        description:
          'Factures, nòmines, pagaments i tiquets dins del mateix flux, amb lectura assistida i menys treball manual.',
        items: {
          invoices: {
            title: 'Factures i nòmines amb IA',
            description:
              'Arrossegues documents, revises les dades llegides i els prepares per pagar sense picar-ho tot a mà.',
          },
          payments: {
            title: 'Pagaments SEPA',
            description:
              'Generes remeses de pagament amb els documents i imports ja ordenats dins del sistema.',
          },
          settlements: {
            title: 'Liquidacions i tiquets',
            description:
              'Captura de despeses, viatges i quilometratge amb liquidacions regenerables en PDF.',
          },
        },
      },
      members: {
        label: 'Gestió de socis i quotes',
        title: 'Base de socis, quotes i devolucions',
        description:
          'La relació amb socis i donants queda connectada amb quotes, incidències, rebuts retornats i historial d’aportacions.',
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
    footerEyebrow: 'Siguiente paso',
    footerTitle: 'Si un bloque ya encaja, bajamos al detalle',
    footerDescription:
      'Podemos entrar directamente en la landing de esa funcionalidad o enseñarte el flujo en una demo corta.',
    sections: {
      dashboard: {
        label: 'Panel de control',
        title: 'Visión general del sistema',
        description:
          'Una entrada clara para ver estado, pendientes e información lista para compartir con el equipo o la junta.',
        items: {
          metrics: {
            title: 'Cuadro de mando',
            description:
              'Indicadores, alertas y visión general para saber qué está pasando sin navegar por diez pantallas.',
          },
          reports: {
            title: 'Informes y exportaciones',
            description:
              'Información lista para descargar, revisar o compartir con gestoría, junta o equipo interno.',
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
      expenses: {
        label: 'Gestión de facturas y liquidaciones (con IA)',
        title: 'Documentos, pagos y liquidaciones',
        description:
          'Facturas, nóminas, pagos y tickets dentro del mismo flujo, con lectura asistida y menos trabajo manual.',
        items: {
          invoices: {
            title: 'Facturas y nóminas con IA',
            description:
              'Arrastras documentos, revisas los datos leídos y los preparas para pagar sin picarlo todo a mano.',
          },
          payments: {
            title: 'Pagos SEPA',
            description:
              'Generas remesas de pago con los documentos e importes ya ordenados dentro del sistema.',
          },
          settlements: {
            title: 'Liquidaciones y tickets',
            description:
              'Captura de gastos, viajes y kilometraje con liquidaciones regenerables en PDF.',
          },
        },
      },
      members: {
        label: 'Gestión de socios y cuotas',
        title: 'Base de socios, cuotas y devoluciones',
        description:
          'La relación con socios y donantes queda conectada con cuotas, incidencias, recibos devueltos e historial de aportaciones.',
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
    footerEyebrow: 'Étape suivante',
    footerTitle: 'Si un bloc vous parle déjà, on descend dans le détail',
    footerDescription:
      'Nous pouvons ouvrir directement la landing concernée ou vous montrer le flux dans une démo courte.',
    sections: {
      dashboard: {
        label: 'Tableau de bord',
        title: 'Vue générale du système',
        description:
          'Une entrée claire pour voir l’état, les points en attente et une information prête à être partagée.',
        items: {
          metrics: {
            title: 'Tableau de bord',
            description:
              'Indicateurs, alertes et vue générale pour comprendre la situation sans parcourir de nombreuses pages.',
          },
          reports: {
            title: 'Rapports et exports',
            description:
              'Information prête à télécharger, vérifier ou partager avec le cabinet, l’équipe ou le conseil.',
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
      expenses: {
        label: 'Gestion des factures et notes de frais (avec IA)',
        title: 'Documents, paiements et liquidations',
        description:
          'Factures, salaires, paiements et justificatifs dans le même flux, avec lecture assistée et moins de travail manuel.',
        items: {
          invoices: {
            title: 'Factures et salaires avec IA',
            description:
              'Vous déposez les documents, vérifiez les données lues et les préparez pour paiement sans tout ressaisir.',
          },
          payments: {
            title: 'Paiements SEPA',
            description:
              'Vous générez des remises de paiement avec documents et montants déjà ordonnés dans le système.',
          },
          settlements: {
            title: 'Notes de frais et justificatifs',
            description:
              'Capture des dépenses, déplacements et kilométrage avec PDF régénérables.',
          },
        },
      },
      members: {
        label: 'Gestion des membres et cotisations',
        title: 'Base membres, cotisations et rejets',
        description:
          'La relation avec membres et donateurs reste liée aux cotisations, incidents, rejets et historique de contributions.',
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
    footerEyebrow: 'Próximo passo',
    footerTitle: 'Se um bloco já fizer sentido, descemos ao detalhe',
    footerDescription:
      'Podemos abrir diretamente a landing dessa funcionalidade ou mostrar o fluxo numa demo curta.',
    sections: {
      dashboard: {
        label: 'Painel de controlo',
        title: 'Visão geral do sistema',
        description:
          'Uma entrada clara para ver estado, pendentes e informação pronta a partilhar com equipa ou direção.',
        items: {
          metrics: {
            title: 'Painel de controlo',
            description:
              'Indicadores, alertas e visão geral para perceber o estado sem navegar por demasiados ecrãs.',
          },
          reports: {
            title: 'Relatórios e exportações',
            description:
              'Informação pronta a descarregar, rever ou partilhar com contabilidade, equipa ou direção.',
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
      expenses: {
        label: 'Gestão de faturas e liquidações (com IA)',
        title: 'Documentos, pagamentos e liquidações',
        description:
          'Faturas, salários, pagamentos e comprovativos no mesmo fluxo, com leitura assistida e menos trabalho manual.',
        items: {
          invoices: {
            title: 'Faturas e salários com IA',
            description:
              'Arrastas documentos, revês os dados lidos e preparas tudo para pagamento sem voltar a digitar.',
          },
          payments: {
            title: 'Pagamentos SEPA',
            description:
              'Gerar remessas de pagamento com documentos e montantes já organizados dentro do sistema.',
          },
          settlements: {
            title: 'Liquidações e comprovativos',
            description:
              'Captura de despesas, viagens e quilometragem com PDF regenerável.',
          },
        },
      },
      members: {
        label: 'Gestão de sócios e quotas',
        title: 'Base de sócios, quotas e devoluções',
        description:
          'A relação com sócios e doadores fica ligada a quotas, incidências, recibos devolvidos e histórico de contribuições.',
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
  href: string;
  ctaLabel: string;
  badgeLabel: string;
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
  const detailLocale = getPublicDetailedGuidesLocale(locale);
  const visuals = getLocaleVisuals(locale);
  const guideHref = getPublicEconomicGuideHref(locale);
  const showDetailedGuides = hasPublicDetailedGuides(locale);
  const contactHref = `/${locale}/contact`;

  const sections: PublicFeaturesExplorerSection[] = [
    {
      id: 'dashboard',
      label: copy.sections.dashboard.label,
      title: copy.sections.dashboard.title,
      description: copy.sections.dashboard.description,
      items: [
        buildLandingItem({
          slug: 'software-gestion-ong',
          previewLocale: locale,
          detailLocale,
          fallbackImage: visuals.dashboard,
          ctaLabel: copy.detailCta,
          demoBadge: copy.demoBadge,
          landingBadge: copy.landingBadge,
        }),
        buildStaticItem({
          id: 'dashboard-metrics',
          title: copy.sections.dashboard.items!.metrics.title,
          description: copy.sections.dashboard.items!.metrics.description,
          image: visuals.dashboard,
          href: `/${detailLocale}/software-gestion-ong`,
          ctaLabel: copy.detailCta,
          badgeLabel: copy.screenBadge,
        }),
        buildStaticItem({
          id: 'dashboard-reports',
          title: copy.sections.dashboard.items!.reports.title,
          description: copy.sections.dashboard.items!.reports.description,
          image: visuals.reports,
          href: `/${detailLocale}/programa-associacions`,
          ctaLabel: copy.detailCta,
          badgeLabel: copy.screenBadge,
        }),
      ],
    },
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
      id: 'expenses',
      label: copy.sections.expenses.label,
      title: copy.sections.expenses.title,
      description: copy.sections.expenses.description,
      items: [
        buildStaticItem({
          id: 'expenses-invoices',
          title: copy.sections.expenses.items!.invoices.title,
          description: copy.sections.expenses.items!.invoices.description,
          image: visuals.expenses,
          href: contactHref,
          ctaLabel: copy.contactCta,
          badgeLabel: copy.screenBadge,
        }),
        buildStaticItem({
          id: 'expenses-payments',
          title: copy.sections.expenses.items!.payments.title,
          description: copy.sections.expenses.items!.payments.description,
          image: visuals.pending,
          href: contactHref,
          ctaLabel: copy.contactCta,
          badgeLabel: copy.screenBadge,
        }),
        buildStaticItem({
          id: 'expenses-settlements',
          title: copy.sections.expenses.items!.settlements.title,
          description: copy.sections.expenses.items!.settlements.description,
          image: visuals.liquidations,
          href: contactHref,
          ctaLabel: copy.contactCta,
          badgeLabel: copy.screenBadge,
        }),
      ],
    },
    {
      id: 'members',
      label: copy.sections.members.label,
      title: copy.sections.members.title,
      description: copy.sections.members.description,
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
      ],
    },
    {
      id: 'fiscal',
      label: copy.sections.fiscal.label,
      title: copy.sections.fiscal.title,
      description: copy.sections.fiscal.description,
      items: [
        buildLandingItem({
          slug: 'control-donacions-ong',
          previewLocale: locale,
          detailLocale,
          fallbackImage: visuals.donations,
          ctaLabel: copy.detailCta,
          demoBadge: copy.demoBadge,
          landingBadge: copy.landingBadge,
        }),
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
      ],
    },
    {
      id: 'projects',
      label: copy.sections.projects.label,
      title: copy.sections.projects.title,
      description: copy.sections.projects.description,
      items: [
        buildStaticItem({
          id: 'projects-budget',
          title: copy.sections.projects.items!.budget.title,
          description: copy.sections.projects.items!.budget.description,
          image: visuals.projects,
          href: contactHref,
          ctaLabel: copy.contactCta,
          badgeLabel: copy.screenBadge,
        }),
        buildStaticItem({
          id: 'projects-grants',
          title: copy.sections.projects.items!.grants.title,
          description: copy.sections.projects.items!.grants.description,
          image: visuals.projects,
          href: contactHref,
          ctaLabel: copy.contactCta,
          badgeLabel: copy.screenBadge,
        }),
        buildStaticItem({
          id: 'projects-reporting',
          title: copy.sections.projects.items!.reporting.title,
          description: copy.sections.projects.items!.reporting.description,
          image: visuals.projects,
          href: contactHref,
          ctaLabel: copy.contactCta,
          badgeLabel: copy.screenBadge,
        }),
      ],
    },
  ];

  return (
    <main className={pageShellClass}>
      <PublicSiteHeader locale={locale} currentSection="features" />

      <section className="px-6 pb-8 pt-8 lg:pt-12">
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

          <div className="mt-6 overflow-hidden rounded-[2.5rem] border border-slate-200/80 bg-white/96 p-6 shadow-[0_28px_90px_-60px_rgba(15,23,42,0.18)] sm:p-8 lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
              <div className="space-y-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                  {copy.eyebrow}
                </p>
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-[3.8rem] lg:leading-[1.02]">
                  {copy.title}
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                  {copy.lead}
                </p>
                <p className="max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                  {copy.helper}
                </p>
              </div>

              <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,0.96),rgba(240,249,255,0.82))] p-4 shadow-[0_22px_70px_-48px_rgba(15,23,42,0.18)]">
                <Image
                  src={visuals.summary}
                  alt={copy.title}
                  width={1600}
                  height={1000}
                  sizes="(min-width: 1024px) 44vw, 100vw"
                  className="rounded-[1.45rem] border border-white/80 shadow-[0_22px_60px_-44px_rgba(15,23,42,0.22)]"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-14">
        <div className="mx-auto max-w-6xl rounded-[2.5rem] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)] p-6 shadow-[0_28px_90px_-60px_rgba(15,23,42,0.18)] sm:p-8 lg:p-10">
          <PublicFeaturesExplorer locale={locale} sections={sections} />
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="mx-auto max-w-6xl rounded-[2.2rem] border border-slate-800 bg-slate-950 p-6 text-white shadow-[0_40px_120px_-64px_rgba(15,23,42,0.6)] sm:p-8 lg:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">
            {copy.footerEyebrow}
          </p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white lg:text-[2.45rem]">
            {copy.footerTitle}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
            {copy.footerDescription}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-white text-slate-950 hover:bg-white/90">
              <Link href={contactHref}>
                {t.cta.primary}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            {showDetailedGuides ? (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href={guideHref}>{copy.detailCta}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <PublicSiteFooter locale={locale} />
    </main>
  );
}
