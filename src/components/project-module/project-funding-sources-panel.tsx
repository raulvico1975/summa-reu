'use client';

import * as React from 'react';
import { Archive, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/i18n';
import {
  formatEuropeanAmountInput,
  formatEuropeanCurrency,
  parseEuropeanAmountInput,
} from '@/lib/project-module-funding';
import type {
  ProjectFundingSource,
  ProjectFundingSourceFormData,
  ProjectFundingSourceType,
} from '@/lib/project-module-types';

const sourceTypes: ProjectFundingSourceType[] = ['public', 'private', 'own_funds', 'local_partner', 'other'];

export function ProjectFundingSourcesPanel({
  fundingSources,
  projectBudgetEUR,
  isSaving,
  canEdit,
  onSave,
  onArchive,
}: {
  fundingSources: ProjectFundingSource[];
  projectBudgetEUR: number | null;
  isSaving: boolean;
  canEdit: boolean;
  onSave: (data: ProjectFundingSourceFormData, sourceId?: string) => Promise<void>;
  onArchive: (sourceId: string) => Promise<void>;
}) {
  const { tr } = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProjectFundingSource | null>(null);

  React.useEffect(() => {
    if (!canEdit) {
      setOpen(false);
      setEditing(null);
    }
  }, [canEdit]);

  const activeSources = fundingSources
    .filter((source) => source.archivedAt === null)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const totals = activeSources.reduce(
    (acc, source) => {
      acc.approved += source.approvedAmountEUR ?? 0;
      acc.received += source.receivedAmountEUR ?? 0;
      return acc;
    },
    { approved: 0, received: 0 }
  );
  const pending = totals.approved - totals.received;
  const budgetDifference = projectBudgetEUR !== null ? projectBudgetEUR - totals.approved : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{tr('projectModule.multiFunding.sourcesTitle')}</CardTitle>
          <CardDescription>{tr('projectModule.multiFunding.sourcesDescription')}</CardDescription>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            {tr('projectModule.multiFunding.addSource')}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {activeSources.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tr('projectModule.multiFunding.noSources')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr('projectModule.multiFunding.sourceName')}</TableHead>
                <TableHead>{tr('projectModule.multiFunding.sourceType')}</TableHead>
                <TableHead className="text-right">{tr('projectModule.multiFunding.approvedAmount')}</TableHead>
                <TableHead className="text-right">{tr('projectModule.multiFunding.receivedAmount')}</TableHead>
                <TableHead className="text-right">{tr('projectModule.multiFunding.pendingToReceive')}</TableHead>
                <TableHead className="w-[90px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeSources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell className="font-medium">{source.name}</TableCell>
                  <TableCell>{tr(`projectModule.multiFunding.sourceTypes.${source.type}`)}</TableCell>
                  <TableCell className="text-right font-mono">{formatEuropeanCurrency(source.approvedAmountEUR)}</TableCell>
                  <TableCell className="text-right font-mono">{formatEuropeanCurrency(source.receivedAmountEUR)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {source.approvedAmountEUR === null
                      ? '-'
                      : formatEuropeanCurrency(source.approvedAmountEUR - (source.receivedAmountEUR ?? 0))}
                  </TableCell>
                  <TableCell>
                    {canEdit && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(source); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => canEdit && onArchive(source.id)} disabled={!canEdit}>
                          <Archive className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/30 font-medium">
                <TableCell>{tr('projectModule.multiFunding.sourcesTotal')}</TableCell>
                <TableCell />
                <TableCell className="text-right font-mono">{formatEuropeanCurrency(totals.approved)}</TableCell>
                <TableCell className="text-right font-mono">{formatEuropeanCurrency(totals.received)}</TableCell>
                <TableCell className="text-right font-mono">{formatEuropeanCurrency(pending)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        )}
        {activeSources.length > 0 && projectBudgetEUR !== null && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border bg-muted/20 px-3 py-2 text-sm">
            <span>
              <span className="text-muted-foreground">{tr('projectModule.multiFunding.projectBudget')}:</span>{' '}
              <span className="font-mono font-medium">{formatEuropeanCurrency(projectBudgetEUR)}</span>
            </span>
            <span>
              <span className="text-muted-foreground">{tr('projectModule.multiFunding.approvedTotal')}:</span>{' '}
              <span className="font-mono font-medium">{formatEuropeanCurrency(totals.approved)}</span>
            </span>
            <span>
              <span className="text-muted-foreground">{tr('projectModule.multiFunding.difference')}:</span>{' '}
              <span className="font-mono font-medium">{formatEuropeanCurrency(budgetDifference)}</span>
            </span>
          </div>
        )}
      </CardContent>
      <FundingSourceDialog
        open={canEdit && open}
        onOpenChange={(next) => canEdit && setOpen(next)}
        source={editing}
        isSaving={isSaving}
        canEdit={canEdit}
        onSave={async (data) => {
          if (!canEdit) return;
          await onSave(data, editing?.id);
          setOpen(false);
          setEditing(null);
        }}
      />
    </Card>
  );
}

function FundingSourceDialog({
  open,
  onOpenChange,
  source,
  isSaving,
  canEdit,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: ProjectFundingSource | null;
  isSaving: boolean;
  canEdit: boolean;
  onSave: (data: ProjectFundingSourceFormData) => Promise<void>;
}) {
  const { tr } = useTranslations();
  const [form, setForm] = React.useState<ProjectFundingSourceFormData>({
    name: '',
    type: 'public',
    approvedAmountEUR: '',
    receivedAmountEUR: '',
    notes: '',
  });

  React.useEffect(() => {
    if (!open) return;
    setForm({
      name: source?.name ?? '',
      type: source?.type ?? 'public',
      approvedAmountEUR: formatEuropeanAmountInput(source?.approvedAmountEUR),
      receivedAmountEUR: formatEuropeanAmountInput(source?.receivedAmountEUR),
      notes: source?.notes ?? '',
    });
  }, [open, source]);

  return (
    <Dialog open={canEdit && open} onOpenChange={(next) => canEdit && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{source ? tr('projectModule.multiFunding.editSource') : tr('projectModule.multiFunding.addSource')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{tr('projectModule.multiFunding.sourceName')}</Label>
            <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>{tr('projectModule.multiFunding.sourceType')}</Label>
            <Select value={form.type} onValueChange={(value) => setForm((prev) => ({ ...prev, type: value as ProjectFundingSourceType }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sourceTypes.map((type) => (
                  <SelectItem key={type} value={type}>{tr(`projectModule.multiFunding.sourceTypes.${type}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{tr('projectModule.multiFunding.approvedAmount')}</Label>
              <Input
                inputMode="decimal"
                value={form.approvedAmountEUR}
                onChange={(event) => setForm((prev) => ({ ...prev, approvedAmountEUR: event.target.value }))}
                onBlur={() => {
                  try {
                    const parsed = parseEuropeanAmountInput(form.approvedAmountEUR);
                    setForm((prev) => ({ ...prev, approvedAmountEUR: formatEuropeanAmountInput(parsed) }));
                  } catch {}
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{tr('projectModule.multiFunding.receivedAmount')}</Label>
              <Input
                inputMode="decimal"
                value={form.receivedAmountEUR}
                onChange={(event) => setForm((prev) => ({ ...prev, receivedAmountEUR: event.target.value }))}
                onBlur={() => {
                  try {
                    const parsed = parseEuropeanAmountInput(form.receivedAmountEUR);
                    setForm((prev) => ({ ...prev, receivedAmountEUR: formatEuropeanAmountInput(parsed) }));
                  } catch {}
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{tr('projectModule.multiFunding.notes')}</Label>
            <Textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>{tr('common.cancel')}</Button>
          <Button onClick={() => canEdit && onSave(form)} disabled={!canEdit || isSaving || !form.name.trim()}>{tr('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
