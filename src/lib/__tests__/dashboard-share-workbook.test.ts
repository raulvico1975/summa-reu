import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';

import { buildDashboardShareWorkbook, type DashboardShareWorkbookTexts } from '../exports/dashboard-share-workbook';
import type { Category } from '../data';

const baseTexts: DashboardShareWorkbookTexts = {
  summarySheetName: 'Resum executiu',
  summaryColumns: {
    indicator: 'Concepte',
    value: 'Valor',
  },
  summaryMeta: {
    organization: 'Entitat',
    period: 'Periode',
    generatedAt: 'Data d exportacio',
  },
  summaryMetrics: {
    income: 'Ingressos totals',
    expenses: 'Despeses operatives',
    transfers: 'Transferencies a contraparts',
    balance: 'Balanc operatiu',
  },
  detailSheets: {
    incomeTop: 'Ingressos destacats',
    expensesTop: 'Projectes destacats',
    transfersTop: 'Contraparts destacades',
    incomeComplete: 'Ingressos detall',
    expensesComplete: 'Projectes detall',
    transfersComplete: 'Contraparts detall',
  },
  detailColumns: {
    incomeLabel: 'Categoria d ingres',
    expenseLabel: 'Projecte',
    transferLabel: 'Contrapart',
    amount: 'Import',
    percentage: '% sobre el total',
    operations: 'Moviments',
  },
  fallbacks: {
    uncategorized: 'Sense categoria',
    generalProject: 'Activitat general',
    noCounterpart: 'Sense contrapart',
  },
};

describe('buildDashboardShareWorkbook', () => {
  it('humanitza categories i elimina la columna d ID tecnic', () => {
    const categories: Category[] = [
      {
        id: 'ABCDEFGHIJKLMNOPQRST',
        name: 'subsidies',
        type: 'income',
      },
    ];

    const workbook = buildDashboardShareWorkbook({
      organizationName: 'Fundacio Exemple',
      periodLabel: 'Q1 2026',
      generatedAt: new Date('2026-04-04T09:30:00.000Z'),
      locale: 'ca-ES',
      categories,
      categoryTranslations: {
        subsidies: 'Subvencions',
      },
      incomeAggregates: {
        aggregated: [
          { id: 'ABCDEFGHIJKLMNOPQRST', name: 'ABCDEFGHIJKLMNOPQRST', amount: 1200, percentage: 100, count: 3 },
        ],
        complete: [
          { id: 'ABCDEFGHIJKLMNOPQRST', name: 'ABCDEFGHIJKLMNOPQRST', amount: 1200, percentage: 100, count: 3 },
        ],
        total: 1200,
      },
      expenseAggregates: { aggregated: [], complete: [], total: 0 },
      transferAggregates: { aggregated: [], complete: [], total: 0 },
      netBalance: 1200,
      texts: baseTexts,
    });

    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(
      workbook.Sheets[baseTexts.detailSheets.incomeTop],
      { header: 1, raw: false },
    );

    assert.deepEqual(rows[0], ['Categoria d ingres', 'Import', '% sobre el total', 'Moviments']);
    assert.equal(rows[1]?.[0], 'Subvencions');
    assert.equal(rows[1]?.[1], '1.200,00 €');
    assert.equal(rows[1]?.[2], '100.0%');
    assert.equal(rows[1]?.[3], '3');
    assert.equal(rows[0]?.includes('ID'), false);
  });

  it('substitueix noms tecnics de projecte per un fallback presentable', () => {
    const workbook = buildDashboardShareWorkbook({
      organizationName: 'Associacio Exemple',
      periodLabel: 'Març 2026',
      generatedAt: new Date('2026-04-04T09:30:00.000Z'),
      locale: 'ca-ES',
      categories: [],
      categoryTranslations: {},
      incomeAggregates: { aggregated: [], complete: [], total: 0 },
      expenseAggregates: {
        aggregated: [
          { id: 'project-1', name: '12345678901234567890', amount: 640, percentage: 100, count: 2 },
        ],
        complete: [
          { id: 'project-1', name: '12345678901234567890', amount: 640, percentage: 100, count: 2 },
        ],
        total: 640,
      },
      transferAggregates: { aggregated: [], complete: [], total: 0 },
      netBalance: -640,
      texts: baseTexts,
    });

    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(
      workbook.Sheets[baseTexts.detailSheets.expensesTop],
      { header: 1, raw: false },
    );

    assert.equal(rows[1]?.[0], 'Activitat general');
    assert.equal(rows[1]?.[1], '640,00 €');
  });
});
