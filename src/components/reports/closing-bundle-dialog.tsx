'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from '@/i18n';
import { useFirebase } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import {
  type PeriodOption,
  type ClosingBundleError,
  getCurrentYearRange,
  getPreviousYearRange,
} from '@/lib/closing-bundle/closing-bundle-types';

interface ClosingBundleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClosingBundleDialog({ open, onOpenChange }: ClosingBundleDialogProps) {
  const { t } = useTranslations();
  const { user } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const { can } = usePermissions();
  const { toast } = useToast();
  const canExportReports = can('informes.exportar');

  const [periodOption, setPeriodOption] = React.useState<PeriodOption>('current_year');
  const [customDateFrom, setCustomDateFrom] = React.useState('');
  const [customDateTo, setCustomDateTo] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);

  // Calcular dates segons opció seleccionada
  const getDates = React.useCallback(() => {
    switch (periodOption) {
      case 'current_year':
        return getCurrentYearRange();
      case 'previous_year':
        return getPreviousYearRange();
      case 'custom':
        return { dateFrom: customDateFrom, dateTo: customDateTo };
      default:
        return getCurrentYearRange();
    }
  }, [periodOption, customDateFrom, customDateTo]);

  // Validar dates personalitzades
  const isCustomValid = React.useMemo(() => {
    if (periodOption !== 'custom') return true;
    if (!customDateFrom || !customDateTo) return false;
    return customDateFrom <= customDateTo;
  }, [periodOption, customDateFrom, customDateTo]);

  const handleGenerate = async () => {
    if (!canExportReports) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.reports.closingBundle.errors.unauthorized,
      });
      return;
    }
    if (!user || !organizationId) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.reports.closingBundle.errors.unauthorized,
      });
      return;
    }

    if (!isCustomValid) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.reports.closingBundle.errors.invalidDates,
      });
      return;
    }

    setIsGenerating(true);

    try {
      const idToken = await user.getIdToken();
      const { dateFrom, dateTo } = getDates();

      const response = await fetch('/api/exports/closing-bundle-zip', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orgId: organizationId,
          dateFrom,
          dateTo,
        }),
      });

      const contentType = response.headers.get('Content-Type') || '';

      // Si és un error JSON
      if (contentType.includes('application/json')) {
        const error = (await response.json()) as ClosingBundleError;

        let errorMessage = error.message;
        if (error.code === 'LIMIT_EXCEEDED') {
          errorMessage = t.reports.closingBundle.errors.limitExceeded;
        } else if (error.code === 'NO_TRANSACTIONS') {
          errorMessage = t.reports.closingBundle.errors.noTransactions;
        } else if (error.code === 'UNAUTHORIZED') {
          errorMessage = t.reports.closingBundle.errors.unauthorized;
        }

        toast({
          variant: 'destructive',
          title: t.common.error,
          description: errorMessage,
        });
        return;
      }

      // Si és un ZIP, descarregar
      if (contentType.includes('application/zip') || contentType.includes('application/octet-stream')) {
        const blob = await response.blob();

        // Obtenir nom del fitxer del header o generar-ne un
        const contentDisposition = response.headers.get('Content-Disposition') || '';
        const filenameMatch = contentDisposition.match(/filename="?([^";\n]+)"?/);
        const filename = filenameMatch?.[1] || `summa_tancament_${dateFrom}_${dateTo}.zip`;

        // Crear link i descarregar
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          presentation: 'centered-success',
          title: t.reports.closingBundle.done,
          description: t.reports.closingBundle.doneDescription,
        });

        onOpenChange(false);
        return;
      }

      // Resposta inesperada
      throw new Error('Resposta inesperada del servidor');
    } catch (error) {
      console.error('[closing-bundle-dialog] Error:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: error instanceof Error ? error.message : t.reports.closingBundle.errors.timeout,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[min(96vw,48rem)] overflow-y-auto sm:w-[min(calc(100vw-3rem),48rem)]">
        <DialogHeader>
          <DialogTitle>{t.reports.closingBundle.dialogTitle}</DialogTitle>
          <DialogDescription>
            {t.reports.closingBundle.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selecció de període */}
          <div className="space-y-2">
            <Label>{t.reports.closingBundle.period}</Label>
            <Select
              value={periodOption}
              onValueChange={(value) => setPeriodOption(value as PeriodOption)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current_year">
                  {t.reports.closingBundle.periodCurrentYear}
                </SelectItem>
                <SelectItem value="previous_year">
                  {t.reports.closingBundle.periodPreviousYear}
                </SelectItem>
                <SelectItem value="custom">
                  {t.reports.closingBundle.periodCustom}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dates personalitzades */}
          {periodOption === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateFrom">{t.reports.closingBundle.dateFrom}</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateTo">{t.reports.closingBundle.dateTo}</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Botó de generació */}
        <div className="flex justify-end">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !isCustomValid || !canExportReports}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.reports.closingBundle.generating}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                {t.reports.closingBundle.generate}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
