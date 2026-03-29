import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildReturnEmailDraft } from '../returns/build-return-email-draft';

describe('build-return-email-draft', () => {
  it('genera el text amb nom quan està disponible', () => {
    const draft = buildReturnEmailDraft({
      contactName: 'Maria Serra',
      txDate: '2026-02-15',
      amount: -32.5,
      language: 'ca',
    });

    assert.match(draft, /Bon dia Maria Serra,/);
    assert.match(draft, /32,50/);
  });

  it('sense nom deixa salutació natural', () => {
    const draft = buildReturnEmailDraft({
      contactName: null,
      txDate: '2026-01-01',
      amount: -10,
      language: 'ca',
    });

    assert.ok(draft.startsWith('Bon dia,'));
  });

  it('usa la plantilla per defecte en castellà quan toca', () => {
    const draft = buildReturnEmailDraft({
      contactName: 'María',
      txDate: '2026-03-01',
      amount: -18,
      language: 'es',
    });

    assert.match(draft, /Buenos días María,/);
    assert.match(draft, /Hemos recibido la devolución/);
  });

  it('formata mes i import segons idioma i només reemplaça variables suportades', () => {
    const draft = buildReturnEmailDraft({
      contactName: 'Jean',
      txDate: '2026-11-03',
      amount: -1234.56,
      language: 'fr',
      organizationReturnTemplate: 'Salut {{name}} - {{month}} - {{amount}} - {{custom}}',
    });

    assert.match(draft, /2026/);
    assert.match(draft, /€|EUR/);
    assert.match(draft, /\{\{custom\}\}/);
  });
});
