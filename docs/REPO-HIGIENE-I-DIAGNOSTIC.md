# Repo Higiene i Diagnòstic

Document curt per tallar bloquejos de repo abans d'integrar o publicar.

## 1. Símptomes de repo brut

- worktrees residuals
- `main` amb canvis locals
- `prod` amb commits fora de `main`
- més d'una branca llesta per integrar
- `ESTAT GLOBAL: BLOQUEJAT`

## 2. Diagnòstic mínim obligatori

1. Executar `npm run status`.
2. Executar `npm run worktree:list`.
3. Comprovar l'estat de `main` al repositori de control:
   ```bash
   git branch --show-current
   git status --short
   git fetch origin --prune
   git rev-parse main
   git rev-parse origin/main
   ```
4. Confirmar si hi ha canvis locals al repo de control.
5. Confirmar si hi ha branques `codex/*` integrades però no tancades:
   ```bash
   git branch --merged main | rg 'codex/'
   npm run worktree:list
   ```

## 3. Accions segures

### Quan usar `npm run worktree:close`

- Quan la branca ja està integrada i el worktree ja no ha de quedar actiu.
- Quan una tasca s'abandona i abans s'ha decidit què passa amb els canvis.
- Després d'haver revisat `npm run worktree:list` i d'entendre quin worktree s'està tancant.

### Quan usar `npm run worktree:gc`

- Després de passar `npm run status` i `npm run worktree:list`.
- Quan hi ha worktrees integrats, nets o vells que es poden netejar sense risc.
- Com a neteja segura de residus, no com a substitut d'entendre l'estat real.

### Quan no fer deploy

- Quan `npm run status` diu `BLOQUEJAT`.
- Quan `main` té canvis locals o no està alineada amb `origin/main`.
- Quan hi ha worktrees residuals o més d'una branca llesta.
- Quan `prod` conté commits fora de `main`.

### Quan escalar a neteja manual de branques o worktrees

- Quan `worktree:close` o `worktree:gc` no resolen el bloqueig.
- Quan hi ha rutes trencades, worktrees desapareguts o branques sense worktree.
- Quan una branca `codex/*` ja és a `main` però continua apareixent com a residu.
- Quan no és clar d'on surten els canvis locals del repositori de control.

## 4. Prohibicions

- No publicar amb residus.
- No implementar al repositori de control.
- No barrejar neteja de repo amb una feature.
- No arreglar un bloqueig amb cherry-picks improvisats sense haver aclarit abans l'estat real.
