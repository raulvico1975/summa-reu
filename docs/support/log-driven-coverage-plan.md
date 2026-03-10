# Log-Driven Coverage Plan

Source report:
- `/Users/raulvico/Documents/summa-social/reports/bot-top-problems.json`
- generatedAt: `2026-03-09T10:21:28.913Z`
- orgId: `PrNPBg7YFnk16f9gXdXw`

Observacions del report:
- Només hi ha `4` candidats reals a `recommendedCoverageCandidates`.
- Tots `4` mapen ja a una `bestCardId` existent amb `confidenceBand: high`.
- No hi ha `topFallback` ni `topNotHelpful`.
- Les mètriques de taxa (`fallbackRate`, `notHelpfulRate`, `reformulationRate`, `clarifyAbandonmentRate`) consten com `insufficient_data`, de manera que aquest report serveix per prioritzar cobertura existent, no per inferir problemes històrics nous.

## already-covered

- `com imputo una despesa a diversos projectes?`
  - status: `already-covered`
  - currentCardId: `guide-projects`
  - per què: la card ja conté l'intent exacte `imputar una despesa a diversos projectes`.
  - evidència:
    - `/tmp/summa-social-kb-clean/docs/kb/cards/guides/guide-projects.json`
    - `/tmp/summa-social-kb-clean/src/lib/support/eval/golden-set.ts`
    - `/tmp/summa-social-kb-clean/src/lib/support/kb-quality-gate.ts`

- `com imputo una despesa entre diferents projectes?`
  - status: `already-covered`
  - currentCardId: `guide-projects`
  - per què: la variant ja és al golden set crític i recupera la mateixa card.
  - evidència:
    - `/tmp/summa-social-kb-clean/docs/kb/cards/guides/guide-projects.json`
    - `/tmp/summa-social-kb-clean/src/lib/support/eval/golden-set.ts`

- `com puc saber les quotes que un soci ha pagat?`
  - status: `already-covered`
  - currentCardId: `manual-member-paid-quotas`
  - per què: la pregunta exacta ja està coberta per una card específica i està protegida al quality gate.
  - evidència:
    - `/tmp/summa-social-kb-clean/docs/kb/cards/manual/manual-member-paid-quotas.json`
    - `/tmp/summa-social-kb-clean/src/lib/support/eval/golden-set.ts`
    - `/tmp/summa-social-kb-clean/src/lib/support/kb-quality-gate.ts`

- `com pujo una factura o rebut o nòmina?`
  - status: `already-covered`
  - currentCardId: `guide-attach-document`
  - per què: la formulació exacta ja és a la card i al golden set crític.
  - evidència:
    - `/tmp/summa-social-kb-clean/docs/kb/cards/guides/guide-attach-document.json`
    - `/tmp/summa-social-kb-clean/src/lib/support/eval/golden-set.ts`
    - `/tmp/summa-social-kb-clean/src/lib/support/kb-quality-gate.ts`

## strengthen-existing-cards

- `none`
  - motiu: el report actual no mostra cap candidat amb `fallback`, `notHelpful` o `reformulation` fiable, i els quatre candidats principals ja tenen match exacte a cards existents.
  - decisió: no reforçar sinònims ni wording només “per si de cas”; esperar més senyal real o un cas concret d'error verificable.

## new-verified-cards-to-create

- `none`
  - motiu: el report no aporta cap pregunta freqüent que apunti a un flux real no cobert.

## blocked-by-verification

- `none from current report`
  - motiu: cap candidat del report apunta a funcionalitat no demostrada.

- `member-company-contact-link`
  - status: `blocked-by-verification`
  - motiu: el producte només exposa `Persona de contacte` com a camp informatiu d'empresa donant; no hi ha un flux verificat per vincular un soci com a contacte operatiu.
  - evidència base:
    - `/tmp/summa-social-kb-clean/docs/support/minimum-coverage-execution-log.md`
    - `/tmp/summa-social-kb-clean/docs/manual-usuari-summa-social.md`

- `member-fee-pause`
  - status: `blocked-by-verification`
  - motiu: no hi ha cap camp, estat o acció verificable de pausa formal de quota.
  - evidència base:
    - `/tmp/summa-social-kb-clean/docs/support/minimum-coverage-execution-log.md`
    - `/tmp/summa-social-kb-clean/src/components/donor-manager.tsx`

## deprioritized-candidates

- `none`
  - motiu: no hi ha candidats nous de baix volum per empènyer al final del backlog; el report és massa curt i els quatre casos ja estan coberts.

## next move

- Esperar un report amb més volum o amb mètriques prospectives fiables abans d'obrir backlog nou només per logs.
- Si apareixen noves preguntes freqüents fora de la cobertura mínima, classificar-les primer contra:
  - card existent recupera bé
  - card existent existeix però no recupera prou bé
  - flux real verificable sense card
  - flux no demostrable
