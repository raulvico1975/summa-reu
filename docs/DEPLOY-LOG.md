### Idle session logout

Sessio tancada automaticament despres de 30 min d'inactivitat.

Comportament:
- Avis als 25 minuts
- Modal amb opcio "Continuar sessio"
- Logout real via POST /api/auth/session-logout
- Sessio persistent si hi ha activitat
- No logout en tancar pestanya o navegador

2026-03-11
UX meeting control panel redesign merged to main.
Clarifies recording requires active participants in Daily.
No backend changes.

2026-03-14
Dashboard: eliminacio de reunions passades disponible des del tauler.
Proteccio backend impedeix eliminar reunions futures o actives.
QA local sobre emuladors: llistat, supressio i persistencia verificats per HTTP contra `next dev`.
Nota: la comprovacio automatitzada de click + refresh en Safari ha quedat bloquejada per la configuracio local del navegador (`Allow remote automation` / `Allow JavaScript from Apple Events` desactivats).

2026-03-14
Manual production deploy restored and validated for summa-board.
Service account used: github-deploy-manual@summa-board.iam.gserviceaccount.com
Secret updated: FIREBASE_SERVICE_ACCOUNT_SUMMA_BOARD
Roles assigned:
- roles/firebase.admin
- roles/cloudfunctions.admin
- roles/cloudbuild.builds.editor
- roles/iam.serviceAccountUser
- roles/serviceusage.serviceUsageConsumer
Project APIs enabled during restore:
- cloudbuild.googleapis.com
- cloudfunctions.googleapis.com
- artifactregistry.googleapis.com
- runtimeconfig.googleapis.com
- cloudbilling.googleapis.com
GitHub Actions runs:
- 23085424735 failed: Cloud Build API not enabled
- 23085475301 failed: missing serviceusage.services.use on runtimeconfig/artifactregistry
- 23085522567 failed: Cloud Billing API disabled
- 23085620119 succeeded: Deploy Manual Emergency on main
Validation:
- SSR function active: ssrsummaboard (europe-west1), updated 2026-03-14T10:00:20Z
- summareu.app responds 307 -> /ca and 200 on /ca after deploy
- hosted backend responds at https://summa-board--summa-board.europe-west4.hosted.app

2026-03-17
PR #9 merged to main.
Deployed SHA: 755b5b52da892f8462e393c9f5ab5879217a2c3a
Phase 1 product contract validated in production:
- close-poll only succeeds with a usable meeting
- real success path validated with Daily
- usable meeting created
- meetingUrl present
- meeting URL host was summareu.daily.co
- owner UI showed "Entrar a la reunió"
Operational issue discovered and resolved:
- production runtime was missing DAILY_API_KEY and DAILY_DOMAIN
- error category was CONFIG_MISSING
- runtime config applied to service ssrsummaboard

2026-03-18
Phase 1 operational consolidation completed.
Stable App Hosting configuration added in apphosting.yaml.
Commit: 5b57193319de48988a22bc73ab350b9dd945d840
Stable config now declares:
- DAILY_DOMAIN at runtime
- DAILY_API_KEY as App Hosting secret
Secret access granted to backend summa-board.
Current status:
- phase 1 validated functionally
- phase 1 deployed
- phase 1 configuration consolidated at the stable App Hosting layer

2026-03-18
Main product cycle validated end-to-end in production.
Meeting: bIaKdVmveHGN0TPOLky5
Ingest job: bIaKdVmveHGN0TPOLky5__23d7a130-350b-4c72-8acc-7520e2d67d46
Final validation:
- recordingStatus: ready
- meeting_ingest_job.status: completed
- transcript created
- minutes created
- error: null
Operational issues discovered and resolved during final validation:
- Daily webhook was initially missing at account level and later accepted after reading the real event field from the Daily payload
- production runtime was initially missing GEMINI_API_KEY
- automatic model selection reached a retired Gemini model for a new account
Stable deploy consolidation:
- apphosting.yaml now declares GEMINI_API_KEY as a runtime secret
- apphosting.yaml now fixes GEMINI_MODEL to gemini-2.5-flash-lite
- backend runtime has secret access granted for GEMINI_API_KEY
Current status:
- phase 1 resolved
- phase 2 resolved
- block 3A resolved
- full happy path validated in production
