import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import type { Category } from '@/lib/data';
import type { AggregateResult, AggregateRow, NarrativeDraft } from '@/lib/exports/economic-report';
import type { DashboardProjectWorkbookRow } from '@/lib/exports/dashboard-share-workbook';
import { formatCurrencyEU } from '@/lib/normalize';
import { getCategoryDisplayLabel } from '@/lib/ui/display-labels';

const PAGE_MARGIN = 16;
const PAGE_WIDTH = 297;
const PAGE_HEIGHT = 210;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const BRAND = {
  ink: [31, 41, 55] as const,
  muted: [107, 114, 128] as const,
  accent: [14, 116, 144] as const,
  accentSoft: [236, 254, 255] as const,
  line: [226, 232, 240] as const,
  panel: [248, 250, 252] as const,
};

export interface DashboardSharePdfTexts {
  title: string;
  subtitle: string;
  executiveTakeawayTitle: string;
  footer: string;
  detailSectionKicker: string;
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
  summaryBoxTitle: string;
  narrativesPageTitle: string;
  narrativeSectionTitles: Record<keyof NarrativeDraft, string>;
  detailPages: {
    income: string;
    expenses: string;
    expensesByAxis: string;
    projects: string;
  };
  detailColumns: {
    incomeLabel: string;
    expenseCategoryLabel: string;
    axisLabel: string;
    amount: string;
    percentage: string;
    operations: string;
    projectName: string;
    budget: string;
    imputedExpenses: string;
  };
  executiveTakeaway: {
    noActivity: string;
    balanced: string;
    surplus: (params: { balance: string }) => string;
    deficit: (params: { balance: string }) => string;
  };
  emptyStates: {
    income: string;
    expenses: string;
  };
  fallbacks: {
    uncategorized: string;
    emptyText: string;
  };
}

interface BuildDashboardSharePdfParams {
  organizationName: string;
  organizationTaxId?: string | null;
  organizationLogoDataUrl?: string | null;
  periodLabel: string;
  generatedAt: Date;
  locale: string;
  summaryText: string;
  narratives?: NarrativeDraft | null;
  incomeAggregates: AggregateResult;
  expenseCategoryAggregates: AggregateResult;
  transferAggregates: AggregateResult;
  expenseAxisAggregates: AggregateResult;
  projectRows: DashboardProjectWorkbookRow[];
  netBalance: number;
  categories?: Category[] | null;
  categoryTranslations?: Record<string, string>;
  texts: DashboardSharePdfTexts;
}

interface MaterializedRow {
  label: string;
  amount: number;
  percentage: number;
  count: number;
}

export function buildDashboardSharePdf({
  organizationName,
  organizationTaxId,
  organizationLogoDataUrl,
  periodLabel,
  generatedAt,
  locale,
  summaryText,
  narratives,
  incomeAggregates,
  expenseCategoryAggregates,
  transferAggregates,
  expenseAxisAggregates,
  projectRows,
  netBalance,
  categories,
  categoryTranslations,
  texts,
}: BuildDashboardSharePdfParams): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const incomeRows = materializeCategoryRows({
    rows: incomeAggregates.complete,
    total: incomeAggregates.total,
    categories,
    categoryTranslations,
    fallbackLabel: texts.fallbacks.uncategorized,
  });
  const expenseRows = materializeCategoryRows({
    rows: expenseCategoryAggregates.complete,
    total: expenseCategoryAggregates.total,
    categories,
    categoryTranslations,
    fallbackLabel: texts.fallbacks.uncategorized,
  });
  const axisRows = materializeGenericRows({
    rows: expenseAxisAggregates.complete,
    total: expenseAxisAggregates.total,
  });
  const executiveTakeaway = resolveExecutiveTakeaway({
    narratives,
    incomeTotal: incomeAggregates.total,
    expenseTotal: expenseCategoryAggregates.total,
    netBalance,
    texts,
  });

  addCoverPage(doc, {
    organizationName,
    organizationTaxId,
    organizationLogoDataUrl,
    periodLabel,
    generatedAt,
    locale,
    summaryText,
    executiveTakeaway,
    texts,
    metrics: [
      { label: texts.summaryMetrics.income, value: formatCurrencyEU(incomeAggregates.total) },
      { label: texts.summaryMetrics.expenses, value: formatCurrencyEU(expenseCategoryAggregates.total) },
      { label: texts.summaryMetrics.transfers, value: formatCurrencyEU(transferAggregates.total) },
      { label: texts.summaryMetrics.balance, value: formatCurrencyEU(netBalance) },
    ],
  });

  addNarrativesPage(doc, {
    periodLabel,
    texts,
    narratives,
  });

  addAggregateTablePage(doc, {
    title: texts.detailPages.income,
    organizationName,
    periodLabel,
    labelColumnTitle: texts.detailColumns.incomeLabel,
    rows: incomeRows,
    emptyMessage: texts.emptyStates.income,
    texts,
  });

  addAggregateTablePage(doc, {
    title: texts.detailPages.expenses,
    organizationName,
    periodLabel,
    labelColumnTitle: texts.detailColumns.expenseCategoryLabel,
    rows: expenseRows,
    emptyMessage: texts.emptyStates.expenses,
    texts,
  });

  if (axisRows.length > 0) {
    addAggregateTablePage(doc, {
      title: texts.detailPages.expensesByAxis,
      organizationName,
      periodLabel,
      labelColumnTitle: texts.detailColumns.axisLabel,
      rows: axisRows,
      texts,
    });
  }

  if (projectRows.length > 0) {
    addProjectsTablePage(doc, {
      title: texts.detailPages.projects,
      organizationName,
      periodLabel,
      rows: projectRows,
      texts,
    });
  }

  addPageFooters(doc, texts.footer);

  return doc;
}

function addCoverPage(
  doc: jsPDF,
  params: {
    organizationName: string;
    organizationTaxId?: string | null;
    organizationLogoDataUrl?: string | null;
    periodLabel: string;
    generatedAt: Date;
    locale: string;
    summaryText: string;
    executiveTakeaway: string;
    texts: DashboardSharePdfTexts;
    metrics: Array<{ label: string; value: string }>;
  },
) {
  const {
    organizationName,
    organizationTaxId,
    organizationLogoDataUrl,
    periodLabel,
    generatedAt,
    locale,
    summaryText,
    executiveTakeaway,
    texts,
    metrics,
  } = params;

  doc.setFillColor(...BRAND.accentSoft);
  doc.rect(0, 0, PAGE_WIDTH, 48, 'F');

  if (organizationLogoDataUrl) {
    try {
      doc.addImage(organizationLogoDataUrl, 'PNG', PAGE_MARGIN, 16, 20, 20);
    } catch (error) {
      console.error('Error adding dashboard logo to PDF:', error);
    }
  }

  doc.setTextColor(...BRAND.accent);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(texts.title, PAGE_MARGIN + (organizationLogoDataUrl ? 26 : 0), 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...BRAND.muted);
  doc.text(texts.subtitle, PAGE_MARGIN + (organizationLogoDataUrl ? 26 : 0), 29.5);

  doc.setTextColor(...BRAND.ink);
  doc.setFontSize(16);
  doc.text(organizationName, PAGE_MARGIN + (organizationLogoDataUrl ? 26 : 0), 37);

  if (organizationTaxId) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.muted);
    doc.text(`CIF: ${organizationTaxId}`, PAGE_MARGIN + (organizationLogoDataUrl ? 26 : 0), 43);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.muted);
  doc.text(`${texts.summaryMeta.period}: ${periodLabel}`, PAGE_WIDTH - PAGE_MARGIN, 22, { align: 'right' });
  doc.text(
    `${texts.summaryMeta.generatedAt}: ${formatExportDateTime(generatedAt, locale)}`,
    PAGE_WIDTH - PAGE_MARGIN,
    28,
    { align: 'right' },
  );
  doc.text(`${texts.summaryMeta.organization}: ${organizationName}`, PAGE_WIDTH - PAGE_MARGIN, 34, { align: 'right' });

  const takeawayY = 54;
  drawAccentPanel(doc, PAGE_MARGIN, takeawayY, CONTENT_WIDTH, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...BRAND.accent);
  doc.text(texts.executiveTakeawayTitle, PAGE_MARGIN + 5, takeawayY + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...BRAND.ink);
  const takeawayLines = clampLines(doc.splitTextToSize(executiveTakeaway, CONTENT_WIDTH - 10), 2);
  doc.text(takeawayLines, PAGE_MARGIN + 5, takeawayY + 12.5, {
    maxWidth: CONTENT_WIDTH - 10,
    lineHeightFactor: 1.25,
  });

  const gap = 5;
  const cardWidth = (CONTENT_WIDTH - gap * 3) / 4;
  const cardY = 79;
  metrics.forEach((metric, index) => {
    const x = PAGE_MARGIN + index * (cardWidth + gap);
    drawMetricCard(doc, x, cardY, cardWidth, 30, metric.label, metric.value);
  });

  const summaryBoxY = 116;
  const summaryBoxHeight = 67;
  drawPanel(doc, PAGE_MARGIN, summaryBoxY, CONTENT_WIDTH, summaryBoxHeight);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BRAND.ink);
  doc.text(texts.summaryBoxTitle, PAGE_MARGIN + 6, summaryBoxY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...BRAND.ink);
  const summaryLines = clampLines(
    doc.splitTextToSize(summaryText.trim() || texts.fallbacks.emptyText, CONTENT_WIDTH - 12),
    11,
  );
  doc.text(summaryLines, PAGE_MARGIN + 6, summaryBoxY + 18, {
    maxWidth: CONTENT_WIDTH - 12,
    lineHeightFactor: 1.45,
  });
}

function addNarrativesPage(
  doc: jsPDF,
  params: {
    periodLabel: string;
    texts: DashboardSharePdfTexts;
    narratives?: NarrativeDraft | null;
  },
) {
  doc.addPage('a4', 'landscape');
  const { periodLabel, texts, narratives } = params;
  addSectionPageHeader(doc, texts.narrativesPageTitle, periodLabel);

  const boxGap = 6;
  const boxWidth = (CONTENT_WIDTH - boxGap) / 2;
  const boxHeight = 68;
  const startY = 38;
  const narrativeEntries: Array<{ key: keyof NarrativeDraft; text: string }> = [
    { key: 'summary', text: narratives?.summary ?? texts.fallbacks.emptyText },
    { key: 'income', text: narratives?.income ?? texts.fallbacks.emptyText },
    { key: 'expenses', text: narratives?.expenses ?? texts.fallbacks.emptyText },
    { key: 'transfers', text: narratives?.transfers ?? texts.fallbacks.emptyText },
  ];

  narrativeEntries.forEach((entry, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const x = PAGE_MARGIN + col * (boxWidth + boxGap);
    const y = startY + row * (boxHeight + boxGap);
    drawNarrativeBox(doc, {
      x,
      y,
      width: boxWidth,
      height: boxHeight,
      title: texts.narrativeSectionTitles[entry.key],
      text: entry.text,
    });
  });
}

function addAggregateTablePage(
  doc: jsPDF,
  params: {
    title: string;
    organizationName: string;
    periodLabel: string;
    labelColumnTitle: string;
    rows: MaterializedRow[];
    emptyMessage?: string;
    texts: DashboardSharePdfTexts;
  },
) {
  doc.addPage('a4', 'landscape');
  addSectionPageHeader(
    doc,
    params.title,
    `${params.texts.detailSectionKicker} · ${params.organizationName} · ${params.periodLabel}`,
  );

  if (params.rows.length === 0) {
    drawEmptyState(doc, params.emptyMessage ?? params.texts.fallbacks.emptyText);
    return;
  }

  autoTable(doc, {
    startY: 38,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 18 },
    tableWidth: CONTENT_WIDTH,
    head: [[
      params.labelColumnTitle,
      params.texts.detailColumns.amount,
      params.texts.detailColumns.percentage,
      params.texts.detailColumns.operations,
    ]],
    body: params.rows.map((row) => [
      row.label,
      formatCurrencyEU(row.amount),
      formatPercentage(row.percentage),
      String(row.count),
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 2.5,
      overflow: 'linebreak',
      textColor: BRAND.ink[0],
      lineColor: BRAND.line[0],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [...BRAND.accent],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [...BRAND.panel],
    },
    columnStyles: {
      0: { cellWidth: 138 },
      1: { cellWidth: 40, halign: 'right' },
      2: { cellWidth: 34, halign: 'right' },
      3: { cellWidth: 26, halign: 'right' },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index > 0) {
        hookData.cell.styles.halign = 'right';
      }
    },
  });
}

function addProjectsTablePage(
  doc: jsPDF,
  params: {
    title: string;
    organizationName: string;
    periodLabel: string;
    rows: DashboardProjectWorkbookRow[];
    texts: DashboardSharePdfTexts;
  },
) {
  doc.addPage('a4', 'landscape');
  addSectionPageHeader(
    doc,
    params.title,
    `${params.texts.detailSectionKicker} · ${params.organizationName} · ${params.periodLabel}`,
  );

  autoTable(doc, {
    startY: 38,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 18 },
    tableWidth: CONTENT_WIDTH,
    head: [[
      params.texts.detailColumns.projectName,
      params.texts.detailColumns.budget,
      params.texts.detailColumns.imputedExpenses,
    ]],
    body: params.rows.map((row) => [
      row.name,
      formatCurrencyEU(row.budget),
      formatCurrencyEU(row.imputedExpenses),
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 2.5,
      overflow: 'linebreak',
      textColor: BRAND.ink[0],
      lineColor: BRAND.line[0],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [...BRAND.accent],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [...BRAND.panel],
    },
    columnStyles: {
      0: { cellWidth: 150 },
      1: { cellWidth: 40, halign: 'right' },
      2: { cellWidth: 40, halign: 'right' },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index > 0) {
        hookData.cell.styles.halign = 'right';
      }
    },
  });
}

function drawMetricCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
) {
  drawPanel(doc, x, y, width, height);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND.muted);
  doc.text(label, x + 4, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(...BRAND.ink);
  doc.text(value, x + 4, y + 18);
}

function drawNarrativeBox(
  doc: jsPDF,
  params: {
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
    text: string;
  },
) {
  drawPanel(doc, params.x, params.y, params.width, params.height);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.ink);
  doc.text(params.title, params.x + 5, params.y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const lines = clampLines(doc.splitTextToSize(params.text.trim() || '-', params.width - 10), 11);
  doc.text(lines, params.x + 5, params.y + 17, {
    maxWidth: params.width - 10,
    lineHeightFactor: 1.35,
  });
}

function drawAccentPanel(doc: jsPDF, x: number, y: number, width: number, height: number) {
  doc.setDrawColor(...BRAND.accent);
  doc.setFillColor(...BRAND.accentSoft);
  doc.roundedRect(x, y, width, height, 4, 4, 'FD');
}

function drawPanel(doc: jsPDF, x: number, y: number, width: number, height: number) {
  doc.setDrawColor(...BRAND.line);
  doc.setFillColor(...BRAND.panel);
  doc.roundedRect(x, y, width, height, 4, 4, 'FD');
}

function drawEmptyState(doc: jsPDF, message: string) {
  const boxWidth = Math.min(150, CONTENT_WIDTH);
  const boxHeight = 36;
  const x = PAGE_MARGIN + (CONTENT_WIDTH - boxWidth) / 2;
  const y = 82;
  drawPanel(doc, x, y, boxWidth, boxHeight);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...BRAND.muted);
  const lines = clampLines(doc.splitTextToSize(message, boxWidth - 16), 3);
  doc.text(lines, x + boxWidth / 2, y + 16, {
    align: 'center',
    maxWidth: boxWidth - 16,
    lineHeightFactor: 1.35,
  });
}

function addSectionPageHeader(doc: jsPDF, title: string, subtitle: string) {
  doc.setTextColor(...BRAND.accent);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, PAGE_MARGIN, 20);

  doc.setTextColor(...BRAND.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(subtitle, PAGE_MARGIN, 27);

  doc.setDrawColor(...BRAND.line);
  doc.line(PAGE_MARGIN, 31, PAGE_WIDTH - PAGE_MARGIN, 31);
}

function addPageFooters(doc: jsPDF, footerText: string) {
  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...BRAND.line);
    doc.line(PAGE_MARGIN, PAGE_HEIGHT - 11, PAGE_WIDTH - PAGE_MARGIN, PAGE_HEIGHT - 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted);
    doc.text(footerText, PAGE_MARGIN, PAGE_HEIGHT - 6.5);
    doc.text(`${page}/${pageCount}`, PAGE_WIDTH - PAGE_MARGIN, PAGE_HEIGHT - 6.5, { align: 'right' });
  }
}

function materializeCategoryRows({
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

    const current = byLabel.get(label);
    if (current) {
      current.amount += row.amount;
      current.count += row.count;
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
}: {
  rows: AggregateRow[];
  total: number;
}): MaterializedRow[] {
  return rows.map((row) => ({
    label: row.name,
    amount: row.amount,
    count: row.count,
    percentage: total > 0 ? (row.amount / total) * 100 : 0,
  }))
    .filter((row) => row.amount > 0 || row.count > 0)
    .sort((a, b) => b.amount - a.amount);
}

function clampLines(lines: string[], maxLines: number): string[] {
  if (lines.length <= maxLines) return lines;
  const visible = lines.slice(0, maxLines);
  const last = visible[maxLines - 1] ?? '';
  visible[maxLines - 1] = `${last.replace(/[. ]+$/, '')}...`;
  return visible;
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

function resolveExecutiveTakeaway({
  narratives,
  incomeTotal,
  expenseTotal,
  netBalance,
  texts,
}: {
  narratives?: NarrativeDraft | null;
  incomeTotal: number;
  expenseTotal: number;
  netBalance: number;
  texts: DashboardSharePdfTexts;
}): string {
  const narrativeSummary = narratives?.summary?.trim();
  if (narrativeSummary) return narrativeSummary;
  if (incomeTotal === 0 && expenseTotal === 0) return texts.executiveTakeaway.noActivity;
  if (Math.abs(netBalance) < 0.005) return texts.executiveTakeaway.balanced;
  if (netBalance > 0) {
    return texts.executiveTakeaway.surplus({ balance: formatCurrencyEU(netBalance) });
  }
  return texts.executiveTakeaway.deficit({ balance: formatCurrencyEU(Math.abs(netBalance)) });
}
