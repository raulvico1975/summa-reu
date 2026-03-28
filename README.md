# Summa Social

**Gestio economica, fiscal i operativa per a entitats del Tercer Sector**

Summa Social es una aplicacio web multi-organitzacio orientada a entitats petites i mitjanes que necessiten substituir fulls de calcul per un entorn mes robust de moviments bancaris, donants, fiscalitat, justificacio de projectes i suport operatiu.

Avui el repositori no conte nomes el producte principal: tambe inclou el lloc public multiidioma, el blog, la publicacio de novetats de producte, la capa d'ajuda i bot, scripts de demo i un conjunt de runbooks i guardrails operatius per mantenir el sistema amb criteri conservador.

## Que resol avui

Aquest capitol descriu Summa Social des del punt de vista de les persones usuaries i de l'entitat. Aqui el focus no es en canals, peces tecniques o estructura del repositori, sino en quins problemes resol el producte i com acompanya l'operativa economica i fiscal del dia a dia.

- Centralitza en un sol lloc la feina economica que moltes entitats acostumen a repartir entre fulls de calcul, carpetes, correus i seguiment manual.
- Converteix els moviments bancaris en una base operativa clara: importable, classificable, filtrable, documentable i reutilitzable per informes i fiscalitat.
- Dona control real sobre ingressos, despeses, saldos i moviments per periode, per compte i per context de treball.
- Redueix feina manual i risc d'error en processos repetitius com la importacio d'extractes, la deteccio de duplicats, la classificacio i la preparacio d'exports.
- Dona una visio ordenada de qui es cada actor economic de l'entitat: donants, socis, proveidors, treballadors i altres contactes vinculats a moviments recurrents o sensibles.
- Resol el problema dels apunts bancaris agrupats, separant-los en operacions individuals quan una remesa barreja moltes quotes, devolucions o pagaments.
- Permet gestionar el cicle complet de les donacions: cobrament, devolucio, recurrencia, resum anual, certificat i calcul fiscal net.
- Aplica IA en punts concrets on aporta velocitat sense substituir el criteri de l'equip: lectura de tickets i factures, preomplert de camps i suggeriments de categoritzacio o classificacio.
- Dona una capa practica de compliment fiscal per a entitats espanyoles, amb preparacio de models, resums i evidencies per a gestoria.
- Facilita la justificacio economica de projectes i subvencions lligant despeses, documents, pressupost i seguiment economic al projecte correcte.
- Mante l'evidencia documental a prop de cada operacio: factures, justificants, certificats, annexos i paquets de tancament.
- Dona un circuit ordenat per a documents pendents: pujada, lectura automatica, revisio, confirmacio, conciliacio amb banc o incorporacio a una liquidacio.
- Dona visibilitat executiva a l'equip amb quadres resum, alertes, comparatives i informes que permeten prendre decisions sense reconstruir les dades fora del sistema.
- Permet treballar amb equips i organitzacions diferents sense barrejar dades, amb permisos ajustats al rol i a les responsabilitats de cada persona.

## Que no es

- No es un ERP generic.
- No es comptabilitat formal.
- No es un gestor de projectes generalista.
- No es un producte fiscal multi-pais: el domini fiscal i bancari esta modelat per al context espanyol.

## Moduls principals del producte

Entesos com a blocs funcionals de treball per a l'entitat, no com a peces tecniques internes.

### Moviments bancaris i tresoreria

- Importacio d'extractes en formats habituals del banc i d'altres fonts de cobrament.
- Gestio de multiples comptes bancaris dins la mateixa organitzacio.
- Prevencio de duplicats i control d'idempotencia per evitar carregar dues vegades el mateix moviment.
- Camps de treball sobre cada apunt: data, import, descripcio, nota, saldo, dates bancaries i compte d'origen.
- Classificacio de moviments per categoria, contacte, projecte i estat operatiu.
- Filtrat per periode, compte, estat o context fiscal per poder revisar una part concreta del llibre de moviments.
- Arxivat logic quan una operacio no s'ha d'esborrar pero ha de sortir del flux actiu.

### Conciliacio, classificacio i resolucio de pendents

- Matching assistit de moviments amb contactes a partir de nom, document identificatiu o IBAN.
- Categoritzacio guiada amb suport de regles i assistencia sobre conceptes bancaris ambigus.
- Gestio de casos pendents de revisar quan un ingres o una donacio no queda prou clara.
- Separacio entre operativa segura i casos excepcionals que requereixen confirmacio humana.
- Reconciliacio de moviments agrupats, fills, pares, devolucions i operacions vinculades.

### IA aplicada a l'operativa

- Lectura automatica de tickets en imatge per extreure data, import, moneda, comerç i concepte.
- Lectura automatica de PDFs i factures per extreure numero, data, import i dades del proveidor.
- Deteccio assistida del tipus de document quan un fitxer no entra ja perfectament classificat.
- Preomplert de camps dels documents pendents per reduir tecleig i accelerar la revisio.
- Suggeriments de categoritzacio de moviments amb nivell de confiança i possibilitat de no proposar res si el cas es ambigu.
- Assistencia pensada per estalviar temps, no per imposar decisions: la revisio humana continua sent la capa final en processos sensibles.

### Contactes, donants, proveidors i persones vinculades

- Gestio de fitxa unica per a donants particulars o empresa, proveidors, treballadors i altres perfils relacionats amb l'operativa.
- Conservacio de dades rellevants per a gestio i fiscalitat: nom, NIF/DNI, IBAN, estat, recurrencia i relacio amb l'entitat.
- Distincio entre contactes actius i de baixa per no perdre historic.
- Importacio i exportacio de bases de contactes quan cal treballar en lot o coordinar-se amb altres eines.
- Capacitat de reutilitzar la informacio del contacte en moviments, remeses, certificats i informes.

### Quotes, remeses, devolucions i pagaments agrupats

- Desglossament de remeses d'ingres en cobraments individuals quan el banc agrupa moltes quotes en un sol apunt.
- Importacio i tractament de remeses de devolucio per identificar rebuts retornats, comissions i impacte sobre cada donacio.
- Gestio de remeses sortints de pagament amb generacio de fitxers SEPA quan l'entitat paga en lot.
- Seguiment de l'estat de la remesa: pendent, parcial o resolta.
- Capacitat de revisar, sanejar, desfer o reparar processaments quan una remesa entra amb problemes o incoherencies.

### Donacions, recurrencia i fiscalitat

- Tractament de donacions completes, retornades o parcialment afectades per devolucions.
- Calcul net per donant tenint en compte cobraments, retorns i historic.
- Preparacio de dades per al Model 182 amb consolidacio anual i context suficient per a gestoria.
- Preparacio de dades per al Model 347 quan hi ha tercers que superen els llindars obligatoris.
- Generacio de certificats de donacio individuals, anuals o massius.
- Resums anuals de donants i suport per entendre recurrencia, base social i activitat economica vinculada a aportacions.

### Projectes, pressupost i justificacio economica

- Assignacio de moviments i despeses a projectes, programes o financiadors.
- Seguiment economic del projecte amb pressupost, despesa, saldo i moviment associat.
- Gestio de despeses de terreny o fora de banc amb moneda local i conversio a EUR.
- Configuracio manual del tipus de canvi del projecte i calcul ponderat a partir de transferencies reals de canvi.
- Reaplicacio del tipus de canvi quan canvia el context del projecte i cal recalcular imports en EUR.
- Captura de despeses del modul de projectes i control de la seva documentacio justificativa.
- Captura rapida de despesa des del mateix telefon mobil: foto del rebut, import i enviament en pocs segons.
- Extraccio automatica de data, import i concepte en aquesta captura rapida per reduir friccio al terreny.
- Liquidacions i reemborsaments quan una despesa necessita un flux mes formal de revisio.
- Exportacio de justificacio economica del projecte amb llistats ordenats de despeses i factures pensats per al seguiment del finançador.
- Descarrega agrupada dels comprovants i factures del projecte en ZIP, mantenint ordre per partida i ordre cronologic.
- Exportacions i paquets de tancament per entregar justificacio o consolidar documentacio economica.

### Documents, justificants i evidencies

- Adjuncio de factures, comprovants i altres documents a moviments o processos concrets.
- Pujada de PDFs, XML i imatges com a documents pendents abans que tinguin impacte economic definitiu.
- Lectura automatica del contingut del document per preomplir camps i accelerar la revisio.
- Confirmacio dels documents quan ja tenen les dades minimes correctes i poden entrar al flux operatiu.
- Suggeriment i conciliacio posterior amb moviments bancaris quan el document correspon a una sortida o cobrament real.
- Reenllac del document a la ubicacio estable quan la conciliacio ja s'ha resolt.
- Tracabilitat entre moviment, document, liquidacio i resultat economic o fiscal.
- Descarrega de llistats i paquets documentals ordenats quan cal preparar seguiment o justificacio per a finançadors.
- Preparacio de zips i exports documentals per tancament, entrega o revisio externa.

### Liquidacions, tickets i reemborsaments

- Preparacio de liquidacions de despeses de viatge o activitat amb tickets, quilometratge i resum final.
- Assignacio de tickets pujats a una liquidacio concreta sense perdre el control del que continua pendent.
- Generacio de PDF de liquidacio per a revisio, aprovacio o entrega.
- Flux d'enviament i seguiment de liquidacions fins a conciliacio amb el pagament bancari.
- Suport per a reemborsaments i, quan toca, preparacio del fitxer SEPA associat.

### Quadres de control, informes i seguiment

- Resums de diners: ingressos, despeses, transferencies, saldo i volum operatiu.
- Resums de base social: quotes, donants actius, recurrencia i comportament economic agregat.
- Filtres per any, trimestre, mes o periode personalitzat.
- Comparatives temporals per detectar desviacions o canvis respecte a exercicis anteriors.
- Informes i exportacions per donar sortida a les dades sense reconstruir-les fora del sistema.
- Alertes d'obligacions fiscals o de pendents que requereixen revisio.

### Equips, organitzacions i govern intern

- Aillament de dades per organitzacio dins d'un mateix entorn.
- Sistema de rols i capacitats per limitar qui pot veure, editar, importar, validar o administrar.
- Fluxos d'invitacio i incorporacio d'usuaris a una organitzacio.
- Sessio controlada amb tancament automatic per inactivitat.
- Espais d'administracio per governar organitzacions, permisos i operativa sensible.

## Arquitectura resumida

| Capa | Implementacio actual |
| --- | --- |
| Frontend app | Next.js 15 (App Router) + React 18 |
| UI | Tailwind CSS + components tipus shadcn/radix |
| Llenguatge | TypeScript |
| Dades | Firestore |
| Auth | Firebase Auth |
| Fitxers | Firebase Storage |
| Hosting app | Firebase App Hosting |
| Hosting domini | Firebase Hosting com a capa de redirects cap a App Hosting |
| IA | Genkit + Google Gemini, amb usos puntuals d'OpenAI en fluxos editorials |
| Exportacions | XLSX, CSV, jsPDF, jsPDF autotable |
| Serverless extra | Firebase Functions (`functions/`) |

## Rutes i patrons de navegacio

- `/` detecta idioma i redirigeix a `/{lang}`.
- `/{lang}/...` es web publica; internament el middleware ho reescriu a `src/app/public/[lang]`.
- `/{orgSlug}/login` i `/{orgSlug}/dashboard/*` son l'aplicacio autenticada i multi-tenant.
- `/dashboard` redirigeix a `/redirect-to-org` per resoldre l'organitzacio activa.
- `app.summasocial.app` es redirigeix de forma canonica a `summasocial.app`.

## Estructura del repositori

```text
.
├── README.md
├── apphosting.yaml              # Config d'App Hosting i mapping de secrets/env
├── firebase.json                # Firestore, Storage, Hosting redirects, Functions
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── docs/                        # Documentacio d'autoritat, runbooks i contracts
├── functions/                   # Firebase Functions independents del runtime Next
├── help/                        # Capa legacy congelada per adaptadors antics
├── octavi/summa/editorial/      # Runtime editorial per a blog/LinkedIn
├── public/                      # Assets publics, manuals i visuals
├── scripts/                     # QA, deploy, demos, editorial, i18n, migracions
├── src/
│   ├── app/                     # Rutes Next.js (public, dashboard, api)
│   ├── components/              # Components UI i de domini
│   ├── firebase/                # Client providers i helpers Firebase
│   ├── hooks/                   # Hooks d'organitzacio, permisos, filtres...
│   ├── i18n/                    # Locales i provider de traduccions
│   ├── lib/                     # Logica de negoci, fiscal, SEPA, blog, suport...
│   ├── services/                # Capa fina de serveis client
│   └── help/                    # Capa help legacy congelada
├── tests/                       # Proves addicionals i checklist manual
└── tmp/                         # Artefactes temporals de demos, auditories i probes
```

## Fonts de veritat que conve recordar

### Ajuda i suport

No tota la carpeta `help/` es viva. L'estat actual es:

- `src/i18n/locales/*.json`: ajuda visible tipus `HelpSheet`.
- `public/docs/manual-usuari-summa-social.{ca,es,fr}.md`: manual runtime.
- `docs/kb/cards/**/*.json` i `docs/kb/_fallbacks.json`: base del bot.
- `src/help/` i `help/topics/`: capes legacy congelades; no son la font principal per a nou contingut.

### Documentacio operativa

L'ordre de lectura recomanat continua sent:

1. `docs/DEPLOY.md`
2. `docs/GOVERN-DE-CODI-I-DEPLOY.md`
3. `docs/REPO-HIGIENE-I-DIAGNOSTIC.md`
4. `docs/DEV-SOLO-MANUAL.md`
5. `docs/SUMMA-SOCIAL-REFERENCIA-COMPLETA.md`
6. `docs/PATRONS-CODI-OBLIGATORIS.md`

## Requisits locals

- Node.js 20 recomanat.
- `npm` com a gestor de paquets (hi ha `package-lock.json` a arrel i a `functions/`).
- Acces a un projecte Firebase valid o a les credencials publiques necessaries per build i runtime local.
- Credencials opcionals segons el flux que vulguis provar: Gemini, OpenAI, Resend, secrets de publicacio i integracions de backup.

## Configuracio d'entorn

### Variables minimes per arrencar i compilar

El projecte necessita com a minim aquestes variables a `.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_API_KEY=
```

Per a una paritat local realista, afegeix tambe:

```bash
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

`apphosting.yaml` reflecteix els valors publics i el mapping de secrets usats a produccio.

### Variables opcionals per funcionalitat

`.env.local.example` cobreix la part d'IA i blog local:

```bash
GOOGLE_API_KEY=
GOOGLE_GENAI_API_KEY=
GEMINI_API_KEY=
GOOGLE_GENAI_MODEL=
GEMINI_MODEL=

OPENAI_API_KEY=
BLOG_WRITER_PROVIDER=openai
BLOG_WRITER_MODEL=gpt-5

BLOG_PUBLISH_SECRET=
BLOG_PUBLISH_BASE_URL=http://127.0.0.1:9002
```

Segons el flux, tambe poden intervenir:

- `BLOG_ORG_ID`
- `PRODUCT_UPDATES_PUBLISH_SECRET`
- `RESEND_API_KEY`
- `NEXT_PUBLIC_APP_URL`
- `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`
- `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`
- `FIRESTORE_BACKUP_BUCKET`

Nota important:

- `npm run dev` s'encarrega d'assegurar `BLOG_PUBLISH_SECRET`, `BLOG_PUBLISH_BASE_URL` i `BLOG_ORG_ID` per al flux local del blog si no existeixen.
- En mode demo (`APP_ENV=demo` o `NEXT_PUBLIC_APP_ENV=demo`) la validacio Firebase es estricta i requereix totes les claus publiques.

## Posada en marxa local

```bash
npm install
cp .env.local.example .env.local
# afegeix les variables Firebase publiques i les opcionals que necessitis
npm run dev
```

Per defecte el desenvolupament local arrenca a `http://127.0.0.1:9002`.

Alternatives:

- `npm run dev:turbo`: `next dev --turbopack -p 9002` sense el bootstrap del blog local.
- `npm run genkit:dev`: arrenca l'entorn local de Genkit.
- `npm run genkit:watch`: igual que l'anterior, en mode watch.

## Scripts utiles

### Desenvolupament i build

| Script | Que fa |
| --- | --- |
| `npm run dev` | Arrenca el Next local amb bootstrap del blog local |
| `npm run dev:turbo` | Arrenca el dev server simple amb Turbopack |
| `npm run build` | Build segur via `scripts/build-safe.mjs` |
| `npm run start` | Serveix la build produida per Next |
| `npm run lint` | Executa lint de Next |
| `npm run typecheck` | TypeScript sense emitir artefactes |

### Tests i quality gates

| Script | Que fa |
| --- | --- |
| `npm test` | Proves Node del core |
| `npm run test:coverage` | Cobertura + informe de superficie |
| `npm run check` | `docs:check` + doc sync + env + typecheck + tests + build |
| `npm run verify:ci` | Guardrails fiscals + coverage + support eval + build |
| `npm run docs:check` | Valida documentacio i coherencia basica |
| `npm run support:eval` | Eval del bot sobre golden set |
| `npm run i18n:check` | Validacio de locales |
| `npm run help:audit` | Auditoria de la capa help |

### Demos, editorial i manteniment

| Script | Que fa |
| --- | --- |
| `npm run demo:up` | Prepara l'entorn curt de demo |
| `npm run demo:smoke` | Smoke test de demo |
| `npm run updates:drafts` | Genera esborranys de novetats de producte |
| `npm run editorial:generate-monthly` | Genera el calendari/editorial mensual |
| `npm run editorial:publish-blog` | Publica un post del sistema editorial |
| `npm run perf:monthly` | Check mensual de performance |
| `npm run migrate:capabilities` | Backfill de capacitats de membres |

## Flux de treball oficial

Aquest projecte no assumeix un flux "edites a `main` i fas deploy". El contracte vigent es conservador i basat en worktrees:

```bash
npm run inicia
# implementar dins del worktree creat
npm run acabat
npm run integra
npm run status
npm run publica
```

Punts clau:

- El repo de control es aquest directori i ha d'estar net.
- `npm run inicia` crea una branca `codex/*` i un worktree extern.
- La implementacio es fa dins del worktree, no al repo de control.
- `npm run acabat` valida, commita i puja, pero no integra.
- `npm run integra` es l'unica porta d'entrada a `main`.
- `npm run publica` es l'unica porta d'entrada a `prod`.
- `npm run status` es la font unica d'estat operatiu.

Documentacio autoritativa:

- `docs/DEPLOY.md`
- `docs/GOVERN-DE-CODI-I-DEPLOY.md`
- `docs/REPO-HIGIENE-I-DIAGNOSTIC.md`

## Build, QA i riscos de manteniment

Hi ha un detall important del runtime actual: `next.config.ts` te `typescript.ignoreBuildErrors=true` i `eslint.ignoreDuringBuilds=true`.

Aixo implica que:

- `npm run build` no es una garantia suficient de salut.
- El gate real ha de passar per `npm run typecheck`, `npm test`, `npm run check` o `npm run verify:ci`.
- Quan el build falla per corrupcio local de `.next`, `scripts/build-safe.mjs` neteja cache i reintenta una sola vegada.

Cobertura actual:

- proves de negoci sobretot a `src/lib/__tests__/`
- proves SEPA addicionals a `tests/sepa-pain008/`
- checklist manual a `tests/CHECKLIST-MANUAL.md`

`npm run verify:ci` es especialment rellevant quan el canvi toca fiscalitat, remeses, donants, imports o permisos.

## Hosting, infra i serverless

### App i domini

- L'app principal es desplega a Firebase App Hosting (`apphosting.yaml`).
- `firebase.json` mante una capa de Firebase Hosting que redirigeix el domini al backend d'App Hosting.
- Firestore, Storage rules i indexes viuen a l'arrel del repo.

### Functions

`functions/` es un projecte separat amb Node 20 per a:

- exportacio de projectes
- zip de tancament (`closing bundle`)
- migracions puntuals
- alertes d'incidencia
- backups setmanals
- health checks nocturns

### Backups

La infraestructura de backups existeix tant a `src/lib/backups` com a `functions/src/backups`, pero la part "cloud backups" esta actualment desactivada per feature flags (`CLOUD_BACKUPS_ENABLED = false`) a la capa Next/API i en els runners principals.

## APIs i contractes externs rellevants

### Blog public

- Auth: `Authorization: Bearer <BLOG_PUBLISH_SECRET>`
- Upload portada: `POST /api/blog/upload-cover`
- Publicacio: `POST /api/blog/publish`
- Actualitzacio: `POST /api/blog/update`
- Variables utiles: `BLOG_ORG_ID`, `BLOG_PUBLISH_SECRET`, `BLOG_PUBLISH_BASE_URL`
- Contracte extern: `docs/contracts/blog-publish-cover-image.md`

### Novetats de producte

- Auth: `Authorization: Bearer <PRODUCT_UPDATES_PUBLISH_SECRET>`
- Publicacio: `POST /api/product-updates/publish`
- Retirada: `POST /api/product-updates/unpublish`
- Suporta canals `app` i `web`, i localitzacio automatica cap a `es` en determinats fluxos

### Altres endpoints destacables

- `POST /api/support/bot`: bot intern amb guardrails i KB estructurada
- `POST /api/ai/categorize-transaction`: categoritzacio assistida
- `POST /api/fiscal/model182/generate`
- `POST /api/fiscal/model347/generate`
- `POST /api/exports/closing-bundle-zip`

## On continuar segons el que vulguis fer

- Entendre l'operativa global: `docs/DEV-SOLO-MANUAL.md`
- Entendre el contracte de deploy: `docs/DEPLOY.md`
- Mapa complet de documentacio: `docs/README.md`
- Sistema editorial: `octavi/summa/editorial/README.md`
- KB del bot: `docs/kb/README.md`
- Estat de les capes help legacy: `src/help/README.md` i `help/topics/README.md`

## Resum curt

Si has de recordar nomes una cosa: aquest repo es una plataforma completa, no nomes una app Next. Quan toquis codi, pensa sempre en quatre plans alhora: producte multi-org, domini fiscal/SEPA, lloc public/editorial i govern operatiu basat en worktrees i gates forts.
