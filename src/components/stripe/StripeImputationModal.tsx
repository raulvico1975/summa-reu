'use client';

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
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Loader2, AlertTriangle, CheckCircle2, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { useToast } from '@/hooks/use-toast';
import type { Donor } from '@/lib/data';
import type { Donation } from '@/lib/types/donations';
import {
  createStripeDonations,
  ERR_STRIPE_DUPLICATE_PAYMENT,
  type StripePaymentInput,
} from '@/lib/stripe/createStripeDonations';
import { persistStripeImputationWrites } from '@/lib/stripe/commitStripeImputationWrites';
import {
  assertNoActiveStripeImputationByParentTransactionId,
  ERR_STRIPE_PARENT_ALREADY_IMPUTED,
} from '@/lib/stripe/activeStripeImputation';
import {
  acquireProcessLock,
  getLockFailureMessage,
  releaseProcessLock,
} from '@/lib/fiscal/processLocks';
import {
  calculateEditableStripeImputationSummary,
  createManualEditableStripeImputationLine,
  resetEditableStripeImputationLinesFromCsv,
  resolveInitialSelectedTransferId,
  shouldPromptCsvReplacement,
  sortDonorsForStripeImputation,
  type StripeDonorUsageStats,
  type EditableStripeImputationLine,
} from '@/lib/stripe/editable-stripe-imputation';
import {
  findAllMatchingPayoutGroups,
  groupStripeRowsByTransfer,
  parseStripeCsv,
  type StripePayoutGroup,
} from '@/components/stripe-importer/useStripeImporter';
import { DonorSearchCombobox } from '@/components/donor-search-combobox';

interface BankTransactionSummary {
  id: string;
  amount: number;
  date: string;
  description: string;
}

interface StripeImputationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankTransaction: BankTransactionSummary;
  donors: Donor[];
  onComplete?: () => void;
}

interface CsvImportState {
  matchingGroups: StripePayoutGroup[];
  selectedTransferId: string | null;
  warning: string | null;
}

function buildCsvWarning(parsedWarningCount: number, matchingCount: number): string | null {
  if (parsedWarningCount > 0) {
    return "S'han exclòs pagaments reemborsats del CSV.";
  }
  if (matchingCount > 1) {
    return 'Hi ha diversos payouts que quadren amb aquest abonament. Selecciona el correcte.';
  }
  return null;
}

export function StripeImputationModal({
  open,
  onOpenChange,
  bankTransaction,
  donors,
  onComplete,
}: StripeImputationModalProps) {
  const { firestore, user } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const { toast } = useToast();
  const [isParsing, setIsParsing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDifferenceConfirmed, setIsDifferenceConfirmed] = React.useState(false);
  const [editableLines, setEditableLines] = React.useState<EditableStripeImputationLine[]>([]);
  const [csvImportState, setCsvImportState] = React.useState<CsvImportState | null>(null);
  const [pendingCsvImport, setPendingCsvImport] = React.useState<CsvImportState | null>(null);
  const [isReplaceDialogOpen, setIsReplaceDialogOpen] = React.useState(false);
  const [stripeDonorUsageById, setStripeDonorUsageById] = React.useState<StripeDonorUsageStats>({});
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const lineIdRef = React.useRef(0);

  const createLocalId = React.useCallback(() => {
    lineIdRef.current += 1;
    return `stripe-line-${lineIdRef.current}`;
  }, []);

  React.useEffect(() => {
    if (!open) {
      setIsParsing(false);
      setIsSaving(false);
      setIsDifferenceConfirmed(false);
      setEditableLines([]);
      setCsvImportState(null);
      setPendingCsvImport(null);
      setIsReplaceDialogOpen(false);
      setStripeDonorUsageById({});
      lineIdRef.current = 0;
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  }, [open]);

  React.useEffect(() => {
    if (!open || !organizationId) return;

    let cancelled = false;

    const loadStripeDonorUsage = async () => {
      try {
        const donationsRef = collection(firestore, 'organizations', organizationId, 'donations');
        const snapshot = await getDocs(query(donationsRef, where('source', '==', 'stripe')));
        if (cancelled) return;

        const nextUsage: StripeDonorUsageStats = {};
        snapshot.docs.forEach((docSnap) => {
          const donation = docSnap.data() as Donation;
          if (!donation.contactId || donation.archivedAt) return;

          const existing = nextUsage[donation.contactId] ?? { count: 0, lastDate: null };
          const donationDate = donation.date ?? null;
          nextUsage[donation.contactId] = {
            count: existing.count + 1,
            lastDate:
              donationDate && (!existing.lastDate || donationDate > existing.lastDate)
                ? donationDate
                : existing.lastDate,
          };
        });

        setStripeDonorUsageById(nextUsage);
      } catch (error) {
        console.error('Error loading Stripe donor usage:', error);
      }
    };

    void loadStripeDonorUsage();

    return () => {
      cancelled = true;
    };
  }, [firestore, open, organizationId]);

  const donorByEmail = React.useMemo(() => {
    return new Map(
      donors
        .filter((donor) => donor.email)
        .map((donor) => [donor.email!.toLowerCase().trim(), donor.id])
    );
  }, [donors]);

  const sortedDonors = React.useMemo(
    () => sortDonorsForStripeImputation(donors, stripeDonorUsageById),
    [donors, stripeDonorUsageById]
  );
  const donorBadgesById = React.useMemo(
    () =>
      Object.fromEntries(
        Object.entries(stripeDonorUsageById)
          .filter(([, usage]) => usage.count > 0)
          .map(([donorId]) => [donorId, 'Stripe'])
      ),
    [stripeDonorUsageById]
  );

  const selectedGroup = React.useMemo(() => {
    if (!csvImportState?.selectedTransferId) return null;
    return csvImportState.matchingGroups.find((group) => group.transferId === csvImportState.selectedTransferId) ?? null;
  }, [csvImportState]);

  const summary = React.useMemo(() => calculateEditableStripeImputationSummary({
    lines: editableLines,
    bankAmount: bankTransaction.amount,
  }), [bankTransaction.amount, editableLines]);

  const requiresDifferenceConfirmation = Math.abs(summary.difference) > 0;
  const canConfirm =
    editableLines.length > 0
    && !summary.hasInvalidLines
    && summary.duplicateStripePaymentIds.length === 0
    && (!requiresDifferenceConfirmation || isDifferenceConfirmed);

  const replaceLinesFromCsvState = React.useCallback((state: CsvImportState) => {
    const nextLines = resetEditableStripeImputationLinesFromCsv({
      matchingGroups: state.matchingGroups,
      selectedTransferId: state.selectedTransferId,
      donorByEmail,
      createLocalId,
    });

    setCsvImportState(state);
    setEditableLines(nextLines);
    setIsDifferenceConfirmed(false);
  }, [createLocalId, donorByEmail]);

  const parseCsvFile = React.useCallback(async (file: File): Promise<CsvImportState> => {
    const text = await file.text();
    const parsed = parseStripeCsv(text);
    const groups = groupStripeRowsByTransfer(parsed.rows);
    const allMatches = findAllMatchingPayoutGroups(groups, bankTransaction.amount);
    const initialSelectedTransferId = resolveInitialSelectedTransferId(allMatches);

    if (allMatches.length === 0) {
      throw new Error('No s\'ha trobat cap payout Stripe que quadri amb aquest abonament.');
    }

    return {
      matchingGroups: allMatches,
      selectedTransferId: initialSelectedTransferId,
      warning: buildCsvWarning(parsed.warnings.length, allMatches.length),
    };
  }, [bankTransaction.amount]);

  const handleFile = React.useCallback(async (file: File) => {
    setIsParsing(true);

    try {
      const nextState = await parseCsvFile(file);

      if (shouldPromptCsvReplacement(editableLines)) {
        setPendingCsvImport(nextState);
        setIsReplaceDialogOpen(true);
        return;
      }

      replaceLinesFromCsvState(nextState);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error processant el CSV';
      toast({
        variant: 'destructive',
        title: 'No s\'ha pogut imputar Stripe',
        description: message,
      });
    } finally {
      setIsParsing(false);
    }
  }, [editableLines, parseCsvFile, replaceLinesFromCsvState, toast]);

  const handleUploadChange = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleFile(file);
    event.target.value = '';
  }, [handleFile]);

  const handleSelectGroup = React.useCallback((transferId: string) => {
    if (!csvImportState) return;
    replaceLinesFromCsvState({
      ...csvImportState,
      selectedTransferId: transferId,
    });
  }, [csvImportState, replaceLinesFromCsvState]);

  const handleAddManualLine = React.useCallback(() => {
    setEditableLines((current) => [...current, createManualEditableStripeImputationLine(createLocalId())]);
    setIsDifferenceConfirmed(false);
  }, [createLocalId]);

  const handleDeleteLine = React.useCallback((localId: string) => {
    setEditableLines((current) => current.filter((line) => line.localId !== localId));
    setIsDifferenceConfirmed(false);
  }, []);

  const handleSetLineContact = React.useCallback((localId: string, contactId: string | null) => {
    setEditableLines((current) =>
      current.map((line) => line.localId === localId ? { ...line, contactId } : line)
    );
    setIsDifferenceConfirmed(false);
  }, []);

  const handleSetLineAmount = React.useCallback((localId: string, rawValue: string) => {
    const nextAmount = rawValue.trim() === '' ? null : Number(rawValue);
    setEditableLines((current) =>
      current.map((line) => line.localId === localId ? {
        ...line,
        amountGross: nextAmount != null && Number.isFinite(nextAmount) ? nextAmount : null,
      } : line)
    );
    setIsDifferenceConfirmed(false);
  }, []);

  const handleResetFromCsv = React.useCallback(() => {
    if (!csvImportState) return;
    replaceLinesFromCsvState(csvImportState);
  }, [csvImportState, replaceLinesFromCsvState]);

  const handleClearAll = React.useCallback(() => {
    setEditableLines([]);
    setCsvImportState(null);
    setPendingCsvImport(null);
    setIsReplaceDialogOpen(false);
    setIsDifferenceConfirmed(false);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  const handleConfirmReplaceCsv = React.useCallback(() => {
    if (pendingCsvImport) {
      replaceLinesFromCsvState(pendingCsvImport);
    }
    setPendingCsvImport(null);
    setIsReplaceDialogOpen(false);
  }, [pendingCsvImport, replaceLinesFromCsvState]);

  const handleCancelReplaceCsv = React.useCallback(() => {
    setPendingCsvImport(null);
    setIsReplaceDialogOpen(false);
  }, []);

  const findDonationByStripePaymentId = React.useCallback(async (stripePaymentId: string): Promise<Donation | null> => {
    if (!organizationId) return null;
    const donationsRef = collection(firestore, 'organizations', organizationId, 'donations');
    const snapshot = await getDocs(query(donationsRef, where('stripePaymentId', '==', stripePaymentId)));
    const firstDoc = snapshot.docs[0];
    if (!firstDoc) return null;
    return { id: firstDoc.id, ...(firstDoc.data() as Donation) };
  }, [firestore, organizationId]);

  const handleConfirm = React.useCallback(async () => {
    if (!organizationId || !canConfirm) return;

    const userId = user?.uid;
    const parentTxId = bankTransaction.id;
    let lockAcquired = false;

    setIsSaving(true);
    try {
      if (!userId) {
        throw new Error('AUTH_REQUIRED');
      }

      const lockResult = await acquireProcessLock({
        firestore,
        orgId: organizationId,
        parentTxId,
        operation: 'stripeSplit',
        uid: userId,
      });

      if (!lockResult.ok) {
        toast({
          variant: 'destructive',
          title: 'Error a la imputació Stripe',
          description: getLockFailureMessage(lockResult),
        });
        return;
      }
      lockAcquired = true;

      await assertNoActiveStripeImputationByParentTransactionId({
        firestore,
        organizationId,
        parentTransactionId: parentTxId,
      });

      const payments: StripePaymentInput[] = editableLines.map((line) => ({
        stripePaymentId: line.stripePaymentId ?? null,
        amount: line.amountGross ?? 0,
        fee: line.feeAmount ?? 0,
        contactId: line.contactId,
        date: line.date ?? bankTransaction.date,
        customerEmail: line.customerEmail ?? null,
        description: line.description ?? null,
        imputationOrigin: line.imputationOrigin,
      }));

      const { donations, adjustment } = await createStripeDonations({
        parentTransactionId: parentTxId,
        payments,
        bankAmount: bankTransaction.amount,
        adjustmentDate: bankTransaction.date,
        findDonationByStripePaymentId,
      });

      await persistStripeImputationWrites({
        firestore,
        organizationId,
        parentTransactionId: parentTxId,
        donations,
        adjustment,
        stripeTransferId: csvImportState?.selectedTransferId ?? null,
      });

      toast({
        title: 'Imputació Stripe completada',
        description: `S'han creat ${donations.length} donacions Stripe${adjustment ? ' i 1 ajust' : ''}.`,
      });

      onOpenChange(false);
      onComplete?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconegut';
      let description = message;

      if (message === ERR_STRIPE_DUPLICATE_PAYMENT) {
        description = 'Aquest pagament Stripe ja ha estat imputat.';
      } else if (message === ERR_STRIPE_PARENT_ALREADY_IMPUTED) {
        description = 'Aquest moviment ja té una imputació Stripe activa. Cal desfer-la abans de crear-ne una de nova.';
      } else if (message === 'AUTH_REQUIRED') {
        description = 'No s\'ha pogut validar la sessió. Torna-ho a provar.';
      }

      toast({
        variant: 'destructive',
        title: 'Error a la imputació Stripe',
        description,
      });
    } finally {
      if (lockAcquired) {
        await releaseProcessLock({
          firestore,
          orgId: organizationId,
          parentTxId,
        });
      }
      setIsSaving(false);
    }
  }, [bankTransaction.amount, bankTransaction.date, bankTransaction.id, canConfirm, csvImportState, editableLines, findDonationByStripePaymentId, firestore, onComplete, onOpenChange, organizationId, toast, user]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden">
          <DialogHeader className="shrink-0 pr-6">
            <DialogTitle>Imputar Stripe</DialogTitle>
            <DialogDescription>
              Pots carregar un CSV de Stripe o completar la imputació manualment. La taula final sempre és editable abans de confirmar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
              <Alert className="border-primary/20 bg-primary/5">
                <AlertTitle>Abonament bancari</AlertTitle>
                <AlertDescription>
                  Moviment bancari: <span className="font-semibold">{bankTransaction.amount.toFixed(2)} €</span>
                  <span className="text-muted-foreground"> · {bankTransaction.description}</span>
                </AlertDescription>
              </Alert>

              <div className="flex flex-wrap items-center gap-3">
                <Input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleUploadChange}
                  className="hidden"
                />
                <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={isParsing}>
                  {isParsing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Carregar CSV
                </Button>
                <Button type="button" variant="outline" onClick={handleAddManualLine}>
                  <Plus className="h-4 w-4 mr-2" />
                  Afegir línia
                </Button>
                {csvImportState && (
                  <Button type="button" variant="outline" onClick={handleResetFromCsv}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reiniciar des del CSV
                  </Button>
                )}
                {(editableLines.length > 0 || csvImportState) && (
                  <Button type="button" variant="outline" onClick={handleClearAll}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Netejar tot
                  </Button>
                )}
              </div>

              {csvImportState?.warning && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Revisa aquest punt</AlertTitle>
                  <AlertDescription>{csvImportState.warning}</AlertDescription>
                </Alert>
              )}

              {csvImportState && csvImportState.matchingGroups.length > 1 && (
                <div className="space-y-2">
                  <Label>Payout detectat</Label>
                  <Select value={csvImportState.selectedTransferId ?? undefined} onValueChange={handleSelectGroup}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el payout correcte" />
                    </SelectTrigger>
                    <SelectContent>
                      {csvImportState.matchingGroups.map((group) => (
                        <SelectItem key={group.transferId} value={group.transferId}>
                          {group.transferId} · net {group.net.toFixed(2)} €
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!selectedGroup && csvImportState && csvImportState.matchingGroups.length > 1 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Selecció pendent</AlertTitle>
                  <AlertDescription>
                    Hi ha diversos payouts possibles. Selecciona el correcte.
                  </AlertDescription>
                </Alert>
              )}

              {selectedGroup && csvImportState && csvImportState.matchingGroups.length === 1 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Payout detectat</AlertTitle>
                  <AlertDescription>
                    {selectedGroup.rows.length} pagaments · brut {selectedGroup.gross.toFixed(2)} € · comissions {selectedGroup.fees.toFixed(2)} € · net {selectedGroup.net.toFixed(2)} €
                  </AlertDescription>
                </Alert>
              )}

              {selectedGroup && csvImportState && csvImportState.matchingGroups.length > 1 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Payout seleccionat</AlertTitle>
                  <AlertDescription>
                    {selectedGroup.rows.length} pagaments · brut {selectedGroup.gross.toFixed(2)} € · comissions {selectedGroup.fees.toFixed(2)} € · net {selectedGroup.net.toFixed(2)} €
                  </AlertDescription>
                </Alert>
              )}

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Origen</TableHead>
                      <TableHead>Referència</TableHead>
                      <TableHead>Import brut</TableHead>
                      <TableHead>Donant</TableHead>
                      <TableHead className="w-[88px]">Accions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editableLines.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          Encara no hi ha línies d&apos;imputació. Pots començar manualment o carregar un CSV.
                        </TableCell>
                      </TableRow>
                    ) : (
                      editableLines.map((line) => (
                        <TableRow key={line.localId}>
                          <TableCell className="align-top">
                            <span className="text-sm">{line.imputationOrigin === 'csv' ? 'CSV' : 'Manual'}</span>
                          </TableCell>
                          <TableCell className="align-top text-sm text-muted-foreground">
                            {line.stripePaymentId ? (
                              <div className="space-y-1">
                                <div>{line.stripePaymentId}</div>
                                {line.customerEmail && <div>{line.customerEmail}</div>}
                              </div>
                            ) : (
                              'Sense identificador Stripe'
                            )}
                          </TableCell>
                          <TableCell className="align-top">
                            <Input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={line.amountGross ?? ''}
                              onChange={(event) => handleSetLineAmount(line.localId, event.target.value)}
                              placeholder="0.00"
                            />
                          </TableCell>
                          <TableCell className="align-top min-w-[260px]">
                            <DonorSearchCombobox
                              donors={sortedDonors}
                              badgesByDonorId={donorBadgesById}
                              value={line.contactId}
                              onSelect={(donorId) => handleSetLineContact(line.localId, donorId)}
                              placeholder="Assigna donant"
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteLine(line.localId)}
                              aria-label="Eliminar línia"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="rounded-lg border bg-muted/30 p-5">
                <div className="mb-4 text-sm font-medium text-muted-foreground">
                  Repartiment de l&apos;abonament
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border bg-background p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Total imputat</div>
                    <div className="mt-2 text-2xl font-semibold">{summary.totalImputed.toFixed(2)} €</div>
                  </div>
                  <div className="rounded-md border bg-background p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Banc</div>
                    <div className="mt-2 text-2xl font-semibold">{bankTransaction.amount.toFixed(2)} €</div>
                  </div>
                  <div className="rounded-md border bg-background p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Diferència</div>
                    <div className="mt-2 text-2xl font-semibold">
                      {(summary.totalImputed - bankTransaction.amount >= 0 ? '+' : '')}
                      {(summary.totalImputed - bankTransaction.amount).toFixed(2)} €
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  La diferència pot deure&apos;s a comissions o ajustos de Stripe.
                </p>
              </div>

              {summary.hasInvalidLines && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Falten dades per completar</AlertTitle>
                  <AlertDescription>
                    Cada línia ha de tenir donant i un import brut vàlid abans de confirmar.
                  </AlertDescription>
                </Alert>
              )}

              {summary.duplicateStripePaymentIds.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Pagaments Stripe duplicats</AlertTitle>
                  <AlertDescription>
                    No es pot confirmar mentre hi hagi `stripePaymentId` repetits dins la mateixa imputació.
                  </AlertDescription>
                </Alert>
              )}

              {requiresDifferenceConfirmation && (
                <>
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>La distribució no quadra exactament amb el banc</AlertTitle>
                    <AlertDescription>
                      La diferència pot deure&apos;s a comissions o ajustos de Stripe. Si el repartiment és correcte, confirma-ho explícitament.
                    </AlertDescription>
                  </Alert>
                  <div className="flex items-center gap-2 rounded-md border bg-background p-3">
                    <Checkbox
                      id="confirm-stripe-imputation-difference"
                      checked={isDifferenceConfirmed}
                      onCheckedChange={(value) => setIsDifferenceConfirmed(value === true)}
                    />
                    <Label htmlFor="confirm-stripe-imputation-difference">
                      Confirmo que la distribució és correcta
                    </Label>
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="shrink-0 border-t bg-background pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                Cancel·lar
              </Button>
              <Button onClick={handleConfirm} disabled={isSaving || !canConfirm}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Confirmar imputació
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isReplaceDialogOpen} onOpenChange={setIsReplaceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir la imputació actual?</AlertDialogTitle>
            <AlertDialogDescription>
              Ja hi ha línies d&apos;imputació a la taula. Carregar aquest CSV substituirà completament les línies actuals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelReplaceCsv}>Cancel·lar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReplaceCsv}>
              Substituir per les línies del CSV
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
