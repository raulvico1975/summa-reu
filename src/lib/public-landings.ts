import type { PublicLocale } from '@/lib/public-locale';

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

interface PublicLandingDefinition {
  slug: string;
  metadata: Record<PublicLocale, PublicLandingMetadata>;
  content: Partial<Record<PublicLocale, PublicLandingContent>> & { ca: PublicLandingContent };
}

type PublicLandingSlug =
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
  return `/${locale}/gestio-economica-ong`;
}

const RELATED_LANDINGS_BY_SLUG: Record<PublicLandingSlug, PublicLandingSlug[]> = {
  'model-182': ['certificats-donacio', 'gestio-donants', 'model-347-ong'],
  'certificats-donacio': ['model-182', 'gestio-donants', 'control-donacions-ong'],
  'model-347-ong': ['importar-extracte-bancari', 'conciliacio-bancaria-ong', 'software-gestion-ong'],
  'remeses-sepa': ['devolucions-rebuts-socis', 'gestio-donants', 'control-donacions-ong'],
  'devolucions-rebuts-socis': ['remeses-sepa', 'gestio-donants', 'model-182'],
  'conciliacio-bancaria-ong': ['importar-extracte-bancari', 'control-donacions-ong', 'model-347-ong'],
  'importar-extracte-bancari': ['conciliacio-bancaria-ong', 'model-347-ong', 'control-donacions-ong'],
  'gestio-donants': ['control-donacions-ong', 'certificats-donacio', 'model-182'],
  'control-donacions-ong': ['gestio-donants', 'certificats-donacio', 'model-182'],
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
    title: 'Modelo 182 | Summa Social',
    description: 'Landing en preparacion para Modelo 182 de entidades sin animo de lucro.',
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
    title: 'Certificados de donacion | Summa Social',
    description: 'Landing en preparacion para certificados de donacion de entidades sin animo de lucro.',
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

const SEPA_REMITTANCES_METADATA: Record<PublicLocale, PublicLandingMetadata> = {
  ca: {
    title: 'Remeses SEPA per a quotes de socis | Software de gestió per a entitats | Summa Social',
    description:
      'Prepara remeses SEPA de quotes de socis sense fulls de càlcul. Revisa IBAN, imports i genera el fitxer per al banc amb Summa Social.',
  },
  es: {
    title: 'Remesas SEPA | Summa Social',
    description: 'Landing en preparacion para remesas SEPA de entidades sin animo de lucro.',
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

const BANK_STATEMENT_IMPORT_METADATA: Record<PublicLocale, PublicLandingMetadata> = {
  ca: {
    title: "Importar l'extracte bancari per a entitats | Software de gestió | Summa Social",
    description:
      "Importa l'extracte bancari i centralitza ingressos i despeses en un únic lloc. Classifica moviments i vincula transaccions amb donants o proveïdors.",
  },
  es: {
    title: 'Importar extracto bancario | Summa Social',
    description: 'Landing en preparacion para importacion de extractos bancarios de entidades.',
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

const BANK_RECONCILIATION_ONG_METADATA: Record<PublicLocale, PublicLandingMetadata> = {
  ca: {
    title: 'Conciliació bancària per ONG | Summa Social',
    description: "Com controlar els moviments bancaris d'una ONG i classificar ingressos i despeses sense Excel.",
  },
  es: {
    title: 'Conciliacion bancaria para ONG | Summa Social',
    description: 'Landing en preparacion para conciliacion bancaria de entidades sin animo de lucro.',
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

const DONATIONS_CONTROL_ONG_METADATA: Record<PublicLocale, PublicLandingMetadata> = {
  ca: {
    title: 'Control de donacions per ONG | Summa Social',
    description: "Com controlar les donacions d'una ONG i tenir una base clara de donants i aportacions.",
  },
  es: {
    title: 'Control de donaciones para ONG | Summa Social',
    description: 'Landing en preparacion para control y seguimiento de donaciones de entidades sin animo de lucro.',
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
    title: 'Modelo 347 para ONG | Summa Social',
    description: 'Landing en preparacion para el Modelo 347 de entidades sin animo de lucro.',
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

const RETURNED_RECEIPTS_METADATA: Record<PublicLocale, PublicLandingMetadata> = {
  ca: {
    title: 'Devolucions de rebuts de socis | Software de gestió per a entitats | Summa Social',
    description:
      'Gestiona rebuts retornats i devolucions bancàries sense perdre el fil fiscal. Assigna cada devolució al soci correcte dins de Summa Social.',
  },
  es: {
    title: 'Devoluciones de recibos de socios | Summa Social',
    description: 'Landing en preparacion para devoluciones bancarias y recibos devueltos.',
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
      src: '/visuals/landings/model-182/animations/anima-182.webm',
      mp4FallbackSrc: '/visuals/landings/model-182/animations/anima-182.mp4',
      poster: '/visuals/landings/model-182/optimized/anima-182-poster.webp',
      alt: 'Animacio de flux del Model 182 a Summa Social',
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

const PUBLIC_LANDINGS: PublicLandingDefinition[] = [
  {
    slug: 'model-182',
    metadata: MODEL_182_METADATA,
    content: {
      ca: withRelatedLandings(MODEL_182_CONTENT_CA, 'ca', 'model-182'),
      es: buildPendingContent('es', LANDING_NAMES['model-182'].es),
      fr: buildPendingContent('fr', LANDING_NAMES['model-182'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['model-182'].pt),
    },
  },
  {
    slug: 'certificats-donacio',
    metadata: DONATION_CERTIFICATES_METADATA,
    content: {
      ca: withRelatedLandings(DONATION_CERTIFICATES_CONTENT_CA, 'ca', 'certificats-donacio'),
      es: buildPendingContent('es', LANDING_NAMES['certificats-donacio'].es),
      fr: buildPendingContent('fr', LANDING_NAMES['certificats-donacio'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['certificats-donacio'].pt),
    },
  },
  {
    slug: 'model-347-ong',
    metadata: MODEL_347_ONG_METADATA,
    content: {
      ca: withRelatedLandings(MODEL_347_ONG_CONTENT_CA, 'ca', 'model-347-ong'),
      es: buildPendingContent('es', LANDING_NAMES['model-347-ong'].es),
      fr: buildPendingContent('fr', LANDING_NAMES['model-347-ong'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['model-347-ong'].pt),
    },
  },
  {
    slug: 'remeses-sepa',
    metadata: SEPA_REMITTANCES_METADATA,
    content: {
      ca: withRelatedLandings(SEPA_REMITTANCES_CONTENT_CA, 'ca', 'remeses-sepa'),
      es: buildPendingContent('es', LANDING_NAMES['remeses-sepa'].es),
      fr: buildPendingContent('fr', LANDING_NAMES['remeses-sepa'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['remeses-sepa'].pt),
    },
  },
  {
    slug: 'devolucions-rebuts-socis',
    metadata: RETURNED_RECEIPTS_METADATA,
    content: {
      ca: withRelatedLandings(RETURNED_RECEIPTS_CONTENT_CA, 'ca', 'devolucions-rebuts-socis'),
      es: buildPendingContent('es', LANDING_NAMES['devolucions-rebuts-socis'].es),
      fr: buildPendingContent('fr', LANDING_NAMES['devolucions-rebuts-socis'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['devolucions-rebuts-socis'].pt),
    },
  },
  {
    slug: 'importar-extracte-bancari',
    metadata: BANK_STATEMENT_IMPORT_METADATA,
    content: {
      ca: withRelatedLandings(BANK_STATEMENT_IMPORT_CONTENT_CA, 'ca', 'importar-extracte-bancari'),
      es: buildPendingContent('es', LANDING_NAMES['importar-extracte-bancari'].es),
      fr: buildPendingContent('fr', LANDING_NAMES['importar-extracte-bancari'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['importar-extracte-bancari'].pt),
    },
  },
  {
    slug: 'conciliacio-bancaria-ong',
    metadata: BANK_RECONCILIATION_ONG_METADATA,
    content: {
      ca: withRelatedLandings(BANK_RECONCILIATION_ONG_CONTENT_CA, 'ca', 'conciliacio-bancaria-ong'),
      es: buildPendingContent('es', LANDING_NAMES['conciliacio-bancaria-ong'].es),
      fr: buildPendingContent('fr', LANDING_NAMES['conciliacio-bancaria-ong'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['conciliacio-bancaria-ong'].pt),
    },
  },
  {
    slug: 'control-donacions-ong',
    metadata: DONATIONS_CONTROL_ONG_METADATA,
    content: {
      ca: withRelatedLandings(DONATIONS_CONTROL_ONG_CONTENT_CA, 'ca', 'control-donacions-ong'),
      es: buildPendingContent('es', LANDING_NAMES['control-donacions-ong'].es),
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
