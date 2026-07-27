import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import XLSX from 'xlsx';

const resources = [
  {
    xlsx: 'public/recursos/plantilla-conciliacio-bancaria-ong-ca.xlsx',
    csv: 'public/recursos/plantilla-conciliacio-bancaria-ong-ca.csv',
    sheet: 'Conciliacio',
    header: 'Referència bancària',
  },
  {
    xlsx: 'public/recursos/plantilla-conciliacion-bancaria-ong-es.xlsx',
    csv: 'public/recursos/plantilla-conciliacion-bancaria-ong-es.csv',
    sheet: 'Conciliacion',
    header: 'Referencia bancaria',
  },
];

for (const resource of resources) {
  test(`bank reconciliation resource is usable: ${resource.sheet}`, () => {
    const csv = readFileSync(resource.csv, 'utf8');
    assert.match(csv, /referencia_bancaria/);
    assert.doesNotMatch(csv, /\bundefined\b/);

    const workbook = XLSX.readFile(resource.xlsx, { cellDates: true });
    const sheet = workbook.Sheets[resource.sheet];
    assert.ok(sheet);
    assert.equal(sheet.C1?.v, resource.header);
    assert.match(String(sheet.G2?.f), /ROUND\(E2-F2,2\)/);
    assert.ok(sheet['!autofilter']);
  });
}
