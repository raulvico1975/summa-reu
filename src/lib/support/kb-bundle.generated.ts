/**
 * AUTO-GENERATED FILE.
 *
 * Bundles support KB cards and locales into the server build so runtime
 * does not depend on repository filesystem paths inside App Hosting.
 */

import type { KBCard } from './load-kb'
import fallbacksRaw from '../../../docs/kb/_fallbacks.json'
import card0Raw from '../../../docs/kb/cards/guides/guide-access-security.json'
import card1Raw from '../../../docs/kb/cards/guides/guide-attach-document.json'
import card2Raw from '../../../docs/kb/cards/guides/guide-bulk-ai-categorize.json'
import card3Raw from '../../../docs/kb/cards/guides/guide-bulk-categorize.json'
import card4Raw from '../../../docs/kb/cards/guides/guide-change-language.json'
import card5Raw from '../../../docs/kb/cards/guides/guide-change-period.json'
import card6Raw from '../../../docs/kb/cards/guides/guide-danger-delete-remittance.json'
import card7Raw from '../../../docs/kb/cards/guides/guide-donor-certificate.json'
import card8Raw from '../../../docs/kb/cards/guides/guide-donor-inactive.json'
import card9Raw from '../../../docs/kb/cards/guides/guide-donor-reactivate.json'
import card10Raw from '../../../docs/kb/cards/guides/guide-donors.json'
import card11Raw from '../../../docs/kb/cards/guides/guide-edit-movement.json'
import card12Raw from '../../../docs/kb/cards/guides/guide-first-day.json'
import card13Raw from '../../../docs/kb/cards/guides/guide-first-month.json'
import card14Raw from '../../../docs/kb/cards/guides/guide-import-donors.json'
import card15Raw from '../../../docs/kb/cards/guides/guide-import-movements.json'
import card16Raw from '../../../docs/kb/cards/guides/guide-initial-load.json'
import card17Raw from '../../../docs/kb/cards/guides/guide-model-182-generate.json'
import card18Raw from '../../../docs/kb/cards/guides/guide-model-182.json'
import card19Raw from '../../../docs/kb/cards/guides/guide-model-347.json'
import card20Raw from '../../../docs/kb/cards/guides/guide-month-close.json'
import card21Raw from '../../../docs/kb/cards/guides/guide-monthly-flow.json'
import card22Raw from '../../../docs/kb/cards/guides/guide-movement-filters.json'
import card23Raw from '../../../docs/kb/cards/guides/guide-movements.json'
import card24Raw from '../../../docs/kb/cards/guides/guide-projects.json'
import card25Raw from '../../../docs/kb/cards/guides/guide-remittance-low-members.json'
import card26Raw from '../../../docs/kb/cards/guides/guide-remittances.json'
import card27Raw from '../../../docs/kb/cards/guides/guide-reports.json'
import card28Raw from '../../../docs/kb/cards/guides/guide-reset-password.json'
import card29Raw from '../../../docs/kb/cards/guides/guide-returns.json'
import card30Raw from '../../../docs/kb/cards/guides/guide-select-bank-account.json'
import card31Raw from '../../../docs/kb/cards/guides/guide-split-remittance.json'
import card32Raw from '../../../docs/kb/cards/guides/guide-stripe-donations.json'
import card33Raw from '../../../docs/kb/cards/guides/guide-travel-receipts.json'
import card34Raw from '../../../docs/kb/cards/guides/guide-update-donors.json'
import card35Raw from '../../../docs/kb/cards/guides/guide-year-end-fiscal.json'
import card36Raw from '../../../docs/kb/cards/guides/project-open.json'
import card37Raw from '../../../docs/kb/cards/howto/howto-assign-bank-movement.json'
import card38Raw from '../../../docs/kb/cards/howto/howto-dashboard-income-period.json'
import card39Raw from '../../../docs/kb/cards/howto/howto-donor-default-category.json'
import card40Raw from '../../../docs/kb/cards/howto/howto-donor-edit.json'
import card41Raw from '../../../docs/kb/cards/howto/howto-donor-export.json'
import card42Raw from '../../../docs/kb/cards/howto/howto-donor-fiscal-review.json'
import card43Raw from '../../../docs/kb/cards/howto/howto-donor-history-summary.json'
import card44Raw from '../../../docs/kb/cards/howto/howto-donor-update-details.json'
import card45Raw from '../../../docs/kb/cards/howto/howto-donor-update-fee.json'
import card46Raw from '../../../docs/kb/cards/howto/howto-donor-update-iban.json'
import card47Raw from '../../../docs/kb/cards/howto/howto-enter-expense.json'
import card48Raw from '../../../docs/kb/cards/howto/howto-import-bank-returns.json'
import card49Raw from '../../../docs/kb/cards/howto/howto-import-safe-duplicates.json'
import card50Raw from '../../../docs/kb/cards/howto/howto-member-create.json'
import card51Raw from '../../../docs/kb/cards/howto/howto-member-invite.json'
import card52Raw from '../../../docs/kb/cards/howto/howto-member-user-permissions.json'
import card53Raw from '../../../docs/kb/cards/howto/howto-movement-split-amount.json'
import card54Raw from '../../../docs/kb/cards/howto/howto-movement-unassigned-alerts.json'
import card55Raw from '../../../docs/kb/cards/howto/howto-organization-fiscal-data.json'
import card56Raw from '../../../docs/kb/cards/howto/howto-remittance-create-sepa.json'
import card57Raw from '../../../docs/kb/cards/howto/howto-remittance-review-before-send.json'
import card58Raw from '../../../docs/kb/cards/howto/howto-remittance-undo.json'
import card59Raw from '../../../docs/kb/cards/manual/manual-change-logo.json'
import card60Raw from '../../../docs/kb/cards/manual/manual-closing-package.json'
import card61Raw from '../../../docs/kb/cards/manual/manual-common-errors.json'
import card62Raw from '../../../docs/kb/cards/manual/manual-danger-zone.json'
import card63Raw from '../../../docs/kb/cards/manual/manual-dashboard-other-income.json'
import card64Raw from '../../../docs/kb/cards/manual/manual-dashboard-terrain.json'
import card65Raw from '../../../docs/kb/cards/manual/manual-guides-hub.json'
import card66Raw from '../../../docs/kb/cards/manual/manual-internal-transfer.json'
import card67Raw from '../../../docs/kb/cards/manual/manual-login-access.json'
import card68Raw from '../../../docs/kb/cards/manual/manual-member-paid-quotas.json'
import card69Raw from '../../../docs/kb/cards/manual/manual-menu-sections.json'
import card70Raw from '../../../docs/kb/cards/manual/manual-movement-no-contact.json'
import card71Raw from '../../../docs/kb/cards/manual/manual-multi-organization.json'
import card72Raw from '../../../docs/kb/cards/manual/manual-product-updates.json'
import card73Raw from '../../../docs/kb/cards/manual/manual-project-expenses-filtered-feed.json'
import card74Raw from '../../../docs/kb/cards/manual/manual-sepa-out-reconcile.json'
import card75Raw from '../../../docs/kb/cards/manual/manual-signature-setup.json'
import card76Raw from '../../../docs/kb/cards/manual/manual-stripe-best-practices.json'
import card77Raw from '../../../docs/kb/cards/troubleshooting/ts-blocked-by-project-links.json'
import card78Raw from '../../../docs/kb/cards/troubleshooting/ts-donor-incomplete-data.json'
import card79Raw from '../../../docs/kb/cards/troubleshooting/ts-import-invalid-format.json'
import card80Raw from '../../../docs/kb/cards/troubleshooting/ts-import-missing-columns.json'
import card81Raw from '../../../docs/kb/cards/troubleshooting/ts-import-overlap.json'
import card82Raw from '../../../docs/kb/cards/troubleshooting/ts-model-182-donor-missing.json'
import card83Raw from '../../../docs/kb/cards/troubleshooting/ts-offline-error.json'
import card84Raw from '../../../docs/kb/cards/troubleshooting/ts-remittance-member-not-identified.json'
import card85Raw from '../../../docs/kb/cards/troubleshooting/ts-remittance-not-matching.json'
import card86Raw from '../../../docs/kb/cards/troubleshooting/ts-sepa-validation-error.json'
import card87Raw from '../../../docs/kb/cards/howto/howto-mark-donation-182.json'
import card88Raw from '../../../docs/kb/cards/manual/manual-mobile-usage.json'
import card89Raw from '../../../docs/kb/cards/troubleshooting/ts-slow-app.json'
import card90Raw from '../../../docs/kb/cards/howto/howto-donor-pause-fee.json'
import card91Raw from '../../../docs/kb/cards/howto/howto-company-contact-person.json'
import card92Raw from '../../../docs/kb/cards/howto/howto-project-budget-import.json'
import card93Raw from '../../../docs/kb/cards/manual/manual-access-email.json'
import card94Raw from '../../../docs/kb/cards/manual/manual-closed-tab.json'
import caLocaleRaw from '../../i18n/locales/ca.json'
import esLocaleRaw from '../../i18n/locales/es.json'

export const bundledFallbackCards = fallbacksRaw as KBCard[]

export const bundledCardFiles = [
  card0Raw as KBCard,
  card1Raw as KBCard,
  card2Raw as KBCard,
  card3Raw as KBCard,
  card4Raw as KBCard,
  card5Raw as KBCard,
  card6Raw as KBCard,
  card7Raw as KBCard,
  card8Raw as KBCard,
  card9Raw as KBCard,
  card10Raw as KBCard,
  card11Raw as KBCard,
  card12Raw as KBCard,
  card13Raw as KBCard,
  card14Raw as KBCard,
  card15Raw as KBCard,
  card16Raw as KBCard,
  card17Raw as KBCard,
  card18Raw as KBCard,
  card19Raw as KBCard,
  card20Raw as KBCard,
  card21Raw as KBCard,
  card22Raw as KBCard,
  card23Raw as KBCard,
  card24Raw as KBCard,
  card25Raw as KBCard,
  card26Raw as KBCard,
  card27Raw as KBCard,
  card28Raw as KBCard,
  card29Raw as KBCard,
  card30Raw as KBCard,
  card31Raw as KBCard,
  card32Raw as KBCard,
  card33Raw as KBCard,
  card34Raw as KBCard,
  card35Raw as KBCard,
  card36Raw as KBCard,
  card37Raw as KBCard,
  card38Raw as KBCard,
  card39Raw as KBCard,
  card40Raw as KBCard,
  card41Raw as KBCard,
  card42Raw as KBCard,
  card43Raw as KBCard,
  card44Raw as KBCard,
  card45Raw as KBCard,
  card46Raw as KBCard,
  card47Raw as KBCard,
  card48Raw as KBCard,
  card49Raw as KBCard,
  card50Raw as KBCard,
  card51Raw as KBCard,
  card52Raw as KBCard,
  card53Raw as KBCard,
  card54Raw as KBCard,
  card55Raw as KBCard,
  card56Raw as KBCard,
  card57Raw as KBCard,
  card58Raw as KBCard,
  card59Raw as KBCard,
  card60Raw as KBCard,
  card61Raw as KBCard,
  card62Raw as KBCard,
  card63Raw as KBCard,
  card64Raw as KBCard,
  card65Raw as KBCard,
  card66Raw as KBCard,
  card67Raw as KBCard,
  card68Raw as KBCard,
  card69Raw as KBCard,
  card70Raw as KBCard,
  card71Raw as KBCard,
  card72Raw as KBCard,
  card73Raw as KBCard,
  card74Raw as KBCard,
  card75Raw as KBCard,
  card76Raw as KBCard,
  card77Raw as KBCard,
  card78Raw as KBCard,
  card79Raw as KBCard,
  card80Raw as KBCard,
  card81Raw as KBCard,
  card82Raw as KBCard,
  card83Raw as KBCard,
  card84Raw as KBCard,
  card85Raw as KBCard,
  card86Raw as KBCard,
  card87Raw as KBCard,
  card88Raw as KBCard,
  card89Raw as KBCard,
  card90Raw as KBCard,
  card91Raw as KBCard,
  card92Raw as KBCard,
  card93Raw as KBCard,
  card94Raw as KBCard,
]

export const bundledAllCards: KBCard[] = [
  ...bundledFallbackCards,
  ...bundledCardFiles,
]

export const bundledI18n: Record<string, Record<string, string>> = {
  ca: caLocaleRaw as Record<string, string>,
  es: esLocaleRaw as Record<string, string>,
}

export const bundledCardIds = new Set(bundledAllCards.map(card => card.id))
