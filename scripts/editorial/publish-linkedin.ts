import './_env'
import { publishLinkedIn } from '../../src/lib/openclaw-editorial/workflow'
import { hasFlag, requireOption } from './_cli'

async function main() {
  const postId = requireOption('post-id')
  const result = await publishLinkedIn(postId, hasFlag('force'))
  console.log(
    JSON.stringify(
      {
        ok: true,
        postId,
        mode: result.mode,
        status: result.status,
        responsePath: result.responsePath,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error('[editorial:publish-linkedin]', error)
  process.exitCode = 1
})
