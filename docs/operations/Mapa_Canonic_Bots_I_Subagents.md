# Mapa Canonic de Bots i Subagents

Data de revisio: 2026-04-24

Aquest document contrasta el mapa de bots/subagents amb dues fonts:

- repo local `summa-social`
- VPS real via SSH `summa-prod` (`34.248.18.174`, host remot `ip-172-31-44-222`)

## Resum executiu

Ara mateix Summa Social te quatre capes diferents que no s'han de barrejar:

1. **Bot de suport dins del producte**: bot real de l'app, exposat a usuaris autenticats.
2. **OpenClaw Platform a la VPS**: repo extern amb bots `octavi`, `summa-mail` i altres, pero sense runtime Summa actiu materialitzat a `/srv/openclaw` en aquesta VPS.
3. **OpenClaw live actiu a la VPS**: avui nomes hi ha `fpc-seo` actiu com a gateway OpenClaw; no `octavi` ni `summa-mail`.
4. **Prompts d'agents de desenvolupament**: instruccions versionades per tasques de codi, QA o marketing, no runtimes autonoms del producte.

No hi ha cap subagent live dins de l'app que executi accions sobre Firestore en nom de l'usuari. El bot de suport respon amb KB versionada i logs d'observabilitat. OpenClaw no forma part del runtime de Next.js.

## 0. Evidencia VPS verificada

Comandes de lectura executades el 2026-04-24 contra `summa-prod`:

- `ls -la /srv/openclaw`
- `find /srv/openclaw -maxdepth 2 -mindepth 1 -type d`
- `find /srv/openclaw -maxdepth 4 -type d -name .git`
- `ps -eo pid,ppid,user,stat,etime,cmd | grep -Ei "openclaw|octavi|summa-mail|bot|telegram|node|pm2|resend"`
- `systemctl --user list-units --type=service --all`
- `systemctl --user cat fpc-csv-http.service openclaw-gateway-fpc-seo.service`
- `find /srv/openclaw-platform/bots -maxdepth 2`
- `find /srv /home/ubuntu -maxdepth 5 -iname "*summa*" -o -iname "octavi"`

Resultat live actual a la VPS:

- existeix `/srv/openclaw`
- existeix `/srv/openclaw-platform`
- no existeix `/srv/openclaw/summa-mail`
- no existeix `/srv/openclaw/octavi`
- no existeix `/srv/openclaw/mirror/summa-social`
- no hi ha repo `summa-social` sota `/srv/repos`
- hi ha `/srv/openclaw-platform/bots/summa-mail` i `/srv/openclaw-platform/bots/octavi` com a codi/runbooks versionats
- hi ha usuari Linux `summa` amb lingering `systemd --user`, pero sense unitats Summa actives
- serveis user systemd actius relacionats:
  - `openclaw-gateway-fpc-seo.service`
  - `fpc-csv-http.service`
- processos actius relacionats:
  - `openclaw`
  - `openclaw-gateway`
  - `python3 -m http.server 18880 ... /srv/openclaw/fpc-transformer/sources`
- cron actiu relacionat:
  - `0 20 * * 5 /srv/openclaw/fpc-seo/bin/weekly_pack.sh`

Per tant, qualsevol document que digui que el runtime live actual de Summa es `/srv/openclaw/summa-mail` o `/srv/openclaw/octavi` queda obsolet per aquesta VPS.

Resposta operativa directa: en aquesta VPS no s'ha trobat cap servei actiu que serveixi Summa Social. El que hi ha actiu a OpenClaw es de FPC, que es un altre projecte.

## 1. Bot de suport del producte

**Estat:** actiu al codi.

**Entrades UI:**

- `src/components/help/BotFab.tsx`
- `src/components/help/BotSheet.tsx`

**API runtime:**

- `src/app/api/support/bot/route.ts`
- `src/app/api/support/bot-feedback/route.ts`
- `src/app/api/support/bot-questions/candidates/route.ts`
- `src/app/api/support/bot-questions/export/route.ts`

**Motor:**

- `src/lib/support/bot-retrieval.ts`
- `src/lib/support/engine/orchestrator.ts`
- `src/lib/support/engine/retrieval.ts`
- `src/lib/support/engine/renderer.ts`
- `src/lib/support/engine/policy.ts`
- `src/lib/support/engine/disambiguation.ts`
- `src/lib/support/engine/normalize.ts`
- `src/lib/support/support-context.ts`

**KB real:**

- Font versionada: `docs/kb/cards/**/*.json`
- Fallbacks: `docs/kb/_fallbacks.json`
- Bundle runtime: `src/lib/support/kb-bundle.generated.ts`
- Loader runtime: `src/lib/support/load-kb-runtime.ts`
- Nombre actual de cards JSON a `docs/kb/cards`: 88

**Politica del bot:**

- Document base: `docs/kb/_policy.md`
- El bot no improvisa procediments: per donar passos operatius necessita una card validada amb contingut renderitzable.
- Si la confiança no es prou alta, desambigua o dona fallback segur.
- En consultes sensibles o casos concrets aplica guardrails i evita diagnosticar dades concretes.
- `allowAiIntent` esta forcat a `false` a `src/app/api/support/bot/route.ts`; la seleccio d'intent efectiva es determinista.
- `allowAiReformat` nomes pot actuar si hi ha `GOOGLE_GENAI_API_KEY` i `system/supportKb.aiReformatEnabled !== false`; el reformat no pot afegir passos.

**Observabilitat:**

- Preguntes: `organizations/{orgId}/supportBotQuestions/{hash}`
- Logs amb PII emmascarada: IBAN, NIF/CIF/DNI/NIE, email i telefon.
- Feedback yes/no per pregunta.
- Comptadors de fallback, clarify, reformulacio i respostes.
- Export CSV i candidats de cobertura per manteniment.

**Acces i seguretat:**

- Autenticacio amb `verifyIdToken`.
- `orgId` surt del perfil `users/{uid}.organizationId`, no de headers ni query params.
- Validacio de membership i `requireOperationalAccess`.
- Cards de superadmin o `b1_danger` filtrades per usuaris d'organitzacio, amb excepcions controlades.

## 2. OpenClaw / Octavi editorial dins el repo `summa-social`

**Estat:** capa editorial present al repo, separada del bot de suport. No s'ha verificat com a servei live a la VPS.

**Codi:**

- `src/lib/openclaw-editorial/files.ts`
- `src/lib/openclaw-editorial/content.ts`
- `src/lib/openclaw-editorial/workflow.ts`
- `src/lib/openclaw-editorial/types.ts`

**Scripts:**

- `npm run editorial:seed-historical`
- `npm run editorial:generate-monthly`
- `npm run editorial:derive-linkedin`
- `npm run editorial:approve-telegram`
- `npm run editorial:publish-blog`
- `npm run editorial:publish-linkedin`

**Espai de treball:**

- `octavi/summa/editorial/calendar/editorial-calendar.yaml`
- `octavi/summa/editorial/contracts/*`
- `octavi/summa/editorial/runtime/*`
- `octavi/summa/editorial/artifacts/*`
- `octavi/summa/editorial/kb/KNOWLEDGE_BASE_Entitats.local.md`

**Que fa realment:**

- Carrega calendari editorial.
- Genera drafts de blog i derivades LinkedIn.
- Registra estat de cua, approvals i logs.
- Pot demanar aprovacio per Telegram si hi ha credencials.
- Pot publicar blog/LinkedIn via scripts quan hi ha aprovacio i contracte.

**Que no fa:**

- No es el bot d'ajuda de l'app.
- No participa al runtime de `/api/support/bot`.
- No ha d'escriure a Firestore com a agent.
- No pot saltar-se aprovacio humana per publicar.

## 3. Prompts i subagents versionats

**Estat:** artefactes versionats, no processos live.

**Guardrails generals:**

- `agents/AGENTS.md`

**Prompts actuals:**

- `agents/prompts/summa-marketing.md`
- `agents/prompts/sector-normalizer.md`
- `agents/prompts/sector-validator.md`
- `agents/prompts/linkedin-deriver.md`
- `agents/prompts/qa-fiscal.md`
- `agents/prompts/refactor-safe.md`
- `agents/prompts/micro-iteracio.md`

**Subagents declarats al flux marketing:**

- `sector-normalizer`
- `sector-validator`
- `linkedin-deriver`

Aquestes peces defineixen responsabilitats i restriccions. No son serveis desplegats ni tenen permisos propis sobre produccio.

## 4. OpenClaw Platform a la VPS

**Estat verificat:** existeix a la VPS com a repo extern.

**Path real:**

```bash
/srv/openclaw-platform
```

**Git verificat:**

- branch: `main`
- remote: `git@github.com:raulvico1975/openclaw-platform.git`
- HEAD: `14d5194 chore: monorepo net — tots els bots, ops i docs sense secrets`

**Bots Summa presents com a codi dins la plataforma:**

- `/srv/openclaw-platform/bots/octavi`
- `/srv/openclaw-platform/bots/summa-mail`

**Important:** aquests paths no son el mateix que un runtime live actiu sota `/srv/openclaw`. A la VPS revisada, `octavi` i `summa-mail` estan al repo de plataforma, pero no estan desplegats com a serveis actius.

## 5. OpenClaw live actiu a la VPS

**Path base live verificat:**

```bash
/srv/openclaw
```

**Directoris live actuals:**

- `/srv/openclaw/fpc-garant`
- `/srv/openclaw/fpc-seo`
- `/srv/openclaw/fpc-transformer`
- `/srv/openclaw/shared`

**Servei OpenClaw actiu:**

- `openclaw-gateway-fpc-seo.service`
- workspace: `/srv/openclaw/fpc-seo`
- port local: `18813`
- Telegram habilitat a `fpc-seo/config/openclaw.json`
- no forma part de Summa Social

**Servei auxiliar actiu:**

- `fpc-csv-http.service`
- path: `/srv/openclaw/fpc-transformer/sources`
- port local: `18880`

**No verificat com a live en aquesta VPS:**

- `/srv/openclaw/summa-mail`
- `/srv/openclaw/octavi`
- `openclaw-gateway-summa-mail.service`
- `openclaw-gateway-octavi.service`
- `/srv/openclaw/mirror/summa-social`

**Rastres Summa no actius:**

- `/srv/openclaw-platform/bots/octavi`: codi/runbooks del bot Octavi.
- `/srv/openclaw-platform/bots/summa-mail`: codi/runbooks del bot de correu.
- `/srv/ops/state/summa-mirror.json`: estat antic d'un mirror `/srv/repos/summa-social`, pero el path actual no existeix.
- `/srv/ops/state/summa-sales-health.json`: estat antic del 2026-03-27 apuntant a `/srv/openclaw/octavi`, pero el path actual no existeix.
- `/srv/ops/state/summa-sales-backup.json`: backup antic del 2026-04-18 apuntant a `/srv/openclaw/octavi`, pero el runtime actual no existeix.
- `/home/ubuntu/.local/bin/summasocial`: wrapper local cap a `hermes -p summasocial`, no servei resident.

## 6. OpenClaw mirror de `summa-social`

**Document operatiu:** `docs/operations/OPENCLAW-MIRROR.md`

El mirror read-only de `summa-social` no existeix a la VPS revisada. La ruta `/srv/openclaw/mirror/summa-social` queda com a arquitectura recomanada o pendent, no com a estat live.

Si es crea en el futur, ha de continuar tenint prohibit:

- fer push
- guardar secrets
- executar deploys
- modificar el working tree real de desenvolupament

## 7. Estat actual de Summa en l'ambit bots

| Capa | Estat actual | Runtime producte | Escriu Firestore | Font de veritat |
| --- | --- | --- | --- | --- |
| Bot de suport | Actiu al repo producte | Si | Si, nomes observabilitat del bot | `src/app/api/support/bot/*`, `src/lib/support/*`, `docs/kb/*` |
| OpenClaw Platform | Present a VPS | No | No verificat | `/srv/openclaw-platform` |
| Octavi | Present com a codi a plataforma; no live a `/srv/openclaw` | No | No verificat | `/srv/openclaw-platform/bots/octavi` |
| Summa Mail | Present com a codi a plataforma; no live a `/srv/openclaw` | No | No verificat | `/srv/openclaw-platform/bots/summa-mail` |
| fpc-seo | Live actiu a VPS | No | No relacionat amb Summa Social producte | `/srv/openclaw/fpc-seo` |
| OpenClaw editorial repo-local | Present com a pipeline dins `summa-social` | No | No | `src/lib/openclaw-editorial/*`, `octavi/summa/editorial/*` |
| Prompts agents | Versionats | No | No | `agents/prompts/*` |
| OpenClaw mirror Summa | No trobat a VPS | No | No | pendent si cal crear `/srv/openclaw/mirror/summa-social` |
| Integracions privades admin | Contracte documentat, separat del bot | API privada, no bot UI | Pot fer operacions per contracte | `docs/contracts/private-admin-integrations-v1.md` |

## 8. Invariants vigents

- El bot d'ajuda opera amb KB versionada del repo, no amb edicio live des de SuperAdmin.
- `docs/generated/*` no es la font runtime del bot; es artefacte generat o legacy segons el cas.
- Els agents no poden escriure a Firestore en flux d'agent.
- OpenClaw ha de treballar sobre mirror o espai editorial separat, no sobre el working tree productiu sense fase governada.
- La VPS actual no demostra cap runtime live `summa-mail` ni `octavi`; els docs no ho poden presentar com a live.
- Qualsevol canvi que toqui bot de suport, remeses, devolucions, donants o fiscalitat requereix prova minima i mencio explicita.

## 9. Documents relacionats

- `docs/operations/OPENCLAW-MIRROR.md`
- `docs/operations/SUMMA-INBOUND-FUNNEL.md`
- `docs/operations/CONTEXT-OPERATIU-WEB-I-INTEGRACIONS.md`
- `docs/kb/README.md`
- `docs/kb/_policy.md`
- `docs/help/RUNTIME-DIAGNOSTICS.md`
- `docs/support/minimum-coverage-map.md`
- `docs/support/log-driven-coverage-plan.md`
- `octavi/summa/editorial/README.md`
- `octavi/summa/editorial/contracts/editorial-contract.md`
- `agents/AGENTS.md`
