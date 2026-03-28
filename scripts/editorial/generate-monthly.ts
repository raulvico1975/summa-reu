import './_env'
import { generateMonthlyDraft } from '../../src/lib/openclaw-editorial/workflow'
import { readOption } from './_cli'

async function main() {
  const postId = readOption('post-id')
  const result = await generateMonthlyDraft(postId)
  console.log(
    JSON.stringify(
      {
        ok: true,
        postId: result.draft.id,
        title: result.draft.title,
        draftJson: result.queueState.items.find((item) => item.id === result.draft.id)?.artifactPaths
          .draftJson,
        draftMarkdown:
          result.queueState.items.find((item) => item.id === result.draft.id)?.artifactPaths
            .draftMarkdown,
        warnings: result.draft.criteriaWarnings,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error('[editorial:generate-monthly]', error)
  process.exitCode = 1
})
