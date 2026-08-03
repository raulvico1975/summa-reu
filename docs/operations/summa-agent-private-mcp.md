# MCP privat per Summa Agent

Estat: local v0.6, amb B1 conversacional, B2 d'importació bancària controlada, B3 de classificació confirmada i C1 de certificat individual canònic.

Aquest adaptador exposa a Summa Agent una capa MCP privada sobre la `private integration API v1` existent de Summa Social. No és una funcionalitat pública per clients i no amplia permisos.

## Abast

Eines exposades:

- `search_contacts`: lectura de contactes.
- `search_transactions`: lectura de moviments.
- `search_bank_accounts`: cerca de comptes per nom, banc o fragment d'IBAN, amb dades emmascarades.
- `preview_bank_statement_import`: llegeix un `filePath` local absolut i explícit, calcula el SHA-256, parseja l'extracte i consulta duplicats; no importa.
- `prepare_bank_statement_import_plan`: desa durant 15 minuts la selecció exacta de files `NEW`; no importa.
- `commit_bank_statement_import`: importa només el pla confirmat, després de revalidar token, organització, compte, hashes, selecció i duplicats.
- `prepare_donation_classification`: valida un moviment i un donant explícits i retorna el canvi proposat i una precondició; no aplica.
- `prepare_donation_classification_plan`: desa durant 15 minuts un pla per a un únic moviment i un únic donant existents; no aplica.
- `apply_donation_classification`: després de la confirmació exacta, revalida moviment, donant i precondició dins d'una transacció i aplica només els quatre camps canònics de donació.
- `prepare_individual_donation_certificate`: valida una única donació ja classificada i crea un pla confirmable de 15 minuts; no genera cap PDF.
- `generate_individual_donation_certificate`: rellegeix i revalida les dades de Summa, genera el PDF amb el builder compartit amb la UI i el desa en una ruta local nova i segura.
- `upload_pending_document`: pujada idempotent de document pendent per revisió humana.
- `link_pending_document_to_transaction`: vinculació d'un document pendent amb un moviment concret, només amb OK granular i validacions estrictes.
- `get_entity_operational_summary`: resum curt derivat de moviments recents i, opcionalment, cerca de contactes.

Límit explícit: `get_entity_operational_summary` no llegeix documents pendents perquè la v1 no exposa `pending_documents.read`.

## Frontera `prepare-only`

Les rutes de Fase A poden actualitzar només metadades de seguretat ja existents:

- `integrationTokens.lastUsedAt`;
- un registre sanititzat a `integrationAuditLogs`.

No es considera una preparació completada com una importació, una classificació ni un certificat generat.

## Prohibicions

- Fora del commit B2 i de l'apply B3 confirmats, no crea ni importa moviments i no modifica imports, dates ni classificació.
- No toca remeses.
- No toca Model 182 ni Model 347. C1 només genera un PDF individual confirmat i local; no envia correus ni desa certificats a Summa o Storage.
- No escriu directament a Firestore.
- No crea donants automàticament.
- No fa matching fiscal automàtic.
- B2 invoca exclusivament el motor canònic compartit d'importació després de consumir el pla; no executa cap altre `commit`/`apply`, Storage ni cap generador PDF.
- B3 no crea donants, no fa classificació en lot i només pot escriure `contactId`, `contactType`, `transactionType` i `fiscalKind` sobre el moviment confirmat.
- No fa lots: la vinculació document-moviment és d'un sol cas per crida.

## Configuració local

Variables d'entorn:

```bash
SUMMA_BASE_URL=http://localhost:9002
SUMMA_PRIVATE_INTEGRATION_TOKEN=...
SUMMA_ORG_ID=...
SUMMA_SOURCE_REPO=summa-agent-mcp
SUMMA_MCP_OUTPUT_DIR=/Users/raulvico/Downloads/Summa-Certificats
SUMMA_MCP_ENABLED_TOOLS=search_bank_accounts,search_transactions,search_contacts,preview_bank_statement_import,prepare_bank_statement_import_plan,commit_bank_statement_import,prepare_donation_classification,prepare_donation_classification_plan,apply_donation_classification,prepare_individual_donation_certificate,generate_individual_donation_certificate
```

Per al pilot de Flores, el wrapper `scripts/integrations/run-flores-prepare-only-mcp.sh`
valida l'organització activa, recupera el token exclusivament del Mac Keychain i exposa
només les eines conversacionals autoritzades. El secret no s'escriu al repositori ni a la configuració MCP. L'eina `commit_bank_statement_import` no es pot usar sense scope dedicat, pla vigent i confirmació humana exacta.

Arrencada:

```bash
npm run mcp:summa-agent
```

El transport és stdio JSON-RPC MCP. Els tokens continuen governats pel contracte `docs/contracts/private-admin-integrations-v1.md`.

## Evidència mínima

Proves locals:

```bash
npm run test:node
```

Cobertura afegida:

- llista exacta de les eines MCP privades;
- cerques B1 amb zero, un o múltiples candidats, confiança, motius de coincidència i dades emmascarades;
- scopes B1 separats, aïllament multi-organització, auditoria i absència de lectures no acotades;
- ús de rutes privades existents amb `Authorization`;
- resum operatiu sense endpoints fiscals, remeses ni lectura no autoritzada de pending documents;
- upload amb `Idempotency-Key` i sense tocar ledger.
- vinculació document-moviment amb scope dedicat, hash del document, import/data esperats i bloqueig si el moviment ja té document.
- `filePath` bancari absolut, SHA-256 i parseig CSV/XLS/XLSX sense importació;
- scopes separats, aïllament multi-organització, compte actiu i deduplicació;
- moviment/donant/fiscalitat i preparació del certificat sobre estat proposat;
- absència de mutacions de negoci, PDF, Storage i correu.
- pla B2 persistent, expirable, one-time i lligat a token/org/compte/fitxer/hash/selecció;
- bloqueig per manca de confirmació, expiració, reús, binding incorrecte o drift de duplicats;
- motor d'importació compartit amb la UI, idempotència, cap `undefined` i batches de màxim 50.
- pla B3 persistent durant 15 minuts, d'un sol ús i lligat a token, organització, moviment, donant i precondició;
- confirmació exacta, relectura atòmica i bloqueig per moviment o donant canviats;
- escriptura limitada exactament als quatre camps canònics i auditoria de l'estat anterior i posterior.
- builder PDF individual compartit entre UI i endpoint privat, amb dades de Summa rellegides al generate;
- pla C1 de 15 minuts, one-time, token/org/moviment/donant/precondició, confirmació exacta i bloqueig per drift;
- desament local `wx` sense sobreescriptura, dins del directori permès, després de verificar mida i SHA-256;
- absència de certificat anual/massiu, email, Storage, marca d'enviat i mutació fiscal.

## Validació real controlada

La validació real no s'executa si no hi ha tokens explícits a l'entorn. No crea tokens ni desa secrets.

La Fase A v0.2 només s'ha de validar amb fixtures/mocks fins que Raül autoritzi separadament un token real o una prova productiva.

Variables requerides:

```bash
SUMMA_BARUMA_PRIVATE_INTEGRATION_TOKEN=...
SUMMA_BARUMA_ORG_ID=...
SUMMA_BARUMA_FORBIDDEN_ORG_ID=...
SUMMA_FLORES_PRIVATE_INTEGRATION_TOKEN=...
SUMMA_FLORES_ORG_ID=...
SUMMA_FLORES_FORBIDDEN_ORG_ID=...
```

Opcional:

```bash
SUMMA_BASE_URL=https://studio--summa-social.us-central1.hosted.app
SUMMA_MCP_DATE_FROM=2026-04-01
SUMMA_MCP_DATE_TO=2026-04-30
SUMMA_BARUMA_CONTACT_QUERY=de
SUMMA_FLORES_CONTACT_QUERY=la
```

Execució:

```bash
npm run mcp:summa-agent:verify
```

La prova fa:

- `search_contacts` per Baruma i Flores;
- `search_transactions` amb rang curt;
- `upload_pending_document` amb un fitxer dummy innocu;
- `get_entity_operational_summary`;
- comprovació cross-org: cada token ha de fallar contra l'altra org amb `ORG_NOT_ALLOWED`.

Sortida:

- `tmp/verification/summa-agent-mcp-YYYYMMDD.md`

El log queda redaccionat i no inclou tokens, emails complets, NIFs, IBANs ni payloads sensibles.
