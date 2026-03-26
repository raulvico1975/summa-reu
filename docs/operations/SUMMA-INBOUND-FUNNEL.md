# Summa Inbound Funnel

Data de tall: 2026-03-25

## 1. Objectiu

Aquest document explica com es governen els contactes entrants que arriben a `hola@summasocial.app` quan semblen una entitat interessada en `Summa Social`.

La idea central es aquesta:

- `Octavi` coordina
- `summa-mail` llegeix i prepara drafts
- `summa-sales-director` posa criteri comercial quan cal respondre
- no es barreja aquest flux amb el cold outreach setmanal

## 2. Arquitectura

El funnel inbound viu fora del repo del producte, dins del runtime operatiu d'OpenClaw.

Peces:

- runtime de correu: `/srv/openclaw/summa-mail`
- coordinador: `/srv/openclaw/octavi`
- estat inbound: `/srv/openclaw/octavi/sales/inbound`

El repo `summa-social` nomes documenta el contracte operatiu.

## 3. Què passa cada 4 hores

`Octavi` revisa periòdicament si hi ha nous correus a `hola@summasocial.app` que puguin ser contacte comercial real.

Abans d'avisar Raul, ha de fer sempre:

1. obrir el correu
2. identificar entitat, domini i web
3. consultar la web oficial
4. preparar un briefing curt

No s'ha d'avisar per:

- newsletters
- notificacions tècniques
- verificacions
- soroll de SaaS

## 4. Briefing que rep Raul

El briefing minim esperat es:

- qui ha escrit
- que sembla fer l'entitat
- per que podria encaixar amb `Summa`
- quin seguent pas recomana `Octavi`

La idea es que Raul no rebi inbox cru, sino senyal filtrada.

## 5. Etapes del funnel

- `new`
- `brief_sent`
- `approved_to_reply`
- `reply_draft_ready`
- `reply_sent`
- `followup_due`
- `meeting_pending`
- `meeting_booked`
- `proposal_candidate`
- `closed`
- `ignored`

## 6. Si Raul diu “continua”

Quan Raul confirma que vol seguir amb un cas inbound:

- `Octavi` demana criteri comercial a `summa-sales-director`
- es prepara com a minim un primer correu de resposta
- el draft es crea via `summa-mail`
- l'enviament continua exigint `pending_id` i confirmacio humana

Si el cas madura:

- descoberta/demo -> `summa-meeting-prep`
- proposta -> `summa-proposal`

## 7. Diferència amb l'outbound

Aquest funnel NO es el mateix que el weekly outreach.

Per tant:

- no viu a `sales/crm/leads.json` en el v1
- no usa per defecte el contracte de cold outreach
- no s'ha de respondre com si fos prospeccio freda

Inbound:

- ja hi ha una senyal d'interes
- el to ha de ser mes contextual i menys introductori
- la CTA pot ser conversa curta, demo o material/video segons moment

## 8. Fonts de veritat

- inbox original: `summa-mail`
- briefing extern: web oficial de l'entitat
- criteri comercial: `summa-sales-director`
- enviament real: `summa-mail` + `Resend`

## 9. Què recordar

- `Octavi` segueix sent el director del sistema
- `summa-mail` segueix sent la capa de correu
- el producte `summa-social` no guarda l'inbox ni els secrets
- si aquest funnel canvia d'arquitectura, s'ha d'actualitzar aquest document i el de context operatiu general
