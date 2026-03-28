# Demo Gravacions - Playbook

## Objectiu

Guardar una manera estable i reusable de demanar i produir gravacions curtes de Summa Social amb el navegador controlat per Codex.

A partir d'ara, quan Raül digui:

- `fes una gravació sobre X`
- `refem la demo de Y`
- `grava només aquest flux`

la interpretació per defecte és:

1. peça curta de 30-40 segons
2. navegador controlat per automatització
3. UI real de Summa, sense pantalles artificials afegides al producte
4. demo preparada i seeded si cal
5. qualitat comercial per defecte quan la peça és per compartir
6. cursor opcional, mai obligatori si compromet estabilitat
7. entrega en MP4 dins `output/playwright/<scenario>/`
8. resum tècnic a `recording-summary.json`

## Protocol per defecte

### 1. Preparació

- Arrencar la demo amb `npm run demo:up:work` si el flux depèn de dades demo.
- Si el cas és sensible, fer un probe curt abans de la presa final per validar selectors, rutes i bloquejos.
- No dependre de login manual: la gravació ha de crear o reparar un usuari tècnic si cal.

### 2. Implementació

- Cada gravació reusable ha de tenir un script propi: `scripts/demo/record-*.mjs`.
- El script ha de ser autosuficient:
  - carregar `.env.demo`
  - assegurar usuari tècnic
  - preparar artefactes temporals si cal
  - obrir navegador
  - executar el relat
  - convertir la sortida final a MP4
- Per peces públiques o comercials, prioritzar:
  - `1920x1080`
  - `25 fps` en el pipeline estable actual
  - codificació H.264 amb compressió conservadora
  - flux dins de la UI real del producte
- El cursor queda fora del pipeline estable actual. Si algun dia el recuperem, haurà de ser sense comprometre fiabilitat.

### 3. Sortida

- Guardar artefactes a `output/playwright/<scenario>/`
- Mínim esperat:
  - `*.mp4`
  - `recording-summary.json`
- Si hi ha probes o captures de suport, també poden quedar en aquesta carpeta.

### 4. Postproduccio reusable

- Les peces comercials poden tenir una segona passada de render:
  - `intro`
  - `captions`
  - `outro`
- Les peces de landing o hero poden fer servir una variant curta:
  - sense `intro`
  - sense `outro`
  - editades per `segments` a partir d una captura base
  - amb `embedCaptions: false` si la landing ha de mostrar les llegendes des de la pagina i no cremades dins del MP4
- El render reusable viu a `scripts/demo/postproduce-demo-video.mjs`
- Estil comercial per defecte actual:
  - `summa-subtitle`
  - una sola frase curta per escena
  - sense caixa
  - composicio editorial, pensada per web de producte
  - text fosc per defecte i text blanc quan l escena es marca com a `surface: 'dark'`
  - transicions suaus entre `intro`, video i `outro`
- Cada video amb relat propi ha de tenir storyboard a:
  - `scripts/demo/video-storyboards/*.mjs`
  - `docs/operations/demo-storyboards/*.md`
- El renderer pot generar variants de llengua a partir d un sol storyboard:
  - `ca`: versio nomes en catala
  - `es`: versio nomes en castella
  - `dual`: catala a dalt + castella a sota, nomes si es demana explicitament
- El renderer actual pot generar:
  - `.srt`
  - `.vtt`
  - i, si el storyboard ho demana, una versio compactada a partir de `segments`
  - captions curtes de tipus `subtitle` per overlays web o captions completes per peces exportables
- Nomenclatura de sortida:
  - `output/playwright/<scenario>/<storyboard>.ca.mp4`
  - `output/playwright/<scenario>/<storyboard>.es.mp4`
  - `output/playwright/<scenario>/<storyboard>.dual.mp4` com a format excepcional
  - i els `.srt` equivalents
- Variants canoniques per difusio i web:
  - `ca` per catala
  - `es` per castella
- Versions per web:
  - `ca` i `es` si la pagina ha de servir el video segons idioma
  - preferir video net + overlay de captions propi quan la landing necessiti un acabat mes premium que el `track` nadiu del navegador
- Si existeixen assets de marca, es fan servir automaticament:
  - `public/brand/video/demo-intro-ca.mp4` o `.mov`
  - `public/brand/video/demo-outro-ca.mp4` o `.mov`
  - `public/brand/video/demo-intro-es.mp4` o `.mov`
  - `public/brand/video/demo-outro-es.mp4` o `.mov`
  - `public/brand/video/demo-intro.mp4` o `.mov`
  - `public/brand/video/demo-outro.mp4` o `.mov`
- Els assets amb sufix d idioma tenen prioritat sobre els generics.
- Si no existeixen, el sistema fa servir intro/outro textuals de fallback.
- El renderer comercial actual aplica `crossfade` curt entre peces per evitar talls bruscos.
- Comanda base:

```bash
node scripts/demo/postproduce-demo-video.mjs --storyboard my-storyboard --variant all
```

## Convenció per a nous escenaris

Quan es crea una nova gravació, cal deixar:

1. `scripts/demo/record-*.mjs`
2. una secció en aquest playbook o un annex curt amb:
   - objectiu
   - durada
   - entorn
   - rutes
   - dependències de seed
   - riscos coneguts

## Brief mínim per demanar una gravació

Si el prompt del CEO és curt, assumim el mínim viable. Si cal afinar, aquesta és la plantilla:

```md
Tema:
Objectiu de la peça:
Durada orientativa:
Entorn: demo / local / prod-like
Flux a mostrar:
1.
2.
3.
Punt final desitjat:
```

Amb una petició curta també val. Exemples:

- `fes una gravació curta de la divisió de remeses`
- `grava el circuit d'alta de soci i cobrament`
- `refem la demo de remeses, però més comercial i en 25 segons`

## Cas implementat avui

### `member-remittance-demo` i `member-remittance-split-demo`

- Script: `scripts/demo/record-member-remittance.mjs`
- Output:
  - `output/playwright/member-remittance-demo/`
  - `output/playwright/member-remittance-split-demo/`
- Objectiu:
  - mostrar la remesa SEPA de quotes fins a revisió
  - mostrar la divisió d'un ingrés agrupat de socis
- Modes:
  - `--flow full`
  - `--flow split-only`
- Qualitat:
  - `--quality commercial` per defecte
  - `--quality standard` com a fallback ràpid
- Durada actual orientativa:
  - `full`: 38s
  - `split-only`: 24s
- Entorn:
  - `npm run demo:up:work`
  - org demo seeded
- Usuari tècnic:
  - es crea/repara automàticament via Admin SDK
  - variables opcionals:
    - `DEMO_RECORDER_EMAIL`
    - `DEMO_RECORDER_PASSWORD`

### Relat actual

1. Login a `/demo/login`
2. Entrada al dashboard real de la demo
3. Obertura del wizard de remesa SEPA
4. Configuració i selecció fins a la revisió final
5. Obertura directa del divisor de la remesa pendent
6. Pujada CSV demo
7. Mapejat, previsualització i processament

### Comandes base

```bash
node scripts/demo/record-member-remittance.mjs --flow split-only --quality commercial --reseed
node scripts/demo/record-member-remittance.mjs --flow full --quality commercial --reseed
```

### `bank-reconciliation-demo`

- Script: `scripts/demo/record-bank-reconciliation.mjs`
- Output:
  - `output/playwright/bank-reconciliation-demo/`
- Objectiu:
  - mostrar la conciliacio bancaria des de Moviments
  - importar un extracte amb un candidat a duplicat i tres moviments nous
  - categoritzar els nous moviments amb el flux de suggeriments
  - vincular-los manualment a donant, proveidor i empleat
- Entorn:
  - `npm run demo:up:work`
  - org demo seeded
- Dades preparades pel script:
  - crea un moviment existent amb la mateixa descripcio i import per forcar un `possible duplicat`
  - genera un CSV temporal amb 4 files (`1` candidata + `3` noves)
  - neteja abans els moviments previs del mateix relat per mantenir-lo repetible
- Punt final:
  - taula de Moviments filtrada pel cas `demo conciliacio`
  - categories suggerides aplicades
  - contactes assignats a donant, proveidor i empleat

### Relat actual

1. Login a `/demo/login`
2. Entrada a `/demo/dashboard/movimientos`
3. Importacio d extracte bancari
4. Revisio del resum pre-importacio amb duplicat candidat detectat
5. Importacio nomes dels moviments nous
6. Filtre del cas `demo conciliacio` amb els tres moviments nous visibles
7. Suggeriment automatic de categories amb IA
8. Recarrega controlada i pausa per mostrar els mateixos tres moviments ja categoritzats
9. Assignacio manual de contactes a la mateixa taula

### Nota de gravacio

- En peces comercials de conciliacio, el valor de la IA s ha de veure abans de continuar.
- Si la UI no refresca sola prou rapid, el script ha de:
  - esperar persistencia real de categories
  - refrescar la taula des dels filtres o la cerca abans que recarregar tota la pagina
  - reaplicar el filtre del cas
  - deixar en pantalla el `despres` prou temps abans d editar contactes
- No retallar per defecte una gravacio si el relat encara no ha ensenyat el `despres`.
- El flag `--duration` queda com a limit explicit opcional, no com a tall automatic per defecte.
- Si una modal o overlay enfosqueix la UI, la caption de l escena s ha de marcar amb `surface: 'dark'` al storyboard.

### Comanda base

```bash
node scripts/demo/record-bank-reconciliation.mjs --quality commercial --reseed
```

### Postproduccio comercial

- Storyboard executable:
  - `scripts/demo/video-storyboards/bank-reconciliation-intelligent.mjs`
- Storyboard landing:
  - `scripts/demo/video-storyboards/bank-reconciliation-landing.mjs`
- Guio llegible:
  - `docs/operations/demo-storyboards/bank-reconciliation-intelligent.md`
  - `docs/operations/demo-storyboards/bank-reconciliation-landing.md`
- Render final:

```bash
node scripts/demo/postproduce-demo-video.mjs --storyboard bank-reconciliation-intelligent --variant all
```

## Regles de qualitat

- Millor una peça curta i estable que una peça llarga i fràgil.
- Si un pas del producte és inestable per a gravació, es pot saltar si el relat continua sent honest.
- Abans d'una presa final, validar els punts fràgils amb una execució curta.
- No improvisar dades manualment al navegador si el mateix es pot garantir amb seed o script.
