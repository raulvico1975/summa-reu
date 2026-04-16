# Integracions privades administratives (v1)

Estat actual: **implementat a backend**.

La v1 existeix per donar entrada controlada a agents propis com `baruma-admin-agent` o `flores-admin-agent` sense reutilitzar autenticacio d'usuari ni exposar col.leccions sensibles.

## Abast tancat

Scopes disponibles:

- `contacts.read`
- `transactions.read`
- `pending_documents.write`

Rutes disponibles:

- `GET /api/integrations/private/contacts/search`
- `GET /api/integrations/private/transactions/search`
- `POST /api/integrations/private/pending-documents/upload`

Fora d'abast en aquesta fase:

- cap `idToken` d'usuari
- cap escriptura directa a ledger, fiscalitat o remeses
- cap consola d'administracio d'integracions
- cap scope extra

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
  --scope pending_documents.write
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
- `supplierName` opcional
- `invoiceDate` opcional, format `YYYY-MM-DD`
- `amount` opcional
- `sourceRepo` opcional
- `externalMessageId` opcional
- `orgId` dins del body es opcional; si s'envia, ha de coincidir amb l'`orgId` de la URL

Regles:

- es crea un `pendingDocument` en estat `draft`
- no toca ledger ni fiscalitat
- l'upload es guarda a Storage sota un path determinista
- mateixa `Idempotency-Key` + mateix payload => mateix resultat funcional

Exemple `curl`:

```bash
curl -X POST "http://localhost:9002/api/integrations/private/pending-documents/upload?orgId=org_123" \
  -H "Authorization: Bearer $SUMMA_TOKEN" \
  -H "Idempotency-Key: gmail-msg-123" \
  -F "file=@./factura.pdf" \
  -F "supplierName=ACME, S.L." \
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
    "status": "draft",
    "type": "unknown",
    "file": {
      "filename": "factura.pdf",
      "contentType": "application/pdf",
      "sizeBytes": 48231,
      "sha256": "..."
    },
    "invoiceDate": "2026-04-15",
    "amount": 123.45,
    "supplierName": "ACME, S.L.",
    "sourceRepo": "baruma-admin-agent",
    "externalMessageId": "gmail-msg-123"
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
- `400 MISSING_IDEMPOTENCY_KEY`: falta `Idempotency-Key`
- `409 IDEMPOTENCY_CONFLICT`: mateixa clau externa amb payload diferent

## Notes de seguretat

- l'auth d'integracio viu separada de `verifyIdToken(request)`
- no es persisteixen secrets en clar als logs d'auditoria
- no s'emmagatzemen payloads complets sensibles a l'auditoria
- l'entrada d'escriptura va nomes a `pendingDocuments`
