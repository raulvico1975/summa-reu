// src/lib/fiscal/assertFiscalInvariant.ts
// Asserts per garantir invariants fiscals A1-A3 abans d'escriure a Firestore

import type { Firestore } from 'firebase/firestore';
import { reportSystemIncident } from '../system-incidents';

// =============================================================================
// TIPUS
// =============================================================================

/**
 * Candidat a transacció fiscal per validar
 */
export interface FiscalTxCandidate {
  transactionType?: 'return' | 'return_fee' | 'donation' | 'fee' | 'normal';
  amount: number;
  contactId?: string | null;
  source?: 'bank' | 'remittance' | 'manual' | 'stripe';
}

/**
 * Context per reportar incidents
 */
export interface AssertFiscalContext {
  firestore?: Firestore;
  orgId: string;
  operation: 'createReturn' | 'createDonation' | 'splitRemittance' | 'stripeImport';
  route?: string;
}

// =============================================================================
// INVARIANTS
// =============================================================================

/**
 * Valida que una transacció fiscal compleix els invariants A1 i A2 abans de guardar.
 *
 * ## Invariant A1: contactId segons tipus
 * - return: contactId OBLIGATORI
 * - remittance IN (amount > 0): contactId OBLIGATORI
 * - stripe donation: contactId OPCIONAL (excepció controlada)
 * - fee: contactId MAI (ha de ser null/undefined)
 *
 * ## Invariant A2: Coherència de signes
 * - return: amount < 0
 * - donation: amount > 0
 * - fee: amount < 0
 *
 * @throws Error amb codi A1_VIOLATED o A2_VIOLATED si falla
 */
export function assertFiscalTxCanBeSaved(
  tx: FiscalTxCandidate,
  context: AssertFiscalContext
): void {
  // ==========================================================================
  // A1: contactId segons tipus
  // ==========================================================================

  // Returns: contactId OBLIGATORI
  if (tx.transactionType === 'return' && !tx.contactId) {
    reportAndThrow(
      'A1_VIOLATED',
      'Return transaction requires contactId',
      tx,
      context
    );
  }

  // Remittance IN (quotes positives): contactId OBLIGATORI
  if (tx.source === 'remittance' && tx.amount > 0 && !tx.contactId) {
    reportAndThrow(
      'A1_VIOLATED',
      'Remittance IN (positive amount) requires contactId',
      tx,
      context
    );
  }

  // Fee: contactId MAI (ha de ser null/undefined)
  if (tx.transactionType === 'fee' && tx.contactId) {
    reportAndThrow(
      'A1_VIOLATED',
      'Fee transaction must NOT have contactId',
      tx,
      context
    );
  }

  // Stripe donations: contactId OPCIONAL (no validem, és excepció controlada)
  // Les donacions Stripe sense contactId queden excloses del càlcul fiscal

  // ==========================================================================
  // A2: Coherència de signes (amount)
  // ==========================================================================

  // Returns: amount < 0
  if (tx.transactionType === 'return' && tx.amount >= 0) {
    reportAndThrow(
      'A2_VIOLATED',
      'Return transaction must have negative amount',
      tx,
      context
    );
  }

  // Donations: amount > 0
  if (tx.transactionType === 'donation' && tx.amount <= 0) {
    reportAndThrow(
      'A2_VIOLATED',
      'Donation transaction must have positive amount',
      tx,
      context
    );
  }

  // Fees: amount < 0
  if (tx.transactionType === 'fee' && tx.amount >= 0) {
    reportAndThrow(
      'A2_VIOLATED',
      'Fee transaction must have negative amount',
      tx,
      context
    );
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Reporta incident a sistema i llença error
 */
function reportAndThrow(
  code: 'A1_VIOLATED' | 'A2_VIOLATED',
  message: string,
  tx: FiscalTxCandidate,
  context: AssertFiscalContext
): never {
  const fullMessage = `[${code}] ${message}`;

  // Reportar incident de forma asíncrona (no bloqueja)
  if (context.firestore) {
    reportSystemIncident({
      firestore: context.firestore,
      type: 'INVARIANT_BROKEN',
      message: fullMessage,
      route: context.route,
      orgId: context.orgId,
      meta: {
        operation: context.operation,
        invariantCode: code,
        transactionType: tx.transactionType,
        amount: tx.amount,
        hasContactId: !!tx.contactId,
        source: tx.source,
      },
    }).catch((err) => {
      console.error('[assertFiscalInvariant] Error reporting incident:', err);
    });
  }

  // Log per debug
  console.error(`[assertFiscalInvariant] ${fullMessage}`, {
    orgId: context.orgId,
    operation: context.operation,
    tx: {
      transactionType: tx.transactionType,
      amount: tx.amount,
      hasContactId: !!tx.contactId,
      source: tx.source,
    },
  });

  throw new Error(`Fiscal invariant violated: ${fullMessage}`);
}

/**
 * Versió "soft" que només retorna true/false sense llençar error
 * Útil per validacions prèvies a la UI
 */
export function isFiscalTxValid(tx: FiscalTxCandidate): boolean {
  try {
    assertFiscalTxCanBeSaved(tx, {
      orgId: 'validation-only',
      operation: 'createReturn',
    });
    return true;
  } catch {
    return false;
  }
}
