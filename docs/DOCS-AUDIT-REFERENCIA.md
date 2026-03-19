# DOCS-AUDIT-REFERENCIA

Data de l’auditoria: **19 de març de 2026** (`Europe/Madrid`)

Fitxer auditat:

- `/Users/raulvico/Documents/summa-board/SUMMA-REU-REFERENCIA-COMPLETA.md`

Context operatiu verificat durant l’auditoria:

- `npm run inicia` no es pot executar perquè `package.json` no defineix aquest script.
- La feina s’ha fet a la branca `codex/docs-audit-20260319`.

## 1) Canvis fets

- Reescriptura completa del document perquè barrejava estat implementat, roadmap, criteris de negoci i evidència operativa no verificable des del codi.
- Actualització de la superfície real de producte amb les rutes visibles actuals:
  - `/`
  - `/login`
  - `/signup`
  - `/billing`
  - `/dashboard`
  - `/polls/new`
  - `/polls/[pollId]`
  - `/owner/meetings/[meetingId]`
  - `/p/[slug]`
  - `/p/[slug]/results`
  - `/meetings/[meetingId]`
- Actualització de l’inventari real d’API per incloure `POST /api/owner/meetings/create`, que existia al codi i no quedava ben reflectit.
- Correcció del model de dades de reunions per incloure camps realment presents al tipus `MeetingDoc`:
  - `dailyRoomName`
  - `dailyRoomUrl`
  - `provisioningStatus`
  - `provisioningError`
  - `provisioningAttemptedAt`
  - `provisioningReadyAt`
  - `lastWebhookAt`
- Correcció dels estats de negoci reals:
  - `poll.status` passa de `open | closed` a `open | closing | closed | close_failed`
  - `meeting.provisioningStatus` s’ha documentat
  - `meeting.recordingStatus` s’ha ampliat amb l’union real del codi
- Reescriptura del flux de tancament de votació:
  - la reunió es crea primer a Firestore
  - després s’intenta provisionar Daily
  - si Daily falla, la votació queda a `close_failed`
- Separació explícita de dos fluxos de processament que al document antic quedaven barrejats:
  - flux Daily amb webhook i `meeting_ingest_job`
  - flux manual amb `recordings/register` i `process-recording`
- Correcció del comportament de la pantalla de reunió:
  - només accepta reunions usables
  - obre Daily en pestanya nova
  - mostra transcripció, acta, exportacions i esborrat
- Actualització de seguretat, sessió, routing i rate limiting contra implementació real:
  - cookie `__session`
  - `same-origin`
  - `402 subscription_required`
  - prefixos locale en producció
  - host canònic `summareu.app`
  - límits `10/10m`, `40/10m`, `12/10m`
- Actualització dels scripts i workflows a partir del `package.json` i `.github/workflows/*` actuals.

## 2) Eliminacions

- Eliminats tots els blocs de roadmap, “futur”, “objectiu immediat”, “curt termini” i “mig termini”.
- Eliminats KPI, objectius de negoci i “definition of done”, perquè no es poden verificar al codi com a funcionalitat implementada.
- Eliminada la secció de “qualitat executada avui” amb `lint`, `build` i `smoke` en estat `OK`, perquè en aquesta auditoria no s’han reexecutat aquestes comandes.
- Eliminades referències a commits concrets i a estats de `main`, perquè no formen part del comportament funcional verificat del producte.
- Eliminada evidència operacional amb IDs reals d’org, subscripció i events Stripe.
- Eliminada la afirmació que la reunió s’obre “dins Summa via iframe”; el codi actual obre `meetingUrl` en pestanya nova.
- Eliminada la afirmació que la “pujada manual d’àudio/vídeo o text base” sigui una funcionalitat visible a la UI actual; el backend i el component existeixen, però la ruta owner actual no el munta.
- Eliminades recomanacions de procés com “PR obligatori”, “checks requerits” o polítiques operatives no imposades pel codi.
- Eliminada la narrativa de “MVP desplegat i obertura pública tècnicament tancada”, perquè és valorativa i no estrictament verificable línia a línia contra implementació.

## 3) Dubtes detectats

- `MeetingRecordingStatus` inclou `stopping` al tipus i a la UI, però les rutes server actuals no persisteixen aquest estat; el flux efectiu observat és `none -> recording -> processing -> ready | error`.
- `RecordingUploader` existeix a `src/components/meetings/recording-uploader.tsx`, però no hi ha cap import o muntatge actiu en una pàgina; el camí manual existeix al backend però la seva exposició final a usuari queda ambigua.
- Hi ha dues capes relacionades amb creació de room Daily:
  - `src/lib/meetings/create-meeting-with-daily.ts`
  - `src/lib/integrations/daily/create-room.ts`
  El flux actiu de creació de reunió usa aquestes peces, mentre que `src/lib/meetings/daily.ts` concentra start/stop/webhook; convé evitar documentar-les com si fossin una única abstracció.
- `GET /api/public/ics` continua sota el namespace `public`, però funcionalment és una exportació owner-authenticated; el nom de la ruta pot induir a error documental si no s’explicita aquesta excepció.
