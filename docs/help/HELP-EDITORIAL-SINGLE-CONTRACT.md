# Help Editorial Single Contract

## 1. Contracte de les 3 capes

### HelpSheet (?)

Funció: resoldre la tasca immediata dins la pantalla actual.

Estructura obligatòria:
- `title`
- `intro` d'una sola frase
- `3-5 passos` màxim
- `2 problemes habituals` màxim
- `1 CTA` únic al manual

Regles:
- El `HelpSheet` és per pantalla, no per catàleg de tasques.
- Si en una mateixa pantalla conviuen diversos microfluxos, el text ha de prioritzar l'ordre operatiu real i anomenar els fluxos canònics sense teoria extra.
- El `HelpSheet` no és FAQ, ni onboarding, ni resum del producte.

Prohibit:
- introduccions llargues
- context teòric
- duplicar FAQ
- més d'un CTA
- conceptes generals del producte

### Manual

Funció: guia completa d'un procés real d'usuari.

Estructura obligatòria per guia:
- Què és
- Quan s'utilitza
- Pas a pas
- Errors habituals
- On trobar-ho a Summa

Regles:
- El manual runtime ha de mantenir els anchors actius que consumeixen `HelpSheet` i bot.
- Els tres manuals runtime (`ca`, `es`, `fr`) han de tenir el mateix contingut funcional com a mínim dins dels fluxos actius de la iteració.
- Fora de la iteració activa es pot deixar una nota curta de pendent, però no un contingut contradictori.

Prohibit:
- FAQ conversacional
- text ornamental
- seccions sense procés real
- contingut funcional desigual entre idiomes en fluxos actius

### Bot

Funció: trobar la millor guia o microresposta operativa.

Contracte editorial:
- resposta curta
- si hi ha procés curt: `3-4 passos`
- si és procés llarg: resum curt + `uiPath`
- si no hi ha confiança: màxim `3 opcions` de desambiguació
- sense text lliure narratiu

Principi:
- El bot no és font de veritat.
- La font de veritat és la capa editorial publicada: `HelpSheet`, `Manual runtime` i `KB JSON`.

## 2. Font de veritat de cada capa

| Capa | Font de veritat activa |
| --- | --- |
| HelpSheet | `src/i18n/locales/*.json` (`help.*`) |
| Manual runtime | `public/docs/manual-usuari-summa-social.{ca,es,fr}.md` |
| Bot KB | `docs/kb/cards/**/*.json` + `docs/kb/_fallbacks.json` |

Regla d'aplicació:
- Qualsevol build, adaptador o artefacte intermedi queda fora del contracte actiu si no és una de les tres fonts anteriors.

## 3. Llista dels 8 microfluxos de la iteració 1

1. Importar extracte bancari
2. Detectar duplicats en importar
3. Editar dades d'un donant
4. Canviar quota d'un soci
5. Dividir remesa
6. Desfer remesa
7. Importar devolucions del banc
8. Generar Model 182

Regla de tall:
- Aquesta iteració només busca coherència editorial d'aquests 8 microfluxos a `HelpSheet`, `Manual runtime` i `KB`.
- Queden fora d'abast: Stripe, Model 347, certificats, projectes, justificació i qualsevol canvi de retrieval o UX.

## 4. Regles de longitud

### HelpSheet

- `title`: curt i orientat a pantalla
- `intro`: 1 frase
- `steps`: 3-5
- `problemes habituals`: 2 màxim
- `CTA`: 1

### Manual

- Cada guia ha de poder llegir-se com un procés complet sense narració sobrant.
- El `Pas a pas` ha de ser accionable i seqüencial.
- `Errors habituals`: 2-4 punts breus.
- `On trobar-ho a Summa`: 1 línia o 1 llista curta de navegació.

### KB

- `title`: canònic
- `answer`: curt, 3-4 passos + comprovació final
- `uiPaths`: útils i reals
- `intents`: frases naturals, sense inflar variants absurdes

## 5. Regles de nomenclatura

Noms canònics obligatoris en aquesta iteració:
- `Importar extracte bancari`
- `Detectar duplicats en importar`
- `Editar dades d'un donant`
- `Canviar quota d'un soci`
- `Dividir remesa`
- `Desfer remesa`
- `Importar devolucions del banc`
- `Generar Model 182`
- `Donants` com a pantalla

Evitar explícitament en aquests textos:
- barrejar `remeses de cobrament SEPA` amb `remeses operatives a Moviments`
- barrejar `projectes` amb `project-module/*`
- usar `soci` quan el flux real és genèric de `donant`, excepte en el canvi de quota
- usar `hub de guies`, `guies visibles` o promeses equivalents

## 6. Què queda congelat/legacy

Queda fora del contracte actiu com a font principal:
- `src/help/*`
- `help/topics/*`
- `guides.*` com a promesa editorial visible
- `docs/generated/help-guides.*.json`
- `docs/generated/help-bot.json` com a artefacte de build, no com a font primària
- qualsevol duplicació intermèdia que només existeixi per compatibilitat legacy

Política per a aquest material congelat:
- no cal esborrar-lo ara
- no s'ha d'usar com a font principal de contingut nou
- si una peça runtime encara en depèn, es tracta com a compatibilitat temporal i s'ha de documentar, no expandir
