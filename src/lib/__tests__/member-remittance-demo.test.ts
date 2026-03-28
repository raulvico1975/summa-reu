import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDemoMemberRemittanceCsv,
  calculateDemoMemberRemittanceTotal,
  getDemoMemberRemittanceDate,
  selectDemoMemberRemittanceDonors,
} from '@/lib/demo/member-remittance-demo';

test('selectDemoMemberRemittanceDonors tria els recurrents actius amb IBAN i quota', () => {
  const donors = [
    { id: 'd-003', name: 'C', taxId: '333', iban: 'ES333', monthlyAmount: 30, membershipType: 'recurring', status: 'active' },
    { id: 'd-001', name: 'A', taxId: '111', iban: 'ES111', monthlyAmount: 10, membershipType: 'recurring', status: 'active' },
    { id: 'd-004', name: 'D', taxId: '444', iban: undefined, monthlyAmount: 40, membershipType: 'recurring', status: 'active' },
    { id: 'd-002', name: 'B', taxId: '222', iban: 'ES222', monthlyAmount: 20, membershipType: 'recurring', status: 'inactive' },
    { id: 'd-005', name: 'E', taxId: '555', iban: 'ES555', monthlyAmount: 0, membershipType: 'recurring', status: 'active' },
    { id: 'd-006', name: 'F', taxId: '666', iban: 'ES666', monthlyAmount: 60, membershipType: 'one-time', status: 'active' },
  ];

  const selected = selectDemoMemberRemittanceDonors(donors, 3);

  assert.deepEqual(selected.map((donor) => donor.id), ['d-001', 'd-003']);
});

test('buildDemoMemberRemittanceCsv genera capçalera i imports en format bancari', () => {
  const donors = [
    { id: 'd-001', name: 'Anna Puig', taxId: '11111111H', iban: 'ES1200010001000100010001', monthlyAmount: 12.5, membershipType: 'recurring', status: 'active' },
    { id: 'd-002', name: 'Bernat Serra', taxId: '22222222J', iban: 'ES3400020002000200020002', monthlyAmount: 30, membershipType: 'recurring', status: 'active' },
  ];

  const csv = buildDemoMemberRemittanceCsv(donors, '2026-03-18');

  assert.match(csv, /^Data;Nom;DNI\/NIF;IBAN;Import/m);
  assert.match(csv, /2026-03-18;Anna Puig;11111111H;ES1200010001000100010001;12,50/);
  assert.equal(calculateDemoMemberRemittanceTotal(donors), 42.5);
});

test('getDemoMemberRemittanceDate fixa una data recent respecte la referència', () => {
  const date = getDemoMemberRemittanceDate(new Date('2026-03-26T12:00:00'));
  assert.equal(date, '2026-03-18');
});
