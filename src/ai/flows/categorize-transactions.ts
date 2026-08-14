
import 'server-only';

/**
 * @fileOverview Automatically categorizes transactions using AI based on descriptions, amounts, and keywords.
 *
 * - categorizeTransaction - A function that categorizes a transaction.
 * - CategorizeTransactionInput - The input type for the categorizeTransaction function.
 * - CategorizeTransactionOutput - The return type for the categorizeTransaction function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CategoryOptionSchema = z.object({
  id: z.string().describe('The unique ID of the category.'),
  name: z.string().describe('The display name of the category.'),
});

const CategorizeTransactionInputSchema = z.object({
  description: z.string().describe('The description of the transaction.'),
  amount: z.number().describe('The amount of the transaction. Positive for income, negative for expenses.'),
  expenseOptions: z.array(CategoryOptionSchema).describe('List of available expense category options.'),
  incomeOptions: z.array(CategoryOptionSchema).describe('List of available income category options.'),
});
export type CategorizeTransactionInput = z.infer<typeof CategorizeTransactionInputSchema>;

const CategorizeTransactionOutputSchema = z.object({
  categoryId: z.string().nullable().describe('The ID of the selected category, or null if no match.'),
  confidence: z.number().describe('The confidence level of the categorization (0-1).'),
});
export type CategorizeTransactionOutput = z.infer<typeof CategorizeTransactionOutputSchema>;

export async function categorizeTransaction(input: CategorizeTransactionInput): Promise<CategorizeTransactionOutput> {
  // Guard: si no hi ha opcions, retornar null directament
  const options = input.amount < 0 ? input.expenseOptions : input.incomeOptions;
  if (!options || options.length === 0) {
    return { categoryId: null, confidence: 0 };
  }

  return categorizeTransactionFlow(input);
}


const prompt = ai.definePrompt({
  name: 'categorizeTransactionPrompt',
  input: {schema: CategorizeTransactionInputSchema},
  output: {schema: CategorizeTransactionOutputSchema},
  prompt: `You are an expert financial categorizer for a small/medium non-profit organization in Spain.
Your task is operational transaction categorization, not accounting or fiscal interpretation.

Given the transaction description and amount, select the most appropriate category OPTION from the provided lists.
Do NOT infer context, entities or purposes that are not explicitly present in the transaction description.

Transaction Details:
Description: {{{description}}}
Amount: {{{amount}}}

If the amount is negative, it is an expense. You MUST choose ONE option from expenseOptions.
If the amount is positive, it is an income. You MUST choose ONE option from incomeOptions.

Expense options:
{{#each expenseOptions}}- {{id}}: {{name}}
{{/each}}

Income options:
{{#each incomeOptions}}- {{id}}: {{name}}
{{/each}}

Options format:
- Each option has an id and a name.
- You MUST return the id of the selected option exactly as provided.
- If you cannot confidently select an option, return null.

Confidence rules:
- 0.8–1.0 = high confidence
- 0.5–0.79 = medium confidence
- < 0.5 = low confidence → return categoryId null

If confidence would be lower than 0.5, you MUST return categoryId null.

Output schema:
{
  categoryId: string | null,
  confidence: number
}
`,
});

const categorizeTransactionFlow = ai.defineFlow(
  {
    name: 'categorizeTransactionFlow',
    inputSchema: CategorizeTransactionInputSchema,
    outputSchema: CategorizeTransactionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
