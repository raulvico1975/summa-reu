import assert from 'node:assert/strict';
import { computeModel347 } from '../../src/lib/reports/model347';
import { mergeUnifiedFiscalDonations } from '../../src/lib/fiscal/getUnifiedFiscalDonations';
import { mergeTransactionsWithStripeDonations } from '../../src/lib/fiscal/stripe-donations-fiscal-source';

// ─── Helpers ────────────────────────────────────────────────────────────────
const supplier = { id: 's1', type: 'supplier', name: 'Proveïdor SL', taxId: 'B12345678', zipCode: '08001' } as any;

// ─── Error 2: Model 347 pare+fills ──────────────────────────────────────────
{
  const txs = [
    { id: 'parent', date: '2025-02-10', description: 'banc', amount: -4000, contactId: 's1', contactType: 'supplier', archivedAt: null, isSplit: true },
    { id: 'childA', date: '2025-02-10', description: 'fill A', amount: -2000, contactId: 's1', contactType: 'supplier', archivedAt: null, parentTransactionId: 'parent' },
    { id: 'childB', date: '2025-03-05', description: 'fill B', amount: -2000, contactId: 's1', contactType: 'supplier', archivedAt: null, parentTransactionId: 'parent' },
  ];
  const res = computeModel347(txs as any, [supplier], [], 2025, new Set());
  assert.equal(res.expenses[0]?.quarters.total, 4000, 'E2: pare+fills han de sumar 4.000, no 8.000');
}

{
  // Pare de remesa amb filles actives
  const txs = [
    { id: 'remParent', date: '2025-02-10', description: 'remesa', amount: 5000, contactId: 's1', contactType: 'supplier', archivedAt: null, isRemittance: true },
    { id: 'remChild', date: '2025-02-10', description: 'filla', amount: 5000, contactId: 's1', contactType: 'supplier', archivedAt: null, parentTransactionId: 'remParent' },
  ];
  const res = computeModel347(txs as any, [supplier], [], 2025, new Set());
  assert.equal(res.income[0]?.quarters.total, 5000, 'E2: pare remesa no es compta dues vegades');
}

{
  // Pare sense fills actius → es preserva
  const txs = [
    { id: 'loneParent', date: '2025-02-10', description: 'banc', amount: -4000, contactId: 's1', contactType: 'supplier', archivedAt: null, isSplit: true },
    { id: 'deadChild', date: '2025-02-10', description: 'fill arxivat', amount: -2000, contactId: 's1', contactType: 'supplier', archivedAt: '2025-02-11', parentTransactionId: 'loneParent' },
  ];
  // El caller filtra arxivades (invariant A2), com fa el handler del 347
  const activeOnly = (txs as any).filter((t: any) => !t.archivedAt);
  const res = computeModel347(activeOnly, [supplier], [], 2025, new Set());
  assert.equal(res.expenses[0]?.quarters.total, 4000, 'E2: pare sense filles actives es manté (4.000)');
}

{
  // Fills d'altre proveïdor no contaminen
  const otherSupplier = { ...supplier, id: 's2' } as any;
  const txs = [
    { id: 'p2', date: '2025-02-10', description: 'banc', amount: -4000, contactId: 's1', contactType: 'supplier', archivedAt: null, isSplit: true },
    { id: 'cOther', date: '2025-02-10', description: 'fill altre prov.', amount: -2000, contactId: 's2', contactType: 'supplier', archivedAt: null, parentTransactionId: 'p2' },
  ];
  const res = computeModel347(txs as any, [supplier, otherSupplier], [], 2025, new Set());
  const s1 = res.expenses.find(e => e.contactId === 's1');
  assert.equal(s1?.quarters.total, 4000, 'E2: fill sense proveïdor pare no exclou el pare');
}

// ─── Error 3: Stripe duplicat ───────────────────────────────────────────────
{
  // Cas reproductor: donació sense stripePaymentId + tx amb parentTransactionId
  const donations = [
    { id: 'don_1', type: 'donation', contactId: 'd1', date: '2025-05-01', amountGross: 50, parentTransactionId: 'tx_1', archivedAt: null },
  ] as any;
  const transactions = [
    { id: 'tx_1', date: '2025-05-01', amount: 50, contactId: 'd1', transactionType: 'donation', source: 'stripe', archivedAt: null },
  ] as any;
  assert.equal(mergeUnifiedFiscalDonations({ transactions, donations }).length, 1, 'E3: sobreviu una sola donació');
}
{
  // stripePaymentId compartit continua deduplicant
  const donations = [{ id: 'don_1', type: 'donation', contactId: 'd1', date: '2025-05-01', amountGross: 25, stripePaymentId: 'pi_123', archivedAt: null }] as any;
  const transactions = [{ id: 'tx_1', date: '2025-05-01', amount: 25, contactId: 'd1', transactionType: 'donation', source: 'stripe', stripePaymentId: 'pi_123', archivedAt: null }] as any;
  assert.equal(mergeUnifiedFiscalDonations({ transactions, donations }).length, 1, 'E3: clau forta segueix funcionant');
}
{
  // FALS POSITIU: dues donacions reals mateix donant/import/data sense relació estructural → NO es fusionen
  const donations = [
    { id: 'don_a', type: 'donation', contactId: 'd1', date: '2025-05-01', amountGross: 25, archivedAt: null },
    { id: 'don_b', type: 'donation', contactId: 'd1', date: '2025-05-01', amountGross: 25, archivedAt: null },
  ] as any;
  const merged = mergeUnifiedFiscalDonations({ transactions: [] as any, donations });
  assert.equal(merged.length, 2, 'E3: donacions reals diferents NO es fusionen');
}
{
  // FALS POSITIU: mismatch d'import amb parentTransactionId → NO es dedupliquen
  const donations = [
    { id: 'don_1', type: 'donation', contactId: 'd1', date: '2025-05-01', amountGross: 40, parentTransactionId: 'tx_1', archivedAt: null },
  ] as any;
  const transactions = [
    { id: 'tx_1', date: '2025-05-01', amount: 50, contactId: 'd1', transactionType: 'donation', source: 'stripe', archivedAt: null },
  ] as any;
  assert.equal(mergeUnifiedFiscalDonations({ transactions, donations }).length, 2, 'E3: mismatch import impedeix dedupe');
}
{
  // mergeTransactionsWithStripeDonations (font alternativa) manté comportament
  const transactions = [{ id: 'tx_1', date: '2025-05-01', amount: 25, contactId: 'd1', transactionType: 'donation', source: 'stripe', stripePaymentId: 'pi_123', archivedAt: null }] as any;
  const donations = [{ id: 'don_1', source: 'stripe', type: 'donation', contactId: 'd1', date: '2025-05-01', amountGross: 25, stripePaymentId: 'pi_123', archivedAt: null }] as any;
  assert.equal(mergeTransactionsWithStripeDonations(transactions, donations).length, 1, 'E3: merger alternatiu intacte');
}

console.log('✅ Tots els tests del paquet fiscal passen (Error 2 i Error 3, positius + falsos positius)');
