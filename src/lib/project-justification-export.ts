// src/lib/project-justification-export.ts
// Exportació Excel de justificació de projecte (ACCD / Fons Català)

import * as XLSX from 'xlsx';
import type { BudgetLine, ExpenseLink, Project, ProjectExpenseExport, OffBankExpense, UnifiedExpense } from '@/lib/project-module-types';
import type { Firestore } from 'firebase/firestore';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { buildJustificationRows, type JustificationRow } from '@/lib/project-justification-rows';

// Tipus unificat per despeses (bank o off-bank)
interface UnifiedExpenseData {
  id: string;
  source: 'bank' | 'offBank';
  date: string;
  description: string | null;
  counterpartyName: string | null;
  categoryName: string | null;
  amountEUR: number;
  documentName: string | null;
  // FX
  currency?: string | null;
  amountOriginal?: number | null;
  fxRateUsed?: number | null;
  // Justificació (per offBank)
  invoiceNumber?: string | null;
  issuerTaxId?: string | null;
  invoiceDate?: string | null;
  paymentDate?: string | null;
  supportDocNumber?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// TIPUS
// ═══════════════════════════════════════════════════════════════════════════

interface OrganizationData {
  name: string;
  fiscalId: string | null;
}

interface JustificationData {
  project: Project;
  organization: OrganizationData;
  budgetLines: BudgetLine[];
  expenseLinks: ExpenseLink[];
  expenses: Map<string, UnifiedExpenseData>;
}

interface BudgetLineSummary {
  code: string;
  name: string;
  budgeted: number;
  executed: number;
  difference: number;
  deviationPct: number;
  status: 'OK' | 'ALERT';
}

interface ExpenseRow {
  date: string;
  counterpartyName: string;
  concept: string;
  categoryName: string;
  projectName: string;
  budgetLineCode: string;
  budgetLineName: string;
  amountAssigned: number;
  documentRef: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function formatDateDMY(dateStr: string | null): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('ca-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('ca-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value) + '%';
}

// ═══════════════════════════════════════════════════════════════════════════
// FETCH DATA
// ═══════════════════════════════════════════════════════════════════════════

async function fetchJustificationData(
  firestore: Firestore,
  organizationId: string,
  projectId: string
): Promise<JustificationData> {
  // 1. Projecte
  const projectRef = doc(
    firestore,
    'organizations',
    organizationId,
    'projectModule',
    '_',
    'projects',
    projectId
  );
  const projectSnap = await getDoc(projectRef);
  if (!projectSnap.exists()) {
    throw new Error('Projecte no trobat');
  }
  const project = { id: projectSnap.id, ...projectSnap.data() } as Project;

  // 2. Organització
  const orgRef = doc(firestore, 'organizations', organizationId);
  const orgSnap = await getDoc(orgRef);
  const orgData = orgSnap.data();
  const organization: OrganizationData = {
    name: orgData?.name ?? 'Organització',
    fiscalId: orgData?.fiscalId ?? orgData?.nif ?? null,
  };

  // 3. Partides de pressupost
  const linesRef = collection(
    firestore,
    'organizations',
    organizationId,
    'projectModule',
    '_',
    'projects',
    projectId,
    'budgetLines'
  );
  const linesSnap = await getDocs(linesRef);
  const budgetLines: BudgetLine[] = linesSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  } as BudgetLine));

  // Ordenar partides
  budgetLines.sort((a, b) => {
    if (a.order !== null && b.order !== null) return a.order - b.order;
    if (a.order !== null) return -1;
    if (b.order !== null) return 1;
    return a.name.localeCompare(b.name);
  });

  // 4. ExpenseLinks d'aquest projecte
  const linksRef = collection(
    firestore,
    'organizations',
    organizationId,
    'projectModule',
    '_',
    'expenseLinks'
  );
  const linksQuery = query(linksRef, where('projectIds', 'array-contains', projectId));
  const linksSnap = await getDocs(linksQuery);
  const expenseLinks: ExpenseLink[] = linksSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  } as ExpenseLink));

  // 5. Carregar despeses relacionades (bank i off-bank)
  const txIds = expenseLinks.map((l) => l.id);
  const expenses = new Map<string, UnifiedExpenseData>();

  const feedRef = collection(
    firestore,
    'organizations',
    organizationId,
    'exports',
    'projectExpenses',
    'items'
  );

  const offBankRef = collection(
    firestore,
    'organizations',
    organizationId,
    'projectModule',
    '_',
    'offBankExpenses'
  );

  for (const txId of txIds) {
    if (txId.startsWith('off_')) {
      // Despesa off-bank
      const offBankId = txId.replace('off_', '');
      const offBankDoc = await getDoc(doc(offBankRef, offBankId));
      if (offBankDoc.exists()) {
        const data = offBankDoc.data() as OffBankExpense;
        expenses.set(txId, {
          id: txId,
          source: 'offBank',
          date: data.date,
          description: data.concept,
          counterpartyName: data.counterpartyName,
          categoryName: data.categoryName,
          amountEUR: typeof data.amountEUR === 'number' ? -Math.abs(data.amountEUR) : 0,
          documentName: null,
          // FX (nou model amb fallback a camps antics)
          currency: data.originalCurrency ?? data.currency ?? null,
          amountOriginal: data.originalAmount ?? data.amountOriginal ?? null,
          fxRateUsed: data.fxRate ?? data.fxRateUsed ?? null,
          // Justificació directa de offBank
          invoiceNumber: data.invoiceNumber ?? null,
          issuerTaxId: data.issuerTaxId ?? null,
          invoiceDate: data.invoiceDate ?? null,
          paymentDate: data.paymentDate ?? null,
          supportDocNumber: data.supportDocNumber ?? null,
        });
      }
    } else {
      // Despesa bank
      const expenseDoc = await getDoc(doc(feedRef, txId));
      if (expenseDoc.exists()) {
        const data = expenseDoc.data() as ProjectExpenseExport;
        // Buscar justificació a l'expenseLink
        const link = expenseLinks.find((l) => l.id === txId);
        expenses.set(txId, {
          id: txId,
          source: 'bank',
          date: data.date,
          description: data.description,
          counterpartyName: data.counterpartyName,
          categoryName: data.categoryName,
          amountEUR: data.amountEUR,
          documentName: data.documents?.[0]?.name ?? null,
          // FX (bank sempre és EUR)
          currency: 'EUR',
          amountOriginal: null,
          fxRateUsed: null,
          // Justificació de l'expenseLink
          invoiceNumber: link?.justification?.invoiceNumber ?? null,
          issuerTaxId: link?.justification?.issuerTaxId ?? null,
          invoiceDate: link?.justification?.invoiceDate ?? null,
          paymentDate: link?.justification?.paymentDate ?? null,
          supportDocNumber: link?.justification?.supportDocNumber ?? null,
        });
      }
    }
  }

  return {
    project,
    organization,
    budgetLines,
    expenseLinks,
    expenses,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD SHEETS
// ═══════════════════════════════════════════════════════════════════════════

function buildResumSheet(data: JustificationData): XLSX.WorkSheet {
  const { project, budgetLines, expenseLinks } = data;
  const allowedDeviation = project.allowedDeviationPct ?? 10;

  // Calcular execució per partida
  const executionByLine = new Map<string, number>();
  for (const link of expenseLinks) {
    for (const assignment of link.assignments) {
      if (assignment.projectId === project.id && assignment.budgetLineId) {
        const current = executionByLine.get(assignment.budgetLineId) ?? 0;
        executionByLine.set(assignment.budgetLineId, current + (assignment.amountEUR != null ? Math.abs(assignment.amountEUR) : 0));
      }
    }
  }

  // Construir files
  const rows: (string | number)[][] = [];

  // Header
  rows.push([
    'Codi',
    'Partida',
    'Pressupostat',
    'Executat',
    'Diferència',
    'Desviació %',
    'Estat',
  ]);

  let totalBudgeted = 0;
  let totalExecuted = 0;

  for (const line of budgetLines) {
    const executed = executionByLine.get(line.id) ?? 0;
    const difference = executed - line.budgetedAmountEUR;
    const deviationPct = line.budgetedAmountEUR > 0
      ? (difference / line.budgetedAmountEUR) * 100
      : 0;
    const isWithin = Math.abs(deviationPct) <= allowedDeviation;

    totalBudgeted += line.budgetedAmountEUR;
    totalExecuted += executed;

    rows.push([
      line.code ?? '',
      line.name,
      line.budgetedAmountEUR,
      executed,
      difference,
      deviationPct,
      isWithin ? 'OK' : 'ALERTA',
    ]);
  }

  // Fila de totals
  const totalDiff = totalExecuted - totalBudgeted;
  const totalDevPct = totalBudgeted > 0 ? (totalDiff / totalBudgeted) * 100 : 0;
  rows.push([
    '',
    'TOTAL',
    totalBudgeted,
    totalExecuted,
    totalDiff,
    totalDevPct,
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Amplades de columna
  ws['!cols'] = [
    { wch: 10 }, // Codi
    { wch: 30 }, // Partida
    { wch: 15 }, // Pressupostat
    { wch: 15 }, // Executat
    { wch: 15 }, // Diferència
    { wch: 12 }, // Desviació %
    { wch: 10 }, // Estat
  ];

  return ws;
}

function buildDespesesSheet(data: JustificationData): XLSX.WorkSheet {
  const { project, budgetLines, expenseLinks, expenses } = data;

  // Mapa de budgetLineId -> budgetLine per lookup ràpid
  const lineMap = new Map(budgetLines.map((l) => [l.id, l]));

  const rows: (string | number)[][] = [];

  // Header amb noves columnes
  rows.push([
    'Font',
    'Data',
    'Proveïdor/Contrapart',
    'Concepte',
    'Categoria',
    'Projecte',
    'Codi partida',
    'Partida',
    'Moneda',
    'Import original',
    'FX',
    'Import EUR',
    'Núm. factura',
    'NIF emissor',
    'Data factura',
    'Data pagament',
    'Núm. justificant',
    'Document',
  ]);

  // Ordenar expenseLinks per data de despesa
  const sortedLinks = [...expenseLinks].sort((a, b) => {
    const expA = expenses.get(a.id);
    const expB = expenses.get(b.id);
    const dateA = expA?.date ?? '';
    const dateB = expB?.date ?? '';
    return dateA.localeCompare(dateB);
  });

  for (const link of sortedLinks) {
    const expense = expenses.get(link.id);
    if (!expense) continue;

    // Filtrar només assignacions d'aquest projecte
    const relevantAssignments = link.assignments.filter(
      (a) => a.projectId === project.id
    );

    for (const assignment of relevantAssignments) {
      const budgetLine = assignment.budgetLineId
        ? lineMap.get(assignment.budgetLineId)
        : null;

      rows.push([
        expense.source === 'bank' ? 'Bancària' : 'Terreny',
        formatDateDMY(expense.date),
        expense.counterpartyName ?? '',
        expense.description ?? '',
        expense.categoryName ?? '',
        assignment.projectName,
        budgetLine?.code ?? '',
        assignment.budgetLineName ?? '(sense partida)',
        expense.currency ?? 'EUR',
        expense.amountOriginal ?? '',
        expense.fxRateUsed ?? '',
        assignment.amountEUR != null ? Math.abs(assignment.amountEUR) : '',
        expense.invoiceNumber ?? '',
        expense.issuerTaxId ?? '',
        expense.invoiceDate ? formatDateDMY(expense.invoiceDate) : '',
        expense.paymentDate ? formatDateDMY(expense.paymentDate) : '',
        expense.supportDocNumber ?? '',
        expense.documentName ?? '',
      ]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Amplades de columna
  ws['!cols'] = [
    { wch: 10 }, // Font
    { wch: 12 }, // Data
    { wch: 25 }, // Proveïdor
    { wch: 40 }, // Concepte
    { wch: 20 }, // Categoria
    { wch: 20 }, // Projecte
    { wch: 10 }, // Codi partida
    { wch: 25 }, // Partida
    { wch: 8 },  // Moneda
    { wch: 15 }, // Import original
    { wch: 10 }, // FX
    { wch: 15 }, // Import EUR
    { wch: 15 }, // Núm. factura
    { wch: 12 }, // NIF emissor
    { wch: 12 }, // Data factura
    { wch: 12 }, // Data pagament
    { wch: 15 }, // Núm. justificant
    { wch: 30 }, // Document
  ];

  return ws;
}

function buildMetadadesSheet(data: JustificationData): XLSX.WorkSheet {
  const { project, organization } = data;
  const now = new Date();

  const rows: string[][] = [
    ['Metadades de l\'export'],
    [''],
    ['Camp', 'Valor'],
    ['Organització', organization.name],
    ['CIF/NIF', organization.fiscalId ?? ''],
    ['Projecte', project.name],
    ['Codi projecte', project.code ?? ''],
    ['Data inici', formatDateDMY(project.startDate)],
    ['Data fi', formatDateDMY(project.endDate)],
    ['Desviació permesa', `${project.allowedDeviationPct ?? 10}%`],
    [''],
    ['Data export', now.toLocaleDateString('ca-ES')],
    ['Hora export', now.toLocaleTimeString('ca-ES')],
    ['Generat per', 'Summa Social'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Amplades de columna
  ws['!cols'] = [
    { wch: 20 }, // Camp
    { wch: 40 }, // Valor
  ];

  return ws;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

export interface ExportResult {
  blob: Blob;
  filename: string;
}

export async function buildProjectJustificationXlsx(
  firestore: Firestore,
  organizationId: string,
  projectId: string
): Promise<ExportResult> {
  // 1. Obtenir dades
  const data = await fetchJustificationData(firestore, organizationId, projectId);

  // 2. Crear workbook
  const wb = XLSX.utils.book_new();

  // 3. Afegir fulls
  const wsResum = buildResumSheet(data);
  XLSX.utils.book_append_sheet(wb, wsResum, 'Resum');

  const wsDespeses = buildDespesesSheet(data);
  XLSX.utils.book_append_sheet(wb, wsDespeses, 'Despeses');

  const wsMetadades = buildMetadadesSheet(data);
  XLSX.utils.book_append_sheet(wb, wsMetadades, 'Metadades');

  // 4. Generar fitxer
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  // 5. Generar nom de fitxer
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const projectCode = data.project.code?.replace(/[^a-zA-Z0-9]/g, '') ?? data.project.id.slice(0, 8);
  const filename = `justificacio_${projectCode}_${dateStr}.xlsx`;

  return { blob, filename };
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNDING EXCEL EXPORT (NOVA FUNCIÓ - USA buildJustificationRows)
// ═══════════════════════════════════════════════════════════════════════════

export type FundingOrderMode = 'chronological' | 'budgetLineThenChronological';

export interface FundingColumnLabels {
  order: string;
  date: string;
  concept: string;
  supplier: string;
  invoiceNumber: string;
  budgetLine: string;
  fxRateApplied: string;
  totalOriginalAmount: string;
  currency: string;
  totalEurAmount: string;
  assignedPct: string;
  assignedOriginalAmount: string;
  assignedEurAmount: string;
}

export interface FundingExportParams {
  projectId: string;
  projectCode: string;
  projectName: string;
  budgetLines: BudgetLine[];
  expenseLinks: ExpenseLink[];
  expenses: Map<string, UnifiedExpense>;
  orderMode?: FundingOrderMode;
  projectFxRate?: number | null;
  columnLabels?: FundingColumnLabels;
  sheetName?: string;
  filenamePrefix?: string;
}

/**
 * Converteix string YYYY-MM-DD a Date object per Excel.
 * Excel requereix Date objects per formatar correctament les dates.
 */
function parseDateForExcel(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return null;
  // Crear date a mitjanit UTC per evitar problemes de timezone
  return new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
}

/**
 * Construeix l'Excel de justificació per finançadors (format unificat).
 * Utilitza buildJustificationRows com a base i re-ordena segons orderMode.
 *
 * Columnes (A-M):
 * A. Núm. correlatiu
 * B. Data
 * C. Concepte / Descripció
 * D. Proveïdor
 * E. Núm. factura
 * F. Partida (codi + nom)
 * G. Tipus de canvi aplicat
 * H. Import total de la despesa (moneda de la despesa)
 * I. Moneda de la despesa
 * J. Import total de la despesa (en EUR)
 * K. % imputat
 * L. Import imputat al projecte (en moneda local)
 * M. Import imputat al projecte (en EUR)
 */
export function buildProjectJustificationFundingXlsx(
  params: FundingExportParams
): ExportResult {
  const {
    projectCode,
    budgetLines,
    expenseLinks,
    expenses,
    projectId,
    orderMode = 'budgetLineThenChronological',
    projectFxRate,
    columnLabels,
    sheetName = 'Justificació',
    filenamePrefix = 'justificacio_financador',
  } = params;

  // 1. Obtenir files base (ordre per partida, usat també per ZIP)
  const baseRows = buildJustificationRows({
    projectId,
    projectCode: projectCode ?? '',
    budgetLines,
    expenseLinks,
    expenses,
  });

  // 2. Re-ordenar segons orderMode (no afecta ZIP)
  const sortedRows = [...baseRows];
  if (orderMode === 'chronological') {
    sortedRows.sort((a, b) => {
      const dateCompare = a.dateExpense.localeCompare(b.dateExpense);
      if (dateCompare !== 0) return dateCompare;
      return a.txId.localeCompare(b.txId);
    });
  }
  // 'budgetLineThenChronological' ja ve ordenat correctament de buildJustificationRows

  // 3. Lookup assignment per obtenir localPct
  const assignmentLookup = new Map<string, import('@/lib/project-module-types').ExpenseAssignment>();
  for (const link of expenseLinks) {
    for (const a of link.assignments) {
      if (a.projectId !== projectId) continue;
      const key = `${link.id}__${a.budgetLineId ?? 'none'}`;
      assignmentLookup.set(key, a);
    }
  }

  // 4. Construir full de despeses
  const wsData: (string | number | Date | null)[][] = [];
  const labels = columnLabels;

  // Header (A-M) — nou ordre
  wsData.push([
    labels?.order ?? 'Núm.',
    labels?.date ?? 'Data',
    labels?.concept ?? 'Concepte / Descripció',
    labels?.supplier ?? 'Proveïdor',
    labels?.invoiceNumber ?? 'Núm. factura',
    labels?.budgetLine ?? 'Partida',
    labels?.fxRateApplied ?? 'Tipus de canvi aplicat',
    labels?.totalOriginalAmount ?? 'Import total (moneda despesa)',
    labels?.currency ?? 'Moneda',
    labels?.totalEurAmount ?? 'Import total (EUR)',
    labels?.assignedPct ?? '% imputat',
    labels?.assignedOriginalAmount ?? 'Import imputat (moneda local)',
    labels?.assignedEurAmount ?? 'Import imputat (EUR)',
  ]);

  // Acumuladors per fila TOTAL (cols H=7, J=9, K=10, L=11)
  let totalH = 0;
  let totalJ = 0;
  let totalK = 0;
  let totalL = 0;

  // Files de dades
  for (let i = 0; i < sortedRows.length; i++) {
    const row = sortedRows[i];
    const newOrder = i + 1;
    const expense = expenses.get(row.txId);
    const link = expenseLinks.find(l => l.id === row.txId);
    const assignKey = `${row.txId}__${row.budgetLineId ?? 'none'}`;
    const assignment = assignmentLookup.get(assignKey);

    const hasFX = !!(expense?.originalCurrency && expense.originalCurrency !== 'EUR');

    // E: Núm. factura
    const invoiceNumber = expense?.source === 'offBank'
      ? (expense.invoiceNumber ?? '')
      : (link?.justification?.invoiceNumber ?? '');

    // F: Partida (codi + nom)
    let partida = '';
    if (row.budgetLineCode !== 'ZZ_NO_PARTIDA') {
      const code = row.budgetLineCode;
      const name = row.budgetLineName;
      partida = code && code !== '' ? `${code} - ${name}` : name;
    }

    // G: Tipus de canvi aplicat (despesa > projecte > buit)
    const fxRateApplied: number | string = hasFX
      ? (expense?.fxRate ?? expense?.fxRateUsed ?? projectFxRate ?? '')
      : '';

    // H: Import total de la despesa (moneda de la despesa)
    let totalOriginal: number | string = '';
    if (hasFX && expense?.originalAmount != null) {
      totalOriginal = Math.abs(expense.originalAmount);
    } else if (!hasFX && expense?.amountEUR != null && expense.amountEUR !== 0) {
      totalOriginal = Math.abs(expense.amountEUR);
    }
    if (typeof totalOriginal === 'number') totalH += totalOriginal;

    // I: Moneda de la despesa
    const currency = hasFX ? (expense?.originalCurrency ?? 'EUR') : 'EUR';

    // J: Import total de la despesa (en EUR)
    // Per despeses FX: si amountEUR > 0 l'usem; sinó calculem amb originalAmount × fxRateApplied
    let totalEUR: number | string = '';
    if (!hasFX) {
      // EUR: directe
      if (expense?.amountEUR != null && expense.amountEUR !== 0) {
        totalEUR = Math.abs(expense.amountEUR);
      }
    } else {
      // FX: preferir amountEUR si és fiable (no 0), sinó calcular
      if (expense?.amountEUR != null && expense.amountEUR !== 0) {
        totalEUR = Math.abs(expense.amountEUR);
      } else if (expense?.originalAmount != null && typeof fxRateApplied === 'number' && fxRateApplied > 0) {
        totalEUR = Math.abs(expense.originalAmount) * fxRateApplied;
      }
    }
    if (typeof totalEUR === 'number') totalJ += totalEUR;

    // M: Import imputat al projecte (EUR) — calculat primer per usar al % imputat
    const assignedEUR: number | string = row.amountAssignedEUR ?? '';
    if (typeof assignedEUR === 'number') totalL += assignedEUR;

    // K: % imputat (valor intern 0..1 per format Excel percentual)
    let assignedPct: number | string = '';
    if (assignment?.localPct != null) {
      assignedPct = assignment.localPct / 100;
    } else if (typeof assignedEUR === 'number' && typeof totalEUR === 'number' && totalEUR > 0) {
      assignedPct = assignedEUR / totalEUR;
    }

    // L: Import imputat al projecte (moneda local)
    let assignedOriginal: number | string = '';
    if (hasFX && expense?.originalAmount != null && assignment?.localPct != null && assignment.localPct > 0) {
      assignedOriginal = Math.abs(expense.originalAmount) * (assignment.localPct / 100);
      totalK += assignedOriginal;
    }

    wsData.push([
      newOrder,
      parseDateForExcel(row.dateExpense),
      row.concept,
      row.counterpartyName,
      invoiceNumber,
      partida,
      fxRateApplied,
      totalOriginal,
      currency,
      totalEUR,
      assignedPct,
      assignedOriginal,
      assignedEUR,
    ]);
  }

  // Fila de totals
  wsData.push([
    '',
    null,
    '',
    '',
    '',
    'TOTAL',
    '',
    totalH || '',
    '',
    totalJ || '',
    '',
    totalK || '',
    totalL || '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(wsData, { cellDates: true });

  // Format numèric: col G(6) = TC, K(10) = %, cols H(7), J(9), L(11), M(12) = imports
  const fxFormat = '0.000000';
  const pctFormat = '0.00%';
  const numberFormat = '#,##0.00';
  const amountCols = [7, 9, 11, 12];
  for (let r = 1; r <= sortedRows.length + 1; r++) { // +1 per fila totals
    // TC (col 6)
    const fxCellRef = XLSX.utils.encode_cell({ r, c: 6 });
    if (ws[fxCellRef] && typeof ws[fxCellRef].v === 'number') {
      ws[fxCellRef].z = fxFormat;
    }
    // % imputat (col 10)
    const pctCellRef = XLSX.utils.encode_cell({ r, c: 10 });
    if (ws[pctCellRef] && typeof ws[pctCellRef].v === 'number') {
      ws[pctCellRef].z = pctFormat;
    }
    // Import cols
    for (const c of amountCols) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
        ws[cellRef].z = numberFormat;
      }
    }
  }

  // Amplades de columna (A-M)
  ws['!cols'] = [
    { wch: 8 },   // A: Núm.
    { wch: 12 },  // B: Data
    { wch: 35 },  // C: Concepte
    { wch: 25 },  // D: Proveïdor
    { wch: 15 },  // E: Núm. factura
    { wch: 30 },  // F: Partida
    { wch: 14 },  // G: TC aplicat
    { wch: 20 },  // H: Import total (moneda despesa)
    { wch: 10 },  // I: Moneda
    { wch: 16 },  // J: Import total (EUR)
    { wch: 12 },  // K: % imputat
    { wch: 20 },  // L: Import imputat (local)
    { wch: 18 },  // M: Import imputat (EUR)
  ];

  // 5. Crear workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // 6. Generar fitxer
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  // 7. Generar nom de fitxer
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const safeProjectCode = (projectCode ?? 'projecte').replace(/[^a-zA-Z0-9]/g, '');
  const safeFilenamePrefix = (filenamePrefix ?? 'justificacio_financador').replace(/[^a-zA-Z0-9_-]/g, '');
  const filename = `${safeFilenamePrefix}_${safeProjectCode}_${dateStr}.xlsx`;

  return { blob, filename };
}
