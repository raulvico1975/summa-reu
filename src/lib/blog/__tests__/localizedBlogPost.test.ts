import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveLocalizedBlogPost } from '@/lib/blog/localized'
import type { BlogPost } from '@/lib/blog/types'

function buildBlogPost(): BlogPost {
  return {
    id: 'primer-post',
    baseLocale: 'ca',
    title: 'Primer post',
    slug: 'primer-post',
    seoTitle: 'Primer post | Summa Social',
    metaDescription: 'Meta description del primer post',
    excerpt: 'Resum curt del primer post',
    contentHtml: '<p>Contingut HTML</p>',
    tags: ['summa', 'blog'],
    category: 'criteri-operatiu',
    coverImageUrl: 'https://example.com/cover.jpg',
    coverImageAlt: 'Portada del primer post',
    translations: {
      es: {
        title: 'Primer post en castellano',
        seoTitle: 'Primer post en castellano | Summa Social',
        metaDescription: 'Meta description del primer post en castellano',
        excerpt: 'Resumen corto del primer post',
        contentHtml: '<p>Contenido HTML en castellano</p>',
        coverImageAlt: 'Portada del primer post en castellano',
      },
    },
    publishedAt: '2026-03-19T10:00:00.000Z',
    createdAt: '2026-03-19T10:00:00.000Z',
    updatedAt: '2026-03-19T10:00:00.000Z',
  }
}

test('resolveLocalizedBlogPost uses es translation for es locale', () => {
  const post = resolveLocalizedBlogPost(buildBlogPost(), 'es')

  assert.equal(post.title, 'Primer post en castellano')
  assert.equal(post.resolvedLocale, 'es')
  assert.equal(post.isFallback, false)
})

test('resolveLocalizedBlogPost falls back to es for fr locale when translation exists', () => {
  const post = resolveLocalizedBlogPost(buildBlogPost(), 'fr')

  assert.equal(post.title, 'Primer post en castellano')
  assert.equal(post.resolvedLocale, 'es')
  assert.equal(post.requestedLocale, 'fr')
  assert.equal(post.isFallback, false)
})

test('resolveLocalizedBlogPost falls back to base locale when es translation is missing', () => {
  const baseOnlyPost = buildBlogPost()
  delete baseOnlyPost.translations

  const post = resolveLocalizedBlogPost(baseOnlyPost, 'es')

  assert.equal(post.title, 'Primer post')
  assert.equal(post.resolvedLocale, 'ca')
  assert.equal(post.isFallback, true)
})
