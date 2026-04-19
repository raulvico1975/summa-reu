import { z } from 'genkit';

const CategorizeTransactionOutputSchema = z.object({
  categoryId: z.string().nullable(),
  confidence: z.number(),
});

export const CATEGORIZE_TRANSACTION_CONFIDENCE_THRESHOLD = 0.6;

export type CategorizeTransactionOutput = z.infer<typeof CategorizeTransactionOutputSchema>;

export function buildCategorizeTransactionPromptText(): string {
  return `You are an expert operational financial categorizer for a non-profit organization in Spain.
The organization is an NGO and bank descriptions can be written in Spanish or Catalan.
Your job is classification support, not accounting, tax advice, or free-form interpretation.

Given the transaction description and amount, choose the most appropriate category ONLY from the real options provided for this organization.
Never invent category IDs, never return a category outside the provided options, and never rely on hidden assumptions.
Use the category names to reason, but the final answer must return only an ID from the provided options or null.

Transaction Details:
Description: {{{description}}}
Amount: {{{amount}}}

If the amount is negative, it is an expense. You may only choose from expenseOptions.
If the amount is positive, it is an income. You may only choose from incomeOptions.

Expense options:
{{#each expenseOptions}}- {{id}}: {{name}}
{{/each}}

Income options:
{{#each incomeOptions}}- {{id}}: {{name}}
{{/each}}

Reasoning guidance:
- A transfer mentioning ACCD or AECID usually suggests a grant/subsidy category if such an option exists among the provided income options.
- A Bizum from a person usually suggests a donation category if such an option exists among the provided income options.
- "Nomina" or "nòmina" usually suggests salaries/payroll if such an option exists among the provided expense options.
- AEAT, Hacienda, or Agencia Tributaria usually suggest taxes if such an option exists among the provided expense options.
- Endesa, Iberdrola, Naturgy, or Repsol usually suggest supplies/utilities if such an option exists among the provided expense options.
- Vodafone, Movistar, Orange, or Telefonica usually suggest telecommunications if such an option exists among the provided expense options.

Decision rules:
- You must select only from the provided options for the correct transaction direction.
- If no provided option is clearly supported by the description, return categoryId null.
- If you are not sufficiently sure, return categoryId null.
- If confidence would be lower than ${CATEGORIZE_TRANSACTION_CONFIDENCE_THRESHOLD}, you MUST return categoryId null.

Confidence rules:
- 0.8-1.0 = high confidence
- ${CATEGORIZE_TRANSACTION_CONFIDENCE_THRESHOLD}-0.79 = medium confidence
- < ${CATEGORIZE_TRANSACTION_CONFIDENCE_THRESHOLD} = low confidence -> return categoryId null

Output schema:
{
  categoryId: string | null,
  confidence: number
}`;
}

export function applyCategorizationConfidenceThreshold(
  output: CategorizeTransactionOutput
): CategorizeTransactionOutput {
  if (output.confidence < CATEGORIZE_TRANSACTION_CONFIDENCE_THRESHOLD) {
    return {
      categoryId: null,
      confidence: output.confidence,
    };
  }

  return output;
}

export function finalizeCategorizationOutput(
  output: CategorizeTransactionOutput,
  validCategoryIds: string[]
): CategorizeTransactionOutput {
  const sanitizedCategoryId =
    output.categoryId && validCategoryIds.includes(output.categoryId)
      ? output.categoryId
      : null;

  return applyCategorizationConfidenceThreshold({
    categoryId: sanitizedCategoryId,
    confidence: output.confidence,
  });
}
