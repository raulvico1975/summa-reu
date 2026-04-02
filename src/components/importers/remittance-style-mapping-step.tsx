'use client';

import * as React from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { BankMappingColumnOption, BankMappingFieldId } from '@/lib/importers/bank/mapping-ui';
import { cn } from '@/lib/utils';

type RemittanceStyleFieldDefinition = {
  id: BankMappingFieldId;
  label: string;
  required: boolean;
  allowUnavailable?: boolean;
  dotClassName: string;
  headerClassName: string;
  cellClassName: string;
};

type RemittanceStyleMappingLabels = {
  title: string;
  description: string;
  previewTitle: string;
  requiredFieldsTitle: string;
  optionalFieldsTitle: string;
  optionalFieldsTrigger: string;
  columnOptionTemplate: string;
  columnHeaderPrefix: string;
  notAvailable: string;
  missingFieldTemplate: string;
  back: string;
  continue: string;
};

interface RemittanceStyleMappingStepProps {
  fields: RemittanceStyleFieldDefinition[];
  selectedMapping: Record<BankMappingFieldId, number>;
  columns: BankMappingColumnOption[];
  previewRows: string[][];
  previewColumnCount: number;
  previewStartRow: number;
  labels: RemittanceStyleMappingLabels;
  isSubmitting: boolean;
  continueDisabled: boolean;
  onMappingChange: (field: BankMappingFieldId, value: number) => void;
  onBack: () => void;
  onContinue: () => void;
}

const replaceTemplateVars = (template: string, values: Record<string, string>): string => {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replace(`{${key}}`, value);
  }, template);
};

const getColumnShortLabel = (
  column: BankMappingColumnOption,
  labels: RemittanceStyleMappingLabels
): string => {
  return column.label || `${labels.columnHeaderPrefix}${column.index}`;
};

const getPreviewColumnSizing = (fieldId?: BankMappingFieldId) => {
  switch (fieldId) {
    case 'operationDate':
    case 'valueDate':
      return {
        headerClassName: 'w-[7.25rem] min-w-[7.25rem]',
        cellClassName: 'w-[7.25rem] min-w-[7.25rem] text-[11px] tabular-nums',
        valueClassName: 'truncate',
      };
    case 'amount':
    case 'balanceAfter':
      return {
        headerClassName: 'w-[7.5rem] min-w-[7.5rem] text-right',
        cellClassName: 'w-[7.5rem] min-w-[7.5rem] text-right text-[11px] tabular-nums',
        valueClassName: 'truncate',
      };
    case 'description':
      return {
        headerClassName: 'min-w-[20rem] w-[24rem]',
        cellClassName: 'min-w-[20rem] w-[24rem]',
        valueClassName: 'truncate',
      };
    default:
      return {
        headerClassName: 'min-w-[9rem] w-[10rem]',
        cellClassName: 'min-w-[9rem] w-[10rem]',
        valueClassName: 'truncate',
      };
  }
};

export function RemittanceStyleMappingStep({
  fields,
  selectedMapping,
  columns,
  previewRows,
  previewColumnCount,
  previewStartRow,
  labels,
  isSubmitting,
  continueDisabled,
  onMappingChange,
  onBack,
  onContinue,
}: RemittanceStyleMappingStepProps) {
  const [isOptionalOpen, setIsOptionalOpen] = React.useState(false);
  const previewTopScrollRef = React.useRef<HTMLDivElement>(null);
  const previewTableScrollRef = React.useRef<HTMLDivElement>(null);
  const previewTableRef = React.useRef<HTMLTableElement>(null);
  const previewScrollSyncRef = React.useRef<'top' | 'table' | null>(null);
  const [previewScrollMetrics, setPreviewScrollMetrics] = React.useState({
    scrollWidth: 0,
    clientWidth: 0,
  });

  const selectedFieldByColumn = React.useMemo(() => {
    const map = new Map<number, RemittanceStyleFieldDefinition>();
    for (const field of fields) {
      const selectedColumn = selectedMapping[field.id];
      if (typeof selectedColumn === 'number' && selectedColumn >= 0) {
        map.set(selectedColumn, field);
      }
    }
    return map;
  }, [fields, selectedMapping]);

  const columnByIndex = React.useMemo(() => {
    const map = new Map<number, BankMappingColumnOption>();
    for (const column of columns) {
      map.set(column.index, column);
    }
    return map;
  }, [columns]);

  const requiredFields = React.useMemo(
    () => fields.filter((field) => field.required),
    [fields]
  );

  const optionalFields = React.useMemo(
    () => fields.filter((field) => !field.required),
    [fields]
  );

  const missingRequiredField = React.useMemo(() => {
    return requiredFields.find((field) => {
      const selectedColumn = selectedMapping[field.id];
      return selectedColumn < 0 && !field.allowUnavailable;
    }) ?? null;
  }, [requiredFields, selectedMapping]);

  const missingFieldMessage = missingRequiredField
    ? replaceTemplateVars(labels.missingFieldTemplate, {
        field: missingRequiredField.label.replace(/\s*\([^)]*\)\s*$/, ''),
      })
    : null;

  React.useEffect(() => {
    const scrollContainer = previewTableScrollRef.current;
    const table = previewTableRef.current;
    if (!scrollContainer || !table || typeof ResizeObserver === 'undefined') {
      return;
    }

    const updateMetrics = () => {
      setPreviewScrollMetrics({
        scrollWidth: scrollContainer.scrollWidth,
        clientWidth: scrollContainer.clientWidth,
      });
    };

    updateMetrics();

    const resizeObserver = new ResizeObserver(() => {
      updateMetrics();
    });

    resizeObserver.observe(scrollContainer);
    resizeObserver.observe(table);

    return () => {
      resizeObserver.disconnect();
    };
  }, [previewColumnCount, previewRows, selectedMapping, columns]);

  const syncPreviewScroll = React.useCallback((source: 'top' | 'table', scrollLeft: number) => {
    const target = source === 'top' ? previewTableScrollRef.current : previewTopScrollRef.current;
    if (!target) return;
    previewScrollSyncRef.current = source;
    target.scrollLeft = scrollLeft;
    requestAnimationFrame(() => {
      if (previewScrollSyncRef.current === source) {
        previewScrollSyncRef.current = null;
      }
    });
  }, []);

  const handleTopScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (previewScrollSyncRef.current === 'table') return;
    syncPreviewScroll('top', event.currentTarget.scrollLeft);
  }, [syncPreviewScroll]);

  const handleTableScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (previewScrollSyncRef.current === 'top') return;
    syncPreviewScroll('table', event.currentTarget.scrollLeft);
  }, [syncPreviewScroll]);

  const hasHorizontalOverflow = previewScrollMetrics.scrollWidth > previewScrollMetrics.clientWidth + 1;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b px-6 py-4">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-6 overflow-x-hidden lg:grid lg:grid-cols-[minmax(18rem,21rem)_minmax(0,1.35fr)] lg:items-start lg:gap-5 lg:space-y-0 xl:grid-cols-[minmax(19rem,22rem)_minmax(0,1.55fr)] 2xl:grid-cols-[minmax(20rem,23rem)_minmax(0,1.7fr)]">
          <div className="space-y-6 lg:sticky lg:top-0">
            <div className="space-y-3 rounded-lg border p-4">
              <Label className="font-medium">{labels.requiredFieldsTitle}</Label>
              <div className="grid grid-cols-1 gap-4">
                {requiredFields.map((field) => (
                  <div key={field.id} className="min-w-0 space-y-1">
                    <Label className="flex items-center gap-1 text-xs leading-tight">
                      <span className={`h-3 w-3 rounded ${field.dotClassName}`}></span>
                      <span className="break-words">{field.label}</span>
                    </Label>
                    <Select
                      value={selectedMapping[field.id] !== -1 ? String(selectedMapping[field.id]) : 'none'}
                      onValueChange={(value) => onMappingChange(field.id, value === 'none' ? -1 : Number.parseInt(value, 10))}
                    >
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-w-[min(90vw,32rem)]">
                        {(field.allowUnavailable || !field.required) && (
                          <SelectItem value="none">{labels.notAvailable}</SelectItem>
                        )}
                        {columns.map((column) => (
                          <SelectItem key={`${field.id}-${column.index}`} value={String(column.index)}>
                            {getColumnShortLabel(column, labels)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {optionalFields.length > 0 && (
              <Collapsible open={isOptionalOpen} onOpenChange={setIsOptionalOpen} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label className="font-medium">{labels.optionalFieldsTitle}</Label>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="gap-2 px-2">
                      {labels.optionalFieldsTrigger}
                      <ChevronDown className={cn('h-4 w-4 transition-transform', isOptionalOpen && 'rotate-180')} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="pt-4">
                  <div className="grid grid-cols-1 gap-4">
                    {optionalFields.map((field) => (
                      <div key={field.id} className="min-w-0 space-y-1">
                        <Label className="flex items-center gap-1 text-xs leading-tight">
                          <span className={`h-3 w-3 rounded ${field.dotClassName}`}></span>
                          <span className="break-words">{field.label}</span>
                        </Label>
                        <Select
                          value={selectedMapping[field.id] !== -1 ? String(selectedMapping[field.id]) : 'none'}
                          onValueChange={(value) => onMappingChange(field.id, value === 'none' ? -1 : Number.parseInt(value, 10))}
                        >
                          <SelectTrigger className="h-8 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-w-[min(90vw,32rem)]">
                            {(field.allowUnavailable || !field.required) && (
                              <SelectItem value="none">{labels.notAvailable}</SelectItem>
                            )}
                            {columns.map((column) => (
                              <SelectItem key={`${field.id}-${column.index}`} value={String(column.index)}>
                                {getColumnShortLabel(column, labels)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>

          <div className="min-w-0 space-y-2">
            <Label className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {labels.previewTitle}
            </Label>
            {hasHorizontalOverflow ? (
              <div className="rounded-t-md border border-b-0 bg-muted/20 px-2 py-1">
                <div
                  ref={previewTopScrollRef}
                  className="overflow-x-auto overflow-y-hidden"
                  onScroll={handleTopScroll}
                >
                  <div className="h-3" style={{ width: previewScrollMetrics.scrollWidth }} />
                </div>
              </div>
            ) : null}
            <div
              ref={previewTableScrollRef}
              className={cn(
                'max-h-[360px] overflow-auto border',
                hasHorizontalOverflow ? 'rounded-b-md' : 'rounded-md'
              )}
              onScroll={handleTableScroll}
            >
              <table ref={previewTableRef} className="min-w-max table-fixed caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                  <tr className="border-b border-border/50 transition-colors hover:bg-muted/30">
                    <th className="h-10 w-12 px-3 text-left align-middle text-xs font-medium text-muted-foreground">#</th>
                    {Array.from({ length: previewColumnCount }, (_, index) => {
                      const selectedField = selectedFieldByColumn.get(index);
                      const column = columnByIndex.get(index);
                      const headerLabel = column?.label
                        ? column.label
                        : `${labels.columnHeaderPrefix}${index}`;
                      const columnSizing = getPreviewColumnSizing(selectedField?.id);
                      return (
                        <th
                          key={`head-${index}`}
                          className={cn(
                            'h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground whitespace-nowrap',
                            columnSizing.headerClassName,
                            selectedField?.headerClassName
                          )}
                          title={headerLabel}
                        >
                          <div className="truncate">{headerLabel}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {previewRows.map((row, rowIndex) => (
                    <tr
                      key={`row-${rowIndex}`}
                      className="border-b border-border/50 transition-colors hover:bg-muted/30"
                    >
                      <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                        {previewStartRow + rowIndex}
                      </td>
                      {Array.from({ length: previewColumnCount }, (_, columnIndex) => {
                        const selectedField = selectedFieldByColumn.get(columnIndex);
                        const columnSizing = getPreviewColumnSizing(selectedField?.id);
                        const cellValue = row[columnIndex] || '-';
                        return (
                          <td
                            key={`cell-${rowIndex}-${columnIndex}`}
                            className={cn(
                              'px-3 py-2 align-top text-xs leading-4',
                              columnSizing.cellClassName,
                              selectedField?.cellClassName
                            )}
                          >
                            <div className={columnSizing.valueClassName} title={cellValue}>
                              {cellValue}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t px-6 py-4">
        {continueDisabled && missingFieldMessage ? (
          <p className="mb-3 text-sm text-muted-foreground">{missingFieldMessage}</p>
        ) : null}
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button className="w-full sm:w-auto" variant="outline" onClick={onBack} disabled={isSubmitting}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {labels.back}
          </Button>
          <Button className="w-full sm:w-auto" onClick={onContinue} disabled={isSubmitting || continueDisabled}>
            <ArrowRight className="mr-2 h-4 w-4" />
            {labels.continue}
          </Button>
        </div>
      </div>
    </div>
  );
}
