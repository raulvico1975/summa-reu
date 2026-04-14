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

## Tres estats i quatre etiquetes de worktree

El terme genèric `net` queda prohibit com a estat suficient. A partir d'ara només es pot parlar de:

- `NETA_DE_TASCA`: el worktree/branca actual està en estat correcte per tancar la tasca.
- `LLESTA_PER_INTEGRAR`: la branca es pot integrar a `main` sense bloqueig.
- `LLESTA_PER_PUBLICAR`: `main`, `prod`, worktrees, validacions i precondicions permeten publicar ara mateix.

Per als worktrees, el sistema només pot etiquetar:

- `ACTIU`: tasca viva, ordenada i sense risc operatiu.
- `BLOQUEJANT`: worktree que sí impedeix integrar o publicar.
- `RESIDUAL`: worktree ambigu, trencat, detached o prunable.
- `INTEGRAT-NET`: worktree ja integrat i net, pendent només de tancar-se.

Regla curta:

- Una tasca pot estar tancada i no estar llesta per publicar.
- `Integrable` i `publicable` no són sinònims.
- Un worktree `actiu` no és necessàriament `bloquejant`.
- `Autoritzo deploy` només es pot dir quan l'estat global és explícitament `llesta per publicar`.

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
- Tanca només la feina del worktree actual; no ha d'arrossegar altres worktrees ni altres tasques.
- `main` no es toca.
- `prod` no es toca.

## Què garanteix `integra`

- Només entra a `main` una branca llesta.
- La integració es valida abans de tocar `main`.
- Si falla, `main` queda intacta.
- Si passa, `main` queda com a base única per publicar.

## Què garanteix `status`

- Resumeix `TASCA`, `MAIN`, `PUBLICACIÓ` i l'estat del parc de worktrees.
- Distingeix entre worktrees `actius`, `bloquejants`, `residuals` i `integrats-nets`.
- Dona una línia executiva final:
  - `DECISIÓ CEO: POTS DIR "AUTORITZO DEPLOY"`
  - o `DECISIÓ CEO: NO POTS DIR "AUTORITZO DEPLOY"`
- Si no es pot publicar, mostra només 1-3 motius curts.

## Què garanteix `publica`

- Publica a `prod` només allò que ja és a `main`.
- No accepta worktrees `bloquejants`, worktrees `residuals` ni `prod` fora de `main`.
- No es bloqueja només perquè hi hagi altres worktrees `actius` i ordenats en paral·lel.
- `git push origin prod` per si sol no és criteri suficient de deploy verd.
- El ritual verifica la revisió backend activa abans de publicar, materialitza o comprova el rollout real d'App Hosting i exigeix canvi de revisió efectiva.
- També exigeix una comprovació canònica d'un endpoint server-side estable abans de donar la publicació per bona.
- Deixa traça operativa del resultat.

## Què passa quan alguna cosa falla

- Si falla `acabat`, la feina continua al worktree i no s'integra res.
- Si falla `integra`, `main` queda intacta.
- Si `status` diu `BLOQUEJAT`, primer s'aplica `docs/REPO-HIGIENE-I-DIAGNOSTIC.md`.
- Si falla `publica`, `prod` no s'ha de donar per actualitzada.

## Traducció per a negoci

- `commit`: tancar un paquet de canvis de la tasca actual.
- `push`: pujar aquest paquet al servidor.
- `deploy` o `publica`: fer arribar a producció allò que ja ha passat per `main`.
