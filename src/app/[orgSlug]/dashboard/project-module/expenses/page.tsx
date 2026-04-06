// src/app/[orgSlug]/dashboard/project-module/expenses/page.tsx
// Inbox de despeses assignables a projectes

'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { computeFxAmountEUR } from '@/lib/project-module/fx';
import { normalizeAssignments } from '@/lib/project-module/normalize-assignments';
import { useUnifiedExpenseFeed, useProjects, useSaveExpenseLink, useProjectBudgetLines, useUpdateOffBankExpense, useHardDeleteOffBankExpense, useProjectFxTransfers, getEffectiveProjectTC, isFxExpenseNeedingProjectTC, resolveExpenseTC } from '@/hooks/use-project-module';
import { collection, doc, updateDoc, getDoc, getDocs } from 'firebase/firestore';
import { useFirebase, useStorage } from '@/firebase/provider';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useOrgUrl, useCurrentOrganization } from '@/hooks/organization-provider';
import { useToast } from '@/hooks/use-toast';
import { trackUX } from '@/lib/ux/trackUX';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, RefreshCw, ChevronRight, FolderPlus, Check, MoreHorizontal, Split, X, Plus, Landmark, Globe, ArrowLeft, FolderKanban, Filter, Pencil, Trash2, Search, FileText, Upload, Camera, MoreVertical } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { formatDateDMY, formatDateShort } from '@/lib/normalize';
import { AssignmentEditor } from '@/components/project-module/assignment-editor';
import type { ExpenseStatus, UnifiedExpenseWithLink, Project, ExpenseAssignment, BudgetLine, OffBankAttachment, FxTransfer } from '@/lib/project-module-types';
import { useTranslations } from '@/i18n';
import { OffBankExpenseModal } from '@/components/project-module/add-off-bank-expense-modal';
import { buildDocumentFilename } from '@/lib/build-document-filename';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { MobileListItem } from '@/components/mobile/mobile-list-item';
import { usePermissions } from '@/hooks/use-permissions';
import { isExpenseCategoryPending } from '@/lib/project-module/expense-category-pending';

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('ca-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS: Desglossament d'assignacions per badges
// ═══════════════════════════════════════════════════════════════════════════

interface AssignmentBreakdownProject {
  projectId: string;
  projectName: string;
  budgetLineName?: string | null;
  pctInt: number;           // 0..100
  assignedAbsProject: number;
}

interface AssignmentBreakdown {
  totalAbs: number;
  assignedAbs: number;
  freeAbs: number;
  perProject: AssignmentBreakdownProject[];
  isFxMode: boolean;
  corruptData: boolean;
}

/**
 * Normalitza localPct al rang 0..100.
 * - 0 < v <= 1   → v * 100  (assumint que estava en format 0..1)
 * - 1 < v <= 100 → v directament
 * - v > 100 o v < 0 → null (invàlid, es recalcularà per import)
 */
function normalizeLocalPct(v: number | undefined | null, txId?: string): number | null {
  if (v == null) return null;
  if (v < 0 || v > 100) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[P0-DEBUG] localPct fora de rang: ${v} (txId=${txId})`);
    }
    return null;
  }
  if (v > 0 && v <= 1) {
    return Math.round(v * 100);
  }
  return Math.round(v);
}

function computeAssignmentBreakdown(
  expense: { amountEUR: number; originalAmount?: number | null; originalCurrency?: string | null; txId: string },
  assignments: ExpenseAssignment[] | undefined,
): AssignmentBreakdown {
  const isFxMode = expense.originalAmount != null && expense.originalCurrency != null && expense.originalCurrency !== 'EUR';
  const totalAbs = Math.abs(expense.amountEUR);

  if (!assignments || assignments.length === 0) {
    return { totalAbs, assignedAbs: 0, freeAbs: totalAbs, perProject: [], isFxMode, corruptData: false };
  }

  // Intentar usar localPct si totes les assignacions en tenen de fiable
  const normalizedPcts = assignments.map(a => normalizeLocalPct(a.localPct, expense.txId));
  const allHaveLocalPct = normalizedPcts.every(p => p !== null);

  // Calcular assignedAbs per EUR (ignorant nulls)
  const assignedAbs = assignments.reduce((s, a) => s + (a.amountEUR != null ? Math.abs(a.amountEUR) : 0), 0);

  // Decidir denominador per percentatges
  let useDenominator: number;
  let useLocalPct = false;

  if (allHaveLocalPct && isFxMode) {
    // Mode FX amb localPct fiable: usar localPct directament per percentatges
    useLocalPct = true;
    useDenominator = 0; // no cal
  } else if (totalAbs > 0) {
    useDenominator = totalAbs;
  } else if (assignedAbs > 0) {
    // totalAbs === 0 però hi ha assignacions amb EUR: usar assignedAbs com a denominador
    if (process.env.NODE_ENV === 'development') {
      console.error(`[P0-DEBUG] totalAbs=0 però assignedAbs=${assignedAbs} (txId=${expense.txId})`);
    }
    useDenominator = assignedAbs;
  } else {
    // Ni totalAbs ni assignedAbs: dada corrupta
    if (process.env.NODE_ENV === 'development') {
      console.error(`[P0-DEBUG] totalAbs=0, assignedAbs=0 amb ${assignments.length} assignacions (txId=${expense.txId})`, assignments);
    }
    // Última opció: si tenim localPct (fins i tot sense isFxMode), usar-lo
    if (allHaveLocalPct) {
      useLocalPct = true;
      useDenominator = 0;
    } else {
      return { totalAbs, assignedAbs, freeAbs: 0, perProject: [], isFxMode, corruptData: true };
    }
  }

  // Detectar assignedAbs > totalAbs
  if (!useLocalPct && totalAbs > 0 && assignedAbs > totalAbs + 0.01) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[P0-DEBUG] assignedAbs (${assignedAbs}) > totalAbs (${totalAbs}) (txId=${expense.txId})`);
    }
    // Usar assignedAbs com a denominador per obtenir percentatges relatius
    useDenominator = assignedAbs;
  }

  const perProject: AssignmentBreakdownProject[] = assignments.map((a, i) => {
    let pctInt: number;
    let assignedAbsProject: number;

    if (useLocalPct) {
      pctInt = normalizedPcts[i]!;
      assignedAbsProject = a.amountEUR != null ? Math.abs(a.amountEUR) : 0;
    } else {
      assignedAbsProject = a.amountEUR != null ? Math.abs(a.amountEUR) : 0;
      pctInt = useDenominator > 0 ? Math.round((assignedAbsProject / useDenominator) * 100) : 0;
    }

    return {
      projectId: a.projectId,
      projectName: a.projectName,
      budgetLineName: a.budgetLineName,
      pctInt,
      assignedAbsProject,
    };
  });

  const freeAbs = Math.max(0, totalAbs - assignedAbs);

  return { totalAbs, assignedAbs, freeAbs, perProject, isFxMode, corruptData: false };
}

function computeBreakdownLabel(
  breakdown: AssignmentBreakdown,
  projectIdFilter: string | null,
  ep: { breakdownNProjects: (n: number) => string; breakdownNProjectsPcts: (n: number, pcts: string) => string; breakdownInThisProject: (pct: number) => string },
): { label: string; tooltipLines: string[] } | null {
  const { perProject, corruptData } = breakdown;
  if (perProject.length === 0 || corruptData) return null;

  // Si tots els percentatges són 0 (TC pendent), no mostrar parèntesi amb 0
  const allZeroPct = perProject.every(p => p.pctInt === 0);

  const tooltipLines = perProject.map(p =>
    allZeroPct ? p.projectName : `${p.projectName} — ${p.pctInt}%`
  );

  if (projectIdFilter) {
    const pctInProject = perProject
      .filter(p => p.projectId === projectIdFilter)
      .reduce((s, p) => s + p.pctInt, 0);
    if (pctInProject === 0 && allZeroPct) {
      return { label: ep.breakdownInThisProject(0), tooltipLines };
    }
    return { label: ep.breakdownInThisProject(pctInProject), tooltipLines };
  }

  // Si tots 0: mostrar "N proy." sense parèntesi de percentatge
  if (allZeroPct) {
    return { label: ep.breakdownNProjects(perProject.length), tooltipLines };
  }

  if (perProject.length === 1) {
    return { label: ep.breakdownNProjectsPcts(1, `${perProject[0].pctInt}`), tooltipLines };
  }

  if (perProject.length === 2) {
    const pcts = perProject.map(p => `${p.pctInt}`).join('/');
    return { label: ep.breakdownNProjectsPcts(perProject.length, pcts), tooltipLines };
  }

  return { label: ep.breakdownNProjects(perProject.length), tooltipLines };
}

// ═══════════════════════════════════════════════════════════════════════════
// Component per mostrar i gestionar assignacions amb popover + doble badge
// ═══════════════════════════════════════════════════════════════════════════

function AssignmentStatusPopover({
  expense,
  status,
  assignments,
  onRemoveAssignment,
  onUnassignAll,
  onEditAssignment,
  isSaving,
  projectIdFilter,
  ep,
  isCategoryPending = false,
  categoryPendingLabel = 'Categoria pendent',
}: {
  expense: UnifiedExpenseWithLink;
  status: ExpenseStatus;
  assignments?: ExpenseAssignment[];
  onRemoveAssignment: (txId: string, assignmentIndex: number) => Promise<void>;
  onUnassignAll: (txId: string) => Promise<void>;
  onEditAssignment: (expense: UnifiedExpenseWithLink) => void;
  isSaving: boolean;
  projectIdFilter?: string | null;
  ep: { statusUnassigned: string; statusPartial: string; statusAssigned: string; popoverAssigned: string; popoverFree: string; breakdownNProjects: (n: number) => string; breakdownNProjectsPcts: (n: number, pcts: string) => string; breakdownInThisProject: (pct: number) => string };
  isCategoryPending?: boolean;
  categoryPendingLabel?: string;
}) {
  const { tr } = useTranslations();
  const [open, setOpen] = React.useState(false);

  if (isCategoryPending) {
    return (
      <Badge variant="outline" className="h-5 whitespace-nowrap px-1.5 py-0 text-xs bg-amber-50 text-amber-700 border-amber-200">
        {categoryPendingLabel}
      </Badge>
    );
  }

  // Calcular breakdown centralitzat
  const bd = computeAssignmentBreakdown(expense.expense, assignments);

  // Si no té assignacions o dada corrupta sense percentatges
  if (status === 'unassigned' || !assignments || assignments.length === 0 || (bd.corruptData && bd.perProject.length === 0)) {
    return <Badge variant="outline" className="h-5 whitespace-nowrap px-1.5 py-0 text-xs">{ep.statusUnassigned}</Badge>;
  }

  // Badge 1: Estat
  const statusLabel = status === 'assigned' ? ep.statusAssigned : ep.statusPartial;
  const badgeClass = status === 'assigned'
    ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 cursor-pointer';

  // Badge 2: Desglossament
  const breakdownLabel = computeBreakdownLabel(bd, projectIdFilter ?? null, ep);

  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-1">
      {/* Badge 1: Estat — obre el popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Badge variant={status === 'assigned' ? 'default' : 'outline'} className={`${badgeClass} h-5 whitespace-nowrap px-1.5 py-0 text-xs`}>
            {statusLabel}
          </Badge>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="end">
          <div className="p-3 border-b">
            {(() => {
              const isFx = expense.expense.originalAmount != null && expense.expense.originalCurrency;
              const fmt = (v: number) => new Intl.NumberFormat('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
              if (isFx) {
                const localTotal = Math.abs(expense.expense.originalAmount!);
                const cur = expense.expense.originalCurrency!;
                const totalPct = bd.perProject.reduce((s, p) => s + p.pctInt, 0);
                const assignedLocal = localTotal * Math.min(totalPct, 100) / 100;
                const freeLocal = localTotal - assignedLocal;
                return (
                  <div className="flex items-center justify-between text-xs font-mono gap-2">
                    <span className="text-emerald-700">{ep.popoverAssigned} = {fmt(assignedLocal)} {cur}</span>
                    <span className="text-muted-foreground">{ep.popoverFree} = {fmt(freeLocal)} {cur}</span>
                  </div>
                );
              }
              return (
                <div className="flex items-center justify-between text-xs font-mono gap-2">
                  <span className="text-emerald-700">{ep.popoverAssigned} = {formatAmount(bd.assignedAbs)}</span>
                  <span className="text-muted-foreground">{ep.popoverFree} = {formatAmount(bd.freeAbs)}</span>
                </div>
              );
            })()}
          </div>
          <div className={`p-2 space-y-1 ${assignments.length > 3 ? 'max-h-48 overflow-y-auto' : ''}`}>
            {assignments.map((assignment, index) => {
              const isFx = expense.expense.originalAmount != null && expense.expense.originalCurrency;
              const localCurrency = expense.expense.originalCurrency ?? '';
              const localTotal = Math.abs(expense.expense.originalAmount ?? 0);
              const bdProject = bd.perProject[index];

              let displayAmount: string;
              if (isFx && bdProject) {
                const pct = bdProject.pctInt;
                const localForAssignment = localTotal * pct / 100;
                const localFormatted = new Intl.NumberFormat('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(localForAssignment);
                displayAmount = pct > 0 ? `${pct}% · ${localFormatted} ${localCurrency}` : `${localFormatted} ${localCurrency}`;
              } else if (assignment.amountEUR == null) {
                const normPct = normalizeLocalPct(assignment.localPct, expense.expense.txId);
                displayAmount = normPct != null ? `${normPct}%` : 'Sense TC';
              } else if (bdProject && bdProject.pctInt > 0) {
                displayAmount = `${bdProject.pctInt}% · ${formatAmount(Math.abs(assignment.amountEUR))}`;
              } else {
                displayAmount = formatAmount(Math.abs(assignment.amountEUR));
              }

              return (
              <div
                key={`${assignment.projectId}-${assignment.budgetLineId ?? 'none'}-${index}`}
                className="p-2 rounded hover:bg-muted/50 group"
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="text-sm font-medium truncate flex-1 min-w-0">{assignment.projectName}</div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await onRemoveAssignment(expense.expense.txId, index);
                      if (assignments.length === 1) {
                        setOpen(false);
                      }
                    }}
                    disabled={isSaving}
                    aria-label={tr('projectModule.removeAssignment', 'Eliminar assignació')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                {assignment.budgetLineName && (
                  <div className="text-xs text-muted-foreground truncate">
                    {assignment.budgetLineName}
                  </div>
                )}
                <div className="text-xs font-mono text-muted-foreground mt-0.5">
                  {displayAmount}
                </div>
              </div>
              );
            })}
          </div>
          <div className="p-2 border-t flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => {
                setOpen(false);
                onEditAssignment(expense);
              }}
            >
              <Split className="h-3 w-3 mr-1" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs text-destructive hover:text-destructive"
              onClick={async () => {
                await onUnassignAll(expense.expense.txId);
                setOpen(false);
              }}
              disabled={isSaving}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Eliminar tot
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Badge 2: Desglossament — amb tooltip */}
      {breakdownLabel && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="shrink-0 cursor-default whitespace-nowrap px-1.5 py-0 text-[11px] font-medium">
              {breakdownLabel.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[250px]">
            <div className="space-y-0.5 text-xs">
              {breakdownLabel.tooltipLines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

// Component per Quick Assign amb Popover (amb selecció de partida)
function QuickAssignPopover({
  expense,
  projects,
  onAssign100,
  onOpenSplitModal,
  onTcMissing,
  isAssigning,
  assignTooltip,
}: {
  expense: UnifiedExpenseWithLink;
  projects: Project[];
  onAssign100: (txId: string, project: Project, budgetLine?: BudgetLine | null, fxAmountEUR?: number) => Promise<void>;
  onOpenSplitModal: (expense: UnifiedExpenseWithLink) => void;
  onTcMissing?: (project: Project) => void;
  isAssigning: boolean;
  assignTooltip: string;
}) {
  const { tr } = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [selectedProject, setSelectedProject] = React.useState<Project | null>(null);

  // Carregar partides i fxTransfers quan es selecciona un projecte
  const { budgetLines, isLoading: budgetLinesLoading } = useProjectBudgetLines(selectedProject?.id ?? '');
  const { fxTransfers, isLoading: fxLoading } = useProjectFxTransfers(selectedProject?.id ?? '');

  const isFxExpense = isFxExpenseNeedingProjectTC(expense.expense);

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.code && p.code.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setSearch('');
  };

  const handleSelectBudgetLine = async (budgetLine: BudgetLine | null) => {
    if (!selectedProject) return;

    // Si la despesa és FX, computar EUR amb TC (manual o projecte), o null si no n'hi ha
    if (isFxExpense) {
      const tc = resolveExpenseTC(expense.expense, fxTransfers, selectedProject);
      const fxAmountEUR = tc !== null ? expense.expense.originalAmount! * tc : undefined;
      setOpen(false);
      setSelectedProject(null);
      setSearch('');
      await onAssign100(expense.expense.txId, selectedProject, budgetLine, fxAmountEUR);
      return;
    }

    setOpen(false);
    setSelectedProject(null);
    setSearch('');
    await onAssign100(expense.expense.txId, selectedProject, budgetLine);
  };

  const handleBack = () => {
    setSelectedProject(null);
    setSearch('');
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSelectedProject(null);
      setSearch('');
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/40"
              disabled={isAssigning}
              aria-label={assignTooltip}
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{assignTooltip}</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-64 p-0" align="end">
        {!selectedProject ? (
          // Pas 1: Seleccionar projecte
          <Command>
            <CommandInput
              placeholder={tr('projectModule.expenses.bulkAssignSearchPlaceholder', 'Cerca projecte...')}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>{tr('projectModule.expenses.bulkAssignEmpty', 'No s\'han trobat projectes')}</CommandEmpty>
              <CommandGroup heading={tr('projectModule.expenses.bulkAssignHeading', 'Assignar 100% a totes')}>
                {filteredProjects.map((project) => (
                  <CommandItem
                    key={project.id}
                    onSelect={() => handleSelectProject(project)}
                    className="cursor-pointer"
                  >
                    <ChevronRight className="mr-2 h-4 w-4" />
                    <div className="flex-1">
                      <span>{project.name}</span>
                      {project.code && (
                        <span className="ml-2 text-muted-foreground text-xs">({project.code})</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    onOpenSplitModal(expense);
                  }}
                  className="cursor-pointer"
                >
                  <Split className="mr-2 h-4 w-4" />
                  {tr('projectModule.expenses.bulkAssignTitle', 'Assignació múltiple')}...
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          // Pas 2: Seleccionar partida
          <Command>
            <div className="flex items-center border-b px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 mr-2"
                onClick={handleBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium truncate">{selectedProject.name}</span>
            </div>
            <CommandList>
              {(budgetLinesLoading || (isFxExpense && fxLoading)) ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Carregant...
                </div>
              ) : budgetLines.length === 0 ? (
                <CommandGroup heading="Sense partides">
                  <CommandItem
                    onSelect={() => handleSelectBudgetLine(null)}
                    className="cursor-pointer"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Assignar sense partida
                  </CommandItem>
                </CommandGroup>
              ) : (
                <>
                  <CommandGroup heading="Selecciona partida">
                    {budgetLines.map((line) => (
                      <CommandItem
                        key={line.id}
                        onSelect={() => handleSelectBudgetLine(line)}
                        className="cursor-pointer"
                      >
                        <Check className="mr-2 h-4 w-4 opacity-0" />
                        <div className="flex-1">
                          <span>{line.code ? `${line.code} - ` : ''}{line.name}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => handleSelectBudgetLine(null)}
                      className="cursor-pointer text-muted-foreground"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Sense partida
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Component per a fila amb suport drag & drop de documents
interface DroppableExpenseRowProps {
  expense: UnifiedExpenseWithLink;
  children: React.ReactNode;
  onUploadDocument: (expense: UnifiedExpenseWithLink, file: File) => Promise<void>;
  isUploading: boolean;
  isSelected: boolean;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

function DroppableExpenseRow({
  expense,
  children,
  onUploadDocument,
  isUploading,
  isSelected,
}: DroppableExpenseRowProps) {
  const { tr } = useTranslations();
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) {
      setIsDragging(true);
    }
  }, [isUploading]);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = React.useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isUploading) return;

    const files = Array.from(e.dataTransfer.files);
    const validFile = files.find(f =>
      ACCEPTED_TYPES.includes(f.type) || f.type.startsWith('image/')
    );

    if (validFile) {
      await onUploadDocument(expense, validFile);
    }
  }, [expense, onUploadDocument, isUploading]);

  return (
    <TableRow
      className={`group hover:bg-muted/50 transition-colors ${isSelected ? 'bg-muted/30' : ''} ${isDragging ? 'bg-primary/10 ring-2 ring-primary ring-inset' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      {isDragging && (
        <td className="absolute inset-0 flex items-center justify-center bg-primary/5 pointer-events-none z-10">
          <div className="flex items-center gap-2 text-primary font-medium">
            <Upload className="h-5 w-5" />
            <span>{tr('projectModule.expensesPage.dropToUpload', 'Deixa anar per pujar')}</span>
          </div>
        </td>
      )}
    </TableRow>
  );
}

export default function ExpensesInboxPage() {
  const { t, tr } = useTranslations();
  const ep = t.projectModule.expensesPage;
  const statusCategoryPendingLabel = tr('projectModule.expensesPage.statusCategoryPending', 'Categoria pendent');
  const searchParams = useSearchParams();
  const router = useRouter();
  const { buildUrl } = useOrgUrl();
  const { organizationId } = useCurrentOrganization();
  const { canReadBankInProjectes, projectCapability } = usePermissions();
  const { toast } = useToast();
  const storage = useStorage();
  const isMobile = useIsMobile();

  // Llegir filtres de query params
  const projectIdFilter = searchParams.get('projectId');
  const budgetLineIdFilter = searchParams.get('budgetLineId');

  const { expenses, isLoading, isLoadingMore, error, refresh, loadMore, hasMore, isFiltered, usedFallback } = useUnifiedExpenseFeed({
    projectId: projectIdFilter,
    budgetLineId: budgetLineIdFilter,
  });
  const { projects, isLoading: projectsLoading, error: projectsError } = useProjects(true);
  const { save, remove, isSaving } = useSaveExpenseLink();
  const { update: updateOffBankExpense } = useUpdateOffBankExpense();
  const { hardDelete: hardDeleteOffBank, isDeleting: isDeletingOffBank } = useHardDeleteOffBankExpense();
  const { firestore } = useFirebase();

  // Callback: projecte sense TC per despesa FX
  const handleTcMissing = React.useCallback((project: Project) => {
    toast({
      variant: 'destructive',
      title: t.common?.error ?? 'Error',
      description: t.projectModule?.fxNoTcForProject ?? "El projecte no té TC configurat. Afegeix transferències FX al pressupost del projecte.",
    });
  }, [toast, t]);

  // Callback: resolver TC per projecte (one-shot, per al split modal)
  const resolveProjectTC = React.useCallback(async (projectId: string): Promise<number | null> => {
    if (!organizationId) return null;
    const transfersRef = collection(
      firestore,
      'organizations', organizationId,
      'projectModule', '_',
      'projects', projectId,
      'fxTransfers'
    );
    const snapshot = await getDocs(transfersRef);
    const transfers: FxTransfer[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FxTransfer));
    const project = projects.find(p => p.id === projectId);
    if (!project) return null;
    return getEffectiveProjectTC(transfers, project);
  }, [firestore, organizationId, projects]);

  // Estat per controlar loading d'eliminació de document
  const [deletingDocTxId, setDeletingDocTxId] = React.useState<string | null>(null);
  // Estat per controlar uploading de document per drag & drop
  const [uploadingDocTxId, setUploadingDocTxId] = React.useState<string | null>(null);

  // Track page open
  React.useEffect(() => {
    trackUX('expenses.open', {
      filtered: isFiltered,
      projectId: projectIdFilter,
      budgetLineId: budgetLineIdFilter,
    });
  }, [isFiltered, projectIdFilter, budgetLineIdFilter]);

  // Track fallback used
  React.useEffect(() => {
    if (usedFallback) {
      trackUX('expenses.filter.fallback_used', {
        projectId: projectIdFilter,
        budgetLineId: budgetLineIdFilter,
      });
    }
  }, [usedFallback, projectIdFilter, budgetLineIdFilter]);

  // Handler per treure filtre
  const handleClearFilter = () => {
    trackUX('expenses.filter.clear', {
      projectId: projectIdFilter,
      budgetLineId: budgetLineIdFilter,
    });
    router.push(buildUrl('/dashboard/project-module/expenses'));
  };

  // Tradueix el nom de categoria (si és una clau coneguda)
  const getCategoryLabel = (categoryName: string | null): string => {
    if (!categoryName) return '-';
    const translated = (t.categories as Record<string, string>)?.[categoryName];
    return translated ?? categoryName;
  };

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [splitModalExpense, setSplitModalExpense] = React.useState<UnifiedExpenseWithLink | null>(null);
  const [bulkAssignOpen, setBulkAssignOpen] = React.useState(false);
  const [isBulkAssigning, setIsBulkAssigning] = React.useState(false);
  const [addOffBankOpen, setAddOffBankOpen] = React.useState(false);
  const [editOffBankExpense, setEditOffBankExpense] = React.useState<UnifiedExpenseWithLink | null>(null);
  const [deleteConfirmExpense, setDeleteConfirmExpense] = React.useState<UnifiedExpenseWithLink | null>(null);

  // TC del projecte per recàlcul d'edició off-bank FX (R5)
  const [editProjectTC, setEditProjectTC] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!editOffBankExpense?.link?.assignments?.length) {
      setEditProjectTC(null);
      return;
    }
    const projectId = editOffBankExpense.link.assignments[0].projectId;
    resolveProjectTC(projectId).then(tc => setEditProjectTC(tc));
  }, [editOffBankExpense?.link?.assignments, resolveProjectTC]);

  // Filtres locals (cerca + filtre ràpid)
  const [searchQuery, setSearchQuery] = React.useState('');
  type ExpenseTableFilter =
    | 'all'
    | 'withDocument'
    | 'withoutDocument'
    | 'noContact'
    | 'bank'
    | 'offBank'
    | 'assigned'
    | 'unassigned'
    | 'needsReview';
  const [tableFilter, setTableFilter] = React.useState<ExpenseTableFilter>('all');

  React.useEffect(() => {
    if (!canReadBankInProjectes && tableFilter === 'bank') {
      setTableFilter('all');
    }
  }, [canReadBankInProjectes, tableFilter]);

  // Filtratge combinat: tableFilter + searchQuery
  const filteredExpenses = React.useMemo(() => {
    let result = expenses;

    // 1. Filtre per tableFilter
    if (tableFilter !== 'all') {
      result = result.filter(e => {
        const exp = e.expense;
        const categoryPending = isExpenseCategoryPending(exp);
        switch (tableFilter) {
          case 'needsReview':
            return exp.needsReview === true;
          case 'withDocument':
            return !!exp.documentUrl;
          case 'withoutDocument':
            return !exp.documentUrl;
          case 'noContact':
            return !exp.counterpartyName;
          case 'bank':
            return exp.source === 'bank';
          case 'offBank':
            return exp.source === 'offBank';
          case 'assigned':
            return e.status === 'assigned';
          case 'unassigned':
            return e.status === 'unassigned' && !categoryPending;
          default:
            return true;
        }
      });
    }

    // 2. Filtre per searchQuery (case-insensitive)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(e => {
        const exp = e.expense;
        const searchableText = [
          exp.description,
          exp.counterpartyName,
          exp.categoryName,
          String(exp.amountEUR),
          exp.txId,
        ].filter(Boolean).join(' ').toLowerCase();
        return searchableText.includes(query);
      });
    }

    return result;
  }, [expenses, tableFilter, searchQuery]);

  // Quick Assign 100%
  const handleAssign100 = async (txId: string, project: Project, budgetLine?: BudgetLine | null, fxAmountEUR?: number) => {
    const expense = expenses.find(e => e.expense.txId === txId);
    if (!expense) return;

    // Determinar amountEUR (pot ser null per FX sense TC)
    let amountEUR: number | null;

    if (fxAmountEUR !== undefined) {
      // Despesa FX: EUR precomputat pel QuickAssignPopover amb TC (manual o projecte)
      amountEUR = -Math.abs(fxAmountEUR);
    } else if (isFxExpenseNeedingProjectTC(expense.expense)) {
      // Despesa FX sense TC disponible: guardar amb amountEUR = null
      amountEUR = null;
    } else {
      // Despesa EUR normal (bank o off-bank sense FX)
      if (expense.expense.amountEUR === null) {
        toast({
          variant: 'destructive',
          title: t.common?.error ?? 'Error',
          description: t.projectModule?.fxRequiredToAssign ?? "Cal definir l'import EUR",
        });
        return;
      }
      amountEUR = expense.expense.amountEUR; // ja és negatiu
    }

    try {
      const isFx = isFxExpenseNeedingProjectTC(expense.expense);
      const assignments: ExpenseAssignment[] = [{
        projectId: project.id,
        projectName: project.name,
        amountEUR,
        budgetLineId: budgetLine?.id ?? null,
        budgetLineName: budgetLine?.name ?? null,
        ...(isFx ? { localPct: 100 } : {}),
      }];

      await save(txId, assignments, null);
      await refresh();

      const budgetInfo = budgetLine ? ` → ${budgetLine.name}` : '';
      toast({
        title: ep.toastAssigned,
        description: ep.toastAssignedDesc(project.name, budgetInfo),
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: ep.toastError,
        description: err instanceof Error ? err.message : ep.toastErrorAssigning,
      });
    }
  };

  // Split Modal save
  const handleSplitSave = async (assignments: ExpenseAssignment[], note: string | null) => {
    if (!splitModalExpense) return;

    // Normalitzar i validar abans de persistir
    const expData = splitModalExpense.expense;
    const isFx = expData.originalAmount != null
      && expData.originalCurrency != null
      && expData.originalCurrency !== 'EUR';
    const { assignments: normalized, isValid, errors } = normalizeAssignments(assignments, {
      isFx,
      totalAmountEURAbs: Math.abs(expData.amountEUR),
    }, 'preservePartial');

    if (!isValid) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[normalizeAssignments] errors:', errors);
      }
      toast({
        variant: 'destructive',
        title: ep.toastError,
        description: ep.invalidAssignmentToast,
      });
      return;
    }

    try {
      await save(splitModalExpense.expense.txId, normalized, note);
      await refresh();

      // Toast parcial per FX: si la suma de localPct < 100
      const originalAmount = splitModalExpense.expense.originalAmount;
      const originalCurrency = splitModalExpense.expense.originalCurrency;
      if (originalAmount != null && originalCurrency && normalized.length > 0) {
        const totalPct = normalized.reduce((s, a) => s + (a.localPct ?? 0), 0);
        if (totalPct > 0 && totalPct < 100) {
          const remainingPct = 100 - totalPct;
          const remainingLocal = Math.abs(originalAmount) * remainingPct / 100;
          const remainingFormatted = new Intl.NumberFormat('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(remainingLocal);
          setSplitModalExpense(null);
          toast({
            title: tr('projectModule.expensesPage.toastPartialTitle'),
            description: tr('projectModule.expensesPage.toastPartialDesc')
              .replace('{amount}', remainingFormatted)
              .replace('{currency}', originalCurrency)
              .replace('{pct}', String(remainingPct)),
          });
          return;
        }
      }

      setSplitModalExpense(null);
      toast({
        title: ep.toastAssignmentSaved,
        description: ep.toastAssignmentSavedDesc,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: ep.toastError,
        description: err instanceof Error ? err.message : ep.toastErrorSaving,
      });
    }
  };

  // Bulk Assign
  const handleBulkAssign = async (project: Project) => {
    setIsBulkAssigning(true);

    try {
      const selectedExpenses = expenses.filter(
        (e) => selectedIds.has(e.expense.txId) && !isExpenseCategoryPending(e.expense)
      );

      if (selectedExpenses.length === 0) {
        toast({
          variant: 'destructive',
          title: ep.toastError,
          description: `${statusCategoryPendingLabel}. ${tr('projectModule.expensesPage.pendingCategoryHelp', "Classifica el moviment a Moviments abans d'imputar-lo a un projecte.")}`,
        });
        return;
      }

      // Carregar fxTransfers del projecte si hi ha despeses FX
      const hasFxExpenses = selectedExpenses.some(e => isFxExpenseNeedingProjectTC(e.expense));
      let fxTransfers: FxTransfer[] = [];

      if (hasFxExpenses && organizationId) {
        const transfersRef = collection(
          firestore,
          'organizations', organizationId,
          'projectModule', '_',
          'projects', project.id,
          'fxTransfers'
        );
        const snapshot = await getDocs(transfersRef);
        fxTransfers = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FxTransfer));
      }

      let noTcCount = 0;

      for (const expense of selectedExpenses) {
        let amountEUR: number | null;

        if (isFxExpenseNeedingProjectTC(expense.expense)) {
          const tc = resolveExpenseTC(expense.expense, fxTransfers, project);
          if (tc !== null) {
            amountEUR = computeFxAmountEUR(expense.expense.originalAmount!, 100, tc);
          } else {
            amountEUR = null;
            noTcCount++;
          }
        } else {
          if (expense.expense.amountEUR === null) {
            amountEUR = null;
            noTcCount++;
          } else {
            amountEUR = expense.expense.amountEUR;
          }
        }

        const isFx = isFxExpenseNeedingProjectTC(expense.expense);
        const assignments: ExpenseAssignment[] = [{
          projectId: project.id,
          projectName: project.name,
          amountEUR,
          budgetLineId: null,
          budgetLineName: null,
          ...(isFx ? { localPct: 100 } : {}),
        }];
        await save(expense.expense.txId, assignments, null);
      }

      await refresh();
      setSelectedIds(new Set());
      setBulkAssignOpen(false);

      toast({
        title: ep.toastBulkAssigned,
        description: ep.toastBulkAssignedDesc(selectedExpenses.length, project.name) +
          (noTcCount > 0 ? ` ${noTcCount} ${t.projectModule?.fxNoTcSaved ?? 'sense TC (EUR pendent).'}` : ''),
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: ep.toastError,
        description: err instanceof Error ? err.message : ep.toastErrorBulk,
      });
    } finally {
      setIsBulkAssigning(false);
    }
  };

  // Selection handlers
  const toggleSelect = (expense: UnifiedExpenseWithLink) => {
    if (isExpenseCategoryPending(expense.expense)) return;

    const txId = expense.expense.txId;
    const newSet = new Set(selectedIds);
    if (newSet.has(txId)) {
      newSet.delete(txId);
    } else {
      newSet.add(txId);
    }
    setSelectedIds(newSet);
  };

  const selectableExpenses = React.useMemo(
    () => filteredExpenses.filter((item) => !isExpenseCategoryPending(item.expense)),
    [filteredExpenses]
  );
  const selectedVisibleSelectableCount = selectableExpenses.filter((item) => selectedIds.has(item.expense.txId)).length;

  // Handler per obrir edició de despesa off-bank
  const handleEditOffBank = (expense: UnifiedExpenseWithLink) => {
    trackUX('expenses.offBank.edit.open', { expenseId: expense.expense.txId });
    setEditOffBankExpense(expense);
  };

  // Handler per confirmar i executar eliminació definitiva de despesa off-bank
  const handleConfirmDeleteOffBank = async () => {
    if (!deleteConfirmExpense) return;
    const expense = deleteConfirmExpense.expense;
    const offBankId = expense.txId.replace('off_', '');

    try {
      await hardDeleteOffBank({
        id: offBankId,
        attachments: expense.attachments,
        documentUrl: expense.documentUrl,
      });
      setDeleteConfirmExpense(null);
      await refresh();
      trackUX('expenses.offBank.hardDelete', { expenseId: expense.txId });
      toast({ title: tr('projectModule.expensesPage.hardDeleteSuccess', 'Despesa eliminada definitivament') });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: ep.toastError,
        description: err instanceof Error ? err.message : tr('projectModule.expensesPage.hardDeleteError', 'Error eliminant despesa'),
      });
    }
  };

  // Handler per eliminar document/attachments d'una despesa
  const handleDeleteDocument = async (expense: UnifiedExpenseWithLink) => {
    if (!organizationId) return;

    const txId = expense.expense.txId;
    setDeletingDocTxId(txId);

    try {
      if (expense.expense.source === 'offBank') {
        // Off-bank: eliminar attachments (posar array buit)
        const offBankId = txId.replace('off_', '');
        await updateOffBankExpense(offBankId, { attachments: [] });
      } else {
        // Bank: actualitzar document a null
        const txRef = doc(firestore, 'organizations', organizationId, 'transactions', txId);
        await updateDoc(txRef, { document: null });
      }

      await refresh();
      trackUX('expenses.deleteDocument', { txId, source: expense.expense.source });
      toast({
        title: t.movements?.table?.documentDeleted ?? tr('projectModule.expensesPage.documentDeleted', 'Document eliminat'),
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: ep.toastError,
        description: err instanceof Error ? err.message : tr('projectModule.expensesPage.documentDeleteError', 'Error eliminant document'),
      });
    } finally {
      setDeletingDocTxId(null);
    }
  };

  // Handler per pujar document via drag & drop
  const handleUploadDocument = React.useCallback(async (expense: UnifiedExpenseWithLink, file: File) => {
    if (!organizationId) return;

    const txId = expense.expense.txId;
    setUploadingDocTxId(txId);

    try {
      // Generar nom automàtic basat en data i descripció de la despesa
      const fileName = buildDocumentFilename({
        dateISO: expense.expense.date,
        concept: expense.expense.description || 'document',
        originalName: file.name,
      });

      if (expense.expense.source === 'offBank') {
        // Off-bank: afegir a attachments[]
        const offBankId = txId.replace('off_', '');
        const storagePath = `organizations/${organizationId}/offBankExpenses/${offBankId}/${fileName}`;
        const storageRef = ref(storage, storagePath);
        const uploadResult = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(uploadResult.ref);

        const newAttachment: OffBankAttachment = {
          url: downloadURL,
          name: fileName,
          contentType: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString().split('T')[0],
        };

        // Afegir al array existent (o crear-ne un de nou)
        const existingAttachments = expense.expense.attachments ?? [];
        await updateOffBankExpense(offBankId, {
          attachments: [...existingAttachments, newAttachment],
        });
      } else {
        // Bank: actualitzar document (objecte amb url, name, storagePath)
        const storagePath = `organizations/${organizationId}/transactions/${txId}/${fileName}`;
        const storageRef = ref(storage, storagePath);
        const uploadResult = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(uploadResult.ref);

        const txRef = doc(firestore, 'organizations', organizationId, 'transactions', txId);
        await updateDoc(txRef, {
          document: {
            url: downloadURL,
            name: fileName,
            storagePath: storagePath,
          },
        });
      }

      await refresh();
      trackUX('expenses.uploadDocument', { txId, source: expense.expense.source });
      toast({
        title: tr('projectModule.expensesPage.documentUploaded', 'Document pujat'),
        description: file.name,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: ep.toastError,
        description: err instanceof Error ? err.message : tr('projectModule.expensesPage.documentUploadError', 'Error pujant document'),
      });
    } finally {
      setUploadingDocTxId(null);
    }
  }, [organizationId, storage, firestore, updateOffBankExpense, refresh, toast, t, ep]);

  // Handler per des-assignar completament (amb confirmació)
  const handleUnassign = async (txId: string) => {
    if (!confirm(ep.confirmUnassign)) return;
    await handleUnassignAll(txId);
  };

  // Handler per des-assignar completament (sense confirmació, per ús des del popover)
  const handleUnassignAll = async (txId: string) => {
    try {
      await remove(txId);
      await refresh();
      trackUX('expenses.unassign', { txId });
      toast({
        title: ep.toastUnassigned,
        description: ep.toastUnassignedDesc,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: ep.toastError,
        description: err instanceof Error ? err.message : ep.toastErrorRemoving,
      });
    }
  };

  // Handler per eliminar una assignació específica (per index)
  const handleRemoveSingleAssignment = async (txId: string, assignmentIndex: number) => {
    // Buscar la despesa per obtenir les assignacions actuals
    const expenseItem = expenses.find(e => e.expense.txId === txId);
    if (!expenseItem?.link?.assignments) return;

    const currentAssignments = expenseItem.link.assignments;

    // Si només queda una assignació, eliminar tot el link
    if (currentAssignments.length <= 1) {
      await handleUnassignAll(txId);
      return;
    }

    // Filtrar l'assignació per índex
    const newAssignments = currentAssignments.filter((_, idx) => idx !== assignmentIndex);

    // Normalitzar: preservar parcial (no redistribuir), validar coherència
    const expData = expenseItem.expense;
    const isFx = expData.originalAmount != null
      && expData.originalCurrency != null
      && expData.originalCurrency !== 'EUR';
    const { assignments: normalized, isValid, errors } = normalizeAssignments(newAssignments, {
      isFx,
      totalAmountEURAbs: Math.abs(expData.amountEUR),
    }, 'preservePartial');

    if (!isValid) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[normalizeAssignments] errors:', errors);
      }
      toast({
        variant: 'destructive',
        title: ep.toastError,
        description: ep.invalidAssignmentToast,
      });
      return;
    }

    try {
      await save(txId, normalized, expenseItem.link.note, expenseItem.link.justification);
      await refresh();
      trackUX('expenses.removeAssignment', { txId, assignmentIndex });
      toast({
        title: ep.toastAssignmentRemoved,
        description: ep.toastAssignmentRemovedDesc,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: ep.toastError,
        description: err instanceof Error ? err.message : ep.toastErrorRemoving,
      });
    }
  };

  const toggleSelectAll = () => {
    if (selectedVisibleSelectableCount === selectableExpenses.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableExpenses.map((e) => e.expense.txId)));
    }
  };

  const hasSelection = selectedIds.size > 0;
  const allSelected = selectableExpenses.length > 0 && selectedVisibleSelectableCount === selectableExpenses.length;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive font-medium">{ep.errorLoading}</p>
        <p className="text-muted-foreground text-sm">{error.message}</p>
        <Button onClick={() => window.location.reload()} variant="outline">
          {ep.retry}
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-6 pb-24 md:pb-0">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={buildUrl('/dashboard/project-module/projects')}>
                {t.breadcrumb?.projects ?? 'Projectes'}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t.breadcrumb?.expenseAssignment ?? 'Assignació de despeses'}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline">{ep.title}</h1>
          <p className="text-muted-foreground">
            {ep.subtitle}
          </p>
        </div>
        {/* Mobile: CTA + dropdown menu */}
        {isMobile ? (
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => setAddOffBankOpen(true)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t.projectModule?.addExpense ?? 'Afegir despesa'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full">
                  <MoreVertical className="h-4 w-4 mr-2" />
                  {'Més accions'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => router.push(buildUrl('/quick-expense'))}>
                  <Camera className="h-4 w-4 mr-2" />
                  {t.projectModule?.quickExpenseTooltip ?? 'Despesa ràpida'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(buildUrl('/dashboard/project-module/projects'))}>
                  <FolderKanban className="h-4 w-4 mr-2" />
                  {t.breadcrumb?.projects ?? 'Projectes'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTableFilter(tableFilter === 'needsReview' ? 'all' : 'needsReview')}>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {t.projectModule.pendingReview}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          /* Desktop: row of buttons */
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => router.push(buildUrl('/quick-expense'))}
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t.projectModule?.quickExpenseTooltip ?? 'Registrar una despesa ràpidament des del mòbil (foto del rebut)'}
              </TooltipContent>
            </Tooltip>
            <Button
              onClick={() => setAddOffBankOpen(true)}
              variant="default"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t.projectModule?.addExpense ?? 'Afegir despesa'}
            </Button>
            {projectCapability === 'manage' && (
              <Link href={buildUrl('/dashboard/project-module/projects')}>
                <Button variant="outline" size="sm">
                  <FolderKanban className="h-4 w-4 mr-2" />
                  {t.breadcrumb?.projects ?? 'Projectes'}
                </Button>
              </Link>
            )}
            <Button
              onClick={() => setTableFilter(tableFilter === 'needsReview' ? 'all' : 'needsReview')}
              variant={tableFilter === 'needsReview' ? 'default' : 'outline'}
              size="sm"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              {t.projectModule.pendingReview}
            </Button>
          </div>
        )}
      </div>

      {/* Barra de cerca i filtres */}
      <div className="flex flex-col gap-3">
        {/* Cercador */}
        <div className="relative w-full md:max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={ep.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filtres ràpids - Select on mobile, buttons on desktop */}
        {isMobile ? (
          <Select
            value={tableFilter}
            onValueChange={(value) => setTableFilter(value as ExpenseTableFilter)}
          >
            <SelectTrigger className="w-full">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ep.filterAll} ({expenses.length})</SelectItem>
              <SelectItem value="withoutDocument">{ep.filterWithoutDocument}</SelectItem>
              <SelectItem value="unassigned">{ep.filterUnassigned}</SelectItem>
              <SelectItem value="offBank">{ep.filterOffBank}</SelectItem>
              {canReadBankInProjectes && <SelectItem value="bank">{ep.filterBank}</SelectItem>}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex gap-2 items-center flex-wrap">
            <Button
              variant={tableFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTableFilter('all')}
            >
              {ep.filterAll} ({expenses.length})
            </Button>
            <Button
              variant={tableFilter === 'withoutDocument' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTableFilter('withoutDocument')}
            >
              {ep.filterWithoutDocument}
            </Button>
            <Button
              variant={tableFilter === 'unassigned' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTableFilter('unassigned')}
            >
              {ep.filterUnassigned}
            </Button>
            <Button
              variant={tableFilter === 'offBank' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTableFilter('offBank')}
            >
              <Globe className="h-4 w-4 mr-1" />
              {ep.filterOffBank}
            </Button>
            {canReadBankInProjectes && (
              <Button
                variant={tableFilter === 'bank' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTableFilter('bank')}
              >
                <Landmark className="h-4 w-4 mr-1" />
                {ep.filterBank}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Franja de filtre actiu */}
      {isFiltered && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {t.projectModule?.filtered ?? 'Filtrat'}
            </span>
            {budgetLineIdFilter && (
              <span className="text-muted-foreground">
                ({t.projectModule?.byBudgetLine ?? 'per partida'})
              </span>
            )}
            {projectIdFilter && !budgetLineIdFilter && (
              <span className="text-muted-foreground">
                ({t.projectModule?.byProject ?? 'per projecte'})
              </span>
            )}
            {!isLoading && (
              <span className="text-muted-foreground">
                · {expenses.length} {ep.filterResults(expenses.length)}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilter}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            {t.projectModule?.clearFilter ?? 'Treure filtre'}
          </Button>
        </div>
      )}

      {/* Vista mòbil */}
      {isMobile ? (
        <div className="flex flex-col gap-2">
          {isLoading && filteredExpenses.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={`skeleton-${i}`} className="border border-border/50 rounded-lg p-3">
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              {tableFilter !== 'all' || searchQuery
                ? ep.filterNoResults
                : t.projectModule.noEligibleExpenses}
            </div>
          ) : (
            filteredExpenses.map((item) => {
              const { expense, status } = item;
              const categoryPending = isExpenseCategoryPending(expense);
              const mobileBd = computeAssignmentBreakdown(expense, item.link?.assignments);
              const mobileBreakdown = computeBreakdownLabel(mobileBd, projectIdFilter, ep);

              return (
                <MobileListItem
                  key={expense.txId}
                  title={expense.description || '-'}
                  leadingIcon={
                    expense.source === 'bank'
                      ? <Landmark className="h-4 w-4" />
                      : <Globe className="h-4 w-4 text-blue-500" />
                  }
                  badges={[
                    <Badge
                      key="status"
                      variant={!categoryPending && status === 'assigned' ? 'default' : 'outline'}
                      className={
                        categoryPending
                          ? 'h-5 whitespace-nowrap px-1.5 py-0 text-xs bg-amber-50 text-amber-700 border-amber-200'
                          : status === 'assigned'
                          ? 'h-5 whitespace-nowrap px-1.5 py-0 text-xs bg-emerald-600'
                          : status === 'partial'
                          ? 'h-5 whitespace-nowrap px-1.5 py-0 text-xs bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'h-5 whitespace-nowrap px-1.5 py-0 text-xs'
                      }
                    >
                      {categoryPending
                        ? statusCategoryPendingLabel
                        : status === 'assigned'
                        ? ep.statusAssigned
                        : status === 'partial'
                        ? ep.statusPartial
                        : ep.statusUnassigned}
                    </Badge>,
                    mobileBreakdown && (
                      <Badge key="breakdown" variant="outline" className="shrink-0 whitespace-nowrap px-1.5 py-0 text-[11px] font-medium">
                        {mobileBreakdown.label}
                      </Badge>
                    ),
                  ].filter(Boolean)}
                  meta={[
                    { value: formatDateShort(expense.date) },
                    {
                      value: isFxExpenseNeedingProjectTC(expense) && expense.originalAmount
                        ? <span className="font-mono font-medium text-red-600">{expense.originalAmount.toLocaleString('ca-ES')} {expense.originalCurrency}</span>
                        : expense.amountEUR !== 0
                          ? <span className="font-mono font-medium text-red-600">{formatAmount(expense.amountEUR)}</span>
                          : <span className="text-amber-600">{tr('projectModule.expensesPage.pendingAmount', 'Import pendent')}</span>
                    },
                    expense.counterpartyName && { value: expense.counterpartyName },
                  ].filter(Boolean) as { label?: string; value: React.ReactNode }[]}
                  actions={
                    <div className="flex items-center gap-1">
                      {expense.documentUrl && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(expense.documentUrl!, '_blank', 'noopener,noreferrer');
                              }}
                              aria-label={ep.tooltipOpenDocument}
                            >
                              <FileText className="h-4 w-4 fill-current text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{ep.tooltipOpenDocument}</TooltipContent>
                        </Tooltip>
                      )}
                      {/* Assignar (per-projecte TC check al popover) */}
                      {!projectsLoading && projects.length > 0 && status === 'unassigned' && !categoryPending && (
                        expense.amountEUR !== null || isFxExpenseNeedingProjectTC(expense)
                      ) && (
                        <QuickAssignPopover
                          expense={item}
                          projects={projects}
                          onAssign100={handleAssign100}
                          onOpenSplitModal={setSplitModalExpense}
                          onTcMissing={handleTcMissing}
                          isAssigning={isSaving}
                          assignTooltip={t.projectModule?.assignToProject ?? 'Assignar a projecte'}
                        />
                      )}
                      {/* Indicador moneda FX (informatiu, no bloquejant) */}
                      {status === 'unassigned' && isFxExpenseNeedingProjectTC(expense) && expense.amountEUR === null && (
                        <span className="text-[10px] text-blue-600 px-1 font-medium">
                          {expense.originalCurrency}
                        </span>
                      )}
                      {/* Editar despesa off-bank */}
                      {expense.source === 'offBank' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditOffBank(item)}
                              aria-label={t.projectModule?.editExpense ?? 'Editar despesa'}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t.projectModule?.editExpense ?? 'Editar despesa'}</TooltipContent>
                        </Tooltip>
                      )}
                      {/* Eliminar despesa off-bank */}
                      {expense.source === 'offBank' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteConfirmExpense(item)}
                              disabled={isDeletingOffBank}
                              aria-label="Eliminar despesa"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Eliminar despesa</TooltipContent>
                        </Tooltip>
                      )}
                      {/* Detall despesa bank */}
                      {expense.source === 'bank' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link href={buildUrl(`/dashboard/project-module/expenses/${expense.txId}`)}>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t.projectModule?.viewDetail ?? 'Veure detall'}>
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent>{t.projectModule?.viewDetail ?? 'Veure detall'}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  }
                  onClick={expense.source === 'bank'
                    ? () => router.push(buildUrl(`/dashboard/project-module/expenses/${expense.txId}`))
                    : () => handleEditOffBank(item)
                  }
                />
              );
            })
          )}
        </div>
      ) : (
        /* Vista desktop - Taula amb jerarquia de columnes responsive */
        <div className="w-full rounded-lg border">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[36px] px-2">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label={ep.tableSelectAll}
                    disabled={selectableExpenses.length === 0}
                  />
                </TableHead>
                <TableHead className="w-[40px] px-1 text-center">{ep.tableDoc}</TableHead>
                <TableHead className="w-[80px] px-2">{ep.tableDate}</TableHead>
                <TableHead className="px-2">{ep.tableDescription}</TableHead>
                <TableHead className="hidden xl:table-cell w-[160px] px-2 2xl:w-[190px]">{tr('projectModule.expensesPage.tableCounterparty', 'Proveïdor')}</TableHead>
                <TableHead className="text-right px-2 w-[100px]">{ep.tableAmount}</TableHead>
                <TableHead className="w-[200px] px-2 2xl:w-[220px]">{ep.tableStatus}</TableHead>
                <TableHead className="w-[90px] px-1"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && filteredExpenses.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="px-2"><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell className="px-1"><Skeleton className="h-3 w-3 rounded-full mx-auto" /></TableCell>
                    <TableCell className="px-2"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="px-2"><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell className="hidden xl:table-cell px-2"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="px-2"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell className="px-2"><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell className="px-1"><Skeleton className="h-7 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    {tableFilter !== 'all' || searchQuery
                      ? ep.filterNoResults
                      : t.projectModule.noEligibleExpenses}
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((item) => {
                  const { expense, status } = item;
                  const isSelected = selectedIds.has(expense.txId);
                  const isUploading = uploadingDocTxId === expense.txId;
                  const categoryPending = isExpenseCategoryPending(expense);

                  return (
                    <DroppableExpenseRow
                      key={expense.txId}
                      expense={item}
                      onUploadDocument={handleUploadDocument}
                      isUploading={isUploading}
                      isSelected={isSelected}
                    >
                      {/* Checkbox */}
                      <TableCell className="px-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(item)}
                          aria-label={`${ep.tableSelectExpense} ${expense.txId}`}
                          disabled={categoryPending}
                        />
                      </TableCell>

                      {/* Document - sempre visible com a Moviments */}
                      <TableCell className="px-1 text-center">
                        {isUploading ? (
                          <RefreshCw className="h-3 w-3 animate-spin text-primary inline-block" />
                        ) : deletingDocTxId === expense.txId ? (
                          <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground inline-block" />
                        ) : expense.documentUrl ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => window.open(expense.documentUrl!, '_blank', 'noopener,noreferrer')}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted/40"
                              >
                                <FileText className="h-[18px] w-[18px] fill-current text-foreground/80" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>{ep.tooltipOpenDocument}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground/30">
                                <FileText className="h-[18px] w-[18px]" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{ep.tooltipNoDocument}</TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>

                      {/* Data */}
                      <TableCell className="px-2 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateShort(expense.date)}
                      </TableCell>

                      {/* Descripció - amb info secundària inline en < xl */}
                      <TableCell className="px-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {/* Icona font */}
                          {expense.source === 'bank' ? (
                            <Landmark className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <Globe className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] truncate max-w-[min(42vw,36rem)]" title={expense.description || undefined}>
                              {expense.description || '-'}
                            </div>
                            {/* Contrapart en línia secundària */}
                            <div className="xl:hidden flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              {expense.counterpartyName && (
                                <span className="truncate max-w-[180px]">{expense.counterpartyName}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Proveïdor - visible només en xl+ */}
                      <TableCell className="hidden xl:table-cell px-2 text-[13px] text-muted-foreground max-w-[160px] truncate 2xl:max-w-[190px]">
                        {expense.counterpartyName || '-'}
                      </TableCell>

                      {/* Import */}
                      <TableCell className="px-2 text-right text-[13px] whitespace-nowrap tabular-nums">
                        {isFxExpenseNeedingProjectTC(expense) && expense.originalAmount ? (
                          <span className="text-red-600 font-medium">
                            {expense.originalAmount.toLocaleString('ca-ES')} {expense.originalCurrency}
                          </span>
                        ) : expense.amountEUR !== 0 ? (
                          <span className="text-red-600 font-medium">{formatAmount(expense.amountEUR)}</span>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                            Pendent
                          </Badge>
                        )}
                      </TableCell>

                      {/* Estat */}
                      <TableCell className="px-2 align-middle">
                        <AssignmentStatusPopover
                          expense={item}
                          status={status}
                          assignments={item.link?.assignments}
                          onRemoveAssignment={handleRemoveSingleAssignment}
                          onUnassignAll={handleUnassignAll}
                          onEditAssignment={setSplitModalExpense}
                          isSaving={isSaving}
                          projectIdFilter={projectIdFilter}
                          ep={ep}
                          isCategoryPending={categoryPending}
                          categoryPendingLabel={statusCategoryPendingLabel}
                        />
                      </TableCell>

                      {/* Accions */}
                      <TableCell className="px-1">
                        <div className="flex items-center gap-0.5 justify-end">
                          {!projectsLoading && projects.length > 0 && status === 'unassigned' && !categoryPending && (
                            expense.amountEUR !== null || isFxExpenseNeedingProjectTC(expense)
                          ) && (
                            <QuickAssignPopover
                              expense={item}
                              projects={projects}
                              onAssign100={handleAssign100}
                              onOpenSplitModal={setSplitModalExpense}
                              onTcMissing={handleTcMissing}
                              isAssigning={isSaving}
                              assignTooltip={t.projectModule?.assignToProject ?? 'Assignar a projecte'}
                            />
                          )}
                          {/* Indicador moneda FX (informatiu, no bloquejant) */}
                          {status === 'unassigned' && isFxExpenseNeedingProjectTC(expense) && expense.amountEUR === null && (
                            <span className="text-[10px] text-blue-600 px-1 font-medium">
                              {expense.originalCurrency}
                            </span>
                          )}
                          {expense.source === 'offBank' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  onClick={() => handleEditOffBank(item)}
                                  aria-label={t.projectModule?.editExpense ?? 'Editar despesa'}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t.projectModule?.editExpense ?? 'Editar despesa'}</TooltipContent>
                            </Tooltip>
                          )}
                          {expense.source === 'offBank' && expense.documentUrl && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteDocument(item)}
                                  aria-label={t.movements?.table?.deleteDocument ?? 'Eliminar document'}
                                >
                                  <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
                                    <FileText className="h-3.5 w-3.5" />
                                    <span className="pointer-events-none absolute h-[1.5px] w-4 rotate-[-45deg] rounded-full bg-current" />
                                  </span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t.movements?.table?.deleteDocument ?? 'Eliminar document'}</TooltipContent>
                            </Tooltip>
                          )}
                          {expense.source === 'offBank' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => setDeleteConfirmExpense(item)}
                                  disabled={isDeletingOffBank}
                                  aria-label="Eliminar despesa"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Eliminar despesa</TooltipContent>
                            </Tooltip>
                          )}
                          {expense.source === 'bank' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Link href={buildUrl(`/dashboard/project-module/expenses/${expense.txId}`)}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    aria-label={t.projectModule?.viewDetail ?? 'Veure detall'}
                                  >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  </Button>
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent>{t.projectModule?.viewDetail ?? 'Veure detall'}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </DroppableExpenseRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {isLoading && expenses.length > 0 && (
        <div className="flex justify-center py-4">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Botó carregar més (només si no hi ha filtres locals) */}
      {!isLoading && hasMore && !isFiltered && tableFilter === 'all' && !searchQuery && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Carregant...
              </>
            ) : (
              <>
                Carregar més
              </>
            )}
          </Button>
        </div>
      )}

      {/* Barra inferior per bulk assign */}
      {hasSelection && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 shadow-lg z-50">
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">
                {selectedIds.size} despesa{selectedIds.size > 1 ? 's' : ''} seleccionada{selectedIds.size > 1 ? 'es' : ''}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                <X className="h-4 w-4 mr-1" />
                Deseleccionar
              </Button>
            </div>
            <Popover open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
              <PopoverTrigger asChild>
                <Button disabled={isBulkAssigning || projectsLoading}>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  {isBulkAssigning ? 'Assignant...' : 'Assignar a projecte...'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="end">
                <Command>
                  <CommandInput placeholder={tr('projectModule.expenses.bulkAssignSearchPlaceholder', 'Cerca projecte...')} />
                  <CommandList>
                    <CommandEmpty>{tr('projectModule.expenses.bulkAssignEmpty', 'No s\'han trobat projectes')}</CommandEmpty>
                    <CommandGroup heading={tr('projectModule.expenses.bulkAssignHeading', 'Assignar 100% a totes')}>
                      {projects.map((project) => (
                        <CommandItem
                          key={project.id}
                          onSelect={() => handleBulkAssign(project)}
                          className="cursor-pointer"
                        >
                          <Check className="mr-2 h-4 w-4 opacity-0" />
                          <div className="flex-1">
                            <span>{project.name}</span>
                            {project.code && (
                              <span className="ml-2 text-muted-foreground text-xs">({project.code})</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      {/* Split Modal */}
      <Dialog open={!!splitModalExpense} onOpenChange={(open) => !open && setSplitModalExpense(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[min(96vw,72rem)] overflow-y-auto sm:w-[min(calc(100vw-3rem),72rem)]">
          <DialogHeader>
            <DialogTitle>{tr('projectModule.expenses.bulkAssignTitle', 'Assignació múltiple')}</DialogTitle>
            <DialogDescription>
              {tr('projectModule.expenses.bulkAssignDescription', 'Distribueix la despesa entre diversos projectes')}
            </DialogDescription>
          </DialogHeader>
          {splitModalExpense && (() => {
            const isFx = isFxExpenseNeedingProjectTC(splitModalExpense.expense);
            return (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{tr('projectModule.expenses.totalAmount', 'Import total')}</span>
                    <span className="font-mono font-medium text-red-600">
                      {isFx
                        ? `${splitModalExpense.expense.originalAmount?.toLocaleString('ca-ES')} ${splitModalExpense.expense.originalCurrency}`
                        : formatAmount(splitModalExpense.expense.amountEUR)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDateDMY(splitModalExpense.expense.date)} · {splitModalExpense.expense.description || '-'}
                  </div>
                </div>
                <AssignmentEditor
                  projects={projects}
                  projectsLoading={projectsLoading}
                  projectsError={projectsError}
                  currentAssignments={splitModalExpense.link?.assignments ?? []}
                  currentNote={splitModalExpense.link?.note ?? null}
                  totalAmount={Math.abs(splitModalExpense.expense.amountEUR)}
                  onSave={handleSplitSave}
                  onCancel={() => setSplitModalExpense(null)}
                  isSaving={isSaving}
                  createProjectUrl={buildUrl('/dashboard/project-module/projects/new')}
                  fxMode={isFx}
                  originalAmount={isFx ? (splitModalExpense.expense.originalAmount ?? undefined) : undefined}
                  originalCurrency={isFx ? (splitModalExpense.expense.originalCurrency ?? undefined) : undefined}
                  expenseFxRate={isFx ? (splitModalExpense.expense.fxRate ?? null) : undefined}
                  resolveProjectTC={isFx ? resolveProjectTC : undefined}
                />
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Add Off-Bank Expense Modal */}
      <OffBankExpenseModal
        open={addOffBankOpen}
        onOpenChange={setAddOffBankOpen}
        onSuccess={refresh}
        mode="create"
        organizationId={organizationId ?? ''}
      />

      {/* Edit Off-Bank Expense Modal */}
      <OffBankExpenseModal
        open={!!editOffBankExpense}
        onOpenChange={(open) => !open && setEditOffBankExpense(null)}
        onSuccess={() => {
          setEditOffBankExpense(null);
          refresh();
        }}
        mode="edit"
        expenseId={editOffBankExpense?.expense.txId.replace('off_', '')}
        organizationId={organizationId ?? ''}
        initialValues={editOffBankExpense ? {
          date: editOffBankExpense.expense.date,
          amountEUR: editOffBankExpense.expense.amountEUR !== 0
            ? Math.abs(editOffBankExpense.expense.amountEUR).toString().replace('.', ',')
            : '',
          concept: editOffBankExpense.expense.description ?? '',
          counterpartyName: editOffBankExpense.expense.counterpartyName ?? '',
          categoryName: editOffBankExpense.expense.categoryName ?? '',
          // FX
          currency: editOffBankExpense.expense.originalCurrency ?? undefined,
          amountOriginal: editOffBankExpense.expense.originalAmount?.toString().replace('.', ',') ?? undefined,
          fxRateOverride: editOffBankExpense.expense.fxRate?.toString() ?? undefined,
          useFxOverride: !!editOffBankExpense.expense.fxRate,
          // Justificació
          invoiceNumber: editOffBankExpense.expense.invoiceNumber ?? undefined,
          issuerTaxId: editOffBankExpense.expense.issuerTaxId ?? undefined,
          invoiceDate: editOffBankExpense.expense.invoiceDate ?? undefined,
          paymentDate: editOffBankExpense.expense.paymentDate ?? undefined,
          // Attachments
          attachments: editOffBankExpense.expense.attachments ?? undefined,
          needsReview: editOffBankExpense.expense.needsReview ?? undefined,
        } : undefined}
        existingAssignments={editOffBankExpense?.link?.assignments}
        projectFxRate={editProjectTC}
      />

      {/* Confirmació eliminació definitiva off-bank */}
      <AlertDialog open={!!deleteConfirmExpense} onOpenChange={() => setDeleteConfirmExpense(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr('projectModule.expenses.deleteConfirmTitle', 'Eliminar despesa definitivament?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr('projectModule.expenses.deleteConfirmDescription', 'Aquesta acció és irreversible. S\'eliminaran la despesa, les assignacions a projectes i els documents adjunts.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingOffBank}>{t.common?.cancel ?? 'Cancel·lar'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteOffBank}
              disabled={isDeletingOffBank}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingOffBank
                ? tr('projectModule.expenses.deleteConfirming', 'Eliminant…')
                : tr('projectModule.expenses.deletePermanent', 'Eliminar definitivament')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}
