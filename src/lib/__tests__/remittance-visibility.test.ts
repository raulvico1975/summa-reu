import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isVisibleInMovementsLedger } from '../transactions/remittance-visibility';

describe('isVisibleInMovementsLedger', () => {
  it('mostra pare de remesa legacy (isRemittance=true, source=remittance)', () => {
    const visible = isVisibleInMovementsLedger({
      isRemittance: true,
      isRemittanceItem: false,
      source: 'remittance',
      archivedAt: null,
    }, {
      showArchived: false,
    });
    assert.equal(visible, true);
  });

  it('oculta filla de remesa (isRemittanceItem=true)', () => {
    const visible = isVisibleInMovementsLedger({
      isRemittance: false,
      isRemittanceItem: true,
      source: 'remittance',
      parentTransactionId: 'parent-1',
      archivedAt: null,
    }, {
      showArchived: false,
    });
    assert.equal(visible, false);
  });

  it("oculta filla legacy (sense isRemittanceItem) amb source='remittance' i parentTransactionId", () => {
    const visible = isVisibleInMovementsLedger({
      isRemittance: false,
      isRemittanceItem: false,
      source: 'remittance',
      parentTransactionId: 'parent-legacy-1',
      archivedAt: null,
    }, {
      showArchived: false,
    });
    assert.equal(visible, false);
  });

  it('gestiona arxivades: showArchived OFF oculta, ON mostra', () => {
    const tx = {
      isRemittance: true,
      isRemittanceItem: false,
      source: 'manual',
      archivedAt: '2026-03-01T10:00:00.000Z',
    } as const;

    const hidden = isVisibleInMovementsLedger(tx, { showArchived: false });
    const visible = isVisibleInMovementsLedger(tx, { showArchived: true });

    assert.equal(hidden, false);
    assert.equal(visible, true);
  });

  it("no oculta per source='remittance' si no és filla", () => {
    const visible = isVisibleInMovementsLedger({
      isRemittance: false,
      isRemittanceItem: false,
      source: 'remittance',
      parentTransactionId: null,
      archivedAt: null,
    }, {
      showArchived: false,
    });
    assert.equal(visible, true);
  });
});
