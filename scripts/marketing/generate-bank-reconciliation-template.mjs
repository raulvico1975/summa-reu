#!/usr/bin/env node

import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';

const OUTPUT_DIR = resolve('public/recursos');
const ROW_COUNT = 200;

const locales = {
  ca: {
    fileName: 'plantilla-conciliacio-bancaria-ong-ca.xlsx',
    sheetName: 'Conciliacio',
    instructionsName: 'Instruccions',
    headers: [
      'Data moviment',
      'Compte',
      'Referència bancària',
      'Concepte',
      'Import bancari',
      'Import registre intern',
      'Diferència',
      'Estat',
      'Persona responsable',
      'Data revisió',
      'Observacions',
    ],
    example: [
      new Date('2026-01-15T00:00:00Z'),
      'Compte principal',
      'EXEMPLE-001',
      'Quota soci gener',
      50,
      50,
      null,
      'Conciliat',
      'Nom revisor/a',
      new Date('2026-01-31T00:00:00Z'),
      "Fila d'exemple: elimina-la abans de començar",
    ],
    instructionRows: [
      ['Plantilla de conciliació bancària per a ONG i associacions'],
      ['Ús', 'Compara cada moviment de l’extracte amb el registre intern de l’entitat.'],
      ['Diferència', 'Es calcula automàticament: import bancari menys import del registre intern.'],
      ['Estats recomanats', 'Conciliat, Pendent, Duplicat o No identificat.'],
      ['Tancament', 'Filtra les diferències diferents de zero i els estats pendents abans de tancar el període.'],
      ['Privacitat', 'No hi afegeixis dades personals que no siguin necessàries per a la revisió.'],
      ['Avís', 'Aquesta plantilla és una eina de control intern i no substitueix la comptabilitat oficial ni l’assessorament professional.'],
    ],
  },
  es: {
    fileName: 'plantilla-conciliacion-bancaria-ong-es.xlsx',
    sheetName: 'Conciliacion',
    instructionsName: 'Instrucciones',
    headers: [
      'Fecha movimiento',
      'Cuenta',
      'Referencia bancaria',
      'Concepto',
      'Importe bancario',
      'Importe registro interno',
      'Diferencia',
      'Estado',
      'Persona responsable',
      'Fecha revisión',
      'Observaciones',
    ],
    example: [
      new Date('2026-01-15T00:00:00Z'),
      'Cuenta principal',
      'EJEMPLO-001',
      'Cuota socio enero',
      50,
      50,
      null,
      'Conciliado',
      'Nombre revisor/a',
      new Date('2026-01-31T00:00:00Z'),
      'Fila de ejemplo: elimínala antes de empezar',
    ],
    instructionRows: [
      ['Plantilla de conciliación bancaria para ONG y asociaciones'],
      ['Uso', 'Compara cada movimiento del extracto con el registro interno de la entidad.'],
      ['Diferencia', 'Se calcula automáticamente: importe bancario menos importe del registro interno.'],
      ['Estados recomendados', 'Conciliado, Pendiente, Duplicado o No identificado.'],
      ['Cierre', 'Filtra las diferencias distintas de cero y los estados pendientes antes de cerrar el periodo.'],
      ['Privacidad', 'No añadas datos personales que no sean necesarios para la revisión.'],
      ['Aviso', 'Esta plantilla es una herramienta de control interno y no sustituye la contabilidad oficial ni el asesoramiento profesional.'],
    ],
  },
};

function buildWorkbook(copy) {
  const rows = [copy.headers, copy.example];
  for (let row = 3; row <= ROW_COUNT + 1; row += 1) {
    rows.push(['', '', '', '', '', '', null, '', '', '', '']);
  }

  const reconciliation = XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
  for (let row = 2; row <= ROW_COUNT + 1; row += 1) {
    reconciliation[`G${row}`] = {
      t: 'n',
      f: `IF(OR(E${row}="",F${row}=""),"",ROUND(E${row}-F${row},2))`,
      v: 0,
      z: '#,##0.00',
    };
    if (reconciliation[`A${row}`]) reconciliation[`A${row}`].z = 'yyyy-mm-dd';
    if (reconciliation[`J${row}`]) reconciliation[`J${row}`].z = 'yyyy-mm-dd';
    if (reconciliation[`E${row}`]) reconciliation[`E${row}`].z = '#,##0.00';
    if (reconciliation[`F${row}`]) reconciliation[`F${row}`].z = '#,##0.00';
  }
  reconciliation['!autofilter'] = { ref: `A1:K${ROW_COUNT + 1}` };
  reconciliation['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };
  reconciliation['!cols'] = [
    { wch: 15 },
    { wch: 22 },
    { wch: 22 },
    { wch: 34 },
    { wch: 17 },
    { wch: 22 },
    { wch: 14 },
    { wch: 18 },
    { wch: 22 },
    { wch: 15 },
    { wch: 45 },
  ];

  const instructions = XLSX.utils.aoa_to_sheet(copy.instructionRows);
  instructions['!cols'] = [{ wch: 24 }, { wch: 110 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, reconciliation, copy.sheetName);
  XLSX.utils.book_append_sheet(workbook, instructions, copy.instructionsName);
  workbook.Props = {
    Title: copy.instructionRows[0][0],
    Subject: 'Recurs gratuït de control intern',
    Author: 'Summa Social',
    Company: 'Summa Social',
  };
  workbook.Workbook = {
    CalcPr: {
      calcMode: 'auto',
      fullCalcOnLoad: true,
      forceFullCalc: true,
    },
  };
  return workbook;
}

mkdirSync(OUTPUT_DIR, { recursive: true });

for (const copy of Object.values(locales)) {
  XLSX.writeFile(buildWorkbook(copy), resolve(OUTPUT_DIR, copy.fileName), {
    bookType: 'xlsx',
    compression: true,
  });
  process.stdout.write(`Generada ${copy.fileName}\n`);
}
