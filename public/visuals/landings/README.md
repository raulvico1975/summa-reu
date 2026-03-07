# Assets landings publiques (SEO)

Estructura per cada landing:

- `source/`: originals (jpg, jpeg, png, webp, mp4, mov, m4v, webm)
- `optimized/`: versions optimitzades generades (`.webp`, `.avif` i posters de video)
- `animations/`: peces curtes per web generades (`.webm` + `.mp4` fallback)

Landings preparades:

- `model-182`
- `certificats-donacio`
- `remeses-sepa`
- `importar-extracte-bancari`
- `gestio-donants`

## Flux recomanat

1. Copia imatges originals a `source/` de la landing.
2. Executa `npm run images:landings:optimize`.
3. Fes servir les versions de `optimized/` per imatges (`.avif` o `.webp`) i `animations/` per video (`.webm` + `.mp4` fallback).

## Notes SEO/practiques

- Prioritza `AVIF` com a primera opcio i `WebP` com a fallback.
- Evita pujar PNG/JPG directament a la landing excepte casos justificats.
- Mantingues noms estables de fitxer per evitar trencar referencies.
