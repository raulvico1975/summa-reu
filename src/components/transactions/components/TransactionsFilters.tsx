'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sparkles,
  Info,
  Square,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import type { SourceFilter } from '@/lib/constants';
import { FiltersSheet } from './FiltersSheet';

// =============================================================================
// TYPES
// =============================================================================

export type TableFilter =
  | 'all'
  | 'missing'
  | 'returns'
  | 'pendingReturns'
  | 'pendingRemittances'
  | 'pendingIndividuals'
  | 'uncategorized'
  | 'noContact'
  | 'donationsNoContact'
  | 'fiscalPending'
  | 'income'
  | 'expenses'
  | 'expensesWithoutDoc'
  | 'operatingExpenses'
  | 'missionTransfers'
  | 'donations'
  | 'memberFees';

interface TransactionsFiltersProps {
  currentFilter: TableFilter;
  onFilterChange: (filter: TableFilter) => void;
  totalCount: number;
  returnsCount: number;
  pendingReturnsCount: number;
  expensesWithoutDocCount: number;
  uncategorizedCount: number;
  noContactCount: number;
  donationsNoContactCount: number;
  hasUncategorized: boolean;
  canExecuteAiCategorization: boolean;
  isBatchCategorizing: boolean;
  onBatchCategorize: () => void;
  onCancelBatch?: () => void;
  onExportExpensesWithoutDoc: () => void;
  onOpenReturnImporter?: () => void;
  // Source filter
  sourceFilter: SourceFilter;
  onSourceFilterChange: (filter: SourceFilter) => void;
  // Bank account filter
  bankAccountFilter: string;
  onBankAccountFilterChange: (accountId: string) => void;
  // Bulk mode (SuperAdmin only)
  isSuperAdmin?: boolean;
  isBulkMode?: boolean;
  onBulkModeChange?: (enabled: boolean) => void;
  batchProgress?: { current: number; total: number } | null;
  // Show archived transactions (SuperAdmin only)
  showArchived?: boolean;
  onShowArchivedChange?: (enabled: boolean) => void;
  t: {
    categorizeAll: string;
    all: string;
    returns: string;
    pendingReturns: string;
    withoutDocument: string;
    uncategorized: string;
    noContact: string;
    donationsNoContact: string;
    pendingFilters: string;
    exportTooltip: string;
    importReturnsFile?: string;
    allAccounts: string;
    // New translations for reorganized UI
    filtersTitle: string;
    filtersDescription: string;
    clearFilters: string;
    applyFilters: string;
    filterByType: string;
    filterBySource: string;
    filterByAccount: string;
    pendingTasks: string;
    // Quick filters (shortcuts)
    onlyExpenses?: string;
    expensesWithoutDocument?: string;
    expensesWithoutDocumentTooltip?: string;
    // Batch categorization controls
    stopProcessAriaLabel?: string;
    stopButton?: string;
    stopProcessTooltip?: string;
    suggestCategoriesAriaLabel?: string;
    suggestCategoriesTooltip?: string;
    // Bulk mode controls (SuperAdmin)
    bulkModeAriaLabel?: string;
    bulkModeLabel?: string;
    bulkModeTooltip?: string;
    // Archived toggle (SuperAdmin)
    showArchivedAriaLabel?: string;
    showArchivedLabel?: string;
    showArchivedTooltip?: string;
    // Source filter labels
    sourceAll?: string;
    sourceBank?: string;
    sourceRemittance?: string;
    sourceManual?: string;
    sourceStripe?: string;
    sourceEmpty?: string;
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

export const TransactionsFilters = React.memo(function TransactionsFilters({
  currentFilter,
  onFilterChange,
  totalCount,
  pendingReturnsCount,
  expensesWithoutDocCount,
  uncategorizedCount,
  donationsNoContactCount,
  hasUncategorized,
  canExecuteAiCategorization,
  isBatchCategorizing,
  onBatchCategorize,
  onCancelBatch,
  sourceFilter,
  onSourceFilterChange,
  bankAccountFilter,
  onBankAccountFilterChange,
  isSuperAdmin,
  isBulkMode,
  onBulkModeChange,
  batchProgress,
  showArchived,
  onShowArchivedChange,
  t,
}: TransactionsFiltersProps) {
  return (
    <div className="flex flex-col gap-3 w-full md:flex-row md:flex-wrap md:items-center">
      {/* ═══════════════════════════════════════════════════════════════════
          FRANJA 2: Treball actiu (Classificar pendents + Mode ràpid)
          ═══════════════════════════════════════════════════════════════════ */}

      {/* ═══════════════════════════════════════════════════════════════════
          FILTRES RÀPIDS (shortcuts per despeses)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-1">
        {/* Només despeses */}
        <Button
          variant={currentFilter === 'expenses' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onFilterChange(currentFilter === 'expenses' ? 'all' : 'expenses')}
          className="h-8 text-xs"
        >
          {t.onlyExpenses || 'Només despeses'}
        </Button>

        {/* Despeses sense document (prioritari) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={currentFilter === 'expensesWithoutDoc' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onFilterChange(currentFilter === 'expensesWithoutDoc' ? 'all' : 'expensesWithoutDoc')}
              className="h-8 text-xs"
            >
              {t.expensesWithoutDocument || 'Despeses sense document'}
              {expensesWithoutDocCount > 0 && (
                <Badge variant="destructive" className="ml-1.5 h-4 px-1 text-[10px]">
                  {expensesWithoutDocCount}
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-xs">{t.expensesWithoutDocumentTooltip || 'Mostra només les despeses que encara no tenen comprovant adjunt.'}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Separador visual (només desktop) */}
      <div className="hidden md:block h-6 w-px bg-border" />

      {/* Suggerir categories + Mode ràpid (junts) */}
      {canExecuteAiCategorization && <div className="flex items-center gap-2 flex-wrap">
        {isBatchCategorizing ? (
          <div className="flex items-center gap-3">
            {/* Progress bar visual */}
            {batchProgress && batchProgress.total > 0 && (
              <div className="flex items-center gap-2 min-w-[140px]">
                <Progress
                  value={(batchProgress.current / batchProgress.total) * 100}
                  className="h-2 w-24"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {batchProgress.current}/{batchProgress.total}
                </span>
              </div>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onCancelBatch}
                  variant="outline"
                  size="sm"
                  aria-label={t.stopProcessAriaLabel ?? "Aturar procés"}
                  className="border-destructive text-destructive hover:bg-destructive/10"
                >
                  <Square className="mr-2 h-4 w-4" />
                  {t.stopButton ?? "Aturar"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{t.stopProcessTooltip ?? "Prem per aturar el procés. Els canvis aplicats fins ara es mantenen."}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onBatchCategorize}
                disabled={!hasUncategorized}
                variant="default"
                size="sm"
                aria-label={t.suggestCategoriesAriaLabel ?? "Suggerir categories amb IA"}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {t.categorizeAll}
                {uncategorizedCount > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-primary-foreground/20">
                    {uncategorizedCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">{t.suggestCategoriesTooltip ?? "Genera suggeriments i els aplica a mesura que avança. Pots revisar i ajustar després."}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Mode ràpid toggle (només SuperAdmin, adjunt al botó de suggeriments) */}
        {isSuperAdmin && onBulkModeChange && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-border/50">
            <Switch
              id="bulk-mode"
              checked={isBulkMode ?? false}
              onCheckedChange={onBulkModeChange}
              disabled={isBatchCategorizing}
              className="h-4 w-7"
              aria-label={t.bulkModeAriaLabel ?? "Mode ràpid"}
            />
            <Label htmlFor="bulk-mode" className="text-xs cursor-pointer whitespace-nowrap text-muted-foreground">
              {t.bulkModeLabel ?? "Ràpid"}
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs" side="bottom">
                <p className="text-xs">{t.bulkModeTooltip ?? "Accelera el procés reduint el temps entre suggeriments. Pot ser menys precís."}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>}

      {/* Toggle incloure arxivades (només SuperAdmin) */}
      {isSuperAdmin && onShowArchivedChange && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-border/50">
            <Switch
              id="show-archived"
              checked={showArchived ?? false}
              onCheckedChange={onShowArchivedChange}
              className="h-4 w-7"
              aria-label={t.showArchivedAriaLabel ?? "Incloure arxivades"}
            />
            <Label htmlFor="show-archived" className="text-xs cursor-pointer whitespace-nowrap text-muted-foreground">
              {t.showArchivedLabel ?? "Arxivades"}
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs" side="bottom">
                <p className="text-xs">{t.showArchivedTooltip ?? "Mostra les transaccions fiscals arxivades (soft-deleted). Només visible per SuperAdmin."}</p>
              </TooltipContent>
            </Tooltip>
          </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ESPAI FLEXIBLE + ACCIONS DRETA (Filtres + Opcions taula)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="ml-auto flex items-center gap-2">
        {/* Botó Filtres (obre Sheet) */}
        <FiltersSheet
          currentFilter={currentFilter}
          onFilterChange={onFilterChange}
          sourceFilter={sourceFilter}
          onSourceFilterChange={onSourceFilterChange}
          bankAccountFilter={bankAccountFilter}
          onBankAccountFilterChange={onBankAccountFilterChange}
          totalCount={totalCount}
          returnsCount={0}
          pendingReturnsCount={pendingReturnsCount}
          expensesWithoutDocCount={expensesWithoutDocCount}
          uncategorizedCount={uncategorizedCount}
          donationsNoContactCount={donationsNoContactCount}
          t={{
            all: t.all,
            returns: t.returns,
            pendingReturns: t.pendingReturns,
            withoutDocument: t.withoutDocument,
            uncategorized: t.uncategorized,
            donationsNoContact: t.donationsNoContact,
            allAccounts: t.allAccounts,
            filtersTitle: t.filtersTitle,
            filtersDescription: t.filtersDescription,
            clearFilters: t.clearFilters,
            applyFilters: t.applyFilters,
            filterByType: t.filterByType,
            filterBySource: t.filterBySource,
            filterByAccount: t.filterByAccount,
            pendingTasks: t.pendingTasks,
            // Source filter labels
            sourceAll: t.sourceAll,
            sourceBank: t.sourceBank,
            sourceRemittance: t.sourceRemittance,
            sourceManual: t.sourceManual,
            sourceStripe: t.sourceStripe,
            sourceEmpty: t.sourceEmpty,
          }}
        />
      </div>
    </div>
  );
});
