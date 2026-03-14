# BOT Runtime Bug — 2026-03-14

## Resum executiu

La fallada real no és de KB publicada ni de scoring pur. El problema és que el runtime del bot memoritzava la KB només per `version + storageVersion + deletedCardIds`. Si es republicava `support-kb/kb.json` dins la mateixa versió, el procés continuava servint la KB vella en memòria fins a reinici.

Això explica la contradicció observada a producció:

- `support-kb/kb.json` correcta i actualitzada
- `version === storageVersion`
- però el bot encara responent amb resultats antics

## Casos reproduïts en local amb la KB publicada actual

### 1. `com importar l'extracte del banc`

- Top candidate: `guide-import-movements`
- Score: `493`
- Segon candidate: `movement-import-bank`
- Segon score: `431`
- Mode final: `card`
- Decisió: `high_confidence_match`

Conclusió:
La card correcta entra al pool i guanya. No hi ha fallback local amb la KB fresca.

### 2. `com desfer una remesa`

- Top candidate: `howto-remittance-undo`
- Score: `680`
- Segon candidate: cap
- Segon score: `0`
- Mode final: `card`
- Decisió: `direct_intent_high_confidence`

Conclusió:
La card correcta entra per intent directe i no perd per scoring.

### 3. `com actualitzo les dades d'un donant`

- Top candidate: `howto-donor-update-details`
- Score: `680`
- Segon candidate: cap
- Segon score: `0`
- Mode final: `card`
- Decisió: `direct_intent_high_confidence`

Conclusió:
La card correcta entra i guanya. El defecte local reproduïble no és de ranking sinó de navegació: el `uiPath` publicat era `"/dashboard/donants"` i la policy el filtrava perquè només acceptava rutes textuals de catàleg.

## Causa exacta

### Causa principal

`src/lib/support/load-kb-runtime.ts` feia cache amb aquesta clau efectiva:

- `version`
- `storageVersion`
- `deletedCardIds`

No incloïa cap `publishedAt/updatedAt` del document `system/supportKb`. Per tant:

1. el procés carregava una KB publicada antiga
2. es republicava `support-kb/kb.json` amb la mateixa versió
3. `loadKbCards()` seguia retornant la KB antiga des de memòria
4. el bot mantenia fallbacks i resolucions obsoletes fins a reinici o rollout

### Causa secundària

`src/lib/support/engine/policy.ts` descartava `uiPaths` en format ruta (`/dashboard/donants`) perquè només acceptava camins textuals tipus `Donants > ...`. Això deixava la resposta del donant sense destí clickable tot i tenir la card correcta.

## Patch mínim aplicat

1. `load-kb-runtime.ts`
- la signatura de cache ara inclou un `publishedAtKey`
- aquesta clau es deriva de `publishedAt`, `updatedAt` o `storageUpdatedAt`

2. `route.ts`
- passa el `publishedAtKey` real del document `system/supportKb` a `loadKbCards()`

3. `policy.ts`
- converteix rutes dashboard conegudes (`/dashboard/donants`, etc.) a camins de catàleg vàlids per a navegació del bot

## Estat final dels 3 casos després del patch

- `com importar l'extracte del banc` → `guide-import-movements` → `card`
- `com desfer una remesa` → `howto-remittance-undo` → `card`
- `com actualitzo les dades d'un donant` → `howto-donor-update-details` → `card`, amb destí `Donants`
