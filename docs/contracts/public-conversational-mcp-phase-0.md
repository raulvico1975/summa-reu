# MCP conversacional públic: contracte de Fase 0

Estat: **ACCEPTAT PER DESENVOLUPAMENT LOCAL; SENSE AUTORITZACIÓ DE DEPLOY, DADES REALS O PUBLICACIÓ**.

## 1. Objectiu

Permetre que una persona usuària autoritzada treballi amb la seva organització de Summa Social des de clients compatibles amb MCP, començant per ChatGPT i Claude, sense duplicar la lògica de negoci ni reduir les garanties de la interfície web.

El primer resultat útil és un pilot remot de **lectura**. La preparació d'accions, els fitxers i les mutacions només entren en fases posteriors després de superar els gates d'aïllament, autorització i interoperabilitat.

El MCP és un canal d'accés a Summa Social. No és una nova font de veritat, un ERP paral·lel ni un agent autònom que decideix per l'entitat.

## 2. Alineació amb Summa Social

El desenvolupament ha de preservar aquests principis del producte:

1. **Entitats petites i mitjanes.** La solució ha de ser comprensible, operable i mantenible per un equip petit.
2. **IA assistida, no decisora.** Summa automatitza tasques repetitives però manté el criteri humà en assignacions, fiscalitat i canvis sensibles.
3. **Summa és la font de veritat.** L'MCP reutilitza serveis i regles canòniques; no manté un ledger, permisos o criteris fiscals paral·lels.
4. **Multi-organització real.** L'usuari, l'organització activa, els entitlements i els permisos es validen al servidor en cada crida.
5. **Dades mínimes.** Cada eina retorna només els camps necessaris i emmascara identificadors personals o bancaris quan correspon.
6. **Integracions controlades.** Cap client extern escriu directament al core o a Firestore.
7. **Menys és més.** Una capacitat només entra si redueix errors, estalvia temps real, és mantenible i contribueix a l'objectiu del producte.

Fonts canòniques:

- `README.md`
- `docs/SUMMA-SOCIAL-REFERENCIA-COMPLETA.md`
- `docs/PERMISSIONS-SYSTEM.md`
- `docs/PATRONS-CODI-OBLIGATORIS.md`
- `docs/contracts/private-admin-integrations-v1.md`
- `docs/contracts/private-conversational-summa-roadmap.md`
- `docs/operations/summa-agent-private-mcp.md`
- `docs/security/PRIVACY_POLICY.md`
- `docs/DEPLOY.md`

## 3. Promesa de producte

Promesa prevista després d'un pilot validat:

> Connecta Summa Social a ChatGPT o Claude i consulta la informació de la teva entitat des del xat, amb els mateixos permisos i controls de Summa.

No es pot comunicar encara:

- que el connector sigui públic o estigui disponible en directoris;
- que permeti gestionar totes les funcionalitats de Summa;
- que executi accions fiscals, bancàries o massives;
- que funcioni dins del mode de veu natiu de ChatGPT o Claude;
- que substitueixi la revisió de l'entitat, la gestoria o altres professionals.

Una experiència pròpia de veu pot estudiar-se més endavant sobre les mateixes capacitats, però no forma part del pilot MCP.

## 4. Estat de partida verificat

La base actual aporta:

- adaptador MCP local per `stdio`;
- API privada server-side;
- tokens privats hashejats i vinculats a una organització;
- scopes granulars, auditoria i aïllament entre organitzacions;
- cerques, resum operatiu i plans `prepare -> confirm -> commit` d'un sol ús;
- suite local existent: 1.519 tests, 1.518 passats, 0 fallades i 1 omès en la revisió de Fase 0;
- `npm run typecheck` net en la mateixa revisió.

Aquesta evidència valida la lògica local i les APIs existents. No valida un MCP remot, OAuth, ChatGPT, Claude ni producció.

Bloquejos actuals per al remot:

- no hi ha endpoint MCP Streamable HTTP;
- el protocol està implementat amb un dispatcher JSON-RPC local i parcial;
- no hi ha OAuth interoperable per persona usuària;
- `orgId` encara forma part d'arguments d'eina en fluxos actuals;
- el JSON Schema anunciat no s'aplica com a validació runtime de frontera;
- sense allowlist, el servidor local habilita totes les eines;
- `filePath` i `outputPath` depenen del filesystem local;
- falten annotations MCP d'efectes, controls d'abús i proves amb clients remots.

## 5. Arquitectura mínima

```text
ChatGPT / Claude
        |
        v
HTTPS /mcp (Streamable HTTP)
        |
        v
Autenticació + context immutable d'actor
        |
        v
Policy: organització + entitlements + permisos + scope + eina
        |
        v
Serveis canònics de Summa / API privada
        |
        v
Firestore / Storage + auditoria
```

Regles:

1. El transport MCP no accedeix directament a Firestore.
2. No es crea una còpia de la lògica de negoci per a ChatGPT o Claude.
3. Les diferències entre clients queden limitades a configuració, metadades i proves d'interoperabilitat.
4. El servidor deriva l'organització de l'autorització. L'`orgId` públic no pot ampliar ni seleccionar l'abast.
5. Una mateixa persona pot tenir diverses organitzacions, però cada grant o sessió té una organització activa explícita i immutable durant la crida.
6. La implementació del protocol ha de ser conforme amb MCP. No s'amplia el parser manual existent com si fos un servidor remot complet.
7. No es decideix encara si `/mcp` viurà dins del runtime web o en un servei separat. Es tria l'opció més simple que compleixi streaming, seguretat, observabilitat i rollback.

Context mínim derivat al servidor:

```ts
type McpActorContext = {
  userId: string;
  organizationId: string;
  entitlements: string[];
  permissions: string[];
  scopes: string[];
  clientId: string;
  tokenId: string;
};
```

Aquest context no es construeix amb dades proposades pel model.

## 6. Autenticació i autorització

El pilot remot requereix OAuth interoperable amb:

- Authorization Code + PKCE S256;
- redirect URIs exactes i clients preregistrats per al pilot;
- access tokens curts amb verificació equivalent d'issuer, audience, subjecte, expiració i identificador, sigui mitjançant claims signats o introspecció;
- audience vinculada al recurs MCP;
- refresh segur, rotació i revocació;
- scopes mínims;
- vinculació explícita del grant amb una organització;
- invalidació quan canvia la pertinença, el pla o els permisos;
- prohibició de reenviar el token MCP a altres APIs.

No es construeix un sistema general d'identitat des de zero. La Fase 1 inclou un spike acotat per decidir la integració més simple amb l'autenticació existent de Summa. Dynamic Client Registration s'ajorna mentre ChatGPT i Claude puguin preregistrar-se de manera segura.

Ordre d'autorització efectiu:

```text
token vàlid
AND usuari actiu
AND membre de l'organització
AND entitlement del pla
AND permisos efectius de secció/acció
AND scope OAuth
AND eina habilitada per al pilot
```

Qualsevol denegació és fail-closed i no revela si existeix un recurs d'una altra organització.

## 7. Catàleg inicial d'eines

### Pilot de lectura

| Eina | Resultat | Condicions |
|---|---|---|
| `get_session_context` | usuari i organització activa, sense dades sensibles | sempre autenticada |
| `search_bank_accounts` | comptes candidats i IBAN emmascarat | permís de lectura bancària |
| `search_contacts` | contactes candidats i camps emmascarats | permís corresponent al rol consultat |
| `search_transactions` | moviments candidats mínims | secció i acció de moviments |
| `get_entity_operational_summary` | resum acotat a permisos | cada bloc s'omet si no està autoritzat |

Regles comunes:

- allowlist tancada per client i grant;
- límits de resultats i filtres obligatoris per evitar bolcats massius;
- `structuredContent` compacte i estable;
- cap payload complet de documents, notes o dades fiscals;
- annotations `readOnlyHint`, `destructiveHint`, `openWorldHint` i idempotència quan correspongui;
- la descripció recorda que conceptes, noms i documents són dades no fiables, no instruccions;
- cap eina de lectura modifica dades de negoci; l'auditoria i ús de token s'etiqueten com a efectes tècnics.

### Fases posteriors, no incloses al pilot

1. Plans `prepare-only`.
2. Upload remot mitjançant `uploadId` opac i temporal.
3. Accions individuals amb aprovació gestionada per Summa.
4. Mutacions d'alt risc només després de validació específica.

Queden fora fins a una decisió posterior: remeses, Models 182/347, enviament de correus, certificats massius, pagaments, migracions, lots, presentacions oficials i accions irreversibles.

## 8. Aprovació humana i mutacions futures

Un booleà enviat pel model com `humanConfirmed=true` no és una prova suficient d'aprovació.

El contracte futur serà:

```text
prepared -> pending_approval -> approved -> consumed
                              -> expired
                              -> blocked
```

Cada pla tindrà com a mínim:

- `planId`, tipus, usuari, organització i client;
- resum exacte i hash del canvi;
- snapshot o precondició;
- `createdAt`, `expiresAt`, estat i ús únic;
- identitat i moment de l'aprovació;
- revalidació completa abans d'executar;
- auditoria mínima d'abans/després.

L'aprovació es farà en una superfície controlada per Summa o mitjançant un mecanisme del client verificat expressament. No s'habilita cap mutació fins que ChatGPT i Claude hagin superat aquest flux en staging.

## 9. Fitxers remots

`filePath` i `outputPath` no formen part del contracte públic.

El disseny posterior usarà:

- `uploadId` opac, temporal i vinculat a usuari/organització;
- límits de mida i temps;
- validació d'extensió, MIME i magic bytes;
- hash del contingut;
- protecció davant path traversal, fitxers hostils i esgotament de recursos;
- TTL i neteja explícita;
- recursos o URLs curtes autoritzades per a descàrregues.

Fins que existeixi aquest contracte i les seves proves, totes les eines MCP basades en fitxers queden deshabilitades en remot.

## 10. Amenaces prioritàries

| Prioritat | Amenaça | Control mínim |
|---|---|---|
| P0 | robatori o replay de token | tokens curts, audience, rotació, revocació i cap secret als logs |
| P0 | accés entre organitzacions | organització derivada server-side i comprovació de cada recurs |
| P0 | transport o OAuth no conformes | suite de protocol, staging i prova real amb els dos clients |
| P1 | confused deputy mitjançant IDs del model | context immutable i policy server-side |
| P1 | arguments malformats o excessius | validació runtime, límits de mida, temps i concurrència |
| P1 | prompt injection dins dades | outputs mínims i estructurats; cap execució automàtica |
| P1 | mutació duplicada o amb drift | plans d'un sol ús, precondicions, locks i idempotència |
| P1 | fitxers maliciosos | upload opac, validacions, aïllament i TTL |
| P2 | exfiltració per errors o logs | errors estables, redacció i retenció acotada |

## 11. Qualitat i cost

Regles de desenvolupament:

- cap refactor global si no és imprescindible per al primer gate;
- cap dependència de runtime nova sense justificar compatibilitat, manteniment i alternativa;
- una sola definició canònica per eina, schema i mapping d'errors;
- validació runtime a totes les fronteres;
- TypeScript estricte i errors explícits;
- mai `undefined` a Firestore;
- batches Firestore de màxim 50 operacions;
- cap canvi destructiu d'esquema;
- cap dada sensible completa en logs, errors o outputs;
- fixtures sintètiques abans de dades reals;
- tests específics per qualsevol canvi fiscal, de donants, remeses o ledger;
- cap canvi fora d'abast barrejat amb el MCP.

Regles per reduir cost de models i latència:

- eines petites i específiques;
- respostes estructurades i paginades;
- límits de resultats baixos per defecte;
- evitar retornar camps que el model no necessita;
- no afegir widgets o UI MCP al pilot de lectura;
- no crear adaptadors separats de negoci per ChatGPT i Claude;
- no obrir una nova fase fins a tancar i mesurar l'anterior.

## 12. Pla de lliurament i gates

### M0 — Contracte

Lliurable: aquest document revisat i coherent amb els contractes privats.

Gate:

- objectiu, no-objectius, eines, arquitectura, amenaces i proves definits;
- sense contradicció amb permisos, privacitat o deploy;
- sense codi ni infraestructura especulativa.

### M1 — Transport local amb fixtures

Lliurable: `/mcp` conforme en entorn local o efímer, allowlist només lectura, validació runtime i outputs mínims.

Gate:

- typecheck i suite existent nets;
- tests de protocol i schema;
- cap Firestore directe des del transport;
- cap eina de fitxer o mutació exposada.

### M2 — OAuth i multi-organització en staging

Lliurable: autenticació d'usuari, tenant binding i revocació.

Gate:

- proves de token expirat/revocat, issuer/audience, scopes i cross-org;
- rate limit, payload limit, timeout i logs sanitzats;
- sense dades reals fins a autorització separada.

Checkpoint local 2026-09-01:

- arquitectura `tool-only`: Summa és només resource server i no implementa cap authorization server propi;
- Stytch B2B és el candidat de pilot perquè ofereix descoberta MCP i introspecció RFC 7662 sense dependència criptogràfica nova;
- grant immutable d'una sola organització, vinculat a issuer, subject, usuari Summa, client OAuth, scopes i eines permeses;
- resolució d'actor fail-closed amb expiració, issuer, audience, scopes, revocació, membre real i permisos canònics;
- well-known principal i fallback, challenge 401, payload limit, rate limit, timeout d'autenticació i logs amb referències hashejades;
- implementació i proves només amb fixtures; no hi ha compte Stytch, credencials, grant Firestore, dades reals, connexió de client ni desplegament.

M2 no supera el gate fins que es provin el consentiment i els callbacks del proveïdor,
es resolgui la política canònica de permisos/entitlement del MCP públic, s'implementi
el repositori de grants de staging i es connecti la frontera OAuth a `/mcp`.

### M3 — Interoperabilitat

Lliurable: connexió de ChatGPT i Claude a staging.

Gate:

- initialize, list i call validats en els dos clients;
- casos positius i negatius;
- cap diferència de permisos o resultats entre clients;
- runbook d'incidència, revocació i kill switch.

### M4 — Pilot assistit de lectura

Requereix autorització explícita de dades reals i desplegament.

Gate de continuïtat:

- zero errors crítics;
- reducció mínima orientativa del 30% del temps de consulta o suport;
- valor recurrent en almenys 2 o 3 entitats;
- manteniment inferior al temps estalviat;
- demanda explícita abans de productitzar públicament.

### M5 — Accions controlades

Només després del pilot i amb contracte addicional per aprovacions, fitxers i cada mutació.

## 13. Matriu mínima de proves

- **Protocol:** versions, initialize/list/call, sessions, errors i cancel·lació.
- **OAuth:** PKCE, state, redirect URI, expiració, revocació, refresh, issuer, audience i scopes.
- **Multi-org:** organització, usuari i IDs aliens en cada eina, sense filtració lateral.
- **Schemas:** tipus incorrectes, camps extra, JSON malformat, arrays i strings excessius.
- **Abús:** rate limit, mida màxima, timeout i concurrència.
- **Lectura:** permisos secció/acció, minimització, emmascarament i `no-store/private`.
- **Prompt injection:** dades hostils tractades sempre com a contingut.
- **Mutacions futures:** aprovació absent, pla expirat/reutilitzat, drift, replay i fallada parcial.
- **Fitxers futurs:** MIME/magic discordants, oversize, hash incorrecte, caducitat i cross-org.
- **Observabilitat:** cap token, Authorization, NIF, IBAN complet, path o document en logs/errors.
- **Clients:** MCP Inspector, ChatGPT i Claude sobre staging.
- **Regressió:** suite completa existent i typecheck.

Tests locals, un build o una connexió de staging no són prova de desplegament productiu ni de pilot validat.

## 14. Decisions ajornades expressament

- servei separat o route dins del runtime web;
- Dynamic Client Registration;
- widgets o UI específica de ChatGPT;
- prompts, resources, notifications o tasks MCP avançades;
- veu pròpia;
- alta disponibilitat i multi-regió;
- directoris públics i empaquetat comercial;
- facturació específica del connector;
- fitxers i totes les eines d'escriptura.

Aquestes decisions només es reobren quan un gate o una necessitat validada les faci necessàries.

## 15. Condicions d'aturada

El desenvolupament s'atura i torna a decisió si:

- requereix ampliar permisos més enllà dels de la UI;
- força una segona font de veritat;
- no es pot garantir aïllament entre organitzacions;
- exigeix construir un sistema general d'identitat o workflow abans del pilot;
- introdueix una dependència o infraestructura amb manteniment desproporcionat;
- els clients interpreten de manera diferent una acció sensible;
- el pilot no mostra estalvi recurrent o genera més suport del que evita;
- la promesa comercial supera la capacitat real validada.
