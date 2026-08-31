import assert from 'node:assert/strict'
import test from 'node:test'

import {
  classifySupportBotIntent,
  DEFAULT_SUPPORT_BOT_OPENAI_MODEL,
  hasSupportBotOpenAiApiKey,
  reformatSupportBotAnswer,
  resolveSupportBotOpenAiModel,
} from '@/lib/support/openai'

function responseWithOutput(value: unknown) {
  return {
    ok: true,
    status: 200,
    async json() {
      return { output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }] }
    },
    async text() {
      return ''
    },
  }
}

test('resolves the support bot OpenAI configuration without exposing a secret', () => {
  assert.equal(hasSupportBotOpenAiApiKey({ OPENAI_API_KEY: 'test-key' }), true)
  assert.equal(hasSupportBotOpenAiApiKey({ OPENAI_API_KEY: '   ' }), false)
  assert.equal(resolveSupportBotOpenAiModel({}), DEFAULT_SUPPORT_BOT_OPENAI_MODEL)
  assert.equal(resolveSupportBotOpenAiModel({ OPENAI_SUPPORT_BOT_MODEL: 'gpt-test' }), 'gpt-test')
})

test('reformats only through structured output and keeps storage disabled', async () => {
  const captured = { payload: null as Record<string, unknown> | null }
  const answer = await reformatSupportBotAnswer({
    apiKey: 'test-key',
    model: 'gpt-test',
    userQuestion: 'Com creo un projecte?',
    rawAnswer: 'Ves a Projectes i clica Nou projecte.',
    isGuarded: false,
    isLimited: false,
    isWarm: true,
    lang: 'ca',
    uiPathHint: 'Dashboard -> Projectes',
    fetchImpl: async (_url, init) => {
      captured.payload = JSON.parse(init.body) as Record<string, unknown>
      return responseWithOutput({ answer: 'Perfecte. Ves a Projectes i clica Nou projecte.' })
    },
  })

  assert.equal(answer, 'Perfecte. Ves a Projectes i clica Nou projecte.')
  if (!captured.payload) throw new Error('The OpenAI payload was not captured')
  assert.equal(captured.payload.model, 'gpt-test')
  assert.equal(captured.payload.store, false)
  const text = captured.payload.text as { format?: { type?: string; strict?: boolean } }
  assert.equal(text.format?.type, 'json_schema')
  assert.equal(text.format?.strict, true)
})

test('accepts only a candidate card with high or medium confidence', async () => {
  const candidates = [
    { id: 'card-project', title: 'Projectes', hints: 'crear projecte' },
    { id: 'card-budget', title: 'Pressupost', hints: 'importar pressupost' },
  ]

  const selected = await classifySupportBotIntent({
    apiKey: 'test-key',
    model: 'gpt-test',
    userQuestion: 'Com creo un projecte?',
    lang: 'ca',
    candidates,
    fetchImpl: async () => responseWithOutput({ cardId: 'card-project', confidence: 'high' }),
  })
  assert.deepEqual(selected, { cardId: 'card-project', confidence: 'high' })

  const rejected = await classifySupportBotIntent({
    apiKey: 'test-key',
    model: 'gpt-test',
    userQuestion: 'Com creo un projecte?',
    lang: 'ca',
    candidates,
    fetchImpl: async () => responseWithOutput({ cardId: 'not-a-candidate', confidence: 'high' }),
  })
  assert.equal(rejected, null)
})
