# AUDIT — Closing Bundle — Second Round Technical

Abast efectiu: lectura estricta del codi del repo dins aquest worktree, sense canvis funcionals.

Nota de mètode: no s'ha localitzat al repo cap document explícit del briefing "Segona ronda — Validació tècnica del Closing Bundle". Aquesta auditoria respon únicament al codi verificable i marca `NO VERIFICABLE` allò que requereix execució real o material extern no present al worktree.

## 0. Verificació prèvia de paths

[0.1] CONFIRMAT
- Evidència: functions/src/exports/closingBundleZip.ts:1; functions/src/exports/closing-bundle/build-closing-data.ts:1; functions/src/exports/closing-bundle/build-closing-xlsx.ts:1; functions/src/exports/closing-bundle/closing-types.ts:1; functions/src/exports/closing-bundle/normalize-filename.ts:1; src/app/api/exports/closing-bundle-zip/route.ts:1; src/app/[orgSlug]/dashboard/informes/page.tsx:1; src/components/reports/closing-bundle-card.tsx:1; src/components/reports/closing-bundle-dialog.tsx:1; src/lib/closing-bundle/closing-bundle-types.ts:1
- Resposta: Els 10 paths indicats existeixen al repo actual. Dins l'scope inspeccionat no s'ha detectat cap migració de la lògica equivalent cap a un altre path.

## 1. Estat actual

[1.1] CONFIRMAT
- Evidència: src/app/[orgSlug]/dashboard/informes/page.tsx:24-25; src/app/[orgSlug]/dashboard/informes/page.tsx:41-50; src/components/reports/closing-bundle-card.tsx:11-15; src/components/reports/closing-bundle-card.tsx:27-37
- Resposta: El Closing Bundle està integrat a la pàgina d'informes, es renderitza com una `Card` pròpia i el CTA d'obertura del diàleg queda condicionat per `informes.exportar`.

[1.2] CONFIRMAT
- Evidència: src/components/reports/closing-bundle-dialog.tsx:47-71; src/components/reports/closing-bundle-dialog.tsx:103-117; src/lib/closing-bundle/closing-bundle-types.ts:16-31
- Resposta: El contracte client actual és `orgId`, `dateFrom`, `dateTo`, amb tres modes de període (`current_year`, `previous_year`, `custom`) i enviament per `POST` cap a `/api/exports/closing-bundle-zip`.

[1.3] CONFIRMAT
- Evidència: src/app/api/exports/closing-bundle-zip/route.ts:13-18; src/app/api/exports/closing-bundle-zip/route.ts:45-52; src/app/api/exports/closing-bundle-zip/route.ts:62-72; functions/src/exports/closingBundleZip.ts:64-70; functions/src/exports/closingBundleZip.ts:88-105; functions/src/exports/closingBundleZip.ts:117-155
- Resposta: El flux productiu actual és client -> Next API Route -> Cloud Function HTTP. La route valida token i permís granular; la Cloud Function torna a validar token i comprova membership/rol abans de generar el ZIP.

[1.4] CONFIRMAT
- Evidència: functions/src/exports/closingBundleZip.ts:223-235; functions/src/exports/closingBundleZip.ts:337-392; functions/src/exports/closing-bundle/build-closing-data.ts:592-624; functions/src/exports/closing-bundle/build-closing-data.ts:631-739
- Resposta: El ZIP actual es construeix per streaming i inclou `README.txt`, `moviments.xlsx`, `resum.txt`, `debug/resum_debug.txt`, `debug/debug.xlsx` i `documents/{fitxer}` per als adjunts que s'han pogut descarregar.

[1.5] CONFIRMAT
- Evidència: functions/src/exports/closing-bundle/build-closing-data.ts:283-287; functions/src/exports/closing-bundle/build-closing-data.ts:294-330; functions/src/exports/closing-bundle/build-closing-data.ts:364-421
- Resposta: La selecció actual és `ledger-only`: exclou transaccions amb `deletedAt`, filles (`parentTransactionId`), `isRemittanceItem`, `source === 'remittance'` i els childs de Stripe (`transactionType === 'donation'` o `fee`). Les incidències derivades es calculen després sobre aquest conjunt filtrat.

## 2. Traçabilitat de dades

[2.1] CONFIRMAT
- Evidència: functions/src/exports/closingBundleZip.ts:333-359; functions/src/exports/closing-bundle/build-closing-data.ts:631-671
- Resposta: El total d'ingressos del període es calcula a `exportClosingBundleZip` com la suma de `transactions.amount > 0`. Aquest valor es calcula una vegada al flux del bundle i es passa a `buildSummaryText`, on acaba serialitzat a `resum.txt` com `Total ingressos`.

[2.2] CONFIRMAT
- Evidència: functions/src/exports/closingBundleZip.ts:333-359; functions/src/exports/closing-bundle/build-closing-data.ts:631-671
- Resposta: El total de despeses del període es calcula a `exportClosingBundleZip` com la suma de `transactions.amount < 0`. Es calcula una vegada al flux del bundle, es passa a `buildSummaryText` i acaba a `resum.txt` com `Total despeses`. El valor es conserva negatiu en el càlcul i només es renderitza amb `toFixed(2)`.

[2.3] CONFIRMAT
- Evidència: functions/src/exports/closingBundleZip.ts:333-359; functions/src/exports/closing-bundle/build-closing-data.ts:631-678; src/lib/importers/bank/bankStatementParser.ts:500-503; src/lib/importers/bank/bankStatementParser.ts:575-579; src/lib/importers/bank/bankStatementParser.ts:621-634
- Resposta: El flux actual del Closing Bundle no calcula ni serialitza saldo inicial ni saldo final bancari. El que sí existeix al repo és un càlcul d'`initialBalance` i `finalBalance` al parser d'extractes bancaris, no al bundle. Per tant, avui el bundle només produeix saldo net del període (`totalIncome + totalExpense`) a `resum.txt`; saldo inicial/final no existeixen en la seva estructura intermèdia actual.

[2.4] CONFIRMAT
- Evidència: functions/src/exports/closingBundleZip.ts:333-359; functions/src/exports/closing-bundle/build-closing-data.ts:300-331; functions/src/exports/closing-bundle/build-closing-data.ts:656-677; src/components/transactions-table.tsx:1080-1083; src/components/transactions/components/TransactionRow.tsx:260-263; src/components/transactions/components/TransactionRowMobile.tsx:143-146
- Resposta: El bundle calcula `totalWithDocRef` com `transactions.filter((t) => t.document).length` i `movimentsSenseDoc` com `statusCounts.noDocument`, que acaba a `resum.txt`. La UI de Movimientos reutilitza la mateixa idea bàsica de presència documental (`!!tx.document`) a les files, però el seu comptatge exportable de “despeses sense document” filtra només `amount < 0 && !tx.document`.
- NO VERIFICABLE: no es pot afirmar igualtat exacta entre el resum del bundle i cap comptador visible de la UI sense execució real, perquè el bundle compta tots els moviments sense document via `statusCounts.noDocument`, mentre que la UI exportable inspeccionada només agrega despeses sense document.

[2.5] CONFIRMAT
- Evidència: functions/src/exports/closing-bundle/closing-types.ts:11-19; functions/src/exports/closing-bundle/closing-types.ts:85-90; functions/src/exports/closing-bundle/build-closing-data.ts:364-421; functions/src/exports/closingBundleZip.ts:190-191; functions/src/exports/closingBundleZip.ts:347-359; functions/src/exports/closing-bundle/build-closing-data.ts:631-654
- Resposta: El shape real d'incidències és un únic array serialitzable `ClosingIncident[]` amb `{ txId, type, severity, message }`. `detectIncidents()` detecta `FALTA_DOCUMENT`, `SENSE_CATEGORIA`, `SENSE_CONTACTE`, `DEVOLUCIO_PENDENT` i `REMESA_PARCIAL` en una sola passada sobre `transactions`. Aquest array existeix junt a memòria a `exportClosingBundleZip`, però avui només se n'utilitza `incidents.length`; el paràmetre `totalIncidents` entra a `buildSummaryText`, però el text retornat no el renderitza.
- Evidència específica:
- `FALTA_DOCUMENT`: functions/src/exports/closing-bundle/build-closing-data.ts:370-378
- `SENSE_CATEGORIA`: functions/src/exports/closing-bundle/build-closing-data.ts:380-388
- `DEVOLUCIO_PENDENT`: functions/src/exports/closing-bundle/build-closing-data.ts:400-408
- `REMESA_PARCIAL`: functions/src/exports/closing-bundle/build-closing-data.ts:410-418

[2.6] CONFIRMAT
- Evidència: functions/src/exports/closing-bundle/build-closing-data.ts:314-330; functions/src/exports/closing-bundle/build-closing-data.ts:57-78; functions/src/exports/closing-bundle/build-closing-data.ts:107-127; functions/src/exports/closing-bundle/build-closing-data.ts:533-550; functions/src/exports/closing-bundle/build-closing-xlsx.ts:82-91
- Resposta: La categoria entra al flux com a lectura des de Firestore (`data.category`, `data.categoryName`) dins `loadTransactions`. El text humà per a l'Excel es resol a `buildManifestRows`: primer intenta `categoryName`, després `category`, i usa `resolveCategoryName()` sobre el `categoryMap` carregat per `loadCategoryMap()`. `buildMovimentsXlsx()` només consumeix el text humà ja resolt a `row.categoria`.

[2.7] CONFIRMAT
- Evidència: functions/src/exports/closing-bundle/build-closing-data.ts:314-330; functions/src/exports/closing-bundle/build-closing-data.ts:84-101; functions/src/exports/closing-bundle/build-closing-data.ts:132-138; functions/src/exports/closing-bundle/build-closing-data.ts:552-559; functions/src/exports/closing-bundle/build-closing-xlsx.ts:82-91
- Resposta: El contacte entra al flux com a lectura des de Firestore (`data.contactId`, `data.contactName`) dins `loadTransactions`. El text humà per a l'Excel es resol a `buildManifestRows`: prioritza `contactName` si no sembla un ID i, si no, resol `contactId` amb `resolveContactName()` sobre el `contactMap` carregat per `loadContactMap()`. `buildMovimentsXlsx()` només escriu el valor ja resolt a `row.contacte`.

## 3. Punts d'injecció reals

[3.1] CONFIRMAT
- Evidència: functions/src/exports/closingBundleZip.ts:190-217; functions/src/exports/closingBundleZip.ts:300-359; functions/src/exports/closingBundleZip.ts:362-395
- Resposta: `manifest.json` s'hauria d'escriure dins `exportClosingBundleZip`, després de la descàrrega documental i del càlcul de `statusCounts`, `totalIncome`, `totalExpense`, `totalWithDocRef` i `downloadedTxIds.size`, i abans de `archive.finalize()`. En aquest punt ja existeixen a memòria `transactions`, `incidents`, `diagnostics`, `docs`, `txWithDoc`, `statusCounts`, els totals i els comptatges de documents inclosos.
- Shape existent en aquell punt: `transactions: ClosingTransaction[]`, `incidents: ClosingIncident[]`, `diagnostics: Map<string, DocumentDiagnostic>`, `docs: ClosingDocumentInfo[]`, `txWithDoc: Map<string, ClosingDocumentInfo>`, `statusCounts: { ok, noDocument, urlNotParseable, bucketMismatch, notFound, downloadError }`, totals numèrics i `downloadedTxIds: Set<string>`. Evidència: functions/src/exports/closing-bundle/closing-types.ts:39-51; functions/src/exports/closing-bundle/closing-types.ts:85-98; functions/src/exports/closingBundleZip.ts:176-217; functions/src/exports/closingBundleZip.ts:300-359
- Segona passada de pipeline: no, si el manifest només consumeix l'estat ja materialitzat abans de `finalize()`.
- Invariant/risc a preservar: si el manifest ha de reflectir l'estat final dels documents inclosos/no inclosos, s'ha d'injectar després del bucle de descàrrega, no abans. Evidència: functions/src/exports/closingBundleZip.ts:240-298; functions/src/exports/closingBundleZip.ts:300-331
- Refactor estimat: `moderat`

[3.2] CONFIRMAT
- Evidència: functions/src/exports/closing-bundle/build-closing-data.ts:364-421; functions/src/exports/closing-bundle/closing-types.ts:85-90; functions/src/exports/closing-bundle/build-closing-xlsx.ts:7-8; functions/src/exports/closing-bundle/build-closing-xlsx.ts:82-149; functions/src/exports/closingBundleZip.ts:190-191; functions/src/exports/closingBundleZip.ts:337-344
- Resposta: `incidencies.xlsx` s'hauria de construir a `exportClosingBundleZip`, reutilitzant la mateixa capa `xlsx` que ja fa servir `buildMovimentsXlsx()` i `buildDebugXlsx()`. Les incidències de negoci ja existeixen totes juntes com un únic array `ClosingIncident[]` retornat per `detectIncidents()`, de manera que no cal cap relectura de dades per generar un workbook basat només en aquest conjunt.
- Shape existent en aquell punt: `ClosingIncident[]` amb `txId`, `type`, `severity`, `message`. Evidència: functions/src/exports/closing-bundle/closing-types.ts:85-90; functions/src/exports/closing-bundle/build-closing-data.ts:364-421
- Segona passada de pipeline: no per a incidències de negoci; sí cal una derivació addicional si aquest workbook també ha d'incorporar fallades de resolució documental, perquè aquestes viuen a `diagnostics` i queden completes només després del bucle de descàrrega. Evidència: functions/src/exports/closingBundleZip.ts:210-217; functions/src/exports/closingBundleZip.ts:240-298; functions/src/exports/closingBundleZip.ts:375-392
- Invariant/risc a preservar: no confondre incidències de negoci (`detectIncidents`) amb diagnòstic documental (`DocumentDiagnosticStatus`), perquè avui són dos canals separats.
- Refactor estimat: `moderat`

[3.3] CONFIRMAT
- Evidència: src/lib/closing-bundle/closing-bundle-types.ts:16-31; src/components/reports/closing-bundle-dialog.tsx:47-64; src/components/reports/closing-bundle-dialog.tsx:198-217; src/app/api/exports/closing-bundle-zip/route.ts:25-43; functions/src/exports/closingBundleZip.ts:117-133; src/lib/read-models/transactions.ts:93-117; src/i18n/locales/ca.json:4027-4030; src/i18n/locales/es.json:4027-4030; src/i18n/locales/fr.json:4027-4030; src/i18n/locales/pt.json:3922-3925
- Resposta: El preset trimestral no existeix avui al Closing Bundle. El tipus actual del selector és `PeriodOption = 'current_year' | 'previous_year' | 'custom'`, i el diàleg només renderitza aquests tres valors. El backend no rep cap semàntica de període: la route només valida `orgId` i reenvia el body, i la Function només valida `dateFrom/dateTo` amb format `YYYY-MM-DD`.
- Shape existent en aquell punt: contracte backend actual `ClosingBundleRequest = { orgId, dateFrom, dateTo }`. Evidència: src/lib/closing-bundle/closing-bundle-types.ts:5-9; functions/src/exports/closing-bundle/closing-types.ts:5-9
- Segona passada de pipeline: no, si el preset trimestral es resol al client a `from/to`. El repo ja té una utilitat de càlcul trimestral reutilitzable a `resolvePeriodRange()` d'un altre mòdul. Evidència: src/lib/read-models/transactions.ts:98-117
- Fitxers exactes a tocar per implementar-lo sense canviar el contracte backend: `src/lib/closing-bundle/closing-bundle-types.ts`, `src/components/reports/closing-bundle-dialog.tsx` i les claus de traducció del bloc `reports.closingBundle.period*` a `src/i18n/locales/*.json`.
- Invariant/risc a preservar: mantenir `dateFrom/dateTo` com a únic contracte backend evita tocar route i Function; si s'introdueix semàntica de període al backend, ja no seria el mateix canvi.
- Refactor estimat: `trivial`

[3.4] CONFIRMAT
- Evidència: src/lib/permissions.ts:76-100; src/hooks/use-permissions.ts:16-30; src/app/api/exports/closing-bundle-zip/route.ts:45-52; functions/src/exports/closingBundleZip.ts:137-150; src/lib/__tests__/permissions.test.ts:16-58
- Resposta: El model més estructural avui al codi és el de permisos efectius basat en `src/lib/permissions.ts`: el consumeix la UI via `usePermissions()` i la route via `requirePermission()`. La Cloud Function del bundle fa servir un model diferent i més estret, basat només en `member.role`.
- Fitxers exactes a tocar per unificar: com a mínim `functions/src/exports/closingBundleZip.ts` i, segons el model final triat, també `src/app/api/exports/closing-bundle-zip/route.ts` o la capa comuna de permisos. El contracte de permisos efectius ja té tests propis a `src/lib/__tests__/permissions.test.ts`.
- Segona passada de pipeline: no aplica; és una alineació d'autorització entre capes.
- Invariant/risc a preservar: no trencar el bypass de `systemSuperAdmins`/membership validada que ja usa la route. Evidència: src/lib/api/admin-sdk.ts:130-160; src/lib/api/require-permission.ts:18-37
- NO VERIFICABLE: no es pot afirmar només des del codi inspeccionat quins fixtures específics del Closing Bundle caldria afegir o tocar, perquè el flux del bundle no té un harness propi localitzat en aquest worktree.
- Refactor estimat: `requereix repensar`

[3.5] CONFIRMAT
- Evidència: functions/src/exports/closing-bundle/build-closing-data.ts:197-254; functions/src/exports/closing-bundle/build-closing-data.ts:260-270; functions/src/exports/closingBundleZip.ts:240-298; functions/src/exports/closingBundleZip.ts:300-331; functions/src/exports/closingBundleZip.ts:375-392
- Resposta: `document_no_resoluble` no té avui un únic punt literal, però sí un punt comú estructural: el `DocumentDiagnostic.status`. Els casos previs a descàrrega (`NO_DOCUMENT`, `URL_NOT_PARSEABLE`, `BUCKET_MISMATCH`) neixen a `diagnoseTxDocument()` i els casos posteriors (`NOT_FOUND`, `DOWNLOAD_ERROR`) s'assignen al bucle de descàrrega. La capa comuna on fer-lo visible sense dispersar lògica és després de tenir `diagnostics` complet i abans de `archive.finalize()`.
- Shape existent en aquell punt: `Map<string, DocumentDiagnostic>` + `statusCounts` + `debugRows`. Evidència: functions/src/exports/closing-bundle/closing-types.ts:39-51; functions/src/exports/closingBundleZip.ts:210-217; functions/src/exports/closingBundleZip.ts:300-331; functions/src/exports/closingBundleZip.ts:375-392
- Segona passada de pipeline: no cal segona passada de dades, però sí una derivació comuna a partir de `diagnostics` si es vol materialitzar una visibilitat nova al ZIP o al resum.
- Invariant/risc a preservar: no duplicar el diagnòstic en dos llocs separats; avui tota la taxonomia de resolució documental està centrada a `DocumentDiagnosticStatus`.
- Refactor estimat: `moderat`

## 4. Límits i comportament observable

[4.1] CONFIRMAT
- Evidència: functions/src/exports/closingBundleZip.ts:182-184; src/app/api/exports/closing-bundle-zip/route.ts:78-82; src/components/reports/closing-bundle-dialog.tsx:121-139; src/i18n/locales/ca.json:4020-4024
- Resposta: Si no hi ha moviments al període, la Function retorna `400` amb `{ code: 'NO_TRANSACTIONS', message: 'No hi ha moviments en aquest període' }`. La route no el transforma: si l'upstream és JSON, el reexpedeix amb el mateix `status`. El client llegeix el codi `NO_TRANSACTIONS` i substitueix el missatge per la traducció `reports.closingBundle.errors.noTransactions`, mostrada en un toast destructiu.

[4.2] CONFIRMAT
- Evidència: functions/src/exports/closing-bundle/closing-types.ts:116; functions/src/exports/closing-bundle/build-closing-data.ts:429-469; functions/src/exports/closing-bundle/build-closing-data.ts:476-484; functions/src/exports/closingBundleZip.ts:214-220; src/components/reports/closing-bundle-dialog.tsx:125-128
- Resposta: El límit de 120 documents es valida a `validateLimits()` sobre `docs.length`, abans de començar qualsevol descàrrega. Si se supera, la Function retorna `400 LIMIT_EXCEEDED` i no entra cap document al ZIP, perquè no hi ha cap lògica de truncament o selecció parcial; l'array `docs` ja és determinista perquè es construeix en l'ordre de `transactions`, però aquest ordre no s'usa per “deixar-ne entrar 120”, perquè el flux aborta completament. El client veu un toast genèric de “massa documents”.

[4.3] CONFIRMAT
- Evidència: functions/src/exports/closing-bundle/closing-types.ts:117; functions/src/exports/closing-bundle/build-closing-data.ts:486-513; functions/src/exports/closingBundleZip.ts:217-220; src/components/reports/closing-bundle-dialog.tsx:125-128
- Resposta: El límit de 350 MB es valida també a `validateLimits()`, sumant metadata de mida de cada `doc.storagePath`. Si el total supera el màxim, la Function retorna `400 LIMIT_EXCEEDED`. La route el propaga tal qual i el client torna a mostrar el mateix missatge genèric de “massa documents”; el detall de mida calculada (`${totalSizeMB.toFixed(1)} MB`) no arriba a l'usuari perquè el client sobreescriu `error.message` amb la traducció genèrica.

[4.4] CONFIRMAT
- Evidència: functions/src/exports/closingBundleZip.ts:66-69; functions/src/exports/closingBundleZip.ts:240-298; functions/src/exports/closing-bundle/build-closing-data.ts:486-513
- Resposta: És verificable al codi que la Function té `timeoutSeconds: 360`, `memory: '1GB'`, que la validació de mida fa `getMetadata()` seqüencial per document i que la descàrrega del ZIP fa `exists()` i `download()` seqüencials, document a document.
- NO VERIFICABLE: no es pot afirmar des del codi a partir de quin volum o latència real aquest flux començarà a degradar-se o a fer timeout, perquè això depèn de Firestore, Storage, mida real dels fitxers i xarxa en execució.

## 5. Casos exhaustius de no resolució documental

[5.1] CONFIRMAT
- Evidència: functions/src/exports/closing-bundle/closing-types.ts:28-34; functions/src/exports/closing-bundle/build-closing-data.ts:203-213; functions/src/exports/closingBundleZip.ts:310-330; functions/src/exports/closing-bundle/build-closing-data.ts:656-677; functions/src/exports/closing-bundle/build-closing-data.ts:720-737
- Resposta: `NO_DOCUMENT` és el cas “sense document”. Es genera a `diagnoseTxDocument()` quan `tx.document` és nul/falsy. No es loggeja. Es compta a `statusCounts.noDocument`. Arriba a `resum.txt` com `Moviments sense document` i també a `debug/resum_debug.txt` i `debug/debug.xlsx`.

[5.2] CONFIRMAT
- Evidència: functions/src/exports/closing-bundle/build-closing-data.ts:216-229; functions/src/exports/closingBundleZip.ts:310-330; functions/src/exports/closing-bundle/build-closing-data.ts:720-737
- Resposta: `URL_NOT_PARSEABLE` és el cas “URL no parsejable”. Es genera a `diagnoseTxDocument()` quan `extractStorageRef()` no pot extreure `path`. No es loggeja en aquest flux. Es compta a `statusCounts.urlNotParseable`. No apareix desglossat a `resum.txt`; només queda visible a `debug/resum_debug.txt` i `debug/debug.xlsx`.

[5.3] CONFIRMAT
- Evidència: functions/src/exports/closing-bundle/build-closing-data.ts:231-242; functions/src/exports/closingBundleZip.ts:310-330; functions/src/exports/closing-bundle/build-closing-data.ts:720-737
- Resposta: `BUCKET_MISMATCH` és el cas “bucket mismatch”. Es genera a `diagnoseTxDocument()` quan el bucket deduït de la referència documental no coincideix amb el bucket configurat. No es loggeja en aquest flux. Es compta a `statusCounts.bucketMismatch`. No apareix desglossat a `resum.txt`; només queda visible a `debug/resum_debug.txt` i `debug/debug.xlsx`.

[5.4] CONFIRMAT
- Evidència: functions/src/exports/closingBundleZip.ts:248-259; functions/src/exports/closingBundleZip.ts:310-330; functions/src/exports/closing-bundle/build-closing-data.ts:720-737
- Resposta: `NOT_FOUND` és el cas “fitxer no trobat”. Es produeix al bucle de descàrrega quan `file.exists()` retorna `false`. Sí que es loggeja amb `functions.logger.warn`. Es compta a `statusCounts.notFound`. No apareix desglossat a `resum.txt`; només queda visible a `debug/resum_debug.txt` i `debug/debug.xlsx`.

[5.5] CONFIRMAT
- Evidència: functions/src/exports/closingBundleZip.ts:262-297; functions/src/exports/closingBundleZip.ts:310-330; functions/src/exports/closing-bundle/build-closing-data.ts:720-737
- Resposta: `DOWNLOAD_ERROR` és el cas “error de descàrrega”. Es produeix al `catch` del bucle de descàrrega quan `download()` o passos adjacents fallen. Sí que es loggeja amb `functions.logger.warn`. Es compta a `statusCounts.downloadError`. No apareix desglossat a `resum.txt`; només queda visible a `debug/resum_debug.txt` i `debug/debug.xlsx`.

[5.6] CONFIRMAT
- Evidència: functions/src/exports/closing-bundle/closing-types.ts:28-34; functions/src/exports/closingBundleZip.ts:300-331
- Resposta: No hi ha altres casos de “document no entra al ZIP” tipats dins `DocumentDiagnosticStatus` a banda de `NO_DOCUMENT`, `URL_NOT_PARSEABLE`, `BUCKET_MISMATCH`, `NOT_FOUND` i `DOWNLOAD_ERROR`. L'únic estat addicional és `OK`, que representa document resolt i descarregat.

| Canvi proposat | Risc tècnic real | Refactor estimat |
|---|---|---|
| `manifest.json` | S'ha d'injectar després de completar descàrregues i comptatges finals perquè no neixi amb estat documental incomplet. Evidència: functions/src/exports/closingBundleZip.ts:240-359 | `moderat` |
| `incidencies.xlsx top-level` | Les incidències de negoci ja existeixen en un únic array, però el diagnòstic documental viu en una estructura diferent; cal no barrejar canals sense criteri. Evidència: functions/src/exports/closing-bundle/build-closing-data.ts:364-421; functions/src/exports/closingBundleZip.ts:375-392 | `moderat` |
| `preset trimestral` | El backend actual només coneix `dateFrom/dateTo`; el canvi és local al client si es manté aquest contracte. Evidència: src/lib/closing-bundle/closing-bundle-types.ts:16-31; functions/src/exports/closingBundleZip.ts:117-133 | `trivial` |
| `permisos alineats` | Hi ha dos models d'autorització diferents entre route i Function; unificar-los implica escollir font estructural de veritat. Evidència: src/lib/permissions.ts:76-100; src/app/api/exports/closing-bundle-zip/route.ts:45-52; functions/src/exports/closingBundleZip.ts:137-150 | `requereix repensar` |
| `document_no_resoluble visible` | La taxonomia ja existeix, però està repartida entre prediagnòstic i postdescàrrega; cal una sortida visible comuna sense duplicar lògica. Evidència: functions/src/exports/closing-bundle/build-closing-data.ts:197-254; functions/src/exports/closingBundleZip.ts:240-331 | `moderat` |
