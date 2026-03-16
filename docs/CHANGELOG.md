# CHANGELOG — resum recent

Aquest fitxer ja no pretén duplicar el document mestre.

Ús correcte:

- per entendre l'estat funcional actual: `docs/SUMMA-SOCIAL-REFERENCIA-COMPLETA.md`
- per veure l'historial ampli anterior: `docs/archive/changelog/CHANGELOG-pre-2026-03-08.md`
- per veure logs de desplegament: `docs/DEPLOY-LOG.md`

## Resum dels canvis recents

### 2026-03-16

- importador Stripe: suport per `paid`/`Paid`, parsing d'imports amb coma decimal, files sense `Transfer` ignorades fins que existeixi payout i detecció bancària ampliada amb patrons reals de Stripe

### 2026-03-12

- invariant documental de remeses IN: `parentTransactionId` canònic, `remittanceId` només metadada, checks sobre filles actives reals

### 2026-02-25

- alineació del document mestre amb el contracte real d'import bancari
- correcció del dedupe fort sense fallback
- model de permisos alineat amb `capabilities`

### 2026-02-14

- millora de la capa editorial `guides.*` i de l'assistent d'ajuda
- redisseny de Torre de Control a `/admin`
- correccions operatives en resums i bypass SuperAdmin

### 2026-02-12

- SEPA pain.008 amb periodicitat intel·ligent
- millores d'UI i selecció forçada amb revisió
- suggeriments de renom per documents

### 2026-02-11

- persona de contacte per empreses a Donants
- nous filtres al dashboard de Donants
- accés operatiu unificat i ajustos a Firestore Rules

### 2026-02-10

- helper compartit `admin-sdk`
- pre-selecció SEPA per periodicitat
- gate fort d'i18n i health checks nous

### 2026-01-15

- desactivació dels backups al núvol com a funcionalitat estàndard
- consolidació del backup local com a mecanisme actiu

## Nota

Aquest resum és intencionalment curt.

Quan un canvi quedi consolidat al document mestre, aquest fitxer només n'ha de conservar la traça històrica útil, no la descripció exhaustiva.
