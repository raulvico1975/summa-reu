import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeBlogContentHtml } from '@/lib/blog/normalizeContentHtml'

test('normalizeBlogContentHtml strips a duplicated lead h1 and upgrades markdown emphasis markers', () => {
  const html = `
    <h1>Per què les remeses són el punt més fràgil de la gestió d'una associació</h1>
    <p>El primer és saber **a qui girar el rebut cada mes** i fer-ho *abans*.</p>
  `

  const result = normalizeBlogContentHtml(
    html,
    "Per què les remeses són el punt més fràgil de la gestió d'una associació"
  )

  assert.equal(
    result,
    '<p>El primer és saber <strong>a qui girar el rebut cada mes</strong> i fer-ho <em>abans</em>.</p>'
  )
})

test('normalizeBlogContentHtml keeps a non-duplicated lead h1', () => {
  const html = '<h1>Context</h1><p>Cos de l’article.</p>'

  const result = normalizeBlogContentHtml(html, 'Un altre títol')

  assert.equal(result, html)
})

test('normalizeBlogContentHtml does not alter markdown markers inside code blocks', () => {
  const html = '<pre><code>**no tocar** *ni això*</code></pre><p>Però **això sí** i *això també*.</p>'

  const result = normalizeBlogContentHtml(html, 'Títol')

  assert.equal(
    result,
    '<pre><code>**no tocar** *ni això*</code></pre><p>Però <strong>això sí</strong> i <em>això també</em>.</p>'
  )
})
