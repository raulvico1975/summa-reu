# SUMMA REU - REFERÈNCIA COMPLETA

> Document viu de referència de producte i tecnologia de Summa Reu.
> Data de base: **5 de març de 2026** (`Europe/Madrid`).
> Abast: inclou estat implementat i funcionalitats de posicionament en desenvolupament immediat.

## 1) Propòsit del document

Aquest document és la **font de veritat** de Summa Reu i serveix per:

- entendre el producte de cap a peus,
- prendre decisions amb context compartit,
- mantenir alineats producte, disseny, enginyeria i operacions,
- accelerar onboarding i execució sense dependència de context oral.

## 2) Identitat del producte

### 2.1 Nom i context

- Nom de producte: **Summa Reu**
- Domini canònic: `summareu.app`
- Context de codi/repo: `summa-board`

### 2.2 Posicionament

Summa Reu és una plataforma per a entitats socials per coordinar reunions, realitzar-les i generar actes dins un sol sistema.

Flux de posicionament del producte:

`convocatòria -> votació -> reunió dins plataforma -> gravació automàtica -> transcripció -> acta`

### 2.3 Principi de producte

Summa Reu no és:

- una eina de videoconferència,
- un ERP/CRM complet d'entitats.

Summa Reu és:

- un sistema per gestionar reunions i actes amb el mínim esforç operatiu possible.

## 3) Problema que resol

Les entitats socials gestionen reunions amb eines disperses:

- missatgeria,
- correu,
- Doodle,
- Zoom/Meet,
- documents d'acta separats.

Aquesta fragmentació provoca:

- coordinació lenta,
- baixa traçabilitat,
- actes incompletes,
- tasques no registrades.

## 4) Proposta de valor

Summa Reu permet a una entitat:

1. Proposar dates per a una reunió.
2. Recollir disponibilitat dels participants.
3. Tancar la data guanyadora.
4. Crear i gestionar la reunió.
5. Gestionar gravació i transcripció.
6. Generar una acta estructurada editable.

Punts clau de valor:

- Votació pública simple per trobar franja guanyadora.
- Tancament de convocatòria i creació de reunió en el mateix sistema.
- Pipeline d'acta resilient amb transcripció + esborrany estructurat.
- Control per entitat amb aïllament de dades.

## 5) Objectius de negoci i producte

### 5.1 Objectius principals

- Reduir el temps de coordinació de reunions.
- Augmentar el percentatge de reunions amb acta publicada.
- Millorar la traçabilitat de decisions i tasques.
- Oferir experiència robusta per organitzacions no tècniques.

### 5.2 KPI orientatius

- Temps mitjà per tancar una votació.
- % votacions tancades que acaben en reunió creada.
- % reunions amb acta generada/exportada.
- Temps mitjà de publicació d'acta després de reunió.
- Incidències crítiques per setmana (server/client/API).

### 5.3 No-objectius actuals (fora d'abast MVP)

- ERP/CRM complet d'entitats.
- Multi-tenant avançat amb rols interns complexos.
- Edició col·laborativa en temps real tipus Google Docs.
- Tecnologia de videoconferència propietària.
- Integració de passarel·les de pagament plenament operativa a UI (pendent).

## 6) Estat del producte (05/03/2026)

### 6.1 Fase global

- **MVP funcional amb extensió en desenvolupament**.
- Preparat per ús pilot/controlat amb operació tècnica present.

### 6.2 Implementat actualment

- Gestió d'entitats (login/logout + signup via API).
- Creació de votacions (fins a 20 franges).
- Votació pública sense registre.
- Tancament de votació i creació de reunió.
- Pujada manual de gravació o text base.
- Pipeline de transcripció i generació d'acta.
- Edició i export d'acta (`.md`, `ICS`).
- Monitorització d'errors amb Telegram.
- CI amb smoke sobre emuladors.

### 6.3 En desenvolupament (roadmap immediat)

- Reunió en directe dins la plataforma.
- Integració amb proveïdor extern de videoconferència.
- Gravació automàtica de reunions.
- Pipeline automàtic `gravació -> transcripció -> acta`.
- Tancament del flux d'alta comercial/pagament a UI (`/signup`).

## 7) Usuaris principals

### 7.1 Owner d'entitat (usuari principal)

- Perfil: presidència, coordinació o secretaria.
- Necessitat: convocar reunions, tancar votacions, validar actes i mantenir control del procés.

### 7.2 Participant de votació (usuari públic)

- Perfil: membre, voluntari o col·laborador.
- Necessitat: indicar disponibilitat ràpidament i sense crear compte.

### 7.3 Operador tècnic (intern)

- Perfil: enginyeria/operació.
- Necessitat: estabilitat, observabilitat i desplegaments segurs.

## Principis de disseny de producte i UX

### Principis

- Simplicitat operativa: fluxos curts i directes.
- Baixa càrrega cognitiva: llenguatge clar i passos explicats.
- Mobile-first útil (formularis, taules adaptades, botons grans).
- Feedback immediat (estat de procés, missatges d'error i èxit).

### UI actual

- Stack UI: Next App Router + Tailwind v4.
- Estètica: base clara (`slate`) amb accent `sky`.
- Components base: `Button`, `Card`, `Badge`, `Table`, `Field`.
- Idiomes: català (`ca`) i castellà (`es`), default `ca`.

### Criteris a mantenir

- Evitar ambigüitat en accions irreversibles (`tancar votació`).
- Missatges d'error accionables i curts.
- Consistència d'estats i etiquetes (`open/closed/processing/done/error`).

## 8) Flux principal del producte

### 8.1 Flux actual implementat

1. Owner entra a `/login`.
2. Crea votació a `/polls/new`.
3. Comparteix enllaç públic `/p/{slug}`.
4. Participants voten.
5. Owner revisa resultats i tanca votació.
6. Sistema crea reunió i habilita espai d'acta.
7. Owner puja gravació o text base.
8. Sistema processa i genera transcripció + acta.
9. Owner edita i exporta.

### 8.2 Flux objectiu immediat (roadmap)

1. Crear votació.
2. Compartir enllaç públic.
3. Participants voten.
4. Tancar votació.
5. Crear reunió.
6. Realitzar reunió dins plataforma.
7. Gravació automàtica.
8. Transcripció automàtica.
9. Generació d'acta.
10. Edició i export.

## 9) Funcionalitats principals

### 9.1 Gestió d'accés entitat

- Login entitat (Firebase Auth + sessió server `__session`): **Implementat**.
- Logout amb revocació de tokens: **Implementat**.
- Alta d'entitat via API (`/api/auth/entity-signup`): **Implementat**.
- Alta d'entitat exposada completament a UI: **Parcial**.

### 9.2 Votacions

- Crear votació amb màxim 20 franges: **Implementat**.
- Enllaç públic per votar (`/p/[slug]`): **Implementat**.
- Vot sense registre: **Implementat**.
- Persistència de votant via token al navegador + hash al servidor: **Implementat**.
- Resultats públics i per owner: **Implementat**.
- Tancament manual de votació i selecció d'opció guanyadora: **Implementat**.

### 9.3 Reunions

Quan es crea una reunió, el sistema habilita:

- espai d'acta,
- gestió de gravacions,
- transcripció,
- historial.

Model operatiu objectiu:

- reunió dins plataforma,
- gravació automàtica,
- processament sense intervenció manual.

### 9.4 Pipeline d'acta

Flux:

`gravació -> transcripció -> generació d'acta -> edició -> export`

Sortida persistida:

- `minutesJson` (JSON estructurat)
- `minutesMarkdown` (Markdown editable)

### 9.5 Monitorització i incidències

- Captura d'errors server (`instrumentation.ts`): **Implementat**.
- Captura d'errors client (`ErrorMonitor` -> `/api/public/error-report`): **Implementat**.
- Enviament d'incidències a Telegram amb deduplicació temporal: **Implementat**.

## 10) Arquitectura funcional del sistema

### 10.1 Rutes de producte

Públiques:

- `/`
- `/p/[slug]`
- `/p/[slug]/results`

Owner:

- `/login`
- `/signup`
- `/dashboard`
- `/polls/new`
- `/polls/[pollId]`
- `/meetings/[meetingId]`

### 10.2 Regla de transició principal

- En tancar una votació: `poll -> meeting`.

## 11) Arquitectura tècnica

### 11.1 Stack tècnic

- Frontend/Backend web: Next.js 15 (App Router) + React 19 + TypeScript.
- Dades: Firestore.
- Fitxers: Firebase Storage.
- Identitat: Firebase Auth.
- Deploy: Firebase Hosting amb frameworks backend.
- IA: Gemini API (opcional) + fallback deterministic/stub.

### 11.2 Arquitectura de reunions

Summa Reu no implementa tecnologia de videoconferència pròpia.

El sistema utilitza un proveïdor extern per:

- crear sales,
- gestionar connexions,
- generar gravacions cloud.

Summa Reu controla:

- creació de sala i metadades de reunió,
- govern del flux de reunió,
- pipeline d'acta.

### 11.3 Estructura del codi

- `app/`: pàgines i API routes.
- `src/lib/`: domini i infraestructura (db, auth, gemini, monitoring, security).
- `src/components/`: UI i formularis de negoci.
- `functions/`: codebase separat (actualment esquelet).
- `scripts/`: devops local/CI.
- `.github/workflows/`: automatització CI/CD.

### 11.4 Patró arquitectònic

- BFF simple dins Next (`app/api/*`).
- Lògica de domini concentrada a `src/lib/db/repo.ts`.
- Validació d'entrada amb `zod`.
- Autorització server-side en cada endpoint owner.

## 12) Model de dades

### 12.1 Entitats principals

- `orgs/{orgId}`
- `polls/{pollId}` + `options`, `voters`, `votes`
- `meetings/{meetingId}` + `recordings`, `transcripts`, `minutes`
- `_rate_limits/{hash}`

### 12.2 Estats

- Poll: `open | closed`
- Recording: `uploaded | processing | done | error`
- Transcript: `pending | processing | done | error`
- MinutesTask: `todo | doing | done`

### 12.3 Regles clau

- `orgId` canònic = `ownerUid` (amb backward compatibility a legacy orgs).
- Token de votant: raw al client, hash al servidor.
- Acta guardada en dos formats: `minutesJson` i `minutesMarkdown`.

## 13) API de negoci (resum)

### 13.1 Auth

- `POST /api/auth/entity-signup`
- `POST /api/auth/session-login`
- `POST /api/auth/session-logout`

### 13.2 Owner

- `POST /api/owner/polls/create`
- `POST /api/owner/close-poll`
- `POST /api/owner/recordings/register`
- `POST /api/owner/process-recording`
- `POST /api/owner/minutes/update`
- `GET /api/owner/minutes/export?meetingId=...`

### 13.3 Públic

- `POST /api/public/vote`
- `GET /api/public/ics?meetingId=...` (requereix sessió owner)
- `POST /api/public/error-report`

## 14) IA i qualitat de contingut d'actes

### 14.1 Modes d'operació

- Sense `GEMINI_API_KEY`: mode `stub`.
- Amb `GEMINI_API_KEY`: mode `real` amb fallback a `stub` si falla.

### 14.2 Contracte d'acta

- Esquema JSON estricte validat amb `zod` (`language=ca`, summary, attendees, agenda, decisions, tasks).
- Render a markdown homogeni per edició i export.

### 14.3 Criteri rector

- Prioritat operativa: **robustesa > qualitat IA**.
- El flux no es bloqueja per error del model.

## 15) Seguretat i privacitat

### 15.1 Control d'accés

- Sessió server via cookie `__session` (`httpOnly`, `sameSite=strict`).
- Guard owner a pàgines i endpoints.
- Firestore i Storage rules amb model owner.

### 15.2 Proteccions aplicades

- Validació d'entrada amb `zod`.
- Rate limit server-side amb fallback memòria.
- Check same-origin per mutacions (`POST`).
- CSP + headers de seguretat a totes les rutes.
- Redirecció host canònic (`summareu.app`) per evitar dispersió de domini.

### 15.3 Riscos coneguts a gestionar

- Processament en segon pla dins context HTTP (sense cua dedicada).
- Dedupe de Telegram en memòria de procés (no global entre instàncies).
- Col·lecció `_rate_limits` sense neteja explícita automàtica.

## 16) Operació, monitorització i alertes

### 16.1 Monitorització

- Errors server i API reportats a Telegram.
- Errors runtime de client reportats a backend i reenviats a Telegram.
- Missatges d'incident humanitzats amb impacte i acció recomanada.

### 16.2 Runbooks actuals

- Verificació permisos Firebase: `npm run test:permissions`
- Prova canal Telegram: `npm run test:telegram`
- Smoke e2e sobre emuladors: `npm run ci:smoke`
- Monitor login en loop: `npm run monitor:login`

## 17) Entorns i configuració

### 17.1 Variables clau

- Firebase públic (`NEXT_PUBLIC_*`)
- Firebase server (`FIREBASE_*`)
- Gemini (`GEMINI_*`)
- Hosting canònic (`CANONICAL_HOST`, `FORCE_CANONICAL_REDIRECT`)
- Alertes (`TELEGRAM_*`)

### 17.2 Entorn local recomanat

1. `npm run bootstrap:firebase`
2. `npm run emu`
3. `npm run seed`
4. `npm run test:smoke`

## 18) CI/CD i govern de desplegament

- CI (`.github/workflows/ci.yml`): lint + smoke (obligatori en PR/main).
- Deploy emergència manual (`deploy.yml`): revalida i desplega hosting.
- Mirror de prod (`prod-mirror-sync.yml`): sincronització unidireccional segura a branca mirror.

Política operativa recomanada:

- PR obligatori a `main`.
- Checks requerits (`lint`, `smoke`).
- Aprovar desplegament d'emergència via environment `production`.

## 19) Model de producte

Summa Reu opera amb subscripció per entitat.

### 19.1 Pla base

Inclou:

- votacions,
- convocatòria,
- reunions,
- actes manuals.

### 19.2 Pla premium (direcció de producte)

Inclou:

- reunions dins plataforma,
- gravació automàtica,
- transcripció,
- generació d'acta automàtica.

## 20) Roadmap viu

### 20.1 Curt termini

- Integració de reunions dins plataforma.
- Gravació automàtica.
- Pipeline automàtic de transcripció.
- Definició final de pla premium.
- Connectar definitivament flux d'alta comercial a UI (`/signup`).
- Consolidar política de dades efímeres (`_rate_limits`).
- Endurir processament asíncron amb cua dedicada si es preveu càrrega real.

### 20.2 Mig termini

- Millora de qualitat d'actes (prompts i validacions semàntiques).
- Analytics de producte (KPI operatius).
- Rols interns addicionals per entitat.

## 21) Estat de qualitat actual (verificat avui)

Execucions realitzades el **5 de març de 2026**:

- `npm run lint` -> OK
- `npm run build` -> OK
- `npm run ci:smoke` -> OK

Resultat: base actual **compila i passa smoke funcional** sobre emuladors.

## 22) Decisions tècniques vigents

- El backend funcional principal resideix a Next API routes (no a Cloud Functions custom).
- Firestore és la font principal de veritat de negoci.
- L'estratègia IA és resilient: millor resultat possible sense bloquejar operativa.
- Prioritat de seguretat: evitar escriure directament des de client públic a Firestore per vots.
- Les capacitats de reunió es construeixen sobre proveïdor extern, no sobre stack de videoconferència pròpia.

## 23) Criteris de Definition of Done per canvis

Un canvi es considera complet quan:

- resol objectiu funcional sense regressió de flux principal,
- inclou validació mínima (`lint`, build i/o smoke segons impacte),
- manté seguretat i aïllament de dades,
- actualitza aquest document (si canvia comportament, arquitectura o operació).

## 24) Govern del document

Aquest fitxer és **persistent i evolutiu**.

Norma d'actualització a cada canvi rellevant:

1. Actualitzar la secció afectada.
2. Afegir entrada al registre de canvis.
3. Si canvia comportament de negoci, revisar també objectius, KPI, funcionalitats, riscos i runbooks.

## 25) Registre de canvis del document

### 2026-03-05

- Creat `SUMMA-REU-REFERENCIA-COMPLETA.md` com a referència única de producte + tecnologia.
- Integrat estat real del projecte, arquitectura, seguretat, operació i roadmap viu.
- Fusionades anotacions de posicionament i roadmap (reunió dins plataforma, gravació automàtica, model de subscripció) en una sola versió consolidada.

---

## Annex A - Mapa ràpid de fitxers clau

- Producte/UI: `app/`, `src/components/`, `src/i18n/`
- Domini dades: `src/lib/db/repo.ts`, `src/lib/db/types.ts`
- Auth/Firebase: `src/lib/firebase/*`
- Seguretat: `src/lib/security.ts`, `src/lib/security/request.ts`, `firestore.rules`, `storage.rules`
- IA: `src/lib/gemini/*`, `src/lib/minutes/*`, `src/lib/meetings/process-recording-task.ts`
- Monitorització: `instrumentation.ts`, `src/lib/monitoring/*`, `app/api/public/error-report/route.ts`
- DevOps: `scripts/*`, `.github/workflows/*`, `firebase.json`

## Annex B - Principi de manteniment

Si hi ha conflicte entre codi i document, **preval el codi** temporalment, i el document s'ha d'actualitzar en el mateix cicle de treball.
