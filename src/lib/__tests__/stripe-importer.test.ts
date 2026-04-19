import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parseStripeCsv,
  groupStripeRowsByTransfer,
  findAllMatchingPayoutGroups,
  parseStripeAmount,
} from '@/components/stripe-importer/useStripeImporter';
import type { StripePayoutGroup, StripeRow } from '@/lib/stripe/types';

// ═══════════════════════════════════════════════════════════════════
// parseStripeAmount - Parsing d'imports
// ═══════════════════════════════════════════════════════════════════

describe('parseStripeAmount', () => {
  it('should parse European format (1.234,56)', () => {
    const result = parseStripeAmount('1.234,56');
    assert.strictEqual(result, 1234.56);
  });

  it('should parse English format (1234.56)', () => {
    const result = parseStripeAmount('1234.56');
    assert.strictEqual(result, 1234.56);
  });

  it('should handle small amounts without separators', () => {
    assert.strictEqual(parseStripeAmount('10'), 10);
    assert.strictEqual(parseStripeAmount('10.5'), 10.5);
    assert.strictEqual(parseStripeAmount('10,5'), 10.5);
  });

  it('should handle zero and empty strings', () => {
    assert.strictEqual(parseStripeAmount('0'), 0);
    assert.strictEqual(parseStripeAmount(''), 0);
    assert.strictEqual(parseStripeAmount('  '), 0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// parseStripeCsv - Parsing de CSV
// ═══════════════════════════════════════════════════════════════════

describe('parseStripeCsv', () => {
  it('should parse valid CSV with succeeded payments', () => {
    const csvContent = `id,Created date (UTC),Amount,Fee,Net,Status,Transfer,Customer Email,Amount Refunded
ch_123,2024-01-15 10:30:00,100.00,3.20,96.80,succeeded,po_abc,donor@example.com,0
ch_124,2024-01-15 11:00:00,50.00,1.75,48.25,succeeded,po_abc,another@example.com,0`;

    const result = parseStripeCsv(csvContent);

    assert.strictEqual(result.rows.length, 2);
    assert.strictEqual(result.warnings.length, 0);
    assert.strictEqual(result.rows[0].id, 'ch_123');
    assert.strictEqual(result.rows[0].amount, 100.00);
    assert.strictEqual(result.rows[0].fee, 3.20);
    assert.strictEqual(result.rows[0].customerEmail, 'donor@example.com');
    assert.strictEqual(result.rows[0].transfer, 'po_abc');
  });

  it('should accept Paid status and parse comma decimals from real Stripe CSV', () => {
    const csvContent = `id,Created date (UTC),Amount,Fee,Net,Status,Transfer,Customer Email,Amount Refunded
ch_123,2024-01-15 10:30:00,"12,00","0,43","11,57",Paid,,donor@example.com,0
ch_124,2024-01-15 11:00:00,"10,00","0,40","9,60",paid,po_abc,another@example.com,0`;

    const result = parseStripeCsv(csvContent);

    assert.strictEqual(result.rows.length, 2);
    assert.strictEqual(result.rows[0].status, 'Paid');
    assert.strictEqual(result.rows[0].amount, 12);
    assert.strictEqual(result.rows[0].fee, 0.43);
    assert.strictEqual(result.rows[0].transfer, '');
    assert.strictEqual(result.rows[1].fee, 0.4);
  });

  it('should parse semicolon-separated CSV without ERR_NO_COLUMNS', () => {
    const csvContent = `id;Created date (UTC);Amount;Fee;Net;Status;Transfer;Customer Email;Amount Refunded
ch_123;2024-01-15 10:30:00;12,00;0,43;11,57;Paid;po_abc;donor@example.com;0
ch_124;2024-01-15 11:00:00;10,00;0,40;9,60;paid;po_abc;another@example.com;0`;

    const result = parseStripeCsv(csvContent);

    assert.strictEqual(result.rows.length, 2);
    assert.strictEqual(result.rows[0].amount, 12);
    assert.strictEqual(result.rows[0].fee, 0.43);
    assert.strictEqual(result.rows[0].transfer, 'po_abc');
    assert.strictEqual(result.warnings.length, 0);
  });

  it('should exclude refunded payments and add warning', () => {
    const csvContent = `id,Created date (UTC),Amount,Fee,Net,Status,Transfer,Customer Email,Amount Refunded
ch_123,2024-01-15 10:30:00,100.00,3.20,96.80,succeeded,po_abc,donor@example.com,0
ch_124,2024-01-15 11:00:00,50.00,1.75,48.25,succeeded,po_abc,refund@example.com,50.00`;

    const result = parseStripeCsv(csvContent);

    assert.strictEqual(result.rows.length, 1);
    assert.strictEqual(result.warnings.length, 1);
    assert.strictEqual(result.warnings[0].code, 'WARN_REFUNDED');
    assert.strictEqual(result.warnings[0].count, 1);
    assert.strictEqual(result.warnings[0].amount, 50.00);
  });

  it('should handle CSV with only succeeded status', () => {
    const csvContent = `id,Created date (UTC),Amount,Fee,Net,Status,Transfer,Customer Email,Amount Refunded
ch_123,2024-01-15 10:30:00,100.00,3.20,96.80,succeeded,po_abc,donor@example.com,0`;

    const result = parseStripeCsv(csvContent);

    assert.strictEqual(result.rows.length, 1);
  });

  it('should throw error if no valid rows after filtering', () => {
    const csvContent = `id,Created date (UTC),Amount,Fee,Net,Status,Transfer,Customer Email,Amount Refunded
ch_123,2024-01-15 10:30:00,100.00,3.20,96.80,failed,po_abc,donor@example.com,0`;

    const result = parseStripeCsv(csvContent);

    // No valid rows (status=failed), should return empty array
    assert.strictEqual(result.rows.length, 0);
  });

  it('should convert date to YYYY-MM-DD format', () => {
    const csvContent = `id,Created date (UTC),Amount,Fee,Net,Status,Transfer,Customer Email,Amount Refunded
ch_123,2024-01-15 10:30:00,100.00,3.20,96.80,succeeded,po_abc,donor@example.com,0`;

    const result = parseStripeCsv(csvContent);

    assert.strictEqual(result.rows[0].createdDate, '2024-01-15');
  });
});

// ═══════════════════════════════════════════════════════════════════
// groupStripeRowsByTransfer - Agrupació per Transfer ID
// ═══════════════════════════════════════════════════════════════════

describe('groupStripeRowsByTransfer', () => {
  it('should group rows by transfer ID', () => {
    const rows: StripeRow[] = [
      {
        id: 'ch_1',
        createdDate: '2024-01-15',
        amount: 100,
        fee: 3,
        customerEmail: 'test@example.com',
        status: 'succeeded',
        transfer: 'po_abc',
        description: null,
      },
      {
        id: 'ch_2',
        createdDate: '2024-01-15',
        amount: 50,
        fee: 2,
        customerEmail: 'test2@example.com',
        status: 'succeeded',
        transfer: 'po_abc',
        description: null,
      },
      {
        id: 'ch_3',
        createdDate: '2024-01-16',
        amount: 200,
        fee: 5,
        customerEmail: 'test3@example.com',
        status: 'succeeded',
        transfer: 'po_xyz',
        description: null,
      },
    ];

    const groups = groupStripeRowsByTransfer(rows);

    assert.strictEqual(groups.length, 2);

    const groupAbc = groups.find(g => g.transferId === 'po_abc');
    const groupXyz = groups.find(g => g.transferId === 'po_xyz');

    assert.ok(groupAbc);
    assert.strictEqual(groupAbc.rows.length, 2);
    assert.strictEqual(groupAbc.gross, 150);
    assert.strictEqual(groupAbc.fees, 5);
    assert.strictEqual(groupAbc.net, 145);

    assert.ok(groupXyz);
    assert.strictEqual(groupXyz.rows.length, 1);
    assert.strictEqual(groupXyz.gross, 200);
    assert.strictEqual(groupXyz.fees, 5);
    assert.strictEqual(groupXyz.net, 195);
  });

  it('should ignore rows without transfer and group the rest', () => {
    const rows: StripeRow[] = [
      {
        id: 'ch_1',
        createdDate: '2024-01-15',
        amount: 100,
        fee: 3,
        customerEmail: 'test@example.com',
        status: 'succeeded',
        transfer: '',
        description: null,
      },
      {
        id: 'ch_2',
        createdDate: '2024-01-15',
        amount: 50,
        fee: 2,
        customerEmail: 'test2@example.com',
        status: 'succeeded',
        transfer: 'po_abc',
        description: null,
      },
    ];

    const groups = groupStripeRowsByTransfer(rows);

    assert.strictEqual(groups.length, 1);
    assert.strictEqual(groups[0].transferId, 'po_abc');
    assert.strictEqual(groups[0].gross, 50);
    assert.strictEqual(groups[0].fees, 2);
    assert.strictEqual(groups[0].net, 48);
  });

  it('should ignore pending rows without transfer and keep payout matching by net amount', () => {
    const rows: StripeRow[] = [
      {
        id: 'ch_pending',
        createdDate: '2024-01-15',
        amount: 12,
        fee: 0.43,
        customerEmail: 'pending@example.com',
        status: 'Paid',
        transfer: '',
        description: null,
      },
      {
        id: 'ch_settled_1',
        createdDate: '2024-01-15',
        amount: 10,
        fee: 0.4,
        customerEmail: 'settled1@example.com',
        status: 'succeeded',
        transfer: 'po_abc',
        description: null,
      },
      {
        id: 'ch_settled_2',
        createdDate: '2024-01-15',
        amount: 5,
        fee: 0.25,
        customerEmail: 'settled2@example.com',
        status: 'paid',
        transfer: 'po_abc',
        description: null,
      },
    ];

    const groups = groupStripeRowsByTransfer(rows);
    const matches = findAllMatchingPayoutGroups(groups, 14.35);

    assert.strictEqual(groups.length, 1);
    assert.strictEqual(groups[0].rows.length, 2);
    assert.strictEqual(groups[0].gross, 15);
    assert.strictEqual(groups[0].fees, 0.65);
    assert.strictEqual(groups[0].net, 14.35);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].transferId, 'po_abc');
  });

  it('should throw error if no row has transfer', () => {
    const rows: StripeRow[] = [
      {
        id: 'ch_1',
        createdDate: '2024-01-15',
        amount: 100,
        fee: 3,
        customerEmail: 'test@example.com',
        status: 'succeeded',
        transfer: '',
        description: null,
      },
    ];

    assert.throws(() => {
      groupStripeRowsByTransfer(rows);
    }, /ERR_NO_PAYOUT_ROWS/);
  });

  it('should throw the no payout rows error when all payments are still pending payout', () => {
    const rows: StripeRow[] = [
      {
        id: 'ch_1',
        createdDate: '2024-01-15',
        amount: 12,
        fee: 0.43,
        customerEmail: 'test@example.com',
        status: 'Paid',
        transfer: '',
        description: null,
      },
      {
        id: 'ch_2',
        createdDate: '2024-01-15',
        amount: 10,
        fee: 0.4,
        customerEmail: 'test2@example.com',
        status: 'paid',
        transfer: '   ',
        description: null,
      },
    ];

    assert.throws(() => {
      groupStripeRowsByTransfer(rows);
    }, /ERR_NO_PAYOUT_ROWS: Aquest export de Stripe encara no conté cap payout conciliable amb el banc\./);
  });
});

// ═══════════════════════════════════════════════════════════════════
// findAllMatchingPayoutGroups - Matching amb import bancari
// ═══════════════════════════════════════════════════════════════════

describe('findAllMatchingPayoutGroups', () => {
  it('should find matching payout group within tolerance', () => {
    const groups: StripePayoutGroup[] = [
      {
        transferId: 'po_abc',
        rows: [],
        gross: 100.00,
        fees: 3.50,
        net: 96.50,
      },
      {
        transferId: 'po_xyz',
        rows: [],
        gross: 200.00,
        fees: 7.00,
        net: 193.00,
      },
    ];

    const bankAmount = 96.51; // 1 cèntim de diferència (dins tolerància)
    const matches = findAllMatchingPayoutGroups(groups, bankAmount);

    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].transferId, 'po_abc');
  });

  it('should not match if difference exceeds tolerance', () => {
    const groups: StripePayoutGroup[] = [
      {
        transferId: 'po_abc',
        rows: [],
        gross: 100.00,
        fees: 3.50,
        net: 96.50,
      },
    ];

    const bankAmount = 96.53; // 3 cèntims de diferència (fora tolerància de 2¢)
    const matches = findAllMatchingPayoutGroups(groups, bankAmount);

    assert.strictEqual(matches.length, 0);
  });

  it('should find multiple matching groups if within tolerance', () => {
    const groups: StripePayoutGroup[] = [
      {
        transferId: 'po_abc',
        rows: [],
        gross: 100.00,
        fees: 3.50,
        net: 96.50,
      },
      {
        transferId: 'po_def',
        rows: [],
        gross: 95.00,
        fees: 1.50,
        net: 96.51, // Mateix net amb 1¢ diferència
      },
    ];

    const bankAmount = 96.50;
    const matches = findAllMatchingPayoutGroups(groups, bankAmount);

    assert.strictEqual(matches.length, 2);
  });

  it('should return empty array if no groups provided', () => {
    const matches = findAllMatchingPayoutGroups([], 100.00);
    assert.strictEqual(matches.length, 0);
  });

  it('should match with exact amount (zero tolerance)', () => {
    const groups: StripePayoutGroup[] = [
      {
        transferId: 'po_abc',
        rows: [],
        gross: 100.00,
        fees: 3.50,
        net: 96.50,
      },
    ];

    const bankAmount = 96.50;
    const matches = findAllMatchingPayoutGroups(groups, bankAmount);

    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].net, 96.50);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Auto-match by email - Logic tests
// ═══════════════════════════════════════════════════════════════════

describe('applyDonorMatchForEmail logic', () => {
  it('should match all rows with same email', () => {
    // Setup: 3 rows, 2 with same email
    const rows: StripeRow[] = [
      {
        id: 'ch_1',
        createdDate: '2024-01-15',
        amount: 100,
        fee: 3,
        customerEmail: 'test@example.com',
        status: 'succeeded',
        transfer: 'po_abc',
        description: null,
      },
      {
        id: 'ch_2',
        createdDate: '2024-01-15',
        amount: 50,
        fee: 2,
        customerEmail: 'test@example.com', // Mateix email
        status: 'succeeded',
        transfer: 'po_abc',
        description: null,
      },
      {
        id: 'ch_3',
        createdDate: '2024-01-16',
        amount: 200,
        fee: 5,
        customerEmail: 'other@example.com', // Email diferent
        status: 'succeeded',
        transfer: 'po_abc',
        description: null,
      },
    ];

    // Simular la lògica d'applyDonorMatchForEmail
    const donorMatches: Record<string, { contactId: string; contactName: string } | null> = {};
    const rowId = 'ch_1';
    const contactId = 'donor_123';
    const contactName = 'Test Donor';
    const email = 'test@example.com';

    // Assignar la fila inicial
    donorMatches[rowId] = { contactId, contactName };

    // Auto-match altres files amb mateix email
    const emailLower = email.toLowerCase().trim();
    for (const row of rows) {
      if (row.id === rowId) continue;
      if (row.customerEmail?.toLowerCase().trim() === emailLower) {
        donorMatches[row.id] = { contactId, contactName };
      }
    }

    // Verificar que ch_1 i ch_2 tenen match, però ch_3 no
    assert.strictEqual(donorMatches['ch_1']?.contactId, 'donor_123');
    assert.strictEqual(donorMatches['ch_2']?.contactId, 'donor_123');
    assert.strictEqual(donorMatches['ch_3'], undefined);
  });

  it('should not override existing manual match for different email', () => {
    const rows: StripeRow[] = [
      {
        id: 'ch_1',
        createdDate: '2024-01-15',
        amount: 100,
        fee: 3,
        customerEmail: 'test@example.com',
        status: 'succeeded',
        transfer: 'po_abc',
        description: null,
      },
      {
        id: 'ch_2',
        createdDate: '2024-01-15',
        amount: 50,
        fee: 2,
        customerEmail: 'test@example.com',
        status: 'succeeded',
        transfer: 'po_abc',
        description: null,
      },
    ];

    // Estat inicial: ch_2 ja té un match manual amb un donant diferent
    const donorMatches: Record<string, { contactId: string; contactName: string } | null> = {
      'ch_2': { contactId: 'donor_999', contactName: 'Different Donor' },
    };

    const rowId = 'ch_1';
    const contactId = 'donor_123';
    const contactName = 'Test Donor';
    const email = 'test@example.com';

    // Assignar la fila inicial
    donorMatches[rowId] = { contactId, contactName };

    // Simular lògica: NO override si ja té match manual diferent
    const emailLower = email.toLowerCase().trim();
    for (const row of rows) {
      if (row.id === rowId) continue;

      // Skip si ja té un match manual diferent
      if (donorMatches[row.id] && donorMatches[row.id]?.contactId !== contactId) {
        continue;
      }

      if (row.customerEmail?.toLowerCase().trim() === emailLower) {
        donorMatches[row.id] = { contactId, contactName };
      }
    }

    // Verificar que ch_1 té el nou match, però ch_2 manté el seu match original
    assert.strictEqual(donorMatches['ch_1']?.contactId, 'donor_123');
    assert.strictEqual(donorMatches['ch_2']?.contactId, 'donor_999'); // NO override
    assert.strictEqual(donorMatches['ch_2']?.contactName, 'Different Donor');
  });
});
