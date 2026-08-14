# ADR — Entitlements de plans v1 i tall vertical de documents

Estat: implementat en codi, pendent de migració i activació operativa.

## Decisió

Summa Social usa un catàleg versionat amb tres plans canònics: `control`, `management` i `complete`. Els identificadors legacy es normalitzen explícitament: `initial -> control` i `fiscal_documents -> complete`. No s'utilitzen comparacions per rang de pla.

La projecció autoritativa és `organizations/{orgId}/subscription/current`, generada només al backend. Des del catàleg v3, l'autoritat compacta és el tuple `planId + status + catalogVersion + catalogFingerprint`; el mapa `entitlements` es conserva només com a dada auditable i no participa en cap decisió d'accés. El client pot llegir la projecció però no escriure-la. El mode d'enforcement és global i únic a `system/entitlements`; no forma part de la projecció per organització.

L'accés final a una mutació és sempre:

`entitlement comercial AND configuració operativa AND permís de l'usuari`.

La configuració operativa només pot restringir. Mai pot concedir una capacitat que el pla no tingui.

## Catàleg v3

| Capacitat | Control | Gestió | Complet |
|---|---:|---:|---:|
| `transactionDocuments.readHistorical` | Sí | Sí | Sí |
| `transactionDocuments.mutate` | No | Sí | Sí |
| `pendingDocuments.mutate` | No | No | Sí |

`transactionDocuments.mutate` cobreix pujar, vincular, substituir, marcar com a principal, desvincular i eliminar. `pendingDocuments.mutate` cobreix el circuit pre-banc i, en les rutes que acaben vinculant un document pendent a un moviment, s'exigeixen totes dues capacitats.

## Invariants

1. Control conserva lectura, descàrrega i exportació de documents històrics.
2. Un downgrade no esborra, mou ni transforma documents o transaccions.
3. Control no pot fer cap mutació documental, inclòs posar el camp legacy `document` a `null`, eliminar subdocuments, eliminar fitxers de Storage o eliminar una transacció que conserva un document.
4. Una subscripció absent, desconeguda, inactiva, amb versió incorrecta o fingerprint absent/incoherent resol com a Control quan el mode global és `active`.
5. En `off` i `shadow`, una subscripció absent continua en fail-open per facilitar la migració, però la configuració operativa i els permisos personals segueixen aplicant-se.
6. El mode global preval sobre qualsevol dada local. No hi ha override de mode per organització.
7. `subscription/current` i el registre d'auditoria s'actualitzen atòmicament amb el registre legacy de facturació.
8. Cap escriptura inclou `undefined`; les operacions de backfill futures es limiten a chunks de 50.

## Modes i shadow

- `off`: calcula el catàleg però no aplica denegacions comercials.
- `shadow`: permet l'operació. Les rutes servidor registren diagnòstics sense dades sensibles; les accions client i les Rules encara no tenen telemetria durable.
- `active`: aplica el catàleg; absent o corrupte és Control segur.

No es pot passar a `active` fins que:

- existeixi `system/entitlements` amb versió i mode vàlids;
- el dry-run no tingui cap organització activa a `blocked`;
- totes les organitzacions tinguin una projecció coherent amb el catàleg v3 i el fingerprint exacte del seu pla;
- un informe repetible de projeccions confirmi zero `subscription_absent`, `plan_unknown`, `catalog_version_mismatch` i `catalog_fingerprint_mismatch`; la telemetria shadow durable per accions client/Rules queda com a gate pendent abans d'`active`;
- s'hagin verificat manualment un Control, una Gestió, un Complet, un upgrade i un downgrade;
- Firestore i Storage rules estiguin desplegades abans o al mateix release que l'activació.

La prova semàntica local correlaciona el log de Rules amb cada operació. Un `ALLOW` no pot emetre cap error d'avaluació. Un `DENY` pot incloure l'error fail-closed documentat per Firebase només dins la seva finestra i en línies explícitament allowlisted; qualsevol línia nova, error no correlacionat, límit de 1.000 expressions o funció inexistent fa fallar el runner.

## Backfill preparat, no executat

`scripts/migrations/plan-entitlements-backfill-dry-run.ts` només llegeix un JSON local i genera un informe. És idempotent, no connecta amb Firebase, separa registres ambigus a `blocked`, no converteix estats desconeguts en actius i produeix chunks màxims de 50. Aquest canvi no executa cap migració real.

## Downgrade i dades existents

El downgrade actualitza root legacy, projecció i auditoria en una única transacció Admin SDK. No toca `transactions`, `transactions/{id}/documents`, `pendingDocuments` ni Storage. Després del downgrade, els documents existents continuen visibles però totes les mutacions queden denegades a UI, API, Firestore i Storage.

## Superfícies protegides

- Diàleg de documents, files desktop i mòbil, menú i drag & drop.
- Accions documentals del mòdul de projectes només quan la despesa prové d'un moviment bancari; els adjunts `offBankExpenses` no canvien.
- Camp legacy `transactions.document`, subcol·lecció `transactions/{id}/documents` i eliminació del parent amb document.
- Storage canònic `organizations/{orgId}/documents/**` i legacy `transactions/**`.
- Rutes Admin de link/relink de documents pendents; l'upload pre-banc exigeix Complet.
- Obertura de documents de moviments amb permís `moviments.read`; el pla no bloqueja lectura històrica.

## Riscos i desplegament

Risc ALT perquè canvia Firestore Rules, Storage Rules i rutes Admin. El canvi s'ha de desplegar en ordre controlat: codi compatible amb `off`, regles, configuració global explícita `off`, dry-run, backfill autoritzat, `shadow`, validació, i finalment `active`. Qualsevol incidència es reverteix tornant el mode global a `shadow` o `off`; mai s'han d'esborrar projeccions ni documents com a rollback.
