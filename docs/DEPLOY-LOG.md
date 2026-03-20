# Deploy Log — Summa Social

Registre cronologic de desplegaments a produccio.

## Notes operatives sense deploy

### 2026-03-19 — Deploy completat després de tancar el ritual

- SHA main del contingut publicat: `28c1930`.
- SHA final a `prod`: `541d479`.
- Abast publicat: bloc de 14 fitxers amb ajustos de `stripe-importer` i `stripe-detection`, `donor-search-combobox`, `docs/QA-FISCAL.md`, `docs/CHANGELOG.md`, `firestore.indexes.json`, traduccions `i18n` i tests associats.

### 2026-03-19 — Stripe fiscal UI post-merge

- PR #21 mergejada a `main` (`22acb1a`).
- Verificacio post-merge OK del cablejat UI Stripe: menu desktop/mobile, obertura de `StripeImputationModal` i undo via `undoProcessing`.
- Sense deploy en aquest intent: `npm run publica` bloquejat a `verify-local.sh` per variables de build absents (`NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_API_KEY`).

### 2026-03-16 — Stripe importer contract alignment

- Stripe importer validat amb `typecheck`, `npm test` i prova manual dels 4 casos clau.
- Contracte mestre alineat amb el codi: el CSV pot contenir files sense `Transfer`; s'ignoren fins que formin part d'un payout real.
- Sense deploy en aquest tancament; canvi deixat preparat directament sobre `main`.

### 2026-03-13 — Admin health clarity

- Branca preparada per merge complet: `codex/admin-health-clarity-20260313`
- Snapshot nightly fix: validat
- Separacio incidents / salut de dades: validada
- i18n: validat
- QA visual: validada
- QA ACK/RESOLVED en viu: pendent post-merge
- Sense deploy
- Seguent pas operatiu: test manual curt a `/admin` amb incident real o sintetic per verificar `OPEN`, transicio a `ACK`, transicio a `RESOLVED` i absencia d'impacte sobre la seccio de Salut de dades.

### 2026-03-12 — Remeses OUT de devolucions

- Branca preparada per merge complet: `codex/returns-undo-global-repair`
- Invariant fixat: les filles arxivades no compten mai com a filles actives en remeses OUT de devolucions, ni en reprocess ni en calcul d'estat.
- Verificacions guardades a `tmp/verification/2026-03-12-returns-out-*.log`
- Detector global en lectura: 0 casos oberts
- Script puntual Baruma en `dry-run`: `no-op`
- Sense reparacio real de dades executada en aquesta integracio

### 2026-03-12 — Canonical active child detection

- Fals positiu de consistència detectat a UI: el fallback per `remittanceId` incloïa el pare i inflava recompte i suma de filles.
- Invariant fixat: `parentTransactionId` és la relació canònica pare-filla; `remittanceId` queda només com a metadada de vincle amb el document de remesa.
- Guardrails explícits: el pare s'exclou sempre, `archivedAt` exclou filles inactives i `isRemittanceItem === true` només actua com a fallback legacy.
- Segon punt crític corregit a `src/lib/fiscal/undoProcessing.ts` perquè el fallback legacy d'undo no decideixi filles només per `remittanceId`.
- Sense canvis de dades, sense migracions i sense canvi de UX en aquesta integració.

| Data | SHA | Risc | Fiscal | Fitxers | Resultat |
|------|-----|------|--------|---------|----------|
| 2026-02-11 19:07 | 771fa85 | ALT | Si | 31 | OK |
| 2026-02-11 19:13 | 2e6c813 | MITJA | Si | 15 | OK |
| 2026-02-11 21:24 | b7cac23 | ALT | Si | 17 | OK |
| 2026-02-11 21:45 | cd489fa | MITJA | Si | 16 | OK |
| 2026-02-12 08:08 | 7d1f3e4 | MITJA | Si | 26 | OK |
| 2026-02-12 10:26 | 6d919c9 | ALT | Si | 17 | PENDENT |
| 2026-02-12 10:55 | 5e9ec15 | ALT | Si | 17 | PENDENT |
| 2026-02-12 12:08 | 6b4e59b | MITJA | Si | 20 | PENDENT |
| 2026-02-12 13:38 | 39220a5 | ALT | Si | 21 | PENDENT |
| 2026-02-13 11:06 | 520b49c | MITJA | Si | 18 | OK |
| 2026-02-13 11:24 | 15356d4 | ALT | No | 58 | PENDENT |
| 2026-02-13 15:10 | 89cae4e | MITJA | Si | 7 | OK |
| 2026-02-13 15:43 | 9af3eec | MITJA | No | 9 | OK |
| 2026-02-13 17:13 | 650c2c9 | MITJA | Si | 5 | OK |
| 2026-02-14 12:47 | a15c138 | ALT | No | 21 | OK |
| 2026-02-14 14:23 | 06c4765 | ALT | No | 11 | OK |
| 2026-02-14 17:18 | 2418080 | ALT | No | 7 | OK |
| 2026-02-14 17:21 | 3240025 | MITJA | No | 2 | OK |
| 2026-02-14 17:35 | 67887c3 | ALT | No | 6 | OK |
| 2026-02-14 17:39 | 8df364d | ALT | No | 2 | OK |
| 2026-02-14 17:46 | 2e1fcf7 | ALT | No | 4 | OK |
| 2026-02-14 17:54 | 434f911 | ALT | No | 4 | OK |
| 2026-02-14 18:03 | 5b1cd0e | MITJA | No | 2 | OK |
| 2026-02-14 18:07 | 86c1b96 | MITJA | No | 2 | OK |
| 2026-02-14 18:30 | 8a174ed | ALT | No | 11 | OK |
| 2026-02-14 18:35 | 6ea4e4c | ALT | No | 3 | OK |
| 2026-02-14 18:44 | 8dabb1b | ALT | No | 5 | OK |
| 2026-02-14 19:44 | 10767b1 | ALT | Si | 8 | OK |
| 2026-02-14 20:45 | c2e28ec | ALT | No | 11 | PENDENT |
| 2026-02-14 21:19 | 9138509 | MITJA | No | 5 | PENDENT |
| 2026-02-14 21:38 | acb114a | MITJA | No | 46 | PENDENT |
| 2026-02-15 08:34 | 1fce5f3 | ALT | Si | 18 | PENDENT |

| 2026-02-15 10:28 | b697b7e | ALT | Si | 24 | PENDENT |
| 2026-02-15 10:43 | 5b15157 | MITJA | No | 6 | PENDENT |
| 2026-02-15 10:58 | 1205c8f | MITJA | No | 5 | PENDENT |
| 2026-02-15 17:16 | 251bf16 | MITJA | Si | 5 | PENDENT |
| 2026-02-15 17:28 | 216c355 | ALT | No | 7 | PENDENT |
| 2026-02-15 18:36 | b0b3fbe | MITJA | No | 24 | PENDENT |
| 2026-02-15 18:45 | 7b4bed7 | MITJA | No | 7 | OK |
| 2026-02-15 20:30 | 861cb3c | ALT | No | 22 | OK |
| 2026-02-15 21:50 | 42a3f6d | MITJA | No | 4 | OK |
| 2026-02-15 22:39 | 0a404c8 | MITJA | No | 4 | OK |
| 2026-02-15 23:27 | 662a85c | ALT | No | 18 | OK |
| 2026-02-16 11:01 | a4956e9 | MITJA | No | 2 | OK |
| 2026-02-16 12:11 | 27d803e | MITJA | Si | 4 | OK |
| 2026-02-16 13:06 | 8c5c5a1 | MITJA | No | 3 | OK |
| 2026-02-16 13:42 | 87e6dd6 | ALT | Si | 21 | OK |
| 2026-02-16 17:54 | db4713c | ALT | Si | 28 | OK |
| 2026-02-16 19:51 | 324ebf7 | MITJA | No | 10 | OK |
| 2026-02-17 07:23 | 645787b | BAIX | No | 2 | OK |
| 2026-02-17 07:28 | 7ff1aa7 | BAIX | No | 5 | OK |
| 2026-02-17 09:25 | 78b7748 | MITJA | Si | 3 | OK |
| 2026-02-17 10:01 | 0be51ac | MITJA | No | 10 | OK |
| 2026-02-17 15:54 | bc0b6ab | MITJA | No | 9 | OK |
| 2026-02-17 19:19 | 8f2d31f | MITJA | Si | 7 | OK |
| 2026-02-17 21:53 | cee7133 | ALT | Si | 30 | OK |
| 2026-02-17 22:06 | 85892a1 | MITJA | No | 10 | OK |
| 2026-02-18 14:51 | 4dd1517 | MITJA | Si | 9 | OK |
| 2026-02-23 16:44 | c971139 | MITJA | No | 17 | OK |
| 2026-02-24 12:48 | 84873cf | ALT | Si | 38 | OK |
| 2026-02-24 14:50 | 0d83b87 | ALT | Si | 37 | OK |
| 2026-02-25 08:49 | aa4332a | MITJA | No | 7 | OK |
| 2026-02-25 09:17 | 629a9e6 | MITJA | No | 1 | OK |
| 2026-02-25 12:09 | 35384c0 | ALT | Si | 14 | OK |
| 2026-02-26 09:31 | 546c05d | MITJA | Si | 9 | OK |
| 2026-02-26 10:18 | 910c6a9 | MITJA | Si | 4 | OK |
| 2026-02-27 11:43 | ddbc596 | ALT | No | 4 | OK |
| 2026-02-27 13:15 | 2e5509e | MITJA | Si | 4 | OK |
| 2026-02-27 14:25 | 5b791ca | MITJA | Si | 10 | OK |
| 2026-02-27 14:59 | 6b80eff | MITJA | No | 4 | OK |
| 2026-02-27 15:29 | 49b5413 | MITJA | No | 15 | OK |
| 2026-02-27 15:47 | c28fc9c | MITJA | Si | 1 | OK |
| 2026-02-27 15:57 | 9ff9e62 | BAIX | No | 2 | OK |
| 2026-02-27 16:16 | 188437f | MITJA | No | 3 | OK |
| 2026-02-27 16:26 | 17dfe76 | MITJA | No | 13 | OK |
| 2026-02-28 09:24 | 39176a1 | MITJA | Si | 15 | OK |
| 2026-02-28 10:23 | 2f45f26 | ALT | Si | 20 | PENDENT |

### Nota 2026-02-28 (2f45f26)

- P0 test coverage: SEPA pain.008/pain.001 + fiscal invariants/locks/undo.
- No deps noves; CI report-only.
- Extraccio minima de helpers purs per testabilitat a `processLocks.ts`, `children-ops.ts`, `undoProcessing.ts`.

| 2026-02-28 10:46 | 57f3250 | ALT | Si | 31 | OK |
| 2026-02-28 10:49 | 14d78c5 | MITJA | Si | 6 | OK |
| 2026-02-28 17:26 | 857dad3 | MITJA | No | 13 | OK |
| 2026-02-28 17:53 | e6abfdb | MITJA | No | 7 | OK |
| 2026-02-28 18:10 | 63d5bec | ALT | Si | 11 | OK |
| 2026-02-28 19:03 | 0334390 | MITJA | No | 8 | OK |
| 2026-02-28 19:36 | ffd7b80 | ALT | No | 9 | OK |
| 2026-02-28 19:42 | 6b03e91 | BAIX | No | 2 | OK |
| 2026-02-28 20:03 | f1f7b54 | ALT | No | 6 | OK |
| 2026-03-01 10:49 | 0cde50a | BAIX | No | 2 | OK |
| 2026-03-01 11:04 | b97fc98 | BAIX | No | 2 | OK |
| 2026-03-01 18:09 | d4b42bb | BAIX | No | 2 | OK |
| 2026-03-01 19:12 | f460d53 | BAIX | No | 2 | OK |
| 2026-03-01 19:46 | 491714d | ALT | Si | 12 | OK |
| 2026-03-01 20:00 | ffaad53 | BAIX | No | 2 | OK |
| 2026-03-01 20:50 | d3854cd | MITJA | No | 5 | OK |
| 2026-03-01 21:52 | cdf332e | BAIX | No | 2 | OK |
| 2026-03-01 22:03 | 77b5e7b | MITJA | No | 8 | OK |
| 2026-03-02 08:52 | b998f99 | BAIX | No | 2 | OK |
| 2026-03-02 08:56 | 32b1a69 | ALT | Si | 19 | OK |
| 2026-03-02 08:59 | 2156fbf | MITJA | No | 4 | OK |
| 2026-03-02 10:06 | 5a7597a | ALT | Si | 12 | OK |
| 2026-03-02 15:46 | ee19e34 | MITJA | No | 4 | OK |
| 2026-03-02 16:00 | 988a0f1 | MITJA | No | 4 | OK |
| 2026-03-02 16:18 | ea45f89 | ALT | Si | 8 | OK |
| 2026-03-02 16:24 | 6487cba | MITJA | No | 4 | OK |
| 2026-03-02 16:36 | 5c078d0 | MITJA | No | 6 | OK |
| 2026-03-02 16:42 | 182468a | MITJA | No | 3 | OK |
| 2026-03-02 17:46 | e84cd15 | ALT | No | 7 | OK |
| 2026-03-03 11:30 | 549c9ca | MITJA | Si | 3 | OK |
| 2026-03-03 11:51 | 332ca4d | MITJA | No | 9 | OK |
| 2026-03-03 12:05 | 28f4777 | MITJA | Si | 3 | OK |
| 2026-03-03 20:27 | d101e05 | MITJA | Si | 15 | OK |
| 2026-03-04 08:30 | 79c32f2 | MITJA | Si | 8 | OK |
| 2026-03-04 10:04 | 8ee0198 | MITJA | Si | 4 | OK |
| 2026-03-05 10:01 | 8ee53e6 | ALT | Si | 10 | OK_AMB_AVIS |
| 2026-03-05 12:11 | 601b350 | ALT | Si | 20 | OK_AMB_AVIS |
| 2026-03-05 14:22 | 39757d5 | MITJA | Si | 7 | OK |
| 2026-03-05 14:42 | f81647c | MITJA | Si | 4 | OK |
| 2026-03-05 16:35 | 6b3e484 | MITJA | Si | 9 | OK |
| 2026-03-06 10:17 | 4f0670c | MITJA | Si | 7 | OK |
| 2026-03-07 09:02 | a04dab1 | MITJA | Si | 29 | OK |
| 2026-03-07 18:14 | ed71fd7 | ALT | Si | 29 | OK_AMB_AVIS |
| 2026-03-07 18:15 | 012315e | ALT | Si | 29 | OK_AMB_AVIS |
| 2026-03-07 18:52 | 38f9997 | MITJA | Si | 7 | OK |
| 2026-03-07 19:21 | f0a7c11 | MITJA | Si | 4 | OK |
| 2026-03-07 20:00 | af15451 | MITJA | Si | 7 | OK |
| 2026-03-07 20:08 | e306ea9 | MITJA | Si | 4 | OK |
| 2026-03-08 09:15 | b0e7db8 | MITJA | Si | 12 | OK |
| 2026-03-08 11:17 | 4564634 | ALT | No | 7 | OK |
| 2026-03-08 12:26 | ccc4d303 | MITJA | No | 11 | PENDENT |
| 2026-03-08 19:17 | 32f0ad4f | BAIX | No | 2 | PENDENT |
| 2026-03-09 16:08 | d48076f | MITJA | No | 77 | OK |
| 2026-03-10 11:01 | 069b6c2 | BAIX | No | 7 | OK |
| 2026-03-10 13:07 | 3168167 | BAIX | No | 2 | OK |
| 2026-03-10 22:56 | bca0518 | ALT | Si | 17 | OK_AMB_AVIS |
| 2026-03-10 22:57 | c485461 | ALT | Si | 17 | OK_AMB_AVIS |
| 2026-03-10 23:25 | 0e2edb3 | MITJA | No | 8 | OK |
| 2026-03-11 20:40 | 53a365e | ALT | Si | 35 | OK_AMB_AVIS |
| 2026-03-12 08:18 | a2f21af | MITJA | Si | 7 | OK |
| 2026-03-12 10:39 | faae8dc | MITJA | Si | 16 | OK |
| 2026-03-12 13:14 | 3c805b8 | MITJA | No | 6 | OK |
| 2026-03-12 13:21 | 3827be1 | ALT | Si | 6 | OK_AMB_AVIS |
| 2026-03-12 14:05 | 1d61ca6 | ALT | Si | 11 | OK_AMB_AVIS |
| 2026-03-12 14:39 | 193dfe9 | ALT | No | 5 | OK |
| 2026-03-12 15:18 | 9e9465c | ALT | Si | 9 | OK_AMB_AVIS |
| 2026-03-13 12:03 | 1248c81 | MITJA | No | 12 | OK |
| 2026-03-14 08:25 | 62c2280 | ALT | No | 56 | OK |
| 2026-03-14 09:42 | 50e57b8 | ALT | No | 8 | OK |
| 2026-03-14 09:57 | c5dc9ce | ALT | No | 5 | OK |
| 2026-03-14 10:01 | 85d0be0 | ALT | No | 3 | OK |
| 2026-03-14 10:03 | b876a75 | ALT | No | 3 | OK |
| 2026-03-14 10:36 | baa84a6 | ALT | No | 3 | OK |
| 2026-03-16 09:09 | 77f4257 | MITJA | No | 25 | OK |
| 2026-03-16 15:46 | 7a2c52d | MITJA | No | 15 | OK |
| 2026-03-16 16:25 | 54d93d2 | MITJA | No | 10 | OK |
| 2026-03-19 12:12 | 28c1930 | MITJA | Si | 14 | OK |
| 2026-03-20 09:14 | 3f92e9d | MITJA | Si | 14 | OK |
## Decisions humanes (negoci)

| Data | SHA | human_question_reason | business_impact | decision_taken |
|------|-----|-----------------------|-----------------|----------------|
| 2026-02-15 08:34 | 1fce5f3 | Risc ALT residual després de verificacions automàtiques. | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | B_DEPLOY_WITH_VISIBLE_RISK |
| 2026-02-15 10:28 | b697b7e | Risc ALT residual després de verificacions automàtiques. | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | B_DEPLOY_WITH_VISIBLE_RISK |
| 2026-02-16 13:42 | 87e6dd6 | Risc ALT residual després de verificacions automàtiques. | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | B_DEPLOY_WITH_VISIBLE_RISK |
| 2026-02-16 17:54 | db4713c | Risc ALT residual després de verificacions automàtiques. | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | B_DEPLOY_WITH_VISIBLE_RISK |

## Backup curt predeploy

| Data | SHA | resultat | export_path |
|------|-----|----------|-------------|
| 2026-02-16 13:42 | 87e6dd6 | SKIPPED_NO_BUCKET | - |
| 2026-02-16 17:54 | db4713c | SKIPPED_NO_BUCKET | - |
| 2026-02-17 21:53 | cee7133 | Risc ALT residual després de verificacions automàtiques. | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | B_DEPLOY_WITH_VISIBLE_RISK |
| 2026-02-17 21:53 | cee7133 | SKIPPED_NO_BUCKET | - |
| 2026-02-24 12:48 | 84873cf | Risc ALT residual després de verificacions automàtiques. | podria canviar qui veu o edita informació sensible, i l'entitat podria tenir accessos no esperats. | B_DEPLOY_WITH_VISIBLE_RISK |
| 2026-02-24 12:48 | 84873cf | SKIPPED_NO_BUCKET | - |
| 2026-02-24 14:50 | 0d83b87 | Risc ALT residual després de verificacions automàtiques. | podria canviar qui veu o edita informació sensible, i l'entitat podria tenir accessos no esperats. | B_DEPLOY_WITH_VISIBLE_RISK |
| 2026-02-24 14:50 | 0d83b87 | SKIPPED_NO_BUCKET | - |
| 2026-02-25 12:09 | 35384c0 | Risc ALT residual després de verificacions automàtiques. | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | B_DEPLOY_WITH_VISIBLE_RISK |
| 2026-02-25 12:09 | 35384c0 | SKIPPED_NO_BUCKET | - |
| 2026-02-28 10:46 | 57f3250 | Risc ALT residual després de verificacions automàtiques. | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | B_DEPLOY_WITH_VISIBLE_RISK |
| 2026-02-28 10:46 | 57f3250 | SKIPPED_NO_BUCKET | - |
| 2026-02-28 18:10 | 63d5bec | Risc ALT residual després de verificacions automàtiques. | podria afectar el processament de remeses, i l'entitat podria veure cobraments o assignacions que no toquen. | B_DEPLOY_WITH_VISIBLE_RISK |
| 2026-02-28 18:10 | 63d5bec | SKIPPED_NO_BUCKET | - |
| 2026-03-01 19:46 | 491714d | Risc ALT residual després de verificacions automàtiques. | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | B_DEPLOY_WITH_VISIBLE_RISK |
| 2026-03-01 19:46 | 491714d | SKIPPED_NO_BUCKET | - |
| 2026-03-02 08:56 | 32b1a69 | Risc ALT residual després de verificacions automàtiques. | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | B_DEPLOY_WITH_VISIBLE_RISK |
| 2026-03-02 08:56 | 32b1a69 | SKIPPED_NO_BUCKET | - |
| 2026-03-02 10:06 | 5a7597a | Risc ALT residual després de verificacions automàtiques. | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | B_DEPLOY_WITH_VISIBLE_RISK |
| 2026-03-02 10:06 | 5a7597a | SKIPPED_NO_BUCKET | - |
| 2026-03-02 16:18 | ea45f89 | Risc ALT residual després de verificacions automàtiques. | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | B_DEPLOY_WITH_VISIBLE_RISK |
| 2026-03-02 16:18 | ea45f89 | SKIPPED_NO_BUCKET | - |
| 2026-03-05 10:01 | 8ee53e6 | Risc ALT residual detectat (avís guiat, no bloquejant). | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | AUTO_CONTINUE_GUIDED_WARNING |

## Avisos guiats (negoci)

| Data | SHA | Risc | impacte_possible | recomanacio |
|------|-----|------|------------------|-------------|
| 2026-03-05 10:01 | 8ee53e6 | ALT | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | Recomanacio: validar 1 cas real curt abans de publicar (moviment d'exemple -> resultat final esperat). |
| 2026-03-05 10:01 | 8ee53e6 | SKIPPED_NO_BUCKET | - |
| 2026-03-05 12:11 | 601b350 | Risc ALT residual detectat (avís guiat, no bloquejant). | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | AUTO_CONTINUE_GUIDED_WARNING |
| 2026-03-05 12:11 | 601b350 | ALT | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | Recomanacio: validar 1 cas real curt abans de publicar (moviment d'exemple -> resultat final esperat). |
| 2026-03-05 12:11 | 601b350 | SKIPPED_NO_BUCKET | - |
| 2026-03-07 18:14 | ed71fd7 | Risc ALT residual detectat (avís guiat, no bloquejant). | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | AUTO_CONTINUE_GUIDED_WARNING |
| 2026-03-07 18:14 | ed71fd7 | ALT | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | Recomanacio: validar 1 cas real curt abans de publicar (moviment d'exemple -> resultat final esperat). |
| 2026-03-07 18:14 | ed71fd7 | SKIPPED_NO_BUCKET | - |
| 2026-03-07 18:15 | 012315e | Risc ALT residual detectat (avís guiat, no bloquejant). | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | AUTO_CONTINUE_GUIDED_WARNING |
| 2026-03-07 18:15 | 012315e | ALT | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | Recomanacio: validar 1 cas real curt abans de publicar (moviment d'exemple -> resultat final esperat). |
| 2026-03-07 18:15 | 012315e | SKIPPED_NO_BUCKET | - |
| 2026-03-10 22:56 | bca0518 | Risc ALT residual detectat (avís guiat, no bloquejant). | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | AUTO_CONTINUE_GUIDED_WARNING |
| 2026-03-10 22:56 | bca0518 | ALT | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | Recomanacio: validar 1 cas real curt abans de publicar (moviment d'exemple -> resultat final esperat). |
| 2026-03-10 22:56 | bca0518 | SKIPPED_NO_BUCKET | - |
| 2026-03-10 22:57 | c485461 | Risc ALT residual detectat (avís guiat, no bloquejant). | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | AUTO_CONTINUE_GUIDED_WARNING |
| 2026-03-10 22:57 | c485461 | ALT | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | Recomanacio: validar 1 cas real curt abans de publicar (moviment d'exemple -> resultat final esperat). |
| 2026-03-10 22:57 | c485461 | SKIPPED_NO_BUCKET | - |
| 2026-03-11 20:40 | 53a365e | Risc ALT residual detectat (avís guiat, no bloquejant). | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | AUTO_CONTINUE_GUIDED_WARNING |
| 2026-03-11 20:40 | 53a365e | ALT | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | Recomanacio: validar 1 cas real curt abans de publicar (moviment d'exemple -> resultat final esperat). |
| 2026-03-11 20:40 | 53a365e | SKIPPED_NO_BUCKET | - |
| 2026-03-12 13:21 | 3827be1 | Risc ALT residual detectat (avís guiat, no bloquejant). | podria afectar el processament de remeses, i l'entitat podria veure cobraments o assignacions que no toquen. | AUTO_CONTINUE_GUIDED_WARNING |
| 2026-03-12 13:21 | 3827be1 | ALT | podria afectar el processament de remeses, i l'entitat podria veure cobraments o assignacions que no toquen. | Recomanacio: validar 1 cas real curt abans de publicar (moviment d'exemple -> resultat final esperat). |
| 2026-03-12 13:21 | 3827be1 | SKIPPED_NO_BUCKET | - |
| 2026-03-12 14:05 | 1d61ca6 | Risc ALT residual detectat (avís guiat, no bloquejant). | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | AUTO_CONTINUE_GUIDED_WARNING |
| 2026-03-12 14:05 | 1d61ca6 | ALT | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | Recomanacio: validar 1 cas real curt abans de publicar (moviment d'exemple -> resultat final esperat). |
| 2026-03-12 14:05 | 1d61ca6 | SKIPPED_NO_BUCKET | - |
| 2026-03-12 15:18 | 9e9465c | Risc ALT residual detectat (avís guiat, no bloquejant). | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | AUTO_CONTINUE_GUIDED_WARNING |
| 2026-03-12 15:18 | 9e9465c | ALT | podria alterar imports de donacions o devolucions, i l'entitat podria veure totals incorrectes en certificats o informes fiscals. | Recomanacio: validar 1 cas real curt abans de publicar (moviment d'exemple -> resultat final esperat). |
| 2026-03-12 15:18 | 9e9465c | SKIPPED_NO_BUCKET | - |
