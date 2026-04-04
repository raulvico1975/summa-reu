import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildDashboardSharePdf, type DashboardSharePdfTexts } from '../exports/dashboard-share-pdf';
import type { Category } from '../data';

const baseTexts: DashboardSharePdfTexts = {
  title: 'Resum executiu',
  subtitle: 'Informe compartible',
  executiveTakeawayTitle: 'Idea clau del periode',
  footer: 'Generat amb Summa Social',
  detailSectionKicker: 'Annex analitic',
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
  summaryBoxTitle: 'Resum preparat per compartir',
  narrativesPageTitle: 'Lectura del periode',
  narrativeSectionTitles: {
    summary: 'Missatge clau',
    income: 'Ingressos',
    expenses: 'Despeses',
    transfers: 'Projectes i imputacions',
  },
  detailPages: {
    income: 'Ingressos',
    expenses: 'Despeses',
    expensesByAxis: "Despeses per Eix d'actuació",
    projects: 'Projectes',
  },
  detailColumns: {
    incomeLabel: 'Categoria d ingres',
    expenseCategoryLabel: 'Categoria de despesa',
    axisLabel: "Eix d'actuacio",
    amount: 'Import',
    percentage: '% sobre el total',
    operations: 'Moviments',
    projectName: 'Nom del projecte',
    budget: 'Pressupost',
    imputedExpenses: 'Despeses imputades',
  },
  executiveTakeaway: {
    noActivity: 'No hi ha activitat economica.',
    balanced: 'El periode es tanca en equilibri operatiu.',
    surplus: ({ balance }) => `El periode es tanca amb superavit operatiu de ${balance}.`,
    deficit: ({ balance }) => `El periode es tanca amb deficit operatiu de ${balance}.`,
  },
  emptyStates: {
    income: 'No hi ha ingressos registrats en aquest periode.',
    expenses: 'No hi ha despeses registrades en aquest periode.',
  },
  fallbacks: {
    uncategorized: 'Sense categoria',
    emptyText: 'Sense text disponible',
  },
};

describe('buildDashboardSharePdf', () => {
  it('genera un PDF amb diverses pagines i contingut clau', () => {
    const categories: Category[] = [
      { id: 'income-1', name: 'subsidies', type: 'income' },
      { id: 'expense-1', name: 'officeSupplies', type: 'expense' },
    ];

    const pdf = buildDashboardSharePdf({
      organizationName: 'Fundacio Exemple',
      organizationTaxId: 'G12345678',
      periodLabel: 'Q1 2026',
      generatedAt: new Date('2026-04-04T10:00:00.000Z'),
      locale: 'ca-ES',
      summaryText: 'Aquest trimestre consolida l activitat ordinaria i deixa un marge positiu.',
      narratives: {
        summary: 'Resum de context.',
        income: 'Els ingressos venen principalment de subvencions.',
        expenses: 'La despesa se centra en activitat i estructura.',
        transfers: 'Els projectes mantenen una execucio controlada.',
      },
      categories,
      categoryTranslations: {
        subsidies: 'Subvencions',
        officeSupplies: 'Material d oficina',
      },
      incomeAggregates: {
        aggregated: [],
        complete: [{ id: 'income-1', name: 'subsidies', amount: 1200, percentage: 100, count: 3 }],
        total: 1200,
      },
      expenseCategoryAggregates: {
        aggregated: [],
        complete: [{ id: 'expense-1', name: 'officeSupplies', amount: 640, percentage: 100, count: 2 }],
        total: 640,
      },
      transferAggregates: { aggregated: [], complete: [], total: 0 },
      expenseAxisAggregates: {
        aggregated: [],
        complete: [{ id: 'axis-1', name: 'Infancia', amount: 320, percentage: 100, count: 1 }],
        total: 320,
      },
      projectRows: [
        { name: 'Projecte Sahel', budget: 25000, imputedExpenses: 4300 },
      ],
      netBalance: 560,
      texts: baseTexts,
    });

    assert.equal(pdf.getNumberOfPages(), 6);

    const raw = pdf.output();
    assert.match(raw, /Fundacio Exemple/);
    assert.match(raw, /Projecte Sahel/);
    assert.match(raw, /Resum executiu/);
  });

  it('omet les seccions opcionals buides i manté el resum analitic essencial', () => {
    const pdf = buildDashboardSharePdf({
      organizationName: 'Associacio Exemple',
      periodLabel: '2026',
      generatedAt: new Date('2026-04-04T10:00:00.000Z'),
      locale: 'ca-ES',
      summaryText: '',
      narratives: null,
      incomeAggregates: {
        aggregated: [],
        complete: [{ id: 'income-1', name: 'Subvencions', amount: 800, percentage: 100, count: 1 }],
        total: 800,
      },
      expenseCategoryAggregates: {
        aggregated: [],
        complete: [{ id: 'expense-1', name: 'Activitat', amount: 500, percentage: 100, count: 1 }],
        total: 500,
      },
      transferAggregates: { aggregated: [], complete: [], total: 0 },
      expenseAxisAggregates: { aggregated: [], complete: [], total: 0 },
      projectRows: [],
      netBalance: 300,
      texts: baseTexts,
    });

    assert.equal(pdf.getNumberOfPages(), 4);

    const raw = pdf.output();
    assert.match(raw, /Annex analitic · Associacio Exemple · 2026/);
    assert.match(raw, /superavit operatiu/);
  });
});
