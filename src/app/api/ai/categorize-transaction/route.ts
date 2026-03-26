import { NextRequest, NextResponse } from 'next/server';
import { resolveGoogleGenAiApiKey } from '@/ai/config';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// =============================================================================
// SCHEMAS
// =============================================================================

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

const CategorizeTransactionOutputSchema = z.object({
  categoryId: z.string().nullable().describe('The ID of the selected category, or null if no match.'),
  confidence: z.number().describe('The confidence level of the categorization (0-1).'),
});

// =============================================================================
// PROMPT & FLOW (Route Handler scope - no SSR)
// =============================================================================

const prompt = ai.definePrompt({
  name: 'categorizeTransactionPromptAPI',
  input: { schema: CategorizeTransactionInputSchema },
  output: { schema: CategorizeTransactionOutputSchema },
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

// =============================================================================
// RESPONSE TYPES
// =============================================================================

type SuccessResponse = {
  ok: true;
  categoryId: string | null;
  confidence: number;
};

type ErrorResponse = {
  ok: false;
  code: 'QUOTA_EXCEEDED' | 'RATE_LIMITED' | 'TRANSIENT' | 'INVALID_INPUT' | 'AI_ERROR';
  message: string;
};

type ApiResponse = SuccessResponse | ErrorResponse;

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    // Verify API key is available
    const apiKey = resolveGoogleGenAiApiKey();
    if (!apiKey) {
      console.error('[API] No API key found. Check GOOGLE_API_KEY, GOOGLE_GENAI_API_KEY or GEMINI_API_KEY');
      return NextResponse.json({
        ok: false,
        code: 'AI_ERROR',
        message: 'API key not configured',
      });
    }

    const body = await request.json();

    // Validate input
    const parseResult = CategorizeTransactionInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({
        ok: false,
        code: 'INVALID_INPUT',
        message: parseResult.error.message,
      });
    }

    const input = parseResult.data;

    // Guard: si no hi ha opcions, retornar null directament
    const options = input.amount < 0 ? input.expenseOptions : input.incomeOptions;
    if (!options || options.length === 0) {
      return NextResponse.json({
        ok: true,
        categoryId: null,
        confidence: 0,
      });
    }

    console.log('[API] Calling AI with description:', input.description.substring(0, 50));

    // Call AI
    const { output } = await prompt(input);

    if (!output) {
      return NextResponse.json({
        ok: false,
        code: 'AI_ERROR',
        message: 'No output from AI model',
      });
    }

    return NextResponse.json({
      ok: true,
      categoryId: output.categoryId,
      confidence: output.confidence,
    });
  } catch (error: any) {
    console.error('[API] categorize-transaction error:', error);

    const errorMsg = error?.message || error?.toString() || '';
    const errorMsgLower = errorMsg.toLowerCase();

    // Detect quota/rate limit errors (including 400 with quota message)
    if (
      errorMsg.includes('429') ||
      errorMsgLower.includes('quota') ||
      errorMsgLower.includes('resource_exhausted') ||
      errorMsgLower.includes('exceeded') ||
      (errorMsg.includes('400') && errorMsgLower.includes('limit'))
    ) {
      console.error('[API] Quota exceeded:', errorMsg.substring(0, 200));
      return NextResponse.json({
        ok: false,
        code: 'QUOTA_EXCEEDED',
        message: "Quota d'IA esgotada. Torna-ho a provar més tard o activa facturació a Google AI Studio.",
      });
    }

    if (errorMsgLower.includes('rate limit') || errorMsgLower.includes('rate_limit')) {
      return NextResponse.json({
        ok: false,
        code: 'RATE_LIMITED',
        message: 'Rate limited. Please slow down requests.',
      });
    }

    // Detect transient errors (503, 504, timeout)
    if (
      errorMsg.includes('503') ||
      errorMsg.includes('504') ||
      errorMsgLower.includes('timeout') ||
      errorMsgLower.includes('unavailable') ||
      errorMsgLower.includes('econnreset')
    ) {
      return NextResponse.json({
        ok: false,
        code: 'TRANSIENT',
        message: 'Temporary error. Will retry.',
      });
    }

    // Check for API key errors specifically
    if (
      errorMsgLower.includes('api key') ||
      errorMsgLower.includes('api_key') ||
      errorMsgLower.includes('authentication') ||
      errorMsgLower.includes('unauthorized') ||
      errorMsg.includes('401') ||
      errorMsg.includes('403')
    ) {
      return NextResponse.json({
        ok: false,
        code: 'AI_ERROR',
        message: 'API key invalid or unauthorized: ' + errorMsg.substring(0, 150),
      });
    }

    // Generic AI error
    return NextResponse.json({
      ok: false,
      code: 'AI_ERROR',
      message: errorMsg.substring(0, 200),
    });
  }
}
