# Context Operatiu — Web, Canals i Integracions Externes

Data de tall: 2026-03-25

## 1. Objectiu

Aquest document resumeix com es connecta `Summa Social` amb les seves superfícies externes reals:

- web públic
- formulari de contacte
- correu visible al domini
- telèfon i WhatsApp
- pipeline extern de blog
- runtime comercial separat d'OpenClaw

No substitueix la referència funcional del producte. Serveix per entendre el mapa operatiu real entre el repo `summa-social` i els sistemes externs que l'envolten.

## 2. Web públic

### 2.1 Canonical i routing

La font de veritat del routing públic és `src/middleware.ts`.

Regles clau:

- `app.summasocial.app` redirigeix a `summasocial.app`
- `/{lang}/...` es reescriu internament a `/public/{lang}/...`
- `/dashboard` sense slug redirigeix a `/redirect-to-org`
- `/contacte` és un redirect stub cap a `/{lang}/contact`

Superfícies públiques principals:

- home pública: `src/app/public/[lang]/page.tsx`
- contacte públic: `src/app/public/[lang]/contact/page.tsx`
- blog públic: `src/app/blog/page.tsx` i `src/app/blog/[slug]/page.tsx`
- redirects d'entrada: `src/app/contacte/page.tsx`, `src/app/funcionalitats/page.tsx`, `src/app/privacitat/page.tsx`

### 2.2 Què mostra el web

El web públic exposa com a mínim:

- landing multiidioma
- pàgines de funcionalitats i qui som
- contacte
- blog editorial
- privacitat

La navegació pública comuna viu a `src/components/public/PublicSiteHeader.tsx`.

## 3. Canals visibles al web

### 3.1 Correu visible

L'adreça pública central del producte és:

- `hola@summasocial.app`

La constant visible al codi és `src/lib/constants.ts` (`SUPPORT_EMAIL`).

### 3.2 Telèfon i WhatsApp

El component `src/components/public/PublicDirectContact.tsx` publica:

- telèfon: `684 765 359`
- `tel:+34684765359`
- WhatsApp: `https://wa.me/34684765359`

Important:

- avui hi ha CTA pública de WhatsApp
- avui NO hi ha una integració tècnica de WhatsApp dins del producte `summa-social`
- qualsevol automatització de WhatsApp s'ha de considerar externa al repo fins que existeixi una implementació formal

## 4. Formulari de contacte del web

La ruta és:

- `POST /api/contact`

Implementació:

- `src/app/api/contact/route.ts`

Com funciona avui:

- valida payload amb `zod`
- aplica camp honeypot (`website`)
- construeix email de contacte
- envia via `Resend`

Configuració necessària en deploy:

- `RESEND_API_KEY`
- `CONTACT_FORM_TO_EMAIL`

Document de govern:

- `docs/GOVERN-DE-CODI-I-DEPLOY.md`

Remitent operatiu actual del formulari:

- `Summa Social <certifica@summasocial.app>`

Comportament important:

- el formulari no envia al correu públic per màgia
- envia al destinatari configurat a `CONTACT_FORM_TO_EMAIL`
- el `reply_to` és l'email que escriu l'usuari al formulari

## 5. Correu del domini `summasocial.app`

### 5.1 Estat real del domini

Operativament, el domini combina dues peces diferents:

- **entrada**: el domini rep correu amb reenviament cap al Gmail personal de Raül
- **sortida**: el domini ja està preparat per enviar correu via `Resend`

Senyal clara de sortida ja operativa al repo:

- `src/app/api/contact/route.ts` envia des de `certifica@summasocial.app`
- `functions/src/alerts/sendIncidentAlert.ts` envia des de `alertes@summasocial.app`
- `docs/security/Subprocessors.md` ja declara `Resend` com a proveïdor actiu

### 5.2 Què vol dir això

Avui `hola@summasocial.app` és una adreça pública vàlida, però el repo del producte no gestiona una bústia IMAP pròpia del domini.

Per tant:

- el web i els processos backend ja poden **enviar** des del domini
- la lectura d'inbox de `hola@` no viu dins `summa-social`
- la lectura del correu forma part del runtime extern d'OpenClaw

### 5.3 On es veu realment cada cosa

Per no barrejar capes, la regla pràctica és:

- **entrants a `hola@summasocial.app`**: es veuen al Gmail de Raül perquè és on arriba el reenviament, i també al runtime comercial quan es llegeixen des d'OpenClaw
- **enviats del formulari de contacte del web**: es veuen a `Resend` perquè el web envia via `Resend`
- **enviats del runtime comercial**: es veuen a `Resend` i al registre local del runtime, no s'han de donar per visibles automàticament a `Sent` del Gmail personal

En resum:

- Gmail és la font de veritat pràctica per a l'entrada de `hola@`
- `Resend` és la font de veritat pràctica per a la sortida automatitzada del domini

## 6. Runtime extern de correu comercial

### 6.1 Separació respecte el producte

El correu comercial automatitzat NO viu dins `summa-social`.

Viu en un runtime separat d'OpenClaw:

- root live: `/srv/openclaw/summa-mail`

Objectiu del runtime:

- llegir inbox comercial
- obrir missatges
- preparar drafts
- exigir `pending_id`
- enviar només amb confirmació humana

### 6.2 Model operatiu recomanat avui

A data d'aquest document, el model més realista i ja verificat és:

- **entrada**: Gmail personal de Raül, filtrant correus que arriben a `hola@summasocial.app`
- **sortida**: `Resend`, enviant des de `hola@summasocial.app`

Això permet:

- conservar l'adreça pública `hola@`
- llegir els correus que ja arriben pel reenviament actual
- enviar des del domini sense dependre de Gmail com a remitent real

Limitació coneguda:

- els enviats del runtime comercial no s'han de donar per visibles automàticament a `Sent` del Gmail personal si la sortida es fa per `Resend`
- la font de veritat dels enviaments del runtime és el seu registre local de `pending/` i `sent/`

### 6.3 Secrets i govern

Els secrets del runtime comercial NO han d'entrar a aquest repo.

Són famílies separades:

- credencial d'inbox Gmail filtrat
- API key de `Resend`
- token Telegram del bot comercial, si s'activa

Només s'ha de documentar aquí el contracte operatiu, no els paths sensibles ni els valors.

### 6.4 Fonts de veritat i punts de control

Quan hi hagi dubtes d'operativa, l'ordre correcte és:

1. Contracte i mapa del producte: aquest document i `docs/operations/SUMMA-MAIL-OPERATIVA-RAPIDA.md`
2. Web públic i formulari: codi de `summa-social`
3. Inbox comercial: Gmail de Raül i runtime `summa-mail`
4. Enviaments automatitzats: dashboard de `Resend`
5. Automatització comercial: runtime live `/srv/openclaw/summa-mail`

El que NO s'ha d'assumir:

- que `Gmail Sent` sigui la font de veritat dels enviaments del runtime
- que `summa-social` contingui els secrets o la bústia comercial
- que el correu comercial visqui dins d'`Octavi`

### 6.5 Checklist de diagnòstic ràpid

Si falla entrada de `hola@`:

- comprovar que el correu s'ha reenviat al Gmail de Raül
- provar la cerca per destinatari `hola@summasocial.app`
- validar el runtime comercial, no el web públic

Si falla una sortida automatitzada:

- comprovar `Resend`
- comprovar l'estat del runtime comercial
- comprovar si el correu va quedar com a `pending` o com a `sent`
- no diagnosticar-ho mirant només `Gmail Sent`

### 6.6 Funnel d'inbound comercial

Els contactes entrants que semblen oportunitat real tenen flux propi.

Principi:

- `Octavi` detecta i coordina
- `summa-mail` llegeix i prepara drafts
- `summa-sales-director` aporta criteri comercial quan Raul diu que vol continuar

Document específic:

- `docs/operations/SUMMA-INBOUND-FUNNEL.md`

## 7. Blog i OpenClaw

El blog públic de `Summa Social` està connectat a un pipeline extern.

Contracte principal:

- `docs/contracts/blog-publish-cover-image.md`

Peces del repo:

- upload portada: `POST /api/blog/upload-cover`
- publish: `POST /api/blog/publish`
- handler: `src/app/api/blog/publish/handler.ts`

Secrets/config:

- `BLOG_ORG_ID`
- `BLOG_PUBLISH_SECRET`

Responsabilitat real:

- OpenClaw genera contingut i portada
- `summa-social` valida, desa i publica

## 8. Què és dins del repo i què no

### 8.1 Dins del repo `summa-social`

- web públic
- formulari de contacte
- contactes transaccionals/operatius via `Resend`
- publicació del blog
- documentació funcional i de govern

### 8.2 Fora del repo `summa-social`

- runtime comercial separat d'OpenClaw
- bots de Telegram
- lectura d'inbox de `hola@`
- automatitzacions de WhatsApp
- secrets reals i fitxers de credencials

## 9. Decisions pràctiques a recordar

- `hola@summasocial.app` és l'adreça pública canònica de contacte
- `certifica@summasocial.app` i `alertes@summasocial.app` ja existeixen com a remitents tècnics del domini
- WhatsApp és un canal públic visible, però no una integració backend del producte
- el correu comercial automatitzat s'ha de continuar tractant com a sistema extern al repo
- si es mou la lectura o l'enviament de correu a una arquitectura nova, aquest document s'ha d'actualitzar
