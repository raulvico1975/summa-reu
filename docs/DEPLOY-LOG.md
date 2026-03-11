### Idle session logout

Sessio tancada automaticament despres de 30 min d'inactivitat.

Comportament:
- Avis als 25 minuts
- Modal amb opcio "Continuar sessio"
- Logout real via POST /api/auth/session-logout
- Sessio persistent si hi ha activitat
- No logout en tancar pestanya o navegador
