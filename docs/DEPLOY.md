# Deploy — runtime real

Document curt d'autoritat operativa per al tram `main -> prod`.

## Contracte vigent

1. `npm run acabat` només tanca i puja la branca `codex/*`.
2. `npm run integra` és l'única porta d'entrada a `main`.
3. `npm run publica` és l'única porta d'entrada a `prod`.
4. El repositori de control és `/Users/raulvico/Documents/summa-social`.
5. `prod` no rep commits directes.

## Flux normal

```bash
npm run inicia
# implementar dins del worktree
npm run acabat
npm run integra
npm run status
npm run publica
```

Els passos mentals reals són 3:

1. `WORK` — treballar a una sola branca de tasca
2. `MAIN` — integrar-la i deixar `main` alineada
3. `PROD` — publicar-la

`acabat` i `worktree:close` continuen existint com a automatismes, però no com a “quarta” o “cinquena” veritat del sistema.

## Què garanteix cada pas

### `npm run acabat`

- executa checks locals i CI quan hi ha canvis
- fa commit i push de la branca de feina
- no toca `main`

### `npm run integra`

- només corre des del repositori de control
- falla en sec si hi ha worktrees residuals, més d'una branca llesta o feina local oberta en algun worktree
- valida el merge en un worktree temporal
- regenera `next typegen` abans del `typecheck`
- només actualitza `origin/main` si la prova és correcta
- sincronitza `main` local després del push

Resultat esperat:
- `origin/main` actualitzat: `SI`
- `main alineada amb origin/main`: `SI`
- `main neta`: `SI`

### `npm run status`

- és la font única d'estat operatiu
- mostra només:
  - `WORK`
  - `MAIN`
  - `PROD`
  - resum de worktrees
  - `ESTAT GLOBAL: OK/BLOQUEJAT`
- si diu `BLOQUEJAT`, el sistema no accepta `integra` ni `publica`

### `npm run publica`

- només corre des de `main` al repositori de control
- falla en sec si hi ha worktrees actius/residuals o si `prod` conté commits fora de `main`
- fa preflight git, verificacions i classificació de risc
- prepara rollback i registra el resultat a `docs/DEPLOY-LOG.md`
- fa el merge `main -> prod`, push i post-check automàtic
- si els logs de deploy creen commits nous a `main`, els sincronitza també a `origin/main`
- si el SHA remot triga a reflectir `prod` però la resta de comprovacions passen, el resultat final es normalitza a `OK`

Resultat esperat:
- `prod` actualitzada
- `main` alineada amb `origin/main`
- post-check automàtic confirmat o marcat com `PENDENT`
- registre escrit a `docs/DEPLOY-LOG.md`

## Quan alguna cosa falla

- Si falla `acabat`: la branca continua al worktree i no s'integra res.
- Si falla `integra`: `main` queda intacta i el resum ha d'indicar el bloqueig real.
- Si falla `publica`: `prod` no s'ha d'actualitzar i el bloqueig queda registrat.

## Verificació operativa

- Smoke del 2026-03-20: worktree creat amb `.env.local`, `.env.demo` i `node_modules` enllaçats automàticament, sense passos manuals extra.

## Traça mínima de l'estabilització del ritual (2026-03-20)

- Defectes corregits:
  - `npm run integra` podia donar fals `KO` perquè `typecheck` corria abans de regenerar `.next/types`.
  - `npm run integra` podia deixar dubte sobre si `origin/main` i `main` havien quedat realment alineades.
  - `npm run publica` podia deixar `main` per davant d'`origin/main` després dels commits automàtics de logs.
  - `npm run publica` podia acabar en `PENDENT` fals quan només fallava la propagació immediata del SHA remot però la resta de comprovacions ja havien confirmat el deploy.
  - el cicle de worktrees exigia massa diagnòstic manual per saber què era actiu, què es podia tancar i què es podia netejar.
- Fitxers tocats en aquesta estabilització:
  - `scripts/integrate.sh`
  - `scripts/worktree.sh`
  - `scripts/workflow.sh`
  - `scripts/deploy.sh`
  - `docs/GOVERN-DE-CODI-I-DEPLOY.md`
  - `docs/DEV-SOLO-MANUAL.md`
  - `docs/DEPLOY.md`
- Bloc de commits que conté la correcció:
  - `b070bedc` — fiabilitat d'`integra`, resum operatiu i higiene de worktrees
  - `2f6a91ca` — sincronització final de `main` després de `publica`
  - `955f7cb1` — normalització del resultat final de `publica` quan el SHA remot arriba tard
- Prova real del flux complet:
  - el 2026-03-20 es va executar un cicle complet `codex/* -> acabat -> integra -> worktree:close -> publica` amb resultat final `OK`
  - el deploy va quedar confirmat per smoke, contingut públic, check de 3 minuts i oracle postdeploy
  - `main` i `origin/main` van quedar alineades al final del ritual i `prod` va quedar actualitzada
