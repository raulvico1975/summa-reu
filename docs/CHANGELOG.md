# CHANGELOG — resum recent

Aquest fitxer ja no pretén duplicar el document mestre.

Ús correcte:

- per entendre l'estat funcional actual: `docs/SUMMA-SOCIAL-REFERENCIA-COMPLETA.md`
- per veure l'historial ampli anterior: `docs/archive/changelog/CHANGELOG-pre-2026-03-08.md`
- per veure logs de desplegament: `docs/DEPLOY-LOG.md`

## Resum dels canvis recents

### 2026-03-26

- novetats de producte: web públic més descobrible (enllaç visible a home/header), sitemap amb rutes de detall i publicació/despublicació server-to-server més robusta
- mòdul projectes: les despeses bancàries negatives sense categoria entren al feed com "Categoria pendent" i queden bloquejades per assignació fins recategoritzar
- bot d'ajuda: ampliada cobertura operativa amb noves guies i millor desambiguació/retrieval
- operativa App Hosting: afegit secret `PRODUCT_UPDATES_PUBLISH_SECRET` per al flux oficial `POST /api/product-updates/publish`

### 2026-03-27

- API/integracions: `POST /api/product-updates/publish` admet `locale` base (`ca|es`), `locales.es` opcional i auto-genera variant castellana quan la base és `ca`; el write públic persisteix `web.locale` i `web.locales.es` per servir copy per idioma
- codi intern: nova capa `src/lib/product-updates/localized.ts` per resoldre copy efectiva d'app i web; FR/PT reutilitzen variant ES quan existeix; cobertura de tests ampliada per publicació i lectura localitzada
- documentació per usuari: web pública de novetats (home, llistat i detall) mostra contingut per idioma i elimina blocs redundants de copy per deixar context més net
- operativa: home/llistat/detall de novetats públiques passen a `dynamic = 'force-dynamic'` per evitar HTML congelat després de publish

### 2026-03-17

- Stripe deixa de dividir remeses: nou flux d'imputació sobre abonament bancari amb persistència a `donations`, anti-duplicació per `stripePaymentId` i undo per `parentTransactionId`
- fitxa del donant: les donacions Stripe imputades es llegeixen des de `donations` sense contaminar el ledger visual ni duplicar la lectura legacy
- fiscalitat: informes, certificats i Model 182 incorporen `donations` com a font fiscal nova, exclouen `stripe_adjustment` i eviten doble còmput amb `transactions`
- infra requerida: nou índex compost de `contacts` per `type ASC` + `name ASC`

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
