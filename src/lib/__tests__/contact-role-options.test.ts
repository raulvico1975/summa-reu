import test from 'node:test';
import assert from 'node:assert/strict';

import type { AnyContact } from '@/lib/data';
import {
  buildContactRoleOptions,
  parseContactRoleValue,
  resolveContactRoleOption,
  serializeContactRoleValue,
} from '@/lib/contacts/contact-role-options';

const donorEmployee: AnyContact = {
  id: 'contact-1',
  type: 'donor',
  roles: { donor: true, employee: true },
  name: 'Maria Puig',
  taxId: '12345678A',
  zipCode: '08001',
  donorType: 'individual',
  membershipType: 'one-time',
  createdAt: '2026-04-01T10:00:00.000Z',
};

test('buildContactRoleOptions creates one option per effective role', () => {
  const options = buildContactRoleOptions([donorEmployee]);

  assert.deepEqual(
    options.map((option) => [option.contactId, option.contactType, option.isMultiRole]),
    [
      ['contact-1', 'donor', true],
      ['contact-1', 'employee', true],
    ]
  );
});

test('resolveContactRoleOption falls back to the primary type for legacy rows', () => {
  const option = resolveContactRoleOption([donorEmployee], donorEmployee.id, null);

  assert.equal(option?.contactId, donorEmployee.id);
  assert.equal(option?.contactType, 'donor');
});

test('resolveContactRoleOption keeps the explicit role for multi-role contacts', () => {
  const option = resolveContactRoleOption([donorEmployee], donorEmployee.id, 'employee');

  assert.equal(option?.contactId, donorEmployee.id);
  assert.equal(option?.contactType, 'employee');
});

test('serializeContactRoleValue round-trips through parseContactRoleValue', () => {
  const serialized = serializeContactRoleValue('contact-1', 'employee');
  const parsed = parseContactRoleValue(serialized);

  assert.deepEqual(parsed, {
    contactId: 'contact-1',
    contactType: 'employee',
  });
});
