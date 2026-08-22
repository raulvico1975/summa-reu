// ═══════════════════════════════════════════════════════════════════════════════
// MODEL 182 — Agregació de donacions per a generació server-side
// ═══════════════════════════════════════════════════════════════════════════════
// Extret de src/components/donations-report-generator.tsx per permetre
// recompute server-side a /api/fiscal/model182/generate.
// Sense canvis de comportament respecte a la lògica original del component.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Transaction, AnyContact, Donor } from '@/lib/data';
import type { DonationReportRow } from '@/lib/model182-aeat';
import { buildCanonicalFiscalContributions } from '@/lib/fiscal/canonical-fiscal-contributions';

export interface Model182Candidate extends DonationReportRow {
  donorId: string;
  /** Suma dels moviments positius de donació de l'any, inclosos els retornats. */
  grossAmount: number;
  /** Suma dels moviments bancaris de devolució de l'any, amb signe negatiu. */
  returnsAmount: number;
  /** Nombre de moviments bancaris de devolució de l'any. */
  returnCount: number;
  /** Import negatiu que realment resta del net canònic (les parelles són 0). */
  canonicalReturnsAmount: number;
  /** Nombre de devolucions que realment resten del net canònic. */
  canonicalReturnCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓ PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construeix el conjunt de candidats per al Model 182 AEAT a partir de
 * transaccions actives (sense archivedAt) i contactes de tipus 'donor'.
 *
 * Replica exactament la lògica de handleGenerateReport a
 * src/components/donations-report-generator.tsx (invariant A2).
 *
 * @param activeTxs Transaccions ja filtrades (!archivedAt)
 * @param contacts  Tots els contactes de l'organització
 * @param year      Any fiscal del model (int)
 * @returns DonationReportRow[] en format acceptat per generateModel182AEATFile
 */
export function buildModel182Candidates(
  activeTxs: Transaction[],
  contacts: AnyContact[],
  year: number
): Model182Candidate[] {
  const year1 = year - 1;
  const year2 = year - 2;

  const donors = contacts.filter(c => c.type === 'donor') as Donor[];
  const donorMap = new Map(donors.map(d => [d.id, d]));

  const donationsByDonor: Record<string, {
    donor: Donor;
    total: number;
    returned: number;
    grossAmount: number;
    returnsAmount: number;
    returnCount: number;
    canonicalReturnsAmount: number;
    canonicalReturnCount: number;
    totalYear1: number;
    totalYear2: number;
  }> = {};

  // ═══════════════════════════════════════════════════════════════════════
  // PROCESSAR TOTES LES TRANSACCIONS ACTIVES (any actual + històric)
  // HOTFIX: activeTxs ja filtrades client-side amb tolerància !tx.archivedAt
  // ═══════════════════════════════════════════════════════════════════════
  const canonicalContributions = buildCanonicalFiscalContributions(activeTxs);

  for (const contribution of canonicalContributions.contributions) {
    const tx = contribution.tx as Transaction;
    const txYear = new Date(tx.date).getFullYear();

    if (!tx.contactId || !donorMap.has(tx.contactId)) continue;

    if (!donationsByDonor[tx.contactId]) {
      donationsByDonor[tx.contactId] = {
        donor: donorMap.get(tx.contactId)!,
        total: 0,
        returned: 0,
        grossAmount: 0,
        returnsAmount: 0,
        returnCount: 0,
        canonicalReturnsAmount: 0,
        canonicalReturnCount: 0,
        totalYear1: 0,
        totalYear2: 0,
      };
    }

    const netAmount = contribution.canonicalAmount;

    if (txYear === year) {
      if (
        !tx.archivedAt &&
        !tx.isRemittance &&
        !tx.isSplit &&
        tx.amount > 0 &&
        tx.transactionType === 'donation'
      ) {
        donationsByDonor[tx.contactId].grossAmount += tx.amount;
      }

      if (
        !tx.archivedAt &&
        !tx.isRemittance &&
        !tx.isSplit &&
        tx.amount < 0 &&
        tx.transactionType === 'return'
      ) {
        donationsByDonor[tx.contactId].returnsAmount += tx.amount;
        donationsByDonor[tx.contactId].returnCount += 1;
      }

      if (netAmount > 0) {
        donationsByDonor[tx.contactId].total += netAmount;
      } else if (netAmount < 0) {
        donationsByDonor[tx.contactId].returned += Math.abs(netAmount);
        donationsByDonor[tx.contactId].canonicalReturnsAmount += netAmount;
        donationsByDonor[tx.contactId].canonicalReturnCount += 1;
      }
    } else if (txYear === year1) {
      donationsByDonor[tx.contactId].totalYear1 += Math.max(0, netAmount);
    } else if (txYear === year2) {
      donationsByDonor[tx.contactId].totalYear2 += Math.max(0, netAmount);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CALCULAR TOTAL NET I CONSTRUIR LLISTA PER generateModel182AEATFile
  // ═══════════════════════════════════════════════════════════════════════
  return Object.entries(donationsByDonor)
    .map(([donorId, { donor, total, returned, grossAmount, returnsAmount, returnCount, canonicalReturnsAmount, canonicalReturnCount, totalYear1, totalYear2 }]) => {
      const netAmount = Math.max(0, total - returned);
      return {
        donorId,
        donor: {
          name: donor.name,
          taxId: donor.taxId,
          zipCode: donor.zipCode,
          donorType: donor.donorType === 'company' ? 'company' as const : 'individual' as const,
        },
        totalAmount: netAmount,
        previousYearAmount: totalYear1,
        twoYearsAgoAmount: totalYear2,
        grossAmount,
        returnsAmount,
        returnCount,
        canonicalReturnsAmount,
        canonicalReturnCount,
      };
    })
    .filter(row => row.totalAmount > 0)
    .sort((a, b) => b.totalAmount - a.totalAmount);
}
