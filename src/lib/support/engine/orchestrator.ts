import type { KBCard } from '../load-kb'
import type { KbLang } from '../bot-retrieval'
import { buildClarifyAnswer, buildClarifyOptionsPayload } from './disambiguation'
import { isOperationalIntent, normalizeUiPathsAgainstCatalog, SAFE_FALLBACK_PATHS } from './policy'
import { pickTopDisambiguationOptions, resolveRetrieval, type IntentClassifier } from './retrieval'
import { buildEmergencyFallback, renderAnswer } from './renderer'
import type { AssistantTone, OrchestratorResult } from './types'
import type { SupportContext } from '../support-context'

function findFallbackCard(cards: KBCard[]): KBCard | null {
  return cards.find(card => card.id === 'fallback-no-answer')
    ?? cards.find(card => card.type === 'fallback')
    ?? null
}

function isSensitiveDomain(questionDomain: string | undefined, message: string): boolean {
  if (['fiscal', 'sepa', 'remittances', 'returns', 'permissions'].includes(questionDomain ?? '')) {
    return true
  }

  return /\b(devoluc|devolucion|return|retorn|permis|permiso|permisos|acces|acceso|accessos)\b/i.test(message)
}

function buildSpecificCaseFallbackAnswer(lang: KbLang): string {
  return lang === 'es'
    ? 'Esto parece un caso concreto de tus datos.\n\nTe puedo orientar con el procedimiento general desde la guía correcta, pero no diagnosticar este caso concreto desde aquí.\n\nSi sigue sin cuadrar después de revisar el procedimiento general, habrá que revisar el caso concreto.'
    : 'Això sembla un cas concret de les teves dades.\n\nEt puc orientar amb el procediment general des de la guia correcta, però no diagnosticar aquest cas concret des d’aquí.\n\nSi continua sense quadrar després de revisar el procediment general, caldrà revisar el cas concret.'
}

function buildGuidedNavigationAnswer(card: KBCard, lang: KbLang): string {
  const title = card.title?.[lang] ?? card.title?.ca ?? card.title?.es ?? card.id
  return lang === 'es'
    ? `Creo que la mejor ruta para esto es "${title}".\n\nQué hacer ahora:\n1. Abre el destino recomendado.\n2. Sigue ese flujo exacto antes de tocar nada más.\n\nSi no era esto, dime el paso exacto o el mensaje de error y lo afinamos.`
    : `Crec que la millor ruta per a això és "${title}".\n\nQuè fer ara:\n1. Obre el destí recomanat.\n2. Segueix aquest flux exacte abans de tocar res més.\n\nSi no era això, digues-me el pas exacte o el missatge d’error i ho afinarem.`
}

export async function orchestrator(input: {
  message: string
  kbLang: KbLang
  cards: KBCard[]
  clarifyOptionIds: string[]
  supportContext?: SupportContext
  assistantTone: AssistantTone
  allowAiIntent: boolean
  allowAiReformat: boolean
  classifyIntent?: IntentClassifier
  reformat?: (input: {
    userQuestion: string
    rawAnswer: string
    isGuarded: boolean
    isLimited: boolean
    isWarm: boolean
    lang: KbLang
    uiPathHint: string
  }) => Promise<string>
}): Promise<OrchestratorResult> {
  const {
    message,
    kbLang,
    cards,
    clarifyOptionIds,
    supportContext,
    assistantTone,
    allowAiIntent,
    allowAiReformat,
    classifyIntent,
    reformat,
  } = input

  if (cards.length === 0) {
    const emergency = buildEmergencyFallback(kbLang)
    return {
      response: emergency,
      meta: {
        intentType: 'informational',
        confidenceBand: 'low',
        decisionReason: 'no_cards_available',
        questionDomain: 'general',
        specificCaseDetected: false,
        selectedCardId: emergency.cardId,
        usedClarification: false,
        trustedOperationalCard: false,
      },
      selectedCard: null,
      kbLang,
    }
  }

  const intentType = isOperationalIntent(message) ? 'operational' : 'informational'

  let retrievalResult = null
  let selectedByClarify = false

  try {
    const resolution = await resolveRetrieval({
      message,
      lang: kbLang,
      cards,
      clarifyOptionIds,
      supportContext,
      useIntentClassifier: allowAiIntent,
      classifyIntent,
    })
    retrievalResult = resolution.result
    selectedByClarify = resolution.selectedByClarify
  } catch (error) {
    console.error('[bot] retrieve error:', error)
  }

  if (retrievalResult?.clarifyOptions?.length) {
    const options = retrievalResult.clarifyOptions.slice(0, 3)
    const clarifyUiPaths = normalizeUiPathsAgainstCatalog(
      options.flatMap(option => option.uiPaths ?? [])
    )
    const sensitiveClarify = intentType === 'operational' && isSensitiveDomain(retrievalResult.questionDomain, message)
    return {
      response: {
        ok: true,
        mode: 'fallback',
        cardId: 'clarify-disambiguation',
        answer: buildClarifyAnswer(kbLang, options),
        guideId: null,
        uiPaths: clarifyUiPaths.length > 0 ? clarifyUiPaths : SAFE_FALLBACK_PATHS[kbLang],
        clarifyOptions: buildClarifyOptionsPayload(kbLang, options),
      },
      meta: {
        intentType,
        retrievalConfidence: retrievalResult.confidence,
        confidenceBand: retrievalResult.confidenceBand ?? retrievalResult.confidence,
        bestCardId: retrievalResult.bestCardId,
        bestScore: retrievalResult.bestScore,
        secondCardId: retrievalResult.secondCardId,
        secondScore: retrievalResult.secondScore,
        decisionReason: sensitiveClarify
          ? 'sensitive_domain_guardrail'
          : retrievalResult.decisionReason ?? 'medium_confidence_disambiguation',
        specificCaseDetected: retrievalResult.specificCaseDetected ?? false,
        questionDomain: retrievalResult.questionDomain,
        selectedCardId: 'clarify-disambiguation',
        usedClarification: true,
        trustedOperationalCard: false,
      },
      selectedCard: null,
      kbLang,
    }
  }

  const fallbackCard = findFallbackCard(cards)
  const selectedCard = retrievalResult?.card ?? fallbackCard

  if (!selectedCard) {
    const emergency = buildEmergencyFallback(kbLang)
    return {
      response: emergency,
      meta: {
        intentType,
        retrievalConfidence: retrievalResult?.confidence,
        confidenceBand: retrievalResult?.confidenceBand ?? retrievalResult?.confidence,
        bestCardId: retrievalResult?.bestCardId,
        bestScore: retrievalResult?.bestScore,
        secondCardId: retrievalResult?.secondCardId,
        secondScore: retrievalResult?.secondScore,
        decisionReason: retrievalResult?.decisionReason ?? 'no_selected_card',
        specificCaseDetected: retrievalResult?.specificCaseDetected ?? false,
        questionDomain: retrievalResult?.questionDomain,
        selectedCardId: emergency.cardId,
        usedClarification: false,
        trustedOperationalCard: false,
      },
      selectedCard: null,
      kbLang,
    }
  }

  if (retrievalResult?.specificCaseDetected) {
    const selectedFallback = retrievalResult.mode === 'fallback' && retrievalResult.card?.type === 'fallback'
      ? retrievalResult.card
      : null
    const shouldKeepSelectedFallback = selectedFallback && selectedFallback.id !== 'fallback-no-answer'

    if (shouldKeepSelectedFallback && selectedFallback) {
      return {
        response: {
          ok: true,
          mode: 'fallback',
          cardId: selectedFallback.id,
          answer: selectedFallback.answer?.[kbLang] ?? selectedFallback.answer?.ca ?? selectedFallback.answer?.es ?? buildSpecificCaseFallbackAnswer(kbLang),
          guideId: null,
          uiPaths: selectedFallback.uiPaths?.length ? normalizeUiPathsAgainstCatalog(selectedFallback.uiPaths) : SAFE_FALLBACK_PATHS[kbLang],
        },
        meta: {
          intentType,
          retrievalConfidence: retrievalResult?.confidence,
          confidenceBand: retrievalResult?.confidenceBand ?? retrievalResult?.confidence,
          bestCardId: retrievalResult?.bestCardId,
          bestScore: retrievalResult?.bestScore,
          secondCardId: retrievalResult?.secondCardId,
          secondScore: retrievalResult?.secondScore,
          decisionReason: retrievalResult?.decisionReason ?? 'specific_case_guardrail',
          specificCaseDetected: true,
          questionDomain: retrievalResult?.questionDomain,
          selectedCardId: selectedFallback.id,
          usedClarification: false,
          trustedOperationalCard: false,
        },
        selectedCard: null,
        kbLang,
      }
    }

    const specificFallback = findFallbackCard(cards)
    const cardId = specificFallback?.id ?? 'fallback-no-answer'
    return {
      response: {
        ok: true,
        mode: 'fallback',
        cardId,
        answer: buildSpecificCaseFallbackAnswer(kbLang),
        guideId: null,
        uiPaths: specificFallback?.uiPaths?.length ? normalizeUiPathsAgainstCatalog(specificFallback.uiPaths) : SAFE_FALLBACK_PATHS[kbLang],
      },
      meta: {
        intentType,
        retrievalConfidence: retrievalResult?.confidence,
        confidenceBand: retrievalResult?.confidenceBand ?? retrievalResult?.confidence,
        bestCardId: retrievalResult?.bestCardId,
        bestScore: retrievalResult?.bestScore,
        secondCardId: retrievalResult?.secondCardId,
        secondScore: retrievalResult?.secondScore,
        decisionReason: 'specific_case_guardrail',
        specificCaseDetected: true,
        questionDomain: retrievalResult?.questionDomain,
        selectedCardId: cardId,
        usedClarification: false,
        trustedOperationalCard: false,
      },
      selectedCard: null,
      kbLang,
    }
  }

  // P0 strict guardrail:
  // If intent is operational and confidence is not sufficient, only guided disambiguation or safe fallback.
  const confidenceBand = retrievalResult?.confidenceBand ?? retrievalResult?.confidence ?? 'low'
  const sensitiveQuery = isSensitiveDomain(retrievalResult?.questionDomain, message)

  if (intentType === 'operational' && confidenceBand !== 'high') {
    if (!sensitiveQuery && confidenceBand === 'medium' && selectedCard.type !== 'fallback') {
      const guidedUiPaths = normalizeUiPathsAgainstCatalog(selectedCard.uiPaths)
      return {
        response: {
          ok: true,
          mode: 'card',
          cardId: selectedCard.id,
          answer: buildGuidedNavigationAnswer(selectedCard, kbLang),
          guideId: selectedCard.guideId ?? null,
          uiPaths: guidedUiPaths.length > 0 ? guidedUiPaths.slice(0, 1) : SAFE_FALLBACK_PATHS[kbLang].slice(0, 1),
        },
        meta: {
          intentType,
          retrievalConfidence: retrievalResult?.confidence,
          confidenceBand,
          bestCardId: retrievalResult?.bestCardId,
          bestScore: retrievalResult?.bestScore,
          secondCardId: retrievalResult?.secondCardId,
          secondScore: retrievalResult?.secondScore,
          decisionReason: 'operational_medium_navigation',
          specificCaseDetected: retrievalResult?.specificCaseDetected ?? false,
          questionDomain: retrievalResult?.questionDomain,
          selectedCardId: selectedCard.id,
          usedClarification: false,
          trustedOperationalCard: false,
        },
        selectedCard: null,
        kbLang,
      }
    }

    const options = pickTopDisambiguationOptions(cards, retrievalResult)
    if (confidenceBand === 'medium' && options.length >= 2) {
      const clarifyUiPaths = normalizeUiPathsAgainstCatalog(
        options.flatMap(option => option.uiPaths ?? [])
      )
      return {
        response: {
          ok: true,
          mode: 'fallback',
          cardId: 'clarify-disambiguation',
          answer: buildClarifyAnswer(kbLang, options),
          guideId: null,
          uiPaths: clarifyUiPaths.length > 0 ? clarifyUiPaths : SAFE_FALLBACK_PATHS[kbLang],
          clarifyOptions: buildClarifyOptionsPayload(kbLang, options),
        },
        meta: {
          intentType,
          retrievalConfidence: retrievalResult?.confidence,
          confidenceBand,
          bestCardId: retrievalResult?.bestCardId,
          bestScore: retrievalResult?.bestScore,
          secondCardId: retrievalResult?.secondCardId,
          secondScore: retrievalResult?.secondScore,
          decisionReason: sensitiveQuery
            ? 'sensitive_domain_guardrail'
            : 'operational_medium_disambiguation',
          specificCaseDetected: retrievalResult?.specificCaseDetected ?? false,
          questionDomain: retrievalResult?.questionDomain,
          selectedCardId: 'clarify-disambiguation',
          usedClarification: true,
          trustedOperationalCard: false,
        },
        selectedCard: null,
        kbLang,
      }
    }

    const fallbackCard = findFallbackCard(cards)
    const fallbackCardId = fallbackCard?.id ?? 'fallback-no-answer'
    return {
      response: {
        ok: true,
        mode: 'fallback',
        cardId: fallbackCardId,
        answer: fallbackCard
          ? (fallbackCard.answer?.[kbLang] ?? fallbackCard.answer?.ca ?? fallbackCard.answer?.es ?? buildEmergencyFallback(kbLang).answer)
          : buildEmergencyFallback(kbLang).answer,
        guideId: null,
        uiPaths: fallbackCard?.uiPaths?.length ? normalizeUiPathsAgainstCatalog(fallbackCard.uiPaths) : SAFE_FALLBACK_PATHS[kbLang],
      },
      meta: {
        intentType,
        retrievalConfidence: retrievalResult?.confidence,
        confidenceBand,
        bestCardId: retrievalResult?.bestCardId,
        bestScore: retrievalResult?.bestScore,
        secondCardId: retrievalResult?.secondCardId,
        secondScore: retrievalResult?.secondScore,
        decisionReason: sensitiveQuery
          ? 'sensitive_domain_guardrail'
          : confidenceBand === 'medium'
            ? 'operational_medium_fallback'
            : 'operational_low_fallback',
        specificCaseDetected: retrievalResult?.specificCaseDetected ?? false,
        questionDomain: retrievalResult?.questionDomain,
        selectedCardId: fallbackCardId,
        usedClarification: false,
        trustedOperationalCard: false,
      },
      selectedCard: null,
      kbLang,
    }
  }

  const mode: 'card' | 'fallback' = retrievalResult?.mode ?? 'fallback'

  const rendered = await renderAnswer({
    message,
    kbLang,
    card: selectedCard,
    mode,
    intentType,
    assistantTone,
    allowAiReformat,
    reformat,
  })

  return {
    response: {
      ok: true,
      mode,
      cardId: rendered.card.id,
      answer: rendered.answer,
      guideId: rendered.card.guideId ?? null,
      uiPaths: rendered.uiPaths,
    },
    meta: {
      intentType,
      retrievalConfidence: retrievalResult?.confidence,
      confidenceBand,
      bestCardId: retrievalResult?.bestCardId,
      bestScore: retrievalResult?.bestScore,
      secondCardId: retrievalResult?.secondCardId,
      secondScore: retrievalResult?.secondScore,
      decisionReason: retrievalResult?.decisionReason ?? 'high_confidence_match',
      specificCaseDetected: retrievalResult?.specificCaseDetected ?? false,
      questionDomain: retrievalResult?.questionDomain,
      selectedCardId: rendered.card.id,
      usedClarification: selectedByClarify,
      trustedOperationalCard: rendered.trustedOperationalCard,
    },
    selectedCard: rendered.card,
    kbLang,
  }
}
