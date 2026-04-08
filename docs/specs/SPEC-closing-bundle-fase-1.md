# SPEC — Closing Bundle — Fase 1

## 1. Contracte del canvi

- Afegir `manifest.json` a l'arrel del ZIP.
- Afegir `incidencies.xlsx` a l'arrel del ZIP.
- Convertir la no resolució documental en incidència funcional `DOCUMENT_NO_RESOLUBLE`.
- Alinear permisos entre route i Cloud Function amb el model efectiu de `informes.exportar`.
- Afegir preset trimestral al selector del diàleg, resolt a `dateFrom/dateTo`.

## 2. Canvis a implementar

### (A) `manifest.json`

- Fitxer(s) a tocar:
  - `functions/src/exports/closingBundleZip.ts`
  - `functions/src/exports/closing-bundle/closing-types.ts`
- Funció exacta:
  - `exportClosingBundleZip`
- Punt d'injecció:
  - Després del bucle de descàrrega documental i del càlcul de `statusCounts`, `totalIncome`, `totalExpense`, `totalWithDocRef` i `downloadedTxIds.size`
  - Abans de `await archive.finalize()`
- Shape final:
```json
{
  "runId": "string",
  "orgSlug": "string",
  "dateFrom": "YYYY-MM-DD",
  "dateTo": "YYYY-MM-DD",
  "totalTransactions": 0,
  "totalIncome": 0,
  "totalExpense": 0,
  "balance": 0,
  "totalWithDocRef": 0,
  "totalIncluded": 0,
  "totalIncidents": 0,
  "statusCounts": {
    "ok": 0,
    "noDocument": 0,
    "urlNotParseable": 0,
    "bucketMismatch": 0,
    "notFound": 0,
    "downloadError": 0
  }
}
```
- Invariants:
  - No recalcular dades des d'una segona query
  - Serialitzar només dades ja disponibles a memòria a `exportClosingBundleZip`
  - El manifest ha de reflectir l'estat final dels documents, no l'estat previ al `download()`
- Casos límit:
  - `NOT_FOUND` i `DOWNLOAD_ERROR` han d'entrar al `statusCounts`
  - `NO_DOCUMENT` ha d'entrar al `statusCounts`
  - No afegir IDs interns nous fora dels ja disponibles al flux

### (B) `incidencies.xlsx`

- Fitxer(s) a tocar:
  - `functions/src/exports/closing-bundle/build-closing-xlsx.ts`
  - `functions/src/exports/closingBundleZip.ts`
  - `functions/src/exports/closing-bundle/closing-types.ts`
- Funció exacta:
  - Afegir builder nou a `build-closing-xlsx.ts`
  - Invocar-lo des de `exportClosingBundleZip`
- Punt d'injecció:
  - Després de construir la col·lecció final d'incidències
  - Abans de `await archive.finalize()`
- Shape final:
  - Un full `Incidencies`
  - Una fila per incidència
  - Columnes:
    - `Ordre`
    - `Data`
    - `Import`
    - `Concepte`
    - `Categoria`
    - `Contacte`
    - `Tipus`
    - `Severitat`
    - `Missatge`
    - `txId`
    - `documentStatus`
- Invariants:
  - Reutilitzar `xlsx` igual que `moviments.xlsx` i `debug.xlsx`
  - No reconsultar Firestore
  - No barrejar diagnòstic documental cru amb incidències sense mapatge explícit
- Casos límit:
  - Si una transacció té més d'una incidència, una fila per incidència
  - `documentStatus` només informat per incidències documentals; a la resta, buit
  - Mantenir ordre determinista basat en l'ordre de `transactions`

### (C) `document_no_resoluble` -> incidència

- Fitxer(s) a tocar:
  - `functions/src/exports/closing-bundle/closing-types.ts`
  - `functions/src/exports/closingBundleZip.ts`
- Funció exacta:
  - `exportClosingBundleZip`
- Punt d'injecció:
  - Després de completar el bucle de descàrrega documental
  - Abans de generar `manifest.json`, `incidencies.xlsx` i `resum.txt`
- Shape final:
  - Afegir `DOCUMENT_NO_RESOLUBLE` a `IncidentType`
  - Generar incidències derivades a partir de `DocumentDiagnostic.status`
  - Una incidència per transacció quan l'estat final sigui un de:
    - `URL_NOT_PARSEABLE`
    - `BUCKET_MISMATCH`
    - `NOT_FOUND`
    - `DOWNLOAD_ERROR`
- Invariants:
  - No generar `DOCUMENT_NO_RESOLUBLE` per `NO_DOCUMENT`
  - No duplicar incidències per una mateixa transacció i un mateix status final
  - Construir aquestes incidències sobre l'estat final del diagnòstic, no sobre l'estat inicial
- Casos límit:
  - `NO_DOCUMENT` continua cobert per `FALTA_DOCUMENT` només quan correspongui
  - `URL_NOT_PARSEABLE` i `BUCKET_MISMATCH` es deriven abans de download, però la incidència final s'afegeix al mateix pipeline comú
  - `NOT_FOUND` i `DOWNLOAD_ERROR` només existeixen després del bucle de download

### (D) permisos alineats

- Fitxer(s) a tocar:
  - `functions/src/exports/closingBundleZip.ts`
- Funció exacta:
  - `exportClosingBundleZip`
- Punt d'injecció:
  - Substituir el bloc actual de validació per rol simple abans de la generació del bundle
- Shape final:
  - Llegir `role`, `userOverrides`, `userGrants` del membre
  - Resoldre accés efectiu a `informes.exportar`
  - Permetre també el bypass de `systemSuperAdmins/{uid}`
- Invariants:
  - Mantenir `401` per token absent/invàlid
  - Mantenir `403` per no membre o sense permís
  - Preservar el comportament de SuperAdmin que ja admet la route
  - El criteri final ha de quedar alineat amb `informes.exportar`, no amb `admin/superadmin` simple
- Casos límit:
  - `user` sense denies ha de poder passar si el model efectiu li dona `informes.exportar`
  - `admin` amb deny explícit a `informes.exportar` ha de quedar bloquejat
  - `systemSuperAdmins/{uid}` sense membership ha de poder passar

### (E) preset trimestral

- Fitxer(s) a tocar:
  - `src/lib/closing-bundle/closing-bundle-types.ts`
  - `src/components/reports/closing-bundle-dialog.tsx`
  - `src/i18n/ca.ts`
  - `src/i18n/es.ts`
  - `src/i18n/fr.ts`
- Funció exacta:
  - `PeriodOption`
  - `getDates()` del diàleg
- Punt d'injecció:
  - Afegir el nou valor al selector del diàleg
  - Resoldre'l a `dateFrom/dateTo` abans del `fetch`
- Shape final:
  - Nou valor de tipus: `'current_quarter'`
  - El backend continua rebent només:
```ts
{ orgId: string; dateFrom: string; dateTo: string }
```
- Invariants:
  - No canviar el contracte de la route
  - No enviar semàntica de període al backend
  - Resoldre trimestre complet al client
- Casos límit:
  - Trimestre 1: `01-01` a `03-31`
  - Trimestre 2: `04-01` a `06-30`
  - Trimestre 3: `07-01` a `09-30`
  - Trimestre 4: `10-01` a `12-31`

## 3. Ordre d'execució tècnic

1. Estendre `functions/src/exports/closing-bundle/closing-types.ts` amb els tipus necessaris per a `DOCUMENT_NO_RESOLUBLE` i el shape del manifest/incidències.
2. Reordenar `functions/src/exports/closingBundleZip.ts` perquè el pipeline final d'incidències es construeixi després del bucle de descàrrega i abans dels artefactes finals.
3. Afegir `manifest.json` a `exportClosingBundleZip` usant només l'estat ja calculat a memòria.
4. Afegir `buildIncidenciesXlsx()` a `functions/src/exports/closing-bundle/build-closing-xlsx.ts` i append d'`incidencies.xlsx` al ZIP.
5. Alinear permisos a `functions/src/exports/closingBundleZip.ts` amb `informes.exportar`, `userOverrides`, `userGrants` i `systemSuperAdmins`.
6. Afegir el preset trimestral a `src/lib/closing-bundle/closing-bundle-types.ts` i `src/components/reports/closing-bundle-dialog.tsx`.
7. Afegir les claus de text del preset trimestral a `src/i18n/ca.ts`, `src/i18n/es.ts` i `src/i18n/fr.ts`.

## 4. Tests mínims manuals

### (A) `manifest.json`

- Verificació:
  - Generar un bundle vàlid.
  - Obrir el ZIP.
  - Confirmar que existeix `manifest.json` a l'arrel.
  - Confirmar que els comptatges coincideixen amb `resum.txt` i `debug/resum_debug.txt`.
- Ha de passar:
  - El fitxer existeix.
  - Els totals i `statusCounts` estan poblats.
- No pot passar:
  - Manifest buit.
  - Comptatges previs al bucle de descàrrega.

### (B) `incidencies.xlsx`

- Verificació:
  - Generar un bundle amb moviments que activin incidències.
  - Obrir `incidencies.xlsx`.
  - Confirmar una fila per incidència.
- Ha de passar:
  - Existeix `incidencies.xlsx`.
  - Les columnes definides hi són.
- No pot passar:
  - Reutilitzar `debug.xlsx` com si fos `incidencies.xlsx`.
  - Una sola fila per transacció si hi ha múltiples incidències.

### (C) `document_no_resoluble` -> incidència

- Verificació:
  - Preparar casos amb `URL_NOT_PARSEABLE`, `BUCKET_MISMATCH`, `NOT_FOUND` i `DOWNLOAD_ERROR`.
  - Generar bundle.
  - Confirmar que apareix `DOCUMENT_NO_RESOLUBLE` a `incidencies.xlsx`.
- Ha de passar:
  - Un cas documental resolt malament genera incidència funcional.
- No pot passar:
  - `NO_DOCUMENT` convertit automàticament en `DOCUMENT_NO_RESOLUBLE`.
  - Duplicació d'incidències per un únic status final.

### (D) permisos alineats

- Verificació:
  - Cas 1: membre amb `informes.exportar` permès.
  - Cas 2: membre amb deny explícit.
  - Cas 3: SuperAdmin sense membership.
- Ha de passar:
  - Route i Function decideixen igual en els tres casos.
- No pot passar:
  - La route deixi passar i la Function denegui.
  - La Function deixi passar per rol simple quan `informes.exportar` estigui denegat.

### (E) preset trimestral

- Verificació:
  - Obrir el diàleg.
  - Seleccionar preset trimestral.
  - Interceptar el `POST`.
- Ha de passar:
  - El body enviat només conté `orgId`, `dateFrom`, `dateTo`.
  - El rang correspon al trimestre actual complet.
- No pot passar:
  - Enviar `periodType`, `quarter` o semàntica addicional al backend.
  - Resoldre només una part del trimestre.

## 5. Riscos tècnics

- Dates amb component horària poden quedar fora del rang superior del bundle si no es corregeix la comparació `dateTo`. Evidència: `functions/src/exports/closing-bundle/build-closing-data.ts:283-287`
- La validació de mida usa bucket per defecte i la descàrrega usa bucket resolt explícitament. Evidència: `functions/src/exports/closing-bundle/build-closing-data.ts:486-497`; `functions/src/exports/closingBundleZip.ts:194-206`
- El contracte d'error route/client ja està desalineat i no s'ha d'empitjorar. Evidència: `src/lib/api/require-permission.ts:22-34`; `src/components/reports/closing-bundle-dialog.tsx:121-138`
- El flux documental continua sent seqüencial i sensible a cost/timeout. Evidència: `functions/src/exports/closingBundleZip.ts:66-69`; `functions/src/exports/closingBundleZip.ts:240-298`
- Els permisos actuals estan dividits entre model efectiu de la route i rol simple a la Function. Evidència: `src/app/api/exports/closing-bundle-zip/route.ts:45-52`; `functions/src/exports/closingBundleZip.ts:137-150`

## 6. Criteri de DONE

- `manifest.json` existeix a l'arrel del ZIP i reflecteix l'estat final del bundle.
- `incidencies.xlsx` existeix a l'arrel del ZIP i conté una fila per incidència.
- `DOCUMENT_NO_RESOLUBLE` existeix com a incidència funcional i només es deriva dels status documentals finals definits.
- La Cloud Function aplica el mateix criteri efectiu de `informes.exportar` que la route, incloent `userOverrides`, `userGrants` i `systemSuperAdmins`.
- El diàleg té preset trimestral i el backend continua rebent només `orgId`, `dateFrom`, `dateTo`.
- `README.txt`, `moviments.xlsx`, `resum.txt`, `debug/resum_debug.txt` i `debug/debug.xlsx` continuen existint.
