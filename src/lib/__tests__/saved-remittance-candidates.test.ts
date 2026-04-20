import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SepaCollectionRunHistorySummary } from '../sepa/pain008/run-history';
import {
  rankSavedRemittanceCandidates,
  validateSavedRemittanceSelection,
} from '../sepa/pain008/saved-remittance-candidates';

function makeRun(
  overrides: Partial<SepaCollectionRunHistorySummary> & { id: string }
): SepaCollectionRunHistorySummary {
  const hasStoragePath = Object.prototype.hasOwnProperty.call(overrides, 'storagePath');
  const hasFilename = Object.prototype.hasOwnProperty.call(overrides, 'filename');
  return {
    id: overrides.id,
    scheme: 'CORE',
    bankAccountId: overrides.bankAccountId ?? 'bank-1',
    collectionDate: overrides.collectionDate ?? '2026-04-20',
    createdAt: overrides.createdAt ?? '2026-04-16T10:00:00.000Z',
    exportedAt: overrides.exportedAt ?? '2026-04-16T10:01:00.000Z',
    itemCount: overrides.itemCount ?? 12,
    includedCount: overrides.includedCount ?? overrides.itemCount ?? 12,
    excludedCount: overrides.excludedCount ?? 0,
    totalCents: overrides.totalCents ?? 12500,
    filename: hasFilename ? overrides.filename ?? null : 'remesa.xml',
    storagePath: hasStoragePath ? overrides.storagePath ?? null : `organizations/org-1/sepaCollectionRuns/${overrides.id}/remesa.xml`,
    messageId: overrides.messageId ?? `MSG-${overrides.id}`,
  };
}

describe('rankSavedRemittanceCandidates', () => {
  it('destaca una candidata forta única quan compte, import i data encaixen', () => {
    const result = rankSavedRemittanceCandidates({
      transaction: {
        bankAccountId: 'bank-1',
        amount: 125,
        date: '2026-04-20',
      },
      runs: [
        makeRun({ id: 'run-1', totalCents: 12500, collectionDate: '2026-04-19', itemCount: 9 }),
        makeRun({ id: 'run-2', totalCents: 13000, collectionDate: '2026-04-18' }),
        makeRun({ id: 'run-3', bankAccountId: 'bank-2', totalCents: 12500, collectionDate: '2026-04-20' }),
      ],
    });

    assert.equal(result.suggested?.id, 'run-1');
    assert.equal(result.possible.length, 1);
    assert.equal(result.possible[0]?.id, 'run-1');
  });

  it('no preselecciona si hi ha múltiples candidates plausibles i les ordena per data i cobraments', () => {
    const result = rankSavedRemittanceCandidates({
      transaction: {
        bankAccountId: 'bank-1',
        amount: 125,
        date: '2026-04-20',
      },
      runs: [
        makeRun({ id: 'run-1', totalCents: 12500, collectionDate: '2026-04-20', itemCount: 4 }),
        makeRun({ id: 'run-2', totalCents: 12500, collectionDate: '2026-04-20', itemCount: 10 }),
        makeRun({ id: 'run-3', totalCents: 12500, collectionDate: '2026-04-21', itemCount: 20 }),
      ],
    });

    assert.equal(result.suggested, null);
    assert.deepEqual(
      result.possible.map((candidate) => candidate.id),
      ['run-2', 'run-1', 'run-3']
    );
  });

  it('retorna cap coincidència clara si no es pot verificar el compte bancari del moviment', () => {
    const result = rankSavedRemittanceCandidates({
      transaction: {
        bankAccountId: null,
        amount: 125,
        date: '2026-04-20',
      },
      runs: [
        makeRun({ id: 'run-1', totalCents: 12500, collectionDate: '2026-04-20' }),
      ],
    });

    assert.equal(result.suggested, null);
    assert.equal(result.possible.length, 0);
    assert.equal(result.reason, 'missing_bank_account');
  });

  it('descarta remeses sense XML disponible o amb import incoherent', () => {
    const result = rankSavedRemittanceCandidates({
      transaction: {
        bankAccountId: 'bank-1',
        amount: 125,
        date: '2026-04-20',
      },
      runs: [
        makeRun({ id: 'run-1', totalCents: 12500, storagePath: null }),
        makeRun({ id: 'run-2', totalCents: 12497 }),
      ],
    });

    assert.equal(result.suggested, null);
    assert.equal(result.possible.length, 0);
    assert.equal(result.reason, 'no_clear_match');
  });
});

describe('validateSavedRemittanceSelection', () => {
  it('accepta la remesa guardada quan compte i import són coherents', () => {
    const result = validateSavedRemittanceSelection({
      transactionBankAccountId: 'bank-1',
      savedRunBankAccountId: 'bank-1',
      transactionAmount: 125,
      savedRunTotalCents: 12501,
    });

    assert.equal(result.valid, true);
    assert.equal(result.reason, null);
  });

  it('bloqueja si el moviment no té compte bancari verificable', () => {
    const result = validateSavedRemittanceSelection({
      transactionBankAccountId: null,
      savedRunBankAccountId: 'bank-1',
      transactionAmount: 125,
      savedRunTotalCents: 12500,
    });

    assert.equal(result.valid, false);
    assert.equal(result.reason, 'missing_transaction_bank_account');
  });

  it('bloqueja si el compte de la remesa guardada no coincideix', () => {
    const result = validateSavedRemittanceSelection({
      transactionBankAccountId: 'bank-1',
      savedRunBankAccountId: 'bank-2',
      transactionAmount: 125,
      savedRunTotalCents: 12500,
    });

    assert.equal(result.valid, false);
    assert.equal(result.reason, 'bank_account_mismatch');
  });

  it('bloqueja si l import no encaixa dins la tolerància actual', () => {
    const result = validateSavedRemittanceSelection({
      transactionBankAccountId: 'bank-1',
      savedRunBankAccountId: 'bank-1',
      transactionAmount: 125,
      savedRunTotalCents: 12503,
    });

    assert.equal(result.valid, false);
    assert.equal(result.reason, 'amount_mismatch');
  });
});
