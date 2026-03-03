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
