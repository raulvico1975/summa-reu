# Govern de Codi i Deploy — Summa Social

**Versió:** 3.2
**Data:** 2026-02-16
**Autor:** Raül Vico (CEO/CTO)

**Complementaris:**
- `docs/operations/OPENCLAW-MIRROR.md`

---

## 0. Principis no negociables

1. **Model de branques:** `main → prod` (invariant)
2. **Autoritat final:** CEO decideix quan es desplega
3. **Cap dependència nova** sense aprovació explícita
4. **Cap commit directe** a `prod`

---

## 1. Model de branques

| Branca | Funció | Qui hi treballa |
|--------|--------|-----------------|
| `main` | Integració central i preparació de deploy | Repositori de control |
| `prod` | Producció (App Hosting) | Només merge des de main |
| `codex/*` | Tasques d'implementació | Worktrees externs |

```
[worktree codex/*] → [main] → [prod] → Deploy automàtic
```

**Repositori de control:** `/Users/raulvico/Documents/summa-social`  
**Regla:** el control es manté a `main` i net. Les tasques van fora, en worktrees.

**Firebase App Hosting desplega automàticament només des de `prod`.**

---

## 2. Classificació de canvis per risc

| Risc | Tipus de canvis | Exemples | Paths típics |
|------|-----------------|----------|--------------|
| **BAIX** | i18n, docs, microcopy | Labels, traduccions, README | `src/i18n/*`, `docs/*`, `*.md` |
| **MITJÀ** | UI, filtres, exports | Dashboards, CSV, Excel | `src/components/*`, `src/app/*/dashboard/*` |
| **ALT** | Dades, fiscal, conciliació, SEPA | Remeses, Model 182, ledger, pain.008 | `src/lib/remittances/*`, `src/lib/model182/*`, `src/lib/sepa/*`, `src/app/api/*` |

Aquesta classificació determina els requisits de validació (secció 4).

---

## 3. Ritual de desenvolupament

1. Des del **repositori de control** (a `main`, net): `npm run inicia` o `npm run implementa` (opcional: `npm run inicia -- <area>`)
2. El sistema crea **branca `codex/*` + worktree extern** a `../summa-social-worktrees/<branch>` i, si hi ha `area`, evita solapaments amb una altra tasca oberta de la mateixa àrea
3. **Treballar i validar** dins del worktree de tasca:
   ```bash
   node scripts/check-build-env.mjs && npm run build && npm test
   ```
4. `npm run acabat` des del worktree: checks + commit + push de la branca `codex/*`
5. `npm run integra` des del repositori de control: prova de merge en worktree temporal + validacions + actualització d'`origin/main` + sincronització de `main`
6. Un cop integrat, si el worktree ja no fa falta: `npm run worktree:close`

---

## 4. Ritual de deploy per nivell de risc

### Requisits abans de `main → prod`

| Risc | Requisits mínims |
|------|------------------|
| **BAIX** | `npm run build` OK |
| **MITJÀ** | build + smoke tests (`docs/QA/SMOKE-TESTS.md`) |
| **ALT** | build + smoke + checklist manual (`tests/CHECKLIST-MANUAL.md`) |

**Prerequisit estable de build:** `npm run build` requereix credencials Firebase mínimes (`NEXT_PUBLIC_FIREBASE_PROJECT_ID` i `NEXT_PUBLIC_FIREBASE_API_KEY`) via `.env.local` o variables d'entorn de shell/CI.

**Variables de deploy per contacte públic:** si el canvi toca `src/app/public/[lang]/contact/` o `src/app/api/contact/`, producció ha de tenir:
- `RESEND_API_KEY`
- `CONTACT_FORM_TO_EMAIL`

Sense aquesta configuració, `/api/contact` respon `503` i el formulari públic mostra error controlat sense enviar correu.

### Regla P0 específica: filtre de Moviments

Qualsevol canvi del filtre de visibilitat de Moviments es considera **P0** (govern de dades, no UI).

**Obligatori al PR:**
- Tests de filtre actualitzats/afegits (mínim unitaris del helper de visibilitat)
- `verify-local` OK
- `verify-ci` OK
- Evidència de QA manual (checklist curt)

**Checklist QA manual (4 passos):**
1. Flores: cercar remesa a Moviments i validar que el pare 2025 és visible
2. Validar que les filles de remesa no apareixen al llistat principal
3. Toggle arxivats OFF: un moviment arxivat no es veu
4. Toggle arxivats ON: el mateix moviment arxivat es veu

### Verificació post-deploy: contactes

Si el deploy toca `donor-manager`, `supplier-manager`, `employee-manager` o `src/app/api/contacts/import/`:
- Editar un donant existent → desar → verificar que no apareix `permission-denied`
- Comprovar Network tab: `/api/contacts/import` respon 200

### Comandes de deploy (invariants)

```bash
# 1) main → prod
git checkout prod
git pull --ff-only
git merge --no-ff main
git push origin prod
```

---

## 5. Punt de control i autorització

**Un sol punt de decisió humana:** abans de `main → prod`.

### Execució

El ritual complet d'"acabar feina" i publicar s'executa via scripts deterministes:

```bash
npm run inicia    # crea branca codex/* + worktree extern de tasca
npm run implementa # equivalent a inicia
npm run acabat    # tanca tasca des del worktree (checks + commit + push)
npm run integra   # integra a main des del repositori de control
npm run publica   # publica main -> prod (només des del repositori de control)
npm run worktree:list
npm run worktree:close
npm run worktree:gc
```

`npm run inicia` i `npm run implementa` (`scripts/workflow.sh inicia|implementa`) només funcionen al repositori de control (`main` net) i creen una tasca aïllada: branca `codex/...` + worktree extern.

Si es vol reservar una àrea funcional, es pot fer servir:

```bash
npm run inicia -- remeses
```

Si ja hi ha una tasca activa d'aquella àrea, el sistema bloqueja l'inici (`BLOCKED_SAFE`) per evitar solapaments.

`npm run acabat` (`scripts/workflow.sh acabat`) fa aquests passos de forma seqüencial:
1. Detectar canvis pendents i classificar risc (ALT/MITJÀ/BAIX)
2. Verificacions (`verify-local.sh`, `verify-ci.sh`) quan hi ha canvis locals
3. Commit i push automàtics de la branca de treball (`codex/...`) quan hi ha canvis locals
4. Sortida clara indicant que la branca ja és llesta per integrar amb `npm run integra`

`npm run integra` (`scripts/integrate.sh`) fa aquests passos:
1. Verifica que el repositori de control és `main` i està net
2. Detecta les branques `codex/*` pendents i deixa seleccionar un bloc coherent
3. Fa una **prova de merge en worktree temporal**, sense tocar `main`
4. Regenera `.next/types` al worktree temporal i executa `typecheck` + `test:node`
5. Si tot és correcte, actualitza `origin/main` amb el cap validat
6. Sincronitza `main` local amb `origin/main`
7. Mostra un resum inequívoc de què ha entrat, si `main` és neta i si queda pendent decidir deploy

`npm run publica` executa `scripts/deploy.sh`, que fa:
1. Preflight git al **repositori de control** (branca=main, working tree net, pull ff-only)
2. Detectar fitxers canviats (main vs prod)
3. Classificar risc (ALT/MITJÀ/BAIX) per patrons de path
4. **Backup curt automàtic** quan el risc és ALT fiscal (si l'entorn està configurat)
5. **Anàlisi fiscal i d'impacte** — detecta si el canvi pot afectar diners, saldos o fiscalitat.
6. Verificacions locals (`verify-local.sh` + `verify-ci.sh`)
7. Resum
8. **Avís guiat de negoci** si hi ha risc ALT residual: no tècnic, amb impacte possible i recomanació clara.
9. **Pla de rollback automàtic** guardat a `docs/DEPLOY-ROLLBACK-LATEST.md`
10. Merge ritual (main→prod + push)
11. Post-deploy check automàtic (SHA remot + smoke amb URLs resoltes automàticament)
12. **Check post-producció automàtic de 3 minuts** (login, flux principal, informe/export)
13. Registre a `docs/DEPLOY-LOG.md` + incidències a `docs/DEPLOY-INCIDENTS.md` si hi ha bloqueig
14. Sincronització final de `main` amb `origin/main` si els logs han creat commits nous

### Autorització

- **Trigger d'inici:** el CEO escriu `"Comença"`, `"Inicia"` o `"Implementa"` → Codex executa `npm run inicia` o `npm run implementa` (mateix efecte)
- **Trigger de tancament:** el CEO escriu `"Acabat"` → Codex executa `npm run acabat`
- **Trigger d'integració:** quan la branca ja és llesta → Codex executa `npm run integra`
- **Trigger de publicació:** el CEO escriu `"Autoritzo deploy"` → Codex executa `npm run publica`
- El script detecta el nivell de risc automàticament
- El script s'atura si les verificacions fallen
- `Inicia` i `Implementa` serveixen igual.

### Sortida esperada cap al CEO

- Quan hi ha canvis locals, el sistema mostra sempre:
  - bloc `RESUM NO TÈCNIC` (què s'ha fet, implicació, què pot notar l'entitat)
  - bloc `SEGÜENT PAS RECOMANAT` indicant quan dir `Acabat`
- Després d'`acabat`, el sistema mostra:
  - estat curt de la branca (`commit pujat`, `llest per integració`)
  - bloc `SEGÜENT PAS RECOMANAT` indicant `npm run integra`
- Després d'`integra` OK, el sistema mostra:
  - quines branques han entrat
  - si `origin/main` ha quedat actualitzat
  - si `main` local ha quedat alineada i neta
  - bloc `SEGÜENT PAS RECOMANAT` indicant si ja es pot decidir deploy
- Text obligatori del bloc `QUÈ VOL DIR AUTORITZO DEPLOY`:
  - Dir `Autoritzo deploy` vol dir publicar els canvis preparats a producció.
  - Es faran comprovacions automàtiques abans i després.
  - Si alguna comprovació falla, no es publica.
  - L'entitat podria notar canvis immediatament després de publicar.
- Quan el CEO respon `Autoritzo deploy`, Codex executa publicació en silenci.
- Si tot va bé, la resposta final és només: `Ja a producció.`
- Si alguna verificació falla, no es publica i Codex explica el bloqueig en una frase clara.
- Després de `publica`, `main` i `origin/main` han de quedar alineades o el resultat s'ha de marcar explícitament com a `PENDENT`.

### Pràctiques operatives automàtiques (sense passos manuals del CEO)

- Backup curt selectiu abans de deploy en risc ALT fiscal (si hi ha configuració d'entorn).
- Rollback preparat automàticament abans de publicar.
- Check post-producció de 3 minuts automatitzat.
- Mini-registre d'incidència quan un deploy queda bloquejat.
- Si no hi ha URLs de smoke definides, el sistema prova automàticament amb `DEPLOY_BASE_URL` o amb la URL publicada detectada a `firebase.json`.
- Prova prèvia de merge a `integra` en worktree temporal per detectar solapaments abans de tocar `main`.
- `worktree:gc` neteja automàticament worktrees integrats nets i branques `codex/*` fusionades que ja no tenen worktree.
- `check-doc-sync` en mode flexible per defecte (warnings). Si cal bloqueig estricte de documentació: `DOC_SYNC_STRICT=1`.

### Missatge de commit

- El commit ha de tenir un nom representatiu del canvi.
- Si el CEO no dicta un text concret, el sistema genera automàticament un missatge representatiu segons fitxers i impacte.

### Estat operatiu (frases obligatòries)

Codex només pot reportar un d'aquests tres estats:
- `No en producció`
- `Preparat per producció`
- `A producció`

### Regla d'avisos de negoci (no tècnics)

- **BAIX/MITJÀ:** cap pregunta humana.
- **ALT residual:** no es pregunta per defecte; es mostra un **avís guiat**.
- **Format obligatori de l'avís:** impacte per l'entitat (què s'ha tocat, què pot veure malament, què ja està validat, recomanació clara).
- **Prohibit preguntar** sobre comandes, flags, branques, merges o logs tècnics.
- **Bloqueig només en casos forts:** preflight git, verificacions/CI, oracle fiscal, conflicte d'integració.
- Mode estricte opcional: `DEPLOY_REQUIRE_MANUAL_CONFIRMATION_ON_RESIDUAL_ALT=1` (amb aquest mode, risc ALT residual sí bloqueja).
- Els avisos guiats es registren al deploy log.

### Restriccions Codex

- **NO pot** decidir quan desplegar
- **NO pot** fer canvis fora del ritual establert
- **NO pot** usar `--no-verify` en cap cas
- **Implementa sempre** en worktrees de tasca (`codex/*`), mai directament al repositori de control
- **Publica només** des del repositori de control a `main`

### Protecció contra artefactes de build i dependències

El workflow bloqueja explícitament qualsevol fitxer staged sota:
- `node_modules/`
- qualsevol subruta `node_modules/` dins del repositori (incloent `functions/`)
- `.next/`
- `dist/`
- `build/`
- `.turbo/`

Encara que `.gitignore` ja els exclou, el workflow aplica un segon nivell de protecció.  
Nota: per provar el bloqueig de forma controlada (smoke test), pot ser necessari utilitzar `git add -f`.

---

## 6. Rollback

### Rollback bàsic (emergència)

```bash
git checkout prod
git reset --hard <SHA_BON>
git push --force-with-lease
```

Firebase App Hosting redesplegarà automàticament.

**Regla:** Rollback sempre des de `prod`.

### Protocol complet

Per incidents específics (bot, API, Storage, etc.), escenaris detallats i temps estimats:

👉 **Veure [`docs/operations/DEPLOY-ROLLBACK.md`](./operations/DEPLOY-ROLLBACK.md)**

Aquest document conté:
- Escenaris d'error específics (bot, diagnostics, Storage JSON, etc.)
- Rollback parcial vs complet
- Temps estimat per escenari
- Verificació post-rollback
- Procediments de documentació d'incidents

---

## 7. Regles d'or

1. Mai commit directe a `prod`
2. Repositori de control sempre a `main` i net abans d'obrir tasca o publicar
3. Implementació sempre en worktree extern (`codex/*`)
4. Un commit = un propòsit clar
5. Build + test abans de merge
6. Deploy només amb autorització CEO
7. Rollback des de `prod`
8. Risc ALT = confirmació extra obligatòria

---

## 8. Casos especials

| Cas | Tractament |
|-----|------------|
| Web pública (`/public/*`) | Risc BAIX |
| Novetats producte (Firestore `productUpdates`) | Fora d'aquest protocol (SuperAdmin) |
| DEMO | Mai tocar `prod` |
| Canvis visuals | Verificar en mòbil abans de merge |
| Generador pain.008 (`src/lib/sepa/pain008/*`) | Risc ALT — Verificar compatibilitat amb Mode Santander (veure `DEV-SOLO-MANUAL.md` §18) |

---

## 9. Quan canviar aquest model

Només si:
- **Equip 3+ devs** → afegir PRs obligatoris
- **CI/CD automatitzat** → afegir protecció de branques

Fins llavors: **simplicitat i disciplina > automatització**.

---

**Aquest document és norma del projecte.**
Quan algú pregunti "com despleguem Summa?", la resposta és: llegeix aquest document i segueix-lo.
