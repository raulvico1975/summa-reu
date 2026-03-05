# SUMMA REU - REFERÈNCIA COMPLETA

> Document viu de referència de producte i tecnologia de Summa Reu.
> Data de base: **5 de març de 2026** (`Europe/Madrid`).

## 1) Propòsit del document

Aquest document és la **font de veritat** de Summa Reu i ha de servir per:

- entendre el producte de cap a peus,
- prendre decisions amb context compartit,
- mantenir alineats producte, disseny, enginyeria i operacions,
- accelerar onboarding i execució sense dependència de context oral.

## 2) Identitat del producte

### 2.1 Nom i posicionament

- Nom de producte: **Summa Reu**
- Context de codi/repo: `summa-board`
- Posicionament: plataforma per a entitats socials per **convocar reunions, votar disponibilitat i generar actes** en un únic flux.

### 2.2 Problema que resol

Les entitats gestionen reunions amb fricció:

- coordinació dispersa (missatgeria, fulls, correus),
- tancament lent de data/hora,
- poca traçabilitat de decisions i tasques,
- actes tardanes o incompletes.

### 2.3 Proposta de valor

- Votació pública simple per trobar franja guanyadora.
- Tancament de convocatòria i creació de reunió en el mateix sistema.
- Pipeline d'acta amb transcripció + esborrany estructurat (amb fallback segur).
- Control per entitat (aïllament de dades i gestió privada).

## 3) Objectius de negoci i producte

## 3.1 Objectius principals

- Reduir temps de coordinació de reunions.
- Augmentar percentatge de reunions amb acta publicada.
- Donar traçabilitat operativa (decisions, responsables, tasques).
- Oferir experiència robusta per organitzacions no tècniques.

## 3.2 KPI orientatius

- Temps mitjà per tancar una votació.
- % votacions tancades que acaben en reunió creada.
- % reunions amb acta generada/exportada.
- Temps mitjà de publicació d'acta després de reunió.
- Errors crítics per setmana (server/client/API).

## 3.3 No-objectius actuals (fora d'abast MVP)

- ERP/CRM complet d'entitats.
- Multi-tenant avançat amb rols interns complexos.
- Edició col·laborativa en temps real tipus Google Docs.
- Integració amb passarel·les de pagament en producció (encara pendent a UI).

## 4) Usuaris principals

## 4.1 Persona A - Owner d'entitat (usuari principal)

- Qui és: presidència, coordinació o secretaria.
- Necessitat: crear i tancar votacions, convocar reunions, validar actes.
- Dolor: manca de temps, necessitat de control i claredat.

## 4.2 Persona B - Participant de votació (usuari públic)

- Qui és: membre, voluntari o col·laborador.
- Necessitat: indicar disponibilitat ràpid i sense alta.
- Dolor: formularis llargs o confusos.

## 4.3 Persona C - Operador tècnic (intern)

- Qui és: enginyeria/operació.
- Necessitat: mantenir estabilitat, observabilitat i desplegaments segurs.

## 5) Estat del producte (05/03/2026)

### 5.1 Fases

- Fase global: **MVP funcional**.
- Preparat per: ús pilot/controlat amb operació tècnica present.

### 5.2 Estat per àrea

- Flux votació -> reunió: **Implementat**
- Flux gravació -> transcripció -> acta: **Implementat** (amb mode real/stub)
- Observabilitat Telegram: **Implementat**
- CI amb smoke sobre emuladors: **Implementat**
- Alta comercial/pagament a UI: **Parcial/Pendent de connexió final**

## 6) Funcionalitats principals

## 6.1 Gestió d'accés entitat

- Login entitat (Firebase Auth + sessió server `__session`): **Implementat**.
- Logout amb revocació de tokens: **Implementat**.
- Alta d'entitat via API (`/api/auth/entity-signup`): **Implementat**.
- Alta d'entitat exposada completament a UI: **Parcial**.

## 6.2 Votacions

- Crear votació amb màxim 20 franges: **Implementat**.
- Enllaç públic per votar (`/p/[slug]`): **Implementat**.
- Persistència de votant via token al navegador + hash al servidor: **Implementat**.
- Resultats públics i per owner: **Implementat**.
- Tancament de votació i selecció opció guanyadora: **Implementat**.

## 6.3 Reunions i actes

- Creació de reunió en tancar votació: **Implementat**.
- Pujada de gravació (Storage) o text base: **Implementat**.
- Processament asíncron de gravació: **Implementat**.
- Transcripció amb Gemini (si key) o stub: **Implementat**.
- Generació d'acta JSON + Markdown: **Implementat**.
- Edició manual d'acta: **Implementat**.
- Export `ICS` i export `.md`: **Implementat**.

## 6.4 Monitorització i incidències

- Captura d'errors server (`instrumentation.ts`): **Implementat**.
- Captura d'errors client (`ErrorMonitor` -> `/api/public/error-report`): **Implementat**.
- Enviament d'incidències a Telegram amb deduplicació temporal: **Implementat**.

## 7) Principis de disseny de producte i UX

## 7.1 Principis

- Simplicitat operativa: fluxos curts i directes.
- Baixa càrrega cognitiva: llenguatge clar, passos explicats.
- Mobile-first útil (formularis, taules adaptades, botons grans).
- Feedback immediat (estat de procés, missatges d'error i èxit).

## 7.2 UI actual

- Stack: Next App Router + Tailwind v4.
- Estètica: neta, base clara (`slate`) amb accent `sky`.
- Componentització base: `Button`, `Card`, `Badge`, `Table`, `Field`.
- Idiomes: català (`ca`) i castellà (`es`), default `ca`.

## 7.3 Criteris de disseny a mantenir

- Evitar ambigüitat en accions irreversibles (`tancar votació`).
- Missatges d'error accionables i curts.
- Mantenir consistència entre estats i etiquetes (`open/closed/processing/done/error`).

## 8) Arquitectura funcional del sistema

## 8.1 Flux principal end-to-end

1. Owner entra a `/login`.
2. Crea votació a `/polls/new`.
3. Comparteix enllaç públic `/p/{slug}`.
4. Participants voten.
5. Owner revisa resultats i tanca votació.
6. Sistema crea reunió i habilita espai d'acta.
7. Owner puja gravació o text base.
8. Sistema processa i genera transcripció + acta.
9. Owner edita i exporta.

## 8.2 Rutes de producte

### Públiques

- `/`
- `/p/[slug]`
- `/p/[slug]/results`

### Owner

- `/login`
- `/signup`
- `/dashboard`
- `/polls/new`
- `/polls/[pollId]`
- `/meetings/[meetingId]`

## 9) Arquitectura tècnica

## 9.1 Stack tècnic

- Frontend/Backend web: Next.js 15 (App Router) + React 19 + TypeScript.
- Dades: Firestore.
- Fitxers: Firebase Storage.
- Identitat: Firebase Auth.
- Deploy: Firebase Hosting amb frameworks backend.
- IA: Gemini API (opc.) + fallback deterministic/stub.

## 9.2 Estructura del codi

- `app/`: pàgines i API routes.
- `src/lib/`: domini i infraestructura (db, auth, gemini, monitoring, security).
- `src/components/`: UI i formularis de negoci.
- `functions/`: codebase separat (actualment esquelet).
- `scripts/`: devops local/CI.
- `.github/workflows/`: automatització CI/CD.

## 9.3 Patró arquitectònic

- BFF simple dins Next (`app/api/*`).
- Lògica de domini concentrada a `src/lib/db/repo.ts`.
- Validació d'entrada amb `zod`.
- Autorització server-side en cada endpoint owner.

## 10) Model de dades

## 10.1 Entitats principals

- `orgs/{orgId}`
- `polls/{pollId}` + `options`, `voters`, `votes`
- `meetings/{meetingId}` + `recordings`, `transcripts`, `minutes`
- `_rate_limits/{hash}`

## 10.2 Estats

- Poll: `open | closed`
- Recording: `uploaded | processing | done | error`
- Transcript: `pending | processing | done | error`
- MinutesTask: `todo | doing | done`

## 10.3 Regles clau

- `orgId` canònic = `ownerUid` (amb backward compatibility a legacy orgs).
- Token de votant: raw al client, hash al servidor.
- Acta guardada en dos formats:
  - `minutesJson` (estructurat)
  - `minutesMarkdown` (editable/exportable)

## 11) API de negoci (resum)

## 11.1 Auth

- `POST /api/auth/entity-signup`
- `POST /api/auth/session-login`
- `POST /api/auth/session-logout`

## 11.2 Owner

- `POST /api/owner/polls/create`
- `POST /api/owner/close-poll`
- `POST /api/owner/recordings/register`
- `POST /api/owner/process-recording`
- `POST /api/owner/minutes/update`
- `GET /api/owner/minutes/export?meetingId=...`

## 11.3 Públic

- `POST /api/public/vote`
- `GET /api/public/ics?meetingId=...` (requereix sessió owner)
- `POST /api/public/error-report`

## 12) Seguretat i privacitat

## 12.1 Control d'accés

- Sessiò server via cookie `__session` (`httpOnly`, `sameSite=strict`).
- Guard owner a pàgines i endpoints.
- Firestore i Storage rules amb model owner.

## 12.2 Proteccions aplicades

- Validació d'entrada amb `zod`.
- Rate limit server-side amb fallback memòria.
- Check same-origin per mutacions (`POST`).
- CSP + headers de seguretat a totes les rutes.
- Redirecció host canònic (`summareu.app`) per evitar dispersió de domini.

## 12.3 Riscos coneguts a gestionar

- Processament en segon pla dins context HTTP (sense cua dedicada).
- Dedupe de Telegram en memòria de procés (no global entre instàncies).
- Col·lecció `_rate_limits` sense neteja explícita automàtica.

## 13) IA i qualitat de contingut d'actes

## 13.1 Modes d'operació

- Sense `GEMINI_API_KEY`: mode `stub`.
- Amb `GEMINI_API_KEY`: mode `real` amb fallback a `stub` si falla.

## 13.2 Contracte d'acta

- Esquema JSON estricte validat amb `zod` (`language=ca`, summary, attendees, agenda, decisions, tasks).
- Render a markdown homogeni per edició i export.

## 13.3 Criteris mínims d'acceptació del contingut

- Ha de ser JSON vàlid segons esquema.
- Si no es pot garantir qualitat real, s'aplica fallback robust en lloc de fallar el flux.

## 14) Operació, monitorització i alertes

## 14.1 Monitorització

- Errors server i API reportats a Telegram.
- Errors runtime de client reportats a backend i reenviats a Telegram.
- Missatges d'incident humanitzats amb impacte i acció recomanada.

## 14.2 Runbooks actuals

- Verificació permisos Firebase: `npm run test:permissions`
- Prova canal Telegram: `npm run test:telegram`
- Smoke e2e sobre emuladors: `npm run ci:smoke`
- Monitor login en loop: `npm run monitor:login`

## 15) Entorns i configuració

## 15.1 Variables clau

- Firebase públic (`NEXT_PUBLIC_*`)
- Firebase server (`FIREBASE_*`)
- Gemini (`GEMINI_*`)
- Hosting canònic (`CANONICAL_HOST`, `FORCE_CANONICAL_REDIRECT`)
- Alertes (`TELEGRAM_*`)

## 15.2 Entorn local recomanat

1. `npm run bootstrap:firebase`
2. `npm run emu`
3. `npm run seed`
4. `npm run test:smoke`

## 16) CI/CD i govern de desplegament

- CI (`.github/workflows/ci.yml`): lint + smoke (obligatori en PR/main).
- Deploy emergència manual (`deploy.yml`): revalida i desplega hosting.
- Mirror de prod (`prod-mirror-sync.yml`): sincronització unidireccional segura a branca mirror.

Política operativa recomanada:

- PR obligatori a `main`.
- Checks requerits (`lint`, `smoke`).
- Aprovar desplegament d'emergència via environment `production`.

## 17) Estat de qualitat actual (verificat avui)

Execucions realitzades el **5 de març de 2026**:

- `npm run lint` -> OK
- `npm run build` -> OK
- `npm run ci:smoke` -> OK

Resultat: base actual **compila i passa smoke funcional** sobre emuladors.

## 18) Decisions tècniques vigents

- El backend funcional principal resideix a Next API routes (no a Cloud Functions custom).
- Firestore és la font principal de veritat de negoci.
- L'estratègia IA és resilient: millor resultat possible sense bloquejar operativa.
- Prioritat de seguretat: evitar escriure directament des de client públic a Firestore per vots.

## 19) Roadmap viu (macro)

### 19.1 Immediat (curt termini)

- Connectar/decidir definitivament flux d'alta comercial a UI (`/signup`).
- Consolidar política de dades efímeres (`_rate_limits`).
- Endurir processament asíncron amb cua dedicada si es preveu càrrega real.

### 19.2 Mig termini

- Rols interns addicionals per entitat.
- Millora d'analytics de producte (KPI operatius).
- Millora qualitativa d'actes (prompts i validacions semàntiques).

## 20) Criteris de "Definition of Done" per canvis

Un canvi es considera complet quan:

- resol objectiu funcional sense regressió de flux principal,
- inclou validació mínima (`lint`, build i/o smoke segons impacte),
- manté seguretat i aïllament de dades,
- actualitza aquest document (si canvia comportament, arquitectura o operació).

## 21) Govern del document (IMPORTANT)

Aquest fitxer és **persistent i evolutiu**.

Norma d'actualització a cada canvi rellevant:

1. Actualitzar la secció afectada.
2. Afegir entrada al registre de canvis.
3. Si canvia comportament de negoci, revisar també:
   - objectius/KPI,
   - funcionalitats,
   - riscos,
   - runbooks.

## 22) Registre de canvis del document

### 2026-03-05

- Creat `SUMMA-REU-REFERENCIA-COMPLETA.md` com a referència única de producte + tecnologia.
- Integrat estat real del projecte, arquitectura, seguretat, operació i roadmap viu.

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
