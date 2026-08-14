import { NextRequest, NextResponse } from 'next/server';
import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import {
  getAdminDb,
  validateUserMembership,
  verifyIdToken,
} from '@/lib/api/admin-sdk';
import { requirePermission } from '@/lib/api/require-permission';
import { resolveServerEntitlement, type EntitlementDbLike } from '@/lib/api/require-entitlement';
import { canAccessProjectsArea } from '@/lib/permissions';
import {
  buildProjectJustificationFundingXlsx,
  buildProjectMultiFunderJustificationXlsx,
  type FundingColumnLabels,
  type FundingOrderMode,
  type MultiFunderExportLabels,
} from '@/lib/project-justification-export';
import type {
  BudgetLine,
  ExpenseLink,
  FxTransfer,
  OffBankExpense,
  Project,
  ProjectExpenseExport,
  ProjectFundingBudgetAllocation,
  ProjectFundingExpenseAllocation,
  ProjectFundingSource,
  UnifiedExpense,
} from '@/lib/project-module-types';
import { computeSafeFxAssignmentAmountEUR, getEffectiveProjectFxRate } from '@/lib/project-module/fx';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;
const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type ExportKind = 'funding-xlsx' | 'multi-funding-xlsx';
type ExportLocale = 'ca' | 'es' | 'fr' | 'pt';

type ExportRequest = {
  orgId?: string;
  projectId?: string;
  kind?: ExportKind;
  orderMode?: FundingOrderMode;
  locale?: ExportLocale;
};

const FUNDING_LOCALE: Record<ExportLocale, {
  columnLabels: FundingColumnLabels;
  sheetName: string;
  filenamePrefix: string;
}> = {
  ca: {
    columnLabels: { order: 'Núm.', date: 'Data', concept: 'Concepte / Descripció', supplier: 'Proveïdor', invoiceNumber: 'Núm. factura', budgetLine: 'Partida', fxRateApplied: 'Tipus de canvi aplicat', totalOriginalAmount: 'Import total (moneda despesa)', currency: 'Moneda', totalEurAmount: 'Import total (EUR)', assignedPct: '% imputat', assignedOriginalAmount: 'Import imputat (moneda local)', assignedEurAmount: 'Import imputat (EUR)' },
    sheetName: 'Justificació',
    filenamePrefix: 'justificacio_financador',
  },
  es: {
    columnLabels: { order: 'Núm.', date: 'Fecha', concept: 'Concepto / Descripción', supplier: 'Proveedor', invoiceNumber: 'N.º factura', budgetLine: 'Partida', fxRateApplied: 'Tipo de cambio aplicado', totalOriginalAmount: 'Importe total (moneda gasto)', currency: 'Moneda', totalEurAmount: 'Importe total (EUR)', assignedPct: '% imputado', assignedOriginalAmount: 'Importe imputado (moneda local)', assignedEurAmount: 'Importe imputado (EUR)' },
    sheetName: 'Justificación',
    filenamePrefix: 'justificacion_financiador',
  },
  fr: {
    columnLabels: { order: 'N°', date: 'Date', concept: 'Concept / Description', supplier: 'Fournisseur', invoiceNumber: 'N° facture', budgetLine: 'Poste budgétaire', fxRateApplied: 'Taux de change appliqué', totalOriginalAmount: 'Montant total (devise dépense)', currency: 'Devise', totalEurAmount: 'Montant total (EUR)', assignedPct: '% imputé', assignedOriginalAmount: 'Montant imputé (devise locale)', assignedEurAmount: 'Montant imputé (EUR)' },
    sheetName: 'Justification',
    filenamePrefix: 'justification_financeur',
  },
  pt: {
    columnLabels: { order: 'N.º', date: 'Data', concept: 'Conceito / Descrição', supplier: 'Fornecedor', invoiceNumber: 'N.º fatura', budgetLine: 'Rubrica', fxRateApplied: 'Taxa de câmbio aplicada', totalOriginalAmount: 'Valor total (moeda despesa)', currency: 'Moeda', totalEurAmount: 'Valor total (EUR)', assignedPct: '% imputado', assignedOriginalAmount: 'Valor imputado (moeda local)', assignedEurAmount: 'Valor imputado (EUR)' },
    sheetName: 'Justificação',
    filenamePrefix: 'justificacao_financiador',
  },
};

const MULTI_FUNDER_LOCALE: Record<ExportLocale, MultiFunderExportLabels> = {
  ca: { expenseHeaders: ['Núm.', 'Data despesa', 'Data factura', 'Data pagament', 'Concepte', 'Proveïdor / contrapart', 'NIF/CIF', 'Núm. factura', 'Núm. justificant', 'Partida principal', 'Moneda', 'Import total moneda original', 'Tipus de canvi', 'Import total EUR', 'Import imputat EUR'], totalDistributed: 'Total distribuït', difference: 'Diferència', status: 'Estat', notes: 'Notes', summaryBudgetLine: 'Partida', summaryBudgeted: 'Pressupost total', summaryExecuted: 'Executat total', summaryDifference: 'Diferència total', budgetedSuffix: 'pressupost', executedSuffix: 'executat', differenceSuffix: 'diferència', expenseSheetName: 'Despeses', summarySheetName: 'Resum per partida', filenamePrefix: 'justificacio_projecte_diversos_financadors' },
  es: { expenseHeaders: ['Núm.', 'Fecha gasto', 'Fecha factura', 'Fecha pago', 'Concepto', 'Proveedor / contraparte', 'NIF/CIF', 'N.º factura', 'N.º justificante', 'Partida principal', 'Moneda', 'Importe total moneda original', 'Tipo de cambio', 'Importe total EUR', 'Importe imputado EUR'], totalDistributed: 'Total distribuido', difference: 'Diferencia', status: 'Estado', notes: 'Notas', summaryBudgetLine: 'Partida', summaryBudgeted: 'Presupuesto total', summaryExecuted: 'Ejecutado total', summaryDifference: 'Diferencia total', budgetedSuffix: 'presupuesto', executedSuffix: 'ejecutado', differenceSuffix: 'diferencia', expenseSheetName: 'Gastos', summarySheetName: 'Resumen por partida', filenamePrefix: 'justificacion_proyecto_varios_financiadores' },
  fr: { expenseHeaders: ['N°', 'Date dépense', 'Date facture', 'Date paiement', 'Concept', 'Fournisseur / contrepartie', 'NIF/CIF', 'N° facture', 'N° justificatif', 'Poste principal', 'Devise', 'Montant total devise originale', 'Taux de change', 'Montant total EUR', 'Montant imputé EUR'], totalDistributed: 'Total distribué', difference: 'Différence', status: 'État', notes: 'Notes', summaryBudgetLine: 'Poste', summaryBudgeted: 'Budget total', summaryExecuted: 'Exécuté total', summaryDifference: 'Différence totale', budgetedSuffix: 'budget', executedSuffix: 'exécuté', differenceSuffix: 'différence', expenseSheetName: 'Dépenses', summarySheetName: 'Résumé par poste', filenamePrefix: 'justification_projet_plusieurs_bailleurs' },
  pt: { expenseHeaders: ['N.º', 'Data da despesa', 'Data da fatura', 'Data de pagamento', 'Conceito', 'Fornecedor / contraparte', 'NIF', 'N.º fatura', 'N.º comprovativo', 'Rubrica principal', 'Moeda', 'Valor total moeda original', 'Taxa de câmbio', 'Valor total EUR', 'Valor imputado EUR'], totalDistributed: 'Total distribuído', difference: 'Diferença', status: 'Estado', notes: 'Notas', summaryBudgetLine: 'Rubrica', summaryBudgeted: 'Orçamento total', summaryExecuted: 'Executado total', summaryDifference: 'Diferença total', budgetedSuffix: 'orçamento', executedSuffix: 'executado', differenceSuffix: 'diferença', expenseSheetName: 'Despesas', summarySheetName: 'Resumo por rubrica', filenamePrefix: 'justificacao_projeto_varios_financiadores' },
};

type GrantJustificationExportDeps = {
  verifyIdTokenFn: typeof verifyIdToken;
  getAdminDbFn: typeof getAdminDb;
  validateUserMembershipFn: typeof validateUserMembership;
  resolveEntitlementFn: typeof resolveServerEntitlement;
  loadExportDataFn: typeof loadGrantJustificationExportData;
};

const defaultDeps: GrantJustificationExportDeps = {
  verifyIdTokenFn: verifyIdToken,
  getAdminDbFn: getAdminDb,
  validateUserMembershipFn: validateUserMembership,
  resolveEntitlementFn: resolveServerEntitlement,
  loadExportDataFn: loadGrantJustificationExportData,
};

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json({ success: false, code, error }, { status });
}

function isExportKind(value: unknown): value is ExportKind {
  return value === 'funding-xlsx' || value === 'multi-funding-xlsx';
}

function isOrderMode(value: unknown): value is FundingOrderMode {
  return value === 'chronological' || value === 'budgetLineThenChronological';
}

function isExportLocale(value: unknown): value is ExportLocale {
  return value === 'ca' || value === 'es' || value === 'fr' || value === 'pt';
}

function docData<T>(snapshot: QueryDocumentSnapshot): T {
  return { id: snapshot.id, ...snapshot.data() } as T;
}

function bankExpense(id: string, data: ProjectExpenseExport, link: ExpenseLink): UnifiedExpense {
  const documents = [...(data.documents ?? [])]
    .sort((left, right) => Number(right.isPrimary === true) - Number(left.isPrimary === true));
  const primaryDocument = documents[0];
  const seenDocuments = new Set<string>();
  return {
    txId: id,
    source: 'bank',
    date: data.date,
    description: data.description,
    amountEUR: data.amountEUR,
    categoryName: data.categoryName,
    counterpartyName: data.counterpartyName,
    documentUrl: primaryDocument?.fileUrl ?? null,
    attachments: documents
      .filter((document) => typeof document.fileUrl === 'string' && document.fileUrl.trim().length > 0)
      .filter((document) => {
        const identity = document.storagePath?.trim() || document.fileUrl!.trim();
        if (seenDocuments.has(identity)) return false;
        seenDocuments.add(identity);
        return true;
      })
      .map((document, index) => ({
        url: document.fileUrl!.trim(),
        storagePath: document.storagePath ?? null,
        name: document.name?.trim() || `document-${index + 1}`,
        contentType: document.contentType ?? 'application/octet-stream',
        size: typeof document.size === 'number' && Number.isFinite(document.size) ? document.size : 0,
        uploadedAt: document.createdAt ?? data.date,
        aiDocumentReview: document.aiDocumentReview ?? null,
      })),
    originalCurrency: 'EUR',
    originalAmount: null,
    fxRate: null,
    invoiceNumber: link.justification?.invoiceNumber ?? null,
    issuerTaxId: link.justification?.issuerTaxId ?? null,
    invoiceDate: link.justification?.invoiceDate ?? null,
    paymentDate: link.justification?.paymentDate ?? null,
    supportDocNumber: link.justification?.supportDocNumber ?? null,
  };
}

function offBankExpense(id: string, data: OffBankExpense): UnifiedExpense {
  return {
    txId: `off_${id}`,
    source: 'offBank',
    date: data.date,
    description: data.concept,
    amountEUR: data.amountEUR ?? 0,
    categoryName: data.categoryName,
    counterpartyName: data.counterpartyName,
    documentUrl: data.attachments?.[0]?.url ?? data.documentUrl ?? null,
    originalCurrency: data.originalCurrency ?? data.currency ?? null,
    originalAmount: data.originalAmount ?? data.amountOriginal ?? null,
    fxRate: data.fxRate ?? data.fxRateUsed ?? null,
    attachments: data.attachments ?? null,
    needsReview: data.needsReview ?? null,
    invoiceNumber: data.invoiceNumber ?? null,
    issuerTaxId: data.issuerTaxId ?? null,
    invoiceDate: data.invoiceDate ?? null,
    paymentDate: data.paymentDate ?? null,
    supportDocNumber: data.supportDocNumber ?? null,
  };
}

async function mapInChunks<T>(items: T[], limit: number, mapper: (item: T) => Promise<void>): Promise<void> {
  for (let offset = 0; offset < items.length; offset += limit) {
    await Promise.all(items.slice(offset, offset + limit).map(mapper));
  }
}

export async function loadGrantJustificationExportData(
  db: Firestore,
  orgId: string,
  projectId: string
) {
  const projectRef = db.doc(`organizations/${orgId}/projectModule/_/projects/${projectId}`);
  const projectSnap = await projectRef.get();
  if (!projectSnap.exists) return null;

  const linksQuery = db.collection(`organizations/${orgId}/projectModule/_/expenseLinks`)
    .where('projectIds', 'array-contains', projectId);
  const [budgetSnap, linksSnap, fxTransfersSnap, fundingSourcesSnap, budgetAllocationsSnap, expenseAllocationsSnap] = await Promise.all([
    projectRef.collection('budgetLines').get(),
    linksQuery.get(),
    projectRef.collection('fxTransfers').get(),
    projectRef.collection('fundingSources').get(),
    projectRef.collection('fundingBudgetAllocations').get(),
    projectRef.collection('fundingExpenseAllocations').get(),
  ]);

  const project = { id: projectSnap.id, ...projectSnap.data() } as Project;
  const budgetLines = budgetSnap.docs.map((doc) => docData<BudgetLine>(doc));
  const expenseLinks = linksSnap.docs.map((doc) => docData<ExpenseLink>(doc));
  const expenses = new Map<string, UnifiedExpense>();

  await mapInChunks(expenseLinks, 20, async (link) => {
    if (link.id.startsWith('off_')) {
      const expenseId = link.id.slice(4);
      const snapshot = await db.doc(`organizations/${orgId}/projectModule/_/offBankExpenses/${expenseId}`).get();
      if (snapshot.exists) expenses.set(link.id, offBankExpense(snapshot.id, snapshot.data() as OffBankExpense));
      return;
    }
    const snapshot = await db.doc(`organizations/${orgId}/exports/projectExpenses/items/${link.id}`).get();
    if (snapshot.exists) expenses.set(link.id, bankExpense(snapshot.id, snapshot.data() as ProjectExpenseExport, link));
  });

  return {
    project,
    budgetLines,
    expenseLinks,
    expenses,
    fxTransfers: fxTransfersSnap.docs.map((doc) => docData<FxTransfer>(doc)),
    fundingSources: fundingSourcesSnap.docs.map((doc) => docData<ProjectFundingSource>(doc)),
    budgetAllocations: budgetAllocationsSnap.docs.map((doc) => docData<ProjectFundingBudgetAllocation>(doc)),
    expenseAllocations: expenseAllocationsSnap.docs.map((doc) => docData<ProjectFundingExpenseAllocation>(doc)),
  };
}

export async function handleGrantJustificationExportPost(
  request: NextRequest,
  deps: GrantJustificationExportDeps = defaultDeps
): Promise<Response> {
  const auth = await deps.verifyIdTokenFn(request);
  if (!auth) return jsonError('UNAUTHORIZED', 'No autenticat', 401);

  let body: ExportRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_BODY', 'Body invàlid', 400);
  }

  const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  if (!ID_PATTERN.test(orgId) || !ID_PATTERN.test(projectId) || !isExportKind(body.kind)) {
    return jsonError('INVALID_INPUT', 'Paràmetres d’exportació invàlids', 400);
  }
  if (body.orderMode !== undefined && !isOrderMode(body.orderMode)) {
    return jsonError('INVALID_INPUT', 'Ordre d’exportació invàlid', 400);
  }
  if (body.locale !== undefined && !isExportLocale(body.locale)) {
    return jsonError('INVALID_INPUT', 'Idioma d’exportació invàlid', 400);
  }

  const db = deps.getAdminDbFn();
  const membership = await deps.validateUserMembershipFn(db, auth.uid, orgId);
  const denied = requirePermission(membership, {
    code: 'PROJECT_MODULE_REQUIRED',
    check: canAccessProjectsArea,
  });
  if (denied) return denied;

  const entitlement = await deps.resolveEntitlementFn({
    db: db as unknown as EntitlementDbLike,
    orgId,
    capability: 'grantJustification.export',
    userAllowed: true,
  });
  if (!entitlement.allowed) {
    return jsonError('ENTITLEMENT_DENIED', 'L’exportació de justificacions requereix el pla Complet.', 403);
  }

  const data = await deps.loadExportDataFn(db, orgId, projectId);
  if (!data) return jsonError('PROJECT_NOT_FOUND', 'Projecte no trobat', 404);
  const locale = body.locale ?? 'ca';
  const localized = FUNDING_LOCALE[locale];
  const effectiveProjectFxRate = getEffectiveProjectFxRate(data.fxTransfers, data.project);

  const result = body.kind === 'multi-funding-xlsx'
    ? buildProjectMultiFunderJustificationXlsx({
        projectId,
        projectCode: data.project.code,
        projectName: data.project.name,
        budgetLines: data.budgetLines,
        expenseLinks: data.expenseLinks,
        expenses: data.expenses,
        fundingSources: data.fundingSources,
        budgetAllocations: data.budgetAllocations,
        expenseAllocations: data.expenseAllocations,
        labels: MULTI_FUNDER_LOCALE[locale],
        resolveAssignmentAmountEUR: ({ expense, assignment }) => expense
          ? computeSafeFxAssignmentAmountEUR({ expense, assignment, projectTC: effectiveProjectFxRate })
          : assignment.amountEUR,
      })
    : buildProjectJustificationFundingXlsx({
        projectId,
        projectCode: data.project.code ?? '',
        projectName: data.project.name,
        budgetLines: data.budgetLines,
        expenseLinks: data.expenseLinks,
        expenses: data.expenses,
        orderMode: body.orderMode,
        projectFxRate: effectiveProjectFxRate,
        columnLabels: localized.columnLabels,
        sheetName: localized.sheetName,
        filenamePrefix: localized.filenamePrefix,
        resolveAssignmentAmountEUR: ({ expense, assignment }) => expense
          ? computeSafeFxAssignmentAmountEUR({ expense, assignment, projectTC: effectiveProjectFxRate })
          : assignment.amountEUR,
      });

  const bytes = await result.blob.arrayBuffer();
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="${result.filename.replace(/["\r\n]/g, '_')}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
