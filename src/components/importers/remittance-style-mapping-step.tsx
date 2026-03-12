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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b px-6 py-4">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-6 overflow-x-hidden">
          <div className="space-y-3 rounded-lg border p-4">
            <Label className="font-medium">{labels.requiredFieldsTitle}</Label>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {requiredFields.map((field) => (
                <div key={field.id} className="min-w-0 space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <span className={`h-3 w-3 rounded ${field.dotClassName}`}></span>
                    {field.label}
                  </Label>
                  <Select
                    value={selectedMapping[field.id] !== -1 ? String(selectedMapping[field.id]) : 'none'}
                    onValueChange={(value) => onMappingChange(field.id, value === 'none' ? -1 : Number.parseInt(value, 10))}
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.allowUnavailable || !field.required) && (
                        <SelectItem value="none">{labels.notAvailable}</SelectItem>
                      )}
                      {columns.map((column) => (
                        <SelectItem key={`${field.id}-${column.index}`} value={String(column.index)}>
                          {column.label
                            ? `${column.label}: ${column.sample || '-'}`
                            : replaceTemplateVars(labels.columnOptionTemplate, {
                              index: String(column.index),
                              example: column.sample || '-',
                            })}
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
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {optionalFields.map((field) => (
                    <div key={field.id} className="min-w-0 space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        <span className={`h-3 w-3 rounded ${field.dotClassName}`}></span>
                        {field.label}
                      </Label>
                      <Select
                        value={selectedMapping[field.id] !== -1 ? String(selectedMapping[field.id]) : 'none'}
                        onValueChange={(value) => onMappingChange(field.id, value === 'none' ? -1 : Number.parseInt(value, 10))}
                      >
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(field.allowUnavailable || !field.required) && (
                            <SelectItem value="none">{labels.notAvailable}</SelectItem>
                          )}
                          {columns.map((column) => (
                            <SelectItem key={`${field.id}-${column.index}`} value={String(column.index)}>
                              {column.label
                                ? `${column.label}: ${column.sample || '-'}`
                                : replaceTemplateVars(labels.columnOptionTemplate, {
                                  index: String(column.index),
                                  example: column.sample || '-',
                                })}
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

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {labels.previewTitle}
            </Label>
            <div className="max-h-[240px] overflow-auto rounded-md border">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-xs">#</TableHead>
                    {Array.from({ length: previewColumnCount }, (_, index) => {
                      const selectedField = selectedFieldByColumn.get(index);
                      const column = columnByIndex.get(index);
                      const headerLabel = column?.label
                        ? column.label
                        : `${labels.columnHeaderPrefix}${index}`;
                      return (
                        <TableHead
                          key={`head-${index}`}
                          className={`text-xs min-w-[110px] whitespace-nowrap ${selectedField?.headerClassName ?? ''}`}
                        >
                          {headerLabel}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, rowIndex) => (
                    <TableRow key={`row-${rowIndex}`}>
                      <TableCell className="text-xs text-muted-foreground">
                        {previewStartRow + rowIndex}
                      </TableCell>
                      {Array.from({ length: previewColumnCount }, (_, columnIndex) => {
                        const selectedField = selectedFieldByColumn.get(columnIndex);
                        return (
                          <TableCell
                            key={`cell-${rowIndex}-${columnIndex}`}
                            className={`text-xs truncate whitespace-nowrap max-w-[180px] ${selectedField?.cellClassName ?? ''}`}
                          >
                            {row[columnIndex] || '-'}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
