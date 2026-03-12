// src/lib/fiscal/undoProcessing.ts
// Lògica per desfer processaments de remeses (quotes, returns, Stripe)
// Utilitza soft-delete per filles fiscals i locks per multiusuari

import {
  doc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  deleteField,
  addDoc,
  type Firestore,
} from 'firebase/firestore';
import type { Transaction } from '../data';
import { isFiscallyRelevantTransaction } from './softDeleteTransaction';
import { acquireProcessLock, releaseProcessLock, type LockOperation } from './processLocks';
import {
  filterActiveRemittanceChildren,
  isActiveRemittanceChild,
} from '../remittances/is-active-child';

// =============================================================================
// TIPUS
// =============================================================================

export type UndoOperationType = 'remittance_in' | 'returns' | 'payments' | 'stripe';

export interface UndoContext {
  firestore: Firestore;
  orgId: string;
  userId: string;
}

export interface UndoResult {
  success: boolean;
  childrenArchived: number;
  childrenDeleted: number;
  error?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Resolveix el recompte de filles amb fallback parentTransactionId -> remittanceId.
 */
export function resolveUndoChildCount(
  parentMatchCount: number,
  remittanceDocIds: string[],
  parentTxId: string,
  remittanceId?: string | null
): number {
  if (parentMatchCount > 0) {
    return parentMatchCount;
  }

  if (!remittanceId) {
    return 0;
  }

  return remittanceDocIds.filter((id) => id !== parentTxId).length;
}

/**
 * Planifica la mida de cada chunk respectant límit batch i operacions extra finals.
 */
export function planUndoChunkSizes(
  totalChildren: number,
  batchSize = 50,
  extraOpsInLastBatch = 1
): number[] {
  if (totalChildren <= 0) {
    return [];
  }

  const sizes: number[] = [];
  const lastChunkMaxSize = Math.max(1, batchSize - extraOpsInLastBatch);
  let remaining = totalChildren;

  while (remaining > 0) {
    const isLastChunk = remaining <= batchSize;
    const take = isLastChunk ? Math.min(lastChunkMaxSize, remaining) : batchSize;
    sizes.push(take);
    remaining -= take;
  }

  return sizes;
}

/**
 * Detecta el tipus d'operació a desfer basant-se en la transacció pare
 */
export function detectUndoOperationType(tx: Transaction): UndoOperationType | null {
  // Stripe split: filles amb source='stripe'
  // El pare no té source='stripe' (és bancari) però ha generat filles Stripe
  // Detectem per existència de stripeTransferId o comprovant filles
  if (tx.stripeTransferId) {
    return 'stripe';
  }

  if (!tx.isRemittance) {
    return null;
  }

  // Remesa de devolucions
  if (tx.remittanceType === 'returns') {
    return 'returns';
  }

  // Remesa de pagaments
  if (tx.remittanceType === 'payments') {
    return 'payments';
  }

  // Remesa IN (quotes/donacions)
  if (tx.amount > 0) {
    return 'remittance_in';
  }

  // Fallback OUT sense remittanceType explícit
  if (tx.amount < 0) {
    return 'payments';
  }

  return null;
}

/**
 * Obté el text de confirmació segons el tipus
 */
export function getUndoConfirmationText(type: UndoOperationType): string {
  switch (type) {
    case 'remittance_in':
      return 'DESFER QUOTES';
    case 'returns':
      return 'DESFER DEVOLUCIONS';
    case 'payments':
      return 'DESFER PAGAMENTS';
    case 'stripe':
      return 'DESFER STRIPE';
  }
}

/**
 * Obté el títol del diàleg segons el tipus
 */
export function getUndoDialogTitle(type: UndoOperationType): string {
  switch (type) {
    case 'remittance_in':
      return 'Desfer remesa de quotes';
    case 'returns':
      return 'Desfer remesa de devolucions';
    case 'payments':
      return 'Desfer remesa de pagaments';
    case 'stripe':
      return 'Desfer import Stripe';
  }
}

/**
 * Obté la descripció del diàleg segons el tipus i nombre de filles
 */
export function getUndoDialogDescription(type: UndoOperationType, childCount: number): string {
  const baseText = `S'arxivaran ${childCount} transacció${childCount !== 1 ? 'ns' : ''} filla${childCount !== 1 ? 'es' : ''} i podràs processar de nou.`;

  switch (type) {
    case 'remittance_in':
      return `Això NO esborra el moviment bancari. ${baseText}`;
    case 'returns':
      return `Això NO esborra el moviment bancari. ${baseText} Les devolucions s'arxivaran (no s'eliminaran).`;
    case 'payments':
      return `Això ELIMINARÀ permanentment ${childCount} transacció${childCount !== 1 ? 'ns' : ''} filla${childCount !== 1 ? 'es' : ''} i el document de remesa.`;
    case 'stripe':
      return `Això NO esborra el moviment bancari. ${baseText} Les donacions Stripe s'arxivaran.`;
  }
}

// =============================================================================
// FUNCIONS PRINCIPALS
// =============================================================================

/**
 * Compta les transaccions filles d'un pare
 */
export async function countChildTransactions(
  firestore: Firestore,
  orgId: string,
  parentTxId: string,
  remittanceId?: string | null
): Promise<number> {
  const transactionsRef = collection(firestore, 'organizations', orgId, 'transactions');

  // Buscar per parentTransactionId O per remittanceId
  let count = 0;

  // Mètode 1: parentTransactionId (Stripe i nous processaments)
  const byParentQuery = query(
    transactionsRef,
    where('parentTransactionId', '==', parentTxId)
  );
  const byParentSnap = await getDocs(byParentQuery);
  const byParentCount = filterActiveRemittanceChildren(
    byParentSnap.docs.map((d) => ({ ...(d.data() as Transaction), id: d.id }))
  ).length;

  // Mètode 2: remittanceId (remeses legacy)
  let remittanceDocIds: string[] = [];
  if (remittanceId && byParentCount === 0) {
    const byRemittanceQuery = query(
      transactionsRef,
      where('remittanceId', '==', remittanceId)
    );
    const byRemittanceSnap = await getDocs(byRemittanceQuery);
    remittanceDocIds = filterActiveRemittanceChildren(
      byRemittanceSnap.docs.map((d) => ({ ...(d.data() as Transaction), id: d.id }))
    ).map((d) => d.id);
  }

  count = resolveUndoChildCount(byParentCount, remittanceDocIds, parentTxId, remittanceId);
  return count;
}

/**
 * Executa l'operació d'undo amb locks i soft-delete
 */
export async function executeUndo(
  parentTx: Transaction,
  operationType: UndoOperationType,
  context: UndoContext
): Promise<UndoResult> {
  const { firestore, orgId, userId } = context;
  const parentTxId = parentTx.id;

  // Determinar operació de lock
  const lockOperation: LockOperation = 'undoRemittance';

  // Adquirir lock
  const lockResult = await acquireProcessLock({
    firestore,
    orgId,
    parentTxId,
    operation: lockOperation,
    uid: userId,
  });

  if (!lockResult.ok) {
    return {
      success: false,
      childrenArchived: 0,
      childrenDeleted: 0,
      error: lockResult.reason === 'locked_by_other'
        ? 'Un altre usuari està processant aquesta transacció'
        : 'No s\'ha pogut adquirir el lock',
    };
  }

  try {
    const BATCH_SIZE = 50;
    const transactionsRef = collection(firestore, 'organizations', orgId, 'transactions');
    const now = new Date().toISOString();

    // Buscar totes les filles
    const children: { id: string; data: Transaction }[] = [];

    // Buscar per parentTransactionId
    const byParentQuery = query(
      transactionsRef,
      where('parentTransactionId', '==', parentTxId)
    );
    const byParentSnap = await getDocs(byParentQuery);
    byParentSnap.forEach(d => {
      const childData = { id: d.id, ...d.data() } as Transaction;
      if (isActiveRemittanceChild(childData)) {
        children.push({ id: d.id, data: childData });
      }
    });

    // Buscar per remittanceId (legacy) si no hem trobat res
    if (children.length === 0 && parentTx.remittanceId) {
      const byRemittanceQuery = query(
        transactionsRef,
        where('remittanceId', '==', parentTx.remittanceId)
      );
      const byRemittanceSnap = await getDocs(byRemittanceQuery);
      byRemittanceSnap.forEach(d => {
        const childData = { id: d.id, ...d.data() } as Transaction;
        if (d.id !== parentTxId && isActiveRemittanceChild(childData)) {
          children.push({ id: d.id, data: childData });
        }
      });
    }

    let archivedCount = 0;
    let deletedCount = 0;

    // Processar filles en chunks de 50 (reservant ops finals al darrer batch)
    const extraOps = parentTx.remittanceId ? 2 : 1;
    const chunkSizes = planUndoChunkSizes(children.length, BATCH_SIZE, extraOps);

    let cursor = 0;
    for (const size of chunkSizes) {
      const chunk = children.slice(cursor, cursor + size);
      cursor += size;
      const batch = writeBatch(firestore);

      for (const child of chunk) {
        const childRef = doc(transactionsRef, child.id);

        if (operationType === 'payments') {
          // Pagaments OUT: sempre hard-delete
          batch.delete(childRef);
          deletedCount++;
        } else if (operationType === 'returns') {
          // Devolucions OUT: sempre soft-delete (arxivar)
          batch.update(childRef, {
            archivedAt: now,
            archivedByUid: userId,
            archivedReason: 'undo_process',
            archivedFromAction: `undo_${operationType}`,
          });
          archivedCount++;
        } else {
          // Stripe / remittance_in: decidir per fiscalitat
          if (isFiscallyRelevantTransaction(child.data)) {
            batch.update(childRef, {
              archivedAt: now,
              archivedByUid: userId,
              archivedReason: 'undo_process',
              archivedFromAction: `undo_${operationType}`,
            });
            archivedCount++;
          } else {
            batch.delete(childRef);
            deletedCount++;
          }
        }
      }

      // Afegir reset pare i delete remesa NOMÉS a l'últim batch
      if (cursor >= children.length) {
        // Eliminar document de remesa si existeix
        if (parentTx.remittanceId) {
          const remittanceRef = doc(firestore, 'organizations', orgId, 'remittances', parentTx.remittanceId);
          batch.delete(remittanceRef);
        }

        // Resetejar el pare
        batch.update(doc(transactionsRef, parentTxId), {
          // Camps de remesa
          isRemittance: deleteField(),
          remittanceId: deleteField(),
          remittanceItemCount: deleteField(),
          remittanceResolvedCount: deleteField(),
          remittancePendingCount: deleteField(),
          remittancePendingTotalAmount: deleteField(),
          remittanceType: deleteField(),
          remittanceDirection: deleteField(),
          remittanceStatus: deleteField(),
          pendingReturns: deleteField(),
          // Camps Stripe (si aplica)
          stripeTransferId: deleteField(),
          stripePayoutId: deleteField(),
          // Metadata
          updatedAt: now,
        });
      }

      await batch.commit();
    }

    // Cas edge: 0 filles (només reset pare)
    if (children.length === 0) {
      const batch = writeBatch(firestore);

      if (parentTx.remittanceId) {
        const remittanceRef = doc(firestore, 'organizations', orgId, 'remittances', parentTx.remittanceId);
        batch.delete(remittanceRef);
      }

      batch.update(doc(transactionsRef, parentTxId), {
        isRemittance: deleteField(),
        remittanceId: deleteField(),
        remittanceItemCount: deleteField(),
        remittanceResolvedCount: deleteField(),
        remittancePendingCount: deleteField(),
        remittancePendingTotalAmount: deleteField(),
        remittanceType: deleteField(),
        remittanceDirection: deleteField(),
        remittanceStatus: deleteField(),
        pendingReturns: deleteField(),
        stripeTransferId: deleteField(),
        stripePayoutId: deleteField(),
        updatedAt: now,
      });

      await batch.commit();
    }

    // Escriure audit log
    await writeUndoAuditLog(firestore, orgId, {
      action: 'UNDO_PROCESSING',
      parentTxId,
      operationType,
      childrenArchived: archivedCount,
      childrenDeleted: deletedCount,
      actorUid: userId,
      timestamp: now,
    });

    return {
      success: true,
      childrenArchived: archivedCount,
      childrenDeleted: deletedCount,
    };

  } finally {
    // Alliberar lock sempre
    await releaseProcessLock({
      firestore,
      orgId,
      parentTxId,
    });
  }
}

/**
 * Escriu un registre d'auditoria per l'undo
 */
async function writeUndoAuditLog(
  firestore: Firestore,
  orgId: string,
  data: {
    action: string;
    parentTxId: string;
    operationType: UndoOperationType;
    childrenArchived: number;
    childrenDeleted: number;
    actorUid: string;
    timestamp: string;
  }
): Promise<void> {
  try {
    const auditRef = collection(firestore, 'organizations', orgId, 'auditLogs');
    await addDoc(auditRef, data);
  } catch (error) {
    // No bloquejar l'operació principal si falla l'audit
    console.error('[undoProcessing] Error writing audit log:', error);
  }
}
