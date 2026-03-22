# Help System Redesign Plan

## Estat actual real del sistema

- L'usuari veu tres punts d'entrada reals dins del dashboard: `HelpSheet` contextual (`?` del header), `Manual` i `Bot` flotant.
- La ruta `/{orgSlug}/dashboard/guides` no és un hub actiu: avui és només compatibilitat i no resol ajuda per si mateixa.
- El `HelpSheet` funciona a partir de claus `help.*` d'i18n i enllaça al manual per anchors.
- El `Bot` treballa sobre KB cards + fallback + guardrails; no ha de generar procediments lliures.
- El `Manual` runtime real és el de `public/docs/manual-usuari-summa-social.{lang}.md`, no el de `docs/`.

## Incoherències detectades entre codi i documentació

- La documentació mestra descrivia `/dashboard/guides` com a centre real d'ajuda, però el runtime no ho feia.
- El bot encara podia generar badges o textos que apuntaven a `guides`.
- `help-manual-links.ts` contenia anchors antics que no coincideixen amb el manual públic real.
- Els manuals públics ES/FR són resumits i no suporten els anchors que el `HelpSheet` necessita.
- `help:audit` auditava una pàgina `guides` que ja no és el contracte real del producte.

## Contracte final del sistema d'ajuda

- Entry points visibles: `HelpSheet`, `Manual`, `Bot`.
- Destins vàlids des de l'ajuda: pantalla concreta, secció concreta del manual o ajuda contextual (`?`) de la pantalla actual.
- `guides` queda com a compatibilitat mínima, no com a promesa de producte.
- Jerarquia funcional:
  - `HelpSheet`: ajuda immediata de la pantalla.
  - `Manual`: referència llarga i troubleshooting.
  - `KB cards`: resposta operativa curta, troubleshooting i navegació.
- El bot no pot inventar procediments.
- Si no hi ha resposta operativa forta, el bot ha de prioritzar destí útil a pantalla o manual abans de caure a fallback.

## Fitxers tocats

- `src/app/[orgSlug]/dashboard/guides/page.tsx`
- `src/app/[orgSlug]/dashboard/manual/page.tsx`
- `src/components/help/BotSheet.tsx`
- `src/components/help/HelpSheet.tsx`
- `src/help/help-manual-links.ts`
- `src/lib/support/bot-retrieval.ts`
- `src/lib/support/engine/orchestrator.ts`
- `src/lib/support/engine/policy.ts`
- `src/lib/support/engine/renderer.ts`
- `src/lib/support/load-kb-runtime.ts`
- `src/app/api/support/bot-questions/candidates/route.ts`
- `scripts/help/audit-help-layer.ts`
- `docs/kb/_fallbacks.json`
- `docs/kb/_policy.md`
- `docs/kb/_schema.json`
- `docs/kb/cards/manual/manual-guides-hub.json`
- `docs/manual-usuari-summa-social.md`
- `public/docs/manual-usuari-summa-social.ca.md`
- `public/docs/manual-usuari-summa-social.es.md`
- `public/docs/manual-usuari-summa-social.fr.md`
- `docs/SUMMA-SOCIAL-REFERENCIA-COMPLETA.md`
- `docs/DEV-SOLO-MANUAL.md`
- `docs/FAQ_SUMMA_SOCIAL.md`
- `docs/help/EDITORIAL-CONTRACT.md`
- `docs/help/RUNTIME-DIAGNOSTICS.md`

## Criteris d'acceptació

- El bot ja no envia l'usuari a `guides` com a destinació visible principal.
- Els links del `HelpSheet` apunten a anchors reals del manual públic.
- El manual runtime fa fallback segur a CA quan ES/FR no tenen estructura suficient.
- Les respostes del bot prioritzen acció + destí útil abans de fallback.
- El learning manager destaca millor cobertura pendent amb fallback i feedback negatiu.
- El document mestre i els docs operatius ja no descriuen `guides` com a hub actiu.
