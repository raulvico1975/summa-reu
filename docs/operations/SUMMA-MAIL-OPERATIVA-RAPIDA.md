# Summa Mail - Operativa Rapida

Data de tall: 2026-04-24

> Estat VPS verificat: `summa-mail` no esta desplegat com a runtime live a `/srv/openclaw/summa-mail` en aquesta VPS. El codi i runbook existeixen a `/srv/openclaw-platform/bots/summa-mail`. Aquesta guia descriu el model objectiu i els punts de control si es desplega, no un servei actiu avui.

## 1. Objectiu

Aquesta guia es el resum curt per recordar com funciona el correu comercial de `Summa Social` sense haver de reconstruir el mapa tecnic des de zero.

Si nomes recordes una idea, que sigui aquesta:

- `hola@summasocial.app` es l'adreca publica
- l'entrada arriba al Gmail de Raul per reenviament
- la sortida automatitzada del runtime surt per `Resend`
- `Gmail Sent` no es la font de veritat dels enviaments del runtime

## 2. Arquitectura real avui

El sistema operatiu confirmat avui es:

- **entrada**: reenviament del domini cap al Gmail de Raul
- **sortida del web public**: `Resend` des de les rutes del producte
- **runtime `summa-mail`**: no verificat com a servei live en aquesta VPS

El runtime comercial, si es desplega, viu fora del repo:

- codi/runbook verificat: `/srv/openclaw-platform/bots/summa-mail`
- root live esperat: `/srv/openclaw/summa-mail`

## 3. On mirar cada cosa

### 3.1 Correu entrant de `hola@summasocial.app`

Fonts de veritat:

- Gmail de Raul, perque es on arriba el reenviament
- runtime `summa-mail`, nomes quan estigui desplegat a OpenClaw

No s'ha d'assumir:

- que existeixi una bustia IMAP propia de `hola@`
- que el repo `summa-social` contingui l'inbox

### 3.2 Correus enviats pel web public

Exemple:

- formulari de contacte `POST /api/contact`

Fonts de veritat:

- dashboard de `Resend`
- logs i configuracio del deploy de `summa-social`

Recordatori:

- el formulari envia des de `certifica@summasocial.app`
- el destinatari real el marca `CONTACT_FORM_TO_EMAIL`
- no s'ha de confondre amb el runtime comercial de `hola@`

### 3.3 Correus enviats pel runtime comercial

Fonts de veritat:

- dashboard de `Resend`
- registre local del runtime a `pending/` i `sent/`

No s'ha d'assumir:

- que apareguin automaticament a `Sent` del Gmail personal

## 4. Adreces i rols que existeixen avui

- `hola@summasocial.app`: contacte public i remitent del runtime comercial
- `certifica@summasocial.app`: remitent tecnic del formulari de contacte del web
- `alertes@summasocial.app`: remitent tecnic de notificacions/alertes

Aquestes adreces no tenen el mateix circuit operatiu.

## 5. Quan vulguis comprovar si tot segueix viu

Ordre mental recomanat:

1. Recorda quin flux estas mirant: web public, runtime comercial o alertes.
2. Si es inbox de `hola@`, mira primer Gmail, no `Resend`.
3. Si es sortida automatitzada, mira primer `Resend`, no `Gmail Sent`.
4. Si es un problema del bot comercial, mira el runtime separat `summa-mail`, no `Octavi`.

## 6. Preguntes que et faras segur

### "On veig els enviats del bot?"

Al dashboard de `Resend` i al registre local del runtime.

### "On veig els entrants de `hola@`?"

Al Gmail de Raul. Tambe al runtime `summa-mail` si s'ha desplegat i esta llegint des d'OpenClaw.

### "El repo `summa-social` guarda correus?"

No. Guarda el contracte i la documentacio operativa, pero no l'inbox comercial ni els secrets.

### "Si peta alguna cosa, on miro primer?"

- `docs/operations/CONTEXT-OPERATIU-WEB-I-INTEGRACIONS.md`
- `docs/operations/SUMMA-INBOUND-FUNNEL.md` si el dubte es sobre contactes entrants
- el codi/runbook `/srv/openclaw-platform/bots/summa-mail`
- el runtime live `/srv/openclaw/summa-mail`, nomes si existeix desplegat
- el dashboard de `Resend`

## 7. Coses que no has d'oblidar

- `Octavi` no s'ha modificat per aquest sistema
- `Octavi` si que coordina el funnel d'inbound comercial, pero no es la capa de correu
- el correu comercial automatitzat es un sistema extern al producte
- el WhatsApp es un canal visible al web, pero no una integracio backend del repo
- si en el futur canvies de proveidor de correu, aquesta guia i el context operatiu s'han d'actualitzar junts
