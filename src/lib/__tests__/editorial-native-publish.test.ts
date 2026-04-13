import test from 'node:test'
import assert from 'node:assert/strict'

import { buildPublishInputFromNativePost } from '@/lib/editorial-native/publish'
import type { NativeBlogPost } from '@/lib/editorial-native/types'

function buildPost(): NativeBlogPost {
  return {
    id: 'blogdraft-1',
    source: 'manual',
    status: 'approved',
    idea: {
      prompt: 'Article sobre remeses',
      audience: 'associacions',
      problem: 'devolucions',
      objective: 'ordenar criteri',
    },
    draft: {
      title: 'Com revisar una remesa sense perdre context',
      slug: 'com-revisar-una-remesa-sense-perdre-context',
      seoTitle: 'Com revisar una remesa sense perdre context | Summa Social',
      metaDescription: 'Criteri operatiu per revisar remeses i devolucions amb traçabilitat.',
      excerpt: 'Una guia per revisar remeses sense arribar tard al problema.',
      contentMarkdown: '# Com revisar una remesa\n\n## Què mirar primer\n- IBAN\n- Mandats',
      contentHtml: '<h1>Com revisar una remesa</h1><h2>Què mirar primer</h2><ul><li>IBAN</li><li>Mandats</li></ul>',
      tags: ['remeses', 'tresoreria'],
      category: 'operativa',
      coverImageUrl: null,
      coverImageAlt: null,
      imagePrompt: 'Editorial cover for remittances',
      translations: {
        es: {
          title: 'Cómo revisar una remesa sin perder contexto',
          seoTitle: 'Cómo revisar una remesa sin perder contexto | Summa Social',
          metaDescription: 'Criterio operativo para revisar remesas y devoluciones.',
          excerpt: 'Una guía para revisar remesas sin llegar tarde al problema.',
          contentMarkdown: '# Cómo revisar una remesa\n\n## Qué mirar primero\n- IBAN\n- Mandatos',
          contentHtml: '<h1>Cómo revisar una remesa</h1><h2>Qué mirar primero</h2><ul><li>IBAN</li><li>Mandatos</li></ul>',
        },
      },
    },
    context: {
      kbPath: '/tmp/kb.md',
      kbAvailable: true,
      kbRefs: ['kb:remeses'],
      kbSnippets: ['kb:remeses · Remeses: ...'],
      model: 'gemini',
      llmApplied: true,
      validationStatus: 'OK',
      validationVerdict: 'publishable',
      reviewNotes: [],
      generatedAt: '2026-04-13T00:00:00.000Z',
      translatedAt: '2026-04-13T00:00:00.000Z',
    },
    review: {
      approvedAt: '2026-04-13T00:00:00.000Z',
      approvedBy: 'raul',
      publishedAt: null,
      publishedUrl: null,
      localizedUrls: null,
      lastError: null,
    },
    createdAt: '2026-04-13T00:00:00.000Z',
    updatedAt: '2026-04-13T00:00:00.000Z',
  }
}

test('buildPublishInputFromNativePost maps the native draft to the publish contract', () => {
  const payload = buildPublishInputFromNativePost(buildPost())

  assert.equal(payload.slug, 'com-revisar-una-remesa-sense-perdre-context')
  assert.equal(payload.baseLocale, 'ca')
  assert.equal(payload.category, 'operativa')
  assert.deepEqual(payload.tags, ['remeses', 'tresoreria'])
  assert.equal(payload.translations?.es?.title, 'Cómo revisar una remesa sin perder contexto')
  assert.equal(payload.translations?.es?.contentHtml?.includes('<h1>'), true)
})

