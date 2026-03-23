import test from 'node:test'
import assert from 'node:assert/strict'
import { loadAllCards, type KBCard } from '../support/load-kb'
import { debugRetrieveCard, detectSmallTalkResponse, detectSpecificCase, inferQuestionDomain, retrieveCard, suggestKeywordsFromMessage } from '../support/bot-retrieval'
import type { SupportContext } from '../support/support-context'

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

  const es = retrieveCard('como divido una remesa en cuotas?', 'es', cards)
  assert.equal(es.card.id, 'guide-split-remittance')
  assert.equal(es.mode, 'card')
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

test('retrieveCard resolves natural-language bank statement import phrasing', () => {
  const ca = retrieveCard("com carrego l'extracte del banc a summa?", 'ca', cards)
  assert.equal(ca.card.id, 'guide-import-movements')
  assert.equal(ca.mode, 'card')
  assert.equal(ca.confidence, 'high')

  const es = retrieveCard('como cargo el extracto del banco en summa?', 'es', cards)
  assert.equal(es.card.id, 'guide-import-movements')
  assert.equal(es.mode, 'card')
  assert.equal(es.confidence, 'high')
})

test('retrieveCard resolves natural-language duplicate import phrasing', () => {
  const ca = retrieveCard('no vull tornar a importar els mateixos moviments del banc', 'ca', cards)
  assert.equal(ca.card.id, 'howto-import-safe-duplicates')
  assert.equal(ca.mode, 'card')

  const es = retrieveCard('no quiero volver a importar los mismos movimientos del banco', 'es', cards)
  assert.equal(es.card.id, 'howto-import-safe-duplicates')
  assert.equal(es.mode, 'card')
})

test('retrieveCard resolves natural-language bank returns phrasing', () => {
  const ca = retrieveCard("m'han tornat uns rebuts del banc, com els entro?", 'ca', cards)
  assert.equal(ca.card.id, 'howto-import-bank-returns')
  assert.equal(ca.mode, 'card')

  const es = retrieveCard('me han devuelto unos recibos del banco, como los meto?', 'es', cards)
  assert.equal(es.card.id, 'howto-import-bank-returns')
  assert.equal(es.mode, 'card')
})

test('retrieveCard keeps general bank returns questions on the general returns guide', () => {
  const ca = retrieveCard('tinc devolucions al banc, com les gestiono?', 'ca', cards)
  assert.equal(ca.card.id, 'guide-returns')
  assert.equal(ca.mode, 'card')

  const es = retrieveCard('tengo devoluciones en el banco, como las gestiono?', 'es', cards)
  assert.equal(es.card.id, 'guide-returns')
  assert.equal(es.mode, 'card')
})

test('retrieveCard resolves natural-language member creation phrasing', () => {
  const ca = retrieveCard("vull donar d'alta un soci nou", 'ca', cards)
  assert.equal(ca.card.id, 'howto-member-create')
  assert.equal(ca.mode, 'card')

  const es = retrieveCard('quiero dar de alta a un socio nuevo', 'es', cards)
  assert.equal(es.card.id, 'howto-member-create')
  assert.equal(es.mode, 'card')
})

test('retrieveCard resolves forgot-password phrasing before generic login help', () => {
  const ca = retrieveCard('he oblidat la contrasenya, com la recupero?', 'ca', cards)
  assert.equal(ca.card.id, 'guide-reset-password')
  assert.equal(ca.mode, 'card')

  const es = retrieveCard('he olvidado la contraseña, como la recupero?', 'es', cards)
  assert.equal(es.card.id, 'guide-reset-password')
  assert.equal(es.mode, 'card')
})

test('retrieveCard resolves donor history phrasing without drifting to paid-fees only', () => {
  const ca = retrieveCard("com veig l'historial d'un soci?", 'ca', cards)
  assert.equal(ca.card.id, 'howto-donor-history-summary')
  assert.equal(ca.mode, 'card')
})

test('retrieveCard resolves short document-upload phrasing', () => {
  const ca = retrieveCard('on pujo factures', 'ca', cards)
  assert.equal(ca.card.id, 'guide-attach-document')
  assert.equal(ca.mode, 'card')

  const es = retrieveCard('donde subo facturas', 'es', cards)
  assert.equal(es.card.id, 'guide-attach-document')
  assert.equal(es.mode, 'card')
})

test('retrieveCard resolves import-status phrasing', () => {
  const ca = retrieveCard("com sé quants moviments s'han importat correctament?", 'ca', cards)
  assert.equal(ca.card.id, 'guide-import-movements')
  assert.equal(ca.mode, 'card')
})

test('retrieveCard resolves member paid fees history question', () => {
  const result = retrieveCard('Com puc saber les quotes que un soci ha pagat?', 'ca', cards)
  assert.equal(result.card.id, 'manual-member-paid-quotas')
  assert.equal(result.mode, 'card')
})

test('retrieveCard resolves changing a member fee without confusing it with history', () => {
  const result = retrieveCard("com canvio la quota d'un soci", 'ca', cards)
  assert.equal(result.card.id, 'howto-donor-update-fee')
  assert.equal(result.mode, 'card')

  const es = retrieveCard('como cambio la cuota de un socio', 'es', cards)
  assert.equal(es.card.id, 'howto-donor-update-fee')
  assert.equal(es.mode, 'card')
})

test('retrieveCard resolves generic donor details update question', () => {
  const result = retrieveCard("com actualitzo les dades d'un donant", 'ca', cards)
  assert.equal(result.card.id, 'howto-donor-update-details')
  assert.equal(result.mode, 'card')
})

test('retrieveCard resolves donor edit variants without clarify', () => {
  const questions = [
    'com editar un donant',
    'com canviar el correu d un soci',
    'editar fitxa donant',
  ]

  for (const question of questions) {
    const result = retrieveCard(question, 'ca', cards)
    assert.equal(result.card.id, 'howto-donor-update-details')
    assert.equal(result.mode, 'card')
  }
})

test('retrieveCard keeps IBAN update routed to the dedicated card', () => {
  const ca = retrieveCard("com modifico l'IBAN d'un soci", 'ca', cards)
  assert.equal(ca.card.id, 'howto-donor-update-iban')
  assert.equal(ca.mode, 'card')

  const es = retrieveCard('como actualizo los datos de un socio', 'es', cards)
  assert.equal(es.card.id, 'howto-donor-update-details')
  assert.equal(es.mode, 'card')
})

test('retrieveCard resolves creating a SEPA collection remittance', () => {
  const result = retrieveCard('com generar una remesa sepa', 'ca', cards)
  assert.equal(result.card.id, 'howto-remittance-create-sepa')
  assert.equal(result.mode, 'card')
})

test('retrieveCard resolves undoing a processed remittance', () => {
  const result = retrieveCard('com desfer una remesa', 'ca', cards)
  assert.equal(result.card.id, 'howto-remittance-undo')
  assert.equal(result.mode, 'card')
})

test('debugRetrieveCard mirrors the donor update retrieval path', () => {
  const debug = debugRetrieveCard("com actualitzo les dades d'un donant", 'ca', cards)
  assert.equal(debug.predictedMode, 'card')
  assert.equal(debug.predictedCardId, 'howto-donor-update-details')
  assert.equal(debug.directIntent?.cardId, 'howto-donor-update-details')
  assert.ok(debug.cardsConsidered.includes('howto-donor-update-details'))
})

test('retrieveCard resolves model 182 generation explicitly', () => {
  const result = retrieveCard('com trec el model 182', 'ca', cards)
  assert.equal(result.card.id, 'guide-model-182-generate')
  assert.equal(result.mode, 'card')
})

test('retrieveCard resolves login/access question without drifting to projects', () => {
  const result = retrieveCard('no puc entrar', 'ca', cards)
  assert.equal(result.card.id, 'manual-login-access')
  assert.equal(result.mode, 'card')
})

test('retrieveCard resolves change-period and edit-movement phrasing in es', () => {
  const period = retrieveCard('como cambio de periodo para ver movimientos anteriores?', 'es', cards)
  assert.equal(period.card.id, 'guide-change-period')
  assert.equal(period.mode, 'card')

  const edit = retrieveCard('como edito un movimiento?', 'es', cards)
  assert.equal(edit.card.id, 'guide-edit-movement')
  assert.equal(edit.mode, 'card')
})

test('retrieveCard resolves access and permissions phrasing', () => {
  const ca = retrieveCard('com gestiono els accessos i permisos?', 'ca', cards)
  assert.equal(ca.card.id, 'guide-access-security')
  assert.equal(ca.mode, 'card')

  const es = retrieveCard('como gestiono los accesos y permisos?', 'es', cards)
  assert.equal(es.card.id, 'guide-access-security')
  assert.equal(es.mode, 'card')

  const userPerms = retrieveCard("com canvio els permisos d'un usuari?", 'ca', cards)
  assert.equal(userPerms.card.id, 'howto-member-user-permissions')
  assert.equal(userPerms.mode, 'card')
})

test('retrieveCard resolves danger-zone explainer safely', () => {
  const ca = retrieveCard('què és la zona de perill?', 'ca', cards)
  assert.equal(ca.card.id, 'manual-danger-zone')
  assert.equal(ca.mode, 'card')

  const es = retrieveCard('¿qué es la zona de peligro?', 'es', cards)
  assert.equal(es.card.id, 'manual-danger-zone')
  assert.equal(es.mode, 'card')
})

test('retrieveCard routes exact dangerous last-remittance delete query to the dedicated guide', () => {
  const ca = retrieveCard("com esborro l'última remesa?", 'ca', cards)
  assert.equal(ca.card.id, 'guide-danger-delete-remittance')
  assert.equal(ca.mode, 'card')

  const es = retrieveCard('¿cómo borro la última remesa?', 'es', cards)
  assert.equal(es.card.id, 'guide-danger-delete-remittance')
  assert.equal(es.mode, 'card')
})

test('retrieveCard falls back safely on out-of-scope fiscal filing and complex fiscal advice', () => {
  const filing = retrieveCard('com presento la declaració de donatius a hisenda?', 'ca', cards)
  assert.equal(filing.card.id, 'fallback-fiscal-unclear')
  assert.equal(filing.mode, 'fallback')

  const stripe182 = retrieveCard('com calculo les comissions de Stripe per al 182?', 'ca', cards)
  assert.equal(stripe182.card.id, 'fallback-fiscal-unclear')
  assert.equal(stripe182.mode, 'fallback')

  const donor182 = retrieveCard('no em surt el donant al 182', 'ca', cards)
  assert.equal(donor182.card.id, 'fallback-fiscal-unclear')
  assert.equal(donor182.mode, 'fallback')
})

test('retrieveCard falls back safely on ambiguous SEPA and remittance risk queries', () => {
  const cancelSepa = retrieveCard('puc anul·lar una remesa SEPA ja generada?', 'ca', cards)
  assert.equal(cancelSepa.card.id, 'fallback-sepa-unclear')
  assert.equal(cancelSepa.mode, 'fallback')

  const sepaErrors = retrieveCard('què passa si envio un fitxer SEPA amb errors?', 'ca', cards)
  assert.equal(sepaErrors.card.id, 'fallback-sepa-unclear')
  assert.equal(sepaErrors.mode, 'fallback')

  const reprocess = retrieveCard('puc reprocessar una remesa ja processada?', 'ca', cards)
  assert.equal(reprocess.card.id, 'fallback-remittances-unclear')
  assert.equal(reprocess.mode, 'fallback')

  const shortUndo = retrieveCard('com desfer remesa', 'ca', cards)
  assert.equal(shortUndo.card.id, 'fallback-remittances-unclear')
  assert.equal(shortUndo.mode, 'fallback')

  const lowMembers = retrieveCard('per què no surt soci remesa', 'ca', cards)
  assert.equal(lowMembers.card.id, 'fallback-remittances-unclear')
  assert.equal(lowMembers.mode, 'fallback')
})

test('retrieveCard keeps split-remittance recovery on the split guide', () => {
  const result = retrieveCard("he dividit una remesa i m'he equivocat, es pot desfer?", 'ca', cards)
  assert.equal(result.card.id, 'guide-split-remittance')
  assert.equal(result.mode, 'card')
})

test('retrieveCard uses conversation context to resolve follow-up undo questions', () => {
  const supportContext: SupportContext = {
    screen: {
      pathname: '/dashboard/movimientos',
      routeKey: 'movimientos',
      routeUiPath: 'Moviments',
      helpOpen: false,
    },
    previousCardId: 'howto-remittance-create-sepa',
    recentTurns: [
      { role: 'user', text: 'com generar una remesa sepa' },
      { role: 'bot', text: 'Com generar una remesa SEPA', cardId: 'howto-remittance-create-sepa', mode: 'card' },
    ],
  }

  const result = retrieveCard('i com la desfaig?', 'ca', cards, supportContext)
  assert.equal(result.card.id, 'howto-remittance-undo')
  assert.equal(result.mode, 'card')
})

test('retrieveCard uses memory to keep a follow-up on the same permissions workflow', () => {
  const supportContext: SupportContext = {
    screen: {
      pathname: '/dashboard/configuracion',
      routeKey: 'configuracion',
      routeUiPath: 'Configuració',
      helpOpen: false,
    },
    previousCardId: 'howto-member-user-permissions',
    recentTurns: [
      { role: 'user', text: "com canvio els permisos d'un usuari?" },
      { role: 'bot', text: 'Canviar permisos usuari', cardId: 'howto-member-user-permissions', mode: 'card' },
    ],
  }

  const result = retrieveCard('on ho faig?', 'ca', cards, supportContext)
  assert.equal(result.card.id, 'howto-member-user-permissions')
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
  assert.equal(detectSpecificCase('què faig si una remesa no quadra'), false)
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
