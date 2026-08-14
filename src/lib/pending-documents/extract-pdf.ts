export interface ExtractPdfResult {
  success: boolean;
  extracted: boolean;
  error?: string;
}

export async function extractPdfData(
  orgId: string,
  pendingDocumentId: string,
  storagePath: string,
  idToken: string,
  context: 'movements' | 'projects'
): Promise<ExtractPdfResult> {
  const response = await fetch('/api/ai/extract-pdf', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ orgId, pendingDocumentId, storagePath, context }),
  });
  const result = await response.json() as { ok?: boolean; extracted?: boolean; code?: string };
  if (!response.ok || result.ok !== true) {
    return { success: false, extracted: false, error: result.code ?? 'PDF_EXTRACTION_FAILED' };
  }
  return { success: true, extracted: result.extracted === true };
}
