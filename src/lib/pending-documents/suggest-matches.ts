// src/lib/pending-documents/suggest-matches.ts
// Servei de suggeriment de conciliació entre transaccions i documents pendents

import {
  query,
  where,
  getDocs,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import type { Transaction, Contact } from '@/lib/data';
import type { PendingDocument } from './types';
import type { PrebankRemittance } from './sepa-remittance';
import { pendingDocumentsCollection, pendingDocumentDoc } from './refs';
import { prebankRemittancesCollection, prebankRemittanceDoc } from './sepa-remittance';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface MatchScore {
  docId: string;
  transactionId: string;
  score: number;
  reasons: string[];
}

export interface SuggestMatchesResult {
  /** Documents amb suggeriments actualitzats */
  suggestedCount: number;
  /** Remeses SEPA auto-vinculades */
  linkedRemittanceCount: number;
  /** Detalls per debug */
  details: {
    docMatches: MatchScore[];
    remittanceMatches: string[];
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

// Scoring thresholds
const MIN_SCORE_THRESHOLD = 60;
const MAX_SUGGESTIONS_PER_DOC = 3;

// Score values
const SCORE_EXACT_AMOUNT = 60;
const SCORE_DATE_WITHIN_7_DAYS = 20;
const SCORE_SUPPLIER_NAME_MATCH = 10;
const SCORE_IBAN_MATCH = 20;

// Date tolerance (in days)
const DATE_TOLERANCE_INDIVIDUAL = 7;
const DATE_TOLERANCE_REMITTANCE = 3;

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcula la diferència en dies entre dues dates.
 */
function daysDifference(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffMs = Math.abs(d1.getTime() - d2.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Normalitza text per comparació (minúscules, sense accents).
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Comprova si el text del moviment conté el nom del proveïdor.
 */
function descriptionContainsSupplierName(description: string, supplierName: string): boolean {
  const normalizedDesc = normalizeText(description);
  const normalizedName = normalizeText(supplierName);

  // Dividir nom en tokens significatius (mínim 3 chars)
  const tokens = normalizedName.split(' ').filter(t => t.length >= 3);

  if (tokens.length === 0) return false;

  // Mínim 50% dels tokens han de coincidir
  const matchedTokens = tokens.filter(t => normalizedDesc.includes(t));
  return matchedTokens.length >= Math.ceil(tokens.length / 2);
}

/**
 * Normalitza IBAN per comparació.
 */
function normalizeIban(iban: string | null | undefined): string {
  if (!iban) return '';
  return iban.replace(/\s/g, '').toUpperCase();
}

// ═══════════════════════════════════════════════════════════════════════════
// SCORING - DOCUMENTS INDIVIDUALS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcula el score de coincidència entre una transacció i un document pendent.
 */
export function calculateMatchScore(
  transaction: Transaction,
  pendingDoc: PendingDocument,
  supplier: Contact | null
): MatchScore {
  const reasons: string[] = [];
  let score = 0;

  // 1. Import exacte (+60)
  if (pendingDoc.amount !== null) {
    const txAmount = Math.abs(transaction.amount);
    const docAmount = Math.abs(pendingDoc.amount);

    if (Math.abs(txAmount - docAmount) < 0.01) {
      score += SCORE_EXACT_AMOUNT;
      reasons.push(`Import exacte: ${docAmount.toFixed(2)}€`);
    }
  }

  // 2. Data dins ±7 dies (+20)
  if (pendingDoc.invoiceDate) {
    const daysDiff = daysDifference(transaction.date, pendingDoc.invoiceDate);
    if (daysDiff <= DATE_TOLERANCE_INDIVIDUAL) {
      score += SCORE_DATE_WITHIN_7_DAYS;
      reasons.push(`Data propera (${daysDiff} dies)`);
    }
  }

  // 3. Nom proveïdor al concepte (+10)
  if (supplier) {
    if (descriptionContainsSupplierName(transaction.description, supplier.name)) {
      score += SCORE_SUPPLIER_NAME_MATCH;
      reasons.push(`Nom proveïdor al concepte`);
    }
  }

  // 4. IBAN coincideix (+20)
  if (supplier) {
    const supplierWithIban = supplier as Contact & { iban?: string };
    const supplierIban = normalizeIban(supplierWithIban.iban);

    if (supplierIban && transaction.description) {
      // Buscar IBAN al concepte (alguns bancs l'inclouen)
      const normalizedDesc = transaction.description.replace(/\s/g, '').toUpperCase();
      if (normalizedDesc.includes(supplierIban)) {
        score += SCORE_IBAN_MATCH;
        reasons.push('IBAN coincideix');
      }
    }
  }

  return {
    docId: pendingDoc.id,
    transactionId: transaction.id,
    score,
    reasons,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FUNCTION - SUGGEST MATCHES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Processa noves transaccions i suggereix matches amb documents pendents.
 *
 * Per cada transacció nova:
 * 1. Busca documents confirmed que podrien coincidir
 * 2. Calcula scores
 * 3. Desa suggeriments als documents (màx 3, score >= 60)
 *
 * Per transaccions negatives:
 * 1. Busca remeses SEPA prebank_generated que coincideixin
 * 2. Si match, marca la remesa com matched_to_bank
 *
 * @param firestore - Instància de Firestore
 * @param orgId - ID de l'organització
 * @param newTransactions - Transaccions recentment importades
 * @param contacts - Llista de contactes per matching
 */
export async function suggestPendingDocumentMatches(
  firestore: Firestore,
  orgId: string,
  newTransactions: Transaction[],
  contacts: Contact[]
): Promise<SuggestMatchesResult> {
  if (newTransactions.length === 0) {
    return {
      suggestedCount: 0,
      linkedRemittanceCount: 0,
      details: { docMatches: [], remittanceMatches: [] },
    };
  }

  // 1. Carregar documents pendents confirmats
  const docsQuery = query(
    pendingDocumentsCollection(firestore, orgId),
    where('status', '==', 'confirmed')
  );
  const docsSnapshot = await getDocs(docsQuery);
  const pendingDocs: PendingDocument[] = docsSnapshot.docs.map(d => {
    const data = d.data();
    return { ...data, id: d.id } as PendingDocument;
  });

  // 2. Carregar remeses SEPA pre-banc
  const remittancesQuery = query(
    prebankRemittancesCollection(firestore, orgId),
    where('status', '==', 'prebank_generated')
  );
  const remittancesSnapshot = await getDocs(remittancesQuery);
  const remittances: PrebankRemittance[] = remittancesSnapshot.docs.map(d => {
    const data = d.data();
    return { ...data, id: d.id } as PrebankRemittance;
  });

  // 3. Preparar mapa de contactes
  const contactsMap = new Map<string, Contact>();
  contacts.forEach(c => contactsMap.set(c.id, c));

  // 4. Calcular scores per cada combinació tx-doc
  const docScores = new Map<string, MatchScore[]>();

  for (const tx of newTransactions) {
    for (const pendingDoc of pendingDocs) {
      const supplier = pendingDoc.supplierId ? contactsMap.get(pendingDoc.supplierId) : null;
      const score = calculateMatchScore(tx, pendingDoc, supplier ?? null);

      if (score.score >= MIN_SCORE_THRESHOLD) {
        const existingScores = docScores.get(pendingDoc.id) || [];
        existingScores.push(score);
        docScores.set(pendingDoc.id, existingScores);
      }
    }
  }

  // 5. Seleccionar millors suggeriments per document (màx 3)
  const updates: { docId: string; transactionIds: string[] }[] = [];
  const allDocMatches: MatchScore[] = [];

  for (const [docId, scores] of docScores) {
    // Ordenar per score descendent
    scores.sort((a, b) => b.score - a.score);

    // Agafar màxim 3
    const topScores = scores.slice(0, MAX_SUGGESTIONS_PER_DOC);
    const transactionIds = topScores.map(s => s.transactionId);

    updates.push({ docId, transactionIds });
    allDocMatches.push(...topScores);
  }

  // 6. Auto-vincle de remeses SEPA
  const remittanceMatches: string[] = [];

  for (const tx of newTransactions) {
    // Només transaccions negatives (pagaments)
    if (tx.amount >= 0) continue;

    for (const remittance of remittances) {
      // Comprovar condicions de match
      const txAmount = Math.abs(tx.amount);
      const amountMatch = Math.abs(txAmount - remittance.ctrlSum) < 0.01;
      const bankMatch = tx.bankAccountId === remittance.debtorBankAccountId;
      const dateMatch = daysDifference(tx.date, remittance.executionDate) <= DATE_TOLERANCE_REMITTANCE;

      if (amountMatch && bankMatch && dateMatch) {
        remittanceMatches.push(remittance.id);
      }
    }
  }

  // 7. Batch update: documents amb suggeriments
  if (updates.length > 0 || remittanceMatches.length > 0) {
    const BATCH_SIZE = 50;

    // Processar updates de documents
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = writeBatch(firestore);
      const chunk = updates.slice(i, i + BATCH_SIZE);

      for (const { docId, transactionIds } of chunk) {
        const docRef = pendingDocumentDoc(firestore, orgId, docId);
        batch.update(docRef, {
          suggestedTransactionIds: transactionIds,
        });
      }

      await batch.commit();
    }

    // Processar remeses (un per un, són pocs)
    for (const remittanceId of remittanceMatches) {
      const matchedTx = newTransactions.find(tx => {
        const remittance = remittances.find(r => r.id === remittanceId);
        if (!remittance) return false;

        const txAmount = Math.abs(tx.amount);
        const amountMatch = Math.abs(txAmount - remittance.ctrlSum) < 0.01;
        const bankMatch = tx.bankAccountId === remittance.debtorBankAccountId;
        const dateMatch = daysDifference(tx.date, remittance.executionDate) <= DATE_TOLERANCE_REMITTANCE;

        return amountMatch && bankMatch && dateMatch;
      });

      if (matchedTx) {
        const remittanceRef = prebankRemittanceDoc(firestore, orgId, remittanceId);
        await updateDoc(remittanceRef, {
          status: 'matched_to_bank',
          parentTransactionId: matchedTx.id,
        });
      }
    }
  }

  return {
    suggestedCount: updates.length,
    linkedRemittanceCount: remittanceMatches.length,
    details: {
      docMatches: allDocMatches,
      remittanceMatches,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCIONS DE CONCILIACIÓ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Vincula un document pendent amb una transacció.
 *
 * Efectes:
 * - pendingDocument.status = 'matched'
 * - pendingDocument.matchedTransactionId = txId
 * - pendingDocument.suggestedTransactionIds = []
 * - ignoredTransactionIds es manté intacte
 * - transaction.document = downloadUrl (si el doc té fitxer i la tx no en té)
 * - transaction.category = doc.categoryId (si no té)
 * - transaction.contactId = doc.supplierId (si no té)
 *
 * @param firestore - Instància de Firestore
 * @param storage - Instància de Firebase Storage (necessària per obtenir downloadUrl)
 * @param orgId - ID de l'organització
 * @param pendingDoc - Document pendent a vincular
 * @param transactionId - ID de la transacció bancària
 */
export async function linkDocumentToTransaction(
  firestore: Firestore,
  storage: FirebaseStorage,
  orgId: string,
  pendingDoc: PendingDocument,
  transactionId: string
): Promise<void> {
  void storage;
  const user = getAuth(firestore.app).currentUser;
  if (!user) throw new Error('Sessió no vàlida');
  const response = await fetch('/api/pending-documents/link-transaction', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ orgId, pendingDocumentId: pendingDoc.id, transactionId }),
  });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error ?? 'No s\'ha pogut vincular el document');
}

/**
 * Ignora un suggeriment de conciliació.
 *
 * Efectes:
 * - Elimina txId de suggestedTransactionIds
 * - Afegeix txId a ignoredTransactionIds (per no tornar a suggerir)
 */
export async function ignoreMatchSuggestion(
  firestore: Firestore,
  orgId: string,
  pendingDoc: PendingDocument,
  transactionId: string
): Promise<void> {
  const docRef = pendingDocumentDoc(firestore, orgId, pendingDoc.id);

  // Eliminar de suggeriments
  const newSuggested = (pendingDoc.suggestedTransactionIds || [])
    .filter(id => id !== transactionId);

  // Afegir a ignorats
  const ignored = (pendingDoc as PendingDocument & { ignoredTransactionIds?: string[] })
    .ignoredTransactionIds || [];
  const newIgnored = [...ignored, transactionId];

  await updateDoc(docRef, {
    suggestedTransactionIds: newSuggested,
    ignoredTransactionIds: newIgnored,
  });
}
