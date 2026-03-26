import test from 'node:test';
import assert from 'node:assert/strict';
import type { MessageData } from 'genkit';
import {
  DEFAULT_GOOGLE_GENAI_MODEL,
  DEFAULT_GOOGLE_GENAI_MODEL_LABEL,
  buildSharedAiRuntimeConfig,
  hasGoogleGenAiApiKey,
  resolveGenkitModelRef,
  resolveGoogleGenAiApiKey,
  resolveGoogleGenAiModelCode,
  resolveGoogleGenAiModelLabel,
} from '../../ai/config';
import {
  extractSerializableAiResponseMessages,
  parseSerializedAiHistoryMessages,
  serializeAiResponseMessages,
} from '../../ai/history';

test('AI config resolves API key aliases in the expected order', () => {
  assert.equal(resolveGoogleGenAiApiKey({}), undefined);
  assert.equal(
    resolveGoogleGenAiApiKey({
      GOOGLE_API_KEY: 'primary-key',
      GOOGLE_GENAI_API_KEY: 'secondary-key',
      GEMINI_API_KEY: 'third-key',
    }),
    'primary-key'
  );
  assert.equal(
    resolveGoogleGenAiApiKey({
      GOOGLE_GENAI_API_KEY: 'secondary-key',
      GEMINI_API_KEY: 'third-key',
    }),
    'secondary-key'
  );
  assert.equal(
    resolveGoogleGenAiApiKey({
      GEMINI_API_KEY: 'third-key',
    }),
    'third-key'
  );
  assert.equal(
    hasGoogleGenAiApiKey({
      GEMINI_API_KEY: 'third-key',
    }),
    true
  );
});

test('AI config resolves the shared Gemini model defaults and overrides', () => {
  assert.equal(resolveGoogleGenAiModelCode({}), DEFAULT_GOOGLE_GENAI_MODEL);
  assert.equal(resolveGoogleGenAiModelLabel({}), DEFAULT_GOOGLE_GENAI_MODEL_LABEL);
  assert.equal(resolveGenkitModelRef({}), `googleai/${DEFAULT_GOOGLE_GENAI_MODEL}`);

  assert.equal(
    resolveGoogleGenAiModelCode({
      GOOGLE_GENAI_MODEL: 'gemini-3.1-flash-lite-preview',
      GEMINI_MODEL: 'gemini-2.5-flash-lite',
    }),
    'gemini-3.1-flash-lite-preview'
  );
  assert.equal(
    resolveGoogleGenAiModelCode({
      GEMINI_MODEL: 'gemini-2.5-flash-lite',
    }),
    'gemini-2.5-flash-lite'
  );
});

test('shared AI runtime config builds the expected Genkit contract', () => {
  const runtimeConfig = buildSharedAiRuntimeConfig({
    GOOGLE_GENAI_API_KEY: 'runtime-key',
    GEMINI_MODEL: 'gemini-2.5-flash-lite',
  });

  assert.deepEqual(runtimeConfig, {
    apiKey: 'runtime-key',
    model: 'googleai/gemini-2.5-flash-lite',
    modelLabel: 'gemini-2.5-flash-lite',
  });
});

test('AI history helpers preserve thought signatures through JSON round-trip', () => {
  const messages: MessageData[] = [
    {
      role: 'user',
      content: [{ text: 'Check flight status for AA100' }],
    },
    {
      role: 'model',
      content: [
        {
          reasoning: '',
          metadata: { thoughtSignature: 'abc123' },
        },
        {
          text: 'Flight status retrieved.',
        },
      ],
    },
  ];

  const responseLike = { messages };
  const extracted = extractSerializableAiResponseMessages(responseLike);
  const serialized = serializeAiResponseMessages(responseLike);
  const reparsed = parseSerializedAiHistoryMessages(serialized);

  assert.deepEqual(extracted, messages);
  assert.deepEqual(reparsed, messages);
  assert.notEqual(extracted, messages);
  assert.notEqual(reparsed, messages);
});
