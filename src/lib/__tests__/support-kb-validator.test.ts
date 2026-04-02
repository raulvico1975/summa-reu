import test from 'node:test'
import assert from 'node:assert/strict'
import { validateKbCards } from '../support/validate-kb-cards'
import type { KBCard } from '../support/load-kb'

test('validateKbCards accepts guide cards with localized inline answers', () => {
  const inlineGuideCard: KBCard = {
    id: 'guide-inline-import-test',
    type: 'howto',
    domain: 'transactions',
    risk: 'safe',
    guardrail: 'none',
    answerMode: 'full',
    title: { ca: 'Importar moviments', es: 'Importar movimientos' },
    intents: {
      ca: ['com importar moviments'],
      es: ['como importar movimientos'],
    },
    guideId: null,
    answer: {
      ca: '1. Ves a Moviments > Importar.\n2. Puja el fitxer.',
      es: '1. Ve a Movimientos > Importar.\n2. Sube el fichero.',
    },
    uiPaths: ['Moviments > Importar extracte bancari'],
    needsSnapshot: false,
    keywords: ['importar', 'moviments'],
    related: [],
    error_key: null,
    symptom: { ca: null, es: null },
  }

  const result = validateKbCards([inlineGuideCard])
  assert.equal(result.valid, true)
  assert.deepEqual(result.errors, [])
})
