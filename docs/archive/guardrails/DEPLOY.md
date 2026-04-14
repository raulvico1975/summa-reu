# Skill: Deploy verificat

## Definició

Un deploy verificat és la publicació de `main` cap a `prod` mitjançant el ritual determinista del repositori de control.

- `git push` a qualsevol branca no implica producció.
- El deploy només existeix quan Firebase App Hosting ha rebut `prod`.

## Prerequisits obligatoris

- El CEO ha escrit explícitament `Autoritzo deploy`.
- La feina ja s'ha tancat amb `npm run acabat`.
- L'ordre es llança des del repositori de control `/Users/raulvico/Documents/summa-social`.
- El repositori de control és a `main` i està net.

Comanda única:

```bash
npm run publica
```

## Què fa realment

`npm run publica` executa `scripts/workflow.sh publica`, que al seu torn crida `scripts/deploy.sh`.

El ritual actual fa, en ordre:

1. Preflight git al repositori de control (`main`, working tree net, pull `ff-only`)
2. Detecció de canvis i classificació de risc (`main` vs `prod`)
3. Verificació fiscal i documental quan toca
4. Verificacions locals i CI (`verify-local.sh`, `verify-ci.sh`)
5. Backup curt predeploy si el risc ho requereix i hi ha configuració
6. Avís guiat no tècnic si queda risc ALT residual
7. Merge `main -> prod` i push
8. Verificació de revisió backend App Hosting abans i després de publicar
9. Materialització real del rollout d'App Hosting per al commit publicat, o comprovació que ja s'ha materialitzat
10. Post-deploy check automàtic (SHA remot + smoke + comprovació server-side canònica)
11. Check post-producció automàtic de 3 minuts
12. Registre i actualització de `docs/DEPLOY-LOG.md`

Si alguna comprovació crítica falla, el deploy aborta i no es publica res.

## Criteri verd obligatori

- `git push origin prod` no equival a backend nou servit.
- El deploy només és verd si la revisió efectiva del backend App Hosting canvia de debò.
- Si la revisió backend no canvia, `npm run publica` ha de fallar encara que el push a `prod` hagi anat bé.
- La comprovació server-side canònica ha de passar després del rollout real.

## Checklist addicional per canvis d'auth/invitacions

Després del deploy, a més del ritual general, cal validar el comportament real del backend servit:

1. Prova real de `POST /api/invitations/accept`
2. Cas `already_member`: ha de retornar `409` i no consumir la invitació
3. Confirmació que la revisió efectiva servida per Firebase App Hosting coincideix amb `prod`

No n'hi ha prou amb verificar el codi a la branca: cal comprovar l'endpoint i el comportament real a producció.

## Modes útils

- `DEPLOY_REQUIRE_MANUAL_CONFIRMATION_ON_RESIDUAL_ALT=1` fa bloquejant el risc ALT residual.
- `DOC_SYNC_STRICT=1` endureix el gate de sincronització documental.

## Rollback

La referència operativa actual és `docs/DEPLOY-ROLLBACK-LATEST.md`.

Emergència crítica:

```bash
git checkout prod
git reset --hard <SHA_BON>
git push origin prod --force-with-lease
```

Regla: el rollback sempre es fa des de `prod`.

## Documents d'autoritat

- `docs/GOVERN-DE-CODI-I-DEPLOY.md`
- `docs/DEV-SOLO-MANUAL.md`
- `docs/DEPLOY-ROLLBACK-LATEST.md`
