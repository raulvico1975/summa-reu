import type { Transaction } from '@/lib/data';

export type DeleteTransactionBlockedReason = 'parentRemittance' | 'childRemittance';

const DERIVED_TRANSACTION_TYPES = new Set(['donation', 'fee', 'return']);
const DERIVED_SOURCES = new Set(['remittance', 'stripe']);

/**
 * Retorna el motiu de bloqueig d'eliminació si la transacció té derivats.
 * Contracte UI:
 * - Pare (remesa/desglossament): bloquejar eliminar
 * - Filla/vinculada: bloquejar eliminar
 */
export function getDeleteTransactionBlockedReason(
  tx: Transaction
): DeleteTransactionBlockedReason | null {
  if (tx.isRemittance === true || !!tx.stripeTransferId) {
    return 'parentRemittance';
  }

  if (tx.isRemittanceItem === true) {
    return 'childRemittance';
  }

  if (tx.parentTransactionId != null) {
    return 'childRemittance';
  }

  if (
    tx.transactionType &&
    DERIVED_TRANSACTION_TYPES.has(tx.transactionType) &&
    tx.source &&
    DERIVED_SOURCES.has(tx.source)
  ) {
    return 'childRemittance';
  }

  return null;
}

export function canDeleteTransaction(tx: Transaction): boolean {
  return getDeleteTransactionBlockedReason(tx) === null;
}
