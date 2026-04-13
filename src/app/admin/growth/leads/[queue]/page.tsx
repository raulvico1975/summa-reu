import { notFound } from 'next/navigation'

import { LeadsQueuePage } from '@/components/admin/growth/LeadsQueuePage'
import { isGrowthQueueSlug } from '@/lib/growth/queues'

export default async function GrowthLeadsQueuePage({
  params,
}: {
  params: Promise<{ queue: string }>
}) {
  const { queue } = await params

  if (!isGrowthQueueSlug(queue)) {
    notFound()
  }

  return <LeadsQueuePage queue={queue} />
}
