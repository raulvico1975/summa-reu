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
npm run publica
```

## Què garanteix cada pas

### `npm run acabat`

- executa checks locals i CI quan hi ha canvis
- fa commit i push de la branca de feina
- no toca `main`

### `npm run integra`

- només corre des del repositori de control
- valida el merge en un worktree temporal
- regenera `next typegen` abans del `typecheck`
- només actualitza `origin/main` si la prova és correcta
- sincronitza `main` local després del push

Resultat esperat:
- `origin/main` actualitzat: `SI`
- `main alineada amb origin/main`: `SI`
- `main neta`: `SI`

### `npm run publica`

- només corre des de `main` al repositori de control
- fa preflight git, verificacions i classificació de risc
- prepara rollback i registra el resultat a `docs/DEPLOY-LOG.md`
- fa el merge `main -> prod`, push i post-check automàtic
- si els logs de deploy creen commits nous a `main`, els sincronitza també a `origin/main`

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
