import './_env'
import { deriveLinkedIn } from '../../src/lib/openclaw-editorial/workflow'
import { requireOption } from './_cli'

async function main() {
  const postId = requireOption('post-id')
  const result = await deriveLinkedIn(postId)
  console.log(
    JSON.stringify(
      {
        ok: true,
        postId,
        variants: result.artifact.variants.length,
        linkedInJson:
          result.queueState.items.find((item) => item.id === postId)?.artifactPaths.linkedinJson,
        linkedInMarkdown:
          result.queueState.items.find((item) => item.id === postId)?.artifactPaths.linkedinMarkdown,
        warnings: result.artifact.criteriaWarnings,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error('[editorial:derive-linkedin]', error)
  process.exitCode = 1
})
