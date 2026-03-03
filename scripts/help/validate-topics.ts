import { loadTopicPairs, validateTopicPair } from './topic-utils'

function main(): void {
  const pairs = loadTopicPairs('help/topics')
  const errors: string[] = []
  const warnings: string[] = []

  for (const pair of pairs) {
    const result = validateTopicPair(pair)
    errors.push(...result.errors)
    warnings.push(...result.warnings)
  }

  console.log(`[help:validate-topics] Topics analyzed: ${pairs.length}`)

  if (warnings.length > 0) {
    console.log(`[help:validate-topics] Warnings: ${warnings.length}`)
    for (const warning of warnings) {
      console.log(`  - ${warning}`)
    }
  }

  if (errors.length > 0) {
    console.error(`[help:validate-topics] Errors: ${errors.length}`)
    for (const error of errors) {
      console.error(`  - ${error}`)
    }
    process.exit(1)
  }

  console.log('[help:validate-topics] OK')
}

main()
