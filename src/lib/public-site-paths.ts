import type { PublicLocale } from '@/lib/public-locale'

export function getPublicFeaturesHref(locale: PublicLocale) {
  switch (locale) {
    case 'fr':
      return `/${locale}/fonctionnalites`
    case 'pt':
      return `/${locale}/funcionalidades`
    default:
      return `/${locale}/funcionalitats`
  }
}

export function getPublicPricingHref(locale: PublicLocale) {
  return `/${locale}/preus`
}

export function getPublicDetailedGuidesLocale(locale: PublicLocale): 'ca' | 'es' {
  return locale === 'ca' ? 'ca' : 'es'
}

export type PublicHomeFeatureBlockKey =
  | 'conciliation'
  | 'donorsMembers'
  | 'payments'
  | 'fiscal'
  | 'projects'
  | 'control'

const PUBLIC_HOME_FEATURE_BLOCK_SLUGS: Record<PublicHomeFeatureBlockKey, string> = {
  conciliation: 'conciliacio-bancaria-ong',
  donorsMembers: 'gestio-donants',
  payments: 'remeses-sepa',
  fiscal: 'model-182',
  projects: 'gestio-projectes-justificacio',
  control: 'control-visibilitat-entitats',
}

const PUBLIC_HOME_FEATURE_CARD_SLUGS: Record<string, string> = {
  'conciliation.importStatements': 'importar-extracte-bancari',
  'conciliation.autoClassification': 'conciliacio-bancaria-ong',
  'conciliation.contactAssignment': 'conciliacio-bancaria-ong',
  'conciliation.multiBankAccount': 'conciliacio-bancaria-ong',
  'donorsMembers.donorProfile': 'gestio-donants',
  'donorsMembers.bulkImport': 'gestio-donants',
  'donorsMembers.donorHistory': 'gestio-donants',
  'donorsMembers.operationalStatus': 'gestio-donants',
  'payments.remittanceSplitter': 'remeses-sepa',
  'payments.bankReturns': 'devolucions-rebuts-socis',
  'payments.sepaPayments': 'remeses-sepa',
  'payments.stripeDonations': 'control-donacions-ong',
  'fiscal.model182': 'model-182',
  'fiscal.model347': 'model-347-ong',
  'fiscal.donationCertificates': 'certificats-donacio',
  'fiscal.cleanExcel': 'model-347-ong',
  'projects.budgetLines': 'gestio-projectes-justificacio',
  'projects.expenseAssignment': 'gestio-projectes-justificacio',
  'projects.fieldCapture': 'gestio-projectes-justificacio',
  'projects.funderExport': 'gestio-projectes-justificacio',
  'control.dashboard': 'control-visibilitat-entitats',
  'control.boardReport': 'control-visibilitat-entitats',
  'control.dataExport': 'control-visibilitat-entitats',
}

export function getPublicHomeFeatureHref(
  locale: PublicLocale,
  blockKey: PublicHomeFeatureBlockKey,
  cardId?: string
) {
  const detailLocale = getPublicDetailedGuidesLocale(locale)
  const slug = (cardId ? PUBLIC_HOME_FEATURE_CARD_SLUGS[cardId] : undefined)
    ?? PUBLIC_HOME_FEATURE_BLOCK_SLUGS[blockKey]

  return `/${detailLocale}/${slug}`
}

export function getPublicEconomicGuideHref(locale: PublicLocale) {
  const guideLocale = getPublicDetailedGuidesLocale(locale)
  return `/${guideLocale}/gestio-economica-ong`
}

export function hasPublicDetailedGuides(locale: PublicLocale) {
  return ['ca', 'es', 'fr', 'pt'].includes(locale)
}
