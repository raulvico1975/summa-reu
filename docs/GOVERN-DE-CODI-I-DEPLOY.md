# Govern de Codi i Deploy — Summa Social

Aquest és el contracte normatiu llarg del flux de treball i deploy.

- Dubte operatiu curt: `docs/DEPLOY.md`
- Bloquejos, residus i neteja: `docs/REPO-HIGIENE-I-DIAGNOSTIC.md`
- Ús pràctic i checklists: `docs/DEV-SOLO-MANUAL.md`

## 1. Model operatiu únic

Només hi ha tres veritats operatives:

1. `WORK`: una branca de feina oberta en un worktree extern de tasca.
2. `MAIN`: canvis integrats a `main`.
3. `PROD`: canvis publicats a `prod`.

Regles del model:

- El repositori de control és `/Users/raulvico/Documents/summa-social`.
- El repositori de control viu a `main` i s'ha de mantenir sense canvis locals pendents abans d'integrar o publicar.
- `npm run inicia` crea una branca `codex/*` i un worktree extern a `../summa-social-worktrees/<branch>`.
- La implementació es fa només dins del worktree de tasca.
- Treballar directament al repositori de control per fer una feature queda prohibit.
- `main` és integració; `prod` és producció.

## 1.1 Semàntica obligatòria dels estats

El terme genèric `net` queda prohibit com a estat suficient. A nivell operatiu només existeixen aquests tres estats:

- `NETA_DE_TASCA`: el worktree/branca actual està en estat correcte per tancar la tasca.
- `LLESTA_PER_INTEGRAR`: la branca es pot integrar a `main` sense bloqueig.
- `LLESTA_PER_PUBLICAR`: `main`, `prod`, worktrees, validacions i precondicions permeten publicar ara mateix.

Per als worktrees, només existeixen aquestes etiquetes:

- `ACTIU`
- `BLOQUEJANT`
- `RESIDUAL`
- `INTEGRAT-NET`

Interpretació obligatòria:

- Una tasca pot estar tancada i no estar llesta per publicar.
- `Integrable` i `publicable` no són sinònims.
- Un worktree `actiu` no és sinònim de worktree `bloquejant`.
- `Autoritzo deploy` només es pot dir quan l'estat global és explícitament `llesta per publicar`.

## 2. Flux obligatori

```bash
npm run inicia
# implementar dins del worktree
npm run acabat
npm run integra
npm run status
npm run publica
```

Interpretació obligatòria:

1. `npm run inicia` o `npm run implementa` només es llança des del repositori de control, a `main` i net.
2. El sistema crea branca `codex/*` + worktree extern.
3. La feina es desenvolupa i es valida només dins del worktree.
4. `npm run acabat` només valida, commita i puja la branca de feina.
5. `npm run integra` és l'única porta d'entrada a `main`.
6. `npm run publica` és l'única porta d'entrada a `prod`.

La decisió de publicar és separada del tancament i de la integració. Acabar una tasca no vol dir publicar-la.

## 3. Garanties dels scripts

### `npm run inicia`

- Exigeix repositori de control a `main` i net.
- Crea branca `codex/*` i worktree extern.
- Si s'indica una àrea (`npm run inicia -- <area>`), evita obrir una altra tasca activa a la mateixa àrea.

### `npm run acabat`

- S'executa des del worktree de tasca.
- Corre validacions i, si hi ha canvis locals, fa commit i push.
- Prepara només els fitxers canviats del worktree actual.
- No integra res a `main`.
- No publica res a `prod`.
- El resultat correcte és: branca llesta per integrar.

### `npm run integra`

- S'executa només des del repositori de control.
- És l'única porta d'entrada a `main`.
- Valida la integració en un worktree temporal abans de tocar `main`.
- Si falla, `main` queda intacta.
- Si passa, `main` queda alineada com a base única per a `publica`.

### `npm run status`

- És la font única d'estat operatiu.
- Resumeix `TASCA`, `MAIN`, `PUBLICACIÓ` i el parc de worktrees.
- Distingeix worktrees `actius`, `bloquejants`, `residuals` i `integrats-nets`.
- Ha d'acabar amb una decisió binària per al CEO:
  - `DECISIÓ CEO: POTS DIR "AUTORITZO DEPLOY"`
  - o `DECISIÓ CEO: NO POTS DIR "AUTORITZO DEPLOY"`
- Si diu `BLOQUEJAT`, ni `integra` ni `publica` poden continuar.

### `npm run publica`

- S'executa només des del repositori de control.
- És l'única porta d'entrada a `prod`.
- Publica a `prod` només allò que ja és a `main`.
- Un `git push origin prod` no compta com a deploy verd si App Hosting encara serveix la revisió backend anterior.
- El ritual ha de capturar la revisió backend activa abans de publicar, materialitzar o verificar el rollout real d'App Hosting i confirmar que la revisió efectiva canvia.
- Si la revisió backend no canvia de debò, `publica` ha de fallar.
- El criteri verd inclou una comprovació server-side canònica després del rollout real.
- No bloqueja per simple existència d'altres worktrees `actius`.
- Sí que bloqueja worktrees `bloquejants` o `residuals`.
- Si falla, `prod` no s'ha de donar per actualitzada.

## 4. Bloquejos que aturen el ritual

Qualsevol d'aquests casos talla el flux:

- `main` amb canvis locals.
- `main` desalineada amb `origin/main`.
- worktrees `residuals` o ambigus.
- worktrees `bloquejants`.
- més d'una branca llesta per integrar.
- `prod` amb commits fora de `main`.
- `ESTAT GLOBAL: BLOQUEJAT`.

Quan passi, no s'interpreta ni es força res. Es diagnostica amb `docs/REPO-HIGIENE-I-DIAGNOSTIC.md`.

## 5. Comandes auxiliars

Aquestes comandes són de manteniment, no de govern:

- `npm run worktree:list`: inspeccionar worktrees actius i residus.
- `npm run worktree:close`: tancar un worktree que ja no ha de quedar actiu.
- `npm run worktree:gc`: neteja segura de residus i worktrees integrats nets.

Cap d'aquestes comandes substitueix `acabat`, `integra` o `publica`.

## 6. Prohibicions

- No treballar sense worktree de tasca.
- No implementar al repositori de control.
- No interpretar `npm run acabat` com a integració.
- No interpretar un worktree `actiu` com a motiu automàtic de bloqueig.
- No fer deploy fora de `npm run publica`.
- No usar l'estat d'un worktree com a font de veritat per damunt de `npm run status`.
- No barrejar neteja de repo amb una feature.
- No fer cherry-picks improvisats per trencar un bloqueig sense aclarir abans l'estat real.
- No deixar dues versions actives del mateix ritual.

## 7. Regla final

Quan hi hagi dubte:

- `docs/DEPLOY.md` resol el dubte curt.
- aquest document fixa la norma llarga.
- `docs/REPO-HIGIENE-I-DIAGNOSTIC.md` resol el bloqueig.

Si d'una lectura d'aquests documents encara es pogués deduir "es pot treballar sense worktree" o "`acabat` ja integra", el contracte estaria mal escrit.
