import type { HelpContent, HelpRouteKey } from '../help-types';

export const HELP_CONTENT_CA: Record<HelpRouteKey, HelpContent> = {
  '/dashboard': {
    title: 'Ajuda · Dashboard',
    intro:
      'Aquesta pantalla és la foto ràpida: et diu com està l\'organització avui (sense entrar al detall). Serveix per orientar-te, no per "tancar" feina.',
    steps: [
      'Mira primer el balanç i les principals xifres (ingressos/despeses) per entendre el període.',
      'Detecta senyals de feina pendent (moviments sense contacte/categoria, devolucions) i ves directament a Moviments.',
      'Si estàs en mode fiscal, revisa terminis i prepara Informes quan toqui.',
      'Si treballes per projectes, entra al mòdul de Projectes per veure execució i assignacions.',
      'Torna al Dashboard per verificar que l\'ordre general té sentit (tendència i coherència).',
    ],
    tips: [
      'El Dashboard és brúixola: decisions i correccions es fan a Moviments/Contactes/Informes.',
      'Si una xifra "et sorprèn", no ho arreglis aquí: baixa al detall i valida l\'origen.',
      'Una revisió curta (1–2 cops per setmana) evita que els pendents creixin.',
    ],
    extra: {
      order: {
        title: 'Ordre recomanat (2 minuts)',
        items: [
          'Foto general (xifres).',
          'Pendents → Moviments.',
          'Fiscal → Informes.',
          'Projectes → Assignació.',
        ],
      },
      pitfalls: {
        title: 'Errors habituals',
        items: [
          'Esperar que el Dashboard resolgui problemes (només mostra).',
          'Interpretar xifres sense revisar devolucions/remeses.',
          'Voler "tancar" el mes només des d\'aquí.',
        ],
      },
      whenNot: {
        title: 'Quan no cal preocupar-se',
        items: [
          'Si el dia a dia està controlat, no cal mirar-ho cada dia.',
          'Si hi ha pendents petits, resol-los a Moviments i torna després.',
        ],
      },
      manual: {
        label: 'Manual d\'usuari · Entendre el Dashboard',
        href: '/dashboard/manual#14-entendre-el-dashboard',
      },
      video: {
        label: 'Vídeo (properament)',
        note: 'Llegir el Dashboard i saber què fer després (6 minuts)',
      },
    },
    keywords: ['dashboard', 'balanç', 'pendents', 'moviments', 'informes', 'projectes', 'tendència'],
  },
  '/dashboard/movimientos': {
    title: 'Ajuda · Moviments',
    intro:
      'Aquesta pantalla és el centre de control del dia a dia: aquí revises què entra i què surt del banc, detectes pendents i evites errors abans que es facin grans.',
    steps: [
      'Comença pels pendents: filtra per "Sense contacte", "Sense categoria" i "Devolucions pendents" si apareixen.',
      'Assigna primer el contacte (donant, proveïdor o treballador): dona context al moviment.',
      'Assigna després la categoria quan el contacte ja és clar.',
      'Revisa ingressos agrupats (remeses): divideix-les abans de continuar si cal.',
      'Adjunta documents només quan aporten valor (factures, justificants rellevants).',
    ],
    tips: [
      'Ordre recomanat: contacte → categoria → document. Canviar l\'ordre sol generar dubtes després.',
      'Si un moviment et genera dubte, deixa\'l pendent i segueix amb la resta.',
      'Una passada regular pels pendents evita acumulacions difícils de revisar.',
    ],
    extra: {
      order: {
        title: 'Ordre recomanat de treball',
        items: [
          'Filtrar pendents (què està sense resoldre).',
          'Assignar contactes.',
          'Assignar categories.',
          'Revisar remeses i devolucions.',
          'Adjuntar documents quan aporten valor.',
        ],
      },
      pitfalls: {
        title: 'Errors habituals',
        items: [
          'Assignar categoria sense haver definit el contacte.',
          'Forçar una assignació només per "deixar-ho net".',
          'Dividir remeses massa tard, amb altres camps ja tocats.',
          'Generar informes sense haver revisat devolucions.',
        ],
      },
      whenNot: {
        title: 'Quan no cal fer res',
        items: [
          'No cal assignar projecte si només controles el dia a dia.',
          'No cal adjuntar document a moviments petits i evidents.',
          'No cal resoldre tots els dubtes al moment: pendents conscients també són control.',
        ],
      },
      returns: {
        title: 'Devolucions (control ràpid)',
        items: [
          'Prioritat: assignar el donant correcte. Si no hi ha donant, fiscalment no resta on toca.',
          'En remeses de devolucions, el pare no porta contacte: el donant va a les filles.',
          "Si hi ha pendents, resol-les abans d'exportar 182/certificats (evita totals inflats).",
          "Si dubtes, deixa pendent conscient i continua; però no ho oblidis abans de tancament.",
        ],
      },
      remittances: {
        title: 'Remeses (quotes i Stripe)',
        items: [
          "Remesa = un moviment que agrupa moltes quotes. Divideix-la abans d'assignar contactes/categoria a mà.",
          'Després de dividir, treballa sobre les quotes filles (són les que compten per donant).',
          "Stripe: usa \"Dividir remesa Stripe\" i revisa pendents d'assignació (matching per email).",
          'Si una remesa ja està processada, no la tornis a tocar: revisa el detall des del badge/modal.',
        ],
      },
      contacts: {
        title: 'Contactes (criteri ràpid)',
        items: [
          'Assigna primer el contacte: dona context i fa la categoria més fiable.',
          'Si és una nòmina → Treballador. Si és una factura d\'un tercer → Proveïdor. Si és un ingrés de quota/donació → Donant.',
          'Si no tens clar el contacte, deixa\'l pendent i busca pistes al concepte bancari o al document.',
          'Evita crear contactes nous per casos puntuals petits: crea només els recurrents o rellevants.',
        ],
      },
      categories: {
        title: 'Categories (criteri ràpid)',
        items: [
          'Assigna la categoria després del contacte: el contacte sovint suggereix la categoria correcta (categoria per defecte).',
          'Si dubtes entre dues categories, tria la més estable i coherent amb l\'històric (consistència > precisió fictícia).',
          'No forcis categories "per deixar-ho net": un pendent conscient és millor que una categoria equivocada.',
          'Per imports massius, filtra pendents i aplica un criteri repetible abans d\'entrar al detall.',
        ],
      },
      documents: {
        title: 'Documents (criteri ràpid)',
        items: [
          'No cal adjuntar document a cada moviment: reserva-ho per factures, justificants importants o requisits de subvenció.',
          'Si adjuntes des del modal del moviment, el document queda vinculat automàticament.',
          'Un nom de fitxer clar (data + concepte) ajuda després a trobar-lo sense cercar.',
          'Per justificació de projectes, el document pot ser obligatori: revisa-ho abans de tancar.',
        ],
      },
      bankAccounts: {
        title: 'Multi-compte bancari (criteri ràpid)',
        items: [
          'Cada compte sincronitza per separat: si tens més d\'un, filtra per compte quan revisem pendents.',
          'Els saldos del Dashboard sumen tots els comptes: no interpretis com a problema un saldo global diferent del que veus al banc.',
          'Transferències internes apareixen com a sortida d\'un compte i entrada a l\'altre: assigna la mateixa categoria (p. ex. Transferències internes) i no les comptis dues vegades com a despesa/ingrés real.',
          'Quan sincronitzis un nou compte, revisa les dades inicials (saldo obert, data inici) abans de continuar.',
        ],
      },
      ai: {
        title: 'Categorització amb IA (quan usar-la)',
        items: [
          'Ús ideal: molts moviments sense categoria i patrons repetitius.',
          'Regla d\'or: la IA suggereix, tu valides. No assumeixis que sempre encerta.',
          'Si el contacte és clar, assigna primer el contacte: la categoria sol sortir més neta.',
          'Després de l\'IA, revisa una mostra (5–10) abans de donar-ho per bo.',
        ],
      },
      bulk: {
        title: 'Accions massives (per netejar ràpid)',
        items: [
          'Filtra primer (pendents) i després selecciona en bloc: així no toques el que ja està bé.',
          'Aplica canvis repetibles (mateixa categoria) a grups coherents, no a "tot el mes".',
          'Si tens dubtes, fes-ho en lots petits: és més fàcil desfer i revisar.',
          'Després d\'una acció massiva, revisa 3–5 files a l\'atzar per validar.',
        ],
      },
      importing: {
        title: 'Importar extracte (sense sorpreses)',
        items: [
          'Descarrega l\'extracte del banc en CSV/XLSX i puja\'l tal qual.',
          'Evita obrir i desar el CSV amb Excel si canvia formats: pot trencar separadors i decimals.',
          'Abans d\'importar, revisa la previsualització: dates, imports i descripcions.',
          'Si detectes duplicats o imports estranys, atura i revisa el fitxer abans de continuar.',
        ],
      },
      filters: {
        title: 'Filtres (com treballar ràpid)',
        items: [
          'Regla: filtrar abans d\'editar. Primer troba el grup de pendents, després actua.',
          'Filtres estrella: Sense contacte, Sense categoria, Devolucions pendents.',
          'Per revisar una tasca concreta, combina filtre + cerca (nom, import, paraula clau).',
          'En grans volums, treballa per lots petits (per setmana o per tipus) i valida al final.',
        ],
      },
      manual: {
        label: "Manual d'usuari · Gestió de Moviments",
        href: '/dashboard/manual#5-gestio-de-moviments',
      },
      video: {
        label: 'Vídeo (properament)',
        note: 'Com mantenir Moviments sota control en 10 minuts',
      },
    },
    keywords: [
      'control',
      'pendents',
      'contacte',
      'categoria',
      'remesa',
      'devolucions',
      'document',
      'dia a dia',
      'ia',
      'massiu',
      'importar',
      'filtres',
    ],
  },
  '/dashboard/movimientos/liquidacions': {
    title: 'Ajuda · Liquidacions',
    intro:
      'Aquesta pantalla serveix per preparar liquidacions de despeses de viatge: tiquets, quilometratge i PDF final. No és la pantalla de remeses.',
    steps: [
      'Crea o obre una liquidació i revisa el període abans de continuar.',
      'Puja tiquets o justificants i deixa\'ls vinculats a la liquidació correcta.',
      'Afegeix quilometratge només quan correspongui i valida imports abans de generar res.',
      'Revisa els pendents de validació abans de generar el PDF final.',
      'Genera el PDF només quan la liquidació ja està completa i coherent.',
    ],
    tips: [
      'Treballa una liquidació cada cop: barrejar casos complica la revisió.',
      'Els tiquets sense revisar no són tancament: són feina pendent.',
      'Si el dubte és d\'imputació a projecte, continua després a Assignació de despeses.',
    ],
    extra: {
      pitfalls: {
        title: 'Errors habituals',
        items: [
          'Confondre liquidacions de viatge amb remeses o cobrament de quotes.',
          'Generar el PDF sense haver revisat tots els tiquets.',
          'Barrejar quilometratge i altres despeses sense validar imports.',
        ],
      },
      manual: {
        label: 'Manual d\'usuari · Liquidacions de despeses de viatge',
        href: '/dashboard/manual#6c-liquidacions-de-despeses-de-viatge',
      },
    },
    keywords: ['liquidacions', 'viatge', 'tiquets', 'quilometratge', 'pdf', 'despeses'],
  },
  '/dashboard/donants': {
    title: 'Ajuda · Donants',
    intro:
      'Aquesta pantalla és la base fiscal de l\'entitat: si DNI/CIF i Codi Postal són correctes, el Model 182 i els certificats surten nets.',
    steps: [
      'Prioritza DNI/CIF i Codi Postal: és el que més sovint bloqueja o embruta el 182.',
      'Evita duplicats: si importes, actualitza existents en lloc de crear-ne de nous.',
      'Mantén Actiu/Baixa al dia per tenir llista neta sense perdre històric.',
      'Assigna categoria per defecte si ajuda a categoritzar moviments de manera consistent.',
      'Abans de certificats o 182, valida 2–3 donants representatius (amb i sense devolucions).',
    ],
    tips: [
      'Ordre operatiu: DNI/CP → estat → (si cal) categoria per defecte.',
      'Si una devolució està mal assignada, distorsiona el total net del certificat.',
      'No tot donant necessita fitxa perfecta: fiscal mínim i prou.',
    ],
    extra: {
      order: {
        title: 'Ordre recomanat',
        items: [
          'Completar DNI/CIF i Codi Postal.',
          'Revisar estat Actiu/Baixa.',
          'Evitar duplicats (actualitzar).',
          'Validar devolucions si n\'hi ha.',
        ],
      },
      pitfalls: {
        title: 'Errors habituals',
        items: [
          'Deixar DNI o Codi Postal buit i esperar que el 182 surti bé.',
          'Crear duplicats per manca de criteri en importacions.',
          'Ignorar devolucions i inflar totals nets.',
        ],
      },
      whenNot: {
        title: 'Quan no cal complicar-ho',
        items: [
          'No cal omplir totes les dades si no aporten valor (prioritza fiscal).',
          'No cal generar certificats massius si encara hi ha dades fiscals pendents.',
        ],
      },
      returns: {
        title: 'Devolucions (impacte fiscal)',
        items: [
          'Una devolució assignada al donant resta del total net (certificat i Model 182).',
          'Si la devolució no té donant assignat, no resta a ningú: el total queda inflat.',
          'Si una devolució està assignada al donant equivocat, distorsiona dos donants a la vegada.',
          'Abans de tancar l\'any, revisa devolucions pendents i les del donant amb imports estranys.',
        ],
      },
      quality: {
        title: 'Qualitat fiscal (check ràpid)',
        items: [
          'DNI/CIF i Codi Postal complets: és el mínim per 182.',
          'Evitar duplicats: un sol donant per DNI (actualitza, no repliquis).',
          'Coherència d\'estat: baixa quan toca, actiu si segueix aportant.',
          'Mostra de validació: 2–3 donants representatius abans d\'exports massius.',
        ],
      },
      manual: {
        label: 'Manual d\'usuari · Gestió de Donants',
        href: '/dashboard/manual#3-gestio-de-donants',
      },
      video: {
        label: 'Vídeo (properament)',
        note: 'Deixar Donants a punt per al Model 182 (10 minuts)',
      },
    },
    keywords: ['donants', 'socis', 'dni', 'cif', 'codi postal', 'model 182', 'certificats', 'baixa', 'devolucions', 'qualitat'],
  },
  '/dashboard/donants/remeses-cobrament': {
    title: 'Ajuda · Remeses de cobrament',
    intro:
      'Aquesta pantalla serveix per generar la remesa SEPA de cobrament de quotes. Aquí prepares l\'XML pain.008; no és la pantalla per dividir remeses bancàries ja importades.',
    steps: [
      'Comprova primer que el compte bancari té informat l\'ICS a Configuració.',
      'Selecciona compte i data de cobrament abans de revisar els socis inclosos.',
      'Revisa els socis exclosos o amb advertiments abans de generar la remesa.',
      'Genera l\'XML només quan l\'import total i el nombre de socis siguin coherents.',
      'Puja el fitxer al banc fora de Summa: l\'app el genera però no l\'envia automàticament.',
    ],
    tips: [
      'Si falten socis, revisa IBAN, quota i periodicitat abans de forçar res.',
      'Un XML ben generat no substitueix la revisió prèvia del llistat.',
      'Si el problema és una remesa ja processada del banc, no és aquesta pantalla.',
    ],
    extra: {
      pitfalls: {
        title: 'Errors habituals',
        items: [
          'Confondre aquesta pantalla amb el divisor de remeses de Moviments.',
          'Generar la remesa sense ICS configurat al compte bancari.',
          'Ignorar els socis exclosos i descobrir-ho només al banc.',
        ],
      },
      manual: {
        label: 'Manual d\'usuari · Remeses SEPA de cobrament',
        href: '/dashboard/manual#6a-remeses-sepa-de-cobrament',
      },
    },
    keywords: ['remeses', 'sepa', 'cobrament', 'pain.008', 'quotes', 'ics'],
  },
  '/dashboard/proveidors': {
    title: 'Ajuda · Proveïdors',
    intro:
      'Aquesta pantalla ordena els tercers que et facturen. Si el CIF i la identificació estan bé, el Model 347 surt sense neteges d\'última hora.',
    steps: [
      'Crea proveïdors per despeses recurrents o significatives (no per tot).',
      'Completa nom + CIF: és el camp crític per al Model 347.',
      'Posa categoria per defecte si és sempre el mateix tipus de despesa.',
      'Mantén actiu/inactiu per netejar llista sense perdre historial.',
    ],
    tips: [
      'CIF correcte > qualsevol altra dada.',
      'Si canvia el nom comercial però no el CIF, actualitza el mateix proveïdor.',
      'Categoria per defecte accelera Moviments, però revisa-la si hi ha excepcions.',
    ],
    extra: {
      order: {
        title: 'Ordre recomanat',
        items: [
          'Crear només els recurrents.',
          'Validar CIF.',
          'Definir categoria per defecte.',
          'Marcar inactius els que ja no s\'usen.',
        ],
      },
      pitfalls: {
        title: 'Errors habituals',
        items: [
          'Crear duplicats del mateix proveïdor amb el mateix CIF.',
          'Deixar CIF buit i esperar que el 347 surti bé.',
          'Barrejar proveïdors amb treballadors (cada tipus té funció diferent).',
        ],
      },
      whenNot: {
        title: 'Quan no cal',
        items: [
          'No cal crear proveïdor per despeses puntuals petites.',
          'No cal omplir dades extra si no les faràs servir.',
        ],
      },
      manual: {
        label: 'Manual d\'usuari · Proveïdors i Treballadors',
        href: '/dashboard/manual#4-gestio-de-proveidors-i-treballadors',
      },
      video: {
        label: 'Vídeo (properament)',
        note: 'Preparar Proveïdors per al Model 347 (8 minuts)',
      },
    },
    keywords: ['proveïdor', 'cif', 'model 347', 'tercers', 'categoria per defecte', 'inactiu', 'duplicats'],
  },
  '/dashboard/treballadors': {
    title: 'Ajuda · Treballadors',
    intro:
      'Aquesta pantalla serveix per ordenar despeses de personal (nòmines i pagaments recurrents). Ben mantinguda, fa el dia a dia més net i coherent.',
    steps: [
      'Crea un treballador quan tinguis pagaments recurrents de personal (nòmines, dietes fixes, etc.).',
      'Introdueix nom i DNI: et dona traçabilitat i evita confusions amb noms similars.',
      'Defineix categoria per defecte (habitualment Nòmines) per agilitzar l\'assignació a Moviments.',
      'Mantén l\'estat Actiu/Inactiu quan una persona entra o surt (no cal esborrar).',
      'Quan assignis un moviment, revisa que contacte + categoria reflecteixin el que és (nòmina vs altres pagaments).',
    ],
    tips: [
      'Objectiu: coherència. No és una eina de RRHH, és classificació operativa.',
      'Inactiu > eliminar: mantens històric i evites perdre context.',
      'Si hi ha pagaments mixtos, no forcis la categoria per defecte: ajusta puntualment.',
    ],
    extra: {
      order: {
        title: 'Ordre recomanat',
        items: [
          'Crear només recurrents.',
          'Posar DNI.',
          'Categoria per defecte.',
          'Estat actiu/inactiu.',
        ],
      },
      pitfalls: {
        title: 'Errors habituals',
        items: [
          'Barrejar treballadors amb proveïdors (cada tipus té funció diferent).',
          'Esborrar treballadors i perdre històric.',
          'Aplicar sempre la categoria per defecte encara que no toqui.',
        ],
      },
      whenNot: {
        title: 'Quan no cal complicar-ho',
        items: [
          'No cal crear treballadors per pagaments puntuals irrelevants.',
          'No cal omplir camps extra si no els faràs servir.',
        ],
      },
      manual: {
        label: 'Manual d\'usuari · Proveïdors i Treballadors',
        href: '/dashboard/manual#4-gestio-de-proveidors-i-treballadors',
      },
      video: {
        label: 'Vídeo (properament)',
        note: 'Ordenar nòmines i despeses de personal (8 minuts)',
      },
    },
    keywords: ['treballadors', 'nòmines', 'personal', 'dni', 'categoria per defecte', 'actiu', 'inactiu'],
  },
  '/dashboard/informes': {
    title: 'Ajuda · Informes',
    intro:
      'Aquesta pantalla serveix per generar els outputs per a la gestoria: Model 182, Model 347 i certificats. Aquí no es corregeixen dades; aquí es verifiquen i s\'exporten.',
    steps: [
      'Tria l\'any fiscal i treballa sempre amb un any cada cop.',
      'Model 182: resol primer les alertes de donants (sobretot DNI/CIF i Codi Postal).',
      'Revisa devolucions assignades: afecten directament el total del 182 i dels certificats.',
      'Genera el Model 182 i envia\'l a la gestoria.',
      'Model 347: només apareixeran proveïdors que superin el llindar anual; comprova CIF abans d\'exportar.',
      'Genera certificats individuals o en lot quan correspongui.',
    ],
    tips: [
      'Si el 182 no quadra, gairebé sempre és per devolucions o dades incompletes de donants.',
      'Valida 2–3 casos representatius abans d\'enviar certificats massius.',
      'Treballa sempre amb un sol any obert per evitar confusions.',
    ],
    extra: {
      order: {
        title: 'Ordre recomanat quan toca fer informes',
        items: [
          'Seleccionar l\'any fiscal.',
          'Resoldre alertes de donants (DNI/CP).',
          'Revisar devolucions.',
          'Generar Model 182.',
          'Generar Model 347.',
          'Generar certificats.',
        ],
      },
      pitfalls: {
        title: 'Errors habituals',
        items: [
          'Generar el 182 amb donants sense DNI o Codi Postal.',
          'Oblidar devolucions pendents i inflar els totals.',
          'Barrejar anys (corregir dades d\'un any mentre n\'exportes un altre).',
          'Fer certificats massius sense validar cap cas prèviament.',
        ],
      },
      checks: {
        title: 'Checks finals abans d\'enviar a gestoria',
        items: [
          '182: cap alerta crítica pendent.',
          '182: totals coherents amb el que esperes.',
          '347: proveïdors amb CIF correcte.',
          'Certificats: signatura i càrrec configurats.',
        ],
      },
      manual: {
        label: 'Manual d\'usuari · Informes Fiscals',
        href: '/dashboard/manual#9-informes-fiscals',
      },
      video: {
        label: 'Vídeo (properament)',
        note: 'Preparar Model 182 i certificats sense sorpreses (15 minuts)',
      },
    },
    keywords: [
      'model 182',
      'model 347',
      'certificats',
      'gestoria',
      'any fiscal',
      'devolucions',
      'alertes',
      'exportar',
    ],
  },
  '/dashboard/configuracion': {
    title: 'Ajuda · Configuració',
    intro:
      'Aquí deixes l\'organització "a punt": dades fiscals, logo i signatura. Si això està bé, certificats i informes surten consistents.',
    steps: [
      'Completa dades fiscals de l\'entitat (nom, CIF, adreça): és el que surt als outputs.',
      'Puja logo i configura signatura + càrrec: és el que dona validesa als certificats.',
      'Revisa categories amb criteri: afegeix les que falten i evita canvis agressius.',
      'Gestiona membres i rols: edició només per qui realment la necessita.',
    ],
    tips: [
      'Prioritat real: fiscals + signatura. La resta és secundària.',
      'Millor afegir categories que renombrar-les si ja tens historial.',
      'Rols de lectura eviten errors accidentals.',
    ],
    extra: {
      order: {
        title: 'Ordre recomanat (10 minuts)',
        items: [
          'Dades fiscals.',
          'Logo.',
          'Signatura i càrrec.',
          'Categories i rols.',
        ],
      },
      pitfalls: {
        title: 'Errors habituals',
        items: [
          'Deixar signatura/càrrec a mig configurar i generar certificats.',
          'Renombrar categories ja en ús i perdre coherència.',
          'Donar permisos d\'edició a qui només ha de consultar.',
        ],
      },
      whenNot: {
        title: 'Quan no cal tocar res',
        items: [
          'Si només vols treballar Moviments, no cal "polir" Configuració cada dia.',
          'No cal tenir totes les dades perfectes per començar (excepte fiscals/signatura).',
        ],
      },
      manual: {
        label: 'Manual d\'usuari · Configuració inicial',
        href: '/dashboard/manual#2-configuracio-inicial',
      },
      video: {
        label: 'Vídeo (properament)',
        note: 'Configurar Summa Social bé des del primer dia (8 minuts)',
      },
    },
    keywords: ['configuració', 'cif', 'adreça', 'logo', 'signatura', 'càrrec', 'categories', 'membres', 'rols'],
  },
  '/dashboard/ejes-de-actuacion': {
    title: "Ajuda · Eixos d'actuació",
    intro:
      "Aquesta pantalla serveix per classificar internament ingressos i despeses per àrees de treball. No és el mòdul Projectes: és una etiqueta de gestió interna.",
    steps: [
      "Crea un eix quan necessitis analitzar despeses per línies de treball (p. ex. sensibilització, incidència, cooperació).",
      "Posa noms estables i clars: han de durar anys, no només un trimestre.",
      "Assigna moviments a eixos quan això t'ajuda a explicar el pressupost intern o el reporting a junta.",
      "Evita inflar eixos: pocs i útils és millor que molts i confusos.",
      "Si tens dubtes, deixa el moviment sense eix i decideix-ho quan tinguis criteri.",
    ],
    tips: [
      "Un eix és una classificació interna; un projecte del mòdul Projectes és una altra cosa.",
      "No forcis eixos per quadrar: han de reflectir una lògica real de treball.",
      "Si canvies el nom d'un eix, pensa en l'històric (consistència > estètica).",
    ],
    extra: {
      order: {
        title: 'Ordre recomanat',
        items: [
          'Definir 4–8 eixos estables.',
          "Assignar eix només quan aporta valor.",
          'Revisar anualment i ajustar mínim.',
        ],
      },
      pitfalls: {
        title: 'Errors habituals',
        items: [
          "Confondre eixos d'actuació amb projectes del mòdul Projectes.",
          'Crear un eix per cada activitat i perdre perspectiva.',
          "Reclassificar massa sovint i trencar l'històric.",
        ],
      },
      whenNot: {
        title: 'Quan no cal',
        items: [
          "Si l'anàlisi per eixos no s'està usant, no cal assignar-los per rutina.",
          'No cal aplicar eix a tot: només al que vols analitzar.',
        ],
      },
      manual: {
        label: "Manual d'usuari · Projectes / Eixos d'actuació",
        href: '/dashboard/manual#8-projectes-eixos-dactuacio',
      },
      video: {
        label: 'Vídeo (properament)',
        note: "Definir eixos d'actuació útils (6 minuts)",
      },
    },
    keywords: ['eixos', 'classificació', 'àrea', 'seguiment', 'reporting', 'junta', 'intern'],
  },
  '/dashboard/projectes': {
    title: 'Ajuda · Projectes',
    intro: 'Aquesta ajuda està pendent d\'emplenar.',
    steps: [],
  },
  '/dashboard/manual': {
    title: 'Ajuda · Manual d\'usuari',
    intro:
      'Aquesta pàgina és la referència completa. Serveix per ampliar el context quan l\'ajuda d\'una pantalla no és suficient.',
    steps: [
      'Fes servir el TOC per anar directament a la secció que busques.',
      'Si vens des d\'una pantalla, mira primer l\'ancoratge del manual (t\'hi porta al bloc rellevant).',
      'Quan hi ha dubtes, segueix l\'ordre: entendre → aplicar → revisar.',
      'Si detectes una mancança, envia feedback amb el context (pantalla + enllaç).',
    ],
    tips: [
      'No cal llegir-lo sencer: és una eina de consulta.',
      'Valida 1–2 casos reals mentre llegeixes: aprens més ràpid.',
      'Si una secció es repeteix molt, és candidata a vídeo curt.',
    ],
    extra: {
      order: {
        title: 'Com usar el manual (ràpid)',
        items: ['Buscar secció', 'Llegir el mínim', 'Aplicar a la pantalla', 'Tornar i validar'],
      },
      pitfalls: {
        title: 'Errors habituals',
        items: [
          'Llegir massa i actuar poc.',
          'Voler resoldre-ho tot sense provar-ho a l\'app.',
          'No usar els ancoratges i perdre temps fent scroll.',
        ],
      },
      whenNot: {
        title: 'Quan no cal',
        items: [
          'Si l\'ajuda contextual ja resol el dubte, no cal anar al manual.',
          'Si el problema és de dades, vés a la pantalla corresponent (Moviments/Contactes).',
        ],
      },
      manual: { label: 'Anar a l\'inici del manual', href: '/dashboard/manual#top' },
      video: { label: 'Vídeo (properament)', note: 'Com trobar respostes al manual en 2 minuts' },
    },
    keywords: ['manual', 'toc', 'ancoratges', 'ajuda', 'consulta', 'referència', 'vídeo'],
  },
  '/dashboard/project-module/expenses': {
    title: 'Ajuda · Assignació de despeses (Projectes)',
    intro:
      'Aquesta safata és l\'inbox de despeses assignables: aquí decideixes a quin projecte i a quina partida va cada despesa, de forma ràpida i reversible.',
    steps: [
      'Entén què veus: cada fila és una despesa (bancària o de terreny) amb un estat d\'assignació 0% / parcial / 100%.',
      'Comença pels pendents: filtra per "No assignades" (0%) per prioritzar el que encara no està imputat a cap projecte.',
      'Quick Assign 100%: usa l\'acció ràpida per assignar tota la despesa a un projecte i (si cal) a una partida concreta.',
      'Split (assignació múltiple): si una despesa s\'ha de repartir entre projectes o partides, usa l\'assignació múltiple i reparteix imports fins que quadrin.',
      'Revisa l\'estat: l\'objectiu és que el percentatge reflecteixi la realitat (100% quan està totalment imputada; parcial quan només una part).',
      'Desassignar: si t\'has equivocat, desfés l\'assignació i torna-la a deixar com a 0% (o ajusta-la).',
      'Assignació massiva: selecciona diverses despeses i aplica una assignació en bloc quan siguin casos repetitius (mateix projecte/partida).',
      'Final de revisió: abans de donar per bo un projecte, assegura\'t que les despeses rellevants estan 100% i que els splits no deixen imports "perduts".',
    ],
    tips: [
      'Quan un projecte està sobreexecutat en una partida, el split parcial és la manera realista de quadrar sense inventar despeses.',
      'Si una despesa no encaixa en cap projecte, és millor deixar-la a 0% que no pas forçar una assignació incorrecta.',
      'No hi veuràs totes les despeses bancàries automàticament: només entren les que a Moviments ja tenen categoria assignada.',
      'Les despeses de terreny sovint es pengen primer i s\'assignen després: prioritza la coherència de l\'assignació, no la velocitat d\'entrada.',
    ],
    extra: {
      manual: {
        label: 'Manual d\'usuari · Assignació de despeses',
        href: '/dashboard/manual#6-assignacio-de-despeses',
      },
      video: {
        label: 'Vídeo (properament)',
        note: 'Assignar despeses a projectes de forma àgil (10 minuts)',
      },
    },
    keywords: [
      'assignació',
      'projecte',
      'partida',
      'quick assign',
      'split',
      '100%',
      'parcial',
      'desassignar',
      'massiu',
      'terreny',
    ],
  },
  '/dashboard/project-module/projects': {
    title: 'Ajuda · Gestió de projectes',
    intro:
      'Aquí crees i gestiones els projectes del mòdul de Projectes, que després faràs servir per assignar-hi despeses.',
    steps: [
      'Crea un projecte quan necessitis agrupar despeses sota un mateix paraigua (p. ex. una subvenció, un programa o un període de treball concret).',
      'Posa un nom clar i recognoscible: és el que veuràs a la safata d\'assignació de despeses.',
      'Afegeix un codi o referència si treballes amb justificacions externes (opcional però recomanable).',
      'Revisa l\'estat del projecte: actiu mentre s\'hi assignen despeses; tancat quan ja no s\'ha d\'utilitzar.',
      'Si el projecte té pressupost, introdueix-lo o gestiona les partides des de la seva pantalla econòmica.',
      'El projecte agafa sentit quan li assigns despeses des de "Assignació de despeses".',
      'Evita crear projectes duplicats per variacions petites: és millor tenir pocs projectes ben definits.',
      'Quan el projecte s\'acaba, tanca\'l per mantenir l\'ordre i evitar assignacions accidentals.',
    ],
    tips: [
      'Si dubtes si una despesa ha d\'anar a un projecte, deixa-la sense assignar fins tenir criteri.',
      'Un projecte ben definit fa que la pantalla d\'assignació sigui més ràpida i menys propensa a errors.',
      'Tancar projectes antics redueix soroll i ajuda a evitar seleccions equivocades.',
    ],
    extra: {
      manual: {
        label: 'Manual d\'usuari · Gestió de projectes',
        href: '/dashboard/manual#6-gestio-de-projectes',
      },
      video: {
        label: 'Vídeo (properament)',
        note: 'Crear i gestionar projectes de forma eficient (8 minuts)',
      },
    },
    keywords: ['projecte', 'crear', 'editar', 'tancar', 'codi', 'pressupost', 'partides', 'assignació'],
  },
  '/redirect-to-org': {
    title: "Ajuda · Accés a l'organització",
    intro:
      "Aquesta pantalla et redirigeix a la teva organització. Si tens accés a més d'una, el sistema t'envia a la correcta segons els teus permisos.",
    steps: [
      'Espera uns segons: la redirecció és automàtica.',
      'Si no et redirigeix, comprova que tens sessió iniciada.',
      'Si continues aquí, pot ser que no tinguis accés a cap organització activa.',
    ],
    tips: [
      'Si estàs en un ordinador compartit, tanca sessió quan acabis.',
      "Si has canviat de rol o d'org recentment, pot caldre tornar a entrar.",
    ],
    extra: {
      order: {
        title: 'Què fer',
        items: [
          'Esperar redirecció',
          'Reiniciar sessió si cal',
          "Contactar l'admin si no tens accés",
        ],
      },
      pitfalls: {
        title: 'Errors habituals',
        items: [
          "Pensar que és un error de l'app quan és falta de permisos",
          'Tenir la sessió caducada (browser session)',
        ],
      },
      whenNot: {
        title: 'Quan no cal preocupar-se',
        items: ['Si en 5–10 segons et porta al Dashboard, tot està bé.'],
      },
      manual: {
        label: "Manual d'usuari · Primers passos",
        href: '/dashboard/manual#1-primers-passos',
      },
      video: {
        label: 'Vídeo (properament)',
        note: 'Entrar a Summa Social i entendre la redirecció (2 minuts)',
      },
    },
    keywords: ['accés', 'organització', 'redirecció', 'permisos', 'sessió'],
  },
};

export const HELP_FALLBACK_CA: HelpContent = {
  title: 'Ajuda',
  intro: 'Aquesta pantalla encara no té ajuda.',
  steps: [],
};
