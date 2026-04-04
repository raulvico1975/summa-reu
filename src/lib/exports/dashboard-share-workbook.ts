import * as XLSX from 'xlsx';

import type { Category } from '@/lib/data';
import type { AggregateResult, AggregateRow } from '@/lib/exports/economic-report';
import { formatCurrencyEU } from '@/lib/normalize';
import { getCategoryDisplayLabel } from '@/lib/ui/display-labels';

export interface DashboardShareWorkbookTexts {
  summarySheetName: string;
  summaryColumns: {
    indicator: string;
    value: string;
  };
  summaryMeta: {
    organization: string;
    period: string;
    generatedAt: string;
  };
  summaryMetrics: {
    income: string;
    expenses: string;
    transfers: string;
    balance: string;
  };
  detailSheets: {
    incomeTop: string;
    expensesTop: string;
    transfersTop: string;
    incomeComplete: string;
    expensesComplete: string;
    transfersComplete: string;
  };
  detailColumns: {
    incomeLabel: string;
    expenseLabel: string;
    transferLabel: string;
    amount: string;
    percentage: string;
    operations: string;
  };
  fallbacks: {
    uncategorized: string;
    generalProject: string;
    noCounterpart: string;
  };
}

interface BuildDashboardShareWorkbookParams {
  organizationName: string;
  periodLabel: string;
  generatedAt: Date;
  locale: string;
  incomeAggregates: AggregateResult;
  expenseAggregates: AggregateResult;
  transferAggregates: AggregateResult;
  netBalance: number;
  categories?: Category[] | null;
  categoryTranslations?: Record<string, string>;
  texts: DashboardShareWorkbookTexts;
}

interface MaterializedRow {
  label: string;
  amount: number;
  percentage: number;
  count: number;
}

export function buildDashboardShareWorkbook({
  organizationName,
  periodLabel,
  generatedAt,
  locale,
  incomeAggregates,
  expenseAggregates,
  transferAggregates,
  netBalance,
  categories,
  categoryTranslations,
  texts,
}: BuildDashboardShareWorkbookParams): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  appendSheet(
    workbook,
    buildSummarySheet({
      organizationName,
      periodLabel,
      generatedAt,
      locale,
      incomeTotal: incomeAggregates.total,
      expenseTotal: expenseAggregates.total,
      transferTotal: transferAggregates.total,
      netBalance,
      texts,
    }),
    texts.summarySheetName,
  );

  appendSheet(
    workbook,
    buildDetailSheet({
      labelColumnTitle: texts.detailColumns.incomeLabel,
      rows: materializeIncomeRows({
        rows: incomeAggregates.aggregated,
        total: incomeAggregates.total,
        categories,
        categoryTranslations,
        fallbackLabel: texts.fallbacks.uncategorized,
      }),
      texts,
    }),
    texts.detailSheets.incomeTop,
  );

  appendSheet(
    workbook,
    buildDetailSheet({
      labelColumnTitle: texts.detailColumns.expenseLabel,
      rows: materializeGenericRows({
        rows: expenseAggregates.aggregated,
        total: expenseAggregates.total,
        fallbackLabel: texts.fallbacks.generalProject,
      }),
      texts,
    }),
    texts.detailSheets.expensesTop,
  );

  appendSheet(
    workbook,
    buildDetailSheet({
      labelColumnTitle: texts.detailColumns.transferLabel,
      rows: materializeGenericRows({
        rows: transferAggregates.aggregated,
        total: transferAggregates.total,
        fallbackLabel: texts.fallbacks.noCounterpart,
      }),
      texts,
    }),
    texts.detailSheets.transfersTop,
  );

  appendSheet(
    workbook,
    buildDetailSheet({
      labelColumnTitle: texts.detailColumns.incomeLabel,
      rows: materializeIncomeRows({
        rows: incomeAggregates.complete,
        total: incomeAggregates.total,
        categories,
        categoryTranslations,
        fallbackLabel: texts.fallbacks.uncategorized,
      }),
      texts,
    }),
    texts.detailSheets.incomeComplete,
  );

  appendSheet(
    workbook,
    buildDetailSheet({
      labelColumnTitle: texts.detailColumns.expenseLabel,
      rows: materializeGenericRows({
        rows: expenseAggregates.complete,
        total: expenseAggregates.total,
        fallbackLabel: texts.fallbacks.generalProject,
      }),
      texts,
    }),
    texts.detailSheets.expensesComplete,
  );

  appendSheet(
    workbook,
    buildDetailSheet({
      labelColumnTitle: texts.detailColumns.transferLabel,
      rows: materializeGenericRows({
        rows: transferAggregates.complete,
        total: transferAggregates.total,
        fallbackLabel: texts.fallbacks.noCounterpart,
      }),
      texts,
    }),
    texts.detailSheets.transfersComplete,
  );

  return workbook;
}

function buildSummarySheet({
  organizationName,
  periodLabel,
  generatedAt,
  locale,
  incomeTotal,
  expenseTotal,
  transferTotal,
  netBalance,
  texts,
}: {
  organizationName: string;
  periodLabel: string;
  generatedAt: Date;
  locale: string;
  incomeTotal: number;
  expenseTotal: number;
  transferTotal: number;
  netBalance: number;
  texts: DashboardShareWorkbookTexts;
}): XLSX.WorkSheet {
  const rows = [
    [texts.summaryMeta.organization, organizationName],
    [texts.summaryMeta.period, periodLabel],
    [texts.summaryMeta.generatedAt, formatExportDateTime(generatedAt, locale)],
    [],
    [texts.summaryColumns.indicator, texts.summaryColumns.value],
    [texts.summaryMetrics.income, formatCurrencyEU(incomeTotal)],
    [texts.summaryMetrics.expenses, formatCurrencyEU(expenseTotal)],
    [texts.summaryMetrics.transfers, formatCurrencyEU(transferTotal)],
    [texts.summaryMetrics.balance, formatCurrencyEU(netBalance)],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 28 }, { wch: 24 }];

  return sheet;
}

function appendSheet(workbook: XLSX.WorkBook, sheet: XLSX.WorkSheet, requestedName: string) {
  XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName(requestedName));
}

function buildDetailSheet({
  labelColumnTitle,
  rows,
  texts,
}: {
  labelColumnTitle: string;
  rows: MaterializedRow[];
  texts: DashboardShareWorkbookTexts;
}): XLSX.WorkSheet {
  const data = [
    [
      labelColumnTitle,
      texts.detailColumns.amount,
      texts.detailColumns.percentage,
      texts.detailColumns.operations,
    ],
    ...rows.map((row) => [
      row.label,
      formatCurrencyEU(row.amount),
      formatPercentage(row.percentage),
      row.count,
    ]),
  ];

  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet['!cols'] = [
    { wch: 34 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
  ];
  sheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(data.length - 1, 0), c: data[0].length - 1 },
    }),
  };

  return sheet;
}

function materializeIncomeRows({
  rows,
  total,
  categories,
  categoryTranslations,
  fallbackLabel,
}: {
  rows: AggregateRow[];
  total: number;
  categories?: Category[] | null;
  categoryTranslations?: Record<string, string>;
  fallbackLabel: string;
}): MaterializedRow[] {
  const byLabel = new Map<string, { amount: number; count: number }>();

  rows.forEach((row) => {
    const label = getCategoryDisplayLabel(row.id, {
      categoryName: row.name,
      categories: categories ?? undefined,
      categoryTranslations: categoryTranslations ?? {},
      unknownCategoryLabel: fallbackLabel,
    });
    const entry = byLabel.get(label);
    if (entry) {
      entry.amount += row.amount;
      entry.count += row.count;
      return;
    }
    byLabel.set(label, { amount: row.amount, count: row.count });
  });

  return Array.from(byLabel.entries())
    .map(([label, values]) => ({
      label,
      amount: values.amount,
      count: values.count,
      percentage: total > 0 ? (values.amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function materializeGenericRows({
  rows,
  total,
  fallbackLabel,
}: {
  rows: AggregateRow[];
  total: number;
  fallbackLabel: string;
}): MaterializedRow[] {
  return rows.map((row) => ({
    label: toReadableLabel(row.name, fallbackLabel),
    amount: row.amount,
    percentage: total > 0 ? (row.amount / total) * 100 : 0,
    count: row.count,
  }));
}

function toReadableLabel(value: string | null | undefined, fallbackLabel: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallbackLabel;
  if (looksLikeTechnicalId(trimmed)) return fallbackLabel;
  return trimmed;
}

function looksLikeTechnicalId(value: string): boolean {
  if (/^[a-zA-Z0-9]{20}$/.test(value)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return true;
  if (/^[a-zA-Z0-9]{24,}$/.test(value)) return true;
  return false;
}

function formatExportDateTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function safeSheetName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 31) return trimmed;
  return trimmed.slice(0, 31);
}
