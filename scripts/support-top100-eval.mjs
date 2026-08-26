import loadKbModule from '../src/lib/support/load-kb.ts'
import topSupportModule from '../src/lib/support/eval/top-support-questions.ts'

const loadKb = loadKbModule?.default ?? loadKbModule
const topSupport = topSupportModule?.default ?? topSupportModule

const { loadAllCards } = loadKb
const { evaluateTopSupportQuestionsBenchmark } = topSupport

const cards = loadAllCards()
const report = evaluateTopSupportQuestionsBenchmark(cards)
const { metrics, mismatches } = report

console.log('=== Support Top-100 Benchmark ===')
console.log(`Cases: ${metrics.total}`)
console.log(`Positive: ${(metrics.positiveRate * 100).toFixed(2)}% (${metrics.positiveCount}/${metrics.total})`)
console.log(
  `Critical positive: ${(metrics.criticalPositiveRate * 100).toFixed(2)}% (${metrics.criticalPositiveCount}/${metrics.criticalTotal})`
)
console.log(
  `Covered positive: ${(metrics.coveredPositiveRate * 100).toFixed(2)}% (${metrics.coveredPositiveCount}/${metrics.coveredTotal})`
)
console.log(`Weak positive: ${(metrics.weakPositiveRate * 100).toFixed(2)}% (${metrics.weakPositiveCount}/${metrics.weakTotal})`)
console.log(
  `Absent positive: ${(metrics.absentPositiveRate * 100).toFixed(2)}% (${metrics.absentPositiveCount}/${metrics.absentTotal})`
)
console.log(`Clarifications: ${metrics.clarifyCount}`)
console.log(`Fallbacks: ${metrics.fallbackCount}`)
console.log(`Card matches: ${metrics.cardMatchCount}`)
console.log(`Safe fallbacks: ${metrics.safeFallbackCount}`)
console.log(`Unresolved in-scope: ${metrics.unresolvedInScopeCount}`)
console.log(`Trusted operational cards: ${metrics.trustedOperationalCount}`)

if (mismatches.length > 0) {
  console.log('\n--- Mismatches (first 20) ---')
  for (const mismatch of mismatches.slice(0, 20)) {
    const expected = mismatch.expectedAnyOfCardIds.join(' | ')
    const confidence = mismatch.confidence ? `, ${mismatch.confidence}` : ''
    const trusted = mismatch.trustedOperational ? ', trusted-operational' : ''
    console.log(
      `[${mismatch.coverage}] ${mismatch.id} "${mismatch.question}" => expected ${expected} got "${mismatch.actualCardId}" (${mismatch.actualMode}${confidence}${trusted})`
    )
  }
} else {
  console.log('\nNo mismatches.')
}
