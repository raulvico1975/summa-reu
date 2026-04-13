import test from 'node:test'
import assert from 'node:assert/strict'

import { seedQueueStateFromCalendar } from '../openclaw-editorial/workflow'
import type { EditorialCalendar, EditorialCriteriaContext, QueueState } from '../openclaw-editorial/types'

test('seedQueueStateFromCalendar reuses the editorial calendar as runtime queue seed', () => {
  const calendar: EditorialCalendar = {
    version: 1,
    calendarId: 'calendar-2026',
    calendarOrigin: 'octavi',
    criteriaSources: {
      sectorKnowledgeBasePath: '/mnt/data/KB.md',
      blogPublishContractPath: '/mnt/data/contract.md',
      octaviStructurePaths: ['/mnt/data/structure.md'],
    },
    defaults: {
      blogLocale: 'ca',
      approvalChannel: 'telegram',
      linkedinMode: 'mock',
      derivativesPerPost: 3,
      requiresHumanApproval: true,
    },
    posts: [
      {
        id: 'post-planned',
        kind: 'monthly',
        state: 'planned',
        title: 'Nou post',
        slug: 'nou-post',
        month: '2026-05',
        plannedDate: '2026-05-10',
        publishedAt: '',
        category: 'Blog',
        tags: ['blog'],
        sectorPrimary: 'entitats',
        objective: 'informar',
        brief: 'brief',
        sourceStatus: 'provided',
      },
      {
        id: 'post-published',
        kind: 'historical',
        state: 'published',
        title: 'Publicat',
        slug: 'publicat',
        month: '2026-04',
        plannedDate: '2026-04-01',
        publishedAt: '2026-04-11T10:00:00.000Z',
        category: 'Blog',
        tags: ['blog'],
        sectorPrimary: 'entitats',
        objective: 'informar',
        brief: 'brief',
        sourceStatus: 'provided',
      },
    ],
  }

  const criteriaContext: EditorialCriteriaContext = {
    sources: {
      sectorKnowledgeBase: {
        path: '/mnt/data/KB.md',
        exists: true,
        content: '# KB\n- entitats\n',
      },
      blogPublishContract: {
        path: '/mnt/data/contract.md',
        exists: true,
        content: '# Contract\n',
      },
      octaviStructure: [
        {
          path: '/mnt/data/structure.md',
          exists: true,
          content: '# Structure\n',
        },
      ],
    },
    kbTerms: ['entitats'],
    warnings: ['KB sense canvis recents.'],
  }

  const existingQueueState: QueueState = {
    version: 1,
    calendarId: 'old-calendar',
    updatedAt: '2026-04-01T00:00:00.000Z',
    kbPath: '/mnt/data/old-kb.md',
    kbAvailable: false,
    warnings: ['warning antic'],
    items: [
      {
        id: 'post-planned',
        title: 'Títol antic',
        kind: 'monthly',
        month: '2026-04',
        plannedDate: '2026-04-10',
        publishedAt: '',
        sectorPrimary: 'entitats',
        blogStatus: 'planned',
        linkedinStatus: 'not_started',
        approvalStatus: 'not_requested',
        sourceStatus: 'provided',
        artifactPaths: {},
        notes: ['Calendari inferit perquè el bloc YAML exacte no ha arribat en aquest encàrrec.'],
      },
    ],
  }

  const seeded = seedQueueStateFromCalendar(calendar, criteriaContext, existingQueueState)

  assert.equal(seeded.calendarId, 'calendar-2026')
  assert.equal(seeded.kbPath, '/mnt/data/KB.md')
  assert.equal(seeded.kbAvailable, true)
  assert.deepEqual(seeded.warnings, ['KB sense canvis recents.'])
  assert.equal(seeded.items.length, 2)
  assert.equal(seeded.items[0].id, 'post-published')
  assert.equal(seeded.items[0].blogStatus, 'published')
  assert.equal(seeded.items[0].approvalStatus, 'approved')
  assert.equal(seeded.items[1].id, 'post-planned')
  assert.equal(seeded.items[1].title, 'Nou post')
  assert.equal(
    seeded.items[1].notes.includes('Calendari inferit perquè el bloc YAML exacte no ha arribat en aquest encàrrec.'),
    true
  )
})
