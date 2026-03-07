import test from 'node:test'
import assert from 'node:assert/strict'
import { loadAllCards, type KBCard } from '../support/load-kb'
import { orchestrator } from '../support/engine/orchestrator'
import { containsProceduralFreeform } from '../support/engine/policy'
import { renderAnswer } from '../support/engine/renderer'

const cards = loadAllCards()

test('orchestrator blocks free-form procedural fallback for unresolved operational query', async () => {
  const result = await orchestrator({
    message: 'com faig blablabla qwerty asdfgh zzzz',
    kbLang: 'ca',
    cards,
    clarifyOptionIds: [],
    assistantTone: 'neutral',
    allowAiIntent: false,
    allowAiReformat: false,
  })

  assert.equal(result.meta.intentType, 'operational')
  assert.equal(result.response.mode, 'fallback')
  assert.equal(containsProceduralFreeform(result.response.answer), false)
})

test('orchestrator keeps operational card answer for trusted guide card', async () => {
  const result = await orchestrator({
    message: 'com pujo una factura o rebut o nòmina?',
    kbLang: 'ca',
    cards,
    clarifyOptionIds: [],
    assistantTone: 'neutral',
    allowAiIntent: false,
    allowAiReformat: false,
  })

  assert.equal(result.response.mode, 'card')
  assert.equal(result.response.cardId, 'guide-attach-document')
  assert.equal(result.meta.trustedOperationalCard, true)
  assert.match(result.response.answer, /\n1\.\s+/)
})

test('renderer refuses generic procedural guide content when steps are missing', async () => {
  const brokenGuideCard: KBCard = {
    id: 'guide-missing-content',
    type: 'howto',
    domain: 'general',
    risk: 'safe',
    guardrail: 'none',
    answerMode: 'full',
    title: { ca: 'Guia trencada', es: 'Guía rota' },
    intents: { ca: ['prova trencada'], es: ['prueba rota'] },
    guideId: 'missingGuideId',
    answer: null,
    uiPaths: ['Moviments > Prova'],
    needsSnapshot: false,
    keywords: [],
    related: [],
    error_key: null,
    symptom: { ca: null, es: null },
  }

  const rendered = await renderAnswer({
    message: 'com faig aquesta prova?',
    kbLang: 'ca',
    card: brokenGuideCard,
    mode: 'card',
    intentType: 'operational',
    assistantTone: 'neutral',
    allowAiReformat: false,
  })

  assert.equal(rendered.trustedOperationalCard, false)
  assert.equal(containsProceduralFreeform(rendered.answer), false)
  assert.ok(rendered.uiPaths.length > 0)
})

test('renderer keeps all operational steps for trusted project-open card in ES', async () => {
  const card = cards.find(item => item.id === 'project-open')
  assert.ok(card, 'project-open card must exist in KB')

  const rendered = await renderAnswer({
    message: 'como abro un proyecto?',
    kbLang: 'es',
    card,
    mode: 'card',
    intentType: 'operational',
    assistantTone: 'warm',
    allowAiReformat: false,
  })

  assert.equal(rendered.trustedOperationalCard, true)
  assert.match(rendered.answer, /\n1\.\s+Ve a Dashboard/)
  assert.match(rendered.answer, /\n3\.\s+Haz clic en el proyecto/)
})

test('orchestrator falls back on specific-case operational queries', async () => {
  const result = await orchestrator({
    message: 'aquesta remesa no em quadra',
    kbLang: 'ca',
    cards,
    clarifyOptionIds: [],
    assistantTone: 'neutral',
    allowAiIntent: false,
    allowAiReformat: false,
  })

  assert.equal(result.response.mode, 'fallback')
  assert.equal(result.meta.decisionReason, 'specific_case_guardrail')
  assert.equal(result.meta.specificCaseDetected, true)
  assert.match(result.response.answer, /cas concret/i)
})

test('orchestrator blocks medium-confidence operational answers in sensitive domains', async () => {
  const fallbackCard = cards.find(card => card.id === 'fallback-no-answer')
  assert.ok(fallbackCard, 'fallback-no-answer card must exist')

  const localCards: KBCard[] = [
    {
      id: 'kb-remittance-process-sensitive',
      type: 'howto',
      domain: 'remittances',
      risk: 'guarded',
      guardrail: 'b1_remittances',
      answerMode: 'full',
      title: { ca: 'Gestionar remesa', es: 'Gestionar remesa' },
      intents: { ca: ['com gestionar una remesa'], es: ['como gestionar una remesa'] },
      guideId: null,
      answer: {
        ca: '1. Ves a Moviments > Remeses.\n2. Processa la remesa.',
        es: '1. Ve a Movimientos > Remesas.\n2. Procesa la remesa.',
      },
      uiPaths: ['Moviments > Remeses'],
      needsSnapshot: false,
      keywords: ['remesa', 'gestionar'],
      related: [],
      error_key: null,
      symptom: { ca: null, es: null },
    },
    {
      id: 'kb-remittance-undo-sensitive',
      type: 'howto',
      domain: 'remittances',
      risk: 'guarded',
      guardrail: 'b1_remittances',
      answerMode: 'full',
      title: { ca: 'Gestionar remesa', es: 'Gestionar remesa' },
      intents: { ca: ['com gestionar una remesa'], es: ['como gestionar una remesa'] },
      guideId: null,
      answer: {
        ca: '1. Ves a Moviments > Remeses.\n2. Desfés la remesa.',
        es: '1. Ve a Movimientos > Remesas.\n2. Deshaz la remesa.',
      },
      uiPaths: ['Moviments > Remeses'],
      needsSnapshot: false,
      keywords: ['remesa', 'gestionar'],
      related: [],
      error_key: null,
      symptom: { ca: null, es: null },
    },
    fallbackCard,
  ]

  const result = await orchestrator({
    message: 'com gestionar una remesa',
    kbLang: 'ca',
    cards: localCards,
    clarifyOptionIds: [],
    assistantTone: 'neutral',
    allowAiIntent: false,
    allowAiReformat: false,
  })

  assert.equal(result.response.mode, 'fallback')
  assert.equal(result.response.cardId, 'clarify-disambiguation')
  assert.equal(result.meta.confidenceBand, 'medium')
  assert.equal(result.meta.decisionReason, 'sensitive_domain_guardrail')
})
