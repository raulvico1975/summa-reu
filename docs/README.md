# Documentacio del projecte

Aquest directori queda ordenat amb un criteri conservador:

- a l'arrel només hi queden documents d'autoritat o fitxers amb ruta estable consumida per scripts
- els runbooks manuals van a subcarpetes tematiques
- el material generat continua a `docs/generated/`
- el soroll temporal o residual va a `docs/archive/`

## Llegeix primer

1. `docs/DEPLOY.md` - contracte curt d'autoritat operativa
2. `docs/GOVERN-DE-CODI-I-DEPLOY.md` - norma llarga de worktree, integracio i deploy
3. `docs/REPO-HIGIENE-I-DIAGNOSTIC.md` - diagnòstic i neteja de bloquejos
4. `docs/DEV-SOLO-MANUAL.md` - manual pràctic del mantenidor
5. `docs/SUMMA-SOCIAL-REFERENCIA-COMPLETA.md` - document mestre del producte
6. `docs/PATRONS-CODI-OBLIGATORIS.md` - invariants i patrons obligatoris

## Mapa rapid

### Arrel de `docs/`

Nomes hi han de viure:

- documents d'autoritat del projecte
- fitxers operatius amb ruta fixa usada per scripts
- documents centrals d'usuari o producte

Exemples:

- `docs/DEPLOY.md`
- `docs/GOVERN-DE-CODI-I-DEPLOY.md`
- `docs/REPO-HIGIENE-I-DIAGNOSTIC.md`
- `docs/SUMMA-SOCIAL-REFERENCIA-COMPLETA.md`
- `docs/DEV-SOLO-MANUAL.md`
- `docs/QA-FISCAL.md`
- `docs/DEPLOY-LOG.md`
- `docs/DEPLOY-INCIDENTS.md`
- `docs/DEPLOY-ROLLBACK-LATEST.md`
- `docs/manual-usuari-summa-social.md`
- `docs/FAQ_SUMMA_SOCIAL.md`

### Carpetes amb sentit actual

- `docs/operations/` - runbooks manuals i operativa no automatica
  - `docs/operations/Mapa_Canonic_Bots_I_Subagents.md` - mapa actual de bot de suport, OpenClaw, Octavi editorial i prompts/subagents
  - `docs/operations/CONTEXT-OPERATIU-WEB-I-INTEGRACIONS.md` - web public, contacte, WhatsApp, correu del domini i runtime extern d'OpenClaw
  - `docs/operations/SUMMA-MAIL-OPERATIVA-RAPIDA.md` - on es veu l'inbox de `hola@`, on es veuen els enviats i com no perdre's amb el runtime comercial
  - `docs/operations/SUMMA-INBOUND-FUNNEL.md` - com `Octavi` detecta, briefa i acompanya els contactes entrants de `hola@summasocial.app`
- `docs/guardrails/` - fitxes curtes de guardrails i criteris d'implementacio
- `docs/QA/` - proves manuals, cobertura i analisi estatica
- `docs/security/` - auditories i documents de seguretat/privacitat
- `docs/kb/` - base de coneixement estructurada del bot i validacions
- `docs/design/` - contracte visual curt i guardrails d'UI
- `docs/generated/` - artefactes generats per scripts; no editar a ma si venen d'un build
- `docs/governance/`, `docs/contracts/`, `docs/trust/`, `docs/i18n/`, `docs/product-updates/`, `docs/sync/` - documentacio tematica
- `docs/archive/` - material retirat de la navegacio principal o residus conservats

Exemple actual de `docs/contracts/`:

- `docs/contracts/blog-publish-cover-image.md` - contracte extern OpenClaw -> Summa per al blog públic
- `docs/contracts/private-admin-integrations-v1.md` - contracte objectiu per a integracions privades d'agents externs controlats per l'equip

## Regles de manteniment

- Si un fitxer es usat per un script, conserva la ruta estable o actualitza el codi en el mateix canvi.
- Si un document es temporal, d'experiment o brut, no va a l'arrel.
- Si un document deixa de ser operatiu pero pot tenir valor historic, mou-lo a `docs/archive/`.
- No afegir nous pseudo-"skills" a `docs/`; les fitxes curtes van a `docs/guardrails/`.
- No editar `docs/generated/*` manualment si la font real es un script.

## Notes d'aquesta reordenacio

- l'antiga carpeta de pseudo-skills s'ha renombrat a `docs/guardrails/`
- runbooks manuals dispersos s'han mogut a `docs/operations/`
- residus com `.DS_Store` i proves temporals s'han apartat a `docs/archive/_trash/`
- els snapshots de vigencia documental s'arxiven a `docs/archive/`
- `docs/CHANGELOG.md` s'ha deixat com a resum curt i l'historial ampli ha passat a `docs/archive/changelog/`
