// src/app/[orgSlug]/dashboard/project-module/projects/[projectId]/budget/page.tsx
// Pressupost del projecte amb partides i execució

'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { computeFxAmountEUR } from '@/lib/project-module/fx';
import {
  useProjectDetail,
  useProjectBudgetLines,
  useSaveBudgetLine,
  useProjectExpenseLinks,
  useUnifiedExpenseFeed,
  useSaveProjectFx,
  useProjectFxTransfers,
  useSaveFxTransfer,
  useReapplyProjectFx,
  getEffectiveProjectTC,
  computeWeightedFxRate,
  computeFxCurrency,
} from '@/hooks/use-project-module';
import { useOrgUrl } from '@/hooks/organization-provider';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/i18n';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertCircle,
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Download,
  Loader2,
  Eye,
  Info,
  FileArchive,
  Compass,
  DollarSign,
  Upload,
  MoreVertical,
  Hash,
  ChevronDown,
  RefreshCcw,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { MobileListItem } from '@/components/mobile/mobile-list-item';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFirebase } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { doc, getDoc } from 'firebase/firestore';
import { buildProjectJustificationFundingXlsx, type FundingOrderMode, type FundingColumnLabels } from '@/lib/project-justification-export';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { exportProjectJustificationZip } from '@/lib/project-justification-attachments-zip';
import { trackUX } from '@/lib/ux/trackUX';
import { useRouter } from 'next/navigation';
import type { BudgetLine, BudgetLineFormData, FxTransfer, FxTransferFormData } from '@/lib/project-module-types';
import { Textarea } from '@/components/ui/textarea';
import { BalanceProjectModal } from '@/components/project-module/balance-project-modal';
import { BudgetImportWizard } from '@/components/project-module/budget-import-wizard';

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('ca-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('ca-ES', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

// Component per al formulari de transferència FX
function FxTransferForm({
  open,
  onOpenChange,
  onSave,
  isSaving,
  initialData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: FxTransferFormData) => Promise<void>;
  isSaving: boolean;
  initialData?: FxTransfer | null;
}) {
  const { tr } = useTranslations();
  const [date, setDate] = React.useState('');
  const [eurSent, setEurSent] = React.useState('');
  const [localCurrency, setLocalCurrency] = React.useState('');
  const [localReceived, setLocalReceived] = React.useState('');
  const [bankTxRef, setBankTxRef] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      if (initialData) {
        setDate(initialData.date);
        setEurSent(initialData.eurSent.toString());
        setLocalCurrency(initialData.localCurrency);
        setLocalReceived(initialData.localReceived.toString());
        setBankTxRef(initialData.bankTxRef?.txId ?? '');
        setNotes(initialData.notes ?? '');
      } else {
        setDate('');
        setEurSent('');
        setLocalCurrency('');
        setLocalReceived('');
        setBankTxRef('');
        setNotes('');
      }
      setErrors({});
    }
  }, [open, initialData]);

  // TC implícit preview
  const eurVal = parseFloat(eurSent.replace(',', '.'));
  const localVal = parseFloat(localReceived.replace(',', '.'));
  const implicitRate = !isNaN(eurVal) && !isNaN(localVal) && localVal > 0 ? eurVal / localVal : null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!date.trim()) {
      newErrors.date = tr('projectModule.budget.fxTransfersDateRequired');
    }

    const eur = parseFloat(eurSent.replace(',', '.'));
    if (isNaN(eur) || eur <= 0) {
      newErrors.eurSent = tr('projectModule.budget.fxTransfersAmountPositive');
    }

    const local = parseFloat(localReceived.replace(',', '.'));
    if (isNaN(local) || local <= 0) {
      newErrors.localReceived = tr('projectModule.budget.fxTransfersAmountPositive');
    }

    if (!localCurrency.trim()) {
      newErrors.localCurrency = tr('projectModule.budget.fxTransfersCurrencyRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSave({
      date: date.trim(),
      eurSent: eurSent.replace(',', '.'),
      localCurrency: localCurrency.trim().toUpperCase(),
      localReceived: localReceived.replace(',', '.'),
      bankTxRef: bankTxRef.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initialData
              ? tr('projectModule.budget.fxTransfersEdit')
              : tr('projectModule.budget.fxTransfersAdd')}
          </DialogTitle>
          <DialogDescription>
            {tr('projectModule.budget.fxTransfersHelp')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fxDate">{tr('projectModule.budget.fxTransfersDate')}</Label>
            <Input
              id="fxDate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9"
            />
            {errors.date && <p className="text-sm text-destructive">{errors.date}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fxEurSent">{tr('projectModule.budget.fxTransfersEurSent')}</Label>
              <Input
                id="fxEurSent"
                type="text"
                inputMode="decimal"
                value={eurSent}
                onChange={(e) => setEurSent(e.target.value)}
                placeholder="1000"
                className="h-9"
              />
              {errors.eurSent && <p className="text-sm text-destructive">{errors.eurSent}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fxCurrency">{tr('projectModule.currency')}</Label>
              <Input
                id="fxCurrency"
                type="text"
                value={localCurrency}
                onChange={(e) => setLocalCurrency(e.target.value.toUpperCase())}
                placeholder="XOF"
                maxLength={3}
                className="h-9 font-mono"
              />
              {errors.localCurrency && <p className="text-sm text-destructive">{errors.localCurrency}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fxLocalReceived">{tr('projectModule.budget.fxTransfersLocalReceived')}</Label>
            <Input
              id="fxLocalReceived"
              type="text"
              inputMode="decimal"
              value={localReceived}
              onChange={(e) => setLocalReceived(e.target.value)}
              placeholder="650000"
              className="h-9"
            />
            {errors.localReceived && <p className="text-sm text-destructive">{errors.localReceived}</p>}
          </div>

          {/* Preview TC implícit */}
          {implicitRate !== null && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">{tr('projectModule.budget.fxTransfersImplicitRate')}:</span>{' '}
              <span className="font-mono font-medium">{implicitRate.toFixed(6)}</span>{' '}
              <span className="text-muted-foreground">{tr('projectModule.budget.fxTransfersEurPerLocal')}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="fxBankRef">{tr('projectModule.budget.fxTransfersBankRef')}</Label>
            <Input
              id="fxBankRef"
              type="text"
              value={bankTxRef}
              onChange={(e) => setBankTxRef(e.target.value)}
              placeholder={tr('projectModule.budget.optional')}
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fxNotes">{tr('projectModule.budget.fxTransfersNotes')}</Label>
            <Textarea
              id="fxNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={tr('projectModule.budget.optional')}
              rows={2}
              className="text-sm"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              {tr('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : tr('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Component per al formulari de partida
function BudgetLineForm({
  open,
  onOpenChange,
  onSave,
  isSaving,
  initialData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: BudgetLineFormData) => Promise<void>;
  isSaving: boolean;
  initialData?: BudgetLine | null;
}) {
  const { tr } = useTranslations();
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [budgetedAmountEUR, setBudgetedAmountEUR] = React.useState('');
  const [order, setOrder] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      if (initialData) {
        setName(initialData.name);
        setCode(initialData.code ?? '');
        setBudgetedAmountEUR(initialData.budgetedAmountEUR.toString());
        setOrder(initialData.order?.toString() ?? '');
      } else {
        setName('');
        setCode('');
        setBudgetedAmountEUR('');
        setOrder('');
      }
      setErrors({});
    }
  }, [open, initialData]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = tr('projectModule.nameRequired');
    }

    const amount = parseFloat(budgetedAmountEUR.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      newErrors.budgetedAmountEUR = tr('projectModule.amountPositive');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSave({
      name: name.trim(),
      code: code.trim(),
      budgetedAmountEUR: budgetedAmountEUR.replace(',', '.'),
      order,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initialData ? tr('projectModule.editBudgetLine') : tr('projectModule.addBudgetLine')}
          </DialogTitle>
          <DialogDescription>
            {tr('projectModule.budgetLineDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{tr('projectModule.lineName')} *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr('projectModule.budget.lineNameExample')}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">{tr('projectModule.lineCode')}</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={tr('projectModule.budget.lineCodeExample')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="budgetedAmountEUR">{tr('projectModule.budgetedAmount')} *</Label>
            <Input
              id="budgetedAmountEUR"
              type="text"
              inputMode="decimal"
              value={budgetedAmountEUR}
              onChange={(e) => setBudgetedAmountEUR(e.target.value)}
              placeholder="0,00"
              className={errors.budgetedAmountEUR ? 'border-destructive' : ''}
            />
            {errors.budgetedAmountEUR && <p className="text-sm text-destructive">{errors.budgetedAmountEUR}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="order">{tr('projectModule.lineOrder')}</Label>
            <Input
              id="order"
              type="number"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              placeholder={tr('projectModule.budget.orderExample')}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              {tr('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? tr('common.saving') : tr('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ProjectBudgetPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const router = useRouter();
  const { buildUrl } = useOrgUrl();
  const { toast } = useToast();
  const { t, tr } = useTranslations();
  const { firestore } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const isMobile = useIsMobile();

  // Track page open
  React.useEffect(() => {
    trackUX('budget.open', { projectId });
  }, [projectId]);

  const { project, isLoading: projectLoading, error: projectError, refresh: refreshProject } = useProjectDetail(projectId);
  const { budgetLines, isLoading: linesLoading, error: linesError, refresh: refreshLines } = useProjectBudgetLines(projectId);
  const { expenseLinks, isLoading: linksLoading, refresh: refreshExpenseLinks } = useProjectExpenseLinks(projectId);
  const { expenses: allExpenses, isLoading: expensesLoading } = useUnifiedExpenseFeed({ projectId });
  // Pool complet per al modal de justificació (inclou TOTES les despeses, no només les linkades al projecte)
  const { expenses: allExpensesForModal, isLoading: allExpensesLoading } = useUnifiedExpenseFeed();
  const { save, remove, isSaving } = useSaveBudgetLine();
  const { saveFx, isSaving: isSavingFx } = useSaveProjectFx();
  const { fxTransfers, isLoading: fxTransfersLoading, refresh: refreshFxTransfers } = useProjectFxTransfers(projectId);
  const { save: saveFxTransfer, remove: removeFxTransfer, isSaving: isSavingFxTransfer } = useSaveFxTransfer();
  const { reapply: reapplyFx, isRunning: isReapplying } = useReapplyProjectFx();

  // Derivats FX
  const weightedFxRate = React.useMemo(() => computeWeightedFxRate(fxTransfers), [fxTransfers]);
  const weightedFxCurrency = React.useMemo(() => computeFxCurrency(fxTransfers), [fxTransfers]);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingLine, setEditingLine] = React.useState<BudgetLine | null>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState<BudgetLine | null>(null);
  const [importWizardOpen, setImportWizardOpen] = React.useState(false);
  const [isExportingFunding, setIsExportingFunding] = React.useState(false);
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
  const [exportOrderMode, setExportOrderMode] = React.useState<FundingOrderMode>('budgetLineThenChronological');
  const [isExportingZip, setIsExportingZip] = React.useState(false);
  const [zipProgress, setZipProgress] = React.useState<{ current: number; total: number } | null>(null);
  const [justificationModalOpen, setJustificationModalOpen] = React.useState(false);

  // Estat per fxTransfers
  const [fxTransferFormOpen, setFxTransferFormOpen] = React.useState(false);
  const [editingFxTransfer, setEditingFxTransfer] = React.useState<FxTransfer | null>(null);
  const [deleteFxTransferConfirm, setDeleteFxTransferConfirm] = React.useState<FxTransfer | null>(null);
  const [reapplyConfirmOpen, setReapplyConfirmOpen] = React.useState(false);

  // Estat per edició FX legacy
  const [fxEditMode, setFxEditMode] = React.useState(false);
  const [fxRateInput, setFxRateInput] = React.useState('');
  const [fxCurrencyInput, setFxCurrencyInput] = React.useState('');

  // Inicialitzar inputs FX quan es carrega el projecte
  React.useEffect(() => {
    if (project) {
      setFxRateInput(project.fxRate?.toString() ?? '');
      setFxCurrencyInput(project.fxCurrency ?? '');
    }
  }, [project]);

  // Detectar si hi ha assignacions FX que realment necessiten recàlcul
  // Compara l'amountEUR actual de cada assignment amb el que donaria el TC vigent
  const hasFxAssignmentsNeedingRecalc = React.useMemo(() => {
    if (!project) return false;
    if (fxTransfers.length === 0 && !(project.fxRate && project.fxRate > 0)) return false;

    const currentTC = getEffectiveProjectTC(fxTransfers, project);

    // Mapa txId -> UnifiedExpense per lookup ràpid
    const expenseMap = new Map(allExpenses.map(e => [e.expense.txId, e.expense]));

    for (const link of expenseLinks) {
      if (!link.id.startsWith('off_')) continue;
      const expense = expenseMap.get(link.id);
      if (!expense) continue;

      // Si la despesa té TC manual → no es recalcularà, skip
      if (expense.fxRate != null && expense.fxRate > 0) continue;

      // Si no té originalAmount → skip
      const originalAmount = expense.originalAmount;
      if (originalAmount == null) continue;

      for (const a of link.assignments) {
        if (a.projectId !== projectId) continue;

        const pct = a.localPct ?? 100;
        const expectedEUR = computeFxAmountEUR(originalAmount, pct, currentTC);

        // Comparar amb l'actual
        if (expectedEUR === null && a.amountEUR === null) continue;
        if (
          expectedEUR !== null &&
          a.amountEUR !== null &&
          Math.abs(expectedEUR - a.amountEUR) < 0.01
        ) continue;

        // Hi ha diferència → cal recàlcul
        return true;
      }
    }
    return false;
  }, [fxTransfers, project, expenseLinks, allExpenses, projectId]);

  // Detectar si el projecte té context FX (moneda local configurada o despeses off-bank en moneda local)
  const projectHasFxContext = React.useMemo(() => {
    if (project?.fxCurrency) return true;
    const expenseMap = new Map(allExpenses.map(e => [e.expense.txId, e.expense]));
    for (const link of expenseLinks) {
      if (!link.id.startsWith('off_')) continue;
      const expense = expenseMap.get(link.id);
      if (expense?.originalCurrency && expense.originalCurrency !== 'EUR') return true;
    }
    return false;
  }, [project, expenseLinks, allExpenses]);

  // TC efectiu del projecte (ponderat > legacy > null)
  const effectiveTC = React.useMemo(
    () => project ? getEffectiveProjectTC(fxTransfers, project) : null,
    [fxTransfers, project]
  );

  // Banner "sense TC": projecte FX sense TC definit
  const showNoTcBanner = projectHasFxContext && effectiveTC === null;

  // Comptador d'imputacions amb amountEUR === null (pendents de conversió)
  const pendingFxCount = React.useMemo(() => {
    let count = 0;
    for (const link of expenseLinks) {
      for (const a of link.assignments) {
        if (a.projectId === projectId && a.amountEUR === null) count++;
      }
    }
    return count;
  }, [expenseLinks, projectId]);

  // Handler per re-aplicar TC
  const handleReapplyFx = React.useCallback(async () => {
    if (!project) return;
    setReapplyConfirmOpen(false);
    try {
      const result = await reapplyFx(projectId, fxTransfers, project);
      if (result.updated > 0) {
        toast({
          title: tr('projectModule.budget.fxReapplyDoneTitle'),
          description: tr('projectModule.budget.fxReapplyDoneText').replace('{count}', String(result.updated)),
        });
        await refreshExpenseLinks();
      } else {
        toast({
          title: tr('projectModule.budget.fxReapplyNothingTitle'),
          description: tr('projectModule.budget.fxReapplyNothingText'),
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: tr('projectModule.budget.error'),
        description: err instanceof Error ? err.message : tr('projectModule.budget.errorRecalculating'),
      });
    }
  }, [project, projectId, fxTransfers, reapplyFx, toast, t, refreshExpenseLinks]);

  // Calcular execució per partida
  const executionByLine = React.useMemo(() => {
    const map = new Map<string, number>();

    for (const link of expenseLinks) {
      for (const assignment of link.assignments) {
        if (assignment.budgetLineId) {
          const current = map.get(assignment.budgetLineId) ?? 0;
          map.set(assignment.budgetLineId, current + (assignment.amountEUR != null ? Math.abs(assignment.amountEUR) : 0));
        }
      }
    }

    return map;
  }, [expenseLinks]);

  // Calcular totals
  const totals = React.useMemo(() => {
    // Suma de partides (per Estat B)
    let budgetedFromLines = 0;
    let executedByLines = 0;

    for (const line of budgetLines) {
      budgetedFromLines += line.budgetedAmountEUR;
      executedByLines += executionByLine.get(line.id) ?? 0;
    }

    // Execució total del projecte (per Estat A i resum B)
    let totalProjectExecution = 0;
    for (const link of expenseLinks) {
      for (const assignment of link.assignments) {
        if (assignment.projectId === projectId) {
          totalProjectExecution += assignment.amountEUR != null ? Math.abs(assignment.amountEUR) : 0;
        }
      }
    }

    return {
      budgetedFromLines,
      executedByLines,
      totalProjectExecution,
      globalBudget: project?.budgetEUR ?? null,
    };
  }, [budgetLines, executionByLine, expenseLinks, projectId, project?.budgetEUR]);

  // Detecció d'estat
  const hasBudgetLines = budgetLines.length > 0;

  const handleSave = async (data: BudgetLineFormData) => {
    try {
      await save(projectId, data, editingLine?.id);
      toast({
        title: editingLine ? tr('projectModule.budget.lineUpdated') : tr('projectModule.budget.lineCreated'),
        description: tr('projectModule.budget.lineSavedDescNamed').replace('{name}', data.name),
      });
      setFormOpen(false);
      setEditingLine(null);
      await refreshLines();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: tr('projectModule.budget.error'),
        description: err instanceof Error ? err.message : tr('projectModule.budget.errorSavingLine'),
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    // Guardrail: bloquejar si la partida té despeses assignades
    const hasLinkedExpenses = expenseLinks.some(link =>
      link.budgetLineIds?.includes(deleteConfirm.id)
    );
    if (hasLinkedExpenses) {
      toast({
        variant: 'destructive',
        title: tr('projectModule.budget.error'),
        description: tr('projectModule.budget.cannotDeleteLineHasExpenses'),
      });
      return;
    }

    try {
      await remove(projectId, deleteConfirm.id);
      toast({
        title: tr('projectModule.budget.lineDeleted'),
        description: tr('projectModule.budget.lineDeletedDescNamed').replace('{name}', deleteConfirm.name),
      });
      setDeleteConfirm(null);
      await refreshLines();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: tr('projectModule.budget.error'),
        description: err instanceof Error ? err.message : tr('projectModule.budget.errorDeletingLine'),
      });
    }
  };

  const openEdit = (line: BudgetLine, e?: React.MouseEvent) => {
    e?.stopPropagation();
    trackUX('budget.editLine.open', { lineId: line.id, lineName: line.name });
    setEditingLine(line);
    setFormOpen(true);
  };

  const openNew = () => {
    setEditingLine(null);
    setFormOpen(true);
  };

  const handleRowClick = (line: BudgetLine) => {
    trackUX('budget.row.click', { lineId: line.id, lineName: line.name });
    const url = buildUrl(`/dashboard/project-module/expenses?projectId=${projectId}&budgetLineId=${line.id}`);
    router.push(url);
  };

  const handleViewExpenses = () => {
    trackUX('budget.viewExpenses.click', { projectId });
    const url = buildUrl(`/dashboard/project-module/expenses?projectId=${projectId}`);
    router.push(url);
  };

  const handleOpenExportDialog = () => {
    if (!organizationId || !project) return;
    setExportOrderMode('budgetLineThenChronological');
    setExportDialogOpen(true);
  };

  const handleConfirmExportFunding = async () => {
    if (!organizationId || !project) return;

    setExportDialogOpen(false);
    setIsExportingFunding(true);
    try {
      const expenseMap = new Map(allExpenses.map((e) => [e.expense.txId, e.expense]));

      const columnLabels: FundingColumnLabels = {
        order: tr('projectModule.export.columns.order'),
        date: tr('projectModule.export.columns.date'),
        concept: tr('projectModule.export.columns.concept'),
        supplier: tr('projectModule.export.columns.supplier'),
        invoiceNumber: tr('projectModule.export.columns.invoiceNumber'),
        budgetLine: tr('projectModule.export.columns.budgetLine'),
        fxRateApplied: tr('projectModule.export.columns.fxRateApplied'),
        totalOriginalAmount: tr('projectModule.export.columns.totalOriginalAmount'),
        currency: tr('projectModule.export.columns.currency'),
        totalEurAmount: tr('projectModule.export.columns.totalEurAmount'),
        assignedPct: tr('projectModule.export.columns.assignedPct'),
        assignedOriginalAmount: tr('projectModule.export.columns.assignedOriginalAmount'),
        assignedEurAmount: tr('projectModule.export.columns.assignedEurAmount'),
      };

      const { blob, filename } = buildProjectJustificationFundingXlsx({
        projectId,
        projectCode: project.code ?? '',
        projectName: project.name,
        budgetLines,
        expenseLinks,
        expenses: expenseMap,
        orderMode: exportOrderMode,
        projectFxRate: getEffectiveProjectTC(fxTransfers, project),
        columnLabels,
        sheetName: tr('projectModule.export.fundingSheetName'),
        filenamePrefix: tr('projectModule.export.fundingFilenamePrefix'),
      });

      // Descarregar fitxer
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: tr('projectModule.budget.excelGenerated'),
        description: tr('projectModule.budget.excelDownloadedNamed').replace('{filename}', filename),
      });
    } catch (err) {
      console.error('Error exporting funding:', err);
      toast({
        variant: 'destructive',
        title: tr('projectModule.budget.error'),
        description: err instanceof Error ? err.message : tr('projectModule.budget.errorGeneratingExcel'),
      });
    } finally {
      setIsExportingFunding(false);
    }
  };

  // Comptar assignacions del projecte (per decidir si el botó s'ha de desactivar)
  const projectAssignmentsCount = React.useMemo(() => {
    let count = 0;
    for (const link of expenseLinks) {
      for (const assignment of link.assignments) {
        if (assignment.projectId === projectId) {
          count++;
        }
      }
    }
    return count;
  }, [expenseLinks, projectId]);

  const handleExportZip = async () => {
    if (!organizationId || !project) return;

    trackUX('budget.downloadZip.click', { projectId, entriesCount: projectAssignmentsCount });
    setIsExportingZip(true);
    setZipProgress(null);

    try {
      // Obtenir nom de l'organització
      const orgDoc = await getDoc(doc(firestore, 'organizations', organizationId));
      const orgName = orgDoc.data()?.name ?? tr('projectModule.budget.orgFallbackName');

      // Extreure les despeses del feed (que ja té tota la info)
      const expenses = allExpenses.map((e) => e.expense);

      const result = await exportProjectJustificationZip(
        {
          organizationId,
          organizationName: orgName,
          projectId,
          projectCode: project.code ?? '',
          projectName: project.name,
          allowedDeviationPct: project.allowedDeviationPct ?? 10,
          budgetLines,
          expenses,
          expenseLinks,
        },
        (current, total) => {
          setZipProgress({ current, total });
        }
      );

      trackUX('budget.downloadZip.done', {
        entriesCount: result.entriesCount,
        okCount: result.okCount,
        missingCount: result.missingCount,
        fetchErrorCount: result.fetchErrorCount,
      });

      toast({
        title: tr('projectModule.zipGenerated'),
        description: [
          tr('projectModule.budget.zipSummary').replace('{count}', String(result.okCount)),
          result.missingCount > 0
            ? tr('projectModule.budget.zipMissingDocuments').replace('{count}', String(result.missingCount))
            : '',
        ].filter(Boolean).join(' '),
      });
    } catch (err) {
      console.error('Error exporting ZIP:', err);
      trackUX('budget.downloadZip.error', { message: err instanceof Error ? err.message : 'Error desconegut' });
      toast({
        variant: 'destructive',
        title: tr('projectModule.budget.error'),
        description: err instanceof Error ? err.message : tr('projectModule.budget.errorGeneratingZip'),
      });
    } finally {
      setIsExportingZip(false);
      setZipProgress(null);
    }
  };

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive font-medium">{tr('projectModule.budget.errorLoading')}</p>
        <p className="text-muted-foreground text-sm">{projectError?.message ?? tr('projectModule.budget.notFound')}</p>
        <Link href={buildUrl('/dashboard/project-module/projects')}>
          <Button variant="outline">{tr('projectModule.budget.backToProjects')}</Button>
        </Link>
      </div>
    );
  }

  const allowedDeviation = project.allowedDeviationPct ?? 10;

  return (
    <div className="w-full space-y-6 pb-24 md:pb-0">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Link href={buildUrl('/dashboard/project-module/projects')}>
            <Button variant="ghost" size="icon" title={tr('projectModule.backToProjects')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold truncate">{tr('projectModule.budget.title')}</h1>
            <p className="text-muted-foreground text-sm truncate">
              {project.name} {project.code && `(${project.code})`}
            </p>
          </div>
        </div>

        {/* Actions - Mobile: stacked, Desktop: row */}
        {isMobile ? (
          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              onClick={() => {
                trackUX('budget.justification.open', { projectId });
                setJustificationModalOpen(true);
              }}
            >
              <Compass className="h-4 w-4 mr-2" />
              {tr('projectModule.budget.startJustification')}
              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">{tr('projectModule.budget.betaBadge')}</Badge>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full">
                  <MoreVertical className="h-4 w-4 mr-2" />
                  {tr('projectModule.budget.moreActions')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleViewExpenses}>
                  <Eye className="mr-2 h-4 w-4" />
                  {tr('projectModule.budget.viewExpensesAction')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleOpenExportDialog}
                  disabled={isExportingFunding || expensesLoading || projectAssignmentsCount === 0}
                >
                  {isExportingFunding ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {tr('projectModule.exportExcel')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleExportZip}
                  disabled={isExportingZip || expensesLoading || projectAssignmentsCount === 0}
                >
                  {isExportingZip ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileArchive className="mr-2 h-4 w-4" />
                  )}
                  {tr('projectModule.downloadAttachments')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setImportWizardOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  {tr('projectModule.importBudget')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              onClick={() => {
                trackUX('budget.justification.open', { projectId });
                setJustificationModalOpen(true);
              }}
            >
              <Compass className="h-4 w-4 mr-2" />
              {tr('projectModule.budget.startJustification')}
              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">{tr('projectModule.budget.betaBadge')}</Badge>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleViewExpenses}
              title={tr('projectModule.viewExpensesTooltip')}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleOpenExportDialog}
              disabled={isExportingFunding || expensesLoading || projectAssignmentsCount === 0}
              title={tr('projectModule.exportExcel')}
            >
              {isExportingFunding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleExportZip}
              disabled={isExportingZip || expensesLoading || projectAssignmentsCount === 0}
              title={tr('projectModule.downloadAttachments')}
            >
              {isExportingZip ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileArchive className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setImportWizardOpen(true)}
              title={tr('projectModule.importBudget')}
            >
              <Upload className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Banner "Sense TC" (R2) — no dismissible */}
      {showNoTcBanner && (
        <Alert variant="default" className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-800">
            {t.projectModule.fxNoTcBanner}
          </AlertDescription>
        </Alert>
      )}

      {/* Resum — Estat A (sense partides) o Estat B (amb partides) */}
      {!hasBudgetLines ? (
        /* Estat A: Seguiment global */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{tr('projectModule.budget.globalBudget')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {totals.globalBudget !== null ? formatAmount(totals.globalBudget) : '—'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{tr('projectModule.executed')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatAmount(totals.totalProjectExecution)}</p>
              {pendingFxCount > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  {pendingFxCount === 1
                    ? t.projectModule.fxPendingCountSingular
                    : t.projectModule.fxPendingCountPlural.replace('{{count}}', String(pendingFxCount))}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>
                {totals.globalBudget !== null && totals.totalProjectExecution > totals.globalBudget
                  ? tr('projectModule.overspend')
                  : tr('projectModule.pending')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {totals.globalBudget !== null ? (
                <>
                  <p className={`text-2xl font-bold ${totals.totalProjectExecution > totals.globalBudget ? 'text-red-600' : ''}`}>
                    {formatAmount(Math.abs(totals.globalBudget - totals.totalProjectExecution))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatPercent((totals.totalProjectExecution / totals.globalBudget) * 100)} {tr('projectModule.budget.executedLabel')}
                  </p>
                </>
              ) : (
                <p className="text-2xl font-bold">—</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Estat B: Seguiment per partides + referència global */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{tr('projectModule.budgetTotalLabel')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatAmount(totals.budgetedFromLines)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {tr('projectModule.budget.calculatedFromLines')}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{tr('projectModule.executed')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatAmount(totals.executedByLines)}</p>
              {pendingFxCount > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  {pendingFxCount === 1
                    ? t.projectModule.fxPendingCountSingular
                    : t.projectModule.fxPendingCountPlural.replace('{{count}}', String(pendingFxCount))}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>
                {totals.executedByLines > totals.budgetedFromLines
                  ? tr('projectModule.overspend')
                  : tr('projectModule.pending')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${totals.executedByLines > totals.budgetedFromLines ? 'text-red-600' : ''}`}>
                {formatAmount(Math.abs(totals.budgetedFromLines - totals.executedByLines))}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Secció FX: Col·lapsable */}
      <details className="group rounded-lg border bg-background">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium list-none [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-2">
            <span>{tr('projectModule.budget.fxSectionTitle')}</span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs text-muted-foreground hover:bg-muted"
                  aria-label={tr('projectModule.budget.fxHelpAria')}
                >
                  ?
                </button>
              </PopoverTrigger>
              <PopoverContent className="max-w-sm text-sm leading-relaxed" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-3">
                  <p className="font-medium">{tr('projectModule.budget.fxHelpTitle')}</p>
                  <ul className="space-y-2 list-none p-0">
                    <li>
                      <strong>{tr('projectModule.budget.fxHelpModeExpenseTitle')}</strong><br />
                      {tr('projectModule.budget.fxHelpModeExpenseText')}
                    </li>
                    <li>
                      <strong>{tr('projectModule.budget.fxHelpModeTransfersTitle')}</strong><br />
                      {tr('projectModule.budget.fxHelpModeTransfersText')}
                    </li>
                    <li>
                      <strong>{tr('projectModule.budget.fxHelpModeManualTitle')}</strong><br />
                      {tr('projectModule.budget.fxHelpModeManualText')}
                    </li>
                  </ul>
                  <div className="text-xs text-muted-foreground">
                    {tr('projectModule.budget.fxHelpPriority')}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
        </summary>

        <div className="space-y-4 px-4 pb-4">

        {/* Banner re-aplicar TC */}
        {hasFxAssignmentsNeedingRecalc && (
          <Alert variant="default" className="border-blue-200 bg-blue-50">
            <RefreshCcw className="h-4 w-4 text-blue-600" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-sm text-blue-800">
                {tr('projectModule.budget.fxReapplyNoticeText')}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="ml-3 shrink-0"
                onClick={() => setReapplyConfirmOpen(true)}
                disabled={isReapplying}
              >
                {isReapplying ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCcw className="h-3 w-3 mr-1" />
                )}
                {tr('projectModule.budget.fxReapplyButton')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Bloc 1: TC calculat (ponderat) */}
        <div className="rounded-md bg-muted/30 p-3 text-sm">
          <div className="text-muted-foreground">{tr('projectModule.budget.fxTransfersWeightedRate')}</div>
          <div className="mt-1 font-mono">
            {weightedFxRate !== null ? (
              <>
                {new Intl.NumberFormat('ca-ES', { minimumFractionDigits: 10, maximumFractionDigits: 10 }).format(weightedFxRate)} {tr('projectModule.budget.fxTransfersEurPerLocal')}
                {weightedFxCurrency && <span className="ml-1">({weightedFxCurrency})</span>}
              </>
            ) : project.fxRate ? (
              <>
                {new Intl.NumberFormat('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(project.fxRate)} {project.fxCurrency ?? ''} {tr('projectModule.budget.exchangeRateReference')}
                <span className="ml-2 not-italic text-xs text-muted-foreground font-sans">({tr('projectModule.budget.fxLegacyTitle')})</span>
              </>
            ) : (
              <span className="italic font-sans text-muted-foreground">{tr('projectModule.notConfigured')}</span>
            )}
          </div>
        </div>

        {/* Bloc 2: Transferències */}
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">{tr('projectModule.budget.fxTransfersTitle')}</h4>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              setEditingFxTransfer(null);
              setFxTransferFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            {tr('projectModule.budget.fxTransfersAdd')}
          </Button>
        </div>
        {fxTransfers.length > 0 && (
          <div className="rounded-lg border">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{tr('projectModule.budget.fxTransfersDate')}</TableHead>
                  <TableHead className="text-xs text-right">{tr('projectModule.budget.fxTransfersEurSent')}</TableHead>
                  <TableHead className="text-xs">{tr('projectModule.currency')}</TableHead>
                  <TableHead className="text-xs text-right">{tr('projectModule.budget.fxTransfersLocalReceived')}</TableHead>
                  <TableHead className="text-xs text-right">{tr('projectModule.budget.fxTransfersImplicitRate')}</TableHead>
                  <TableHead className="text-xs w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fxTransfers.map((transfer) => {
                  const implicitRate = transfer.localReceived > 0 ? transfer.eurSent / transfer.localReceived : 0;
                  return (
                    <TableRow key={transfer.id}>
                      <TableCell className="text-sm">{transfer.date.replace(/^(\d{4})-(\d{2})-(\d{2}).*/, '$3/$2/$1')}</TableCell>
                      <TableCell className="text-sm text-right font-mono">{formatAmount(transfer.eurSent)}</TableCell>
                      <TableCell className="text-sm font-mono">{transfer.localCurrency}</TableCell>
                      <TableCell className="text-sm text-right font-mono">
                        {new Intl.NumberFormat('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(transfer.localReceived)}
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono">{new Intl.NumberFormat('ca-ES', { minimumFractionDigits: 6, maximumFractionDigits: 6 }).format(implicitRate)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingFxTransfer(transfer);
                              setFxTransferFormOpen(true);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setDeleteFxTransferConfirm(transfer)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {fxTransfers.length === 0 && !fxTransfersLoading && (
          <p className="text-sm text-muted-foreground italic px-1">
            {tr('projectModule.budget.fxTransfersNoTransfers')}
          </p>
        )}

        {/* Bloc 3: TC manual (fallback global) */}
        <div className="rounded-md border border-dashed p-3 text-sm">
          <div className="text-muted-foreground">{tr('projectModule.budget.fxLegacyFallbackTitle')}</div>
          <div className="mt-2">
            {fxEditMode ? (
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[120px] max-w-[160px]">
                  <Input
                    id="fxRate"
                    type="text"
                    inputMode="decimal"
                    value={fxRateInput}
                    onChange={(e) => setFxRateInput(e.target.value)}
                    placeholder="655.957"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="w-20">
                  <Input
                    id="fxCurrency"
                    type="text"
                    value={fxCurrencyInput}
                    onChange={(e) => setFxCurrencyInput(e.target.value.toUpperCase())}
                    placeholder="XOF"
                    maxLength={3}
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <span className="text-sm text-muted-foreground">{tr('projectModule.budget.exchangeRateReference')}</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      setFxEditMode(false);
                      setFxRateInput(project.fxRate?.toString() ?? '');
                      setFxCurrencyInput(project.fxCurrency ?? '');
                    }}
                    disabled={isSavingFx}
                  >
                    {tr('common.cancel')}
                  </Button>
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={async () => {
                      const rate = fxRateInput ? parseFloat(fxRateInput.replace(',', '.')) : null;
                      if (fxRateInput && (isNaN(rate!) || rate! <= 0)) {
                        toast({
                          variant: 'destructive',
                          title: tr('projectModule.budget.error'),
                          description: tr('projectModule.fxRatePositive'),
                        });
                        return;
                      }
                      try {
                        await saveFx(projectId, rate, fxCurrencyInput || null);
                        toast({
                          title: tr('projectModule.fxSaved'),
                          description: rate
                            ? tr('projectModule.budget.fxRateSavedDesc')
                                .replace('{rate}', String(rate))
                                .replace('{currency}', fxCurrencyInput)
                            : tr('projectModule.budget.fxRateRemoved'),
                        });
                        setFxEditMode(false);
                        await refreshProject();
                      } catch (err) {
                        toast({
                          variant: 'destructive',
                          title: tr('projectModule.budget.error'),
                          description: err instanceof Error ? err.message : tr('projectModule.budget.errorSavingFxRate'),
                        });
                      }
                    }}
                    disabled={isSavingFx}
                  >
                    {isSavingFx ? <Loader2 className="h-4 w-4 animate-spin" /> : tr('common.save')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">
                  {project.fxRate ? (
                    <><span className="font-mono">{new Intl.NumberFormat('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(project.fxRate)} {project.fxCurrency ?? ''}</span> {tr('projectModule.budget.exchangeRateReference')}</>
                  ) : (
                    <span className="italic">{tr('projectModule.notConfigured')}</span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setFxEditMode(true)}
                  title={tr('projectModule.budget.editFx')}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {tr('projectModule.budget.fxLegacyHelp')}
          </div>
        </div>

        </div>{/* /space-y-4 */}
      </details>

      {/* Estat A: CTA per desglossar en partides */}
      {!hasBudgetLines && !linesLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                {tr('projectModule.budget.noBudgetLinesHint')}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button onClick={openNew} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  {tr('projectModule.budget.createLineManually')}
                </Button>
                <Button onClick={() => setImportWizardOpen(true)} variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  {tr('projectModule.budget.importLinesExcel')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estat B: Taula de partides */}
      {hasBudgetLines && (
        <>
          {/* Resum superior: referència al pressupost global */}
          {totals.globalBudget !== null && (
            <div className="rounded-lg border bg-muted/30 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{tr('projectModule.budget.globalBudgetLabel')}:</span>{' '}
                  <span className="font-medium">{formatAmount(totals.globalBudget)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{tr('projectModule.budget.linesTotalLabel')}:</span>{' '}
                  <span className="font-medium">{formatAmount(totals.budgetedFromLines)}</span>
                </div>
                {totals.budgetedFromLines !== totals.globalBudget && (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    <Info className="h-3 w-3 mr-1" />
                    {tr('projectModule.budget.linesTotalMismatch')}
                  </Badge>
                )}
              </div>
            </div>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>{tr('projectModule.budget.title')}</CardTitle>
              <Button variant="outline" size="sm" onClick={openNew}>
                <Plus className="h-4 w-4 mr-2" />
                {tr('projectModule.addBudgetLine')}
              </Button>
            </CardHeader>
            <CardContent>
              {linesLoading || linksLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : linesError ? (
                <div className="text-center py-8 text-destructive">
                  {tr('projectModule.budget.errorLoadingLines')}: {linesError.message}
                </div>
              ) : isMobile ? (
            <div className="flex flex-col gap-2 p-3">
              {budgetLines.map((line) => {
                const executed = executionByLine.get(line.id) ?? 0;
                const pending = line.budgetedAmountEUR - executed;
                const percentExec = line.budgetedAmountEUR > 0 ? (executed / line.budgetedAmountEUR) * 100 : 0;
                const maxAllowed = line.budgetedAmountEUR * (1 + allowedDeviation / 100);
                const isOverspend = executed > maxAllowed;
                const hasNoExecution = executed === 0;
                const showOverspend = pending < 0;

                return (
                  <MobileListItem
                    key={line.id}
                    title={line.name}
                    leadingIcon={
                      line.code ? (
                        <span className="text-xs font-mono text-muted-foreground">{line.code}</span>
                      ) : (
                        <Hash className="h-4 w-4 text-muted-foreground" />
                      )
                    }
                    badges={[
                      hasNoExecution ? (
                        <Badge key="status" variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                          <Info className="h-2.5 w-2.5 mr-0.5" />
                          {tr('projectModule.budget.noExecShort')}
                        </Badge>
                      ) : isOverspend ? (
                        <Badge key="status" variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                          {tr('projectModule.budget.alert')}
                        </Badge>
                      ) : (
                        <Badge key="status" variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                          <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                          {tr('projectModule.budget.statusOk')}
                        </Badge>
                      )
                    ]}
                    meta={[
                      { label: tr('projectModule.budget.budgetedShort'), value: formatAmount(line.budgetedAmountEUR) },
                      { label: tr('projectModule.budget.executedShort'), value: formatAmount(executed) },
                      { value: formatPercent(percentExec) },
                      ...(showOverspend
                        ? [{ value: <span className="text-red-600 font-medium">+{formatAmount(Math.abs(pending))}</span> }]
                        : []),
                    ]}
                    actions={
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(line)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {tr('projectModule.budget.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteConfirm(line)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {tr('projectModule.budget.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    }
                    onClick={() => handleRowClick(line)}
                  />
                );
              })}
            </div>
          ) : (
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">{tr('projectModule.lineCode')}</TableHead>
                  <TableHead>{tr('projectModule.lineName')}</TableHead>
                  <TableHead className="text-right">{tr('projectModule.budgeted')}</TableHead>
                  <TableHead className="text-right">{tr('projectModule.executed')}</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">{tr('projectModule.pending')}</TableHead>
                  <TableHead className="w-[100px]">{tr('projectModule.status')}</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgetLines.map((line) => {
                  const executed = executionByLine.get(line.id) ?? 0;
                  const pending = line.budgetedAmountEUR - executed; // pendent = pressupostat - executat
                  const percentExec = line.budgetedAmountEUR > 0 ? (executed / line.budgetedAmountEUR) * 100 : 0;

                  // Estat: OK si executat <= pressupostat * (1 + allowedDeviationPct/100)
                  // ALERTA si executat > pressupostat * (1 + allowedDeviationPct/100)
                  // INFO si executat === 0
                  const maxAllowed = line.budgetedAmountEUR * (1 + allowedDeviation / 100);
                  const isOverspend = executed > maxAllowed;
                  const hasNoExecution = executed === 0;

                  // Determinar què mostrar a la columna Pendent/Sobreexecució
                  const showOverspend = pending < 0;

                  return (
                    <TableRow
                      key={line.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(line)}
                    >
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {line.code ?? '-'}
                      </TableCell>
                      <TableCell className="font-medium">{line.name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatAmount(line.budgetedAmountEUR)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatAmount(executed)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPercent(percentExec)}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${showOverspend ? 'text-red-600' : ''}`}>
                        {showOverspend
                          ? `${tr('projectModule.overspend')}: ${formatAmount(Math.abs(pending))}`
                          : formatAmount(pending)}
                      </TableCell>
                      <TableCell>
                        {hasNoExecution ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            <Info className="h-3 w-3 mr-1" />
                            {tr('projectModule.noExecution')}
                          </Badge>
                        ) : isOverspend ? (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {tr('projectModule.budget.alert')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {tr('projectModule.budget.statusOk')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => openEdit(line, e)}
                            title={tr('projectModule.editBudgetLine')}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(line);
                            }}
                            title={tr('projectModule.deleteBudgetLine')}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Form Modal */}
      <BudgetLineForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingLine(null);
        }}
        onSave={handleSave}
        isSaving={isSaving}
        initialData={editingLine}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.projectModule.deleteBudgetLine}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.projectModule.deleteBudgetLineConfirm.replace('{name}', deleteConfirm?.name || '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Quadrar projecte */}
      <BalanceProjectModal
        open={justificationModalOpen}
        onOpenChange={setJustificationModalOpen}
        guidedMode={true}
        project={project}
        budgetLines={budgetLines}
        expenseLinks={expenseLinks}
        allExpenses={allExpensesForModal}
        onSuccess={async () => {
          await refreshLines();
        }}
      />

      {/* Dialog selecció ordre Excel */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {tr('projectModule.exportExcel')}
            </DialogTitle>
            <DialogDescription>
              {tr('projectModule.export.orderMode.label')}
            </DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={exportOrderMode}
            onValueChange={(v) => setExportOrderMode(v as FundingOrderMode)}
            className="space-y-3"
          >
            <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
              <RadioGroupItem value="budgetLineThenChronological" id="order-budget" className="mt-1" />
              <Label htmlFor="order-budget" className="font-medium cursor-pointer">
                {tr('projectModule.export.orderMode.byBudgetLine')}
              </Label>
            </div>

            <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
              <RadioGroupItem value="chronological" id="order-chrono" className="mt-1" />
              <Label htmlFor="order-chrono" className="font-medium cursor-pointer">
                {tr('projectModule.export.orderMode.chronological')}
              </Label>
            </div>
          </RadioGroup>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              {tr('common.cancel')}
            </Button>
            <Button onClick={handleConfirmExportFunding}>
              <Download className="h-4 w-4 mr-2" />
              {tr('projectModule.export.download')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wizard d'importació de pressupost */}
      <BudgetImportWizard
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
        projectId={projectId}
        onComplete={() => {
          refreshLines();
        }}
      />

      {/* Form alta/edició FX Transfer */}
      <FxTransferForm
        open={fxTransferFormOpen}
        onOpenChange={(open) => {
          setFxTransferFormOpen(open);
          if (!open) setEditingFxTransfer(null);
        }}
        onSave={async (data) => {
          try {
            await saveFxTransfer(projectId, data, editingFxTransfer?.id);
            toast({
              title: tr('projectModule.budget.fxTransfersSaved'),
            });
            setFxTransferFormOpen(false);
            setEditingFxTransfer(null);
            await refreshFxTransfers();
          } catch (err) {
            toast({
              variant: 'destructive',
              title: tr('projectModule.budget.error'),
              description: err instanceof Error ? err.message : tr('projectModule.budget.errorSavingTransfer'),
            });
          }
        }}
        isSaving={isSavingFxTransfer}
        initialData={editingFxTransfer}
      />

      {/* Confirmació eliminació FX Transfer */}
      <AlertDialog
        open={!!deleteFxTransferConfirm}
        onOpenChange={(open) => !open && setDeleteFxTransferConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr('projectModule.budget.fxTransfersDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr('projectModule.budget.fxTransfersDeleteWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteFxTransferConfirm) return;
                try {
                  await removeFxTransfer(projectId, deleteFxTransferConfirm.id);
                  toast({
                    title: tr('projectModule.budget.fxTransfersDeleted'),
                  });
                  setDeleteFxTransferConfirm(null);
                  await refreshFxTransfers();
                } catch (err) {
                  toast({
                    variant: 'destructive',
                    title: tr('projectModule.budget.error'),
                    description: err instanceof Error ? err.message : tr('projectModule.budget.errorDeletingTransfer'),
                  });
                }
              }}
            >
              {tr('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmació re-aplicar TC */}
      <AlertDialog open={reapplyConfirmOpen} onOpenChange={setReapplyConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tr('projectModule.budget.fxReapplyConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tr('projectModule.budget.fxReapplyConfirmText')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReapplyFx} disabled={isReapplying}>
              {isReapplying
                ? tr('projectModule.budget.fxReapplyRunning')
                : tr('projectModule.budget.fxReapplyButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
