'use client';

import * as React from 'react';
import {
  parseStripeCsv,
  groupStripeRowsByTransfer,
  findAllMatchingPayoutGroups,
  type StripeRow,
  type Warning,
  type StripePayoutGroup,
} from './useStripeImporter';
import { formatCurrencyEU } from '@/lib/normalize';
import { useFirebase } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { collection, doc, query, where, getDocs, getDoc } from 'firebase/firestore';
import type { Transaction } from '@/lib/data';
import type { Donation } from '@/lib/types/donations';
import { useToast } from '@/hooks/use-toast';
import { acquireProcessLock, releaseProcessLock, getLockFailureMessage } from '@/lib/fiscal/processLocks';
import { createStripeDonations, ERR_STRIPE_DUPLICATE_PAYMENT, ERR_STRIPE_CONTACT_REQUIRED } from '@/lib/stripe/createStripeDonations';
import { persistStripeImputationWrites } from '@/lib/stripe/commitStripeImputationWrites';

// UI Components
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, AlertTriangle, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { type Contact } from './DonorSelectorEnhanced';
import { CreateQuickDonorDialog, type QuickDonorFormData } from './CreateQuickDonorDialog';
import { useTranslations } from '@/i18n';
import { addDocumentNonBlocking } from '@/firebase';
import { findExistingContact, addRole, needsRoleUpdate } from '@/lib/contact-matching';
import { updateContactViaApi } from '@/services/contacts';

// ════════════════════════════════════════════════════════════════════════════
// TIPUS
// ════════════════════════════════════════════════════════════════════════════

interface BankTransaction {
  id: string;
  amount: number;
  date?: string;
  description?: string;
  bankAccountId?: string | null;
}

interface DonorLookupResult {
  id: string;
  name: string;
  defaultCategoryId?: string | null;
}

interface StripeImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankTransaction: BankTransaction;
  lookupDonorByEmail: (email: string) => Promise<DonorLookupResult | null>;
  donors: Contact[];
  onImportDone?: () => void;
}

type DonorMatch = {
  contactId: string;
  contactName: string;
  defaultCategoryId?: string | null;
  roleUpdateData?: {
    roles: Record<string, boolean>;
  };
} | null;

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════════════════════

export function StripeImporter({
  open,
  onOpenChange,
  bankTransaction,
  lookupDonorByEmail,
  donors,
  onImportDone,
}: StripeImporterProps) {
  // Hooks de Firebase i organització
  const { firestore, user, auth } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const userId = user?.uid;
  const { toast } = useToast();
  const { t } = useTranslations();

  // Estats
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [parsedRows, setParsedRows] = React.useState<StripeRow[]>([]);
  const [warnings, setWarnings] = React.useState<Warning[]>([]);
  const [ignoredRowsCount, setIgnoredRowsCount] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [matchingGroups, setMatchingGroups] = React.useState<StripePayoutGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = React.useState<StripePayoutGroup | null>(null);

  // Estat de matching de donants
  const [donorMatches, setDonorMatches] = React.useState<Record<string, DonorMatch>>({});
  const [isMatchingDonors, setIsMatchingDonors] = React.useState(false);

  // Estat per modal de confirmació (REMOVED - using direct call instead)

  // Estat per diàleg de creació de donant
  const [isCreateDonorOpen, setIsCreateDonorOpen] = React.useState(false);
  const [createDonorInitialData, setCreateDonorInitialData] = React.useState<{
    email?: string;
    rowId?: string;
  } | null>(null);

  // Estat per confirmació inline (dins del mateix Dialog)
  const [pendingConfirmation, setPendingConfirmation] = React.useState<{
    donationsCount: number;
    netAmount: number;
    feesAmount: number;
    payoutId: string;
  } | null>(null);

  // Reset quan es tanca el modal
  React.useEffect(() => {
    if (!open) {
      setParsedRows([]);
      setWarnings([]);
      setIgnoredRowsCount(0);
      setErrorMessage(null);
      setMatchingGroups([]);
      setSelectedGroup(null);
      setDonorMatches({});
      setIsMatchingDonors(false);
      setIsSaving(false);
      setIsCreateDonorOpen(false);
      setCreateDonorInitialData(null);
      setPendingConfirmation(null);
    }
  }, [open]);

  // Matching automàtic de donants quan canvia selectedGroup
  React.useEffect(() => {
    if (!selectedGroup) {
      setDonorMatches({});
      return;
    }

    let cancelled = false;

    // Reinicialitzar el mapping per al nou grup (tots a null)
    // Això evita matches "fantasma" d'un grup anterior
    setDonorMatches(() => {
      const init: Record<string, DonorMatch> = {};
      selectedGroup.rows.forEach(r => { init[r.id] = null; });
      return init;
    });

    const matchDonors = async () => {
      setIsMatchingDonors(true);
      try {
        const autoMatches: Record<string, DonorMatch> = {};

        for (const row of selectedGroup.rows) {
          // Check cancel·lació abans de cada lookup
          if (cancelled) return;

          if (!row.customerEmail || row.customerEmail.trim() === '') {
            autoMatches[row.id] = null;
            continue;
          }

          try {
            const donor = await lookupDonorByEmail(row.customerEmail.toLowerCase());
            if (cancelled) return;

            if (donor) {
              autoMatches[row.id] = {
                contactId: donor.id,
                contactName: donor.name,
                defaultCategoryId: donor.defaultCategoryId,
              };
            } else {
              autoMatches[row.id] = null;
            }
          } catch {
            if (cancelled) return;
            autoMatches[row.id] = null;
          }
        }

        if (cancelled) return;

        // Merge: automàtic només omple buits, manual guanya
        setDonorMatches(prev => {
          const next = { ...prev };
          for (const [stripeId, match] of Object.entries(autoMatches)) {
            // Només set si no existeix o és null (no trepitjar manuals)
            if (next[stripeId] == null) {
              next[stripeId] = match;
            }
          }
          return next;
        });
      } finally {
        if (!cancelled) {
          setIsMatchingDonors(false);
        }
      }
    };

    matchDonors();

    return () => {
      cancelled = true;
    };
  }, [selectedGroup, lookupDonorByEmail]);

  // Handler per llegir el fitxer CSV
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setErrorMessage(null);
    setParsedRows([]);
    setWarnings([]);
    setIgnoredRowsCount(0);
    setMatchingGroups([]);
    setSelectedGroup(null);
    setDonorMatches({});

    try {
      const text = await file.text();
      const result = parseStripeCsv(text);
      const rowsWithTransfer = result.rows.filter(
        (row) => row.transfer && row.transfer.trim().length > 0
      );
      const ignoredRows = result.rows.length - rowsWithTransfer.length;

      setParsedRows(rowsWithTransfer);
      setWarnings(result.warnings);
      setIgnoredRowsCount(ignoredRows);

      // Validar que hi ha files vàlides
      if (result.rows.length === 0) {
        setErrorMessage(t.importers.stripeImporter.errors.noValidRows);
        return;
      }

      // Validar que queda almenys un payout real
      if (rowsWithTransfer.length === 0) {
        setErrorMessage(t.importers.stripeImporter.errors.noPayoutRows);
        return;
      }

      // Agrupar per Transfer i buscar matches
      const groups = groupStripeRowsByTransfer(rowsWithTransfer);
      const matches = findAllMatchingPayoutGroups(groups, bankTransaction.amount);
      setMatchingGroups(matches);

      // Si hi ha un únic match, seleccionar-lo automàticament
      if (matches.length === 1) {
        setSelectedGroup(matches[0]);
      } else if (matches.length === 0) {
        // Cap match: mostrar error
        setErrorMessage(
          t.importers.stripeImporter.errors.noMatch(formatCurrencyEU(bankTransaction.amount))
        );
      }
      // Si matches.length > 1, l'usuari haurà de seleccionar manualment (UI ja ho gestiona)
    } catch (err) {
      const message = err instanceof Error ? err.message : t.importers.stripeImporter.errors.processingFile;
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // PAS 5: ESCRIPTURA FIRESTORE
  // ══════════════════════════════════════════════════════════════════════════

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 1: Preparar confirmació (NO escriu a Firestore)
  // ════════════════════════════════════════════════════════════════════════════
  const handlePrepareImport = () => {
    if (!selectedGroup) {
      return;
    }

    // Capturar l'estat EXACTE que s'importarà
    setPendingConfirmation({
      donationsCount: displayRows.length,
      netAmount: totalNet,
      feesAmount: selectedGroup.fees,
      payoutId: selectedGroup.transferId,
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 2: Executar import (escriu a Firestore)
  // ════════════════════════════════════════════════════════════════════════════
  const handleConfirmImport = async () => {
    if (!selectedGroup || !organizationId || !firestore || !pendingConfirmation) {
      return;
    }

    // PAS 7: Adquirir lock per parentTxId (multiusuari)
    const parentTxId = bankTransaction.id;
    let lockAcquired = false;

    if (userId) {
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
          title: 'Operació bloquejada',
          description: getLockFailureMessage(lockResult),
        });
        return;
      }
      lockAcquired = true;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      // 1. Validar límits
      const stripeIds = selectedGroup.rows.map(r => r.id);

      // 1a. Massa files per un sol batch (reservem marge)
      if (stripeIds.length + 2 > 450) {
        throw new Error(t.importers.stripeImporter.errors.tooManyRows(stripeIds.length));
      }

      // 1b. Cap fila vàlida
      if (stripeIds.length === 0) {
        throw new Error(t.importers.stripeImporter.errors.noValidRows);
      }

      // 2. Validar idempotència: comprovar si ja existeixen registres legacy o donations
      const transactionsRef = collection(firestore, 'organizations', organizationId, 'transactions');
      const donationsRef = collection(firestore, 'organizations', organizationId, 'donations');

      // Firestore 'in' té límit de 30, fer en batches si cal
      const existingIds: string[] = [];
      const batchSize = 30;
      for (let i = 0; i < stripeIds.length; i += batchSize) {
        const batch = stripeIds.slice(i, i + batchSize);
        const [legacySnapshot, donationsSnapshot] = await Promise.all([
          getDocs(query(transactionsRef, where('stripePaymentId', 'in', batch))),
          getDocs(query(donationsRef, where('stripePaymentId', 'in', batch))),
        ]);

        legacySnapshot.forEach(doc => {
          const data = doc.data() as Transaction;
          if (data.stripePaymentId) existingIds.push(data.stripePaymentId);
        });
        donationsSnapshot.forEach(doc => {
          const data = doc.data() as Donation;
          if (data.stripePaymentId && !data.archivedAt) existingIds.push(data.stripePaymentId);
        });
      }

      if (existingIds.length > 0) {
        const idsPreview = existingIds.slice(0, 3).join(', ') + (existingIds.length > 3 ? '...' : '');
        throw new Error(
          t.importers.stripeImporter.errors.alreadyImported(existingIds.length, idsPreview)
        );
      }

      const parentTxRef = doc(transactionsRef, bankTransaction.id);
      const importStartedAt = new Date().toISOString();
      const payments = selectedGroup.rows.map((row) => {
        const match = donorMatches[row.id];
        const baseDesc = row.description || `Donació - ${row.customerEmail}`;
        const descUpper = baseDesc.toUpperCase();
        const finalDesc = descUpper.includes('STRIPE') ? baseDesc : `${baseDesc} (via Stripe)`;

        return {
          stripePaymentId: row.id,
          amount: row.amount,
          fee: row.fee,
          contactId: match?.contactId ?? null,
          date: row.createdDate,
          customerEmail: row.customerEmail,
          description: finalDesc,
          imputationOrigin: 'csv' as const,
        };
      });

      const { donations, adjustment } = await createStripeDonations({
        parentTransactionId: bankTransaction.id,
        payments,
        bankAmount: bankTransaction.amount,
        adjustmentDate: bankTransaction.date || new Date().toISOString().split('T')[0],
        findDonationByStripePaymentId: async (stripePaymentId: string) => {
          const snapshot = await getDocs(query(donationsRef, where('stripePaymentId', '==', stripePaymentId)));
          const firstDoc = snapshot.docs[0];
          if (!firstDoc) return null;
          return { id: firstDoc.id, ...(firstDoc.data() as Donation) };
        },
      });

      await persistStripeImputationWrites({
        firestore,
        organizationId,
        parentTransactionId: bankTransaction.id,
        donations: donations.map((donation) => ({
          ...donation,
          stripeTransferId: selectedGroup.transferId,
        })),
        adjustment: adjustment ? { ...adjustment, stripeTransferId: selectedGroup.transferId } : null,
        stripeTransferId: selectedGroup.transferId,
      });

      const verificationSnapshot = await getDocs(
        query(donationsRef, where('parentTransactionId', '==', bankTransaction.id))
      );
      const activeDonations = verificationSnapshot.docs.filter((docSnap) => {
        const donation = docSnap.data() as Donation;
        return !donation.archivedAt;
      });

      const errors: string[] = [];
      const expectedCount = donations.length + (adjustment ? 1 : 0);
      if (activeDonations.length !== expectedCount) {
        errors.push(`Expected ${expectedCount} donation docs, got ${activeDonations.length}`);
      }
      if (activeDonations.filter((docSnap) => (docSnap.data() as Donation).type === 'donation').length !== donations.length) {
        errors.push(`Expected ${donations.length} donation docs`);
      }

      const parentSnap = await getDoc(parentTxRef);
      if (!parentSnap.exists()) {
        errors.push('Parent bank transaction missing after Stripe split');
      } else {
        const parentData = parentSnap.data() as Transaction;
        if (parentData.stripeTransferId !== selectedGroup.transferId) {
          errors.push('Parent bank transaction missing stripeTransferId marker');
        }
      }

      if (errors.length > 0) {
        throw new Error(`Validació post-commit fallida: ${errors.join('; ')}`);
      }

      const pendingRoleUpdates = Array.from(
        new Map(
          Object.values(donorMatches)
            .filter((match): match is Exclude<DonorMatch, null> => !!match?.roleUpdateData)
            .map((match) => [match.contactId, match.roleUpdateData!])
        ).entries()
      );

      if (pendingRoleUpdates.length > 0) {
        const roleUpdateResults = await Promise.allSettled(
          pendingRoleUpdates.map(([docId, roleUpdateData]) =>
            updateContactViaApi({
              orgId: organizationId,
              docId,
              data: roleUpdateData,
              auth,
            })
          )
        );

        const failedRoleUpdates = roleUpdateResults.filter(
          (result) => result.status === 'rejected'
        );

        if (failedRoleUpdates.length > 0) {
          console.error('[stripe-importer] Deferred contact role updates failed:', failedRoleUpdates);
          toast({
            variant: 'destructive',
            title: t.common.error,
            description: `Import Stripe completat, però ${failedRoleUpdates.length} actualització(ns) de contacte no s'han pogut aplicar.`,
          });
        }
      }

      // Toast d'èxit actualitzat
      toast({
        title: t.importers.stripeImporter.success.title,
        description: `${selectedGroup.rows.length} donacions Stripe imputades i alineades fiscalment. ${t.importers.stripeImporter.success.reviewHint}`,
      });

      // Wait for Firestore listeners to sync before closing modal
      await new Promise(resolve => setTimeout(resolve, 500));

      // Tancar confirmació i modal
      setPendingConfirmation(null);
      onOpenChange(false);

      if (onImportDone) {
        onImportDone();
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : t.importers.stripeImporter.errors.processingFile;
      const normalizedMessage =
        message === ERR_STRIPE_DUPLICATE_PAYMENT
          ? 'Aquest pagament Stripe ja existeix a legacy o a donations.'
          : message === ERR_STRIPE_CONTACT_REQUIRED
            ? 'Totes les donacions Stripe han de tenir donant assignat.'
            : message;
      setErrorMessage(normalizedMessage);
      // En cas d'error, també tanquem la confirmació per permetre reintent
      setPendingConfirmation(null);
    } finally {
      setIsSaving(false);

      // PAS 7: Alliberar lock sempre (encara que hi hagi error)
      if (lockAcquired && userId && organizationId) {
        await releaseProcessLock({
          firestore,
          orgId: organizationId,
          parentTxId,
        });
      }
    }
  };

  /**
   * Auto-match all rows with the same email to the given donor
   * Si email és null, només assigna el contactId a la fila rowId
   */
  const applyDonorMatchForEmail = React.useCallback(
    (
      rowId: string,
      contactId: string,
      contactName: string,
      email: string | null,
      options?: {
        defaultCategoryId?: string | null;
        roleUpdateData?: {
          roles: Record<string, boolean>;
        };
      }
    ) => {
      if (!selectedGroup) return;

      setDonorMatches((prev) => {
        const updated = { ...prev };

        // Sempre assigna la fila especificada
        updated[rowId] = {
          contactId,
          contactName,
          defaultCategoryId: options?.defaultCategoryId ?? null,
          roleUpdateData: options?.roleUpdateData,
        };

        // Si hi ha email, auto-matcheja totes les altres files amb el mateix email
        if (email) {
          const emailLower = email.toLowerCase().trim();

          for (const row of selectedGroup.rows) {
            // Skip la fila ja assignada
            if (row.id === rowId) continue;

            // Skip files que ja tenen un match manual diferent (no override)
            if (prev[row.id] && prev[row.id]?.contactId !== contactId) {
              continue;
            }

            // Auto-match si el email coincideix
            if (row.customerEmail?.toLowerCase().trim() === emailLower) {
              updated[row.id] = {
                contactId,
                contactName,
                defaultCategoryId: options?.defaultCategoryId ?? null,
                roleUpdateData: options?.roleUpdateData,
              };
            }
          }
        }

        return updated;
      });
    },
    [selectedGroup]
  );

  // Handler per assignació manual de donant
  const handleManualAssign = (rowId: string, contactId: string | null) => {
    if (!contactId) {
      // Desvincular
      setDonorMatches(prev => ({
        ...prev,
        [rowId]: null,
      }));
      return;
    }

    const donor = donors.find(d => d.id === contactId);
    if (!donor) return;

    // Trobar el row per obtenir el email
    const row = selectedGroup?.rows.find(r => r.id === rowId);
    const email = row?.customerEmail || null;

    // Aplicar auto-match per email
    applyDonorMatchForEmail(rowId, donor.id, donor.name, email);
  };

  // Handler per obrir el diàleg de creació de donant
  const handleOpenCreateDonor = (rowId: string, email?: string) => {
    setCreateDonorInitialData({ rowId, email });
    setIsCreateDonorOpen(true);
  };

  // Handler per crear un nou donant ràpid
  // REGLA: Comprova si ja existeix un contacte amb el mateix NIF/email abans de crear
  const handleCreateQuickDonor = React.useCallback(
    async (formData: QuickDonorFormData): Promise<string | null> => {
      if (!organizationId || !firestore) return null;

      const contactsCollection = collection(firestore, 'organizations', organizationId, 'contacts');

      // Comprovar si ja existeix un contacte amb el mateix NIF o email
      const existingMatch = findExistingContact(
        donors as any[],
        formData.taxId.trim() || undefined,
        undefined, // No tenim IBAN en creació ràpida
        formData.email.trim() || undefined
      );

      if (existingMatch.found && existingMatch.contact) {
        // Ja existeix un contacte - usar-lo i diferir l'upgrade de rol fins que l'import acabi bé
        const existing = existingMatch.contact;
        const roleUpdateData = needsRoleUpdate(existing, 'donor')
          ? { roles: addRole(existing, 'donor') }
          : null;
        const donorMatchOptions = roleUpdateData ? { roleUpdateData } : {};

        if (roleUpdateData) {
          toast({
            title: t.importers.stripeImporter.createQuickDonor.success.title,
            description: `${existing.name} ja existia com a ${existing.type}. S'aplicarà el rol de donant en completar la importació.`,
          });
        } else {
          toast({
            title: t.importers.stripeImporter.createQuickDonor.success.title,
            description: `${existing.name} ja existeix com a donant.`,
          });
        }

        // Aplicar el match a la fila
        if (createDonorInitialData?.rowId) {
          applyDonorMatchForEmail(
            createDonorInitialData.rowId,
            existing.id,
            existing.name,
            (existing as any).email || null,
            donorMatchOptions
          );
        }

        return existing.id;
      }

      // No existeix - crear nou contacte
      const now = new Date().toISOString();
      const newDonorData = {
        type: 'donor',
        roles: { donor: true },  // Inicialitzar amb rol explícit
        name: formData.name.trim(),
        taxId: formData.taxId.trim() || null,
        zipCode: formData.zipCode.trim() || null,
        email: formData.email.trim() || null,
        donorType: 'individual',
        membershipType: 'one-time',
        createdAt: now,
      };

      try {
        const docRef = await addDocumentNonBlocking(contactsCollection, newDonorData);

        if (docRef && createDonorInitialData?.rowId) {
          // Auto-assign the newly created donor to the row + auto-match by email
          const email = formData.email.trim() || null;
          applyDonorMatchForEmail(
            createDonorInitialData.rowId,
            docRef.id,
            formData.name.trim(),
            email
          );

          // Show success toast
          toast({
            title: t.importers.stripeImporter.createQuickDonor.success.title,
            description: t.importers.stripeImporter.createQuickDonor.success.description(
              formData.name.trim()
            ),
          });

          // Show warning if taxId or zipCode is missing
          if (!formData.taxId.trim() || !formData.zipCode.trim()) {
            setTimeout(() => {
              toast({
                title: t.importers.stripeImporter.createQuickDonor.warnings.incompleteData,
                description:
                  t.importers.stripeImporter.createQuickDonor.warnings.incompleteFiscalData,
                duration: 5000,
              });
            }, 500);
          }

          return docRef.id;
        }

        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconegut';
        toast({
          variant: 'destructive',
          title: t.common.error,
          description: message,
        });
        return null;
      }
    },
    [organizationId, firestore, createDonorInitialData, toast, t, applyDonorMatchForEmail]
  );

  // Trobar warning de refunded
  const refundedWarning = warnings.find(w => w.code === 'WARN_REFUNDED');

  // Calcular totals del grup seleccionat (o de totes les files si no n'hi ha)
  const displayRows = selectedGroup ? selectedGroup.rows : parsedRows;
  const totalGross = selectedGroup ? selectedGroup.gross : parsedRows.reduce((sum, row) => sum + row.amount, 0);
  const totalFees = selectedGroup ? selectedGroup.fees : parsedRows.reduce((sum, row) => sum + row.fee, 0);
  const totalNet = selectedGroup ? selectedGroup.net : totalGross - totalFees;

  // Comprovar si l'import quadra amb el banc
  const amountMatches = Math.abs(totalNet - bankTransaction.amount) <= 0.02;

  // Calcular estadístiques de matching
  const matchedCount = displayRows.filter(row => donorMatches[row.id] !== null && donorMatches[row.id] !== undefined).length;
  const pendingCount = displayRows.length - matchedCount;
  const allMatched = pendingCount === 0 && !isMatchingDonors;

  // Botó Continuar només s'habilita si quadra i totes les files tenen match
  const canContinue = amountMatches && allMatched && selectedGroup !== null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[min(96vw,84rem)] overflow-y-auto sm:w-[min(calc(100vw-3rem),84rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t.importers.stripeImporter.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Importa i concilia pagaments procedents de Stripe.
          </DialogDescription>
        </DialogHeader>

        {/* Info del moviment bancari */}
        <div className="rounded-lg bg-muted p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t.importers.stripeImporter.bankInfo.amount}</span>
            <span className="text-lg font-semibold">{formatCurrencyEU(bankTransaction.amount)}</span>
          </div>
          {bankTransaction.date && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t.importers.stripeImporter.bankInfo.date}</span>
              <span>{bankTransaction.date}</span>
            </div>
          )}
          {bankTransaction.description && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t.importers.stripeImporter.bankInfo.description}</span>
              <span className="truncate max-w-[300px]">{bankTransaction.description}</span>
            </div>
          )}
        </div>

        {/* Upload CSV */}
        <div className="space-y-2">
          <Label htmlFor="stripe-csv">{t.importers.stripeImporter.csvUpload.label}</Label>
          <div className="flex items-center gap-2">
            <Input
              id="stripe-csv"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isLoading}
              className="cursor-pointer"
            />
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
          <p className="text-xs text-muted-foreground">
            {t.importers.stripeImporter.csvUpload.helpText}
          </p>
        </div>

        {/* Error */}
        {errorMessage && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t.importers.stripeImporter.errors.processingFile}</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Selector de grup (si múltiples matches) */}
        {matchingGroups.length > 1 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t.importers.stripeImporter.multiplePayouts.title}</AlertTitle>
            <AlertDescription>
              <p className="mb-2">
                {t.importers.stripeImporter.multiplePayouts.description(matchingGroups.length)}
              </p>
              <div className="space-y-2">
                {matchingGroups.map((group) => (
                  <button
                    key={group.transferId}
                    onClick={() => setSelectedGroup(group)}
                    className={`w-full text-left p-2 rounded border transition-colors ${
                      selectedGroup?.transferId === group.transferId
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm">{group.transferId}</span>
                      <span className="font-semibold">{formatCurrencyEU(group.net)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {group.rows.length} {t.importers.stripeImporter.multiplePayouts.donationsLabel} · {t.importers.stripeImporter.multiplePayouts.grossLabel} {formatCurrencyEU(group.gross)}
                    </div>
                  </button>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {ignoredRowsCount > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t.importers.stripeImporter.warnings.ignoredNoTransferTitle}</AlertTitle>
            <AlertDescription>
              {t.importers.stripeImporter.warnings.ignoredNoTransferDescription(ignoredRowsCount)}
            </AlertDescription>
          </Alert>
        )}

        {/* Resultat del parsing */}
        {selectedGroup && (
          <div className="space-y-4">
            {/* Resum */}
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t.importers.stripeImporter.summary.donations}</span>
                <span className="text-lg font-semibold">{displayRows.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t.importers.stripeImporter.summary.payout}</span>
                <span className="font-mono text-xs">{selectedGroup.transferId}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t.importers.stripeImporter.summary.grossTotal}</span>
                <span>{formatCurrencyEU(totalGross)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t.importers.stripeImporter.summary.fees}</span>
                <span className="text-red-600">-{formatCurrencyEU(totalFees)}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="font-medium">{t.importers.stripeImporter.summary.net}</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">{formatCurrencyEU(totalNet)}</span>
                  {amountMatches ? (
                    <span className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle2 className="h-4 w-4" />
                      {t.importers.stripeImporter.summary.matches}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-600 text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      {t.importers.stripeImporter.summary.doesNotMatch}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Warning de reemborsaments */}
            {refundedWarning && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t.importers.stripeImporter.warnings.refundedExcluded}</AlertTitle>
                <AlertDescription>
                  {t.importers.stripeImporter.warnings.refundedDescription(
                    refundedWarning.count,
                    formatCurrencyEU(refundedWarning.amount)
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Indicadors de matching */}
            <div className="flex items-center gap-4 text-sm">
              {isMatchingDonors ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.importers.stripeImporter.matching.searching}
                </span>
              ) : (
                <>
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {t.importers.stripeImporter.matching.matched(matchedCount, displayRows.length)}
                  </span>
                  {pendingCount > 0 && (
                    <span className="flex items-center gap-1 text-orange-600">
                      <AlertTriangle className="h-4 w-4" />
                      {t.importers.stripeImporter.matching.pending(pendingCount)}
                    </span>
                  )}
                  {allMatched && (
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      {t.importers.stripeImporter.matching.allReady}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Taula de donacions */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.importers.stripeImporter.table.email}</TableHead>
                    <TableHead>{t.importers.stripeImporter.table.donor}</TableHead>
                    <TableHead>{t.importers.stripeImporter.table.status}</TableHead>
                    <TableHead className="text-right">{t.importers.stripeImporter.table.gross}</TableHead>
                    <TableHead>{t.importers.stripeImporter.table.date}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRows.map((row, idx) => {
                    const match = donorMatches[row.id];
                    const hasMatch = match !== null && match !== undefined;

                    return (
                      <TableRow key={row.id || idx}>
                        <TableCell className="font-mono text-xs">
                          {row.customerEmail || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <select
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              value={hasMatch ? match.contactId : ''}
                              onChange={(e) => handleManualAssign(row.id, e.target.value || null)}
                              disabled={isMatchingDonors}
                            >
                              <option value="">{t.importers.stripeImporter.donorSelector.placeholder}</option>
                              {[...donors]
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((donor) => (
                                  <option key={donor.id} value={donor.id}>
                                    {donor.email ? `${donor.name} — ${donor.email}` : donor.name}
                                  </option>
                                ))}
                            </select>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenCreateDonor(row.id, row.customerEmail)}
                              disabled={isMatchingDonors}
                              className="shrink-0"
                            >
                              {t.importers.stripeImporter.donorSelector.createNewButton}
                            </Button>
                          </div>
                          {!hasMatch && !isMatchingDonors && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {t.importers.stripeImporter.donorSelector.noMatchForEmail}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {isMatchingDonors ? (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          ) : hasMatch ? (
                            <span className="flex items-center gap-1 text-green-600 text-xs">
                              <CheckCircle2 className="h-3 w-3" />
                              {t.importers.stripeImporter.table.matchStatus}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-orange-600 text-xs">
                              <AlertTriangle className="h-3 w-3" />
                              {t.importers.stripeImporter.table.pendingStatus}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrencyEU(row.amount)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {row.createdDate}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Estat inicial (sense fitxer carregat) */}
        {!errorMessage && parsedRows.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {t.importers.stripeImporter.emptyState}
            </p>
          </div>
        )}

        {/* Confirmació inline (dins del mateix Dialog) */}
        {pendingConfirmation && (
          <div className="border-t pt-4 space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">
                {t.importers.stripeImporter.confirmation.title}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t.importers.stripeImporter.confirmation.description(pendingConfirmation.donationsCount)}
              </p>
            </div>

            <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
              <p className="font-medium">{t.importers.stripeImporter.confirmation.summaryLabel}</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>{t.importers.stripeImporter.summary.donations}</span>
                  <span className="font-mono">{pendingConfirmation.donationsCount}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t.importers.stripeImporter.confirmation.netAmount('')}</span>
                  <span className="font-mono">{formatCurrencyEU(pendingConfirmation.netAmount)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t.importers.stripeImporter.confirmation.feesAmount('')}</span>
                  <span className="font-mono text-red-600">-{formatCurrencyEU(pendingConfirmation.feesAmount)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t">
                  <span>{t.importers.stripeImporter.summary.payout}</span>
                  <span className="font-mono">{pendingConfirmation.payoutId}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {pendingConfirmation ? (
            // Botons de confirmació
            <>
              <Button
                variant="outline"
                onClick={() => setPendingConfirmation(null)}
                disabled={isSaving}
              >
                {t.importers.stripeImporter.confirmation.cancel}
              </Button>
              <Button onClick={handleConfirmImport} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t.importers.stripeImporter.actions.importing}
                  </>
                ) : (
                  t.importers.stripeImporter.confirmation.confirm
                )}
              </Button>
            </>
          ) : (
            // Botons normals
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                {t.importers.stripeImporter.actions.close}
              </Button>
              <Button
                disabled={!canContinue || isSaving}
                onClick={handlePrepareImport}
                title={
                  !selectedGroup
                    ? t.importers.stripeImporter.actions.selectPayout
                    : !amountMatches
                      ? t.importers.stripeImporter.actions.amountMismatch
                      : !allMatched
                        ? t.importers.stripeImporter.actions.pendingAssignments(pendingCount)
                        : t.importers.stripeImporter.actions.import
                }
              >
                {t.importers.stripeImporter.actions.import}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Create Quick Donor Dialog */}
    <CreateQuickDonorDialog
      open={isCreateDonorOpen}
      onOpenChange={setIsCreateDonorOpen}
      onSave={handleCreateQuickDonor}
      initialData={{
        email: createDonorInitialData?.email,
      }}
    />
    </>
  );
}
