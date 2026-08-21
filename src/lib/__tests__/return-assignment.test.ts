import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSingleReturnAssignmentPlan } from '../returns/assignReturnAtomically';

describe('single return assignment plan', () => {
  it('crea una parella completa sense cap camp undefined', () => {
    const plan = buildSingleReturnAssignmentPlan({
      returnTransaction: { id: 'return-10', amount: -10 },
      donorId: 'donor-1',
      linkedDonation: {
        id: 'donation-10',
        amount: 10,
        contactId: 'donor-1',
        transactionType: 'donation',
      },
    });

    assert.deepEqual(plan, {
      returnUpdate: {
        transactionType: 'return',
        contactId: 'donor-1',
        contactType: 'donor',
        linkedTransactionId: 'donation-10',
      },
      donationUpdate: {
        donationStatus: 'returned',
        linkedTransactionId: 'return-10',
      },
    });
    assert.equal(JSON.stringify(plan).includes('undefined'), false);
  });

  it('marca partial quan la devolució és inferior a la donació', () => {
    const plan = buildSingleReturnAssignmentPlan({
      returnTransaction: { id: 'return-30', amount: -30 },
      donorId: 'donor-1',
      linkedDonation: {
        id: 'donation-100',
        amount: 100,
        contactId: 'donor-1',
        transactionType: 'donation',
      },
    });

    assert.equal(plan.donationUpdate?.donationStatus, 'partial');
  });

  it('permet una devolució sense parella i conserva linkedTransactionId com null', () => {
    const plan = buildSingleReturnAssignmentPlan({
      returnTransaction: { id: 'return-30', amount: -30 },
      donorId: 'donor-1',
    });

    assert.equal(plan.returnUpdate.linkedTransactionId, null);
    assert.equal(plan.donationUpdate, null);
  });

  it('bloqueja imports superiors, donants diferents i sobreescriptura de vincles', () => {
    assert.throws(() => buildSingleReturnAssignmentPlan({
      returnTransaction: { id: 'return-110', amount: -110 },
      donorId: 'donor-1',
      linkedDonation: {
        id: 'donation-100',
        amount: 100,
        contactId: 'donor-1',
        transactionType: 'donation',
      },
    }), /cannot exceed/);

    assert.throws(() => buildSingleReturnAssignmentPlan({
      returnTransaction: { id: 'return-10', amount: -10 },
      donorId: 'donor-1',
      linkedDonation: {
        id: 'donation-10',
        amount: 10,
        contactId: 'donor-2',
        transactionType: 'donation',
      },
    }), /different donor/);

    assert.throws(() => buildSingleReturnAssignmentPlan({
      returnTransaction: { id: 'return-10', amount: -10 },
      donorId: 'donor-1',
      linkedDonation: {
        id: 'donation-10',
        amount: 10,
        contactId: 'donor-1',
        transactionType: 'donation',
        linkedTransactionId: 'another-return',
      },
    }), /already assigned/);
  });
});
