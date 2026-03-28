import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBlogDraft, buildLinkedInArtifact, validateEditorialLanguage } from '../openclaw-editorial/content'
import type { EditorialCalendarPost, EditorialCriteriaContext } from '../openclaw-editorial/types'

const criteriaContext: EditorialCriteriaContext = {
  sources: {
    sectorKnowledgeBase: {
      path: '/mnt/data/KNOWLEDGE_BASE_Entitats.md',
      exists: false,
      content: null,
    },
    blogPublishContract: {
      path: '/tmp/blog-contract.md',
      exists: true,
      content: 'contract',
    },
    octaviStructure: [],
  },
  kbTerms: ['entitats', 'fiscalitat'],
  warnings: ['KB missing'],
}

const post: EditorialCalendarPost = {
  id: '2026-04-control-model-347',
  kind: 'monthly',
  state: 'planned',
  title: 'El control previ que convé fer abans del Model 347',
  slug: 'control-previ-conve-fer-abans-model-347',
  month: '2026-04',
  plannedDate: '2026-04-08',
  publishedAt: '2026-04-08T08:00:00.000Z',
  category: 'fiscal',
  tags: ['model-347', 'proveidors', 'fiscalitat'],
  sectorPrimary: 'fiscalitat',
  sectorSecondary: 'proveidors',
  objective:
    "Explicar les verificacions mínimes abans d'una exportació 347 perquè el tancament no depengui d'urgències finals.",
  brief:
    'Revisió de tercers, imports agregats i traçabilitat documental abans de treballar el Model 347.',
  sourceStatus: 'inferred_from_missing_exact_yaml_block',
}

test('validateEditorialLanguage detecta to SaaS prohibit', () => {
  const issues = validateEditorialLanguage(
    'Aquest quick win de SaaS tuda a fer growth',
    ['entitats']
  )

  assert.ok(issues.some((issue) => issue.includes('banned tone term')))
})

test('buildBlogDraft genera un draft amb criteri sectorial', () => {
  const draft = buildBlogDraft(post, criteriaContext, 3, 'ca')

  assert.equal(draft.slug, post.slug)
  assert.ok(draft.contentHtml.includes('<h2>Què cal entendre abans d’actuar</h2>'))
  assert.ok(draft.contentHtml.includes('<h2>Què revisar abans de donar-ho per bo</h2>'))
  assert.ok(draft.contentMarkdown.includes('obligació fiscal'))
  assert.ok(!draft.contentHtml.includes('LinkedIn'))
  assert.ok(!draft.contentHtml.includes('plantilla rígida'))
  assert.ok(draft.criteriaWarnings.includes('KB missing'))
})

test('buildLinkedInArtifact genera 3 variants coherents', () => {
  const draft = buildBlogDraft(post, criteriaContext, 3, 'ca')
  const linkedIn = buildLinkedInArtifact(draft, 'mock', 3)

  assert.equal(linkedIn.variants.length, 3)
  assert.match(linkedIn.variants[0]?.id ?? '', /-li-1$/)
  assert.ok(linkedIn.variants.every((variant) => variant.body.toLowerCase().includes('entitats')))
})
