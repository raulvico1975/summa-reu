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
