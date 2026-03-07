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

const DONATION_CERTIFICATES_METADATA: Record<PublicLocale, PublicLandingMetadata> = {
  ca: {
    title: 'Certificats de donacio per a ONG | Software de gestio per entitats | Summa Social',
    description:
      'Genera i envia els certificats de donacio sense plantilles manuals, sense errors i sense perdre hores cada any.',
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
    title: 'Certificats de donacio per a ONG i associacions',
    subtitle: 'Genera i envia els certificats de donacio sense plantilles manuals, sense errors i sense perdre hores cada any.',
    introParagraphs: [
      'Per a moltes entitats, l emissio dels certificats de donacio continua sent una tasca lenta i repetitiva. Cal revisar que ha donat cada persona, comprovar si hi ha devolucions, generar el document correcte i fer arribar el certificat al donant.',
      'Quan aquest proces es fa amb fulls de calcul, plantilles i correus manuals, es facil que apareguin errors, duplicitats o simplement massa feina acumulada en pocs dies.',
      'Summa Social simplifica aquest proces.',
      'Es una aplicacio pensada especificament per a entitats socials que permet generar els certificats de donacio a partir de les dades reals de l any i enviar-los de manera ordenada des d un unic lloc.',
    ],
    media: {
      type: 'video',
      src: '/visuals/landings/certificats-donacio/animations/anima-certificats.webm',
      mp4FallbackSrc: '/visuals/landings/certificats-donacio/animations/anima-certificats.mp4',
      poster: '/visuals/landings/certificats-donacio/optimized/anima-certificats-poster.webp',
      alt: 'Animacio del proces de certificats de donacio a Summa Social',
    },
  },
  problem: {
    title: 'El problema real dels certificats de donacio',
    intro: 'Quan arriba el moment d emetre certificats, moltes entitats es troben amb situacions com aquestes:',
    points: [
      'cal revisar manualment que ha aportat cada donant',
      's han de restar devolucions o rebuts retornats',
      'hi ha dades fiscals incompletes',
      'els documents es generen un per un',
      'els correus s han d enviar manualment',
    ],
    outroParagraphs: [
      'El resultat acostuma a ser el mateix: hores de feina administrativa per completar una tasca que hauria de ser molt mes simple.',
    ],
  },
  solution: {
    title: 'Com ho resol Summa Social',
    intro: 'Summa Social genera els certificats a partir de la mateixa informacio economica que l entitat ja treballa durant l any. Aixo permet que el proces sigui molt mes clar i molt mes fiable.',
    steps: [
      {
        title: 'El sistema calcula l import correcte',
        body: 'Cada certificat es genera a partir de les donacions reals registrades al sistema.',
      },
      {
        title: 'Les devolucions queden reflectides',
        body: 'Si hi ha rebuts retornats o ajustos, el certificat recull l import net real del donant.',
      },
      {
        title: 'El certificat es genera automaticament',
        body: 'No cal preparar plantilles manuals ni copiar dades d un lloc a un altre.',
      },
      {
        title: 'Es pot enviar des de la mateixa aplicacio',
        body: 'L entitat pot gestionar l enviament dels certificats sense sortir del sistema.',
      },
      {
        title: 'Tambe es pot treballar en bloc',
        body: 'Quan cal emetre molts certificats, el proces continua sent ordenat i assumible.',
      },
    ],
  },
  includes: {
    title: 'Que permet gestionar Summa Social',
    intro: 'Amb Summa Social, l entitat pot:',
    items: [
      'generar certificats individuals per a un donant concret',
      'preparar certificats anuals a partir de l activitat real del donant',
      'gestionar l emissio de certificats de forma massiva',
      'mantenir coherencia entre certificats, donacions i devolucions',
      'centralitzar el proces dins de la mateixa aplicacio',
    ],
    outroParagraphs: [
      'Aixo evita haver de repartir la feina entre Excel, PDFs solts i correus enviats manualment.',
    ],
  },
  operationalBenefits: {
    title: 'Beneficis operatius per a l entitat',
    items: [
      'Menys temps administratiu: els certificats es generen a partir de dades que ja estan treballades al sistema.',
      'Menys risc d errors: l import del certificat no depen de calculs manuals d ultima hora.',
      'Proces mes ordenat: la generacio i l enviament es fan des d un unic entorn.',
      'Mes tranquil litat per a l equip: quan arriba el moment d emetre certificats, la feina ja no comenca de zero.',
    ],
  },
  forSmallAndMidEntities: {
    title: 'Pensat per a entitats petites i mitjanes',
    paragraphs: [
      'Summa Social esta dissenyat per a organitzacions que necessiten complir amb les seves obligacions fiscals sense afegir complexitat innecessaria. Es especialment util per entitats que gestionen socis o donants recurrents, han d emetre certificats cada any, volen evitar processos manuals amb fulls de calcul i necessiten una manera clara de controlar donacions i devolucions.',
      'No es una eina pensada per fer mes gran la burocracia. Es una eina pensada per reduir-la. El millor es no esperar al moment d emetre els certificats: si durant l any les donacions i les devolucions ja queden ben registrades, el proces final es simplifica molt.',
    ],
  },
  finalCta: {
    title: 'Vols veure com funciona?',
    text: 'Si cada any la generacio dels certificats de donacio et porta massa hores o massa revisions manuals, potser val la pena veure com funciona Summa Social. L emissio de certificats pot passar de ser una tasca pesada i repetitiva a ser simplement un proces mes dins del sistema.',
    linkLabel: 'Demana una demostracio per la teva entitat.',
    href: '/ca/contact',
  },
};

const SEPA_REMITTANCES_METADATA: Record<PublicLocale, PublicLandingMetadata> = {
  ca: {
    title: 'Remeses SEPA per a quotes de socis | Software de gestió per entitats | Summa Social',
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
      'Summa Social simplifica aquest procés. L aplicació permet preparar les remeses de cobrament de quotes a partir de les dades reals dels socis i generar el fitxer que el banc necessita.',
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
      'A més, quan l entitat té molts socis, el procés pot convertir-se en una tasca administrativa molt pesada.',
    ],
  },
  solution: {
    title: 'Com ho resol Summa Social',
    intro: 'Summa Social permet preparar les remeses de cobrament directament des de la informació dels socis. El procés és simple:',
    steps: [
      {
        title: 'Selecciones el compte bancari de l entitat',
        body: 'El sistema utilitza les dades del compte que cobrarà les quotes.',
      },
      {
        title: 'El sistema identifica els socis que toca cobrar',
        body: 'Segons la periodicitat de la quota, es pot preparar la remesa corresponent.',
      },
      {
        title: 'Revises la selecció',
        body: 'Abans de generar la remesa, es pot comprovar qui s inclou i qui no.',
      },
      {
        title: 'Es genera el fitxer SEPA',
        body: 'L entitat descarrega el fitxer amb el format que necessita el banc.',
      },
      {
        title: 'Puges el fitxer al banc',
        body: 'Amb el fitxer carregat al banc, es pot executar el cobrament de les quotes.',
      },
    ],
  },
  includes: {
    title: 'Què permet gestionar Summa Social',
    intro: 'Amb Summa Social, l entitat pot:',
    items: [
      'preparar remeses de cobrament de quotes',
      'gestionar socis amb diferents periodicitats de pagament',
      'detectar socis amb dades bancàries incompletes',
      'revisar fàcilment els cobraments abans d enviar-los al banc',
    ],
    outroParagraphs: [
      'Tot el procés queda integrat amb la base de dades de donants i amb la gestió econòmica de l entitat.',
    ],
  },
  operationalBenefits: {
    title: 'Beneficis operatius',
    items: [
      'Menys feina administrativa: no cal preparar fitxers manuals cada vegada.',
      'Menys risc d errors: els cobraments es generen a partir de les dades dels socis.',
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
    title: 'Vols veure com funciona?',
    text: 'Si la teva entitat cobra quotes de socis cada mes o cada trimestre, potser val la pena veure com funciona aquest procés dins de Summa Social. Preparar una remesa pot passar de ser una tasca manual amb Excel a ser simplement un pas més dins del sistema.',
    linkLabel: 'Demana una demostració per la teva entitat.',
    href: '/ca/contact',
  },
};

const BANK_STATEMENT_IMPORT_METADATA: Record<PublicLocale, PublicLandingMetadata> = {
  ca: {
    title: 'Importar extracte bancari per a entitats | Software de gestió | Summa Social',
    description:
      'Importa l extracte bancari i centralitza ingressos i despeses en un únic lloc. Classifica moviments i vincula transaccions amb donants o proveïdors.',
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
    title: 'Importar l extracte bancari i tenir tots els moviments controlats',
    subtitle: 'Porta els moviments del banc a un únic lloc.',
    introParagraphs: [
      'Moltes entitats gestionen la seva informació econòmica amb extractes bancaris, fulls de càlcul i notes disperses. Això fa difícil tenir una visió clara de què ha passat realment durant el mes.',
      'Summa Social permet importar l extracte bancari i treballar directament sobre els moviments.',
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
        body: 'Cada línia d extracte queda identificada com un moviment nou.',
      },
      {
        title: 'Cada moviment queda registrat',
        body: 'Es guarda la data, la descripció i l import per treballar-ho des del sistema.',
      },
      {
        title: 'Assignació de contactes i categories',
        body: 'Els moviments es poden vincular amb donants, proveïdors o categories de despesa.',
      },
      {
        title: 'Revisió i classificació',
        body: 'L equip de l entitat pot revisar els moviments i completar la informació que calgui.',
      },
    ],
  },
  includes: {
    title: 'Què permet gestionar Summa Social',
    intro: 'Amb els moviments importats, l entitat pot:',
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
      'Summa Social està pensat per entitats que gestionen els comptes amb extractes bancaris, volen tenir millor control de les despeses i ingressos i necessiten preparar informes fiscals o justificacions.',
      'No és un sistema comptable complex. És una eina per organitzar la informació econòmica de l entitat.',
    ],
  },
  finalCta: {
    title: 'Vols veure com funciona?',
    text: 'Si la teva entitat treballa amb extractes bancaris cada mes, potser val la pena veure com funciona aquest procés dins de Summa Social. Importar els moviments pot passar de ser una tasca manual a ser simplement el primer pas de la gestió econòmica.',
    linkLabel: 'Demana una demostració per la teva entitat.',
    href: '/ca/contact',
  },
};

const DONOR_MANAGEMENT_METADATA: Record<PublicLocale, PublicLandingMetadata> = {
  ca: {
    title: 'Gestió de donants per a entitats socials | Software de gestió | Summa Social',
    description:
      'Centralitza socis i donants en una base clara, amb historial d aportacions i suport per certificats i Model 182.',
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
    title: 'Gestionar els donants de l entitat sense fulls de càlcul',
    subtitle: 'Tenir una base clara de socis i donants.',
    introParagraphs: [
      'Per a moltes entitats, la informació dels donants es troba repartida entre fulls de càlcul, llistes antigues i correus electrònics.',
      'Això fa difícil saber qui són realment els donants actius, quant ha aportat cada persona i quins socis paguen quotes regularment.',
      'Summa Social centralitza la gestió de donants en un únic lloc.',
    ],
  },
  problem: {
    title: 'El problema habitual amb les bases de donants',
    intro: 'Quan la informació dels donants es gestiona amb Excel, apareixen problemes com:',
    points: [
      'dades duplicades o desactualitzades',
      'dificultat per saber què ha aportat cada persona',
      'errors en preparar certificats de donació',
      'manca de visió sobre l evolució dels donants',
    ],
    outroParagraphs: ['Amb el temps, la base de dades es torna difícil de mantenir.'],
  },
  solution: {
    title: 'Com ho resol Summa Social',
    intro: 'Summa Social permet gestionar els donants com una base estructurada vinculada als moviments econòmics.',
    steps: [
      {
        title: 'Registres els donants de l entitat',
        body: 'Cada persona o empresa té la seva fitxa amb les dades principals.',
      },
      {
        title: 'Pots importar donants des d Excel',
        body: 'La base inicial es pot carregar sense haver de crear cada fitxa manualment.',
      },
      {
        title: 'Les donacions es vinculen automàticament',
        body: 'Quan entra una donació, queda associada al donant corresponent.',
      },
      {
        title: 'Pots veure l historial de cada donant',
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
    intro: 'Amb Summa Social, l entitat pot:',
    items: [
      'tenir una base actualitzada de socis i donants',
      'importar donants des d Excel',
      'veure l historial complet de donacions',
      'identificar donants recurrents o puntuals',
    ],
    outroParagraphs: ['Això permet entendre millor qui sosté l activitat de l entitat.'],
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
      'És una eina per facilitar la gestió quotidiana de l entitat.',
    ],
  },
  finalCta: {
    title: 'Vols veure com funciona?',
    text: 'Si la base de donants de la teva entitat està repartida entre diversos documents o fulls de càlcul, potser val la pena veure com funciona Summa Social. La gestió dels donants pot passar de ser un conjunt de llistes disperses a ser una base clara vinculada a la realitat econòmica de l entitat.',
    linkLabel: 'Demana una demostració per la teva entitat.',
    href: '/ca/contact',
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
  {
    slug: 'certificats-donacio',
    metadata: DONATION_CERTIFICATES_METADATA,
    content: {
      ca: DONATION_CERTIFICATES_CONTENT_CA,
      es: buildPendingContent('es', LANDING_NAMES['certificats-donacio'].es),
      fr: buildPendingContent('fr', LANDING_NAMES['certificats-donacio'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['certificats-donacio'].pt),
    },
  },
  {
    slug: 'remeses-sepa',
    metadata: SEPA_REMITTANCES_METADATA,
    content: {
      ca: SEPA_REMITTANCES_CONTENT_CA,
      es: buildPendingContent('es', LANDING_NAMES['remeses-sepa'].es),
      fr: buildPendingContent('fr', LANDING_NAMES['remeses-sepa'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['remeses-sepa'].pt),
    },
  },
  {
    slug: 'importar-extracte-bancari',
    metadata: BANK_STATEMENT_IMPORT_METADATA,
    content: {
      ca: BANK_STATEMENT_IMPORT_CONTENT_CA,
      es: buildPendingContent('es', LANDING_NAMES['importar-extracte-bancari'].es),
      fr: buildPendingContent('fr', LANDING_NAMES['importar-extracte-bancari'].fr),
      pt: buildPendingContent('pt', LANDING_NAMES['importar-extracte-bancari'].pt),
    },
  },
  {
    slug: 'gestio-donants',
    metadata: DONOR_MANAGEMENT_METADATA,
    content: {
      ca: DONOR_MANAGEMENT_CONTENT_CA,
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
