import test from 'node:test'
import assert from 'node:assert/strict'
import { loadAllCards, type KBCard } from '../support/load-kb'
import { runKbQualityGate } from '../support/kb-quality-gate'

test('quality gate fails when critical operational card has no renderable steps', () => {
  const cards = loadAllCards().map(card => ({ ...card })) as KBCard[]
  const idx = cards.findIndex(card => card.id === 'guide-projects')
  assert.ok(idx >= 0, 'guide-projects card must exist in fixture KB')

  cards[idx] = {
    ...cards[idx],
    guideId: 'non-existent-guide-id',
  }

  const gate = runKbQualityGate(cards)
  assert.equal(gate.ok, false)
  assert.ok(
    gate.errors.some(error => error.includes('Critical card has no renderable operational steps: guide-projects')),
    'quality gate should block publish when critical operational card content is missing'
  )
})

test('quality gate reports top support benchmark coverage metrics', () => {
  const gate = runKbQualityGate(loadAllCards())

  assert.equal(typeof gate.stats.topSupport.total, 'number')
  assert.equal(gate.stats.topSupport.total, 100)
  assert.equal(typeof gate.stats.topSupport.positiveRate, 'number')
  assert.equal(typeof gate.stats.topSupport.criticalPositiveRate, 'number')
  assert.equal(typeof gate.stats.topSupport.coveredPositiveRate, 'number')
  assert.equal(typeof gate.stats.topSupport.fallbackCount, 'number')
  assert.equal(typeof gate.stats.topSupport.cardMatchCount, 'number')
  assert.equal(typeof gate.stats.topSupport.safeFallbackCount, 'number')
  assert.equal(typeof gate.stats.topSupport.unresolvedInScopeCount, 'number')
})
