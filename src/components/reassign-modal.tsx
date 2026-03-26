'use client';

/**
 * ReassignModal - Modal reutilitzable per reassignar transaccions
 *
 * Flux:
 * 1. Pas 1: Seleccionar entitat destí (categoria o eix)
 * 2. Pas 2: Confirmar la reassignació
 * 3. Executar via API (no escriu Firestore directament)
 *
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { useTranslations } from '@/i18n';
import { Alert, AlertDescription } from '@/components/ui/alert';

export type ReassignType = 'category' | 'project';

export interface ReassignItem {
  id: string;
  name: string;
}

interface ReassignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: ReassignType;
  sourceItem: ReassignItem;
  targetItems: ReassignItem[]; // Exclou source i arxivats
  affectedCount: number;
  onConfirm: (targetId: string) => Promise<{ success: boolean; error?: string }>;
}

export function ReassignModal({
  open,
  onOpenChange,
  type,
  sourceItem,
  targetItems,
  affectedCount,
  onConfirm,
}: ReassignModalProps) {
  const { t } = useTranslations();
  const [selectedTarget, setSelectedTarget] = React.useState<string>('');
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [step, setStep] = React.useState<'select' | 'confirm'>('select');
  const [error, setError] = React.useState<string | null>(null);

  // Reset state quan el modal es tanca
  React.useEffect(() => {
    if (!open) {
      setSelectedTarget('');
      setStep('select');
      setError(null);
      setIsProcessing(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!selectedTarget) return;
    setIsProcessing(true);
    setError(null);

    try {
      const result = await onConfirm(selectedTarget);
      if (result.success) {
        onOpenChange(false);
      } else {
        setError(result.error || 'Error desconegut');
        setStep('select');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut');
      setStep('select');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedTargetItem = targetItems.find(item => item.id === selectedTarget);

  // Labels segons tipus
  const typeLabel = type === 'category'
    ? (t.settings?.category ?? 'categoria')
    : (t.projects?.axis ?? 'eix');

  const titleText = type === 'category'
    ? (t.settings?.reassignTitle ?? 'Reassignar moviments')
    : (t.projects?.reassignTitle ?? 'Reassignar moviments');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titleText}</DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? (type === 'category'
                  ? (t.settings?.reassignDescription ??
                     `Aquesta ${typeLabel} té ${affectedCount} moviments associats. Selecciona on vols reassignar-los.`)
                  : (t.projects?.reassignDescription ??
                     `Aquest ${typeLabel} té ${affectedCount} moviments associats. Selecciona on vols reassignar-los.`))
              : (t.settings?.reassignConfirmDescription ??
                 `Confirma que vols moure ${affectedCount} moviments.`)
            }
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 'select' && (
          <div className="grid gap-4 py-4">
            {/* Origen */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium">{t.common?.from ?? 'De'}:</span>
              <span className="text-foreground">{sourceItem.name}</span>
            </div>

            {/* Selector destí */}
            <div className="grid gap-2">
              <Label>{t.settings?.reassignTarget ?? `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} destí`}</Label>
              <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                <SelectTrigger>
                  <SelectValue placeholder={t.settings?.reassignSelectPlaceholder ?? 'Selecciona...'} />
                </SelectTrigger>
                <SelectContent>
                  {targetItems.length === 0 ? (
                    <SelectItem value="_empty" disabled>
                      {t.settings?.noAvailableTargets ?? `No hi ha ${typeLabel}s disponibles`}
                    </SelectItem>
                  ) : (
                    targetItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Recompte */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t.common?.movements ?? 'Moviments'}:</span>
              <span className="font-medium">{affectedCount}</span>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="py-4">
            <div className="flex items-center justify-center gap-4 p-4 bg-muted rounded-lg">
              <div className="text-center">
                <div className="text-sm text-muted-foreground">{t.common?.from ?? 'De'}</div>
                <div className="font-medium">{sourceItem.name}</div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <div className="text-center">
                <div className="text-sm text-muted-foreground">{t.common?.to ?? 'A'}</div>
                <div className="font-medium">{selectedTargetItem?.name}</div>
              </div>
            </div>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              {affectedCount} {t.common?.movementsWillBeMoved ?? 'moviments seran moguts'}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'select' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t.common?.cancel ?? 'Cancel·lar'}
              </Button>
              <Button
                onClick={() => setStep('confirm')}
                disabled={!selectedTarget || targetItems.length === 0}
              >
                {t.common?.continue ?? 'Continuar'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('select')} disabled={isProcessing}>
                {t.common?.back ?? 'Enrere'}
              </Button>
              <Button onClick={handleConfirm} disabled={isProcessing}>
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t.settings?.reassignConfirmButton
                  ? (typeof t.settings.reassignConfirmButton === 'function'
                      ? t.settings.reassignConfirmButton(affectedCount)
                      : t.settings.reassignConfirmButton)
                  : `Reassignar ${affectedCount} moviments`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
