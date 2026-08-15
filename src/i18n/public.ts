/**
 * Traduccions per a les pàgines públiques (no requereixen autenticació).
 * Suporta ca/es/fr/pt.
 */

import type { PublicLocale } from '@/lib/public-locale';
import type { PublicPlanId } from '@/lib/public-plans';

type CardType = {
  title: string;
  description: string;
  screenshotAlt: string;
};

type BlockType = {
  title: string;
  subtitle: string;
  cards: Record<string, CardType>;
};

export interface PublicTranslations {
  common: {
    appName: string;
    tagline: string;
    close: string;
    back: string;
    backToHome: string;
    about: string;
    blog: string;
    menu: string;
    contact: string;
    privacy: string;
    features: string;
    enter: string;
    email: string;
    lastUpdated: string;
    privacyContact: string;
  };
  cta: {
    primary: string;
    secondary: string;
    supporting: string;
  };
  login: {
    title: string;
    welcomeTitle: string;
    welcomeDescription: string;
    urlFormatIntro: string;
    urlFormatExample: string;
    urlFormatHelp: string;
    orElse: string;
    visitWebsite: string;
    contactUs: string;
    footer: string;
    sessionExpired: string;
  };
  privacy: {
    title: string;
    updatedAt: string;
    sections: {
      whoWeAre: {
        title: string;
        intro: string;
        responsible: string;
        processor: string;
      };
      whatData: {
        title: string;
        appUsersTitle: string;
        appUsersTable: {
          data: string;
          purpose: string;
          email: string;
          emailPurpose: string;
          name: string;
          namePurpose: string;
          role: string;
          rolePurpose: string;
          organizations: string;
          organizationsPurpose: string;
        };
        appUsersNote: string;
        entityDataTitle: string;
        entityDataIntro: string;
        entityDataItems: string[];
        entityDataNote: string;
        entityDataSensitive: string;
      };
      legalBasis: {
        title: string;
        table: {
          treatment: string;
          basis: string;
          appUsers: string;
          appUsersBasis: string;
          entityData: string;
          entityDataBasis: string;
        };
      };
      recipients: {
        title: string;
        subprocessorsTitle: string;
        subprocessorsIntro: string;
        table: {
          service: string;
          location: string;
          guarantees: string;
        };
        services: {
          auth: { name: string; location: string; guarantees: string };
          firestore: { name: string; location: string; guarantees: string };
          storage: { name: string; location: string; guarantees: string };
          hosting: { name: string; location: string; guarantees: string };
        };
        legalObligationsTitle: string;
        legalObligationsIntro: string;
        legalObligationsItems: string[];
        legalObligationsNote: string;
      };
      retention: {
        title: string;
        table: {
          dataType: string;
          period: string;
        };
        items: {
          appUsers: { type: string; period: string };
          fiscalData: { type: string; period: string };
          otherData: { type: string; period: string };
        };
        note: string;
      };
      rights: {
        title: string;
        intro: string;
        rightsList: {
          access: { name: string; description: string };
          rectification: { name: string; description: string };
          erasure: { name: string; description: string };
          objection: { name: string; description: string };
          restriction: { name: string; description: string };
          portability: { name: string; description: string };
        };
        howToExerciseTitle: string;
        howToExerciseAppUsers: string;
        howToExerciseOthers: string;
        responseTime: string;
        complaint: string;
        complaintLink: string;
      };
      security: {
        title: string;
        intro: string;
        measures: string[];
      };
      changes: {
        title: string;
        content: string;
      };
      contact: {
        title: string;
        intro: string;
        emailLabel: string;
        responsibleLabel: string;
        responsibleValue: string;
        holderLabel: string;
        holderValue: string;
        dpoNote: string;
      };
    };
  };
  contact: {
    title: string;
    subtitle: string;
    description: string;
    responseTime: string;
    directEmailLabel: string;
    form: {
      nameLabel: string;
      emailLabel: string;
      organizationLabel: string;
      messageLabel: string;
      submit: string;
      sending: string;
      success: string;
      error: string;
      invalidName: string;
      invalidEmail: string;
      invalidMessage: string;
      helper: string;
      messagePlaceholder: string;
      planMessages: Record<PublicPlanId, string>;
    };
  };
  pricing: {
    navLabel: string;
    metaTitle: string;
    metaDescription: string;
    title: string;
    subtitle: string;
    claim: string;
    orientationTitle: string;
    orientationText: string;
    orientationPoints: string[];
    implantationTitle: string;
    implantationText: string;
    implantationPrice: string;
    implantationSubtext: string;
    implantationNoteTitle: string;
    implantationNoteText: string;
    decisionTitle: string;
    decisionText: string;
    cta: string;
    plans: Array<{
      id: PublicPlanId;
      name: string;
      price: string;
      badge: string;
      cta: string;
      description: string;
      recommended?: boolean;
      features: string[];
      limit?: string;
    }>;
    comparisonTitle: string;
    comparisonDescription: string;
    comparisonFeatureLabel: string;
    comparisonIncludedLabel: string;
    comparisonNotIncludedLabel: string;
    comparisonRows: Array<{
      feature: string;
      control: boolean;
      management: boolean;
      complete: boolean;
    }>;
    faqTitle: string;
    faqItems: Array<{ question: string; answer: string }>;
  };
  home: {
    metaTitle: string;
    metaDescription: string;
    skipToContent: string;
    heroTagline: string;
    hero: {
      visualAlt: string;
      bridgeLine: string;
    };
    nav: {
      conciliation: string;
      remittances: string;
      onlineDonations: string;
      fiscalCertificates: string;
      invoicesSepa: string;
      ticketsSettlements: string;
      projects: string;
    };
    solves: {
      title: string;
      introLead: string;
      introDetail: string;
      aiBadge: string;
      conciliation: string;
      fiscal: string;
      remittances: string;
      vision: string;
      control: string;
      result: string;
    };
    sections: {
      conciliation: {
        title: string;
        description: string;
      };
      remittances: {
        title: string;
        description: string;
      };
      onlineDonations: {
        title: string;
        description: string;
      };
      fiscalCertificates: {
        title: string;
        description: string;
      };
      invoicesSepa: {
        title: string;
        description: string;
      };
      ticketsSettlements: {
        title: string;
        description: string;
      };
      projects: {
        title: string;
        description: string;
      };
    };
    readMore: string;
    // Landing page sections (Kobo-style)
    stats: {
      entities: string;
      entitiesLabel: string;
      movements: string;
      movementsLabel: string;
      countries: string;
      countriesLabel: string;
    };
    workflow: {
      title: string;
      lead: string;
      step1: { title: string; description: string };
      step2: { title: string; description: string };
      step3: { title: string; description: string };
      step4: { title: string; description: string };
    };
    systemOverview: {
      title: string;
      subtitle: string;
    };
    capabilities: {
      title: string;
      conciliation: { title: string; description: string };
      remittances: { title: string; description: string };
      donations: { title: string; description: string };
      fiscal: { title: string; description: string };
    };
    blocks: {
      conciliation: BlockType;
      donorsMembers: BlockType;
      payments: BlockType;
      fiscal: BlockType;
      projects: BlockType;
      control: BlockType;
    };
    profiles: {
      admin: { title: string; description: string };
      projects: { title: string; description: string };
    };
    whoWeAre: {
      title: string;
      lead: string;
      description: string;
      status: string;
    };
    howWeWork: {
      title: string;
      lead: string;
      paragraph1: string;
      paragraph2: string;
      note: string;
      cta: string;
      imageAlt: string;
    };
    finalCta: {
      title: string;
      subtitle: string;
      cta: string;
    };
  };
  features: {
    metaTitle: string;
    metaDescription: string;
    back: string;
    intro: {
      title: string;
      subtitle: string;
      tagline: string;
    };
    mainTitle: string;
    list: {
      conciliation: {
        title: string;
        description: string;
        bullets: string[];
      };
      aiAssignment: {
        title: string;
        description: string;
        bullets: string[];
      };
      remittancesDivider: {
        title: string;
        description: string;
        bullets: string[];
      };
      expensesSepa: {
        title: string;
        description: string;
        ticketsNote: string;
        bullets: string[];
      };
      fiscal: {
        title: string;
        description: string;
        bullets: string[];
      };
      donationCertificates: {
        title: string;
        bullets: string[];
      };
      movementClassification: {
        title: string;
        bullets: string[];
      };
      dashboard: {
        title: string;
        bullets: string[];
      };
      multiContact: {
        title: string;
        bullets: string[];
      };
      bankReturns: {
        title: string;
        bullets: string[];
      };
      stripeIntegration: {
        title: string;
        bullets: string[];
      };
      projectsModule: {
        title: string;
        bullets: string[];
      };
      multiOrg: {
        title: string;
        bullets: string[];
      };
      exports: {
        title: string;
        bullets: string[];
      };
      alerts: {
        title: string;
        bullets: string[];
      };
    };
    cta: string;
  };
  updates: {
    metaTitle: string;
    metaDescription: string;
    navLabel: string;
    title: string;
    back: string;
    noUpdates: string;
    readMore: string;
    viewAll: string;
    publishedAt: string;
    latestLabel: string;
    latestTitle: string;
    latestDescription: string;
  };
  about: {
    metaTitle: string;
    metaDescription: string;
  };
}

const createCard = (title: string, description: string, screenshotAlt = title): CardType => ({
  title,
  description,
  screenshotAlt,
});

const HOME_BLOCKS_CA: PublicTranslations['home']['blocks'] = {
  conciliation: {
    title: 'Conciliació bancària',
    subtitle: '',
    cards: {
      importStatements: createCard(
        "Importació d'extractes",
        'Puges el fitxer del banc i en minuts tens tots els moviments dins el sistema.'
      ),
      autoClassification: createCard(
        'Categorització assistida',
        'La IA proposa una categoria perquè la puguis revisar abans de confirmar-la.'
      ),
      contactAssignment: createCard(
        'Assignació de contactes',
        'Cada moviment queda vinculat al donant, proveïdor o treballador corresponent.'
      ),
      multiBankAccount: createCard(
        'Multi-compte bancari',
        "Si teniu més d'un compte, tot queda separat i traçable."
      ),
    },
  },
  donorsMembers: {
    title: 'Socis i donants',
    subtitle: '',
    cards: {
      donorProfile: createCard(
        'Fitxa completa amb validació fiscal',
        'DNI/CIF, codi postal, IBAN. El sistema avisa del que falta abans que sigui un problema.'
      ),
      bulkImport: createCard(
        'Importació massiva',
        "Tens un Excel amb 500 donants? Importa'ls d'un cop."
      ),
      donorHistory: createCard(
        'Històric per donant',
        'Totes les donacions, devolucions i certificats en una sola fitxa.'
      ),
      operationalStatus: createCard(
        'Estats operatius',
        'Actiu, baixa o arxivat. Llista neta sense perdre històric.'
      ),
    },
  },
  payments: {
    title: 'Cobraments i pagaments',
    subtitle: '',
    cards: {
      remittanceSplitter: createCard(
        'Divisor de remeses',
        "El banc t'envia un sol apunt per 200 quotes? Summa les separa automàticament."
      ),
      bankReturns: createCard(
        'Devolucions bancàries',
        'Registra les devolucions i relaciona-les amb la quota i la persona corresponents.'
      ),
      sepaPayments: createCard(
        'Remeses SEPA de pagament',
        'Genera fitxers SEPA per pagar factures i nòmines des del banc.'
      ),
      stripeDonations: createCard(
        'Donacions i historial',
        'Registra les donacions i conserva l’historial econòmic de cada donant.'
      ),
    },
  },
  fiscal: {
    title: 'Fiscalitat',
    subtitle: '',
    cards: {
      model182: createCard(
        'Model 182',
        'Donacions anuals preparades per revisar abans de compartir-les amb la gestoria.'
      ),
      model347: createCard(
        'Model 347',
        'Informació dels proveïdors que superen el llindar, preparada per revisar.'
      ),
      donationCertificates: createCard(
        'Certificats de donació',
        'PDF individual o massiu, amb enviament per email automàtic.'
      ),
      cleanExcel: createCard(
        'Excel net per a la gestoria',
        'Informació estructurada perquè la gestoria la pugui revisar.'
      ),
    },
  },
  projects: {
    title: 'Projectes',
    subtitle: '',
    cards: {
      budgetLines: createCard(
        'Pressupost per partides',
        "Importa el pressupost des d'Excel i fes el seguiment executat vs previst."
      ),
      expenseAssignment: createCard(
        'Assignació de despeses',
        'Vincula despeses a partides, senceres o parcials. Amb suggerències intel·ligents.'
      ),
      fieldCapture: createCard(
        'Captura de despeses de terreny',
        'Tiquets, viatges i quilometratge des del mòbil.'
      ),
      funderExport: createCard(
        'Exportació per al finançador',
        'XLSX estructurat i comprovants agrupats per preparar la justificació.'
      ),
    },
  },
  control: {
    title: 'Control i visibilitat',
    subtitle: '',
    cards: {
      dashboard: createCard(
        'Dashboard directiu',
        "Ingressos, despeses, saldo, base social i obligacions fiscals d'un cop d'ull."
      ),
      smartAlerts: createCard(
        'Alertes intel·ligents',
        'Moviments pendents, dades incompletes, terminis fiscals. Tot prioritzat.'
      ),
      boardReport: createCard(
        'Informe per a junta o patronat',
        "Genera un informe amb l'estat de comptes, edita el text si cal, exporta a Excel o envia'l per email directament."
      ),
      dataExport: createCard(
        'Exportació de dades',
        'Excel, CSV, PDF. Per contacte, projecte o període.'
      ),
    },
  },
};

const HOME_BLOCKS_ES: PublicTranslations['home']['blocks'] = {
  conciliation: {
    title: 'Conciliación bancaria',
    subtitle: '',
    cards: {
      importStatements: createCard(
        'Importación de extractos',
        'Subes el fichero del banco y en minutos tienes todos los movimientos dentro del sistema.'
      ),
      autoClassification: createCard(
        'Categorización asistida',
        'La IA propone una categoría para que puedas revisarla antes de confirmarla.'
      ),
      contactAssignment: createCard(
        'Asignación de contactos',
        'Cada movimiento queda vinculado al donante, proveedor o trabajador correspondiente.'
      ),
      multiBankAccount: createCard(
        'Multicuenta bancaria',
        'Si tenéis más de una cuenta, todo queda separado y trazable.'
      ),
    },
  },
  donorsMembers: {
    title: 'Socios y donantes',
    subtitle: '',
    cards: {
      donorProfile: createCard(
        'Ficha completa con validación fiscal',
        'DNI/CIF, código postal, IBAN. El sistema avisa de lo que falta antes de que sea un problema.'
      ),
      bulkImport: createCard(
        'Importación masiva',
        '¿Tienes un Excel con 500 donantes? Impórtalos de una vez.'
      ),
      donorHistory: createCard(
        'Histórico por donante',
        'Todas las donaciones, devoluciones y certificados en una sola ficha.'
      ),
      operationalStatus: createCard(
        'Estados operativos',
        'Activo, baja o archivado. Lista limpia sin perder histórico.'
      ),
    },
  },
  payments: {
    title: 'Cobros y pagos',
    subtitle: '',
    cards: {
      remittanceSplitter: createCard(
        'Divisor de remesas',
        '¿El banco te envía un solo apunte por 200 cuotas? Summa las separa automáticamente.'
      ),
      bankReturns: createCard(
        'Devoluciones bancarias',
        'Registra las devoluciones y relaciónalas con la cuota y la persona correspondientes.'
      ),
      sepaPayments: createCard(
        'Remesas SEPA de pago',
        'Genera ficheros SEPA para pagar facturas y nóminas desde el banco.'
      ),
      stripeDonations: createCard(
        'Donaciones e histórico',
        'Registra las donaciones y conserva el histórico económico de cada donante.'
      ),
    },
  },
  fiscal: {
    title: 'Fiscalidad',
    subtitle: '',
    cards: {
      model182: createCard(
        'Modelo 182',
        'Donaciones anuales preparadas para revisar antes de compartirlas con la gestoría.'
      ),
      model347: createCard(
        'Modelo 347',
        'Información de los proveedores que superan el umbral, preparada para revisar.'
      ),
      donationCertificates: createCard(
        'Certificados de donación',
        'PDF individual o masivo, con envío por email automático.'
      ),
      cleanExcel: createCard(
        'Excel limpio para la gestoría',
        'Información estructurada para que la gestoría pueda revisarla.'
      ),
    },
  },
  projects: {
    title: 'Proyectos',
    subtitle: '',
    cards: {
      budgetLines: createCard(
        'Presupuesto por partidas',
        'Importa el presupuesto desde Excel y haz el seguimiento ejecutado vs previsto.'
      ),
      expenseAssignment: createCard(
        'Asignación de gastos',
        'Vincula gastos a partidas, enteros o parciales. Con sugerencias inteligentes.'
      ),
      fieldCapture: createCard(
        'Captura de gastos de terreno',
        'Tickets, viajes y kilometraje desde el móvil.'
      ),
      funderExport: createCard(
        'Exportación para el financiador',
        'XLSX estructurado y comprobantes agrupados para preparar la justificación.'
      ),
    },
  },
  control: {
    title: 'Control y visibilidad',
    subtitle: '',
    cards: {
      dashboard: createCard(
        'Dashboard directivo',
        'Ingresos, gastos, saldo, base social y obligaciones fiscales de un vistazo.'
      ),
      smartAlerts: createCard(
        'Alertas inteligentes',
        'Movimientos pendientes, datos incompletos, plazos fiscales. Todo priorizado.'
      ),
      boardReport: createCard(
        'Informe para junta o patronato',
        'Genera un informe con el estado de cuentas, edita el texto si hace falta, exporta a Excel o envíalo por email directamente.'
      ),
      dataExport: createCard(
        'Exportación de datos',
        'Excel, CSV, PDF. Por contacto, proyecto o período.'
      ),
    },
  },
};

const HOME_BLOCKS_FR: PublicTranslations['home']['blocks'] = {
  conciliation: {
    title: 'Rapprochement bancaire',
    subtitle: '',
    cards: {
      importStatements: createCard(
        'Importation de relevés',
        'Téléchargez le fichier de la banque et en quelques minutes tous les mouvements sont dans le système.'
      ),
      autoClassification: createCard(
        'Catégorisation assistée',
        "L'IA propose une catégorie afin que vous puissiez la vérifier avant confirmation."
      ),
      contactAssignment: createCard(
        'Attribution de contacts',
        'Chaque mouvement est lié au donateur, fournisseur ou salarié correspondant.'
      ),
      multiBankAccount: createCard(
        'Multi-compte bancaire',
        "Si vous avez plus d'un compte, tout reste séparé et traçable."
      ),
    },
  },
  donorsMembers: {
    title: 'Adhérents et donateurs',
    subtitle: '',
    cards: {
      donorProfile: createCard(
        'Fiche complète avec validation fiscale',
        'NIF, code postal, IBAN. Le système signale ce qui manque avant que ce soit un problème.'
      ),
      bulkImport: createCard(
        'Importation massive',
        "Vous avez un Excel avec 500 donateurs ? Importez-les d'un coup."
      ),
      donorHistory: createCard(
        'Historique par donateur',
        'Tous les dons, rejets et certificats dans une seule fiche.'
      ),
      operationalStatus: createCard(
        'États opérationnels',
        "Actif, résilié ou archivé. Liste propre sans perdre l'historique."
      ),
    },
  },
  payments: {
    title: 'Encaissements et paiements',
    subtitle: '',
    cards: {
      remittanceSplitter: createCard(
        'Séparateur de prélèvements',
        'La banque vous envoie une seule écriture pour 200 cotisations ? Summa les sépare automatiquement.'
      ),
      bankReturns: createCard(
        'Rejets bancaires',
        'Enregistrez les rejets et reliez-les à la cotisation et à la personne concernées.'
      ),
      sepaPayments: createCard(
        'Remises SEPA de paiement',
        'Générez des fichiers SEPA pour payer factures et salaires depuis la banque.'
      ),
      stripeDonations: createCard(
        'Dons et historique',
        'Enregistrez les dons et conservez l’historique économique de chaque donateur.'
      ),
    },
  },
  fiscal: {
    title: 'Fiscalité',
    subtitle: '',
    cards: {
      model182: createCard(
        'Modèle 182',
        'Dons annuels préparés pour vérification avant partage avec le cabinet comptable.'
      ),
      model347: createCard(
        'Modèle 347',
        'Informations sur les fournisseurs dépassant le seuil, préparées pour vérification.'
      ),
      donationCertificates: createCard(
        'Certificats de don',
        'PDF individuel ou en lot, avec envoi par email automatique.'
      ),
      cleanExcel: createCard(
        'Excel propre pour le comptable',
        'Informations structurées afin que le cabinet comptable puisse les vérifier.'
      ),
    },
  },
  projects: {
    title: 'Projets',
    subtitle: '',
    cards: {
      budgetLines: createCard(
        'Budget par lignes',
        "Importez le budget depuis Excel et suivez l'exécuté vs le prévu."
      ),
      expenseAssignment: createCard(
        'Affectation de dépenses',
        'Rattachez des dépenses aux lignes, en totalité ou partiellement. Avec suggestions intelligentes.'
      ),
      fieldCapture: createCard(
        'Saisie de dépenses terrain',
        'Tickets, déplacements et kilométrage depuis le mobile.'
      ),
      funderExport: createCard(
        'Export pour le bailleur',
        'XLSX structuré et pièces regroupées pour préparer la justification.'
      ),
    },
  },
  control: {
    title: 'Contrôle et visibilité',
    subtitle: '',
    cards: {
      dashboard: createCard(
        'Tableau de bord directif',
        "Recettes, dépenses, solde, base sociale et obligations fiscales d'un coup d'œil."
      ),
      smartAlerts: createCard(
        'Alertes intelligentes',
        'Mouvements en attente, données incomplètes, échéances fiscales. Tout priorisé.'
      ),
      boardReport: createCard(
        'Rapport pour le conseil',
        "Générez un rapport avec l'état des comptes, modifiez le texte si besoin, exportez en Excel ou envoyez-le par email directement."
      ),
      dataExport: createCard(
        'Export de données',
        'Excel, CSV, PDF. Par contact, projet ou période.'
      ),
    },
  },
};

const HOME_BLOCKS_PT: PublicTranslations['home']['blocks'] = {
  conciliation: {
    title: 'Reconciliação bancária',
    subtitle: '',
    cards: {
      importStatements: createCard(
        'Importação de extratos',
        'Carrega o ficheiro do banco e em minutos tens todos os movimentos dentro do sistema.'
      ),
      autoClassification: createCard(
        'Categorização assistida',
        'A IA propõe uma categoria para revisão antes da confirmação.'
      ),
      contactAssignment: createCard(
        'Atribuição de contactos',
        'Cada movimento fica ligado ao doador, fornecedor ou trabalhador correspondente.'
      ),
      multiBankAccount: createCard(
        'Multiconta bancária',
        'Se tiverem mais do que uma conta, tudo fica separado e rastreável.'
      ),
    },
  },
  donorsMembers: {
    title: 'Sócios e doadores',
    subtitle: '',
    cards: {
      donorProfile: createCard(
        'Ficha completa com validação fiscal',
        'NIF, código postal, IBAN. O sistema avisa do que falta antes que seja um problema.'
      ),
      bulkImport: createCard(
        'Importação massiva',
        'Tens um Excel com 500 doadores? Importa-os de uma vez.'
      ),
      donorHistory: createCard(
        'Histórico por doador',
        'Todos os donativos, devoluções e certificados numa só ficha.'
      ),
      operationalStatus: createCard(
        'Estados operacionais',
        'Ativo, baixa ou arquivado. Lista limpa sem perder histórico.'
      ),
    },
  },
  payments: {
    title: 'Cobranças e pagamentos',
    subtitle: '',
    cards: {
      remittanceSplitter: createCard(
        'Separador de remessas',
        'O banco envia-te um só lançamento por 200 quotas? Summa separa-as automaticamente.'
      ),
      bankReturns: createCard(
        'Devoluções bancárias',
        'Regista as devoluções e relaciona-as com a quota e a pessoa correspondentes.'
      ),
      sepaPayments: createCard(
        'Remessas SEPA de pagamento',
        'Gera ficheiros SEPA para pagar faturas e ordenados a partir do banco.'
      ),
      stripeDonations: createCard(
        'Doações e histórico',
        'Regista as doações e conserva o histórico económico de cada doador.'
      ),
    },
  },
  fiscal: {
    title: 'Fiscalidade',
    subtitle: '',
    cards: {
      model182: createCard(
        'Modelo 182',
        'Doações anuais preparadas para revisão antes de partilhar com o contabilista.'
      ),
      model347: createCard(
        'Modelo 347',
        'Informação dos fornecedores que ultrapassam o limiar, preparada para revisão.'
      ),
      donationCertificates: createCard(
        'Certificados de doação',
        'PDF individual ou em lote, com envio por email automático.'
      ),
      cleanExcel: createCard(
        'Excel limpo para o contabilista',
        'Informação estruturada para que o contabilista a possa rever.'
      ),
    },
  },
  projects: {
    title: 'Projetos',
    subtitle: '',
    cards: {
      budgetLines: createCard(
        'Orçamento por rubricas',
        'Importa o orçamento desde Excel e faz o seguimento executado vs previsto.'
      ),
      expenseAssignment: createCard(
        'Imputação de despesas',
        'Liga despesas a rubricas, inteiras ou parciais. Com sugestões inteligentes.'
      ),
      fieldCapture: createCard(
        'Captura de despesas de terreno',
        'Tickets, deslocações e quilometragem a partir do telemóvel.'
      ),
      funderExport: createCard(
        'Exportação para o financiador',
        'XLSX estruturado e comprovativos agrupados para preparar a justificação.'
      ),
    },
  },
  control: {
    title: 'Controlo e visibilidade',
    subtitle: '',
    cards: {
      dashboard: createCard(
        'Painel diretivo',
        'Receitas, despesas, saldo, base social e obrigações fiscais de relance.'
      ),
      smartAlerts: createCard(
        'Alertas inteligentes',
        'Movimentos pendentes, dados incompletos, prazos fiscais. Tudo priorizado.'
      ),
      boardReport: createCard(
        'Relatório para direção',
        'Gera um relatório com o estado das contas, edita o texto se necessário, exporta para Excel ou envia por email diretamente.'
      ),
      dataExport: createCard(
        'Exportação de dados',
        'Excel, CSV, PDF. Por contacto, projeto ou período.'
      ),
    },
  },
};

const ca: PublicTranslations = {
  common: {
    appName: 'Summa Social',
    tagline: 'Gestió econòmica i fiscal per a entitats',
    close: 'Tancar',
    back: 'Tornar',
    backToHome: "Tornar a l'inici",
    about: 'Qui som',
    blog: 'Blog',
    menu: 'Menu',
    contact: 'Contacte',
    privacy: 'Privacitat',
    features: 'Funcionalitats',
    enter: 'Entrar',
    email: 'Email',
    lastUpdated: 'Última actualització',
    privacyContact: 'Contacte de privacitat',
  },
  cta: {
    primary: 'Contacta amb nosaltres',
    secondary: 'Explica’ns la teva entitat',
    supporting:
      'Ens agrada entendre primer la realitat de cada entitat abans de proposar res.',
  },
  login: {
    title: 'Accés | Summa Social',
    welcomeTitle: 'Benvingut a Summa Social',
    welcomeDescription:
      'Per accedir al tauler de la teva entitat, utilitza la URL que et van facilitar.',
    urlFormatIntro: "L'adreça té aquest format:",
    urlFormatExample: 'la-teva-entitat',
    urlFormatHelp: "Si no la recordes, demana-la a l'administrador de la teva organització.",
    orElse: 'o bé',
    visitWebsite: 'Visita el web de Summa Social',
    contactUs: 'Contacta amb nosaltres',
    footer: 'Summa Social — Gestió econòmica i fiscal per a entitats',
    sessionExpired: "La teva sessió s'ha tancat per inactivitat.",
  },
  privacy: {
    title: 'Política de Privacitat',
    updatedAt: 'Juliol 2026',
    sections: {
      whoWeAre: {
        title: '1. Qui som',
        intro:
          "Summa Social és una aplicació de gestió financera per a entitats socials que actua com a responsable del tractament de les dades dels usuaris de l'aplicació.",
        responsible:
          "Responsable del tractament (per a dades d'usuaris de l'aplicació): Summa Social",
        processor:
          "Encarregat del tractament (per a dades de les entitats clients): Summa Social actua per compte de cada entitat, que és la responsable de les dades dels seus donants, socis, proveïdors i treballadors.",
      },
      whatData: {
        title: '2. Quines dades tractem',
        appUsersTitle: "2.1 Usuaris de l'aplicació (Summa Social és responsable)",
        appUsersTable: {
          data: 'Dada',
          purpose: 'Finalitat',
          email: 'Email',
          emailPurpose: 'Identificació i accés al compte',
          name: 'Nom',
          namePurpose: 'Personalització de la interfície',
          role: 'Rol',
          rolePurpose: "Control d'accés (Admin, User, Viewer)",
          organizations: 'Organitzacions',
          organizationsPurpose: 'Gestió multi-organització',
        },
        appUsersNote:
          "Les credencials d'accés (contrasenyes) són gestionades per Firebase Authentication i no són accessibles per Summa Social.",
        entityDataTitle: '2.2 Dades de les entitats (Summa Social és encarregat)',
        entityDataIntro:
          'Summa Social tracta les següents dades per compte de les entitats clients:',
        entityDataItems: [
          'Donants i socis: nom, NIF, IBAN, adreça, email, telèfon',
          'Proveïdors: nom, NIF, dades de contacte',
          'Treballadors: nom, NIF, dades laborals',
          'Moviments bancaris: data, import, concepte, categoria',
        ],
        entityDataNote:
          "La base legal i el deure d'informar els interessats (donants, socis, etc.) correspon a cada entitat com a responsable del tractament.",
        entityDataSensitive:
          "Summa Social no tracta dades de categories especials segons l'Art. 9 del RGPD.",
      },
      legalBasis: {
        title: '3. Base legal del tractament',
        table: {
          treatment: 'Tractament',
          basis: 'Base legal',
          appUsers: "Usuaris de l'aplicació",
          appUsersBasis: 'Execució del contracte de servei (Art. 6.1.b RGPD)',
          entityData: 'Dades de les entitats',
          entityDataBasis: 'Segons instruccions del responsable (entitat)',
        },
      },
      recipients: {
        title: '4. Destinataris de les dades',
        subprocessorsTitle: '4.1 Subencarregats',
        subprocessorsIntro:
          "Summa Social utilitza els següents serveis de Google/Firebase per al funcionament de l'aplicació:",
        table: {
          service: 'Servei',
          location: 'Ubicació',
          guarantees: 'Garanties',
        },
        services: {
          auth: {
            name: 'Firebase Authentication',
            location: 'EUA',
            guarantees: 'Clàusules Contractuals Tipus (SCC) + Marc UE-EUA',
          },
          firestore: {
            name: 'Firebase Firestore',
            location: 'UE (eur3)',
            guarantees: "Dades dins l'Espai Econòmic Europeu",
          },
          storage: {
            name: 'Firebase Storage',
            location: 'UE (eur3)',
            guarantees: "Dades dins l'Espai Econòmic Europeu",
          },
          hosting: {
            name: 'Firebase Hosting',
            location: 'Global (CDN)',
            guarantees: 'Només assets i aplicació web',
          },
        },
        legalObligationsTitle: '4.2 Cessions per obligació legal',
        legalObligationsIntro: 'Les entitats clients poden cedir dades a:',
        legalObligationsItems: [
          'Agència Tributària: Model 182 (donatius), Model 347 (operacions amb tercers)',
          'Entitats bancàries: Gestió de remeses i rebuts',
        ],
        legalObligationsNote: 'Aquestes cessions són responsabilitat de cada entitat.',
      },
      retention: {
        title: '5. Conservació de les dades',
        table: {
          dataType: 'Tipus de dada',
          period: 'Termini',
        },
        items: {
          appUsers: {
            type: "Usuaris de l'aplicació",
            period: 'Mentre el compte estigui actiu + 12 mesos',
          },
          fiscalData: {
            type: 'Dades fiscals (entitats)',
            period: 'Mínim 6 anys (obligacions mercantils i comptables)',
          },
          otherData: {
            type: 'Altres dades de contactes',
            period: 'Segons política del responsable (entitat)',
          },
        },
        note: 'Les còpies de seguretat es conserven durant períodes limitats i es gestionen segons les mesures descrites al document intern de seguretat.',
      },
      rights: {
        title: '6. Els teus drets',
        intro: 'Com a interessat, tens dret a:',
        rightsList: {
          access: {
            name: 'Accés',
            description: "Sol·licitar una còpia de les teves dades",
          },
          rectification: {
            name: 'Rectificació',
            description: 'Corregir dades inexactes',
          },
          erasure: {
            name: 'Supressió',
            description: "Sol·licitar l'eliminació de les teves dades",
          },
          objection: {
            name: 'Oposició',
            description: "Oposar-te a determinats tractaments",
          },
          restriction: {
            name: 'Limitació',
            description: 'Sol·licitar la restricció del tractament',
          },
          portability: {
            name: 'Portabilitat',
            description: 'Rebre les teves dades en format estructurat',
          },
        },
        howToExerciseTitle: 'Com exercir els teus drets',
        howToExerciseAppUsers: "Usuaris de l'aplicació: Escriu a",
        howToExerciseOthers:
          "Donants, socis o altres interessats d'una entitat: Contacta directament amb l'entitat corresponent. Summa Social assistirà l'entitat en la gestió de la teva sol·licitud.",
        responseTime: 'Termini de resposta: 1 mes (ampliable a 2 en casos complexos).',
        complaint:
          'Si consideres que els teus drets no han estat atesos correctament, pots presentar una reclamació davant l\'',
        complaintLink: "Agència Espanyola de Protecció de Dades (AEPD)",
      },
      security: {
        title: '7. Seguretat',
        intro:
          'Summa Social implementa mesures tècniques i organitzatives per protegir les dades:',
        measures: [
          'Xifratge en trànsit (HTTPS/TLS)',
          'Xifratge en repòs (infraestructura Google)',
          "Control d'accés per rols",
          'Aïllament de dades entre organitzacions',
          'Gestió de sessions amb caducitat i mecanismes de tancament de sessió',
        ],
      },
      changes: {
        title: '8. Canvis en aquesta política',
        content:
          "Qualsevol modificació d'aquesta política es comunicarà als usuaris a través de l'aplicació. La data d'\"Última actualització\" reflecteix la versió vigent.",
      },
      contact: {
        title: '9. Contacte',
        intro: 'Per a qualsevol qüestió relacionada amb la privacitat:',
        emailLabel: 'Email',
        responsibleLabel: 'Responsable intern',
        responsibleValue: 'Summa Social',
        holderLabel: 'Titular del servei',
        holderValue: 'Summa Social (Espanya)',
        dpoNote:
          "Delegat de Protecció de Dades (DPD/DPO): no aplicable (Summa Social no està obligada a designar DPD segons l'Art. 37 RGPD).",
      },
    },
  },
  contact: {
    title: 'Expliqueu-nos una mica la vostra entitat i us direm com començar.',
    subtitle: 'Revisarem quin pla encaixa millor i quin acompanyament inicial necessiteu.',
    description:
      'Abans d’activar cap quota mensual, us confirmarem el pla, l’import inicial i els primers passos.',
    responseTime: 'Respondrem tan aviat com sigui possible.',
    directEmailLabel: 'Correu directe',
    form: {
      nameLabel: 'Nom',
      emailLabel: 'Correu electrònic',
      organizationLabel: 'Entitat',
      messageLabel: 'Missatge',
      submit: 'Enviar contacte',
      sending: 'Enviant missatge...',
      success: 'Missatge enviat. Et respondrem tan aviat com sigui possible.',
      error: "No hem pogut enviar el missatge ara mateix. Torna-ho a provar d'aquí una estona o escriu-nos al correu directe.",
      invalidName: 'Escriu un nom vàlid.',
      invalidEmail: 'Escriu un correu electrònic vàlid.',
      invalidMessage: 'El missatge ha de tenir almenys 10 caràcters.',
      helper: 'Revisarem quin pla encaixa millor, quin acompanyament inicial necessiteu i quin seria l’import inicial abans d’activar cap quota mensual.',
      messagePlaceholder:
        'Expliqueu-nos breument quants socis o donants teniu, si feu remeses, si voleu importar moviments bancaris o si necessiteu preparar models fiscals.',
      planMessages: {
        control: 'Vull començar amb el pla Control.',
        management: 'Vull començar amb el pla Gestió.',
        complete: 'Voldria parlar del pla Complet.',
      },
    },
  },
  pricing: {
    navLabel: 'Preus',
    metaTitle: 'Preus | Summa Social',
    metaDescription:
      'Plans de Summa Social des de 49 €/mes per controlar banc, socis i donacions, vincular documents i gestionar projectes.',
    title: 'Trieu fins on voleu portar el control econòmic de la vostra entitat',
    subtitle:
      'Tots els plans permeten importar el banc i gestionar socis, quotes i donacions. Afegiu-hi documentació o projectes quan la gestió ho necessiti.',
    claim: 'Plans des de 49 €/mes.',
    orientationTitle: 'Trieu el pla segons la complexitat de la gestió',
    orientationText: 'La diferència no és la mida de l’entitat, sinó fins on voleu centralitzar la gestió.',
    orientationPoints: [
      'Control: banc, socis, quotes i donacions',
      'Gestió: documents vinculats als moviments',
      'Complet: tancament, projectes i pressupostos',
    ],
    implantationTitle: 'Implantació inicial',
    implantationText:
      'Abans de treballar bé, cal ordenar les dades de partida: contactes, extractes, categories, remeses i criteris fiscals. Per això Summa Social inclou una implantació inicial pressupostada segons el cas.',
    implantationPrice: 'A partir de 300 €',
    implantationSubtext:
      "L'import final depèn de l'estat de les dades, el volum de contactes i la complexitat de l'entitat.",
    implantationNoteTitle: 'Abans de començar, revisem el vostre cas.',
    implantationNoteText:
      "La implantació inicial es pressuposta segons el volum de dades i l’acompanyament necessari. No pagareu cap quota mensual fins que hàgim acordat el pla, l’import inicial i els primers passos.",
    decisionTitle: 'Si dubteu, us ajudem a triar sense sobredimensionar el pla',
    decisionText: 'Revisarem com gestioneu el banc, la documentació i els projectes abans de recomanar-vos cap opció.',
    cta: 'Parlem del vostre cas',
    plans: [
      {
        id: 'control',
        name: 'Control',
        price: '49 €/mes',
        badge: 'Control essencial',
        cta: 'Vull controlar banc i donacions',
        description:
          'Per a entitats que conserven la documentació fora de Summa, però volen tenir sota control els moviments, els socis i les donacions.',
        features: [
          'Importació i revisió d’extractes bancaris',
          'Alta i edició manual de moviments',
          'Socis, donants i contactes',
          'Quotes i remeses SEPA',
          'Gestió manual de devolucions',
          'Certificats de donació',
          'Preparació del Model 182, subjecta a revisió',
        ],
        limit: 'No inclou pujar ni vincular documents als moviments.',
      },
      {
        id: 'management',
        name: 'Gestió',
        price: '79 €/mes',
        badge: 'Recomanat',
        cta: 'Vull començar amb Gestió',
        recommended: true,
        description: 'Per a entitats que volen centralitzar factures, nòmines, tiquets i justificants i relacionar-los amb els moviments bancaris.',
        features: [
          'Tot el pla Control',
          'Pujada i vinculació de documents als moviments',
          'Control dels moviments sense document',
          'Categorització assistida amb IA',
          'Preparació del Model 347',
        ],
      },
      {
        id: 'complete',
        name: 'Complet',
        price: '119 €/mes',
        badge: 'Tancament i projectes',
        cta: 'Vull gestionar projectes i tancaments',
        description:
          'Per a entitats que volen preparar el tancament econòmic i gestionar pressupostos, despeses i justificacions de projectes.',
        features: [
          'Tot el pla Gestió',
          'Gestió completa de projectes o subvencions',
          'Control de la imputació de despeses entre projectes',
          'Multidivisa dins dels projectes',
          'XLSX estructurat per preparar la justificació econòmica',
          'Safata de documents previs o pendents de vincular',
          'Propostes de conciliació assistida de documents',
          'Captura de tiquets i extracció assistida de dades',
          'Paquet de tancament amb moviments i documents',
        ],
      },
    ],
    comparisonTitle: 'Compareu els tres plans',
    comparisonDescription: 'El banc és comú a tots els plans. Gestió afegeix la documentació i Complet, el tancament i els projectes.',
    comparisonFeatureLabel: 'Funcionalitat',
    comparisonIncludedLabel: 'Inclòs',
    comparisonNotIncludedLabel: 'No inclòs',
    comparisonRows: [
      { feature: 'Importació i revisió bancària', control: true, management: true, complete: true },
      { feature: 'Socis, donants, SEPA, devolucions manuals, certificats i Model 182', control: true, management: true, complete: true },
      { feature: 'Documents vinculats als moviments', control: false, management: true, complete: true },
      { feature: 'Control sense document, IA assistida i Model 347', control: false, management: true, complete: true },
      { feature: 'Safata prèvia, OCR i paquet de tancament', control: false, management: false, complete: true },
      { feature: 'Projectes, pressupostos, multidivisa en projectes i XLSX estructurat', control: false, management: false, complete: true },
    ],
    faqTitle: 'Preguntes freqüents sobre els plans',
    faqItems: [
      { question: 'El pla Control permet importar el banc?', answer: 'Sí. La importació i revisió d’extractes bancaris està inclosa en tots els plans.' },
      { question: 'Quina és la diferència principal entre Control i Gestió?', answer: 'Control permet treballar els moviments bancaris, però no afegir-hi documentació. Gestió permet pujar i vincular factures, nòmines, tiquets i altres justificants.' },
      { question: 'Summa presenta els models fiscals?', answer: 'No. Summa prepara la informació i els fitxers perquè l’entitat o la seva assessoria els revisi i presenti.' },
      { question: 'Summa substitueix la gestoria?', answer: 'No. Ordena i prepara la informació econòmica perquè l’entitat i la gestoria treballin amb més control.' },
      { question: 'Què passa si baixo a un pla inferior?', answer: 'Les dades i els documents existents es conserven. Els podreu consultar i descarregar, però deixareu de poder crear o modificar els elements reservats al pla anterior.' },
    ],
  },
  home: {
    metaTitle: 'Summa Social | Gestió econòmica per a entitats',
    metaDescription:
      "Gestió econòmica i fiscal per a entitats socials petites i mitjanes d'Espanya. Conciliació bancària, Model 182/347, remeses SEPA i més.",
    skipToContent: 'Saltar al contingut',
    heroTagline: 'Controla donacions, quotes i informes fiscals de la teva entitat',
    hero: {
      visualAlt: 'Captura de pantalla de Summa Social',
      bridgeLine: "Programari per gestió econòmica d'entitats",
    },
    nav: {
      conciliation: 'Conciliació',
      remittances: 'Remeses i devolucions',
      onlineDonations: 'Donacions i donants',
      fiscalCertificates: 'Fiscalitat i certificats',
      invoicesSepa: 'Factures i SEPA',
      ticketsSettlements: 'Tiquets i liquidacions',
      projects: 'Projectes',
    },
    solves: {
      title: 'Què resol Summa Social?',
      introLead:
        'Summa Social porta ordre, control i tranquil·litat a la gestió econòmica de les entitats d\'acció social i de cooperació.',
      introDetail:
        'Aprofita el potencial de la IA per conciliar extractes, quotes de socis, models fiscals (182 i 347) i projectes.',
      aiBadge: 'IA',
      conciliation:
        "Conciliació bancària més àgil: importa l'extracte, centralitza els moviments i revisa'n la classificació amb menys feina de transcripció manual. La intel·ligència artificial ajuda a identificar proveïdors, socis i donants.",
      fiscal:
        "Informació fiscal més ordenada: prepara els Models 182 i 347 i els certificats de donació a partir de les dades registrades. Revisa el resultat abans de compartir-lo amb la gestoria o presentar-lo a l'AEAT.",
      remittances:
        'Remeses de quotes i pagaments amb un procés guiat: revisa les remeses agrupades del banc i prepara fitxers SEPA per a pagaments a proveïdors i nòmines amb més control abans d’enviar-los.',
      vision:
        "Visió clara i actualitzada: Dashboard amb mètriques en temps real. Ingressos, despeses, balanç i alertes, tot visible d'un cop d'ull. Informes automàtics per a junta o patronat.",
      control:
        "Traçabilitat de cada moviment: relaciona el comprovant amb el moviment bancari i obtén un XLSX estructurat amb els comprovants agrupats per preparar la justificació.",
      result:
        "El resultat: més temps per a la missió de l'entitat, menys temps amb fulls de càlcul i tasques repetitives. Gestió econòmica professional, accessible i sense complicacions.",
    },
    sections: {
      conciliation: {
        title: 'Conciliació bancària assistida i seguiment de comptes',
        description:
          "Quan s'importa l'extracte bancari, Summa Social centralitza els moviments i ajuda a relacionar-los amb la documentació, els pagaments i les remeses existents perquè l'entitat pugui revisar i confirmar el resultat.",
      },
      remittances: {
        title: 'Gestió completa de remeses de socis i devolucions',
        description:
          "Quan l'entitat rep una remesa agrupada del banc —per quotes de socis o aportacions periòdiques— Summa Social permet desglossar aquest ingrés i situar cada import en el seu lloc. La remesa deixa de ser una xifra única i passa a convertir-se en el detall necessari per saber qui ha aportat què i en quin moment.",
      },
      onlineDonations: {
        title: 'Registre i control de donacions',
        description:
          "Summa Social permet registrar les donacions, relacionar-les amb cada persona i mantenir l'historial econòmic i fiscal ordenat dins del mateix sistema.",
      },
      fiscalCertificates: {
        title:
          'Preparació de models fiscals (182 i 347) i certificats de donació',
        description:
          "A mesura que la informació econòmica s'ha anat treballant amb criteri —ingressos, despeses, remeses i devolucions— Summa Social prepara els models fiscals i els certificats a partir de les dades ordenades perquè es revisin abans de presentar-los o compartir-los.",
      },
      invoicesSepa: {
        title:
          'Lectura ràpida assistida amb IA de factures, nòmines i elaboració de remeses de pagaments SEPA',
        description:
          "Summa Social permet incorporar al sistema la documentació econòmica que es genera en el dia a dia de l'entitat —factures, nòmines i altres documents— simplement arrossegant els fitxers. Les dades rellevants s'extreuen de manera intel·ligent i passen a formar part del flux administratiu, amb criteri i context des del primer moment.",
      },
      ticketsSettlements: {
        title:
          "Captura de rebuts i tiquets amb extracció assistida de dades",
        description:
          "Quan l'equip de l'entitat fa desplaçaments, viatges o activitats fora de l'oficina, Summa Social permet capturar de manera immediata els rebuts i tiquets que es van generant. Una simple fotografia des del mòbil és suficient perquè aquests comprovants quedin registrats dins del sistema, associats a la persona i al context en què s'han produït.",
      },
      projects: {
        title: 'Mòdul de Projectes opcional: execució pressupostària i assistent de justificacions',
        description:
          "Quan l'entitat treballa amb projectes, la gestió econòmica requereix una lectura diferent: no només què s'ha pagat, sinó a quin projecte correspon cada despesa i com s'està executant el pressupost aprovat.",
      },
    },
    readMore: 'Llegir més →',
    stats: {
      entities: '15+',
      entitiesLabel: 'entitats actives',
      movements: '2.000+',
      movementsLabel: 'moviments/mes',
      countries: '5',
      countriesLabel: 'països',
    },
    workflow: {
      title: 'Com funciona',
      lead: "De l'extracte bancari a l'informe fiscal, tot en el mateix sistema.",
      step1: {
        title: 'Connecta',
        description: 'Importa extractes, factures, nòmines i tiquets en segons. Summa posa cada dada al seu lloc des del primer moment.',
      },
      step2: {
        title: 'Gestiona',
        description: 'Controla remeses de socis i devolucions bancàries. Revisa propostes de categorització i relaciona moviments amb contactes i documents.',
      },
      step3: {
        title: 'Compleix',
        description: "Prepara els Models 182 i 347 i els certificats de donació per revisar. En el pla Complet, controla també l'execució econòmica i la multidivisa dins dels projectes.",
      },
      step4: {
        title: 'Obté',
        description:
          'Obté informes automàtics per a juntes i patronats amb dades reals actualitzades. Prepara remeses SEPA, fulls de liquidació i llistats ordenats de despeses i factures per a fiscalitat i justificacions.',
      },
    },
    systemOverview: {
      title: 'Què pots fer amb Summa Social',
      subtitle: '',
    },
    capabilities: {
      title: 'Què pots fer amb Summa Social',
      conciliation: {
        title: 'Conciliació bancària',
        description: 'Importa extractes i revisa les propostes per relacionar moviments i documentació.',
      },
      remittances: {
        title: 'Remeses i devolucions',
        description: 'Divideix remeses agrupades i gestiona devolucions amb traçabilitat.',
      },
      donations: {
        title: 'Donacions i donants',
        description: 'Registra donacions i mantén cada aportació relacionada amb el seu donant.',
      },
      fiscal: {
        title: 'Fiscalitat i certificats',
        description: 'Models 182 i 347 i certificats de donació preparats per revisar.',
      },
    },
    blocks: HOME_BLOCKS_CA,
    profiles: {
      admin: {
        title: 'Per a administradors i tresoreria',
        description:
          'Conciliació, remeses i fiscalitat: cada peça en el seu lloc, sense reconstruir res a posteriori.',
      },
      projects: {
        title: 'Per a gestors de projectes',
        description: "Seguiment pressupostari, imputació de despeses i XLSX estructurat amb documentació agrupada per preparar la justificació.",
      },
    },
    whoWeAre: {
      title: 'Qui som',
      lead: 'Summa Social neix de la gestió real de les entitats.',
      description:
        'És una aplicació desenvolupada dins l’ecosistema de Semilla de Software Libre, a partir d’experiència directa amb organitzacions socials, gestió econòmica, donants, subvencions i justificacions.',
      status: 'Origen i trajectòria',
    },
    howWeWork: {
      title: 'Com treballem',
      lead: "Abans d'activar Summa Social per a la vostra entitat, valorem conjuntament si encaixa amb la vostra manera de treballar i quins són els vostres objectius, per garantir una adopció pràctica i útil.",
      paragraph1: 'Si veiem que us pot servir, us acompanyem en la posada en marxa fins que l’eina estigui operativa i sigui còmoda en el dia a dia.',
      paragraph2: "El nostre suport està orientat a resoldre dubtes concrets i assegurar estabilitat en l'ús.",
      note: "Treballem amb un nombre limitat d'entitats per mantenir la qualitat de l'acompanyament i preservar criteri professional.",
      cta: 'Parlem del vostre cas',
      imageAlt: 'Il·lustració del procés de treball de Summa Social',
    },
    finalCta: {
      title: 'Vols ordenar la gestió econòmica de la teva entitat?',
      subtitle:
        'Explica’ns com treballeu avui i veurem si Summa Social us pot ajudar a reduir Excel, revisions manuals i duplicitats.',
      cta: 'Entrar',
    },
  },
  features: {
    metaTitle: 'Summa Social | Funcionalitats',
    metaDescription:
      "Gestió econòmica i fiscal per a entitats socials petites i mitjanes d'Espanya. Conciliació bancària, Model 182/347, remeses SEPA i més.",
    back: 'Tornar',
    intro: {
      title: 'Summa Social',
      subtitle:
        "Gestió econòmica i fiscal per a entitats petites i mitjanes d'Espanya, amb conciliació bancària i exports per a la gestoria (Model 182 i 347).",
      tagline:
        'Summa Social porta ordre, control i tranquil·litat a la gestió econòmica de les entitats d\'acció social i de cooperació.',
    },
    mainTitle: '15 Principals Funcionalitats de Summa Social',
    list: {
      conciliation: {
        title: '1. Conciliació Bancària Assistida',
        description:
          "Importes l'extracte del banc, Summa Social detecta possibles duplicats i et permet revisar i relacionar els moviments amb les operacions registrades. Tot queda traçable per compte bancari.",
        bullets: [
          "Importació d'extractes (CSV, Excel, OFX) de qualsevol banc",
          'Detecció automàtica de duplicats',
          'Suport multi-compte amb trazabilitat completa',
          "Visió clara de l'estat de cada compte",
        ],
      },
      aiAssignment: {
        title: '2. Propostes de Categorització amb IA',
        description:
          "Quan importes moviments, Summa Social proposa proveïdors, socis, donants, treballadors i categories a partir de les dades disponibles perquè ho puguis revisar abans de confirmar.",
        bullets: [
          'Propostes per nom, IBAN o DNI',
          'Proposta de categoria per revisar',
          'Memòria de decisions anteriors',
          'Assistència amb IA quan cal',
        ],
      },
      remittancesDivider: {
        title: '3. Divisor de Remeses IN (Quotes de Socis)',
        description:
          "Quan el banc t'ingressa una remesa agrupada de les quotes que els socis paguen, Summa Social la desglossa automàticament assignant cada import al soci corresponent.",
        bullets: [
          'Descomposició automàtica per IBAN/DNI/Nom',
          'Detecció de quotes impagades i remeses parcials',
          'Assignació individual amb historial complet',
          'Visió clara de qui està al corrent i qui no',
        ],
      },
      expensesSepa: {
        title: '4. Gestor de Despeses i Nòmines amb Generador de Remeses SEPA',
        description:
          "Arrossega factures i nòmines a Summa Social, revisa les dades extretes amb assistència d'IA i genera una remesa de pagaments per pujar al banc.",
        ticketsNote:
          'Novetat: captura de tiquets, viatges i quilometratge amb liquidacions en PDF regenerable.',
        bullets: [
          'Remeses de pagament (SEPA) per factures i nòmines',
          'Extracció assistida de dades amb IA',
          'Liquidacions de tiquets, viatges i quilometratge amb PDF regenerable',
          'Enllaç clar document ↔ pagament ↔ moviment bancari',
          "Quan entra l'extracte: revisió i vinculació amb el moviment",
        ],
      },
      fiscal: {
        title: '5. Preparació Fiscal (Model 182 i 347)',
        description:
          'Prepara els fitxers fiscals i les validacions perquè l’entitat o la gestoria els revisi abans de presentar-los.',
        bullets: [
          'Model 182 amb validació de requisits legals',
          'Preparació del Model 347',
          'Comprovació de CIF/DNI/NIE i dades postals',
          'Exportació Excel per a la gestoria',
        ],
      },
      donationCertificates: {
        title: '6. Certificats de Donació',
        bullets: [
          'Generació PDF amb logo i signatura digital',
          'Enviament individual o massiu per email',
          "Control complet d'enviaments",
          'Compliment LOPDGDD automàtic',
        ],
      },
      movementClassification: {
        title: '7. Classificació de Moviments amb Memòria',
        bullets: [
          'Categories comptables personalitzables',
          'Propostes de categorització amb IA',
          'Memòria persistent',
          'Assignació massiva per lots',
        ],
      },
      dashboard: {
        title: '8. Dashboard Directiu amb Mètriques en Temps Real',
        bullets: [
          'Indicadors clau sempre visibles',
          'Filtres per període',
          'Alertes prioritzades',
          "Gràfics d'evolució",
          "Export PDF d'informes per a junta/patronat",
        ],
      },
      multiContact: {
        title: '9. Gestió Multi-contacte amb Tipologies',
        bullets: [
          'Donants, socis, proveïdors, treballadors i contraparts',
          'Validació automàtica de CIF/DNI/NIE i IBANs',
          'Importació massiva amb mapping flexible',
          'Estats operatius',
        ],
      },
      bankReturns: {
        title: '10. Gestió de Devolucions Bancàries',
        bullets: [
          'Importador específic de devolucions',
          'Vinculació manual amb el donant',
          'Seguiment de quotes pendents',
          'Retorn reflectit en la preparació del Model 182',
        ],
      },
      stripeIntegration: {
        title: '11. Registre i Històric de Donacions',
        bullets: [
          'Registre individual de donacions',
          'Vinculació amb la fitxa del donant',
          'Històric econòmic i fiscal',
          'Traçabilitat de cada aportació',
        ],
      },
      projectsModule: {
        title: '12. Mòdul de Projectes i Subvencions',
        bullets: [
          'Execució vs pressupostat',
          'Assignació parcial de despeses',
          'Captura fotogràfica de despeses de terreny',
          'Export justificació (Excel + ZIP)',
          'Gestió multi-moneda',
        ],
      },
      multiOrg: {
        title: '13. Arquitectura Multi-organització amb Seguretat Europea',
        bullets: [
          'Aïllament total de dades',
          'Rols i permisos',
          'Compliment RGPD/LOPDGDD',
          'Servidors UE',
        ],
      },
      exports: {
        title: '14. Exportació de Dades i Informes',
        bullets: [
          'Excel, CSV i PDF',
          'Models oficials AEAT',
          'Exports per contacte, projecte o període',
        ],
      },
      alerts: {
        title: "15. Sistema d'Alertes Intel·ligent",
        bullets: ['Alertes crítiques i informatives', 'Enllaços directes a resolució', 'Priorització automàtica'],
      },
    },
    cta: 'Entrar a Summa Social',
  },
  updates: {
    metaTitle: 'Novetats de Summa Social | Millores del producte',
    metaDescription:
      'Consulta les noves funcionalitats i millores de Summa Social per gestionar l’economia, la fiscalitat i els projectes de la teva entitat.',
    navLabel: 'Novetats',
    title: 'Novetats de Summa Social',
    back: 'Tornar',
    noUpdates: 'No hi ha novetats publicades.',
    readMore: 'Llegir més',
    viewAll: 'Veure totes les novetats',
    publishedAt: 'Publicat el',
    latestLabel: 'Nou a Summa',
    latestTitle: 'L’última millora publicada',
    latestDescription:
      'Aquí expliquem què hem millorat, què pots fer ara i on ho notaràs. Una cronologia pública de com Summa Social evoluciona amb les necessitats reals de les entitats.',
  },
  about: {
    metaTitle: 'Qui som | Summa Social',
    metaDescription:
      "Coneix millor què és Summa Social i per què estem construint una eina de gestió econòmica i fiscal per a entitats d'acció social i cooperació.",
  },
};

const es: PublicTranslations = {
  common: {
    appName: 'Summa Social',
    tagline: 'Gestión económica y fiscal para entidades',
    close: 'Cerrar',
    back: 'Volver',
    backToHome: 'Volver al inicio',
    about: 'Quiénes somos',
    blog: 'Blog',
    menu: 'Menú',
    contact: 'Contacto',
    privacy: 'Privacidad',
    features: 'Funcionalidades',
    enter: 'Entrar',
    email: 'Email',
    lastUpdated: 'Última actualización',
    privacyContact: 'Contacto de privacidad',
  },
  cta: {
    primary: 'Contacta con nosotros',
    secondary: 'Cuéntanos sobre tu entidad',
    supporting:
      'Nos gusta entender primero la realidad de cada entidad antes de proponer nada.',
  },
  login: {
    title: 'Acceso | Summa Social',
    welcomeTitle: 'Bienvenido a Summa Social',
    welcomeDescription:
      'Para acceder al panel de tu entidad, utiliza la URL que te facilitaron.',
    urlFormatIntro: 'La dirección tiene este formato:',
    urlFormatExample: 'tu-entidad',
    urlFormatHelp: 'Si no la recuerdas, pídela al administrador de tu organización.',
    orElse: 'o bien',
    visitWebsite: 'Visita la web de Summa Social',
    contactUs: 'Contacta con nosotros',
    footer: 'Summa Social — Gestión económica y fiscal para entidades',
    sessionExpired: 'Tu sesión se ha cerrado por inactividad.',
  },
  privacy: {
    title: 'Política de Privacidad',
    updatedAt: 'Julio 2026',
    sections: {
      whoWeAre: {
        title: '1. Quiénes somos',
        intro:
          'Summa Social es una aplicación de gestión financiera para entidades sociales que actúa como responsable del tratamiento de los datos de los usuarios de la aplicación.',
        responsible:
          'Responsable del tratamiento (para datos de usuarios de la aplicación): Summa Social',
        processor:
          'Encargado del tratamiento (para datos de las entidades clientes): Summa Social actúa por cuenta de cada entidad, que es la responsable de los datos de sus donantes, socios, proveedores y trabajadores.',
      },
      whatData: {
        title: '2. Qué datos tratamos',
        appUsersTitle: '2.1 Usuarios de la aplicación (Summa Social es responsable)',
        appUsersTable: {
          data: 'Dato',
          purpose: 'Finalidad',
          email: 'Email',
          emailPurpose: 'Identificación y acceso a la cuenta',
          name: 'Nombre',
          namePurpose: 'Personalización de la interfaz',
          role: 'Rol',
          rolePurpose: 'Control de acceso (Admin, User, Viewer)',
          organizations: 'Organizaciones',
          organizationsPurpose: 'Gestión multi-organización',
        },
        appUsersNote:
          'Las credenciales de acceso (contraseñas) son gestionadas por Firebase Authentication y no son accesibles por Summa Social.',
        entityDataTitle: '2.2 Datos de las entidades (Summa Social es encargado)',
        entityDataIntro:
          'Summa Social trata los siguientes datos por cuenta de las entidades clientes:',
        entityDataItems: [
          'Donantes y socios: nombre, NIF, IBAN, dirección, email, teléfono',
          'Proveedores: nombre, NIF, datos de contacto',
          'Trabajadores: nombre, NIF, datos laborales',
          'Movimientos bancarios: fecha, importe, concepto, categoría',
        ],
        entityDataNote:
          'La base legal y el deber de informar a los interesados (donantes, socios, etc.) corresponde a cada entidad como responsable del tratamiento.',
        entityDataSensitive:
          'Summa Social no trata datos de categorías especiales según el Art. 9 del RGPD.',
      },
      legalBasis: {
        title: '3. Base legal del tratamiento',
        table: {
          treatment: 'Tratamiento',
          basis: 'Base legal',
          appUsers: 'Usuarios de la aplicación',
          appUsersBasis: 'Ejecución del contrato de servicio (Art. 6.1.b RGPD)',
          entityData: 'Datos de las entidades',
          entityDataBasis: 'Según instrucciones del responsable (entidad)',
        },
      },
      recipients: {
        title: '4. Destinatarios de los datos',
        subprocessorsTitle: '4.1 Subencargados',
        subprocessorsIntro:
          'Summa Social utiliza los siguientes servicios de Google/Firebase para el funcionamiento de la aplicación:',
        table: {
          service: 'Servicio',
          location: 'Ubicación',
          guarantees: 'Garantías',
        },
        services: {
          auth: {
            name: 'Firebase Authentication',
            location: 'EE.UU.',
            guarantees: 'Cláusulas Contractuales Tipo (SCC) + Marco UE-EE.UU.',
          },
          firestore: {
            name: 'Firebase Firestore',
            location: 'UE (eur3)',
            guarantees: 'Datos dentro del Espacio Económico Europeo',
          },
          storage: {
            name: 'Firebase Storage',
            location: 'UE (eur3)',
            guarantees: 'Datos dentro del Espacio Económico Europeo',
          },
          hosting: {
            name: 'Firebase Hosting',
            location: 'Global (CDN)',
            guarantees: 'Solo assets y aplicación web',
          },
        },
        legalObligationsTitle: '4.2 Cesiones por obligación legal',
        legalObligationsIntro: 'Las entidades clientes pueden ceder datos a:',
        legalObligationsItems: [
          'Agencia Tributaria: Modelo 182 (donativos), Modelo 347 (operaciones con terceros)',
          'Entidades bancarias: Gestión de remesas y recibos',
        ],
        legalObligationsNote: 'Estas cesiones son responsabilidad de cada entidad.',
      },
      retention: {
        title: '5. Conservación de los datos',
        table: {
          dataType: 'Tipo de dato',
          period: 'Plazo',
        },
        items: {
          appUsers: {
            type: 'Usuarios de la aplicación',
            period: 'Mientras la cuenta esté activa + 12 meses',
          },
          fiscalData: {
            type: 'Datos fiscales (entidades)',
            period: 'Mínimo 6 años (obligaciones mercantiles y contables)',
          },
          otherData: {
            type: 'Otros datos de contactos',
            period: 'Según política del responsable (entidad)',
          },
        },
        note: 'Las copias de seguridad se conservan durante períodos limitados y se gestionan según las medidas descritas en el documento interno de seguridad.',
      },
      rights: {
        title: '6. Tus derechos',
        intro: 'Como interesado, tienes derecho a:',
        rightsList: {
          access: {
            name: 'Acceso',
            description: 'Solicitar una copia de tus datos',
          },
          rectification: {
            name: 'Rectificación',
            description: 'Corregir datos inexactos',
          },
          erasure: {
            name: 'Supresión',
            description: 'Solicitar la eliminación de tus datos',
          },
          objection: {
            name: 'Oposición',
            description: 'Oponerte a determinados tratamientos',
          },
          restriction: {
            name: 'Limitación',
            description: 'Solicitar la restricción del tratamiento',
          },
          portability: {
            name: 'Portabilidad',
            description: 'Recibir tus datos en formato estructurado',
          },
        },
        howToExerciseTitle: 'Cómo ejercer tus derechos',
        howToExerciseAppUsers: 'Usuarios de la aplicación: Escribe a',
        howToExerciseOthers:
          'Donantes, socios u otros interesados de una entidad: Contacta directamente con la entidad correspondiente. Summa Social asistirá a la entidad en la gestión de tu solicitud.',
        responseTime: 'Plazo de respuesta: 1 mes (ampliable a 2 en casos complejos).',
        complaint:
          'Si consideras que tus derechos no han sido atendidos correctamente, puedes presentar una reclamación ante la ',
        complaintLink: 'Agencia Española de Protección de Datos (AEPD)',
      },
      security: {
        title: '7. Seguridad',
        intro:
          'Summa Social implementa medidas técnicas y organizativas para proteger los datos:',
        measures: [
          'Cifrado en tránsito (HTTPS/TLS)',
          'Cifrado en reposo (infraestructura Google)',
          'Control de acceso por roles',
          'Aislamiento de datos entre organizaciones',
          'Gestión de sesiones con caducidad y mecanismos de cierre de sesión',
        ],
      },
      changes: {
        title: '8. Cambios en esta política',
        content:
          'Cualquier modificación de esta política se comunicará a los usuarios a través de la aplicación. La fecha de "Última actualización" refleja la versión vigente.',
      },
      contact: {
        title: '9. Contacto',
        intro: 'Para cualquier cuestión relacionada con la privacidad:',
        emailLabel: 'Email',
        responsibleLabel: 'Responsable interno',
        responsibleValue: 'Summa Social',
        holderLabel: 'Titular del servicio',
        holderValue: 'Summa Social (España)',
        dpoNote:
          'Delegado de Protección de Datos (DPD/DPO): no aplicable (Summa Social no está obligada a designar DPD según el Art. 37 RGPD).',
      },
    },
  },
  contact: {
    title: 'Cuéntanos un poco sobre vuestra entidad y os diremos cómo empezar.',
    subtitle: 'Revisaremos qué plan encaja mejor y qué acompañamiento inicial necesitáis.',
    description:
      'Antes de activar ninguna cuota mensual, os confirmaremos el plan, el importe inicial y los primeros pasos.',
    responseTime: 'Responderemos lo antes posible.',
    directEmailLabel: 'Correo directo',
    form: {
      nameLabel: 'Nombre',
      emailLabel: 'Correo electrónico',
      organizationLabel: 'Entidad',
      messageLabel: 'Mensaje',
      submit: 'Enviar contacto',
      sending: 'Enviando mensaje...',
      success: 'Mensaje enviado. Te responderemos lo antes posible.',
      error: 'No hemos podido enviar el mensaje ahora mismo. Vuelve a intentarlo más tarde o escríbenos al correo directo.',
      invalidName: 'Escribe un nombre válido.',
      invalidEmail: 'Escribe un correo electrónico válido.',
      invalidMessage: 'El mensaje debe tener al menos 10 caracteres.',
      helper: 'Revisaremos qué plan encaja mejor, qué acompañamiento inicial necesitáis y cuál sería el importe inicial antes de activar ninguna cuota mensual.',
      messagePlaceholder:
        'Cuéntanos brevemente cuántos socios o donantes tenéis, si hacéis remesas, si queréis importar movimientos bancarios o si necesitáis preparar modelos fiscales.',
      planMessages: {
        control: 'Quiero empezar con el plan Control.',
        management: 'Quiero empezar con el plan Gestión.',
        complete: 'Me gustaría hablar del plan Completo.',
      },
    },
  },
  pricing: {
    navLabel: 'Precios',
    metaTitle: 'Precios | Summa Social',
    metaDescription:
      'Planes de Summa Social desde 49 €/mes para controlar banco, socios y donaciones, vincular documentos y gestionar proyectos.',
    title: 'Elegid hasta dónde queréis llevar el control económico de vuestra entidad',
    subtitle:
      'Todos los planes permiten importar el banco y gestionar socios, cuotas y donaciones. Añadid documentación o proyectos cuando la gestión lo necesite.',
    claim: 'Planes desde 49 €/mes.',
    orientationTitle: 'Elegid el plan según la complejidad de la gestión',
    orientationText: 'La diferencia no es el tamaño de la entidad, sino hasta dónde queréis centralizar la gestión.',
    orientationPoints: [
      'Control: banco, socios, cuotas y donaciones',
      'Gestión: documentos vinculados a los movimientos',
      'Completo: cierre, proyectos y presupuestos',
    ],
    implantationTitle: 'Implantación inicial',
    implantationText:
      'Antes de trabajar bien, hay que ordenar los datos de partida: contactos, extractos, categorías, remesas y criterios fiscales. Por eso Summa Social incluye una implantación inicial presupuestada según el caso.',
    implantationPrice: 'A partir de 300 €',
    implantationSubtext:
      'El importe final depende del estado de los datos, el volumen de contactos y la complejidad de la entidad.',
    implantationNoteTitle: 'Antes de empezar, revisamos vuestro caso.',
    implantationNoteText:
      'La implantación inicial se presupuesta según el volumen de datos y el acompañamiento necesario. No pagaréis ninguna cuota mensual hasta que hayamos acordado el plan, el importe inicial y los primeros pasos.',
    decisionTitle: 'Si dudáis, os ayudamos a elegir sin sobredimensionar el plan',
    decisionText: 'Revisaremos cómo gestionáis el banco, la documentación y los proyectos antes de recomendaros una opción.',
    cta: 'Hablemos de vuestro caso',
    plans: [
      {
        id: 'control',
        name: 'Control',
        price: '49 €/mes',
        badge: 'Control esencial',
        cta: 'Quiero controlar banco y donaciones',
        description:
          'Para entidades que conservan la documentación fuera de Summa, pero quieren tener bajo control los movimientos, los socios y las donaciones.',
        features: [
          'Importación y revisión de extractos bancarios',
          'Alta y edición manual de movimientos',
          'Socios, donantes y contactos',
          'Cuotas y remesas SEPA',
          'Gestión manual de devoluciones',
          'Certificados de donación',
          'Preparación del Modelo 182, sujeta a revisión',
        ],
        limit: 'No incluye subir ni vincular documentos a los movimientos.',
      },
      {
        id: 'management',
        name: 'Gestión',
        price: '79 €/mes',
        badge: 'Recomendado',
        cta: 'Quiero empezar con Gestión',
        recommended: true,
        description: 'Para entidades que quieren centralizar facturas, nóminas, tickets y justificantes y relacionarlos con los movimientos bancarios.',
        features: [
          'Todo el plan Control',
          'Subida y vinculación de documentos a los movimientos',
          'Control de movimientos sin documento',
          'Categorización asistida con IA',
          'Preparación del Modelo 347',
        ],
      },
      {
        id: 'complete',
        name: 'Completo',
        price: '119 €/mes',
        badge: 'Cierre y proyectos',
        cta: 'Quiero gestionar proyectos y cierres',
        description:
          'Para entidades que quieren preparar el cierre económico y gestionar presupuestos, gastos y justificaciones de proyectos.',
        features: [
          'Todo el plan Gestión',
          'Gestión completa de proyectos o subvenciones',
          'Control de imputación de gastos entre proyectos',
          'Multidivisa dentro de los proyectos',
          'XLSX estructurado para preparar la justificación económica',
          'Bandeja de documentos previos o pendientes de vincular',
          'Propuestas de conciliación asistida de documentos',
          'Captura de tickets y extracción asistida de datos',
          'Paquete de cierre con movimientos y documentos',
        ],
      },
    ],
    comparisonTitle: 'Comparad los tres planes',
    comparisonDescription: 'El banco es común a todos los planes. Gestión añade la documentación y Completo, el cierre y los proyectos.',
    comparisonFeatureLabel: 'Funcionalidad',
    comparisonIncludedLabel: 'Incluido',
    comparisonNotIncludedLabel: 'No incluido',
    comparisonRows: [
      { feature: 'Importación y revisión bancaria', control: true, management: true, complete: true },
      { feature: 'Socios, donantes, SEPA, devoluciones manuales, certificados y Modelo 182', control: true, management: true, complete: true },
      { feature: 'Documentos vinculados a los movimientos', control: false, management: true, complete: true },
      { feature: 'Control sin documento, IA asistida y Modelo 347', control: false, management: true, complete: true },
      { feature: 'Bandeja previa, OCR y paquete de cierre', control: false, management: false, complete: true },
      { feature: 'Proyectos, presupuestos, multidivisa en proyectos y XLSX estructurado', control: false, management: false, complete: true },
    ],
    faqTitle: 'Preguntas frecuentes sobre los planes',
    faqItems: [
      { question: '¿El plan Control permite importar el banco?', answer: 'Sí. La importación y revisión de extractos bancarios está incluida en todos los planes.' },
      { question: '¿Cuál es la diferencia principal entre Control y Gestión?', answer: 'Control permite trabajar los movimientos bancarios, pero no añadirles documentación. Gestión permite subir y vincular facturas, nóminas, tickets y otros justificantes.' },
      { question: '¿Summa presenta los modelos fiscales?', answer: 'No. Summa prepara la información y los archivos para que la entidad o su asesoría los revise y presente.' },
      { question: '¿Summa sustituye a la gestoría?', answer: 'No. Ordena y prepara la información económica para que la entidad y la gestoría trabajen con más control.' },
      { question: '¿Qué ocurre si bajo a un plan inferior?', answer: 'Los datos y documentos existentes se conservan. Podréis consultarlos y descargarlos, pero dejaréis de poder crear o modificar los elementos reservados al plan anterior.' },
    ],
  },
  home: {
    metaTitle: 'Summa Social | Gestión económica para entidades',
    metaDescription:
      'Gestión económica y fiscal para entidades sociales pequeñas y medianas de España. Conciliación bancaria, Modelo 182/347, remesas SEPA y más.',
    skipToContent: 'Saltar al contenido',
    heroTagline: 'Controla donaciones, cuotas e informes fiscales de tu entidad',
    hero: {
      visualAlt: 'Captura de pantalla de Summa Social',
      bridgeLine: 'Gestión económica clara para entidades',
    },
    nav: {
      conciliation: 'Conciliación',
      remittances: 'Remesas y devoluciones',
      onlineDonations: 'Donaciones y donantes',
      fiscalCertificates: 'Fiscalidad y certificados',
      invoicesSepa: 'Facturas y SEPA',
      ticketsSettlements: 'Tickets y liquidaciones',
      projects: 'Proyectos',
    },
    solves: {
      title: '¿Qué resuelve Summa Social?',
      introLead:
        'Summa Social aporta orden, control y tranquilidad a la gestión económica de las entidades de acción social y cooperación.',
      introDetail:
        'Aprovecha el potencial de la IA para conciliar extractos, cuotas de socios, modelos fiscales (182 y 347) y proyectos.',
      aiBadge: 'IA',
      conciliation:
        'Conciliación bancaria más ágil: importa el extracto, centraliza los movimientos y revisa su clasificación con menos trabajo de transcripción manual. La inteligencia artificial ayuda a identificar proveedores, socios y donantes.',
      fiscal:
        'Información fiscal más ordenada: prepara los Modelos 182 y 347 y los certificados de donación a partir de los datos registrados. Revisa el resultado antes de compartirlo con la gestoría o presentarlo a la AEAT.',
      remittances:
        'Remesas de cuotas y pagos con un proceso guiado: revisa las remesas agrupadas del banco y prepara ficheros SEPA para pagos a proveedores y nóminas con más control antes de enviarlos.',
      vision:
        'Visión clara y actualizada: Dashboard con métricas en tiempo real. Ingresos, gastos, balance y alertas, todo visible de un vistazo. Informes automáticos para junta o patronato.',
      control:
        'Trazabilidad de cada movimiento: relaciona el comprobante con el movimiento bancario y obtén un XLSX estructurado con los comprobantes agrupados para preparar la justificación.',
      result:
        'El resultado: más tiempo para la misión de la entidad, menos tiempo con hojas de cálculo y tareas repetitivas. Gestión económica profesional, accesible y sin complicaciones.',
    },
    sections: {
      conciliation: {
        title: 'Conciliación bancaria asistida y seguimiento de cuentas',
        description:
          'Cuando se importa el extracto bancario, Summa Social centraliza los movimientos y ayuda a relacionarlos con la documentación, los pagos y las remesas existentes para que la entidad pueda revisar y confirmar el resultado.',
      },
      remittances: {
        title: 'Gestión completa de remesas de socios y devoluciones',
        description:
          'Cuando la entidad recibe una remesa agrupada del banco —por cuotas de socios o aportaciones periódicas— Summa Social permite desglosar este ingreso y situar cada importe en su lugar. La remesa deja de ser una cifra única y pasa a convertirse en el detalle necesario para saber quién ha aportado qué y en qué momento.',
      },
      onlineDonations: {
        title: 'Registro y control de donaciones',
        description:
          'Summa Social permite registrar las donaciones, relacionarlas con cada persona y mantener el histórico económico y fiscal ordenado dentro del mismo sistema.',
      },
      fiscalCertificates: {
        title:
          'Preparación de modelos fiscales (182 y 347) y certificados de donación',
        description:
          'A medida que la información económica se trabaja con criterio —ingresos, gastos, remesas y devoluciones— Summa Social prepara los modelos fiscales y los certificados a partir de los datos ordenados para revisarlos antes de presentarlos o compartirlos.',
      },
      invoicesSepa: {
        title:
          'Lectura rápida asistida con IA de facturas, nóminas y elaboración de remesas de pagos SEPA',
        description:
          'Summa Social permite incorporar al sistema la documentación económica que se genera en el día a día de la entidad —facturas, nóminas y otros documentos— simplemente arrastrando los ficheros. Los datos relevantes se extraen de manera inteligente y pasan a formar parte del flujo administrativo, con criterio y contexto desde el primer momento.',
      },
      ticketsSettlements: {
        title:
          'Captura de recibos y tickets con extracción asistida de datos',
        description:
          'Cuando el equipo de la entidad hace desplazamientos, viajes o actividades fuera de la oficina, Summa Social permite capturar de manera inmediata los recibos y tickets que se van generando. Una simple fotografía desde el móvil es suficiente para que estos comprobantes queden registrados dentro del sistema, asociados a la persona y al contexto en que se han producido.',
      },
      projects: {
        title: 'Módulo de Proyectos opcional: ejecución presupuestaria y asistente de justificaciones',
        description:
          'Cuando la entidad trabaja con proyectos, la gestión económica requiere una lectura diferente: no solo qué se ha pagado, sino a qué proyecto corresponde cada gasto y cómo se está ejecutando el presupuesto aprobado.',
      },
    },
    readMore: 'Leer más →',
    stats: {
      entities: '15+',
      entitiesLabel: 'entidades activas',
      movements: '2.000+',
      movementsLabel: 'movimientos/mes',
      countries: '5',
      countriesLabel: 'países',
    },
    workflow: {
      title: 'Cómo funciona',
      lead: 'Del extracto bancario al informe fiscal, todo en el mismo sistema.',
      step1: {
        title: 'Conecta',
        description: 'Importa extractos, facturas, nóminas y tickets en segundos. Summa sitúa cada dato en su lugar desde el primer momento.',
      },
      step2: {
        title: 'Gestiona',
        description: 'Controla remesas de socios y devoluciones bancarias. Revisa propuestas de categorización y relaciona movimientos con contactos y documentos.',
      },
      step3: {
        title: 'Cumple',
        description: 'Prepara los Modelos 182 y 347 y los certificados de donación para revisar. En el plan Completo, controla también la ejecución económica y la multidivisa dentro de los proyectos.',
      },
      step4: {
        title: 'Obtén',
        description:
          'Obtén informes automáticos para juntas y patronatos con datos reales actualizados. Prepara remesas SEPA, hojas de liquidación y listados ordenados de gastos y facturas para fiscalidad y justificaciones.',
      },
    },
    systemOverview: {
      title: 'Qué puedes hacer con Summa Social',
      subtitle: 'Orden y control para la gestión económica de vuestra entidad.',
    },
    capabilities: {
      title: 'Qué puedes hacer con Summa Social',
      conciliation: {
        title: 'Conciliación bancaria',
        description: 'Importa extractos y revisa las propuestas para relacionar movimientos y documentación.',
      },
      remittances: {
        title: 'Remesas y devoluciones',
        description: 'Divide remesas agrupadas y gestiona devoluciones con trazabilidad.',
      },
      donations: {
        title: 'Donaciones y donantes',
        description: 'Registra donaciones y mantiene cada aportación relacionada con su donante.',
      },
      fiscal: {
        title: 'Fiscalidad y certificados',
        description: 'Modelos 182 y 347 y certificados de donación preparados para revisar.',
      },
    },
    blocks: HOME_BLOCKS_ES,
    profiles: {
      admin: {
        title: 'Para administradores y tesorería',
        description: 'Control completo de la gestión económica diaria: conciliación, remesas, gastos y documentación. Todo en un solo lugar, con criterio y sin complicaciones.',
      },
      projects: {
        title: 'Para gestores de proyectos',
        description: 'Seguimiento presupuestario, imputación de gastos y XLSX estructurado con documentación agrupada para preparar la justificación.',
      },
    },
    whoWeAre: {
      title: 'Quiénes somos',
      lead: 'Summa Social nace de la gestión real de las entidades.',
      description:
        'Es una aplicación desarrollada dentro del ecosistema de Semilla de Software Libre, a partir de experiencia directa con organizaciones sociales, gestión económica, donantes, subvenciones y justificaciones.',
      status: 'Origen y trayectoria',
    },
    howWeWork: {
      title: 'Cómo trabajamos',
      lead: 'Antes de activar Summa Social para tu entidad, valoramos juntos si encaja con vuestra forma de trabajar y cuáles son vuestros objetivos, para asegurar una adopción práctica y útil.',
      paragraph1: 'Una vez validado el encaje, os acompañamos en la puesta en marcha hasta que la herramienta esté operativa y resulte cómoda en el día a día.',
      paragraph2: 'Nuestro apoyo está enfocado en resolver dudas concretas y asegurar estabilidad en el uso.',
      note: 'Trabajamos con un número limitado de entidades para mantener la calidad del acompañamiento y preservar criterio profesional.',
      cta: 'Hablar de vuestro caso',
      imageAlt: 'Ilustración del proceso de trabajo de Summa Social',
    },
    finalCta: {
      title: '¿Quieres ordenar la gestión económica de tu entidad?',
      subtitle:
        'Cuéntanos cómo trabajáis hoy y veremos si Summa Social puede ayudaros a reducir Excel, revisiones manuales y duplicidades.',
      cta: 'Entrar',
    },
  },
  features: {
    metaTitle: 'Summa Social | Funcionalidades',
    metaDescription:
      'Gestión económica y fiscal para entidades sociales pequeñas y medianas de España. Conciliación bancaria, Modelo 182/347, remesas SEPA y más.',
    back: 'Volver',
    intro: {
      title: 'Summa Social',
      subtitle:
        'Gestión económica y fiscal para entidades pequeñas y medianas de España, con conciliación bancaria y exports para la gestoría (Modelo 182 y 347).',
      tagline:
        'Summa Social aporta orden, control y tranquilidad a la gestión económica de las entidades sociales pequeñas y medianas.',
    },
    mainTitle: '15 Principales Funcionalidades de Summa Social',
    list: {
      conciliation: {
        title: '1. Conciliación Bancaria Asistida',
        description:
          'Importas el extracto del banco, Summa Social detecta posibles duplicados y te permite revisar y relacionar los movimientos con las operaciones registradas. Todo queda trazable por cuenta bancaria.',
        bullets: [
          'Importación de extractos (CSV, Excel, OFX) de cualquier banco',
          'Detección automática de duplicados',
          'Soporte multi-cuenta con trazabilidad completa',
          'Visión clara del estado de cada cuenta',
        ],
      },
      aiAssignment: {
        title: '2. Propuestas de Categorización con IA',
        description:
          'Cuando importas movimientos, Summa Social propone proveedores, socios, donantes, trabajadores y categorías a partir de los datos disponibles para que puedas revisarlos antes de confirmar.',
        bullets: [
          'Propuestas por nombre, IBAN o DNI',
          'Propuesta de categoría para revisar',
          'Memoria de decisiones anteriores',
          'Asistencia con IA cuando hace falta',
        ],
      },
      remittancesDivider: {
        title: '3. Divisor de Remesas IN (Cuotas de Socios)',
        description:
          'Cuando el banco te ingresa una remesa agrupada de las cuotas que los socios pagan, Summa Social la desglosa automáticamente asignando cada importe al socio correspondiente.',
        bullets: [
          'Descomposición automática por IBAN/DNI/Nombre',
          'Detección de cuotas impagadas y remesas parciales',
          'Asignación individual con historial completo',
          'Visión clara de quién está al corriente y quién no',
        ],
      },
      expensesSepa: {
        title: '4. Gestor de Gastos y Nóminas con Generador de Remesas SEPA',
        description:
          'Arrastra facturas y nóminas a Summa Social, revisa los datos extraídos con asistencia de IA y genera una remesa de pagos para subir al banco.',
        ticketsNote:
          'Novedad: captura de tickets, viajes y kilometraje con liquidaciones en PDF regenerable.',
        bullets: [
          'Remesas de pago (SEPA) para facturas y nóminas',
          'Extracción asistida de datos con IA',
          'Liquidaciones de tickets, viajes y kilometraje con PDF regenerable',
          'Enlace claro documento ↔ pago ↔ movimiento bancario',
          'Cuando entra el extracto: revisión y vinculación con el movimiento',
        ],
      },
      fiscal: {
        title: '5. Preparación Fiscal (Modelo 182 y 347)',
        description:
          'Prepara los ficheros fiscales y las validaciones para que la entidad o la gestoría los revise antes de presentarlos.',
        bullets: [
          'Modelo 182 con validación de requisitos legales',
          'Preparación del Modelo 347',
          'Comprobación de CIF/DNI/NIE y datos postales',
          'Exportación Excel para la gestoría',
        ],
      },
      donationCertificates: {
        title: '6. Certificados de Donación',
        bullets: [
          'Generación PDF con logo y firma digital',
          'Envío individual o masivo por email',
          'Control completo de envíos',
          'Cumplimiento LOPDGDD automático',
        ],
      },
      movementClassification: {
        title: '7. Clasificación de Movimientos con Memoria',
        bullets: [
          'Categorías contables personalizables',
          'Propuestas de categorización con IA',
          'Memoria persistente',
          'Asignación masiva por lotes',
        ],
      },
      dashboard: {
        title: '8. Dashboard Directivo con Métricas en Tiempo Real',
        bullets: [
          'Indicadores clave siempre visibles',
          'Filtros por período',
          'Alertas priorizadas',
          'Gráficos de evolución',
          'Export PDF de informes para junta/patronato',
        ],
      },
      multiContact: {
        title: '9. Gestión Multi-contacto con Tipologías',
        bullets: [
          'Donantes, socios, proveedores, trabajadores y contrapartes',
          'Validación automática de CIF/DNI/NIE e IBANs',
          'Importación masiva con mapping flexible',
          'Estados operativos',
        ],
      },
      bankReturns: {
        title: '10. Gestión de Devoluciones Bancarias',
        bullets: [
          'Importador específico de devoluciones',
          'Vinculación manual con el donante',
          'Seguimiento de cuotas pendientes',
          'Devolución reflejada en la preparación del Modelo 182',
        ],
      },
      stripeIntegration: {
        title: '11. Registro e Histórico de Donaciones',
        bullets: [
          'Registro individual de donaciones',
          'Vinculación con la ficha del donante',
          'Histórico económico y fiscal',
          'Trazabilidad de cada aportación',
        ],
      },
      projectsModule: {
        title: '12. Módulo de Proyectos y Subvenciones',
        bullets: [
          'Ejecución vs presupuestado',
          'Asignación parcial de gastos',
          'Captura fotográfica de gastos de terreno',
          'Export justificación (Excel + ZIP)',
          'Gestión multi-moneda',
        ],
      },
      multiOrg: {
        title: '13. Arquitectura Multi-organización con Seguridad Europea',
        bullets: [
          'Aislamiento total de datos',
          'Roles y permisos',
          'Cumplimiento RGPD/LOPDGDD',
          'Servidores UE',
        ],
      },
      exports: {
        title: '14. Exportación de Datos e Informes',
        bullets: [
          'Excel, CSV y PDF',
          'Modelos oficiales AEAT',
          'Exports por contacto, proyecto o período',
        ],
      },
      alerts: {
        title: '15. Sistema de Alertas Inteligente',
        bullets: ['Alertas críticas e informativas', 'Enlaces directos a resolución', 'Priorización automática'],
      },
    },
    cta: 'Entrar a Summa Social',
  },
  updates: {
    metaTitle: 'Novedades de Summa Social | Mejoras del producto',
    metaDescription:
      'Consulta las nuevas funcionalidades y mejoras de Summa Social para gestionar la economía, la fiscalidad y los proyectos de tu entidad.',
    navLabel: 'Novedades',
    title: 'Novedades de Summa Social',
    back: 'Volver',
    noUpdates: 'No hay novedades publicadas.',
    readMore: 'Leer más',
    viewAll: 'Ver todas las novedades',
    publishedAt: 'Publicado el',
    latestLabel: 'Nuevo en Summa',
    latestTitle: 'La última mejora publicada',
    latestDescription:
      'Aquí explicamos qué hemos mejorado, qué puedes hacer ahora y dónde lo notarás. Una cronología pública de cómo Summa Social evoluciona con las necesidades reales de las entidades.',
  },
  about: {
    metaTitle: 'Quiénes somos | Summa Social',
    metaDescription:
      'Conoce mejor qué es Summa Social y por qué estamos construyendo una herramienta de gestión económica y fiscal para entidades de acción social y cooperación.',
  },
};

const fr: PublicTranslations = {
  common: {
    appName: 'Summa Social',
    tagline: 'Gestion économique et fiscale pour les associations',
    close: 'Fermer',
    back: 'Retour',
    backToHome: "Retour à l'accueil",
    about: 'Qui sommes-nous',
    blog: 'Blog',
    menu: 'Menu',
    contact: 'Contact',
    privacy: 'Confidentialité',
    features: 'Fonctionnalités',
    enter: 'Entrer',
    email: 'Email',
    lastUpdated: 'Dernière mise à jour',
    privacyContact: 'Contact vie privée',
  },
  cta: {
    primary: 'Contactez-nous',
    secondary: 'Parlez-nous de votre organisation',
    supporting:
      'Nous préférons comprendre la réalité de chaque organisation avant de proposer quoi que ce soit.',
  },
  login: {
    title: 'Accès | Summa Social',
    welcomeTitle: 'Bienvenue sur Summa Social',
    welcomeDescription:
      "Pour accéder au tableau de bord de votre association, utilisez l'URL qui vous a été fournie.",
    urlFormatIntro: "L'adresse a ce format :",
    urlFormatExample: 'votre-association',
    urlFormatHelp:
      "Si vous ne vous en souvenez pas, demandez-la à l'administrateur de votre organisation.",
    orElse: 'ou bien',
    visitWebsite: 'Visitez le site de Summa Social',
    contactUs: 'Contactez-nous',
    footer: 'Summa Social — Gestion économique et fiscale pour les associations',
    sessionExpired: "Votre session a été fermée pour inactivité.",
  },
  privacy: {
    title: 'Politique de Confidentialité',
    updatedAt: 'Juillet 2026',
    sections: {
      whoWeAre: {
        title: '1. Qui sommes-nous',
        intro:
          "Summa Social est une application de gestion financière pour les associations qui agit en tant que responsable du traitement des données des utilisateurs de l'application.",
        responsible:
          "Responsable du traitement (pour les données des utilisateurs de l'application) : Summa Social",
        processor:
          "Sous-traitant (pour les données des entités clientes) : Summa Social agit pour le compte de chaque entité, qui est responsable des données de ses donateurs, adhérents, fournisseurs et employés.",
      },
      whatData: {
        title: '2. Quelles données traitons-nous',
        appUsersTitle: "2.1 Utilisateurs de l'application (Summa Social est responsable)",
        appUsersTable: {
          data: 'Donnée',
          purpose: 'Finalité',
          email: 'Email',
          emailPurpose: 'Identification et accès au compte',
          name: 'Nom',
          namePurpose: "Personnalisation de l'interface",
          role: 'Rôle',
          rolePurpose: "Contrôle d'accès (Admin, User, Viewer)",
          organizations: 'Organisations',
          organizationsPurpose: 'Gestion multi-organisation',
        },
        appUsersNote:
          "Les identifiants d'accès (mots de passe) sont gérés par Firebase Authentication et ne sont pas accessibles par Summa Social.",
        entityDataTitle: '2.2 Données des entités (Summa Social est sous-traitant)',
        entityDataIntro:
          'Summa Social traite les données suivantes pour le compte des entités clientes :',
        entityDataItems: [
          'Donateurs et adhérents : nom, NIF, IBAN, adresse, email, téléphone',
          'Fournisseurs : nom, NIF, coordonnées',
          'Employés : nom, NIF, données professionnelles',
          'Mouvements bancaires : date, montant, libellé, catégorie',
        ],
        entityDataNote:
          "La base juridique et le devoir d'informer les personnes concernées (donateurs, adhérents, etc.) incombent à chaque entité en tant que responsable du traitement.",
        entityDataSensitive:
          "Summa Social ne traite pas de données de catégories particulières au sens de l'Art. 9 du RGPD.",
      },
      legalBasis: {
        title: '3. Base juridique du traitement',
        table: {
          treatment: 'Traitement',
          basis: 'Base juridique',
          appUsers: "Utilisateurs de l'application",
          appUsersBasis: 'Exécution du contrat de service (Art. 6.1.b RGPD)',
          entityData: 'Données des entités',
          entityDataBasis: 'Selon les instructions du responsable (entité)',
        },
      },
      recipients: {
        title: '4. Destinataires des données',
        subprocessorsTitle: '4.1 Sous-traitants',
        subprocessorsIntro:
          "Summa Social utilise les services Google/Firebase suivants pour le fonctionnement de l'application :",
        table: {
          service: 'Service',
          location: 'Localisation',
          guarantees: 'Garanties',
        },
        services: {
          auth: {
            name: 'Firebase Authentication',
            location: 'États-Unis',
            guarantees: 'Clauses Contractuelles Types (CCT) + Cadre UE-États-Unis',
          },
          firestore: {
            name: 'Firebase Firestore',
            location: 'UE (eur3)',
            guarantees: "Données dans l'Espace Économique Européen",
          },
          storage: {
            name: 'Firebase Storage',
            location: 'UE (eur3)',
            guarantees: "Données dans l'Espace Économique Européen",
          },
          hosting: {
            name: 'Firebase Hosting',
            location: 'Global (CDN)',
            guarantees: 'Uniquement assets et application web',
          },
        },
        legalObligationsTitle: '4.2 Transferts par obligation légale',
        legalObligationsIntro: 'Les entités clientes peuvent transférer des données à :',
        legalObligationsItems: [
          'Administration fiscale : Modèle 182 (dons), Modèle 347 (opérations avec des tiers)',
          'Établissements bancaires : Gestion des prélèvements et reçus',
        ],
        legalObligationsNote: 'Ces transferts relèvent de la responsabilité de chaque entité.',
      },
      retention: {
        title: '5. Conservation des données',
        table: {
          dataType: 'Type de donnée',
          period: 'Durée',
        },
        items: {
          appUsers: {
            type: "Utilisateurs de l'application",
            period: 'Tant que le compte est actif + 12 mois',
          },
          fiscalData: {
            type: 'Données fiscales (entités)',
            period: 'Minimum 6 ans (obligations commerciales et comptables)',
          },
          otherData: {
            type: 'Autres données de contacts',
            period: 'Selon la politique du responsable (entité)',
          },
        },
        note: "Les sauvegardes sont conservées pendant des périodes limitées et gérées selon les mesures décrites dans le document interne de sécurité.",
      },
      rights: {
        title: '6. Vos droits',
        intro: 'En tant que personne concernée, vous avez le droit de :',
        rightsList: {
          access: {
            name: 'Accès',
            description: 'Demander une copie de vos données',
          },
          rectification: {
            name: 'Rectification',
            description: 'Corriger des données inexactes',
          },
          erasure: {
            name: 'Effacement',
            description: "Demander la suppression de vos données",
          },
          objection: {
            name: 'Opposition',
            description: "Vous opposer à certains traitements",
          },
          restriction: {
            name: 'Limitation',
            description: 'Demander la restriction du traitement',
          },
          portability: {
            name: 'Portabilité',
            description: 'Recevoir vos données dans un format structuré',
          },
        },
        howToExerciseTitle: 'Comment exercer vos droits',
        howToExerciseAppUsers: "Utilisateurs de l'application : Écrivez à",
        howToExerciseOthers:
          "Donateurs, adhérents ou autres personnes concernées d'une entité : Contactez directement l'entité concernée. Summa Social assistera l'entité dans la gestion de votre demande.",
        responseTime: 'Délai de réponse : 1 mois (extensible à 2 pour les cas complexes).',
        complaint:
          "Si vous estimez que vos droits n'ont pas été respectés, vous pouvez déposer une réclamation auprès de l'",
        complaintLink: 'Agence Espagnole de Protection des Données (AEPD)',
      },
      security: {
        title: '7. Sécurité',
        intro:
          'Summa Social met en œuvre des mesures techniques et organisationnelles pour protéger les données :',
        measures: [
          'Chiffrement en transit (HTTPS/TLS)',
          'Chiffrement au repos (infrastructure Google)',
          "Contrôle d'accès par rôles",
          'Isolation des données entre organisations',
          "Gestion des sessions avec expiration et mécanismes de déconnexion",
        ],
      },
      changes: {
        title: '8. Modifications de cette politique',
        content:
          "Toute modification de cette politique sera communiquée aux utilisateurs via l'application. La date de \"Dernière mise à jour\" reflète la version en vigueur.",
      },
      contact: {
        title: '9. Contact',
        intro: 'Pour toute question relative à la confidentialité :',
        emailLabel: 'Email',
        responsibleLabel: 'Responsable interne',
        responsibleValue: 'Summa Social',
        holderLabel: 'Titulaire du service',
        holderValue: 'Summa Social (Espagne)',
        dpoNote:
          "Délégué à la Protection des Données (DPD/DPO) : non applicable (Summa Social n'est pas tenue de désigner un DPD selon l'Art. 37 RGPD).",
      },
    },
  },
  contact: {
    title: 'Expliquez-nous un peu votre organisation et nous vous dirons comment commencer.',
    subtitle: 'Nous verrons quel plan convient le mieux et quel accompagnement initial vous faut.',
    description:
      'Avant toute mensualité, nous confirmerons le plan, le montant initial et les premières étapes.',
    responseTime: 'Nous vous répondrons dans les meilleurs délais.',
    directEmailLabel: 'Email direct',
    form: {
      nameLabel: 'Nom',
      emailLabel: 'Email',
      organizationLabel: 'Organisation',
      messageLabel: 'Message',
      submit: 'Envoyer le contact',
      sending: 'Envoi du message...',
      success: 'Message envoyé. Nous vous répondrons dans les meilleurs délais.',
      error: "Nous n'avons pas pu envoyer le message pour le moment. Réessayez plus tard ou écrivez-nous à l'email direct.",
      invalidName: 'Saisissez un nom valide.',
      invalidEmail: 'Saisissez une adresse email valide.',
      invalidMessage: 'Le message doit contenir au moins 10 caractères.',
      helper: 'Nous verrons quel plan convient le mieux, quel accompagnement initial vous faut et quel serait le montant initial avant toute mensualité.',
      messagePlaceholder:
        'Expliquez-nous brièvement combien de membres ou de donateurs vous avez, si vous émettez des prélèvements, si vous voulez importer des mouvements bancaires ou préparer des déclarations fiscales.',
      planMessages: {
        control: 'Je veux commencer avec le plan Contrôle.',
        management: 'Je veux commencer avec le plan Gestion.',
        complete: 'Je voudrais parler du plan Complet.',
      },
    },
  },
  pricing: {
    navLabel: 'Tarifs',
    metaTitle: 'Tarifs | Summa Social',
    metaDescription:
      'Plans Summa Social dès 49 €/mois pour contrôler la banque, les membres et les dons, relier les documents et gérer les projets.',
    title: 'Choisissez jusqu’où vous voulez porter le contrôle économique de votre organisation',
    subtitle:
      'Tous les plans permettent d’importer la banque et de gérer membres, cotisations et dons. Ajoutez la documentation ou les projets lorsque votre gestion l’exige.',
    claim: 'Plans à partir de 49 €/mois.',
    orientationTitle: 'Choisissez le plan selon la complexité de la gestion',
    orientationText: 'La différence ne tient pas à la taille de l’organisation, mais au niveau de centralisation souhaité.',
    orientationPoints: [
      'Contrôle : banque, membres, cotisations et dons',
      'Gestion : documents liés aux mouvements',
      'Complet : clôture, projets et budgets',
    ],
    implantationTitle: 'Mise en place initiale',
    implantationText:
      'Avant de bien travailler, il faut ordonner les données de départ : contacts, relevés, catégories, prélèvements et critères fiscaux. C’est pourquoi Summa Social inclut une mise en place initiale chiffrée selon le cas.',
    implantationPrice: 'À partir de 300 €',
    implantationSubtext:
      'Le montant final dépend de l’état des données, du volume de contacts et de la complexité de l’organisation.',
    implantationNoteTitle: 'Avant de commencer, nous étudions votre situation.',
    implantationNoteText:
      'La mise en place initiale est chiffrée selon le volume de données et l’accompagnement nécessaire. Vous ne paierez aucune mensualité tant que nous n’aurons pas convenu du plan, du montant initial et des premières étapes.',
    decisionTitle: 'En cas de doute, nous vous aidons à choisir sans surdimensionner le plan',
    decisionText: 'Nous examinerons votre gestion bancaire, documentaire et de projets avant de vous recommander une option.',
    cta: 'Parlons de votre cas',
    plans: [
      {
        id: 'control',
        name: 'Contrôle',
        price: '49 €/mois',
        badge: 'Contrôle essentiel',
        cta: 'Je veux contrôler banque et dons',
        description:
          'Pour les organisations qui conservent leurs documents hors de Summa, mais veulent contrôler mouvements, membres et dons.',
        features: [
          'Import et vérification des relevés bancaires',
          'Création et modification manuelles de mouvements',
          'Membres, donateurs et contacts',
          'Cotisations et prélèvements SEPA',
          'Gestion manuelle des rejets',
          'Certificats de don',
          'Préparation du Modèle 182, soumise à vérification',
        ],
        limit: 'N’inclut pas le dépôt ni la liaison de documents aux mouvements.',
      },
      {
        id: 'management',
        name: 'Gestion',
        price: '79 €/mois',
        badge: 'Recommandé',
        cta: 'Je veux commencer avec Gestion',
        recommended: true,
        description: 'Pour les organisations qui veulent centraliser factures, fiches de paie, tickets et justificatifs et les relier aux mouvements bancaires.',
        features: [
          'Tout le plan Contrôle',
          'Dépôt et liaison de documents aux mouvements',
          'Suivi des mouvements sans document',
          'Catégorisation assistée par IA',
          'Préparation du Modèle 347',
        ],
      },
      {
        id: 'complete',
        name: 'Complet',
        price: '119 €/mois',
        badge: 'Clôture et projets',
        cta: 'Je veux gérer projets et clôtures',
        description:
          'Pour les organisations qui veulent préparer la clôture économique et gérer budgets, dépenses et justificatifs de projets.',
        features: [
          'Tout le plan Gestion',
          'Gestion complète de projets ou subventions',
          'Contrôle de l’imputation des dépenses entre projets',
          'Multidevise au sein des projets',
          'XLSX structuré pour préparer la justification économique',
          'Boîte de documents préalables ou en attente de liaison',
          'Propositions de rapprochement documentaire assisté',
          'Capture de tickets et extraction assistée des données',
          'Dossier de clôture avec mouvements et documents',
        ],
      },
    ],
    comparisonTitle: 'Comparez les trois plans',
    comparisonDescription: 'La banque est commune à tous les plans. Gestion ajoute les documents et Complet, la clôture et les projets.',
    comparisonFeatureLabel: 'Fonctionnalité',
    comparisonIncludedLabel: 'Inclus',
    comparisonNotIncludedLabel: 'Non inclus',
    comparisonRows: [
      { feature: 'Import et vérification bancaire', control: true, management: true, complete: true },
      { feature: 'Membres, donateurs, SEPA, rejets manuels, certificats et Modèle 182', control: true, management: true, complete: true },
      { feature: 'Documents liés aux mouvements', control: false, management: true, complete: true },
      { feature: 'Suivi sans document, IA assistée et Modèle 347', control: false, management: true, complete: true },
      { feature: 'Boîte préalable, OCR et dossier de clôture', control: false, management: false, complete: true },
      { feature: 'Projets, budgets, multidevise dans les projets et XLSX structuré', control: false, management: false, complete: true },
    ],
    faqTitle: 'Questions fréquentes sur les plans',
    faqItems: [
      { question: 'Le plan Contrôle permet-il d’importer la banque ?', answer: 'Oui. L’import et la vérification des relevés bancaires sont inclus dans tous les plans.' },
      { question: 'Quelle est la principale différence entre Contrôle et Gestion ?', answer: 'Contrôle permet de travailler les mouvements bancaires sans y ajouter de documents. Gestion permet de déposer et relier factures, fiches de paie, tickets et autres justificatifs.' },
      { question: 'Summa dépose-t-il les déclarations fiscales ?', answer: 'Non. Summa prépare les informations et les fichiers pour vérification et dépôt par l’organisation ou son cabinet comptable.' },
      { question: 'Summa remplace-t-il le cabinet comptable ?', answer: 'Non. Il organise et prépare les informations économiques afin que l’organisation et son cabinet travaillent avec plus de contrôle.' },
      { question: 'Que se passe-t-il si je passe à un plan inférieur ?', answer: 'Les données et documents existants sont conservés. Vous pourrez les consulter et les télécharger, mais plus créer ni modifier les éléments réservés au plan précédent.' },
    ],
  },
  home: {
    metaTitle: 'Summa Social | Gestion économique pour les associations',
    metaDescription:
      "Gestion économique et fiscale pour les associations petites et moyennes d'Espagne. Rapprochement bancaire, Modèle 182/347, prélèvements SEPA et plus.",
    skipToContent: 'Aller au contenu',
    heroTagline: 'Contrôlez dons, cotisations et rapports fiscaux de votre organisation',
    hero: {
      visualAlt: 'Capture d\'écran de Summa Social',
      bridgeLine: 'Gestion économique claire pour les organisations',
    },
    nav: {
      conciliation: 'Rapprochement',
      remittances: 'Prélèvements et rejets',
      onlineDonations: 'Dons et donateurs',
      fiscalCertificates: 'Fiscalité et certificats',
      invoicesSepa: 'Factures et SEPA',
      ticketsSettlements: 'Tickets et notes de frais',
      projects: 'Projets',
    },
    solves: {
      title: 'Que résout Summa Social ?',
      introLead:
        "Summa Social apporte ordre, contrôle et sérénité à la gestion économique des associations d'action sociale et de coopération.",
      introDetail:
        "Exploitez le potentiel de l'IA pour rapprocher relevés, cotisations des adhérents, modèles fiscaux (182 et 347) et projets.",
      aiBadge: 'IA',
      conciliation:
        "Rapprochement bancaire simple et rapide : Importez le relevé et en quelques minutes, tous les mouvements sont classés, sans erreurs de transcription. L'intelligence artificielle reconnaît automatiquement fournisseurs, adhérents et donateurs.",
      fiscal:
        "Fiscalité en temps réel, sans effort : Modèles 182 et 347 en un clic. Certificats de don générés et envoyés automatiquement. Tout validé et prêt à envoyer au comptable ou à l'administration fiscale.",
      remittances:
        'Prélèvements de cotisations et paiements en quelques secondes : Décompose automatiquement les prélèvements groupés de la banque. Génère des fichiers SEPA pour les paiements aux fournisseurs et salaires. Facile, rapide et sans erreurs.',
      vision:
        "Vision claire et à jour : Tableau de bord avec métriques en temps réel. Revenus, dépenses, solde et alertes, tout visible d'un coup d'œil. Rapports automatiques pour le conseil d'administration.",
      control:
        "Traçabilité de chaque mouvement : reliez le justificatif au mouvement bancaire et obtenez un XLSX structuré avec les pièces regroupées pour préparer la justification.",
      result:
        "Le résultat : plus de temps pour la mission de l'association, moins de temps avec les tableurs et les tâches répétitives. Gestion économique professionnelle, accessible et sans complications.",
    },
    sections: {
      conciliation: {
        title: 'Rapprochement bancaire assisté et suivi des comptes',
        description:
          "Quand le relevé bancaire est importé, Summa Social centralise les mouvements et aide à les relier aux documents, paiements et prélèvements existants afin que l'organisation puisse vérifier et confirmer le résultat.",
      },
      remittances: {
        title: 'Gestion complète des prélèvements adhérents et des rejets',
        description:
          "Quand l'association reçoit un prélèvement groupé de la banque — pour les cotisations ou contributions périodiques — Summa Social permet de décomposer ce revenu et de placer chaque montant à sa place. Le prélèvement cesse d'être un chiffre unique pour devenir le détail nécessaire pour savoir qui a contribué quoi et quand.",
      },
      onlineDonations: {
        title: 'Enregistrement et contrôle des dons',
        description:
          "Summa Social permet d'enregistrer les dons, de les relier à chaque personne et de conserver l'historique économique et fiscal dans un même système.",
      },
      fiscalCertificates: {
        title:
          'Préparation des modèles fiscaux (182 et 347) et certificats de don',
        description:
          "À mesure que l'information économique est structurée — revenus, dépenses, prélèvements et rejets — Summa Social prépare les modèles fiscaux et les certificats à partir des données ordonnées, pour vérification avant dépôt ou partage.",
      },
      invoicesSepa: {
        title:
          'Lecture rapide assistée par IA de factures, fiches de paie et élaboration de virements SEPA',
        description:
          "Summa Social permet d'incorporer au système la documentation économique générée au quotidien de l'association — factures, fiches de paie et autres documents — simplement en glissant les fichiers. Les données pertinentes sont extraites intelligemment et intègrent le flux administratif, avec rigueur et contexte dès le premier moment.",
      },
      ticketsSettlements: {
        title:
          "Capture de reçus et tickets avec extraction assistée des données",
        description:
          "Quand l'équipe de l'association fait des déplacements, voyages ou activités hors du bureau, Summa Social permet de capturer immédiatement les reçus et tickets générés. Une simple photo depuis le mobile suffit pour que ces justificatifs soient enregistrés dans le système, associés à la personne et au contexte.",
      },
      projects: {
        title: 'Module Projets optionnel : exécution budgétaire et assistant de justifications',
        description:
          "Quand l'association travaille avec des projets, la gestion économique nécessite une lecture différente : non seulement ce qui a été payé, mais à quel projet correspond chaque dépense et comment s'exécute le budget approuvé.",
      },
    },
    readMore: 'En savoir plus →',
    stats: {
      entities: '15+',
      entitiesLabel: 'associations actives',
      movements: '2 000+',
      movementsLabel: 'mouvements/mois',
      countries: '5',
      countriesLabel: 'pays',
    },
    workflow: {
      title: 'Comment ça marche',
      lead: "Du relevé bancaire au rapport fiscal, tout dans le même système.",
      step1: {
        title: 'Connectez',
        description: "Importez relevés, factures, fiches de paie et justificatifs en quelques secondes. Summa place chaque donnée au bon endroit dès le départ.",
      },
      step2: {
        title: 'Gérez',
        description: 'Contrôlez les prélèvements et les rejets bancaires. Vérifiez les propositions de catégorisation et reliez mouvements, contacts et documents.',
      },
      step3: {
        title: 'Conformez',
        description: "Préparez les modèles 182 et 347 et les certificats de don pour vérification. Avec le plan Complet, suivez aussi l'exécution économique et le multidevise au sein des projets.",
      },
      step4: {
        title: 'Obtenez',
        description:
          'Obtenez des rapports automatiques pour conseils et comités avec des données réelles à jour. Préparez fichiers SEPA, notes de frais et listes ordonnées de dépenses et factures pour fiscalité et justificatifs.',
      },
    },
    systemOverview: {
      title: 'Ce que vous pouvez faire avec Summa Social',
      subtitle:
        "Summa Social apporte ordre, contrôle et sérénité à la gestion économique des associations d'action sociale et de coopération.",
    },
    capabilities: {
      title: 'Ce que vous pouvez faire avec Summa Social',
      conciliation: {
        title: 'Rapprochement bancaire',
        description: 'Importez les relevés et vérifiez les propositions pour relier mouvements et documentation.',
      },
      remittances: {
        title: 'Prélèvements et rejets',
        description: 'Divisez les prélèvements groupés et gérez les rejets avec traçabilité.',
      },
      donations: {
        title: 'Dons et donateurs',
        description: 'Enregistrez les dons et conservez chaque contribution reliée à son donateur.',
      },
      fiscal: {
        title: 'Fiscalité et certificats',
        description: 'Modèles 182 et 347 et certificats de don préparés pour vérification.',
      },
    },
    blocks: HOME_BLOCKS_FR,
    profiles: {
      admin: {
        title: 'Pour administrateurs et trésorerie',
        description: "Contrôle complet de la gestion économique quotidienne : rapprochement, prélèvements, dépenses et documentation. Tout au même endroit, avec discernement et sans complications.",
      },
      projects: {
        title: 'Pour gestionnaires de projets',
        description: "Suivi budgétaire, affectation des dépenses et XLSX structuré avec documentation regroupée pour préparer la justification.",
      },
    },
    whoWeAre: {
      title: 'Qui nous sommes',
      lead: 'Summa Social naît de la gestion réelle des organisations.',
      description:
        'C’est une application développée au sein de l’écosystème de Semilla de Software Libre, à partir d’une expérience directe avec des organisations sociales, la gestion économique, les donateurs, les subventions et les justificatifs.',
      status: 'Origine et trajectoire',
    },
    howWeWork: {
      title: 'Comment nous travaillons',
      lead: "Avant d'activer Summa Social pour votre association, nous évaluons ensemble si cela correspond à votre façon de travailler et quels sont vos objectifs, pour garantir une adoption pratique et utile.",
      paragraph1: "Une fois l'adéquation validée, nous vous accompagnons dans la mise en route jusqu'à ce que l'outil soit opérationnel et confortable au quotidien.",
      paragraph2: 'Notre support est orienté vers la résolution de doutes concrets et la stabilité dans l\'utilisation.',
      note: 'Nous travaillons avec un nombre limité d\'associations pour maintenir la qualité de l\'accompagnement et préserver le discernement professionnel.',
      cta: 'Parlons de votre cas',
      imageAlt: 'Illustration du processus de travail de Summa Social',
    },
    finalCta: {
      title: 'Vous voulez remettre de l’ordre dans la gestion économique de votre organisation ?',
      subtitle:
        'Expliquez-nous votre fonctionnement actuel et nous verrons si Summa Social peut réduire Excel, les révisions manuelles et les doublons.',
      cta: 'Entrer',
    },
  },
  features: {
    metaTitle: 'Summa Social | Fonctionnalités',
    metaDescription:
      "Gestion économique et fiscale pour les associations petites et moyennes d'Espagne. Rapprochement bancaire, Modèle 182/347, prélèvements SEPA et plus.",
    back: 'Retour',
    intro: {
      title: 'Summa Social',
      subtitle:
        "Gestion économique et fiscale pour les petites et moyennes associations d'Espagne, avec rapprochement bancaire et exports pour le comptable (Modèle 182 et 347).",
      tagline:
        'Summa Social apporte ordre, contrôle et sérénité à la gestion économique des petites et moyennes associations.',
    },
    mainTitle: '15 Principales Fonctionnalités de Summa Social',
    list: {
      conciliation: {
        title: '1. Rapprochement Bancaire Assisté',
        description:
          'Importez le relevé bancaire : Summa Social détecte les doublons possibles et vous permet de vérifier et relier les mouvements aux opérations enregistrées. Tout reste traçable par compte.',
        bullets: [
          "Importation de relevés (CSV, Excel, OFX) de n'importe quelle banque",
          'Détection automatique des doublons',
          'Support multi-compte avec traçabilité complète',
          "Vision claire de l'état de chaque compte",
        ],
      },
      aiAssignment: {
        title: '2. Propositions de Catégorisation avec IA',
        description:
          'Lors de l’import des mouvements, Summa Social propose fournisseurs, membres, donateurs, salariés et catégories à partir des données disponibles, pour vérification avant confirmation.',
        bullets: [
          'Propositions par nom, IBAN ou NIF',
          'Proposition de catégorie à vérifier',
          'Mémoire des décisions antérieures',
          'Assistance par IA lorsque nécessaire',
        ],
      },
      remittancesDivider: {
        title: '3. Diviseur de Prélèvements IN (Cotisations Adhérents)',
        description:
          "Quand la banque vous verse un prélèvement groupé des cotisations que les adhérents paient, Summa Social le décompose automatiquement en affectant chaque montant à l'adhérent correspondant.",
        bullets: [
          'Décomposition automatique par IBAN/NIF/Nom',
          'Détection des cotisations impayées et prélèvements partiels',
          'Affectation individuelle avec historique complet',
          "Vision claire de qui est à jour et qui ne l'est pas",
        ],
      },
      expensesSepa: {
        title: '4. Gestionnaire de Dépenses et Salaires avec Générateur de Virements SEPA',
        description:
          'Glissez factures et fiches de paie dans Summa Social, vérifiez les données extraites avec assistance IA et générez un virement à télécharger sur la banque.',
        ticketsNote:
          'Nouveauté : capture de tickets, voyages et kilométrage avec notes de frais en PDF régénérable.',
        bullets: [
          'Virements de paiement (SEPA) pour factures et salaires',
          'Extraction assistée de données avec IA',
          'Notes de frais pour tickets, voyages et kilométrage avec PDF régénérable',
          'Lien clair document ↔ paiement ↔ mouvement bancaire',
          'Quand le relevé arrive : vérification et liaison avec le mouvement',
        ],
      },
      fiscal: {
        title: '5. Préparation Fiscale (Modèle 182 et 347)',
        description:
          "Prépare les fichiers fiscaux et les contrôles pour vérification par l'organisation ou le cabinet comptable avant dépôt.",
        bullets: [
          'Modèle 182 avec validation des exigences légales',
          'Préparation du Modèle 347',
          'Vérification de NIF et données postales',
          'Exportation Excel pour le comptable',
        ],
      },
      donationCertificates: {
        title: '6. Certificats de Don',
        bullets: [
          'Génération PDF avec logo et signature numérique',
          'Envoi individuel ou massif par email',
          "Contrôle complet des envois",
          'Conformité RGPD automatique',
        ],
      },
      movementClassification: {
        title: '7. Classification des Mouvements avec Mémoire',
        bullets: [
          'Catégories comptables personnalisables',
          'Propositions de catégorisation avec IA',
          'Mémoire persistante',
          'Affectation massive par lots',
        ],
      },
      dashboard: {
        title: '8. Tableau de Bord Directif avec Métriques en Temps Réel',
        bullets: [
          'Indicateurs clés toujours visibles',
          'Filtres par période',
          'Alertes priorisées',
          "Graphiques d'évolution",
          "Export PDF de rapports pour le conseil d'administration",
        ],
      },
      multiContact: {
        title: '9. Gestion Multi-contact avec Typologies',
        bullets: [
          'Donateurs, adhérents, fournisseurs, employés et contreparties',
          'Validation automatique de NIF et IBANs',
          'Importation massive avec mapping flexible',
          'États opérationnels',
        ],
      },
      bankReturns: {
        title: '10. Gestion des Rejets Bancaires',
        bullets: [
          'Importateur spécifique de rejets',
          'Liaison manuelle avec le donateur',
          'Suivi des cotisations en attente',
          'Rejet pris en compte dans la préparation du Modèle 182',
        ],
      },
      stripeIntegration: {
        title: '11. Enregistrement et Historique des Dons',
        bullets: [
          'Enregistrement individuel des dons',
          'Liaison avec la fiche du donateur',
          'Historique économique et fiscal',
          'Traçabilité de chaque contribution',
        ],
      },
      projectsModule: {
        title: '12. Module Projets et Subventions',
        bullets: [
          'Exécution vs budgété',
          'Affectation partielle de dépenses',
          'Capture photo de dépenses terrain',
          'Export justification (Excel + ZIP)',
          'Gestion multi-devises',
        ],
      },
      multiOrg: {
        title: '13. Architecture Multi-organisation avec Sécurité Européenne',
        bullets: [
          'Isolation totale des données',
          'Rôles et permissions',
          'Conformité RGPD',
          'Serveurs UE',
        ],
      },
      exports: {
        title: '14. Exportation de Données et Rapports',
        bullets: [
          'Excel, CSV et PDF',
          'Modèles officiels administration fiscale',
          'Exports par contact, projet ou période',
        ],
      },
      alerts: {
        title: "15. Système d'Alertes Intelligent",
        bullets: ['Alertes critiques et informatives', 'Liens directs vers résolution', 'Priorisation automatique'],
      },
    },
    cta: 'Entrer dans Summa Social',
  },
  updates: {
    metaTitle: 'Nouveautés | Summa Social',
    metaDescription: 'Découvrez les dernières nouveautés et améliorations de Summa Social.',
    navLabel: 'Nouveautés',
    title: 'Nouveautés du produit',
    back: 'Retour',
    noUpdates: 'Aucune nouveauté publiée.',
    readMore: 'En savoir plus',
    viewAll: 'Voir toutes les nouveautés',
    publishedAt: 'Publié le',
    latestLabel: 'Nouveau dans Summa',
    latestTitle: 'La dernière amélioration publiée',
    latestDescription:
      'Nous publions des améliorations utiles et discrètes pour expliquer clairement ce qui change et comment cela se remarquera au quotidien.',
  },
  about: {
    metaTitle: 'Qui sommes-nous | Summa Social',
    metaDescription:
      "Découvrez mieux ce qu'est Summa Social et pourquoi nous construisons un outil de gestion économique et fiscale pour les associations d'action sociale et de coopération.",
  },
};

const pt: PublicTranslations = {
  common: {
    appName: 'Summa Social',
    tagline: 'Gestão económica e fiscal para entidades',
    close: 'Fechar',
    back: 'Voltar',
    backToHome: 'Voltar ao início',
    about: 'Quem somos',
    blog: 'Blog',
    menu: 'Menu',
    contact: 'Contacto',
    privacy: 'Privacidade',
    features: 'Funcionalidades',
    enter: 'Entrar',
    email: 'Email',
    lastUpdated: 'Última atualização',
    privacyContact: 'Contacto de privacidade',
  },
  cta: {
    primary: 'Fale connosco',
    secondary: 'Conte-nos sobre a sua organização',
    supporting:
      'Preferimos compreender primeiro a realidade de cada entidade antes de propor seja o que for.',
  },
  login: {
    title: 'Acesso | Summa Social',
    welcomeTitle: 'Bem-vindo ao Summa Social',
    welcomeDescription:
      'Para aceder ao painel da sua entidade, utilize o URL que lhe foi fornecido.',
    urlFormatIntro: 'O endereço tem este formato:',
    urlFormatExample: 'a-sua-entidade',
    urlFormatHelp: 'Se não se lembra, peça ao administrador da sua organização.',
    orElse: 'ou então',
    visitWebsite: 'Visite o site do Summa Social',
    contactUs: 'Contacte-nos',
    footer: 'Summa Social — Gestão económica e fiscal para entidades',
    sessionExpired: 'A sua sessão foi encerrada por inatividade.',
  },
  privacy: {
    title: 'Política de Privacidade',
    updatedAt: 'Julho 2026',
    sections: {
      whoWeAre: {
        title: '1. Quem somos',
        intro:
          'Summa Social é uma aplicação de gestão financeira para entidades sociais que atua como responsável pelo tratamento dos dados dos utilizadores da aplicação.',
        responsible:
          'Responsável pelo tratamento (para dados de utilizadores da aplicação): Summa Social',
        processor:
          'Subcontratante (para dados das entidades clientes): Summa Social atua por conta de cada entidade, que é a responsável pelos dados dos seus doadores, sócios, fornecedores e trabalhadores.',
      },
      whatData: {
        title: '2. Que dados tratamos',
        appUsersTitle: '2.1 Utilizadores da aplicação (Summa Social é responsável)',
        appUsersTable: {
          data: 'Dado',
          purpose: 'Finalidade',
          email: 'Email',
          emailPurpose: 'Identificação e acesso à conta',
          name: 'Nome',
          namePurpose: 'Personalização da interface',
          role: 'Papel',
          rolePurpose: 'Controlo de acesso (Admin, User, Viewer)',
          organizations: 'Organizações',
          organizationsPurpose: 'Gestão multi-organização',
        },
        appUsersNote:
          'As credenciais de acesso (palavras-passe) são geridas pelo Firebase Authentication e não são acessíveis pelo Summa Social.',
        entityDataTitle: '2.2 Dados das entidades (Summa Social é subcontratante)',
        entityDataIntro:
          'Summa Social trata os seguintes dados por conta das entidades clientes:',
        entityDataItems: [
          'Doadores e sócios: nome, NIF, IBAN, morada, email, telefone',
          'Fornecedores: nome, NIF, dados de contacto',
          'Trabalhadores: nome, NIF, dados laborais',
          'Movimentos bancários: data, montante, conceito, categoria',
        ],
        entityDataNote:
          'A base legal e o dever de informar os interessados (doadores, sócios, etc.) cabe a cada entidade como responsável pelo tratamento.',
        entityDataSensitive:
          'Summa Social não trata dados de categorias especiais segundo o Art. 9 do RGPD.',
      },
      legalBasis: {
        title: '3. Base legal do tratamento',
        table: {
          treatment: 'Tratamento',
          basis: 'Base legal',
          appUsers: 'Utilizadores da aplicação',
          appUsersBasis: 'Execução do contrato de serviço (Art. 6.1.b RGPD)',
          entityData: 'Dados das entidades',
          entityDataBasis: 'Segundo instruções do responsável (entidade)',
        },
      },
      recipients: {
        title: '4. Destinatários dos dados',
        subprocessorsTitle: '4.1 Subcontratantes',
        subprocessorsIntro:
          'Summa Social utiliza os seguintes serviços Google/Firebase para o funcionamento da aplicação:',
        table: {
          service: 'Serviço',
          location: 'Localização',
          guarantees: 'Garantias',
        },
        services: {
          auth: {
            name: 'Firebase Authentication',
            location: 'EUA',
            guarantees: 'Cláusulas Contratuais Tipo (CCT) + Quadro UE-EUA',
          },
          firestore: {
            name: 'Firebase Firestore',
            location: 'UE (eur3)',
            guarantees: 'Dados no Espaço Económico Europeu',
          },
          storage: {
            name: 'Firebase Storage',
            location: 'UE (eur3)',
            guarantees: 'Dados no Espaço Económico Europeu',
          },
          hosting: {
            name: 'Firebase Hosting',
            location: 'Global (CDN)',
            guarantees: 'Apenas assets e aplicação web',
          },
        },
        legalObligationsTitle: '4.2 Cessões por obrigação legal',
        legalObligationsIntro: 'As entidades clientes podem ceder dados a:',
        legalObligationsItems: [
          'Autoridade Tributária: Modelo 182 (donativos), Modelo 347 (operações com terceiros)',
          'Entidades bancárias: Gestão de remessas e recibos',
        ],
        legalObligationsNote: 'Estas cessões são responsabilidade de cada entidade.',
      },
      retention: {
        title: '5. Conservação dos dados',
        table: {
          dataType: 'Tipo de dado',
          period: 'Prazo',
        },
        items: {
          appUsers: {
            type: 'Utilizadores da aplicação',
            period: 'Enquanto a conta estiver ativa + 12 meses',
          },
          fiscalData: {
            type: 'Dados fiscais (entidades)',
            period: 'Mínimo 6 anos (obrigações comerciais e contabilísticas)',
          },
          otherData: {
            type: 'Outros dados de contactos',
            period: 'Segundo política do responsável (entidade)',
          },
        },
        note: 'As cópias de segurança são conservadas durante períodos limitados e geridas segundo as medidas descritas no documento interno de segurança.',
      },
      rights: {
        title: '6. Os seus direitos',
        intro: 'Como interessado, tem direito a:',
        rightsList: {
          access: {
            name: 'Acesso',
            description: 'Solicitar uma cópia dos seus dados',
          },
          rectification: {
            name: 'Retificação',
            description: 'Corrigir dados inexatos',
          },
          erasure: {
            name: 'Apagamento',
            description: 'Solicitar a eliminação dos seus dados',
          },
          objection: {
            name: 'Oposição',
            description: 'Opor-se a determinados tratamentos',
          },
          restriction: {
            name: 'Limitação',
            description: 'Solicitar a restrição do tratamento',
          },
          portability: {
            name: 'Portabilidade',
            description: 'Receber os seus dados em formato estruturado',
          },
        },
        howToExerciseTitle: 'Como exercer os seus direitos',
        howToExerciseAppUsers: 'Utilizadores da aplicação: Escreva para',
        howToExerciseOthers:
          'Doadores, sócios ou outros interessados de uma entidade: Contacte diretamente a entidade correspondente. Summa Social assistirá a entidade na gestão do seu pedido.',
        responseTime: 'Prazo de resposta: 1 mês (extensível a 2 em casos complexos).',
        complaint:
          'Se considera que os seus direitos não foram atendidos corretamente, pode apresentar uma reclamação junto da ',
        complaintLink: 'Agência Espanhola de Proteção de Dados (AEPD)',
      },
      security: {
        title: '7. Segurança',
        intro:
          'Summa Social implementa medidas técnicas e organizativas para proteger os dados:',
        measures: [
          'Encriptação em trânsito (HTTPS/TLS)',
          'Encriptação em repouso (infraestrutura Google)',
          'Controlo de acesso por papéis',
          'Isolamento de dados entre organizações',
          'Gestão de sessões com expiração e mecanismos de encerramento de sessão',
        ],
      },
      changes: {
        title: '8. Alterações a esta política',
        content:
          'Qualquer modificação desta política será comunicada aos utilizadores através da aplicação. A data de "Última atualização" reflete a versão vigente.',
      },
      contact: {
        title: '9. Contacto',
        intro: 'Para qualquer questão relacionada com a privacidade:',
        emailLabel: 'Email',
        responsibleLabel: 'Responsável interno',
        responsibleValue: 'Summa Social',
        holderLabel: 'Titular do serviço',
        holderValue: 'Summa Social (Espanha)',
        dpoNote:
          'Encarregado de Proteção de Dados (EPD/DPO): não aplicável (Summa Social não está obrigada a designar EPD segundo o Art. 37 RGPD).',
      },
    },
  },
  contact: {
    title: 'Falem-nos um pouco da vossa entidade e diremos como começar.',
    subtitle: 'Veremos que plano encaixa melhor e que acompanhamento inicial precisam.',
    description:
      'Antes de ativar qualquer mensalidade, confirmaremos o plano, o valor inicial e os primeiros passos.',
    responseTime: 'Responderemos o mais brevemente possível.',
    directEmailLabel: 'Email direto',
    form: {
      nameLabel: 'Nome',
      emailLabel: 'Email',
      organizationLabel: 'Entidade',
      messageLabel: 'Mensagem',
      submit: 'Enviar contacto',
      sending: 'A enviar mensagem...',
      success: 'Mensagem enviada. Responderemos o mais brevemente possível.',
      error: 'Não foi possível enviar a mensagem agora. Tente novamente mais tarde ou escreva-nos para o email direto.',
      invalidName: 'Escreva um nome válido.',
      invalidEmail: 'Escreva um email válido.',
      invalidMessage: 'A mensagem deve ter pelo menos 10 caracteres.',
      helper: 'Veremos que plano encaixa melhor, que acompanhamento inicial precisam e qual seria o valor inicial antes de ativar qualquer mensalidade.',
      messagePlaceholder:
        'Explique-nos brevemente quantos sócios ou doadores têm, se fazem remessas, se querem importar movimentos bancários ou se precisam de preparar modelos fiscais.',
      planMessages: {
        control: 'Quero começar com o plano Controlo.',
        management: 'Quero começar com o plano Gestão.',
        complete: 'Gostaria de falar sobre o plano Completo.',
      },
    },
  },
  pricing: {
    navLabel: 'Preços',
    metaTitle: 'Preços | Summa Social',
    metaDescription:
      'Planos do Summa Social desde 49 €/mês para controlar banco, sócios e doações, ligar documentos e gerir projetos.',
    title: 'Escolham até onde querem levar o controlo económico da vossa entidade',
    subtitle:
      'Todos os planos permitem importar o banco e gerir sócios, quotas e doações. Acrescentem documentação ou projetos quando a gestão o exigir.',
    claim: 'Planos desde 49 €/mês.',
    orientationTitle: 'Escolham o plano segundo a complexidade da gestão',
    orientationText: 'A diferença não é o tamanho da entidade, mas até onde querem centralizar a gestão.',
    orientationPoints: [
      'Controlo: banco, sócios, quotas e doações',
      'Gestão: documentos ligados aos movimentos',
      'Completo: fecho, projetos e orçamentos',
    ],
    implantationTitle: 'Implementação inicial',
    implantationText:
      'Antes de trabalhar bem, é preciso ordenar os dados de partida: contactos, extratos, categorias, remessas e critérios fiscais. Por isso o Summa Social inclui uma implementação inicial orçamentada segundo o caso.',
    implantationPrice: 'A partir de 300 €',
    implantationSubtext:
      'O valor final depende do estado dos dados, do volume de contactos e da complexidade da entidade.',
    implantationNoteTitle: 'Antes de começar, analisamos o vosso caso.',
    implantationNoteText:
      'A implementação inicial é orçamentada segundo o volume de dados e o acompanhamento necessário. Não pagarão nenhuma mensalidade até acordarmos o plano, o valor inicial e os primeiros passos.',
    decisionTitle: 'Em caso de dúvida, ajudamos a escolher sem sobredimensionar o plano',
    decisionText: 'Analisaremos como gerem o banco, a documentação e os projetos antes de recomendar uma opção.',
    cta: 'Falemos do vosso caso',
    plans: [
      {
        id: 'control',
        name: 'Controlo',
        price: '49 €/mês',
        badge: 'Controlo essencial',
        cta: 'Quero controlar banco e doações',
        description:
          'Para entidades que guardam a documentação fora do Summa, mas querem controlar os movimentos, os sócios e as doações.',
        features: [
          'Importação e revisão de extratos bancários',
          'Criação e edição manual de movimentos',
          'Sócios, doadores e contactos',
          'Quotas e remessas SEPA',
          'Gestão manual de devoluções',
          'Certificados de donativo',
          'Preparação do Modelo 182, sujeita a revisão',
        ],
        limit: 'Não inclui carregar nem ligar documentos aos movimentos.',
      },
      {
        id: 'management',
        name: 'Gestão',
        price: '79 €/mês',
        badge: 'Recomendado',
        cta: 'Quero começar com Gestão',
        recommended: true,
        description: 'Para entidades que querem centralizar faturas, folhas de pagamento, tickets e comprovativos e relacioná-los com os movimentos bancários.',
        features: [
          'Todo o plano Controlo',
          'Carregamento e ligação de documentos aos movimentos',
          'Controlo de movimentos sem documento',
          'Categorização assistida com IA',
          'Preparação do Modelo 347',
        ],
      },
      {
        id: 'complete',
        name: 'Completo',
        price: '119 €/mês',
        badge: 'Fecho e projetos',
        cta: 'Quero gerir projetos e fechos',
        description:
          'Para entidades que querem preparar o fecho económico e gerir orçamentos, despesas e justificações de projetos.',
        features: [
          'Todo o plano Gestão',
          'Gestão completa de projetos ou subvenções',
          'Controlo da imputação de despesas entre projetos',
          'Multidivisa dentro dos projetos',
          'XLSX estruturado para preparar a justificação económica',
          'Caixa de documentos prévios ou pendentes de ligação',
          'Propostas de reconciliação assistida de documentos',
          'Captura de tickets e extração assistida de dados',
          'Pacote de fecho com movimentos e documentos',
        ],
      },
    ],
    comparisonTitle: 'Comparem os três planos',
    comparisonDescription: 'O banco é comum a todos os planos. Gestão acrescenta a documentação e Completo, o fecho e os projetos.',
    comparisonFeatureLabel: 'Funcionalidade',
    comparisonIncludedLabel: 'Incluído',
    comparisonNotIncludedLabel: 'Não incluído',
    comparisonRows: [
      { feature: 'Importação e revisão bancária', control: true, management: true, complete: true },
      { feature: 'Sócios, doadores, SEPA, devoluções manuais, certificados e Modelo 182', control: true, management: true, complete: true },
      { feature: 'Documentos ligados aos movimentos', control: false, management: true, complete: true },
      { feature: 'Controlo sem documento, IA assistida e Modelo 347', control: false, management: true, complete: true },
      { feature: 'Caixa prévia, OCR e pacote de fecho', control: false, management: false, complete: true },
      { feature: 'Projetos, orçamentos, multidivisa em projetos e XLSX estruturado', control: false, management: false, complete: true },
    ],
    faqTitle: 'Perguntas frequentes sobre os planos',
    faqItems: [
      { question: 'O plano Controlo permite importar o banco?', answer: 'Sim. A importação e revisão de extratos bancários está incluída em todos os planos.' },
      { question: 'Qual é a principal diferença entre Controlo e Gestão?', answer: 'Controlo permite trabalhar os movimentos bancários, mas não adicionar-lhes documentação. Gestão permite carregar e ligar faturas, folhas de pagamento, tickets e outros comprovativos.' },
      { question: 'O Summa apresenta os modelos fiscais?', answer: 'Não. O Summa prepara a informação e os ficheiros para que a entidade ou a sua assessoria os reveja e apresente.' },
      { question: 'O Summa substitui a contabilidade?', answer: 'Não. Organiza e prepara a informação económica para que a entidade e a contabilidade trabalhem com mais controlo.' },
      { question: 'O que acontece se mudar para um plano inferior?', answer: 'Os dados e documentos existentes são conservados. Poderão consultá-los e descarregá-los, mas deixarão de poder criar ou modificar os elementos reservados ao plano anterior.' },
    ],
  },
  home: {
    metaTitle: 'Summa Social | Gestão económica para entidades',
    metaDescription:
      'Gestão económica e fiscal para entidades sociais pequenas e médias de Espanha. Reconciliação bancária, Modelo 182/347, remessas SEPA e mais.',
    skipToContent: 'Saltar para o conteúdo',
    heroTagline: 'Controla doações, quotas e relatórios fiscais da tua entidade',
    hero: {
      visualAlt: 'Captura de ecrã de Summa Social',
      bridgeLine: 'Gestão económica clara para entidades',
    },
    nav: {
      conciliation: 'Reconciliação',
      remittances: 'Remessas e devoluções',
      onlineDonations: 'Doações e doadores',
      fiscalCertificates: 'Fiscalidade e certificados',
      invoicesSepa: 'Faturas e SEPA',
      ticketsSettlements: 'Tickets e liquidações',
      projects: 'Projetos',
    },
    solves: {
      title: 'O que resolve o Summa Social?',
      introLead:
        'Summa Social traz ordem, controlo e tranquilidade à gestão económica das entidades de ação social e cooperação.',
      introDetail:
        'Aproveita o potencial da IA para conciliar extratos, quotas de associados, modelos fiscais (182 e 347) e projetos.',
      aiBadge: 'IA',
      conciliation:
        'Reconciliação bancária simples e rápida: Importa o extrato e em poucos minutos tens todos os movimentos classificados, sem erros de transcrição. A inteligência artificial reconhece automaticamente fornecedores, sócios e doadores.',
      fiscal:
        'Fiscalidade em tempo real, sem esforço: Modelos 182 e 347 com um clique. Certificados de doação gerados e enviados automaticamente. Tudo validado e pronto para enviar ao contabilista ou à Autoridade Tributária.',
      remittances:
        'Remessas de quotas e pagamentos em poucos segundos: Divide automaticamente as remessas agrupadas do banco. Gera ficheiros SEPA para pagamentos a fornecedores e ordenados. Fácil, rápido e sem erros.',
      vision:
        'Visão clara e atualizada: Dashboard com métricas em tempo real. Receitas, despesas, saldo e alertas, tudo visível de relance. Relatórios automáticos para direção ou conselho.',
      control:
        'Rastreabilidade de cada movimento: relaciona o comprovativo com o movimento bancário e obtém um XLSX estruturado com os documentos agrupados para preparar a justificação.',
      result:
        'O resultado: mais tempo para a missão da entidade, menos tempo com folhas de cálculo e tarefas repetitivas. Gestão económica profissional, acessível e sem complicações.',
    },
    sections: {
      conciliation: {
        title: 'Reconciliação bancária assistida e acompanhamento de contas',
        description:
          'Quando o extrato bancário é importado, o Summa Social centraliza os movimentos e ajuda a relacioná-los com a documentação, os pagamentos e as remessas existentes para que a entidade possa rever e confirmar o resultado.',
      },
      remittances: {
        title: 'Gestão completa de remessas de sócios e devoluções',
        description:
          'Quando a entidade recebe uma remessa agrupada do banco — por quotas de sócios ou contribuições periódicas — Summa Social permite decompor esta receita e colocar cada montante no seu lugar. A remessa deixa de ser um valor único e passa a ser o detalhe necessário para saber quem contribuiu o quê e quando.',
      },
      onlineDonations: {
        title: 'Registo e controlo de doações',
        description:
          'O Summa Social permite registar as doações, relacioná-las com cada pessoa e manter o histórico económico e fiscal organizado no mesmo sistema.',
      },
      fiscalCertificates: {
        title:
          'Preparação de modelos fiscais (182 e 347) e certificados de doação',
        description:
          'À medida que a informação económica é trabalhada com critério — receitas, despesas, remessas e devoluções — o Summa Social prepara os modelos fiscais e os certificados a partir dos dados ordenados para revisão antes da apresentação ou partilha.',
      },
      invoicesSepa: {
        title:
          'Leitura rápida assistida por IA de faturas, ordenados e elaboração de remessas de pagamentos SEPA',
        description:
          'Summa Social permite incorporar no sistema a documentação económica gerada no dia a dia da entidade — faturas, ordenados e outros documentos — simplesmente arrastando os ficheiros. Os dados relevantes são extraídos de forma inteligente e integram o fluxo administrativo, com critério e contexto desde o primeiro momento.',
      },
      ticketsSettlements: {
        title:
          'Captura de recibos e tickets com extração assistida de dados',
        description:
          'Quando a equipa da entidade faz deslocações, viagens ou atividades fora do escritório, Summa Social permite capturar imediatamente os recibos e tickets gerados. Uma simples fotografia do telemóvel é suficiente para que estes comprovativos fiquem registados no sistema, associados à pessoa e ao contexto.',
      },
      projects: {
        title: 'Módulo de Projetos opcional: execução orçamental e assistente de justificações',
        description:
          'Quando a entidade trabalha com projetos, a gestão económica requer uma leitura diferente: não só o que foi pago, mas a que projeto corresponde cada despesa e como se está a executar o orçamento aprovado.',
      },
    },
    readMore: 'Ler mais →',
    stats: {
      entities: '15+',
      entitiesLabel: 'entidades ativas',
      movements: '2.000+',
      movementsLabel: 'movimentos/mês',
      countries: '5',
      countriesLabel: 'países',
    },
    workflow: {
      title: 'Como funciona',
      lead: 'Do extrato bancário ao relatório fiscal, tudo no mesmo sistema.',
      step1: {
        title: 'Conecta',
        description: 'Importa extratos, faturas, folhas salariais e recibos em segundos. A Summa coloca cada dado no lugar certo desde o primeiro momento.',
      },
      step2: {
        title: 'Gere',
        description: 'Controla remessas de sócios e devoluções bancárias. Revê propostas de categorização e relaciona movimentos com contactos e documentos.',
      },
      step3: {
        title: 'Cumpre',
        description: 'Prepara os Modelos 182 e 347 e os certificados de doação para revisão. No plano Completo, controla também a execução económica e a multidivisa dentro dos projetos.',
      },
      step4: {
        title: 'Obtém',
        description:
          'Obtém relatórios automáticos para direções e patronatos com dados reais atualizados. Prepara ficheiros SEPA, folhas de liquidação e listagens ordenadas de despesas e faturas para fiscalidade e justificações.',
      },
    },
    systemOverview: {
      title: 'O que podes fazer com Summa Social',
      subtitle:
        'Summa Social traz ordem, controlo e tranquilidade à gestão económica das entidades de ação social e cooperação.',
    },
    capabilities: {
      title: 'O que podes fazer com Summa Social',
      conciliation: {
        title: 'Reconciliação bancária',
        description: 'Importa extratos e revê as propostas para relacionar movimentos e documentação.',
      },
      remittances: {
        title: 'Remessas e devoluções',
        description: 'Divide remessas agrupadas e gere devoluções com rastreabilidade.',
      },
      donations: {
        title: 'Doações e doadores',
        description: 'Regista doações e mantém cada contribuição relacionada com o respetivo doador.',
      },
      fiscal: {
        title: 'Fiscalidade e certificados',
        description: 'Modelos 182 e 347 e certificados de doação preparados para revisão.',
      },
    },
    blocks: HOME_BLOCKS_PT,
    profiles: {
      admin: {
        title: 'Para administradores e tesouraria',
        description: 'Controlo completo da gestão económica diária: reconciliação, remessas, despesas e documentação. Tudo num só lugar, com critério e sem complicações.',
      },
      projects: {
        title: 'Para gestores de projetos',
        description: 'Seguimento orçamental, imputação de despesas e XLSX estruturado com documentação agrupada para preparar a justificação.',
      },
    },
    whoWeAre: {
      title: 'Quem somos',
      lead: 'O Summa Social nasce da gestão real das entidades.',
      description:
        'É uma aplicação desenvolvida dentro do ecossistema da Semilla de Software Libre, a partir de experiência direta com organizações sociais, gestão económica, doadores, subsídios e justificações.',
      status: 'Origem e trajetória',
    },
    howWeWork: {
      title: 'Como trabalhamos',
      lead: 'Antes de ativar Summa Social para a vossa entidade, avaliamos em conjunto se encaixa com a vossa forma de trabalhar e quais são os vossos objetivos, para garantir uma adoção prática e útil.',
      paragraph1: 'Uma vez validada a adequação, acompanhamos-vos na implementação até que a ferramenta esteja operacional e seja confortável no dia a dia.',
      paragraph2: 'O nosso suporte está orientado para resolver dúvidas concretas e assegurar estabilidade no uso.',
      note: 'Trabalhamos com um número limitado de entidades para manter a qualidade do acompanhamento e preservar critério profissional.',
      cta: 'Falemos do vosso caso',
      imageAlt: 'Ilustração do processo de trabalho de Summa Social',
    },
    finalCta: {
      title: 'Queres organizar melhor a gestão económica da tua entidade?',
      subtitle:
        'Conta-nos como trabalham hoje e veremos se o Summa Social pode reduzir Excel, revisões manuais e duplicações.',
      cta: 'Entrar',
    },
  },
  features: {
    metaTitle: 'Summa Social | Funcionalidades',
    metaDescription:
      'Gestão económica e fiscal para entidades sociais pequenas e médias de Espanha. Reconciliação bancária, Modelo 182/347, remessas SEPA e mais.',
    back: 'Voltar',
    intro: {
      title: 'Summa Social',
      subtitle:
        'Gestão económica e fiscal para entidades pequenas e médias de Espanha, com reconciliação bancária e exports para o contabilista (Modelo 182 e 347).',
      tagline:
        'Summa Social traz ordem, controlo e tranquilidade à gestão económica das entidades sociais pequenas e médias.',
    },
    mainTitle: '15 Principais Funcionalidades do Summa Social',
    list: {
      conciliation: {
        title: '1. Reconciliação Bancária Assistida',
        description:
          'Importa o extrato bancário: o Summa Social deteta possíveis duplicados e permite rever e relacionar os movimentos com as operações registadas. Tudo fica rastreável por conta.',
        bullets: [
          'Importação de extratos (CSV, Excel, OFX) de qualquer banco',
          'Deteção automática de duplicados',
          'Suporte multi-conta com rastreabilidade completa',
          'Visão clara do estado de cada conta',
        ],
      },
      aiAssignment: {
        title: '2. Propostas de Categorização com IA',
        description:
          'Ao importar movimentos, o Summa Social propõe fornecedores, sócios, doadores, trabalhadores e categorias a partir dos dados disponíveis para revisão antes da confirmação.',
        bullets: [
          'Propostas por nome, IBAN ou NIF',
          'Proposta de categoria para revisão',
          'Memória de decisões anteriores',
          'Assistência com IA quando necessário',
        ],
      },
      remittancesDivider: {
        title: '3. Divisor de Remessas IN (Quotas de Sócios)',
        description:
          'Quando o banco te credita uma remessa agrupada das quotas que os sócios pagam, Summa Social decompõe-na automaticamente atribuindo cada montante ao sócio correspondente.',
        bullets: [
          'Decomposição automática por IBAN/NIF/Nome',
          'Deteção de quotas por pagar e remessas parciais',
          'Atribuição individual com histórico completo',
          'Visão clara de quem está em dia e quem não está',
        ],
      },
      expensesSepa: {
        title: '4. Gestor de Despesas e Ordenados com Gerador de Remessas SEPA',
        description:
          'Arrasta faturas e ordenados para o Summa Social, revê os dados extraídos com assistência de IA e gera uma remessa de pagamentos para carregar no banco.',
        ticketsNote:
          'Novidade: captura de tickets, viagens e quilometragem com liquidações em PDF regenerável.',
        bullets: [
          'Remessas de pagamento (SEPA) para faturas e ordenados',
          'Extração assistida de dados com IA',
          'Liquidações de tickets, viagens e quilometragem com PDF regenerável',
          'Ligação clara documento ↔ pagamento ↔ movimento bancário',
          'Quando entra o extrato: revisão e ligação com o movimento',
        ],
      },
      fiscal: {
        title: '5. Preparação Fiscal (Modelo 182 e 347)',
        description:
          'Prepara os ficheiros fiscais e as validações para revisão pela entidade ou pelo contabilista antes da apresentação.',
        bullets: [
          'Modelo 182 com validação de requisitos legais',
          'Preparação do Modelo 347',
          'Verificação de NIF e dados postais',
          'Exportação Excel para o contabilista',
        ],
      },
      donationCertificates: {
        title: '6. Certificados de Doação',
        bullets: [
          'Geração PDF com logo e assinatura digital',
          'Envio individual ou massivo por email',
          'Controlo completo de envios',
          'Conformidade RGPD automática',
        ],
      },
      movementClassification: {
        title: '7. Classificação de Movimentos com Memória',
        bullets: [
          'Categorias contabilísticas personalizáveis',
          'Propostas de categorização com IA',
          'Memória persistente',
          'Atribuição massiva por lotes',
        ],
      },
      dashboard: {
        title: '8. Dashboard Diretivo com Métricas em Tempo Real',
        bullets: [
          'Indicadores chave sempre visíveis',
          'Filtros por período',
          'Alertas priorizados',
          'Gráficos de evolução',
          'Export PDF de relatórios para direção/conselho',
        ],
      },
      multiContact: {
        title: '9. Gestão Multi-contacto com Tipologias',
        bullets: [
          'Doadores, sócios, fornecedores, trabalhadores e contrapartes',
          'Validação automática de NIF e IBANs',
          'Importação massiva com mapping flexível',
          'Estados operacionais',
        ],
      },
      bankReturns: {
        title: '10. Gestão de Devoluções Bancárias',
        bullets: [
          'Importador específico de devoluções',
          'Ligação manual com o doador',
          'Acompanhamento de quotas pendentes',
          'Devolução refletida na preparação do Modelo 182',
        ],
      },
      stripeIntegration: {
        title: '11. Registo e Histórico de Doações',
        bullets: [
          'Registo individual de doações',
          'Ligação à ficha do doador',
          'Histórico económico e fiscal',
          'Rastreabilidade de cada contribuição',
        ],
      },
      projectsModule: {
        title: '12. Módulo de Projetos e Subsídios',
        bullets: [
          'Execução vs orçamentado',
          'Atribuição parcial de despesas',
          'Captura fotográfica de despesas de terreno',
          'Export justificação (Excel + ZIP)',
          'Gestão multi-moeda',
        ],
      },
      multiOrg: {
        title: '13. Arquitetura Multi-organização com Segurança Europeia',
        bullets: [
          'Isolamento total de dados',
          'Papéis e permissões',
          'Conformidade RGPD',
          'Servidores UE',
        ],
      },
      exports: {
        title: '14. Exportação de Dados e Relatórios',
        bullets: [
          'Excel, CSV e PDF',
          'Modelos oficiais Autoridade Tributária',
          'Exports por contacto, projeto ou período',
        ],
      },
      alerts: {
        title: '15. Sistema de Alertas Inteligente',
        bullets: ['Alertas críticos e informativos', 'Links diretos para resolução', 'Priorização automática'],
      },
    },
    cta: 'Entrar no Summa Social',
  },
  updates: {
    metaTitle: 'Novidades | Summa Social',
    metaDescription: 'Descubra as últimas novidades e melhorias do Summa Social.',
    navLabel: 'Novidades',
    title: 'Novidades do produto',
    back: 'Voltar',
    noUpdates: 'Não há novidades publicadas.',
    readMore: 'Ler mais',
    viewAll: 'Ver todas as novidades',
    publishedAt: 'Publicado em',
    latestLabel: 'Novo no Summa',
    latestTitle: 'A última melhoria publicada',
    latestDescription:
      'Vamos publicando melhorias pequenas e úteis para que seja simples perceber o que mudou e como isso se nota no dia a dia.',
  },
  about: {
    metaTitle: 'Quem somos | Summa Social',
    metaDescription:
      'Conhece melhor o que é o Summa Social e porque estamos a construir uma ferramenta de gestão económica e fiscal para entidades de ação social e cooperação.',
  },
};

export const publicTranslations: Record<PublicLocale, PublicTranslations> = {
  ca,
  es,
  fr,
  pt,
};

/**
 * Obté les traduccions públiques per a un idioma donat.
 */
export function getPublicTranslations(locale: PublicLocale): PublicTranslations {
  return publicTranslations[locale];
}
