import type { Transaction } from '@/lib/data';

/**
 * Regla de visibilitat ledger:
 * 1) Amagar sempre filles de remesa (isRemittanceItem=true)
 * 1b) Fallback legacy: si té parentTransactionId + source='remittance', també és filla
 * 2) Si showArchived=false, amagar transaccions arxivades (archivedAt no buit)
 * 3) Altrament mostrar (incloent pares de remesa, independentment de source)
 */
export function isVisibleInMovementsLedger(
  tx: Pick<Transaction, 'isRemittance' | 'isRemittanceItem' | 'source' | 'archivedAt' | 'parentTransactionId'>,
  { showArchived }: { showArchived: boolean }
): boolean {
  if (tx.isRemittanceItem === true) return false;
  if (tx.source === 'remittance' && !!tx.parentTransactionId) return false;
  if (!showArchived && tx.archivedAt != null && tx.archivedAt !== '') return false;
  return true;
}
