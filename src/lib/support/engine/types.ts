import type { KBCard } from '../load-kb'
import type { KbLang, RetrievalConfidence } from '../bot-retrieval'

export type InputLang = 'ca' | 'es' | 'fr' | 'pt'
export type AssistantTone = 'neutral' | 'warm'
export type IntentType = 'operational' | 'informational'
export type CardSource = 'validated-kb' | 'bundled-failsafe' | 'runtime-fallback'
export type ResponseSubtype = 'full_verified_answer' | 'guided_navigation' | 'clarify' | 'fallback'

export type ClarifyOption = {
  index: 1 | 2 | 3
  cardId: string
  label: string
}

export type RelatedSuggestion = {
  cardId: string
  label: string
  question: string
}

export type SuccessResponse = {
  ok: true
  mode: 'card' | 'fallback'
  responseSubtype?: ResponseSubtype
  cardId: string
  answer: string
  guideId: string | null
  uiPaths: string[]
  language?: InputLang
  clarifyOptions?: ClarifyOption[]
  relatedSuggestions?: RelatedSuggestion[]
}

export type ErrorResponse = {
  ok: false
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_INPUT' | 'QUOTA_EXCEEDED' | 'RATE_LIMITED' | 'TRANSIENT' | 'AI_ERROR'
  message: string
}

export type ApiResponse = SuccessResponse | ErrorResponse

export type EngineCard = KBCard & {
  source: CardSource
  uiPathsAllowed: string[]
  steps: string[]
}

export type OrchestratorMeta = {
  intentType: IntentType
  retrievalConfidence?: RetrievalConfidence
  confidenceBand?: RetrievalConfidence
  responseSubtype?: ResponseSubtype
  bestCardId?: string
  bestScore?: number
  secondCardId?: string
  secondScore?: number
  decisionReason?: string
  specificCaseDetected?: boolean
  questionDomain?: string
  intentDetected?: string
  intentConfidence?: number
  intentReason?: string
  retrievalDomain?: string
  candidateCardIds?: string[]
  candidateScores?: number[]
  candidateReasons?: string[]
  selectedCardId: string
  usedClarification: boolean
  trustedOperationalCard: boolean
}

export type OrchestratorResult = {
  response: SuccessResponse
  meta: OrchestratorMeta
  selectedCard: EngineCard | null
  kbLang: KbLang
}
