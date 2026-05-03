'use client';

import * as React from 'react';
import { DEFAULT_GOOGLE_GENAI_MODEL_LABEL } from '@/ai/config';
import { doc, CollectionReference } from 'firebase/firestore';
import { updateDocumentNonBlocking, useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/i18n';
import { trackUX } from '@/lib/ux/trackUX';
import type { Transaction, Category, ClassificationMemoryEntry } from '@/lib/data';
import { resolveAutomaticCategoryDecision } from '@/lib/transaction-classification/decision-engine';

// =============================================================================
// TYPES
// =============================================================================

interface UseTransactionCategorizationParams {
  transactionsCollection: CollectionReference | null;
  transactions: Transaction[] | null;
  availableCategories: Category[] | null;
  classificationMemory?: ClassificationMemoryEntry[] | null;
  organizationId?: string | null;
  getCategoryDisplayName: (categoryId: string) => string;
  bulkMode?: boolean;
  onQuotaExceeded?: () => void;
}

interface UseTransactionCategorizationReturn {
  // Loading states
  loadingStates: Record<string, boolean>;
  isBatchCategorizing: boolean;
  batchProgress: { current: number; total: number } | null;
  batchStatus: {
    phase: 'preparing' | 'analyzing' | 'applying' | 'waiting';
    current: number;
    total: number;
    appliedCount: number;
    reviewCount: number;
    currentDescription: string | null;
    suggestedCategoryName: string | null;
    optionCount: number;
    delayMs: number;
    source: 'rules' | 'ai' | null;
  } | null;

  // Actions
  handleCategorize: (txId: string) => Promise<void>;
  handleBatchCategorize: () => Promise<void>;
  handleCancelBatch: () => void;
}

// API Response types
type ApiSuccessResponse = {
  ok: true;
  categoryId: string | null;
  confidence: number;
};

type ApiErrorResponse = {
  ok: false;
  code: 'QUOTA_EXCEEDED' | 'RATE_LIMITED' | 'TRANSIENT' | 'INVALID_INPUT' | 'AI_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN';
  message: string;
};

type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

// Category option for API input
type CategoryOption = {
  id: string;
  name: string;
};

// =============================================================================
// CONSTANTS
// =============================================================================

// IMPORTANT: Processament SEQÜENCIAL via Route Handler (NO Server Action)
// La velocitat ve de l'automatització, NO del paral·lelisme

// Delay base entre crides IA
const BASE_DELAY_NORMAL_MS = 1500; // 1.5 segons
const BASE_DELAY_BULK_MS = 1200; // 1.2 segons en mode ràpid

// Backoff adaptatiu
const MAX_DELAY_MS = 8000; // Màxim 8 segons
const BACKOFF_MULTIPLIER = 2;

// =============================================================================
// API CALL HELPER
// =============================================================================

async function callCategorizationAPI(input: {
  orgId: string;
  idToken: string;
  description: string;
  amount: number;
  expenseOptions: CategoryOption[];
  incomeOptions: CategoryOption[];
}): Promise<ApiResponse> {
  const { idToken, ...body } = input;
  const response = await fetch('/api/ai/categorize-transaction', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });

  // Parse JSON - Route Handler always returns 200 with ok field
  const data = await response.json();
  return data as ApiResponse;
}

// =============================================================================
// ERROR MESSAGE HELPER
// =============================================================================

/**
 * Tradueix el codi d'error de l'API a un missatge clar per l'usuari
 */
function getErrorMessage(code: ApiErrorResponse['code'], language: 'ca' | 'es' | 'fr'): { title: string; description: string } {
  const messages: Record<ApiErrorResponse['code'], { ca: { title: string; description: string }; es: { title: string; description: string }; fr: { title: string; description: string } }> = {
    QUOTA_EXCEEDED: {
      ca: {
        title: "Límit d'ús d'IA assolit",
        description: "S'ha arribat al límit d'ús d'IA per avui. La categorització automàtica es reprendrà quan es renovi la quota.",
      },
      es: {
        title: "Límite de uso de IA alcanzado",
        description: "Se ha alcanzado el límite de uso de IA para hoy. La categorización automática se reanudará cuando se renueve la cuota.",
      },
      fr: {
        title: "Limite d'utilisation de l'IA atteinte",
        description: "La limite d'utilisation de l'IA pour aujourd'hui a été atteinte. La catégorisation automatique reprendra lorsque le quota sera renouvelé.",
      },
    },
    RATE_LIMITED: {
      ca: {
        title: "Massa peticions",
        description: "S'estan fent massa peticions. Esperant...",
      },
      es: {
        title: "Demasiadas peticiones",
        description: "Se están haciendo demasiadas peticiones. Esperando...",
      },
      fr: {
        title: "Trop de requêtes",
        description: "Trop de requêtes en cours. En attente...",
      },
    },
    TRANSIENT: {
      ca: {
        title: "Error temporal",
        description: "Error temporal del servidor. Reintentant...",
      },
      es: {
        title: "Error temporal",
        description: "Error temporal del servidor. Reintentando...",
      },
      fr: {
        title: "Erreur temporaire",
        description: "Erreur temporaire du serveur. Nouvelle tentative...",
      },
    },
    INVALID_INPUT: {
      ca: {
        title: "Dades invàlides",
        description: "Les dades de la transacció no són vàlides.",
      },
      es: {
        title: "Datos inválidos",
        description: "Los datos de la transacción no son válidos.",
      },
      fr: {
        title: "Données invalides",
        description: "Les données de la transaction ne sont pas valides.",
      },
    },
    UNAUTHORIZED: {
      ca: {
        title: "Sessió no vàlida",
        description: "Torna a iniciar sessió per utilitzar la IA.",
      },
      es: {
        title: "Sesión no válida",
        description: "Vuelve a iniciar sesión para utilizar la IA.",
      },
      fr: {
        title: "Session non valide",
        description: "Reconnectez-vous pour utiliser l'IA.",
      },
    },
    FORBIDDEN: {
      ca: {
        title: "Permisos insuficients",
        description: "No tens permisos per utilitzar la IA en aquesta organització.",
      },
      es: {
        title: "Permisos insuficientes",
        description: "No tienes permisos para utilizar la IA en esta organización.",
      },
      fr: {
        title: "Autorisations insuffisantes",
        description: "Vous n'avez pas les autorisations nécessaires pour utiliser l'IA dans cette organisation.",
      },
    },
    AI_ERROR: {
      ca: {
        title: "IA no disponible",
        description: "No s'ha pogut accedir a la clau d'IA del sistema. Revisa la configuració del servei o torna-ho a provar més tard.",
      },
      es: {
        title: "IA no disponible",
        description: "No se ha podido acceder a la clave de IA del sistema. Revisa la configuración del servicio o inténtalo más tarde.",
      },
      fr: {
        title: "IA non disponible",
        description: "Impossible d'accéder à la clé IA du système. Vérifiez la configuration du service ou réessayez plus tard.",
      },
    },
  };

  return messages[code]?.[language] || messages.AI_ERROR[language];
}

// =============================================================================
// HOOK
// =============================================================================

export function useTransactionCategorization({
  transactionsCollection,
  transactions,
  availableCategories,
  classificationMemory,
  organizationId,
  getCategoryDisplayName,
  bulkMode = false,
  onQuotaExceeded,
}: UseTransactionCategorizationParams): UseTransactionCategorizationReturn {
  const { toast } = useToast();
  const { user } = useFirebase();
  const { t, language } = useTranslations();
  // pt fa fallback a ca per missatges d'error (getErrorMessage només té ca/es/fr)
  const errorLang = language === 'pt' ? 'ca' : language;

  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------

  const [loadingStates, setLoadingStates] = React.useState<Record<string, boolean>>({});
  const [isBatchCategorizing, setIsBatchCategorizing] = React.useState(false);
  const [batchProgress, setBatchProgress] = React.useState<{ current: number; total: number } | null>(null);
  const [batchStatus, setBatchStatus] = React.useState<UseTransactionCategorizationReturn['batchStatus']>(null);

  // Cancel·lació
  const cancelRef = React.useRef(false);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      cancelRef.current = true;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // DERIVED DATA
  // ---------------------------------------------------------------------------

  const expenseOptions = React.useMemo(
    () => availableCategories?.filter((c) => c.type === 'expense').map((c) => ({ id: c.id, name: c.name })) || [],
    [availableCategories]
  );

  const incomeOptions = React.useMemo(
    () => availableCategories?.filter((c) => c.type === 'income').map((c) => ({ id: c.id, name: c.name })) || [],
    [availableCategories]
  );

  // ---------------------------------------------------------------------------
  // CANCEL HANDLER
  // ---------------------------------------------------------------------------

  const handleCancelBatch = React.useCallback(() => {
    cancelRef.current = true;
  }, []);

  // ---------------------------------------------------------------------------
  // CATEGORIZE SINGLE TRANSACTION (via Route Handler)
  // ---------------------------------------------------------------------------

  const handleCategorize = React.useCallback(async (txId: string) => {
    if (!transactions) return;
    const transaction = transactions.find((tx) => tx.id === txId);
    if (!transaction || !availableCategories || !transactionsCollection) return;

    setLoadingStates((prev) => ({ ...prev, [txId]: true }));
    try {
      const automaticDecision = resolveAutomaticCategoryDecision({
        description: transaction.description,
        amount: transaction.amount,
        categories: availableCategories,
        memoryEntries: classificationMemory,
      });

      if (automaticDecision) {
        updateDocumentNonBlocking(doc(transactionsCollection, txId), { category: automaticDecision.categoryId });
        const categoryName = getCategoryDisplayName(automaticDecision.categoryId);
        toast({
          title: language === 'ca' ? 'Categoria assignada' : 'Categoría asignada',
          description: language === 'ca'
            ? `Transacció classificada com "${categoryName}" per criteri conservador.`
            : `Transacción clasificada como "${categoryName}" con criterio conservador.`,
        });
        trackUX('ai.categorize.forced', {
          categoryId: automaticDecision.categoryId,
          categoryName,
          source: automaticDecision.source,
        });
        return;
      }

      if (!organizationId || !user) {
        throw new Error('Sessió no vàlida. Torna a iniciar sessió.');
      }

      const idToken = await user.getIdToken();
      const result = await callCategorizationAPI({
        orgId: organizationId,
        idToken,
        description: transaction.description,
        amount: transaction.amount,
        expenseOptions,
        incomeOptions,
      });

      if (!result.ok) {
        updateDocumentNonBlocking(doc(transactionsCollection, txId), { category: null });

        const errorMsg = getErrorMessage(result.code, errorLang);
        toast({
          variant: 'destructive',
          title: errorMsg.title,
          description: errorMsg.description,
        });

        trackUX('ai.categorize.error', { code: result.code, reason: result.message, model: DEFAULT_GOOGLE_GENAI_MODEL_LABEL });
        return;
      }

      const categoryToSave = result.categoryId ?? null;
      updateDocumentNonBlocking(doc(transactionsCollection, txId), { category: categoryToSave });

      const categoryName = result.categoryId ? getCategoryDisplayName(result.categoryId) : (language === 'ca' ? 'sense categoria' : 'sin categoría');
      toast({
        title: language === 'ca' ? 'Categorització Automàtica' : 'Categorización Automática',
        description: language === 'ca'
          ? `Transacció classificada com "${categoryName}" amb una confiança del ${Math.round(result.confidence * 100)}%.`
          : `Transacción clasificada como "${categoryName}" con una confianza del ${Math.round(result.confidence * 100)}%.`,
      });
    } catch (error) {
      console.error('Error categorizing transaction:', error);
      updateDocumentNonBlocking(doc(transactionsCollection, txId), { category: null });

      const errorMsg = getErrorMessage('AI_ERROR', errorLang);
      toast({
        variant: 'destructive',
        title: errorMsg.title,
        description: errorMsg.description,
      });
      trackUX('ai.categorize.error', { code: 'NETWORK', reason: String(error), model: DEFAULT_GOOGLE_GENAI_MODEL_LABEL });
    } finally {
      setLoadingStates((prev) => ({ ...prev, [txId]: false }));
    }
  }, [
    transactions,
    availableCategories,
    classificationMemory,
    transactionsCollection,
    organizationId,
    user,
    expenseOptions,
    incomeOptions,
    getCategoryDisplayName,
    language,
    toast,
    t,
  ]);

  // ---------------------------------------------------------------------------
  // BATCH CATEGORIZE ALL UNCATEGORIZED (SEQÜENCIAL via Route Handler)
  // ---------------------------------------------------------------------------

  const handleBatchCategorize = React.useCallback(async () => {
    // Bloquejar si ja s'està executant
    if (isBatchCategorizing) {
      return;
    }

    if (!transactions || !availableCategories || !transactionsCollection || !organizationId || !user) {
      toast({ title: t.movements.table.dataUnavailable, description: t.movements.table.dataLoadError });
      return;
    }

    const transactionsToCategorize = transactions.filter(tx => !tx.category || tx.category === 'Revisar');
    if (transactionsToCategorize.length === 0) {
      toast({ title: t.movements.table.nothingToCategorize, description: t.movements.table.allAlreadyCategorized });
      return;
    }

    // Reset cancel flag
    cancelRef.current = false;

    // Delay base segons mode
    let currentDelay = bulkMode ? BASE_DELAY_BULK_MS : BASE_DELAY_NORMAL_MS;

    setIsBatchCategorizing(true);
    setBatchProgress({ current: 0, total: transactionsToCategorize.length });
    setBatchStatus({
      phase: 'preparing',
      current: 0,
      total: transactionsToCategorize.length,
      appliedCount: 0,
      reviewCount: 0,
      currentDescription: null,
      suggestedCategoryName: null,
      optionCount: 0,
      delayMs: currentDelay,
      source: null,
    });
    const startTime = Date.now();
    trackUX('ai.bulk.run.start', { count: transactionsToCategorize.length, bulkMode, sequential: true });

    let successCount = 0;
    let errorCount = 0;
    let quotaExceeded = false;
    let cancelled = false;
    const idToken = await user.getIdToken();

    // PROCESSAMENT SEQÜENCIAL: una transacció alhora
    for (let i = 0; i < transactionsToCategorize.length; i++) {
      // Check cancel
      if (cancelRef.current) {
        cancelled = true;
        break;
      }

      if (quotaExceeded) break;

      const tx = transactionsToCategorize[i];
      const optionCount = tx.amount < 0 ? expenseOptions.length : incomeOptions.length;
      setBatchProgress({ current: i + 1, total: transactionsToCategorize.length });
      setBatchStatus({
        phase: 'analyzing',
        current: i + 1,
        total: transactionsToCategorize.length,
        appliedCount: successCount,
        reviewCount: errorCount,
        currentDescription: tx.description,
        suggestedCategoryName: null,
        optionCount,
        delayMs: currentDelay,
        source: null,
      });

      try {
        const automaticDecision = resolveAutomaticCategoryDecision({
          description: tx.description,
          amount: tx.amount,
          categories: availableCategories,
          memoryEntries: classificationMemory,
        });

        if (automaticDecision) {
          updateDocumentNonBlocking(doc(transactionsCollection, tx.id), { category: automaticDecision.categoryId });
          successCount++;
          setBatchStatus({
            phase: 'applying',
            current: i + 1,
            total: transactionsToCategorize.length,
            appliedCount: successCount,
            reviewCount: errorCount,
            currentDescription: tx.description,
            suggestedCategoryName: getCategoryDisplayName(automaticDecision.categoryId),
            optionCount,
            delayMs: currentDelay,
            source: automaticDecision.source === 'ai' ? 'ai' : 'rules',
          });
          continue;
        }

        const result = await callCategorizationAPI({
          orgId: organizationId,
          idToken,
          description: tx.description,
          amount: tx.amount,
          expenseOptions,
          incomeOptions,
        });

        if (!result.ok) {
          errorCount++;

          updateDocumentNonBlocking(doc(transactionsCollection, tx.id), { category: null });
          setBatchStatus({
            phase: 'applying',
            current: i + 1,
            total: transactionsToCategorize.length,
            appliedCount: successCount,
            reviewCount: errorCount,
            currentDescription: tx.description,
            suggestedCategoryName: language === 'ca' ? 'sense categoria' : 'sin categoría',
            optionCount,
            delayMs: currentDelay,
            source: 'ai',
          });

          if (result.code === 'QUOTA_EXCEEDED') {
            quotaExceeded = true;
            onQuotaExceeded?.();
            break;
          }

          if (result.code === 'RATE_LIMITED' || result.code === 'TRANSIENT') {
            currentDelay = Math.min(currentDelay * BACKOFF_MULTIPLIER, MAX_DELAY_MS);
          }

          continue;
        }

        const categoryToSave = result.categoryId ?? null;
        updateDocumentNonBlocking(doc(transactionsCollection, tx.id), { category: categoryToSave });
        successCount++;
        setBatchStatus({
          phase: 'applying',
          current: i + 1,
          total: transactionsToCategorize.length,
          appliedCount: successCount,
          reviewCount: errorCount,
          currentDescription: tx.description,
          suggestedCategoryName: categoryToSave
            ? getCategoryDisplayName(categoryToSave)
            : (language === 'ca' ? 'sense categoria' : 'sin categoría'),
          optionCount,
          delayMs: currentDelay,
          source: 'ai',
        });
      } catch (error: unknown) {
        console.error('Error categorizing transaction:', error);
        errorCount++;

        updateDocumentNonBlocking(doc(transactionsCollection, tx.id), { category: null });
        setBatchStatus({
          phase: 'applying',
          current: i + 1,
          total: transactionsToCategorize.length,
          appliedCount: successCount,
          reviewCount: errorCount,
          currentDescription: tx.description,
          suggestedCategoryName: language === 'ca' ? 'sense categoria' : 'sin categoría',
          optionCount,
          delayMs: currentDelay,
          source: 'ai',
        });

        currentDelay = Math.min(currentDelay * BACKOFF_MULTIPLIER, MAX_DELAY_MS);
      }

      // Delay entre crides (excepte l'última)
      if (i < transactionsToCategorize.length - 1 && !quotaExceeded && !cancelRef.current) {
        setBatchStatus({
          phase: 'waiting',
          current: i + 1,
          total: transactionsToCategorize.length,
          appliedCount: successCount,
          reviewCount: errorCount,
          currentDescription: null,
          suggestedCategoryName: null,
          optionCount: 0,
          delayMs: currentDelay,
          source: null,
        });
        await new Promise(resolve => setTimeout(resolve, currentDelay));
      }
    }

    const durationMs = Date.now() - startTime;
    setIsBatchCategorizing(false);
    setBatchProgress(null);
    setBatchStatus(null);

    trackUX('ai.bulk.run.done', {
      processedCount: successCount,
      errorCount,
      durationMs,
      bulkMode,
      quotaExceeded,
      cancelled,
    });

    if (cancelled) {
      toast({
        title: language === 'ca' ? 'Procés aturat' : 'Proceso detenido',
        description: language === 'ca'
          ? `${successCount} moviments processats. Els canvis aplicats fins ara es mantenen.`
          : `${successCount} movimientos procesados. Los cambios aplicados se mantienen.`,
      });
    } else if (quotaExceeded) {
      const errorMsg = getErrorMessage('QUOTA_EXCEEDED', errorLang);
      toast({
        variant: 'destructive',
        title: errorMsg.title,
        description: errorMsg.description,
      });
    } else {
      // Finalització correcta
      toast({
        title: language === 'ca' ? 'Suggeriments aplicats' : 'Sugerencias aplicadas',
        description: language === 'ca'
          ? `${successCount} categories assignades${errorCount > 0 ? `, ${errorCount} pendents de revisió` : ''}.`
          : `${successCount} categorías asignadas${errorCount > 0 ? `, ${errorCount} pendientes de revisión` : ''}.`,
      });
    }
  }, [
    transactions,
    availableCategories,
    classificationMemory,
    transactionsCollection,
    organizationId,
    user,
    expenseOptions,
    incomeOptions,
    getCategoryDisplayName,
    bulkMode,
    onQuotaExceeded,
    isBatchCategorizing,
    language,
    toast,
    t,
  ]);

  // ---------------------------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------------------------

  return {
    // Loading states
    loadingStates,
    isBatchCategorizing,
    batchProgress,
    batchStatus,

    // Actions
    handleCategorize,
    handleBatchCategorize,
    handleCancelBatch,
  };
}
