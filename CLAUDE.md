# CLAUDE — Model d'autorització operativa (Summa Social)

Aquest document defineix **quan Claude Code pot executar sense preguntar**
i **quan ha d'aturar-se obligatòriament** per decisió humana.

────────────────────────────────────────────────────────────
## 1. Autorització implícita (NO cal demanar permís)

Claude Code POT executar, modificar i commitejar directament quan el risc és
**BAIX o MITJÀ**, sempre amb criteri conservador i canvi mínim.

### Risc BAIX — Executar directament
- Traduccions i18n:
  - `src/i18n/**`
- Documentació:
  - `docs/**`
  - `*.md`, `*.txt`
- Contingut estàtic:
  - `public/**`
- Microcopy, textos d'ajuda, labels
- Neteja de codi mort
- Tests (afegir, ajustar, millorar)
- Build i verificacions locals

### Risc MITJÀ — Executar directament
- UI / UX:
  - `src/components/**`
  - `src/app/**` (EXCEPTE `src/app/api/**`)
- Hooks i estat de presentació:
  - `src/hooks/**`
- Lògica auxiliar NO crítica:
  - `src/lib/**` (EXCEPTE zones RISC ALT)
- Refactors locals i conservadors:
  - llegibilitat
  - eliminació de duplicació
  - extracció de helpers
- Exports (CSV / Excel / PDF) **sense impacte fiscal**

➡️ En aquests casos:
- NO demanar autorització
- NO preguntar "confirmes?"
- Executar i reportar resultat

────────────────────────────────────────────────────────────
## 2. STOP obligatori — Autorització explícita requerida

Claude Code **HA D'ATURAR-SE** i demanar decisió de Raül abans de continuar
si detecta qualsevol canvi de **RISC ALT**.

### 2.1 Fiscalitat i conciliació (RISC ALT)
- Model 182, 347, certificats
- Càlculs fiscals, nets, recurrència
- Conciliació bancària
- Ledger, veritat bancària
- Remeses:
  - IN / OUT
  - devolucions
  - undo / reprocess
- SEPA:
  - pain.001
  - pain.008
- Invariants definits a:
  - `SUMMA-SOCIAL-REFERENCIA-COMPLETA.md`
  - `docs/QA-FISCAL.md`

### 2.2 Mòdul Projectes — CRÍTIC (RISC ALT)
Qualsevol canvi que afecti **imports, conversions o coherència econòmica**:

#### Tipus de canvi (FX)
- TC del projecte
- TC ponderat
- TC manual / forçat
- Reaplicació de TC
- Arrodoniments
- Conversions moneda → EUR

#### Pressupostos i execució
- Càlculs de:
  - pressupost total
  - executat
  - pendent
  - desviacions
- Agregacions per partida
- Percentatges
- Imports justificables

#### Assignacions
- Splits
- Reassignacions
- Eliminacions parcials
- Qualsevol lògica que redistribueixi imports

➡️ **Tot això és STOP automàtic**, encara que estigui "només" a UI o hooks.

### 2.3 Arquitectura i govern (RISC ALT)
- Afegir dependències noves
- Canviar model de dades Firestore
- Modificar Firestore Rules o Storage Rules
- Canvis massius o migracions
- Scripts que escriguin dades reals
- Alterar fluxos:
  - PROCESSAR → DESFER → REPROCESSAR

────────────────────────────────────────────────────────────
## 2.b Detecció automàtica de risc (per paths tocats)

Claude Code HA de classificar el risc segons els **fitxers modificats**.

### Regla principal
- **Si hi ha qualsevol path RISC ALT → STOP**
- Només BAIX/MITJÀ → executar

### Paths RISC ALT (STOP)
- `src/app/api/**`
- `src/lib/fiscal/**`
- `src/lib/remittances/**`
- `src/lib/sepa/**`
- `src/app/**/project-module/**`
- `src/lib/**/fx*`
- `src/lib/**/exchange*`
- `src/lib/**/budget*`
- `firestore.rules`
- `storage.rules`
- `scripts/**` (si fa writes a Firestore o dades reals)

### Paths RISC MITJÀ
- `src/components/**`
- `src/app/**` (excepte api i project-module crític)
- `src/hooks/**`
- `src/lib/**` (helpers no crítics)
- `functions/**`

### Paths RISC BAIX
- `src/i18n/**`
- `docs/**`
- `public/**`
- `*.md`, `*.txt`

### Report obligatori (al final de cada tasca)
- **RISC:** BAIX | MITJÀ | ALT
- **Paths tocats:** (llista curta)
- **Checks executats:** build / test / verify
- **Estat:** `No en producció` | `Preparat per producció` | `A producció`

────────────────────────────────────────────────────────────
## 3. Deploy

Claude Code **NO pot desplegar mai** per iniciativa pròpia.

### 3.1 Bloc d'impacte obligatori (ABANS de demanar autorització)

Abans de proposar un deploy, Claude Code **HA de presentar** aquest bloc:

```
IMPACTE DEL CANVI

1. Pot afectar diners, saldos o fiscalitat?
   Resposta: Sí/No + frase clara en llenguatge no tècnic.

2. Si hi hagués un error, què podria passar?
   Resposta: conseqüència real sobre l'ús de Summa Social.

3. Recomanació:
   🟢 Desplegar
   🟡 Provar abans amb un cas real
   🔴 No desplegar encara
```

**Regles del bloc:**
- Si el canvi afecta càlculs, remeses, conciliació o fiscalitat, la resposta 1 ha d'explicar **exactament** quin càlcul o flux s'està modificant.
- Si no afecta diners, ha de dir explícitament: **"No es modifica cap càlcul ni saldo."**
- La classificació de risc interna es manté per lògica, però **no s'exposa** a Raül.
- No s'usa terminologia tècnica (P0, gate, risk level, etc.) en cap missatge destinat a Raül.

### 3.2 Autorització i execució

Quan Raül escriu literalment:

> "Inicia"

Claude Code executa:

```bash
npm run inicia
```

Aquesta ordre prepara el desenvolupament:
- només es pot executar des del repositori de control (`/Users/raulvico/Documents/summa-social`) a `main` i net
- crea branca `codex/...` + worktree extern de tasca
- Claude continua la implementació dins del worktree creat

Opcionalment, si s'indica una àrea funcional, Claude pot reservar-la:

```bash
npm run inicia -- remeses
```

Si ja hi ha una tasca activa d'aquella àrea, el sistema bloqueja l'inici (`BLOCKED_SAFE`) per evitar solapaments.

Quan Raül escriu literalment:

> "Implementa"

Claude Code executa:

```bash
npm run implementa
```

`Implementa` és equivalent a `Inicia`.
`Inicia` i `Implementa` serveixen igual.

Quan Raül escriu literalment:

> "Acabat"

Claude Code executa:

```bash
npm run acabat
```

Això llança `scripts/workflow.sh acabat`, que:
- executa verificacions locals i CI (`verify-local.sh`, `verify-ci.sh`)
- commiteja i fa push
- entra a una cua d'integració única
- prova el merge contra `main` actualitzat abans d'integrar
- integra a `main` al repositori de control només si la prova passa
- pregunta operativament si cal tancar el worktree de tasca

Després de completar aquesta fase, Claude:
- escriu literalment `Acabat`
- mostra bloc `RESUM NO TÈCNIC` (què s'ha fet, implicació, què pot notar l'entitat)
- mostra bloc `SEGÜENT PAS RECOMANAT`
- si queda `Preparat per producció`, mostra també bloc `QUÈ VOL DIR AUTORITZO DEPLOY`

Quan Raül escriu literalment:

> "Autoritzo deploy"

Claude Code executa:

```bash
npm run publica
```

Precondició obligatòria: executar-ho des del repositori de control (`/Users/raulvico/Documents/summa-social`) a `main`.

Això llança `scripts/deploy.sh`, que és un script determinista i bloquejant que:
- verifica git, detecta canvis
- executa backup curt automàtic en risc ALT fiscal (si està configurat)
- analitza impacte fiscal i bloqueja si les comprovacions no són suficients
- executa verificacions locals
- prepara rollback automàtic a `docs/DEPLOY-ROLLBACK-LATEST.md`
- fa el merge ritual (main→prod) i push
- força post-deploy check (SHA + smoke test + check 3 minuts)
- registra el deploy a `docs/DEPLOY-LOG.md`
- registra bloquejos a `docs/DEPLOY-INCIDENTS.md`
- si no hi ha URLs de smoke definides, intenta resoldre-les automàticament amb `DEPLOY_BASE_URL` o `firebase.json`

Claude Code **NO pot** saltar cap pas del script ni usar `--no-verify`.

Si el deploy passa sense errors, Claude respon només:
`Ja a producció.`

Si hi ha bloqueig, Claude explica en llenguatge no tècnic què ha fallat i quin és el següent pas.

### Guia del procés (obligatòria)

- El sistema ha de guiar sempre el següent pas en llenguatge no tècnic.
- Amb canvis locals: mostrar `RESUM NO TÈCNIC` + `SEGÜENT PAS RECOMANAT` per indicar quan dir `Acabat`.
- Després d'`acabat` amb estat `Preparat per producció`: mostrar `QUÈ VOL DIR AUTORITZO DEPLOY` + `SEGÜENT PAS RECOMANAT`.
- Text obligatori del bloc `QUÈ VOL DIR AUTORITZO DEPLOY`:
  - Dir `Autoritzo deploy` vol dir publicar els canvis preparats a producció.
  - Es faran comprovacions automàtiques abans i després.
  - Si alguna comprovació falla, no es publica.
  - L'entitat podria notar canvis immediatament després de publicar.
- Si no es pot fer un resum clar, no recomanar `Acabat` i indicar que cal concretar millor l'impacte.

### Missatge de commit (obligatori)

- El commit no pot ser genèric.
- Ha d'incloure un nom representatiu del canvi (àrea i impacte funcional).
- Si no hi ha missatge explícit del CEO, Claude genera automàticament un missatge representatiu a partir dels fitxers canviats.

────────────────────────────────────────────────────────────
## 4. Regla d'or

Si un canvi:
- pot afectar dades reals d'una ONG
- pot generar errors silenciosos
- pot desquadrar imports, justificacions o saldos

➡️ **STOP automàtic i preguntar**

────────────────────────────────────────────────────────────
## 5. WORKTREE-FIRST (OBLIGATORI)

Aquesta secció aplica igual a **Claude** i **Codex**.

### Activació explícita obligatòria
El flux worktree-first només s'activa si el missatge comença literalment per:
- `Implementa:`
- `Inicia:`
- `Hotfix:`
- `Refactor:`

No s'activa per paraules soltes dins d'una frase.

### Precondició obligatòria al control
Abans de crear worktree:
- validar que el repositori de control està a `main` i net
- si no està net o no és `main`, aturar i demanar neteja o autorització explícita per stash/reset segons governança

### Flux operatiu obligatori
1. executar `npm run inicia` des de `/Users/raulvico/Documents/summa-social` (control)  
   opcional: `npm run inicia -- <area>` per reservar àrea i evitar solapament
2. canviar a la ruta del worktree creat
3. implementar i commitejar només dins del worktree
4. integrar amb `npm run acabat`
5. oferir tancament i executar `npm run worktree:close` si l'usuari diu `OK`
6. tornar al control només per `npm run publica` (si escau)

### Regles de context
- No crear worktree per consultes o anàlisi.
- Si la petició indica àrea (`npm run inicia -- <area>`), respectar el bloqueig automàtic d'àrea activa (`BLOCKED_SAFE`) i no forçar l'obertura d'una nova tasca en la mateixa àrea.
- Mai executar `publica` fora del control.
- Si algú intenta publicar fora del control, mostrar missatge de bloqueig:
  - `BLOQUEIG: npm run publica només es pot executar des del repositori de control a main.`

### Treball en paral·lel
- Es poden tenir múltiples worktrees oberts.
- Claude/Codex mai barreja fitxers entre worktrees.
- Claude/Codex mai integra una branca que no sigui la activa.
- Claude/Codex mai fa merge manual al control.
- Claude/Codex sempre usa `npm run acabat`.
- `acabat` usa cua d'integració i prova prèvia de merge abans de tocar `main`.
- La gestió de múltiples tasques és seqüencial per execució i paral·lela per aïllament físic.

### Format de petició recomanat
- `Implementa: <slug> — <objectiu en 1 frase>`
- Opcional: `Risc esperat: BAIX/MITJÀ/ALT`

────────────────────────────────────────────────────────────
## 6. Regla de comunicació amb Raül (obligatòria)

Claude Code **NO pot fer preguntes opaques, tècniques o inintel·ligibles**.

### Prohibit
- ❌ Preguntes del tipus:
  - "Vols executar aquesta comanda?"
  - "Confirmes?"
  - "Yes / No?"
  - "Autoritzes això?"
  **sense explicar abans què és i què implica**

- ❌ Preguntar sobre:
  - pipes, redireccions, flags (`|`, `&&`, `2>&1`, etc.)
  - sintaxi de shell
  - detalls d'execució tècnica interna
  - `git`, `merge`, branques, commits, push, SHA o logs tècnics

### Obligació abans de qualsevol pregunta
Si Claude necessita una confirmació, **HA D'EXPRESSAR-HO així**:

1. **Què és** (en llenguatge no tècnic)
2. **Què fa**
3. **Què NO fa**
4. **Si és segur o no**
5. **Què significa exactament dir "sí"**

### Exemple correcte
> "Això és una validació de traduccions.
> No modifica cap dada ni cap codi.
> Només comprova que els textos estiguin complets.
> Dir 'sí' només vol dir executar la comprovació.
> Ho executo?"

### Regla clau
Si **no es pot explicar en llenguatge humà**,
➡️ **Claude NO ha de preguntar** i ha de:
- executar directament (si risc BAIX/MITJÀ), o
- aturar-se i explicar el problema (si risc ALT)

### Política de preguntes en deploy (obligatòria)

- BAIX/MITJÀ: cap pregunta humana.
- ALT: només preguntar si queda risc residual després de verificacions automàtiques.
- La pregunta ha de ser de negoci/impacte, amb aquest format:
  1) Què s'ha tocat (llenguatge pla)
  2) Quin risc real pot causar a l'entitat
  3) Què veuria l'entitat si falla
  4) Opció A (recomanada): no publicar encara
  5) Opció B: publicar assumint risc temporal visible
- Si no es pot formular amb aquest format: **BLOCKED_SAFE** (sense pregunta).

### Traducció de responsabilitat
Raül **NO ha de prendre decisions tècniques de terminal**.
La responsabilitat de saber si una acció és segura és **de Claude Code**.

En cas de dubte:
- Claude explica
- Claude proposa
- Raül decideix amb criteri, no amb sintaxi

────────────────────────────────────────────────────────────
## 7. Regla de documentació mínima (obligatòria)

Claude Code **HA de documentar** quan un canvi:

- altera comportament visible per l'usuari
- introdueix una nova opció, botó o flux
- canvia una regla existent (encara que sigui subtil)
- resol un bug que abans afectava dades o fluxos

### On documentar (obligatori)
- Si és funcionament intern → `docs/` (nota tècnica breu)
- Si és ús d'usuari → `manual-usuari-summa-social.md`
- Si afecta ambdós → tots dos

### Què documentar (format curt)
1. Què passava abans
2. Què passa ara
3. Com ho nota l'usuari (o què NO notarà)
4. Si cal fer alguna cosa diferent o no

### Prohibit
- ❌ "documentar per si de cas"
- ❌ textos genèrics
- ❌ documentació que no correspongui a cap canvi real

Si el canvi **no es pot explicar en 4 punts**, probablement **no està prou clar**.

────────────────────────────────────────────────────────────
## 8. Regla del Manual d'Usuari (rol estricte)

Quan Claude Code escriu o modifica el
`manual-usuari-summa-social.md`:

### Rol obligatori
Claude actua com:
> "Persona que acompanya algú no tècnic que porta els comptes d'una ONG"

### Regles d'escriptura
- Llenguatge no tècnic
- Explicacions procedimentals
- Frases completes
- Exemple abans que definició

### Prohibit al manual d'usuari
- ❌ parlar de codi, hooks, components, APIs
- ❌ parlar de "sistema", "arquitectura", "lògica interna"
- ❌ justificar decisions tècniques

### Pregunta de control obligatòria (interna)
Abans de guardar un canvi al manual, Claude ha de poder respondre:
> "Això ajuda algú a fer millor la seva feina real?"

Si la resposta no és clarament **sí**, no s'ha d'escriure.

────────────────────────────────────────────────────────────
## 9. Idioma i estil

- Resposta sempre en **català**
- Codi explícit, mínim, reversible
- No "millores" si ningú les ha demanat

> En cas de dubte entre executar o preguntar: **preguntar**.
