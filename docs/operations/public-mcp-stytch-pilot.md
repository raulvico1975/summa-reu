# Pilot MCP públic amb Stytch

Estat: **desplegat amb fail-closed; només activable per al pilot tancat autoritzat**.

## Resultat del M2

El pilot incorpora una frontera OAuth 2.1 de lectura per connectar clients MCP preregistrats:

- pàgina d'autorització pròpia a `/mcp/authorize`;
- sessió d'usuari verificada amb Firebase;
- vinculació tancada d'un usuari i una organització pilot de Summa amb un membre i una organització de Stytch;
- pertinença real a `organizations/{orgId}/members/{uid}`, sense bypass de SuperAdmin;
- Authorization Code amb PKCE `S256`, `state`, recurs i callbacks HTTPS;
- clients OAuth públics sense secret de client;
- consentiment explícit i scopes només de lectura;
- introspecció autoritativa del token amb client, issuer, audience, subjecte i expiració;
- configuració fail-closed: si falta una variable, el flux respon `MCP_OAUTH_NOT_CONFIGURED`.

No s'ha afegit cap dependència ni esquema Firestore. La vinculació del pilot és configuració de servidor per mantenir l'abast mínim i reversible.

## Configuració requerida

Les variables estan documentades a `.env.local.example`. Els secrets s'han de desar al gestor de secrets de l'entorn; mai al repositori ni en variables `NEXT_PUBLIC_*`.

Els clients autoritzats han de ser `third_party_public`, preregistrats i amb:

- PKCE obligatori;
- callback exacte del client;
- audience personalitzada igual a `SUMMA_MCP_RESOURCE`;
- access token curt;
- únicament els quatre scopes de lectura publicats pel recurs MCP.

El mapping fix del pilot és `mcp.session.read` → `session_read`,
`bank_accounts.search` → `bank_accounts_search`, `contacts.search` →
`contacts_search` i `transactions.search` → `transactions_search`. El resum
operatiu comparteix l'últim scope; no afegeix cap permís nou. Els callbacks
HTTPS han de coincidir exactament amb els clients preregistrats i l'audience ha
de ser exactament `SUMMA_MCP_RESOURCE`.

M2 usa access tokens curts (15 minuts) i no habilita `offline_access` ni
refresh. El rate limit en memòria només és un control local: no és suficient
per staging públic. La configuració de l'issuer, els callbacks, la revocació,
la limitació distribuïda i la prova real amb ChatGPT i Claude continuen sent
gates abans de qualsevol desplegament o comunicació externa.

Per al pilot no s'activen DCR ni CIMD. Es revisaran després de validar almenys ChatGPT i Claude amb clients preregistrats.

## Ordre segur d'activació

1. Crear l'organització i el membre de proves a Stytch.
2. Crear els recursos/actions RBAC i els quatre scopes de lectura.
3. Crear un secret de projecte només de servidor.
4. Crear els clients públics PKCE de ChatGPT i Claude.
5. Configurar les variables al staging i l'Authorization URL de Stytch.
6. Desplegar només amb autorització explícita i seguint `docs/DEPLOY.md`.
7. Validar consentiment, callback, token, audience i aïllament d'organització amb dades de prova.
8. Revocar el grant i comprovar que l'accés deixa de funcionar.

## Gates abans de comunicar disponibilitat

- `/mcp` ha d'usar l'actor OAuth i un servei de lectura canònic; el mode fixture M1 no és suficient.
- Prova real satisfactòria amb ChatGPT i Claude.
- Cap dada completa de NIF, IBAN o correu en les respostes del pilot.
- Revocació, límits d'ús, auditoria sanititzada i rollback verificats.
- Aprovació explícita de desplegament i de comunicació externa.

La veu no és una propietat garantida pel protocol MCP. Només es pot comunicar després d'una prova real en el mode de veu del client concret.
