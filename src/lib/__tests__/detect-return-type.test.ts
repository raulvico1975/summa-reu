import { describe, it } from 'node:test';
import assert from 'node:assert';
import { detectReturnType } from '../data';

describe('detectReturnType', () => {
  it('detecta devolucions de rebut amb patrons bancaris habituals', () => {
    assert.strictEqual(detectReturnType('ADEUDO DEVOLUCION RECIBOS'), 'return');
    assert.strictEqual(detectReturnType('DEV.RECIBO ADEUDO SEPA'), 'return');
    assert.strictEqual(detectReturnType('RECIBO DEVUELTO CUOTA SOCIO'), 'return');
    assert.strictEqual(detectReturnType('RECHAZO RECIBO SEPA'), 'return');
    assert.strictEqual(detectReturnType('ADEUDO RECIBOS RECHAZADOS'), 'return');
    assert.strictEqual(detectReturnType('ADEUDO REBUTS REBUTJATS'), 'return');
  });

  it('detecta variants internacionals i codis operatius', () => {
    assert.strictEqual(detectReturnType('SEPA DD RETURN 2026-01'), 'return');
    assert.strictEqual(detectReturnType('RETURNED DIRECT DEBIT MEMBER'), 'return');
    assert.strictEqual(detectReturnType('R-TRANSACTION CUOTA SOCIO'), 'return');
  });

  it('prioritza return_fee per sobre de return', () => {
    assert.strictEqual(detectReturnType('COMISION DEVOL. RECIBOS'), 'return_fee');
    assert.strictEqual(detectReturnType('Gastos Devoluciones De Recibos'), 'return_fee');
    assert.strictEqual(detectReturnType('Comisión por devolución de recibo'), 'return_fee');
    assert.strictEqual(detectReturnType('RJCT FEE SEPA DD'), 'return_fee');
    assert.strictEqual(detectReturnType('RETURNED DIRECT DEBIT FEE'), 'return_fee');
  });

  it('normalitza accents, puntuació i espais inconsistents', () => {
    assert.strictEqual(detectReturnType('  deVoLuCión  de   recibo  '), 'return');
    assert.strictEqual(detectReturnType('COMISIÓN DEVOLUCIÓN   RECIBO'), 'return_fee');
  });

  it('evita falsos positius de devolucions de targeta/compra', () => {
    assert.strictEqual(detectReturnType('ABONO TARJETA DEVOLUCION COMPRA AMAZON'), null);
    assert.strictEqual(detectReturnType('CARD REFUND SUPERMARKET'), null);
    assert.strictEqual(detectReturnType('REEMBOLSO TARJETA VISA'), null);
  });

  it('retorna null quan no és devolució', () => {
    assert.strictEqual(detectReturnType('PAGO NOMINA ENERO'), null);
    assert.strictEqual(detectReturnType('TRANSFERENCIA RECIBIDA SOCIO'), null);
    assert.strictEqual(detectReturnType(''), null);
  });
});
