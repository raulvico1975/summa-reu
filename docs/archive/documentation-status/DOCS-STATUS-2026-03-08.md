# Estat de la documentacio

Data de revisio: 2026-03-08

## Criteri

- `VIGENT`: consistent amb el repo actual o amb rutes/scripts vius
- `UTIL PERO REVISAR`: encara aporta valor, pero no puc garantir alineacio completa sense revisio tematica
- `HISTORIC`: snapshot o registre; no s'ha d'usar com a contracte viu
- `REVISIO OBLIGADA`: conté afirmacions que avui no coincideixen del tot amb el producte o l'operativa real
- `GENERAT`: artefacte de scripts

## Vigent

- `docs/SUMMA-SOCIAL-REFERENCIA-COMPLETA.md`
- `docs/PATRONS-CODI-OBLIGATORIS.md`
- `docs/DEV-SOLO-MANUAL.md`
- `docs/GOVERN-DE-CODI-I-DEPLOY.md`
- `docs/manual-usuari-summa-social.md`
- `docs/FAQ_SUMMA_SOCIAL.md`
- `docs/QA-FISCAL.md`
- `docs/DEPLOY-LOG.md`
- `docs/DEPLOY-INCIDENTS.md`
- `docs/DEPLOY-ROLLBACK-LATEST.md`
- `docs/PERMISSIONS-SYSTEM.md`
- `docs/CRITERI-CERTIFICATS-DONACIO.md`
- `docs/CATALEG-FUNCIONALITATS.md`
- `docs/trust/Data-Exit-Plan.md`
- `docs/governance/Product-Governance-Charter.md`
- `docs/contracts/Service-Agreement-Template.md`
- `docs/security/TOMs.md`
- `docs/guardrails/*`
- `docs/operations/*`
- `docs/design/*`
- `docs/kb/*`

## Generat

- `docs/generated/*`
- `docs/product-updates/product-updates-drafts.json`
- `docs/PERFORMANCE-BASELINE-v1.json`
- `docs/i18n/*`

## Historic

- `docs/CHANGELOG.md`
- `docs/archive/performance/PERFORMANCE-BASELINE-v1.md`
- `docs/archive/changelog/CHANGELOG-pre-2026-03-08.md`
- `docs/security/AUDIT-2026-01-04.md`
- `docs/archive/_trash/*`

## Util pero revisar

- `docs/REMESES-IN-LEGACY-I-ROBUSTESA.md`
- `docs/security/PRIVACY_POLICY.md`
- `docs/security/Subprocessors.md`
- `docs/i18n.md`
- `docs/QA/*`

## Decisio aplicada

- s'ha mantingut el que es viu o consumit per scripts
- s'ha arxivat el baseline Markdown de performance perque era un snapshot historic
- els documents amb risc semantic s'han reescrit per alinear-los amb el producte actual
- s'ha separat millor el que es base viva (`docs/kb/*`) del que son informes d'auditoria (`docs/i18n/*`)
