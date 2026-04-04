'use client';
import * as React from 'react';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { DollarSign, TrendingUp, TrendingDown, Rocket, Heart, AlertTriangle, FolderKanban, CalendarClock, Share2, Copy, Mail, PartyPopper, Info, FileSpreadsheet, FileText, RefreshCcw, Pencil, Settings, Loader2 } from 'lucide-react';
import type { Transaction, Contact, Project, Donor, Category, OrganizationMember } from '@/lib/data';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useTranslations } from '@/i18n';
import { useCurrentOrganization, useOrgUrl } from '@/hooks/organization-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { formatCurrencyEU } from '@/lib/normalize';
import { DateFilter, type DateFilterValue } from '@/components/date-filter';
import { useTransactionFilters } from '@/hooks/use-transaction-filters';
import { useIsMobile } from '@/hooks/use-mobile';
import { findSystemCategoryId } from '@/lib/constants';
import { canViewFinancialDashboard } from '@/lib/can-view-financial-dashboard';
import {
  aggregateIncomeByCategory,
  aggregateMissionTransfersByContact,
  aggregateOperationalExpensesByProject,
  buildNarrativesFromAggregates,
  type AggregateResult,
  type AggregateRow,
  type NarrativeDraft,
} from '@/lib/exports/economic-report';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toPeriodQuery } from '@/lib/period-query';
import { shouldShowWelcomeModal, isFirstAdmin } from '@/lib/onboarding';
import { WelcomeOnboardingModal } from '@/components/onboarding/WelcomeOnboardingModal';
import { OnboardingWizardModal } from '@/components/onboarding/OnboardingWizard';
import { detectLegacyCategoryTransactions, logLegacyCategorySummary } from '@/lib/category-health';
import { isVisibleInMovementsLedger } from '@/lib/transactions/remittance-visibility';
import { FISCAL_PENDING_REVIEW_ALERT_TYPE, toDateFromFirestoreValue } from '@/lib/admin/admin-alerts';

interface TaxObligation {
  id: string;
  nameKey: string;
  month: number;
  day: number;
  reportPath: string;
}

const TAX_OBLIGATIONS: TaxObligation[] = [
  { id: 'model182', nameKey: 'model182', month: 1, day: 31, reportPath: '/dashboard/informes' },
  { id: 'model347', nameKey: 'model347', month: 2, day: 28, reportPath: '/dashboard/informes' },
];

const NARRATIVE_ORDER: (keyof NarrativeDraft)[] = ['summary', 'income', 'expenses', 'transfers'];
const EMPTY_AGGREGATE: AggregateResult = { aggregated: [], complete: [], total: 0 };

interface Celebration {
  id: string;
  emoji: string;
  messageKey: string;
  messageParams?: Record<string, any>;
  priority: number;
}

interface DashboardAdminAlert {
  id: string;
  type: string;
  status: 'open' | 'read' | 'expired';
  expiresAt?: unknown;
  payload?: {
    pendingCount?: number;
    pendingAmountCents?: number;
    year?: number;
  };
  createdAt?: unknown;
}

interface DashboardSummaryResponse {
  success: boolean;
  income: number;
  expense: number;
  missionTransfers: number;
  balance: number;
  count: number;
}

// Component per mostrar comparativa amb any anterior
function ComparisonBadge({
  current,
  previous,
  previousYear,
  isCurrency = false,
  formatFn,
  texts,
}: {
  current: number;
  previous: number;
  previousYear: number;
  isCurrency?: boolean;
  formatFn?: (value: number) => string;
  texts: {
    equal: (params: { year: number }) => string;
    delta: (params: { sign: string; value: string; year: number }) => string;
  };
}) {
  const diff = current - previous;

  if (diff === 0) {
    return <span className="text-xs text-muted-foreground">{texts.equal({ year: previousYear })}</span>;
  }

  const isPositive = diff > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const color = isPositive ? 'text-green-600' : 'text-red-600';
  const prefix = isPositive ? '+' : '-';
  const rawValue = formatFn ? formatFn(Math.abs(diff)) : Math.abs(diff);
  const displayDiff = typeof rawValue === 'number' ? rawValue.toString() : rawValue;
  const label = texts.delta({ sign: prefix, value: displayDiff, year: previousYear });

  return (
    <span className={`text-xs flex items-center gap-0.5 ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// Component per mostrar taula Top 5 categories + Altres
function TopCategoriesTable({
  transactions,
  categories,
  categoryTranslations,
  texts,
  buildUrl,
}: {
  transactions: Transaction[];
  categories: Category[] | null;
  categoryTranslations: Record<string, string>;
  texts: {
    title: string;
    category: string;
    amount: string;
    percent: string;
    delta: string;
    viewExpenses: string;
    others: string;
    noData: string;
    uncategorized: string;
  };
  buildUrl: (path: string) => string;
}) {
  // Mapa de categoryId → nom (per categories de l'org)
  const categoryNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    if (categories) {
      for (const c of categories) {
        m.set(c.id, c.name);
      }
    }
    return m;
  }, [categories]);

  // Mapa de categoryId → type (income/expense) per categories de l'org
  const categoryTypeById = React.useMemo(() => {
    const m = new Map<string, 'income' | 'expense'>();
    if (categories) {
      for (const c of categories) {
        m.set(c.id, c.type);
      }
    }
    return m;
  }, [categories]);

  // Categories d'ingrés predefinides (claus que poden aparèixer directament a tx.category)
  const INCOME_CATEGORY_KEYS = new Set([
    'donations', 'subsidies', 'memberFees', 'sponsorships',
    'productSales', 'inheritances', 'events', 'otherIncome',
  ]);

  // Funció per obtenir el nom de la categoria (resol ID → name → traducció)
  const getCategoryName = React.useCallback((categoryKey: string): string => {
    if (categoryKey === 'uncategorized') {
      return texts.uncategorized;
    }

    // Primer intentar trobar en categories de l'org (per ID)
    const orgCategoryName = categoryNameById.get(categoryKey);
    if (orgCategoryName) {
      // El nom de la categoria pot ser una clau de traducció (ex: 'salaries')
      // Intentem traduir-la
      const translated = categoryTranslations[orgCategoryName];
      if (translated && typeof translated === 'string') {
        return translated;
      }
      // Si no es pot traduir, retornem el nom directament (categories custom)
      return orgCategoryName;
    }

    // Després, traduccions predefinides (per clau directa)
    const translatedCategory = categoryTranslations[categoryKey];
    if (translatedCategory && typeof translatedCategory === 'string') {
      return translatedCategory;
    }

    // Si no es troba, retornar "Sense categoria" per evitar mostrar claus internes
    return texts.uncategorized;
  }, [categoryNameById, categoryTranslations, texts.uncategorized]);

  // Funció per determinar si una categoria és d'ingrés
  const isIncomeCategory = React.useCallback((categoryKey: string): boolean => {
    // 1. Si és una clau predefinida d'ingrés
    if (INCOME_CATEGORY_KEYS.has(categoryKey)) return true;
    // 2. Si l'org ha definit aquesta categoria com a income
    const orgType = categoryTypeById.get(categoryKey);
    if (orgType === 'income') return true;
    // 3. Si el nom de la categoria (orgName) és una clau d'ingrés
    const orgName = categoryNameById.get(categoryKey);
    if (orgName && INCOME_CATEGORY_KEYS.has(orgName)) return true;
    return false;
  }, [categoryTypeById, categoryNameById]);

  // Separar despeses categoritzades, no categoritzades i fees
  // IMPORTANT: Aquesta taula mostra DESPESES, per tant excloem categories d'ingrés
  const { categorizedTxs, uncategorizedTotal } = React.useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return { categorizedTxs: [], uncategorizedTotal: 0 };
    }

    let uncatTotal = 0;
    const catTxs: Transaction[] = [];

    for (const tx of transactions) {
      // Excloure fees (comissions bancàries i fees de retorn)
      if (tx.transactionType === 'fee' || tx.transactionType === 'return_fee') {
        continue;
      }
      // Excloure categories d'ingrés (no són despeses)
      if (tx.category && isIncomeCategory(tx.category)) {
        continue;
      }
      // Separar categoritzades de no categoritzades
      if (tx.category) {
        catTxs.push(tx);
      } else {
        uncatTotal += Math.abs(tx.amount);
      }
    }

    return { categorizedTxs: catTxs, uncategorizedTotal: uncatTotal };
  }, [transactions, isIncomeCategory]);

  const topCategories = React.useMemo(() => {
    if (categorizedTxs.length === 0) return [];

    // SOLUCIÓ: Agregar per displayName (no per categoryId) per evitar duplicats visuals
    // Problema: Múltiples categoryId poden tenir el mateix displayName traduït
    // Ex: ID "salaries" i ID "bCAC7..." amb orgName "salaries" → ambdós mostren "Salarios y seguridad social"
    const byDisplayName = new Map<string, { amount: number; keys: string[] }>();

    for (const tx of categorizedTxs) {
      const categoryKey = tx.category!;
      const displayName = getCategoryName(categoryKey);
      const existing = byDisplayName.get(displayName);
      if (existing) {
        existing.amount += Math.abs(tx.amount);
        if (!existing.keys.includes(categoryKey)) {
          existing.keys.push(categoryKey);
        }
      } else {
        byDisplayName.set(displayName, { amount: Math.abs(tx.amount), keys: [categoryKey] });
      }
    }

    // Convertir a array i ordenar
    const sorted = [...byDisplayName.entries()]
      .map(([name, data]) => ({ name, amount: data.amount, keys: data.keys }))
      .sort((a, b) => b.amount - a.amount);

    // Calcular total
    const total = sorted.reduce((sum, item) => sum + item.amount, 0);
    if (total === 0) return [];

    // Top 5 + Altres
    const top5 = sorted.slice(0, 5);
    const restAmount = sorted.slice(5).reduce((sum, item) => sum + item.amount, 0);

    // Per l'enllaç de filtrar, usem el primer key del grup (els altres són sinònims)
    const result = top5.map(item => ({
      key: item.keys[0],
      name: item.name,
      amount: item.amount,
      percent: (item.amount / total) * 100,
    }));

    if (restAmount > 0) {
      result.push({
        key: '_others',
        name: texts.others,
        amount: restAmount,
        percent: (restAmount / total) * 100,
      });
    }

    return result;
  }, [categorizedTxs, getCategoryName, texts.others]);

  if (topCategories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{texts.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{texts.noData}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{texts.title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left font-medium p-3">{texts.category}</th>
                <th className="text-right font-medium p-3">{texts.amount}</th>
                <th className="text-right font-medium p-3">{texts.percent}</th>
                <th className="text-right font-medium p-3">{texts.delta}</th>
                <th className="text-right font-medium p-3"></th>
              </tr>
            </thead>
            <tbody>
              {topCategories.map((cat) => (
                <tr key={cat.key} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-medium">{cat.name}</td>
                  <td className="p-3 text-right tabular-nums">{formatCurrencyEU(cat.amount)}</td>
                  <td className="p-3 text-right tabular-nums text-muted-foreground">{cat.percent.toFixed(1)}%</td>
                  <td className="p-3 text-right text-muted-foreground">—</td>
                  <td className="p-3 text-right">
                    {cat.key !== '_others' && (
                      <Link href={buildUrl(`/dashboard/movimientos?category=${cat.key}`)}>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                          {texts.viewExpenses}
                        </Button>
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {uncategorizedTotal > 0 && (
          <div className="px-3 py-2 border-t text-sm text-muted-foreground">
            {texts.uncategorized}: {formatCurrencyEU(uncategorizedTotal)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { firestore, user } = useFirebase();
  const { organizationId, organization, userRole, member, isLoading: isOrganizationLoading } = useCurrentOrganization();
  const { permissions, canAccessProjectsArea } = usePermissions();
  // SECURITY GUARD: users without moviments permissions must never see economic data
  // (amounts, totals, balances or derived financial metrics).
  const canViewFinancial = canViewFinancialDashboard(permissions);
  const { t, tr, language } = useTranslations();
  const locale = language === 'es' ? 'es-ES' : 'ca-ES';
  // Helper local per interpolació de placeholders {key} en claus JSON
  const tri = React.useCallback(
    (key: string, params: Record<string, string | number>) =>
      tr(key).replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`)),
    [tr]
  );
  // Adaptador shareModal: mateixa forma que t.dashboard.shareModal però via tr()/tri()
  const shareModalTexts = React.useMemo(() => ({
    summaryHeader: (p: { organization: string; period: string }) => tri("dashboard.shareModal.summaryHeader", p),
    summaryBlockTitle: tr("dashboard.shareModal.summaryBlockTitle"),
    summaryFallbackOrg: tr("dashboard.shareModal.summaryFallbackOrg"),
    summaryOrgPeriod: (p: { organization: string; period: string }) => tri("dashboard.shareModal.summaryOrgPeriod", p),
    emailSubject: (p: { organization: string }) => tri("dashboard.shareModal.emailSubject", p),
    actions: {
      copy: tr("dashboard.shareModal.actions.copy"),
      edit: tr("dashboard.shareModal.actions.edit"),
      reset: tr("dashboard.shareModal.actions.reset"),
      exportExcel: tr("dashboard.shareModal.actions.exportExcel"),
      exportCsv: tr("dashboard.shareModal.actions.exportCsv"),
    },
    narrativesHeading: tr("dashboard.shareModal.narrativesHeading"),
    narrativesDescription: tr("dashboard.shareModal.narrativesDescription"),
    cards: {
      summary: { title: tr("dashboard.shareModal.cards.summary.title"), label: tr("dashboard.shareModal.cards.summary.label") },
      income: { title: tr("dashboard.shareModal.cards.income.title"), label: tr("dashboard.shareModal.cards.income.label") },
      expenses: { title: tr("dashboard.shareModal.cards.expenses.title"), label: tr("dashboard.shareModal.cards.expenses.label") },
      transfers: { title: tr("dashboard.shareModal.cards.transfers.title"), label: tr("dashboard.shareModal.cards.transfers.label") },
    },
    editor: {
      title: (p: { section: string }) => tri("dashboard.shareModal.editor.title", p),
      description: (p: { section: string }) => tri("dashboard.shareModal.editor.description", p),
    },
    labels: {
      uncategorized: tr("dashboard.shareModal.labels.uncategorized"),
      generalProject: tr("dashboard.shareModal.labels.generalProject"),
      generalProjectDescriptor: tr("dashboard.shareModal.labels.generalProjectDescriptor"),
      noCounterpart: tr("dashboard.shareModal.labels.noCounterpart"),
      others: tr("dashboard.shareModal.labels.others"),
    },
    narratives: {
      summary: {
        noMovements: (p: { period: string }) => tri("dashboard.shareModal.narratives.summary.noMovements", p),
        general: (p: { period: string; income: string; expenses: string; balance: string }) => tri("dashboard.shareModal.narratives.summary.general", p),
      },
      income: {
        noData: tr("dashboard.shareModal.narratives.income.noData"),
        primary: (p: { source: string; percentage: string }) => tri("dashboard.shareModal.narratives.income.primary", p),
        fallbackPrimary: (p: { percentage: string }) => tri("dashboard.shareModal.narratives.income.fallbackPrimary", p),
        secondary: (p: { source: string; percentage: string }) => tri("dashboard.shareModal.narratives.income.secondary", p),
        fallbackSecondary: (p: { percentage: string }) => tri("dashboard.shareModal.narratives.income.fallbackSecondary", p),
      },
      expenses: {
        noData: tr("dashboard.shareModal.narratives.expenses.noData"),
        allGeneral: (p: { label: string }) => tri("dashboard.shareModal.narratives.expenses.allGeneral", p),
        generalDescriptor: (p: { label: string; descriptor: string }) => tri("dashboard.shareModal.narratives.expenses.generalDescriptor", p),
        primary: (p: { area: string; percentage: string }) => tri("dashboard.shareModal.narratives.expenses.primary", p),
        secondary: (p: { area: string; percentage: string }) => tri("dashboard.shareModal.narratives.expenses.secondary", p),
        others: (p: { percentage: string }) => tri("dashboard.shareModal.narratives.expenses.others", p),
      },
      transfers: {
        noData: tr("dashboard.shareModal.narratives.transfers.noData"),
        primary: (p: { counterpart: string; percentage: string }) => tri("dashboard.shareModal.narratives.transfers.primary", p),
        fallbackPrimary: (p: { percentage: string }) => tri("dashboard.shareModal.narratives.transfers.fallbackPrimary", p),
        secondary: (p: { counterpart: string; percentage: string }) => tri("dashboard.shareModal.narratives.transfers.secondary", p),
        fallbackSecondary: (p: { percentage: string }) => tri("dashboard.shareModal.narratives.transfers.fallbackSecondary", p),
        others: (p: { percentage: string }) => tri("dashboard.shareModal.narratives.transfers.others", p),
      },
    },
  }), [tr, tri]);
  const shareModalExports = React.useMemo(() => ({
    summarySheet: {
      name: tr("dashboard.shareModal.exports.summarySheet.name"),
      columns: {
        indicator: tr("dashboard.shareModal.exports.summarySheet.columns.indicator"),
        value: tr("dashboard.shareModal.exports.summarySheet.columns.value"),
      },
      rows: {
        period: tr("dashboard.shareModal.exports.summarySheet.rows.period"),
        income: tr("dashboard.shareModal.exports.summarySheet.rows.income"),
        expenses: tr("dashboard.shareModal.exports.summarySheet.rows.expenses"),
        transfers: tr("dashboard.shareModal.exports.summarySheet.rows.transfers"),
        balance: tr("dashboard.shareModal.exports.summarySheet.rows.balance"),
      },
    },
    sheets: {
      incomeTop: tr("dashboard.shareModal.exports.sheets.incomeTop"),
      expensesTop: tr("dashboard.shareModal.exports.sheets.expensesTop"),
      transfersTop: tr("dashboard.shareModal.exports.sheets.transfersTop"),
      incomeComplete: tr("dashboard.shareModal.exports.sheets.incomeComplete"),
      expensesComplete: tr("dashboard.shareModal.exports.sheets.expensesComplete"),
      transfersComplete: tr("dashboard.shareModal.exports.sheets.transfersComplete"),
    },
    columns: {
      id: tr("dashboard.shareModal.exports.columns.id"),
      name: tr("dashboard.shareModal.exports.columns.name"),
      amount: tr("dashboard.shareModal.exports.columns.amount"),
      percentage: tr("dashboard.shareModal.exports.columns.percentage"),
      operations: tr("dashboard.shareModal.exports.columns.operations"),
    },
    excelFileName: (p: { organizationSlug: string; date: string }) => tri("dashboard.shareModal.exports.excelFileName", p),
    csvFileNames: {
      income: (p: { organizationSlug: string; date: string }) => tri("dashboard.shareModal.exports.csvFileNames.income", p),
      expenses: (p: { organizationSlug: string; date: string }) => tri("dashboard.shareModal.exports.csvFileNames.expenses", p),
      transfers: (p: { organizationSlug: string; date: string }) => tri("dashboard.shareModal.exports.csvFileNames.transfers", p),
    },
  }), [tr, tri]);
  const { buildUrl } = useOrgUrl();

  // ═══════════════════════════════════════════════════════════════════════════════
  // ONBOARDING: Modal de benvinguda per primer admin
  // ═══════════════════════════════════════════════════════════════════════════════

  // Carregar membres per detectar primer admin
  const membersQuery = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'members') : null,
    [firestore, organizationId]
  );
  const { data: members } = useCollection<OrganizationMember>(membersQuery);

  // Estat de les modals
  const [showWelcomeModal, setShowWelcomeModal] = React.useState(false);
  const [showWizardModal, setShowWizardModal] = React.useState(false);
  // Botó de sessió: només visible si ha declinat la welcome modal en aquesta sessió
  const [showSessionButton, setShowSessionButton] = React.useState(false);

  // Detectar si cal mostrar la welcome modal
  const shouldShowWelcome = React.useMemo(
    () => shouldShowWelcomeModal(organization, user?.uid, members),
    [organization, user?.uid, members]
  );

  // Detectar si és el primer admin (per al botó de sessió)
  const isUserFirstAdmin = React.useMemo(
    () => isFirstAdmin(user?.uid, members),
    [user?.uid, members]
  );

  // Llegir estat del wizard des de Firestore
  const wizardStatus = (organization?.onboarding as any)?.wizard?.status as string | undefined;

  // Ref per evitar bucles de reobrir
  const hasCheckedWizard = React.useRef(false);

  // Obrir la welcome modal automàticament si cal
  // O reobrir el wizard si status === 'in_progress'
  React.useEffect(() => {
    // Evitar múltiples checks
    if (hasCheckedWizard.current) return;

    // Si wizard.status === 'completed', no fer res
    if (wizardStatus === 'completed') {
      hasCheckedWizard.current = true;
      return;
    }

    // Si wizard.status === 'in_progress' i el modal no està obert, reobrir
    if (wizardStatus === 'in_progress' && !showWizardModal) {
      hasCheckedWizard.current = true;
      setShowWizardModal(true);
      return;
    }

    // Si cal mostrar welcome i no està obert cap modal
    if (shouldShowWelcome && !showWelcomeModal && !showWizardModal) {
      hasCheckedWizard.current = true;
      setShowWelcomeModal(true);
    }
  }, [shouldShowWelcome, showWelcomeModal, showWizardModal, wizardStatus]);

  // Gestionar "Guia'm" des de la welcome modal
  const handleStartGuide = () => {
    setShowWizardModal(true);
    setShowSessionButton(false);
  };

  // Gestionar "Començar pel meu compte" des de la welcome modal
  const handleSkipWelcome = () => {
    setShowSessionButton(true);
  };

  const transactionsQuery = useMemoFirebase(
    () => canViewFinancial && organizationId ? collection(firestore, 'organizations', organizationId, 'transactions') : null,
    [canViewFinancial, firestore, organizationId]
  );
  const { data: transactions } = useCollection<Transaction>(transactionsQuery);

  const contactsQuery = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'contacts') : null,
    [firestore, organizationId]
  );
  const { data: contacts } = useCollection<Contact>(contactsQuery);

  const projectsQuery = useMemoFirebase(
    () => canViewFinancial && organizationId ? collection(firestore, 'organizations', organizationId, 'projects') : null,
    [canViewFinancial, firestore, organizationId]
  );
  const { data: projects } = useCollection<Project>(projectsQuery);

  const categoriesQuery = useMemoFirebase(
    () => canViewFinancial && organizationId ? collection(firestore, 'organizations', organizationId, 'categories') : null,
    [canViewFinancial, firestore, organizationId]
  );
  const { data: categories } = useCollection<Category>(categoriesQuery);
  const [isMarkingFiscalAlertRead, setIsMarkingFiscalAlertRead] = React.useState(false);
  const canReadFiscalAlerts = canViewFinancial
    && !isOrganizationLoading
    && !!organizationId
    && userRole === 'admin'
    && member?.role === 'admin';

  const fiscalAlertsQuery = useMemoFirebase(
    () => {
      if (!canReadFiscalAlerts || !organizationId) return null;
      return query(
        collection(firestore, 'organizations', organizationId, 'adminAlerts'),
        where('type', '==', FISCAL_PENDING_REVIEW_ALERT_TYPE),
        where('status', '==', 'open')
      );
    },
    [canReadFiscalAlerts, firestore, organizationId]
  );
  const { data: fiscalAlerts } = useCollection<DashboardAdminAlert>(
    fiscalAlertsQuery,
    [],
    { ignorePermissionDenied: true }
  );
  const [dateFilter, setDateFilter] = React.useState<DateFilterValue>({ type: 'all' });
  const periodQuery = React.useMemo(() => toPeriodQuery(dateFilter), [dateFilter]);
  const [dashboardSummary, setDashboardSummary] = React.useState<DashboardSummaryResponse | null>(null);
  const [isDashboardSummaryLoading, setIsDashboardSummaryLoading] = React.useState(false);
  const dateFilteredTransactions = useTransactionFilters(transactions || undefined, dateFilter);

  // Base dataset: exclou transaccions arxivades (soft-deleted)
  // Tots els KPIs i agregats han de partir d'aquest conjunt
  const baseTransactions = React.useMemo(
    () => (dateFilteredTransactions || []).filter(tx => tx.archivedAt == null),
    [dateFilteredTransactions]
  );

  // Predicate: moviment bancari real (ledger)
  // Exclou desglossaments interns encara que no tinguin parentTransactionId
  const isBankLedgerTx = React.useCallback((tx: Transaction) => {
    // 1) No sumar mai desglossaments amb parent
    if (tx.parentTransactionId) return false;
    // 2) Visibilitat remeses/arxivades amb helper compartit de Moviments
    if (!isVisibleInMovementsLedger(tx, { showArchived: false })) return false;
    // 3) No sumar mai transaccions internes Stripe (donacions i comissions desglossades)
    if (tx.transactionType === 'donation') return false;
    if (tx.transactionType === 'fee') return false;
    // 4) Devolucions bancàries reals SÍ compten (transactionType === 'return')
    return true;
  }, []);

  // KPIs econòmics: només transaccions que representen el ledger bancari real
  // (per Ingressos, Despeses, Balance)
  const filteredTransactions = React.useMemo(() => {
    if (!canViewFinancial) return [];
    if (baseTransactions.length === 0) return [];
    const ledgerTxs = baseTransactions.filter(isBankLedgerTx);

    // DEV-only: validar que el ledger no conté transaccions que haurien de ser excloses
    if (process.env.NODE_ENV === 'development' && ledgerTxs.length > 0) {
      const invalidRemittance = ledgerTxs.filter(tx => !isVisibleInMovementsLedger(tx, { showArchived: false }));
      const invalidChildren = ledgerTxs.filter(tx => tx.parentTransactionId);
      if (invalidRemittance.length > 0 || invalidChildren.length > 0) {
        console.warn('[Dashboard] LEDGER CONTAMINATION DETECTED:', {
          remittanceItems: invalidRemittance.length,
          childTransactions: invalidChildren.length,
          total: ledgerTxs.length,
        });
      }
    }

    return ledgerTxs;
  }, [baseTransactions, canViewFinancial, isBankLedgerTx]);

  // Detectar categories legacy (docIds en lloc de nameKeys) - només log a consola
  React.useEffect(() => {
    if (!canViewFinancial) return;
    if (!filteredTransactions || filteredTransactions.length === 0 || !organizationId) return;
    const legacyTxs = detectLegacyCategoryTransactions(filteredTransactions);
    if (legacyTxs.length > 0) {
      logLegacyCategorySummary(organizationId, legacyTxs);
    }
  }, [canViewFinancial, filteredTransactions, organizationId]);

  // KPIs socials: transaccions amb contacte (incloent fills de remesa)
  // (per Donants actius, Socis actius, Quotes)
  // Aquí SÍ usem fills perquè són l'única manera de saber quin contacte ha pagat
  const socialMetricsTxs = React.useMemo(() => {
    if (baseTransactions.length === 0) return [];
    // Incloure totes les transaccions positives amb contactId
    // (fills de remesa tenen contactId, pares de remesa no)
    const socialTxs = baseTransactions.filter(tx =>
      tx.amount > 0 &&
      tx.contactId &&
      tx.contactType === 'donor'
    );

    // DEV-only: log per debugging
    if (process.env.NODE_ENV === 'development' && socialTxs.length > 0) {
      const withParent = socialTxs.filter(tx => tx.parentTransactionId);
      console.debug('[Dashboard] Social metrics:', {
        total: socialTxs.length,
        withParent: withParent.length,
        uniqueContacts: new Set(socialTxs.map(tx => tx.contactId)).size,
      });
    }

    return socialTxs;
  }, [baseTransactions]);

  React.useEffect(() => {
    if (!canViewFinancial || !organizationId || !user) {
      setDashboardSummary(null);
      setIsDashboardSummaryLoading(false);
      return;
    }

    const controller = new AbortController();

    const loadDashboardSummary = async () => {
      setIsDashboardSummaryLoading(true);
      try {
        const idToken = await user.getIdToken();
        const params = new URLSearchParams({
          orgId: organizationId,
          ...periodQuery,
        });
        const response = await fetch(`/api/dashboard/summary?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`dashboard summary request failed: ${response.status}`);
        }

        const payload = (await response.json()) as DashboardSummaryResponse;
        if (!controller.signal.aborted) {
          setDashboardSummary(payload);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('[dashboard] summary load error:', error);
          setDashboardSummary(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsDashboardSummaryLoading(false);
        }
      }
    };

    void loadDashboardSummary();

    return () => controller.abort();
  }, [canViewFinancial, organizationId, periodQuery, user]);

  const missionTransferCategoryId = React.useMemo(
    () => (canViewFinancial && categories ? findSystemCategoryId(categories, 'missionTransfers') : null),
    [canViewFinancial, categories]
  );
  const incomeAggregates = React.useMemo(
    () => {
      if (!canViewFinancial) return EMPTY_AGGREGATE;
      return (
      aggregateIncomeByCategory({
        transactions: filteredTransactions,
        categories,
        topN: 3,
        labels: shareModalTexts.labels,
      })
      );
    },
    [canViewFinancial, filteredTransactions, categories, shareModalTexts]
  );
  const expenseAggregates = React.useMemo(
    () => {
      if (!canViewFinancial) return EMPTY_AGGREGATE;
      return (
      aggregateOperationalExpensesByProject({
        transactions: filteredTransactions,
        projects,
        topN: 3,
        missionKey: missionTransferCategoryId ?? '',
        labels: shareModalTexts.labels,
      })
      );
    },
    [canViewFinancial, filteredTransactions, projects, shareModalTexts, missionTransferCategoryId]
  );
  const transferAggregates = React.useMemo(
    () => {
      if (!canViewFinancial) return EMPTY_AGGREGATE;
      return (
      aggregateMissionTransfersByContact({
        transactions: filteredTransactions,
        contacts,
        topN: 3,
        missionKey: missionTransferCategoryId ?? '',
        labels: shareModalTexts.labels,
      })
      );
    },
    [canViewFinancial, filteredTransactions, contacts, shareModalTexts, missionTransferCategoryId]
  );
  const totalIncome = canViewFinancial ? dashboardSummary?.income ?? 0 : 0;
  const totalExpenses = canViewFinancial ? dashboardSummary?.expense ?? 0 : 0;
  const totalMissionTransfers = canViewFinancial ? dashboardSummary?.missionTransfers ?? 0 : 0;

  const expenseTransactions = React.useMemo(
    () => (canViewFinancial ? filteredTransactions?.filter((tx) => tx.amount < 0 && tx.category !== missionTransferCategoryId) || [] : []),
    [canViewFinancial, filteredTransactions, missionTransferCategoryId]
  );
  // Saldo = Ingressos + Despeses + Terreny (tots tres ja amb signe: despeses i terreny són negatius)
  const netBalance = canViewFinancial ? dashboardSummary?.balance ?? 0 : 0;
  // Estat per compartir resum
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false);
  const [summaryText, setSummaryText] = React.useState('');
  const [copySuccess, setCopySuccess] = React.useState(false);
  const [narratives, setNarratives] = React.useState<NarrativeDraft | null>(null);
  const [defaultNarratives, setDefaultNarratives] = React.useState<NarrativeDraft | null>(null);
  const [editingField, setEditingField] = React.useState<keyof NarrativeDraft | null>(null);
  const [editingValue, setEditingValue] = React.useState('');
  const [isNarrativeEditorOpen, setNarrativeEditorOpen] = React.useState(false);
  const isMobile = useIsMobile();
  const createMovementsLink = React.useCallback(
    (filter: string) => {
      const params = new URLSearchParams({ filter, ...periodQuery });
      return buildUrl(`/dashboard/movimientos?${params.toString()}`);
    },
    [buildUrl, periodQuery],
  );
  const createDonorsLink = React.useCallback(
    (options?: { membershipType?: 'one-time' | 'recurring'; viewActive?: boolean }) => {
      const params = new URLSearchParams();
      if (options?.viewActive) {
        params.set('view', 'active');
        Object.entries(periodQuery).forEach(([k, v]) => params.set(k, v));
      }
      if (options?.membershipType) {
        params.set('membershipType', options.membershipType);
      }
      const query = params.toString();
      return buildUrl(`/dashboard/donants${query ? `?${query}` : ''}`);
    },
    [buildUrl, periodQuery],
  );
  const fiscalPendingMovementsUrl = React.useMemo(
    () => {
      const currentYear = new Date().getFullYear();
      return buildUrl(`/dashboard/movimientos?fiscal=pending&year=${currentYear}`);
    },
    [buildUrl]
  );

  const activeFiscalPendingAlert = React.useMemo(() => {
    if (!fiscalAlerts || userRole !== 'admin') return null;

    const now = new Date();
    const candidates = fiscalAlerts
      .filter((alert) => {
        if (alert.type !== FISCAL_PENDING_REVIEW_ALERT_TYPE) return false;
        if (alert.status !== 'open') return false;
        const expiresAt = toDateFromFirestoreValue(alert.expiresAt);
        if (!expiresAt) return false;
        return expiresAt.getTime() > now.getTime();
      })
      .sort((a, b) => {
        const aTime = toDateFromFirestoreValue(a.createdAt)?.getTime() ?? 0;
        const bTime = toDateFromFirestoreValue(b.createdAt)?.getTime() ?? 0;
        return bTime - aTime;
      });

    return candidates[0] ?? null;
  }, [fiscalAlerts, userRole]);

  const handleMarkFiscalPendingAlertRead = React.useCallback(async () => {
    if (!organizationId || !user || !activeFiscalPendingAlert?.id) return;

    setIsMarkingFiscalAlertRead(true);
    try {
      const idToken = await user.getIdToken();
      await fetch('/api/admin-alerts/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          orgId: organizationId,
          alertId: activeFiscalPendingAlert.id,
        }),
      });
    } catch (error) {
      console.error('[dashboard] mark fiscal alert read error:', error);
    } finally {
      setIsMarkingFiscalAlertRead(false);
    }
  }, [activeFiscalPendingAlert?.id, organizationId, user]);

  const fiscalPendingAlertBody = React.useMemo(() => {
    if (!activeFiscalPendingAlert) return '';

    const pendingCount = Number(activeFiscalPendingAlert.payload?.pendingCount ?? 0);
    const pendingAmountCents = Number(activeFiscalPendingAlert.payload?.pendingAmountCents ?? 0);
    const year = Number(activeFiscalPendingAlert.payload?.year ?? new Date().getFullYear());

    return tri('dashboard.alerts.fiscalPending.body', {
      count: pendingCount,
      amount: formatCurrencyEU(pendingAmountCents / 100),
      year,
    });
  }, [activeFiscalPendingAlert, tri]);

  // Ref per gestionar timeout i evitar memory leaks
  const copyTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout quan component es desmunta
  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);
  React.useEffect(() => {
    if (!shareDialogOpen) {
      setNarrativeEditorOpen(false);
      setEditingField(null);
    }
  }, [shareDialogOpen]);
  React.useEffect(() => {
    if (!canViewFinancial && shareDialogOpen) {
      setShareDialogOpen(false);
    }
  }, [canViewFinancial, shareDialogOpen]);

  // Funció per formatejar el període del filtre
  const formatPeriodLabel = (filter: DateFilterValue): string => {
    const monthKeyOrder: (keyof typeof t.months)[] = [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december',
    ];
    const formatMonthName = (monthIndex: number) => {
      const key = monthKeyOrder[monthIndex];
      if (!key) return '';
      const monthLabel = t.months[key];
      return monthLabel ? monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1) : '';
    };
    if (filter.type === 'all') return tr("dashboard.allPeriods");
    if (filter.type === 'year' && filter.year) return `${tr("dashboard.filterYear")} ${filter.year}`;
    if (filter.type === 'month' && filter.year && filter.month) {
      const monthName = formatMonthName(filter.month - 1);
      return `${monthName} ${filter.year}`.trim();
    }
    if (filter.type === 'quarter' && filter.year && filter.quarter) {
      return tri("dashboard.periodLabels.quarter", { quarter: filter.quarter, year: filter.year });
    }
    if (filter.type === 'custom' && filter.customRange?.from && filter.customRange?.to) {
      const formatter = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
      const start = formatter.format(filter.customRange.from);
      const end = formatter.format(filter.customRange.to);
      return tri("dashboard.periodLabels.customRange", { start, end });
    }
    return tr("dashboard.allPeriods");
  };
  const periodLabel = formatPeriodLabel(dateFilter);
  const organizationName = organization?.name || shareModalTexts.summaryFallbackOrg;
  const summaryOrgPeriodText = shareModalTexts.summaryOrgPeriod({ organization: organizationName, period: periodLabel });
  const summaryHeaderText = shareModalTexts.summaryHeader({ organization: organizationName, period: periodLabel });
  const emailSubjectText = shareModalTexts.emailSubject({ organization: organizationName });

  // Funció per generar el text de resum
  const generateSummaryText = (): string => {
    const orgName = organizationName;
    const period = periodLabel;

    // Comparativa amb any anterior
    const donorsComparison = canShowComparison
      ? ` (${prevUniqueDonors} ${tr("dashboard.vsPreviousYear")})`
      : '';
    const donationsComparison = canShowComparison
      ? ` (${formatCurrencyEU(prevTotalDonations)} ${tr("dashboard.vsPreviousYear")})`
      : '';
    const membersComparison = canShowComparison
      ? ` (${prevActiveMembers} ${tr("dashboard.vsPreviousYear")})`
      : '';
    const feesComparison = canShowComparison
      ? ` (${formatCurrencyEU(prevMemberFees)} ${tr("dashboard.vsPreviousYear")})`
      : '';

    return `${summaryHeaderText}

💰 ${tr("dashboard.totalIncome")}: ${formatCurrencyEU(totalIncome)}
💸 ${tr("dashboard.operatingExpenses")}: ${formatCurrencyEU(Math.abs(totalExpenses))}
📈 ${tr("dashboard.operatingBalance")}: ${formatCurrencyEU(netBalance)}

❤️ ${tr("dashboard.activeDonors")}: ${uniqueDonors}${donorsComparison}
🎁 ${tr("dashboard.donations")}: ${formatCurrencyEU(totalDonations)}${donationsComparison}
👥 ${tr("dashboard.activeMembers")}: ${activeMembers}${membersComparison}
💳 ${tr("dashboard.memberFees")}: ${formatCurrencyEU(memberFees)}${feesComparison}

${tr("dashboard.generatedWith")}`;
  };

  // Funció per copiar al portapapers
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopySuccess(true);
      // Netejar timeout anterior si existeix
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  };

  // Funció per enviar per email
  const handleEmailShare = () => {
    const subject = encodeURIComponent(emailSubjectText);
    const body = encodeURIComponent(summaryText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // Funció per obrir el diàleg
  const handleShareClick = () => {
    if (!canViewFinancial) return;
    const text = generateSummaryText();
    const periodLabel = formatPeriodLabel(dateFilter);
    const baseNarratives = buildNarrativesFromAggregates({
      periodLabel,
      income: incomeAggregates,
      expenses: expenseAggregates,
      transfers: transferAggregates,
      netBalance,
      texts: shareModalTexts.narratives,
      labels: shareModalTexts.labels,
    });
    setSummaryText(text);
    setNarratives(baseNarratives);
    setDefaultNarratives(baseNarratives);
    setEditingField(null);
    setEditingValue('');
    setNarrativeEditorOpen(false);
    setShareDialogOpen(true);
  };

  const openNarrativeEditor = (field: keyof NarrativeDraft) => {
    if (!narratives) return;
    setEditingField(field);
    setEditingValue(narratives[field]);
    setNarrativeEditorOpen(true);
  };

  const handleNarrativeSave = () => {
    if (!narratives || !editingField) {
      setNarrativeEditorOpen(false);
      setEditingField(null);
      return;
    }
    setNarratives({ ...narratives, [editingField]: editingValue });
    setNarrativeEditorOpen(false);
    setEditingField(null);
  };

  const handleNarrativeCancel = () => {
    setNarrativeEditorOpen(false);
    setEditingField(null);
  };

  const handleResetNarratives = () => {
    if (defaultNarratives) {
      setNarratives(defaultNarratives);
      setEditingField(null);
      setEditingValue('');
      setNarrativeEditorOpen(false);
    }
  };

  const handleCopyNarrative = async (field: keyof NarrativeDraft) => {
    if (!narratives) return;
    try {
      await navigator.clipboard.writeText(narratives[field]);
    } catch (err) {
      console.error('Error copying narrative:', err);
    }
  };

  const formatAggregateSheetRows = (rows: AggregateRow[]) => {
    const columns = shareModalExports.columns;
    return rows.map((row) => ({
      [columns.id]: row.id,
      [columns.name]: row.name,
      [columns.amount]: Number(row.amount.toFixed(2)),
      [columns.percentage]: Number(row.percentage.toFixed(2)),
      [columns.operations]: row.count,
    }));
  };

  const handleExportEconomicExcel = () => {
    if (!canViewFinancial) return;
    const workbook = XLSX.utils.book_new();
    const periodLabel = formatPeriodLabel(dateFilter);
    const summarySheetTexts = shareModalExports.summarySheet;
    const summarySheet = XLSX.utils.json_to_sheet([
      {
        [summarySheetTexts.columns.indicator]: summarySheetTexts.rows.period,
        [summarySheetTexts.columns.value]: periodLabel,
      },
      {
        [summarySheetTexts.columns.indicator]: summarySheetTexts.rows.income,
        [summarySheetTexts.columns.value]: Number(incomeAggregates.total.toFixed(2)),
      },
      {
        [summarySheetTexts.columns.indicator]: summarySheetTexts.rows.expenses,
        [summarySheetTexts.columns.value]: Number(expenseAggregates.total.toFixed(2)),
      },
      {
        [summarySheetTexts.columns.indicator]: summarySheetTexts.rows.transfers,
        [summarySheetTexts.columns.value]: Number(transferAggregates.total.toFixed(2)),
      },
      {
        [summarySheetTexts.columns.indicator]: summarySheetTexts.rows.balance,
        [summarySheetTexts.columns.value]: Number(netBalance.toFixed(2)),
      },
    ]);

    const appendSheet = (title: string, rows: AggregateRow[]) => {
      const sheet = XLSX.utils.json_to_sheet(formatAggregateSheetRows(rows));
      XLSX.utils.book_append_sheet(workbook, sheet, title);
    };

    XLSX.utils.book_append_sheet(workbook, summarySheet, summarySheetTexts.name);
    const sheetNames = shareModalExports.sheets;
    appendSheet(sheetNames.incomeTop, incomeAggregates.aggregated);
    appendSheet(sheetNames.expensesTop, expenseAggregates.aggregated);
    appendSheet(sheetNames.transfersTop, transferAggregates.aggregated);
    appendSheet(sheetNames.incomeComplete, incomeAggregates.complete);
    appendSheet(sheetNames.expensesComplete, expenseAggregates.complete);
    appendSheet(sheetNames.transfersComplete, transferAggregates.complete);

    const dateStamp = new Date().toISOString().split('T')[0];
    const organizationSlug = organization?.slug || 'org';
    const excelFileName = shareModalExports.excelFileName({ organizationSlug, date: dateStamp });
    XLSX.writeFile(workbook, excelFileName);
  };

  const downloadCsv = (rows: AggregateRow[], filename: string) => {
    const columns = shareModalExports.columns;
    const data = rows.map((row) => [
      row.id,
      row.name,
      Number(row.amount.toFixed(2)),
      Number(row.percentage.toFixed(2)),
      row.count,
    ]);
    const csv = Papa.unparse({
      fields: [columns.id, columns.name, columns.amount, columns.percentage, columns.operations],
      data,
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportEconomicCsv = () => {
    if (!canViewFinancial) return;
    const dateStamp = new Date().toISOString().split('T')[0];
    const organizationSlug = organization?.slug || 'org';
    const csvFiles = shareModalExports.csvFileNames;
    downloadCsv(incomeAggregates.complete, csvFiles.income({ organizationSlug, date: dateStamp }));
    downloadCsv(expenseAggregates.complete, csvFiles.expenses({ organizationSlug, date: dateStamp }));
    downloadCsv(transferAggregates.complete, csvFiles.transfers({ organizationSlug, date: dateStamp }));
  };

  // Map de contactes per ID amb el seu membershipType
  const contactMembershipMap = React.useMemo(() => {
    if (!contacts) return new Map<string, 'one-time' | 'recurring'>();
    return new Map(
      contacts
        .filter((c): c is Donor => c.type === 'donor')
        .map(c => [c.id, c.membershipType || 'one-time'])
    );
  }, [contacts]);

  // Determinar si es pot mostrar comparativa amb any anterior
  const canShowComparison = dateFilter.type === 'year' || dateFilter.type === 'quarter' || dateFilter.type === 'month';
  const previousYear = (dateFilter.year || new Date().getFullYear()) - 1;

  // Funció per obtenir transaccions socials del període anterior (per comparativa)
  // Usa el mateix criteri que socialMetricsTxs: ingressos amb contactId
  const getPreviousPeriodSocialTxs = React.useCallback(() => {
    if (!transactions || !canShowComparison) return [];
    return transactions.filter(tx => {
      // Primer: criteri social (igual que socialMetricsTxs)
      if (tx.amount <= 0 || !tx.contactId || tx.contactType !== 'donor') return false;

      // Després: criteri de període anterior
      const txDate = new Date(tx.date);
      const txYear = txDate.getFullYear();

      if (dateFilter.type === 'year') {
        return txYear === previousYear;
      }
      if (dateFilter.type === 'quarter' && dateFilter.quarter) {
        const txMonth = txDate.getMonth() + 1;
        const qStart = (dateFilter.quarter - 1) * 3 + 1;
        const qEnd = dateFilter.quarter * 3;
        return txYear === previousYear && txMonth >= qStart && txMonth <= qEnd;
      }
      if (dateFilter.type === 'month' && dateFilter.month) {
        return txYear === previousYear && txDate.getMonth() + 1 === dateFilter.month;
      }
      return false;
    });
  }, [transactions, canShowComparison, dateFilter, previousYear]);

  // Funció per calcular mètriques de donants i socis
  const calculateDonorMetrics = React.useCallback((txs: Transaction[]) => {
    const donorIds = new Set<string>();
    const memberIds = new Set<string>();
    let donations = 0;
    let memberFees = 0;

    txs.forEach(tx => {
      if (tx.amount > 0 && tx.contactType === 'donor' && tx.contactId) {
        const membershipType = contactMembershipMap.get(tx.contactId) || 'one-time';

        if (membershipType === 'recurring') {
          memberIds.add(tx.contactId);
          memberFees += tx.amount;
        } else {
          donorIds.add(tx.contactId);
          donations += tx.amount;
        }
      }
    });

    return {
      totalDonations: donations,
      uniqueDonors: donorIds.size,
      memberFees,
      activeMembers: memberIds.size
    };
  }, [contactMembershipMap]);

  // Mètriques del període actual (usa socialMetricsTxs, no filteredTransactions)
  // Perquè els fills de remesa tenen contactId, els pares no
  const currentMetrics = React.useMemo(() => {
    if (!socialMetricsTxs) return { totalDonations: 0, uniqueDonors: 0, memberFees: 0, activeMembers: 0 };
    return calculateDonorMetrics(socialMetricsTxs);
  }, [socialMetricsTxs, calculateDonorMetrics]);

  // Mètriques del període anterior (per comparativa)
  const previousMetrics = React.useMemo(() => {
    if (!canShowComparison) return { totalDonations: 0, uniqueDonors: 0, memberFees: 0, activeMembers: 0 };
    return calculateDonorMetrics(getPreviousPeriodSocialTxs());
  }, [canShowComparison, getPreviousPeriodSocialTxs, calculateDonorMetrics]);

  const { totalDonations, uniqueDonors, memberFees, activeMembers } = currentMetrics;
  const {
    totalDonations: prevTotalDonations,
    uniqueDonors: prevUniqueDonors,
    memberFees: prevMemberFees,
    activeMembers: prevActiveMembers
  } = previousMetrics;
  const relationalSupportersMetrics = React.useMemo(() => {
    if (!contacts) return { activeMembers: 0, activeDonors: 0 };

    let activeMembersCount = 0;
    let activeDonorsCount = 0;

    contacts.forEach((contact) => {
      if (contact.type !== 'donor') return;
      if (contact.archivedAt) return;

      const donor = contact as Donor;
      if (donor.status === 'inactive') return;

      if (donor.membershipType === 'recurring') {
        activeMembersCount += 1;
        return;
      }

      activeDonorsCount += 1;
    });

    return {
      activeMembers: activeMembersCount,
      activeDonors: activeDonorsCount,
    };
  }, [contacts]);

  // Càlcul d'"Altres ingressos" (residual per reconciliar dashboard amb extracte)
  // = Ingressos totals - Quotes - Donacions puntuals
  const otherIncomeEUR = React.useMemo(() => {
    if (!canViewFinancial) return 0;
    const residual = totalIncome - memberFees - totalDonations;
    // DEV-only: validar que la reconciliació quadra
    if (process.env.NODE_ENV === 'development') {
      const recon = totalIncome - memberFees - totalDonations - Math.max(0, residual);
      if (Math.abs(recon) > 0.01) {
        console.warn('[Dashboard] Income reconciliation diff', recon);
      }
    }
    return Math.max(0, residual);
  }, [canViewFinancial, totalIncome, memberFees, totalDonations]);

  // Càlcul de despeses per projecte
  const expensesByProject = React.useMemo(() => {
    if (!canViewFinancial) return [];
    if (!filteredTransactions) return [];

    // Crear mapa de projectes per ID
    const projectMap = new Map<string | null, { name: string; total: number }>();

    // Procesar totes les despeses (excloses transferències de missió)
    filteredTransactions.forEach(tx => {
      if (tx.amount < 0 && tx.category !== missionTransferCategoryId) {
        const projectId = tx.projectId || null;
        const current = projectMap.get(projectId) || { name: '', total: 0 };
        current.total += Math.abs(tx.amount);
        projectMap.set(projectId, current);
      }
    });

    // Assignar noms de projectes
    projectMap.forEach((value, key) => {
      if (key === null) {
        value.name = tr("dashboard.unassigned");
      } else {
        const project = projects?.find(p => p.id === key);
        value.name = project?.name || tr("dashboard.unassigned");
      }
    });

    // Calcular total i percentatges
    const total = Array.from(projectMap.values()).reduce((sum, p) => sum + p.total, 0);

    const result = Array.from(projectMap.entries()).map(([projectId, data]) => ({
      projectId,
      projectName: data.name,
      totalExpense: data.total,
      percentage: total > 0 ? (data.total / total) * 100 : 0,
    }));

    // Ordenar: primer per import descendent, però "Sense assignar" sempre al final
    return result.sort((a, b) => {
      // "Sense assignar" (projectId === null) sempre al final
      if (a.projectId === null && b.projectId !== null) return 1;
      if (a.projectId !== null && b.projectId === null) return -1;
      // La resta ordenats per import descendent
      return b.totalExpense - a.totalExpense;
    });
  }, [canViewFinancial, filteredTransactions, projects, tr]);

  const totalProjectExpenses = React.useMemo(() => {
    return expensesByProject.reduce((sum, p) => sum + p.totalExpense, 0);
  }, [expensesByProject]);

  // Total de despesa assignada a projectes (excloent "Sense assignar")
  const totalAssignedProjectExpenses = React.useMemo(() => {
    return expensesByProject
      .filter(p => p.projectId !== null)
      .reduce((sum, p) => sum + p.totalExpense, 0);
  }, [expensesByProject]);

  // Top 5 projectes assignats + "Altres" (només projectes reals, sense "Sense assignar")
  const topAssignedProjects = React.useMemo(() => {
    if (!canViewFinancial) return [];
    // Filtrar només projectes assignats (excloure projectId === null)
    const assigned = expensesByProject.filter(p => p.projectId !== null);
    if (assigned.length === 0 || totalAssignedProjectExpenses === 0) return [];

    // Ordenar per import descendent
    const sorted = [...assigned].sort((a, b) => b.totalExpense - a.totalExpense);

    // Top 5
    const top5 = sorted.slice(0, 5);
    const restAmount = sorted.slice(5).reduce((sum, p) => sum + p.totalExpense, 0);

    // Recalcular percentatges sobre total assignat
    const result = top5.map(p => ({
      ...p,
      percentage: (p.totalExpense / totalAssignedProjectExpenses) * 100,
    }));

    // Afegir "Altres" si cal
    if (restAmount > 0) {
      result.push({
        projectId: '_others',
        projectName: tr("dashboard.topCategoriesOthers"),
        totalExpense: restAmount,
        percentage: (restAmount / totalAssignedProjectExpenses) * 100,
      });
    }

    return result;
  }, [canViewFinancial, expensesByProject, totalAssignedProjectExpenses, tr]);

  // Condicions per mostrar el bloc de "Despesa per Eix"
  const hasProjectModule = organization?.features?.projectModule === true;
  const hasActiveProjects = (projects?.length ?? 0) > 0;
  const totalExpensesAbs = Math.abs(totalExpenses);
  const assignedExpensesRatio = totalExpensesAbs > 0 ? totalAssignedProjectExpenses / totalExpensesAbs : 0;
  const shouldShowProjectExpenses =
    canViewFinancial &&
    canAccessProjectsArea &&
    hasProjectModule &&
    hasActiveProjects &&
    totalAssignedProjectExpenses > 0 &&
    assignedExpensesRatio > 0.05;

  // Càlcul d'alertes
  const alerts = React.useMemo(() => {
    const result = [];

    // 🔴 Moviments sense categoritzar
    const uncategorizedCount = filteredTransactions?.filter(tx =>
      tx.category === null || tx.category === 'Revisar'
    ).length || 0;

    if (uncategorizedCount > 0) {
      result.push({
        type: 'uncategorized' as const,
        count: uncategorizedCount,
        label: tr("dashboard.uncategorizedMovements"),
        variant: 'destructive' as const,
        href: buildUrl('/dashboard/movimientos') + '?filter=uncategorized',
      });
    }

    // 🟠 Donants amb dades incompletes
    const incompleteDonorsCount = contacts?.filter(contact =>
      contact.type === 'donor' && (!contact.taxId || !contact.zipCode)
    ).length || 0;

    if (incompleteDonorsCount > 0) {
      result.push({
        type: 'incomplete_donors' as const,
        count: incompleteDonorsCount,
        label: tr("dashboard.incompleteDonors"),
        variant: 'default' as const,
        href: buildUrl('/dashboard/donants') + '?filter=incomplete',
      });
    }

    // 🟡 Moviments sense contacte assignat
    const threshold = organization?.contactAlertThreshold ?? 50;
    const noContactCount = filteredTransactions?.filter(tx =>
      !tx.contactId && Math.abs(tx.amount) > threshold
    ).length || 0;

    if (noContactCount > 0) {
      result.push({
        type: 'no_contact' as const,
        count: noContactCount,
        label: tr("dashboard.movementsWithoutContact"),
        variant: 'secondary' as const,
        href: buildUrl('/dashboard/movimientos') + '?filter=noContact',
        info: threshold > 0 ? tri("dashboard.onlyMovementsAbove", { amount: threshold }) : void 0,
      });
    }

    return result;
  }, [filteredTransactions, contacts, tr, tri, buildUrl, organization]);

  // Càlcul d'obligacions fiscals
  const taxObligations = React.useMemo(() => {
    if (!canViewFinancial) return [];
    const today = new Date();
    const currentYear = today.getFullYear();

    return TAX_OBLIGATIONS.map(obligation => {
      // Crear data límit per aquest any
      let deadline = new Date(currentYear, obligation.month - 1, obligation.day);

      // Si ja ha passat, usar l'any següent
      if (deadline < today) {
        deadline = new Date(currentYear + 1, obligation.month - 1, obligation.day);
      }

      // Calcular dies restants
      const daysRemaining = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Determinar estat visual
      let status: 'success' | 'warning' | 'destructive';
      if (daysRemaining > 60) status = 'success';
      else if (daysRemaining >= 30) status = 'warning';
      else status = 'destructive';

      return {
        ...obligation,
        deadline,
        daysRemaining,
        status
      };
    }).sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [canViewFinancial]);

  // Càlcul de celebracions
  const celebrations = React.useMemo(() => {
    const result: Celebration[] = [];

    // 1. Totes les transaccions categoritzades
    const uncategorizedCount = filteredTransactions?.filter(tx =>
      tx.category === null || tx.category === 'Revisar'
    ).length || 0;

    if (uncategorizedCount === 0 && filteredTransactions && filteredTransactions.length > 0) {
      result.push({
        id: 'all-categorized',
        emoji: '✅',
        messageKey: 'allCategorized',
        priority: 3
      });
    }

    // 2. Balanç positiu
    if (netBalance > 0) {
      result.push({
        id: 'positive-balance',
        emoji: '📈',
        messageKey: 'positiveBalance',
        priority: 2
      });
    }

    // 3. Més de 5 donants
    if (uniqueDonors > 5) {
      result.push({
        id: 'many-donors',
        emoji: '❤️',
        messageKey: 'manyDonors',
        messageParams: { count: uniqueDonors },
        priority: 1
      });
    }

    // 4. No hi ha alertes
    if (alerts.length === 0 && filteredTransactions && filteredTransactions.length > 0) {
      result.push({
        id: 'no-alerts',
        emoji: '🎯',
        messageKey: 'noAlerts',
        priority: 4
      });
    }

    // 5. Primera donació del mes (si el filtre inclou el mes actual)
    if (dateFilter.type === 'month' || dateFilter.type === 'all') {
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();

      const donationsThisMonth = filteredTransactions?.filter(tx => {
        const txDate = new Date(tx.date);
        return tx.amount > 0 &&
          tx.contactType === 'donor' &&
          txDate.getMonth() + 1 === currentMonth &&
          txDate.getFullYear() === currentYear;
      }).length || 0;

      if (donationsThisMonth > 0 && dateFilter.type === 'all') {
        result.push({
          id: 'first-donation-month',
          emoji: '🎁',
          messageKey: 'firstDonationMonth',
          priority: 2
        });
      }
    }

    // Ordenar per prioritat
    return result.sort((a, b) => a.priority - b.priority);
  }, [filteredTransactions, netBalance, uniqueDonors, alerts, dateFilter]);

  return (
    <div className="flex flex-col gap-6">
      {/* Modals d'onboarding */}
      <WelcomeOnboardingModal
        open={showWelcomeModal}
        onOpenChange={setShowWelcomeModal}
        onStartGuide={handleStartGuide}
        onSkip={handleSkipWelcome}
      />
      <OnboardingWizardModal
        open={showWizardModal}
        onOpenChange={setShowWizardModal}
      />

      {/* Capçalera amb botó de sessió opcional */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline">{tr("dashboard.title")}</h1>
          <p className="text-muted-foreground">{tr("dashboard.description")}</p>
        </div>
        {/* Botó "Configuració inicial" - només durant la sessió si ha declinat */}
        {showSessionButton && isUserFirstAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowWizardModal(true)}
            className="text-muted-foreground"
          >
            <Settings className="h-4 w-4 mr-2" />
            {t.onboarding?.welcome?.sessionButton ?? "Configuració inicial"}
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <DateFilter value={dateFilter} onChange={setDateFilter} />
        {canViewFinancial && (
          <Button variant="outline" onClick={handleShareClick}>
            <Share2 className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">{tr("dashboard.shareSummary")}</span>
          </Button>
        )}
      </div>

      {userRole === 'admin' && activeFiscalPendingAlert && (
        <Card className="border-amber-300 bg-amber-50/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{tr('dashboard.alerts.fiscalPending.title')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-amber-900">{fiscalPendingAlertBody}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={fiscalPendingMovementsUrl}>
                  {tr('dashboard.alerts.fiscalPending.ctaReview')}
                </Link>
              </Button>
              <Button
                size="sm"
                onClick={handleMarkFiscalPendingAlertRead}
                disabled={isMarkingFiscalAlertRead}
              >
                {isMarkingFiscalAlertRead && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                {tr('dashboard.alerts.fiscalPending.ctaMarkRead')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* OCULTAT TEMPORALMENT - Celebracions
      {celebrations.length > 0 && (
        <Card className="border-emerald-200/60 bg-emerald-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <PartyPopper className="h-4 w-4 text-emerald-600" />
              {tr("dashboard.celebrations")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {celebrations.slice(0, 3).map((celebration) => {
                const displayMessage = celebration.messageParams
                  ? tri(`dashboard.${celebration.messageKey}`, celebration.messageParams as Record<string, string | number>)
                  : tr(`dashboard.${celebration.messageKey}`);

                return (
                  <Badge
                    key={celebration.id}
                    variant="outline"
                    className="text-sm py-1 px-2.5 border-emerald-200 text-emerald-700 bg-emerald-50/50"
                  >
                    <span className="mr-1">{celebration.emoji}</span>
                    {displayMessage}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      */}

      {/* ═══════════════════════════════════════════════════════════════════════════════
          BLOC A — DINERS (veritat bancària, ledger)
          Dataset: filteredTransactions (només apunts del banc)
          ═══════════════════════════════════════════════════════════════════════════════ */}
      {canViewFinancial && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              {tr("dashboard.moneyBlock")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{tr("dashboard.moneyBlockDescription")}</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Link
                href={createMovementsLink('income')}
                className="block rounded-lg border p-4 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 active:scale-[0.99] cursor-pointer transition-colors"
              >
                <p className="text-sm text-muted-foreground">{tr("dashboard.totalIncome")}</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {isDashboardSummaryLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrencyEU(totalIncome)}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">{tr("dashboard.totalIncomeDescription")}</p>
              </Link>
              <Link
                href={createMovementsLink('operatingExpenses')}
                className="block rounded-lg border p-4 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 active:scale-[0.99] cursor-pointer transition-colors"
              >
                <p className="text-sm text-muted-foreground">{tr("dashboard.operatingExpenses")}</p>
                <p className="text-2xl font-bold text-rose-600">
                  {isDashboardSummaryLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrencyEU(totalExpenses)}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">{tr("dashboard.operatingExpensesDescription")}</p>
              </Link>
              <Link
                href={createMovementsLink('missionTransfers')}
                className="block rounded-lg border p-4 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 active:scale-[0.99] cursor-pointer transition-colors"
              >
                <p className="text-sm text-muted-foreground">{tr("dashboard.missionTransfers")}</p>
                <p className="text-2xl font-bold text-blue-600">
                  {isDashboardSummaryLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrencyEU(totalMissionTransfers)}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">{tr("dashboard.missionTransfersDescription")}</p>
              </Link>
              <div className="rounded-lg border p-4 bg-muted/20">
                <p className="text-sm text-muted-foreground">{tr("dashboard.operatingBalance")}</p>
                <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isDashboardSummaryLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrencyEU(netBalance)}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">{tr("dashboard.operatingBalanceDescription")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════════
          BLOC B — QUI ENS SOSTÉ (veritat relacional, per contacte)
          Dataset: socialMetricsTxs (transaccions amb contactId, inclou fills de remesa)
          ═══════════════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-muted-foreground" />
            {tr("dashboard.supportersBlock")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{tr("dashboard.supportersBlockDescription")}</p>
        </CardHeader>
        <CardContent>
          {canViewFinancial ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Link
                href={createMovementsLink('memberFees')}
                className="block rounded-lg border p-4 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 active:scale-[0.99] cursor-pointer transition-colors"
              >
                <p className="text-sm text-muted-foreground">{tr("dashboard.memberFees")}</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrencyEU(memberFees)}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{tr("dashboard.memberFeesDescription")}</p>
                {canShowComparison && (
                  <ComparisonBadge
                    current={memberFees}
                    previous={prevMemberFees}
                    previousYear={previousYear}
                    isCurrency
                    formatFn={formatCurrencyEU}
                    texts={{
                      equal: (p) => tri("dashboard.comparison.equal", p),
                      delta: (p) => tri("dashboard.comparison.delta", p),
                    }}
                  />
                )}
              </Link>
              <Link
                href={createMovementsLink('donations')}
                className="block rounded-lg border p-4 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 active:scale-[0.99] cursor-pointer transition-colors"
              >
                <p className="text-sm text-muted-foreground">{tr("dashboard.oneTimeDonations")}</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrencyEU(totalDonations)}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{tr("dashboard.oneTimeDonationsDescription")}</p>
                {canShowComparison && (
                  <ComparisonBadge
                    current={totalDonations}
                    previous={prevTotalDonations}
                    previousYear={previousYear}
                    isCurrency
                    formatFn={formatCurrencyEU}
                    texts={{
                      equal: (p) => tri("dashboard.comparison.equal", p),
                      delta: (p) => tri("dashboard.comparison.delta", p),
                    }}
                  />
                )}
              </Link>
              {otherIncomeEUR > 0 && (
                <Link
                  href={createMovementsLink('income')}
                  className="block rounded-lg border p-4 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 active:scale-[0.99] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <p className="text-sm text-muted-foreground">{tr("dashboard.otherIncome")}</p>
                    <Tooltip>
                      <TooltipTrigger asChild onClick={(e) => e.preventDefault()}>
                        <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs">{tr("dashboard.otherIncomeTooltip")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">{formatCurrencyEU(otherIncomeEUR)}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">{tr("dashboard.otherIncomeDescription")}</p>
                </Link>
              )}
              <Link
                href={createDonorsLink({ membershipType: 'recurring', viewActive: true })}
                className="block rounded-lg border p-4 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 active:scale-[0.99] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-1">
                  <p className="text-sm text-muted-foreground">{tr("dashboard.activeMembers")}</p>
                  <Tooltip>
                    <TooltipTrigger asChild onClick={(e) => e.preventDefault()}>
                      <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs">{tr("dashboard.activeMembersTooltip")}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-2xl font-bold">{activeMembers}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{tr("dashboard.activeMembersDescription")}</p>
                {canShowComparison && (
                  <ComparisonBadge
                    current={activeMembers}
                    previous={prevActiveMembers}
                    previousYear={previousYear}
                    texts={{
                      equal: (p) => tri("dashboard.comparison.equal", p),
                      delta: (p) => tri("dashboard.comparison.delta", p),
                    }}
                  />
                )}
              </Link>
              <Link
                href={createDonorsLink({ membershipType: 'one-time', viewActive: true })}
                className="block rounded-lg border p-4 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 active:scale-[0.99] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-1">
                  <p className="text-sm text-muted-foreground">{tr("dashboard.activeDonors")}</p>
                  <Tooltip>
                    <TooltipTrigger asChild onClick={(e) => e.preventDefault()}>
                      <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs">{tr("dashboard.activeDonorsTooltip")}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-2xl font-bold">{uniqueDonors}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{tr("dashboard.activeDonorsDescription")}</p>
                {canShowComparison && (
                  <ComparisonBadge
                    current={uniqueDonors}
                    previous={prevUniqueDonors}
                    previousYear={previousYear}
                    texts={{
                      equal: (p) => tri("dashboard.comparison.equal", p),
                      delta: (p) => tri("dashboard.comparison.delta", p),
                    }}
                  />
                )}
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">{tr("dashboard.activeMembers")}</p>
                <p className="text-2xl font-bold">{relationalSupportersMetrics.activeMembers}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{tr("dashboard.activeMembersDescription")}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">{tr("dashboard.activeDonors")}</p>
                <p className="text-2xl font-bold">{relationalSupportersMetrics.activeDonors}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{tr("dashboard.activeDonorsDescription")}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {canViewFinancial &&
        shouldShowProjectExpenses && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-muted-foreground" />
                {tr("dashboard.assignedExpensesByProject")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {tr("dashboard.assignedExpensesDescription")}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topAssignedProjects.map((project) => (
                  <div key={project.projectId} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {project.projectName}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatCurrencyEU(project.totalExpense)}
                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                          ({Math.round(project.percentage)}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all bg-blue-500"
                        style={{ width: `${project.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-4 mt-4 border-t space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{tr("dashboard.totalAssigned")}</span>
                    <span className="text-sm font-bold tabular-nums">{formatCurrencyEU(totalAssignedProjectExpenses)}</span>
                  </div>
                  <Link href={buildUrl('/dashboard/project-module/projects')}>
                    <Button variant="outline" size="sm" className="w-full">
                      {tr("dashboard.viewProjectDetails")}
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      {canViewFinancial && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-muted-foreground" />
              {tr("dashboard.taxObligations")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {taxObligations.map((obligation) => {
                // Mapping segons Design Contract: >60 dies = neutral, 30-60 = ambre, <30 = vermell
                const badgeClass = obligation.status === 'destructive'
                  ? 'bg-rose-100 text-rose-700 border-rose-200'
                  : obligation.status === 'warning'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-muted/50 text-muted-foreground border-border';

                return (
                  <div
                    key={obligation.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={badgeClass}>
                        {obligation.daysRemaining}d
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">{tr(`dashboard.${obligation.nameKey}`)}</p>
                        <p className="text-xs text-muted-foreground">
                          {obligation.daysRemaining} {tr("dashboard.daysRemaining")}
                        </p>
                      </div>
                    </div>
                    <Link href={buildUrl(obligation.reportPath)}>
                      <Button variant="outline" size="sm">
                        {tr("dashboard.prepare")}
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* BLOC ALERTES COMENTAT TEMPORALMENT
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            {tr("dashboard.alerts")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-1.5 py-2 text-muted-foreground">
              <span className="text-sm text-emerald-600">✓</span>
              <span className="text-sm">{tr("dashboard.allClear")}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {alerts.map((alert) => {
                // Mapping segons Design Contract: destructive=vermell, default=ambre, secondary=neutral
                const badgeClass = alert.variant === 'destructive'
                  ? 'bg-rose-100 text-rose-700 border-rose-200'
                  : alert.variant === 'default'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-muted/50 text-muted-foreground border-border';

                return (
                  <div key={alert.type}>
                    <Link
                      href={alert.href}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                    >
                      <span className="text-sm">{alert.label}</span>
                      <Badge variant="outline" className={badgeClass}>{alert.count}</Badge>
                    </Link>
                    {(alert as any).info && (
                      <p className="text-xs text-muted-foreground mt-1 ml-3">{(alert as any).info}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      */}

      {canViewFinancial && (
        <TopCategoriesTable
          transactions={expenseTransactions}
          categories={categories}
          categoryTranslations={t.categories as Record<string, string>}
          texts={{
            title: tr("dashboard.topCategoriesTitle"),
            category: tr("dashboard.topCategoriesCategory"),
            amount: tr("dashboard.topCategoriesAmount"),
            percent: tr("dashboard.topCategoriesPercent"),
            delta: tr("dashboard.topCategoriesDelta"),
            viewExpenses: tr("dashboard.topCategoriesViewExpenses"),
            others: tr("dashboard.topCategoriesOthers"),
            noData: tr("dashboard.noExpenseData"),
            uncategorized: tr("common.uncategorized"),
          }}
          buildUrl={buildUrl}
        />
      )}

      {canViewFinancial && (
        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
          <DialogContent className="!w-[min(calc(100vw-1.5rem),94rem)] !max-w-[94rem] p-0 sm:!w-[min(calc(100vw-3rem),94rem)]">
            <div className="flex h-[min(92vh,980px)] min-h-0 flex-col">
              <DialogHeader className="px-5 pt-5 md:px-8 md:pt-7">
                <DialogTitle>{tr("dashboard.shareSummary")}</DialogTitle>
                <DialogDescription>{tr("dashboard.shareSummaryDescription")}</DialogDescription>
              </DialogHeader>

              <div className="grid min-h-0 flex-1 gap-5 overflow-hidden px-4 pb-4 pt-4 md:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.95fr)] md:px-6 md:pb-6 md:pt-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.9fr)]">
                <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border bg-muted/20 p-3 shadow-sm">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{tr("dashboard.totalIncome")}</p>
                      <p className="mt-1 text-lg font-semibold">{formatCurrencyEU(totalIncome)}</p>
                    </div>
                    <div className="rounded-xl border bg-muted/20 p-3 shadow-sm">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{tr("dashboard.operatingExpenses")}</p>
                      <p className="mt-1 text-lg font-semibold">{formatCurrencyEU(Math.abs(totalExpenses))}</p>
                    </div>
                    <div className="rounded-xl border bg-muted/20 p-3 shadow-sm">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{tr("dashboard.operatingBalance")}</p>
                      <p className="mt-1 text-lg font-semibold">{formatCurrencyEU(netBalance)}</p>
                    </div>
                    <div className="rounded-xl border bg-muted/20 p-3 shadow-sm">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{tr("dashboard.activeDonors")}</p>
                      <p className="mt-1 text-lg font-semibold">{uniqueDonors}</p>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-xl border bg-background/80 p-4 shadow-sm md:p-5">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">{shareModalTexts.summaryBlockTitle}</p>
                      <p className="text-sm font-semibold">{summaryOrgPeriodText}</p>
                    </div>
                    <Textarea
                      value={summaryText}
                      onChange={(e) => setSummaryText(e.target.value)}
                      className="min-h-0 flex-1 resize-none font-mono text-sm leading-6 md:min-h-[420px]"
                    />
                  </div>

                  <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <Button variant="outline" onClick={handleCopy}>
                      <Copy className="h-4 w-4 mr-2" />
                      {copySuccess ? tr("dashboard.copied") : tr("dashboard.copy")}
                    </Button>
                    <Button variant="outline" onClick={handleResetNarratives} disabled={!defaultNarratives}>
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      {shareModalTexts.actions.reset}
                    </Button>
                    <Button variant="secondary" onClick={handleExportEconomicExcel}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      {shareModalTexts.actions.exportExcel}
                    </Button>
                    <Button variant="secondary" onClick={handleExportEconomicCsv}>
                      <FileText className="h-4 w-4 mr-2" />
                      {shareModalTexts.actions.exportCsv}
                    </Button>
                  </div>
                </div>

                {narratives && (
                  <div className="flex min-h-0 flex-col rounded-xl border bg-muted/10 p-4 shadow-sm md:p-5">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">{shareModalTexts.narrativesHeading}</p>
                      <p className="text-sm text-muted-foreground">
                        {shareModalTexts.narrativesDescription}
                      </p>
                    </div>
                    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto pr-1 xl:grid-cols-2">
                      {NARRATIVE_ORDER.map((field) => (
                        <div key={field} className="flex h-full flex-col rounded-lg border border-dashed bg-background/90 p-3 shadow-sm">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {shareModalTexts.cards[field].title}
                            </p>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <button
                                onClick={() => handleCopyNarrative(field)}
                                className="text-xs hover:text-foreground"
                                aria-label={shareModalTexts.actions.copy}
                              >
                                📋
                              </button>
                              <button
                                onClick={() => openNarrativeEditor(field)}
                                className="text-xs hover:text-foreground"
                                aria-label={shareModalTexts.actions.edit}
                              >
                                ✏️
                              </button>
                            </div>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-4">
                            {narratives[field]}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="border-t px-4 py-4 md:px-6">
                <Button variant="default" onClick={handleEmailShare}>
                  <Mail className="h-4 w-4 mr-2" />
                  {tr("dashboard.sendByEmail")}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {canViewFinancial && editingField && (
        isMobile ? (
          <Sheet open={isNarrativeEditorOpen} onOpenChange={(open) => (open ? setNarrativeEditorOpen(true) : handleNarrativeCancel())}>
            <SheetContent side="bottom" className="h-[85vh] w-full overflow-y-auto">
              <SheetHeader className="space-y-1">
                <SheetTitle>{shareModalTexts.editor.title({ section: shareModalTexts.cards[editingField].title })}</SheetTitle>
                <SheetDescription>{shareModalTexts.editor.description({ section: shareModalTexts.cards[editingField].label })}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 py-4">
                <Textarea
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  rows={8}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button onClick={handleNarrativeSave}>{t.common.save}</Button>
                  <Button variant="outline" onClick={handleNarrativeCancel}>
                    {t.common.cancel}
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <Dialog open={isNarrativeEditorOpen} onOpenChange={(open) => (open ? setNarrativeEditorOpen(true) : handleNarrativeCancel())}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{shareModalTexts.editor.title({ section: shareModalTexts.cards[editingField].title })}</DialogTitle>
                <DialogDescription>{shareModalTexts.editor.description({ section: shareModalTexts.cards[editingField].label })}</DialogDescription>
              </DialogHeader>
              <Textarea
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                rows={8}
                className="text-sm"
              />
              <DialogFooter className="mt-4">
                <Button onClick={handleNarrativeSave}>{t.common.save}</Button>
                <Button variant="outline" onClick={handleNarrativeCancel}>
                  {t.common.cancel}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      )}
    </div>
  );
}
