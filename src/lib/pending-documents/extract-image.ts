// src/lib/pending-documents/extract-image.ts
// Servei per extreure dades d'una imatge de ticket i actualitzar el pendingDocument

import { ref, getDownloadURL, FirebaseStorage } from 'firebase/storage';
import { updateDoc, serverTimestamp, Firestore, FieldValue } from 'firebase/firestore';
import { pendingDocumentDoc } from './refs';
import type { PendingDocument, PendingDocumentExtraction } from './types';

/**
 * Resultat de l'extracció d'imatge.
 */
export interface ExtractImageResult {
  success: boolean;
  extracted: boolean;       // true si s'ha extret algun camp
  error?: string;
  aiOutput?: {
    date: string | null;
    amount: number | null;
    currency: string | null;
    merchant: string | null;
    concept: string | null;
    confidence: number;
  };
  fields?: {
    invoiceDate?: string;
    amount?: number;
  };
}

/**
 * Mapeja la confiança de Gemini a la nostra escala.
 */
function mapConfidence(aiConfidence: number): PendingDocumentExtraction['confidence'] {
  if (aiConfidence >= 0.8) return 'high';
  if (aiConfidence >= 0.5) return 'medium';
  return 'low';
}

/**
 * Extreu dades d'una imatge de ticket pujada a Storage i actualitza el document Firestore.
 *
 * @param storage - Instància de Firebase Storage
 * @param firestore - Instància de Firestore
 * @param orgId - ID de l'organització
 * @param doc - Document pendent a processar
 * @returns Resultat de l'extracció
 */
export async function extractImageData(
  storage: FirebaseStorage,
  firestore: Firestore,
  orgId: string,
  doc: PendingDocument,
  idToken: string
): Promise<ExtractImageResult> {
  try {
    // Verificar que és una imatge
    const isImage = doc.file.contentType.startsWith('image/');

    if (!isImage) {
      return { success: true, extracted: false };
    }

    // Validem que el fitxer existeix, però el backend només rep el path intern.
    const storageRef = ref(storage, doc.file.storagePath);
    await getDownloadURL(storageRef);

    // Cridar l'API endpoint d'extracció de tickets
    const response = await fetch('/api/ai/extract-ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        orgId,
        storagePath: doc.file.storagePath,
        docId: doc.id,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        extracted: false,
        error: `Error API: ${response.status}`,
      };
    }

    const aiOutput = await response.json();

    // Si la confiança és molt baixa, no guardem res
    if (!aiOutput.ok || aiOutput.confidence < 0.3) {
      return {
        success: true,
        extracted: false,
        aiOutput,
      };
    }

    // Preparar l'update - només escriure camps que són null al document actual
    const updates: { [key: string]: string | number | PendingDocumentExtraction | FieldValue | null } = {
      updatedAt: serverTimestamp(),
    };

    // Camp extracted amb evidències
    const extraction: PendingDocumentExtraction = {
      source: 'ai',
      confidence: mapConfidence(aiOutput.confidence),
      evidence: {
        invoiceDate: aiOutput.date ?? undefined,
        amount: aiOutput.amount?.toString() ?? undefined,
        supplierName: aiOutput.merchant ?? undefined,
      },
    };
    updates.extracted = extraction;

    // Camps de dades (només si el document té el camp a null)
    const fields: ExtractImageResult['fields'] = {};

    if (doc.invoiceDate === null && aiOutput.date) {
      updates.invoiceDate = aiOutput.date;
      fields.invoiceDate = aiOutput.date;
    }

    if (doc.amount === null && aiOutput.amount !== null) {
      updates.amount = aiOutput.amount;
      fields.amount = aiOutput.amount;
    }

    // Actualitzar Firestore
    const docRef = pendingDocumentDoc(firestore, orgId, doc.id);
    await updateDoc(docRef, updates);

    return {
      success: true,
      extracted: Object.keys(fields).length > 0,
      aiOutput,
      fields,
    };
  } catch (error) {
    console.error('[extractImageData] Error:', error);
    return {
      success: false,
      extracted: false,
      error: error instanceof Error ? error.message : 'Error desconegut',
    };
  }
}
