import './_env'
import {
  recordTelegramApprovalDecision,
  requestTelegramApproval,
} from '../../src/lib/openclaw-editorial/workflow'
import { readOption, requireOption } from './_cli'

async function main() {
  const postId = requireOption('post-id')
  const decision = readOption('decision')
  if (decision === 'approved' || decision === 'rejected') {
    const approvedBy = readOption('approved-by') ?? 'telegram-human-review'
    const result = await recordTelegramApprovalDecision(postId, decision, approvedBy)
    console.log(
      JSON.stringify(
        {
          ok: true,
          postId,
          approvalStatus: result.approvalStatus,
          approvalPath: result.approvalPath,
        },
        null,
        2
      )
    )
    return
  }

  const result = await requestTelegramApproval(postId)
  console.log(
    JSON.stringify(
      {
        ok: true,
        postId,
        mode: result.mode,
        approvalStatus: result.approvalStatus,
        approvalPath: result.approvalPath,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error('[editorial:approve-telegram]', error)
  process.exitCode = 1
})
