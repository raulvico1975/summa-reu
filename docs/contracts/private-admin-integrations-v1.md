# Integracions privades administratives (v1)

Estat actual: **CONSOLIDAT + MCP PRIVAT FASE A + B1/B2/B3 + C1 INDIVIDUAL CONVERSACIONAL LOCAL**.

La v1 existeix per donar entrada controlada a agents propis com `baruma-admin-agent` o `flores-admin-agent` sense reutilitzar autenticacio d'usuari ni exposar col.leccions sensibles.

## Abast operatiu

La base v1 continua limitada a lectura i entrada de documents pendents. El pilot controlat afegeix una sola accio nova: vincular un `pendingDocument` existent amb un moviment concret quan hi ha OK granular i validacions fortes.

Scopes disponibles:

- `contacts.read`
- `transactions.read`
- `bank_accounts.search`
- `contacts.search`
- `transactions.search`
- `bank_import.preview`
- `bank_import.prepare`
- `bank_import.commit`
- `donation_classification.prepare`
- `donation_classification.apply`
- `certificates.prepare`
- `certificates.generate`
- `pending_documents.write`
- `pending_documents.link`

Rutes disponibles:

- `GET /api/integrations/private/contacts/search`
- `GET /api/integrations/private/transactions/search`
- `GET /api/integrations/private/conversational-search/bank-accounts`
- `GET /api/integrations/private/conversational-search/contacts`
- `GET /api/integrations/private/conversational-search/transactions`
- `POST /api/integrations/private/bank-import/preview`
- `POST /api/integrations/private/bank-import/plan`
- `POST /api/integrations/private/bank-import/commit`
- `POST /api/integrations/private/donations/classification/prepare`
- `POST /api/integrations/private/donations/classification/plan`
- `POST /api/integrations/private/donations/classification/apply`
- `POST /api/integrations/private/certificates/individual/prepare`
- `POST /api/integrations/private/certificates/individual/plan`
- `POST /api/integrations/private/certificates/individual/generate`
- `POST /api/integrations/private/pending-documents/upload`
- `POST /api/integrations/private/pending-documents/link-transaction`

Fora d'abast en aquesta fase:

- cap `idToken` d'usuari
- cap escriptura directa a ledger, fiscalitat o remeses
- cap consola d'administracio d'integracions
- cap accés directe al ledger
- cap canvi persistent sobre fiscalitat
- cap API publica
- cap `Claude`/`Codex MCP` directe
- cap endpoint nou "per si de cas": `link-transaction` existeix nomes pel cas validat document pendent + moviment
- cap refactor global d'API en aquesta fase
- fora dels fluxos B2 i B3 amb pla confirmat, cap `commit` d'importació ni `apply` de classificació; cap generació PDF o enviament de certificat

### Contracte Fase A

Les tres rutes `preview`/`prepare` no modifiquen col·leccions de negoci. Només es mantenen les dues escriptures de seguretat comunes a la private integration API:

- actualització de `integrationTokens.lastUsedAt`;
- alta sanitzada a `integrationAuditLogs`.

`preview_bank_statement_import` exigeix organització, compte bancari i `filePath` absolut explícits al client MCP. El fitxer es parseja localment i només s'envien dades estructurades, hash i metadades a la ruta privada. La resposta és `prepared`, mai `imported`.

`prepare_donation_classification` exigeix moviment i donant explícits, comprova organització, estat, signe i conflictes, i retorna el patch proposat i una precondició determinista. La resposta és `prepared`, mai `classified`.

`prepare_individual_donation_certificate` aplica el criteri fiscal actual de Summa sobre l'estat persistent o sobre la classificació proposada. La resposta és `prepared`, mai `generated`, `stored`, `downloaded` o `sent`.

### Contracte C1 de certificat individual canònic

`prepare_individual_donation_certificate` crea un pla persistent de 15 minuts només quan una única transacció ja consta com a donació positiva, activa i vinculada a un donant existent amb dades fiscals, i quan l'organització té les dades institucionals mínimes. El pla queda lligat al token, organització, moviment, donant i snapshot fiscal/institucional.

`generate_individual_donation_certificate` exigeix el mateix pla i la confirmació exacta. El servidor rellegeix organització, donant i moviment, bloqueja qualsevol drift i genera el PDF mitjançant el mateix builder canònic que usa la descàrrega individual de la UI. El client MCP verifica mida i SHA-256 i desa el PDF amb creació exclusiva dins `SUMMA_MCP_OUTPUT_DIR`.

C1 no genera certificats anuals o massius, no envia correus, no escriu a Storage, no marca res com enviat i no modifica cap dada de negoci o fiscal.

### Contracte B1 conversacional

Les tres rutes B1 són estrictament de lectura i exigeixen scopes independents. Retornen `candidates`, `matchReasons`, `confidence` i un estat de resolució; fins i tot amb un sol resultat, la decisió queda marcada com `candidate_only` i requereix selecció humana abans de qualsevol acció posterior.

- `search_bank_accounts`: nom, banc o fragment d'IBAN; IBAN sempre emmascarat.
- `search_contacts`: nom, alias, email o NIF/CIF; email i identificador fiscal emmascarats.
- `search_transactions`: concepte, import i tolerància, dates, compte i direcció; exigeix almenys un filtre per evitar consultes no acotades.

Les respostes declaren `effects.businessDataMutated=false`. Les úniques escriptures comunes són `integrationTokens.lastUsedAt` i l'auditoria sanitzada a `integrationAuditLogs`.

### Contracte B2 d'importació bancària controlada

`prepare_bank_statement_import_plan` exigeix una selecció explícita de files classificades com `NEW`, persisteix un pla server-side lligat al token, organització, compte, SHA-256 del fitxer, `inputHash` i selecció, i caduca als 15 minuts. El pla no importa moviments.

`commit_bank_statement_import` exigeix el mateix `planId`, bindings, selecció i el `confirmationText` exacte després d'una confirmació humana. El servidor consumeix el pla una sola vegada, torna a calcular els duplicats contra l'estat actual i bloqueja qualsevol drift abans d'escriure.

El commit reutilitza el motor canònic compartit amb la ruta UI: normalització, IDs deterministes, idempotència per `inputHash`, lock, `safeSet`/`safeUpdate`, `importJobs`, `importRuns` i batches de màxim 50. No importa files duplicades, candidates o no seleccionades.

### Contracte B3 de classificació controlada d'una donació

`prepare_donation_classification_plan` exigeix un únic moviment positiu existent i un únic donant actiu existent. Persisteix durant 15 minuts un pla lligat al token, organització, moviment, donant i precondició. No modifica el moviment.

`apply_donation_classification` exigeix el mateix `planId`, moviment, donant, precondició i el text de confirmació exacte després d'una confirmació humana. Dins d'una única transacció, el servidor torna a llegir moviment i donant, repeteix les validacions canòniques i bloqueja qualsevol canvi d'estat abans d'escriure.

L'únic patch permès sobre el moviment és `contactId`, `contactType='donor'`, `transactionType='donation'` i `fiscalKind='donation'`. El pla és d'un sol ús. No crea donants, no importa extractes, no modifica altres camps i no genera certificats.

## Validacio real en produccio (2026-04-16)

Validacio feta contra la instancia productiva desplegada, amb tokens temporals separats per org i sense reutilitzar autenticacio d'usuari.

Casos validats:

- `baruma-admin-agent`: lectura real de `5` contactes, lectura real de `5` moviments d'abril 2026, upload real de `1` factura a `pendingDocuments`, prova de `403 ORG_NOT_ALLOWED` contra una altra org i estrès controlat de `10` uploads amb `3` reintents sobre la mateixa `Idempotency-Key`
- `flores-admin-agent`: lectura real de `5` contactes, lectura real de `4` moviments d'abril 2026 (coincidents amb el volum real existent a l'org en aquell periode), upload real de `1` factura a `pendingDocuments` i prova de `403 ORG_NOT_ALLOWED` contra una altra org

Latencies orientatives observades:

- cerca de contactes: aproximadament `1.5s`
- cerca de moviments: aproximadament `0.5s`
- upload nou a `pendingDocuments`: aproximadament `1.7s` a `2.0s`
- reintent idempotent: aproximadament `0.5s` a `0.65s`

Resultat funcional:

- idempotencia validada en reintents: mateixa `Idempotency-Key` + mateix payload => mateix `pendingDocument.id`
- aïllament per organitzacio validat: cap dada creuada i `403 ORG_NOT_ALLOWED` correcte
- Storage coherent durant l'estrès: `1` objecte per `pendingDocument` creat, sense creixement indegut en reintents
- auditoria coherent a `integrationAuditLogs` sense payloads sensibles complets

Neteja posterior a la validacio:

- tokens temporals de validacio revocats
- `pendingDocuments` de smoke eliminats
- claus d'idempotencia de smoke eliminades
- artefactes temporals de Storage eliminats
- auditoria conservada com a rastre real d'execucio

## On viuen els tokens

Col.leccio Firestore:

```text
integrationTokens/{tokenId}
```

Shape operativa:

```json
{
  "tokenType": "private_integration",
  "orgId": "org_123",
  "tokenHash": "sha256:...",
  "scopes": ["contacts.read", "transactions.read"],
  "status": "active",
  "createdAt": "serverTimestamp",
  "createdBy": "raul",
  "lastUsedAt": null,
  "label": "baruma-prod",
  "sourceRepo": "baruma-admin-agent"
}
```

Regles:

- es desa **nomes el hash**, mai el token en clar
- un token queda lligat a **una sola organitzacio**
- `status` nomes pot ser `active` o `revoked`
- totes les crides deixen auditoria a `integrationAuditLogs/{logId}`

## Com es creen i es revoquen ara

Creacio:

```bash
npm run integrations:token:create -- \
  --org org_123 \
  --label baruma-prod \
  --created-by raul \
  --source-repo baruma-admin-agent \
  --scope contacts.read \
  --scope transactions.read \
  --scope bank_accounts.search \
  --scope contacts.search \
  --scope transactions.search \
  --scope bank_import.preview \
  --scope bank_import.prepare \
  --scope bank_import.commit \
  --scope donation_classification.prepare \
  --scope donation_classification.apply \
  --scope certificates.prepare \
  --scope certificates.generate \
  --scope pending_documents.write \
  --scope pending_documents.link
```

El comandament retorna el `clearToken` una sola vegada. Guarda'l fora de Firestore.

Revocacio:

```bash
npm run integrations:token:revoke -- --token-id <tokenId>
```

## Headers comuns

Totes les rutes exigeixen:

```http
Authorization: Bearer <SUMMA_PRIVATE_INTEGRATION_TOKEN>
```

L'upload exigeix, a mes, idempotencia explicita:

```http
Idempotency-Key: <external-stable-key>
```

Si es reutilitza la mateixa clau amb payload diferent, la resposta es `409 IDEMPOTENCY_CONFLICT`.

## Ruta 1: contactes

```http
GET /api/integrations/private/contacts/search?orgId=org_123&q=palmerita&limit=20
```

Scope:

- `contacts.read`

Regles:

- `orgId` obligatori
- `q` obligatori, minim 2 caracters
- exclou arxivats per defecte
- `includeArchived=true` els inclou
- `limit` per defecte `20`, maxim `50`

Resposta:

```json
{
  "success": true,
  "contacts": [
    {
      "id": "contact_1",
      "name": "PALMERITA, S.L.",
      "taxId": "B12345678",
      "email": "factures@palmerita.tv",
      "iban": "ES1122334455667788990011",
      "type": "supplier",
      "roles": { "supplier": true },
      "status": null
    }
  ],
  "limit": 20
}
```

## Ruta 2: moviments

```http
GET /api/integrations/private/transactions/search?orgId=org_123&q=alpha&dateFrom=2026-01-01&limit=50
```

Scope:

- `transactions.read`

Filtres suportats:

- `orgId` obligatori
- `q`
- `contactId`
- `bankAccountId`
- `dateFrom`
- `dateTo`
- `cursor`
- `limit`
- `includeArchived`

Regles:

- paginacio per cursor
- exclou filles de remesa visibles al ledger
- `limit` per defecte `50`, maxim `100`

Resposta:

```json
{
  "success": true,
  "transactions": [
    {
      "id": "tx_1",
      "date": "2026-04-15",
      "amount": -120.5,
      "description": "Factura Alpha serveis",
      "contactId": "contact_1",
      "contactType": "supplier",
      "category": "services",
      "projectId": "project_1",
      "bankAccountId": "bank_1",
      "source": "bank",
      "transactionType": "normal",
      "document": "doc_1"
    }
  ],
  "nextCursor": null,
  "limit": 50
}
```

## Ruta 3: upload a pendingDocuments

```http
POST /api/integrations/private/pending-documents/upload?orgId=org_123
Authorization: Bearer <token>
Idempotency-Key: gmail-msg-123
Content-Type: multipart/form-data
```

Camps `multipart/form-data`:

- `file` obligatori
- `status` opcional: `draft` per defecte; `confirmed` nomes quan l'agent envia tots els camps obligatoris de Summa Social
- `type` opcional: `unknown` per defecte; per `status=confirmed` ha de ser `invoice`, `payroll` o `receipt`
- `invoiceNumber` opcional; obligatori per `status=confirmed` amb `type=invoice` o `type=payroll`
- `supplierName` opcional
- `supplierId` opcional; obligatori per `status=confirmed` amb `type=invoice` o `type=payroll`
- `categoryId` opcional; obligatori per qualsevol `status=confirmed`
- `invoiceDate` opcional, format `YYYY-MM-DD`
- `amount` opcional
- `sourceRepo` opcional
- `externalMessageId` opcional
- `orgId` dins del body es opcional; si s'envia, ha de coincidir amb l'`orgId` de la URL

Regles:

- per defecte es crea un `pendingDocument` en estat `draft`
- si s'envia `status=confirmed`, el document queda directament preparat per al flux propi de conciliacio de Summa Social quan s'importi l'extracte bancari
- un `confirmed` extern no vincula cap moviment per si sol; nomes deixa el document en el mateix estat funcional que un document confirmat dins la UI de pendents
- no toca ledger ni fiscalitat
- l'upload es guarda a Storage sota un path determinista
- mateixa `Idempotency-Key` + mateix payload => mateix resultat funcional

Exemple `curl`:

```bash
curl -X POST "http://localhost:9002/api/integrations/private/pending-documents/upload?orgId=org_123" \
  -H "Authorization: Bearer $SUMMA_TOKEN" \
  -H "Idempotency-Key: gmail-msg-123" \
  -F "file=@./factura.pdf" \
  -F "status=confirmed" \
  -F "type=invoice" \
  -F "invoiceNumber=F-2026-15" \
  -F "supplierName=ACME, S.L." \
  -F "supplierId=supplier_acme" \
  -F "categoryId=cat_services" \
  -F "invoiceDate=2026-04-15" \
  -F "amount=123.45" \
  -F "externalMessageId=gmail-msg-123"
```

Resposta:

```json
{
  "success": true,
  "idempotent": false,
  "pendingDocument": {
    "id": "intpd_abc123",
    "status": "confirmed",
    "type": "invoice",
    "file": {
      "filename": "factura.pdf",
      "contentType": "application/pdf",
      "sizeBytes": 48231,
      "sha256": "..."
    },
    "invoiceNumber": "F-2026-15",
    "invoiceDate": "2026-04-15",
    "amount": 123.45,
    "supplierId": "supplier_acme",
    "categoryId": "cat_services",
    "supplierName": "ACME, S.L.",
    "sourceRepo": "baruma-admin-agent",
    "externalMessageId": "gmail-msg-123"
  }
}
```

## Ruta 4: vincular pendingDocument amb moviment

```http
POST /api/integrations/private/pending-documents/link-transaction?orgId=org_123
Authorization: Bearer <token>
Content-Type: application/json
```

Scope:

- `pending_documents.link`

Body:

```json
{
  "orgId": "org_123",
  "pendingDocumentId": "intpd_abc123",
  "transactionId": "tx_123",
  "caseId": "baruma-case-la-teva-barra",
  "documentHash": "4e437b126ebe1c5a4a7a7ff0a7c2f13d7805f34b7873c682c439c364c9ffdef4",
  "expectedAmount": 738.2,
  "expectedDate": "2026-05-04",
  "reviewerLabel": "Raul",
  "note": "OK granular pilot Baruma"
}
```

Regles:

- només accepta un document i un moviment per crida
- el token ha de pertanyer a la mateixa organització
- el `pendingDocument` ha d'existir i tenir `file.sha256`
- el hash del document ha de coincidir
- l'import del document, si existeix, i l'import del moviment han de coincidir en valor absolut
- la data del moviment ha de coincidir amb `expectedDate`
- el moviment no pot tenir ja cap document vinculat
- si el document ja estava vinculat amb el mateix moviment i el moviment ja tenia document, la resposta és idempotent
- no modifica imports, dates, categories, contactes, fiscalitat ni remeses

Resposta:

```json
{
  "success": true,
  "linked": true,
  "idempotent": false,
  "pendingDocumentId": "intpd_abc123",
  "transactionId": "tx_123",
  "newState": {
    "pendingStatus": "matched",
    "matchedTransactionId": "tx_123",
    "transactionHasDocument": true
  },
  "storage": {
    "finalStoragePath": "organizations/org_123/documents/tx_123/factura.pdf",
    "copied": true
  }
}
```

## Errors estables

- `401 UNAUTHORIZED`: token absent, invalid o revocat
- `403 ORG_NOT_ALLOWED`: token fora de l'organitzacio
- `403 SCOPE_DENIED`: token sense scope suficient
- `400 MISSING_ORG_ID`: falta `orgId`
- `400 INVALID_QUERY`: `q` invalida a contactes
- `400 INVALID_CURSOR`: cursor invalida
- `400 CURSOR_NOT_FOUND`: cursor desconeguda
- `400 INVALID_DATE`: data invalida
- `400 INVALID_CONFIRMED_TYPE`: un document confirmat ha de ser `invoice`, `payroll` o `receipt`
- `400 CONFIRMED_AMOUNT_REQUIRED`: falta import en un document confirmat
- `400 CONFIRMED_INVOICE_DATE_REQUIRED`: falta data en un document confirmat
- `400 CONFIRMED_CATEGORY_REQUIRED`: falta categoria en un document confirmat
- `400 CONFIRMED_INVOICE_NUMBER_REQUIRED`: falta numero en factura/nomina confirmada
- `400 CONFIRMED_SUPPLIER_REQUIRED`: falta proveidor en factura/nomina confirmada
- `400 MISSING_IDEMPOTENCY_KEY`: falta `Idempotency-Key`
- `409 IDEMPOTENCY_CONFLICT`: mateixa clau externa amb payload diferent
- `409 DOCUMENT_HASH_MISMATCH`: el document pendent no coincideix amb el hash validat per l'agent
- `409 TRANSACTION_ALREADY_HAS_DOCUMENT`: el moviment ja té document
- `409 TRANSACTION_AMOUNT_MISMATCH`: l'import esperat no encaixa amb el moviment
- `409 TRANSACTION_DATE_MISMATCH`: la data esperada no encaixa amb el moviment

## v2 candidates

Bloc de possibles extensions futures. Aquest apartat **no** obre contracte nou ni autoritza implementacio automatica.

- `pending_documents.read`
- `contacts.upsert` molt restringit i acotat
- `transactions.write` en brut: explicitament fora d'abast

## Notes de seguretat

- l'auth d'integracio viu separada de `verifyIdToken(request)`
- no es persisteixen secrets en clar als logs d'auditoria
- no s'emmagatzemen payloads complets sensibles a l'auditoria
- l'entrada d'escriptura general va nomes a `pendingDocuments`; la vinculacio pilot nomes pot escriure `pendingDocuments.status/matchedTransactionId/file.finalStoragePath` i `transactions.document`
