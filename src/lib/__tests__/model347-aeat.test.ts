import { describe, it } from 'node:test';
import assert from 'node:assert';

import type { Category, Organization, Supplier, Transaction } from '../data';
import {
  computeModel347,
  type SupplierAggregate,
} from '../reports/model347';
import {
  generateModel347AEATFile,
  encodeLatin1,
} from '../reports/model347-aeat';

describe('computeModel347', () => {
  it('agrega per proveidor/direccio i aplica llindar anual', () => {
    const transactions: Transaction[] = [
      {
        id: 't1',
        date: '2025-01-15',
        description: 'Factura gener',
        amount: -2000,
        category: 'c1',
        document: null,
        contactId: 's1',
        contactType: 'supplier',
      },
      {
        id: 't2',
        date: '2025-04-10',
        description: 'Factura abril',
        amount: -1200,
        category: 'c1',
        document: null,
        contactId: 's1',
        contactType: 'supplier',
      },
      {
        id: 't3',
        date: '2025-08-10',
        description: 'Abonament proveidor',
        amount: 5000,
        category: 'c2',
        document: null,
        contactId: 's1',
        contactType: 'supplier',
      },
      {
        id: 't4',
        date: '2025-05-20',
        description: 'Sota llindar',
        amount: -2900,
        category: 'c1',
        document: null,
        contactId: 's2',
        contactType: 'supplier',
      },
      {
        id: 't5',
        date: '2025-06-20',
        description: 'No es proveidor',
        amount: -8000,
        category: 'c1',
        document: null,
        contactId: 'd1',
        contactType: 'donor',
      },
      {
        id: 't6',
        date: '2024-05-20',
        description: 'Any diferent',
        amount: -9000,
        category: 'c1',
        document: null,
        contactId: 's1',
        contactType: 'supplier',
      },
    ];

    const suppliers: Supplier[] = [
      { id: 's1', type: 'supplier', name: 'Proveidor 1', taxId: 'B12345678', zipCode: '08001', createdAt: '2024-01-01' },
      { id: 's2', type: 'supplier', name: 'Proveidor 2', taxId: 'B87654321', zipCode: '08002', createdAt: '2024-01-01' },
    ];

    const categories: Category[] = [
      { id: 'c1', name: 'Compres', type: 'expense' },
      { id: 'c2', name: 'Abonaments', type: 'income' },
    ];

    const result = computeModel347(
      transactions,
      suppliers,
      categories,
      2025,
      new Set<string>()
    );

    assert.strictEqual(result.expenses.length, 1);
    assert.strictEqual(result.income.length, 1);

    assert.strictEqual(result.expenses[0].contactId, 's1');
    assert.strictEqual(result.expenses[0].zipCode, '08001');
    assert.strictEqual(result.expenses[0].quarters.q1, 2000);
    assert.strictEqual(result.expenses[0].quarters.q2, 1200);
    assert.strictEqual(result.expenses[0].quarters.total, 3200);

    assert.strictEqual(result.income[0].contactId, 's1');
    assert.strictEqual(result.income[0].quarters.q3, 5000);
    assert.strictEqual(result.income[0].quarters.total, 5000);
  });

  it('recalcula totals si hi ha transaccions excloses', () => {
    const transactions: Transaction[] = [
      {
        id: 't1',
        date: '2025-01-15',
        description: 'Factura gener',
        amount: -2000,
        category: null,
        document: null,
        contactId: 's1',
        contactType: 'supplier',
      },
      {
        id: 't2',
        date: '2025-04-10',
        description: 'Factura abril',
        amount: -1200,
        category: null,
        document: null,
        contactId: 's1',
        contactType: 'supplier',
      },
    ];

    const suppliers: Supplier[] = [
      { id: 's1', type: 'supplier', name: 'Proveidor 1', taxId: 'B12345678', zipCode: '08001', createdAt: '2024-01-01' },
    ];

    const result = computeModel347(
      transactions,
      suppliers,
      [],
      2025,
      new Set(['t2'])
    );

    assert.strictEqual(result.expenses.length, 0);
    assert.strictEqual(result.income.length, 0);
  });

  it('admet data Firestore i contactType legacy a l export server-side', () => {
    const transactions: Transaction[] = [
      {
        id: 't1',
        date: { toDate: () => new Date('2025-01-15T00:00:00.000Z') } as unknown as string,
        description: 'Factura legacy',
        amount: -4100,
        category: null,
        document: null,
        contactId: 's1',
      },
      {
        id: 't2',
        date: { seconds: 1741996800, nanoseconds: 0 } as unknown as string, // 2025-03-15
        description: 'Moviment no supplier',
        amount: -5000,
        category: null,
        document: null,
        contactId: 's1',
        contactType: 'donor',
      },
    ];

    const suppliers: Supplier[] = [
      { id: 's1', type: 'supplier', name: 'Proveidor 1', taxId: 'B12345678', zipCode: '08001', createdAt: '2024-01-01' },
    ];

    const result = computeModel347(
      transactions,
      suppliers,
      [],
      2025,
      new Set<string>()
    );

    assert.strictEqual(result.expenses.length, 1);
    assert.strictEqual(result.expenses[0].quarters.total, 4100);
    assert.strictEqual(result.income.length, 0);
  });
});

describe('generateModel347AEATFile', () => {
  const org: Organization = {
    id: 'org-1',
    name: 'Associacio Test',
    slug: 'assoc-test',
    taxId: 'G12345678',
    status: 'active',
    createdAt: '2024-01-01',
    createdBy: 'admin',
    phone: '612345678',
    signatoryName: 'Laura Garcia',
  };

  const mkAggregate = (
    args: {
      contactId: string;
      name: string;
      taxId: string;
      direction: 'expense' | 'income';
      zipCode?: string;
      province?: string;
      q1?: number;
      q2?: number;
      q3?: number;
      q4?: number;
    }
  ): SupplierAggregate => {
    const q1 = args.q1 ?? 0;
    const q2 = args.q2 ?? 0;
    const q3 = args.q3 ?? 0;
    const q4 = args.q4 ?? 0;
    return {
      contactId: args.contactId,
      name: args.name,
      taxId: args.taxId,
      zipCode: args.zipCode ?? '08001',
      province: args.province,
      direction: args.direction,
      quarters: {
        q1,
        q2,
        q3,
        q4,
        total: q1 + q2 + q3 + q4,
      },
      transactions: [],
    };
  };

  it('genera fitxer de 500 caracters per linea amb tipus 1 i 2', () => {
    const expenses = [
      mkAggregate({
        contactId: 's1',
        name: 'Proveidor Compra',
        taxId: 'B12345678',
        direction: 'expense',
        q1: 1000,
        q2: 2500,
      }),
    ];

    const income = [
      mkAggregate({
        contactId: 's2',
        name: 'Proveidor Ingres',
        taxId: 'B87654321',
        direction: 'income',
        q3: 4000,
      }),
    ];

    const result = generateModel347AEATFile(org, expenses, income, 2025);

    assert.deepStrictEqual(result.errors, []);
    assert.strictEqual(result.includedCount, 2);
    assert.strictEqual(result.excludedCount, 0);

    const lines = result.content.split('\r\n').filter(Boolean);
    assert.strictEqual(lines.length, 3);
    assert.strictEqual(lines[0].length, 500);
    assert.strictEqual(lines[1].length, 500);
    assert.strictEqual(lines[2].length, 500);
    assert.ok(lines[0].startsWith('1347'));
    assert.ok(lines[1].startsWith('2347'));
    assert.ok(lines[2].startsWith('2347'));

    // Posicio 82 (1-indexed) = index 81: clau operacio A/B
    assert.strictEqual(lines[1][81], 'A');
    assert.strictEqual(lines[2][81], 'B');
    // Posicions 77-78 (1-indexed): codi província (des de CP)
    assert.strictEqual(lines[1].slice(76, 78), '08');
    assert.strictEqual(lines[2].slice(76, 78), '08');
    // Posicions 300-305 (1-indexed): Número de convocatoria BDNS (numèric)
    assert.strictEqual(lines[1].slice(299, 305), '000000');
    assert.strictEqual(lines[2].slice(299, 305), '000000');

    const encoded = encodeLatin1(result.content);
    assert.strictEqual(encoded.error, null);
    assert.ok(encoded.bytes.length > 0);
  });

  it('exclou proveidors amb NIF invalid sense bloquejar export', () => {
    const expenses = [
      mkAggregate({
        contactId: 's1',
        name: 'Proveidor Invalid',
        taxId: '123',
        direction: 'expense',
        q1: 5000,
      }),
      mkAggregate({
        contactId: 's2',
        name: 'Proveidor Valid',
        taxId: 'B12345678',
        direction: 'expense',
        q2: 5000,
      }),
    ];

    const result = generateModel347AEATFile(org, expenses, [], 2025);

    assert.deepStrictEqual(result.errors, []);
    assert.strictEqual(result.includedCount, 1);
    assert.strictEqual(result.excludedCount, 1);
    assert.strictEqual(result.excluded[0].name, 'Proveidor Invalid');
    assert.ok(result.excluded[0].issueCodes.includes('TAXID_INVALID_LENGTH'));

    const lines = result.content.split('\r\n').filter(Boolean);
    assert.strictEqual(lines.length, 2);
  });

  it('exclou proveidors sense codi de provincia valid per evitar error AEAT 20903', () => {
    const expenses = [
      mkAggregate({
        contactId: 's1',
        name: 'Sense CP',
        taxId: 'B12345678',
        zipCode: '',
        direction: 'expense',
        q1: 4000,
      }),
      mkAggregate({
        contactId: 's2',
        name: 'Amb CP',
        taxId: 'B87654321',
        zipCode: '17001',
        direction: 'expense',
        q2: 5000,
      }),
    ];

    const result = generateModel347AEATFile(org, expenses, [], 2025);

    assert.deepStrictEqual(result.errors, []);
    assert.strictEqual(result.includedCount, 1);
    assert.strictEqual(result.excludedCount, 1);
    assert.strictEqual(result.excluded[0].name, 'Sense CP');
    assert.ok(result.excluded[0].issueCodes.includes('PROVINCE_CODE_MISSING'));

    const lines = result.content.split('\r\n').filter(Boolean);
    assert.strictEqual(lines.length, 2);
    // Registre del proveïdor vàlid amb codi província Girona
    assert.strictEqual(lines[1].slice(76, 78), '17');
  });

  it('retorna error bloquejant si dades de l organitzacio son invalides', () => {
    const badOrg: Organization = {
      ...org,
      taxId: 'B12',
      signatoryName: '',
    };

    const result = generateModel347AEATFile(
      badOrg,
      [mkAggregate({ contactId: 's1', name: 'Proveidor', taxId: 'B12345678', direction: 'expense', q1: 5000 })],
      [],
      2025
    );

    assert.strictEqual(result.content, '');
    assert.strictEqual(result.includedCount, 0);
    assert.strictEqual(result.excludedCount, 0);
    assert.ok(result.errors.length >= 1);
  });

  it('retorna error si no queda cap proveidor valid per exportar', () => {
    const result = generateModel347AEATFile(
      org,
      [mkAggregate({ contactId: 's1', name: 'Sense NIF', taxId: '', direction: 'expense', q1: 5000 })],
      [],
      2025
    );

    assert.strictEqual(result.content, '');
    assert.strictEqual(result.includedCount, 0);
    assert.strictEqual(result.excludedCount, 1);
    assert.ok(result.errors.some((e) => e.includes('Cap proveïdor vàlid per exportar')));
  });
});
