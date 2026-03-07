import type { PublicLocale } from '@/lib/public-locale';

interface PublicLandingMetadata {
  title: string;
  description: string;
}

interface NumberedBlock {
  title: string;
  body: string;
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
}

interface PublicLandingDefinition {
  slug: string;
  metadata: Record<PublicLocale, PublicLandingMetadata>;
  content: Partial<Record<PublicLocale, PublicLandingContent>> & { ca: PublicLandingContent };
}

const LANDING_NAMES: Record<string, Record<PublicLocale, string>> = {
  'model-182': {
    ca: 'Model 182',
    es: 'Modelo 182',
    fr: 'Modele 182',
    pt: 'Modelo 182',
  },
  'certificats-donacio': {
    ca: 'Certificats de donacio',
    es: 'Certificados de donacion',
    fr: 'Certificats de don',
    pt: 'Certificados de doacao',
  },
  'remeses-sepa': {
    ca: 'Remeses SEPA',
    es: 'Remesas SEPA',
    fr: 'Prelevements SEPA',
    pt: 'Remessas SEPA',
  },
  'importar-extracte-bancari': {
    ca: 'Importar extracte bancari',
    es: 'Importar extracto bancario',
    fr: 'Importer un extrait bancaire',
    pt: 'Importar extrato bancario',
  },
  'gestio-donants': {
    ca: 'Gestio de donants',
    es: 'Gestion de donantes',
    fr: 'Gestion des donateurs',
    pt: 'Gestao de doadores',
  },
};

function contactHref(locale: PublicLocale) {
  return `/${locale}/contact`;
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
      subtitle: 'Contingut en preparacio',
      introParagraphs: [
        `Aquesta landing sobre ${landingName} ja te l esquelet tecnic i visual preparat.`,
        'El contingut final s afegira quan es tanqui el text funcional validat.',
      ],
    },
    problem: {
      title: 'Problema real',
      intro: 'Apartat pendent de definir amb contingut funcional validat.',
      points: [
        'Punt pendent de validacio funcional.',
        'Punt pendent de validacio funcional.',
        'Punt pendent de validacio funcional.',
      ],
    },
    solution: {
      title: 'Com ho resol Summa Social',
      intro: 'Bloc preparat per documentar el flux real en 5 passos.',
      steps: [
        { title: 'Pas 1 (pendent)', body: 'Detall pendent de validacio.' },
        { title: 'Pas 2 (pendent)', body: 'Detall pendent de validacio.' },
        { title: 'Pas 3 (pendent)', body: 'Detall pendent de validacio.' },
        { title: 'Pas 4 (pendent)', body: 'Detall pendent de validacio.' },
        { title: 'Pas 5 (pendent)', body: 'Detall pendent de validacio.' },
      ],
    },
    includes: {
      title: 'Que inclou / que permet',
      intro: 'Seccio preparada per llistar l abast funcional real.',
      items: [
        'Element pendent de validacio.',
        'Element pendent de validacio.',
        'Element pendent de validacio.',
      ],
    },
    operationalBenefits: {
      title: 'Beneficis operatius',
      items: [
        'Benefici pendent de validacio.',
        'Benefici pendent de validacio.',
        'Benefici pendent de validacio.',
      ],
    },
    forSmallAndMidEntities: {
      title: 'Pensat per a entitats petites i mitjanes',
      paragraphs: [
        'Text pendent de validacio funcional.',
        'Text pendent de validacio funcional.',
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

function buildPendingMetadata(name: Record<PublicLocale, string>): Record<PublicLocale, PublicLandingMetadata> {
  return {
    ca: {
      title: `${name.ca} | Summa Social`,
      description: `${name.ca} per entitats sense anim de lucre. Contingut complet en preparacio.`,
    },
    es: {
      title: `${name.es} | Summa Social`,
      description: `${name.es} para entidades sin animo de lucro. Contenido completo en preparacion.`,
    },
    fr: {
      title: `${name.fr} | Summa Social`,
      description: `${name.fr} pour associations. Contenu complet en preparation.`,
    },
    pt: {
      title: `${name.pt} | Summa Social`,
      description: `${name.pt} para entidades sem fins lucrativos. Conteudo completo em preparacao.`,
    },
  };
}

function buildPendingLanding(slug: keyof typeof LANDING_NAMES): PublicLandingDefinition {
  const name = LANDING_NAMES[slug];
  return {
    slug,
    metadata: buildPendingMetadata(name),
    content: {
      ca: buildPendingContent('ca', name.ca),
      es: buildPendingContent('es', name.es),
      fr: buildPendingContent('fr', name.fr),
      pt: buildPendingContent('pt', name.pt),
    },
  };
}

const MODEL_182_METADATA: Record<PublicLocale, PublicLandingMetadata> = {
  ca: {
    title: 'Model 182 per a ONG | Software de gestió per entitats | Summa Social',
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

const MODEL_182_CONTENT_CA: PublicLandingContent = {
  hero: {
    title: 'Model 182 per a ONGs i associacions',
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
      'No és un ERP generalista ni un sistema de comptabilitat avançat. És una eina de gestió econòmica i fiscal pensada específicament per entitats socials.',
    ],
  },
  finalCta: {
    title: 'Vols veure com funciona?',
    text: 'Si portes la gestió econòmica d’una entitat i cada any pateixes amb el Model 182, potser val la pena veure com funciona Summa Social.',
    linkLabel: 'Demana una demostració per la teva entitat.',
    href: '/ca/contact',
  },
};

const PUBLIC_LANDINGS: PublicLandingDefinition[] = [
  {
    slug: 'model-182',
    metadata: MODEL_182_METADATA,
    content: {
      ca: MODEL_182_CONTENT_CA,
      es: buildPendingContent('es', LANDING_NAMES['model-182'].es),
      fr: buildPendingContent('fr', LANDING_NAMES['model-182'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['model-182'].pt),
    },
  },
  buildPendingLanding('certificats-donacio'),
  buildPendingLanding('remeses-sepa'),
  buildPendingLanding('importar-extracte-bancari'),
  buildPendingLanding('gestio-donants'),
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
