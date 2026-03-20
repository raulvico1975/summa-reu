'use client';

import * as React from 'react';
import { doc, query, where, getDocs, limit, type CollectionReference } from 'firebase/firestore';
import { updateDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/i18n';
import { formatCurrencyEU } from '@/lib/normalize';
import type { Transaction, Donor, ContactType } from '@/lib/data';
import {
  createManualReturnSplit,
  getSplitValidationError,
  type SplitRow,
} from '@/lib/returns/createReturnSplit';
import {
  acquireProcessLock,
  getLockFailureMessage,
  releaseProcessLock,
} from '@/lib/fiscal/processLocks';

export type ReturnAssignmentMode = 'single' | 'multi';

interface UseReturnManagementParams {
  transactionsCollection: CollectionReference | null;
  contactsCollection: CollectionReference | null;
  organizationId: string | null;
  userId: string | null;
  donors: Donor[];
  contactMap: Record<string, { name: string; type: ContactType }>;
}

interface UseReturnManagementReturn {
  isReturnDialogOpen: boolean;
  handleCloseReturnDialog: () => void;
  returnTransaction: Transaction | null;
  returnDonorId: string | null;
  setReturnDonorId: (id: string | null) => void;
  returnLinkedTxId: string | null;
  setReturnLinkedTxId: (id: string | null) => void;
  donorDonations: Transaction[];
  isLoadingDonations: boolean;
  returnMode: ReturnAssignmentMode;
  setReturnMode: (mode: ReturnAssignmentMode) => void;
  splitRows: SplitRow[];
  addSplitRow: () => void;
  updateSplitRow: (index: number, patch: Partial<SplitRow>) => void;
  removeSplitRow: (index: number) => void;
  splitValidationError: string | null;
  canUseManualSplit: boolean;
  parentReturnTotal: number;
  isSavingReturn: boolean;
  canSaveReturn: boolean;
  handleOpenReturnDialog: (tx: Transaction) => void;
  handleSaveReturn: () => Promise<void>;
}

function getSplitValidationMessage(
  error: ReturnType<typeof getSplitValidationError>,
  total: number
): string | null {
  switch (error) {
    case 'INVALID_TOTAL':
      return "L'import del pare no és vàlid per fer el desglossament.";
    case 'MISSING_ROWS':
      return 'Afegeix almenys un soci.';
    case 'MISSING_CONTACT':
      return 'Selecciona un soci a totes les files.';
    case 'INVALID_AMOUNT':
      return 'Revisa els imports introduïts.';
    case 'NON_POSITIVE_AMOUNT':
      return 'Tots els imports han de ser superiors a 0.';
    case 'TOTAL_MISMATCH':
      return `La suma ha de ser exactament ${formatCurrencyEU(total)}.`;
    default:
      return null;
  }
}

export function useReturnManagement({
  transactionsCollection,
  contactsCollection,
  organizationId,
  userId,
  donors,
  contactMap,
}: UseReturnManagementParams): UseReturnManagementReturn {
  const { toast } = useToast();
  const { t } = useTranslations();

  const [isReturnDialogOpen, setIsReturnDialogOpen] = React.useState(false);
  const [returnTransaction, setReturnTransaction] = React.useState<Transaction | null>(null);
  const [returnDonorIdState, setReturnDonorIdState] = React.useState<string | null>(null);
  const [returnLinkedTxIdState, setReturnLinkedTxIdState] = React.useState<string | null>(null);
  const [donorDonations, setDonorDonations] = React.useState<Transaction[]>([]);
  const [isLoadingDonations, setIsLoadingDonations] = React.useState(false);
  const [returnModeState, setReturnModeState] = React.useState<ReturnAssignmentMode>('single');
  const [splitRows, setSplitRows] = React.useState<SplitRow[]>([]);
  const [isSavingReturn, setIsSavingReturn] = React.useState(false);
  const donorIds = React.useMemo(() => new Set(donors.map((donor) => donor.id)), [donors]);
  const donorNamesById = React.useMemo(
    () => new Map(donors.map((donor) => [donor.id, donor.name])),
    [donors]
  );

  const parentReturnTotal = React.useMemo(
    () => Math.abs(returnTransaction?.amount ?? 0),
    [returnTransaction]
  );

  const canUseManualSplit = React.useMemo(() => {
    if (!returnTransaction) {
      return false;
    }

    return (
      returnTransaction.amount < 0 &&
      !returnTransaction.isRemittanceItem &&
      returnTransaction.transactionType !== 'return_fee' &&
      returnTransaction.source !== 'stripe' &&
      !returnTransaction.contactId &&
      !returnTransaction.linkedTransactionId
    );
  }, [returnTransaction]);

  const setReturnDonorId = React.useCallback((id: string | null) => {
    setReturnDonorIdState(id);
    setReturnLinkedTxIdState(null);

    if (canUseManualSplit && returnModeState === 'single') {
      setSplitRows([{ contactId: id, amount: parentReturnTotal }]);
    }
  }, [canUseManualSplit, parentReturnTotal, returnModeState]);

  const setReturnLinkedTxId = React.useCallback((id: string | null) => {
    setReturnLinkedTxIdState(id);
  }, []);

  const setReturnMode = React.useCallback((mode: ReturnAssignmentMode) => {
    setReturnModeState(mode);

    if (mode === 'multi') {
      setSplitRows((prev) => {
        if (prev.length > 0) {
          return prev;
        }

        return [{ contactId: returnDonorIdState, amount: parentReturnTotal }];
      });
      return;
    }

    if (!returnDonorIdState && splitRows[0]?.contactId && donorIds.has(splitRows[0].contactId)) {
      setReturnDonorIdState(splitRows[0].contactId);
    }
  }, [donorIds, parentReturnTotal, returnDonorIdState, splitRows]);

  const addSplitRow = React.useCallback(() => {
    setSplitRows((prev) => [...prev, { contactId: null, amount: 0 }]);
  }, []);

  const updateSplitRow = React.useCallback((index: number, patch: Partial<SplitRow>) => {
    setSplitRows((prev) => prev.map((row, rowIndex) => {
      if (rowIndex !== index) {
        return row;
      }

      return {
        ...row,
        ...patch,
      };
    }));
  }, []);

  const removeSplitRow = React.useCallback((index: number) => {
    setSplitRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  }, []);

  React.useEffect(() => {
    if (!returnDonorIdState || !transactionsCollection || returnModeState !== 'single') {
      setDonorDonations([]);
      return;
    }

    let isMounted = true;

    const loadDonorDonations = async () => {
      setIsLoadingDonations(true);
      try {
        const donationsQuery = query(
          transactionsCollection,
          where('contactId', '==', returnDonorIdState),
          where('amount', '>', 0),
          limit(100)
        );
        const snapshot = await getDocs(donationsQuery);

        if (!isMounted) {
          return;
        }

        const donations = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Transaction))
          .filter((tx) => tx.donationStatus !== 'returned')
          .sort((a, b) => b.date.localeCompare(a.date));

        setDonorDonations(donations);
      } catch (error) {
        console.error('Error loading donor donations:', error);
      } finally {
        if (isMounted) {
          setIsLoadingDonations(false);
        }
      }
    };

    loadDonorDonations();

    return () => {
      isMounted = false;
    };
  }, [returnDonorIdState, returnModeState, transactionsCollection]);

  const handleOpenReturnDialog = React.useCallback((tx: Transaction) => {
    const preselectedDonorId = tx.contactId && donorIds.has(tx.contactId)
      ? tx.contactId
      : null;

    setReturnTransaction(tx);
    setReturnDonorIdState(preselectedDonorId);
    setReturnLinkedTxIdState(tx.linkedTransactionId || null);
    setDonorDonations([]);
    setReturnModeState('single');
    setSplitRows([{ contactId: preselectedDonorId, amount: Math.abs(tx.amount) }]);
    setIsReturnDialogOpen(true);
  }, [donorIds]);

  const handleCloseReturnDialog = React.useCallback(() => {
    setIsReturnDialogOpen(false);
    setReturnTransaction(null);
    setReturnDonorIdState(null);
    setReturnLinkedTxIdState(null);
    setDonorDonations([]);
    setReturnModeState('single');
    setSplitRows([]);
    setIsSavingReturn(false);
  }, []);

  const splitValidationError = React.useMemo(() => {
    if (!canUseManualSplit || returnModeState !== 'multi') {
      return null;
    }

    return getSplitValidationMessage(
      getSplitValidationError(parentReturnTotal, splitRows),
      parentReturnTotal
    );
  }, [canUseManualSplit, parentReturnTotal, returnModeState, splitRows]);

  const canSaveReturn = React.useMemo(() => {
    if (!returnTransaction || isSavingReturn) {
      return false;
    }

    if (canUseManualSplit && returnModeState === 'multi') {
      return splitValidationError === null;
    }

    return !!returnDonorIdState && donorIds.has(returnDonorIdState);
  }, [
    canUseManualSplit,
    donorIds,
    isSavingReturn,
    returnDonorIdState,
    returnModeState,
    returnTransaction,
    splitValidationError,
  ]);

  const handleSaveReturn = React.useCallback(async () => {
    if (!returnTransaction || !transactionsCollection) {
      return;
    }

    let lockedParentId: string | null = null;
    setIsSavingReturn(true);

    try {
      if (canUseManualSplit && returnModeState === 'multi') {
        if (!organizationId) {
          throw new Error('Missing organizationId for manual return split');
        }

        const validationMessage = getSplitValidationMessage(
          getSplitValidationError(parentReturnTotal, splitRows),
          parentReturnTotal
        );

        if (validationMessage) {
          toast({
            variant: 'destructive',
            title: t.common.error,
            description: validationMessage,
          });
          return;
        }

        if (userId) {
          const lockResult = await acquireProcessLock({
            firestore: transactionsCollection.firestore,
            orgId: organizationId,
            parentTxId: returnTransaction.id,
            operation: 'returnImport',
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

          lockedParentId = returnTransaction.id;
        }

        const plan = await createManualReturnSplit({
          transactionsCollection,
          contactsCollection,
          organizationId,
          parentTransaction: returnTransaction,
          rows: splitRows,
          donorNamesById,
          route: '/transactions/manage-return',
        });

        toast({
          title: t.movements.table.returnAssigned,
          description: plan.children.length === 1
            ? `S'ha creat 1 devolució filla.`
            : `S'han creat ${plan.children.length} devolucions filles correctament.`,
        });

        handleCloseReturnDialog();
        return;
      }

      if (!returnDonorIdState || !donorIds.has(returnDonorIdState)) {
        toast({
          variant: 'destructive',
          title: t.common.error,
          description: t.movements.table.assignDonorTooltip,
        });
        return;
      }

      const returnUpdate: Record<string, unknown> = {
        transactionType: 'return',
        contactId: returnDonorIdState,
        contactType: 'donor',
        linkedTransactionId: returnLinkedTxIdState ?? null,
      };

      updateDocumentNonBlocking(
        doc(transactionsCollection, returnTransaction.id),
        returnUpdate
      );

      if (returnLinkedTxIdState) {
        updateDocumentNonBlocking(
          doc(transactionsCollection, returnLinkedTxIdState),
          {
            donationStatus: 'returned',
            linkedTransactionId: returnTransaction.id,
          }
        );

        if (contactsCollection) {
          const donor = donors.find((item) => item.id === returnDonorIdState);
          if (donor) {
            updateDocumentNonBlocking(
              doc(contactsCollection, returnDonorIdState),
              {
                returnCount: (donor.returnCount || 0) + 1,
                lastReturnDate: new Date().toISOString(),
                status: 'pending_return',
              }
            );
          }
        }
      }

      toast({
        title: t.movements.table.returnAssigned,
        description: t.movements.table.returnAssignedDescription(
          contactMap[returnDonorIdState]?.name || ''
        ),
      });

      handleCloseReturnDialog();
    } catch (error) {
      console.error('Error saving return:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.movements.table.returnSaveError,
      });
    } finally {
      if (lockedParentId && userId && organizationId) {
        try {
          await releaseProcessLock({
            firestore: transactionsCollection.firestore,
            orgId: organizationId,
            parentTxId: lockedParentId,
          });
        } catch (lockError) {
          console.error('Error releasing return lock:', lockError);
        }
      }

      setIsSavingReturn(false);
    }
  }, [
    canUseManualSplit,
    contactMap,
    contactsCollection,
    donorIds,
    donorNamesById,
    donors,
    handleCloseReturnDialog,
    organizationId,
    parentReturnTotal,
    returnDonorIdState,
    returnLinkedTxIdState,
    returnModeState,
    returnTransaction,
    splitRows,
    t,
    toast,
    transactionsCollection,
    userId,
  ]);

  return {
    isReturnDialogOpen,
    handleCloseReturnDialog,
    returnTransaction,
    returnDonorId: returnDonorIdState,
    setReturnDonorId,
    returnLinkedTxId: returnLinkedTxIdState,
    setReturnLinkedTxId,
    donorDonations,
    isLoadingDonations,
    returnMode: returnModeState,
    setReturnMode,
    splitRows,
    addSplitRow,
    updateSplitRow,
    removeSplitRow,
    splitValidationError,
    canUseManualSplit,
    parentReturnTotal,
    isSavingReturn,
    canSaveReturn,
    handleOpenReturnDialog,
    handleSaveReturn,
  };
}
