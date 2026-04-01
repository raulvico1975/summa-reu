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
      { label: "Actes amb IA", href: "/actes-ia-entitats" },
      { label: "Juntes directives", href: "/software-juntes-directives" },
      { label: "Convocatòries i votacions", href: "/convocatories-i-votacions" },
    ],
    trustBand: [
      "Actes generades amb IA i revisables",
      "Traçabilitat clara de decisions i acords",
      "Arxiu exportable i consultable",
      "Pensat per a juntes, patronats i equips de coordinació",
    ],
    editorialEyebrow: "Tot connectat",
    editorialTitle: "La reunió acaba. L'acta ja està feta.",
    editorialBody:
      "Summa Reu connecta convocatòria, reunió, transcripció i arxiu final perquè la junta no depengui de canals dispersos ni de postreunió manual.",
    editorialBullets: [
      "Comparteix la votació pública i fixa la millor data sense perseguir respostes.",
      "Obre la reunió i controla la gravació des del mateix espai privat de l'entitat.",
      "Rep una acta preparada per revisar, exportar i deixar arxivada al mateix flux.",
    ],
    sectorsEyebrow: "On encaixa millor",
    sectorsTitle: "Governança operativa per a entitats que necessiten criteri, rastre i arxiu.",
    sectorsBody:
      "Associacions, fundacions, cooperatives i equips que volen professionalitzar juntes, patronats, convocatòries i actes sense fer-ho pesat.",
    sectorsIntro: "Casos d'ús prioritaris",
    landingSectionEyebrow: "Landings comercials",
    landingSectionTitle: "Superfícies pensades per captar intenció real, no només trànsit genèric.",
    landingSectionBody:
      "Cada landing treballa un problema concret: actes amb IA, juntes directives, convocatòries, associacions, fundacions o cooperatives.",
    finalEyebrow: "Summa Reu",
    finalTitle: "Menys postreunió. Més decisions ben documentades.",
    finalBody:
      "Si la vostra entitat vol reduir coordinació i tancar actes amb més control, aquí teniu un flux complet per convocar, reunir i arxivar sense dispersió.",
    finalPrimaryCta: "Activa l'espai",
    finalSecondaryCta: "Accés entitat",
    softwareSchemaName: "Summa Reu",
    softwareSchemaDescription:
      "Plataforma de governança operativa per a entitats: convocatòries, votacions, reunió, transcripció i actes amb IA en un únic flux.",
    landings: [
      {
        key: "actes-ai",
        slug: "actes-ia-entitats",
        navLabel: "Actes amb IA",
        eyebrow: "Actes amb IA",
        heroTitle: "Actes amb IA per a entitats que necessiten rastre i criteri.",
        heroBody:
          "Grava la reunió, genera la transcripció i prepara una acta revisable dins del mateix espai. Sense reconstruir la sessió a mà ni perseguir notes disperses.",
        metaTitle: "Actes amb IA per a entitats | Summa Reu",
        metaDescription:
          "Genera actes amb IA a partir de la reunió o de les notes base. Revisa, exporta i arxiva-ho tot dins del mateix flux de Summa Reu.",
        introTitle: "El diferencial no és la gravació. És el tancament.",
        introBody:
          "La reunió no acaba quan es tanca la videotrucada. Acaba quan l'acta està preparada, revisada i guardada. Aquest és el punt on Summa Reu elimina més feina manual.",
        bullets: [
          "Transcripció i esborrany d'acta dins del mateix entorn privat.",
          "Acta editable abans d'exportar o compartir.",
          "Arxiu consultable sense buscar documents en canals separats.",
        ],
        sections: [
          {
            title: "De la reunió al document final",
            body:
              "La gravació passa a transcripció i després a acta revisable. El secretariat deixa de començar de zero després de cada sessió.",
          },
          {
            title: "IA aplicada on aporta valor",
            body:
              "No és IA ornamental. És IA orientada a reduir postreunió manual i accelerar el tancament institucional.",
          },
          {
            title: "Arxiu i exportació",
            body:
              "Quan cal compartir l'acta o recuperar acords anteriors, tot queda dins del mateix espai i es pot exportar sense reconstruccions.",
          },
        ],
        proofTitle: "Què resol",
        proofItems: [
          "Evita perseguir notes, àudios i versions disperses.",
          "Redueix dependència d'una sola persona per tancar l'acta.",
          "Manté traçabilitat clara del resultat final.",
        ],
        ctaTitle: "Mostra'ns una reunió i et mostrem com queda l'acta.",
        ctaBody:
          "La demo s'ha d'entendre en cinc minuts: reunió, transcripció, acta revisable i arxiu final al mateix lloc.",
      },
      {
        key: "boards",
        slug: "software-juntes-directives",
        navLabel: "Juntes directives",
        eyebrow: "Juntes directives",
        heroTitle: "Software per a juntes directives que volen decidir amb traçabilitat.",
        heroBody:
          "Convoca, fixa data, celebra la reunió i deixa constància clara d'acords, responsables i documentació final sense dependre de fils dispersos.",
        metaTitle: "Software per a juntes directives | Summa Reu",
        metaDescription:
          "Plataforma per convocar, reunir i tancar actes de juntes directives amb més control, menys postreunió i arxiu ordenat.",
        introTitle: "La junta no necessita més canals. Necessita un fil únic.",
        introBody:
          "Quan la informació passa per correu, xat, videotrucada i document separat, la reunió perd rastre. Summa Reu ho unifica.",
        bullets: [
          "Convocatòria i disponibilitat en un sol flux.",
          "Registre clar d'acords i següents passos.",
          "Acta preparada per revisar i compartir.",
        ],
        sections: [
          {
            title: "Abans de la reunió",
            body: "Resol la data i comparteix la convocatòria sense recórrer a eines disperses.",
          },
          {
            title: "Durant la reunió",
            body: "Obre la sessió i controla la gravació des del mateix espai de governança.",
          },
          {
            title: "Després de la reunió",
            body:
              "Tanca l'acta i deixa-la arxivada amb el mateix nivell d'ordre amb què s'ha convocat la junta.",
          },
        ],
        proofTitle: "Per què encaixa",
        proofItems: [
          "Millora formalitat i seguiment de decisions.",
          "Dona claredat a presidència, secretaria i coordinació.",
          "Evita postreunions improvisades per tancar documents.",
        ],
        ctaTitle: "Si la junta és important, el tancament també.",
        ctaBody:
          "Mostrem el flux complet amb decisions, acta i arxiu perquè la prova no quedi en un vídeo, sinó en un procés sencer.",
      },
      {
        key: "calls-voting",
        slug: "convocatories-i-votacions",
        navLabel: "Convocatòries i votacions",
        eyebrow: "Convocatòries i votacions",
        heroTitle: "Resol convocatòries i votacions sense convertir-les en setmanes de seguiment manual.",
        heroBody:
          "Comparteix l'enllaç, recull disponibilitat i fes que la millor data acabi convertida en reunió i acta dins del mateix sistema.",
        metaTitle: "Convocatòries i votacions per a entitats | Summa Reu",
        metaDescription:
          "Gestiona convocatòries i votacions d'horari amb un flux que continua fins a la reunió i l'acta final.",
        introTitle: "La votació no és un final. És l'entrada al flux complet.",
        introBody:
          "El valor no és només trobar una data. És que la data guanyadora ja et porta a una reunió ben tancada i documentada.",
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
              "La convocatòria no es perd. El flux continua fins a la sessió i el tancament documental.",
          },
        ],
        proofTitle: "Què evita",
        proofItems: [
          "Cadena eterna de correus per decidir data.",
          "Missatges duplicats per confirmar horaris.",
          "Separació artificial entre votació i reunió real.",
        ],
        ctaTitle: "Mostra'ns com convoqueu avui i et mostrem un flux més net.",
        ctaBody:
          "La demo ensenya com passa la disponibilitat a reunió i com la reunió es converteix en acta sense canvis d'eina.",
      },
      {
        key: "associations",
        slug: "software-associacions",
        navLabel: "Associacions",
        eyebrow: "Associacions",
        heroTitle: "Software per a associacions que volen professionalitzar juntes, assemblees i actes.",
        heroBody:
          "Summa Reu ajuda a convocar, reunir i deixar rastre clar de decisions sense fer el procés més pesat per a l'equip ni per a la base social.",
        metaTitle: "Software per a associacions | Summa Reu",
        metaDescription:
          "Plataforma per a associacions: convocatòries, votacions, reunió i actes amb IA en un únic flux de governança.",
        introTitle: "Més ordre institucional, menys feina artesanal.",
        introBody:
          "Quan la coordinació depèn de poques persones, qualsevol fricció es multiplica. Per això el flux ha de ser clar, lleuger i arxivable.",
        bullets: [
          "Juntes i assemblees amb millor traçabilitat.",
          "Participació externa controlada i simple.",
          "Actes preparades i consultables quan calgui.",
        ],
        sections: [
          {
            title: "Per a juntes i assemblees",
            body: "Summa Reu estructura tant la part de convocatòria com el tancament posterior en un únic entorn.",
          },
          {
            title: "Per a equips petits",
            body: "Quan secretaria, presidència i coordinació comparteixen càrrega, un flux unit redueix desgast immediat.",
          },
          {
            title: "Per a la memòria institucional",
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
        heroTitle: "Software per a fundacions que necessiten formalitat, arxiu i traçabilitat real.",
        heroBody:
          "Organitza patronats i sessions de govern amb un sistema que connecta convocatòria, reunió, acta i arxiu final dins del mateix entorn.",
        metaTitle: "Software per a fundacions | Summa Reu",
        metaDescription:
          "Gestiona patronats, reunions i actes amb IA en una plataforma pensada per a fundacions i òrgans de govern.",
        introTitle: "La confiança institucional es construeix amb procés i registre.",
        introBody:
          "Per a fundacions, la reunió no és només coordinació. És governança. Per això el valor està en la claredat del rastre i la solidesa del tancament.",
        bullets: [
          "Patronats i sessions amb millor registre final.",
          "Acta preparada per revisar sense començar de zero.",
          "Historial ordenat per consultes posteriors.",
        ],
        sections: [
          {
            title: "Més criteri en el flux",
            body:
              "Cada pas queda ordenat per reduir improvisació i per donar més consistència a la documentació final.",
          },
          {
            title: "Acta i arxiu",
            body: "El valor és poder passar de reunió a document final sense afegir eines ni reconstruccions manuals.",
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
        ctaTitle: "Quan la governança és seriosa, el flux també ho ha de ser.",
        ctaBody:
          "Mostrem Summa Reu amb una sessió tipus de patronat perquè es valori el control documental i operatiu.",
      },
      {
        key: "cooperatives",
        slug: "software-cooperatives",
        navLabel: "Cooperatives",
        eyebrow: "Cooperatives",
        heroTitle: "Software per a cooperatives que volen decisions més ben documentades i menys dispersió.",
        heroBody:
          "Centralitza disponibilitat, reunió i acta per al consell rector o altres espais de govern sense separar el procés en eines inconnexes.",
        metaTitle: "Software per a cooperatives | Summa Reu",
        metaDescription:
          "Plataforma per a cooperatives: convocatòries, consell rector, reunió i actes amb IA dins d'un únic flux.",
        introTitle: "Del consell rector a l'acta final sense perdre context.",
        introBody:
          "Les cooperatives necessiten processos clars, rastre dels acords i menys fricció entre convocatòria i documentació. Aquesta és exactament la funció de Summa Reu.",
        bullets: [
          "Consell rector amb millor seguiment d'acords.",
          "Menys salt entre disponibilitat, reunió i arxiu.",
          "Acta exportable i consultable al mateix espai.",
        ],
        sections: [
          {
            title: "Govern i operativa connectats",
            body:
              "La part institucional i la part pràctica de la reunió viuen dins d'un mateix flux, no en peces separades.",
          },
          {
            title: "Seguiment més clar",
            body: "Acords, responsables i tancament documental queden més accessibles per a la sessió següent.",
          },
          {
            title: "Menys càrrega invisible",
            body:
              "El temps que avui es perd en coordinació i reconstrucció del document final es redueix de manera tangible.",
          },
        ],
        proofTitle: "Resultat pràctic",
        proofItems: [
          "Millor rastre documental del consell rector.",
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
      { label: "Actas con IA", href: "/actas-ia-entidades" },
      { label: "Juntas directivas", href: "/software-juntas-directivas" },
      { label: "Convocatorias y votaciones", href: "/convocatorias-y-votaciones" },
    ],
    trustBand: [
      "Actas generadas con IA y listas para revisar",
      "Trazabilidad clara de decisiones y acuerdos",
      "Archivo exportable y consultable",
      "Pensado para juntas, patronatos y equipos de coordinación",
    ],
    editorialEyebrow: "Todo conectado",
    editorialTitle: "La reunión termina. El acta ya está hecha.",
    editorialBody:
      "Summa Reu conecta convocatoria, reunión, transcripción y archivo final para que la junta no dependa de canales dispersos ni de postreunión manual.",
    editorialBullets: [
      "Comparte la votación pública y fija la mejor fecha sin perseguir respuestas.",
      "Abre la reunión y controla la grabación desde el mismo espacio privado de la entidad.",
      "Recibe un acta preparada para revisar, exportar y dejar archivada en el mismo flujo.",
    ],
    sectorsEyebrow: "Dónde encaja mejor",
    sectorsTitle: "Gobernanza operativa para entidades que necesitan criterio, rastro y archivo.",
    sectorsBody:
      "Asociaciones, fundaciones, cooperativas y equipos que quieren profesionalizar juntas, patronatos, convocatorias y actas sin volver el proceso pesado.",
    sectorsIntro: "Casos de uso prioritarios",
    landingSectionEyebrow: "Landings comerciales",
    landingSectionTitle: "Superficies pensadas para captar intención real, no solo tráfico genérico.",
    landingSectionBody:
      "Cada landing trabaja un problema concreto: actas con IA, juntas directivas, convocatorias, asociaciones, fundaciones o cooperativas.",
    finalEyebrow: "Summa Reu",
    finalTitle: "Menos postreunión. Más decisiones bien documentadas.",
    finalBody:
      "Si vuestra entidad quiere reducir coordinación y cerrar actas con más control, aquí tenéis un flujo completo para convocar, reunir y archivar sin dispersión.",
    finalPrimaryCta: "Activa el espacio",
    finalSecondaryCta: "Acceso entidad",
    softwareSchemaName: "Summa Reu",
    softwareSchemaDescription:
      "Plataforma de gobernanza operativa para entidades: convocatorias, votaciones, reunión, transcripción y actas con IA en un único flujo.",
    landings: [
      {
        key: "actes-ai",
        slug: "actas-ia-entidades",
        navLabel: "Actas con IA",
        eyebrow: "Actas con IA",
        heroTitle: "Actas con IA para entidades que necesitan rastro y criterio.",
        heroBody:
          "Graba la reunión, genera la transcripción y prepara un acta revisable dentro del mismo espacio. Sin reconstruir la sesión a mano ni perseguir notas dispersas.",
        metaTitle: "Actas con IA para entidades | Summa Reu",
        metaDescription:
          "Genera actas con IA a partir de la reunión o de notas base. Revisa, exporta y archiva todo dentro del mismo flujo de Summa Reu.",
        introTitle: "La diferencia no es la grabación. Es el cierre.",
        introBody:
          "La reunión no termina cuando se cierra la videollamada. Termina cuando el acta está preparada, revisada y guardada. Ahí es donde Summa Reu elimina más trabajo manual.",
        bullets: [
          "Transcripción y borrador de acta dentro del mismo entorno privado.",
          "Acta editable antes de exportar o compartir.",
          "Archivo consultable sin buscar documentos en canales separados.",
        ],
        sections: [
          {
            title: "De la reunión al documento final",
            body:
              "La grabación pasa a transcripción y después a un acta revisable. Secretaría deja de empezar desde cero después de cada sesión.",
          },
          {
            title: "IA aplicada donde aporta valor",
            body:
              "No es IA ornamental. Es IA orientada a reducir postreunión manual y acelerar el cierre institucional.",
          },
          {
            title: "Archivo y exportación",
            body:
              "Cuando hace falta compartir el acta o recuperar acuerdos anteriores, todo queda en el mismo espacio y se puede exportar sin reconstrucciones.",
          },
        ],
        proofTitle: "Qué resuelve",
        proofItems: [
          "Evita perseguir notas, audios y versiones dispersas.",
          "Reduce dependencia de una sola persona para cerrar el acta.",
          "Mantiene trazabilidad clara del resultado final.",
        ],
        ctaTitle: "Enséñanos una reunión y te enseñamos cómo queda el acta.",
        ctaBody:
          "La demo tiene que entenderse en cinco minutos: reunión, transcripción, acta revisable y archivo final en el mismo lugar.",
      },
      {
        key: "boards",
        slug: "software-juntas-directivas",
        navLabel: "Juntas directivas",
        eyebrow: "Juntas directivas",
        heroTitle: "Software para juntas directivas que quieren decidir con trazabilidad.",
        heroBody:
          "Convoca, fija fecha, celebra la reunión y deja constancia clara de acuerdos, responsables y documentación final sin depender de hilos dispersos.",
        metaTitle: "Software para juntas directivas | Summa Reu",
        metaDescription:
          "Plataforma para convocar, reunir y cerrar actas de juntas directivas con más control, menos postreunión y archivo ordenado.",
        introTitle: "La junta no necesita más canales. Necesita un hilo único.",
        introBody:
          "Cuando la información pasa por correo, chat, videollamada y documento separado, la reunión pierde rastro. Summa Reu lo unifica.",
        bullets: [
          "Convocatoria y disponibilidad en un solo flujo.",
          "Registro claro de acuerdos y siguientes pasos.",
          "Acta preparada para revisar y compartir.",
        ],
        sections: [
          {
            title: "Antes de la reunión",
            body: "Resuelve la fecha y comparte la convocatoria sin recurrir a herramientas dispersas.",
          },
          {
            title: "Durante la reunión",
            body: "Abre la sesión y controla la grabación desde el mismo espacio de gobernanza.",
          },
          {
            title: "Después de la reunión",
            body:
              "Cierra el acta y déjala archivada con el mismo nivel de orden con el que se convocó la junta.",
          },
        ],
        proofTitle: "Por qué encaja",
        proofItems: [
          "Mejora formalidad y seguimiento de decisiones.",
          "Da claridad a presidencia, secretaría y coordinación.",
          "Evita postreuniones improvisadas para cerrar documentos.",
        ],
        ctaTitle: "Si la junta es importante, el cierre también.",
        ctaBody:
          "Mostramos el flujo completo con decisiones, acta y archivo para que la prueba no se quede en un vídeo, sino en un proceso entero.",
      },
      {
        key: "calls-voting",
        slug: "convocatorias-y-votaciones",
        navLabel: "Convocatorias y votaciones",
        eyebrow: "Convocatorias y votaciones",
        heroTitle: "Resuelve convocatorias y votaciones sin convertirlas en semanas de seguimiento manual.",
        heroBody:
          "Comparte el enlace, recoge disponibilidad y haz que la mejor fecha termine convertida en reunión y acta dentro del mismo sistema.",
        metaTitle: "Convocatorias y votaciones para entidades | Summa Reu",
        metaDescription:
          "Gestiona convocatorias y votaciones de horario con un flujo que continúa hasta la reunión y el acta final.",
        introTitle: "La votación no es un final. Es la entrada al flujo completo.",
        introBody:
          "El valor no es solo encontrar una fecha. Es que la fecha ganadora ya te lleva a una reunión bien cerrada y documentada.",
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
              "La convocatoria no se pierde. El flujo continúa hasta la sesión y el cierre documental.",
          },
        ],
        proofTitle: "Qué evita",
        proofItems: [
          "Cadena eterna de correos para decidir fecha.",
          "Mensajes duplicados para confirmar horarios.",
          "Separación artificial entre votación y reunión real.",
        ],
        ctaTitle: "Enséñanos cómo convocáis hoy y te mostramos un flujo más limpio.",
        ctaBody:
          "La demo enseña cómo la disponibilidad pasa a reunión y cómo la reunión se convierte en acta sin cambiar de herramienta.",
      },
      {
        key: "associations",
        slug: "software-asociaciones",
        navLabel: "Asociaciones",
        eyebrow: "Asociaciones",
        heroTitle: "Software para asociaciones que quieren profesionalizar juntas, asambleas y actas.",
        heroBody:
          "Summa Reu ayuda a convocar, reunir y dejar rastro claro de decisiones sin hacer el proceso más pesado para el equipo ni para la base social.",
        metaTitle: "Software para asociaciones | Summa Reu",
        metaDescription:
          "Plataforma para asociaciones: convocatorias, votaciones, reunión y actas con IA en un único flujo de gobernanza.",
        introTitle: "Más orden institucional, menos trabajo artesanal.",
        introBody:
          "Cuando la coordinación depende de pocas personas, cualquier fricción se multiplica. Por eso el flujo tiene que ser claro, ligero y archivable.",
        bullets: [
          "Juntas y asambleas con mejor trazabilidad.",
          "Participación externa controlada y simple.",
          "Actas preparadas y consultables cuando haga falta.",
        ],
        sections: [
          {
            title: "Para juntas y asambleas",
            body: "Summa Reu estructura tanto la parte de convocatoria como el cierre posterior en un único entorno.",
          },
          {
            title: "Para equipos pequeños",
            body: "Cuando secretaría, presidencia y coordinación comparten carga, un flujo unido reduce desgaste inmediato.",
          },
          {
            title: "Para la memoria institucional",
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
        heroTitle: "Software para fundaciones que necesitan formalidad, archivo y trazabilidad real.",
        heroBody:
          "Organiza patronatos y sesiones de gobierno con un sistema que conecta convocatoria, reunión, acta y archivo final dentro del mismo entorno.",
        metaTitle: "Software para fundaciones | Summa Reu",
        metaDescription:
          "Gestiona patronatos, reuniones y actas con IA en una plataforma pensada para fundaciones y órganos de gobierno.",
        introTitle: "La confianza institucional se construye con proceso y registro.",
        introBody:
          "Para las fundaciones, la reunión no es solo coordinación. Es gobernanza. Por eso el valor está en la claridad del rastro y la solidez del cierre.",
        bullets: [
          "Patronatos y sesiones con mejor registro final.",
          "Acta preparada para revisar sin empezar desde cero.",
          "Historial ordenado para consultas posteriores.",
        ],
        sections: [
          {
            title: "Más criterio en el flujo",
            body:
              "Cada paso queda ordenado para reducir improvisación y dar más consistencia a la documentación final.",
          },
          {
            title: "Acta y archivo",
            body: "El valor es poder pasar de reunión a documento final sin añadir herramientas ni reconstrucciones manuales.",
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
        ctaTitle: "Cuando la gobernanza es seria, el flujo también tiene que serlo.",
        ctaBody:
          "Mostramos Summa Reu con una sesión tipo de patronato para valorar el control documental y operativo.",
      },
      {
        key: "cooperatives",
        slug: "software-cooperativas",
        navLabel: "Cooperativas",
        eyebrow: "Cooperativas",
        heroTitle: "Software para cooperativas que quieren decisiones mejor documentadas y menos dispersión.",
        heroBody:
          "Centraliza disponibilidad, reunión y acta para el consejo rector u otros espacios de gobierno sin separar el proceso en herramientas inconexas.",
        metaTitle: "Software para cooperativas | Summa Reu",
        metaDescription:
          "Plataforma para cooperativas: convocatorias, consejo rector, reunión y actas con IA dentro de un único flujo.",
        introTitle: "Del consejo rector al acta final sin perder contexto.",
        introBody:
          "Las cooperativas necesitan procesos claros, rastro de los acuerdos y menos fricción entre convocatoria y documentación. Esa es exactamente la función de Summa Reu.",
        bullets: [
          "Consejo rector con mejor seguimiento de acuerdos.",
          "Menos salto entre disponibilidad, reunión y archivo.",
          "Acta exportable y consultable en el mismo espacio.",
        ],
        sections: [
          {
            title: "Gobierno y operativa conectados",
            body:
              "La parte institucional y la parte práctica de la reunión viven dentro de un mismo flujo, no en piezas separadas.",
          },
          {
            title: "Seguimiento más claro",
            body: "Acuerdos, responsables y cierre documental quedan más accesibles para la sesión siguiente.",
          },
          {
            title: "Menos carga invisible",
            body:
              "El tiempo que hoy se pierde en coordinación y reconstrucción del documento final se reduce de forma tangible.",
          },
        ],
        proofTitle: "Resultado práctico",
        proofItems: [
          "Mejor rastro documental del consejo rector.",
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

export function getAllMarketingPaths(): Array<{ locale: I18nLocale; slug: string }> {
  return (["ca", "es"] as const).flatMap((locale) =>
    marketingContent[locale].landings.map((page) => ({ locale, slug: page.slug }))
  );
}
