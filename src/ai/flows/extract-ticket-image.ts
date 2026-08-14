import 'server-only';

/**
 * @fileOverview Extreu dades estructurades d'un ticket/rebut en format imatge (JPEG/PNG).
 *
 * - extractTicketImage - Funció principal per extreure dades d'una imatge.
 * - ExtractTicketImageInput - Input amb la imatge en base64.
 * - ExtractTicketImageOutput - Output amb camps extrets i confiança.
 *
 * A diferència de extract-pdf-invoice.ts (factures formals), aquest flow està
 * optimitzat per tickets de comerços: rebuts de caixa, tiquets de taxi, restaurants, etc.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

const ExtractTicketImageInputSchema = z.object({
  imageBase64: z.string().describe('Contingut de la imatge codificat en base64'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']).describe('Tipus MIME de la imatge'),
});
export type ExtractTicketImageInput = z.infer<typeof ExtractTicketImageInputSchema>;

const ExtractTicketImageOutputSchema = z.object({
  date: z.string().nullable().describe('Data del ticket (format YYYY-MM-DD)'),
  amount: z.number().nullable().describe('Import total del ticket'),
  currency: z.string().nullable().describe('Codi ISO 4217 de la moneda (EUR, USD, XOF, etc.)'),
  merchant: z.string().nullable().describe('Nom del comerç o establiment'),
  concept: z.string().nullable().describe('Concepte o descripció breu de la despesa'),
  confidence: z.number().describe('Confiança global de l\'extracció (0-1)'),
});
export type ExtractTicketImageOutput = z.infer<typeof ExtractTicketImageOutputSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// WRAPPER FUNCTION (exportada)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extreu dades d'un ticket en format imatge.
 *
 * @param input - Imatge en base64 + tipus MIME
 * @returns Camps extrets amb confiança
 *
 * @example
 * const result = await extractTicketImage({
 *   imageBase64: '/9j/4AAQSkZJRg...',
 *   mimeType: 'image/jpeg'
 * });
 */
export async function extractTicketImage(
  input: ExtractTicketImageInput
): Promise<ExtractTicketImageOutput> {
  // Guard: imatge buida
  if (!input.imageBase64 || input.imageBase64.length < 100) {
    return createEmptyOutput();
  }

  try {
    return await extractTicketImageFlow(input);
  } catch (error) {
    console.error('[extractTicketImage] Error:', error);
    return createEmptyOutput();
  }
}

function createEmptyOutput(): ExtractTicketImageOutput {
  return {
    date: null,
    amount: null,
    currency: null,
    merchant: null,
    concept: null,
    confidence: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT
// ═══════════════════════════════════════════════════════════════════════════

const prompt = ai.definePrompt({
  name: 'extractTicketImagePrompt',
  input: { schema: ExtractTicketImageInputSchema },
  output: { schema: ExtractTicketImageOutputSchema },
  prompt: `You are a receipt/ticket data extraction specialist.

IMAGE:
{{media url=imageDataUri}}

YOUR TASK:
Extract structured data from this receipt/ticket image. This could be:
- A cash register receipt (tiquet de caixa)
- A restaurant bill
- A taxi receipt
- A gas station receipt
- A parking ticket
- Any other small-format expense proof

EXTRACTION RULES:

1. **date**:
   - Look for: "Fecha", "Date", timestamps, header dates
   - MUST return in format YYYY-MM-DD (e.g., "2025-01-15")
   - Convert any date format found: "15/01/2025" → "2025-01-15"
   - If only day/month visible, assume current year

2. **amount**:
   - Extract the TOTAL amount paid
   - Look for: "Total", "A pagar", "Total a pagar", "Importe", final bold number
   - Parse correctly: "12,50 €" → 12.50, "$15.00" → 15.00
   - For multi-line receipts, use the final total (not subtotals)

3. **currency**:
   - Detect the currency from symbols or text
   - Return ISO 4217 code: EUR, USD, GBP, XOF, MAD, MXN, etc.
   - Default to EUR if symbol is "€" or no clear indicator in Spanish context
   - Common mappings: "€" → EUR, "$" → USD (unless context suggests other), "£" → GBP
   - For CFA franc (West Africa): FCFA, CFA, F → XOF

4. **merchant**:
   - Name of the business/establishment
   - Usually at the top of the receipt (header, logo text)
   - Look for: company name, store name, restaurant name
   - If illegible or not present, return null

5. **concept**:
   - Brief description of what was purchased
   - Infer from items listed or merchant type
   - Examples: "Taxi", "Restaurante", "Gasolina", "Material oficina", "Parking"
   - Keep it short (1-3 words)
   - If many items, use generic category: "Compra supermercado", "Material diverso"

CONFIDENCE SCORING:
- 0.9-1.0: All main fields clearly visible and unambiguous
- 0.7-0.89: Most fields found but some blur or ambiguity
- 0.5-0.69: Key fields missing or unclear
- <0.5: Image is not a receipt or mostly illegible

OUTPUT FORMAT:
{
  "date": "YYYY-MM-DD | null",
  "amount": number | null,
  "currency": "EUR | USD | ... | null",
  "merchant": "string | null",
  "concept": "string | null",
  "confidence": number
}`,
});

// ═══════════════════════════════════════════════════════════════════════════
// FLOW
// ═══════════════════════════════════════════════════════════════════════════

const extractTicketImageFlow = ai.defineFlow(
  {
    name: 'extractTicketImageFlow',
    inputSchema: ExtractTicketImageInputSchema,
    outputSchema: ExtractTicketImageOutputSchema,
  },
  async (input) => {
    // Construir data URI per a Gemini
    const imageDataUri = `data:${input.mimeType};base64,${input.imageBase64}`;

    const { output } = await prompt({
      ...input,
      // @ts-expect-error - imageDataUri és usat al template però no està al schema
      imageDataUri,
    });

    // Post-processar l'output
    const result = output!;

    // Validar format de data
    if (result.date && !isValidDateFormat(result.date)) {
      result.date = null;
    }

    // Normalitzar codi de moneda
    if (result.currency) {
      result.currency = normalizeCurrencyCode(result.currency);
    }

    return result;
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valida format YYYY-MM-DD.
 */
function isValidDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

/**
 * Normalitza el codi de moneda a ISO 4217.
 */
function normalizeCurrencyCode(code: string): string {
  const normalized = code.toUpperCase().trim();

  // Mapejos comuns
  const mappings: Record<string, string> = {
    'EURO': 'EUR',
    'EUROS': 'EUR',
    'DOLLAR': 'USD',
    'DOLLARS': 'USD',
    'FCFA': 'XOF',
    'CFA': 'XOF',
    'F.CFA': 'XOF',
    'DIRHAM': 'MAD',
    'DH': 'MAD',
  };

  return mappings[normalized] || normalized;
}
