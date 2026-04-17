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
import { Badge } from '@/components/ui/badge';
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
import { addDocumentNonBlocking, useFirebase } from '@/firebase';
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
import { CreateQuickDonorDialog, type QuickDonorFormData } from '@/components/stripe-importer/CreateQuickDonorDialog';
import { findExistingContact } from '@/lib/contact-matching';
import {
  buildStripeQuickDonorContactPayload,
  toLocalDonorFromStripeQuickPayload,
  type StripeQuickDonorKind,
} from '@/lib/stripe/quick-donor';
import {
  buildStripePayoutGroupFromPayments,
  type StripePayoutPayment,
} from '@/lib/stripe/payout-sync';
import type { StripeRecentPayout } from '@/lib/stripe/payout-api';
import { useTranslations, type TrFunction } from '@/i18n';

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
  source: 'csv' | 'stripe';
}

interface QuickCreateState {
  lineLocalId: string;
  kind: StripeQuickDonorKind;
  initialData?: Partial<QuickDonorFormData>;
}

function formatStripePayoutDate(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return '--';
  }

  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(timestamp * 1000));
}

function formatStripeCurrencyAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function shortenStripeId(id: string): string {
  if (id.length <= 14) {
    return id;
  }

  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function buildCsvWarning(parsedWarningCount: number, matchingCount: number, tr: TrFunction): string | null {
  if (parsedWarningCount > 0) {
    return tr('dialogs.stripeImputation.refundedExcluded', "S'han exclòs pagaments reemborsats del CSV.");
  }
  if (matchingCount > 1) {
    return tr('dialogs.stripeImputation.multiplePayoutsWarning', 'Hi ha diversos payouts que quadren amb aquest abonament. Selecciona el correcte.');
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
  const { t, tr } = useTranslations();
  const [isParsing, setIsParsing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDifferenceConfirmed, setIsDifferenceConfirmed] = React.useState(false);
  const [editableLines, setEditableLines] = React.useState<EditableStripeImputationLine[]>([]);
  const [csvImportState, setCsvImportState] = React.useState<CsvImportState | null>(null);
  const [pendingCsvImport, setPendingCsvImport] = React.useState<CsvImportState | null>(null);
  const [isReplaceDialogOpen, setIsReplaceDialogOpen] = React.useState(false);
  const [stripeDonorUsageById, setStripeDonorUsageById] = React.useState<StripeDonorUsageStats>({});
  const [localDonorOverrides, setLocalDonorOverrides] = React.useState<Donor[]>([]);
  const [quickCreateState, setQuickCreateState] = React.useState<QuickCreateState | null>(null);
  const [isStripeImportVisible, setIsStripeImportVisible] = React.useState(false);
  const [stripeRecentPayouts, setStripeRecentPayouts] = React.useState<StripeRecentPayout[]>([]);
  const [selectedStripePayoutId, setSelectedStripePayoutId] = React.useState('');
  const [isStripePayoutsLoading, setIsStripePayoutsLoading] = React.useState(false);
  const [isStripeImporting, setIsStripeImporting] = React.useState(false);
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
      setLocalDonorOverrides([]);
      setQuickCreateState(null);
      setIsStripeImportVisible(false);
      setStripeRecentPayouts([]);
      setSelectedStripePayoutId('');
      setIsStripePayoutsLoading(false);
      setIsStripeImporting(false);
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

  const availableDonors = React.useMemo(() => {
    const byId = new Map<string, Donor>();
    localDonorOverrides.forEach((donor) => byId.set(donor.id, donor));
    donors.forEach((donor) => byId.set(donor.id, donor));
    return Array.from(byId.values());
  }, [donors, localDonorOverrides]);

  const donorByEmail = React.useMemo(() => {
    return new Map(
      availableDonors
        .filter((donor) => donor.email)
        .map((donor) => [donor.email!.toLowerCase().trim(), donor.id])
    );
  }, [availableDonors]);

  const sortedDonors = React.useMemo(
    () => sortDonorsForStripeImputation(availableDonors, stripeDonorUsageById),
    [availableDonors, stripeDonorUsageById]
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
  const importedSourceLabel = csvImportState?.source === 'stripe'
    ? tr('dialogs.stripeImputation.importSourceStripe', 'Stripe')
    : 'CSV';

  const summary = React.useMemo(() => calculateEditableStripeImputationSummary({
    lines: editableLines,
    bankAmount: bankTransaction.amount,
  }), [bankTransaction.amount, editableLines]);

  const requiresDifferenceConfirmation = Math.abs(summary.difference) > 0;
  const pendingAssignmentCount = React.useMemo(
    () => editableLines.filter((line) => !line.contactId).length,
    [editableLines]
  );
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
      throw new Error(tr('dialogs.stripeImputation.noMatchingPayout', 'No s\'ha trobat cap payout Stripe que quadri amb aquest abonament.'));
    }

    return {
      matchingGroups: allMatches,
      selectedTransferId: initialSelectedTransferId,
      warning: buildCsvWarning(parsed.warnings.length, allMatches.length, tr),
      source: 'csv',
    };
  }, [bankTransaction.amount, tr]);

  const buildStripeImportState = React.useCallback((
    payoutId: string,
    payments: StripePayoutPayment[]
  ): CsvImportState => {
    if (payments.length === 0) {
      throw new Error(
        tr('dialogs.stripeImputation.noStripeCharges', 'Aquest payout no conté pagaments de tipus charge disponibles per imputar.')
      );
    }

    return {
      matchingGroups: [buildStripePayoutGroupFromPayments(payoutId, payments)],
      selectedTransferId: payoutId,
      warning: null,
      source: 'stripe',
    };
  }, [tr]);

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
      const message = error instanceof Error ? error.message : t.common.unknownError;
      toast({
        variant: 'destructive',
        title: tr('dialogs.stripeImputation.modalErrorTitle', 'Error a la imputació Stripe'),
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

  const loadRecentStripePayouts = React.useCallback(async (): Promise<StripeRecentPayout[]> => {
    if (!organizationId) return [];
    if (!user) {
      toast({
        variant: 'destructive',
        title: tr('dialogs.stripeImputation.modalErrorTitle', 'Error a la imputació Stripe'),
        description: tr('dialogs.stripeImputation.authRequired', 'No s\'ha pogut validar la sessió. Torna-ho a provar.'),
      });
      return [];
    }

    setIsStripePayoutsLoading(true);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(
        `/api/stripe/payouts?orgId=${encodeURIComponent(organizationId)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMessage =
          payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : tr('dialogs.stripeImputation.loadStripeError', 'No s\'ha pogut carregar aquest payout de Stripe.');
        throw new Error(errorMessage);
      }

      if (!Array.isArray(payload)) {
        throw new Error(tr('dialogs.stripeImputation.loadStripeError', 'No s\'ha pogut carregar aquest payout de Stripe.'));
      }

      const payouts = payload as StripeRecentPayout[];
      setStripeRecentPayouts(payouts);
      setSelectedStripePayoutId((current) => {
        if (current && payouts.some((payout) => payout.id === current)) {
          return current;
        }
        return payouts[0]?.id ?? '';
      });
      return payouts;
    } catch (error) {
      const message = error instanceof Error ? error.message : t.common.unknownError;
      toast({
        variant: 'destructive',
        title: tr('dialogs.stripeImputation.modalErrorTitle', 'Error a la imputació Stripe'),
        description: message,
      });
      setStripeRecentPayouts([]);
      setSelectedStripePayoutId('');
      return [];
    } finally {
      setIsStripePayoutsLoading(false);
    }
  }, [organizationId, t.common.unknownError, toast, tr, user]);

  const handleToggleStripeImport = React.useCallback(async () => {
    if (isStripeImportVisible) {
      setIsStripeImportVisible(false);
      return;
    }

    setIsStripeImportVisible(true);
    await loadRecentStripePayouts();
  }, [isStripeImportVisible, loadRecentStripePayouts]);

  const handleImportFromStripe = React.useCallback(async () => {
    if (!organizationId) return;

    const payoutId = selectedStripePayoutId.trim();
    if (!payoutId) {
      toast({
        variant: 'destructive',
        title: tr('dialogs.stripeImputation.modalErrorTitle', 'Error a la imputació Stripe'),
        description: tr('dialogs.stripeImputation.missingPayoutId', 'Selecciona un payout de Stripe abans d importar.'),
      });
      return;
    }

    if (!user) {
      toast({
        variant: 'destructive',
        title: tr('dialogs.stripeImputation.modalErrorTitle', 'Error a la imputació Stripe'),
        description: tr('dialogs.stripeImputation.authRequired', 'No s\'ha pogut validar la sessió. Torna-ho a provar.'),
      });
      return;
    }

    setIsStripeImporting(true);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(
        `/api/stripe/payout/${encodeURIComponent(payoutId)}?orgId=${encodeURIComponent(organizationId)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMessage =
          payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : tr('dialogs.stripeImputation.loadStripeError', 'No s\'ha pogut carregar aquest payout de Stripe.');
        throw new Error(errorMessage);
      }

      if (!Array.isArray(payload)) {
        throw new Error(tr('dialogs.stripeImputation.loadStripeError', 'No s\'ha pogut carregar aquest payout de Stripe.'));
      }

      const nextState = buildStripeImportState(payoutId, payload as StripePayoutPayment[]);

      if (shouldPromptCsvReplacement(editableLines)) {
        setPendingCsvImport(nextState);
        setIsReplaceDialogOpen(true);
      } else {
        replaceLinesFromCsvState(nextState);
      }

      setIsStripeImportVisible(false);
      setSelectedStripePayoutId('');
    } catch (error) {
      const message = error instanceof Error ? error.message : t.common.unknownError;
      toast({
        variant: 'destructive',
        title: tr('dialogs.stripeImputation.modalErrorTitle', 'Error a la imputació Stripe'),
        description: message,
      });
    } finally {
      setIsStripeImporting(false);
    }
  }, [buildStripeImportState, editableLines, organizationId, replaceLinesFromCsvState, selectedStripePayoutId, t.common.unknownError, toast, tr, user]);

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
    setEditableLines((current) => {
      const targetLine = current.find((line) => line.localId === localId);
      if (!targetLine) return current;

      const targetEmail = targetLine.customerEmail?.toLowerCase().trim() ?? null;

      return current.map((line) => {
        if (line.localId === localId) {
          return { ...line, contactId };
        }

        if (!contactId || !targetEmail) {
          return line;
        }

        const lineEmail = line.customerEmail?.toLowerCase().trim() ?? null;
        if (!lineEmail || lineEmail !== targetEmail) {
          return line;
        }

        if (line.contactId && line.contactId !== contactId) {
          return line;
        }

        return { ...line, contactId };
      });
    });
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
    setQuickCreateState(null);
    setIsStripeImportVisible(false);
    setStripeRecentPayouts([]);
    setSelectedStripePayoutId('');
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

  const handleOpenQuickCreate = React.useCallback((localId: string, kind: StripeQuickDonorKind) => {
    const line = editableLines.find((currentLine) => currentLine.localId === localId);
    setQuickCreateState({
      lineLocalId: localId,
      kind,
      initialData: {
        email: line?.customerEmail ?? '',
      },
    });
  }, [editableLines]);

  const handleQuickCreateOpenChange = React.useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setQuickCreateState(null);
    }
  }, []);

  const handleCreateQuickDonor = React.useCallback(async (formData: QuickDonorFormData): Promise<string | null> => {
    if (!organizationId || !firestore || !quickCreateState) return null;

    const contactsCollection = collection(firestore, 'organizations', organizationId, 'contacts');
    const existingMatch = findExistingContact(
      availableDonors as any[],
      formData.taxId.trim() || undefined,
      undefined,
      formData.email.trim() || undefined
    );

    if (existingMatch.found && existingMatch.contact) {
      const existingDonor = existingMatch.contact as Donor;

      setLocalDonorOverrides((current) => {
        const next = current.filter((donor) => donor.id !== existingDonor.id);
        return [...next, existingDonor];
      });
      handleSetLineContact(quickCreateState.lineLocalId, existingDonor.id);

      const existingIsMember = existingDonor.membershipType === 'recurring';
      const requestedIsMember = quickCreateState.kind === 'member';

      toast({
        title: requestedIsMember
          ? tr('dialogs.stripeImputation.memberAssignedTitle', 'Soci assignat')
          : tr('dialogs.stripeImputation.donorAssignedTitle', 'Donant assignat'),
        description:
          requestedIsMember && !existingIsMember
            ? tr('dialogs.stripeImputation.existingAssignedNeedsReview', '{name} ja existia com a donant. L\'he assignat sense canviar-lo a soci; si cal, revisa la seva fitxa.').replace('{name}', existingDonor.name)
            : tr('dialogs.stripeImputation.existingAssignedSame', '{name} ja existia i l\'he assignat a la imputació.').replace('{name}', existingDonor.name),
      });

      return existingDonor.id;
    }

    const nowIso = new Date().toISOString();
    const payload = buildStripeQuickDonorContactPayload({
      kind: quickCreateState.kind,
      formData,
      nowIso,
      memberSince: quickCreateState.kind === 'member'
        ? (bankTransaction.date || nowIso.slice(0, 10))
        : null,
    });

    try {
      const docRef = await addDocumentNonBlocking(contactsCollection, payload);
      if (!docRef) {
        return null;
      }

      const localDonor = toLocalDonorFromStripeQuickPayload(docRef.id, payload);
      setLocalDonorOverrides((current) => {
        const next = current.filter((donor) => donor.id !== localDonor.id);
        return [...next, localDonor];
      });
      handleSetLineContact(quickCreateState.lineLocalId, localDonor.id);

      toast({
        title: quickCreateState.kind === 'member'
          ? tr('dialogs.stripeImputation.memberAssignedTitle', 'Soci assignat')
          : tr('dialogs.stripeImputation.donorAssignedTitle', 'Donant assignat'),
        description: tr('dialogs.stripeImputation.successDescription', '{name} ja queda vinculat a la donació Stripe i disponible a la seva fitxa.').replace('{name}', localDonor.name),
      });

      if (!payload.taxId || !payload.zipCode) {
        setTimeout(() => {
          toast({
            title: tr('dialogs.stripeImputation.missingFiscalTitle', 'Falten dades fiscals'),
            description: tr('dialogs.stripeImputation.missingFiscalDescription', 'Completa NIF i codi postal a la fitxa per tenir el 182 i els certificats perfectament preparats.'),
            duration: 5000,
          });
        }, 400);
      }

      return localDonor.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : t.common.unknownError;
      toast({
        variant: 'destructive',
        title: tr('dialogs.stripeImputation.createContactErrorTitle', 'No s\'ha pogut crear el contacte'),
        description: message,
      });
      return null;
    }
  }, [availableDonors, bankTransaction.date, firestore, handleSetLineContact, organizationId, quickCreateState, toast]);

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
          title: tr('dialogs.stripeImputation.modalErrorTitle', 'Error a la imputació Stripe'),
          description: getLockFailureMessage(lockResult, {
            lockedByOther: tr('dialogs.stripeImputation.alreadyImputed', 'Aquest moviment ja té una imputació Stripe activa. Obre el detall i desfés-la abans de tornar-ho a provar.'),
            processingError: t.common.actionError,
          }),
        });
        return;
      }
      lockAcquired = true;

      await assertNoActiveStripeImputationByParentTransactionId({
        firestore,
        organizationId,
        parentTransactionId: parentTxId,
      });

      const existingStripePaymentIds = new Set(
        (
          await Promise.all(
            editableLines
              .map((line) => line.stripePaymentId)
              .filter((stripePaymentId): stripePaymentId is string => Boolean(stripePaymentId))
              .map(async (stripePaymentId) => {
                const existingDonation = await findDonationByStripePaymentId(stripePaymentId);
                if (existingDonation && !existingDonation.archivedAt) {
                  return stripePaymentId;
                }
                return null;
              })
          )
        ).filter((stripePaymentId): stripePaymentId is string => Boolean(stripePaymentId))
      );

      const skippedExistingCount = editableLines.filter(
        (line) => line.stripePaymentId && existingStripePaymentIds.has(line.stripePaymentId)
      ).length;

      const payments: StripePaymentInput[] = editableLines
        .filter((line) => !line.stripePaymentId || !existingStripePaymentIds.has(line.stripePaymentId))
        .map((line) => ({
        stripePaymentId: line.stripePaymentId ?? null,
        amount: line.amountGross ?? 0,
        fee: line.feeAmount ?? 0,
        contactId: line.contactId,
        date: line.date ?? bankTransaction.date,
        customerEmail: line.customerEmail ?? null,
        description: line.description ?? null,
        imputationOrigin: line.imputationOrigin === 'manual' ? 'manual' : 'csv',
      }));

      if (payments.length === 0) {
        toast({
          title: tr('dialogs.stripeImputation.noNewPaymentsTitle', 'Cap pagament nou per imputar'),
          description: tr('dialogs.stripeImputation.noNewPaymentsDescription', 'Tots els stripePaymentId d aquesta selecció ja existeixen. No s han creat duplicats.'),
        });
        return;
      }

      const { donations, adjustment } = await createStripeDonations({
        parentTransactionId: parentTxId,
        payments,
        bankAmount: bankTransaction.amount,
        adjustmentDate: bankTransaction.date,
        findDonationByStripePaymentId: async () => null,
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
        title: tr('dialogs.stripeImputation.completedTitle', 'Imputació Stripe completada'),
        description: tr('dialogs.stripeImputation.completedDescription', 'S\'han creat {count} donacions Stripe{adjustment}.')
          .replace('{count}', String(donations.length))
          .replace(
            '{adjustment}',
            adjustment ? tr('dialogs.stripeImputation.completedDescriptionAdjustment', ' i 1 ajust') : ''
          ) + (
            skippedExistingCount > 0
              ? ` ${tr('dialogs.stripeImputation.completedSkippedExisting', 'S han ignorat {count} pagaments ja existents.')}`.replace('{count}', String(skippedExistingCount))
              : ''
          ),
      });

      onOpenChange(false);
      onComplete?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : t.common.unknownError;
      let description = message;

      if (message === ERR_STRIPE_DUPLICATE_PAYMENT) {
        description = tr('dialogs.stripeImputation.alreadyImputed', 'Aquest moviment ja té una imputació Stripe activa. Obre el detall i desfés-la abans de tornar-ho a provar.');
      } else if (message === ERR_STRIPE_PARENT_ALREADY_IMPUTED) {
        description = tr('dialogs.stripeImputation.alreadyImputed', 'Aquest moviment ja té una imputació Stripe activa. Obre el detall i desfés-la abans de tornar-ho a provar.');
      } else if (message === 'AUTH_REQUIRED') {
        description = tr('dialogs.stripeImputation.authRequired', 'No s\'ha pogut validar la sessió. Torna-ho a provar.');
      }

      toast({
        variant: 'destructive',
        title: tr('dialogs.stripeImputation.modalErrorTitle', 'Error a la imputació Stripe'),
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
  }, [bankTransaction.amount, bankTransaction.date, bankTransaction.id, canConfirm, csvImportState, editableLines, findDonationByStripePaymentId, firestore, onComplete, onOpenChange, organizationId, t.common.actionError, t.common.unknownError, toast, tr, user]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-0.75rem)] max-w-[1460px] flex-col overflow-hidden p-0 sm:w-[min(calc(100vw-2rem),1460px)]">
          <DialogHeader className="shrink-0 border-b bg-background px-4 py-4 pr-10 sm:px-6">
            <DialogTitle>{tr('dialogs.stripeImputation.title', 'Imputar Stripe')}</DialogTitle>
            <DialogDescription className="break-words leading-relaxed">
              {tr('dialogs.stripeImputation.descriptionStripeImport', 'Aquest moviment bancari correspon a un payout Stripe. Summa en pot carregar el detall directament des de Stripe i deixar-te la imputació preparada. Usa el CSV només si la sync no està disponible.')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 sm:px-6">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
              <Alert className="border-primary/20 bg-primary/5">
                <AlertTitle>{tr('dialogs.stripeImputation.bankPaymentTitle', 'Abonament bancari')}</AlertTitle>
                <AlertDescription>
                  {tr('dialogs.stripeImputation.bankPaymentLabel', 'Moviment bancari:')} <span className="font-semibold">{bankTransaction.amount.toFixed(2)} €</span>
                  <span className="text-muted-foreground"> · {bankTransaction.description}</span>
                </AlertDescription>
              </Alert>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() => { void handleToggleStripeImport(); }}
                  disabled={isStripeImporting || isStripePayoutsLoading}
                >
                  {isStripeImporting || isStripePayoutsLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {tr('dialogs.stripeImputation.importFromStripe', 'Importar des de Stripe')}
                </Button>
                <Input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleUploadChange}
                  className="hidden"
                />
                <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={isParsing}>
                  {isParsing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {tr('dialogs.stripeImputation.uploadCsv', 'Carregar CSV')}
                </Button>
                <Button type="button" variant="outline" onClick={handleAddManualLine}>
                  <Plus className="h-4 w-4 mr-2" />
                  {tr('dialogs.stripeImputation.addLine', 'Afegir línia')}
                </Button>
                {csvImportState && (
                  <Button type="button" variant="outline" onClick={handleResetFromCsv}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {csvImportState.source === 'stripe'
                      ? tr('dialogs.stripeImputation.resetFromStripe', 'Reiniciar des de Stripe')
                      : tr('dialogs.stripeImputation.resetFromCsv', 'Reiniciar des del CSV')}
                  </Button>
                )}
                {(editableLines.length > 0 || csvImportState) && (
                  <Button type="button" variant="outline" onClick={handleClearAll}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {tr('dialogs.stripeImputation.clearAll', 'Netejar tot')}
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {tr('dialogs.stripeImputation.primaryFlowHint', 'Comença per Stripe Sync. Si no pots carregar el payout des de Stripe, fes servir el CSV com a via alternativa.')}
              </p>

              {isStripeImportVisible && (
                <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-4 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="stripe-payout-select">
                      {tr('dialogs.stripeImputation.recentPayoutLabel', 'Payout recent de Stripe')}
                    </Label>
                    {isStripePayoutsLoading ? (
                      <div className="flex h-10 items-center rounded-md border bg-background px-3 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {tr('dialogs.stripeImputation.loadingRecentPayouts', 'Carregant payouts recents de Stripe...')}
                      </div>
                    ) : stripeRecentPayouts.length > 0 ? (
                      <Select value={selectedStripePayoutId} onValueChange={setSelectedStripePayoutId}>
                        <SelectTrigger id="stripe-payout-select">
                          <SelectValue placeholder={tr('dialogs.stripeImputation.recentPayoutPlaceholder', 'Selecciona un payout paid')} />
                        </SelectTrigger>
                        <SelectContent>
                          {stripeRecentPayouts.map((payout) => (
                            <SelectItem key={payout.id} value={payout.id}>
                              {`${formatStripePayoutDate(payout.arrivalDate || payout.created)} · ${formatStripeCurrencyAmount(payout.amount, payout.currency)} · ${shortenStripeId(payout.id)}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex h-10 items-center rounded-md border bg-background px-3 text-sm text-muted-foreground">
                        {tr('dialogs.stripeImputation.noRecentPaidPayouts', 'No hi ha payouts paid recents disponibles a Stripe.')}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={handleImportFromStripe}
                    disabled={isStripeImporting || isStripePayoutsLoading || selectedStripePayoutId.trim().length === 0}
                  >
                    {isStripeImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    {tr('dialogs.stripeImputation.loadStripePayout', 'Carregar payout')}
                  </Button>
                </div>
              )}

              {csvImportState?.warning && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{tr('dialogs.stripeImputation.reviewWarningTitle', 'Revisa aquest punt')}</AlertTitle>
                  <AlertDescription>{csvImportState.warning}</AlertDescription>
                </Alert>
              )}

              {csvImportState && csvImportState.matchingGroups.length > 1 && (
                <div className="space-y-2">
                  <Label>{tr('dialogs.stripeImputation.detectedPayoutLabel', 'Payout detectat')}</Label>
                  <Select value={csvImportState.selectedTransferId ?? undefined} onValueChange={handleSelectGroup}>
                    <SelectTrigger>
                      <SelectValue placeholder={tr('dialogs.stripeImputation.detectedPayoutPlaceholder', 'Selecciona el payout correcte')} />
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
                  <AlertTitle>{tr('dialogs.stripeImputation.searchPendingTitle', 'Selecció pendent')}</AlertTitle>
                  <AlertDescription>
                    {tr('dialogs.stripeImputation.searchPendingDescription', 'Hi ha diversos payouts possibles. Selecciona el correcte.')}
                  </AlertDescription>
                </Alert>
              )}

              {selectedGroup && csvImportState && csvImportState.matchingGroups.length === 1 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>{tr('dialogs.stripeImputation.payoutDetectedTitle', 'Payout detectat')}</AlertTitle>
                  <AlertDescription>
                    {selectedGroup.rows.length} {tr('dialogs.stripeImputation.payoutSummaryPayments', 'pagaments')} · {tr('dialogs.stripeImputation.payoutSummaryGross', 'brut')} {selectedGroup.gross.toFixed(2)} € · {tr('dialogs.stripeImputation.payoutSummaryFees', 'comissions')} {selectedGroup.fees.toFixed(2)} € · {tr('dialogs.stripeImputation.payoutSummaryNet', 'net')} {selectedGroup.net.toFixed(2)} €
                  </AlertDescription>
                </Alert>
              )}

              {selectedGroup && csvImportState && csvImportState.matchingGroups.length > 1 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>{tr('dialogs.stripeImputation.payoutSelectedTitle', 'Payout seleccionat')}</AlertTitle>
                  <AlertDescription>
                    {selectedGroup.rows.length} {tr('dialogs.stripeImputation.payoutSummaryPayments', 'pagaments')} · {tr('dialogs.stripeImputation.payoutSummaryGross', 'brut')} {selectedGroup.gross.toFixed(2)} € · {tr('dialogs.stripeImputation.payoutSummaryFees', 'comissions')} {selectedGroup.fees.toFixed(2)} € · {tr('dialogs.stripeImputation.payoutSummaryNet', 'net')} {selectedGroup.net.toFixed(2)} €
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-3 lg:hidden">
                {editableLines.length === 0 ? (
                  <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
                    {tr('dialogs.stripeImputation.emptyStripeImport', 'Encara no hi ha línies d\'imputació. Comença important el payout des de Stripe. Usa el CSV només si la sync no està disponible.')}
                  </div>
                ) : (
                  editableLines.map((line) => (
                    <div key={line.localId} className="space-y-4 rounded-lg border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {line.imputationOrigin === 'csv' ? importedSourceLabel : tr('dialogs.stripeImputation.manualOrigin', 'Manual')}
                          </div>
                          <div className="break-all text-sm text-foreground">
                            {line.stripePaymentId || tr('dialogs.stripeImputation.noStripeIdentifier', 'Sense identificador Stripe')}
                          </div>
                          {line.customerEmail && (
                            <div className="break-words text-sm text-muted-foreground">{line.customerEmail}</div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteLine(line.localId)}
                          aria-label={tr('dialogs.stripeImputation.deleteLineAria', 'Eliminar línia')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                            {tr('dialogs.stripeImputation.grossAmount', 'Import brut')}
                          </Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={line.amountGross ?? ''}
                            onChange={(event) => handleSetLineAmount(line.localId, event.target.value)}
                            placeholder="0.00"
                          />
                        </div>

                        <div className="min-w-0 space-y-2">
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                            {tr('dialogs.stripeImputation.donor', 'Donant')}
                          </Label>
                          {!line.contactId && (
                            <div className="space-y-1">
                              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                                {tr('dialogs.stripeImputation.pendingAssignmentBadge', 'Pendent d\'assignació')}
                              </Badge>
                              <p className="text-xs text-muted-foreground">
                                {tr('dialogs.stripeImputation.pendingAssignmentDescription', 'Assigna manualment el donant o soci per poder confirmar aquesta línia.')}
                              </p>
                            </div>
                          )}
                          <DonorSearchCombobox
                            donors={sortedDonors}
                            value={line.contactId}
                            onSelect={(donorId) => handleSetLineContact(line.localId, donorId)}
                            placeholder={tr('dialogs.stripeImputation.assignDonorPlaceholder', 'Assigna donant')}
                            presentation="dialog"
                            dialogTitle={tr('dialogs.stripeImputation.donorDialogTitle', 'Selecciona donant o soci')}
                            createActions={[
                              {
                                key: `donor-${line.localId}`,
                                label: tr('dialogs.stripeImputation.createDonor', 'Donar d\'alta nou donant'),
                                onSelect: () => handleOpenQuickCreate(line.localId, 'donor'),
                              },
                              {
                                key: `member-${line.localId}`,
                                label: tr('dialogs.stripeImputation.createMember', 'Donar d\'alta nou soci'),
                                onSelect: () => handleOpenQuickCreate(line.localId, 'member'),
                              },
                            ]}
                            badgesByDonorId={donorBadgesById}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="hidden rounded-md border lg:block">
                <Table className="w-full min-w-[920px]">
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead className="w-[92px]">{tr('dialogs.stripeImputation.tableOrigin', 'Origen')}</TableHead>
                      <TableHead className="w-[280px]">{tr('dialogs.stripeImputation.reference', 'Referència')}</TableHead>
                      <TableHead className="w-[132px]">{tr('dialogs.stripeImputation.grossAmount', 'Import brut')}</TableHead>
                      <TableHead>{tr('dialogs.stripeImputation.donor', 'Donant')}</TableHead>
                      <TableHead className="w-[80px] text-right">{tr('dialogs.stripeImputation.tableActions', 'Accions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editableLines.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          {tr('dialogs.stripeImputation.emptyStripeImport', 'Encara no hi ha línies d\'imputació. Comença important el payout des de Stripe. Usa el CSV només si la sync no està disponible.')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      editableLines.map((line) => (
                        <TableRow key={line.localId}>
                          <TableCell className="align-top">
                            <span className="text-sm">{line.imputationOrigin === 'csv' ? importedSourceLabel : tr('dialogs.stripeImputation.manualOrigin', 'Manual')}</span>
                          </TableCell>
                          <TableCell className="align-top text-sm text-muted-foreground">
                            {line.stripePaymentId ? (
                              <div className="space-y-1">
                                <div className="break-all text-foreground">{line.stripePaymentId}</div>
                                {line.customerEmail && <div className="break-words">{line.customerEmail}</div>}
                              </div>
                            ) : (
                              tr('dialogs.stripeImputation.noStripeIdentifier', 'Sense identificador Stripe')
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
                          <TableCell className="min-w-[320px] align-top">
                            {!line.contactId && (
                              <div className="mb-2 space-y-1">
                                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                                  {tr('dialogs.stripeImputation.pendingAssignmentBadge', 'Pendent d\'assignació')}
                                </Badge>
                                <p className="text-xs text-muted-foreground">
                                  {tr('dialogs.stripeImputation.pendingAssignmentDescription', 'Assigna manualment el donant o soci per poder confirmar aquesta línia.')}
                                </p>
                              </div>
                            )}
                            <DonorSearchCombobox
                              donors={sortedDonors}
                              value={line.contactId}
                              onSelect={(donorId) => handleSetLineContact(line.localId, donorId)}
                              placeholder={tr('dialogs.stripeImputation.assignDonorPlaceholder', 'Assigna donant')}
                              presentation="dialog"
                              dialogTitle={tr('dialogs.stripeImputation.donorDialogTitle', 'Selecciona donant o soci')}
                              createActions={[
                                {
                                  key: `donor-${line.localId}`,
                                  label: tr('dialogs.stripeImputation.createDonor', 'Donar d\'alta nou donant'),
                                  onSelect: () => handleOpenQuickCreate(line.localId, 'donor'),
                                },
                                {
                                  key: `member-${line.localId}`,
                                  label: tr('dialogs.stripeImputation.createMember', 'Donar d\'alta nou soci'),
                                  onSelect: () => handleOpenQuickCreate(line.localId, 'member'),
                                },
                              ]}
                              badgesByDonorId={donorBadgesById}
                            />
                          </TableCell>
                          <TableCell className="align-top text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteLine(line.localId)}
                              aria-label={tr('dialogs.stripeImputation.deleteLineAria', 'Eliminar línia')}
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
                  {tr('dialogs.stripeImputation.bankPaymentTitle', 'Abonament bancari')}
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border bg-background p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{tr('dialogs.stripeImputation.totalImputed', 'Total imputat')}</div>
                    <div className="mt-2 text-2xl font-semibold">{summary.totalImputed.toFixed(2)} €</div>
                  </div>
                  <div className="rounded-md border bg-background p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{tr('dialogs.stripeImputation.bank', 'Banc')}</div>
                    <div className="mt-2 text-2xl font-semibold">{bankTransaction.amount.toFixed(2)} €</div>
                  </div>
                  <div className="rounded-md border bg-background p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{tr('dialogs.stripeImputation.difference', 'Diferència')}</div>
                    <div className="mt-2 text-2xl font-semibold">
                      {(summary.totalImputed - bankTransaction.amount >= 0 ? '+' : '')}
                      {(summary.totalImputed - bankTransaction.amount).toFixed(2)} €
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {tr('dialogs.stripeImputation.differenceHint', 'La diferència pot deure\'s a comissions o ajustos de Stripe.')}
                </p>
              </div>

              {summary.hasInvalidLines && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{tr('dialogs.stripeImputation.missingDataTitle', 'Falten dades per completar')}</AlertTitle>
                  <AlertDescription>
                    {pendingAssignmentCount > 0
                      ? tr('dialogs.stripeImputation.pendingAssignmentsGlobal', 'Hi ha línies pendents d\'assignació manual. Cada línia ha de tenir donant i un import brut vàlid abans de confirmar.')
                      : tr('dialogs.stripeImputation.missingDataDescription', 'Cada línia ha de tenir donant i un import brut vàlid abans de confirmar.')}
                  </AlertDescription>
                </Alert>
              )}

              {summary.duplicateStripePaymentIds.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{tr('dialogs.stripeImputation.duplicateTitle', 'Pagaments Stripe duplicats')}</AlertTitle>
                  <AlertDescription>
                    {tr('dialogs.stripeImputation.duplicateDescription', 'No es pot confirmar mentre hi hagi `stripePaymentId` repetits dins la mateixa imputació.')}
                  </AlertDescription>
                </Alert>
              )}

              {requiresDifferenceConfirmation && (
                <>
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{tr('dialogs.stripeImputation.differenceTitle', 'La distribució no quadra exactament amb el banc')}</AlertTitle>
                    <AlertDescription>
                      {tr('dialogs.stripeImputation.differenceDescription', 'La diferència pot deure\'s a comissions o ajustos de Stripe. Si el repartiment és correcte, confirma-ho explícitament.')}
                    </AlertDescription>
                  </Alert>
                  <div className="flex items-center gap-2 rounded-md border bg-background p-3">
                    <Checkbox
                      id="confirm-stripe-imputation-difference"
                      checked={isDifferenceConfirmed}
                      onCheckedChange={(value) => setIsDifferenceConfirmed(value === true)}
                    />
                    <Label htmlFor="confirm-stripe-imputation-difference">
                      {tr('dialogs.stripeImputation.differenceConfirm', 'Confirmo que la distribució és correcta')}
                    </Label>
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="shrink-0 border-t bg-background py-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                {t.common.cancel}
              </Button>
              <Button onClick={handleConfirm} disabled={isSaving || !canConfirm}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {tr('dialogs.stripeImputation.confirmAction', 'Confirmar imputació')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isReplaceDialogOpen} onOpenChange={setIsReplaceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr('dialogs.stripeImputation.replaceCsvTitle', 'Substituir la imputació actual?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingCsvImport?.source === 'stripe'
                ? tr('dialogs.stripeImputation.replaceStripeDescription', 'Ja hi ha línies d\'imputació a la taula. Importar aquest payout substituirà completament les línies actuals.')
                : tr('dialogs.stripeImputation.replaceCsvDescription', 'Ja hi ha línies d\'imputació a la taula. Carregar aquest CSV substituirà completament les línies actuals.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelReplaceCsv}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReplaceCsv}>
              {pendingCsvImport?.source === 'stripe'
                ? tr('dialogs.stripeImputation.replaceStripeAction', 'Substituir per les línies de Stripe')
                : tr('dialogs.stripeImputation.replaceCsvAction', 'Substituir per les línies del CSV')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateQuickDonorDialog
        open={quickCreateState !== null}
        onOpenChange={handleQuickCreateOpenChange}
        onSave={handleCreateQuickDonor}
        initialData={quickCreateState?.initialData}
        title={quickCreateState?.kind === 'member'
          ? tr('dialogs.stripeImputation.createMemberTitle', 'Crear nou soci')
          : tr('dialogs.stripeImputation.createDonorTitle', 'Crear nou donant')}
        description={
          quickCreateState?.kind === 'member'
            ? tr('dialogs.stripeImputation.createMemberDescription', 'Crea el soci des d\'aquí i l\'assignarem directament a la imputació Stripe.')
            : tr('dialogs.stripeImputation.createDonorDescription', 'Crea el donant des d\'aquí i l\'assignarem directament a la imputació Stripe.')
        }
        submitLabel={quickCreateState?.kind === 'member'
          ? tr('dialogs.stripeImputation.createMemberAction', 'Crear soci')
          : tr('dialogs.stripeImputation.createDonorAction', 'Crear donant')}
        submittingLabel={quickCreateState?.kind === 'member'
          ? `${tr('dialogs.stripeImputation.createMemberAction', 'Crear soci')}...`
          : `${tr('dialogs.stripeImputation.createDonorAction', 'Crear donant')}...`}
      />
    </>
  );
}
