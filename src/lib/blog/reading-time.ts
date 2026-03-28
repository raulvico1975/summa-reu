import type { PublicLocale } from '@/lib/public-locale'

export function estimateBlogReadingTimeMinutes(contentHtml: string): number {
  const plainText = contentHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const wordCount = plainText ? plainText.split(' ').length : 0

  return Math.max(3, Math.round(wordCount / 180))
}

export function formatBlogReadingTime(
  minutes: number,
  locale: PublicLocale
): string {
  switch (locale) {
    case 'es':
      return `${minutes} min de lectura`
    case 'fr':
      return `${minutes} min de lecture`
    case 'pt':
      return `${minutes} min de leitura`
    case 'ca':
    default:
      return `${minutes} min de lectura`
  }
}
