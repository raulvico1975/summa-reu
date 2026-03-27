import type { PublicLocale } from '@/lib/public-locale'

const CATEGORY_LABELS: Record<PublicLocale, Record<string, string>> = {
  ca: {
    'criteri-operatiu': 'Gestió econòmica',
    fiscal: 'Fiscalitat',
    operativa: 'Operativa',
  },
  es: {
    'criteri-operatiu': 'Gestión económica',
    fiscal: 'Fiscalidad',
    operativa: 'Operativa',
  },
  fr: {
    'criteri-operatiu': 'Gestion économique',
    fiscal: 'Fiscalité',
    operativa: 'Opérations',
  },
  pt: {
    'criteri-operatiu': 'Gestão econômica',
    fiscal: 'Fiscalidade',
    operativa: 'Operativa',
  },
}

export function getBlogCategoryLabel(
  category: string,
  locale: PublicLocale = 'ca'
): string {
  return CATEGORY_LABELS[locale][category] ?? CATEGORY_LABELS.ca[category] ?? category
}
