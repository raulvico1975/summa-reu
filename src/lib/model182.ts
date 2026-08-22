/**
 * Lògica pura de càlcul per al Model 182 (Declaració informativa de donatius)
 *
 * Aquesta funció no depèn de Firebase ni cap altre servei extern,
 * per tal de poder ser testejada fàcilment amb tests unitaris.
 */
import type {
  Donor as DataDonor,
  Transaction as DataTransaction,
} from '@/lib/data';
import { buildModel182Candidates } from '@/lib/model182-aggregation';

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
  // API històrica: el càlcul real viu a l'agregació compartida del Model 182.
  const validDonors = donors.filter((donor) => donor.taxId && donor.taxId.trim());
  const donorMap = new Map(validDonors.map((donor) => [donor.id, donor]));
  const sharedDonors: DataDonor[] = validDonors.map((donor) => ({
    id: donor.id,
    type: 'donor',
    name: donor.name,
    taxId: donor.taxId,
    zipCode: donor.zipCode,
    province: donor.province,
    donorType: donor.donorType,
    membershipType: 'one-time',
    createdAt: '1970-01-01',
  }));
  const sharedTransactions: DataTransaction[] = transactions.map((tx, index) => ({
    id: tx.id ?? `legacy-model182-${index}`,
    date: tx.date,
    description: '',
    amount: tx.amount,
    category: null,
    document: null,
    contactId: tx.contactId ?? null,
    transactionType: tx.transactionType as DataTransaction['transactionType'],
    donationStatus: tx.donationStatus as DataTransaction['donationStatus'],
    linkedTransactionId: tx.linkedTransactionId ?? null,
    archivedAt: tx.archivedAt ?? undefined,
    isRemittance: tx.isRemittance,
    isSplit: tx.isSplit,
  }));

  const candidates = buildModel182Candidates(sharedTransactions, sharedDonors, year);
  const donorTotals: DonorTotals[] = candidates.map((candidate) => {
    const donor = donorMap.get(candidate.donorId)!;
    const valor1 = candidate.previousYearAmount ?? 0;
    const valor2 = candidate.twoYearsAgoAmount ?? 0;
    return {
      donorId: candidate.donorId,
      donor,
      totalAmount: candidate.totalAmount,
      returnedAmount: Math.abs(candidate.canonicalReturnsAmount),
      valor1,
      valor2,
      recurrente: valor1 > 0 && valor2 > 0,
    };
  });

  return {
    donorTotals,
    stats: {
      totalDonors: donorTotals.length,
      totalAmount: donorTotals.reduce((sum, row) => sum + row.totalAmount, 0),
      excludedReturns: candidates.reduce((sum, row) => sum + row.canonicalReturnCount, 0),
      excludedAmount: candidates.reduce((sum, row) => sum + Math.abs(row.canonicalReturnsAmount), 0),
    },
  };
}
