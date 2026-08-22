/**
 * Lògica pura de càlcul per al Model 182 (Declaració informativa de donatius)
 *
 * Aquesta funció no depèn de Firebase ni cap altre servei extern,
 * per tal de poder ser testejada fàcilment amb tests unitaris.
 */
import { buildCanonicalFiscalContributions } from '@/lib/fiscal/canonical-fiscal-contributions';

// =============================================================================
// TIPUS
// =============================================================================

export interface Donor {
  id: string;
  name: string;
  taxId: string;
  zipCode: string;
  province?: string;
  donorType: 'individual' | 'company';
}

export interface Transaction {
  id?: string;
  contactId?: string | null;
  date: string;
  amount: number;
  transactionType?: string;    // 'return' per devolucions
  donationStatus?: string;     // 'returned' per donacions retornades
  archivedAt?: string | null;  // soft-delete: excloure del còmput fiscal
  isRemittance?: boolean;      // pare de remesa: ignorar del còmput fiscal
  isSplit?: boolean;           // pare de split: ignorar del còmput fiscal
  linkedTransactionId?: string | null;
}

export interface DonorTotals {
  donorId: string;
  donor: Donor;
  totalAmount: number;         // Total net de l'any seleccionat
  returnedAmount: number;      // Import retornat de l'any seleccionat
  valor1: number;              // Total any anterior (year-1)
  valor2: number;              // Total dos anys abans (year-2)
  recurrente: boolean;         // true si valor1 > 0 AND valor2 > 0
}

export interface Model182Result {
  donorTotals: DonorTotals[];
  stats: {
    totalDonors: number;
    totalAmount: number;
    excludedReturns: number;
    excludedAmount: number;
  };
}

// =============================================================================
// FUNCIONS AUXILIARS
// =============================================================================

function isArchivedTransaction(tx: Transaction): boolean {
  return tx.archivedAt != null && tx.archivedAt !== '';
}

function isRemittanceParent(tx: Transaction): boolean {
  return tx.isRemittance === true;
}

function isSplitParent(tx: Transaction): boolean {
  return tx.isSplit === true;
}

/**
 * Calcula l'import net d'una transacció segons el seu tipus
 */
export function calculateTransactionNetAmount(tx: Transaction): number {
  if (isArchivedTransaction(tx) || isRemittanceParent(tx) || isSplitParent(tx)) {
    return 0;
  }

  // Devolució → valor negatiu
  if (tx.transactionType === 'return' && tx.amount < 0) {
    return tx.amount; // ja és negatiu
  }

  // Donació marcada com retornada → aportació fallida, no certificable
  if (tx.amount > 0 && tx.donationStatus === 'returned') {
    return 0;
  }

  // Donació fiscal vàlida → valor positiu
  if (tx.amount > 0 && tx.transactionType === 'donation') {
    return tx.amount;
  }

  // Altres casos (despeses, etc.) → 0
  return 0;
}

/**
 * Determina si una transacció és una devolució o donació retornada
 */
export function isReturnTransaction(tx: Transaction): boolean {
  if (isArchivedTransaction(tx) || isRemittanceParent(tx) || isSplitParent(tx)) {
    return false;
  }

  return (tx.transactionType === 'return' && tx.amount < 0) ||
         (tx.amount > 0 && tx.donationStatus === 'returned');
}

// =============================================================================
// FUNCIÓ PRINCIPAL
// =============================================================================

/**
 * Calcula els totals de donacions per donant per al Model 182
 *
 * @param transactions - Llista de transaccions (donacions)
 * @param donors - Llista de donants
 * @param year - Any fiscal a reportar
 * @returns Objecte amb els totals per donant i estadístiques
 *
 * Regles de càlcul:
 * 1. Suma totes les donacions positives de l'any
 * 2. Resta les devolucions sense parella (transactionType === 'return')
 * 3. Neutralitza les donacions marcades com retornades i la seva devolució vinculada
 * 4. Calcula valor1 (any-1) i valor2 (any-2) per determinar recurrència
 * 5. Un donant és recurrent si valor1 > 0 AND valor2 > 0
 * 6. Ignora donants sense DNI (taxId buit)
 */
export function calculateModel182Totals(
  transactions: Transaction[],
  donors: Donor[],
  year: number
): Model182Result {
  // Crear mapa de donants per ID (només amb taxId vàlid)
  const donorMap = new Map<string, Donor>();
  for (const donor of donors) {
    if (donor.taxId && donor.taxId.trim()) {
      donorMap.set(donor.id, donor);
    }
  }

  // Anys per comparar recurrència
  const year1 = year - 1;
  const year2 = year - 2;

  // Acumuladors per donant
  const donationsByDonor: Record<string, {
    donor: Donor;
    total: number;
    returned: number;
    totalYear1: number;
    totalYear2: number;
  }> = {};

  // Estadístiques de devolucions
  let excludedReturns = 0;
  let excludedAmount = 0;
  const canonicalContributions = buildCanonicalFiscalContributions(transactions);

  // Processar totes les transaccions
  for (const contribution of canonicalContributions.contributions) {
    const tx = contribution.tx;
    const txYear = new Date(tx.date).getFullYear();

    // Només processar transaccions amb donant assignat i amb DNI
    if (!tx.contactId || !donorMap.has(tx.contactId)) {
      continue;
    }

    // Inicialitzar si no existeix
    if (!donationsByDonor[tx.contactId]) {
      donationsByDonor[tx.contactId] = {
        donor: donorMap.get(tx.contactId)!,
        total: 0,
        returned: 0,
        totalYear1: 0,
        totalYear2: 0,
      };
    }

    // Calcular import net de la transacció
    const netAmount = contribution.canonicalAmount;

    // Comptar devolucions de l'any actual
    if (txYear === year && netAmount < 0) {
      excludedReturns++;
      excludedAmount += Math.abs(netAmount);
    }

    // Acumular segons l'any
    if (txYear === year) {
      if (netAmount > 0) {
        donationsByDonor[tx.contactId].total += netAmount;
      } else if (netAmount < 0) {
        donationsByDonor[tx.contactId].returned += Math.abs(netAmount);
      }
    } else if (txYear === year1) {
      donationsByDonor[tx.contactId].totalYear1 += Math.max(0, netAmount);
    } else if (txYear === year2) {
      donationsByDonor[tx.contactId].totalYear2 += Math.max(0, netAmount);
    }
  }

  // Generar resultat final
  const donorTotals: DonorTotals[] = Object.entries(donationsByDonor)
    .map(([donorId, { donor, total, returned, totalYear1, totalYear2 }]) => {
      const totalAmount = Math.max(0, total - returned);
      const valor1 = totalYear1;
      const valor2 = totalYear2;

      return {
        donorId,
        donor,
        totalAmount,
        returnedAmount: returned,
        valor1,
        valor2,
        recurrente: valor1 > 0 && valor2 > 0,
      };
    })
    // Només incloure donants amb total positiu
    .filter(({ totalAmount }) => totalAmount > 0)
    // Ordenar per import descendent
    .sort((a, b) => b.totalAmount - a.totalAmount);

  // Calcular estadístiques
  const stats = {
    totalDonors: donorTotals.length,
    totalAmount: donorTotals.reduce((sum, row) => sum + row.totalAmount, 0),
    excludedReturns,
    excludedAmount,
  };

  return { donorTotals, stats };
}
