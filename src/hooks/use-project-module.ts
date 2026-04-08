// src/hooks/use-project-module.ts
// Hooks per al mòdul de Projectes (B1)

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { computeFxAmountEUR } from '@/lib/project-module/fx';
import { validateAssignments } from '@/lib/project-module/normalize-assignments';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  documentId,
  QueryDocumentSnapshot,
  DocumentData,
  QueryConstraint,
  UpdateData,
  writeBatch,
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { useFirebase } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { canReadBankInProjectes, canUseProjectModule, resolveEffectivePermissions } from '@/lib/permissions';
import type {
  ProjectExpenseExport,
  Project,
  ExpenseLink,
  ExpenseWithLink,
  ExpenseStatus,
  ProjectFormData,
  ExpenseAssignment,
  ExpenseJustification,
  OffBankExpense,
  OffBankExpenseFormData,
  UnifiedExpense,
  UnifiedExpenseWithLink,
  BudgetLine,
  BudgetLineFormData,
  FxTransfer,
  FxTransferFormData,
  OffBankAttachment,
} from '@/lib/project-module-types';
import { safeSet, safeUpdate } from '@/lib/safe-write';

const PAGE_SIZE = 50;

/**
 * Helper per dividir un array en chunks de mida `size`.
 * Usat per les queries batxejades amb `documentId()`.
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Resol la URL del document d'una despesa bancària.
 * Prioritat: fileUrl → storagePath (convertit a URL pública)
 */
function resolveDocumentUrl(
  documents: ProjectExpenseExport['documents'] | undefined
): string | null {
  if (!documents || documents.length === 0) return null;

  const firstDoc = documents[0];

  // 1. Si tenim fileUrl, usar-la directament
  if (firstDoc.fileUrl) {
    return firstDoc.fileUrl;
  }

  // 2. Si tenim storagePath però no fileUrl, intentar construir URL pública
  // Format storagePath: "organizations/{orgId}/documents/{docId}"
  // Format URL: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media
  if (firstDoc.storagePath) {
    // El bucket hauria de ser summa-social.appspot.com (o similar)
    // Com que no tenim accés directe al bucket aquí, retornem null i deixem
    // que l'usuari regeneri el document. En futures versions es pot millorar.
    // Per ara, loguem un warning per debug.
    console.warn(`[resolveDocumentUrl] storagePath exists but no fileUrl: ${firstDoc.storagePath}`);
    return null;
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK: Llistat de despeses exportades (feed read-only)
// ═══════════════════════════════════════════════════════════════════════════

interface UseExpenseFeedResult {
  expenses: ExpenseWithLink[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useExpenseFeed(): UseExpenseFeedResult {
  const { firestore } = useFirebase();
  const { organizationId } = useCurrentOrganization();

  const [expenses, setExpenses] = useState<ExpenseWithLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const loadExpenses = useCallback(async (isLoadMore = false) => {
    if (!organizationId) return;

    try {
      if (!isLoadMore) {
        setIsLoading(true);
      }

      // Query al feed d'exports
      const feedRef = collection(
        firestore,
        'organizations',
        organizationId,
        'exports',
        'projectExpenses',
        'items'
      );

      let q = query(
        feedRef,
        where('isEligibleForProjects', '==', true),
        where('deletedAt', '==', null),
        orderBy('date', 'desc'),
        limit(PAGE_SIZE)
      );

      if (isLoadMore && lastDoc) {
        q = query(
          feedRef,
          where('isEligibleForProjects', '==', true),
          where('deletedAt', '==', null),
          orderBy('date', 'desc'),
          startAfter(lastDoc),
          limit(PAGE_SIZE)
        );
      }

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setHasMore(false);
        if (!isLoadMore) {
          setExpenses([]);
        }
        return;
      }

      // Obtenir els IDs per fer el batch lookup dels links
      const txIds = snapshot.docs.map((d) => d.id);

      // Carregar els expenseLinks corresponents
      const linksRef = collection(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'expenseLinks'
      );

      const linksMap = new Map<string, ExpenseLink>();

      if (txIds.length > 0) {
        // Firestore 'in' query: fem chunks de 10 per compatibilitat segura
        const chunks = chunkArray(txIds, 10);

        // Executem els chunks en paral·lel (roundtrips mínims)
        const snaps = await Promise.all(
          chunks.map((ids) =>
            getDocs(
              query(
                linksRef,
                where(documentId(), 'in', ids)
              )
            )
          )
        );

        for (const snap of snaps) {
          for (const d of snap.docs) {
            linksMap.set(d.id, { id: d.id, ...(d.data() as Omit<ExpenseLink, 'id'>) } as ExpenseLink);
          }
        }
      }

      // Combinar expenses amb links
      const newExpenses: ExpenseWithLink[] = snapshot.docs.map((d) => {
        const expense = { id: d.id, ...d.data() } as ProjectExpenseExport;
        const link = linksMap.get(d.id) ?? null;

        const assignedAmount = link
          ? link.assignments.reduce((sum, a) => sum + (a.amountEUR != null ? Math.abs(a.amountEUR) : 0), 0)
          : 0;
        const totalAmount = Math.abs(expense.amountEUR);
        const remainingAmount = totalAmount - assignedAmount;

        let status: ExpenseStatus = 'unassigned';
        if (link && link.assignments.length > 0) {
          const hasLocalPct = link.assignments.some(a => a.localPct != null);
          if (hasLocalPct) {
            const totalPct = link.assignments.reduce((s, a) => s + (a.localPct ?? 0), 0);
            status = totalPct >= 100 ? 'assigned' : 'partial';
          } else {
            status = remainingAmount <= 0.01 ? 'assigned' : 'partial';
          }
        }

        return {
          expense,
          link,
          status,
          assignedAmount,
          remainingAmount,
        };
      });

      if (isLoadMore) {
        setExpenses((prev) => [...prev, ...newExpenses]);
      } else {
        setExpenses(newExpenses);
      }

      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === PAGE_SIZE);

    } catch (err) {
      console.error('Error loading expense feed:', err);
      setError(err instanceof Error ? err : new Error('Error desconegut'));
    } finally {
      setIsLoading(false);
    }
  }, [firestore, organizationId, lastDoc]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    await loadExpenses(true);
  }, [hasMore, isLoading, loadExpenses]);

  const refresh = useCallback(async () => {
    setLastDoc(null);
    setHasMore(true);
    await loadExpenses(false);
  }, [loadExpenses]);

  useEffect(() => {
    loadExpenses(false);
  }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    expenses,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK: Llistat unificat de despeses (bank + off-bank) amb filtres opcionals
// ═══════════════════════════════════════════════════════════════════════════

interface UseUnifiedExpenseFeedOptions {
  projectId?: string | null;
  budgetLineId?: string | null;
}

interface UseUnifiedExpenseFeedResult {
  expenses: UnifiedExpenseWithLink[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  isFiltered: boolean;
  usedFallback: boolean;
}

export function useUnifiedExpenseFeed(options?: UseUnifiedExpenseFeedOptions): UseUnifiedExpenseFeedResult {
  const { firestore } = useFirebase();
  const { organizationId, userRole, member } = useCurrentOrganization();

  const projectId = options?.projectId ?? null;
  const budgetLineId = options?.budgetLineId ?? null;
  const isFiltered = !!(projectId || budgetLineId);

  const effectivePermissions = useMemo(
    () => resolveEffectivePermissions({
      role: userRole,
      userOverrides: member?.userOverrides,
      userGrants: member?.userGrants,
    }),
    [member?.userGrants, member?.userOverrides, userRole]
  );
  const canViewBankExpenses = canReadBankInProjectes(effectivePermissions);
  const canViewOffBankExpenses = canUseProjectModule(effectivePermissions);

  const [expenses, setExpenses] = useState<UnifiedExpenseWithLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);

  // Paginació
  const [lastBankDoc, setLastBankDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [lastOffBankDoc, setLastOffBankDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Helper per carregar despeses filtrades
  const loadFilteredExpenses = useCallback(async () => {
    if (!organizationId) return;
    if (!canViewOffBankExpenses && !canViewBankExpenses) {
      setExpenses([]);
      setUsedFallback(false);
      return;
    }

    const linksRef = collection(
      firestore,
      'organizations',
      organizationId,
      'projectModule',
      '_',
      'expenseLinks'
    );

    let linksSnapshot;
    let didUseFallback = false;

    // Fer query segons el filtre
    if (budgetLineId) {
      // Cas A: filtrar per budgetLineId
      // Primer intentem amb budgetLineIds (dades noves)
      const directQuery = query(linksRef, where('budgetLineIds', 'array-contains', budgetLineId));
      linksSnapshot = await getDocs(directQuery);

      // Si no trobem res, fem fallback: carregar per projectId i filtrar client-side
      if (linksSnapshot.empty && projectId) {
        didUseFallback = true;
        const fallbackQuery = query(linksRef, where('projectIds', 'array-contains', projectId));
        const fallbackSnapshot = await getDocs(fallbackQuery);

        // Filtrar client-side per budgetLineId dins assignments
        const filteredDocs = fallbackSnapshot.docs.filter((d) => {
          const data = d.data();
          return data.assignments?.some((a: ExpenseAssignment) => a.budgetLineId === budgetLineId);
        });

        linksSnapshot = {
          docs: filteredDocs,
          empty: filteredDocs.length === 0,
        } as unknown as typeof linksSnapshot;
      }
    } else if (projectId) {
      // Cas B: filtrar per projectId
      const directQuery = query(linksRef, where('projectIds', 'array-contains', projectId));
      linksSnapshot = await getDocs(directQuery);
    } else {
      // No hauria d'arribar aquí, però per seguretat
      setExpenses([]);
      setUsedFallback(false);
      return;
    }

    setUsedFallback(didUseFallback);

    const linksMap = new Map<string, ExpenseLink>();
    const txIds: string[] = [];

    for (const linkDoc of linksSnapshot.docs) {
      const linkData = { id: linkDoc.id, ...linkDoc.data() } as ExpenseLink;
      linksMap.set(linkDoc.id, linkData);
      const txId = linkDoc.id;
      const isOffBank = txId.startsWith('off_');
      if ((isOffBank && !canViewOffBankExpenses) || (!isOffBank && !canViewBankExpenses)) {
        continue;
      }
      txIds.push(txId);
    }

    if (txIds.length === 0) {
      setExpenses([]);
      return;
    }

    // Carregar les despeses corresponents
    const bankRef = collection(
      firestore,
      'organizations',
      organizationId,
      'exports',
      'projectExpenses',
      'items'
    );

    const offBankRef = collection(
      firestore,
      'organizations',
      organizationId,
      'projectModule',
      '_',
      'offBankExpenses'
    );

    const allExpenses: UnifiedExpense[] = [];

    // Separar IDs per tipus (off-bank vs bank) per fer queries batxejades
    const offBankTxIds: string[] = [];
    const bankTxIds: string[] = [];
    for (const txId of txIds) {
      if (txId.startsWith('off_')) {
        offBankTxIds.push(txId);
      } else {
        bankTxIds.push(txId);
      }
    }

    // Carregar off-bank expenses en paral·lel (chunks de 10)
    const offBankMap = new Map<string, OffBankExpense>();
    if (canViewOffBankExpenses && offBankTxIds.length > 0) {
      const offBankDocIds = offBankTxIds.map(id => id.replace('off_', ''));
      const chunks = chunkArray(offBankDocIds, 10);
      const snaps = await Promise.all(
        chunks.map((ids) =>
          getDocs(query(offBankRef, where(documentId(), 'in', ids)))
        )
      );
      for (const snap of snaps) {
        for (const d of snap.docs) {
          offBankMap.set(d.id, d.data() as OffBankExpense);
        }
      }
    }

    // Carregar bank expenses en paral·lel (chunks de 10)
    const bankMap = new Map<string, ProjectExpenseExport>();
    if (canViewBankExpenses && bankTxIds.length > 0) {
      const chunks = chunkArray(bankTxIds, 10);
      const snaps = await Promise.all(
        chunks.map((ids) =>
          getDocs(query(bankRef, where(documentId(), 'in', ids)))
        )
      );
      for (const snap of snaps) {
        for (const d of snap.docs) {
          bankMap.set(d.id, d.data() as ProjectExpenseExport);
        }
      }
    }

    // Construir allExpenses mantenint l'ordre original
    for (const txId of txIds) {
      if (txId.startsWith('off_')) {
        const offBankId = txId.replace('off_', '');
        const data = offBankMap.get(offBankId);
        if (data) {
          const isPending = data.amountEUR === null || data.amountEUR === undefined;
          const amountEURValue = typeof data.amountEUR === 'number' ? -Math.abs(data.amountEUR) : 0;
          allExpenses.push({
            txId,
            source: 'offBank' as const,
            date: data.date,
            description: data.concept,
            amountEUR: amountEURValue,
            categoryName: data.categoryName,
            counterpartyName: data.counterpartyName,
            documentUrl: data.documentUrl ?? data.attachments?.[0]?.url ?? null,
            // Camps FX (nou model)
            originalCurrency: data.originalCurrency ?? data.currency ?? null,
            originalAmount: data.originalAmount ?? data.amountOriginal ?? null,
            fxRate: data.fxRate ?? data.fxRateUsed ?? null,
            pendingConversion: isPending,
            // Camps justificació
            invoiceNumber: data.invoiceNumber ?? null,
            issuerTaxId: data.issuerTaxId ?? null,
            invoiceDate: data.invoiceDate ?? null,
            paymentDate: data.paymentDate ?? null,
            supportDocNumber: data.supportDocNumber ?? null,
            needsReview: data.needsReview ?? null,
          });
        }
      } else {
        const data = bankMap.get(txId);
        if (data) {
          allExpenses.push({
            txId,
            source: 'bank' as const,
            date: data.date,
            description: data.description,
            amountEUR: data.amountEUR,
            categoryName: data.categoryName,
            counterpartyName: data.counterpartyName,
            documentUrl: resolveDocumentUrl(data.documents),
          });
        }
      }
    }

    // Ordenar per data desc
    allExpenses.sort((a, b) => b.date.localeCompare(a.date));

    // Combinar amb links
    const result: UnifiedExpenseWithLink[] = allExpenses.map((expense) => {
      const link = linksMap.get(expense.txId) ?? null;

      const assignedAmount = link
        ? link.assignments.reduce((sum, a) => sum + (a.amountEUR != null ? Math.abs(a.amountEUR) : 0), 0)
        : 0;
      const totalAmount = Math.abs(expense.amountEUR);
      const remainingAmount = totalAmount - assignedAmount;

      let status: ExpenseStatus = 'unassigned';
      if (link && link.assignments.length > 0) {
        // Per FX amb localPct: usar suma de percentatges per determinar estat
        const hasLocalPct = link.assignments.some(a => a.localPct != null);
        if (hasLocalPct) {
          const totalPct = link.assignments.reduce((s, a) => s + (a.localPct ?? 0), 0);
          status = totalPct >= 100 ? 'assigned' : 'partial';
        } else {
          status = remainingAmount <= 0.01 ? 'assigned' : 'partial';
        }
      }

      return {
        expense,
        link,
        status,
        assignedAmount,
        remainingAmount,
      };
    });

    setExpenses(result);
  }, [firestore, organizationId, projectId, budgetLineId, canViewOffBankExpenses, canViewBankExpenses]);

  const loadExpenses = useCallback(async (loadMore = false) => {
    if (!organizationId) return;

    try {
      if (!canViewOffBankExpenses && !canViewBankExpenses) {
        setExpenses([]);
        setHasMore(false);
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
      }

      if (loadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        // Reset paginació quan es carrega de nou
        setLastBankDoc(null);
        setLastOffBankDoc(null);
        setHasMore(true);
      }

      // Si hi ha filtre, carreguem des dels expenseLinks primer (sense paginació)
      if (budgetLineId || projectId) {
        await loadFilteredExpenses();
        setHasMore(false); // Els filtrats no tenen paginació
        return;
      }

      // Cas sense filtre: carregar despeses amb paginació
      // 1. Carregar despeses bank (exports)
      let bankDocs: QueryDocumentSnapshot[] = [];
      if (canViewBankExpenses) {
        const bankRef = collection(
          firestore,
          'organizations',
          organizationId,
          'exports',
          'projectExpenses',
          'items'
        );

        const bankQueryConstraints: QueryConstraint[] = [
          where('isEligibleForProjects', '==', true),
          where('deletedAt', '==', null),
          orderBy('date', 'desc'),
          limit(PAGE_SIZE),
        ];
        if (loadMore && lastBankDoc) {
          bankQueryConstraints.push(startAfter(lastBankDoc));
        }
        const bankQuery = query(bankRef, ...bankQueryConstraints);
        const bankSnapshot = await getDocs(bankQuery);
        bankDocs = bankSnapshot.docs;
      } else {
        setLastBankDoc(null);
      }

      // 2. Carregar despeses off-bank
      let offBankDocs: QueryDocumentSnapshot[] = [];
      if (canViewOffBankExpenses) {
        const offBankRef = collection(
          firestore,
          'organizations',
          organizationId,
          'projectModule',
          '_',
          'offBankExpenses'
        );

        const offBankQueryConstraints: QueryConstraint[] = [orderBy('date', 'desc'), limit(PAGE_SIZE)];
        if (loadMore && lastOffBankDoc) {
          offBankQueryConstraints.push(startAfter(lastOffBankDoc));
        }
        const offBankQuery = query(offBankRef, ...offBankQueryConstraints);
        const offBankSnapshot = await getDocs(offBankQuery);
        offBankDocs = offBankSnapshot.docs;
      } else {
        setLastOffBankDoc(null);
      }

      // Actualitzar cursors per paginació
      if (bankDocs.length > 0) {
        setLastBankDoc(bankDocs[bankDocs.length - 1]);
      }
      if (offBankDocs.length > 0) {
        setLastOffBankDoc(offBankDocs[offBankDocs.length - 1]);
      }

      // Comprovar si hi ha més dades
      const hasMoreData = bankDocs.length === PAGE_SIZE || offBankDocs.length === PAGE_SIZE;
      setHasMore(hasMoreData);

      // 3. Convertir a UnifiedExpense
      const bankExpenses: UnifiedExpense[] = bankDocs.map((d) => {
        const data = d.data() as ProjectExpenseExport;
        return {
          txId: d.id,
          source: 'bank' as const,
          date: data.date,
          description: data.description,
          amountEUR: data.amountEUR, // ja negatiu
          categoryName: data.categoryName,
          counterpartyName: data.counterpartyName,
          documentUrl: resolveDocumentUrl(data.documents),
        };
      });

      const offBankExpenses: UnifiedExpense[] = offBankDocs.map((d) => {
        const data = d.data() as OffBankExpense;
        const isPending = data.amountEUR === null || data.amountEUR === undefined;
        const amountEURValue = typeof data.amountEUR === 'number' ? -Math.abs(data.amountEUR) : 0;
        return {
          txId: `off_${d.id}`,
          source: 'offBank' as const,
          date: data.date,
          description: data.concept,
          amountEUR: amountEURValue,
          categoryName: data.categoryName,
          counterpartyName: data.counterpartyName,
          documentUrl: data.documentUrl ?? data.attachments?.[0]?.url ?? null,
          // Camps FX (nou model)
          originalCurrency: data.originalCurrency ?? data.currency ?? null,
          originalAmount: data.originalAmount ?? data.amountOriginal ?? null,
          fxRate: data.fxRate ?? data.fxRateUsed ?? null,
          pendingConversion: isPending,
          // Camps justificació
          invoiceNumber: data.invoiceNumber ?? null,
          issuerTaxId: data.issuerTaxId ?? null,
          invoiceDate: data.invoiceDate ?? null,
          paymentDate: data.paymentDate ?? null,
          supportDocNumber: data.supportDocNumber ?? null,
          needsReview: data.needsReview ?? null,
        };
      });

      // 4. Mergeja i ordena per data desc
      const newExpenses = [...bankExpenses, ...offBankExpenses].sort(
        (a, b) => b.date.localeCompare(a.date)
      );

      // 5. Carregar els expenseLinks corresponents
      const linksRef = collection(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'expenseLinks'
      );

      const linksMap = new Map<string, ExpenseLink>();
      const linkDocs = await Promise.all(
        newExpenses.map((exp) => getDoc(doc(linksRef, exp.txId)))
      );
      for (const linkDoc of linkDocs) {
        if (linkDoc.exists()) {
          linksMap.set(linkDoc.id, { id: linkDoc.id, ...linkDoc.data() } as ExpenseLink);
        }
      }

      // 6. Combinar amb links
      const result: UnifiedExpenseWithLink[] = newExpenses.map((expense) => {
        const link = linksMap.get(expense.txId) ?? null;

        const assignedAmount = link
          ? link.assignments.reduce((sum, a) => sum + (a.amountEUR != null ? Math.abs(a.amountEUR) : 0), 0)
          : 0;
        const totalAmount = Math.abs(expense.amountEUR);
        const remainingAmount = totalAmount - assignedAmount;

        let status: ExpenseStatus = 'unassigned';
        if (link && link.assignments.length > 0) {
          const hasLocalPct = link.assignments.some(a => a.localPct != null);
          if (hasLocalPct) {
            const totalPct = link.assignments.reduce((s, a) => s + (a.localPct ?? 0), 0);
            status = totalPct >= 100 ? 'assigned' : 'partial';
          } else {
            status = remainingAmount <= 0.01 ? 'assigned' : 'partial';
          }
        }

        return {
          expense,
          link,
          status,
          assignedAmount,
          remainingAmount,
        };
      });

      // Si és loadMore, afegir als existents; si no, substituir
      if (loadMore) {
        setExpenses(prev => {
          // Evitar duplicats
          const existingIds = new Set(prev.map(e => e.expense.txId));
          const newItems = result.filter(e => !existingIds.has(e.expense.txId));
          const combined = [...prev, ...newItems];
          // Reordenar per data
          return combined.sort((a, b) => b.expense.date.localeCompare(a.expense.date));
        });
      } else {
        setExpenses(result);
      }

    } catch (err) {
      console.error('Error loading unified expense feed:', err);
      setError(err instanceof Error ? err : new Error('Error desconegut'));
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [
    firestore,
    organizationId,
    projectId,
    budgetLineId,
    loadFilteredExpenses,
    lastBankDoc,
    lastOffBankDoc,
    canViewBankExpenses,
    canViewOffBankExpenses,
  ]);

  const refresh = useCallback(async () => {
    await loadExpenses(false);
  }, [loadExpenses]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    await loadExpenses(true);
  }, [loadExpenses, hasMore, isLoadingMore]);

  useEffect(() => {
    loadExpenses(false);
  }, [organizationId, projectId, budgetLineId, canViewBankExpenses, canViewOffBankExpenses]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    expenses,
    isLoading,
    isLoadingMore,
    error,
    refresh,
    loadMore,
    hasMore,
    isFiltered,
    usedFallback,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK: Crear despesa off-bank
// ═══════════════════════════════════════════════════════════════════════════

interface UseSaveOffBankExpenseResult {
  save: (data: OffBankExpenseFormData) => Promise<string>;
  isSaving: boolean;
  error: Error | null;
}

export function useSaveOffBankExpense(): UseSaveOffBankExpenseResult {
  const { firestore, user } = useFirebase();
  const { organizationId } = useCurrentOrganization();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const save = useCallback(async (data: OffBankExpenseFormData): Promise<string> => {
    if (!organizationId || !user) {
      throw new Error('No autenticat');
    }

    // Validacions
    // amountEUR pot ser null si és moneda local sense fxRate
    let amount: number | null = null;
    if (data.amountEUR) {
      amount = parseFloat(data.amountEUR);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('L\'import ha de ser un número positiu');
      }
    }

    const concept = data.concept.trim();
    if (concept.length === 0) {
      throw new Error('El concepte és obligatori');
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.date)) {
      throw new Error('La data ha de tenir format YYYY-MM-DD');
    }

    // Moneda local (opcional)
    const originalCurrency = data.originalCurrency?.trim().toUpperCase() || null;
    // Ja no exigim import EUR o moneda local - es pot guardar una captura sense import

    setIsSaving(true);
    setError(null);

    try {
      const offBankRef = collection(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'offBankExpenses'
      );

      const now = serverTimestamp();
      const newRef = doc(offBankRef);

      // Camps FX (nou model)
      const originalAmount = data.originalAmount ? parseFloat(data.originalAmount) : null;
      const fxRate = data.fxRate ? parseFloat(data.fxRate) : null;

      const expenseData: Record<string, unknown> = {
        orgId: organizationId,
        source: 'offBank' as const,
        date: data.date,
        concept,
        amountEUR: amount, // pot ser null
        counterpartyName: data.counterpartyName?.trim() || null,
        categoryName: data.categoryName?.trim() || null,
        documentUrl: null,
        createdBy: user.uid,
        createdAt: now,
        updatedAt: now,
      };

      // Afegir camps moneda local si existeixen
      if (originalCurrency && originalCurrency !== 'EUR') {
        expenseData.originalCurrency = originalCurrency;
        if (originalAmount !== null && !isNaN(originalAmount)) {
          expenseData.originalAmount = originalAmount;
        }
        if (fxRate !== null && !isNaN(fxRate) && fxRate > 0) {
          expenseData.fxRate = fxRate;
        }
      }

      // Camps justificació opcionals
      if (data.invoiceNumber?.trim()) {
        expenseData.invoiceNumber = data.invoiceNumber.trim();
      }
      if (data.issuerTaxId?.trim()) {
        expenseData.issuerTaxId = data.issuerTaxId.trim();
      }
      if (data.invoiceDate) {
        expenseData.invoiceDate = data.invoiceDate;
      }
      if (data.paymentDate) {
        expenseData.paymentDate = data.paymentDate;
      }
      if (data.supportDocNumber?.trim()) {
        expenseData.supportDocNumber = data.supportDocNumber.trim();
      }

      // Attachments (nou)
      if (data.attachments && data.attachments.length > 0) {
        expenseData.attachments = data.attachments;
      }

      // needsReview (nou)
      if (data.needsReview) {
        expenseData.needsReview = true;
      }

      await safeSet({
        data: expenseData,
        context: {
          updatedBy: user.uid,
          source: 'user',
          updatedAtFactory: () => serverTimestamp(),
          requiredFields: ['orgId', 'source', 'date', 'concept', 'createdBy'],
        },
        write: async (payload) => {
          await setDoc(newRef, payload);
        },
      });

      return newRef.id;

    } catch (err) {
      console.error('Error saving off-bank expense:', err);
      const e = err instanceof Error ? err : new Error('Error desant despesa');
      setError(e);
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, [firestore, organizationId, user]);

  return {
    save,
    isSaving,
    error,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK: Actualitzar despesa off-bank
// ═══════════════════════════════════════════════════════════════════════════

interface UseUpdateOffBankExpenseResult {
  update: (expenseId: string, data: Partial<OffBankExpenseFormData>) => Promise<void>;
  isUpdating: boolean;
  error: Error | null;
}

export function useUpdateOffBankExpense(): UseUpdateOffBankExpenseResult {
  const { firestore, user } = useFirebase();
  const { organizationId } = useCurrentOrganization();

  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const update = useCallback(async (expenseId: string, data: Partial<OffBankExpenseFormData>): Promise<void> => {
    if (!organizationId || !user) {
      throw new Error('No autenticat');
    }

    if (!expenseId) {
      throw new Error('ID de despesa no vàlid');
    }

    // Validacions si s'inclouen els camps
    // amountEUR pot ser null si és moneda local sense fxRate
    if (data.amountEUR !== undefined && data.amountEUR !== null) {
      const amount = parseFloat(data.amountEUR);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('L\'import ha de ser un número positiu');
      }
    }

    if (data.concept !== undefined) {
      const concept = data.concept.trim();
      if (concept.length === 0) {
        throw new Error('El concepte és obligatori');
      }
    }

    if (data.date !== undefined) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(data.date)) {
        throw new Error('La data ha de tenir format YYYY-MM-DD');
      }
    }

    setIsUpdating(true);
    setError(null);

    try {
      const expenseRef = doc(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'offBankExpenses',
        expenseId
      );

      const updateData: UpdateData<DocumentData> = {
        updatedAt: serverTimestamp(),
      };

      if (data.date !== undefined) {
        updateData.date = data.date;
      }
      if (data.concept !== undefined) {
        updateData.concept = data.concept.trim();
      }
      if (data.amountEUR !== undefined) {
        updateData.amountEUR = data.amountEUR ? parseFloat(data.amountEUR) : null;
      }
      if (data.counterpartyName !== undefined) {
        updateData.counterpartyName = data.counterpartyName.trim() || null;
      }
      if (data.categoryName !== undefined) {
        updateData.categoryName = data.categoryName.trim() || null;
      }

      // Camps moneda local (nou model)
      if (data.originalCurrency !== undefined) {
        const currency = data.originalCurrency?.trim().toUpperCase() || null;
        if (currency && currency !== 'EUR') {
          updateData.originalCurrency = currency;
          if (data.originalAmount !== undefined) {
            const origAmount = data.originalAmount ? parseFloat(data.originalAmount) : null;
            updateData.originalAmount = origAmount !== null && !isNaN(origAmount) ? origAmount : null;
          }
          if (data.fxRate !== undefined) {
            const fxRate = data.fxRate ? parseFloat(data.fxRate) : null;
            updateData.fxRate = fxRate !== null && !isNaN(fxRate) && fxRate > 0 ? fxRate : null;
          }
        } else {
          // Si torna a EUR, netejar camps FX
          updateData.originalCurrency = null;
          updateData.originalAmount = null;
          updateData.fxRate = null;
        }
      }

      // Camps justificació
      if (data.invoiceNumber !== undefined) {
        updateData.invoiceNumber = data.invoiceNumber?.trim() || null;
      }
      if (data.issuerTaxId !== undefined) {
        updateData.issuerTaxId = data.issuerTaxId?.trim() || null;
      }
      if (data.invoiceDate !== undefined) {
        updateData.invoiceDate = data.invoiceDate || null;
      }
      if (data.paymentDate !== undefined) {
        updateData.paymentDate = data.paymentDate || null;
      }
      if (data.supportDocNumber !== undefined) {
        updateData.supportDocNumber = data.supportDocNumber?.trim() || null;
      }

      // Attachments (nou)
      if (data.attachments !== undefined) {
        updateData.attachments = data.attachments.length > 0 ? data.attachments : null;
      }

      // needsReview (nou)
      if (data.needsReview !== undefined) {
        updateData.needsReview = data.needsReview || null;
      }

      await safeUpdate({
        data: updateData as Record<string, unknown>,
        context: {
          updatedBy: user.uid,
          source: 'user',
          updatedAtFactory: () => serverTimestamp(),
        },
        write: async (payload) => {
          await updateDoc(expenseRef, payload as UpdateData<DocumentData>);
        },
      });

    } catch (err) {
      console.error('Error updating off-bank expense:', err);
      const e = err instanceof Error ? err : new Error('Error actualitzant despesa');
      setError(e);
      throw e;
    } finally {
      setIsUpdating(false);
    }
  }, [firestore, organizationId, user]);

  return {
    update,
    isUpdating,
    error,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK: Eliminar despesa off-bank (hard delete)
// ═══════════════════════════════════════════════════════════════════════════

interface HardDeleteTarget {
  id: string;
  attachments?: OffBankAttachment[] | null;
  documentUrl?: string | null;
}

interface UseHardDeleteOffBankExpenseResult {
  hardDelete: (target: HardDeleteTarget) => Promise<void>;
  isDeleting: boolean;
  error: Error | null;
}

export function useHardDeleteOffBankExpense(): UseHardDeleteOffBankExpenseResult {
  const { firestore, storage } = useFirebase();
  const { organizationId } = useCurrentOrganization();

  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const hardDelete = useCallback(async (target: HardDeleteTarget): Promise<void> => {
    if (!organizationId) {
      throw new Error('No autenticat');
    }

    setIsDeleting(true);
    setError(null);

    try {
      // 1. Batch atòmic: eliminar despesa + link
      const batch = writeBatch(firestore);

      const expenseRef = doc(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'offBankExpenses',
        target.id
      );
      batch.delete(expenseRef);

      const linkRef = doc(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'expenseLinks',
        `off_${target.id}`
      );
      batch.delete(linkRef); // idempotent si no existeix

      await batch.commit();

      // 2. Neteja Storage (post-batch, no bloquejant)
      const urls: string[] = [];
      if (target.attachments) {
        for (const att of target.attachments) {
          if (att.url) urls.push(att.url);
        }
      }
      if (target.documentUrl) {
        urls.push(target.documentUrl);
      }

      for (const url of urls) {
        try {
          await deleteObject(ref(storage, url));
        } catch {
          console.warn(`Storage cleanup: no s'ha pogut eliminar ${url}`);
        }
      }

    } catch (err) {
      console.error('Error deleting off-bank expense:', err);
      const e = err instanceof Error ? err : new Error('Error eliminant despesa');
      setError(e);
      throw e;
    } finally {
      setIsDeleting(false);
    }
  }, [firestore, storage, organizationId]);

  return {
    hardDelete,
    isDeleting,
    error,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK: Detall d'una despesa amb el seu link
// ═══════════════════════════════════════════════════════════════════════════

interface UseExpenseDetailResult {
  expense: ProjectExpenseExport | null;
  link: ExpenseLink | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useExpenseDetail(txId: string): UseExpenseDetailResult {
  const { firestore } = useFirebase();
  const { organizationId, userRole, member } = useCurrentOrganization();

  const effectivePermissions = useMemo(
    () => resolveEffectivePermissions({
      role: userRole,
      userOverrides: member?.userOverrides,
      userGrants: member?.userGrants,
    }),
    [member?.userGrants, member?.userOverrides, userRole]
  );
  const canViewBankExpenses = canReadBankInProjectes(effectivePermissions);

  const [expense, setExpense] = useState<ProjectExpenseExport | null>(null);
  const [link, setLink] = useState<ExpenseLink | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!organizationId || !txId) return;

    setIsLoading(true);
    setError(null);

    try {
      if (!txId.startsWith('off_') && !canViewBankExpenses) {
        throw new Error('No tens permisos per veure despeses bancaries en Projectes');
      }

      // Carregar despesa del feed
      const expenseRef = doc(
        firestore,
        'organizations',
        organizationId,
        'exports',
        'projectExpenses',
        'items',
        txId
      );
      const expenseSnap = await getDoc(expenseRef);

      if (!expenseSnap.exists()) {
        throw new Error('Despesa no trobada');
      }

      setExpense({ id: expenseSnap.id, ...expenseSnap.data() } as ProjectExpenseExport);

      // Carregar link si existeix
      const linkRef = doc(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'expenseLinks',
        txId
      );
      const linkSnap = await getDoc(linkRef);

      if (linkSnap.exists()) {
        setLink({ id: linkSnap.id, ...linkSnap.data() } as ExpenseLink);
      } else {
        setLink(null);
      }

    } catch (err) {
      console.error('Error loading expense detail:', err);
      setError(err instanceof Error ? err : new Error('Error desconegut'));
    } finally {
      setIsLoading(false);
    }
  }, [firestore, organizationId, txId, canViewBankExpenses]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    expense,
    link,
    isLoading,
    error,
    refresh: load,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK: Guardar assignació de despesa
// ═══════════════════════════════════════════════════════════════════════════

interface UseSaveExpenseLinkResult {
  save: (txId: string, assignments: ExpenseAssignment[], note: string | null, justification?: ExpenseJustification | null) => Promise<void>;
  remove: (txId: string) => Promise<void>;
  isSaving: boolean;
  error: Error | null;
}

export function useSaveExpenseLink(): UseSaveExpenseLinkResult {
  const { firestore, user } = useFirebase();
  const { organizationId } = useCurrentOrganization();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const save = useCallback(async (
    txId: string,
    assignments: ExpenseAssignment[],
    note: string | null,
    justification?: ExpenseJustification | null
  ) => {
    if (!organizationId || !user) {
      throw new Error('No autenticat');
    }

    // Guardrail estructural: rebutjar dades invàlides ABANS d'escriure a Firestore
    if (assignments.length > 0) {
      const validation = validateAssignments(assignments);
      if (!validation.isValid) {
        throw new Error(`Invalid assignment state: ${validation.errors.join(', ')}`);
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      const linkRef = doc(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'expenseLinks',
        txId
      );

      const existingSnap = await getDoc(linkRef);
      const now = serverTimestamp();

      // Calcular projectIds i budgetLineIds per queries ràpides
      const projectIds = [...new Set(assignments.map((a) => a.projectId))];
      const budgetLineIds = [...new Set(
        assignments
          .filter((a) => a.budgetLineId)
          .map((a) => a.budgetLineId as string)
      )];

      const linkData: Omit<ExpenseLink, 'id' | 'createdAt' | 'updatedAt'> & {
        createdAt?: ReturnType<typeof serverTimestamp>;
        updatedAt: ReturnType<typeof serverTimestamp>;
        budgetLineIds: string[];
      } = {
        orgId: organizationId,
        assignments,
        projectIds,
        budgetLineIds,
        note: note ?? null,
        justification: justification ?? null,
        createdBy: user.uid,
        updatedAt: now,
      };

      if (!existingSnap.exists()) {
        linkData.createdAt = now;
      }

      await setDoc(linkRef, linkData, { merge: true });

    } catch (err) {
      console.error('Error saving expense link:', err);
      const e = err instanceof Error ? err : new Error('Error desant assignació');
      setError(e);
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, [firestore, organizationId, user]);

  const remove = useCallback(async (txId: string) => {
    if (!organizationId) {
      throw new Error('No autenticat');
    }

    setIsSaving(true);
    setError(null);

    try {
      const linkRef = doc(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'expenseLinks',
        txId
      );

      await deleteDoc(linkRef);

    } catch (err) {
      console.error('Error removing expense link:', err);
      const e = err instanceof Error ? err : new Error('Error eliminant assignació');
      setError(e);
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, [firestore, organizationId]);

  return {
    save,
    remove,
    isSaving,
    error,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK: Llistat de projectes del mòdul
// ═══════════════════════════════════════════════════════════════════════════

interface UseProjectsResult {
  projects: Project[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useProjects(onlyActive = false): UseProjectsResult {
  const { firestore } = useFirebase();
  const { organizationId } = useCurrentOrganization();

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;

    setIsLoading(true);
    setError(null);

    try {
      const projectsRef = collection(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'projects'
      );

      let q = query(projectsRef, orderBy('name', 'asc'));

      if (onlyActive) {
        q = query(projectsRef, where('status', '==', 'active'), orderBy('name', 'asc'));
      }

      const snapshot = await getDocs(q);

      const loadedProjects: Project[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      } as Project));

      setProjects(loadedProjects);

    } catch (err) {
      console.error('Error loading projects:', err);
      setError(err instanceof Error ? err : new Error('Error desconegut'));
    } finally {
      setIsLoading(false);
    }
  }, [firestore, organizationId, onlyActive]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    projects,
    isLoading,
    error,
    refresh: load,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK: Detall d'un projecte
// ═══════════════════════════════════════════════════════════════════════════

interface UseProjectDetailResult {
  project: Project | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useProjectDetail(projectId: string): UseProjectDetailResult {
  const { firestore } = useFirebase();
  const { organizationId } = useCurrentOrganization();

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!organizationId || !projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const projectRef = doc(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'projects',
        projectId
      );
      const projectSnap = await getDoc(projectRef);

      if (!projectSnap.exists()) {
        throw new Error('Projecte no trobat');
      }

      setProject({ id: projectSnap.id, ...projectSnap.data() } as Project);

    } catch (err) {
      console.error('Error loading project detail:', err);
      setError(err instanceof Error ? err : new Error('Error desconegut'));
    } finally {
      setIsLoading(false);
    }
  }, [firestore, organizationId, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    project,
    isLoading,
    error,
    refresh: load,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK: Crear/Editar projecte
// ═══════════════════════════════════════════════════════════════════════════

interface UseSaveProjectResult {
  save: (data: ProjectFormData, projectId?: string) => Promise<string>;
  isSaving: boolean;
  error: Error | null;
}

export function useSaveProject(): UseSaveProjectResult {
  const { firestore, user } = useFirebase();
  const { organizationId } = useCurrentOrganization();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const save = useCallback(async (data: ProjectFormData, projectId?: string): Promise<string> => {
    if (!organizationId || !user) {
      throw new Error('No autenticat');
    }

    setIsSaving(true);
    setError(null);

    try {
      const projectsRef = collection(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'projects'
      );

      const now = serverTimestamp();

      const deviationPct = data.allowedDeviationPct ? parseFloat(data.allowedDeviationPct) : 10;

      const projectData = {
        orgId: organizationId,
        name: data.name.trim(),
        code: data.code.trim() || null,
        status: data.status,
        budgetEUR: data.budgetEUR ? parseFloat(data.budgetEUR) : null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        allowedDeviationPct: isNaN(deviationPct) ? 10 : deviationPct,
        updatedAt: now,
      };

      let finalId: string;

      if (projectId) {
        // Editar existent
        const projectRef = doc(projectsRef, projectId);
        await setDoc(projectRef, projectData, { merge: true });
        finalId = projectId;
      } else {
        // Crear nou
        const newRef = doc(projectsRef);
        await setDoc(newRef, {
          ...projectData,
          createdBy: user.uid,
          createdAt: now,
        });
        finalId = newRef.id;
      }

      return finalId;

    } catch (err) {
      console.error('Error saving project:', err);
      const e = err instanceof Error ? err : new Error('Error desant projecte');
      setError(e);
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, [firestore, organizationId, user]);

  return {
    save,
    isSaving,
    error,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK: Desar tipus de canvi del projecte (FX)
// ═══════════════════════════════════════════════════════════════════════════

interface UseSaveProjectFxResult {
  saveFx: (projectId: string, fxRate: number | null, fxCurrency: string | null) => Promise<void>;
  isSaving: boolean;
  error: Error | null;
}

export function useSaveProjectFx(): UseSaveProjectFxResult {
  const { firestore } = useFirebase();
  const { organizationId } = useCurrentOrganization();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const saveFx = useCallback(async (
    projectId: string,
    fxRate: number | null,
    fxCurrency: string | null
  ): Promise<void> => {
    if (!organizationId) {
      throw new Error('No autenticat');
    }

    setIsSaving(true);
    setError(null);

    try {
      const projectRef = doc(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'projects',
        projectId
      );

      await setDoc(projectRef, {
        fxRate: fxRate,
        fxCurrency: fxCurrency,
        updatedAt: serverTimestamp(),
      }, { merge: true });

    } catch (err) {
      console.error('Error saving project FX:', err);
      const e = err instanceof Error ? err : new Error('Error desant tipus de canvi');
      setError(e);
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, [firestore, organizationId]);

  return {
    saveFx,
    isSaving,
    error,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONS PURES: Càlcul TC ponderat (EUR per 1 unitat local)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcula el TC ponderat del projecte com EUR per 1 unitat local.
 * Fórmula: Σ eurSent / Σ localReceived
 * Compatible amb expense.fxRate (amountEUR = originalAmount × fxRate)
 */
export function computeWeightedFxRate(transfers: FxTransfer[]): number | null {
  if (transfers.length === 0) return null;
  const totalEur = transfers.reduce((s, t) => s + t.eurSent, 0);
  const totalLocal = transfers.reduce((s, t) => s + t.localReceived, 0);
  if (totalLocal <= 0) return null;
  return totalEur / totalLocal;
}

/**
 * Retorna la moneda local del projecte si totes les transferències usen la mateixa.
 * Si hi ha múltiples monedes → null.
 */
export function computeFxCurrency(transfers: FxTransfer[]): string | null {
  if (transfers.length === 0) return null;
  const currencies = new Set(transfers.map(t => t.localCurrency));
  return currencies.size === 1 ? [...currencies][0] : null;
}

/**
 * Retorna el TC efectiu del projecte (EUR per 1 unitat local).
 * Fallback chain: TC ponderat de transferències > project.fxRate (invertit) > null.
 * NOTA: project.fxRate = "X local = 1 EUR" (convenci inversa), cal invertir.
 */
export function getEffectiveProjectTC(
  fxTransfers: FxTransfer[],
  project: Project
): number | null {
  const weighted = computeWeightedFxRate(fxTransfers);
  if (weighted !== null) return weighted;
  if (project.fxRate && project.fxRate > 0) return 1 / project.fxRate;
  return null;
}

/**
 * Detecta si una despesa off-bank és FX i té originalAmount per computar EUR.
 * Només aquestes despeses usen TC del projecte (o TC manual) per calcular EUR.
 */
export function isFxExpenseNeedingProjectTC(expense: UnifiedExpense): boolean {
  return (
    expense.source === 'offBank' &&
    expense.originalAmount != null &&
    expense.originalAmount > 0 &&
    expense.originalCurrency != null &&
    expense.originalCurrency !== 'EUR'
  );
}

/**
 * Resol el TC per una despesa FX, amb prioritat:
 * 1. TC manual per despesa (expense.fxRate) — PRIORITAT ABSOLUTA
 * 2. TC projecte (ponderat o legacy invertit)
 * Retorna EUR per 1 unitat local, o null si no hi ha TC disponible.
 */
export function resolveExpenseTC(
  expense: UnifiedExpense,
  fxTransfers: FxTransfer[],
  project: Project
): number | null {
  if (expense.fxRate != null && expense.fxRate > 0) return expense.fxRate;
  return getEffectiveProjectTC(fxTransfers, project);
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK: Transferències FX d'un projecte
// ═══════════════════════════════════════════════════════════════════════════

interface UseProjectFxTransfersResult {
  fxTransfers: FxTransfer[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useProjectFxTransfers(projectId: string): UseProjectFxTransfersResult {
  const { firestore } = useFirebase();
  const { organizationId } = useCurrentOrganization();

  const [fxTransfers, setFxTransfers] = useState<FxTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!organizationId || !projectId) {
      setFxTransfers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const transfersRef = collection(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'projects',
        projectId,
        'fxTransfers'
      );

      const snapshot = await getDocs(transfersRef);

      const transfers: FxTransfer[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      } as FxTransfer));

      // Ordenar per date ascendent
      transfers.sort((a, b) => a.date.localeCompare(b.date));

      setFxTransfers(transfers);

    } catch (err) {
      console.error('Error loading fxTransfers:', err);
      setError(err instanceof Error ? err : new Error('Error desconegut'));
    } finally {
      setIsLoading(false);
    }
  }, [firestore, organizationId, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    fxTransfers,
    isLoading,
    error,
    refresh: load,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK: CRUD de transferències FX
// ═══════════════════════════════════════════════════════════════════════════

interface UseSaveFxTransferResult {
  save: (projectId: string, data: FxTransferFormData, transferId?: string) => Promise<string>;
  remove: (projectId: string, transferId: string) => Promise<void>;
  isSaving: boolean;
  error: Error | null;
}

export function useSaveFxTransfer(): UseSaveFxTransferResult {
  const { firestore } = useFirebase();
  const { organizationId } = useCurrentOrganization();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const save = useCallback(async (
    projectId: string,
    data: FxTransferFormData,
    transferId?: string
  ): Promise<string> => {
    if (!organizationId) {
      throw new Error('No autenticat');
    }

    const date = data.date.trim();
    if (!date) {
      throw new Error('La data és obligatòria');
    }

    const eurSent = parseFloat(data.eurSent.replace(',', '.'));
    if (isNaN(eurSent) || eurSent <= 0) {
      throw new Error('L\'import en EUR ha de ser positiu');
    }

    const localReceived = parseFloat(data.localReceived.replace(',', '.'));
    if (isNaN(localReceived) || localReceived <= 0) {
      throw new Error('L\'import en moneda local ha de ser positiu');
    }

    const localCurrency = data.localCurrency.trim().toUpperCase();
    if (!localCurrency) {
      throw new Error('La moneda és obligatòria');
    }

    setIsSaving(true);
    setError(null);

    try {
      const transfersRef = collection(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'projects',
        projectId,
        'fxTransfers'
      );

      const transferData: Omit<FxTransfer, 'id'> = {
        date,
        eurSent,
        localCurrency,
        localReceived,
        bankTxRef: data.bankTxRef?.trim() ? { txId: data.bankTxRef.trim() } : null,
        notes: data.notes?.trim() || null,
      };

      let finalId: string;

      if (transferId) {
        const transferRef = doc(transfersRef, transferId);
        await setDoc(transferRef, transferData, { merge: true });
        finalId = transferId;
      } else {
        const newRef = doc(transfersRef);
        await setDoc(newRef, transferData);
        finalId = newRef.id;
      }

      return finalId;

    } catch (err) {
      console.error('Error saving fxTransfer:', err);
      const e = err instanceof Error ? err : new Error('Error desant transferència');
      setError(e);
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, [firestore, organizationId]);

  const remove = useCallback(async (projectId: string, transferId: string) => {
    if (!organizationId) {
      throw new Error('No autenticat');
    }

    setIsSaving(true);
    setError(null);

    try {
      const transferRef = doc(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'projects',
        projectId,
        'fxTransfers',
        transferId
      );

      await deleteDoc(transferRef);

    } catch (err) {
      console.error('Error removing fxTransfer:', err);
      const e = err instanceof Error ? err : new Error('Error eliminant transferència');
      setError(e);
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, [firestore, organizationId]);

  return {
    save,
    remove,
    isSaving,
    error,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK: Re-aplicar TC a assignacions FX d'un projecte
// ═══════════════════════════════════════════════════════════════════════════

interface UseReapplyProjectFxResult {
  reapply: (
    projectId: string,
    fxTransfers: FxTransfer[],
    project: Project
  ) => Promise<{ updated: number; skippedManualTC: number }>;
  isRunning: boolean;
}

export function useReapplyProjectFx(): UseReapplyProjectFxResult {
  const { firestore } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const [isRunning, setIsRunning] = useState(false);

  const reapply = useCallback(async (
    projectId: string,
    fxTransfers: FxTransfer[],
    project: Project
  ): Promise<{ updated: number; skippedManualTC: number }> => {
    if (!organizationId) throw new Error('No autenticat');

    setIsRunning(true);
    try {
      // 1. Calcular el TC actual del projecte
      const newTC = getEffectiveProjectTC(fxTransfers, project);

      // 2. Carregar expenseLinks del projecte
      const linksRef = collection(
        firestore, 'organizations', organizationId, 'projectModule', '_', 'expenseLinks'
      );
      const q = query(linksRef, where('projectIds', 'array-contains', projectId));
      const snapshot = await getDocs(q);

      const links: ExpenseLink[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      } as ExpenseLink));

      // 3. Cache de docs off-bank per evitar recàrregues
      const offBankCache = new Map<string, OffBankExpense | null>();

      async function getOffBankDoc(expenseId: string): Promise<OffBankExpense | null> {
        if (offBankCache.has(expenseId)) return offBankCache.get(expenseId)!;
        const docRef = doc(
          firestore, 'organizations', organizationId!, 'projectModule', '_', 'offBankExpenses', expenseId
        );
        const snap = await getDoc(docRef);
        const data = snap.exists() ? { id: snap.id, ...snap.data() } as OffBankExpense : null;
        offBankCache.set(expenseId, data);
        return data;
      }

      // 4. Iterar links i calcular updates
      let updated = 0;
      let skippedManualTC = 0;

      // Acumular updates: linkId -> { ref, newAssignments }
      const pendingUpdates: Array<{
        linkRef: ReturnType<typeof doc>;
        assignments: ExpenseAssignment[];
      }> = [];

      for (const link of links) {
        let linkModified = false;
        const newAssignments = [...link.assignments];

        for (let i = 0; i < newAssignments.length; i++) {
          const assignment = newAssignments[i];
          if (assignment.projectId !== projectId) continue;

          // Només off-bank (txId comença amb "off_")
          if (!link.id.startsWith('off_')) continue;

          // Carregar doc off-bank
          const expenseId = link.id.slice(4); // treure "off_"
          const offBank = await getOffBankDoc(expenseId);
          if (!offBank) continue;

          // Si la despesa té TC manual (fxRate o fxRateUsed) → skip
          const expenseFxRate = offBank.fxRate ?? offBank.fxRateUsed ?? null;
          if (expenseFxRate != null && expenseFxRate > 0) {
            skippedManualTC++;
            continue;
          }

          // Si no té originalAmount → skip
          const originalAmount = offBank.originalAmount ?? offBank.amountOriginal ?? null;
          if (originalAmount == null) continue;

          // Calcular nou amountEUR
          const pct = assignment.localPct ?? 100;
          const newAmountEUR = computeFxAmountEUR(originalAmount, pct, newTC);

          // Comparar amb l'actual (tolerància 0.01 EUR)
          const oldAmountEUR = assignment.amountEUR;
          if (newAmountEUR === null && oldAmountEUR === null) continue;
          if (
            newAmountEUR !== null &&
            oldAmountEUR !== null &&
            Math.abs(newAmountEUR - oldAmountEUR) < 0.01
          ) continue;

          // Actualitzar
          newAssignments[i] = { ...assignment, amountEUR: newAmountEUR };
          linkModified = true;
          updated++;
        }

        if (linkModified) {
          const linkRef = doc(linksRef, link.id);
          pendingUpdates.push({ linkRef, assignments: newAssignments });
        }
      }

      // 5. Escriure amb writeBatch (chunks de 50)
      if (pendingUpdates.length > 0) {
        const chunks = chunkArray(pendingUpdates, 50);
        for (const chunk of chunks) {
          const batch = writeBatch(firestore);
          for (const { linkRef, assignments } of chunk) {
            batch.update(linkRef, {
              assignments,
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        }
      }

      return { updated, skippedManualTC };
    } finally {
      setIsRunning(false);
    }
  }, [firestore, organizationId]);

  return { reapply, isRunning };
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK: Partides de pressupost d'un projecte
// ═══════════════════════════════════════════════════════════════════════════

interface UseProjectBudgetLinesResult {
  budgetLines: BudgetLine[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useProjectBudgetLines(projectId: string): UseProjectBudgetLinesResult {
  const { firestore } = useFirebase();
  const { organizationId } = useCurrentOrganization();

  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!organizationId || !projectId) {
      setBudgetLines([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const linesRef = collection(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'projects',
        projectId,
        'budgetLines'
      );

      // Carregar totes les partides (ordenarem al client per evitar problemes amb nulls)
      const snapshot = await getDocs(linesRef);

      const lines: BudgetLine[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      } as BudgetLine));

      // Ordenar al client: primer per order (nulls al final), després per name
      lines.sort((a, b) => {
        if (a.order !== null && b.order !== null) return a.order - b.order;
        if (a.order !== null) return -1;
        if (b.order !== null) return 1;
        return a.name.localeCompare(b.name);
      });

      setBudgetLines(lines);

    } catch (err) {
      console.error('Error loading budget lines:', err);
      setError(err instanceof Error ? err : new Error('Error desconegut'));
    } finally {
      setIsLoading(false);
    }
  }, [firestore, organizationId, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    budgetLines,
    isLoading,
    error,
    refresh: load,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK: CRUD de partides de pressupost
// ═══════════════════════════════════════════════════════════════════════════

interface UseSaveBudgetLineResult {
  save: (projectId: string, data: BudgetLineFormData, lineId?: string) => Promise<string>;
  remove: (projectId: string, lineId: string) => Promise<void>;
  isSaving: boolean;
  error: Error | null;
}

export function useSaveBudgetLine(): UseSaveBudgetLineResult {
  const { firestore, user } = useFirebase();
  const { organizationId } = useCurrentOrganization();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const save = useCallback(async (
    projectId: string,
    data: BudgetLineFormData,
    lineId?: string
  ): Promise<string> => {
    if (!organizationId || !user) {
      throw new Error('No autenticat');
    }

    const name = data.name.trim();
    if (!name) {
      throw new Error('El nom de la partida és obligatori');
    }

    const amount = parseFloat(data.budgetedAmountEUR);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('L\'import pressupostat ha de ser positiu');
    }

    setIsSaving(true);
    setError(null);

    try {
      const linesRef = collection(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'projects',
        projectId,
        'budgetLines'
      );

      const now = serverTimestamp();
      const orderNum = data.order ? parseInt(data.order, 10) : null;

      const lineData = {
        name,
        code: data.code.trim() || null,
        budgetedAmountEUR: amount,
        order: isNaN(orderNum as number) ? null : orderNum,
        updatedAt: now,
      };

      let finalId: string;

      if (lineId) {
        const lineRef = doc(linesRef, lineId);
        await setDoc(lineRef, lineData, { merge: true });
        finalId = lineId;
      } else {
        const newRef = doc(linesRef);
        await setDoc(newRef, {
          ...lineData,
          createdBy: user.uid,
          createdAt: now,
        });
        finalId = newRef.id;
      }

      return finalId;

    } catch (err) {
      console.error('Error saving budget line:', err);
      const e = err instanceof Error ? err : new Error('Error desant partida');
      setError(e);
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, [firestore, organizationId, user]);

  const remove = useCallback(async (projectId: string, lineId: string) => {
    if (!organizationId) {
      throw new Error('No autenticat');
    }

    setIsSaving(true);
    setError(null);

    try {
      const lineRef = doc(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'projects',
        projectId,
        'budgetLines',
        lineId
      );

      await deleteDoc(lineRef);

    } catch (err) {
      console.error('Error removing budget line:', err);
      const e = err instanceof Error ? err : new Error('Error eliminant partida');
      setError(e);
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, [firestore, organizationId]);

  return {
    save,
    remove,
    isSaving,
    error,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK: Actualitzar budgetLine d'una assignació
// ═══════════════════════════════════════════════════════════════════════════

interface UseSetBudgetLineResult {
  setBudgetLineForAssignment: (
    txId: string,
    assignmentIndex: number,
    budgetLineId: string | null,
    budgetLineName: string | null
  ) => Promise<void>;
  isSaving: boolean;
  error: Error | null;
}

export function useSetBudgetLine(): UseSetBudgetLineResult {
  const { firestore } = useFirebase();
  const { organizationId } = useCurrentOrganization();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const setBudgetLineForAssignment = useCallback(async (
    txId: string,
    assignmentIndex: number,
    budgetLineId: string | null,
    budgetLineName: string | null
  ) => {
    if (!organizationId) {
      throw new Error('No autenticat');
    }

    setIsSaving(true);
    setError(null);

    try {
      const linkRef = doc(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'expenseLinks',
        txId
      );

      const linkSnap = await getDoc(linkRef);
      if (!linkSnap.exists()) {
        throw new Error('Assignació no trobada');
      }

      const linkData = linkSnap.data() as ExpenseLink;
      const assignments = [...linkData.assignments];

      if (assignmentIndex < 0 || assignmentIndex >= assignments.length) {
        throw new Error('Índex d\'assignació invàlid');
      }

      // Actualitzar budgetLineId i budgetLineName
      assignments[assignmentIndex] = {
        ...assignments[assignmentIndex],
        budgetLineId,
        budgetLineName,
      };

      await setDoc(linkRef, {
        assignments,
        updatedAt: serverTimestamp(),
      }, { merge: true });

    } catch (err) {
      console.error('Error setting budget line:', err);
      const e = err instanceof Error ? err : new Error('Error actualitzant partida');
      setError(e);
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, [firestore, organizationId]);

  return {
    setBudgetLineForAssignment,
    isSaving,
    error,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK: Despeses assignades a un projecte (per calcular execució)
// ═══════════════════════════════════════════════════════════════════════════

interface UseProjectExpenseLinksResult {
  expenseLinks: ExpenseLink[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useProjectExpenseLinks(projectId: string): UseProjectExpenseLinksResult {
  const { firestore } = useFirebase();
  const { organizationId } = useCurrentOrganization();

  const [expenseLinks, setExpenseLinks] = useState<ExpenseLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!organizationId || !projectId) {
      setExpenseLinks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const linksRef = collection(
        firestore,
        'organizations',
        organizationId,
        'projectModule',
        '_',
        'expenseLinks'
      );

      // Query amb projectIds array-contains
      const q = query(linksRef, where('projectIds', 'array-contains', projectId));
      const snapshot = await getDocs(q);

      const links: ExpenseLink[] = snapshot.docs.map((d) => {
        const data = d.data();
        // Compatibilitat: si no té projectIds, calcular-lo
        const projectIds = data.projectIds ?? data.assignments?.map((a: ExpenseAssignment) => a.projectId) ?? [];
        return {
          id: d.id,
          ...data,
          projectIds,
        } as ExpenseLink;
      });

      setExpenseLinks(links);

    } catch (err) {
      console.error('Error loading project expense links:', err);
      setError(err instanceof Error ? err : new Error('Error desconegut'));
    } finally {
      setIsLoading(false);
    }
  }, [firestore, organizationId, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    expenseLinks,
    isLoading,
    error,
    refresh: load,
  };
}
