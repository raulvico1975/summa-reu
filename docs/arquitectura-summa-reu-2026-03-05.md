# Summa Reu - Arquitectura, estat del codi i contingut (05/03/2026)

## 1) Abast i context d'aquest document

- Data de la fotografia tècnica: **5 de març de 2026** (timezone projecte: `Europe/Madrid`).
- Font: estat **real** del workspace local a `/Users/raulvico/Documents/summa-board`.
- Aquesta fotografia descriu tant l'arquitectura com l'estat operatiu i la qualitat executada avui (`lint`, `build`, `smoke`).
- Inclou l'estat de codi **tal com està ara**: hi ha canvis locals no comitejats.

## 2) Resum executiu

- Producte: MVP per a entitats socials per gestionar **votacions de convocatòria**, **tancament de reunió** i **actes** amb suport IA.
- Arquitectura: monorepo lleuger amb **Next.js App Router** + **Firebase (Auth/Firestore/Storage/Hosting)** + mòdul `functions` separat (actualment esquelet).
- Model de seguretat: accés owner per sessió server (`__session`) i escriptura pública acotada via endpoint backend (`/api/public/vote`).
- Estat tècnic avui:
  - `npm run lint`: OK
  - `npm run build`: OK
  - `npm run ci:smoke` (emuladors): OK
- Maduresa: base sòlida de producte MVP, amb observabilitat a Telegram, scripts operatius i CI/CD; encara amb zones pendents típiques MVP (alta comercial encara no connectada a UI, processament en segon pla sense cua dedicada, etc.).

## 3) Stack i versions actuals

### Runtime i framework

- `next`: `^15.5.12`
- `react` / `react-dom`: `19.2.3`
- `typescript`: `^5`
- Node per app principal: via entorn Next (workflows CI fan servir Node 20)
- Node per `functions`: `22` (`functions/package.json`)

### Plataforma i serveis

- Firebase Auth (client + admin)
- Firestore (model principal de dades)
- Firebase Storage (pujada de gravacions)
- Firebase Hosting amb `frameworksBackend` (regió `europe-west1`)
- Gemini API (mode real opcional, fallback stub)
- Telegram Bot API (alertes operatives)

### Llibreries rellevants

- `firebase`, `firebase-admin`
- `zod` (validació d'entrada i esquema d'actes)
- `@opentelemetry/api` (present com a dependència)
- Tailwind v4 (`@tailwindcss/postcss`)

## 4) Estructura del repositori

Directoris principals:

- `app/`: UI App Router + API routes (`app/api/*`)
- `src/`: capa de domini i components
- `functions/`: codi Cloud Functions v2 (actualment buit funcionalment)
- `scripts/`: bootstrap, seed, smoke, monitor i automatització mirror
- `.github/workflows/`: CI, deploy manual d'emergència, mirror de prod
- `docs/`: documentació operativa

Mètriques ràpides de codi (sense generats):

- Fitxers de codi rellevants: **~88** (`app`, `src`, `functions/src`, `scripts`, `.github/workflows`, `docs`)
- LOC aproximades:
  - `src`: **3501**
  - `app`: **1410**
  - `scripts`: **1012**
  - `.github/workflows`: **221**

## 5) Arquitectura lògica

### 5.1 Capa de presentació (App Router)

Rutes UI:

- Públiques:
  - `/`
  - `/p/[slug]`
  - `/p/[slug]/results`
- Owner:
  - `/login`
  - `/signup`
  - `/dashboard`
  - `/polls/new`
  - `/polls/[pollId]`
  - `/meetings/[meetingId]`

Patró de protecció owner:

- Server-side guard amb `requireOwnerPage()` (`src/lib/ui/owner-page.ts`)
- Resolució de sessió via cookie `__session` i `adminAuth.verifySessionCookie` (`src/lib/firebase/auth.ts`)

### 5.2 Capa API (BFF intern)

Endpoints principals (`app/api/*`):

- Auth:
  - `POST /api/auth/entity-signup`
  - `POST /api/auth/session-login`
  - `POST /api/auth/session-logout`
- Polls owner:
  - `POST /api/owner/polls/create`
  - `POST /api/owner/close-poll`
- Vote públic:
  - `POST /api/public/vote`
  - `GET /api/public/ics` (requereix owner)
- Meeting/actes:
  - `POST /api/owner/recordings/register`
  - `POST /api/owner/process-recording`
  - `POST /api/owner/minutes/update`
  - `GET /api/owner/minutes/export`
- Monitoring client:
  - `POST /api/public/error-report`

Validació consistent amb `zod` i controls d'autorització same-origin per mètodes mutables (`isTrustedSameOrigin`).

### 5.3 Capa de domini / repositori

El nucli de dades és `src/lib/db/repo.ts`:

- Lectura/escriptura de `orgs`, `polls`, `meetings` i subcol·leccions
- Transaccions per operacions crítiques:
  - `upsertVoteByVoterId`
  - `closePollCreateMeeting`
  - `claimRecordingForProcessing`
- Funcions de negoci clau:
  - creació d'entitat (`createOrgForOwner`)
  - creació i tancament de votació
  - registre/processament de gravació
  - guardat de transcripció i acta

### 5.4 Integracions externes

- Firebase Admin SDK (server)
- Firebase Web SDK (client)
- Gemini REST (`generativelanguage.googleapis.com`)
- Telegram Bot API (`sendMessage`) per incidents

## 6) Model de dades (Firestore)

### 6.1 Col·leccions principals

- `orgs/{orgId}`
  - `name`, `ownerUid`, `createdAt`
- `polls/{pollId}`
  - `orgId`, `title`, `description`, `timezone`, `slug`, `status`, `winningOptionId`, `createdAt`, `closedAt`
  - subcol·leccions:
    - `options/{optionId}` (`startsAt`)
    - `voters/{voterId}` (`name`, `tokenHash`, `createdAt`, `lastSeenAt`)
    - `votes/{voterId}` (`availabilityByOptionId`, `updatedAt`)
- `meetings/{meetingId}`
  - `pollId`, `orgId`, `scheduledAt`, `createdAt`
  - subcol·leccions:
    - `recordings/{recordingId}`
    - `transcripts/{transcriptId}`
    - `minutes/{minutesId}`
- `_rate_limits/{hash}` (control de taxa server-side)

### 6.2 Índexos

- Un índex declarat a `firestore.indexes.json`:
  - `polls` per `orgId ASC` + `createdAt DESC`

## 7) Seguretat

### 7.1 Auth i sessió

- Login client amb Firebase Auth (`signInWithEmailAndPassword`)
- Intercanvi d'`idToken` per cookie `__session` (`session-login`)
- Logout revocant refresh tokens i netejant cookie (`session-logout`)

### 7.2 Regles Firestore/Storage

- Firestore: només owner de l'entitat pot accedir als seus recursos.
- Storage: només owner de la reunió pot escriure/llegir `meetings/{meetingId}/recordings/*`.
- Deny-all final en ambdós rulesets.

### 7.3 Proteccions d'API

- Same-origin check en operacions de mutació (`POST`).
- Rate limiting:
  - signup (`10` intents / `10min` per IP)
  - vot públic (`40` / `10min` per `poll+ip`)
  - error-report client (`12` / `10min` per IP)
- Token votant:
  - al client es guarda token raw a `localStorage`
  - al servidor només es persisteix hash SHA-256
  - `voterId` derivat del hash

### 7.4 Headers i hardening web

- CSP restrictiva a `next.config.ts`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- HSTS, COOP, CORP, Referrer-Policy
- Middleware de redirecció canònica (`summareu.app`) per hosts `web.app/firebaseapp.com`

## 8) Fluxos funcionals principals

### 8.1 Flux votació

1. Owner crea votació (`/polls/new` -> `POST /api/owner/polls/create`).
2. Es comparteix enllaç públic `/p/{slug}`.
3. Participants voten (`POST /api/public/vote`).
4. Owner revisa resultats (`/polls/{pollId}` o `/p/{slug}/results`).
5. Owner tanca votació i crea reunió (`POST /api/owner/close-poll`).

### 8.2 Flux reunió i acta

1. Owner puja fitxer o text base (`recording-uploader`).
2. `register` crea registre de gravació.
3. `process-recording` fa claim i llança tasca asíncrona.
4. Tasca genera:
  - transcripció (Gemini o stub)
  - acta (JSON + markdown)
5. Owner pot editar markdown i exportar `.md`.
6. També pot exportar convocatòria `.ics`.

### 8.3 Processament IA

- Mode `real` si hi ha `GEMINI_API_KEY`, altrament `stub`.
- Selecció model:
  - model explícit per env o detecció automàtica (`flash-lite`)
  - fallback: `gemini-2.5-flash-lite`
- Si falla transcripció/generació real -> fallback a stub.

## 9) Observabilitat i incidències

- `instrumentation.ts`: captura `unhandledRejection` i `uncaughtException` de procés.
- `ErrorMonitor` client captura `error` i `unhandledrejection` i envia a backend.
- `report.ts` classifica errors esperats vs inesperats.
- Alertes Telegram humanitzades amb dedupe temporal (10 min) en memòria.

## 10) DevOps, scripts i desplegament

### 10.1 Scripts npm

- Execució: `dev`, `build`, `start`, `lint`
- Entorn local complet: `emu`, `seed`, `test:smoke`
- Operatiu: `monitor:login`, `test:telegram`, `test:permissions`, `bootstrap:firebase`

### 10.2 CI/CD

- `CI` (`.github/workflows/ci.yml`): lint + smoke amb emuladors
- `Deploy Manual Emergency`: lint + smoke + `firebase deploy --only hosting`
- `Prod Mirror Sync`: sincronització unidireccional des de repo prod cap branca mirror

### 10.3 Hosting i functions

- Next desplegat via Firebase Hosting Framework backend (`europe-west1`).
- `functions/src/index.ts` és intencionalment buit (sense lògica pròpia avui).

## 11) Estat de qualitat avui (evidència executada)

Comandes executades avui (05/03/2026):

- `npm run lint` -> **OK**
- `npm run build` -> **OK** (compila i genera 21 rutes)
- `npm run ci:smoke` -> **OK** (emuladors + seed + smoke end-to-end)

El smoke valida, entre altres:

- càrrega de rutes públiques i login
- votació pública + re-vot amb mateix token
- aïllament entre entitats
- protecció d'ICS sense sessió
- alta d'entitat via API
- logout i revocació efectiva de sessió

## 12) Estat actual del codi (workspace)

### 12.1 Canvis locals

- Branca actual: `main`
- Fitxers modificats (tracked): **36**
- Fitxers/directoris no seguits: **10**
- Hi ha canvis amplis de UI, scripts, CI i configuració respecte l'últim commit local.

### 12.2 Coherència funcional

- Capa de domini i API alineades per MVP.
- Traduccions `ca` i `es` completes per superfícies principals.
- UI responsive aplicada a rutes core.

### 12.3 Punts a tenir presents

- **Alta d'entitat a UI**: `/signup` actual mostra bloc comercial amb CTA deshabilitat; el formulari `EntitySignupForm` existeix però no està connectat a la pàgina.
- **Processament asíncron**: es llança amb `void processRecordingTask(...)` des d'un handler HTTP; per escalar robustament convindria cua dedicada (Cloud Tasks/PubSub) per garanties de reintent i durabilitat.
- **Rate-limit store**: `_rate_limits` pot créixer sense neteja automàtica explícita (no hi ha TTL/cron en codi).
- **Dedupe alertes**: memòria local del procés; en múltiples instàncies serverless la deduplicació no és global.

## 13) Inventari funcional del producte (què conté avui)

- Multi-entitat basada en owner Firebase Auth.
- Votacions públiques amb enllaç per slug.
- Taula de resultats per owner i vista pública agregada.
- Tancament de votació i creació de reunió.
- Pujada de gravacions o entrada manual de notes/text.
- Pipeline transcripció + acta (real/stub) amb edició manual.
- Exportació `.ics` i exportació d'acta `.md`.
- Monitorització d'errors server/client amb alertes Telegram.
- Entorn local reproductible amb Firebase emulators + seed + smoke.
- CI obligatòria (lint/smoke) i deploy manual segur.
- Mirror de prod segregat amb claus read-only i alertes separades.

## 14) Conclusió tècnica

L'estat actual de Summa Reu és **consistent i desplegable** per a un MVP operatiu: arquitectura clara per capes, seguretat raonable per model owner/public, proves automàtiques bàsiques útils i pipeline funcional de negoci complet (votació -> reunió -> acta). Els següents salts de solidesa passen principalment per:

- connectar o retirar definitivament el flux d'alta UI pendent,
- externalitzar el processament de gravacions a una cua robusta,
- afegir neteja/TTL per documents de rate-limit i dedupe distribuït.
