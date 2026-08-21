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
): DonationReportRow[] {
  const year1 = year - 1;
  const year2 = year - 2;

  const donors = contacts.filter(c => c.type === 'donor') as Donor[];
  const donorMap = new Map(donors.map(d => [d.id, d]));

  const donationsByDonor: Record<string, {
    donor: Donor;
    total: number;
    returned: number;
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
        totalYear1: 0,
        totalYear2: 0,
      };
    }

    const netAmount = contribution.canonicalAmount;

    if (txYear === year) {
      if (netAmount > 0) {
        donationsByDonor[tx.contactId].total += netAmount;
      } else {
        donationsByDonor[tx.contactId].returned += Math.abs(netAmount);
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
  return Object.values(donationsByDonor)
    .map(({ donor, total, returned, totalYear1, totalYear2 }) => {
      const netAmount = Math.max(0, total - returned);
      return {
        donor: {
          name: donor.name,
          taxId: donor.taxId,
          zipCode: donor.zipCode,
          donorType: donor.donorType === 'company' ? 'company' as const : 'individual' as const,
        },
        totalAmount: netAmount,
        previousYearAmount: totalYear1,
        twoYearsAgoAmount: totalYear2,
      };
    })
    .filter(row => row.totalAmount > 0)
    .sort((a, b) => b.totalAmount - a.totalAmount);
}
