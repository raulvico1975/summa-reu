'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type UpdateData,
} from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import type {
  ProjectFundingBudgetAllocation,
  ProjectFundingExpenseAllocation,
  ProjectFundingExpenseAllocationFormLine,
  ProjectFundingSource,
  ProjectFundingSourceFormData,
} from '@/lib/project-module-types';
import { parseEuropeanAmountInput } from '@/lib/project-module-funding';
import { useProjectCommercialAccess } from '@/hooks/use-project-module';

const MAX_FUNDING_BATCH_WRITES = 50;

function projectPath(organizationId: string, projectId: string): string {
  return `organizations/${organizationId}/projectModule/_/projects/${projectId}`;
}

export function useProjectFundingSources(projectId: string) {
  const { firestore } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const [fundingSources, setFundingSources] = useState<ProjectFundingSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!organizationId || !projectId) {
      setFundingSources([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const ref = collection(firestore, projectPath(organizationId, projectId), 'fundingSources');
      const snap = await getDocs(query(ref, orderBy('order', 'asc')));
      const rows = snap.docs.map((item) => ({ id: item.id, ...item.data() } as ProjectFundingSource));
      rows.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
      setFundingSources(rows);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Error carregant fonts de finançament');
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }, [firestore, organizationId, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return { fundingSources, isLoading, error, refresh: load };
}

export function useFundingBudgetAllocations(projectId: string) {
  const { firestore } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const [budgetAllocations, setBudgetAllocations] = useState<ProjectFundingBudgetAllocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!organizationId || !projectId) {
      setBudgetAllocations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const ref = collection(firestore, projectPath(organizationId, projectId), 'fundingBudgetAllocations');
      const snap = await getDocs(ref);
      setBudgetAllocations(snap.docs.map((item) => ({ id: item.id, ...item.data() } as ProjectFundingBudgetAllocation)));
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Error carregant distribució pressupostària');
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }, [firestore, organizationId, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return { budgetAllocations, isLoading, error, refresh: load };
}

export function useFundingExpenseAllocations(projectId: string) {
  const { firestore } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const [expenseAllocations, setExpenseAllocations] = useState<ProjectFundingExpenseAllocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!organizationId || !projectId) {
      setExpenseAllocations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const ref = collection(firestore, projectPath(organizationId, projectId), 'fundingExpenseAllocations');
      const snap = await getDocs(ref);
      setExpenseAllocations(snap.docs.map((item) => ({ id: item.id, ...item.data() } as ProjectFundingExpenseAllocation)));
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Error carregant distribució de despeses');
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }, [firestore, organizationId, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return { expenseAllocations, isLoading, error, refresh: load };
}

export function useSaveProjectFunding() {
  const { firestore, user } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const { canMutateProjects, canMutateBudgets } = useProjectCommercialAccess();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const enableMultiFunder = useCallback(async (projectId: string) => {
    if (!canMutateProjects) throw new Error('ENTITLEMENT_DENIED');
    if (!organizationId || !user) throw new Error('No autenticat');
    setIsSaving(true);
    setError(null);
    try {
      const ref = doc(firestore, projectPath(organizationId, projectId));
      await updateDoc(ref, {
        multiFunderEnabled: true,
        updatedAt: serverTimestamp(),
      } as UpdateData<DocumentData>);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Error activant diversos finançadors');
      setError(e);
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, [canMutateProjects, firestore, organizationId, user]);

  const saveFundingSource = useCallback(async (
    projectId: string,
    data: ProjectFundingSourceFormData,
    sourceId?: string
  ): Promise<string> => {
    if (!canMutateProjects) throw new Error('ENTITLEMENT_DENIED');
    if (!organizationId || !user) throw new Error('No autenticat');
    const name = data.name.trim();
    if (!name) throw new Error('El nom de la font és obligatori');

    const approvedAmountEUR = parseEuropeanAmountInput(data.approvedAmountEUR);
    const receivedAmountEUR = parseEuropeanAmountInput(data.receivedAmountEUR);

    setIsSaving(true);
    setError(null);
    try {
      const sourcesRef = collection(firestore, projectPath(organizationId, projectId), 'fundingSources');
      const ref = sourceId
        ? doc(firestore, projectPath(organizationId, projectId), 'fundingSources', sourceId)
        : doc(sourcesRef);
      let orderPatch: { order?: number } = {};
      if (!sourceId) {
        const existingSnap = await getDocs(sourcesRef);
        const maxOrder = existingSnap.docs.reduce((max, item) => {
          const value = item.data().order;
          return typeof value === 'number' && Number.isFinite(value) ? Math.max(max, value) : max;
        }, -1);
        orderPatch = { order: maxOrder + 1 };
      }
      const payload = {
        name,
        type: data.type,
        approvedAmountEUR,
        receivedAmountEUR,
        notes: data.notes.trim() || null,
        archivedAt: null,
        updatedAt: serverTimestamp(),
        ...orderPatch,
        ...(sourceId ? {} : { createdAt: serverTimestamp() }),
      };
      await setDoc(ref, payload, { merge: true });
      return ref.id;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Error desant font de finançament');
      setError(e);
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, [canMutateProjects, firestore, organizationId, user]);

  const archiveFundingSource = useCallback(async (projectId: string, sourceId: string) => {
    if (!canMutateProjects) throw new Error('ENTITLEMENT_DENIED');
    if (!organizationId || !user) throw new Error('No autenticat');
    setIsSaving(true);
    setError(null);
    try {
      const ref = doc(firestore, projectPath(organizationId, projectId), 'fundingSources', sourceId);
      await updateDoc(ref, {
        archivedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      } as UpdateData<DocumentData>);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Error arxivant font de finançament');
      setError(e);
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, [canMutateProjects, firestore, organizationId, user]);

  const saveFundingBudgetAllocation = useCallback(async (
    projectId: string,
    budgetLineId: string,
    fundingSourceId: string,
    amountValue: string
  ) => {
    if (!canMutateBudgets) throw new Error('ENTITLEMENT_DENIED');
    if (!organizationId || !user) throw new Error('No autenticat');
    const amountEUR = parseEuropeanAmountInput(amountValue, { required: true });
    const allocationId = `${budgetLineId}__${fundingSourceId}`;

    setIsSaving(true);
    setError(null);
    try {
      const ref = doc(firestore, projectPath(organizationId, projectId), 'fundingBudgetAllocations', allocationId);
      await setDoc(ref, {
        budgetLineId,
        fundingSourceId,
        amountEUR,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Error desant distribució pressupostària');
      setError(e);
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, [canMutateBudgets, firestore, organizationId, user]);

  const saveFundingExpenseAllocationsForExpense = useCallback(async (params: {
    projectId: string;
    expenseLinkId: string;
    expenseId: string;
    expenseSource: 'bank' | 'offBank';
    lines: ProjectFundingExpenseAllocationFormLine[];
  }) => {
    if (!canMutateProjects) throw new Error('ENTITLEMENT_DENIED');
    if (!organizationId || !user) throw new Error('No autenticat');
    const normalizedLines = params.lines
      .map((line) => ({
        id: line.id,
        fundingSourceId: line.fundingSourceId,
        amountEUR: parseEuropeanAmountInput(line.amountEUR, { required: true }),
        kind: line.kind,
        budgetLineId: line.budgetLineId.trim() || null,
        notes: line.notes.trim() || null,
      }))
      .filter((line) => line.fundingSourceId && line.amountEUR >= 0);

    setIsSaving(true);
    setError(null);
    try {
      const allocationsRef = collection(
        firestore,
        projectPath(organizationId, params.projectId),
        'fundingExpenseAllocations'
      );
      const existingSnap = await getDocs(query(allocationsRef, where('expenseLinkId', '==', params.expenseLinkId)));
      const operationCount = existingSnap.docs.length + normalizedLines.length;
      if (operationCount > MAX_FUNDING_BATCH_WRITES) {
        throw new Error('Massa línies per guardar en una sola operació');
      }

      const batch = writeBatch(firestore);
      for (const existing of existingSnap.docs) {
        batch.delete(existing.ref);
      }
      for (const line of normalizedLines) {
        const ref = doc(allocationsRef);
        batch.set(ref, {
          expenseLinkId: params.expenseLinkId,
          expenseId: params.expenseId,
          expenseSource: params.expenseSource,
          fundingSourceId: line.fundingSourceId,
          amountEUR: line.amountEUR,
          kind: line.kind,
          budgetLineId: line.budgetLineId,
          notes: line.notes,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Error desant distribució de despesa');
      setError(e);
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, [canMutateProjects, firestore, organizationId, user]);

  return {
    enableMultiFunder,
    saveFundingSource,
    archiveFundingSource,
    saveFundingBudgetAllocation,
    saveFundingExpenseAllocationsForExpense,
    isSaving,
    error,
  };
}
