import type { KBCard } from '../load-kb'
import { retrieveCard, type KbLang, type RetrievalResult } from '../bot-retrieval'
import { resolveClarifyChoice } from './disambiguation'

export type IntentClassifier = (input: {
  message: string
  lang: KbLang
  cards: KBCard[]
}) => Promise<{ card: KBCard; confidence: 'high' | 'medium' | 'low' } | null>

export type RetrievalResolution = {
  result: RetrievalResult | null
  selectedByClarify: boolean
}

export async function resolveRetrieval(input: {
  message: string
  lang: KbLang
  cards: KBCard[]
  clarifyOptionIds: string[]
  useIntentClassifier: boolean
  classifyIntent?: IntentClassifier
}): Promise<RetrievalResolution> {
  const { message, lang, cards, clarifyOptionIds, useIntentClassifier, classifyIntent } = input

  let result: RetrievalResult | null = null
  let selectedByClarify = false

  const selectedCard = resolveClarifyChoice(message, clarifyOptionIds, cards)
  if (selectedCard) {
    result = {
      card: selectedCard,
      mode: 'card',
      bestCardId: selectedCard.id,
      bestScore: 100,
      confidence: 'high',
      confidenceBand: 'high',
      decisionReason: 'clarify_selection',
      specificCaseDetected: false,
      questionDomain: 'general',
    }
    selectedByClarify = true
  } else {
    result = retrieveCard(message, lang, cards)
  }

  if (
    useIntentClassifier &&
    classifyIntent &&
    cards.length > 0 &&
    (!result || result.mode === 'fallback' || result.confidence === 'low')
  ) {
    try {
      const aiIntent = await classifyIntent({ message, lang, cards })
      if (aiIntent?.card) {
        result = {
          card: aiIntent.card,
          mode: 'card',
          bestCardId: aiIntent.card.id,
          bestScore: Math.max(result?.bestScore ?? 0, 60),
          secondCardId: result?.bestCardId,
          secondScore: result?.bestScore ?? 0,
          confidence: aiIntent.confidence,
          confidenceBand: aiIntent.confidence,
          decisionReason: aiIntent.confidence === 'high' ? 'ai_intent_high_confidence' : 'ai_intent_medium_confidence',
          specificCaseDetected: result?.specificCaseDetected ?? false,
          questionDomain: result?.questionDomain,
        }
      }
    } catch (error) {
      console.warn('[bot] intent classifier failed, keeping retrieval result:', (error as Error)?.message)
    }
  }

  return { result, selectedByClarify }
}

export function pickTopDisambiguationOptions(
  cards: KBCard[],
  result: RetrievalResult | null
): KBCard[] {
  if (!result) return []

  const fromClarify = (result.clarifyOptions ?? []).filter(card => card.type !== 'fallback')
  if (fromClarify.length >= 2) return fromClarify.slice(0, 3)

  const candidateIds = [result.bestCardId, result.secondCardId].filter(Boolean) as string[]
  const dedup = Array.from(new Set(candidateIds))

  const candidates = dedup
    .map(id => cards.find(card => card.id === id && card.type !== 'fallback'))
    .filter((card): card is KBCard => Boolean(card))

  return candidates.slice(0, 3)
}

export function isConfidenceSufficient(confidence: RetrievalResult['confidence']): boolean {
  return confidence === 'high' || confidence === 'medium'
}
