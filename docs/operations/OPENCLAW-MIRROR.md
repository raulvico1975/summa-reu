# OPENCLAW MIRROR

OpenClaw es un bot extern que llegeix el codi per acompanyar el projecte. No forma part del runtime de Summa Social i no es el bot d'ajuda de l'app.

Estat verificat el 2026-04-24 contra `summa-prod`: no existeix cap mirror de `summa-social` a `/srv/openclaw/mirror/summa-social` ni cap repo `summa-social` sota `/srv/repos`.

Si cal activar-lo, ha de ser un mirror read-only del repo: clon separat, fora del repo de treball i fora de qualsevol worktree de desenvolupament.

Ubicacio recomanada pendent de crear: `/srv/openclaw/mirror/summa-social` (o equivalent).

Actualitzacio:
```bash
git fetch --all --prune
git reset --hard origin/main
```

Prohibit:
- cap push
- cap secret
- cap deploy des del mirror
- cap escriptura a Firestore
- cap modificacio del working tree real de desenvolupament

Relacio amb el mapa de bots:

- mapa canonic: `docs/operations/Mapa_Canonic_Bots_I_Subagents.md`
- bot de suport producte: `src/app/api/support/bot/route.ts` + `src/lib/support/*`
- pipeline editorial OpenClaw/Octavi: `src/lib/openclaw-editorial/*` + `octavi/summa/editorial/*`
- plataforma OpenClaw real a VPS: `/srv/openclaw-platform`
- directoris OpenClaw actuals a VPS: `/srv/openclaw/fpc-seo`, `/srv/openclaw/fpc-garant`, `/srv/openclaw/fpc-transformer`; servei live verificat: `openclaw-gateway-fpc-seo.service`
