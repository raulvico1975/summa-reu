import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CATEGORIZE_TRANSACTION_CONFIDENCE_THRESHOLD,
  applyCategorizationConfidenceThreshold,
  buildCategorizeTransactionPromptText,
  finalizeCategorizationOutput,
} from '@/app/api/ai/categorize-transaction/prompt-helpers';

test('categorize transaction route uses the raised confidence threshold', () => {
  assert.equal(CATEGORIZE_TRANSACTION_CONFIDENCE_THRESHOLD, 0.6);
  assert.deepEqual(
    applyCategorizationConfidenceThreshold({ categoryId: 'cat-1', confidence: 0.59 }),
    { categoryId: null, confidence: 0.59 }
  );
  assert.deepEqual(
    applyCategorizationConfidenceThreshold({ categoryId: 'cat-1', confidence: 0.6 }),
    { categoryId: 'cat-1', confidence: 0.6 }
  );
  assert.deepEqual(
    finalizeCategorizationOutput(
      { categoryId: 'cat-missing', confidence: 0.95 },
      ['cat-1', 'cat-2']
    ),
    { categoryId: null, confidence: 0.95 }
  );
});

test('categorize transaction prompt hardens nonprofit Spain constraints and bilingual examples', () => {
  const prompt = buildCategorizeTransactionPromptText();

  assert.match(prompt, /non-profit organization in Spain/i);
  assert.match(prompt, /Spanish or Catalan/i);
  assert.match(prompt, /Bizum/i);
  assert.match(prompt, /ACCD/i);
  assert.match(prompt, /AECID/i);
  assert.match(prompt, /AEAT/i);
  assert.match(prompt, /Endesa/i);
  assert.match(prompt, /Vodafone/i);
  assert.match(prompt, /only from the provided options/i);
  assert.match(prompt, /return categoryId null/i);
  assert.match(prompt, /0\.6/i);
});
