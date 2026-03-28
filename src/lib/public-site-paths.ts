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

export function getPublicDetailedGuidesLocale(locale: PublicLocale): 'ca' | 'es' {
  return locale === 'ca' ? 'ca' : 'es'
}

export function getPublicEconomicGuideHref(locale: PublicLocale) {
  const guideLocale = getPublicDetailedGuidesLocale(locale)
  return `/${guideLocale}/gestio-economica-ong`
}

export function hasPublicDetailedGuides(locale: PublicLocale) {
  return ['ca', 'es', 'fr', 'pt'].includes(locale)
}
