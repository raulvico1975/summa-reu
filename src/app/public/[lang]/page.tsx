import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { PublicFeaturesExplorer, type PublicFeaturesExplorerSection } from '@/components/public/PublicFeaturesExplorer';
import { PublicDirectContact } from '@/components/public/PublicDirectContact';
import { PublicEditorialMark } from '@/components/public/PublicEditorialMark';
import { PublicHeroParticles } from '@/components/public/PublicHeroParticles';
import { PUBLIC_SHELL_X, PUBLIC_WIDE_SHELL } from '@/components/public/public-shell';
import { RotatingHeroPhrase } from '@/components/public/RotatingHeroPhrase';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, Upload, Settings, FileCheck, Download } from 'lucide-react';
import {
  PUBLIC_LOCALES,
  isValidPublicLocale,
  generatePublicPageMetadata,
  type PublicLocale,
} from '@/lib/public-locale';
import { SUPPORT_EMAIL } from '@/lib/constants';
import { getPublicTranslations } from '@/i18n/public';
import { type PublicLandingHeroMedia } from '@/lib/public-landings';
import { getPublicFeaturesHref } from '@/lib/public-site-paths';

const surfaceClass =
  'rounded-[1.75rem] border border-border/60 bg-white/90 shadow-[0_22px_60px_-40px_rgba(15,23,42,0.18)] backdrop-blur';

const SURFACE_CLASS = surfaceClass;

const HERO_ROTATING_SEGMENTS: Record<PublicLocale, string> = {
  ca: 'donacions, quotes i informes fiscals',
  es: 'donaciones, cuotas e informes fiscales',
  fr: 'dons, cotisations et rapports fiscaux',
  pt: 'doações, quotas e relatórios fiscais',
};

const HERO_ROTATING_PHRASES: Record<PublicLocale, string[]> = {
  ca: ['donacions', 'quotes', 'informes fiscals'],
  es: ['donaciones', 'cuotas', 'informes fiscales'],
  fr: ['dons', 'cotisations', 'rapports fiscaux'],
  pt: ['doações', 'quotas', 'relatórios fiscais'],
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
      'Conciliació bancària, remeses, devolucions i Model 182 en un sol sistema.',
    valueRailIntro: {
      eyebrow: 'On et treu feina',
      title: 'El control econòmic que et treu hores de banc, quotes i justificacions',
    },
    valueRail: {
      conciliation: {
        title: 'Importa l’extracte bancari',
        description: 'El moviment entra al sistema amb compte, data i import llestos per treballar.',
      },
      remittances: {
        title: 'Relaciona moviments, contactes i documents',
        description: 'Cada cobrament o despesa queda connectat amb la seva fitxa i suport.',
      },
      fiscal: {
        title: 'Prepara la fiscalitat sense reconstruir dades',
        description: 'Quan arriba el 182 o un certificat, la base econòmica ja està ordenada.',
      },
      projects: {
        title: 'Segueix i justifica projectes de cooperació',
        description:
          'Quan hi ha subvencions o cooperació, feu seguiment pressupostari, relacioneu despesa i prepareu la justificació sense separar la part econòmica del projecte.',
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
      'Conciliación bancaria, remesas, devoluciones y Modelo 182 en un solo sistema.',
    valueRailIntro: {
      eyebrow: 'Dónde te ahorra trabajo',
      title: 'El control económico que te quita horas de banco, cuotas y justificaciones',
    },
    valueRail: {
      conciliation: {
        title: 'Importa el extracto bancario',
        description: 'El movimiento entra en el sistema con cuenta, fecha e importe listos para trabajar.',
      },
      remittances: {
        title: 'Relaciona movimientos, contactos y documentos',
        description: 'Cada cobro o gasto queda conectado con su ficha y soporte.',
      },
      fiscal: {
        title: 'Prepara la fiscalidad sin reconstruir datos',
        description: 'Cuando llega el 182 o un certificado, la base económica ya está ordenada.',
      },
      projects: {
        title: 'Sigue y justifica proyectos de cooperación',
        description:
          'Cuando hay subvenciones o cooperación, hacéis seguimiento presupuestario, relacionáis gasto y preparáis la justificación sin separar la parte económica del proyecto.',
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

const HOME_REFRESH_COPY: Record<
  PublicLocale,
  {
    hero: {
      cta: string;
      ctaCaption: string;
    };
    beforeAfter: {
      eyebrow: string;
      title: string;
      description: string;
      beforeTitle: string;
      beforeItems: string[];
      afterTitle: string;
      afterItems: string[];
    };
    metrics: {
      eyebrow: string;
      title: string;
      description: string;
      items: {
        entities: string;
        movements: string;
        countries: string;
      };
    };
    functionality: {
      cta: string;
    };
    fit: {
      eyebrow: string;
      title: string;
      fitTitle: string;
      fitItems: string[];
      notFitTitle: string;
      notFitItems: string[];
    };
    work: {
      eyebrow: string;
      title: string;
      description: string;
      note: string;
    };
    final: {
      eyebrow: string;
      title: string;
      subtitle: string;
      supportNote: string;
    };
  }
> = {
  ca: {
    hero: {
      cta: 'Parla amb nosaltres',
      ctaCaption: 'Valorem primer si encaixa amb la vostra operativa real.',
    },
    beforeAfter: {
      eyebrow: '',
      title: 'Del desordre a criteri operatiu',
      description: 'El canvi no és estètic: és passar de peces soltes a un sistema treballable.',
      beforeTitle: 'Abans',
      beforeItems: [
        'Extractes dispersos',
        'Remeses difícils de reconstruir',
        'Devolucions poc traçables',
        'Model 182 preparat a mà',
      ],
      afterTitle: 'Amb Summa',
      afterItems: [
        'Conciliació centralitzada',
        'Quotes i devolucions sota control',
        'Donants relacionats correctament',
        'Fiscalitat preparada amb criteri',
      ],
    },
    metrics: {
      eyebrow: 'Credibilitat',
      title: 'Operativa real, no narrativa',
      description: 'Les xifres ajuden a entendre l’escala i el tipus de feina que Summa ja cobreix.',
      items: {
        entities: 'Entitats amb operativa real',
        movements: 'Moviments treballats cada mes',
        countries: 'Contextos de treball internacionals',
      },
    },
    functionality: {
      cta: 'Veure funcionalitat',
    },
    fit: {
      eyebrow: 'Per a qui és',
      title: 'Entitats socials, culturals, esportives i de cooperació',
      fitTitle: 'Encaixa si',
      fitItems: [
        'Gestioneu quotes de socis o donacions',
        'Envieu remeses i teniu devolucions',
        'Prepareu Model 182 o certificats de donació',
        "L'Excel se us queda curt i us obliga a molta feina manual",
      ],
      notFitTitle: 'No és per a vosaltres si',
      notFitItems: [
        'Busqueu un ERP generalista',
        'Només necessiteu facturació',
        'No teniu pràcticament operativa econòmica',
        'Voleu comptabilitat formal completa dins l’eina',
      ],
    },
    work: {
      eyebrow: 'Com treballem',
      title: 'Primer mirem si us pot ajudar de veritat.',
      description:
        'No comencem amb una demo genèrica. Primer entenem com porteu banc, quotes, devolucions i fiscalitat, i després us ensenyem només allò que us ha de resoldre feina.',
      note: 'Si veiem que no és la millor opció per a la vostra manera de treballar, us ho direm abans de fer-vos perdre temps.',
    },
    final: {
      eyebrow: 'Parla amb nosaltres',
      title: 'Parla amb nosaltres',
      subtitle: 'Valorem si Summa encaixa amb la vostra entitat.',
      supportNote:
        'Ens agrada entendre primer la realitat de cada entitat abans de proposar res.',
    },
  },
  es: {
    hero: {
      cta: 'Habla con nosotros',
      ctaCaption: 'Valoramos primero si encaja con vuestra operativa real.',
    },
    beforeAfter: {
      eyebrow: '',
      title: 'Del desorden a criterio operativo',
      description: 'El cambio no es estético: es pasar de piezas sueltas a un sistema trabajable.',
      beforeTitle: 'Antes',
      beforeItems: [
        'Extractos dispersos',
        'Remesas difíciles de reconstruir',
        'Devoluciones poco trazables',
        'Modelo 182 preparado a mano',
      ],
      afterTitle: 'Con Summa',
      afterItems: [
        'Conciliación centralizada',
        'Cuotas y devoluciones bajo control',
        'Donantes relacionados correctamente',
        'Fiscalidad preparada con criterio',
      ],
    },
    metrics: {
      eyebrow: 'Credibilidad',
      title: 'Operativa real, no decoración',
      description: 'Las cifras ayudan a entender la escala y el tipo de trabajo que Summa ya cubre.',
      items: {
        entities: 'Entidades con operativa real',
        movements: 'Movimientos trabajados cada mes',
        countries: 'Contextos de trabajo internacionales',
      },
    },
    functionality: {
      cta: 'Ver funcionalidad',
    },
    fit: {
      eyebrow: 'Para quién es',
      title: 'Summa encaja cuando hay operativa económica real.',
      fitTitle: 'Encaja si',
      fitItems: [
        'Gestionáis cuotas o donaciones recurrentes',
        'Tenéis remesas o devoluciones',
        'Preparáis Modelo 182 o certificados',
        'Queréis dejar atrás Excel como centro de control',
      ],
      notFitTitle: 'No es para vosotros si',
      notFitItems: [
        'Buscáis un ERP generalista',
        'Solo necesitáis facturación',
        'No tenéis apenas operativa económica',
        'Queréis contabilidad formal completa dentro de la herramienta',
      ],
    },
    work: {
      eyebrow: 'Cómo trabajamos',
      title: 'Primero miramos si encaja con vuestra operativa.',
      description:
        'No empezamos con una demo genérica. Primero entendemos cómo lleváis banco, cuotas, devoluciones y fiscalidad, y después os enseñamos solo lo que os tiene que resolver trabajo.',
      note: 'Si no hay un encaje claro con vuestra manera de trabajar, os lo diremos antes de haceros perder tiempo.',
    },
    final: {
      eyebrow: 'Habla con nosotros',
      title: 'Habla con nosotros',
      subtitle: 'Valoramos si Summa encaja con vuestra entidad.',
      supportNote:
        'Nos gusta entender primero la realidad de cada entidad antes de proponer nada.',
    },
  },
  fr: {
    hero: {
      cta: 'Parlez avec nous',
      ctaCaption: "Nous vérifions d'abord si cela correspond à votre réalité opérationnelle.",
    },
    beforeAfter: {
      eyebrow: '',
      title: "Du désordre à un cadre opérationnel",
      description: "Le changement n'est pas esthétique : il s'agit de passer de pièces dispersées à un système exploitable.",
      beforeTitle: 'Avant',
      beforeItems: [
        'Relevés dispersés',
        'Prélèvements difficiles à reconstituer',
        'Rejets peu traçables',
        'Modèle 182 préparé à la main',
      ],
      afterTitle: 'Avec Summa',
      afterItems: [
        'Rapprochement centralisé',
        'Cotisations et rejets sous contrôle',
        'Donateurs correctement liés',
        'Fiscalité préparée avec méthode',
      ],
    },
    metrics: {
      eyebrow: 'Crédibilité',
      title: 'Du travail réel, pas de la décoration',
      description: "Les chiffres aident à comprendre l'échelle et le type d'opérations que Summa couvre déjà.",
      items: {
        entities: 'Structures avec une vraie opération économique',
        movements: 'Mouvements traités chaque mois',
        countries: 'Contextes de travail internationaux',
      },
    },
    functionality: {
      cta: 'Voir la fonctionnalité',
    },
    fit: {
      eyebrow: "Pour qui c'est",
      title: 'Summa convient quand il y a une vraie opération économique.',
      fitTitle: 'Cela convient si',
      fitItems: [
        'Vous gérez des cotisations ou des dons récurrents',
        'Vous avez des prélèvements ou des rejets',
        'Vous préparez le modèle 182 ou des certificats',
        'Vous voulez sortir d’Excel comme centre de contrôle',
      ],
      notFitTitle: "Ce n'est pas pour vous si",
      notFitItems: [
        'Vous cherchez un ERP généraliste',
        'Vous avez seulement besoin de facturation',
        'Vous avez très peu d’opérations économiques',
        'Vous voulez une comptabilité formelle complète dans l’outil',
      ],
    },
    work: {
      eyebrow: 'Comment nous travaillons',
      title: "Nous vérifions d'abord si cela colle à votre fonctionnement.",
      description:
        "Nous ne commençons pas par une démo générique. Nous comprenons d'abord comment vous gérez banque, cotisations, rejets et fiscalité, puis nous montrons uniquement ce qui doit réellement vous faire gagner du temps.",
      note: "S'il n'y a pas de bon fit avec votre manière de travailler, nous vous le dirons avant de vous faire perdre du temps.",
    },
    final: {
      eyebrow: 'Parlez avec nous',
      title: 'Parlez avec nous',
      subtitle: 'Nous évaluons si Summa convient à votre structure.',
      supportNote:
        "Nous aimons comprendre d'abord la réalité de chaque structure avant de proposer quoi que ce soit.",
    },
  },
  pt: {
    hero: {
      cta: 'Fale connosco',
      ctaCaption: 'Avaliamos primeiro se encaixa na vossa operativa real.',
    },
    beforeAfter: {
      eyebrow: '',
      title: 'Da desordem ao critério operativo',
      description: 'A mudança não é estética: é passar de peças soltas para um sistema trabalhável.',
      beforeTitle: 'Antes',
      beforeItems: [
        'Extratos dispersos',
        'Remessas difíceis de reconstruir',
        'Devoluções pouco rastreáveis',
        'Modelo 182 preparado à mão',
      ],
      afterTitle: 'Com Summa',
      afterItems: [
        'Reconciliação centralizada',
        'Quotas e devoluções sob controlo',
        'Doadores relacionados corretamente',
        'Fiscalidade preparada com critério',
      ],
    },
    metrics: {
      eyebrow: 'Credibilidade',
      title: 'Operativa real, não decoração',
      description: 'Os números ajudam a perceber a escala e o tipo de trabalho que o Summa já cobre.',
      items: {
        entities: 'Entidades com operativa real',
        movements: 'Movimentos trabalhados todos os meses',
        countries: 'Contextos de trabalho internacionais',
      },
    },
    functionality: {
      cta: 'Ver funcionalidade',
    },
    fit: {
      eyebrow: 'Para quem é',
      title: 'O Summa encaixa quando existe operativa económica real.',
      fitTitle: 'Encaixa se',
      fitItems: [
        'Gerem quotas ou doações recorrentes',
        'Têm remessas ou devoluções',
        'Preparam Modelo 182 ou certificados',
        'Querem deixar o Excel como centro de controlo',
      ],
      notFitTitle: 'Não é para vocês se',
      notFitItems: [
        'Procuram um ERP generalista',
        'Só precisam de faturação',
        'Quase não têm operativa económica',
        'Querem contabilidade formal completa dentro da ferramenta',
      ],
    },
    work: {
      eyebrow: 'Como trabalhamos',
      title: 'Primeiro vemos se encaixa com a vossa operativa.',
      description:
        'Não começamos com uma demo genérica. Primeiro percebemos como trabalham banco, quotas, devoluções e fiscalidade, e depois mostramos apenas o que vos deve realmente poupar trabalho.',
      note: 'Se não houver um encaixe claro com a vossa forma de trabalhar, diremo-lo antes de vos fazer perder tempo.',
    },
    final: {
      eyebrow: 'Fale connosco',
      title: 'Fale connosco',
      subtitle: 'Avaliamos se o Summa encaixa com a vossa entidade.',
      supportNote:
        'Gostamos de perceber primeiro a realidade de cada entidade antes de propor seja o que for.',
    },
  },
};

const HOME_SECTION_COPY: Record<
  PublicLocale,
  {
    capabilitiesNote: string;
    capabilitiesCta: string;
    conciliationCardDescription: string;
    updatesBadge: string;
    secondaryEyebrow: string;
    secondaryTitle: string;
    secondaryDescription: string;
    secondaryDemoBadge: string;
    secondaryGuideBadge: string;
  }
> = {
  ca: {
    capabilitiesNote:
      'Comencem per 4 demos premium destacades i, just a sota, hi tens més processos clau que Summa també cobreix. N’anirem obrint més a poc a poc.',
    capabilitiesCta: 'Veure totes les funcionalitats',
    conciliationCardDescription:
      'Importa extractes, categoritza automàticament amb IA i concilia amb la documentació existent.',
    updatesBadge: 'NOU A SUMMA',
    secondaryEyebrow: 'Més recorreguts',
    secondaryTitle: 'Altres funcionalitats que ja pots explorar',
    secondaryDescription:
      'Perquè es vegi més clar l’abast real de Summa, aquí tens 4 landings més amb processos complementaris de tresoreria, donants i fiscalitat.',
    secondaryDemoBadge: 'Amb demo',
    secondaryGuideBadge: 'Landing detallada',
  },
  es: {
    capabilitiesNote:
      'Empezamos por 4 demos premium destacadas y, justo debajo, tienes más procesos clave que Summa también cubre. Iremos abriendo más landings poco a poco.',
    capabilitiesCta: 'Ver todas las funcionalidades',
    conciliationCardDescription:
      'Importa extractos, categoriza automáticamente con IA y concilia con la documentación existente.',
    updatesBadge: 'NUEVO EN SUMMA',
    secondaryEyebrow: 'Más recorridos',
    secondaryTitle: 'Otras funcionalidades que ya puedes explorar',
    secondaryDescription:
      'Para que se entienda mejor el alcance real de Summa, aquí tienes 4 landings más con procesos complementarios de tesorería, donantes y fiscalidad.',
    secondaryDemoBadge: 'Con demo',
    secondaryGuideBadge: 'Landing detallada',
  },
  fr: {
    capabilitiesNote:
      'Nous commençons par 4 démos premium mises en avant et, juste en dessous, vous voyez déjà d’autres processus clés que Summa couvre aussi. D’autres landings arriveront progressivement.',
    capabilitiesCta: 'Voir toutes les fonctionnalités',
    conciliationCardDescription:
      'Importez les relevés, catégorisez automatiquement avec l’IA et rapprochez avec la documentation existante.',
    updatesBadge: 'NOUVEAU SUR SUMMA',
    secondaryEyebrow: 'Plus de parcours',
    secondaryTitle: 'D’autres fonctionnalités déjà à explorer',
    secondaryDescription:
      'Pour mieux montrer l’étendue réelle de Summa, voici 4 landings supplémentaires autour de la trésorerie, des donateurs et de la fiscalité.',
    secondaryDemoBadge: 'Avec démo',
    secondaryGuideBadge: 'Landing détaillée',
  },
  pt: {
    capabilitiesNote:
      'Começamos por 4 demos premium em destaque e, logo abaixo, tens mais processos-chave que o Summa também cobre. Iremos abrir mais landings aos poucos.',
    capabilitiesCta: 'Ver todas as funcionalidades',
    conciliationCardDescription:
      'Importa extratos, categoriza automaticamente com IA e concilia com a documentação existente.',
    updatesBadge: 'NOVO NO SUMMA',
    secondaryEyebrow: 'Mais percursos',
    secondaryTitle: 'Outras funcionalidades que já podes explorar',
    secondaryDescription:
      'Para tornar o alcance real do Summa mais visível, aqui tens mais 4 landings com processos complementares de tesouraria, doadores e fiscalidade.',
    secondaryDemoBadge: 'Com demo',
    secondaryGuideBadge: 'Landing detalhada',
  },
};

const HOME_FUNCTIONS_COPY: Record<
  PublicLocale,
  {
    eyebrow: string;
    title: string;
    description: string;
    coreLabel: string;
    optionalLabel: string;
    viewBlock: string;
    viewOptional: string;
    blocks: {
      treasury: { title: string; description: string; highlights: string[] };
      memberOps: { title: string; description: string; highlights: string[] };
      expenses: { title: string; description: string; highlights: string[] };
      projects: { title: string; description: string; highlights: string[] };
    };
  }
> = {
  ca: {
    eyebrow: 'Funcionalitats',
    title: 'Tria un bloc i mira Summa en acció',
    description:
      'Explora les funcionalitats principals des de la home i mira la pantalla real de cada flux abans d’entrar al detall.',
    coreLabel: 'Nucli base',
    optionalLabel: 'Mòdul opcional',
    viewBlock: 'Veure bloc',
    viewOptional: 'Veure projectes',
    blocks: {
      treasury: {
        title: 'Cobrar i conciliar',
        description: 'Quotes, remeses, devolucions i banc dins del mateix fil.',
        highlights: ['Quotes', 'Remeses', 'Banc'],
      },
      memberOps: {
        title: 'Gestionar la despesa',
        description: 'Factures, nòmines i pagaments amb els documents on toca.',
        highlights: ['Factures', 'Pagaments', 'Liquidacions'],
      },
      expenses: {
        title: 'Arribar bé a fiscalitat',
        description: 'Certificats, 182 i 347 sense reconstruir dades a última hora.',
        highlights: ['Certificats', '182', '347'],
      },
      projects: {
        title: 'Seguir projectes',
        description: 'Pressupost, subvencions i justificació només si us cal aquest nivell.',
        highlights: ['Pressupost', 'Subvencions', 'Justificació'],
      },
    },
  },
  es: {
    eyebrow: 'Funcionalidades',
    title: 'Elige un bloque y mira Summa en acción',
    description:
      'Explora las funcionalidades principales desde la home y mira la pantalla real de cada flujo antes de entrar en detalle.',
    coreLabel: 'Núcleo base',
    optionalLabel: 'Módulo opcional',
    viewBlock: 'Ver bloque',
    viewOptional: 'Ver proyectos',
    blocks: {
      treasury: {
        title: 'Cobrar y conciliar',
        description: 'Cuotas, remesas, devoluciones y banco dentro del mismo hilo.',
        highlights: ['Cuotas', 'Remesas', 'Banco'],
      },
      memberOps: {
        title: 'Gestionar el gasto',
        description: 'Facturas, nóminas y pagos con los documentos donde toca.',
        highlights: ['Facturas', 'Pagos', 'Liquidaciones'],
      },
      expenses: {
        title: 'Llegar bien a fiscalidad',
        description: 'Certificados, 182 y 347 sin reconstruir datos a última hora.',
        highlights: ['Certificados', '182', '347'],
      },
      projects: {
        title: 'Seguir proyectos',
        description: 'Presupuesto, subvenciones y justificación solo si os hace falta este nivel.',
        highlights: ['Presupuesto', 'Subvenciones', 'Justificación'],
      },
    },
  },
  fr: {
    eyebrow: 'Fonctionnalités',
    title: 'Choisissez un bloc et regardez Summa en action',
    description:
      'Explorez les fonctionnalités principales depuis la home et regardez l’écran réel de chaque flux avant d’aller plus loin.',
    coreLabel: 'Socle principal',
    optionalLabel: 'Module optionnel',
    viewBlock: 'Voir le bloc',
    viewOptional: 'Voir les projets',
    blocks: {
      treasury: {
        title: 'Encaisser et rapprocher',
        description: 'Cotisations, prélèvements, rejets et banque dans le même flux.',
        highlights: ['Cotisations', 'Prélèvements', 'Banque'],
      },
      memberOps: {
        title: 'Gérer les dépenses',
        description: 'Factures, salaires et paiements avec les documents au bon endroit.',
        highlights: ['Factures', 'Paiements', 'Notes de frais'],
      },
      expenses: {
        title: 'Arriver sereinement à la fiscalité',
        description: 'Certificats, 182 et 347 sans reconstruire les données en fin de course.',
        highlights: ['Certificats', '182', '347'],
      },
      projects: {
        title: 'Suivre les projets',
        description: 'Budget, subventions et justification uniquement si vous en avez besoin.',
        highlights: ['Budget', 'Subventions', 'Justification'],
      },
    },
  },
  pt: {
    eyebrow: 'Funcionalidades',
    title: 'Escolhe um bloco e vê o Summa em ação',
    description:
      'Explora as funcionalidades principais a partir da home e vê o ecrã real de cada fluxo antes de entrares no detalhe.',
    coreLabel: 'Núcleo base',
    optionalLabel: 'Módulo opcional',
    viewBlock: 'Ver bloco',
    viewOptional: 'Ver projetos',
    blocks: {
      treasury: {
        title: 'Cobrar e reconciliar',
        description: 'Quotas, remessas, devoluções e banco dentro do mesmo fluxo.',
        highlights: ['Quotas', 'Remessas', 'Banco'],
      },
      memberOps: {
        title: 'Gerir a despesa',
        description: 'Faturas, salários e pagamentos com os documentos no lugar certo.',
        highlights: ['Faturas', 'Pagamentos', 'Liquidações'],
      },
      expenses: {
        title: 'Chegar bem à fiscalidade',
        description: 'Certificados, 182 e 347 sem reconstruir dados à última hora.',
        highlights: ['Certificados', '182', '347'],
      },
      projects: {
        title: 'Acompanhar projetos',
        description: 'Orçamento, subsídios e justificação apenas se precisarem desse nível.',
        highlights: ['Orçamento', 'Subsídios', 'Justificação'],
      },
    },
  },
};

type HomeExplorerCopy = {
  helper: string;
  detailCta: string;
  contactCta: string;
  demoBadge: string;
  landingBadge: string;
  screenBadge: string;
  sections: {
    dashboard: { label: string; title: string; description: string };
    conciliation: { label: string; title: string; description: string; assignment: { title: string; description: string } };
    expenses: {
      label: string;
      title: string;
      description: string;
      invoices: { title: string; description: string };
      payments: { title: string; description: string };
      settlements: { title: string; description: string };
    };
    members: { label: string; title: string; description: string };
    fiscal: { label: string; title: string; description: string };
    projects: {
      label: string;
      title: string;
      description: string;
      budget: { title: string; description: string };
      grants: { title: string; description: string };
      reporting: { title: string; description: string };
    };
    dashboardItems: {
      metrics: { title: string; description: string };
      reports: { title: string; description: string };
    };
  };
};

const HOME_EXPLORER_COPY: Record<PublicLocale, HomeExplorerCopy> = {
  ca: {
    helper:
      "Clica cada bloc per desplegar-ne les funcionalitats i veure, a la dreta, la pantalla real de Summa que correspon a aquell flux.",
    detailCta: 'Més informació',
    contactCta: 'Demana una demo',
    demoBadge: 'Vídeo demo',
    landingBadge: 'Landing',
    screenBadge: 'Pantalla',
    sections: {
      dashboard: {
        label: 'Panell de control',
        title: 'Visió general del sistema',
        description:
          "Una entrada clara per veure estat, alertes i informació preparada per compartir amb l'equip o la junta.",
      },
      dashboardItems: {
        metrics: {
          title: 'Quadre de comandament',
          description:
            'Indicadors, alertes i una lectura ràpida del que està pendent, resolt o preparat.',
        },
        reports: {
          title: 'Informes i exports',
          description:
            'Documents i dades llestes per revisar, descarregar o compartir amb gestoria i junta.',
        },
      },
      conciliation: {
        label: 'Conciliació bancària (amb IA)',
        title: 'Moviments, extractes i conciliació',
        description:
          "Importes l'extracte, relaciones moviments i treballes la conciliació amb criteri i traçabilitat.",
        assignment: {
          title: 'Assignació intel·ligent',
          description:
            'Summa proposa contactes, categories i relacions a partir de decisions anteriors i patrons detectats.',
        },
      },
      expenses: {
        label: 'Gestió de factures i liquidacions (amb IA)',
        title: 'Documents, pagaments i liquidacions',
        description:
          'Factures, nòmines, remeses de pagament i tiquets dins del mateix flux, amb menys feina manual.',
        invoices: {
          title: 'Factures i nòmines amb IA',
          description:
            'Arrossegues documents, revises les dades extretes i els deixes preparats per treballar-los.',
        },
        payments: {
          title: 'Pagaments SEPA',
          description:
            'Generes pagaments amb els imports i documents ja ordenats dins del sistema.',
        },
        settlements: {
          title: 'Liquidacions i tiquets',
          description:
            'Captura de despeses, viatges i quilometratge amb liquidacions regenerables en PDF.',
        },
      },
      members: {
        label: 'Gestió de socis i quotes',
        title: 'Base de socis, quotes i devolucions',
        description:
          'Socis, donants, quotes, rebuts retornats i historial econòmic dins d’un mateix fil.',
      },
      fiscal: {
        label: 'Fiscalitat (models AEAT ready)',
        title: 'Donacions, certificats i models fiscals',
        description:
          'Quan arriba el moment fiscal, la informació ja està preparada per generar certificats i models.',
      },
      projects: {
        label: 'Gestió de projectes',
        title: 'Projectes, subvencions i justificació',
        description:
          'Seguiment pressupostari, imputació de despesa i justificació perquè la part econòmica del projecte no vagi per lliure.',
        budget: {
          title: 'Seguiment pressupostari',
          description:
            'Comparativa entre pressupostat i executat per veure ràpidament on està cada projecte.',
        },
        grants: {
          title: 'Subvencions i imputació',
          description:
            'Assignació parcial de despesa i lectura clara de quina despesa pertany a cada projecte.',
        },
        reporting: {
          title: 'Justificació i exportació',
          description:
            'Materials exportables i documentació agrupada per preparar justificacions.',
        },
      },
    },
  },
  es: {
    helper:
      'Haz clic en cada bloque para desplegar sus funcionalidades y ver, a la derecha, la pantalla real de Summa que corresponde a ese flujo.',
    detailCta: 'Más información',
    contactCta: 'Pide una demo',
    demoBadge: 'Vídeo demo',
    landingBadge: 'Landing',
    screenBadge: 'Pantalla',
    sections: {
      dashboard: {
        label: 'Panel de control',
        title: 'Visión general del sistema',
        description:
          'Una entrada clara para ver estado, alertas e información preparada para compartir con el equipo o la junta.',
      },
      dashboardItems: {
        metrics: {
          title: 'Cuadro de mando',
          description:
            'Indicadores, alertas y una lectura rápida de lo pendiente, resuelto o preparado.',
        },
        reports: {
          title: 'Informes y exportaciones',
          description:
            'Documentos y datos listos para revisar, descargar o compartir con gestoría y junta.',
        },
      },
      conciliation: {
        label: 'Conciliación bancaria (con IA)',
        title: 'Movimientos, extractos y conciliación',
        description:
          'Importas el extracto, relacionas movimientos y trabajas la conciliación con criterio y trazabilidad.',
        assignment: {
          title: 'Asignación inteligente',
          description:
            'Summa propone contactos, categorías y relaciones a partir de decisiones anteriores y patrones detectados.',
        },
      },
      expenses: {
        label: 'Gestión de facturas y liquidaciones (con IA)',
        title: 'Documentos, pagos y liquidaciones',
        description:
          'Facturas, nóminas, remesas de pago y tickets dentro del mismo flujo, con menos trabajo manual.',
        invoices: {
          title: 'Facturas y nóminas con IA',
          description:
            'Arrastras documentos, revisas los datos extraídos y los dejas preparados para trabajar.',
        },
        payments: {
          title: 'Pagos SEPA',
          description:
            'Generas pagos con importes y documentos ya ordenados dentro del sistema.',
        },
        settlements: {
          title: 'Liquidaciones y tickets',
          description:
            'Captura de gastos, viajes y kilometraje con liquidaciones regenerables en PDF.',
        },
      },
      members: {
        label: 'Gestión de socios y cuotas',
        title: 'Base de socios, cuotas y devoluciones',
        description:
          'Socios, donantes, cuotas, recibos devueltos e historial económico dentro del mismo hilo.',
      },
      fiscal: {
        label: 'Fiscalidad (modelos AEAT ready)',
        title: 'Donaciones, certificados y modelos fiscales',
        description:
          'Cuando llega el momento fiscal, la información ya está preparada para generar certificados y modelos.',
      },
      projects: {
        label: 'Gestión de proyectos',
        title: 'Proyectos, subvenciones y justificación',
        description:
          'Seguimiento presupuestario, imputación de gasto y justificación para que la parte económica del proyecto no vaya por libre.',
        budget: {
          title: 'Seguimiento presupuestario',
          description:
            'Comparativa entre presupuestado y ejecutado para ver rápidamente dónde está cada proyecto.',
        },
        grants: {
          title: 'Subvenciones e imputación',
          description:
            'Asignación parcial de gasto y lectura clara de qué gasto pertenece a cada proyecto.',
        },
        reporting: {
          title: 'Justificación y exportación',
          description:
            'Materiales exportables y documentación agrupada para preparar justificaciones.',
        },
      },
    },
  },
  fr: {
    helper:
      'Cliquez sur chaque bloc pour déployer ses fonctionnalités et voir, à droite, l’écran réel de Summa correspondant à ce flux.',
    detailCta: 'Plus d’informations',
    contactCta: 'Demander une démo',
    demoBadge: 'Démo vidéo',
    landingBadge: 'Landing',
    screenBadge: 'Écran',
    sections: {
      dashboard: {
        label: 'Tableau de bord',
        title: 'Vue générale du système',
        description:
          'Une entrée claire pour voir état, alertes et information prête à partager avec l’équipe ou le conseil.',
      },
      dashboardItems: {
        metrics: {
          title: 'Tableau de bord',
          description:
            'Indicateurs, alertes et lecture rapide de ce qui est en attente, résolu ou prêt.',
        },
        reports: {
          title: 'Rapports et exports',
          description:
            'Documents et données prêts à vérifier, télécharger ou partager.',
        },
      },
      conciliation: {
        label: 'Rapprochement bancaire (avec IA)',
        title: 'Mouvements, relevés et rapprochement',
        description:
          'Vous importez le relevé, reliez les mouvements et travaillez le rapprochement avec traçabilité.',
        assignment: {
          title: 'Affectation intelligente',
          description:
            'Summa propose contacts, catégories et relations à partir des décisions précédentes.',
        },
      },
      expenses: {
        label: 'Gestion des factures et notes de frais (avec IA)',
        title: 'Documents, paiements et liquidations',
        description:
          'Factures, salaires, paiements et justificatifs dans le même flux, avec moins de travail manuel.',
        invoices: {
          title: 'Factures et salaires avec IA',
          description:
            'Vous déposez les documents, vérifiez les données extraites et les préparez.',
        },
        payments: {
          title: 'Paiements SEPA',
          description:
            'Vous générez les paiements à partir de montants et documents déjà ordonnés.',
        },
        settlements: {
          title: 'Notes de frais et justificatifs',
          description:
            'Capture des dépenses, déplacements et kilométrage avec PDF régénérables.',
        },
      },
      members: {
        label: 'Gestion des membres et cotisations',
        title: 'Base membres, cotisations et rejets',
        description:
          'Membres, donateurs, cotisations, rejets et historique économique dans le même fil.',
      },
      fiscal: {
        label: 'Fiscalité (modèles AEAT ready)',
        title: 'Dons, certificats et modèles fiscaux',
        description:
          'Quand vient la fiscalité, l’information est déjà prête pour certificats et déclarations.',
      },
      projects: {
        label: 'Gestion des projets',
        title: 'Projets, subventions et justification',
        description:
          'Suivi budgétaire, affectation des dépenses et justification pour garder la partie économique alignée.',
        budget: {
          title: 'Suivi budgétaire',
          description:
            'Comparaison entre budgeté et exécuté pour voir rapidement où en est chaque projet.',
        },
        grants: {
          title: 'Subventions et affectation',
          description:
            'Affectation partielle des dépenses et lecture claire par projet.',
        },
        reporting: {
          title: 'Justification et export',
          description:
            'Matériaux exportables et documentation groupée pour préparer la justification.',
        },
      },
    },
  },
  pt: {
    helper:
      'Clica em cada bloco para o abrir e ver, à direita, o ecrã real do Summa correspondente a esse fluxo.',
    detailCta: 'Mais informação',
    contactCta: 'Pedir demo',
    demoBadge: 'Vídeo demo',
    landingBadge: 'Landing',
    screenBadge: 'Ecrã',
    sections: {
      dashboard: {
        label: 'Painel de controlo',
        title: 'Visão geral do sistema',
        description:
          'Uma entrada clara para ver estado, alertas e informação pronta a partilhar com equipa ou direção.',
      },
      dashboardItems: {
        metrics: {
          title: 'Painel de controlo',
          description:
            'Indicadores, alertas e leitura rápida do que está pendente, resolvido ou pronto.',
        },
        reports: {
          title: 'Relatórios e exportações',
          description:
            'Documentos e dados prontos para rever, descarregar ou partilhar.',
        },
      },
      conciliation: {
        label: 'Reconciliação bancária (com IA)',
        title: 'Movimentos, extratos e reconciliação',
        description:
          'Importas o extrato, relacionas movimentos e trabalhas a reconciliação com rastreabilidade.',
        assignment: {
          title: 'Atribuição inteligente',
          description:
            'O Summa propõe contactos, categorias e relações a partir de decisões anteriores.',
        },
      },
      expenses: {
        label: 'Gestão de faturas e liquidações (com IA)',
        title: 'Documentos, pagamentos e liquidações',
        description:
          'Faturas, salários, pagamentos e comprovativos no mesmo fluxo, com menos trabalho manual.',
        invoices: {
          title: 'Faturas e salários com IA',
          description:
            'Arrastas documentos, revês os dados extraídos e preparas tudo para trabalhar.',
        },
        payments: {
          title: 'Pagamentos SEPA',
          description:
            'Gerar pagamentos a partir de montantes e documentos já organizados.',
        },
        settlements: {
          title: 'Liquidações e comprovativos',
          description:
            'Captura de despesas, viagens e quilometragem com PDF regenerável.',
        },
      },
      members: {
        label: 'Gestão de sócios e quotas',
        title: 'Base de sócios, quotas e devoluções',
        description:
          'Sócios, doadores, quotas, recibos devolvidos e histórico económico no mesmo fio.',
      },
      fiscal: {
        label: 'Fiscalidade (modelos AEAT ready)',
        title: 'Doações, certificados e modelos fiscais',
        description:
          'Quando chega a fiscalidade, a informação já está pronta para certificados e modelos.',
      },
      projects: {
        label: 'Gestão de projetos',
        title: 'Projetos, subsídios e justificação',
        description:
          'Seguimento orçamental, imputação de despesa e justificação para manter a parte económica alinhada.',
        budget: {
          title: 'Seguimento orçamental',
          description:
            'Comparação entre orçamentado e executado para ver rapidamente cada projeto.',
        },
        grants: {
          title: 'Subsídios e imputação',
          description:
            'Atribuição parcial de despesas e leitura clara por projeto.',
        },
        reporting: {
          title: 'Justificação e exportação',
          description:
            'Materiais exportáveis e documentação agrupada para preparar justificações.',
        },
      },
    },
  },
};

function createImageMedia(src: string, alt: string): PublicLandingHeroMedia {
  return {
    type: 'image',
    src,
    alt,
  };
}

function createVideoMedia(
  src: string,
  alt: string,
  poster?: string,
  mp4FallbackSrc?: string
): PublicLandingHeroMedia {
  return {
    type: 'video',
    src,
    alt,
    poster,
    mp4FallbackSrc,
    autoPlay: true,
    loop: true,
    muted: true,
    controls: false,
  };
}

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
    expenses: string;
    onlineDonations: string;
    fiscalCertificates: string;
    projects: string;
  }
> = {
  ca: {
    conciliation: 'conciliacio-bancaria',
    remittances: 'remeses-devolucions',
    expenses: 'despeses-pagaments-sepa',
    onlineDonations: 'donacions-online',
    fiscalCertificates: 'fiscalitat-certificats',
    projects: 'modul-projectes',
  },
  es: {
    conciliation: 'conciliacion-bancaria',
    remittances: 'remesas-devoluciones',
    expenses: 'gastos-pagos-sepa',
    onlineDonations: 'donaciones-online',
    fiscalCertificates: 'fiscalidad-certificados',
    projects: 'modulo-proyectos',
  },
  fr: {
    conciliation: 'rapprochement-bancaire',
    remittances: 'prelevements-rejets',
    expenses: 'factures-sepa',
    onlineDonations: 'dons-en-ligne',
    fiscalCertificates: 'fiscalite-certificats',
    projects: 'module-projets',
  },
  pt: {
    conciliation: 'reconciliacao-bancaria',
    remittances: 'remessas-devolucoes',
    expenses: 'faturas-sepa',
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
    dashboard: '/visuals/web/web_dashboard.webp',
    conciliation: '/visuals/web/web_concilia_bancaria.webp',
    remittances: '/visuals/web/web_divide_remeses.webp',
    donations: '/visuals/web/web_divide_stripe.webp',
    fiscal: '/visuals/web/web_certificats_182.webp',
    admin: '/visuals/web/web_gestio_docs.webp',
    projects: '/visuals/web/web_seguiment_projectes.webp',
  },
  ca: {
    dashboard: '/visuals/web/web_dashboard.webp',
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

function trimTrailingArrow(text: string) {
  return text.replace(/\s*[→↗➜]+\s*$/, '');
}

export default async function HomePage({ params }: PageProps) {
  const { lang } = await params;

  if (!isValidPublicLocale(lang)) {
    notFound();
  }

  const locale = lang as PublicLocale;
  const t = getPublicTranslations(locale);
  const landingCopy = LANDING_COPY[locale];
  const copy = HOME_REFRESH_COPY[locale];
  const featuresHref = getPublicFeaturesHref(locale);
  const contactHref = `/${locale}/contact`;
  const howWeWorkHref = `/${locale}#how-we-work`;
  const updatesHref = `/${locale}/novetats`;
  const headlineParts = splitTextAroundPhrase(t.home.heroTagline, HERO_ROTATING_SEGMENTS[locale]);
  const headlinePrefix = headlineParts.before.trim();
  const headlineSuffix = headlineParts.after.trim();
  const rotatingHeroPhrases = HERO_ROTATING_PHRASES[locale];
  const BLOCK_ORDER = [
    'conciliation',
    'donorsMembers',
    'payments',
    'fiscal',
    'projects',
    'control',
  ] as const;
  type HomeBlockKey = (typeof BLOCK_ORDER)[number];
  const functionalityHrefs: Record<HomeBlockKey, string> = {
    conciliation: `/${locale}/conciliacio-bancaria-ong`,
    donorsMembers: `/${locale}/gestio-donants`,
    payments: `/${locale}/remeses-sepa`,
    fiscal: `/${locale}/model-182`,
    projects: `/${locale}/gestio-projectes-justificacio`,
    control: `/${locale}/control-operatiu-entitats`,
  };
  const BLOCK_CARDS: Record<HomeBlockKey, readonly string[]> = {
    conciliation: ['importStatements', 'autoClassification', 'contactAssignment', 'multiBankAccount'],
    donorsMembers: ['donorProfile', 'bulkImport', 'donorHistory', 'operationalStatus'],
    payments: ['remittanceSplitter', 'bankReturns', 'sepaPayments', 'stripeDonations'],
    fiscal: ['model182', 'model347', 'donationCertificates', 'cleanExcel'],
    projects: ['budgetLines', 'expenseAssignment', 'fieldCapture', 'funderExport'],
    control: ['dashboard', 'smartAlerts', 'boardReport', 'dataExport'],
  };
  const CARD_SCREENSHOTS: Record<string, string> = {
    'conciliation.importStatements': '/visuals/web/features-v3/block1_import_extractes_start_4k.webp',
    'conciliation.autoClassification': '/visuals/web/features-v3/block1_classificacio_auto_4k.webp',
    'conciliation.contactAssignment': '/visuals/web/features-v3/block1_assignacio_contactes_4k.webp',
    'conciliation.multiBankAccount': '/visuals/web/features-v3/block1_multi_compte_4k.webp',
    'donorsMembers.donorProfile': '/visuals/web/features/block2_fitxa_donant.webp',
    'donorsMembers.bulkImport': '/visuals/web/features/block2_importacio_massiva.webp',
    'donorsMembers.donorHistory': '/visuals/web/features/block2_historic_donant.webp',
    'donorsMembers.operationalStatus': '/visuals/web/features/block2_estats_donants.webp',
    'payments.remittanceSplitter': '/visuals/web/features/block3_divisor_remeses.webp',
    'payments.bankReturns': '/visuals/web/features/block3_devolucions.webp',
    'payments.sepaPayments': '/visuals/web/features/block3_remeses_sepa.webp',
    'payments.stripeDonations': '/visuals/web/features/block3_stripe.webp',
    'fiscal.model182': '/visuals/web/features/block4_model182.webp',
    'fiscal.model347': '/visuals/web/features/block4_model347.webp',
    'fiscal.donationCertificates': '/visuals/web/features/block4_certificats.webp',
    'fiscal.cleanExcel': '/visuals/web/features/block4_excel_gestoria.webp',
    'projects.budgetLines': '/visuals/web/features/block5_pressupost_partides.webp',
    'projects.expenseAssignment': '/visuals/web/features/block5_assignacio_despeses.webp',
    'projects.fieldCapture': '/visuals/web/features/block5_captura_terreny.webp',
    'projects.funderExport': '/visuals/web/features/block5_export_financador.webp',
    'control.dashboard': '/visuals/web/features/block6_dashboard.webp',
    'control.smartAlerts': '/visuals/web/features/block6_alertes.webp',
    'control.boardReport': '/visuals/web/features/block6_informe_junta.webp',
    'control.dataExport': '/visuals/web/features/block6_exportacio_dades.webp',
  };
  const CARD_VIDEO_OVERRIDES: Partial<Record<string, PublicLandingHeroMedia>> = {
    'conciliation.importStatements': createVideoMedia(
      '/visuals/web/features-v3/block1_import_extractes_loop_4k.mp4',
      t.home.blocks.conciliation.cards.importStatements.screenshotAlt,
      '/visuals/web/features-v3/block1_import_extractes_start_4k.webp'
    ),
    'donorsMembers.donorProfile': createVideoMedia(
      locale === 'es'
        ? '/visuals/landings/control-donacions-ong/animations/control-donacions-demo-es.mp4'
        : '/visuals/landings/control-donacions-ong/animations/control-donacions-demo-ca.mp4',
      t.home.blocks.donorsMembers.cards.donorProfile.screenshotAlt,
      '/visuals/landings/control-donacions-ong/optimized/control-donacions-demo-poster.webp'
    ),
    'donorsMembers.donorHistory': createVideoMedia(
      locale === 'es'
        ? '/visuals/landings/control-donacions-ong/animations/control-donacions-demo-es.mp4'
        : '/visuals/landings/control-donacions-ong/animations/control-donacions-demo-ca.mp4',
      t.home.blocks.donorsMembers.cards.donorHistory.screenshotAlt,
      '/visuals/landings/control-donacions-ong/optimized/control-donacions-demo-poster.webp'
    ),
    'payments.remittanceSplitter': createVideoMedia(
      locale === 'es'
        ? '/visuals/landings/remeses-sepa/animations/remeses-sepa-demo-es.mp4'
        : '/visuals/landings/remeses-sepa/animations/remeses-sepa-demo-ca.mp4',
      t.home.blocks.payments.cards.remittanceSplitter.screenshotAlt,
      '/visuals/landings/remeses-sepa/optimized/remeses-sepa-demo-poster.webp'
    ),
    'payments.sepaPayments': createVideoMedia(
      locale === 'es'
        ? '/visuals/landings/remeses-sepa/animations/remeses-sepa-demo-es.mp4'
        : '/visuals/landings/remeses-sepa/animations/remeses-sepa-demo-ca.mp4',
      t.home.blocks.payments.cards.sepaPayments.screenshotAlt,
      '/visuals/landings/remeses-sepa/optimized/remeses-sepa-demo-poster.webp'
    ),
    'fiscal.model182': createVideoMedia(
      locale === 'es'
        ? '/visuals/landings/model-182/animations/model-182-demo-es.mp4'
        : '/visuals/landings/model-182/animations/model-182-demo-ca.mp4',
      t.home.blocks.fiscal.cards.model182.screenshotAlt,
      '/visuals/landings/model-182/optimized/model-182-demo-poster.webp'
    ),
    'control.dashboard': createVideoMedia(
      '/visuals/functionalities/dashboard/animations/dashboard-control-feature-ca.mp4',
      t.home.blocks.control.cards.dashboard.screenshotAlt,
      '/visuals/functionalities/dashboard/optimized/dashboard-control-feature-poster-ca.png'
    ),
    'control.smartAlerts': createVideoMedia(
      '/visuals/functionalities/dashboard/animations/dashboard-control-feature-ca.mp4',
      t.home.blocks.control.cards.smartAlerts.screenshotAlt,
      '/visuals/functionalities/dashboard/optimized/dashboard-control-feature-poster-ca.png'
    ),
  };

  const valueRail = [
    {
      title: landingCopy.valueRail.conciliation.title,
      description: landingCopy.valueRail.conciliation.description,
      icon: Upload,
      href: functionalityHrefs.conciliation,
    },
    {
      title: landingCopy.valueRail.remittances.title,
      description: landingCopy.valueRail.remittances.description,
      icon: Settings,
      href: functionalityHrefs.payments,
    },
    {
      title: landingCopy.valueRail.fiscal.title,
      description: landingCopy.valueRail.fiscal.description,
      icon: FileCheck,
      href: functionalityHrefs.fiscal,
    },
    {
      title: landingCopy.valueRail.projects.title,
      description: landingCopy.valueRail.projects.description,
      icon: Download,
      href: functionalityHrefs.projects,
    },
  ] as const;

  const heroHighlightsByLocale: Record<PublicLocale, string[]> = {
    ca: [
      'Conciliació bancària',
      'Fiscalitat i certificats',
      'Remeses i devolucions',
      'Gestió de projectes',
    ],
    es: [
      'Conciliación bancaria',
      'Fiscalidad y certificados',
      'Remesas y devoluciones',
      'Gestión de proyectos',
    ],
    fr: [
      'Rapprochement bancaire',
      'Fiscalité et certificats',
      'Prélèvements et rejets',
      'Gestion de projets',
    ],
    pt: [
      'Reconciliação bancária',
      'Fiscalidade e certificados',
      'Remessas e devoluções',
      'Gestão de projetos',
    ],
  };
  const heroHighlights = heroHighlightsByLocale[locale];

  const homeFeatureExplorerSections: PublicFeaturesExplorerSection[] = [
    ...BLOCK_ORDER.map((blockKey) => {
      const block = t.home.blocks[blockKey];
      const readMoreHref = functionalityHrefs[blockKey];
      const items = BLOCK_CARDS[blockKey].reduce<PublicFeaturesExplorerSection['items']>(
        (accumulator, cardKey) => {
          const card = block.cards[cardKey];
          const screenshot = CARD_SCREENSHOTS[`${blockKey}.${cardKey}`];

          if (!card || !screenshot) {
            return accumulator;
          }

          accumulator.push({
            id: `${blockKey}.${cardKey}`,
            title: card.title,
            description: card.description,
            href: readMoreHref,
            ctaLabel: copy.functionality.cta,
            media:
              CARD_VIDEO_OVERRIDES[`${blockKey}.${cardKey}`] ??
              createImageMedia(screenshot, card.screenshotAlt),
          });

          return accumulator;
        },
        []
      );

      return {
        id: blockKey,
        tabLabel: block.title,
        title: block.title,
        description: block.subtitle,
        items,
      };
    }),
  ];

  return (
    <main className="flex min-h-screen flex-col">
      <a
        href="#capabilities"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        {t.home.skipToContent}
      </a>

      <PublicSiteHeader locale={locale} />

      <section className={`relative overflow-hidden bg-background pb-6 pt-6 lg:pb-8 lg:pt-8 ${PUBLIC_SHELL_X}`}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-5rem] top-[-4rem] h-52 w-52 rounded-full bg-sky-100/85 blur-3xl" />
          <div className="absolute right-[8%] top-[12%] h-72 w-72 rounded-full bg-amber-100/70 blur-3xl" />
          <div className="absolute bottom-[-5rem] right-[-1rem] h-60 w-60 rounded-full bg-cyan-100/70 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-[82rem]">
          <div className="grid items-center gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-10 xl:gap-12 2xl:gap-14">
            <div className="space-y-5 text-center lg:space-y-6 lg:text-left">
              <div className="space-y-5">
                <p className="mx-auto inline-flex w-fit items-center rounded-full border border-sky-200/80 bg-white/80 px-3 py-1.5 text-[10px] font-semibold text-primary/90 shadow-[0_16px_40px_-28px_rgba(14,165,233,0.55)] sm:px-3.5 sm:py-1.5 sm:text-[11px] lg:mx-0 lg:text-xs">
                  {t.home.hero.bridgeLine}
                </p>

                <h1 className="mx-auto max-w-3xl text-[2.95rem] font-black leading-[0.98] tracking-[-0.04em] text-foreground sm:text-[3.6rem] md:text-[3.95rem] lg:mx-0 lg:text-[4.1rem] 2xl:text-[4.85rem]">
                  {headlineParts.highlight ? (
                    <>
                      <span className="block">{headlinePrefix}</span>
                      <span className="mt-2 block">
                        <RotatingHeroPhrase items={rotatingHeroPhrases} />
                      </span>
                      <span className="block">{headlineSuffix}</span>
                    </>
                  ) : (
                    t.home.heroTagline
                  )}
                </h1>

                <p className="mx-auto max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl lg:mx-0">
                  {landingCopy.heroSupport}
                </p>
              </div>

              <div className="flex flex-col items-center gap-3 lg:items-start">
                <Button asChild size="lg" className="rounded-full px-8">
                  <Link href={contactHref}>
                    {copy.hero.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                  {copy.hero.ctaCaption}
                </p>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-none">
              <div className="absolute inset-[-10%] hidden sm:block">
                <PublicHeroParticles className="scale-[1.06]" />
              </div>
              <div className="pointer-events-none absolute inset-x-10 top-8 h-32 rounded-full bg-sky-100/80 blur-3xl" />
              <div className="pointer-events-none absolute bottom-8 left-8 h-24 w-24 rounded-full bg-amber-100/80 blur-3xl" />

              <div className="relative z-10 mx-auto max-w-[60rem] pt-2">
                <div className="overflow-hidden rounded-[1.55rem] border border-slate-200/75 bg-[linear-gradient(180deg,rgba(250,250,250,0.98),rgba(244,246,248,0.94))] p-1.5 shadow-[0_30px_72px_-56px_rgba(15,23,42,0.24)] backdrop-blur">
                  <div className="overflow-hidden rounded-[1.15rem] border border-slate-200/80 bg-white/98">
                    <div className="flex items-center border-b border-slate-200/80 bg-slate-50/90 px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                      </div>
                    </div>
                    <div className="overflow-hidden bg-slate-100/80">
                      <Image
                        src="/visuals/web/web_pantalla_summa.webp"
                        alt={t.home.hero.visualAlt}
                        width={1600}
                        height={1000}
                        sizes="(min-width: 1536px) 56vw, (min-width: 1280px) 58vw, (min-width: 1024px) 54vw, 100vw"
                        className="h-auto w-full"
                        priority
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 hidden sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-2">
                  {heroHighlights.map((item) => (
                    <div
                      key={item}
                      className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200/80 bg-white/82 px-2.5 py-1 text-[11px] font-medium leading-none text-slate-600 shadow-[0_10px_24px_-24px_rgba(15,23,42,0.14)] backdrop-blur"
                    >
                      <span className="h-1 w-1 rounded-full bg-primary/70" />
                      <span>{item}</span>
                    </div>
                  ))}
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

      {/* D) FUNCIONALITATS — EXPLORADOR */}
      <section
        id="capabilities"
        className={`scroll-mt-24 bg-[linear-gradient(180deg,#f8f9fc_0%,#f8f9fc_36%,#ffffff_100%)] py-16 lg:py-20 ${PUBLIC_SHELL_X}`}
      >
        <div className="mx-auto max-w-[96rem]">
          <div className="mx-auto max-w-[42rem] text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
              {t.common.features}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-[2.45rem]">
              {t.home.systemOverview.title}
            </h2>
            <PublicEditorialMark align="center" size="sm" className="mt-3 opacity-80" />
            {t.home.systemOverview.subtitle ? (
              <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
                {t.home.systemOverview.subtitle}
              </p>
            ) : null}
          </div>

          <div className="mt-10 lg:mt-12">
            <PublicFeaturesExplorer
              locale={locale}
              sections={homeFeatureExplorerSections}
              tabsAlign="center"
              showSectionIntro
              showSectionTitle={false}
              resetItemOnSectionChange
              layout="image-heavy"
              compactCards
              showItemBadges={false}
            />
          </div>
        </div>
      </section>

      <section className={`py-16 lg:py-20 ${PUBLIC_SHELL_X}`}>
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
              {copy.fit.eyebrow}
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.25rem]">
              {copy.fit.title}
            </h2>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <article className={`${SURFACE_CLASS} p-6 sm:p-7`}>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary/85">
                {copy.fit.fitTitle}
              </p>
              <div className="mt-5 space-y-3">
                {copy.fit.fitItems.map((item) => (
                  <div key={item} className="flex gap-3 rounded-[1.15rem] bg-slate-50 px-4 py-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <p className="text-sm leading-6 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className={`${SURFACE_CLASS} p-6 sm:p-7`}>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary/85">
                {copy.fit.notFitTitle}
              </p>
              <div className="mt-5 space-y-3">
                {copy.fit.notFitItems.map((item) => (
                  <div key={item} className="flex gap-3 rounded-[1.15rem] bg-slate-50 px-4 py-3">
                    <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-400" />
                    <p className="text-sm leading-6 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="how-we-work" className={`bg-white py-16 lg:py-20 ${PUBLIC_SHELL_X}`}>
        <div className="mx-auto max-w-6xl">
          <div className={`${SURFACE_CLASS} grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start`}>
            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                {copy.work.eyebrow}
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.2rem]">
                {copy.work.title}
              </h2>
            </div>

            <div className="space-y-5">
              <p className="text-base leading-7 text-slate-600 sm:text-lg">{copy.work.description}</p>
              <p className="text-base leading-7 text-slate-600">{t.home.howWeWork.paragraph1}</p>
              <div className="rounded-[1.35rem] border border-sky-100/80 bg-[linear-gradient(135deg,rgba(14,165,233,0.08),rgba(255,255,255,0.98))] px-5 py-4 text-sm leading-6 text-slate-600">
                {copy.work.note}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section data-preview-section="cta-final" className={`pb-20 pt-10 lg:pt-14 ${PUBLIC_SHELL_X}`}>
        <div className="mx-auto max-w-6xl rounded-[2.4rem] border border-sky-200/70 bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(255,255,255,0.96)_45%,rgba(240,249,255,0.92))] p-6 shadow-[0_30px_90px_-56px_rgba(14,165,233,0.45)] sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.92fr] lg:items-center">
            <div className="space-y-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                {copy.final.eyebrow}
              </p>
              <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-[2.45rem]">
                {copy.final.title}
              </h2>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                {copy.final.subtitle}
              </p>
              <Button asChild size="lg" className="rounded-full px-8">
                <Link href={contactHref}>
                  {copy.hero.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="rounded-[1.9rem] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.28)] sm:p-7">
              <p className="text-sm leading-6 text-slate-600">{copy.final.supportNote}</p>
              <PublicDirectContact locale={locale} className="mt-6 border-t border-border/60 pt-6" />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t bg-muted/20 py-12">
        <div className={`${PUBLIC_WIDE_SHELL} grid gap-10 md:grid-cols-3`}>
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
              <Link href={featuresHref} className="hover:text-foreground hover:underline">
                {t.common.features}
              </Link>
              <Link href={howWeWorkHref} className="hover:text-foreground hover:underline">
                {t.home.howWeWork.title}
              </Link>
              <Link href={updatesHref} className="hover:text-foreground hover:underline">
                {t.updates.navLabel}
              </Link>
              <Link href={`/${locale}/blog`} className="hover:text-foreground hover:underline">
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
