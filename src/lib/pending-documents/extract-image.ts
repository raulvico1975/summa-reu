// src/lib/pending-documents/extract-image.ts
// Servei per extreure dades d'una imatge de ticket i actualitzar el pendingDocument

import { FirebaseStorage } from 'firebase/storage';
import { Firestore } from 'firebase/firestore';
import type { PendingDocument } from './types';

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
        context: 'movements',
        target: 'pending',
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

    return {
      success: true,
      extracted: aiOutput.persisted === true && aiOutput.confidence >= 0.3,
      aiOutput,
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
