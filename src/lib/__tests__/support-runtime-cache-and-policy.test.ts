import test from 'node:test'
import assert from 'node:assert/strict'
import { buildKbRuntimeCacheSignature, serializeKbCacheBustValue } from '../support/load-kb-runtime'
import { normalizeUiPathsAgainstCatalog } from '../support/engine/policy'

test('runtime KB cache signature changes when published storage timestamp changes', () => {
  const before = buildKbRuntimeCacheSignature({
    version: 10,
    storageVersion: 10,
    deletedCardIds: [],
    publishedAtKey: serializeKbCacheBustValue({ seconds: 1, nanoseconds: 0 }),
  })

  const after = buildKbRuntimeCacheSignature({
    version: 10,
    storageVersion: 10,
    deletedCardIds: [],
    publishedAtKey: serializeKbCacheBustValue({ seconds: 2, nanoseconds: 0 }),
  })

  assert.notEqual(before, after)
})

test('policy keeps dashboard route ui paths actionable for bot navigation', () => {
  assert.deepEqual(
    normalizeUiPathsAgainstCatalog(['/dashboard/donants']),
    ['Donants']
  )
})
