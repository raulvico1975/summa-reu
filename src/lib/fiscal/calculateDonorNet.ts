// src/lib/fiscal/calculateDonorNet.ts
// Motor únic de càlcul fiscal per donants
// Centralitza la lògica duplicada en donor-detail-drawer, donation-certificate-generator, etc.

import { buildCanonicalFiscalContributions } from '@/lib/fiscal/canonical-fiscal-contributions';

/**
 * Input per al càlcul del net fiscal d'un donant
 */
export interface DonorNetInput {
  transactions: Array<{
    amount: number;
    date: string;
    transactionType?: string;
    donationStatus?: string;
    contactId?: string | null;
    archivedAt?: string | null;
    isSplit?: boolean;
    isRemittance?: boolean;
  }>;
  donorId: string;
  year: number;
}

/**
 * Resultat del càlcul fiscal
 * IMPORTANT: netCents NO fa clamp a 0. El motor retorna el valor real.
 * La UI pot decidir mostrar 0 si cal, però el motor no menteix.
 */
export interface DonorNetResult {
  grossDonationsCents: number;
  returnsCents: number;       // Negatiu (o 0)
  netCents: number;           // Pot ser negatiu si returns > donations
  donationsCount: number;
  returnsCount: number;
}

/**
 * Calcula el net fiscal d'un donant per a un any específic.
 *
 * Criteris:
 * - Donacions fiscals: transactionType === 'donation'
 * - Devolucions: transactionType === 'return' (amount < 0) o donationStatus === 'returned'
 * - Exclusions: archivedAt informat o pare de remesa (isRemittance === true)
 * - Net: gross + returns (returns són negatius, per tant és una resta)
 *
 * NO fa clamp a 0: si hi ha més devolucions que donacions, retorna negatiu.
 */
export function calculateDonorNet(input: DonorNetInput): DonorNetResult {
  const { transactions, donorId, year } = input;
  const yearStr = year.toString();
  const contributions = buildCanonicalFiscalContributions(input.transactions).contributions;

  let grossDonationsCents = 0;
  let returnsCents = 0;
  let donationsCount = 0;
  let returnsCount = 0;

  for (const contribution of contributions) {
    const tx = contribution.tx;
    // Només transaccions d'aquest donant
    if (tx.contactId !== donorId) continue;

    // Només transaccions de l'any especificat
    if (!tx.date.startsWith(yearStr)) continue;

    const netAmount = contribution.canonicalAmount;
    if (netAmount > 0) {
      grossDonationsCents += Math.round(netAmount * 100);
      donationsCount++;
    }

    if (netAmount < 0) {
      // returnsCents serà negatiu
      returnsCents += Math.round(netAmount * 100);
      returnsCount++;
    }
  }

  return {
    grossDonationsCents,
    returnsCents,
    // Net = gross + returns (returns és negatiu, per tant és una resta)
    // NO fem clamp a 0: el motor no menteix
    netCents: grossDonationsCents + returnsCents,
    donationsCount,
    returnsCount,
  };
}

/**
 * Versió en euros (per comoditat de la UI)
 */
export interface DonorNetResultEuros {
  grossDonations: number;
  returns: number;
  net: number;
  donationsCount: number;
  returnsCount: number;
}

export function calculateDonorNetEuros(input: DonorNetInput): DonorNetResultEuros {
  const result = calculateDonorNet(input);
  return {
    grossDonations: result.grossDonationsCents / 100,
    returns: result.returnsCents / 100,
    net: result.netCents / 100,
    donationsCount: result.donationsCount,
    returnsCount: result.returnsCount,
  };
}
