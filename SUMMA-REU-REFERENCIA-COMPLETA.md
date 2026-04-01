# SUMMA REU - REFERÈNCIA COMPLETA

> Document viu de referència de producte i tecnologia de Summa Reu.
> Data de base: **1 d'abril de 2026** (`Europe/Madrid`).
> Abast: estat real implementat al repositori `summa-reu` i roadmap immediat explícit.

## 1) Propòsit del document

Aquest document és la **font de veritat** de Summa Reu per:

- entendre el producte i el seu estat actual,
- prendre decisions de producte i tecnologia amb context compartit,
- reduir dependència de context oral,
- mantenir alineats producte, enginyeria i operacions.

## 2) Identitat del producte

### 2.1 Nom i context

- Nom de producte: **Summa Reu**
- Domini canònic: `summareu.app`
- Repositori de treball: `summa-reu` (anteriorment `summa-board`)

### 2.2 Posicionament

Summa Reu és una plataforma per a entitats socials per concentrar en un únic sistema:

- convocatòria de reunió,
- recollida de disponibilitats,
- tancament de data,
- espai de reunió,
- transcripció,
- generació i edició d’actes.

Flux de posicionament objectiu:

`convocatòria -> votació -> reunió -> gravació -> transcripció -> acta`

### 2.3 Principi de producte

Summa Reu no és:

- una eina de videoconferència generalista,
- un ERP/CRM complet per entitats,
- un editor col·laboratiu en temps real.

Summa Reu és:

- un sistema operatiu lleuger per preparar reunions i publicar actes amb poc esforç manual.

## 3) Problema que resol

Les entitats socials acostumen a operar amb eines fragmentades:

- correu i missatgeria per convocar,
- Doodle o equivalents per votar,
- Zoom/Meet per reunir-se,
- documents separats per redactar actes.

Això provoca:

- pèrdua de temps per coordinar,
- baixa traçabilitat,
- actes tardanes o incompletes,
- poca continuïtat entre convocatòria, reunió i document final.

## 4) Proposta de valor

Summa Reu permet:

1. Crear una votació amb franges candidates.
2. Compartir un enllaç públic perquè els participants indiquin disponibilitat.
3. Consultar resultats i tancar la millor opció.
4. Crear automàticament la reunió associada.
5. Pujar una gravació o text base.
6. Generar transcripció i esborrany d’acta.
7. Editar i exportar el resultat final.

Punts clau de valor actual:

- experiència simple per a participants sense compte,
- aïllament de dades per entitat,
- pipeline resilient per a transcripció i actes,
- arquitectura prou sòlida per operar pilots reals.

## 5) Objectius de negoci i producte

### 5.1 Objectius principals

- Reduir el temps de tancament d’una reunió.
- Augmentar el percentatge de reunions amb acta final publicada.
- Donar traçabilitat de decisions i tasques.
- Oferir una experiència robusta per equips no tècnics.

### 5.2 KPI orientatius

- Temps mitjà per tancar una votació.
- % de votacions tancades que acaben en reunió creada.
- % de reunions amb acta exportada.
- Temps mitjà entre reunió i acta publicada.
- Incidències crítiques per setmana.

### 5.3 No-objectius actuals

- ERP/CRM complet.
- Multi-tenant amb rols interns avançats.
- Videoconferència pròpia.
- Edició col·laborativa tipus Google Docs.

## 6) Estat del producte (01/04/2026)

### 6.1 Fase global

- **Producte desplegat a producció, obert al públic, amb CI/CD automàtic funcionant**.
- Onboarding públic amb subscripció Stripe operativa.
- Pipeline complet: votació → reunió Daily → gravació → transcripció → acta.

### 6.2 Implementat actualment

- Home pública de producte amb CTA d'accés i alta.
- Localització català/castellà amb routing localitzat i fallback controlat.
- Login owner amb sessió server via cookie `__session` (24h, httpOnly, secure, sameSite strict).
- Logout amb revocació de tokens.
- Alta d'entitat pública amb creació d'org (anti-enumeració de comptes).
- Pantalla `/billing` i checkout Stripe de subscripció.
- Webhook Stripe amb activació de subscripció i auditoria a `stripe_events`.
- Guard global de subscripció a UI i `api/owner/*`.
- Dashboard owner amb llistat de votacions ("Resultats" com a acció principal).
- Creació de votacions amb selector assistit de franges.
- Votació pública sense registre.
- Resultats públics amb matriu de vots (qui ha votat què) i rànquing.
- Còpia d'enllaç públic de votació.
- Tancament de votació i creació automàtica de reunió (amb retry manual si falla).
- Control d'inici/aturada de gravació a reunions Daily.
- Pujada manual d'àudio/vídeo o text base.
- Processament asíncron de gravació amb transcripció i acta.
- Edició i export d'acta en Markdown.
- Eliminació de reunions amb esborrat en cascada de subcol·leccions, jobs i fitxers associats.
- Export d'ICS de reunió.
- Notificació per email a l'owner quan es rep un vot (via Resend).
- Pàgina 404 bilingüe amb marca.
- Monitorització d'errors server/client amb alertes Telegram.
- CI amb lint + smoke sobre emuladors Firebase.
- Deploy automàtic via Firebase App Hosting (push a main → build → deploy).

### 6.3 Seguretat aplicada (abril 2026)

- CSP amb `script-src 'self'` (sense `unsafe-inline`).
- Cookie de sessió reduït de 5 dies a 24 hores.
- Anti-enumeració: `/api/auth/entity-signup` retorna 200 OK per emails duplicats.
- Rate limiting a votació (40/10min per IP per enquesta) i signup (10/10min per IP).
- Secrets a Google Cloud Secret Manager amb accés IAM concedit al backend.

### 6.4 En desenvolupament / roadmap immediat

- Grace period de billing (7-14 dies quan un pagament falla).
- Metadades Open Graph per compartir a xarxes.
- Actes multilingüe (ara només en català).
- Gestió de compte (canvi email/contrasenya, eliminació).
- Notificacions email addicionals (creació enquesta, tancament).

## 7) Usuaris principals

### 7.1 Owner d’entitat

- Perfil: presidència, coordinació, secretaria.
- Necessitat: convocar, tancar votacions, gestionar la reunió i validar actes.

### 7.2 Participant públic

- Perfil: membre, voluntari, col·laborador.
- Necessitat: votar disponibilitat ràpidament i sense compte.

### 7.3 Visitant comercial

- Perfil: entitat encara no registrada.
- Necessitat: entendre la proposta de valor i iniciar l’alta.

### 7.4 Operador tècnic

- Perfil: enginyeria/operació.
- Necessitat: observabilitat, seguretat i desplegaments segurs.

## 8) Principis de producte i UX

### 8.1 Principis

- Simplicitat operativa.
- Baixa càrrega cognitiva.
- Mobile-first útil.
- Feedback immediat en accions i errors.
- Consistència entre estat públic i estat owner.
- Localització pragmàtica: català per defecte, castellà quan hi ha cobertura suficient.

### 8.2 UI actual

- Stack UI: Next App Router + Tailwind v4.
- Estètica: base clara `slate` amb accent `sky`.
- Components base: `Button`, `Card`, `Badge`, `Table`, `Field`.
- Tipografia: `Inter`.
- Idiomes disponibles: `ca`, `es`.

### 8.3 Criteris a mantenir

- Accions irreversibles clares, especialment `tancar votació` i `eliminar reunió`.
- Errors curts i accionables.
- Estats coherents: `open`, `closed`, `uploaded`, `processing`, `done`, `error`.
- Evitar bucles de routing o pèrdua de context de locale.

## 9) Flux principal del producte

### 9.1 Flux actual implementat

1. Usuari arriba a `/` i entén la proposta de valor.
2. Owner inicia sessió a `/login`.
3. Crea votació a `/polls/new`.
4. Comparteix enllaç públic `/p/{slug}`.
5. Participants voten i poden consultar resultats.
6. Owner revisa resultats i tanca la votació.
7. El sistema crea una reunió amb `meetingUrl` Daily.
8. Owner entra a la reunió des de Summa.
9. Owner inicia i atura la gravació des de Summa.
10. Daily envia webhook de gravació completada.
11. El sistema crea `meeting_ingest_job` idempotent i processa transcripció + esborrany d’acta.
12. Owner revisa transcripció, edita acta i exporta.
13. Si cal, owner elimina la reunió amb neteja en cascada i redirecció segura.

### 9.2 Flux objectiu immediat

1. Crear votació.
2. Compartir enllaç públic.
3. Recollir disponibilitat.
4. Tancar opció guanyadora.
5. Entrar a reunió dins plataforma o integrada.
6. Obtenir gravació automàtica.
7. Generar transcripció i acta sense intervenció manual.
8. Revisar, publicar i exportar.

## 10) Funcionalitats principals

### 10.1 Accés i identitat

- Login owner via formulari server-side a `POST /api/auth/password-login`: **Implementat**.
- Sessió server via `POST /api/auth/session-login`: **Implementat**.
- Logout amb revocació de tokens a `POST /api/auth/session-logout`: **Implementat**.
- Alta d’entitat via `POST /api/auth/entity-signup`: **Implementat**.
- Exposició pública completa del signup autoservei: **Parcial**.

### 10.2 Home pública i captació

- Landing pública amb CTA d’accés i alta: **Implementat**.
- Pàgina `/signup` amb missatge comercial i estat del pla: **Implementat**.
- Activació de subscripció via `/billing` i Stripe Checkout: **Implementat**.

### 10.3 Votacions

- Crear votació amb màxim 20 franges: **Implementat**.
- Selector assistit de franges amb finestres ràpides i 5/7/10 dies: **Implementat**.
- Enllaç públic per votar: **Implementat**.
- Persistència de votant via token al navegador i hash al servidor: **Implementat**.
- Resultats públics: **Implementat**.
- Resultats owner en dashboard i pàgina de gestió: **Implementat**.
- Còpia d’enllaç públic: **Implementat**.
- Tancament manual de votació i creació de reunió: **Implementat**.

### 10.4 Reunions

Quan es tanca una votació:

- es crea el document de reunió,
- es crea una room Daily,
- es mostra una pantalla específica de reunió a `/owner/meetings/{meetingId}`,
- s’habiliten entrada a reunió, control de gravació, transcripció i acta.

Capacitats actuals:

- entrada a reunió des de Summa amb `iframe` si el proveïdor ho permet i fallback a pestanya nova,
- inici i aturada de gravació des de Summa via API owner,
- webhook Daily per tancar gravació i llançar ingestió,
- `meeting_ingest_job` idempotent per cada `meetingId + recordingId`,
- refresc automàtic de la pantalla mentre hi ha processament,
- eliminació de reunió amb esborrat de `recordings`, `transcripts`, `minutes`, `meeting_ingest_jobs` i prefix de Storage `meetings/{meetingId}/`,
- export d’ICS,
- export d’acta en `.md`.

Capacitats encara no implementades o pendents d’enduriment:

- ingestió real de fitxers grans fora del límit inline actual de Gemini,
- proves E2E contra Daily real fora de l’entorn mock controlat de smoke.

### 10.5 Pipeline d’acta

Flux actual de reunió premium:

`close poll -> create meeting + room -> start recording -> stop recording -> daily webhook -> meeting_ingest_job -> transcript -> minutesDraft -> edició -> export`

Sortida persistent:

- `meetings/{meetingId}.recordingStatus`
- `meetings/{meetingId}.recordingUrl`
- `meetings/{meetingId}.transcript`
- `meetings/{meetingId}.minutesDraft`
- `meeting_ingest_jobs/{jobId}`
- `meetings/{meetingId}/transcripts/{recordingId}`
- `meetings/{meetingId}/minutes/{recordingId}`

Contractes d’estat nous:

- `meeting.recordingStatus`: `none -> recording -> processing -> ready | error`
- `meeting_ingest_job.status`: `queued -> processing -> completed | error`

Modes de generació:

- `real` si hi ha `GEMINI_API_KEY` i la gravació es pot ingerir,
- `mock` només en smoke controlat via `MEETING_INGEST_MOCK_MODE=true`,
- `error` si la ingestió real no és possible; no hi ha `stub` silenciós en el flux premium.

### 10.6 Localització i routing

- Idiomes: `ca` i `es`.
- Cookie de preferència: `summa-locale`.
- En producció, les rutes es serveixen amb prefix localitzat (`/ca/...`, `/es/...`).
- En local, es mantenen URLs estables sense prefix i el locale viatja per header/cookie.
- Hi ha regles de “no fallback” per evitar mostrar castellà incomplet en rutes crítiques.

### 10.7 Monitorització i incidències

- Captura d’errors server via `instrumentation.ts`: **Implementat**.
- Captura d’errors client via `ErrorMonitor` + `/api/public/error-report`: **Implementat**.
- Alertes Telegram amb deduplicació temporal: **Implementat**.

## 11) Arquitectura funcional del sistema

### 11.1 Rutes de producte

Públiques:

- `/`
- `/login`
- `/signup`
- `/p/[slug]`
- `/p/[slug]/results`

Owner:

- `/dashboard`
- `/polls/new`
- `/polls/[pollId]`
- `/owner/meetings/[meetingId]`
- `/meetings/[meetingId]` (redirect localitzat)

Notes de locale:

- en producció es presenten com `/ca/...` o `/es/...`,
- internament App Router treballa sobre les rutes sense prefix.

### 11.2 Regla de transició principal

- En tancar una votació: `poll -> meeting`.

### 11.3 BFF intern

El backend funcional principal resideix dins de Next API routes:

- auth,
- operacions owner,
- operacions públiques,
- export i monitorització.

## 12) Arquitectura tècnica

### 12.1 Stack tècnic

- Frontend/BFF: Next.js 15 + React 19 + TypeScript.
- Dades: Firestore.
- Fitxers: Firebase Storage.
- Identitat: Firebase Auth.
- Deploy: Firebase App Hosting (Cloud Run, europe-west4, deploy automàtic des de `main`).
- Videoconferència: Daily.co (rooms, gravació, webhooks).
- IA: Gemini (transcripció + actes); falla explícitament si no hi ha API key.
- Email: Resend (`your-meeting@summareu.app`).
- Pagaments: Stripe (subscripció per entitat).
- Observabilitat: Telegram Bot API.
- CI: GitHub Actions (lint + smoke amb emuladors Firebase).

### 12.2 Arquitectura real de reunions avui

Summa Reu no incorpora tecnologia de videoconferència pròpia, però **sí integra Daily** per crear rooms, obrir la reunió, controlar gravació i processar la sortida via webhook.

L’arquitectura de reunió actual és:

- document de reunió a Firestore,
- room Daily associada al `meetingId`,
- reunió accessible dins Summa via `iframe` o en pestanya nova,
- gravació Daily controlada des de la UI owner,
- pujada manual de gravació/text base com a camí alternatiu,
- processament llançat des d’un endpoint HTTP o via webhook de Daily,
- persistència de transcript i acta en subcol·leccions,
- UI de reunió que es refresca mentre hi ha estat `processing`.

La capa pròpia de videoconferència continua sent **roadmap**, però la integració amb Daily sí és estat implementat.

### 12.3 Estructura del codi

- `app/`: pàgines i API routes.
- `src/components/`: UI i formularis.
- `src/lib/`: domini, dades, Firebase, seguretat, IA, monitorització.
- `src/i18n/`: catàlegs, routing i cobertura de localització.
- `functions/`: codebase separat, avui sense lògica funcional rellevant.
- `scripts/`: bootstrap, smoke, seed, monitor i utilitats operatives.
- `.github/workflows/`: CI, deploy manual i mirror.

### 12.4 Patrons arquitectònics

- BFF simple dins Next.
- Domini concentrat a `src/lib/db/repo.ts`.
- Validació d’entrada amb `zod`.
- Autorització server-side per a totes les operacions owner.
- Middleware per locale, cookies i redirecció canònica.
- Metadata pública localitzada per SEO.

## 13) Model de dades

### 13.1 Entitats principals

- `orgs/{orgId}`
- `polls/{pollId}`
- `polls/{pollId}/options/{optionId}`
- `polls/{pollId}/voters/{voterId}`
- `polls/{pollId}/votes/{voterId}`
- `meetings/{meetingId}`
- `meetings/{meetingId}/recordings/{recordingId}`
- `meetings/{meetingId}/transcripts/{transcriptId}`
- `meetings/{meetingId}/minutes/{minutesId}`
- `_rate_limits/{hash}`

### 13.2 Camps clau

- `orgs`: `name`, `ownerUid`, `createdAt`
- `polls`: `orgId`, `title`, `description`, `timezone`, `slug`, `status`, `winningOptionId`, `createdAt`, `closedAt`
- `meetings`: `pollId`, `orgId`, `scheduledAt`, `createdAt`
- `recordings`: `storagePath`, `rawText`, `mimeType`, `originalName`, `status`, `error`, `createdAt`
- `transcripts`: `recordingId`, `status`, `text`, `storagePathTxt`, `createdAt`
- `minutes`: `recordingId`, `status`, `minutesMarkdown`, `minutesJson`, `createdAt`

### 13.3 Estats

- Poll: `open | closing | closed | close_failed`
- Meeting provisioning: `provisioning | usable | provisioning_failed`
- Meeting recording: `none | recording | stopping | processing | ready | error`
- Meeting recovery: `retry_pending | retry_running | retry_failed`
- Meeting ingest job: `queued | processing | completed | error`
- Recording: `uploaded | processing | done | error`
- Transcript: `pending | processing | done | error`
- Tasques dins `minutesJson`: `todo | doing | done`

### 13.4 Regles clau

- `orgId` canònic = `ownerUid`, mantenint compatibilitat amb orgs legacy.
- El token de votant raw només viu al client.
- El servidor només persisteix el hash del token.
- L’acta es desa en JSON estructurat i Markdown editable.

## 14) API de negoci

### 14.1 Auth

- `POST /api/auth/entity-signup`
- `POST /api/auth/password-login`
- `POST /api/auth/session-login`
- `POST /api/auth/session-logout`

### 14.2 Owner

- `POST /api/owner/polls/create`
- `POST /api/owner/close-poll`
- `POST /api/owner/recordings/register`
- `POST /api/owner/process-recording`
- `POST /api/owner/meetings/start-recording`
- `POST /api/owner/meetings/stop-recording`
- `POST /api/owner/meetings/delete`
- `POST /api/owner/minutes/update`
- `GET /api/owner/minutes/export?meetingId=...`

### 14.3 Públic

- `POST /api/public/vote` (dispara email notificació a l'owner via Resend)
- `GET /api/public/ics?meetingId=...` requereix sessió owner
- `POST /api/public/error-report`

### 14.4 Webhooks

- `POST /api/webhooks/daily/recording-complete` (validat amb Bearer token)
- `POST /api/webhooks/stripe` (validat amb signature Stripe)

## 15) IA i qualitat de contingut

### 15.1 Modes

- Sense `GEMINI_API_KEY`: `error` al flux premium
- Amb `GEMINI_API_KEY`: `real`
- Smoke controlat: `mock`
- Si falla transcripció o generació al flux premium: `error`

### 15.2 Contracte d’acta

L’acta estructurada inclou:

- `language`
- `summary`
- `attendees`
- `agenda`
- `decisions`
- `tasks`

La validació és estricta amb `zod` i després es renderitza a Markdown homogeni.

### 15.3 Criteri rector

- `robustesa > qualitat IA`
- El flux de negoci no pot quedar bloquejat per error del model.

## 16) Seguretat i privacitat

### 16.1 Control d’accés

- Sessió server via cookie `__session` `httpOnly`.
- Guard owner a pàgines i endpoints.
- Firestore i Storage rules modelades per owner/org.

### 16.2 Proteccions aplicades

- Validació d'entrada amb `zod`.
- Same-origin check per mutacions.
- Rate limit server-side amb fallback a memòria.
- CSP: `script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`.
- Headers: HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, COOP same-origin, CORP same-site.
- Anti-enumeració de comptes (signup retorna 200 genèric per emails existents).
- Sessió cookie 24h, httpOnly, secure, sameSite strict.
- Idle timeout 30 minuts amb logout automàtic.
- Redirecció host canònic cap a `summareu.app`.
- Secrets a Google Cloud Secret Manager (mai en codi ni env files a producció).

### 16.3 Riscos coneguts

- Processament asíncron encara dins el context d'una crida HTTP.
- Deduplicació Telegram mantinguda en memòria de procés, no global.
- Col·lecció `_rate_limits` sense neteja automàtica explícita.
- Webhooks Stripe sense idempotència per `event.id` (pot processar duplicats).

## 17) Operació, monitorització i alertes

### 17.1 Monitorització

- Errors server i API reportats a Telegram.
- Errors client reportats a backend i reenviats a Telegram.
- Dedupe temporal per reduir soroll.

### 17.2 Runbooks actuals

- `npm run test:permissions`
- `npm run test:telegram`
- `npm run ci:smoke`
- `npm run monitor:login`
- `npm run i18n:check-es`

## 18) Entorns i configuració

### 18.1 Variables clau

- Firebase client: `NEXT_PUBLIC_FIREBASE_*`
- Firebase server: `FIREBASE_*`
- Daily: `DAILY_API_KEY`, `DAILY_API_BASE_URL`, `DAILY_DOMAIN`, `DAILY_WEBHOOK_BEARER_TOKEN`
- Mocks controlats: `DAILY_MOCK_MODE`, `MEETING_INGEST_MOCK_MODE`
- IA: `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_BASE_URL`
- Pagaments: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`
- Email: `RESEND_API_KEY`
- Canònic: `CANONICAL_HOST`, `FORCE_CANONICAL_REDIRECT`
- Alertes: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_ALERTS_ENABLED`

### 18.2 Secrets a producció (apphosting.yaml)

Tots via Google Cloud Secret Manager amb IAM concedit al backend:

- `DAILY_API_KEY`
- `DAILY_WEBHOOK_BEARER_TOKEN`
- `GEMINI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `RESEND_API_KEY`

### 18.2 Entorn local recomanat

1. `npm run bootstrap:firebase`
2. `npm run emu`
3. `npm run seed`
4. `npm run test:smoke`

## 19) CI/CD i desplegament

### 19.1 Pipeline

- **CI** (`.github/workflows/ci.yml`): `lint` + smoke sobre emuladors Firebase (auth, firestore, storage).
- **Deploy automàtic**: Firebase App Hosting detecta push a `main`, fa build (Cloud Build, europe-west4) i desplega a Cloud Run.
- **Deploy manual d'emergència** (`.github/workflows/deploy.yml`): revalida i desplega hosting manualment.
- **Prod Mirror Sync** (`.github/workflows/prod-mirror-sync.yml`): mirror unidireccional segur cap a branca mirror.

### 19.2 Infraestructura de deploy

- Backend: Firebase App Hosting → Cloud Run (europe-west4).
- URL pública: `https://summareu.app` (domini custom) / `https://summa-board--summa-board.europe-west4.hosted.app` (Firebase).
- Repo vinculat: `raulvico1975/summa-reu` via Developer Connect.
- Builds: Google Cloud Build, ~2-3 min per deploy.

### 19.3 Política

- Push a `main` → CI + deploy automàtic.
- Checks requerits: `lint` i smoke.
- Deploy d'emergència amb `firebase apphosting:rollouts:create` si el trigger automàtic falla.

## 20) Model de producte

Summa Reu s’orienta a subscripció per entitat.

### 20.1 Capacitat base avui

- votacions,
- tancament de data,
- reunió com a espai de seguiment,
- pujades manuals,
- transcripció i acta amb suport IA,
- edició i export.

### 20.2 Capacitat premium/objectiu

- reunió dins plataforma o integrada,
- gravació automàtica,
- pipeline complet sense intervenció manual,
- packaging comercial i cobrament tancats.

## 21) Roadmap viu

### 21.1 Curt termini

- Grace period de billing (7-14 dies amb avís a l'owner).
- Idempotència de webhooks Stripe (guardar `event.id` per evitar duplicats).
- Metadades Open Graph (`og:image`, `og:url`) per compartir a WhatsApp/Telegram.
- Actes multilingüe (ara el prompt Gemini genera sempre en català).
- Notificacions email addicionals (creació enquesta, tancament, nova reunió).

### 21.2 Mig termini

- Gestió de compte (canvi email/contrasenya, eliminació — GDPR).
- Exportació de resultats de votació (CSV/PDF).
- Paginació de votacions i resultats (>100 votants).
- Política de retenció de dades (cleanup automàtic de reunions antigues).
- Millora de qualitat d'actes.
- Analytics de producte.
- Rols interns addicionals per entitat.

## 22) Estat de qualitat actual

Execucions verificades avui, **1 d'abril de 2026**:

- `npm run lint` -> **OK**
- `npm run i18n:check-es` -> **OK**
- `npm run build` -> **OK**
- `npm run ci:smoke` -> **OK**
- CI GitHub Actions -> **5 runs consecutius OK**
- Firebase App Hosting deploy -> **3 builds consecutius SUCCESS**

El smoke cobreix com a mínim:

- home pública,
- login owner,
- vot públic (primer vot + segon usuari + re-vot amb manteniment de `voterId`),
- protecció d'ICS sense sessió,
- sessió owner vàlida amb accés a dashboard,
- tancament de votació i creació de reunió amb room Daily (mock),
- inici i aturada de gravació,
- webhook Daily de gravació completada (amb detecció de duplicats),
- processament de transcripció i acta (mock),
- alta d'entitat via API,
- aïllament multi-entitat (owner B no veu dades d'owner A),
- logout i revocació de sessió.

## 23) Decisions tècniques vigents

- El backend funcional principal viu a Next API routes.
- Firestore és la font principal de veritat.
- L’estratègia IA és resilient: millor resultat possible sense bloquejar operativa.
- Els vots públics no escriuen directament a Firestore des del client.
- La localització s’aplica a nivell de middleware i no amb estructura duplicada de rutes.
- La capa de reunió en directe encara no condiciona l’arquitectura actual perquè no està integrada.

## 24) Definition of Done per canvis

Un canvi es considera complet quan:

- resol el flux funcional objectiu,
- no introdueix regressió al flux principal,
- manté seguretat i aïllament de dades,
- incorpora validació mínima adequada,
- actualitza aquest document si canvia comportament, arquitectura o operació.

## 25) Govern del document

Aquest fitxer és persistent i evolutiu.

Norma d’actualització:

1. Actualitzar la secció afectada.
2. Afegir entrada al registre de canvis.
3. Si canvia negoci o operació, revisar també objectius, riscos, runbooks i roadmap.

## 26) Registre de canvis del document

### 2026-04-01

- Actualitzada la data base del document a 1 d'abril de 2026.
- Repositori renombrat de `summa-board` a `summa-reu`.
- Documentat Firebase App Hosting amb deploy automàtic (Cloud Run, europe-west4).
- Documentada la integració Resend per notificacions email de vots.
- Documentada la integració Stripe (billing, webhooks) a la secció d'API.
- Actualitzats els estats de dades: polls (closing, close_failed), meetings (provisioning, recovery).
- Documentada la seguretat aplicada: CSP sense unsafe-inline, sessió 24h, anti-enumeració, pàgina 404.
- Documentats tots els secrets de producció a `apphosting.yaml` via Secret Manager.
- Actualitzat el smoke test: ara cobreix tancament votació, gravació, webhook, transcripció, acta, aïllament multi-entitat.
- Actualitzat el roadmap amb prioritats reals post-llançament.
- Afegida la matriu de vots (qui ha votat què) a la pàgina pública de resultats.
- Dashboard: "Resultats" com a botó principal per a votacions actives.

### 2026-03-09

- Actualitzada la data base del document a 9 de març de 2026.
- Documentats els commits recents de reunions `043f33ca`, `5ee58d95`, `56af8ae9` i `76516339`.
- Afegida la capacitat d’eliminar reunions amb esborrat en cascada de subcol·leccions, jobs i fitxers associats.
- Corregides les rutes owner de reunió i els endpoints reals de control de gravació/eliminació.

### 2026-03-08

- Actualitzada la data base del document a 8 de març de 2026.
- Corregit l’estat real d’onboarding: signup públic + billing Stripe operatius a producció.
- Actualitzat el flux de reunions: Summa crea room Daily, controla gravació i processa transcripció/acta via webhook + `meeting_ingest_job`.
- Documentat el contracte del flux premium: `recordingStatus` (`none -> recording -> processing -> ready|error`) i ingestió idempotent per `meetingId + recordingId`.
- Afegides les novetats de localització `ca/es`, routing per locale i control de fallback.
- Incorporada la home pública i el flux comercial actual.
- Afegides les rutes i endpoints d’autenticació reals, incloent `password-login`.
- Documentada la resolució del blocker de build antiga amb el commit `151c9473`.
- Afegida evidència de validació real amb l’org `FnNsMxFscHfOyt2oxhTPi3uUQD22`, `subscriptionStatus = active`, `stripeSubscriptionId = sub_1T8hIy1w5oTdm9u8IBZeBPjW` i `stripe_events/evt_1T8hJ81w5oTdm9u8pvhPgF6r`.
- Ajustats riscos, roadmap i decisions tècniques a l’estat real del codi.
- Actualitzada l’evidència de qualitat amb `lint`, `i18n:check-es`, `build` i `ci:smoke` executats avui.

## Annex C - Checklist postobertura

- Revisar noves `orgs/*` creades a Firestore
- Revisar `subscriptionStatus` i detectar `pending` anòmals
- Revisar `stripe_events` i confirmar `checkout.session.completed`
- Revisar logs SSR i webhook Stripe
- Revisar alertes Telegram de `past_due`, `canceled` o errors inesperats

### 2026-03-05

- Creat `SUMMA-REU-REFERENCIA-COMPLETA.md` com a referència única de producte + tecnologia.
- Integrat estat inicial del projecte, arquitectura, seguretat, operació i roadmap viu.

---

## Annex A - Mapa ràpid de fitxers clau

- Producte/UI: `app/`, `src/components/`, `src/i18n/`
- Dades: `src/lib/db/repo.ts`, `src/lib/db/types.ts`
- Firebase/Auth: `src/lib/firebase/*`
- Seguretat: `src/lib/security.ts`, `src/lib/security/request.ts`, `firestore.rules`, `storage.rules`, `middleware.ts`, `next.config.ts`
- IA i actes: `src/lib/gemini/*`, `src/lib/minutes/*`, `src/lib/meetings/process-recording-task.ts`
- Integracions: `src/lib/integrations/daily/`, `src/lib/notifications/vote-email.ts`
- Monitorització: `instrumentation.ts`, `src/lib/monitoring/*`, `app/api/public/error-report/route.ts`
- Billing: `src/lib/env.ts` (Stripe config), `app/api/webhooks/stripe/route.ts`
- DevOps: `scripts/*`, `.github/workflows/*`, `firebase.json`, `apphosting.yaml`

## Annex B - Principi de manteniment

Si hi ha conflicte entre codi i document, **preval el codi** temporalment i aquest document s’ha d’actualitzar dins el mateix cicle de treball.
