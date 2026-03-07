import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBotProblemsReport, toBotQuestionLogRecord } from '../../../scripts/support/analyze-bot-logs'

test('buildBotProblemsReport computes fallback and coverage candidates', () => {
  const report = buildBotProblemsReport(
    [
      toBotQuestionLogRecord('hash-fallback', {
        messageRaw: 'remesa no quadra',
        messageNormalized: 'remesa no quadra',
        lang: 'ca',
        resultMode: 'fallback',
        cardIdOrFallbackId: 'fallback-remittances-unclear',
        bestCardId: 'guide-remittances',
        confidenceBand: 'low',
        decisionReason: 'specific_case_fallback',
        intent: 'operational',
        count: 12,
        helpfulYes: 1,
        helpfulNo: 5,
      }),
      toBotQuestionLogRecord('hash-helpful', {
        messageRaw: 'on pujo factures',
        messageNormalized: 'on pujo factures',
        lang: 'ca',
        resultMode: 'card',
        cardIdOrFallbackId: 'guide-attach-document',
        bestCardId: 'guide-attach-document',
        confidenceBand: 'high',
        decisionReason: 'high_confidence_match',
        intent: 'operational',
        count: 8,
        helpfulYes: 2,
        helpfulNo: 1,
      }),
    ],
    {
      orgId: 'org-test',
      days: 90,
      generatedAt: '2026-03-07T12:00:00.000Z',
    }
  )

  assert.equal(report.topFallback[0]?.normalizedQueryHash, 'hash-fallback')
  assert.equal(report.topFallback[0]?.fallbackRate, 1)
  assert.equal(report.topNotHelpful[0]?.normalizedQueryHash, 'hash-fallback')
  assert.equal(report.recommendedCoverageCandidates.length, 2)
})

test('buildBotProblemsReport marks unavailable metrics as insufficient_data', () => {
  const report = buildBotProblemsReport(
    [
      toBotQuestionLogRecord('hash-no-signal', {
        messageRaw: 'duplicats extracte bancari',
        messageNormalized: 'duplicats extracte bancari',
        lang: 'ca',
        resultMode: 'fallback',
        cardIdOrFallbackId: 'fallback-no-answer',
        count: 3,
      }),
    ],
    {
      orgId: 'org-test',
      days: 90,
      generatedAt: '2026-03-07T12:00:00.000Z',
    }
  )

  assert.equal(report.topReformulations.status, 'insufficient_data')
  assert.equal(report.topClarifyAbandonment.status, 'insufficient_data')
  assert.equal(report.topHighFrequency[0]?.reformulationRate, null)
  assert.equal(report.topHighFrequency[0]?.clarifyAbandonmentRate, null)
})
