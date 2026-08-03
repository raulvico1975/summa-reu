# MCP privat per Summa Agent

Estat: local v0.2, Fase A `prepare-only`.

Aquest adaptador exposa a Summa Agent una capa MCP privada sobre la `private integration API v1` existent de Summa Social. No és una funcionalitat pública per clients i no amplia permisos.

## Abast

Eines exposades:

- `search_contacts`: lectura de contactes.
- `search_transactions`: lectura de moviments.
- `preview_bank_statement_import`: llegeix un `filePath` local absolut i explícit, calcula el SHA-256, parseja l'extracte i consulta duplicats; no importa.
- `prepare_donation_classification`: valida un moviment i un donant explícits i retorna el canvi proposat i una precondició; no aplica.
- `prepare_individual_donation_certificate`: valida les dades fiscals persistents o la classificació proposada; no genera cap PDF.
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

- No crea ni importa moviments i no modifica imports, dates ni classificació.
- No toca remeses.
- No toca Model 182 ni Model 347, no genera/desa certificats i no envia correus.
- No escriu directament a Firestore.
- No crea donants automàticament.
- No fa matching fiscal automàtic.
- No invoca l'endpoint real d'importació, cap operació `commit`/`apply`, Storage ni cap generador PDF.
- No fa lots: la vinculació document-moviment és d'un sol cas per crida.

## Configuració local

Variables d'entorn:

```bash
SUMMA_BASE_URL=http://localhost:9002
SUMMA_PRIVATE_INTEGRATION_TOKEN=...
SUMMA_ORG_ID=...
SUMMA_SOURCE_REPO=summa-agent-mcp
SUMMA_MCP_ENABLED_TOOLS=preview_bank_statement_import,prepare_donation_classification,prepare_individual_donation_certificate
```

Per al pilot de Flores, el wrapper `scripts/integrations/run-flores-prepare-only-mcp.sh`
valida l'organització activa, recupera el token exclusivament del Mac Keychain i exposa
només les tres eines de Fase A. El secret no s'escriu al repositori ni a la configuració MCP.

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
- ús de rutes privades existents amb `Authorization`;
- resum operatiu sense endpoints fiscals, remeses ni lectura no autoritzada de pending documents;
- upload amb `Idempotency-Key` i sense tocar ledger.
- vinculació document-moviment amb scope dedicat, hash del document, import/data esperats i bloqueig si el moviment ja té document.
- `filePath` bancari absolut, SHA-256 i parseig CSV/XLS/XLSX sense importació;
- scopes separats, aïllament multi-organització, compte actiu i deduplicació;
- moviment/donant/fiscalitat i preparació del certificat sobre estat proposat;
- absència de mutacions de negoci, PDF, Storage i correu.

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
