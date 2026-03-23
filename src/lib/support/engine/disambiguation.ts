import type { KBCard } from '../load-kb'
import type { KbLang } from '../bot-retrieval'
import type { ClarifyOption } from './types'

function getCardLabel(card: KBCard, lang: KbLang): string {
  return card.title?.[lang] ?? card.title?.ca ?? card.title?.es ?? card.id
}

export function resolveClarifyChoice(
  message: string,
  clarifyOptionIds: string[],
  cards: KBCard[]
): KBCard | null {
  const normalized = message.trim()
  if (!['1', '2', '3'].includes(normalized)) return null
  if (clarifyOptionIds.length < 2) return null

  const selectedIndex = Number(normalized) - 1
  const selectedId = clarifyOptionIds[selectedIndex]
  if (!selectedId) return null

  const selectedCard = cards.find(c => c.id === selectedId && c.type !== 'fallback')
  return selectedCard ?? null
}

export function buildClarifyAnswer(lang: KbLang, options: KBCard[]): string {
  const intro = lang === 'es'
    ? 'Quiero llevarte al paso correcto sin hacerte perder tiempo. ¿Cuál de estas opciones se parece más a tu caso?'
    : 'Vull portar-te al pas correcte sense fer-te perdre temps. Quina d’aquestes opcions s’assembla més al teu cas?'

  const lines = options.slice(0, 3).map((card, i) => {
    const label = getCardLabel(card, lang)
    const pathHint = card.uiPaths?.[0]
    return pathHint ? `${i + 1}. ${label} (${pathHint})` : `${i + 1}. ${label}`
  })

  const outro = lang === 'es'
    ? 'Respóndeme con "1", "2" o "3". Si ninguna encaja, dime la pantalla exacta o pega el error literal.'
    : 'Respon-me amb "1", "2" o "3". Si cap no encaixa, digues-me la pantalla exacta o enganxa l’error literal.'

  return [intro, ...lines, outro].join('\n')
}

export function buildClarifyOptionsPayload(lang: KbLang, options: KBCard[]): ClarifyOption[] {
  return options.slice(0, 3).map((card, i) => ({
    index: (i + 1) as 1 | 2 | 3,
    cardId: card.id,
    label: getCardLabel(card, lang),
  }))
}
