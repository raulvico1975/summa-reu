import assert from 'node:assert/strict';
import test from 'node:test';

import type { AnyContact, Category, ClassificationMemoryEntry, Donor, Supplier } from '@/lib/data';
import {
  CATEGORY_AI_CONFIDENCE_THRESHOLD,
  CONTACT_AI_CONFIDENCE_THRESHOLD,
  canAutoApplyAiCategoryDecision,
  canAutoApplyAiContactDecision,
  resolveAutomaticCategoryDecision,
  resolveAutomaticContactDecision,
} from '@/lib/transaction-classification/decision-engine';
import {
  normalizeDecisionDescription,
  normalizeDecisionText,
} from '@/lib/transaction-classification/normalize';

function buildDonor(id: string, name: string, overrides: Partial<Donor> = {}): Donor {
  return {
    id,
    type: 'donor',
    donorType: 'individual',
    membershipType: 'one-time',
    name,
    taxId: '',
    zipCode: '08001',
    createdAt: '2026-04-22T10:00:00.000Z',
    ...overrides,
  };
}

function buildSupplier(id: string, name: string, overrides: Partial<Supplier> = {}): Supplier {
  return {
    id,
    type: 'supplier',
    name,
    taxId: '',
    zipCode: '08001',
    createdAt: '2026-04-22T10:00:00.000Z',
    ...overrides,
  };
}

const incomeCategory: Category = {
  id: 'cat-income',
  name: 'Donacions',
  type: 'income',
};

const subsidyCategory: Category = {
  id: 'cat-subsidy',
  name: 'Subvencions',
  type: 'income',
};

const expenseCategory: Category = {
  id: 'cat-expense',
  name: 'Subministraments',
  type: 'expense',
};

test('normalizeDecisionDescription strips boilerplate and unstable numeric noise', () => {
  assert.equal(
    normalizeDecisionDescription('TRANSFERENCIA SEPA RECIBO ENDESA 123456789'),
    'endesa'
  );
  assert.equal(normalizeDecisionText('Fundació Barça, S.L.'), 'fundacio barca s.l.');
});

test('strong identifier evidence still auto-assigns contact and default category', () => {
  const supplier = buildSupplier('sup-1', 'Endesa Energia', {
    taxId: 'B12345678',
    defaultCategoryId: expenseCategory.id,
  });

  const contactDecision = resolveAutomaticContactDecision({
    description: 'REBUT ENDESA B12345678',
    amount: -82,
    contacts: [supplier],
    categories: [expenseCategory],
  });

  assert.deepEqual(contactDecision, {
    contactId: supplier.id,
    contactType: 'supplier',
    source: 'hard',
  });

  const categoryDecision = resolveAutomaticCategoryDecision({
    description: 'REBUT ENDESA B12345678',
    amount: -82,
    categories: [expenseCategory],
    confirmedContact: supplier,
  });

  assert.deepEqual(categoryDecision, {
    categoryId: expenseCategory.id,
    source: 'contact',
  });
});

test('ambiguous name match that used to be permissive now stays empty', () => {
  const contacts: AnyContact[] = [
    buildDonor('donor-1', 'Maria Garcia'),
    buildDonor('donor-2', 'Maria Garcia Lopez'),
  ];

  const decision = resolveAutomaticContactDecision({
    description: 'TRANSFERENCIA MARIA GARCIA LOPEZ',
    amount: 50,
    contacts,
    categories: [incomeCategory],
  });

  assert.equal(decision, null);
});

test('memory only auto-applies after repeated confirmed corrections', () => {
  const donor = buildDonor('donor-1', 'Laura Serra');
  const memoryEntries: ClassificationMemoryEntry[] = [
    {
      id: 'mem-1',
      normalizedDescription: normalizeDecisionDescription('quota laura serra 2026'),
      contactId: donor.id,
      categoryId: incomeCategory.id,
      usageCount: 2,
      lastUsedAt: '2026-04-22T12:00:00.000Z',
    },
  ];

  const contactDecision = resolveAutomaticContactDecision({
    description: 'QUOTA LAURA SERRA 2026',
    amount: 25,
    contacts: [donor],
    categories: [incomeCategory],
    memoryEntries,
  });

  assert.deepEqual(contactDecision, {
    contactId: donor.id,
    contactType: 'donor',
    source: 'memory',
  });

  const categoryDecision = resolveAutomaticCategoryDecision({
    description: 'QUOTA LAURA SERRA 2026',
    amount: 25,
    categories: [incomeCategory, subsidyCategory],
    memoryEntries,
  });

  assert.deepEqual(categoryDecision, {
    categoryId: incomeCategory.id,
    source: 'memory',
  });
});

test('deterministic category rules still work without a contact', () => {
  const decision = resolveAutomaticCategoryDecision({
    description: 'Transferencia ACCD projecte cooperacio',
    amount: 1200,
    categories: [incomeCategory, subsidyCategory],
  });

  assert.deepEqual(decision, {
    categoryId: subsidyCategory.id,
    source: 'rule',
  });
});

test('ai thresholds are conservative for both contact and category', () => {
  assert.equal(CONTACT_AI_CONFIDENCE_THRESHOLD, 0.85);
  assert.equal(CATEGORY_AI_CONFIDENCE_THRESHOLD, 0.85);
  assert.equal(
    canAutoApplyAiContactDecision({ contactId: 'contact-1', confidence: 0.84 }),
    false
  );
  assert.equal(
    canAutoApplyAiContactDecision({ contactId: 'contact-1', confidence: 0.85 }),
    true
  );
  assert.equal(
    canAutoApplyAiCategoryDecision({ categoryId: 'cat-1', confidence: 0.84 }),
    false
  );
  assert.equal(
    canAutoApplyAiCategoryDecision({ categoryId: 'cat-1', confidence: 0.85 }),
    true
  );
});
