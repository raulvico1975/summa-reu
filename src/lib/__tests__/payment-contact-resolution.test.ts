import test from 'node:test';
import assert from 'node:assert/strict';

import type { AnyContact } from '@/lib/data';
import {
  findPaymentBeneficiary,
  resolvePaymentChildContactType,
} from '@/lib/remittances/payment-contact-resolution';

const employeeContact: AnyContact = {
  id: 'employee-1',
  type: 'employee',
  roles: { employee: true },
  name: 'Maria Puig',
  taxId: '12345678A',
  zipCode: '08001',
  iban: 'ES1200000000000000000001',
  createdAt: '2026-04-01T10:00:00.000Z',
};

const supplierContact: AnyContact = {
  id: 'supplier-1',
  type: 'supplier',
  roles: { supplier: true },
  name: 'Proveidor Nord',
  taxId: 'B12345678',
  zipCode: '08002',
  iban: 'ES9800000000000000000002',
  createdAt: '2026-04-01T10:00:00.000Z',
};

test('findPaymentBeneficiary prioritizes employee matches before supplier matches', () => {
  const sharedIbanSupplier: AnyContact = {
    ...supplierContact,
    id: 'supplier-2',
    iban: employeeContact.iban,
    taxId: 'B87654321',
    name: 'Assessoria Global',
  };

  const result = findPaymentBeneficiary({
    name: 'Maria Puig',
    taxId: employeeContact.taxId,
    iban: employeeContact.iban ?? '',
    contacts: [sharedIbanSupplier, employeeContact],
  });

  assert.equal(result.contact?.id, employeeContact.id);
  assert.equal(result.contactType, 'employee');
});

test('findPaymentBeneficiary still resolves a supplier when no employee matches', () => {
  const result = findPaymentBeneficiary({
    name: supplierContact.name,
    taxId: supplierContact.taxId,
    iban: supplierContact.iban ?? '',
    contacts: [supplierContact],
  });

  assert.equal(result.contact?.id, supplierContact.id);
  assert.equal(result.contactType, 'supplier');
});

test('resolvePaymentChildContactType prefers manual employee selection', () => {
  const result = resolvePaymentChildContactType({
    contactId: employeeContact.id,
    status: 'new_without_taxid',
    manualMatchContactType: 'employee',
    matchedContactType: 'supplier',
  });

  assert.equal(result, 'employee');
});

test('resolvePaymentChildContactType keeps supplier for auto-created suppliers', () => {
  const result = resolvePaymentChildContactType({
    contactId: supplierContact.id,
    status: 'new_with_taxid',
  });

  assert.equal(result, 'supplier');
});
