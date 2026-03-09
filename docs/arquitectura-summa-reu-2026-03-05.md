# Summa Reu - Arquitectura, estat del codi i contingut (09/03/2026)

## 1) Abast i context d'aquest document

- Data de la fotografia tècnica: **9 de març de 2026** (timezone projecte: `Europe/Madrid`).
- Fitxer històric: el nom del document conserva la data original, però el contingut reflecteix l'estat actual.
- Font: estat **real** del workspace local a `/Users/raulvico/Documents/summa-board`.
- Aquesta fotografia descriu arquitectura, estat operatiu i qualitat verificada avui.
- Inclou l'estat de codi tal com està ara, amb canvis locals no comitejats.

## 2) Resum executiu

- Producte: MVP per a entitats socials per gestionar **votacions**, **tancament de reunió** i **actes** amb suport IA.
- Arquitectura: monorepo lleuger amb **Next.js App Router** + **Firebase (Auth/Firestore/Storage/Hosting)** + mòdul `functions` separat, avui sense lògica funcional rellevant.
- Model de seguretat: accés owner per sessió server (`__session`) i escriptura pública limitada via endpoint backend (`/api/public/vote`).
- Novetats estructurals rellevants:
  - localització `ca/es` amb middleware i routing localitzat,
  - login server-side amb `password-login`,
  - home pública i flux comercial bàsic,
  - reunió com a espai documental, no com a videoreunió integrada.
- Estat tècnic avui:
  - `npm run lint`: OK
  - `npm run i18n:check-es`: OK
  - `npm run build`: OK
  - `npm run ci:smoke`: OK
- Commits rellevants més recents a `main`:
  - `043f33ca` `meetings: return unified meeting creation shape`
  - `5ee58d95` `meetings: remove firestore composite index dependency in getMeetingById`
  - `56af8ae9` `meetings(recording): improve recording observability`
  - `76516339` `meeting(owner): afegeix esborrat de reunions`
- Maduresa: base sòlida de producte MVP, amb observabilitat, scripts operatius i CI/CD; encara amb pendents clars en signup públic, processament asíncron robust i capa de reunió en directe.
- Validació de producció: onboarding públic amb Stripe operatiu; blocker de build antiga resolt al commit `151c9473`.

## 3) Stack i versions actuals

### 3.1 Runtime i framework

- `next`: `^15.5.12`
- `react` / `react-dom`: `19.2.3`
- `typescript`: `^5`
- Node per app principal: via entorn Next; la CI usa Node 20
- Node per `functions`: `22`

### 3.2 Plataforma i serveis

- Firebase Auth
- Firestore
- Firebase Storage
- Firebase Hosting amb `frameworksBackend` a `europe-west1`
- Gemini API opcional; el flux premium deixa `error` si la ingestió real no és possible
- Telegram Bot API per alertes

### 3.3 Llibreries rellevants

- `firebase`, `firebase-admin`
- `zod`
- `@opentelemetry/api`
- Tailwind v4

## 4) Estructura del repositori

Directoris principals:

- `app/`: UI App Router + API routes
- `src/`: domini, components, i18n, Firebase, seguretat i monitorització
- `functions/`: Cloud Functions v2, avui pràcticament esquelet
- `scripts/`: bootstrap, seed, smoke, monitor i utilitats
- `.github/workflows/`: CI, deploy manual d'emergència, mirror de prod
- `docs/`: documentació operativa i de referència

Observacions de mida:

- El build actual genera **29 rutes**.
- L'estructura funcional principal continua centralitzada a `app/` i `src/lib/`.

## 5) Arquitectura lògica

### 5.1 Capa de presentació

Rutes UI visibles:

- Públiques:
  - `/`
  - `/login`
  - `/signup`
  - `/p/[slug]`
  - `/p/[slug]/results`
- Owner:
  - `/billing`
  - `/dashboard`
  - `/polls/new`
  - `/polls/[pollId]`
  - `/owner/meetings/[meetingId]`
  - `/meetings/[meetingId]` com a redirect localitzat

Model de locale:

- En producció les rutes es presenten com `/ca/...` o `/es/...`.
- En local es mantenen URLs estables sense prefix i el locale viatja per header/cookie.

Protecció owner:

- guard server-side amb `requireOwnerPage()`
- resolució de sessió via cookie `__session` i `adminAuth.verifySessionCookie`

### 5.2 Capa API (BFF intern)

Endpoints principals:

- Auth:
  - `POST /api/auth/entity-signup`
  - `POST /api/auth/password-login`
  - `POST /api/auth/session-login`
  - `POST /api/auth/session-logout`
- Owner:
  - `POST /api/owner/polls/create`
  - `POST /api/owner/close-poll`
  - `POST /api/owner/meetings/start-recording`
  - `POST /api/owner/meetings/stop-recording`
  - `POST /api/owner/meetings/delete`
  - `POST /api/owner/recordings/register`
  - `POST /api/owner/process-recording`
  - `POST /api/owner/minutes/update`
  - `GET /api/owner/minutes/export`
- Públic:
  - `POST /api/public/vote`
  - `GET /api/public/ics` (requereix owner)
  - `POST /api/public/error-report`

Característiques:

- validació d'entrada amb `zod`
- checks `same-origin` a mutacions
- autorització owner en endpoints privats

### 5.3 Capa de domini / repositori

El nucli de negoci continua a `src/lib/db/repo.ts`:

- lectoescriptura de `orgs`, `polls`, `meetings` i subcol·leccions
- transaccions per operacions crítiques:
  - `upsertVoteByVoterId`
  - `closePollCreateMeeting`
  - `claimRecordingForProcessing`
- funcions clau:
  - creació d'entitat
  - creació i tancament de votació
  - registre de gravació
  - guardat de transcripció i acta
  - edició d'acta

### 5.4 Integracions externes

- Firebase Admin SDK
- Firebase Web SDK
- Daily REST + webhook
- Stripe Checkout + webhook
- Gemini REST
- Telegram Bot API

## 6) Model de dades (Firestore)

### 6.1 Col·leccions principals

- `orgs/{orgId}`
- `stripe_events/{eventId}`
- `polls/{pollId}`
  - `options/{optionId}`
  - `voters/{voterId}`
  - `votes/{voterId}`
- `meetings/{meetingId}`
  - `recordings/{recordingId}`
  - `transcripts/{transcriptId}`
  - `minutes/{minutesId}`
- `meeting_ingest_jobs/{jobId}`
- `_rate_limits/{hash}`

### 6.2 Camps rellevants

- `orgs`: `name`, `ownerUid`, `createdAt`, `subscriptionStatus`, `stripeCustomerId`, `stripeSubscriptionId`, `plan`, `recordingLimitMinutes`
- `stripe_events`: `eventId`, `type`, `created`, `orgId`, `subscriptionId`, `receivedAt`, `raw`
- `polls`: `orgId`, `title`, `description`, `timezone`, `slug`, `status`, `winningOptionId`, `createdAt`, `closedAt`
- `meetings`: `orgId`, `title`, `description`, `createdAt`, `createdBy`, `meetingUrl`, `recordingStatus`, `recordingUrl`, `transcript`, `minutesDraft`, `pollId`, `scheduledAt`
- `recordings`: `storagePath`, `rawText`, `mimeType`, `originalName`, `status`, `error`, `createdAt`
- `transcripts`: `recordingId`, `status`, `text`, `storagePathTxt`, `createdAt`
- `minutes`: `recordingId`, `status`, `minutesMarkdown`, `minutesJson`, `createdAt`
- `meeting_ingest_jobs`: `meetingId`, `orgId`, `recordingId`, `source`, `status`, `recordingUrl`, `error`, `createdAt`, `updatedAt`

Contractes d’estat:

- `meeting.recordingStatus`: `none -> recording -> processing -> ready | error`
- `meeting_ingest_job.status`: `queued -> processing -> completed | error`

### 6.3 Índexos

- Índex declarat a `firestore.indexes.json`:
  - `polls` per `orgId ASC` + `createdAt DESC`

## 7) Seguretat

### 7.1 Auth i sessió

- Login principal via formulari server-side que envia a `POST /api/auth/password-login`
- Alta programàtica via `entity-signup` i posterior `session-login`
- Sessió owner en cookie `__session`
- Logout amb revocació de refresh tokens i neteja de cookie

### 7.2 Regles Firestore/Storage

- Firestore: només owner de l'entitat accedeix als seus recursos
- Storage: només owner de la reunió pot llegir/escriure `meetings/{meetingId}/recordings/*`
- `deny-all` final en ambdós rulesets

### 7.3 Proteccions d'API

- `same-origin` per mutacions
- `subscription_required` (`402`) a `api/owner/*` si l’org no està activa
- `require owner` + ownership sobre `meetingId` a endpoints owner de reunions
- webhook Daily amb bearer opcional i filtre d’events admesos
- webhook Stripe amb verificació de signatura i auditoria Firestore
- rate limit server-side:
  - signup: `10 / 10min / IP`
  - vot públic: `40 / 10min / poll+ip`
  - error-report client: `12 / 10min / IP`
- token de votant:
  - raw al client
  - hash SHA-256 al servidor
  - `voterId` derivat del hash

### 7.4 Headers i hardening web

- CSP restrictiva a `next.config.ts`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- HSTS, COOP, CORP, Referrer-Policy
- `Permissions-Policy` restrictiva
- middleware de redirecció canònica a `summareu.app`
- `skipTrailingSlashRedirect: true` per evitar bucles de locale amb slash final

## 8) Fluxos funcionals principals

### 8.1 Flux de votació

1. Owner crea votació a `/polls/new`.
2. Comparteix enllaç públic `/p/{slug}`.
3. Participants voten via `POST /api/public/vote`.
4. Owner revisa resultats a `/polls/{pollId}` o `/p/{slug}/results`.
5. Owner tanca votació via `POST /api/owner/close-poll`.
6. El sistema crea la reunió.

### 8.2 Flux de reunió i acta

1. Owner tanca votació via `POST /api/owner/close-poll`.
2. El servidor crea document `meetings/{meetingId}` i room Daily.
3. Owner entra a `/owner/meetings/{meetingId}`.
4. Owner inicia gravació via `POST /api/owner/meetings/start-recording`.
5. Owner atura gravació via `POST /api/owner/meetings/stop-recording`.
6. Daily notifica `POST /api/webhooks/daily/recording-complete`.
7. El servidor crea `meeting_ingest_jobs/{jobId}` de forma idempotent.
8. El job processa transcripció + acta i persisteix `transcript` i `minutesDraft`.
9. La UI es refresca mentre hi ha estat `processing`.
10. Owner pot editar markdown i exportar `.md`.
11. Owner pot exportar `.ics`.
12. Owner pot eliminar la reunió amb neteja en cascada.

### 8.3 Processament IA

- Mode `real` si hi ha `GEMINI_API_KEY` i el fitxer és ingerible
- Mode `mock` només per smoke controlat
- Selecció de model via env o detecció
- fallback a `gemini-2.5-flash-lite`
- si falla el camí `real`, el job queda en `error` i la reunió mostra estat accionable

## 9) Observabilitat i incidències

- `instrumentation.ts` captura `unhandledRejection` i `uncaughtException`
- `ErrorMonitor` client envia `error` i `unhandledrejection` a backend
- `report.ts` diferencia errors esperats i inesperats
- alertes Telegram humanitzades amb dedupe temporal en memòria

## 10) DevOps, scripts i desplegament

### 10.1 Scripts npm

- base: `dev`, `build`, `start`, `lint`
- local complet: `emu`, `seed`, `test:smoke`, `ci:smoke`
- operació: `monitor:login`, `test:telegram`, `test:permissions`, `bootstrap:firebase`
- qualitat d'i18n: `i18n:check-es`

### 10.2 CI/CD

- `CI`: lint + smoke amb emuladors
- `Deploy Manual Emergency`: lint + smoke + deploy hosting
- `Prod Mirror Sync`: mirror unidireccional cap a branca mirror

### 10.3 Hosting i functions

- Next desplegat via Firebase Hosting Framework backend a `europe-west1`
- `functions/src/index.ts` continua intencionalment buit

### 10.4 Prova manual de staging real

Variables necessàries:

- `DAILY_API_KEY`
- `DAILY_DOMAIN`
- `DAILY_WEBHOOK_BEARER_TOKEN`
- `GEMINI_API_KEY`

Ordre exacte de prova manual:

1. Crear reunió.
2. Entrar a la reunió.
3. Iniciar gravació.
4. Esperar entre 20 i 40 segons.
5. Aturar gravació.
6. Verificar que el webhook real arriba a `POST /api/webhooks/daily/recording-complete`.
7. Verificar que la reunió passa per `recordingStatus = processing`.
8. Verificar que la reunió acaba amb `recordingStatus = ready`.
9. Verificar que hi ha `transcript`.
10. Verificar que hi ha `minutesDraft`.

Què s’ha de verificar a Firestore:

- `meetings/{meetingId}.meetingUrl`
- `meetings/{meetingId}.recordingStatus`
- `meetings/{meetingId}.recordingUrl`
- `meetings/{meetingId}.transcript`
- `meetings/{meetingId}.minutesDraft`
- `meeting_ingest_jobs/{jobId}` associat amb estat coherent

Què s’ha de verificar en eliminació segura de reunió:

- el document `meetings/{meetingId}` desapareix
- les subcol·leccions `recordings`, `transcripts` i `minutes` queden buides
- no queden `meeting_ingest_jobs` associats
- el prefix de Storage `meetings/{meetingId}/` queda sense fitxers útils

Criteri d’èxit:

- Daily crea la room i la gravació.
- El webhook és acceptat.
- `meeting_ingest_job` passa a `completed`.
- `transcript` i `minutesDraft` queden persistits.

Criteri d’error:

- Si falla només l’embed `iframe`, no bloqueja.
- Si falla webhook, ingestió o persistència final, bloqueja merge i deploy.

## 11) Estat de qualitat avui

Comandes executades avui, **9 de març de 2026**:

- `npm run lint` -> **OK**
- `npm run i18n:check-es` -> **OK**
- `npm run build` -> **OK**
- `npm run ci:smoke` -> **OK**

El build actual genera **29 rutes**.

El smoke valida, entre altres:

- càrrega de home pública i login
- votació pública i re-vot amb mateix `voterId`
- aïllament entre entitats
- protecció d'ICS sense sessió
- alta d'entitat via API
- logout i revocació efectiva de sessió
- coherència del routing actualitzat de login/logout amb locale

## 12) Estat actual del codi (workspace)

### 12.1 Canvis locals

- Branca actual: `main`
- El workspace s’ha de deixar net després de comitejar documentació i desplegar.

### 12.2 Coherència funcional

- Capa de domini i API alineades per l'MVP
- Traduccions `ca` i `es` operatives a superfícies principals
- Routing localitzat i guardes owner coherents amb el middleware
- UI responsive aplicada a rutes core

### 12.3 Punts a tenir presents

- **Verificació visual final**: queda recomanat entrar una vegada amb l’owner actiu per confirmar confort de redirecció final a `/dashboard`.
- **Reunió en directe**: hi ha integració operativa amb Daily per room, embed i controls de gravació; encara no és una capa pròpia ni està endurida com a E2E de producció.
- **Processament asíncron**: es llança amb `void processRecordingTask(...)` des d'un handler HTTP; per escalar bé cal cua dedicada.
- **Rate-limit store**: `_rate_limits` pot créixer sense neteja automàtica explícita.
- **Dedupe alertes**: és local al procés; en múltiples instàncies no és global.

## 13) Inventari funcional del producte (què conté avui)

- Home pública de producte
- Accés owner per login
- Alta d'entitat pública amb Stripe
- Pantalla `/billing`
- Votacions públiques amb slug
- Resultats públics i resultats owner
- Còpia d'enllaç públic de votació
- Tancament de votació i creació de reunió
- Inici/aturada de gravació Daily des de la reunió
- Pujada de gravacions o entrada manual de text
- Pipeline transcripció + acta amb edició manual
- Eliminació segura de reunió amb neteja en cascada
- Exportació `.ics` i `.md`
- Monitorització d'errors server/client amb Telegram
- Entorn local reproductible amb emuladors, seed i smoke
- CI obligatòria i deploy manual segur
- Mirror de prod segregat
- Localització `ca/es` amb cobertura controlada
- Auditoria de webhooks Stripe a Firestore

## 14) Conclusió tècnica

L'estat actual de Summa Reu és **consistent, desplegat i operativament llest per operar**: arquitectura clara per capes, seguretat raonable pel model owner/public, proves automàtiques útils i pipeline funcional complet `signup -> billing -> Stripe -> votació -> reunió -> gravació -> acta`.

Els següents salts de solidesa passen principalment per:

- externalitzar el processament de gravacions a una cua robusta,
- afegir neteja/TTL per documents de rate-limit,
- decidir i executar l'estratègia real de reunió síncrona.

## 15) Evidència mínima d'obertura

- Org validada a producció: `FnNsMxFscHfOyt2oxhTPi3uUQD22`
- `subscriptionStatus = active`
- `stripeSubscriptionId = sub_1T8hIy1w5oTdm9u8IBZeBPjW`
- Event auditat: `stripe_events/evt_1T8hJ81w5oTdm9u8pvhPgF6r`
- Tipus: `checkout.session.completed`

## 16) Checklist postobertura

- Revisar noves `orgs/*` creades
- Revisar `subscriptionStatus`
- Revisar `stripe_events`
- Revisar si apareixen `pending` anòmals
- Revisar errors SSR i webhook
