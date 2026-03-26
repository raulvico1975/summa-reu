# DEV SOLO MANUAL — SUMMA SOCIAL

> Manual operatiu per al mantenidor únic del projecte.
> Objectiu: tornar a entendre el projecte en 10 minuts després de mesos sense tocar-lo.

---

## 0. Com usar aquest document (30 segons)

1. **Estàs perdut?** Comença per la secció 2 (Mapa d'eines)
2. **Tens un problema d'usuari?** Secció 3 (Fluxos de suport)
3. **Has de tocar codi?** Secció 4.1 (Checklist abans de producció)
4. **No recordes on és algo?** Secció 6 (Estructures del codi)

No llegeixis tot. Consulta el que necessitis.

---

## 1. Mapa del sistema (què és i què NO és Summa Social)

### Què FA Summa Social

- **Conciliació bancària real**: Importació de moviments bancaris (Norma 43, CSV)
- **Control de saldos**: Seguiment de balanç operatiu per període
- **Classificació determinista**: Categories, projectes, donants
- **Fiscalitat espanyola**: Model 182, Model 347, certificats de donació
- **Exports per a gestories**: Excel, CSV, formats estàndard

### Què NO és Summa Social

- ❌ **NO és un ERP genèric** — No gestiona inventari, nòmines, facturació completa
- ❌ **NO és un gestor de projectes** — El mòdul projectes és només per justificació econòmica
- ❌ **NO és comptabilitat formal** — És pre-comptabilitat per entitats petites
- ❌ **NO és multi-país** — Només Espanya (fiscalitat, formats bancaris)

### Stack tecnològic

| Capa | Tecnologia |
|------|------------|
| Frontend | Next.js 15 (App Router), React 18, TypeScript |
| Estils | Tailwind CSS, shadcn/ui |
| Backend | Firebase (Firestore, Auth, Storage, Functions) |
| Hosting | Firebase Hosting / App Hosting |
| Idiomes | Català (principal), Castellà, Francès |

---

## 2. Mapa d'eines (on mirar segons el problema)

| Eina | Per a què | Quan s'hi entra |
|------|-----------|-----------------|
| **Firebase Console** | Veure dades, usuaris, logs | Diagnòstic de producció, veure errors |
| **Cloud Logging** | Logs detallats de Cloud Functions | Errors de remeses, importacions, emails |
| **GitHub** | Codi font, PRs, historial | Canvis de codi, revisar versions |
| **VS Code + Codex** | Desenvolupament local | Fer canvis, debugging |
| **`/docs`** | Documentació del projecte | Entendre decisions, especificacions |
| **`/admin`** | Panell SuperAdmin | Gestió d'organitzacions, reset passwords |

### Enllaços ràpids

- Firebase Console: `console.firebase.google.com` → projecte `summa-social`
- Cloud Logging: Firebase Console → Build → Functions → Logs
- GitHub: (afegir URL del repositori)

---

## 3. Fluxos de suport habituals

### 3.1 Usuari no pot iniciar sessió

**Flux correcte (l'usuari ho fa sol):**
1. Pantalla login → "Has oblidat la contrasenya?"
2. Introdueix email
3. Rep correu de Firebase Auth
4. Restableix contrasenya

**Rol del SuperAdmin:**
- **Pot fer:** Enviar correu de reset des de `/admin` → Usuaris → "Enviar reset"
- **NO pot fer:** Veure ni canviar contrasenyes manualment
- **NO ha de fer:** Crear contrasenyes noves per l'usuari

**Si el correu no arriba:**
1. Verificar que l'email és correcte
2. Mirar carpeta spam
3. Comprovar a Firebase Console → Authentication si l'usuari existeix

---

### 3.2 Problemes d'importació

(pendent d'omplir)

---

### 3.3 Desquadraments i saldos

(pendent d'omplir)

---

### 3.4 Errors amb remeses / splits

(pendent d'omplir)

---

## 4. Checklists "no pensar"

### 4.1 Abans de tocar producció

```
□ git status → branca neta, sense canvis pendents
□ git pull → tinc l'última versió
□ node scripts/check-build-env.mjs → env mínim de build validat
□ npm run build → compila sense errors
□ Si sóc al repo de control, estic a `main`
□ Si implemento, estic dins d'un worktree de tasca (`codex/*`)
□ He llegit el que vaig a tocar (no codi a cegues)
□ Tinc backup mental del que faré (puc desfer-ho)
```

**Regla d'or:** Si no pots explicar el canvi en una frase, no el facis.

---

### 4.1b Hook: bloqueig de commits a prod

El hook Husky (`.husky/pre-commit`) bloqueja `git commit` si estàs a la branca `prod`. Això s'aplica automàticament perquè el projecte ja usa Husky (`core.hooksPath = .husky/_`).

**No es pot desactivar:** `--no-verify` queda prohibit en qualsevol cas.

**Per què:** el model `worktree de tasca → main → prod` depèn dels checks per evitar regressions i errors silenciosos.

---

### 4.1c Treball en paral·lel amb worktrees (obligatori)

Aquest manual no redefineix el contracte. L'autoritat és:

- `docs/DEPLOY.md` per al dubte curt
- `docs/GOVERN-DE-CODI-I-DEPLOY.md` per a la norma llarga
- `docs/REPO-HIGIENE-I-DIAGNOSTIC.md` per a bloquejos i residus

Checklist pràctica:

1. El repositori de control és `/Users/raulvico/Documents/summa-social`.
2. Des del control (`main`, net): `npm run inicia` o `npm run implementa`.
3. El sistema crea branca `codex/*` + worktree extern.
4. Implementar només dins del worktree.
5. `npm run acabat` només valida, commita i puja la branca.
6. `npm run integra` s'executa després, des del repositori de control.
7. `npm run status` és la font única d'estat.

Operacions de manteniment:

- `npm run worktree:list` per inspeccionar worktrees actius i residus
- `npm run worktree:close` per tancar un worktree que ja no ha de continuar viu
- `npm run worktree:gc` per neteja segura després de revisar l'estat

Regla pràctica:

- si `npm run status` diu `BLOQUEJAT`, no interpretis res ni facis deploy; primer diagnostica el repo

### Bloqueig d’artefactes

El sistema impedeix commitejar dependències i artefactes de build encara que s’intentin afegir manualment.

En cas de test intern del mecanisme, pot ser necessari utilitzar `git add -f` per simular un intent maliciós i validar que el workflow el bloqueja correctament.

---

### 4.2 Gate de producció (obligatori)

**Abans de push a prod** (via deploy des de `main`), si el canvi toca Moviments, Remeses, Devolucions, Donants, Certificats, Imports o Permisos:

```
□ scripts/verify-ci.sh ✅ (typecheck + tests + env de build + build)
□ scripts/verify-local.sh ✅ (env de build + build + checks fiables i18n / undefined)
□ docs/QA-FISCAL.md completat amb PASS/FAIL ✅
```

**Sense això: prohibit push.**

**Nota de tancament operatiu — Read Models Fase 1 (2026-03-11)**
1. La fase 1 de read models queda funcionalment acceptada amb el patch posterior de `transactions-table`.
2. La regressió detectada va ser: cerca i filtres de Moviments treballant sobre un dataset parcial paginat.
3. La correcció aplicada va ser: bloqueig honest de resultats fins completar la resolució suficient, evitant resultats parcials enganyosos.
4. `main` queda apte per esperar deploy, però sense desplegar encara.
5. Millora estructural pendent:
   - portar cerca i filtres de Moviments a backend

Guia ràpida d'execució: [scripts/verify-fiscal.md](../scripts/verify-fiscal.md)

---

### 4.3 Desplegament

Aquest manual no reescriu el ritual de deploy. Per govern i autoritat:

- `docs/DEPLOY.md`
- `docs/GOVERN-DE-CODI-I-DEPLOY.md`
- `docs/REPO-HIGIENE-I-DIAGNOSTIC.md`

Checklist pràctica abans de publicar:

```bash
npm run status
npm run worktree:list
npm run integra
npm run status
npm run publica
```

Regles pràctiques:

- `npm run acabat` no integra.
- `npm run integra` és l'única porta d'entrada a `main`.
- `npm run publica` és l'única porta d'entrada a `prod`.
- si `npm run status` diu `BLOQUEJAT`, no es publica
- si hi ha residus, primer aplica `worktree:close`, `worktree:gc` o el diagnòstic del document de higiene

---

### 4.4 Incidències

Consulta la secció 9 (Salut del sistema).

---

## 5. Glossari mínim del sistema

| Terme | Significat |
|-------|------------|
| **Transacció** | Moviment bancari (positiu = ingrés, negatiu = despesa) |
| **Contacte** | Donant, proveïdor, soci... qualsevol entitat externa |
| **Remesa** | Agrupació de transaccions (donacions domiciliades, pagaments SEPA) |
| **Split** | Divisió d'una transacció en parts assignades a projectes |
| **Projecte** | Eix d'actuació per justificació (subvencions, programes) |
| **Partida** | Línia de pressupost dins d'un projecte |
| **Categoria** | Classificació comptable (nòmines, subministraments, donacions...) |

---

## 6. Estructures del codi que sempre s'obliden

### Carpetes clau

```
src/
├── app/                    # Pàgines (Next.js App Router)
│   ├── [orgSlug]/         # Rutes per organització (multi-tenant)
│   │   └── dashboard/     # Tot el dashboard
│   └── admin/             # Panell SuperAdmin
├── components/            # Components React reutilitzables
├── lib/                   # Lògica de negoci pura (NO React)
│   └── data.ts           # TIPUS PRINCIPALS (Transaction, Contact, Organization...)
├── hooks/                 # Custom hooks
├── firebase/              # Configuració i helpers Firebase
└── i18n/                  # Traduccions (ca.ts, es.ts, fr.ts)
```

### Fitxers "punt d'entrada"

| Fitxer | Conté |
|--------|-------|
| `src/lib/data.ts` | Tots els tipus TypeScript del sistema |
| `src/lib/normalize.ts` | Funcions de format (moneda, dates, NIF) |
| `src/firebase/index.ts` | Hooks Firebase (`useCollection`, `useDocument`) |
| `src/hooks/organization-provider.tsx` | Context de l'organització actual |
| `src/i18n/index.ts` | Hook `useTranslations()` |

### Patrons que si es trenquen fan mal

1. **Multi-tenant via `[orgSlug]`**: Tota dada viu sota `/organizations/{orgId}/...`
2. **Firestore Rules**: Defineixen qui pot llegir/escriure — no tocar sense revisar
3. **Tipus a `data.ts`**: Si canvies un tipus, pot trencar moltes coses
4. **Cloud Functions**: Són backend real — errors aquí no es veuen a la UI

### Writes de contactes (UPDATE) via API

**Per què:** Les Firestore Rules d'immutabilitat dels camps `archivedAt`/`archivedByUid`/`archivedFromAction` (guardrails C2/C3) bloquegen qualsevol `setDoc(merge: true)` client-side que no inclogui explícitament aquests camps. Amb `merge: true`, Firestore interpreta un camp absent com a `null`, que difereix del valor existent → `permission-denied`.

**Norma:** El client **no fa updates directes** a `organizations/{orgId}/contacts/{contactId}`. Tots els updates passen per API Admin SDK.

**Endpoint:** `POST /api/contacts/import`
- Valida `Authorization: Bearer <idToken>` + member role `admin|user`
- Descarta `archived*` del payload client
- Preserva `archived*` del document existent
- Escriu amb Admin SDK `batch.set(merge: true)` (bypassa Firestore Rules)

**Fitxers:**
- API: `src/app/api/contacts/import/route.ts`
- Helper client: `src/services/contacts.ts` → `updateContactViaApi()`
- Commits: `d9c7ae0` (import), `9c3be85` (edicions donants)

**Creates** (nous contactes) sí que poden ser client-side (`addDocumentNonBlocking`) perquè no tenen camps d'arxivat.

**Roadmap:** Migrar `supplier-manager.tsx` i `employee-manager.tsx` al mateix helper.

---

## 7. SuperAdmin global: què pot fer i què NO

### Pot fer (des de `/admin`)

- Llistar totes les organitzacions
- Crear noves organitzacions
- Suspendre/reactivar organitzacions
- Entrar a qualsevol organització (mode admin)
- Enviar correus de reset de contrasenya

### NO pot fer (i no ha de poder)

- Veure contrasenyes d'usuaris
- Editar dades internes d'organitzacions (moviments, contactes...)
- Esborrar organitzacions de forma permanent
- Modificar Firestore Rules o Cloud Functions des de la UI

### Detecció de SuperAdmin

```typescript
// src/lib/data.ts
export const SUPER_ADMIN_UID = 'f2AHJqjXiOZkYajwkOnZ8RY6h2k2';

// Ús típic
const isSuperAdmin = user?.uid === SUPER_ADMIN_UID;
```

---

## 8. Històric i punts sensibles del projecte

(pendent d'omplir — afegir aquí decisions importants, canvis que van costar, coses que no tocar)

---

## 9. Salut del sistema (Sentinelles)

El panell `/admin` inclou un bloc **"Salut del sistema"** que detecta problemes automàticament.

### Què mirar diàriament

1. Entra a `/admin` i mira el bloc de sentinelles
2. Si tot és 🟢, no cal fer res
3. Si hi ha 🔴 vermell, obre "Veure incidents" i actua

### Què mirar setmanalment

1. S6 Encallaments: transaccions > 30 dies sense classificar
2. S7 Fiscal 182: donants sense dades fiscals completes
3. S8 Activitat: organitzacions inactives > 60 dies

Aquestes són consultes, no generen alertes automàtiques.

### Sentinelles (S1–S8)

| ID | Nom | Tipus | Què detecta |
|----|-----|-------|-------------|
| S1 | Permisos | CRITICAL | Errors "Missing or insufficient permissions" |
| S2 | Moviments | CRITICAL | Errors a la pantalla de moviments |
| S3 | Importadors | CRITICAL | Errors d'importació (banc, CSV, Stripe) |
| S4 | Exports | CRITICAL | Errors d'exportació (Excel, PDF, SEPA) |
| S5 | Remeses OUT | CRITICAL | Invariants violades (deltaCents≠0, isValid=false) |
| S6 | Encallaments | CONSULTA | Transaccions sense classificar > 30 dies |
| S7 | Fiscal 182 | CONSULTA | Donants sense dades fiscals |
| S8 | Activitat | CONSULTA | Organitzacions inactives > 60 dies |

### Com actuar davant un incident

1. **Clica l'icona ❓** per veure:
   - Què passa (descripció)
   - Impacte (per què és important)
   - Primers passos (1-2 accions concretes)

2. **Opcions d'acció:**
   - **ACK**: Silencia l'incident temporalment (l'has vist però encara no l'has resolt)
   - **Resolt**: Tanca l'incident (el problema s'ha corregit)

3. **Si es repeteix el mateix error:** L'incident es reobre automàticament amb comptador incrementat.

### Errors ignorats (anti-soroll)

Aquests errors NO generen incidents:
- `ERR_BLOCKED_BY_CLIENT` — Adblockers o extensions
- `ResizeObserver loop` — Error benigne de layout
- `ChunkLoadError` / `Loading chunk` — Problemes de xarxa
- `Network request failed` / `Failed to fetch` — Xarxa temporal
- `Script error.` — Errors cross-origin sense info útil
- `AbortError` — Requests cancel·lats intencionalment

### Test manual de verificació

Per validar que el sistema funciona:

1. **Test CLIENT_CRASH:**
   - Afegeix `throw new Error('Test incident')` a qualsevol component
   - Recarrega la pàgina
   - Verifica que apareix incident a `/admin`

2. **Test PERMISSIONS:**
   - Intenta accedir a dades d'una altra org sense permisos
   - Verifica que apareix incident tipus PERMISSIONS

3. **Test anti-soroll:**
   - Els errors `ERR_BLOCKED_BY_CLIENT` (adblockers) NO han de crear incidents

### Què fer quan rebo un email d'alerta (v1.1)

1. **Obre el link** `/admin` de l'email i localitza l'incident
2. **Copia el prompt** clicant el botó 📋 o "Copiar prompt de reparació"
3. **Enganxa a Codex** i deixa que proposi el fix mínim + QA

**Opcions després de copiar:**
- Si vas a treballar-hi ara: deixa l'incident OPEN
- Si l'has vist però no pots ara: fes **ACK** (silencia 24h)
- Si l'has resolt: fes **Resolt**

**Per desactivar alertes email ràpidament (kill switch):**
```bash
firebase functions:config:set alerts.enabled=false
firebase deploy --only functions
```

### Checklist QA pre-prod (alertes email v1.1)

Abans d'activar `ALERTS_ENABLED=true` en producció:

```
□ 1. Config dev OFF
   - Confirmar alerts.enabled=false a dev
   - Verificar que no s'envia cap email encara que hi hagi incidents

□ 2. Config prod
   - firebase functions:config:set resend.api_key="re_xxx"
   - firebase functions:config:set alert.email="raul.vico.ferre@gmail.com"
   - firebase functions:config:set alerts.enabled=true
   - firebase deploy --only functions

□ 3. Test crash ruta core
   - Injectar throw new Error("TEST_CORE_CRASH") a Moviments
   - Recarregar 2 cops → incident OPEN amb count>=2 → 1 email
   - Verificar que el cos inclou link a /admin + prompt

□ 4. Test ACK
   - Marcar l'incident com ACK
   - Recarregar 5 cops → count puja però 0 emails nous

□ 5. Test RESOLVED + reaparició
   - Posar RESOLVED
   - Reproduir de nou → ha de reobrir a OPEN
   - No email si dins del cooldown 24h

□ 6. Test soroll filtrat
   - Reproduir ERR_BLOCKED_BY_CLIENT → no incident

□ 7. Test sanitització
   - Verificar que prompt i email no contenen emails d'usuaris, IBANs ni tokens

□ 8. Test idempotència
   - Recàrregues ràpides al mateix incident → 1 sol email
```

---

## 10. Novetats del producte — Ritual de publicació

Quan publiques una novetat nova des de SuperAdmin (`/admin` → Novetats):

### Flux complet

```
1. Publicar ─────────────────────────────────────────────────────
   □ Crear novetat a SuperAdmin (omplir camps o usar "Generar amb IA")
   □ Revisar preview (App / Web / X / LinkedIn)
   □ Clicar "Publicar"
   → La campaneta de les instàncies mostrarà la novetat immediatament

2. Exportar JSON (si web.enabled = true) ────────────────────────
   □ Clicar "Exportar web JSON" al SuperAdmin
   □ Es descarrega novetats-data.json

3. Commit ───────────────────────────────────────────────────────
   □ Substituir public/novetats-data.json amb el fitxer descarregat
   □ git add public/novetats-data.json
   □ git commit -m "docs(novetats): actualitzar web JSON - [títol breu]"

4. Deploy ───────────────────────────────────────────────────────
   □ seguir el mateix ritual general del repo: `npm run acabat` → `npm run integra` → `npm run publica`
   □ Verificar que /ca/novetats mostra la nova entrada
```

### Checklist ràpid

```
□ Campaneta funciona? → No cal deploy
□ Web públic necessita actualització? → Exportar + Commit + Deploy
□ Social? → Copiar textos des de preview, publicar manualment
```

### Guardrails (no negociables)

- **NO HTML** a Firestore — sempre text pla estructurat
- **NO `dangerouslySetInnerHTML`** — render segur via `renderStructuredText()`
- **NO Firestore públic** — web llegeix JSON estàtic
- **NO deps noves** — tot funciona amb stack existent

---

## 11. Entorn DEMO

### 1. Propòsit

- **Què és**: Instància completament separada de producció amb Firebase project propi (`summa-social-demo`)
- **Per a què serveix**: Demos comercials, captures de pantalla, tests visuals, formació
- **Per a què NO serveix**: Producció, dades reals, tests d'integració amb serveis externs

### 2. Principis clau

| Principi | Descripció |
|----------|------------|
| Firebase project separat | `summa-social-demo` — zero risc per a prod |
| Dades 100% sintètiques | Noms, IBANs, imports... tot és fals |
| Regenerable | Botó a `/admin` per tornar a l'estat inicial |
| Sense serviceAccountKey | Usa ADC (Application Default Credentials) |
| Bypass de rols UI | Qualsevol usuari autenticat pot navegar |

### 3. Requisits previs (locals)

```bash
# Node.js (versió del projecte)
node -v

# gcloud CLI instal·lat
gcloud --version

# Autenticar ADC (només primer cop o quan expira)
gcloud auth application-default login

# Accés al projecte Firebase demo
# (has de tenir permisos a summa-social-demo)
```

### 4. Arrencada DEMO

> **Per instruccions pas a pas per no-programadors:** [docs/operations/DEMO-PAS-A-PAS.md](./operations/DEMO-PAS-A-PAS.md)

#### DEMO en 1 comandament (recomanat)

```bash
npm run demo:up        # Mode Short (demo ràpida)
npm run demo:up:work   # Mode Work (dades realistes)
```

**Què fa:**
1. Mata el port 9002 si està ocupat
2. Arrenca servidor DEMO
3. Executa seed (Short o Work)
4. Obre navegador a `/demo`

**Què ha d'aparèixer:**
- Terminal: `[demo:up] DEMO a punt. (Ctrl+C per aturar)`
- Browser: http://localhost:9002/demo amb dades

#### Arrencada manual (per debugging)

```bash
npm run dev:demo
```

**Què ha d'aparèixer:**
- Terminal: `[DEMO] Projecte: summa-social-demo`
- Browser: http://localhost:9002
- Badge "DEMO" visible a navbar i `/admin`

**Fitxers clau:**

| Fitxer | Funció |
|--------|--------|
| `.env.demo` | Config Firebase demo + `SUPERADMIN_EMAIL` + `SUPER_ADMIN_UID` |
| `scripts/run-demo-dev.mjs` | Runner que carrega env i neteja credencials |
| `src/lib/demo/isDemoOrg.ts` | `isDemoEnv()` client+server |

### 5. Estat: Beta interna

| Aspecte | Regla |
|---------|-------|
| **Objectiu** | Validació comercial en reunions reals |
| **Permès** | microcopy DEMO, ajustos de volums ±10%, retocar textos/ordres del guió |
| **Prohibit** | tocar queries/models, afegir "wows" nous, canviar flux Short/Work, editar dades manualment |

**Qualsevol canvi fora d'això requereix decisió explícita de producte.**

> **Canvis bloquejats**: qualsevol modificació de DEMO requereix decisió de producte (Raül).

#### Checklists operatius

**Abans d'una demo:**
```
□ npm run dev:demo
□ Regenerar Short o Work segons sessió
□ Verificar dashboard net / anomalies segons mode
```

**Després d'un ajust:**
```
□ npm run demo:smoke
□ Verificar invariants del mode corresponent
```

### 6. Regenerar dades (DemoMode dual)

#### Modes disponibles

| Mode | Descripció | Ús típic |
|------|------------|----------|
| **Short** | Dades netes, sense anomalies | Vídeos, pitch, captures |
| **Work** | Dades amb "fang" controlat | Validar workflows reals |

#### Regenerar

1. Ves a http://localhost:9002/admin
2. Secció "Entorn DEMO" (només visible en demo)
3. **Selecciona mode**: Short o Work
4. Clica "Regenerar demo" → confirmació obligatòria
5. Espera ~10-30s

**Qui pot fer-ho**: Usuari amb email a `SUPERADMIN_EMAIL` o UID a `SUPER_ADMIN_UID` de `.env.demo`

**Què fa el seed**:
- Purga totes les dades demo existents (`isDemoData: true`)
- Crea org `demo-org` amb slug `demo`
- Genera contactes, categories, transaccions, projectes, partides, despeses
- Puja PDFs dummy a Storage
- **Mode work**: Afegeix anomalies controlades

#### Volums (base)

| Entitat | Quantitat |
|---------|-----------|
| Donants | 50 |
| Proveïdors | 20 |
| Treballadors | 8 |
| Categories | 16 |
| Transaccions bank | 100 |
| Projectes | 4 |
| Partides | 40 |
| Off-bank expenses | 30 (10 XOF + 10 HNL + 10 DOP) |
| ExpenseLinks | 20 (10 full + 10 mixed) |
| PDFs | 20 |

#### Anomalies (només mode Work)

| Anomalia | Quantitat | Descripció |
|----------|-----------|------------|
| Duplicats | 3 parells | Concepte similar, mateixa data, import ±1% |
| Mal categoritzat | 1 | Ingrés amb categoria de despesa |
| Pendents | 5 | Moviments sense categoria ni contacte |
| Traçabilitat | 1 factura | 3 moviments compartint 1 PDF |

#### Casos especials demo (només mode Work)

| Cas | Descripció | Ús demo |
|-----|------------|---------|
| **Donant certificat** | 1 donant complet ("Maria García López") amb donació (100€) + devolució assignada (-20€) = net 80€ | Demo de certificat fiscal amb devolucions |
| **Devolució pendent** | 1 devolució (-35€) tipus `transactionType: 'return'` sense contacte assignat | Demo de workflow de resolució de devolucions |

#### Microcopy a la UI

Quan `isDemoEnv() === true`:
- Badge "DEMO" al header amb tooltip: "Dades sintètiques de demo"
- Secció "Entorn DEMO" visible a `/admin`
- Selector de mode (Short/Work) abans de regenerar

#### Validació ràpida

```bash
# Smoke test (sense autenticació)
npm run demo:smoke

# Validació completa
# 1. Arrenca la demo
npm run dev:demo

# 2. Login a /admin, regenera Short
# 3. Comprova: /demo/dashboard net, 100 tx, 20–30 recents

# 4. Regenera Work
# 5. Comprova: duplicats visibles, pendents sense categoria
```

#### Guardrails

- ❌ **NO editar dades manualment** a Firestore/Storage en demo — sempre usar seed
- ❌ **NO relaxar Firestore rules** — les mateixes que prod
- ✅ El seed valida invariants automàticament (throw si falla)

### 7. Autenticació i permisos

**En DEMO:**
- `isDemoEnv()` retorna `true` (client i server)
- Bypass de rols a UI: qualsevol usuari autenticat pot veure tot
- El seed valida SuperAdmin via Firebase ID Token (no headers falsificables)
- ADC substitueix serviceAccountKey per Admin SDK

**Diferència amb prod:**
- En prod, `isDemoEnv()` retorna `false`
- Els rols i permisos funcionen normalment
- Usa serviceAccountKey (no ADC)

**⚠️ NO copiar patrons DEMO a prod** — el bypass de rols és només per UX de demo

**i18n en DEMO:**
- En DEMO/local, i18n usa sempre fallback local (sense Storage) per evitar CORS/permisos
- No es subscriu al listener de versions (`system/i18n`)
- Errors de permisos no bloquejants es silencien en DEMO

**Login públic general:**
- No existeix login general públic (`/{lang}/login`)
- Qualsevol accés a `/ca/login`, `/es/login`, etc. redirigeix a la landing pública (`/{lang}`)
- El login d'organització (`/{orgSlug}/login`) continua funcionant normalment

### 8. Problemes coneguts i solucions

| Problema | Causa | Solució |
|----------|-------|---------|
| No puc descarregar serviceAccountKey | Google Workspace bloqueja claus privades | Usar ADC: `gcloud auth application-default login` |
| "Could not load default credentials" | ADC no configurat o expirat | Executar `gcloud auth application-default login` |
| "Cannot use undefined as Firestore value" | Camp `projectId` buit en algunes despeses | Sanejador a `writeBatch()` filtra camps undefined |
| Hydration mismatch a `<html>` | Extensions del navegador (Grammarly, LanguageTool, adblock) injecten classes abans d'hidratar | Provar en incògnit. `suppressHydrationWarning` a `<html>` silencia el warning |
| "No tens accés a aquesta organització" | UID no és membre ni SuperAdmin hardcodejat | `isDemoEnv()` fa bypass a `organization-provider.tsx` |
| "Slug demo no té organització associada" | Mapping `slugs/demo` tenia camp incorrecte | Seed escriu `orgId` (no `organizationId`) |
| "Firestore has already been initialized" | `db.settings()` cridat després d'altres operacions | Eliminat `db.settings()`, inicialització cached |

### 9. Què NO s'ha de fer

- ❌ **No fer seed des del client/browser** — sempre via API route amb Admin SDK
- ❌ **No relaxar Firestore rules globals** — les rules són les mateixes que prod
- ❌ **No reutilitzar DEMO per producció** — projectes Firebase separats
- ❌ **No confiar en headers manuals per auth** — usar Firebase ID Token verificat
- ❌ **No cridar `db.settings()` en runtime** — provoca crash en hot reload

### Fitxers modificats per DEMO

| Fitxer | Canvi |
|--------|-------|
| `src/lib/demo/isDemoOrg.ts` | `isDemoEnv()` mira `NEXT_PUBLIC_APP_ENV` + `APP_ENV` |
| `src/lib/admin/superadmin-allowlist.ts` | Accepta `SUPERADMIN_EMAIL` de env |
| `src/app/api/internal/demo/seed/route.ts` | Auth via ID Token, ADC, demoMode param |
| `src/scripts/demo/seed-demo.ts` | `runDemoSeed(db, bucket, demoMode)`, anomalies work |
| `src/scripts/demo/demo-generators.ts` | Generadors deterministes amb volums actualitzats |
| `src/hooks/organization-provider.tsx` | Bypass accés si `isDemoEnv()` |
| `src/components/dashboard-header.tsx` | Badge DEMO amb tooltip microcopy |
| `src/app/admin/page.tsx` | Selector Short/Work, diàleg confirmació |
| `scripts/run-demo-dev.mjs` | Neteja `GOOGLE_APPLICATION_CREDENTIALS` |

### 10. Fitxers d'importació (DEMO)

Per a demos i formació, el projecte inclou fitxers CSV de mostra que es poden importar amb els importadors existents.

#### Ubicació

```
public/demo-files/
├── remesa-quotes-demo.csv      # Remesa SEPA IN (8 socis)
├── devolucions-banc-demo.csv   # Devolucions del banc (3 files)
└── stripe-payout-demo.csv      # Payout Stripe (6 donacions)
```

#### Regenerar fitxers

```bash
npx tsx src/scripts/demo/generate-demo-files.ts
```

#### Fitxers disponibles

| Fitxer | Importador | Contingut | Ús demo |
|--------|------------|-----------|---------|
| `remesa-quotes-demo.csv` | Remittance Splitter | 8 socis amb IBAN, DNI, import | "Importo una remesa" |
| `devolucions-banc-demo.csv` | Return Importer | 3 devolucions amb IBAN, motiu | "Importo devolucions del banc" |
| `stripe-payout-demo.csv` | Stripe Importer | 6 donacions + transfer ID | "Importo donacions Stripe" |

#### Format dels fitxers

**remesa-quotes-demo.csv** (separador `;`):
```csv
Nom;DNI/CIF;IBAN;Import
Marc Ribas Vidal;52659254H;ES2427326247864723170551;10,00
...
```

**devolucions-banc-demo.csv** (separador `;`):
```csv
cuenta de adeudo;importe;fecha;nombre cliente;motivo devolucion
ES2427326247864723170551;25,50;15/01/2026;Marc Ribas Vidal;MS02 - Insuficient saldo
...
```

**stripe-payout-demo.csv** (separador `,`):
```csv
id,Created date (UTC),Amount,Fee,Net,Status,Transfer,Customer Email,Description,Amount Refunded
ch_demo_charge_001,2026-06-01 10:00:00,25.00,0.98,24.02,succeeded,po_demo_payout_001,iris.prats.ferrer@example.demo,Donacio online,0
...
```

#### Coherència amb el seed

Els fitxers es generen amb el mateix **SEED=42** que el seed de la demo. Això significa:
- Els noms, DNIs i IBANs coincideixen amb els donants generats pel seed
- Es poden importar i els importadors trobaran match automàtic

**Nota**: Si regeneres el seed amb mode Work, les dades ja inclouen transaccions de remesa i Stripe. Els fitxers CSV serveixen per demostrar el flux d'importació, no per crear dades noves.

---

## 12. Mode Rescat (admin)

El **Mode Rescat** és un bypass temporal per recuperar accés a `/admin` quan el sistema de SuperAdmin via Firestore no funciona.

### Quan usar-lo

- No pots accedir a `/admin` tot i estar autenticat
- El document `systemSuperAdmins/{uid}` no existeix o hi ha problemes de permisos
- Necessites accés urgent per administrar organitzacions

### Com activar-lo

1. Obrir `src/app/admin/page.tsx`
2. Canviar `const RESCUE_MODE = false;` → `const RESCUE_MODE = true;`
3. Deploy o `npm run dev`

### Què passa en Mode Rescat

| Aspecte | Comportament |
|---------|--------------|
| **Accés** | Qualsevol usuari autenticat pot entrar |
| **Banner** | Taronja indicant "Mode rescat activat" |
| **Crear org** | ❌ Desactivat |
| **Migrar slugs** | ❌ Desactivat |
| **Suspendre/Reactivar** | ❌ Desactivat |
| **I18n Manager** | ❌ Desactivat |
| **SuperAdmins Manager** | ❌ Desactivat |
| **Veure orgs** | ✅ Funciona |
| **Entrar a org** | ✅ Funciona |

### Com desactivar-lo

1. Assegurar que el teu UID existeix a `systemSuperAdmins/{uid}` a Firestore
2. Canviar `const RESCUE_MODE = true;` → `const RESCUE_MODE = false;`
3. Deploy

### ⚠️ Advertència

El Mode Rescat elimina tota seguretat d'accés a `/admin`. Només usar-lo temporalment per recuperar control i desactivar-lo immediatament després.

---

## 13. Ajuda dins producte

### Què és

L'ajuda visible per a usuaris finals es reparteix entre `HelpSheet`, `Manual` i `Bot`. La ruta `/dashboard/guides` queda només com a compatibilitat de links antics.

### Cercador natural

El cercador usa **scoring determinista** (sense IA):

| Match | Punts |
|-------|-------|
| Títol | +50 |
| Resum | +20 |
| Text card | +10 |
| Sinònim | +5 a +45 |

**Sinònims**: L'usuari escriu "no veig moviments" → el sistema troba la capa editorial interna `guides.*` gràcies al diccionari de sinònims a `guides.search.syn.*`. Això ja no implica cap hub visible dins del producte.

### Fitxers clau

| Fitxer | Funció |
|--------|--------|
| `src/components/help/HelpSheet.tsx` | Ajuda contextual per pantalla |
| `src/app/[orgSlug]/dashboard/manual/page.tsx` | Manual runtime |
| `src/components/help/BotSheet.tsx` | Bot amb destins útils |

### Criteri operatiu

1. Si el dubte és de la pantalla actual, prioritzar `?`.
2. Si és un procés llarg o sensible, prioritzar manual.
3. Si l'usuari no sap on anar, prioritzar bot amb destí concret.

---

## 14. Patrons de Layout (v1.27)

### Problema: icones del header desapareixen

**Símptoma**: En pantalles estretes (o amb taules amples), les icones d'ajuda i notificacions del header desapareixen.

**Causa**: Contingut amb `min-width` fixa (ex: `TransactionsTable` amb `min-w-[600px]`) expandeix el contenidor més enllà del viewport.

**Solució aplicada a `layout.tsx`**:

```tsx
<SidebarInset className="flex min-w-0 flex-1 flex-col overflow-x-hidden ...">
```

| Propietat | Per què |
|-----------|---------|
| `min-w-0` | Permet que flex children es comprimeixin |
| `overflow-x-hidden` | Evita que contingut ample expandeixi el contenidor |

### Pattern header responsive

```tsx
<header className="flex items-center justify-between gap-2">
  {/* Bloc esquerra: degradable */}
  <div className="flex min-w-0 flex-1 items-center gap-2">
    {/* Breadcrumb amb truncate */}
  </div>
  {/* Bloc dreta: fix */}
  <div className="flex shrink-0 items-center gap-2">
    <HelpSheet />
    <NotificationBell />
  </div>
</header>
```

**Regla**: El bloc dreta (`shrink-0`) mai es comprimeix. El breadcrumb es trunca si cal.

---

## 15. Next.js 15 — Canvis importants

### searchParams és Promise

A Next 15, `searchParams` a les pàgines és un `Promise`:

```tsx
// ❌ Next 14 (no funciona a Next 15)
export default function Page({ searchParams }: { searchParams: Record<string, string> }) {
  const value = searchParams.key;
}

// ✅ Next 15
export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const value = params.key;
}
```

**Fitxers afectats**: Qualsevol `page.tsx` que usi `searchParams`.

**Error típic**: `TS2344: Type '{ searchParams: Record<...> }' does not satisfy the constraint 'PageProps'`

---

## 15. Arquitectura de rutes i layouts (anti-regressions)

### Principis fonamentals

| Principi | Regla |
|----------|-------|
| **Un sol `<html>`** | Només `src/app/layout.tsx` (RootLayout) renderitza `<html>` i `<body>` |
| **Layouts fills = `<div>`** | Tots els altres layouts usen `<div>` o fragments |
| **Middleware = font de veritat** | Totes les decisions de routing es fan al middleware abans de renderitzar JSX |
| **Públic ≠ privat** | Les rutes públiques MAI intenten carregar orgs ni auth |

### Tipus de rutes

| Tipus | Patró URL | Exemple | Comportament |
|-------|-----------|---------|--------------|
| **Landing pública** | `/{lang}` | `/es`, `/ca` | SSG, sense auth, reescrit a `/public/{lang}` |
| **Pàgina pública** | `/{lang}/{page}` | `/es/funcionalidades` | SSG, sense auth |
| **Login org** | `/{orgSlug}/login` | `/demo/login` | Formulari login per org específica |
| **Dashboard** | `/{orgSlug}/dashboard/*` | `/demo/dashboard` | Requereix auth, OrganizationProvider |

### Rutes que NO existeixen

| Ruta | Per què | Què passa |
|------|---------|-----------|
| `/login` | No hi ha login global | Redirigeix a `/{lang}` (landing) |
| `/{lang}/login` | No hi ha login públic general | Middleware redirigeix a `/{lang}` |
| `/dashboard` | Requereix slug d'org | Redirigeix a `/redirect-to-org` |

### Middleware: responsabilitats

```
1. app.summasocial.app → summasocial.app (canonical)
2. /{lang}/login → /{lang} (no existeix login públic)
3. /{lang}/... → /public/{lang}/... (rewrite intern)
4. /dashboard → /redirect-to-org (selector d'org)
```

### Què NO fer mai

- ❌ **Renderitzar `<html>` o `<body>` fora de RootLayout** — causa hydration errors
- ❌ **Carregar orgs a rutes públiques** — errors de permisos en DEMO
- ❌ **Crear rutes `/login` amb formularis** — el model és `/{orgSlug}/login`
- ❌ **Fer redirects a JSX** — sempre al middleware

### Fitxers clau

| Fitxer | Responsabilitat |
|--------|-----------------|
| `src/app/layout.tsx` | RootLayout — únic `<html>` i `<body>` |
| `src/middleware.ts` | Routing i redirects (font de veritat) |
| `src/app/public/[lang]/layout.tsx` | Layout públic (sense `<html>`) |
| `src/app/[orgSlug]/login/page.tsx` | Login per org específica |

---

## 16. Backups externs (v1.x)

### Què és

Sistema de backup automàtic que exporta les dades de cada organització a un proveïdor extern (Dropbox o Google Drive).

### Arquitectura

| Component | Ubicació | Funció |
|-----------|----------|--------|
| **UI** | `src/components/backups-settings.tsx` | Configuració i execució manual |
| **API routes** | `src/app/api/integrations/backup/` | OAuth start/callback, run-now |
| **Cloud Functions** | `functions/src/backups/` | Scheduler setmanal, providers |
| **Tipus** | `src/lib/backups/types.ts` | `BackupIntegration`, `BackupRun` |

### Estructura a Firestore

```
/organizations/{orgId}/
  ├── integrations/backup     # Config integració
  ├── integrations/backupOAuthRequests/{id}  # One-shot OAuth
  └── backups/{id}            # Logs d'execució
```

### Estructura al proveïdor

```
Summa Social/{orgSlug}/backups/{YYYY-MM-DD}/
  ├── data.json       # Dades exportades
  └── manifest.json   # Checksums i metadata
```

### Checklist de proves manuals

#### Dropbox

```
□ Seleccionar Dropbox com a proveïdor
□ Clicar "Connectar" → OAuth consent
□ Verificar toast "Connexió establerta"
□ Verificar status "Connectat" i badge verd
□ Clicar "Executar backup ara"
□ Verificar toast "Backup executat correctament"
□ Verificar a Dropbox: carpeta /Summa Social/{orgSlug}/backups/{data}
□ Verificar fitxers data.json i manifest.json existeixen
□ Verificar a Firestore: document a /organizations/{orgId}/backups
□ Verificar banner d'avís desapareix del dashboard
```

#### Google Drive

```
□ Seleccionar Google Drive com a proveïdor
□ Clicar "Connectar" → OAuth consent Google
□ Verificar toast "Connexió establerta"
□ Verificar status "Connectat" i badge verd
□ Clicar "Executar backup ara"
□ Verificar toast "Backup executat correctament"
□ Verificar a Drive: carpeta Summa Social/{orgSlug}/backups/{data}
□ Verificar fitxers data.json i manifest.json existeixen
□ Verificar a Firestore: document a /organizations/{orgId}/backups
```

#### Scheduler setmanal

```
□ Verificar Cloud Function runWeeklyBackup desplegada
□ Per forçar execució: Firebase Console → Functions → runWeeklyBackup → Run
□ Verificar logs a Cloud Logging amb prefix [runWeeklyBackup]
```

#### Retenció

```
□ Crear >8 backups (executar manualment varis cops)
□ Verificar que només en queden 8 a Dropbox/Drive
□ Verificar que el backup del dia actual MAI s'esborra
```

#### Banner d'avís

```
□ Desconnectar provider (o org nova sense backup)
□ Verificar banner apareix al dashboard
□ Connectar provider
□ Verificar banner desapareix
```

### Secrets necessaris

| Variable | On | Descripció |
|----------|-----|------------|
| `DROPBOX_APP_KEY` | Vercel + Functions | Client ID Dropbox |
| `DROPBOX_APP_SECRET` | Vercel + Functions | Client Secret Dropbox |
| `GOOGLE_DRIVE_CLIENT_ID` | Vercel | Client ID Google OAuth |
| `GOOGLE_DRIVE_CLIENT_SECRET` | Vercel | Client Secret Google OAuth |

### Redirect URIs a registrar

**Dropbox App Console:**
- `https://app.summasocial.org/api/integrations/backup/dropbox/callback`

**Google Cloud Console (OAuth 2.0 Client):**
- `https://app.summasocial.org/api/integrations/backup/google-drive/callback`

### Troubleshooting

| Problema | Causa probable | Solució |
|----------|----------------|---------|
| "Token refresh failed" | Refresh token expirat o revocat | Desconnectar i tornar a connectar |
| "Missing refresh token" | OAuth sense `access_type=offline` | Verificar paràmetres OAuth |
| "Folder already exists" | Normal, és idempotent | No cal acció |
| Backup no apareix a Drive/Dropbox | Error d'upload | Mirar `lastError` a Firestore |
| Banner no desapareix | `status !== 'connected'` | Verificar `integrations/backup.status` |

### Fitxers clau

| Fitxer | Funció |
|--------|--------|
| `src/components/backups-settings.tsx` | UI de configuració |
| `src/components/backup-alert-banner.tsx` | Banner d'avís al dashboard |
| `functions/src/backups/runBackupForOrg.ts` | Runner principal |
| `functions/src/backups/runWeeklyBackup.ts` | Scheduler setmanal |
| `functions/src/backups/applyRetention.ts` | Política de retenció |
| `functions/src/backups/providers/dropboxProvider.ts` | Operacions Dropbox |
| `functions/src/backups/providers/googleDriveProvider.ts` | Operacions Google Drive |

---

## 17. Dashboard — Datasets separats (v1.30)

### Principi fonamental

**Els KPIs econòmics i socials utilitzen datasets diferents per evitar duplicats i confusions.**

| Bloc | Dataset | Què mostra | Font de veritat |
|------|---------|------------|-----------------|
| **Diners** | `filteredTransactions` (ledger) | Ingressos, Despeses, Terreny, Saldo | Extracte bancari |
| **Qui ens sosté** | `socialMetricsTxs` (contacte) | Quotes, Donacions, Altres ingressos, Socis, Donants | Relacions amb persones |

### Perquè cal separar-ho

Les remeses i Stripe creen **fills desglossats**:
- El **pare** representa l'apunt bancari real (ex: 1.500 € remesa SEPA)
- Els **fills** representen qui ha pagat (ex: 50 quotes de 30 €)

Si sumem pares + fills, duplicaríem els imports.

### Regles dels datasets

**Ledger (Bloc Diners):**
```typescript
// Exclou:
if (tx.parentTransactionId) return false;        // fills
if (tx.isRemittanceItem === true) return false;  // ítems remesa
if (tx.transactionType === 'donation') return false;  // Stripe donation
if (tx.transactionType === 'fee') return false;  // Stripe fee
if (tx.source === 'remittance') return false;    // files remesa
```

**Social (Bloc Qui ens sosté):**
```typescript
// Inclou:
tx.amount > 0 && tx.contactId && tx.contactType === 'donor'
// Inclou fills de remesa perquè tenen contactId
```

### KPI "Altres ingressos" (v1.30)

Reconcilia el Dashboard amb l'extracte bancari mostrant el residual:

```typescript
otherIncomeEUR = Math.max(0, totalIncome - memberFees - totalDonations)
```

- **Només es mostra si > 0**
- **Exemples**: subvencions, loteria, reintegraments, interessos, ingressos sense contacte
- **Objectiu**: El gestor pot sumar Quotes + Donacions + Altres i veure que quadra amb Ingressos totals

### Test per afegir nous KPIs

Abans d'afegir un KPI al dashboard, verifica:

1. **Pregunta humana**: "Un gestor pot explicar aquest número en una frase?"
2. **Dataset correcte**: És veritat bancària (ledger) o relacional (social)?
3. **Reproduïble**: Es pot verificar amb 1-2 filtres a Moviments o Donants?

### Guardrails (DEV-only)

En mode development, el dashboard imprimeix:
- `[Dashboard] Social metrics: { total, withParent, uniqueContacts }`
- `[Dashboard] LEDGER CONTAMINATION DETECTED` si el ledger conté ítems que haurien ser exclosos
- `[Dashboard] Income reconciliation diff` si la reconciliació no quadra (tolerància 0.01 €)

### Fitxers clau

| Fitxer | Funció |
|--------|--------|
| `src/app/[orgSlug]/dashboard/page.tsx` | `isBankLedgerTx`, `filteredTransactions`, `socialMetricsTxs` |
| `src/i18n/ca.ts` | `moneyBlock`, `supportersBlock` i descripcions |

---

## 18. SEPA pain.008 — Guia operativa per al mantenidor (v1.36)

### Fitxers implicats

| Fitxer | Funció |
|--------|--------|
| `src/lib/sepa/pain008/generate-pain008.ts` | Generador XML pain.008.001.02 |
| `src/lib/sepa/pain008/sequence-type.ts` | Lògica SeqTp (FRST/RCUR/OOFF/FNAL) |
| `src/lib/sepa/pain008/iban-length.ts` | Validació longitud IBAN per país |
| `src/components/sepa-collection/SepaCollectionWizard.tsx` | Wizard UI (3 passos) |

### Dialecte Santander (coneixement crític)

El Santander NO accepta el format ISO 20022 genèric. Peculiaritats documentades:

| Aspecte | Què vol Santander | Què passava abans |
|---------|-------------------|-------------------|
| Namespace | `pain.008.001.02` | `.08` → "Formato no válido" |
| `CreDtTm` | Sense mil·lisegons | Amb `.046` → "Formato de fecha incorrecto" |
| `BtchBookg` | `true` obligatori | No s'emetia |
| `InitgPty/OrgId` | Amb `creditorId` | No s'emetia |
| `Dbtr/PrvtId` | NO incloure NIF deutor | S'incloïa → possible rebuig |
| `EndToEndId` | `NOTPROVIDED` | Valor generat (no útil perquè Santander no el retorna) |
| `PmtInfId` | ≤ 35 chars | 37 chars → "excede longitud máxima" |
| `SeqTp` | `RCUR` per mandats ja cobrats | `FRST` per migrats → rebuig massiu |

### Regles SeqTp per migracions

**Problema:** Donants migrats d'un altre sistema no tenen `sepaPain008LastRunAt` ni `sepaMandate.lastCollectedAt` a Firestore. La lògica els marca com `FRST`. Santander rebutja perquè ja els coneix com `RCUR`.

**Solució permanent:** Informar `sepaMandate.lastCollectedAt` amb data de migració o última remesa del sistema antic.

**Solució temporal (activa feb 2026):** `determineSequenceType()` retorna `'RCUR'` fix. Buscar `// TEMP` a `sequence-type.ts`.

**Quan revertir el TEMP:**
1. Confirmar amb Santander que accepta el fitxer amb tots RCUR
2. Executar script de migració per informar `lastCollectedAt` als donants existents
3. Eliminar el `return 'RCUR'` fix i deixar la lògica original

### Límits d'identificadors (invariant)

Tots els identificadors SEPA han de ser ≤ 35 caràcters, només `[A-Za-z0-9-]`.

El helper `ensureMax35()` a `generate-pain008.ts` s'aplica a `PmtInfId`. `MsgId` ja es genera amb `.slice(0, 35)`. `EndToEndId` és `NOTPROVIDED` (11 chars).

**Si s'afegeix un nou identificador al XML, SEMPRE aplicar `ensureMax35()` o equivalent.**

### Errors reals (referència ràpida)

| Símptoma | Buscar | Solució |
|----------|--------|---------|
| "excede longitud máxima: 35" | Identificador > 35 chars | `ensureMax35()` |
| Rebuig massiu sense error clar | SeqTp FRST en migrats | Forçar RCUR o informar `lastCollectedAt` |
| "Formato de fichero no válido" | Namespace `.08` | Namespace `.02` |
| "Formato de fecha incorrecto" | Mil·lisegons a `CreDtTm` | `.slice(0, 19)` al timestamp |

---

*Última actualització: 2026-02-04*
