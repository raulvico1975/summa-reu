import test from 'node:test'
import assert from 'node:assert/strict'
import { loadAllCards, type KBCard } from '../support/load-kb'
import { detectSmallTalkResponse, detectSpecificCase, inferQuestionDomain, retrieveCard, suggestKeywordsFromMessage } from '../support/bot-retrieval'

const cards = loadAllCards()

function buildCard(overrides: Partial<KBCard> & Pick<KBCard, 'id'>): KBCard {
  return {
    id: overrides.id,
    type: overrides.type ?? 'howto',
    domain: overrides.domain ?? 'general',
    risk: overrides.risk ?? 'safe',
    guardrail: overrides.guardrail ?? 'none',
    answerMode: overrides.answerMode ?? 'full',
    title: overrides.title ?? { ca: overrides.id, es: overrides.id },
    intents: overrides.intents ?? { ca: [overrides.id], es: [overrides.id] },
    guideId: overrides.guideId ?? null,
    answer: overrides.answer ?? {
      ca: '1. Pas verificat.\n2. Segon pas.',
      es: '1. Paso verificado.\n2. Segundo paso.',
    },
    uiPaths: overrides.uiPaths ?? ['Moviments > Remeses'],
    needsSnapshot: overrides.needsSnapshot ?? false,
    keywords: overrides.keywords ?? [],
    related: overrides.related ?? [],
    error_key: overrides.error_key ?? null,
    symptom: overrides.symptom ?? { ca: null, es: null },
  }
}

test('retrieveCard understands donation certificate phrasing variants', () => {
  const result = retrieveCard('com faig arribar el certificat de donatius a un soci?', 'ca', cards)
  assert.equal(result.card.id, 'guide-donor-certificate')
  assert.equal(result.mode, 'card')
})

test('retrieveCard understands remittance split variants', () => {
  const result = retrieveCard('vull fraccionar la remesa de rebuts en quotes', 'ca', cards)
  assert.equal(result.card.id, 'guide-split-remittance')
  assert.equal(result.mode, 'card')
})

test('retrieveCard tolerates remittance misspelling', () => {
  const result = retrieveCard('tinc problemes per dividir una remessa', 'ca', cards)
  assert.equal(result.card.id, 'guide-split-remittance')
  assert.equal(result.mode, 'card')
})

test('retrieveCard understands expense allocation variants', () => {
  const result = retrieveCard('com reparteixo una despesa entre dos projectes?', 'ca', cards)
  assert.equal(result.card.id, 'guide-projects')
  assert.equal(result.mode, 'card')
})

test('retrieveCard resolves logo change question', () => {
  const result = retrieveCard("vull canviar el logo de l'entitat", 'ca', cards)
  assert.equal(result.card.id, 'manual-change-logo')
  assert.equal(result.mode, 'card')
})

test('retrieveCard resolves product updates inbox question', () => {
  const result = retrieveCard('com em puc assabentar de les novetats de Summa?', 'ca', cards)
  assert.equal(result.card.id, 'manual-product-updates')
  assert.equal(result.mode, 'card')
})

test('retrieveCard resolves multi-organization question', () => {
  const result = retrieveCard('puc tenir diverses organitzacions?', 'ca', cards)
  assert.equal(result.card.id, 'manual-multi-organization')
  assert.equal(result.mode, 'card')
})

test('retrieveCard resolves internal transfer categorization question', () => {
  const result = retrieveCard("tinc una transferència interna entre comptes de l'entitat, com la categorizo?", 'ca', cards)
  assert.equal(result.card.id, 'manual-internal-transfer')
  assert.equal(result.mode, 'card')
})

test('retrieveCard resolves generic error message question', () => {
  const result = retrieveCard("m'apareix un missatge d'error que no entenc", 'ca', cards)
  assert.equal(result.card.id, 'manual-common-errors')
  assert.equal(result.mode, 'card')
})

test('retrieveCard resolves guides hub question', () => {
  const result = retrieveCard("on trobo les guies d'ajuda dins l'app?", 'ca', cards)
  assert.equal(result.card.id, 'manual-guides-hub')
  assert.equal(result.mode, 'card')
})

test('retrieveCard resolves expense split across projects question', () => {
  const result = retrieveCard('Com imputo una despesa a diversos projectes?', 'ca', cards)
  assert.equal(result.card.id, 'guide-projects')
  assert.equal(result.mode, 'card')
})

test('retrieveCard resolves missing project expenses due to uncategorized movements', () => {
  const result = retrieveCard('Per què no em surten totes les despeses de la seu al llistat de despeses per imputar a projectes?', 'ca', cards)
  assert.equal(result.card.id, 'manual-project-expenses-filtered-feed')
  assert.equal(result.mode, 'card')
})

test('retrieveCard resolves upload invoice/receipt/payroll question', () => {
  const result = retrieveCard('Com pujo una factura o rebut o nòmina?', 'ca', cards)
  assert.equal(result.card.id, 'guide-attach-document')
  assert.equal(result.mode, 'card')
})

test('retrieveCard resolves member paid fees history question', () => {
  const result = retrieveCard('Com puc saber les quotes que un soci ha pagat?', 'ca', cards)
  assert.equal(result.card.id, 'manual-member-paid-quotas')
  assert.equal(result.mode, 'card')
})

test('retrieveCard direct-intent maps project allocation question reliably', () => {
  const result = retrieveCard('com imputo una despesa a diversos projectes?', 'ca', cards)
  assert.equal(result.card.id, 'guide-projects')
  assert.equal(result.mode, 'card')
  assert.equal(result.confidence, 'high')
})

test('retrieveCard direct-intent maps project allocation variant with "diferents"', () => {
  const result = retrieveCard('com imputo una despesa entre diferents projectes?', 'ca', cards)
  assert.equal(result.card.id, 'guide-projects')
  assert.equal(result.mode, 'card')
  assert.equal(result.confidence, 'high')
})

test('retrieveCard direct-intent maps document upload question reliably', () => {
  const result = retrieveCard('com pujo una factura o rebut o nomina?', 'ca', cards)
  assert.equal(result.card.id, 'guide-attach-document')
  assert.equal(result.mode, 'card')
  assert.equal(result.confidence, 'high')
})

test('retrieveCard direct-intent maps project-open variants reliably', () => {
  const ca = retrieveCard('com obro un projecte?', 'ca', cards)
  assert.equal(ca.card.id, 'project-open')
  assert.equal(ca.mode, 'card')

  const es = retrieveCard('como abro un proyecto?', 'es', cards)
  assert.equal(es.card.id, 'project-open')
  assert.equal(es.mode, 'card')
})

test('retrieveCard falls back safely for out-of-scope long query', () => {
  const result = retrieveCard(
    'quina és la millor estratègia de màrqueting digital per a una startup saas?',
    'ca',
    cards
  )
  assert.equal(result.card.id, 'fallback-no-answer')
  assert.equal(result.mode, 'fallback')
})

test('inferQuestionDomain detects fiscal and remittances', () => {
  assert.equal(inferQuestionDomain('Com envio certificat de donació model 182?'), 'fiscal')
  assert.equal(inferQuestionDomain('Puc desfer una remesa de rebuts?'), 'remittances')
  assert.equal(inferQuestionDomain('tinc error amb la remessa de quotes'), 'remittances')
})

test('detectSpecificCase detects concrete data phrasing in ca and es', () => {
  assert.equal(detectSpecificCase('aquesta remesa no em quadra'), true)
  assert.equal(detectSpecificCase('esta factura no me cuadra'), true)
  assert.equal(detectSpecificCase('com genero el model 182'), false)
})

test('retrieveCard does not answer directly on medium-confidence operational ambiguity', () => {
  const fallbackCard = cards.find(card => card.id === 'fallback-no-answer')
  assert.ok(fallbackCard, 'fallback-no-answer card must exist')

  const localCards: KBCard[] = [
    buildCard({
      id: 'kb-remittance-process-test',
      domain: 'remittances',
      risk: 'guarded',
      guardrail: 'b1_remittances',
      title: { ca: 'Gestionar remesa', es: 'Gestionar remesa' },
      intents: {
        ca: ['com gestionar una remesa'],
        es: ['como gestionar una remesa'],
      },
      keywords: ['remesa', 'gestionar'],
    }),
    buildCard({
      id: 'kb-remittance-undo-test',
      domain: 'remittances',
      risk: 'guarded',
      guardrail: 'b1_remittances',
      title: { ca: 'Gestionar remesa', es: 'Gestionar remesa' },
      intents: {
        ca: ['com gestionar una remesa'],
        es: ['como gestionar una remesa'],
      },
      keywords: ['remesa', 'gestionar'],
    }),
    fallbackCard,
  ]

  const result = retrieveCard('com gestionar una remesa', 'ca', localCards)
  assert.equal(result.mode, 'fallback')
  assert.equal(result.confidenceBand, 'medium')
  assert.equal(result.decisionReason, 'medium_confidence_disambiguation')
  assert.equal(result.clarifyOptions?.length, 2)
})

test('suggestKeywordsFromMessage returns meaningful canonical keywords', () => {
  const keywords = suggestKeywordsFromMessage('com imputo despeses entre projectes i remeses?', 4)
  assert.deepEqual(keywords, ['imputar', 'despesa', 'projecte', 'remesa'])
})

test('detectSmallTalkResponse handles greeting', () => {
  const response = detectSmallTalkResponse('Hola', 'ca')
  assert.ok(response)
  assert.equal(response?.cardId, 'smalltalk-greeting')
})

test('detectSmallTalkResponse handles greeting with punctuation', () => {
  const response = detectSmallTalkResponse('Hola!!!', 'ca')
  assert.ok(response)
  assert.equal(response?.cardId, 'smalltalk-greeting')
})

test('detectSmallTalkResponse handles identity question', () => {
  const response = detectSmallTalkResponse('qui ets?', 'ca')
  assert.ok(response)
  assert.equal(response?.cardId, 'smalltalk-about')
})

test('detectSmallTalkResponse handles thanks', () => {
  const response = detectSmallTalkResponse('gràcies', 'ca')
  assert.ok(response)
  assert.equal(response?.cardId, 'smalltalk-thanks')
})

test('detectSmallTalkResponse handles thanks with punctuation', () => {
  const response = detectSmallTalkResponse('gràcies!', 'ca')
  assert.ok(response)
  assert.equal(response?.cardId, 'smalltalk-thanks')
})

test('detectSmallTalkResponse handles acknowledgements', () => {
  const response = detectSmallTalkResponse("d'acord", 'ca')
  assert.ok(response)
  assert.equal(response?.cardId, 'smalltalk-ack')
})
