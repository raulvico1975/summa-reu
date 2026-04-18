import type { I18nLocale } from "@/src/i18n/config";

export type MarketingLanding = {
  key:
    | "actes-ai"
    | "boards"
    | "calls-voting"
    | "associations"
    | "foundations"
    | "cooperatives";
  slug: string;
  navLabel: string;
  eyebrow: string;
  heroTitle: string;
  heroBody: string;
  metaTitle: string;
  metaDescription: string;
  keywords?: string[];
  introTitle: string;
  introBody: string;
  bullets: string[];
  sections: Array<{
    title: string;
    body: string;
  }>;
  proofTitle: string;
  proofItems: string[];
  ctaTitle: string;
  ctaBody: string;
};

type MarketingLocaleContent = {
  headerLinks: Array<{ label: string; href: string }>;
  trustBand: string[];
  editorialEyebrow: string;
  editorialTitle: string;
  editorialBody: string;
  editorialBullets: string[];
  sectorsEyebrow: string;
  sectorsTitle: string;
  sectorsBody: string;
  sectorsIntro: string;
  landingSectionEyebrow: string;
  landingSectionTitle: string;
  landingSectionBody: string;
  finalEyebrow: string;
  finalTitle: string;
  finalBody: string;
  finalPrimaryCta: string;
  finalSecondaryCta: string;
  softwareSchemaName: string;
  softwareSchemaDescription: string;
  landings: MarketingLanding[];
};

const marketingContent: Record<I18nLocale, MarketingLocaleContent> = {
  ca: {
    headerLinks: [
      { label: "Convocatòries i votacions", href: "/convocatories-i-votacions" },
      { label: "Juntes directives", href: "/software-juntes-directives" },
      { label: "Actes amb IA", href: "/actes-ia-entitats" },
    ],
    trustBand: [
      "Convocatòria, disponibilitat, reunió, gravació i acta en un sol flux",
      "La gravació es converteix en transcripció i acta revisable",
      "Arxiu consultable i ordenat",
      "Pensat per a juntes, patronats i equips de coordinació",
    ],
    editorialEyebrow: "Tot connectat",
    editorialTitle: "Convoca, reuneix-te i tanca l'acta al mateix lloc.",
    editorialBody:
      "Summa Reu connecta convocatòria, disponibilitat, reunió, gravació i acta final perquè no hagis de saltar entre correu, videotrucada i documents separats.",
    editorialBullets: [
      "Comparteix la convocatòria i recull disponibilitat amb un sol enllaç.",
      "Obre la reunió i controla la gravació des del mateix espai privat de l'entitat.",
      "Rep una acta preparada per revisar, exportar i deixar guardada al mateix flux.",
    ],
    sectorsEyebrow: "On encaixa millor",
    sectorsTitle: "Un sol espai per convocar, reunir i tancar actes.",
    sectorsBody:
      "Associacions, fundacions, cooperatives i equips que volen gestionar convocatòries, disponibilitat, reunions, gravació i actes sense repartir-ho en eines diferents.",
    sectorsIntro: "Casos d'ús prioritaris",
    landingSectionEyebrow: "Mateix producte, tres entrades",
    landingSectionTitle: "Pots entrar per la convocatòria, per la reunió o per l'acta, però el producte és un de sol.",
    landingSectionBody:
      "Aquestes pàgines t'ajuden a veure Summa Reu des de la necessitat que tens avui, però totes desemboquen en el mateix recorregut: convocar, reunir-se, gravar i tancar l'acta.",
    finalEyebrow: "Summa Reu",
    finalTitle: "Menys eines separades. Més reunions ben tancades.",
    finalBody:
      "Si avui convoqueu en un lloc, us reuniu en un altre i tanqueu l'acta en un tercer, Summa Reu us ho uneix en un sol flux.",
    finalPrimaryCta: "Activa l'espai",
    finalSecondaryCta: "Accés entitat",
    softwareSchemaName: "Summa Reu",
    softwareSchemaDescription:
      "Plataforma per convocar reunions, recollir disponibilitat, gravar la sessió i tancar l'acta en un únic flux.",
    landings: [
      {
        key: "actes-ai",
        slug: "actes-ia-entitats",
        navLabel: "Actes amb IA",
        eyebrow: "Actes amb IA",
        heroTitle: "Actes amb IA per tancar la reunió sense començar de zero.",
        heroBody:
          "Convoca, reuneix-te, grava la sessió i rep una acta revisable dins del mateix espai. Sense reconstruir la sessió a mà ni perseguir notes disperses.",
        metaTitle: "Actes amb IA per a entitats | Summa Reu",
        metaDescription:
          "Genera actes amb IA a partir de la reunió que ja has convocat i gravat. Revisa, exporta i arxiva-ho tot dins del mateix flux de Summa Reu.",
        keywords: [
          "actes amb IA",
          "actes per a entitats",
          "software actes juntes",
          "transcripció reunió entitats",
        ],
        introTitle: "La reunió no acaba quan s'apaga la càmera. Acaba quan l'acta està llesta.",
        introBody:
          "La reunió no acaba quan es tanca la videotrucada. Acaba quan l'acta està preparada, revisada i guardada al mateix espai. Aquest és el punt on Summa Reu elimina més feina manual.",
        bullets: [
          "Transcripció i esborrany d'acta dins del mateix entorn privat.",
          "Acta editable abans d'exportar o compartir.",
          "Arxiu consultable sense buscar documents en canals separats.",
        ],
        sections: [
          {
            title: "De la reunió a l'acta",
            body:
              "La gravació passa a transcripció i després a acta revisable. El secretariat deixa de començar de zero després de cada sessió.",
          },
          {
            title: "IA aplicada on aporta valor",
            body:
              "No és IA ornamental. És IA orientada a reduir feina manual després de la reunió i accelerar el moment de tancar l'acta.",
          },
          {
            title: "Arxiu i exportació",
            body:
              "Quan cal compartir l'acta o recuperar acords anteriors, tot queda dins de Summa Reu i es pot exportar sense reconstruccions.",
          },
        ],
        proofTitle: "Què resol",
        proofItems: [
          "Evita perseguir notes, àudios i versions disperses.",
          "Redueix dependència d'una sola persona per tancar l'acta.",
          "L'acta queda guardada i és fàcil de recuperar.",
        ],
        ctaTitle: "Mostra'ns una reunió i et mostrem com queda l'acta llesta.",
        ctaBody:
          "La demo s'ha d'entendre en cinc minuts: reunió, transcripció, acta revisable i arxiu final al mateix lloc.",
      },
      {
        key: "boards",
        slug: "software-juntes-directives",
        navLabel: "Juntes directives",
        eyebrow: "Juntes directives",
        heroTitle: "Software per a juntes directives per convocar, reunir i tancar actes sense canviar d'eina.",
        heroBody:
          "Comparteix la convocatòria, recull disponibilitat, obre la reunió, grava-la i deixa l'acta preparada per revisar.",
        metaTitle: "Software per a juntes directives | Summa Reu",
        metaDescription:
          "Plataforma per gestionar convocatòries, disponibilitat, reunions, gravació i actes de juntes directives en un únic flux.",
        keywords: [
          "software juntes directives",
          "convocatòries junta",
          "actes junta directiva",
        ],
        introTitle: "La junta no necessita més eines. Necessita un sol recorregut.",
        introBody:
          "Quan la informació passa per correu, xat, videotrucada i document separat, la reunió es complica i l'equip perd temps. Summa Reu ho unifica perquè presidència, secretaria i coordinació treballin sobre el mateix flux.",
        bullets: [
          "Convocatòria i disponibilitat en un sol flux.",
          "Reunió i gravació des del mateix espai.",
          "Acta preparada per revisar i compartir.",
        ],
        sections: [
          {
            title: "Abans de la reunió",
            body: "Resol la data i comparteix la convocatòria sense recórrer a eines disperses.",
          },
          {
            title: "Durant la reunió",
            body: "Obre la sessió i controla la gravació des del mateix espai.",
          },
          {
            title: "Després de la reunió",
            body:
              "Tanca l'acta i deixa-la arxivada amb el mateix nivell d'ordre amb què s'ha convocat la junta.",
          },
        ],
        proofTitle: "Per què encaixa",
        proofItems: [
          "Millora la forma de convocar i tancar la reunió.",
          "Dona claredat a presidència, secretaria i coordinació.",
          "Evita postreunions improvisades per tancar documents.",
        ],
        ctaTitle: "Si la junta és important, el tancament també.",
        ctaBody:
          "Mostrem el flux complet amb convocatòria, reunió, acta i arxiu perquè la prova no quedi en un vídeo, sinó en un procés sencer.",
      },
      {
        key: "calls-voting",
        slug: "convocatories-i-votacions",
        navLabel: "Convocatòries i votacions",
        eyebrow: "Convocatòries i votacions",
        heroTitle: "Resol convocatòries i votacions sense convertir-les en setmanes de seguiment manual.",
        heroBody:
          "Comparteix l'enllaç, recull disponibilitat i fes que la millor data acabi convertida en reunió i acta dins del mateix producte.",
        metaTitle: "Convocatòries i votacions per a entitats | Summa Reu",
        metaDescription:
          "Gestiona convocatòries i votacions d'horari amb un flux que continua fins a la reunió, la gravació i l'acta final.",
        keywords: [
          "convocatòries i votacions",
          "votacions entitats",
          "resoldre disponibilitat reunió",
          "convocar junta entitat",
        ],
        introTitle: "La votació no és un final. És el primer pas del flux complet.",
        introBody:
          "El valor no és només trobar una data. És que la data guanyadora ja et porta a una reunió ben tancada i documentada, sense haver de reiniciar el procés en una altra eina.",
        bullets: [
          "Participació externa simple, sense comptes per als participants.",
          "Control intern complet per a l'entitat.",
          "Continuïtat natural cap a reunió i acta.",
        ],
        sections: [
          {
            title: "Participació sense fricció",
            body: "Els participants només obren l'enllaç i marquen disponibilitat. No cal afegir cap barrera extra.",
          },
          {
            title: "Lectura clara del resultat",
            body: "L'equip intern pot decidir ràpidament amb una vista neta de resultats i opcions guanyadores.",
          },
          {
            title: "De la data a la reunió",
            body:
              "La convocatòria no es perd. El flux continua fins a la sessió, la gravació i el tancament de l'acta.",
          },
        ],
        proofTitle: "Què evita",
        proofItems: [
          "Cadena eterna de correus per decidir data.",
          "Missatges duplicats per confirmar horaris.",
          "Separació artificial entre votació i reunió real.",
        ],
        ctaTitle: "Mostra'ns com convoqueu avui i et mostrem com passar de disponibilitat a reunió tancada sense fricció.",
        ctaBody:
          "La demo ensenya com passa la disponibilitat a reunió i com la reunió es converteix en acta sense canvis d'eina.",
      },
      {
        key: "associations",
        slug: "software-associacions",
        navLabel: "Associacions",
        eyebrow: "Associacions",
        heroTitle: "Software per a associacions per convocar reunions, gravar-les i tancar actes sense embolics.",
        heroBody:
          "Summa Reu ajuda a convocar, reunir i deixar l'acta llesta sense fer el procés més pesat per a l'equip ni per a la base social.",
        metaTitle: "Software per a associacions | Summa Reu",
        metaDescription:
          "Plataforma per a associacions: convocatòries, disponibilitat, reunió, gravació i actes amb IA en un únic flux.",
        introTitle: "Més ordre en el procés, menys feina artesanal.",
        introBody:
          "Quan la coordinació depèn de poques persones, qualsevol fricció es multiplica. Per això el flux ha de ser clar, lleuger i fàcil de tancar.",
        bullets: [
          "Juntes i assemblees amb millor ordre final.",
          "Participació externa controlada i simple.",
          "Actes preparades i consultables quan calgui.",
        ],
        sections: [
          {
            title: "Per a juntes i assemblees",
            body: "Summa Reu estructura la convocatòria, la reunió i el tancament posterior en un únic entorn.",
          },
          {
            title: "Per a equips petits",
            body: "Quan secretaria, presidència i coordinació comparteixen càrrega, un flux unit redueix desgast immediat.",
          },
          {
            title: "Per recuperar actes i acords",
            body:
              "Les actes, acords i exports queden accessibles quan toca justificar, recordar o recuperar decisions.",
          },
        ],
        proofTitle: "Benefici pràctic",
        proofItems: [
          "Menys dependència de persones concretes per tancar actes.",
          "Més ordre en juntes periòdiques i decisions recurrents.",
          "Millor imatge davant la pròpia organització.",
        ],
        ctaTitle: "Les associacions necessiten eines lleugeres, no improvisació constant.",
        ctaBody:
          "Fem una demo amb un cas real de junta o assemblea perquè es vegi el valor complet del flux.",
      },
      {
        key: "foundations",
        slug: "software-fundacions",
        navLabel: "Fundacions",
        eyebrow: "Fundacions",
        heroTitle: "Software per a fundacions per convocar, reunir i deixar l'acta ben guardada.",
        heroBody:
          "Organitza patronats i sessions amb un sistema que connecta convocatòria, disponibilitat, reunió, gravació i acta dins del mateix entorn.",
        metaTitle: "Software per a fundacions | Summa Reu",
        metaDescription:
          "Gestiona patronats, reunions i actes amb IA en una plataforma pensada per a fundacions i patronats.",
        introTitle: "La confiança institucional es construeix amb una reunió ben tancada.",
        introBody:
          "Per a fundacions, la reunió no és només coordinació. És deixar constància clara del que s'ha decidit i tenir l'acta a punt per guardar.",
        bullets: [
          "Patronats i sessions amb millor ordre final.",
          "Acta preparada per revisar sense començar de zero.",
          "Historial ordenat per consultes posteriors.",
        ],
        sections: [
          {
            title: "Més ordre en cada pas",
            body:
              "Cada pas queda ordenat per reduir improvisació i donar més consistència a l'acta final.",
          },
          {
            title: "Acta i arxiu",
            body: "El valor és poder passar de reunió a acta final sense afegir eines ni reconstruccions manuals.",
          },
          {
            title: "Per a presidència i secretaria",
            body:
              "El procés dona més control a qui convoca i a qui tanca l'acta, amb menys càrrega mecànica entre sessions.",
          },
        ],
        proofTitle: "Per què encaixa en fundacions",
        proofItems: [
          "Ajuda a donar formalitat a patronats recurrents.",
          "Millora l'arxiu i la recuperació posterior d'acords.",
          "Redueix postreunió manual sense perdre control.",
        ],
        ctaTitle: "Quan la sessió és seriosa, el tancament també ho ha de ser.",
        ctaBody:
          "Mostrem Summa Reu amb una sessió tipus de patronat perquè es vegi el flux complet de convocatòria, reunió i acta.",
      },
      {
        key: "cooperatives",
        slug: "software-cooperatives",
        navLabel: "Cooperatives",
        eyebrow: "Cooperatives",
        heroTitle: "Software per a cooperatives per convocar, reunir i tancar actes sense separar el procés.",
        heroBody:
          "Centralitza disponibilitat, reunió i acta per al consell rector o altres sessions sense repartir la feina en eines diferents.",
        metaTitle: "Software per a cooperatives | Summa Reu",
        metaDescription:
          "Plataforma per a cooperatives: convocatòries, disponibilitat, reunió, gravació i actes amb IA dins d'un únic flux.",
        introTitle: "Del consell rector a l'acta final sense perdre el fil.",
        introBody:
          "Les cooperatives necessiten processos clars, acords ben recollits i menys fricció entre la convocatòria i l'acta final. Aquesta és exactament la funció de Summa Reu.",
        bullets: [
          "Consell rector amb millor seguiment d'acords.",
          "Menys salt entre disponibilitat, reunió i arxiu.",
          "Acta exportable i consultable al mateix espai.",
        ],
        sections: [
          {
            title: "Flux connectat",
            body:
              "La part institucional i la part pràctica de la reunió viuen dins d'un mateix flux, no en peces separades.",
          },
          {
            title: "Seguiment més clar",
            body: "Acords, responsables i acta final queden més accessibles per a la sessió següent.",
          },
          {
            title: "Menys càrrega invisible",
            body:
              "El temps que avui es perd en coordinació i reconstrucció de l'acta final es redueix de manera tangible.",
          },
        ],
        proofTitle: "Resultat pràctic",
        proofItems: [
          "Millor ordre documental del consell rector.",
          "Més ordre sense afegir burocràcia artificial.",
          "Més facilitat per recuperar actes i acords.",
        ],
        ctaTitle: "Si la cooperativa decideix sovint, el procés ha d'estar ben resolt.",
        ctaBody:
          "Fem la demo sobre un cas de consell rector i et mostrem com es tanca la reunió amb l'acta preparada.",
      },
    ],
  },
  es: {
    headerLinks: [
      { label: "Convocatorias y votaciones", href: "/convocatorias-y-votaciones" },
      { label: "Juntas directivas", href: "/software-juntas-directivas" },
      { label: "Actas con IA", href: "/actas-ia-entidades" },
    ],
    trustBand: [
      "Convocatoria, disponibilidad, reunión, grabación y acta en un solo flujo",
      "La grabación se convierte en transcripción y acta revisable",
      "Archivo consultable y ordenado",
      "Pensado para juntas, patronatos y equipos de coordinación",
    ],
    editorialEyebrow: "Todo conectado",
    editorialTitle: "Convoca, reúnete y cierra el acta en el mismo lugar.",
    editorialBody:
      "Summa Reu conecta convocatoria, disponibilidad, reunión, grabación y acta final para que no tengas que saltar entre correo, videollamada y documentos separados.",
    editorialBullets: [
      "Comparte la convocatoria y recoge disponibilidad con un solo enlace.",
      "Abre la reunión y controla la grabación desde el mismo espacio privado de la entidad.",
      "Recibe un acta preparada para revisar, exportar y dejar guardada en el mismo flujo.",
    ],
    sectorsEyebrow: "Dónde encaja mejor",
    sectorsTitle: "Un solo espacio para convocar, reunirse y cerrar actas.",
    sectorsBody:
      "Asociaciones, fundaciones, cooperativas y equipos que quieren gestionar convocatorias, disponibilidad, reuniones, grabación y actas sin repartirlo en herramientas diferentes.",
    sectorsIntro: "Casos de uso prioritarios",
    landingSectionEyebrow: "Mismo producto, tres entradas",
    landingSectionTitle: "Puedes entrar por la convocatoria, por la reunión o por el acta, pero el producto es uno solo.",
    landingSectionBody:
      "Estas páginas te ayudan a ver Summa Reu desde la necesidad que tienes hoy, pero todas desembocan en el mismo recorrido: convocar, reunirse, grabar y cerrar el acta.",
    finalEyebrow: "Summa Reu",
    finalTitle: "Menos herramientas separadas. Más reuniones bien cerradas.",
    finalBody:
      "Si hoy convocáis en un sitio, os reunís en otro y cerráis el acta en un tercero, Summa Reu os lo une en un solo flujo.",
    finalPrimaryCta: "Activa el espacio",
    finalSecondaryCta: "Acceso entidad",
    softwareSchemaName: "Summa Reu",
    softwareSchemaDescription:
      "Plataforma para convocar reuniones, recoger disponibilidad, grabar la sesión y cerrar el acta en un único flujo.",
    landings: [
      {
        key: "actes-ai",
        slug: "actas-ia-entidades",
        navLabel: "Actas con IA",
        eyebrow: "Actas con IA",
        heroTitle: "Actas con IA para cerrar la reunión sin empezar de cero.",
        heroBody:
          "Convoca, reúnete, graba la sesión y recibe un acta revisable dentro del mismo espacio. Sin reconstruir la sesión a mano ni perseguir notas dispersas.",
        metaTitle: "Actas con IA para entidades | Summa Reu",
        metaDescription:
          "Genera actas con IA a partir de la reunión que ya has convocado y grabado. Revisa, exporta y archiva todo dentro del mismo flujo de Summa Reu.",
        keywords: [
          "actas con IA",
          "actas para entidades",
          "software actas juntas",
          "transcripción reunión entidades",
        ],
        introTitle: "La reunión no acaba cuando se apaga la cámara. Acaba cuando el acta está lista.",
        introBody:
          "La reunión no termina cuando se cierra la videollamada. Termina cuando el acta está preparada, revisada y guardada en el mismo espacio. Ahí es donde Summa Reu elimina más trabajo manual.",
        bullets: [
          "Transcripción y borrador de acta dentro del mismo entorno privado.",
          "Acta editable antes de exportar o compartir.",
          "Archivo consultable sin buscar documentos en canales separados.",
        ],
        sections: [
          {
            title: "De la reunión al acta",
            body:
              "La grabación pasa a transcripción y después a un acta revisable. Secretaría deja de empezar desde cero después de cada sesión.",
          },
          {
            title: "IA aplicada donde aporta valor",
            body:
              "No es IA ornamental. Es IA orientada a reducir trabajo manual después de la reunión y acelerar el momento de cerrar el acta.",
          },
          {
            title: "Archivo y exportación",
            body:
              "Cuando hace falta compartir el acta o recuperar acuerdos anteriores, todo queda dentro de Summa Reu y se puede exportar sin reconstrucciones.",
          },
        ],
        proofTitle: "Qué resuelve",
        proofItems: [
          "Evita perseguir notas, audios y versiones dispersas.",
          "Reduce dependencia de una sola persona para cerrar el acta.",
          "El acta queda guardada y es fácil de recuperar.",
        ],
        ctaTitle: "Enséñanos una reunión y te mostramos cómo queda el acta lista.",
        ctaBody:
          "La demo tiene que entenderse en cinco minutos: reunión, transcripción, acta revisable y archivo final en el mismo lugar.",
      },
      {
        key: "boards",
        slug: "software-juntas-directivas",
        navLabel: "Juntas directivas",
        eyebrow: "Juntas directivas",
        heroTitle: "Software para juntas directivas para convocar, reunirse y cerrar actas sin cambiar de herramienta.",
        heroBody:
          "Comparte la convocatoria, recoge disponibilidad, abre la reunión, grábala y deja el acta preparada para revisar.",
        metaTitle: "Software para juntas directivas | Summa Reu",
        metaDescription:
          "Plataforma para gestionar convocatorias, disponibilidad, reuniones, grabación y actas de juntas directivas en un único flujo.",
        keywords: [
          "software juntas directivas",
          "convocatorias junta",
          "actas junta directiva",
        ],
        introTitle: "La junta no necesita más herramientas. Necesita un solo recorrido.",
        introBody:
          "Cuando la información pasa por correo, chat, videollamada y documento separado, la reunión se complica y el equipo pierde tiempo. Summa Reu lo unifica para que presidencia, secretaría y coordinación trabajen sobre el mismo flujo.",
        bullets: [
          "Convocatoria y disponibilidad en un solo flujo.",
          "Reunión y grabación desde el mismo espacio.",
          "Acta preparada para revisar y compartir.",
        ],
        sections: [
          {
            title: "Antes de la reunión",
            body: "Resuelve la fecha y comparte la convocatoria sin recurrir a herramientas dispersas.",
          },
          {
            title: "Durante la reunión",
            body: "Abre la sesión y controla la grabación desde el mismo espacio.",
          },
          {
            title: "Después de la reunión",
            body:
              "Cierra el acta y déjala archivada con el mismo nivel de orden con el que se convocó la junta.",
          },
        ],
        proofTitle: "Por qué encaja",
        proofItems: [
          "Mejora la forma de convocar y cerrar la reunión.",
          "Da claridad a presidencia, secretaría y coordinación.",
          "Evita postreuniones improvisadas para cerrar documentos.",
        ],
        ctaTitle: "Si la junta es importante, el cierre también.",
        ctaBody:
          "Mostramos el flujo completo con convocatoria, reunión, acta y archivo para que la prueba no se quede en un vídeo, sino en un proceso entero.",
      },
      {
        key: "calls-voting",
        slug: "convocatorias-y-votaciones",
        navLabel: "Convocatorias y votaciones",
        eyebrow: "Convocatorias y votaciones",
        heroTitle: "Resuelve convocatorias y votaciones sin convertirlas en semanas de seguimiento manual.",
        heroBody:
          "Comparte el enlace, recoge disponibilidad y haz que la mejor fecha termine convertida en reunión y acta dentro del mismo producto.",
        metaTitle: "Convocatorias y votaciones para entidades | Summa Reu",
        metaDescription:
          "Gestiona convocatorias y votaciones de horario con un flujo que continúa hasta la reunión, la grabación y el acta final.",
        keywords: [
          "convocatorias y votaciones",
          "votaciones entidades",
          "resolver disponibilidad reunión",
          "convocar junta entidad",
        ],
        introTitle: "La votación no es un final. Es el primer paso del flujo completo.",
        introBody:
          "El valor no es solo encontrar una fecha. Es que la fecha ganadora ya te lleva a una reunión bien cerrada y documentada, sin reiniciar el proceso en otra herramienta.",
        bullets: [
          "Participación externa simple, sin cuentas para los participantes.",
          "Control interno completo para la entidad.",
          "Continuidad natural hacia reunión y acta.",
        ],
        sections: [
          {
            title: "Participación sin fricción",
            body: "Los participantes solo abren el enlace y marcan disponibilidad. No hace falta añadir ninguna barrera extra.",
          },
          {
            title: "Lectura clara del resultado",
            body: "El equipo interno puede decidir rápido con una vista limpia de resultados y opciones ganadoras.",
          },
          {
            title: "De la fecha a la reunión",
            body:
              "La convocatoria no se pierde. El flujo continúa hasta la sesión, la grabación y el cierre del acta.",
          },
        ],
        proofTitle: "Qué evita",
        proofItems: [
          "Cadena eterna de correos para decidir fecha.",
          "Mensajes duplicados para confirmar horarios.",
          "Separación artificial entre votación y reunión real.",
        ],
        ctaTitle: "Enséñanos cómo convocáis hoy y te mostramos cómo pasar de disponibilidad a reunión cerrada sin fricción.",
        ctaBody:
          "La demo enseña cómo la disponibilidad pasa a reunión y cómo la reunión se convierte en acta sin cambiar de herramienta.",
      },
      {
        key: "associations",
        slug: "software-asociaciones",
        navLabel: "Asociaciones",
        eyebrow: "Asociaciones",
        heroTitle: "Software para asociaciones para convocar reuniones, grabarlas y cerrar actas sin lío.",
        heroBody:
          "Summa Reu ayuda a convocar, reunir y dejar el acta lista sin hacer el proceso más pesado para el equipo ni para la base social.",
        metaTitle: "Software para asociaciones | Summa Reu",
        metaDescription:
          "Plataforma para asociaciones: convocatorias, disponibilidad, reunión, grabación y actas con IA en un único flujo.",
        introTitle: "Más orden en el proceso, menos trabajo artesanal.",
        introBody:
          "Cuando la coordinación depende de pocas personas, cualquier fricción se multiplica. Por eso el flujo tiene que ser claro, ligero y archivable.",
        bullets: [
          "Juntas y asambleas con mejor orden final.",
          "Participación externa controlada y simple.",
          "Actas preparadas y consultables cuando haga falta.",
        ],
        sections: [
          {
            title: "Para juntas y asambleas",
            body: "Summa Reu estructura la convocatoria, la reunión y el cierre posterior en un único entorno.",
          },
          {
            title: "Para equipos pequeños",
            body: "Cuando secretaría, presidencia y coordinación comparten carga, un flujo unido reduce desgaste inmediato.",
          },
          {
            title: "Para recuperar actas y acuerdos",
            body:
              "Las actas, acuerdos y exportaciones quedan accesibles cuando toca justificar, recordar o recuperar decisiones.",
          },
        ],
        proofTitle: "Beneficio práctico",
        proofItems: [
          "Menos dependencia de personas concretas para cerrar actas.",
          "Más orden en juntas periódicas y decisiones recurrentes.",
          "Mejor imagen ante la propia organización.",
        ],
        ctaTitle: "Las asociaciones necesitan herramientas ligeras, no improvisación constante.",
        ctaBody:
          "Hacemos una demo con un caso real de junta o asamblea para que se vea el valor completo del flujo.",
      },
      {
        key: "foundations",
        slug: "software-fundaciones",
        navLabel: "Fundaciones",
        eyebrow: "Fundaciones",
        heroTitle: "Software para fundaciones para convocar, reunir y dejar el acta bien guardada.",
        heroBody:
          "Organiza patronatos y sesiones con un sistema que conecta convocatoria, disponibilidad, reunión, grabación y acta dentro del mismo entorno.",
        metaTitle: "Software para fundaciones | Summa Reu",
        metaDescription:
          "Gestiona patronatos, reuniones y actas con IA en una plataforma pensada para fundaciones y patronatos.",
        introTitle: "La confianza institucional se construye con una reunión bien cerrada.",
        introBody:
          "Para las fundaciones, la reunión no es solo coordinación. Es dejar constancia clara de lo que se ha decidido y tener el acta a punto para guardar.",
        bullets: [
          "Patronatos y sesiones con mejor orden final.",
          "Acta preparada para revisar sin empezar desde cero.",
          "Historial ordenado para consultas posteriores.",
        ],
        sections: [
          {
            title: "Más orden en cada paso",
            body:
              "Cada paso queda ordenado para reducir improvisación y dar más consistencia al acta final.",
          },
          {
            title: "Acta y archivo",
            body: "El valor es poder pasar de reunión a acta final sin añadir herramientas ni reconstrucciones manuales.",
          },
          {
            title: "Para presidencia y secretaría",
            body:
              "El proceso da más control a quien convoca y a quien cierra el acta, con menos carga mecánica entre sesiones.",
          },
        ],
        proofTitle: "Por qué encaja en fundaciones",
        proofItems: [
          "Ayuda a dar formalidad a patronatos recurrentes.",
          "Mejora el archivo y la recuperación posterior de acuerdos.",
          "Reduce postreunión manual sin perder control.",
        ],
        ctaTitle: "Cuando la sesión es seria, el cierre también tiene que serlo.",
        ctaBody:
          "Mostramos Summa Reu con una sesión tipo de patronato para ver el flujo completo de convocatoria, reunión y acta.",
      },
      {
        key: "cooperatives",
        slug: "software-cooperativas",
        navLabel: "Cooperativas",
        eyebrow: "Cooperativas",
        heroTitle: "Software para cooperativas para convocar, reunir y cerrar actos sin separar el proceso.",
        heroBody:
          "Centraliza disponibilidad, reunión y acta para el consejo rector u otras sesiones sin repartir la feina en herramientas diferentes.",
        metaTitle: "Software para cooperativas | Summa Reu",
        metaDescription:
          "Plataforma para cooperativas: convocatorias, disponibilidad, reunión, grabación y actas con IA dentro de un único flujo.",
        introTitle: "Del consejo rector al acta final sin perder el hilo.",
        introBody:
          "Las cooperativas necesitan procesos claros, acuerdos bien recogidos y menos fricción entre la convocatoria y el acta final. Esa es exactamente la función de Summa Reu.",
        bullets: [
          "Consejo rector con mejor seguimiento de acuerdos.",
          "Menos salto entre disponibilidad, reunión y archivo.",
          "Acta exportable y consultable en el mismo espacio.",
        ],
        sections: [
          {
            title: "Flujo conectado",
            body:
              "La parte institucional y la parte práctica de la reunión viven dentro de un mismo flujo, no en piezas separadas.",
          },
          {
            title: "Seguimiento más claro",
            body: "Acuerdos, responsables y acta final quedan más accesibles para la sesión siguiente.",
          },
          {
            title: "Menos carga invisible",
            body:
              "El tiempo que hoy se pierde en coordinación y reconstrucción del acta final se reduce de forma tangible.",
          },
        ],
        proofTitle: "Resultado práctico",
        proofItems: [
          "Mejor orden documental del consejo rector.",
          "Más orden sin añadir burocracia artificial.",
          "Más facilidad para recuperar actas y acuerdos.",
        ],
        ctaTitle: "Si la cooperativa decide a menudo, el proceso tiene que estar bien resuelto.",
        ctaBody:
          "Hacemos la demo sobre un caso de consejo rector y mostramos cómo se cierra la reunión con el acta preparada.",
      },
    ],
  },
};

export function getMarketingContent(locale: I18nLocale): MarketingLocaleContent {
  return marketingContent[locale];
}

export function getMarketingPages(locale: I18nLocale): MarketingLanding[] {
  return marketingContent[locale].landings;
}

export function getMarketingPageBySlug(locale: I18nLocale, slug: string): MarketingLanding | null {
  return marketingContent[locale].landings.find((page) => page.slug === slug) ?? null;
}

export function getMarketingPageByKey(
  locale: I18nLocale,
  key: MarketingLanding["key"]
): MarketingLanding | null {
  return marketingContent[locale].landings.find((page) => page.key === key) ?? null;
}

export function getAllMarketingPaths(): Array<{ locale: I18nLocale; slug: string }> {
  return (["ca", "es"] as const).flatMap((locale) =>
    marketingContent[locale].landings.map((page) => ({ locale, slug: page.slug }))
  );
}
