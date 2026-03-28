import './_env'
import { seedHistoricalQueue } from '../../src/lib/openclaw-editorial/workflow'

async function main() {
  const queueState = await seedHistoricalQueue()
  console.log(
    JSON.stringify(
      {
        ok: true,
        items: queueState.items.length,
        kbAvailable: queueState.kbAvailable,
        warnings: queueState.warnings,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error('[editorial:seed-historical]', error)
  process.exitCode = 1
})
