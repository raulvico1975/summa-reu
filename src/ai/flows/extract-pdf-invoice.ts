import 'server-only';

/**
 * @fileOverview Extreu dades estructurades d'una factura PDF usant Gemini.
 *
 * - extractPdfInvoice - Funció principal per extreure dades d'un PDF.
 * - ExtractPdfInvoiceInput - Input amb el PDF en base64 i dades de l'organització.
 * - ExtractPdfInvoiceOutput - Output amb camps extrets, evidències i confiança.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

const ExtractPdfInvoiceInputSchema = z.object({
  pdfBase64: z.string().describe('Contingut del PDF codificat en base64'),
  orgLegalName: z.string().describe('Nom legal de l\'organització receptora'),
  orgTaxId: z.string().describe('CIF/NIF de l\'organització receptora'),
});
export type ExtractPdfInvoiceInput = z.infer<typeof ExtractPdfInvoiceInputSchema>;

const ExtractedFieldSchema = z.object({
  value: z.string().nullable().describe('Valor extret, o null si no es troba'),
  evidence: z.string().nullable().describe('Text literal del PDF d\'on s\'ha extret'),
});

const ExtractPdfInvoiceOutputSchema = z.object({
  docType: z.enum(['invoice', 'payroll', 'receipt', 'unknown']).describe('Tipus de document detectat'),
  invoiceNumber: ExtractedFieldSchema.describe('Número de factura'),
  invoiceDate: ExtractedFieldSchema.describe('Data de factura (format YYYY-MM-DD)'),
  amount: z.object({
    value: z.number().nullable().describe('Import total amb IVA inclòs'),
    evidence: z.string().nullable().describe('Text literal del PDF'),
  }).describe('Import total de la factura'),
  supplierName: ExtractedFieldSchema.describe('Nom del proveïdor/emissor'),
  supplierTaxId: ExtractedFieldSchema.describe('CIF/NIF del proveïdor normalitzat'),
  confidence: z.number().describe('Confiança global de l\'extracció (0-1)'),
});
export type ExtractPdfInvoiceOutput = z.infer<typeof ExtractPdfInvoiceOutputSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// WRAPPER FUNCTION (exportada)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extreu dades d'una factura PDF.
 *
 * @param input - PDF en base64 + dades de l'organització
 * @returns Camps extrets amb evidències i confiança
 *
 * @example
 * const result = await extractPdfInvoice({
 *   pdfBase64: 'JVBERi0xLjQK...',
 *   orgLegalName: 'Associació Example',
 *   orgTaxId: 'G12345678'
 * });
 */
export async function extractPdfInvoice(
  input: ExtractPdfInvoiceInput
): Promise<ExtractPdfInvoiceOutput> {
  // Guard: PDF buit
  if (!input.pdfBase64 || input.pdfBase64.length < 100) {
    return createEmptyOutput();
  }

  try {
    return await extractPdfInvoiceFlow(input);
  } catch (error) {
    console.error('[extractPdfInvoice] Error:', error);
    return createEmptyOutput();
  }
}

function createEmptyOutput(): ExtractPdfInvoiceOutput {
  return {
    docType: 'unknown',
    invoiceNumber: { value: null, evidence: null },
    invoiceDate: { value: null, evidence: null },
    amount: { value: null, evidence: null },
    supplierName: { value: null, evidence: null },
    supplierTaxId: { value: null, evidence: null },
    confidence: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT
// ═══════════════════════════════════════════════════════════════════════════

const prompt = ai.definePrompt({
  name: 'extractPdfInvoicePrompt',
  input: { schema: ExtractPdfInvoiceInputSchema },
  output: { schema: ExtractPdfInvoiceOutputSchema },
  prompt: `You are a document data extraction specialist for Spanish invoices and payrolls.

DOCUMENT:
{{media url=pdfDataUri}}

ORGANIZATION RECEIVING THE DOCUMENT:
- Legal Name: {{{orgLegalName}}}
- Tax ID (CIF/NIF): {{{orgTaxId}}}

YOUR TASK:
Extract structured data from the PDF. This is a document RECEIVED by the organization above, so:
- The SUPPLIER/ISSUER is the OTHER party (not the organization)
- Look for "Emisor", "Proveedor", "De:", "Factura de:" to identify the supplier
- The organization ({{{orgLegalName}}}) should appear as "Cliente", "Receptor", "A:", "Factura a:"

EXTRACTION RULES:

1. **docType**: Classify the document:
   - "invoice" → Factura, Albarán valorado, Nota de cargo
   - "payroll" → Nómina, Recibo de salarios
   - "receipt" → Ticket, Recibo, Justificante de pago
   - "unknown" → Cannot determine

2. **invoiceNumber**:
   - Look for: "Nº Factura", "Factura nº", "Número", "Ref", "Nº"
   - Include series if present (e.g., "A-2025-0001")
   - For payrolls, use period reference if no number exists

3. **invoiceDate**:
   - Look for: "Fecha", "Fecha de emisión", "Fecha factura"
   - MUST return in format YYYY-MM-DD (e.g., "2025-01-15")
   - Convert Spanish dates: "15 de enero de 2025" → "2025-01-15"

4. **amount**:
   - Extract the TOTAL amount INCLUDING taxes (IVA)
   - Look for: "Total", "Total factura", "Importe total", "A pagar"
   - For payrolls: "Líquido a percibir", "Neto"
   - Parse Spanish format: "1.234,56 €" → 1234.56

5. **supplierName**:
   - The company/person ISSUING the invoice (NOT {{{orgLegalName}}})
   - Look for: "Emisor", "Proveedor", "Razón social", letterhead/logo text

6. **supplierTaxId**:
   - CIF/NIF of the issuer
   - Normalize: remove spaces, dashes, convert to uppercase
   - Spanish formats: A12345678, B12345678, 12345678A, X1234567A

EVIDENCE RULES:
- For each field, provide the literal text from the PDF that supports your extraction
- If a field is not found, set value to null and evidence to null
- Be precise: copy the exact text you see, don't paraphrase

CONFIDENCE SCORING:
- 0.9-1.0: All main fields clearly visible and unambiguous
- 0.7-0.89: Most fields found but some ambiguity
- 0.5-0.69: Key fields missing or unclear
- <0.5: Document is not an invoice/payroll or mostly illegible

OUTPUT FORMAT:
{
  "docType": "invoice" | "payroll" | "receipt" | "unknown",
  "invoiceNumber": { "value": "string | null", "evidence": "string | null" },
  "invoiceDate": { "value": "YYYY-MM-DD | null", "evidence": "string | null" },
  "amount": { "value": number | null, "evidence": "string | null" },
  "supplierName": { "value": "string | null", "evidence": "string | null" },
  "supplierTaxId": { "value": "string | null", "evidence": "string | null" },
  "confidence": number
}`,
});

// ═══════════════════════════════════════════════════════════════════════════
// FLOW
// ═══════════════════════════════════════════════════════════════════════════

const extractPdfInvoiceFlow = ai.defineFlow(
  {
    name: 'extractPdfInvoiceFlow',
    inputSchema: ExtractPdfInvoiceInputSchema,
    outputSchema: ExtractPdfInvoiceOutputSchema,
  },
  async (input) => {
    // Construir data URI per a Gemini
    const pdfDataUri = `data:application/pdf;base64,${input.pdfBase64}`;

    const { output } = await prompt({
      ...input,
      // @ts-expect-error - pdfDataUri és usat al template però no està al schema
      pdfDataUri,
    });

    // Post-processar l'output
    const result = output!;

    // Normalitzar taxId si existeix
    if (result.supplierTaxId.value) {
      result.supplierTaxId.value = normalizeTaxId(result.supplierTaxId.value);
    }

    // Validar format de data
    if (result.invoiceDate.value && !isValidDateFormat(result.invoiceDate.value)) {
      result.invoiceDate.value = null;
    }

    return result;
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalitza un CIF/NIF espanyol.
 */
function normalizeTaxId(taxId: string): string {
  return taxId.replace(/[\s\-\.]/g, '').toUpperCase();
}

/**
 * Valida format YYYY-MM-DD.
 */
function isValidDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}
