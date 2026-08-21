/**
 * Tests unitaris per a la lògica de càlcul del Model 182
 *
 * Executa amb: npm test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateModel182Totals,
  calculateTransactionNetAmount,
  isReturnTransaction,
  type Donor,
  type Transaction,
} from '../model182';
import { normalizeTaxId, removeAccents } from '../normalize';

// =============================================================================
// DADES DE TEST
// =============================================================================

const createDonor = (overrides: Partial<Donor> = {}): Donor => ({
  id: 'donor-1',
  name: 'Joan Garcia',
  taxId: '12345678A',
  zipCode: '08001',
  province: 'Barcelona',
  donorType: 'individual',
  ...overrides,
});

const createTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  contactId: 'donor-1',
  date: '2024-06-15',
  amount: 100,
  transactionType: 'donation',
  ...overrides,
});

// =============================================================================
// TESTS: calculateTransactionNetAmount
// =============================================================================

describe('calculateTransactionNetAmount', () => {
  it('retorna l\'import positiu per una donació normal', () => {
    const tx = createTransaction({ amount: 100 });
    assert.strictEqual(calculateTransactionNetAmount(tx), 100);
  });

  it('retorna l\'import negatiu per una devolució (transactionType=return)', () => {
    const tx = createTransaction({
      amount: -50,
      transactionType: 'return',
    });
    assert.strictEqual(calculateTransactionNetAmount(tx), -50);
  });

  it('retorna l\'import negatiu per una donació marcada com returned', () => {
    const tx = createTransaction({
      amount: 75,
      donationStatus: 'returned',
    });
    assert.strictEqual(calculateTransactionNetAmount(tx), -75);
  });

  it('retorna 0 per transaccions que no són donacions ni devolucions', () => {
    const tx = createTransaction({ amount: -100, transactionType: undefined }); // despesa sense transactionType
    assert.strictEqual(calculateTransactionNetAmount(tx), 0);
  });

  it('retorna 0 per transaccions arxivades', () => {
    const tx = createTransaction({
      amount: 100,
      transactionType: 'donation',
      archivedAt: '2024-06-20T10:00:00.000Z',
    });
    assert.strictEqual(calculateTransactionNetAmount(tx), 0);
  });

  it('retorna 0 per pares de remesa', () => {
    const tx = createTransaction({
      amount: 100,
      transactionType: 'donation',
      isRemittance: true,
    });
    assert.strictEqual(calculateTransactionNetAmount(tx), 0);
  });
});

// =============================================================================
// TESTS: isReturnTransaction
// =============================================================================

describe('isReturnTransaction', () => {
  it('retorna true per transactionType=return amb import negatiu', () => {
    const tx = createTransaction({ transactionType: 'return', amount: -50 });
    assert.strictEqual(isReturnTransaction(tx), true);
  });

  it('retorna true per donació amb donationStatus=returned', () => {
    const tx = createTransaction({ donationStatus: 'returned', amount: 100 });
    assert.strictEqual(isReturnTransaction(tx), true);
  });

  it('retorna false per una donació normal', () => {
    const tx = createTransaction({ amount: 100 });
    assert.strictEqual(isReturnTransaction(tx), false);
  });

  it('retorna false si està arxivada o és pare de remesa', () => {
    const archivedReturn = createTransaction({
      transactionType: 'return',
      amount: -50,
      archivedAt: '2024-06-21T00:00:00.000Z',
    });
    const remittanceReturn = createTransaction({
      transactionType: 'return',
      amount: -40,
      isRemittance: true,
    });

    assert.strictEqual(isReturnTransaction(archivedReturn), false);
    assert.strictEqual(isReturnTransaction(remittanceReturn), false);
  });
});

// =============================================================================
// TESTS: calculateModel182Totals - Suma de donacions
// =============================================================================

describe('calculateModel182Totals - Suma de donacions', () => {
  it('suma donacions d\'un donant correctament', () => {
    const donors = [createDonor({ id: 'donor-1' })];
    const transactions = [
      createTransaction({ id: 'tx-1', contactId: 'donor-1', amount: 100, date: '2024-03-01' }),
      createTransaction({ id: 'tx-2', contactId: 'donor-1', amount: 50, date: '2024-06-01' }),
      createTransaction({ id: 'tx-3', contactId: 'donor-1', amount: 25, date: '2024-09-01' }),
    ];

    const result = calculateModel182Totals(transactions, donors, 2024);

    assert.strictEqual(result.donorTotals.length, 1);
    assert.strictEqual(result.donorTotals[0].totalAmount, 175);
    assert.strictEqual(result.stats.totalAmount, 175);
    assert.strictEqual(result.stats.totalDonors, 1);
  });

  it('suma donacions de múltiples donants per separat', () => {
    const donors = [
      createDonor({ id: 'donor-1', name: 'Joan', taxId: '11111111A' }),
      createDonor({ id: 'donor-2', name: 'Maria', taxId: '22222222B' }),
    ];
    const transactions = [
      createTransaction({ id: 'tx-1', contactId: 'donor-1', amount: 100, date: '2024-03-01' }),
      createTransaction({ id: 'tx-2', contactId: 'donor-2', amount: 200, date: '2024-03-01' }),
    ];

    const result = calculateModel182Totals(transactions, donors, 2024);

    assert.strictEqual(result.donorTotals.length, 2);
    assert.strictEqual(result.stats.totalAmount, 300);
    assert.strictEqual(result.stats.totalDonors, 2);

    // Els resultats estan ordenats per import descendent
    assert.strictEqual(result.donorTotals[0].totalAmount, 200);
    assert.strictEqual(result.donorTotals[1].totalAmount, 100);
  });

  it('retorna llista buida si no hi ha donacions', () => {
    const donors = [createDonor()];
    const transactions: Transaction[] = [];

    const result = calculateModel182Totals(transactions, donors, 2024);

    assert.strictEqual(result.donorTotals.length, 0);
    assert.strictEqual(result.stats.totalAmount, 0);
    assert.strictEqual(result.stats.totalDonors, 0);
  });
});

// =============================================================================
// TESTS: calculateModel182Totals - Devolucions
// =============================================================================

describe('calculateModel182Totals - Devolucions', () => {
  it('resta devolucions (transactionType === "return")', () => {
    const donors = [createDonor({ id: 'donor-1' })];
    const transactions = [
      createTransaction({ id: 'tx-1', contactId: 'donor-1', amount: 100, date: '2024-03-01' }),
      createTransaction({
        id: 'tx-2',
        contactId: 'donor-1',
        amount: -30,
        transactionType: 'return',
        date: '2024-06-01',
      }),
    ];

    const result = calculateModel182Totals(transactions, donors, 2024);

    assert.strictEqual(result.donorTotals.length, 1);
    assert.strictEqual(result.donorTotals[0].totalAmount, 70);
    assert.strictEqual(result.donorTotals[0].returnedAmount, 30);
    assert.strictEqual(result.stats.excludedReturns, 1);
    assert.strictEqual(result.stats.excludedAmount, 30);
  });

  it('resta donacions marcades com returned (donationStatus === "returned")', () => {
    const donors = [createDonor({ id: 'donor-1' })];
    const transactions = [
      createTransaction({ id: 'tx-1', contactId: 'donor-1', amount: 100, date: '2024-03-01' }),
      createTransaction({
        id: 'tx-2',
        contactId: 'donor-1',
        amount: 40,
        donationStatus: 'returned',
        date: '2024-06-01',
      }),
    ];

    const result = calculateModel182Totals(transactions, donors, 2024);

    assert.strictEqual(result.donorTotals.length, 1);
    assert.strictEqual(result.donorTotals[0].totalAmount, 60);
    assert.strictEqual(result.donorTotals[0].returnedAmount, 40);
    assert.strictEqual(result.stats.excludedReturns, 1);
    assert.strictEqual(result.stats.excludedAmount, 40);
  });

  it('no duplica una devolució quan returned i return tenen linkedTransactionId', () => {
    const donors = [createDonor({ id: 'donor-1' })];
    const transactions = [
      createTransaction({
        id: 'donation-normal',
        contactId: 'donor-1',
        amount: 200,
        date: '2024-03-01',
      }),
      createTransaction({
        id: 'donation-returned',
        contactId: 'donor-1',
        amount: 100,
        date: '2024-06-01',
        donationStatus: 'returned',
        linkedTransactionId: 'return-100',
      }),
      createTransaction({
        id: 'return-100',
        contactId: 'donor-1',
        amount: -100,
        date: '2024-06-15',
        transactionType: 'return',
        linkedTransactionId: 'donation-returned',
      }),
    ];

    const result = calculateModel182Totals(transactions, donors, 2024);

    assert.strictEqual(result.donorTotals.length, 1);
    assert.strictEqual(result.donorTotals[0].totalAmount, 100);
    assert.strictEqual(result.donorTotals[0].returnedAmount, 100);
    assert.strictEqual(result.stats.excludedReturns, 1);
    assert.strictEqual(result.stats.excludedAmount, 100);
  });

  it('ignora pares de remesa i transaccions arxivades', () => {
    const donors = [createDonor({ id: 'donor-1' })];
    const transactions = [
      createTransaction({ id: 'tx-1', contactId: 'donor-1', amount: 100, transactionType: 'donation', date: '2024-03-01' }),
      createTransaction({ id: 'tx-2', contactId: 'donor-1', amount: -20, transactionType: 'return', date: '2024-04-01', archivedAt: '2024-04-02T00:00:00.000Z' }),
      createTransaction({ id: 'tx-3', contactId: 'donor-1', amount: 50, transactionType: 'donation', date: '2024-05-01', isRemittance: true }),
    ];

    const result = calculateModel182Totals(transactions, donors, 2024);

    assert.strictEqual(result.donorTotals.length, 1);
    assert.strictEqual(result.donorTotals[0].totalAmount, 100);
    assert.strictEqual(result.donorTotals[0].returnedAmount, 0);
  });

  it('exclou donant si devolucions >= donacions', () => {
    const donors = [createDonor({ id: 'donor-1' })];
    const transactions = [
      createTransaction({ id: 'tx-1', contactId: 'donor-1', amount: 100, date: '2024-03-01' }),
      createTransaction({
        id: 'tx-2',
        contactId: 'donor-1',
        amount: -100,
        transactionType: 'return',
        date: '2024-06-01',
      }),
    ];

    const result = calculateModel182Totals(transactions, donors, 2024);

    // Donant amb total 0 no apareix al resultat
    assert.strictEqual(result.donorTotals.length, 0);
    assert.strictEqual(result.stats.totalDonors, 0);
  });
});

// =============================================================================
// TESTS: calculateModel182Totals - Recurrència
// =============================================================================

describe('calculateModel182Totals - Recurrència', () => {
  it('marca com recurrent si ha donat els 2 anys anteriors', () => {
    const donors = [createDonor({ id: 'donor-1' })];
    const transactions = [
      // Any actual (2024)
      createTransaction({ id: 'tx-1', contactId: 'donor-1', amount: 100, date: '2024-06-01' }),
      // Any anterior (2023)
      createTransaction({ id: 'tx-2', contactId: 'donor-1', amount: 80, date: '2023-06-01' }),
      // Dos anys abans (2022)
      createTransaction({ id: 'tx-3', contactId: 'donor-1', amount: 60, date: '2022-06-01' }),
    ];

    const result = calculateModel182Totals(transactions, donors, 2024);

    assert.strictEqual(result.donorTotals.length, 1);
    assert.strictEqual(result.donorTotals[0].recurrente, true);
    assert.strictEqual(result.donorTotals[0].valor1, 80);
    assert.strictEqual(result.donorTotals[0].valor2, 60);
  });

  it('NO és recurrent si no ha donat l\'any anterior', () => {
    const donors = [createDonor({ id: 'donor-1' })];
    const transactions = [
      // Any actual (2024)
      createTransaction({ id: 'tx-1', contactId: 'donor-1', amount: 100, date: '2024-06-01' }),
      // Dos anys abans (2022) - però NO l'any 2023
      createTransaction({ id: 'tx-2', contactId: 'donor-1', amount: 60, date: '2022-06-01' }),
    ];

    const result = calculateModel182Totals(transactions, donors, 2024);

    assert.strictEqual(result.donorTotals.length, 1);
    assert.strictEqual(result.donorTotals[0].recurrente, false);
    assert.strictEqual(result.donorTotals[0].valor1, 0);
    assert.strictEqual(result.donorTotals[0].valor2, 60);
  });

  it('NO és recurrent si no ha donat fa dos anys', () => {
    const donors = [createDonor({ id: 'donor-1' })];
    const transactions = [
      // Any actual (2024)
      createTransaction({ id: 'tx-1', contactId: 'donor-1', amount: 100, date: '2024-06-01' }),
      // Any anterior (2023) - però NO l'any 2022
      createTransaction({ id: 'tx-2', contactId: 'donor-1', amount: 80, date: '2023-06-01' }),
    ];

    const result = calculateModel182Totals(transactions, donors, 2024);

    assert.strictEqual(result.donorTotals.length, 1);
    assert.strictEqual(result.donorTotals[0].recurrente, false);
    assert.strictEqual(result.donorTotals[0].valor1, 80);
    assert.strictEqual(result.donorTotals[0].valor2, 0);
  });
});

// =============================================================================
// TESTS: calculateModel182Totals - Donants sense DNI
// =============================================================================

describe('calculateModel182Totals - Donants sense DNI', () => {
  it('ignora donants sense taxId', () => {
    const donors = [
      createDonor({ id: 'donor-1', taxId: '12345678A' }),
      createDonor({ id: 'donor-2', taxId: '' }), // Sense DNI
    ];
    const transactions = [
      createTransaction({ id: 'tx-1', contactId: 'donor-1', amount: 100, date: '2024-03-01' }),
      createTransaction({ id: 'tx-2', contactId: 'donor-2', amount: 200, date: '2024-03-01' }),
    ];

    const result = calculateModel182Totals(transactions, donors, 2024);

    // Només donor-1 apareix (donor-2 sense DNI és ignorat)
    assert.strictEqual(result.donorTotals.length, 1);
    assert.strictEqual(result.donorTotals[0].donor.id, 'donor-1');
    assert.strictEqual(result.stats.totalAmount, 100);
  });

  it('ignora donants amb taxId només espais', () => {
    const donors = [createDonor({ id: 'donor-1', taxId: '   ' })];
    const transactions = [
      createTransaction({ id: 'tx-1', contactId: 'donor-1', amount: 100, date: '2024-03-01' }),
    ];

    const result = calculateModel182Totals(transactions, donors, 2024);

    assert.strictEqual(result.donorTotals.length, 0);
  });

  it('ignora transaccions sense contactId', () => {
    const donors = [createDonor({ id: 'donor-1' })];
    const transactions = [
      createTransaction({ id: 'tx-1', contactId: null, amount: 100, date: '2024-03-01' }),
      createTransaction({ id: 'tx-2', contactId: 'donor-1', amount: 50, date: '2024-03-01' }),
    ];

    const result = calculateModel182Totals(transactions, donors, 2024);

    assert.strictEqual(result.donorTotals.length, 1);
    assert.strictEqual(result.donorTotals[0].totalAmount, 50);
  });
});

// =============================================================================
// TESTS: calculateModel182Totals - Casos edge
// =============================================================================

describe('calculateModel182Totals - Casos edge', () => {
  it('gestiona transaccions d\'anys fora del rang (any-3, any+1)', () => {
    const donors = [createDonor({ id: 'donor-1' })];
    const transactions = [
      // Any actual
      createTransaction({ id: 'tx-1', contactId: 'donor-1', amount: 100, date: '2024-06-01' }),
      // Any futur (ignorat)
      createTransaction({ id: 'tx-2', contactId: 'donor-1', amount: 500, date: '2025-06-01' }),
      // Tres anys abans (ignorat)
      createTransaction({ id: 'tx-3', contactId: 'donor-1', amount: 300, date: '2021-06-01' }),
    ];

    const result = calculateModel182Totals(transactions, donors, 2024);

    assert.strictEqual(result.donorTotals.length, 1);
    assert.strictEqual(result.donorTotals[0].totalAmount, 100);
    assert.strictEqual(result.donorTotals[0].valor1, 0);
    assert.strictEqual(result.donorTotals[0].valor2, 0);
  });

  it('ordena resultats per import descendent', () => {
    const donors = [
      createDonor({ id: 'donor-1', name: 'Joan', taxId: '11111111A' }),
      createDonor({ id: 'donor-2', name: 'Maria', taxId: '22222222B' }),
      createDonor({ id: 'donor-3', name: 'Pere', taxId: '33333333C' }),
    ];
    const transactions = [
      createTransaction({ id: 'tx-1', contactId: 'donor-1', amount: 50, date: '2024-03-01' }),
      createTransaction({ id: 'tx-2', contactId: 'donor-2', amount: 200, date: '2024-03-01' }),
      createTransaction({ id: 'tx-3', contactId: 'donor-3', amount: 100, date: '2024-03-01' }),
    ];

    const result = calculateModel182Totals(transactions, donors, 2024);

    assert.strictEqual(result.donorTotals[0].totalAmount, 200);
    assert.strictEqual(result.donorTotals[1].totalAmount, 100);
    assert.strictEqual(result.donorTotals[2].totalAmount, 50);
  });
});

// =============================================================================
// TESTS: Export Gestoria (A–G) - Normalització i transformacions
// =============================================================================

describe('Export Gestoria - Normalització NIF', () => {
  it('normalitza NIF amb espais i guions', () => {
    assert.strictEqual(normalizeTaxId('B-12.345.678'), 'B12345678');
  });

  it('normalitza NIF a majúscules', () => {
    assert.strictEqual(normalizeTaxId('b12345678'), 'B12345678');
  });

  it('normalitza NIE amb espais', () => {
    assert.strictEqual(normalizeTaxId('X 1234567 A'), 'X1234567A');
  });

  it('retorna string buit per valor null/undefined', () => {
    assert.strictEqual(normalizeTaxId(null), '');
    assert.strictEqual(normalizeTaxId(undefined), '');
  });
});

describe('Export Gestoria - Normalització Nom (removeAccents)', () => {
  it('elimina accents i converteix a majúscules', () => {
    const nom = 'María García-López';
    const normalitzat = removeAccents(nom).toUpperCase().replace(/\s+/g, ' ').trim();
    assert.strictEqual(normalitzat, 'MARIA GARCIA-LOPEZ');
  });

  it('gestiona accents catalans', () => {
    const nom = 'Núria Puigdomènech';
    const normalitzat = removeAccents(nom).toUpperCase().replace(/\s+/g, ' ').trim();
    assert.strictEqual(normalitzat, 'NURIA PUIGDOMENECH');
  });

  it('col·lapsa espais múltiples', () => {
    const nom = 'Joan   Garcia    López';
    const normalitzat = removeAccents(nom).toUpperCase().replace(/\s+/g, ' ').trim();
    assert.strictEqual(normalitzat, 'JOAN GARCIA LOPEZ');
  });

  it('retorna string buit per valor null/undefined', () => {
    assert.strictEqual(removeAccents(null), '');
    assert.strictEqual(removeAccents(undefined), '');
  });
});

describe('Export Gestoria - Codi Província', () => {
  it('extreu 2 primers dígits del CP Barcelona', () => {
    const zipCode = '08001';
    const provincia = zipCode.substring(0, 2);
    assert.strictEqual(provincia, '08');
  });

  it('extreu 2 primers dígits del CP Girona', () => {
    const zipCode = '17000';
    const provincia = zipCode.substring(0, 2);
    assert.strictEqual(provincia, '17');
  });

  it('preserva zero inicial', () => {
    const zipCode = '01001'; // Àlaba
    const provincia = zipCode.substring(0, 2);
    assert.strictEqual(provincia, '01');
  });
});

describe('Export Gestoria - Clau (F0/A0)', () => {
  it('retorna F0 per membershipType recurring', () => {
    const membershipType: string = 'recurring';
    const clau = membershipType === 'recurring' ? 'F0' : 'A0';
    assert.strictEqual(clau, 'F0');
  });

  it('retorna A0 per membershipType one-time', () => {
    const membershipType: string = 'one-time';
    const clau = membershipType === 'recurring' ? 'F0' : 'A0';
    assert.strictEqual(clau, 'A0');
  });
});

describe('Export Gestoria - Recurrència', () => {
  it('retorna 1 si valor1 > 0 i valor2 > 0', () => {
    const valor1: number = 100;
    const valor2: number = 50;
    let recurrencia: number | string = '';
    if (valor1 > 0 && valor2 > 0) {
      recurrencia = 1;
    } else if (valor1 === 0 && valor2 === 0) {
      recurrencia = 2;
    }
    assert.strictEqual(recurrencia, 1);
  });

  it('retorna 2 si valor1 === 0 i valor2 === 0', () => {
    const valor1: number = 0;
    const valor2: number = 0;
    let recurrencia: number | string = '';
    if (valor1 > 0 && valor2 > 0) {
      recurrencia = 1;
    } else if (valor1 === 0 && valor2 === 0) {
      recurrencia = 2;
    }
    assert.strictEqual(recurrencia, 2);
  });

  it('retorna buit si valor1 > 0 i valor2 === 0', () => {
    const valor1: number = 100;
    const valor2: number = 0;
    let recurrencia: number | string = '';
    if (valor1 > 0 && valor2 > 0) {
      recurrencia = 1;
    } else if (valor1 === 0 && valor2 === 0) {
      recurrencia = 2;
    }
    assert.strictEqual(recurrencia, '');
  });

  it('retorna buit si valor1 === 0 i valor2 > 0', () => {
    const valor1: number = 0;
    const valor2: number = 50;
    let recurrencia: number | string = '';
    if (valor1 > 0 && valor2 > 0) {
      recurrencia = 1;
    } else if (valor1 === 0 && valor2 === 0) {
      recurrencia = 2;
    }
    assert.strictEqual(recurrencia, '');
  });
});
