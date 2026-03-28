# Model 182 Landing

## Objectiu

Peça curta per la landing `model-182` i per la capacitat equivalent de la home. Ha d ensenyar que Summa Social genera el report fiscal sobre dades reals, resta devolucions i valida donants incomplets abans d exportar a l AEAT.

## Relat

1. Entrar a `Informes`
2. Mostrar el generador de donacions del `Model 182`
3. Generar l informe
4. Deixar visibles:
   - donants totals
   - import net anual
   - devolucions descomptades
   - fila demo de `Mireia Serra Vidal` sense NIF
5. Obrir `Exportar per a AEAT`
6. Tancar amb el diàleg d exclusió i validació

## Cas demo

- Donant exclòs AEAT: `Mireia Serra Vidal`
- Mode seed: `work`
- Dades preparades al seed:
  - 1 donació de `90,00 €`
  - `taxId` buit per forçar exclusió AEAT
  - codi postal vàlid perquè el missatge principal sigui el NIF

## Sortida

- captura base: `output/playwright/model-182-demo/model-182-demo.mp4`
- landing render:
  - `output/playwright/model-182-demo/model-182-landing.ca.mp4`
  - `output/playwright/model-182-demo/model-182-landing.es.mp4`
- captions overlay:
  - `.vtt` per a `ca` i `es`
