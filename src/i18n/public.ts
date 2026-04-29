/**
 * Traduccions per a les pàgines públiques (no requereixen autenticació).
 * Suporta ca/es/fr/pt.
 */

import type { PublicLocale } from '@/lib/public-locale';

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
    };
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
        'Classificació automàtica',
        'El sistema recorda com classifiques i ho aplica sol. Si no ho sap, la IA proposa.'
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
        'Importa les devolucions i el sistema les vincula al donant correcte.'
      ),
      sepaPayments: createCard(
        'Remeses SEPA de pagament',
        'Genera fitxers SEPA per pagar factures i nòmines des del banc.'
      ),
      stripeDonations: createCard(
        'Donacions online (Stripe)',
        'Les donacions web entren automàticament, separant donació i comissió.'
      ),
    },
  },
  fiscal: {
    title: 'Fiscalitat',
    subtitle: '',
    cards: {
      model182: createCard(
        'Model 182',
        'Donacions anuals llestes per enviar a la gestoria. Amb validació prèvia i alertes.'
      ),
      model347: createCard(
        'Model 347',
        'Proveïdors que superen el llindar, amb CIF validat.'
      ),
      donationCertificates: createCard(
        'Certificats de donació',
        'PDF individual o massiu, amb enviament per email automàtic.'
      ),
      cleanExcel: createCard(
        'Excel net per a la gestoria',
        'Tot en format estàndard, sense haver de retocar res.'
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
        'Excel de justificació + ZIP amb tots els comprovants, amb un clic.'
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
        'Clasificación automática',
        'El sistema recuerda cómo clasificas y lo aplica solo. Si no lo sabe, la IA propone.'
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
        'Importa las devoluciones y el sistema las vincula al donante correcto.'
      ),
      sepaPayments: createCard(
        'Remesas SEPA de pago',
        'Genera ficheros SEPA para pagar facturas y nóminas desde el banco.'
      ),
      stripeDonations: createCard(
        'Donaciones online (Stripe)',
        'Las donaciones web entran automáticamente, separando donación y comisión.'
      ),
    },
  },
  fiscal: {
    title: 'Fiscalidad',
    subtitle: '',
    cards: {
      model182: createCard(
        'Modelo 182',
        'Donaciones anuales listas para enviar a la gestoría. Con validación previa y alertas.'
      ),
      model347: createCard(
        'Modelo 347',
        'Proveedores que superan el umbral, con CIF validado.'
      ),
      donationCertificates: createCard(
        'Certificados de donación',
        'PDF individual o masivo, con envío por email automático.'
      ),
      cleanExcel: createCard(
        'Excel limpio para la gestoría',
        'Todo en formato estándar, sin tener que retocar nada.'
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
        'Excel de justificación + ZIP con todos los comprobantes, con un clic.'
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
        'Classification automatique',
        "Le système retient comment vous classez et l'applique seul. S'il ne sait pas, l'IA propose."
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
        'Importez les rejets et le système les rattache au donateur concerné.'
      ),
      sepaPayments: createCard(
        'Remises SEPA de paiement',
        'Générez des fichiers SEPA pour payer factures et salaires depuis la banque.'
      ),
      stripeDonations: createCard(
        'Dons en ligne (Stripe)',
        'Les dons web entrent automatiquement, en séparant don et commission.'
      ),
    },
  },
  fiscal: {
    title: 'Fiscalité',
    subtitle: '',
    cards: {
      model182: createCard(
        'Modèle 182',
        'Dons annuels prêts à envoyer au cabinet comptable. Avec validation préalable et alertes.'
      ),
      model347: createCard(
        'Modèle 347',
        'Fournisseurs dépassant le seuil, avec NIF validé.'
      ),
      donationCertificates: createCard(
        'Certificats de don',
        'PDF individuel ou en lot, avec envoi par email automatique.'
      ),
      cleanExcel: createCard(
        'Excel propre pour le comptable',
        'Tout en format standard, sans avoir à retoucher.'
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
        'Excel de justification + ZIP avec toutes les pièces, en un clic.'
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
        'Classificação automática',
        'O sistema lembra como classificas e aplica sozinho. Se não souber, a IA propõe.'
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
        'Importa as devoluções e o sistema liga-as ao doador correto.'
      ),
      sepaPayments: createCard(
        'Remessas SEPA de pagamento',
        'Gera ficheiros SEPA para pagar faturas e ordenados a partir do banco.'
      ),
      stripeDonations: createCard(
        'Doações online (Stripe)',
        'As doações web entram automaticamente, separando doação e comissão.'
      ),
    },
  },
  fiscal: {
    title: 'Fiscalidade',
    subtitle: '',
    cards: {
      model182: createCard(
        'Modelo 182',
        'Doações anuais prontas para enviar ao contabilista. Com validação prévia e alertas.'
      ),
      model347: createCard(
        'Modelo 347',
        'Fornecedores que ultrapassam o limiar, com NIF validado.'
      ),
      donationCertificates: createCard(
        'Certificados de doação',
        'PDF individual ou em lote, com envio por email automático.'
      ),
      cleanExcel: createCard(
        'Excel limpo para o contabilista',
        'Tudo em formato padrão, sem ter de retocar nada.'
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
        'Excel de justificação + ZIP com todos os comprovativos, com um clique.'
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
    updatedAt: 'Març 2026',
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
    title: 'Parlem de la teva entitat',
    subtitle: 'Si vols veure si Summa Social encaixa amb la teva ONG, escriu-nos.',
    description:
      'Ens agrada entendre primer la realitat de cada entitat abans de proposar res.',
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
      helper: "Explica'ns el teu cas i et respondrem per correu.",
    },
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
      onlineDonations: 'Donacions online',
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
        "Conciliació bancària senzilla i ràpida: Importes l'extracte i en pocs minuts tens tots els moviments classificats, sense errors de transcripció. La intel·ligència artificial reconeix automàticament proveïdors, socis i donants.",
      fiscal:
        "Fiscalitat a temps real, sense esforç: Models 182 i 347 amb un clic. Certificats de donació generats i enviats automàticament. Tot validat i llest per enviar a la gestoria o l'AEAT.",
      remittances:
        'Remeses de quotes i pagaments en pocs segons: Divideix automàticament les remeses agrupades del banc. Genera fitxers SEPA per pagaments a proveïdors i nòmines. Fàcil, ràpid i sense errors.',
      vision:
        "Visió clara i actualitzada: Dashboard amb mètriques en temps real. Ingressos, despeses, balanç i alertes, tot visible d'un cop d'ull. Informes automàtics per a junta o patronat.",
      control:
        "Control absolut de cada euro: Trazabilitat completa des del comprovant fins al moviment bancari. Justificació de subvencions amb un clic: Excel + totes les factures en un ZIP.",
      result:
        "El resultat: més temps per a la missió de l'entitat, menys temps amb fulls de càlcul i tasques repetitives. Gestió econòmica professional, accessible i sense complicacions.",
    },
    sections: {
      conciliation: {
        title: 'Conciliació bancària automàtica i seguiment de comptes',
        description:
          "Quan s'importa l'extracte bancari, Summa Social posa en relació el que ja s'ha treballat prèviament amb el que reflecteix el banc. Els moviments es reconcilien amb la documentació, els pagaments i les remeses existents, tot evitant duplicats i errors de transcripció.",
      },
      remittances: {
        title: 'Gestió completa de remeses de socis i devolucions',
        description:
          "Quan l'entitat rep una remesa agrupada del banc —per quotes de socis o aportacions periòdiques— Summa Social permet desglossar aquest ingrés i situar cada import en el seu lloc. La remesa deixa de ser una xifra única i passa a convertir-se en el detall necessari per saber qui ha aportat què i en quin moment.",
      },
      onlineDonations: {
        title: 'Registre i control acurat de donacions online i ingressos web',
        description:
          "Quan l'entitat rep donacions a través del web, els ingressos arriben al compte de forma agrupada. Summa Social permet incorporar aquests ingressos al sistema, identificar cada donació individual i situar-la dins del conjunt de la gestió econòmica, mantenint el vincle amb la persona que ha fet l'aportació.",
      },
      fiscalCertificates: {
        title:
          'Elaboració i enviament en un click de models fiscals (182 i 347) i certificats de donació',
        description:
          "A mesura que la informació econòmica s'ha anat treballant amb criteri —ingressos, despeses, remeses i devolucions— la fiscalitat deixa de ser un exercici de reconstrucció. Summa Social permet generar els models fiscals i els certificats de donació a partir del que ja està ordenat i verificat dins del sistema.",
      },
      invoicesSepa: {
        title:
          'Lectura ràpida assistida amb IA de factures, nòmines i elaboració de remeses de pagaments SEPA',
        description:
          "Summa Social permet incorporar al sistema la documentació econòmica que es genera en el dia a dia de l'entitat —factures, nòmines i altres documents— simplement arrossegant els fitxers. Les dades rellevants s'extreuen de manera intel·ligent i passen a formar part del flux administratiu, amb criteri i context des del primer moment.",
      },
      ticketsSettlements: {
        title:
          "Captura d'imatges de rebuts i tiquets de viatge, i elaboració automàtica de liquidacions",
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
        description: 'Controla remeses de socis, devolucions bancàries i cobraments Stripe. Concilia moviments i categoritza ingressos i despeses amb assistència automàtica.',
      },
      step3: {
        title: 'Compleix',
        description: "Genera Model 182, 347 i certificats de donació amb enviament directe des de l'app. Controla també l'execució econòmica dels projectes, inclús en cooperació i amb diverses monedes.",
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
        description: 'Importa extractes i concilia automàticament amb la documentació existent.',
      },
      remittances: {
        title: 'Remeses i devolucions',
        description: 'Divideix remeses agrupades i gestiona devolucions amb traçabilitat.',
      },
      donations: {
        title: 'Donacions online',
        description: 'Integra Stripe i altres passarel·les per registrar donacions web.',
      },
      fiscal: {
        title: 'Fiscalitat i certificats',
        description: 'Model 182, 347 i certificats de donació generats automàticament.',
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
        description: "Seguiment de l'execució pressupostària, justificació de subvencions i exportació completa amb un clic. Excel + factures en ZIP.",
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
        title: '1. Conciliació Bancària Automàtica',
        description:
          "Importes l'extracte del banc i Summa Social trova automàticament els moviments duplicats i els enllaça amb les operacions que ja tens registrades. Tot queda traçable per compte bancari.",
        bullets: [
          "Importació d'extractes (CSV, Excel, OFX) de qualsevol banc",
          'Detecció automàtica de duplicats',
          'Suport multi-compte amb trazabilitat completa',
          "Visió clara de l'estat de cada compte",
        ],
      },
      aiAssignment: {
        title: '2. Auto-assignació Intel·ligent amb IA',
        description:
          "Quan importes moviments, Summa Social reconeix automàticament els teus proveïdors, socis, donants i treballadors. La intel·ligència artificial intervé quan cal, aprenen de les teves decisions anteriors i cada cop és més intel·ligent.",
        bullets: [
          'Reconeixement automàtic per nom, IBAN o DNI',
          'Assignació automàtica de categoria per defecte',
          'Memòria de decisions anteriors',
          'Aprenentatge progressiu amb IA',
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
          "Arrossega ràpidament factures i nòmines a Summa Social, confirma les dades que s'extreuen automàticament (IA) i genera una remesa de pagaments per pujar al banc.",
        ticketsNote:
          'Novetat: captura de tiquets, viatges i quilometratge amb liquidacions automàtiques en PDF.',
        bullets: [
          'Remeses de pagament (SEPA) per factures i nòmines',
          'Extracció automàtica de dades amb IA',
          'Liquidacions de tiquets, viatges i quilometratge amb PDF regenerable',
          'Enllaç clar document ↔ pagament ↔ moviment bancari',
          "Quan entra l'extracte: conciliació automàtica",
        ],
      },
      fiscal: {
        title: '5. Gestió Fiscal Automatitzada (Model 182 i 347)',
        description:
          'Genera els fitxers per Hisenda amb validació prèvia i formats llestos per enviar a la gestoria.',
        bullets: [
          'Model 182 amb validació de requisits legals',
          'Model 347 automàtic',
          'Comprovació de CIF/DNI/NIE i dades postals',
          'Exportació Excel per a la gestoria',
        ],
      },
      donationCertificates: {
        title: '6. Certificats de Donació Automàtics',
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
          'Auto-categorització intel·ligent amb IA',
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
          'Matching automàtic amb el donant',
          'Seguiment de quotes pendents',
          'Exclusió automàtica del Model 182',
        ],
      },
      stripeIntegration: {
        title: '11. Integració Stripe per Donacions Online',
        bullets: [
          'Separació donació vs comissió',
          'Matching per email',
          'Creació automàtica de donants',
          'Trazabilitat completa',
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
    metaTitle: 'Novetats | Summa Social',
    metaDescription: 'Descobreix les últimes novetats i millores de Summa Social.',
    navLabel: 'Novetats',
    title: 'Novetats del producte',
    back: 'Tornar',
    noUpdates: 'No hi ha novetats publicades.',
    readMore: 'Llegir més',
    viewAll: 'Veure totes les novetats',
    publishedAt: 'Publicat el',
    latestLabel: 'Nou a Summa',
    latestTitle: 'L’última millora publicada',
    latestDescription:
      'Anem publicant millores petites i útils perquè sigui fàcil entendre què canvia i com es notarà en el dia a dia.',
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
    updatedAt: 'Marzo 2026',
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
    title: 'Hablemos de tu entidad',
    subtitle: 'Si quieres ver si Summa Social encaja con tu ONG, escríbenos.',
    description:
      'Nos gusta entender primero la realidad de cada entidad antes de proponer nada.',
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
      helper: 'Cuéntanos tu caso y te responderemos por correo.',
    },
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
      onlineDonations: 'Donaciones online',
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
        'Conciliación bancaria sencilla y rápida: Importas el extracto y en pocos minutos tienes todos los movimientos clasificados, sin errores de transcripción. La inteligencia artificial reconoce automáticamente proveedores, socios y donantes.',
      fiscal:
        'Fiscalidad en tiempo real, sin esfuerzo: Modelos 182 y 347 con un clic. Certificados de donación generados y enviados automáticamente. Todo validado y listo para enviar a la gestoría o la AEAT.',
      remittances:
        'Remesas de cuotas y pagos en pocos segundos: Divide automáticamente las remesas agrupadas del banco. Genera ficheros SEPA para pagos a proveedores y nóminas. Fácil, rápido y sin errores.',
      vision:
        'Visión clara y actualizada: Dashboard con métricas en tiempo real. Ingresos, gastos, balance y alertas, todo visible de un vistazo. Informes automáticos para junta o patronato.',
      control:
        'Control absoluto de cada euro: Trazabilidad completa desde el comprobante hasta el movimiento bancario. Justificación de subvenciones con un clic: Excel + todas las facturas en un ZIP.',
      result:
        'El resultado: más tiempo para la misión de la entidad, menos tiempo con hojas de cálculo y tareas repetitivas. Gestión económica profesional, accesible y sin complicaciones.',
    },
    sections: {
      conciliation: {
        title: 'Conciliación bancaria automática y seguimiento de cuentas',
        description:
          'Cuando se importa el extracto bancario, Summa Social pone en relación lo que ya se ha trabajado previamente con lo que refleja el banco. Los movimientos se reconcilian con la documentación, los pagos y las remesas existentes, evitando duplicados y errores de transcripción.',
      },
      remittances: {
        title: 'Gestión completa de remesas de socios y devoluciones',
        description:
          'Cuando la entidad recibe una remesa agrupada del banco —por cuotas de socios o aportaciones periódicas— Summa Social permite desglosar este ingreso y situar cada importe en su lugar. La remesa deja de ser una cifra única y pasa a convertirse en el detalle necesario para saber quién ha aportado qué y en qué momento.',
      },
      onlineDonations: {
        title: 'Registro y control preciso de donaciones online e ingresos web',
        description:
          'Cuando la entidad recibe donaciones a través de la web, los ingresos llegan a la cuenta de forma agrupada. Summa Social permite incorporar estos ingresos al sistema, identificar cada donación individual y situarla dentro del conjunto de la gestión económica, manteniendo el vínculo con la persona que ha hecho la aportación.',
      },
      fiscalCertificates: {
        title:
          'Elaboración y envío en un clic de modelos fiscales (182 y 347) y certificados de donación',
        description:
          'A medida que la información económica se ha ido trabajando con criterio —ingresos, gastos, remesas y devoluciones— la fiscalidad deja de ser un ejercicio de reconstrucción. Summa Social permite generar los modelos fiscales y los certificados de donación a partir de lo que ya está ordenado y verificado dentro del sistema.',
      },
      invoicesSepa: {
        title:
          'Lectura rápida asistida con IA de facturas, nóminas y elaboración de remesas de pagos SEPA',
        description:
          'Summa Social permite incorporar al sistema la documentación económica que se genera en el día a día de la entidad —facturas, nóminas y otros documentos— simplemente arrastrando los ficheros. Los datos relevantes se extraen de manera inteligente y pasan a formar parte del flujo administrativo, con criterio y contexto desde el primer momento.',
      },
      ticketsSettlements: {
        title:
          'Captura de imágenes de recibos y tickets de viaje, y elaboración automática de liquidaciones',
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
        description: 'Controla remesas de socios, devoluciones bancarias y cobros Stripe. Concilia movimientos y categoriza ingresos y gastos con asistencia automática.',
      },
      step3: {
        title: 'Cumple',
        description: 'Genera Modelo 182, 347 y certificados de donación con envío directo desde la app. Controla también la ejecución económica de los proyectos, incluso en cooperación y con varias monedas.',
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
        description: 'Importa extractos y concilia automáticamente con la documentación existente.',
      },
      remittances: {
        title: 'Remesas y devoluciones',
        description: 'Divide remesas agrupadas y gestiona devoluciones con trazabilidad.',
      },
      donations: {
        title: 'Donaciones online',
        description: 'Integra Stripe y otras pasarelas para registrar donaciones web.',
      },
      fiscal: {
        title: 'Fiscalidad y certificados',
        description: 'Modelo 182, 347 y certificados de donación generados automáticamente.',
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
        description: 'Seguimiento de la ejecución presupuestaria, justificación de subvenciones y exportación completa con un clic. Excel + facturas en ZIP.',
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
        title: '1. Conciliación Bancaria Automática',
        description:
          'Importas el extracto del banco y Summa Social encuentra automáticamente los movimientos duplicados y los enlaza con las operaciones que ya tienes registradas. Todo queda trazable por cuenta bancaria.',
        bullets: [
          'Importación de extractos (CSV, Excel, OFX) de cualquier banco',
          'Detección automática de duplicados',
          'Soporte multi-cuenta con trazabilidad completa',
          'Visión clara del estado de cada cuenta',
        ],
      },
      aiAssignment: {
        title: '2. Auto-asignación Inteligente con IA',
        description:
          'Cuando importas movimientos, Summa Social reconoce automáticamente tus proveedores, socios, donantes y trabajadores. La inteligencia artificial interviene cuando es necesario, aprende de tus decisiones anteriores y cada vez es más inteligente.',
        bullets: [
          'Reconocimiento automático por nombre, IBAN o DNI',
          'Asignación automática de categoría por defecto',
          'Memoria de decisiones anteriores',
          'Aprendizaje progresivo con IA',
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
          'Arrastra rápidamente facturas y nóminas a Summa Social, confirma los datos que se extraen automáticamente (IA) y genera una remesa de pagos para subir al banco.',
        ticketsNote:
          'Novedad: captura de tickets, viajes y kilometraje con liquidaciones automáticas en PDF.',
        bullets: [
          'Remesas de pago (SEPA) para facturas y nóminas',
          'Extracción automática de datos con IA',
          'Liquidaciones de tickets, viajes y kilometraje con PDF regenerable',
          'Enlace claro documento ↔ pago ↔ movimiento bancario',
          'Cuando entra el extracto: conciliación automática',
        ],
      },
      fiscal: {
        title: '5. Gestión Fiscal Automatizada (Modelo 182 y 347)',
        description:
          'Genera los ficheros para Hacienda con validación previa y formatos listos para enviar a la gestoría.',
        bullets: [
          'Modelo 182 con validación de requisitos legales',
          'Modelo 347 automático',
          'Comprobación de CIF/DNI/NIE y datos postales',
          'Exportación Excel para la gestoría',
        ],
      },
      donationCertificates: {
        title: '6. Certificados de Donación Automáticos',
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
          'Auto-categorización inteligente con IA',
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
          'Matching automático con el donante',
          'Seguimiento de cuotas pendientes',
          'Exclusión automática del Modelo 182',
        ],
      },
      stripeIntegration: {
        title: '11. Integración Stripe para Donaciones Online',
        bullets: [
          'Separación donación vs comisión',
          'Matching por email',
          'Creación automática de donantes',
          'Trazabilidad completa',
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
    metaTitle: 'Novedades | Summa Social',
    metaDescription: 'Descubre las últimas novedades y mejoras de Summa Social.',
    navLabel: 'Novedades',
    title: 'Novedades del producto',
    back: 'Volver',
    noUpdates: 'No hay novedades publicadas.',
    readMore: 'Leer más',
    viewAll: 'Ver todas las novedades',
    publishedAt: 'Publicado el',
    latestLabel: 'Nuevo en Summa',
    latestTitle: 'La última mejora publicada',
    latestDescription:
      'Vamos publicando mejoras pequeñas y útiles para que sea fácil entender qué cambia y cómo se notará en el día a día.',
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
    updatedAt: 'Mars 2026',
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
    title: 'Parlons de votre organisation',
    subtitle: 'Si vous voulez voir si Summa Social convient à votre association, écrivez-nous.',
    description:
      'Nous préférons comprendre la réalité de chaque organisation avant de proposer quoi que ce soit.',
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
      helper: 'Expliquez-nous votre situation et nous vous répondrons par email.',
    },
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
      onlineDonations: 'Dons en ligne',
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
        "Contrôle absolu de chaque euro : Traçabilité complète du justificatif au mouvement bancaire. Justification de subventions en un clic : Excel + toutes les factures en ZIP.",
      result:
        "Le résultat : plus de temps pour la mission de l'association, moins de temps avec les tableurs et les tâches répétitives. Gestion économique professionnelle, accessible et sans complications.",
    },
    sections: {
      conciliation: {
        title: 'Rapprochement bancaire automatique et suivi des comptes',
        description:
          "Quand on importe le relevé bancaire, Summa Social met en relation ce qui a déjà été traité avec ce que reflète la banque. Les mouvements sont rapprochés avec la documentation, les paiements et les prélèvements existants, évitant les doublons et les erreurs de transcription.",
      },
      remittances: {
        title: 'Gestion complète des prélèvements adhérents et des rejets',
        description:
          "Quand l'association reçoit un prélèvement groupé de la banque — pour les cotisations ou contributions périodiques — Summa Social permet de décomposer ce revenu et de placer chaque montant à sa place. Le prélèvement cesse d'être un chiffre unique pour devenir le détail nécessaire pour savoir qui a contribué quoi et quand.",
      },
      onlineDonations: {
        title: 'Enregistrement et contrôle précis des dons en ligne et revenus web',
        description:
          "Quand l'association reçoit des dons via le web, les revenus arrivent au compte de façon groupée. Summa Social permet d'incorporer ces revenus au système, d'identifier chaque don individuel et de le situer dans l'ensemble de la gestion économique, en maintenant le lien avec la personne qui a fait la contribution.",
      },
      fiscalCertificates: {
        title:
          'Élaboration et envoi en un clic des modèles fiscaux (182 et 347) et certificats de don',
        description:
          "Au fur et à mesure que l'information économique a été travaillée avec rigueur — revenus, dépenses, prélèvements et rejets — la fiscalité cesse d'être un exercice de reconstruction. Summa Social permet de générer les modèles fiscaux et les certificats de don à partir de ce qui est déjà ordonné et vérifié dans le système.",
      },
      invoicesSepa: {
        title:
          'Lecture rapide assistée par IA de factures, fiches de paie et élaboration de virements SEPA',
        description:
          "Summa Social permet d'incorporer au système la documentation économique générée au quotidien de l'association — factures, fiches de paie et autres documents — simplement en glissant les fichiers. Les données pertinentes sont extraites intelligemment et intègrent le flux administratif, avec rigueur et contexte dès le premier moment.",
      },
      ticketsSettlements: {
        title:
          "Capture d'images de reçus et tickets de voyage, et élaboration automatique de notes de frais",
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
        description: 'Contrôlez prélèvements membres, rejets bancaires et encaissements Stripe. Rapprochez les mouvements et catégorisez recettes et dépenses avec assistance automatique.',
      },
      step3: {
        title: 'Conformez',
        description: "Générez les modèles 182, 347 et les certificats de don avec envoi direct depuis l'app. Suivez aussi l'exécution économique des projets, y compris en coopération et en multi-devises.",
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
        description: 'Importez des extraits et rapprochez automatiquement avec la documentation existante.',
      },
      remittances: {
        title: 'Prélèvements et rejets',
        description: 'Divisez les prélèvements groupés et gérez les rejets avec traçabilité.',
      },
      donations: {
        title: 'Dons en ligne',
        description: "Intégrez Stripe et d'autres passerelles pour enregistrer les dons web.",
      },
      fiscal: {
        title: 'Fiscalité et certificats',
        description: 'Modèle 182, 347 et certificats de don générés automatiquement.',
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
        description: "Suivi de l'exécution budgétaire, justification des subventions et export complet en un clic. Excel + factures en ZIP.",
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
        title: '1. Rapprochement Bancaire Automatique',
        description:
          'Importez le relevé de la banque et Summa Social trouve automatiquement les mouvements en double et les lie aux opérations déjà enregistrées. Tout reste traçable par compte bancaire.',
        bullets: [
          "Importation de relevés (CSV, Excel, OFX) de n'importe quelle banque",
          'Détection automatique des doublons',
          'Support multi-compte avec traçabilité complète',
          "Vision claire de l'état de chaque compte",
        ],
      },
      aiAssignment: {
        title: '2. Affectation Intelligente avec IA',
        description:
          "Quand vous importez des mouvements, Summa Social reconnaît automatiquement vos fournisseurs, adhérents, donateurs et employés. L'intelligence artificielle intervient quand nécessaire, apprend de vos décisions antérieures et devient de plus en plus intelligente.",
        bullets: [
          'Reconnaissance automatique par nom, IBAN ou NIF',
          'Affectation automatique de catégorie par défaut',
          'Mémoire des décisions antérieures',
          'Apprentissage progressif avec IA',
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
          'Glissez rapidement factures et fiches de paie dans Summa Social, confirmez les données extraites automatiquement (IA) et générez un virement à télécharger sur la banque.',
        ticketsNote:
          'Nouveauté : capture de tickets, voyages et kilométrage avec notes de frais automatiques en PDF.',
        bullets: [
          'Virements de paiement (SEPA) pour factures et salaires',
          'Extraction automatique de données avec IA',
          'Notes de frais pour tickets, voyages et kilométrage avec PDF régénérable',
          'Lien clair document ↔ paiement ↔ mouvement bancaire',
          'Quand le relevé arrive : rapprochement automatique',
        ],
      },
      fiscal: {
        title: '5. Gestion Fiscale Automatisée (Modèle 182 et 347)',
        description:
          "Génère les fichiers pour l'administration fiscale avec validation préalable et formats prêts à envoyer au comptable.",
        bullets: [
          'Modèle 182 avec validation des exigences légales',
          'Modèle 347 automatique',
          'Vérification de NIF et données postales',
          'Exportation Excel pour le comptable',
        ],
      },
      donationCertificates: {
        title: '6. Certificats de Don Automatiques',
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
          'Auto-catégorisation intelligente avec IA',
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
          'Matching automatique avec le donateur',
          'Suivi des cotisations en attente',
          'Exclusion automatique du Modèle 182',
        ],
      },
      stripeIntegration: {
        title: '11. Intégration Stripe pour Dons en Ligne',
        bullets: [
          'Séparation don vs commission',
          'Matching par email',
          'Création automatique de donateurs',
          'Traçabilité complète',
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
    updatedAt: 'Março 2026',
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
    title: 'Falemos da sua organização',
    subtitle: 'Se quiser perceber se o Summa Social encaixa na sua ONG, escreva-nos.',
    description:
      'Preferimos compreender primeiro a realidade de cada entidade antes de propor seja o que for.',
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
      helper: 'Explique-nos o seu caso e responderemos por email.',
    },
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
      onlineDonations: 'Doações online',
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
        'Controlo absoluto de cada euro: Rastreabilidade completa do comprovativo ao movimento bancário. Justificação de subsídios com um clique: Excel + todas as faturas num ZIP.',
      result:
        'O resultado: mais tempo para a missão da entidade, menos tempo com folhas de cálculo e tarefas repetitivas. Gestão económica profissional, acessível e sem complicações.',
    },
    sections: {
      conciliation: {
        title: 'Reconciliação bancária automática e acompanhamento de contas',
        description:
          'Quando se importa o extrato bancário, Summa Social relaciona o que já foi trabalhado previamente com o que reflete o banco. Os movimentos são reconciliados com a documentação, os pagamentos e as remessas existentes, evitando duplicados e erros de transcrição.',
      },
      remittances: {
        title: 'Gestão completa de remessas de sócios e devoluções',
        description:
          'Quando a entidade recebe uma remessa agrupada do banco — por quotas de sócios ou contribuições periódicas — Summa Social permite decompor esta receita e colocar cada montante no seu lugar. A remessa deixa de ser um valor único e passa a ser o detalhe necessário para saber quem contribuiu o quê e quando.',
      },
      onlineDonations: {
        title: 'Registo e controlo preciso de doações online e receitas web',
        description:
          'Quando a entidade recebe doações através da web, as receitas chegam à conta de forma agrupada. Summa Social permite incorporar estas receitas no sistema, identificar cada doação individual e situá-la no conjunto da gestão económica, mantendo a ligação com a pessoa que fez a contribuição.',
      },
      fiscalCertificates: {
        title:
          'Elaboração e envio num clique de modelos fiscais (182 e 347) e certificados de doação',
        description:
          'À medida que a informação económica foi trabalhada com critério — receitas, despesas, remessas e devoluções — a fiscalidade deixa de ser um exercício de reconstrução. Summa Social permite gerar os modelos fiscais e os certificados de doação a partir do que já está ordenado e verificado no sistema.',
      },
      invoicesSepa: {
        title:
          'Leitura rápida assistida por IA de faturas, ordenados e elaboração de remessas de pagamentos SEPA',
        description:
          'Summa Social permite incorporar no sistema a documentação económica gerada no dia a dia da entidade — faturas, ordenados e outros documentos — simplesmente arrastando os ficheiros. Os dados relevantes são extraídos de forma inteligente e integram o fluxo administrativo, com critério e contexto desde o primeiro momento.',
      },
      ticketsSettlements: {
        title:
          'Captura de imagens de recibos e tickets de viagem, e elaboração automática de liquidações',
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
        description: 'Controla remessas de sócios, devoluções bancárias e cobranças Stripe. Reconcilia movimentos e categoriza receitas e despesas com assistência automática.',
      },
      step3: {
        title: 'Cumpre',
        description: 'Gera Modelo 182, 347 e certificados de doação com envio direto a partir da app. Controla também a execução económica dos projetos, incluindo cooperação e várias moedas.',
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
        description: 'Importa extratos e reconcilia automaticamente com a documentação existente.',
      },
      remittances: {
        title: 'Remessas e devoluções',
        description: 'Divide remessas agrupadas e gere devoluções com rastreabilidade.',
      },
      donations: {
        title: 'Doações online',
        description: 'Integra Stripe e outras gateways para registar doações web.',
      },
      fiscal: {
        title: 'Fiscalidade e certificados',
        description: 'Modelo 182, 347 e certificados de doação gerados automaticamente.',
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
        description: 'Seguimento da execução orçamental, justificação de subsídios e exportação completa com um clique. Excel + faturas em ZIP.',
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
        title: '1. Reconciliação Bancária Automática',
        description:
          'Importa o extrato do banco e Summa Social encontra automaticamente os movimentos duplicados e liga-os às operações já registadas. Tudo fica rastreável por conta bancária.',
        bullets: [
          'Importação de extratos (CSV, Excel, OFX) de qualquer banco',
          'Deteção automática de duplicados',
          'Suporte multi-conta com rastreabilidade completa',
          'Visão clara do estado de cada conta',
        ],
      },
      aiAssignment: {
        title: '2. Atribuição Inteligente com IA',
        description:
          'Quando importas movimentos, Summa Social reconhece automaticamente os teus fornecedores, sócios, doadores e trabalhadores. A inteligência artificial intervém quando necessário, aprende das tuas decisões anteriores e fica cada vez mais inteligente.',
        bullets: [
          'Reconhecimento automático por nome, IBAN ou NIF',
          'Atribuição automática de categoria por defeito',
          'Memória de decisões anteriores',
          'Aprendizagem progressiva com IA',
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
          'Arrasta rapidamente faturas e ordenados para o Summa Social, confirma os dados extraídos automaticamente (IA) e gera uma remessa de pagamentos para carregar no banco.',
        ticketsNote:
          'Novidade: captura de tickets, viagens e quilometragem com liquidações automáticas em PDF.',
        bullets: [
          'Remessas de pagamento (SEPA) para faturas e ordenados',
          'Extração automática de dados com IA',
          'Liquidações de tickets, viagens e quilometragem com PDF regenerável',
          'Ligação clara documento ↔ pagamento ↔ movimento bancário',
          'Quando entra o extrato: reconciliação automática',
        ],
      },
      fiscal: {
        title: '5. Gestão Fiscal Automatizada (Modelo 182 e 347)',
        description:
          'Gera os ficheiros para a Autoridade Tributária com validação prévia e formatos prontos para enviar ao contabilista.',
        bullets: [
          'Modelo 182 com validação de requisitos legais',
          'Modelo 347 automático',
          'Verificação de NIF e dados postais',
          'Exportação Excel para o contabilista',
        ],
      },
      donationCertificates: {
        title: '6. Certificados de Doação Automáticos',
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
          'Auto-categorização inteligente com IA',
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
          'Matching automático com o doador',
          'Acompanhamento de quotas pendentes',
          'Exclusão automática do Modelo 182',
        ],
      },
      stripeIntegration: {
        title: '11. Integração Stripe para Doações Online',
        bullets: [
          'Separação doação vs comissão',
          'Matching por email',
          'Criação automática de doadores',
          'Rastreabilidade completa',
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
