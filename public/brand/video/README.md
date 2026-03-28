# Brand Video Assets

Aquest directori es reserva per a intros i outros reutilitzables del pipeline de demos.

## Noms esperats

- `demo-intro-ca.mp4` o `demo-intro-ca.mov`
- `demo-intro-es.mp4` o `demo-intro-es.mov`
- `demo-outro-ca.mp4` o `demo-outro-ca.mov`
- `demo-outro-es.mp4` o `demo-outro-es.mov`
- `demo-intro.mp4` o `demo-intro.mov`
- `demo-outro.mp4` o `demo-outro.mov`

Els fitxers sense sufix d idioma queden com a `fallback` generic.

## Recomanacions

- Resolucio base: `1920x1080`
- FPS: `25` o `30`
- `mp4 (H.264)` si la peça ja te fons propi
- `mov` si es vol conservar alpha per a futures variants del pipeline

El script `scripts/demo/postproduce-demo-video.mjs` buscara aquests fitxers automaticament.

Quan el storyboard te textos localitzats, el renderer pot generar:

- `*.ca.mp4`: captions nomes en catala
- `*.es.mp4`: captions nomes en castella
- `*.dual.mp4`: captions bilingues dins del video, nomes si es demana explicitament
