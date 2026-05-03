import { NextRequest, NextResponse } from 'next/server';
import { resolveGoogleGenAiApiKey } from '@/ai/config';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  buildCategorizeTransactionPromptText,
  finalizeCategorizationOutput,
} from './prompt-helpers';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { requireOrgMembership, type ApiGuardCode } from '@/lib/api/request-guards';

// =============================================================================
// SCHEMAS
// =============================================================================

const CategoryOptionSchema = z.object({
  id: z.string().describe('The unique ID of the category.'),
  name: z.string().describe('The display name of the category.'),
});

const CategorizeTransactionInputSchema = z.object({
  orgId: z.string().min(1).describe('The organization ID that owns this categorization request.'),
  description: z.string().describe('The description of the transaction.'),
  amount: z.number().describe('The amount of the transaction. Positive for income, negative for expenses.'),
  expenseOptions: z.array(CategoryOptionSchema).describe('List of available expense category options.'),
  incomeOptions: z.array(CategoryOptionSchema).describe('List of available income category options.'),
});

const CategorizeTransactionPromptInputSchema = CategorizeTransactionInputSchema.omit({ orgId: true });

const CategorizeTransactionOutputSchema = z.object({
  categoryId: z.string().nullable().describe('The ID of the selected category, or null if no match.'),
  confidence: z.number().describe('The confidence level of the categorization (0-1).'),
});

// =============================================================================
// PROMPT & FLOW (Route Handler scope - no SSR)
// =============================================================================

const prompt = ai.definePrompt({
  name: 'categorizeTransactionPromptAPI',
  input: { schema: CategorizeTransactionPromptInputSchema },
  output: { schema: CategorizeTransactionOutputSchema },
  prompt: buildCategorizeTransactionPromptText(),
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
  code: 'QUOTA_EXCEEDED' | 'RATE_LIMITED' | 'TRANSIENT' | 'INVALID_INPUT' | 'AI_ERROR' | ApiGuardCode;
  message: string;
};

type ApiResponse = SuccessResponse | ErrorResponse;

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
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
    const guard = await requireOrgMembership(request, input.orgId);
    if (!guard.ok) {
      return NextResponse.json({
        ok: false,
        code: guard.code,
        message: guard.message,
      }, { status: guard.status });
    }

    // Verify API key is available only after the request is authenticated.
    const apiKey = resolveGoogleGenAiApiKey();
    if (!apiKey) {
      console.error('[API] No API key found. Check GOOGLE_API_KEY, GOOGLE_GENAI_API_KEY or GEMINI_API_KEY');
      return NextResponse.json({
        ok: false,
        code: 'AI_ERROR',
        message: 'API key not configured',
      });
    }

    const rateLimit = checkRateLimit({
      key: `ai:categorize-transaction:${guard.auth.uid}:${input.orgId}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json({
        ok: false,
        code: 'RATE_LIMITED',
        message: 'Rate limited. Please slow down requests.',
      }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

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
    const { orgId: _orgId, ...aiInput } = input;
    const { output } = await prompt(aiInput);

    if (!output) {
      return NextResponse.json({
        ok: false,
        code: 'AI_ERROR',
        message: 'No output from AI model',
      });
    }

    const finalOutput = finalizeCategorizationOutput(
      output,
      options.map((option) => option.id)
    );

    return NextResponse.json({
      ok: true,
      categoryId: finalOutput.categoryId,
      confidence: finalOutput.confidence,
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
