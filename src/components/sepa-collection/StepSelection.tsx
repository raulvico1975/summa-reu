'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { CheckCircle2, XCircle, AlertTriangle, Users, Search, Info, ExternalLink } from 'lucide-react';
import { useTranslations } from '@/i18n';
import { cn } from '@/lib/utils';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import type { Donor } from '@/lib/data';
import { determineSequenceType, type DonorCollectionStatus } from '@/lib/sepa/pain008';

export interface SelectionData {
  selectedIds: Set<string>;
  searchQuery: string;
  periodicityFilter: string | null;
}

interface StepSelectionProps {
  eligible: Donor[];
  excluded: Array<{ donor: Donor; reason: string }>;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  totalAmountCents: number;
  donorStatuses: Map<string, DonorCollectionStatus>;
}

export function StepSelection({
  eligible,
  excluded,
  selectedIds,
  onSelectionChange,
  totalAmountCents,
  donorStatuses,
}: StepSelectionProps) {
  const { t, tr } = useTranslations();
  const { orgSlug } = useCurrentOrganization();
  const [showExcludedOnly, setShowExcludedOnly] = React.useState(false);
  const [showAllMissing, setShowAllMissing] = React.useState(false);
  const [confirmBlockedId, setConfirmBlockedId] = React.useState<string | null>(null);

  // Nous filtres
  const [searchQuery, setSearchQuery] = React.useState('');
  const [periodicityFilter, setPeriodicityFilter] = React.useState<string | null>(null);

  // Detecció de socis no mensuals sense sepaPain008LastRunAt (risc duplicat migració)
  const missingLastRun = React.useMemo(
    () => eligible.filter(d =>
      ['quarterly', 'semiannual', 'annual'].includes(d.periodicityQuota || '') &&
      !d.sepaPain008LastRunAt
    ),
    [eligible]
  );

  // Filtrar elegibles segons cerca i periodicitat
  const filteredEligible = React.useMemo(() => {
    let result = eligible;

    // Filtre de cerca (nom, NIF, IBAN)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.taxId?.toLowerCase().includes(q) ||
        d.iban?.toLowerCase().replace(/\s/g, '').includes(q.replace(/\s/g, ''))
      );
    }

    // Filtre de periodicitat
    if (periodicityFilter) {
      if (periodicityFilter === '__none__') {
        // "Sense periodicitat" = periodicityQuota és null o undefined
        result = result.filter(d => !d.periodicityQuota);
      } else {
        result = result.filter(d => (d.periodicityQuota || 'monthly') === periodicityFilter);
      }
    }

    return result;
  }, [eligible, searchQuery, periodicityFilter]);

  // Calcular estat del checkbox global (excloure bloquejats del càlcul)
  const selectableFiltered = filteredEligible.filter(d => {
    const st = donorStatuses.get(d.id);
    return st?.type !== 'blocked' && st?.type !== 'noPeriodicity';
  });
  const allFilteredSelected = selectableFiltered.length > 0 && selectableFiltered.every(d => selectedIds.has(d.id));
  const someFilteredSelected = selectableFiltered.some(d => selectedIds.has(d.id));

  const handleToggleAllFiltered = (checked: boolean) => {
    if (checked) {
      // Afegir tots els filtrats NO bloquejats a la selecció
      const newSet = new Set(selectedIds);
      filteredEligible.forEach(d => {
        const st = donorStatuses.get(d.id);
        if (st?.type !== 'blocked' && st?.type !== 'noPeriodicity') {
          newSet.add(d.id);
        }
      });
      onSelectionChange(newSet);
    } else {
      // Treure tots els filtrats de la selecció
      const newSet = new Set(selectedIds);
      filteredEligible.forEach(d => newSet.delete(d.id));
      onSelectionChange(newSet);
    }
  };

  const handleClearSelection = () => {
    onSelectionChange(new Set());
  };

  const handleToggle = (donorId: string) => {
    const st = donorStatuses.get(donorId);
    if (st?.type === 'noPeriodicity') return;

    // Blocked: si ja seleccionat → deseleccionar directament; si no → demanar confirmació
    if (st?.type === 'blocked') {
      if (selectedIds.has(donorId)) {
        const newSet = new Set(selectedIds);
        newSet.delete(donorId);
        onSelectionChange(newSet);
      } else {
        setConfirmBlockedId(donorId);
      }
      return;
    }

    const newSet = new Set(selectedIds);
    if (newSet.has(donorId)) {
      newSet.delete(donorId);
    } else {
      newSet.add(donorId);
    }
    onSelectionChange(newSet);
  };

  const handleConfirmBlocked = () => {
    if (!confirmBlockedId) return;
    const newSet = new Set(selectedIds);
    newSet.add(confirmBlockedId);
    onSelectionChange(newSet);
    setConfirmBlockedId(null);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('ca-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

  const formatIban = (iban: string) => {
    // Show last 4 digits only for privacy
    if (iban.length > 4) {
      return '···· ' + iban.slice(-4);
    }
    return iban;
  };

  // Formatar data "Darrer cobrament" com "feb25" (mes curt + any 2 dígits)
  const formatLastRun = (date: string | null | undefined): string => {
    if (!date) return '—';
    try {
      const d = new Date(date);
      const mon = d.toLocaleDateString('ca-ES', { month: 'short', timeZone: 'UTC' }).replace('.', '');
      const yr = String(d.getUTCFullYear()).slice(2);
      return `${mon}${yr}`;
    } catch {
      return '—';
    }
  };

  // Map reason to i18n key
  const getReasonLabel = (reason: string): string => {
    // Motiu dinàmic: IBAN_INCOMPLET:FR:24:27
    if (reason.startsWith('IBAN_INCOMPLET:')) {
      const [, country, length, expected] = reason.split(':');
      return tr('sepaCollection.selection.reasons.ibanIncomplete', 'IBAN {country} incomplet ({length}/{expected})')
        .replace('{country}', country)
        .replace('{length}', length)
        .replace('{expected}', expected);
    }

    const reasonMap: Record<string, string> = {
      'Sense IBAN': t.sepaCollection.selection.reasons.noIban,
      'No és recurrent': tr('sepaCollection.selection.reasons.notRecurring', 'No és recurrent'),
      'Sense NIF': tr('sepaCollection.selection.reasons.noTaxId', 'Sense NIF'),
      "Sense data d'alta": tr('sepaCollection.selection.reasons.noMemberSince', "Sense data d'alta"),
      'Donant inactiu': t.sepaCollection.selection.reasons.donorInactive,
    };
    return reasonMap[reason] || reason;
  };

  // Comptar invàlids
  const invalidIbanCount = excluded.filter(e =>
    e.reason === 'Sense IBAN' || e.reason.toLowerCase().includes('iban')
  ).length;
  const invalidAmountCount = filteredEligible.filter(d =>
    !d.monthlyAmount || d.monthlyAmount <= 0
  ).length;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">{t.sepaCollection.selection.title}</h3>

      {/* Warning: socis no mensuals sense últim cobrament (risc duplicat migració) */}
      {missingLastRun.length > 0 && (
        <div className="space-y-3">
          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-sm">
              <p className="font-medium">
                {tr('sepaPain008.selection.migrationWarningTitle', 'Atenció: risc de duplicar cobrament')}
              </p>
              <p className="mt-1">
                {tr('sepaPain008.selection.migrationWarningDesc',
                  'Hi ha {count} socis trimestrals/semestrals/anuals sense registre d\'últim cobrament SEPA. Si ja es van cobrar fora de Summa, podries duplicar el cobrament. Revisa\'ls des de Donants abans de continuar.'
                ).replace('{count}', String(missingLastRun.length))}
              </p>
            </AlertDescription>
          </Alert>

          {/* Llista compacta dels afectats */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
            {(showAllMissing ? missingLastRun : missingLastRun.slice(0, 10)).map(donor => {
              const periodicityKey = `donors.periodicityQuota.${donor.periodicityQuota}`;
              const periodicityLabel = tr(periodicityKey, donor.periodicityQuota ?? '');
              return (
                <div key={donor.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{donor.name}</span>
                    <Badge variant="outline" className="text-xs">{periodicityLabel}</Badge>
                    <span className="text-muted-foreground">
                      {tr('sepaPain008.selection.noLastRun', 'Sense data')}
                    </span>
                  </div>
                  <a
                    href={`/${orgSlug}/dashboard/donants`}
                    className="text-xs text-amber-700 hover:text-amber-900 underline flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {tr('sepaPain008.selection.editDonor', 'Editar')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              );
            })}
            {missingLastRun.length > 10 && !showAllMissing && (
              <Button
                variant="ghost"
                size="sm"
                className="text-amber-700 hover:text-amber-900 p-0 h-auto"
                onClick={() => setShowAllMissing(true)}
              >
                {tr('sepaPain008.selection.showAll', 'Veure tots')} ({missingLastRun.length})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Microcopy informatiu */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700 text-sm">
          {tr('sepaPain008.selection.autoPreselectionNote', 'Preselecció automàtica segons periodicitat. Pots modificar la selecció lliurement.')}
        </AlertDescription>
      </Alert>

      {/* Summary stats */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/50 p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <span className="font-medium">{selectedIds.size}</span>
          <span className="text-muted-foreground text-sm">
            {t.sepaCollection.selection.selected({ count: selectedIds.size })}
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <span>
            {tr('sepaPain008.selection.showingOf', 'Mostrant {shown} de {total} socis')
              .replace('{shown}', String(filteredEligible.length))
              .replace('{total}', String(eligible.length))}
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-orange-500" />
          <span>{tr('sepaPain008.selection.excludedCount', '{count} exclosos').replace('{count}', String(excluded.length))}</span>
        </div>
        {invalidAmountCount > 0 && (
          <>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-amber-600 text-sm">
                {invalidAmountCount} {tr('sepaPain008.selection.invalidAmount', 'import invàlid')}
              </span>
            </div>
          </>
        )}
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{tr('sepaPain008.selection.total', 'Total:')}</span>
          <span className="font-bold text-lg">{formatCurrency(totalAmountCents)}</span>
        </div>
      </div>

      {/* Barra de filtres */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Cerca */}
        <div className="relative min-w-[220px] flex-1 lg:max-w-[360px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={tr('sepaPain008.selection.searchPlaceholder', 'Cercar per nom, NIF o IBAN...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filtre periodicitat */}
        <Select
          value={periodicityFilter || '__all__'}
          onValueChange={(v) => setPeriodicityFilter(v === '__all__' ? null : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={tr('sepaPain008.selection.periodicityFilter', 'Periodicitat')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{tr('sepaPain008.selection.allPeriodicities', 'Totes')}</SelectItem>
            <SelectItem value="__none__">{tr('sepaPain008.selection.noPeriodicitySet', 'Sense periodicitat')}</SelectItem>
            <SelectItem value="monthly">{tr('donors.periodicityQuota.monthly', 'Mensual')}</SelectItem>
            <SelectItem value="quarterly">{tr('donors.periodicityQuota.quarterly', 'Trimestral')}</SelectItem>
            <SelectItem value="semiannual">{tr('donors.periodicityQuota.semiannual', 'Semestral')}</SelectItem>
            <SelectItem value="annual">{tr('donors.periodicityQuota.annual', 'Anual')}</SelectItem>
            <SelectItem value="manual">{tr('donors.periodicityQuota.manual', 'Manual')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Switch exclosos */}
        <div className="flex items-center gap-2">
          <Switch
            id="show-excluded"
            checked={showExcludedOnly}
            onCheckedChange={setShowExcludedOnly}
          />
          <Label htmlFor="show-excluded" className="text-sm">
            {tr('sepaPain008.selection.showExcludedOnly', 'Mostrar només exclosos')}
          </Label>
        </div>
      </div>

      {/* Accions: Checkbox global + Netejar */}
      {!showExcludedOnly && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allFilteredSelected}
              indeterminate={someFilteredSelected && !allFilteredSelected}
              onCheckedChange={handleToggleAllFiltered}
            />
            <span className="text-sm">
              {tr('sepaPain008.selection.selectAllFiltered', 'Seleccionar tots els mostrats')} ({filteredEligible.length})
            </span>
          </div>

          {selectedIds.size > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearSelection}>
              {tr('sepaPain008.selection.clearSelection', 'Netejar selecció')}
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      {!showExcludedOnly ? (
        <div className="rounded-xl border border-border/60 bg-background/95 shadow-sm">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead className="w-[28%]">{t.sepaCollection.review.itemsTable.name}</TableHead>
                <TableHead className="w-[120px]">{t.sepaCollection.review.itemsTable.amount}</TableHead>
                <TableHead className="w-[120px]">{tr('sepaPain008.selection.lastRun', 'Darrer cobrament')}</TableHead>
                <TableHead className="w-[140px]">{tr('sepaPain008.selection.statusColumn', 'Periodicitat')}</TableHead>
                <TableHead className="w-[150px]">{t.sepaCollection.review.itemsTable.iban}</TableHead>
                <TableHead className="w-[120px]">{t.sepaCollection.review.itemsTable.sequence}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEligible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {t.sepaCollection.selection.noEligible}
                  </TableCell>
                </TableRow>
              ) : (
                filteredEligible.map((donor) => {
                  const isSelected = selectedIds.has(donor.id);
                  const seqType = determineSequenceType(donor);
                  const hasInvalidAmount = !donor.monthlyAmount || donor.monthlyAmount <= 0;
                  const st = donorStatuses.get(donor.id);
                  const isNoPeriodicity = st?.type === 'noPeriodicity';
                  const isBlocked = st?.type === 'blocked';
                  return (
                    <TableRow
                      key={donor.id}
                      className={cn(
                        'transition-colors cursor-pointer',
                        isNoPeriodicity && 'opacity-50 cursor-not-allowed',
                        isSelected && isBlocked ? 'bg-orange-50' : isSelected ? 'bg-primary/5' : '',
                        !isSelected && !isNoPeriodicity && 'hover:bg-muted/50',
                        hasInvalidAmount && !isNoPeriodicity && 'opacity-60'
                      )}
                      onClick={() => handleToggle(donor.id)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          disabled={isNoPeriodicity}
                          onCheckedChange={() => handleToggle(donor.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <span className="block truncate">{donor.name}</span>
                      </TableCell>
                      <TableCell>
                        {donor.monthlyAmount ? (
                          formatCurrency(Math.round(donor.monthlyAmount * 100))
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">
                            {tr('sepaPain008.selection.invalidAmount', 'Import invàlid')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatLastRun(donor.sepaPain008LastRunAt)}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          if (!st) return '—';

                          if (st.type === 'blocked') {
                            return (
                              <Badge variant="outline" className="text-orange-600 border-orange-300 font-normal">
                                {tr('sepaPain008.selection.blockedBadge', 'No toca encara')}
                              </Badge>
                            );
                          }

                          if (st.type === 'manual') {
                            return (
                              <Badge variant="outline" className="text-gray-500 font-normal">
                                {tr('sepaPain008.selection.manualPeriodicity', 'Manual')}
                              </Badge>
                            );
                          }

                          if (st.type === 'noPeriodicity') {
                            return (
                              <Badge variant="outline" className="text-gray-500 font-normal">
                                {tr('sepaPain008.selection.noPeriodicityBadge', 'Sense periodicitat')}
                              </Badge>
                            );
                          }

                          // type === 'due': show periodicity label
                          const periodicityKey = `donors.periodicityQuota.${st.periodicity}`;
                          const label = tr(periodicityKey, st.periodicity ?? '');
                          return (
                            <span className="text-sm text-muted-foreground">
                              {label}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="font-mono text-sm whitespace-nowrap">
                        {donor.iban ? formatIban(donor.iban) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={seqType === 'FRST' ? 'default' : 'secondary'}>
                          {seqType}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        // Excluded table
        <div className="rounded-xl border border-border/60 bg-background/95 shadow-sm">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead className="w-[32%]">{t.sepaCollection.review.itemsTable.name}</TableHead>
                <TableHead>{tr('sepaPain008.selection.reasonColumn', 'Motiu')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {excluded.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                    {tr('sepaPain008.selection.allEligible', 'Tots els socis són elegibles')}
                  </TableCell>
                </TableRow>
              ) : (
                excluded.map(({ donor, reason }) => (
                  <TableRow key={donor.id}>
                    <TableCell>
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                    </TableCell>
                    <TableCell className="font-medium">
                      <span className="block truncate">{donor.name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-orange-600 border-orange-300">
                        {getReasonLabel(reason)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Confirmació per seleccionar soci blocked */}
      <AlertDialog open={!!confirmBlockedId} onOpenChange={(open) => !open && setConfirmBlockedId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tr('sepaPain008.selection.confirmBlockedTitle', 'Incloure soci abans d\'hora?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tr('sepaPain008.selection.confirmBlockedDesc',
                'Confirmes que vols incloure aquest soci a la remesa actual? (Segons el càlcul de periodicitat, encara no li tocaria.)')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {tr('sepaPain008.selection.confirmBlockedCancel', 'Cancel·lar')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmBlocked}>
              {tr('sepaPain008.selection.confirmBlockedAction', 'Sí, incloure igualment')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
