import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PUBLIC_TRANSACTION_DTO_KEYS,
  serializePublicTransaction,
} from '@/lib/transactions/public-transaction-dto';

test('serializePublicTransaction: retorna només les claus permeses i normalitza notes legacy', () => {
  const dto = serializePublicTransaction('tx-1', {
    date: '2026-03-20',
    operationDate: '2026-03-19',
    description: 'Donacio',
    amount: 42.5,
    balanceAfter: 100.5,
    category: 'cat-1',
    contactId: 'contact-1',
    contactType: 'donor',
    projectId: 'project-1',
    document: 'invoice.pdf',
    notes: 'nota legacy',
    source: 'bank',
    transactionType: 'donation',
    isSplit: true,
    parentTransactionId: 'parent-1',
    isRemittance: true,
    isRemittanceItem: false,
    remittanceId: 'rem-1',
    remittanceType: 'returns',
    remittanceStatus: 'partial',
    remittanceItemCount: 3,
    remittanceResolvedCount: 2,
    remittancePendingCount: 1,
    remittancePendingTotalAmount: 12.34,
    bankAccountId: 'bank-1',
    archivedAt: '2026-03-21T10:00:00.000Z',
    donationStatus: 'completed',
    stripeTransferId: 'tr_123',
    createdByUid: 'secret-user',
    linkedTransactionIds: ['child-1'],
    pendingReturns: [{ iban: 'ES123' }],
    fiscalKind: 'donation',
    archivedByUid: 'archiver',
    internalPayload: { debug: true },
  });

  assert.deepEqual(
    Object.keys(dto).sort(),
    [...PUBLIC_TRANSACTION_DTO_KEYS].sort()
  );
  assert.equal(dto.note, 'nota legacy');
  assert.equal(dto.contactType, 'donor');
  assert.equal(dto.remittanceStatus, 'partial');
  assert.equal('createdByUid' in dto, false);
  assert.equal('linkedTransactionIds' in dto, false);
  assert.equal('pendingReturns' in dto, false);
  assert.equal('fiscalKind' in dto, false);
  assert.equal('archivedByUid' in dto, false);
  assert.equal('internalPayload' in dto, false);
});
