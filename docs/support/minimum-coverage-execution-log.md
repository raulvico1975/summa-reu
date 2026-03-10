# Minimum Coverage Execution Log

## updatedCards

- `/Users/raulvico/Documents/summa-social/docs/kb/_eval/expected.json`
- `/Users/raulvico/Documents/summa-social/docs/kb/_eval/expected-es.json`

## createdCards

- `howto-member-create`
- `howto-donor-edit`
- `howto-donor-update-iban`
- `howto-donor-history-summary`
- `howto-donor-update-fee`
- `howto-dashboard-income-period`
- `howto-donor-fiscal-review`
- `howto-member-invite`
- `howto-member-user-permissions`
- `howto-donor-export`
- `howto-remittance-create-sepa`
- `howto-remittance-review-before-send`
- `howto-assign-bank-movement`
- `howto-movement-split-amount`
- `howto-import-safe-duplicates`
- `howto-organization-fiscal-data`
- `howto-movement-unassigned-alerts`

## blockedFlows

- `member-company-contact-link`
  - status: `blocked-by-verification`
  - què falta: no hi ha cap flux verificat que assigni un membre o soci com a contacte operatiu d'una empresa donant; el producte només exposa el camp informatiu `Persona de contacte`.
  - quin fitxer no ho confirma: `/Users/raulvico/Documents/summa-social/src/components/donor-manager.tsx`, `/Users/raulvico/Documents/summa-social/docs/manual-usuari-summa-social.md`
  - per què no s'ha escrit la card: la funcionalitat formulada al mapa no existeix al producte amb suport verificable.

- `member-fee-pause`
  - status: `blocked-by-verification`
  - què falta: no hi ha cap camp, estat o acció verificable de `pausa` per a quotes de soci.
  - quin fitxer no ho confirma: `/Users/raulvico/Documents/summa-social/src/components/donor-manager.tsx`, `/Users/raulvico/Documents/summa-social/src/i18n/locales/ca.json`
  - per què no s'ha escrit la card: només està verificat el canvi d'import, modalitat i periodicitat; no una pausa formal.

## verificationEvidence

- `howto-member-create`
  - evidence:
    - `/Users/raulvico/Documents/summa-social/src/components/donor-manager.tsx`
    - `/Users/raulvico/Documents/summa-social/src/i18n/locales/ca.json`
    - `/Users/raulvico/Documents/summa-social/docs/manual-usuari-summa-social.md`

- `howto-donor-edit`
  - evidence:
    - `/Users/raulvico/Documents/summa-social/src/components/donor-manager.tsx`
    - `/Users/raulvico/Documents/summa-social/src/components/donor-detail-drawer.tsx`
    - `/Users/raulvico/Documents/summa-social/docs/manual-usuari-summa-social.md`

- `howto-donor-update-iban`
  - evidence:
    - `/Users/raulvico/Documents/summa-social/src/components/donor-manager.tsx`
    - `/Users/raulvico/Documents/summa-social/docs/manual-usuari-summa-social.md`

- `howto-donor-history-summary`
  - evidence:
    - `/Users/raulvico/Documents/summa-social/src/components/donor-detail-drawer.tsx`
    - `/Users/raulvico/Documents/summa-social/src/i18n/locales/ca.json`
    - `/Users/raulvico/Documents/summa-social/docs/manual-usuari-summa-social.md`

- `howto-donor-update-fee`
  - evidence:
    - `/Users/raulvico/Documents/summa-social/src/components/donor-manager.tsx`
    - `/Users/raulvico/Documents/summa-social/docs/manual-usuari-summa-social.md`

- `howto-dashboard-income-period`
  - evidence:
    - `/Users/raulvico/Documents/summa-social/src/app/[orgSlug]/dashboard/page.tsx`
    - `/Users/raulvico/Documents/summa-social/src/components/date-filter.tsx`
    - `/Users/raulvico/Documents/summa-social/src/i18n/locales/ca.json`
    - `/Users/raulvico/Documents/summa-social/src/i18n/locales/es.json`
    - `/Users/raulvico/Documents/summa-social/docs/manual-usuari-summa-social.md`

- `howto-donor-fiscal-review`
  - evidence:
    - `/Users/raulvico/Documents/summa-social/src/components/donor-manager.tsx`
    - `/Users/raulvico/Documents/summa-social/src/i18n/locales/ca.json`
    - `/Users/raulvico/Documents/summa-social/docs/manual-usuari-summa-social.md`

- `howto-member-invite`
  - evidence:
    - `/Users/raulvico/Documents/summa-social/src/components/members-manager.tsx`
    - `/Users/raulvico/Documents/summa-social/src/components/invite-member-dialog.tsx`
    - `/Users/raulvico/Documents/summa-social/docs/manual-usuari-summa-social.md`

- `howto-member-user-permissions`
  - evidence:
    - `/Users/raulvico/Documents/summa-social/src/components/members-manager.tsx`
    - `/Users/raulvico/Documents/summa-social/src/components/members-user-permissions-dialog.tsx`
    - `/Users/raulvico/Documents/summa-social/src/app/api/members/user-permissions/route.ts`

- `howto-donor-export`
  - evidence:
    - `/Users/raulvico/Documents/summa-social/src/components/donor-manager.tsx`
    - `/Users/raulvico/Documents/summa-social/docs/manual-usuari-summa-social.md`

- `howto-remittance-create-sepa`
  - evidence:
    - `/Users/raulvico/Documents/summa-social/src/components/sepa-collection/SepaCollectionWizard.tsx`
    - `/Users/raulvico/Documents/summa-social/src/components/sepa-collection/StepConfig.tsx`
    - `/Users/raulvico/Documents/summa-social/src/components/sepa-collection/StepSelection.tsx`
    - `/Users/raulvico/Documents/summa-social/docs/manual-usuari-summa-social.md`

- `howto-remittance-review-before-send`
  - evidence:
    - `/Users/raulvico/Documents/summa-social/src/components/sepa-collection/StepReview.tsx`
    - `/Users/raulvico/Documents/summa-social/src/i18n/locales/ca.json`
    - `/Users/raulvico/Documents/summa-social/docs/manual-usuari-summa-social.md`

- `howto-assign-bank-movement`
  - evidence:
    - `/Users/raulvico/Documents/summa-social/src/components/transactions/components/TransactionRow.tsx`
    - `/Users/raulvico/Documents/summa-social/src/i18n/locales/ca.json`
    - `/Users/raulvico/Documents/summa-social/docs/manual-usuari-summa-social.md`

- `howto-movement-split-amount`
  - evidence:
    - `/Users/raulvico/Documents/summa-social/src/components/transactions/split-amount-dialog.tsx`
    - `/Users/raulvico/Documents/summa-social/src/components/transactions/components/TransactionRow.tsx`
    - `/Users/raulvico/Documents/summa-social/src/components/transactions/components/TransactionRowMobile.tsx`
    - `/Users/raulvico/Documents/summa-social/src/i18n/locales/ca.json`

- `howto-import-safe-duplicates`
  - evidence:
    - `/Users/raulvico/Documents/summa-social/src/components/transaction-importer.tsx`
    - `/Users/raulvico/Documents/summa-social/src/components/dedupe-candidate-resolver.tsx`
    - `/Users/raulvico/Documents/summa-social/src/i18n/locales/ca.json`
    - `/Users/raulvico/Documents/summa-social/docs/FAQ_SUMMA_SOCIAL.md`

- `howto-organization-fiscal-data`
  - evidence:
    - `/Users/raulvico/Documents/summa-social/src/app/[orgSlug]/dashboard/configuracion/page.tsx`
    - `/Users/raulvico/Documents/summa-social/src/components/organization-settings.tsx`
    - `/Users/raulvico/Documents/summa-social/src/i18n/locales/ca.json`
    - `/Users/raulvico/Documents/summa-social/docs/manual-usuari-summa-social.md`

- `howto-movement-unassigned-alerts`
  - evidence:
    - `/Users/raulvico/Documents/summa-social/src/app/[orgSlug]/dashboard/page.tsx`
    - `/Users/raulvico/Documents/summa-social/src/components/transactions/components/TransactionsFilters.tsx`
    - `/Users/raulvico/Documents/summa-social/src/i18n/locales/ca.json`
    - `/Users/raulvico/Documents/summa-social/docs/manual-usuari-summa-social.md`

## notes

- `npm run inicia support-kb-core-coverage` no s'ha pogut completar perquè el repositori ja estava brut abans d'obrir la tasca.
- No s'ha tocat cap peça del motor del bot, retrieval, observabilitat ni API de suport.
