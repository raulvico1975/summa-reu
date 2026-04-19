# `src/help` status

Aquest directori queda congelat com a capa legacy de compatibilitat.

## Contracte actiu

L'ajuda visible del producte ja no es governa des d'aquí.

Fonts de veritat actives:

- `src/i18n/locales/*.json` per `help.*` (`HelpSheet`)
- `public/docs/manual-usuari-summa-social.{ca,es,fr}.md` per al manual runtime
- `docs/kb/cards/**/*.json` + `docs/kb/_fallbacks.json` per al bot
- `docs/generated/*` no entra al runtime del bot

## Manteniment pràctic del manual

- La versió de treball llarga que mantenim al repo viu a:
  - `docs/manual-usuari-summa-social.md` (CA)
  - `docs/manual-usuari-summa-social.es.md` (ES)
- El runtime continua servint:
  - `public/docs/manual-usuari-summa-social.ca.md`
  - `public/docs/manual-usuari-summa-social.es.md`
- Després d'editar els manuals del repo, sincronitza el runtime amb:
  - `npm run help:sync-manual`

## Com tractar aquest directori

- No afegir-hi contingut nou.
- No usar-lo com a font principal d'edició.
- Només mantenir-lo mentre existeixin dependències de compatibilitat no retirades.

Referència editorial: `docs/help/HELP-EDITORIAL-SINGLE-CONTRACT.md`
