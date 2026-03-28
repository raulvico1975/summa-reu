import type { PublicLocale } from '@/lib/public-locale';
import { getPublicDetailedGuidesLocale } from '@/lib/public-site-paths';

interface PublicLandingMetadata {
  title: string;
  description: string;
}

interface NumberedBlock {
  title: string;
  body: string;
}

export interface PublicLandingRelatedLink {
  slug: string;
  href: string;
  title: string;
  description: string;
}

export interface PublicLandingRelatedSection {
  title: string;
  intro: string;
  guide: {
    href: string;
    label: string;
    description: string;
  };
  items: PublicLandingRelatedLink[];
}

export interface PublicLandingContent {
  hero: {
    title: string;
    subtitle: string;
    introParagraphs: string[];
    media?: {
      type: 'image' | 'video';
      src: string;
      alt: string;
      poster?: string;
      mp4FallbackSrc?: string;
      captionsSrc?: string;
      captionsLang?: string;
      captionsLabel?: string;
      captionsDefault?: boolean;
      captionsDisplay?: 'native' | 'overlay';
      durationLabel?: string;
      autoPlay?: boolean;
      loop?: boolean;
      controls?: boolean;
      muted?: boolean;
    };
  };
  problem: {
    title: string;
    intro: string;
    points: string[];
    outroParagraphs?: string[];
  };
  solution: {
    title: string;
    intro: string;
    steps: NumberedBlock[];
  };
  includes: {
    title: string;
    intro: string;
    items: string[];
    outroParagraphs?: string[];
  };
  operationalBenefits: {
    title: string;
    items: string[];
  };
  forSmallAndMidEntities: {
    title: string;
    paragraphs: string[];
  };
  finalCta: {
    title: string;
    text: string;
    linkLabel: string;
    href: string;
  };
  relatedLandings?: PublicLandingRelatedSection;
}

export type PublicLandingHeroMedia = NonNullable<PublicLandingContent['hero']['media']>;

interface PublicLandingDefinition {
  slug: string;
  metadata: Record<PublicLocale, PublicLandingMetadata>;
  content: Partial<Record<PublicLocale, PublicLandingContent>> & { ca: PublicLandingContent };
}

export type PublicLandingSlug =
  | 'model-182'
  | 'certificats-donacio'
  | 'model-347-ong'
  | 'remeses-sepa'
  | 'devolucions-rebuts-socis'
  | 'conciliacio-bancaria-ong'
  | 'importar-extracte-bancari'
  | 'gestio-donants'
  | 'control-donacions-ong'
  | 'software-gestion-ong'
  | 'programa-associacions';

const LANDING_NAMES: Record<string, Record<PublicLocale, string>> = {
  'model-182': {
    ca: 'Model 182',
    es: 'Modelo 182',
    fr: 'Modele 182',
    pt: 'Modelo 182',
  },
  'certificats-donacio': {
    ca: 'Certificats de donació',
    es: 'Certificados de donacion',
    fr: 'Certificats de don',
    pt: 'Certificados de doacao',
  },
  'model-347-ong': {
    ca: 'Model 347 per a ONG',
    es: 'Modelo 347 para ONG',
    fr: 'Modele 347 pour associations',
    pt: 'Modelo 347 para ONG',
  },
  'remeses-sepa': {
    ca: 'Remeses SEPA',
    es: 'Remesas SEPA',
    fr: 'Prelevements SEPA',
    pt: 'Remessas SEPA',
  },
  'devolucions-rebuts-socis': {
    ca: 'Devolucions de rebuts de socis',
    es: 'Devoluciones de recibos de socios',
    fr: 'Rejets de recus de membres',
    pt: 'Devolucoes de recibos de socios',
  },
  'importar-extracte-bancari': {
    ca: 'Importar extracte bancari',
    es: 'Importar extracto bancario',
    fr: 'Importer un extrait bancaire',
    pt: 'Importar extrato bancario',
  },
  'conciliacio-bancaria-ong': {
    ca: 'Conciliació bancària per ONG',
    es: 'Conciliacion bancaria para ONG',
    fr: 'Conciliation bancaire pour associations',
    pt: 'Conciliacao bancaria para ONG',
  },
  'control-donacions-ong': {
    ca: 'Control de donacions per ONG',
    es: 'Control de donaciones para ONG',
    fr: 'Controle des dons pour associations',
    pt: 'Controle de doacoes para ONG',
  },
  'software-gestion-ong': {
    ca: 'Software de gestió per ONG',
    es: 'Software de gestion para ONG',
    fr: 'Logiciel de gestion pour associations',
    pt: 'Software de gestao para ONG',
  },
  'programa-associacions': {
    ca: 'Programa per associacions i ONG',
    es: 'Programa para asociaciones y ONG',
    fr: 'Programme pour associations et ONG',
    pt: 'Programa para associacoes e ONG',
  },
  'gestio-donants': {
    ca: 'Gestió de donants',
    es: 'Gestion de donantes',
    fr: 'Gestion des donateurs',
    pt: 'Gestao de doadores',
  },
};

function contactHref(locale: PublicLocale) {
  return `/${locale}/contact`;
}

function publicGuideHref(locale: PublicLocale) {
  const guideLocale = getPublicDetailedGuidesLocale(locale);
  return `/${guideLocale}/gestio-economica-ong`;
}

const RELATED_LANDINGS_BY_SLUG: Record<PublicLandingSlug, PublicLandingSlug[]> = {
  'model-182': ['certificats-donacio', 'control-donacions-ong', 'devolucions-rebuts-socis'],
  'certificats-donacio': ['model-182', 'control-donacions-ong', 'devolucions-rebuts-socis'],
  'model-347-ong': ['importar-extracte-bancari', 'conciliacio-bancaria-ong', 'model-182'],
  'remeses-sepa': ['devolucions-rebuts-socis', 'control-donacions-ong', 'conciliacio-bancaria-ong'],
  'devolucions-rebuts-socis': ['remeses-sepa', 'control-donacions-ong', 'model-182'],
  'conciliacio-bancaria-ong': ['importar-extracte-bancari', 'control-donacions-ong', 'model-347-ong'],
  'importar-extracte-bancari': ['conciliacio-bancaria-ong', 'model-347-ong', 'control-donacions-ong'],
  'gestio-donants': ['control-donacions-ong', 'certificats-donacio', 'model-182'],
  'control-donacions-ong': ['certificats-donacio', 'model-182', 'remeses-sepa'],
  'software-gestion-ong': ['programa-associacions', 'gestio-donants', 'control-donacions-ong'],
  'programa-associacions': ['software-gestion-ong', 'gestio-donants', 'remeses-sepa'],
};

const LANDING_TEASERS: Record<PublicLandingSlug, Record<PublicLocale, string>> = {
  'model-182': {
    ca: "Prepara el Model 182 a partir de donacions, devolucions i dades fiscals ja ordenades.",
    es: 'Prepara el Modelo 182 con una base fiscal ya ordenada.',
    fr: 'Preparez le Modele 182 a partir de donnees deja ordonnees.',
    pt: 'Prepare o Modelo 182 com base fiscal ja organizada.',
  },
  'certificats-donacio': {
    ca: 'Genera i envia certificats de donació sense plantilles manuals ni revisions disperses.',
    es: 'Genera certificados de donacion sin plantillas manuales.',
    fr: 'Generez des certificats de don sans modeles manuels.',
    pt: 'Gere certificados de doacao sem modelos manuais.',
  },
  'model-347-ong': {
    ca: 'Revisa operacions amb tercers i prepara el Model 347 amb els proveïdors ben identificats.',
    es: 'Revisa operaciones con terceros y prepara el Modelo 347.',
    fr: 'Revisez les operations avec des tiers et preparez le Modele 347.',
    pt: 'Reveja operacoes com terceiros e prepare o Modelo 347.',
  },
  'remeses-sepa': {
    ca: 'Genera remeses SEPA de quotes amb control dels imports, periodicitats i fitxer bancari.',
    es: 'Genera remesas SEPA de cuotas con control previo.',
    fr: 'Generez des prelevements SEPA avec controle prealable.',
    pt: 'Gere remessas SEPA de quotas com controlo previo.',
  },
  'devolucions-rebuts-socis': {
    ca: 'Gestiona rebuts retornats i assigna cada devolució al soci correcte abans del tancament fiscal.',
    es: 'Gestiona recibos devueltos y asigna cada devolucion correctamente.',
    fr: 'Gerez les rejets et attribuez chaque retour au bon membre.',
    pt: 'Gira recibos devolvidos e atribua cada devolucao corretamente.',
  },
  'conciliacio-bancaria-ong': {
    ca: 'Centralitza moviments bancaris i treballa la conciliació amb criteri i traçabilitat.',
    es: 'Centraliza movimientos bancarios y conciliacion.',
    fr: 'Centralisez les mouvements bancaires et le rapprochement.',
    pt: 'Centralize movimentos bancarios e reconciliacao.',
  },
  'importar-extracte-bancari': {
    ca: "Importa l'extracte bancari i converteix-lo en base de treball per a la gestió econòmica.",
    es: 'Importa el extracto bancario y trabaja sobre movimientos reales.',
    fr: 'Importez le releve bancaire et travaillez sur les mouvements reels.',
    pt: 'Importe o extrato bancario e trabalhe sobre movimentos reais.',
  },
  'gestio-donants': {
    ca: "Mantén una base clara de socis i donants vinculada a l'historial d'aportacions i devolucions.",
    es: 'Mantiene una base clara de socios y donantes.',
    fr: 'Maintenez une base claire de membres et donateurs.',
    pt: 'Mantenha uma base clara de socios e doadores.',
  },
  'control-donacions-ong': {
    ca: 'Segueix les aportacions de cada donant i entén millor la base econòmica de l’entitat.',
    es: 'Sigue las aportaciones de cada donante.',
    fr: 'Suivez les contributions de chaque donateur.',
    pt: 'Acompanhe as contribuicoes de cada doador.',
  },
  'software-gestion-ong': {
    ca: 'Visió general del software per centralitzar moviments, donants, quotes i fiscalitat.',
    es: 'Vision general del software de gestion para ONG.',
    fr: 'Vue d ensemble du logiciel de gestion pour associations.',
    pt: 'Visao geral do software de gestao para ONG.',
  },
  'programa-associacions': {
    ca: 'Alternativa clara a Excel per ordenar la gestió econòmica d’associacions i ONG.',
    es: 'Alternativa clara a Excel para asociaciones y ONG.',
    fr: 'Alternative claire a Excel pour associations et ONG.',
    pt: 'Alternativa clara ao Excel para associacoes e ONG.',
  },
};

function buildRelatedLandingsSection(
  locale: PublicLocale,
  slug: PublicLandingSlug
): PublicLandingRelatedSection {
  const relatedSlugs = RELATED_LANDINGS_BY_SLUG[slug];

  return {
    title:
      locale === 'ca'
        ? 'També et pot interessar'
        : locale === 'es'
          ? 'Tambien te puede interesar'
          : locale === 'fr'
            ? 'Cela peut aussi vous interesser'
            : 'Tambem te pode interessar',
    intro:
      locale === 'ca'
        ? 'Si estàs treballant aquesta part de la gestió econòmica, aquestes pàgines et donaran context complementari dins del mateix recorregut.'
        : locale === 'es'
          ? 'Si estas trabajando esta parte de la gestión económica, estas páginas te dan contexto complementario dentro del mismo recorrido.'
          : locale === 'fr'
            ? 'Si vous travaillez cette partie de la gestion économique, ces pages apportent un contexte complémentaire.'
            : 'Se estás a trabalhar esta área da gestão económica, estas páginas dão contexto complementar.',
    guide: {
      href: publicGuideHref(locale),
      label:
        locale === 'ca'
          ? 'Guia de gestió econòmica per a ONG'
          : locale === 'es'
            ? 'Guía de gestión económica para ONG'
            : locale === 'fr'
              ? 'Guide de gestion économique pour associations'
              : 'Guia de gestão económica para ONG',
      description:
        locale === 'ca'
          ? 'Visió general dels processos clau: conciliació bancària, remeses, donants i fiscalitat.'
          : locale === 'es'
            ? 'Visión general de los procesos clave: conciliación bancaria, remesas, donantes y fiscalidad.'
            : locale === 'fr'
              ? 'Vue générale des processus clés : rapprochement bancaire, prélèvements, donateurs et fiscalité.'
              : 'Visão geral dos processos-chave: reconciliação bancária, remessas, doadores e fiscalidade.',
    },
    items: relatedSlugs.map((relatedSlug) => ({
      slug: relatedSlug,
      href: `/${locale}/${relatedSlug}`,
      title: LANDING_NAMES[relatedSlug][locale],
      description: LANDING_TEASERS[relatedSlug][locale],
    })),
  };
}

function withRelatedLandings(
  content: PublicLandingContent,
  locale: PublicLocale,
  slug: PublicLandingSlug
): PublicLandingContent {
  return {
    ...content,
    relatedLandings: buildRelatedLandingsSection(locale, slug),
  };
}

function buildPendingContent(locale: PublicLocale, landingName: string): PublicLandingContent {
  if (locale === 'es') {
    return {
      hero: {
        title: landingName,
        subtitle: 'Contenido en preparacion',
        introParagraphs: [
          `Esta landing sobre ${landingName} ya tiene estructura tecnica y visual preparada.`,
          'El contenido final se anadira cuando se cierre el texto funcional validado.',
        ],
      },
      problem: {
        title: 'Problema real',
        intro: 'Pendiente de definir con contenido funcional validado.',
        points: [
          'Punto pendiente de validacion funcional.',
          'Punto pendiente de validacion funcional.',
          'Punto pendiente de validacion funcional.',
        ],
      },
      solution: {
        title: 'Como lo resuelve Summa Social',
        intro: 'Bloque preparado para documentar el flujo real con 5 pasos.',
        steps: [
          { title: 'Paso 1 (pendiente)', body: 'Detalle pendiente de validacion.' },
          { title: 'Paso 2 (pendiente)', body: 'Detalle pendiente de validacion.' },
          { title: 'Paso 3 (pendiente)', body: 'Detalle pendiente de validacion.' },
          { title: 'Paso 4 (pendiente)', body: 'Detalle pendiente de validacion.' },
          { title: 'Paso 5 (pendiente)', body: 'Detalle pendiente de validacion.' },
        ],
      },
      includes: {
        title: 'Que incluye / que permite',
        intro: 'Seccion preparada para listar alcance funcional real.',
        items: [
          'Elemento pendiente de validacion.',
          'Elemento pendiente de validacion.',
          'Elemento pendiente de validacion.',
        ],
      },
      operationalBenefits: {
        title: 'Beneficios operativos',
        items: [
          'Beneficio pendiente de validacion.',
          'Beneficio pendiente de validacion.',
          'Beneficio pendiente de validacion.',
        ],
      },
      forSmallAndMidEntities: {
        title: 'Pensado para entidades pequenas y medianas',
        paragraphs: [
          'Texto pendiente de validacion funcional.',
          'Texto pendiente de validacion funcional.',
        ],
      },
      finalCta: {
        title: 'CTA final',
        text: 'Si quieres priorizar esta landing, escribenos y preparamos el contenido validado.',
        linkLabel: 'Contacto',
        href: contactHref(locale),
      },
    };
  }

  if (locale === 'fr') {
    return {
      hero: {
        title: landingName,
        subtitle: 'Contenu en preparation',
        introParagraphs: [
          `Cette landing sur ${landingName} dispose deja de sa structure technique et visuelle.`,
          'Le contenu final sera ajoute une fois le texte fonctionnel valide.',
        ],
      },
      problem: {
        title: 'Probleme reel',
        intro: 'Section en attente de contenu fonctionnel valide.',
        points: [
          'Point en attente de validation fonctionnelle.',
          'Point en attente de validation fonctionnelle.',
          'Point en attente de validation fonctionnelle.',
        ],
      },
      solution: {
        title: 'Comment Summa Social le resout',
        intro: 'Bloc reserve pour documenter le flux reel en 5 etapes.',
        steps: [
          { title: 'Etape 1 (en attente)', body: 'Detail en attente de validation.' },
          { title: 'Etape 2 (en attente)', body: 'Detail en attente de validation.' },
          { title: 'Etape 3 (en attente)', body: 'Detail en attente de validation.' },
          { title: 'Etape 4 (en attente)', body: 'Detail en attente de validation.' },
          { title: 'Etape 5 (en attente)', body: 'Detail en attente de validation.' },
        ],
      },
      includes: {
        title: 'Ce que ca inclut / permet',
        intro: 'Section prete pour lister le perimetre fonctionnel reel.',
        items: [
          'Element en attente de validation.',
          'Element en attente de validation.',
          'Element en attente de validation.',
        ],
      },
      operationalBenefits: {
        title: 'Benefices operationnels',
        items: [
          'Benefice en attente de validation.',
          'Benefice en attente de validation.',
          'Benefice en attente de validation.',
        ],
      },
      forSmallAndMidEntities: {
        title: 'Pense pour les petites et moyennes entites',
        paragraphs: [
          'Texte en attente de validation fonctionnelle.',
          'Texte en attente de validation fonctionnelle.',
        ],
      },
      finalCta: {
        title: 'CTA final',
        text: 'Si vous souhaitez prioriser cette landing, contactez-nous pour preparer le contenu valide.',
        linkLabel: 'Contact',
        href: contactHref(locale),
      },
    };
  }

  if (locale === 'pt') {
    return {
      hero: {
        title: landingName,
        subtitle: 'Conteudo em preparacao',
        introParagraphs: [
          `Esta landing sobre ${landingName} ja tem estrutura tecnica e visual preparada.`,
          'O conteudo final sera adicionado quando o texto funcional estiver validado.',
        ],
      },
      problem: {
        title: 'Problema real',
        intro: 'Secao pendente de conteudo funcional validado.',
        points: [
          'Ponto pendente de validacao funcional.',
          'Ponto pendente de validacao funcional.',
          'Ponto pendente de validacao funcional.',
        ],
      },
      solution: {
        title: 'Como a Summa Social resolve',
        intro: 'Bloco preparado para descrever o fluxo real em 5 passos.',
        steps: [
          { title: 'Passo 1 (pendente)', body: 'Detalhe pendente de validacao.' },
          { title: 'Passo 2 (pendente)', body: 'Detalhe pendente de validacao.' },
          { title: 'Passo 3 (pendente)', body: 'Detalhe pendente de validacao.' },
          { title: 'Passo 4 (pendente)', body: 'Detalhe pendente de validacao.' },
          { title: 'Passo 5 (pendente)', body: 'Detalhe pendente de validacao.' },
        ],
      },
      includes: {
        title: 'O que inclui / o que permite',
        intro: 'Secao pronta para listar o alcance funcional real.',
        items: [
          'Item pendente de validacao.',
          'Item pendente de validacao.',
          'Item pendente de validacao.',
        ],
      },
      operationalBenefits: {
        title: 'Beneficios operacionais',
        items: [
          'Beneficio pendente de validacao.',
          'Beneficio pendente de validacao.',
          'Beneficio pendente de validacao.',
        ],
      },
      forSmallAndMidEntities: {
        title: 'Pensado para entidades pequenas e medias',
        paragraphs: [
          'Texto pendente de validacao funcional.',
          'Texto pendente de validacao funcional.',
        ],
      },
      finalCta: {
        title: 'CTA final',
        text: 'Se quiser priorizar esta landing, fale connosco para preparar o conteudo validado.',
        linkLabel: 'Contacto',
        href: contactHref(locale),
      },
    };
  }

  return {
    hero: {
      title: landingName,
      subtitle: 'Contingut en preparació',
      introParagraphs: [
        `Aquesta landing sobre ${landingName} ja té l'esquelet tècnic i visual preparat.`,
        "El contingut final s'afegirà quan es tanqui el text funcional validat.",
      ],
    },
    problem: {
      title: 'Problema real',
      intro: 'Apartat pendent de definir amb contingut funcional validat.',
      points: [
        'Punt pendent de validació funcional.',
        'Punt pendent de validació funcional.',
        'Punt pendent de validació funcional.',
      ],
    },
    solution: {
      title: 'Com ho resol Summa Social',
      intro: 'Bloc preparat per documentar el flux real en 5 passos.',
      steps: [
        { title: 'Pas 1 (pendent)', body: 'Detall pendent de validació.' },
        { title: 'Pas 2 (pendent)', body: 'Detall pendent de validació.' },
        { title: 'Pas 3 (pendent)', body: 'Detall pendent de validació.' },
        { title: 'Pas 4 (pendent)', body: 'Detall pendent de validació.' },
        { title: 'Pas 5 (pendent)', body: 'Detall pendent de validació.' },
      ],
    },
    includes: {
      title: 'Què inclou / què permet',
      intro: "Secció preparada per llistar l'abast funcional real.",
      items: [
        'Element pendent de validació.',
        'Element pendent de validació.',
        'Element pendent de validació.',
      ],
    },
    operationalBenefits: {
      title: 'Beneficis operatius',
      items: [
        'Benefici pendent de validació.',
        'Benefici pendent de validació.',
        'Benefici pendent de validació.',
      ],
    },
    forSmallAndMidEntities: {
      title: 'Pensat per a entitats petites i mitjanes',
      paragraphs: [
        'Text pendent de validació funcional.',
        'Text pendent de validació funcional.',
      ],
    },
    finalCta: {
      title: 'CTA final',
      text: 'Si vols prioritzar aquesta landing, escriu-nos i preparem el contingut validat.',
      linkLabel: 'Contacte',
      href: contactHref(locale),
    },
  };
}

const MODEL_182_METADATA: Record<PublicLocale, PublicLandingMetadata> = {
  ca: {
    title: 'Model 182 per a ONG | Software de gestió per a entitats | Summa Social',
    description:
      "Com preparar el Model 182 d'una associació sense Excel ni errors. Controla donacions, devolucions i donants amb Summa Social.",
  },
  es: {
    title: 'Modelo 182 para ONG | Software de gestión para entidades | Summa Social',
    description:
      'Cómo preparar el Modelo 182 de una asociación sin Excel ni errores. Controla donaciones, devoluciones y donantes con Summa Social.',
  },
  fr: {
    title: 'Modele 182 | Summa Social',
    description: 'Landing en preparation pour le Modele 182 des associations.',
  },
  pt: {
    title: 'Modelo 182 | Summa Social',
    description: 'Landing em preparacao para Modelo 182 de entidades sem fins lucrativos.',
  },
};

const DONATION_CERTIFICATES_METADATA: Record<PublicLocale, PublicLandingMetadata> = {
  ca: {
    title: 'Certificats de donació per a ONG | Software de gestió per a entitats | Summa Social',
    description:
      'Genera i envia els certificats de donació sense plantilles manuals, sense errors i sense perdre hores cada any.',
  },
  es: {
    title: 'Certificados de donación para ONG | Software de gestión para entidades | Summa Social',
    description:
      'Genera y envía los certificados de donación sin plantillas manuales, sin errores y sin perder horas cada año.',
  },
  fr: {
    title: 'Certificats de don | Summa Social',
    description: 'Landing en preparation pour les certificats de don des associations.',
  },
  pt: {
    title: 'Certificados de doacao | Summa Social',
    description: 'Landing em preparacao para certificados de doacao de entidades sem fins lucrativos.',
  },
};

const DONATION_CERTIFICATES_CONTENT_CA: PublicLandingContent = {
  hero: {
    title: 'Certificats de donació per a ONG i associacions',
    subtitle: 'Genera i envia els certificats de donació sense plantilles manuals, sense errors i sense perdre hores cada any.',
    introParagraphs: [
      "Per a moltes entitats, l'emissió dels certificats de donació continua sent una tasca lenta i repetitiva. Cal revisar què ha donat cada persona, comprovar si hi ha devolucions, generar el document correcte i fer arribar el certificat al donant.",
      "Quan aquest procés es fa amb fulls de càlcul, plantilles i correus manuals, és fàcil que apareguin errors, duplicitats o simplement massa feina acumulada en pocs dies.",
      'Summa Social simplifica aquest procés.',
      "És una aplicació pensada específicament per a entitats socials que permet generar els certificats de donació a partir de les dades reals de l'any i enviar-los de manera ordenada des d'un únic lloc.",
    ],
    media: {
      type: 'video',
      src: '/visuals/landings/certificats-donacio/animations/anima-certificats.webm',
      mp4FallbackSrc: '/visuals/landings/certificats-donacio/animations/anima-certificats.mp4',
      poster: '/visuals/landings/certificats-donacio/optimized/anima-certificats-poster.webp',
      alt: 'Animació del procés de certificats de donació a Summa Social',
    },
  },
  problem: {
    title: 'El problema real dels certificats de donació',
    intro: "Quan arriba el moment d'emetre certificats, moltes entitats es troben amb situacions com aquestes:",
    points: [
      'cal revisar manualment què ha aportat cada donant',
      "s'han de restar devolucions o rebuts retornats",
      'hi ha dades fiscals incompletes',
      'els documents es generen un per un',
      "els correus s'han d'enviar manualment",
    ],
    outroParagraphs: [
      'El resultat acostuma a ser el mateix: hores de feina administrativa per completar una tasca que hauria de ser molt més simple.',
    ],
  },
  solution: {
    title: 'Com ho resol Summa Social',
    intro: "Summa Social genera els certificats a partir de la mateixa informació econòmica que l'entitat ja treballa durant l'any. Això permet que el procés sigui molt més clar i molt més fiable.",
    steps: [
      {
        title: "El sistema calcula l'import correcte",
        body: 'Cada certificat es genera a partir de les donacions reals registrades al sistema.',
      },
      {
        title: 'Les devolucions queden reflectides',
        body: "Si hi ha rebuts retornats o ajustos, el certificat recull l'import net real del donant.",
      },
      {
        title: 'El certificat es genera automàticament',
        body: "No cal preparar plantilles manuals ni copiar dades d'un lloc a un altre.",
      },
      {
        title: 'Es pot enviar des de la mateixa aplicació',
        body: "L'entitat pot gestionar l'enviament dels certificats sense sortir del sistema.",
      },
      {
        title: 'També es pot treballar en bloc',
        body: "Quan cal emetre molts certificats, el procés continua sent ordenat i assumible.",
      },
    ],
  },
  includes: {
    title: 'Què permet gestionar Summa Social',
    intro: "Amb Summa Social, l'entitat pot:",
    items: [
      'generar certificats individuals per a un donant concret',
      "preparar certificats anuals a partir de l'activitat real del donant",
      "gestionar l'emissió de certificats de forma massiva",
      'mantenir coherència entre certificats, donacions i devolucions',
      'centralitzar el procés dins de la mateixa aplicació',
    ],
    outroParagraphs: [
      'Això evita haver de repartir la feina entre Excel, PDFs solts i correus enviats manualment.',
    ],
  },
  operationalBenefits: {
    title: "Beneficis operatius per a l'entitat",
    items: [
      'Menys temps administratiu: els certificats es generen a partir de dades que ja estan treballades al sistema.',
      "Menys risc d'errors: l'import del certificat no depèn de càlculs manuals d'última hora.",
      "Procés més ordenat: la generació i l'enviament es fan des d'un únic entorn.",
      "Més tranquil·litat per a l'equip: quan arriba el moment d'emetre certificats, la feina ja no comença de zero.",
    ],
  },
  forSmallAndMidEntities: {
    title: 'Pensat per a entitats petites i mitjanes',
    paragraphs: [
      "Summa Social està dissenyat per a organitzacions que necessiten complir amb les seves obligacions fiscals sense afegir complexitat innecessària. És especialment útil per a entitats que gestionen socis o donants recurrents, han d'emetre certificats cada any, volen evitar processos manuals amb fulls de càlcul i necessiten una manera clara de controlar donacions i devolucions.",
      "No és una eina pensada per fer més gran la burocràcia. És una eina pensada per reduir-la. El millor és no esperar al moment d'emetre els certificats: si durant l'any les donacions i les devolucions ja queden ben registrades, el procés final es simplifica molt.",
    ],
  },
  finalCta: {
    title: 'Parlem de la teva entitat',
    text: "Si cada any la generació dels certificats de donació et porta massa hores o massa revisions manuals, escriu-nos i t'explicarem si Summa Social us pot ajudar a simplificar aquest procés.",
    linkLabel: 'Contacta amb nosaltres',
    href: '/ca/contact',
  },
};

const DONATION_CERTIFICATES_CONTENT_ES: PublicLandingContent = {
  hero: {
    title: 'Certificados de donación para ONG y asociaciones',
    subtitle: 'Genera y envía los certificados de donación sin plantillas manuales, sin errores y sin perder horas cada año.',
    introParagraphs: [
      'Para muchas entidades, la emisión de certificados de donación sigue siendo una tarea lenta y repetitiva. Hay que revisar qué ha donado cada persona, comprobar si hay devoluciones, generar el documento correcto y hacer llegar el certificado al donante.',
      'Cuando este proceso se hace con hojas de cálculo, plantillas y correos manuales, es fácil que aparezcan errores, duplicidades o simplemente demasiado trabajo acumulado en pocos días.',
      'Summa Social simplifica este proceso.',
      'Es una aplicación pensada específicamente para entidades sociales que permite generar los certificados de donación a partir de los datos reales del año y enviarlos de forma ordenada desde un único lugar.',
    ],
  },
  problem: {
    title: 'El problema real de los certificados de donación',
    intro: 'Cuando llega el momento de emitir certificados, muchas entidades se encuentran con situaciones como estas:',
    points: [
      'hay que revisar manualmente qué ha aportado cada donante',
      'hay que restar devoluciones o recibos devueltos',
      'faltan datos fiscales',
      'los documentos se generan uno a uno',
      'los correos deben enviarse manualmente',
    ],
    outroParagraphs: [
      'El resultado suele ser el mismo: horas de trabajo administrativo para completar una tarea que debería ser mucho más simple.',
    ],
  },
  solution: {
    title: 'Cómo lo resuelve Summa Social',
    intro:
      'Summa Social genera los certificados a partir de la misma información económica que la entidad ya trabaja durante el año. Esto hace que el proceso sea mucho más claro y fiable.',
    steps: [
      {
        title: 'El sistema calcula el importe correcto',
        body: 'Cada certificado se genera a partir de las donaciones reales registradas en el sistema.',
      },
      {
        title: 'Las devoluciones quedan reflejadas',
        body: 'Si hay recibos devueltos o ajustes, el certificado recoge el importe neto real del donante.',
      },
      {
        title: 'El certificado se genera automáticamente',
        body: 'No hace falta preparar plantillas manuales ni copiar datos de un sitio a otro.',
      },
      {
        title: 'Puede enviarse desde la misma aplicación',
        body: 'La entidad puede gestionar el envío de los certificados sin salir del sistema.',
      },
      {
        title: 'También puede trabajarse en bloque',
        body: 'Cuando hay que emitir muchos certificados, el proceso sigue siendo ordenado y asumible.',
      },
    ],
  },
  includes: {
    title: 'Qué permite gestionar Summa Social',
    intro: 'Con Summa Social, la entidad puede:',
    items: [
      'generar certificados individuales para un donante concreto',
      'preparar certificados anuales a partir de la actividad real del donante',
      'gestionar la emisión de certificados de forma masiva',
      'mantener coherencia entre certificados, donaciones y devoluciones',
      'centralizar el proceso dentro de la misma aplicación',
    ],
    outroParagraphs: [
      'Esto evita repartir el trabajo entre Excel, PDFs sueltos y correos enviados manualmente.',
    ],
  },
  operationalBenefits: {
    title: 'Beneficios operativos para la entidad',
    items: [
      'Menos tiempo administrativo: los certificados se generan a partir de datos que ya están trabajados en el sistema.',
      'Menos riesgo de errores: el importe del certificado no depende de cálculos manuales de última hora.',
      'Proceso más ordenado: la generación y el envío se hacen desde un único entorno.',
      'Más tranquilidad para el equipo: cuando llega el momento de emitir certificados, el trabajo ya no empieza de cero.',
    ],
  },
  forSmallAndMidEntities: {
    title: 'Pensado para entidades pequeñas y medianas',
    paragraphs: [
      'Summa Social está diseñado para organizaciones que necesitan cumplir con sus obligaciones fiscales sin añadir complejidad innecesaria. Es especialmente útil para entidades que gestionan socios o donantes recurrentes, deben emitir certificados cada año, quieren evitar procesos manuales con hojas de cálculo y necesitan una manera clara de controlar donaciones y devoluciones.',
      'No es una herramienta pensada para hacer más grande la burocracia. Es una herramienta pensada para reducirla. Lo mejor es no esperar al momento de emitir los certificados: si durante el año las donaciones y devoluciones ya quedan bien registradas, el proceso final se simplifica mucho.',
    ],
  },
  finalCta: {
    title: 'Hablemos de vuestra entidad',
    text: 'Si cada año la generación de certificados de donación os consume demasiadas horas o demasiadas revisiones manuales, escribidnos y os explicaremos si Summa Social puede ayudaros a simplificar este proceso.',
    linkLabel: 'Contacta con nosotros',
    href: '/es/contact',
  },
};

const SEPA_REMITTANCES_METADATA: Record<PublicLocale, PublicLandingMetadata> = {
  ca: {
    title: 'Remeses SEPA per a quotes de socis | Software de gestió per a entitats | Summa Social',
    description:
      'Prepara remeses SEPA de quotes de socis sense fulls de càlcul. Revisa IBAN, imports i genera el fitxer per al banc amb Summa Social.',
  },
  es: {
    title: 'Remesas SEPA para cuotas de socios | Software de gestión para entidades | Summa Social',
    description:
      'Prepara remesas SEPA de cuotas de socios sin hojas de cálculo. Revisa IBAN, importes y genera el fichero para el banco con Summa Social.',
  },
  fr: {
    title: 'Prelevements SEPA | Summa Social',
    description: 'Landing en preparation pour les prelevements SEPA des associations.',
  },
  pt: {
    title: 'Remessas SEPA | Summa Social',
    description: 'Landing em preparacao para remessas SEPA de entidades sem fins lucrativos.',
  },
};

const SEPA_REMITTANCES_CONTENT_CA: PublicLandingContent = {
  hero: {
    title: 'Cobrar quotes de socis amb remeses SEPA sense fulls de càlcul',
    subtitle: 'Genera les remeses de cobrament de manera clara i ordenada.',
    media: {
      type: 'video',
      src: '/visuals/landings/remeses-sepa/animations/remeses-sepa-demo-ca.mp4',
      poster: '/visuals/landings/remeses-sepa/optimized/remeses-sepa-demo-poster.webp',
      captionsSrc: '/visuals/landings/remeses-sepa/animations/remeses-sepa-demo-ca.vtt',
      captionsLang: 'ca',
      captionsLabel: 'Català',
      captionsDisplay: 'overlay',
      durationLabel: '14 s',
      autoPlay: false,
      loop: false,
      controls: true,
      muted: false,
      alt: 'Vídeo demostratiu de la generació de remeses SEPA de quotes de socis amb Summa Social',
    },
    introParagraphs: [
      'Moltes entitats cobren les quotes dels seus socis mitjançant domiciliació bancària. Però preparar les remeses SEPA acostuma a implicar fulls de càlcul, revisions manuals i molta cura per evitar errors.',
      'Cal comprovar els IBAN, revisar qui toca cobrar aquell mes, generar el fitxer correcte i enviar-lo al banc.',
      "Summa Social simplifica aquest procés. L'aplicació permet preparar les remeses de cobrament de quotes a partir de les dades reals dels socis i generar el fitxer que el banc necessita.",
    ],
  },
  problem: {
    title: 'El problema habitual amb les remeses de quotes',
    intro: 'Quan les remeses es preparen manualment, és fàcil trobar-se amb situacions com aquestes:',
    points: [
      'socis amb IBAN incorrecte o incomplet',
      'dificultat per saber a qui toca cobrar aquell mes',
      'errors en els imports de les quotes',
      'fitxers generats amb Excel que després el banc rebutja',
    ],
    outroParagraphs: [
      "A més, quan l'entitat té molts socis, el procés pot convertir-se en una tasca administrativa molt pesada.",
    ],
  },
  solution: {
    title: 'Com ho resol Summa Social',
    intro: 'Summa Social permet preparar les remeses de cobrament directament des de la informació dels socis. El procés és simple:',
    steps: [
      {
        title: "Selecciona el compte bancari de l'entitat",
        body: 'El sistema utilitza les dades del compte que cobrarà les quotes.',
      },
      {
        title: 'El sistema identifica els socis que toca cobrar',
        body: 'Segons la periodicitat de la quota, es pot preparar la remesa corresponent.',
      },
      {
        title: 'Revises la selecció',
        body: "Abans de generar la remesa, es pot comprovar qui s'inclou i qui no.",
      },
      {
        title: 'Es genera el fitxer SEPA',
        body: "L'entitat descarrega el fitxer amb el format que necessita el banc.",
      },
      {
        title: 'Puges el fitxer al banc',
        body: 'Amb el fitxer carregat al banc, es pot executar el cobrament de les quotes.',
      },
    ],
  },
  includes: {
    title: 'Què permet gestionar Summa Social',
    intro: "Amb Summa Social, l'entitat pot:",
    items: [
      'preparar remeses de cobrament de quotes',
      'gestionar socis amb diferents periodicitats de pagament',
      'detectar socis amb dades bancàries incompletes',
      "revisar fàcilment els cobraments abans d'enviar-los al banc",
    ],
    outroParagraphs: [
      "Tot el procés queda integrat amb la base de dades de donants i amb la gestió econòmica de l'entitat.",
    ],
  },
  operationalBenefits: {
    title: 'Beneficis operatius',
    items: [
      'Menys feina administrativa: no cal preparar fitxers manuals cada vegada.',
      "Menys risc d'errors: els cobraments es generen a partir de les dades dels socis.",
      'Més control sobre les quotes: és més fàcil veure qui paga, quan paga i quant paga.',
    ],
  },
  forSmallAndMidEntities: {
    title: 'Pensat per a entitats socials',
    paragraphs: [
      'Aquest sistema és especialment útil per a entitats que tenen socis amb quotes recurrents, cobren per domiciliació bancària i volen simplificar la gestió de les remeses.',
      'Summa Social no és un gestor bancari complet. És una eina pensada perquè les entitats socials puguin gestionar les quotes de manera clara i ordenada.',
    ],
  },
  finalCta: {
    title: 'Parlem de la teva entitat',
    text: 'Si la teva entitat cobra quotes de socis cada mes o cada trimestre, contacta amb nosaltres i veurem si Summa Social us pot ajudar a ordenar aquest procés.',
    linkLabel: 'Contacta amb nosaltres',
    href: '/ca/contact',
  },
};

const SEPA_REMITTANCES_CONTENT_ES: PublicLandingContent = {
  hero: {
    title: 'Cobrar cuotas de socios con remesas SEPA sin hojas de cálculo',
    subtitle: 'Genera las remesas de cobro de forma clara y ordenada.',
    media: {
      type: 'video',
      src: '/visuals/landings/remeses-sepa/animations/remeses-sepa-demo-es.mp4',
      poster: '/visuals/landings/remeses-sepa/optimized/remeses-sepa-demo-poster.webp',
      captionsSrc: '/visuals/landings/remeses-sepa/animations/remeses-sepa-demo-es.vtt',
      captionsLang: 'es',
      captionsLabel: 'Español',
      captionsDisplay: 'overlay',
      durationLabel: '14 s',
      autoPlay: false,
      loop: false,
      controls: true,
      muted: false,
      alt: 'Vídeo demostrativo de la generación de remesas SEPA de cuotas de socios con Summa Social',
    },
    introParagraphs: [
      'Muchas entidades cobran las cuotas de sus socios mediante domiciliación bancaria. Pero preparar las remesas SEPA suele implicar hojas de cálculo, revisiones manuales y mucho cuidado para evitar errores.',
      'Hay que comprobar los IBAN, revisar a quién toca cobrar ese mes, generar el fichero correcto y enviarlo al banco.',
      'Summa Social simplifica este proceso. La aplicación permite preparar las remesas de cobro de cuotas a partir de los datos reales de los socios y generar el fichero que el banco necesita.',
    ],
  },
  problem: {
    title: 'El problema habitual con las remesas de cuotas',
    intro: 'Cuando las remesas se preparan manualmente, es fácil encontrarse con situaciones como estas:',
    points: [
      'socios con IBAN incorrecto o incompleto',
      'dificultad para saber a quién toca cobrar ese mes',
      'errores en los importes de las cuotas',
      'ficheros generados con Excel que después el banco rechaza',
    ],
    outroParagraphs: [
      'Además, cuando la entidad tiene muchos socios, el proceso puede convertirse en una tarea administrativa muy pesada.',
    ],
  },
  solution: {
    title: 'Cómo lo resuelve Summa Social',
    intro: 'Summa Social permite preparar las remesas de cobro directamente desde la información de los socios. El proceso es simple:',
    steps: [
      {
        title: 'Selecciona la cuenta bancaria de la entidad',
        body: 'El sistema utiliza los datos de la cuenta que cobrará las cuotas.',
      },
      {
        title: 'El sistema identifica a los socios que toca cobrar',
        body: 'Según la periodicidad de la cuota, puede prepararse la remesa correspondiente.',
      },
      {
        title: 'Revisas la selección',
        body: 'Antes de generar la remesa, puede comprobarse quién se incluye y quién no.',
      },
      {
        title: 'Se genera el fichero SEPA',
        body: 'La entidad descarga el fichero con el formato que necesita el banco.',
      },
      {
        title: 'Subes el fichero al banco',
        body: 'Con el fichero cargado en el banco, ya puede ejecutarse el cobro de las cuotas.',
      },
    ],
  },
  includes: {
    title: 'Qué permite gestionar Summa Social',
    intro: 'Con Summa Social, la entidad puede:',
    items: [
      'preparar remesas de cobro de cuotas',
      'gestionar socios con distintas periodicidades de pago',
      'detectar socios con datos bancarios incompletos',
      'revisar fácilmente los cobros antes de enviarlos al banco',
    ],
    outroParagraphs: [
      'Todo el proceso queda integrado con la base de datos de donantes y con la gestión económica de la entidad.',
    ],
  },
  operationalBenefits: {
    title: 'Beneficios operativos',
    items: [
      'Menos trabajo administrativo: no hace falta preparar ficheros manuales cada vez.',
      'Menos riesgo de errores: los cobros se generan a partir de los datos de los socios.',
      'Más control sobre las cuotas: es más fácil ver quién paga, cuándo paga y cuánto paga.',
    ],
  },
  forSmallAndMidEntities: {
    title: 'Pensado para entidades sociales',
    paragraphs: [
      'Este sistema es especialmente útil para entidades que tienen socios con cuotas recurrentes, cobran por domiciliación bancaria y quieren simplificar la gestión de las remesas.',
      'Summa Social no es un gestor bancario completo. Es una herramienta pensada para que las entidades sociales puedan gestionar las cuotas de forma clara y ordenada.',
    ],
  },
  finalCta: {
    title: 'Hablemos de vuestra entidad',
    text: 'Si vuestra entidad cobra cuotas de socios cada mes o cada trimestre, contactad con nosotros y veremos si Summa Social puede ayudaros a ordenar este proceso.',
    linkLabel: 'Contacta con nosotros',
    href: '/es/contact',
  },
};

const BANK_STATEMENT_IMPORT_METADATA: Record<PublicLocale, PublicLandingMetadata> = {
  ca: {
    title: "Importar l'extracte bancari per a entitats | Software de gestió | Summa Social",
    description:
      "Importa l'extracte bancari i centralitza ingressos i despeses en un únic lloc. Classifica moviments i vincula transaccions amb donants o proveïdors.",
  },
  es: {
    title: 'Importar extracto bancario para entidades | Software de gestión | Summa Social',
    description:
      'Importa el extracto bancario y centraliza ingresos y gastos en un único lugar. Clasifica movimientos y vincula transacciones con donantes o proveedores.',
  },
  fr: {
    title: 'Importer un extrait bancaire | Summa Social',
    description: 'Landing en preparation pour l import des extraits bancaires des associations.',
  },
  pt: {
    title: 'Importar extrato bancario | Summa Social',
    description: 'Landing em preparacao para importacao de extratos bancarios de entidades.',
  },
};

const BANK_STATEMENT_IMPORT_CONTENT_CA: PublicLandingContent = {
  hero: {
    title: "Importar l'extracte bancari i tenir tots els moviments controlats",
    subtitle: 'Porta els moviments del banc a un únic lloc.',
    media: {
      type: 'video',
      src: '/visuals/landings/importar-extracte-bancari/animations/importar-extracte-bancari-demo-ca.mp4',
      poster: '/visuals/landings/importar-extracte-bancari/optimized/importar-extracte-bancari-demo-poster.webp',
      captionsSrc: '/visuals/landings/importar-extracte-bancari/animations/importar-extracte-bancari-demo-ca.vtt',
      captionsLang: 'ca',
      captionsLabel: 'Subtítols en català',
      captionsDisplay: 'overlay',
      durationLabel: '21 s',
      alt: "Vídeo de demostració de la importació d'extracte bancari a Summa Social",
      controls: true,
      autoPlay: false,
      loop: false,
      muted: false,
    },
    introParagraphs: [
      'Moltes entitats gestionen la seva informació econòmica amb extractes bancaris, fulls de càlcul i notes disperses. Això fa difícil tenir una visió clara de què ha passat realment durant el mes.',
      "Summa Social permet importar l'extracte bancari i treballar directament sobre els moviments.",
      'Així, totes les entrades i sortides de diners es poden revisar, classificar i vincular amb donants o proveïdors.',
    ],
  },
  problem: {
    title: 'El problema habitual amb els extractes bancaris',
    intro: 'Quan els moviments del banc es gestionen manualment, apareixen dificultats com:',
    points: [
      'moviments duplicats o mal registrats',
      'dificultat per saber a què correspon cada despesa',
      'pèrdua de temps classificant transaccions',
      'informació repartida entre diversos documents',
    ],
    outroParagraphs: ['El resultat acostuma a ser una gestió econòmica poc clara.'],
  },
  solution: {
    title: 'Com ho resol Summa Social',
    intro: 'Summa Social permet importar els moviments del banc de manera senzilla.',
    steps: [
      {
        title: 'Puges el fitxer del banc',
        body: 'Els extractes es poden importar en formats habituals com CSV o Excel.',
      },
      {
        title: 'El sistema detecta els moviments',
        body: "Cada línia d'extracte queda identificada com un moviment nou.",
      },
      {
        title: 'Cada moviment queda registrat',
        body: "Es guarda la data, la descripció i l'import per treballar-ho des del sistema.",
      },
      {
        title: 'Assignació de contactes i categories',
        body: 'Els moviments es poden vincular amb donants, proveïdors o categories de despesa.',
      },
      {
        title: 'Revisió i classificació',
        body: "L'equip de l'entitat pot revisar els moviments i completar la informació que calgui.",
      },
    ],
  },
  includes: {
    title: 'Què permet gestionar Summa Social',
    intro: "Amb els moviments importats, l'entitat pot:",
    items: [
      'tenir tots els ingressos i despeses en un únic lloc',
      'classificar moviments per categoria',
      'vincular transaccions amb donants o proveïdors',
      'adjuntar factures o documents relacionats',
    ],
    outroParagraphs: ['Això permet tenir una base econòmica clara per a informes, certificats o justificacions.'],
  },
  operationalBenefits: {
    title: 'Beneficis operatius',
    items: [
      'Visió clara de les finances: tots els moviments del banc es poden consultar i revisar fàcilment.',
      'Menys feina manual: no cal copiar dades del banc a Excel.',
      'Base fiable per als informes fiscals: la informació econòmica ja queda preparada per generar informes o certificats.',
    ],
  },
  forSmallAndMidEntities: {
    title: 'Pensat per a entitats petites i mitjanes',
    paragraphs: [
      "Summa Social està pensat per a entitats que gestionen els comptes amb extractes bancaris, volen tenir millor control de les despeses i ingressos i necessiten preparar informes fiscals o justificacions.",
      "No és un sistema comptable complex. És una eina per organitzar la informació econòmica de l'entitat.",
    ],
  },
  finalCta: {
    title: 'Parlem de la teva entitat',
    text: 'Si la teva entitat treballa amb extractes bancaris cada mes, contacta amb nosaltres i veurem si Summa Social us pot ajudar a ordenar aquesta operativa.',
    linkLabel: 'Contacta amb nosaltres',
    href: '/ca/contact',
  },
};

const BANK_STATEMENT_IMPORT_CONTENT_ES: PublicLandingContent = {
  hero: {
    title: 'Importar el extracto bancario y tener todos los movimientos controlados',
    subtitle: 'Lleva los movimientos del banco a un único lugar.',
    media: {
      type: 'video',
      src: '/visuals/landings/importar-extracte-bancari/animations/importar-extracte-bancari-demo-es.mp4',
      poster: '/visuals/landings/importar-extracte-bancari/optimized/importar-extracte-bancari-demo-poster.webp',
      captionsSrc: '/visuals/landings/importar-extracte-bancari/animations/importar-extracte-bancari-demo-es.vtt',
      captionsLang: 'es',
      captionsLabel: 'Subtítulos en castellano',
      captionsDisplay: 'overlay',
      durationLabel: '21 s',
      alt: 'Vídeo demostrativo de la importación de extracto bancario en Summa Social',
      controls: true,
      autoPlay: false,
      loop: false,
      muted: false,
    },
    introParagraphs: [
      'Muchas entidades gestionan su información económica con extractos bancarios, hojas de cálculo y notas dispersas. Eso hace difícil tener una visión clara de lo que ha pasado realmente durante el mes.',
      'Summa Social permite importar el extracto bancario y trabajar directamente sobre los movimientos.',
      'Así, todas las entradas y salidas de dinero pueden revisarse, clasificarse y vincularse con donantes o proveedores.',
    ],
  },
  problem: {
    title: 'El problema habitual con los extractos bancarios',
    intro: 'Cuando los movimientos del banco se gestionan manualmente, aparecen dificultades como:',
    points: [
      'movimientos duplicados o mal registrados',
      'dificultad para saber a qué corresponde cada gasto',
      'pérdida de tiempo clasificando transacciones',
      'información repartida entre varios documentos',
    ],
    outroParagraphs: ['El resultado suele ser una gestión económica poco clara.'],
  },
  solution: {
    title: 'Cómo lo resuelve Summa Social',
    intro: 'Summa Social permite importar los movimientos del banco de forma sencilla.',
    steps: [
      {
        title: 'Subes el fichero del banco',
        body: 'Los extractos pueden importarse en formatos habituales como CSV o Excel.',
      },
      {
        title: 'El sistema detecta los movimientos',
        body: 'Cada línea del extracto queda identificada como un movimiento nuevo.',
      },
      {
        title: 'Cada movimiento queda registrado',
        body: 'Se guarda la fecha, la descripción y el importe para trabajarlo desde el sistema.',
      },
      {
        title: 'Asignación de contactos y categorías',
        body: 'Los movimientos pueden vincularse con donantes, proveedores o categorías de gasto.',
      },
      {
        title: 'Revisión y clasificación',
        body: 'El equipo de la entidad puede revisar los movimientos y completar la información necesaria.',
      },
    ],
  },
  includes: {
    title: 'Qué permite gestionar Summa Social',
    intro: 'Con los movimientos importados, la entidad puede:',
    items: [
      'tener todos los ingresos y gastos en un único lugar',
      'clasificar movimientos por categoría',
      'vincular transacciones con donantes o proveedores',
      'adjuntar facturas o documentos relacionados',
    ],
    outroParagraphs: ['Esto permite tener una base económica clara para informes, certificados o justificaciones.'],
  },
  operationalBenefits: {
    title: 'Beneficios operativos',
    items: [
      'Visión clara de las finanzas: todos los movimientos del banco pueden consultarse y revisarse fácilmente.',
      'Menos trabajo manual: no hace falta copiar datos del banco a Excel.',
      'Base fiable para los informes fiscales: la información económica ya queda preparada para generar informes o certificados.',
    ],
  },
  forSmallAndMidEntities: {
    title: 'Pensado para entidades pequeñas y medianas',
    paragraphs: [
      'Summa Social está pensado para entidades que gestionan sus cuentas con extractos bancarios, quieren tener mejor control de gastos e ingresos y necesitan preparar informes fiscales o justificaciones.',
      'No es un sistema contable complejo. Es una herramienta para organizar la información económica de la entidad.',
    ],
  },
  finalCta: {
    title: 'Hablemos de vuestra entidad',
    text: 'Si vuestra entidad trabaja con extractos bancarios cada mes, contactad con nosotros y veremos si Summa Social puede ayudaros a ordenar esta operativa.',
    linkLabel: 'Contacta con nosotros',
    href: '/es/contact',
  },
};

const BANK_RECONCILIATION_ONG_METADATA: Record<PublicLocale, PublicLandingMetadata> = {
  ca: {
    title: 'Conciliació bancària per ONG | Summa Social',
    description: "Com controlar els moviments bancaris d'una ONG i classificar ingressos i despeses sense Excel.",
  },
  es: {
    title: 'Conciliación bancaria para ONG | Summa Social',
    description: 'Cómo controlar los movimientos bancarios de una ONG y clasificar ingresos y gastos sin Excel.',
  },
  fr: {
    title: 'Conciliation bancaire pour associations | Summa Social',
    description: 'Landing en preparation pour la conciliation bancaire des associations.',
  },
  pt: {
    title: 'Conciliacao bancaria para ONG | Summa Social',
    description: 'Landing em preparacao para conciliacao bancaria de entidades sem fins lucrativos.',
  },
};

const BANK_RECONCILIATION_ONG_CONTENT_CA: PublicLandingContent = {
  hero: {
    title: 'Conciliació bancària per a ONG i associacions',
    subtitle: 'Tenir els moviments del banc clars, classificats i sota control.',
    introParagraphs: [
      'Moltes entitats gestionen els seus comptes a partir dels extractes bancaris i fulls de càlcul. Amb el temps, això fa difícil entendre realment què ha passat durant el mes.',
      'Ingressos, despeses, quotes de socis, donacions, devolucions... tota aquesta informació acaba dispersa entre documents i revisions manuals.',
      "Summa Social permet fer la conciliació bancària d'una manera clara i ordenada.",
      'Els moviments del banc es poden importar al sistema i treballar directament sobre ells per entendre què correspon a cada ingrés o despesa.',
    ],
    media: {
      type: 'video',
      src: '/visuals/landings/conciliacio-bancaria-ong/animations/conciliacio-bancaria-demo-ca.mp4',
      poster: '/visuals/landings/conciliacio-bancaria-ong/optimized/conciliacio-bancaria-demo-ca-poster.webp',
      captionsSrc: '/visuals/landings/conciliacio-bancaria-ong/animations/conciliacio-bancaria-demo-ca.vtt',
      captionsLang: 'ca',
      captionsLabel: 'Subtítols en català',
      captionsDisplay: 'overlay',
      durationLabel: '21 s',
      alt: 'Vídeo de demostració de la conciliació bancària a Summa Social',
      controls: true,
      autoPlay: false,
      loop: false,
      muted: false,
    },
  },
  problem: {
    title: 'El problema habitual amb els moviments del banc',
    intro: 'Quan la conciliació bancària es fa manualment, apareixen situacions com aquestes:',
    points: [
      'moviments sense identificar',
      "despeses que no saps a què corresponen",
      "ingressos sense saber de quin donant provenen",
      'dificultat per quadrar els números amb el banc',
    ],
    outroParagraphs: [
      'A mesura que passen els mesos, aquesta informació es torna cada vegada més difícil de revisar.',
    ],
  },
  solution: {
    title: 'Com ho resol Summa Social',
    intro: "Summa Social permet treballar amb els moviments bancaris com la base de la gestió econòmica de l'entitat. El procés és senzill:",
    steps: [
      {
        title: "Importes l'extracte bancari",
        body: 'Els moviments del banc es poden pujar en formats habituals com Excel o CSV.',
      },
      {
        title: 'El sistema registra tots els moviments',
        body: 'Cada transacció queda registrada amb la seva data, descripció i import.',
      },
      {
        title: 'Assignació de contactes i categories',
        body: 'Els ingressos i despeses es poden vincular amb donants, proveïdors o categories.',
      },
      {
        title: 'Revisió i classificació',
        body: "L'equip de l'entitat pot revisar els moviments i completar la informació que falta.",
      },
      {
        title: 'Tens una base econòmica fiable',
        body: 'Amb els moviments classificats, la conciliació deixa de dependre de revisions manuals disperses.',
      },
    ],
  },
  includes: {
    title: 'Què permet gestionar Summa Social',
    intro: 'Treballar amb la conciliació bancària dins de Summa Social permet:',
    items: [
      'tenir tots els moviments econòmics en un únic lloc',
      'identificar ingressos de donants o quotes de socis',
      'classificar despeses per categoria',
      'adjuntar factures o documents relacionats',
    ],
    outroParagraphs: ["Això crea una base clara per a la gestió econòmica de l'entitat."],
  },
  operationalBenefits: {
    title: 'Beneficis operatius',
    items: [
      'Més claredat en els moviments del banc: és fàcil veure què correspon a cada ingrés o despesa.',
      'Menys feina manual: no cal copiar informació entre extractes i Excel.',
      'Base fiable per a informes fiscals: els moviments ja estan preparats per generar certificats o informes.',
    ],
  },
  forSmallAndMidEntities: {
    title: 'Pensat per a entitats petites i mitjanes',
    paragraphs: [
      "Summa Social està pensat per a organitzacions que gestionen els comptes amb extractes bancaris, necessiten entendre millor els ingressos i despeses i volen tenir la informació econòmica ordenada.",
      "No és un sistema comptable complex. És una eina per tenir control real dels moviments econòmics de l'entitat.",
    ],
  },
  finalCta: {
    title: 'Parlem de la teva entitat',
    text: "Si cada mes l'equip ha de revisar extractes bancaris i fulls de càlcul per entendre què ha passat, contacta amb nosaltres i valorarem si Summa Social us pot ajudar a simplificar aquesta feina.",
    linkLabel: 'Contacta amb nosaltres',
    href: '/ca/contact',
  },
};

const BANK_RECONCILIATION_ONG_CONTENT_ES: PublicLandingContent = {
  hero: {
    title: 'Conciliación bancaria para ONG y asociaciones',
    subtitle: 'Tener los movimientos del banco claros, clasificados y bajo control.',
    media: {
      type: 'video',
      src: '/visuals/landings/conciliacio-bancaria-ong/animations/conciliacio-bancaria-demo-es.mp4',
      poster: '/visuals/landings/conciliacio-bancaria-ong/optimized/conciliacio-bancaria-demo-ca-poster.webp',
      captionsSrc: '/visuals/landings/conciliacio-bancaria-ong/animations/conciliacio-bancaria-demo-es.vtt',
      captionsLang: 'es',
      captionsLabel: 'Subtítulos en castellano',
      captionsDisplay: 'overlay',
      durationLabel: '21 s',
      alt: 'Vídeo demostrativo de la conciliación bancaria en Summa Social',
      controls: true,
      autoPlay: false,
      loop: false,
      muted: false,
    },
    introParagraphs: [
      'Muchas entidades gestionan sus cuentas a partir de extractos bancarios y hojas de cálculo. Con el tiempo, eso hace difícil entender realmente qué ha pasado durante el mes.',
      'Ingresos, gastos, cuotas de socios, donaciones, devoluciones... toda esa información acaba dispersa entre documentos y revisiones manuales.',
      'Summa Social permite hacer la conciliación bancaria de una forma clara y ordenada.',
      'Los movimientos del banco pueden importarse al sistema y trabajarse directamente sobre ellos para entender qué corresponde a cada ingreso o gasto.',
    ],
  },
  problem: {
    title: 'El problema habitual con los movimientos del banco',
    intro: 'Cuando la conciliación bancaria se hace manualmente, aparecen situaciones como estas:',
    points: [
      'movimientos sin identificar',
      'gastos que no sabes a qué corresponden',
      'ingresos sin saber de qué donante proceden',
      'dificultad para cuadrar los números con el banco',
    ],
    outroParagraphs: [
      'A medida que pasan los meses, esta información se vuelve cada vez más difícil de revisar.',
    ],
  },
  solution: {
    title: 'Cómo lo resuelve Summa Social',
    intro: 'Summa Social permite trabajar con los movimientos bancarios como base de la gestión económica de la entidad. El proceso es sencillo:',
    steps: [
      {
        title: 'Importas el extracto bancario',
        body: 'Los movimientos del banco pueden subirse en formatos habituales como Excel o CSV.',
      },
      {
        title: 'El sistema registra todos los movimientos',
        body: 'Cada transacción queda registrada con su fecha, descripción e importe.',
      },
      {
        title: 'Asignación de contactos y categorías',
        body: 'Los ingresos y gastos pueden vincularse con donantes, proveedores o categorías.',
      },
      {
        title: 'Revisión y clasificación',
        body: 'El equipo de la entidad puede revisar los movimientos y completar la información que falta.',
      },
      {
        title: 'Tienes una base económica fiable',
        body: 'Con los movimientos clasificados, la conciliación deja de depender de revisiones manuales dispersas.',
      },
    ],
  },
  includes: {
    title: 'Qué permite gestionar Summa Social',
    intro: 'Trabajar con la conciliación bancaria dentro de Summa Social permite:',
    items: [
      'tener todos los movimientos económicos en un único lugar',
      'identificar ingresos de donantes o cuotas de socios',
      'clasificar gastos por categoría',
      'adjuntar facturas o documentos relacionados',
    ],
    outroParagraphs: ['Esto crea una base clara para la gestión económica de la entidad.'],
  },
  operationalBenefits: {
    title: 'Beneficios operativos',
    items: [
      'Más claridad en los movimientos del banco: es fácil ver qué corresponde a cada ingreso o gasto.',
      'Menos trabajo manual: no hace falta copiar información entre extractos y Excel.',
      'Base fiable para informes fiscales: los movimientos ya quedan preparados para generar certificados o informes.',
    ],
  },
  forSmallAndMidEntities: {
    title: 'Pensado para entidades pequeñas y medianas',
    paragraphs: [
      'Summa Social está pensado para organizaciones que gestionan sus cuentas con extractos bancarios, necesitan entender mejor ingresos y gastos y quieren tener la información económica ordenada.',
      'No es un sistema contable complejo. Es una herramienta para tener control real de los movimientos económicos de la entidad.',
    ],
  },
  finalCta: {
    title: 'Hablemos de vuestra entidad',
    text: 'Si cada mes el equipo tiene que revisar extractos bancarios y hojas de cálculo para entender qué ha pasado, contactad con nosotros y valoraremos si Summa Social puede ayudaros a simplificar este trabajo.',
    linkLabel: 'Contacta con nosotros',
    href: '/es/contact',
  },
};

const DONATIONS_CONTROL_ONG_METADATA: Record<PublicLocale, PublicLandingMetadata> = {
  ca: {
    title: 'Control de donacions per ONG | Summa Social',
    description: "Com controlar les donacions d'una ONG i tenir una base clara de donants i aportacions.",
  },
  es: {
    title: 'Control de donaciones para ONG | Summa Social',
    description: 'Cómo controlar las donaciones de una ONG y tener una base clara de donantes y aportaciones.',
  },
  fr: {
    title: 'Controle des dons pour associations | Summa Social',
    description: 'Landing en preparation pour le controle des dons des associations.',
  },
  pt: {
    title: 'Controle de doacoes para ONG | Summa Social',
    description: 'Landing em preparacao para controle de doacoes de entidades sem fins lucrativos.',
  },
};

const DONATIONS_CONTROL_ONG_CONTENT_CA: PublicLandingContent = {
  hero: {
    title: "Controlar les donacions d'una ONG sense fulls de càlcul",
    subtitle: 'Tenir clar qui dona, quant dona i quan dona.',
    introParagraphs: [
      'Per a moltes entitats, les donacions arriben per diferents canals: transferències, quotes de socis, aportacions puntuals o plataformes online.',
      'Amb el temps, aquesta informació acaba repartida entre extractes bancaris, fulls de càlcul i llistes de donants.',
      "Summa Social permet tenir una visió clara de totes les donacions de l'entitat.",
      "L'aplicació centralitza la informació dels donants i les seves aportacions perquè l'equip de l'entitat pugui entendre millor d'on provenen els ingressos.",
    ],
    media: {
      type: 'video',
      alt: 'Vídeo demo del control de donacions a Summa Social',
      durationLabel: '15 s',
      src: '/visuals/landings/control-donacions-ong/animations/control-donacions-demo-ca.mp4',
      poster: '/visuals/landings/control-donacions-ong/optimized/control-donacions-demo-poster.webp',
      captionsSrc: '/visuals/landings/control-donacions-ong/animations/control-donacions-demo-ca.vtt',
      captionsLang: 'ca',
      captionsLabel: 'Català',
      captionsDisplay: 'overlay',
      autoPlay: false,
      loop: false,
      controls: true,
    },
  },
  problem: {
    title: 'El problema habitual amb el seguiment de donacions',
    intro: 'Quan les donacions es gestionen manualment, apareixen situacions com:',
    points: [
      "dificultat per saber quant ha donat cada persona durant l'any",
      'informació dispersa entre extractes i llistes de donants',
      'errors en preparar certificats de donació',
      'manca de visió sobre els donants recurrents',
    ],
    outroParagraphs: ['Amb el temps, això fa difícil tenir una base clara de suport de l’entitat.'],
  },
  solution: {
    title: 'Com ho resol Summa Social',
    intro: 'Summa Social permet vincular les donacions amb els donants de manera directa. El procés és simple:',
    steps: [
      {
        title: 'Les donacions es registren als moviments',
        body: "Els ingressos de l'entitat queden registrats a partir dels moviments del banc.",
      },
      {
        title: 'Les aportacions es vinculen amb els donants',
        body: "Cada donació queda associada a la persona o empresa que l'ha fet.",
      },
      {
        title: "El sistema calcula l'historial de cada donant",
        body: 'La fitxa del donant mostra totes les aportacions i devolucions.',
      },
      {
        title: 'La informació serveix per als informes fiscals',
        body: 'Les dades es poden utilitzar per generar certificats o preparar el Model 182.',
      },
      {
        title: 'Tot queda connectat en un únic flux',
        body: "Això evita repetir la revisió en Excel i manté la base de donants lligada als moviments reals.",
      },
    ],
  },
  includes: {
    title: 'Què permet gestionar Summa Social',
    intro: "Amb Summa Social l'entitat pot:",
    items: [
      "veure l'historial de donacions de cada persona",
      'identificar donants recurrents',
      "controlar l'evolució de les aportacions",
      'tenir una base de donants vinculada a la realitat econòmica',
    ],
    outroParagraphs: ["Tot això ajuda a entendre millor com es financia l'activitat de l'entitat."],
  },
  operationalBenefits: {
    title: 'Beneficis operatius',
    items: [
      'Visió clara de les donacions: és fàcil saber qui ha aportat i quant.',
      'Menys errors administratius: la informació dels donants està vinculada als moviments reals.',
      'Base sòlida per a informes fiscals: els certificats i informes utilitzen la mateixa informació.',
    ],
  },
  forSmallAndMidEntities: {
    title: 'Pensat per a entitats socials',
    paragraphs: [
      'Summa Social està pensat per a organitzacions que reben donacions o quotes de socis, volen entendre millor la seva base de suport i necessiten preparar informes fiscals.',
      'No és una eina de màrqueting complexa. És una eina per tenir una base clara de donants i aportacions.',
    ],
  },
  finalCta: {
    title: 'Parlem de la teva entitat',
    text: "Si la informació sobre donacions de la teva entitat està repartida entre diversos documents o fulls de càlcul, contacta amb nosaltres i veurem si Summa Social us pot ajudar a centralitzar-la.",
    linkLabel: 'Contacta amb nosaltres',
    href: '/ca/contact',
  },
};

const DONATIONS_CONTROL_ONG_CONTENT_ES: PublicLandingContent = {
  hero: {
    title: 'Controlar las donaciones de una ONG sin hojas de cálculo',
    subtitle: 'Tener claro quién dona, cuánto dona y cuándo dona.',
    introParagraphs: [
      'Para muchas entidades, las donaciones llegan por distintos canales: transferencias, cuotas de socios, aportaciones puntuales o plataformas online.',
      'Con el tiempo, esa información acaba repartida entre extractos bancarios, hojas de cálculo y listas de donantes.',
      'Summa Social permite tener una visión clara de todas las donaciones de la entidad.',
      'La aplicación centraliza la información de los donantes y sus aportaciones para que el equipo pueda entender mejor de dónde proceden los ingresos.',
    ],
    media: {
      type: 'video',
      alt: 'Vídeo demo del control de donaciones en Summa Social',
      durationLabel: '15 s',
      src: '/visuals/landings/control-donacions-ong/animations/control-donacions-demo-es.mp4',
      poster: '/visuals/landings/control-donacions-ong/optimized/control-donacions-demo-poster.webp',
      captionsSrc: '/visuals/landings/control-donacions-ong/animations/control-donacions-demo-es.vtt',
      captionsLang: 'es',
      captionsLabel: 'Español',
      captionsDisplay: 'overlay',
      autoPlay: false,
      loop: false,
      controls: true,
    },
  },
  problem: {
    title: 'El problema habitual con el seguimiento de donaciones',
    intro: 'Cuando las donaciones se gestionan manualmente, aparecen situaciones como:',
    points: [
      'dificultad para saber cuánto ha donado cada persona durante el año',
      'información dispersa entre extractos y listas de donantes',
      'errores al preparar certificados de donación',
      'falta de visión sobre los donantes recurrentes',
    ],
    outroParagraphs: ['Con el tiempo, eso hace difícil tener una base clara de apoyo de la entidad.'],
  },
  solution: {
    title: 'Cómo lo resuelve Summa Social',
    intro: 'Summa Social permite vincular las donaciones con los donantes de forma directa. El proceso es simple:',
    steps: [
      {
        title: 'Las donaciones se registran en los movimientos',
        body: 'Los ingresos de la entidad quedan registrados a partir de los movimientos del banco.',
      },
      {
        title: 'Las aportaciones se vinculan con los donantes',
        body: 'Cada donación queda asociada a la persona o empresa que la ha realizado.',
      },
      {
        title: 'El sistema calcula el historial de cada donante',
        body: 'La ficha del donante muestra todas las aportaciones y devoluciones.',
      },
      {
        title: 'La información sirve para los informes fiscales',
        body: 'Los datos pueden utilizarse para generar certificados o preparar el Modelo 182.',
      },
      {
        title: 'Todo queda conectado en un único flujo',
        body: 'Eso evita repetir la revisión en Excel y mantiene la base de donantes ligada a los movimientos reales.',
      },
    ],
  },
  includes: {
    title: 'Qué permite gestionar Summa Social',
    intro: 'Con Summa Social, la entidad puede:',
    items: [
      'ver el historial de donaciones de cada persona',
      'identificar donantes recurrentes',
      'controlar la evolución de las aportaciones',
      'tener una base de donantes vinculada a la realidad económica',
    ],
    outroParagraphs: ['Todo esto ayuda a entender mejor cómo se financia la actividad de la entidad.'],
  },
  operationalBenefits: {
    title: 'Beneficios operativos',
    items: [
      'Visión clara de las donaciones: es fácil saber quién ha aportado y cuánto.',
      'Menos errores administrativos: la información de los donantes está vinculada a los movimientos reales.',
      'Base sólida para informes fiscales: los certificados e informes utilizan la misma información.',
    ],
  },
  forSmallAndMidEntities: {
    title: 'Pensado para entidades sociales',
    paragraphs: [
      'Summa Social está pensado para organizaciones que reciben donaciones o cuotas de socios, quieren entender mejor su base de apoyo y necesitan preparar informes fiscales.',
      'No es una herramienta de marketing compleja. Es una herramienta para tener una base clara de donantes y aportaciones.',
    ],
  },
  finalCta: {
    title: 'Hablemos de vuestra entidad',
    text: 'Si la información sobre donaciones de vuestra entidad está repartida entre varios documentos u hojas de cálculo, contactad con nosotros y veremos si Summa Social puede ayudaros a centralizarla.',
    linkLabel: 'Contacta con nosotros',
    href: '/es/contact',
  },
};

const SOFTWARE_MANAGEMENT_ONG_METADATA: Record<PublicLocale, PublicLandingMetadata> = {
  ca: {
    title: 'Software de gestió per ONG | Summa Social',
    description: "Software per gestionar moviments, donants i informes fiscals d'una ONG.",
  },
  es: {
    title: 'Software de gestion para ONG | Summa Social',
    description: 'Landing en preparacion para software de gestion de entidades sin animo de lucro.',
  },
  fr: {
    title: 'Logiciel de gestion pour associations | Summa Social',
    description: 'Landing en preparation pour logiciel de gestion des associations.',
  },
  pt: {
    title: 'Software de gestao para ONG | Summa Social',
    description: 'Landing em preparacao para software de gestao de entidades sem fins lucrativos.',
  },
};

const SOFTWARE_MANAGEMENT_ONG_CONTENT_CA: PublicLandingContent = {
  hero: {
    title: 'Software de gestió per a ONG i associacions',
    subtitle: 'Controlar moviments, donants i obligacions fiscals en un únic sistema.',
    introParagraphs: [
      'Moltes entitats gestionen la seva activitat econòmica amb una combinació de fulls de càlcul, extractes bancaris i documents dispersos.',
      "Amb el temps, això fa difícil entendre què està passant realment amb les finances de l'organització.",
      'Summa Social és un software de gestió econòmica pensat específicament per a entitats socials.',
      'Permet centralitzar la informació econòmica, els donants i les obligacions fiscals en un únic sistema.',
    ],
  },
  problem: {
    title: 'El problema habitual amb la gestió econòmica de les ONG',
    intro: 'Quan la gestió es fa amb eines disperses, és habitual trobar:',
    points: [
      'informació econòmica repartida entre diversos documents',
      'dificultat per quadrar ingressos i despeses',
      'errors en preparar informes fiscals',
      'moltes hores dedicades a tasques administratives',
    ],
    outroParagraphs: [
      'Això no només consumeix temps, sinó que també pot generar incertesa sobre la situació econòmica real.',
    ],
  },
  solution: {
    title: 'Com ho resol Summa Social',
    intro: "Summa Social organitza la informació econòmica de l'entitat al voltant dels moviments del banc. A partir d'aquí es poden gestionar:",
    steps: [
      {
        title: 'Moviments econòmics',
        body: 'Els ingressos i despeses es poden importar i classificar.',
      },
      {
        title: 'Donants i socis',
        body: 'Cada aportació queda vinculada al donant corresponent.',
      },
      {
        title: 'Quotes i remeses',
        body: 'Les quotes de socis es poden gestionar de manera ordenada.',
      },
      {
        title: 'Informes fiscals',
        body: 'La informació econòmica es pot utilitzar per generar informes i certificats.',
      },
      {
        title: 'Visió econòmica integrada',
        body: "Tots els blocs comparteixen la mateixa base de dades perquè l'equip treballi amb un sol sistema coherent.",
      },
    ],
  },
  includes: {
    title: 'Què permet gestionar Summa Social',
    intro: 'Amb Summa Social és més fàcil:',
    items: [
      'controlar ingressos i despeses',
      'gestionar la base de donants',
      'preparar informes fiscals',
      "entendre la situació econòmica de l'entitat",
    ],
    outroParagraphs: ['Tot això dins d’un sistema pensat per a entitats socials.'],
  },
  operationalBenefits: {
    title: 'Beneficis operatius',
    items: [
      'Informació econòmica centralitzada: la informació ja no està repartida entre diversos documents.',
      'Menys feina administrativa: moltes tasques repetitives es simplifiquen.',
      "Més claredat en la gestió: l'equip pot entendre millor la situació econòmica.",
    ],
  },
  forSmallAndMidEntities: {
    title: 'Pensat per a entitats petites i mitjanes',
    paragraphs: [
      "Summa Social està pensat per a organitzacions que tenen equips petits d'administració, gestionen donacions i quotes de socis i necessiten preparar informes fiscals.",
      "No és un ERP complex. És una eina per ordenar la gestió econòmica de l'entitat.",
    ],
  },
  finalCta: {
    title: 'Parlem de la teva entitat',
    text: "Si la gestió econòmica de la teva entitat depèn de diversos fulls de càlcul i revisions manuals, contacta amb nosaltres i veurem si Summa Social encaixa amb la vostra manera de treballar.",
    linkLabel: 'Contacta amb nosaltres',
    href: '/ca/contact',
  },
};

const ASSOCIATIONS_PROGRAM_METADATA: Record<PublicLocale, PublicLandingMetadata> = {
  ca: {
    title: 'Programa per associacions i ONG | Summa Social',
    description: 'Programa de gestió per associacions que permet controlar moviments, donants i informes fiscals.',
  },
  es: {
    title: 'Programa para asociaciones y ONG | Summa Social',
    description: 'Landing en preparacion para programa de gestion de asociaciones y ONG.',
  },
  fr: {
    title: 'Programme pour associations et ONG | Summa Social',
    description: 'Landing en preparation pour programme de gestion des associations et ONG.',
  },
  pt: {
    title: 'Programa para associacoes e ONG | Summa Social',
    description: 'Landing em preparacao para programa de gestao de associacoes e ONG.',
  },
};

const ASSOCIATIONS_PROGRAM_CONTENT_CA: PublicLandingContent = {
  hero: {
    title: 'Programa de gestió per a associacions i ONG',
    subtitle: 'Controlar moviments, donants i informes fiscals sense fulls de càlcul.',
    introParagraphs: [
      'Moltes associacions gestionen la seva informació econòmica amb una combinació de fulls de càlcul, extractes bancaris i documents dispersos.',
      "Al principi pot funcionar, però amb el temps es fa difícil entendre què està passant realment amb els ingressos, les despeses o les donacions.",
      'Summa Social és un programa de gestió pensat específicament per a associacions i entitats socials.',
      'Permet centralitzar la informació econòmica, els donants i les obligacions fiscals en un únic sistema.',
    ],
  },
  problem: {
    title: "El problema habitual de la gestió d'una associació",
    intro: 'Quan la gestió econòmica es fa amb eines disperses, és habitual trobar situacions com:',
    points: [
      'informació econòmica repartida entre diversos documents',
      "dificultat per saber què ha passat durant l'any",
      'errors en preparar informes fiscals',
      'moltes hores dedicades a tasques administratives',
    ],
    outroParagraphs: ["A mesura que l'entitat creix, aquesta situació es fa cada vegada més difícil de mantenir."],
  },
  solution: {
    title: 'Com ho resol Summa Social',
    intro: "Summa Social organitza la gestió econòmica de l'entitat a partir dels moviments reals del banc. A partir d'aquí és possible gestionar tota la informació necessària.",
    steps: [
      {
        title: 'Moviments econòmics',
        body: "Els ingressos i despeses de l'entitat es poden importar i classificar.",
      },
      {
        title: 'Donants i socis',
        body: 'Les aportacions queden vinculades a la persona o empresa corresponent.',
      },
      {
        title: 'Quotes de socis',
        body: 'Les quotes es poden gestionar i relacionar amb les remeses bancàries.',
      },
      {
        title: 'Informes fiscals',
        body: 'La informació econòmica serveix per generar certificats de donació i preparar informes fiscals.',
      },
      {
        title: 'Treball en un únic sistema',
        body: 'La gestió deixa de dependre de documents dispersos i queda centralitzada dins de la mateixa aplicació.',
      },
    ],
  },
  includes: {
    title: 'Què permet gestionar Summa Social',
    intro: 'Amb Summa Social és més fàcil:',
    items: [
      'controlar ingressos i despeses',
      'gestionar la base de donants',
      'revisar moviments bancaris',
      "preparar informes fiscals de l'entitat",
    ],
    outroParagraphs: ["Tot això dins d'un sistema pensat per a organitzacions sense ànim de lucre."],
  },
  operationalBenefits: {
    title: 'Beneficis operatius',
    items: [
      'Informació econòmica centralitzada: la informació ja no està repartida entre diversos documents.',
      'Menys feina administrativa: moltes tasques repetitives es simplifiquen.',
      "Més claredat en la gestió: l'equip pot entendre millor la situació econòmica de l'entitat.",
    ],
  },
  forSmallAndMidEntities: {
    title: 'Pensat per a entitats petites i mitjanes',
    paragraphs: [
      "Summa Social està pensat per a associacions que gestionen donacions o quotes de socis, tenen equips petits d'administració i necessiten preparar informes fiscals.",
      "No és un ERP complex. És una eina per ordenar la gestió econòmica de l'entitat.",
    ],
  },
  finalCta: {
    title: 'Parlem de la teva entitat',
    text: "Si la gestió econòmica de la teva associació depèn de diversos fulls de càlcul i revisions manuals, contacta amb nosaltres i valorarem si Summa Social us pot ajudar a ordenar-la.",
    linkLabel: 'Contacta amb nosaltres',
    href: '/ca/contact',
  },
};

const DONOR_MANAGEMENT_METADATA: Record<PublicLocale, PublicLandingMetadata> = {
  ca: {
    title: 'Gestió de donants per a entitats socials | Software de gestió | Summa Social',
    description:
      "Centralitza socis i donants en una base clara, amb historial d'aportacions i suport per a certificats i Model 182.",
  },
  es: {
    title: 'Gestion de donantes | Summa Social',
    description: 'Landing en preparacion para gestion de donantes de entidades sin animo de lucro.',
  },
  fr: {
    title: 'Gestion des donateurs | Summa Social',
    description: 'Landing en preparation pour la gestion des donateurs des associations.',
  },
  pt: {
    title: 'Gestao de doadores | Summa Social',
    description: 'Landing em preparacao para gestao de doadores de entidades sem fins lucrativos.',
  },
};

const DONOR_MANAGEMENT_CONTENT_CA: PublicLandingContent = {
  hero: {
    title: "Gestionar els donants de l'entitat sense fulls de càlcul",
    subtitle: 'Tenir una base clara de socis i donants.',
    introParagraphs: [
      'Per a moltes entitats, la informació dels donants es troba repartida entre fulls de càlcul, llistes antigues i correus electrònics.',
      'Això fa difícil saber qui són realment els donants actius, quant ha aportat cada persona i quins socis paguen quotes regularment.',
      'Summa Social centralitza la gestió de donants en un únic lloc.',
    ],
    media: {
      type: 'video',
      src: '/visuals/landings/gestio-donants/animations/anima-gestio-socis.webm',
      mp4FallbackSrc: '/visuals/landings/gestio-donants/animations/anima-gestio-socis.mp4',
      poster: '/visuals/landings/gestio-donants/optimized/anima-gestio-socis-poster.webp',
      alt: 'Animació de la gestió de donants a Summa Social',
    },
  },
  problem: {
    title: 'El problema habitual amb les bases de donants',
    intro: 'Quan la informació dels donants es gestiona amb Excel, apareixen problemes com:',
    points: [
      'dades duplicades o desactualitzades',
      'dificultat per saber què ha aportat cada persona',
      'errors en preparar certificats de donació',
      "manca de visió sobre l'evolució dels donants",
    ],
    outroParagraphs: ['Amb el temps, la base de dades es torna difícil de mantenir.'],
  },
  solution: {
    title: 'Com ho resol Summa Social',
    intro: 'Summa Social permet gestionar els donants com una base estructurada vinculada als moviments econòmics.',
    steps: [
      {
        title: "Registres els donants de l'entitat",
        body: 'Cada persona o empresa té la seva fitxa amb les dades principals.',
      },
      {
        title: "Pots importar donants des d'Excel",
        body: 'La base inicial es pot carregar sense haver de crear cada fitxa manualment.',
      },
      {
        title: 'Les donacions es vinculen automàticament',
        body: 'Quan entra una donació, queda associada al donant corresponent.',
      },
      {
        title: "Pots veure l'historial de cada donant",
        body: 'La fitxa mostra totes les aportacions i devolucions.',
      },
      {
        title: 'La informació serveix per als informes fiscals',
        body: 'Els certificats i el Model 182 utilitzen aquesta base de dades.',
      },
    ],
  },
  includes: {
    title: 'Què permet gestionar Summa Social',
    intro: "Amb Summa Social, l'entitat pot:",
    items: [
      'tenir una base actualitzada de socis i donants',
      "importar donants des d'Excel",
      "veure l'historial complet de donacions",
      'identificar donants recurrents o puntuals',
    ],
    outroParagraphs: ["Això permet entendre millor qui sosté l'activitat de l'entitat."],
  },
  operationalBenefits: {
    title: 'Beneficis operatius',
    items: [
      'Base de donants clara: la informació ja no està repartida entre diferents documents.',
      'Millor control de les donacions: és fàcil veure què ha aportat cada persona.',
      'Preparació més simple dels informes fiscals: les dades dels donants ja estan estructurades.',
    ],
  },
  forSmallAndMidEntities: {
    title: 'Pensat per a entitats socials',
    paragraphs: [
      'Summa Social està pensat per a entitats que tenen socis o donants recurrents, volen ordenar la seva base de donants i necessiten generar certificats o informes fiscals.',
      "És una eina per facilitar la gestió quotidiana de l'entitat.",
    ],
  },
  finalCta: {
    title: 'Parlem de la teva entitat',
    text: "Si la base de donants de la teva entitat està repartida entre diversos documents o fulls de càlcul, contacta amb nosaltres i veurem si Summa Social us pot ajudar a unificar-la.",
    linkLabel: 'Contacta amb nosaltres',
    href: '/ca/contact',
  },
};

const MODEL_347_ONG_METADATA: Record<PublicLocale, PublicLandingMetadata> = {
  ca: {
    title: 'Model 347 per a ONG | Software de gestió per a entitats | Summa Social',
    description:
      'Prepara el Model 347 amb els proveïdors ben identificats i les operacions amb tercers ordenades dins de Summa Social.',
  },
  es: {
    title: 'Modelo 347 para ONG | Software de gestión para entidades | Summa Social',
    description:
      'Prepara el Modelo 347 con los proveedores bien identificados y las operaciones con terceros ordenadas dentro de Summa Social.',
  },
  fr: {
    title: 'Modele 347 pour associations | Summa Social',
    description: 'Landing en preparation pour le Modele 347 des associations.',
  },
  pt: {
    title: 'Modelo 347 para ONG | Summa Social',
    description: 'Landing em preparacao para o Modelo 347 de entidades sem fins lucrativos.',
  },
};

const MODEL_347_ONG_CONTENT_CA: PublicLandingContent = {
  hero: {
    title: 'Model 347 per a ONG i associacions',
    subtitle: "Prepara l'informe d'operacions amb tercers sense reconstruir dades a última hora.",
    introParagraphs: [
      "El Model 347 obliga a revisar les operacions amb tercers que superen el llindar anual i a verificar que les dades dels proveïdors siguin correctes abans d'exportar.",
      "Quan aquesta feina es fa amb extractes, Excels i comprovacions manuals, és habitual arribar al tancament amb CIFs incomplets, imports dubtosos o operacions que encara s'han de revisar.",
      "Summa Social ajuda a preparar aquesta part de la fiscalitat a partir dels moviments i dels proveïdors que l'entitat ja treballa durant l'any.",
    ],
  },
  problem: {
    title: 'El problema habitual del Model 347',
    intro: 'Quan les operacions amb tercers no estan ordenades, acostumen a aparèixer aquests bloquejos:',
    points: [
      'proveïdors sense CIF o amb dades incompletes',
      'pagaments repartits entre extractes i fulls de càlcul',
      'dubtes sobre quines operacions entren realment al 347',
      "revisió d'última hora abans d'enviar l'export a la gestoria",
    ],
    outroParagraphs: [
      'El resultat és un procés fiscal lent i poc fiable just en el moment en què menys marge hi ha per corregir dades.',
    ],
  },
  solution: {
    title: 'Com ho resol Summa Social',
    intro: "Summa Social prepara el Model 347 a partir de la informació econòmica i dels tercers que l'entitat ja té registrats.",
    steps: [
      {
        title: 'Tens els proveïdors identificats',
        body: 'Cada tercer es treballa des de la seva fitxa, amb el nom i el CIF com a dada crítica.',
      },
      {
        title: 'Els pagaments queden vinculats als moviments reals',
        body: "La base del 347 surt dels moviments econòmics que ja s'han revisat dins del sistema.",
      },
      {
        title: 'Revises qui supera el llindar anual',
        body: "El sistema ajuda a focalitzar la revisió en els proveïdors que poden entrar a l'informe.",
      },
      {
        title: 'Verifiques el detall abans d’exportar',
        body: "L'equip pot revisar les operacions mostrades i deixar net el conjunt abans de generar el fitxer.",
      },
      {
        title: 'Generes la sortida per a la gestoria o l’AEAT',
        body: "Quan les dades són correctes, l'export surt a partir del mateix sistema.",
      },
    ],
  },
  includes: {
    title: 'Què permet gestionar Summa Social',
    intro: "Amb Summa Social, l'entitat pot:",
    items: [
      'mantenir els proveïdors ben identificats durant l’any',
      'centralitzar els pagaments que després alimenten el Model 347',
      'revisar els tercers que superen el llindar anual de 3.005,06 €',
      'preparar l’export amb una base molt més neta per a la gestoria',
    ],
    outroParagraphs: [
      "Això evita haver de reconstruir l'informe quan el termini fiscal ja és a sobre.",
    ],
  },
  operationalBenefits: {
    title: 'Beneficis operatius',
    items: [
      "Menys neteja d'última hora: la informació dels proveïdors ja es treballa durant l'any.",
      'Més coherència fiscal: el 347 surt de moviments i tercers que comparteixen la mateixa base.',
      'Més control sobre els pagaments rellevants per al tancament anual.',
    ],
  },
  forSmallAndMidEntities: {
    title: 'Pensat per a entitats petites i mitjanes',
    paragraphs: [
      'Summa Social està pensat per a organitzacions que necessiten entregar el Model 347 a la gestoria sense dedicar dies sencers a revisar tercers i pagaments.',
      "No és un sistema fiscal genèric. És una eina per tenir ordenada la informació econòmica que després s'ha de declarar.",
    ],
  },
  finalCta: {
    title: 'Parlem de la teva entitat',
    text: 'Si el Model 347 t’obliga a revisar proveïdors i pagaments des de zero cada any, contacta amb nosaltres i valorarem si Summa Social us pot ajudar a ordenar aquesta part fiscal.',
    linkLabel: 'Contacta amb nosaltres',
    href: '/ca/contact',
  },
};

const MODEL_347_ONG_CONTENT_ES: PublicLandingContent = {
  hero: {
    title: 'Modelo 347 para ONG y asociaciones',
    subtitle: 'Prepara el informe de operaciones con terceros sin reconstruir datos a última hora.',
    introParagraphs: [
      'El Modelo 347 obliga a revisar las operaciones con terceros que superan el umbral anual y a verificar que los datos de los proveedores sean correctos antes de exportar.',
      'Cuando este trabajo se hace con extractos, Excel y comprobaciones manuales, es habitual llegar al cierre con CIF incompletos, importes dudosos u operaciones que todavía deben revisarse.',
      'Summa Social ayuda a preparar esta parte de la fiscalidad a partir de los movimientos y de los proveedores que la entidad ya trabaja durante el año.',
    ],
  },
  problem: {
    title: 'El problema habitual del Modelo 347',
    intro: 'Cuando las operaciones con terceros no están ordenadas, suelen aparecer estos bloqueos:',
    points: [
      'proveedores sin CIF o con datos incompletos',
      'pagos repartidos entre extractos y hojas de cálculo',
      'dudas sobre qué operaciones entran realmente en el 347',
      'revisión de última hora antes de enviar la exportación a la gestoría',
    ],
    outroParagraphs: [
      'El resultado es un proceso fiscal lento y poco fiable justo en el momento en el que menos margen hay para corregir datos.',
    ],
  },
  solution: {
    title: 'Cómo lo resuelve Summa Social',
    intro: 'Summa Social prepara el Modelo 347 a partir de la información económica y de los terceros que la entidad ya tiene registrados.',
    steps: [
      {
        title: 'Tienes los proveedores identificados',
        body: 'Cada tercero se trabaja desde su ficha, con el nombre y el CIF como dato crítico.',
      },
      {
        title: 'Los pagos quedan vinculados a los movimientos reales',
        body: 'La base del 347 sale de los movimientos económicos que ya se han revisado dentro del sistema.',
      },
      {
        title: 'Revisas quién supera el umbral anual',
        body: 'El sistema ayuda a focalizar la revisión en los proveedores que pueden entrar en el informe.',
      },
      {
        title: 'Verificas el detalle antes de exportar',
        body: 'El equipo puede revisar las operaciones mostradas y dejar limpio el conjunto antes de generar el fichero.',
      },
      {
        title: 'Generas la salida para la gestoría o la AEAT',
        body: 'Cuando los datos son correctos, la exportación sale a partir del mismo sistema.',
      },
    ],
  },
  includes: {
    title: 'Qué permite gestionar Summa Social',
    intro: 'Con Summa Social, la entidad puede:',
    items: [
      'mantener a los proveedores bien identificados durante el año',
      'centralizar los pagos que después alimentan el Modelo 347',
      'revisar los terceros que superan el umbral anual de 3.005,06 €',
      'preparar la exportación con una base mucho más limpia para la gestoría',
    ],
    outroParagraphs: [
      'Esto evita tener que reconstruir el informe cuando el plazo fiscal ya está encima.',
    ],
  },
  operationalBenefits: {
    title: 'Beneficios operativos',
    items: [
      'Menos limpieza de última hora: la información de los proveedores ya se trabaja durante el año.',
      'Más coherencia fiscal: el 347 sale de movimientos y terceros que comparten la misma base.',
      'Más control sobre los pagos relevantes para el cierre anual.',
    ],
  },
  forSmallAndMidEntities: {
    title: 'Pensado para entidades pequeñas y medianas',
    paragraphs: [
      'Summa Social está pensado para organizaciones que necesitan entregar el Modelo 347 a la gestoría sin dedicar días enteros a revisar terceros y pagos.',
      'No es un sistema fiscal genérico. Es una herramienta para tener ordenada la información económica que después debe declararse.',
    ],
  },
  finalCta: {
    title: 'Hablemos de vuestra entidad',
    text: 'Si el Modelo 347 os obliga a revisar proveedores y pagos desde cero cada año, contactad con nosotros y valoraremos si Summa Social puede ayudaros a ordenar esta parte fiscal.',
    linkLabel: 'Contacta con nosotros',
    href: '/es/contact',
  },
};

const RETURNED_RECEIPTS_METADATA: Record<PublicLocale, PublicLandingMetadata> = {
  ca: {
    title: 'Devolucions de rebuts de socis | Software de gestió per a entitats | Summa Social',
    description:
      'Gestiona rebuts retornats i devolucions bancàries sense perdre el fil fiscal. Assigna cada devolució al soci correcte dins de Summa Social.',
  },
  es: {
    title: 'Devoluciones de recibos de socios | Software de gestión para entidades | Summa Social',
    description:
      'Gestiona recibos devueltos y devoluciones bancarias sin perder el hilo fiscal. Asigna cada devolución al socio correcto dentro de Summa Social.',
  },
  fr: {
    title: 'Rejets de recus de membres | Summa Social',
    description: 'Landing en preparation pour les rejets et retours bancaires.',
  },
  pt: {
    title: 'Devolucoes de recibos de socios | Summa Social',
    description: 'Landing em preparacao para devolucoes bancarias e recibos devolvidos.',
  },
};

const RETURNED_RECEIPTS_CONTENT_CA: PublicLandingContent = {
  hero: {
    title: 'Gestionar devolucions de rebuts de socis sense perdre el control fiscal',
    subtitle: 'Assigna cada rebut retornat al soci correcte i evita totals inflats en certificats i Model 182.',
    introParagraphs: [
      "Quan el banc retorna rebuts de quotes o donacions recurrents, la feina no s'acaba en veure l'import negatiu a l'extracte.",
      "Cal saber de quin soci o donant és cada devolució, revisar si forma part d'una remesa i assegurar que el total net quedi ben calculat.",
      "Summa Social ajuda a gestionar aquest procés dins del mateix flux econòmic de l'entitat, sense haver de portar un control separat amb Excel.",
    ],
  },
  problem: {
    title: 'El problema habitual amb els rebuts retornats',
    intro: 'Quan les devolucions es deixen fora del sistema, passen coses com aquestes:',
    points: [
      'imports negatius sense soci assignat',
      'remeses de devolucions revisades només pel moviment pare',
      'certificats o Model 182 amb totals inflats',
      'manca de seguiment sobre quins socis acumulen rebuts retornats',
    ],
    outroParagraphs: [
      'Aquesta és una d’aquelles tasques petites que, si es deixa pendent, acaba afectant directament el tancament fiscal.',
    ],
  },
  solution: {
    title: 'Com ho resol Summa Social',
    intro: 'Summa Social permet treballar les devolucions dins del mateix circuit de moviments i donants.',
    steps: [
      {
        title: 'Detectes les devolucions pendents',
        body: 'Els moviments retornats es poden revisar des del mateix entorn de treball econòmic.',
      },
      {
        title: 'Importes el detall del banc quan el tens',
        body: "Si el banc facilita el fitxer de devolucions, el sistema l'aprofita per avançar la identificació.",
      },
      {
        title: 'Assignes cada devolució al soci correcte',
        body: 'La devolució ha de quedar vinculada al donant o soci que realment correspon.',
      },
      {
        title: 'Mantenir pendents conscients quan falta informació',
        body: 'Si alguna devolució no es pot resoldre al moment, es pot deixar localitzada per revisar-la després.',
      },
      {
        title: 'El total net queda ben reflectit',
        body: 'Quan la devolució està ben assignada, el sistema la té en compte allà on toca.',
      },
    ],
  },
  includes: {
    title: 'Què permet gestionar Summa Social',
    intro: "Amb Summa Social, l'entitat pot:",
    items: [
      'revisar devolucions bancàries des del mateix espai de moviments',
      'importar el detall de devolucions facilitat pel banc',
      'mantenir traçabilitat de les devolucions dins de la fitxa del donant',
      'arribar al tancament anual amb menys risc de totals fiscals incorrectes',
    ],
    outroParagraphs: [
      'La clau és simple: una devolució només resta on toca si està ben assignada.',
    ],
  },
  operationalBenefits: {
    title: 'Beneficis operatius',
    items: [
      'Menys errors fiscals: els totals nets de cada donant es poden revisar amb base real.',
      'Més ordre mensual: les devolucions deixen de ser una carpeta pendent fora del sistema.',
      'Més visibilitat sobre socis amb rebuts retornats o incidències recurrents.',
    ],
  },
  forSmallAndMidEntities: {
    title: 'Pensat per a entitats petites i mitjanes',
    paragraphs: [
      'Summa Social és útil per a entitats que cobren quotes o donacions recurrents i necessiten controlar les devolucions sense perdre temps en seguiments manuals.',
      "És una eina pensada per resoldre la part operativa i fiscal del dia a dia, no per afegir més burocràcia.",
    ],
  },
  finalCta: {
    title: 'Parlem de la teva entitat',
    text: 'Si les devolucions bancàries et fan perdre temps i et generen dubtes abans del tancament anual, contacta amb nosaltres i veurem si Summa Social us pot ajudar a controlar-les millor.',
    linkLabel: 'Contacta amb nosaltres',
    href: '/ca/contact',
  },
};

const RETURNED_RECEIPTS_CONTENT_ES: PublicLandingContent = {
  hero: {
    title: 'Gestionar devoluciones de recibos de socios sin perder el control fiscal',
    subtitle: 'Asigna cada recibo devuelto al socio correcto y evita totales inflados en certificados y Modelo 182.',
    introParagraphs: [
      'Cuando el banco devuelve recibos de cuotas o donaciones recurrentes, el trabajo no termina al ver el importe negativo en el extracto.',
      'Hay que saber de qué socio o donante es cada devolución, revisar si forma parte de una remesa y asegurarse de que el total neto quede bien calculado.',
      'Summa Social ayuda a gestionar este proceso dentro del mismo flujo económico de la entidad, sin tener que llevar un control separado en Excel.',
    ],
  },
  problem: {
    title: 'El problema habitual con los recibos devueltos',
    intro: 'Cuando las devoluciones se dejan fuera del sistema, pasan cosas como estas:',
    points: [
      'importes negativos sin socio asignado',
      'remesas de devoluciones revisadas solo por el movimiento padre',
      'certificados o Modelo 182 con totales inflados',
      'falta de seguimiento sobre qué socios acumulan recibos devueltos',
    ],
    outroParagraphs: [
      'Esta es una de esas tareas pequeñas que, si se dejan pendientes, acaban afectando directamente al cierre fiscal.',
    ],
  },
  solution: {
    title: 'Cómo lo resuelve Summa Social',
    intro: 'Summa Social permite trabajar las devoluciones dentro del mismo circuito de movimientos y donantes.',
    steps: [
      {
        title: 'Detectas las devoluciones pendientes',
        body: 'Los movimientos devueltos pueden revisarse desde el mismo entorno de trabajo económico.',
      },
      {
        title: 'Importas el detalle del banco cuando lo tienes',
        body: 'Si el banco facilita el fichero de devoluciones, el sistema lo aprovecha para avanzar la identificación.',
      },
      {
        title: 'Asignas cada devolución al socio correcto',
        body: 'La devolución debe quedar vinculada al donante o socio que realmente corresponde.',
      },
      {
        title: 'Mantienes pendientes conscientes cuando falta información',
        body: 'Si alguna devolución no puede resolverse al momento, puede dejarse localizada para revisarla después.',
      },
      {
        title: 'El total neto queda bien reflejado',
        body: 'Cuando la devolución está bien asignada, el sistema la tiene en cuenta donde corresponde.',
      },
    ],
  },
  includes: {
    title: 'Qué permite gestionar Summa Social',
    intro: 'Con Summa Social, la entidad puede:',
    items: [
      'revisar devoluciones bancarias desde el mismo espacio de movimientos',
      'importar el detalle de devoluciones facilitado por el banco',
      'mantener trazabilidad de las devoluciones dentro de la ficha del donante',
      'llegar al cierre anual con menos riesgo de totales fiscales incorrectos',
    ],
    outroParagraphs: [
      'La clave es simple: una devolución solo resta donde toca si está bien asignada.',
    ],
  },
  operationalBenefits: {
    title: 'Beneficios operativos',
    items: [
      'Menos errores fiscales: los totales netos de cada donante pueden revisarse con base real.',
      'Más orden mensual: las devoluciones dejan de ser una carpeta pendiente fuera del sistema.',
      'Más visibilidad sobre socios con recibos devueltos o incidencias recurrentes.',
    ],
  },
  forSmallAndMidEntities: {
    title: 'Pensado para entidades pequeñas y medianas',
    paragraphs: [
      'Summa Social es útil para entidades que cobran cuotas o donaciones recurrentes y necesitan controlar las devoluciones sin perder tiempo en seguimientos manuales.',
      'Es una herramienta pensada para resolver la parte operativa y fiscal del día a día, no para añadir más burocracia.',
    ],
  },
  finalCta: {
    title: 'Hablemos de vuestra entidad',
    text: 'Si las devoluciones bancarias os hacen perder tiempo y os generan dudas antes del cierre anual, contactad con nosotros y veremos si Summa Social puede ayudaros a controlarlas mejor.',
    linkLabel: 'Contacta con nosotros',
    href: '/es/contact',
  },
};

const MODEL_182_CONTENT_CA: PublicLandingContent = {
  hero: {
    title: 'Model 182 per a ONG i associacions',
    subtitle: 'Genera el Model 182 sense Excel, sense errors i sense patir el gener.',
    introParagraphs: [
      'El Model 182 és una de les obligacions fiscals més delicades per a una entitat. Cada any cal recopilar totes les donacions, verificar les dades dels donants, restar les devolucions i preparar el fitxer per a la gestoria o per a l’AEAT.',
      'Moltes entitats encara ho fan amb Excel i extractes bancaris. Això implica hores de revisió manual, risc d’errors i molta pressió a finals de gener.',
      'Summa Social resol aquest problema.',
      'És una aplicació pensada específicament per a entitats sense ànim de lucre que centralitza els moviments bancaris, els donants i la informació fiscal necessària per preparar el Model 182 de manera segura i ràpida.',
    ],
    media: {
      type: 'video',
      src: '/visuals/landings/model-182/animations/model-182-demo-ca.mp4',
      poster: '/visuals/landings/model-182/optimized/model-182-demo-poster.webp',
      captionsSrc: '/visuals/landings/model-182/animations/model-182-demo-ca.vtt',
      captionsLang: 'ca',
      captionsLabel: 'Subtítols en català',
      captionsDisplay: 'overlay',
      autoPlay: false,
      loop: false,
      durationLabel: '10 s',
      alt: 'Vídeo de demostració del Model 182 a Summa Social',
      controls: true,
      muted: false,
    },
  },
  problem: {
    title: 'El problema real del Model 182',
    intro: 'Quan arriba el gener, moltes entitats es troben amb situacions com aquestes:',
    points: [
      'Donacions repartides entre extractes bancaris, remeses i Stripe.',
      'Donants sense DNI o amb dades incompletes.',
      'Devolucions bancàries que cal restar manualment.',
      'Dubtes sobre qui ha donat realment durant l’any.',
      'Excels que no quadren amb el compte bancari.',
    ],
    outroParagraphs: [
      'El resultat acostuma a ser el mateix: dies sencers revisant dades abans de poder enviar el Model 182 a la gestoria.',
    ],
  },
  solution: {
    title: 'Com ho resol Summa Social',
    intro: 'Summa Social està dissenyat perquè el Model 182 surti pràcticament sol a partir de les dades reals del banc.',
    steps: [
      {
        title: 'Importes l’extracte bancari',
        body: 'Pots pujar fitxers CSV o Excel del banc. Els moviments es detecten automàticament i el sistema evita duplicats.',
      },
      {
        title: 'Assignes els donants',
        body: 'Les donacions s’associen als donants per nom, IBAN o DNI. També pots importar els donants des d’Excel.',
      },
      {
        title: 'Les devolucions es resten automàticament',
        body: 'Si un rebut es retorna, el sistema ho registra i descompta la devolució del càlcul fiscal.',
      },
      {
        title: 'El sistema calcula el total per donant',
        body: 'Summa Social consolida totes les donacions de l’any i calcula el net real per cada persona.',
      },
      {
        title: 'Generes el Model 182',
        body: 'Amb un clic obtens un Excel preparat per a la gestoria o el fitxer oficial per presentar a l’AEAT.',
      },
    ],
  },
  includes: {
    title: 'Què inclou el Model 182 generat per Summa Social',
    intro: 'El sistema prepara automàticament la informació que exigeix Hisenda:',
    items: [
      'NIF del donant.',
      'Nom complet.',
      'Codi de província.',
      'Import anual de donacions.',
      'Recurrència de donacions.',
      'Naturalesa (persona física o jurídica).',
    ],
    outroParagraphs: [
      'També aplica automàticament el càlcul de donacions menys devolucions i valida que les dades mínimes siguin correctes abans de generar el fitxer.',
    ],
  },
  operationalBenefits: {
    title: 'Beneficis operatius per a l’entitat',
    items: [
      'Menys hores de preparació del Model 182.',
      'Menys risc d’errors en imports o donants.',
      'Control real de les donacions durant tot l’any.',
      'Traçabilitat completa des del Model 182 fins al moviment bancari.',
    ],
  },
  forSmallAndMidEntities: {
    title: 'Pensat per a entitats petites i mitjanes',
    paragraphs: [
      'Summa Social està dissenyat per a organitzacions que porten la gestió econòmica amb fulls de càlcul i necessiten complir amb la fiscalitat sense un sistema complex.',
      'No és un ERP generalista ni un sistema de comptabilitat avançat. És una eina de gestió econòmica i fiscal pensada específicament per a entitats socials.',
    ],
  },
  finalCta: {
    title: 'Parlem de la teva entitat',
    text: 'Si portes la gestió econòmica d’una entitat i cada any pateixes amb el Model 182, contacta amb nosaltres i valorarem si Summa Social us pot ajudar a simplificar aquest tancament.',
    linkLabel: 'Contacta amb nosaltres',
    href: '/ca/contact',
  },
};

const MODEL_182_CONTENT_ES: PublicLandingContent = {
  hero: {
    title: 'Modelo 182 para ONG y asociaciones',
    subtitle: 'Genera el Modelo 182 sin Excel, sin errores y sin sufrir en enero.',
    introParagraphs: [
      'El Modelo 182 es una de las obligaciones fiscales más delicadas para una entidad. Cada año hay que recopilar todas las donaciones, verificar los datos de los donantes, restar las devoluciones y preparar el fichero para la gestoría o para la AEAT.',
      'Muchas entidades todavía lo hacen con Excel y extractos bancarios. Eso implica horas de revisión manual, riesgo de errores y mucha presión a finales de enero.',
      'Summa Social resuelve este problema.',
      'Es una aplicación pensada específicamente para entidades sin ánimo de lucro que centraliza los movimientos bancarios, los donantes y la información fiscal necesaria para preparar el Modelo 182 de forma segura y rápida.',
    ],
    media: {
      type: 'video',
      src: '/visuals/landings/model-182/animations/model-182-demo-es.mp4',
      poster: '/visuals/landings/model-182/optimized/model-182-demo-poster.webp',
      captionsSrc: '/visuals/landings/model-182/animations/model-182-demo-es.vtt',
      captionsLang: 'es',
      captionsLabel: 'Subtítulos en castellano',
      captionsDisplay: 'overlay',
      autoPlay: false,
      loop: false,
      durationLabel: '10 s',
      alt: 'Vídeo de demostración del Modelo 182 en Summa Social',
      controls: true,
      muted: false,
    },
  },
  problem: {
    title: 'El problema real del Modelo 182',
    intro: 'Cuando llega enero, muchas entidades se encuentran con situaciones como estas:',
    points: [
      'donaciones repartidas entre extractos bancarios, remesas y Stripe',
      'donantes sin DNI o con datos incompletos',
      'devoluciones bancarias que hay que restar manualmente',
      'dudas sobre quién ha donado realmente durante el año',
      'Excel que no cuadra con la cuenta bancaria',
    ],
    outroParagraphs: [
      'El resultado suele ser el mismo: días enteros revisando datos antes de poder enviar el Modelo 182 a la gestoría.',
    ],
  },
  solution: {
    title: 'Cómo lo resuelve Summa Social',
    intro: 'Summa Social está diseñado para que el Modelo 182 salga prácticamente solo a partir de los datos reales del banco.',
    steps: [
      {
        title: 'Importas el extracto bancario',
        body: 'Puedes subir ficheros CSV o Excel del banco. Los movimientos se detectan automáticamente y el sistema evita duplicados.',
      },
      {
        title: 'Asignas los donantes',
        body: 'Las donaciones se asocian a los donantes por nombre, IBAN o DNI. También puedes importar los donantes desde Excel.',
      },
      {
        title: 'Las devoluciones se restan automáticamente',
        body: 'Si un recibo se devuelve, el sistema lo registra y descuenta la devolución del cálculo fiscal.',
      },
      {
        title: 'El sistema calcula el total por donante',
        body: 'Summa Social consolida todas las donaciones del año y calcula el neto real por cada persona.',
      },
      {
        title: 'Generas el Modelo 182',
        body: 'Con un clic obtienes un Excel preparado para la gestoría o el fichero oficial para presentar a la AEAT.',
      },
    ],
  },
  includes: {
    title: 'Qué incluye el Modelo 182 generado por Summa Social',
    intro: 'El sistema prepara automáticamente la información que exige Hacienda:',
    items: [
      'NIF del donante.',
      'Nombre completo.',
      'Código de provincia.',
      'Importe anual de donaciones.',
      'Recurrencia de donaciones.',
      'Naturaleza (persona física o jurídica).',
    ],
    outroParagraphs: [
      'También aplica automáticamente el cálculo de donaciones menos devoluciones y valida que los datos mínimos sean correctos antes de generar el fichero.',
    ],
  },
  operationalBenefits: {
    title: 'Beneficios operativos para la entidad',
    items: [
      'Menos horas de preparación del Modelo 182.',
      'Menos riesgo de errores en importes o donantes.',
      'Control real de las donaciones durante todo el año.',
      'Trazabilidad completa desde el Modelo 182 hasta el movimiento bancario.',
    ],
  },
  forSmallAndMidEntities: {
    title: 'Pensado para entidades pequeñas y medianas',
    paragraphs: [
      'Summa Social está diseñado para organizaciones que llevan la gestión económica con hojas de cálculo y necesitan cumplir con la fiscalidad sin un sistema complejo.',
      'No es un ERP generalista ni un sistema de contabilidad avanzada. Es una herramienta de gestión económica y fiscal pensada específicamente para entidades sociales.',
    ],
  },
  finalCta: {
    title: 'Hablemos de vuestra entidad',
    text: 'Si lleváis la gestión económica de una entidad y cada año sufrís con el Modelo 182, contactad con nosotros y valoraremos si Summa Social puede ayudaros a simplificar este cierre.',
    linkLabel: 'Contacta con nosotros',
    href: '/es/contact',
  },
};

const PUBLIC_LANDINGS: PublicLandingDefinition[] = [
  {
    slug: 'model-182',
    metadata: MODEL_182_METADATA,
    content: {
      ca: withRelatedLandings(MODEL_182_CONTENT_CA, 'ca', 'model-182'),
      es: withRelatedLandings(MODEL_182_CONTENT_ES, 'es', 'model-182'),
      fr: buildPendingContent('fr', LANDING_NAMES['model-182'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['model-182'].pt),
    },
  },
  {
    slug: 'certificats-donacio',
    metadata: DONATION_CERTIFICATES_METADATA,
    content: {
      ca: withRelatedLandings(DONATION_CERTIFICATES_CONTENT_CA, 'ca', 'certificats-donacio'),
      es: withRelatedLandings(DONATION_CERTIFICATES_CONTENT_ES, 'es', 'certificats-donacio'),
      fr: buildPendingContent('fr', LANDING_NAMES['certificats-donacio'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['certificats-donacio'].pt),
    },
  },
  {
    slug: 'model-347-ong',
    metadata: MODEL_347_ONG_METADATA,
    content: {
      ca: withRelatedLandings(MODEL_347_ONG_CONTENT_CA, 'ca', 'model-347-ong'),
      es: withRelatedLandings(MODEL_347_ONG_CONTENT_ES, 'es', 'model-347-ong'),
      fr: buildPendingContent('fr', LANDING_NAMES['model-347-ong'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['model-347-ong'].pt),
    },
  },
  {
    slug: 'remeses-sepa',
    metadata: SEPA_REMITTANCES_METADATA,
    content: {
      ca: withRelatedLandings(SEPA_REMITTANCES_CONTENT_CA, 'ca', 'remeses-sepa'),
      es: withRelatedLandings(SEPA_REMITTANCES_CONTENT_ES, 'es', 'remeses-sepa'),
      fr: buildPendingContent('fr', LANDING_NAMES['remeses-sepa'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['remeses-sepa'].pt),
    },
  },
  {
    slug: 'devolucions-rebuts-socis',
    metadata: RETURNED_RECEIPTS_METADATA,
    content: {
      ca: withRelatedLandings(RETURNED_RECEIPTS_CONTENT_CA, 'ca', 'devolucions-rebuts-socis'),
      es: withRelatedLandings(RETURNED_RECEIPTS_CONTENT_ES, 'es', 'devolucions-rebuts-socis'),
      fr: buildPendingContent('fr', LANDING_NAMES['devolucions-rebuts-socis'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['devolucions-rebuts-socis'].pt),
    },
  },
  {
    slug: 'importar-extracte-bancari',
    metadata: BANK_STATEMENT_IMPORT_METADATA,
    content: {
      ca: withRelatedLandings(BANK_STATEMENT_IMPORT_CONTENT_CA, 'ca', 'importar-extracte-bancari'),
      es: withRelatedLandings(BANK_STATEMENT_IMPORT_CONTENT_ES, 'es', 'importar-extracte-bancari'),
      fr: buildPendingContent('fr', LANDING_NAMES['importar-extracte-bancari'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['importar-extracte-bancari'].pt),
    },
  },
  {
    slug: 'conciliacio-bancaria-ong',
    metadata: BANK_RECONCILIATION_ONG_METADATA,
    content: {
      ca: withRelatedLandings(BANK_RECONCILIATION_ONG_CONTENT_CA, 'ca', 'conciliacio-bancaria-ong'),
      es: withRelatedLandings(BANK_RECONCILIATION_ONG_CONTENT_ES, 'es', 'conciliacio-bancaria-ong'),
      fr: buildPendingContent('fr', LANDING_NAMES['conciliacio-bancaria-ong'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['conciliacio-bancaria-ong'].pt),
    },
  },
  {
    slug: 'control-donacions-ong',
    metadata: DONATIONS_CONTROL_ONG_METADATA,
    content: {
      ca: withRelatedLandings(DONATIONS_CONTROL_ONG_CONTENT_CA, 'ca', 'control-donacions-ong'),
      es: withRelatedLandings(DONATIONS_CONTROL_ONG_CONTENT_ES, 'es', 'control-donacions-ong'),
      fr: buildPendingContent('fr', LANDING_NAMES['control-donacions-ong'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['control-donacions-ong'].pt),
    },
  },
  {
    slug: 'software-gestion-ong',
    metadata: SOFTWARE_MANAGEMENT_ONG_METADATA,
    content: {
      ca: withRelatedLandings(SOFTWARE_MANAGEMENT_ONG_CONTENT_CA, 'ca', 'software-gestion-ong'),
      es: buildPendingContent('es', LANDING_NAMES['software-gestion-ong'].es),
      fr: buildPendingContent('fr', LANDING_NAMES['software-gestion-ong'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['software-gestion-ong'].pt),
    },
  },
  {
    slug: 'programa-associacions',
    metadata: ASSOCIATIONS_PROGRAM_METADATA,
    content: {
      ca: withRelatedLandings(ASSOCIATIONS_PROGRAM_CONTENT_CA, 'ca', 'programa-associacions'),
      es: buildPendingContent('es', LANDING_NAMES['programa-associacions'].es),
      fr: buildPendingContent('fr', LANDING_NAMES['programa-associacions'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['programa-associacions'].pt),
    },
  },
  {
    slug: 'gestio-donants',
    metadata: DONOR_MANAGEMENT_METADATA,
    content: {
      ca: withRelatedLandings(DONOR_MANAGEMENT_CONTENT_CA, 'ca', 'gestio-donants'),
      es: buildPendingContent('es', LANDING_NAMES['gestio-donants'].es),
      fr: buildPendingContent('fr', LANDING_NAMES['gestio-donants'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['gestio-donants'].pt),
    },
  },
];

const PUBLIC_LANDING_MAP = new Map(PUBLIC_LANDINGS.map((landing) => [landing.slug, landing]));

export function getPublicLandingBySlug(slug: string): PublicLandingDefinition | null {
  return PUBLIC_LANDING_MAP.get(slug) ?? null;
}

export function getPublicLandingSlugs(): string[] {
  return PUBLIC_LANDINGS.map((landing) => landing.slug);
}

export function getPublicLandingMetadata(landing: PublicLandingDefinition, locale: PublicLocale): PublicLandingMetadata {
  return landing.metadata[locale] ?? landing.metadata.ca;
}

export function getPublicLandingContent(landing: PublicLandingDefinition, locale: PublicLocale): PublicLandingContent {
  return landing.content[locale] ?? landing.content.ca;
}

export function getPublicLandingPreviewBySlug(slug: string, locale: PublicLocale) {
  const landing = getPublicLandingBySlug(slug);

  if (!landing) {
    return null;
  }

  const content = getPublicLandingContent(landing, locale);
  const metadata = getPublicLandingMetadata(landing, locale);

  return {
    slug: landing.slug,
    title: content.hero.title,
    subtitle: content.hero.subtitle,
    description: metadata.description,
    media: content.hero.media ?? null,
  };
}
