# Deploy — contracte vigent

Document curt d'autoritat operativa.

## Contracte vigent

- `npm run inicia` crea branca `codex/*` + worktree extern.
- La feina es fa només dins del worktree de tasca.
- `npm run acabat` només valida, commita i puja la branca.
- `npm run integra` és l'única porta d'entrada a `main`.
- `npm run status` és la font única d'estat operatiu.
- Si `npm run status` diu `BLOQUEJAT`, ni `integra` ni `publica` poden continuar.
- `npm run publica` és l'única porta d'entrada a `prod`.

## Flux normal

```bash
npm run inicia
# implementar dins del worktree
npm run acabat
npm run integra
npm run status
npm run publica
```

## Què garanteix `acabat`

- La branca `codex/*` queda validada, commitada i pujada.
- `main` no es toca.
- `prod` no es toca.

## Què garanteix `integra`

- Només entra a `main` una branca llesta.
- La integració es valida abans de tocar `main`.
- Si falla, `main` queda intacta.
- Si passa, `main` queda com a base única per publicar.

## Què garanteix `status`

- Resumeix `WORK`, `MAIN`, `PROD` i el parc de worktrees.
- Decideix si l'estat global és `OK` o `BLOQUEJAT`.
- Si diu `BLOQUEJAT`, s'atura el ritual i es diagnostica el repo.

## Què garanteix `publica`

- Publica a `prod` només allò que ja és a `main`.
- No accepta residus ni `prod` fora de `main`.
- Deixa traça operativa del resultat.

## Què passa quan alguna cosa falla

- Si falla `acabat`, la feina continua al worktree i no s'integra res.
- Si falla `integra`, `main` queda intacta.
- Si `status` diu `BLOQUEJAT`, primer s'aplica `docs/REPO-HIGIENE-I-DIAGNOSTIC.md`.
- Si falla `publica`, `prod` no s'ha de donar per actualitzada.
