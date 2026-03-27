// src/hooks/use-product-updates.ts
// Hook per carregar novetats de Firestore amb fallback a legacy

'use client';

import * as React from 'react';
import { collection, query, where, orderBy, limit, getDocs, Firestore } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { type ProductUpdate, PRODUCT_UPDATES } from '@/lib/notifications';
import { isDemoEnv } from '@/lib/demo/isDemoOrg';
import type { Language } from '@/i18n';
import { resolveAppProductUpdateCopy } from '@/lib/product-updates/localized';

/**
 * Tipus ampliat per incloure camps nous de Firestore.
 */
export type FirestoreProductUpdate = ProductUpdate & {
  // Camps nous del schema ampliat
  contentLong?: string | null;
  guideUrl?: string | null;
  videoUrl?: string | null;
};

export type UseProductUpdatesResult = {
  updates: FirestoreProductUpdate[];
  isLoading: boolean;
  error: Error | null;
  usingFallback: boolean;
};

type RawProductUpdateEntry = {
  id: string;
  data: unknown;
};

function toFirestoreProductUpdate(
  entry: RawProductUpdateEntry,
  language: Language
): FirestoreProductUpdate | null {
  const source = entry.data as Record<string, unknown>;
  const resolvedCopy = resolveAppProductUpdateCopy(source, language);
  if (!resolvedCopy) return null;

  const createdAtRaw = source?.createdAt;
  const createdAt =
    typeof createdAtRaw === 'object' &&
    createdAtRaw !== null &&
    'toDate' in createdAtRaw &&
    typeof (createdAtRaw as { toDate?: () => Date }).toDate === 'function'
      ? (createdAtRaw as { toDate: () => Date }).toDate().toISOString().slice(0, 10)
      : typeof source?.createdAt === 'string'
        ? source.createdAt.slice(0, 10)
        : '';

  const link = typeof source?.link === 'string' && source.link.trim()
    ? source.link
    : undefined;
  const guideUrl = typeof source?.guideUrl === 'string' && source.guideUrl.trim()
    ? source.guideUrl
    : null;
  const videoUrl = typeof source?.videoUrl === 'string' && source.videoUrl.trim()
    ? source.videoUrl
    : null;

  return {
    id: entry.id,
    title: resolvedCopy.title,
    body: resolvedCopy.body,
    href: link,
    ctaLabel: resolvedCopy.ctaLabel ?? undefined,
    createdAt,
    contentLong: resolvedCopy.contentLong,
    guideUrl,
    videoUrl,
  };
}

/**
 * Hook per carregar novetats del producte.
 *
 * Query: productUpdates on isActive==true, orderBy createdAt desc, limit 6
 * Si Firestore falla → fallback a PRODUCT_UPDATES legacy + console.warn
 *
 * NOTA: Ordenem per createdAt (no publishedAt) perquè:
 * - createdAt sempre està resolt com a Timestamp real després del setDoc
 * - publishedAt pot quedar pendent fins que Firestore resol serverTimestamp()
 * - Per timeline futur, es pot migrar a publishedAt quan sigui Timestamp garantit
 */
export function useProductUpdates(language: Language): UseProductUpdatesResult {
  const { firestore } = useFirebase();
  const fallbackEntries = React.useMemo<RawProductUpdateEntry[]>(
    () => PRODUCT_UPDATES.map((update) => ({ id: update.id, data: update })),
    []
  );
  const [rawUpdates, setRawUpdates] = React.useState<RawProductUpdateEntry[]>(
    fallbackEntries
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [usingFallback, setUsingFallback] = React.useState(false);

  const updates = React.useMemo(
    () => rawUpdates
      .map((entry) => toFirestoreProductUpdate(entry, language))
      .filter((entry): entry is FirestoreProductUpdate => entry !== null),
    [rawUpdates, language]
  );

  React.useEffect(() => {
    if (!firestore) {
      setIsLoading(false);
      setUsingFallback(true);
      setRawUpdates(fallbackEntries);
      return;
    }

    async function fetchUpdates() {
      try {
        const q = query(
          collection(firestore as Firestore, 'productUpdates'),
          where('isActive', '==', true),
          orderBy('createdAt', 'desc'),
          limit(6)
        );
        const snapshot = await getDocs(q);
        const firestoreUpdates: RawProductUpdateEntry[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          data: doc.data(),
        }));

        if (firestoreUpdates.length > 0) {
          setRawUpdates(firestoreUpdates);
          setUsingFallback(false);
        } else {
          // Firestore buit → usar fallback
          setRawUpdates(fallbackEntries);
          setUsingFallback(true);
        }
      } catch (err: unknown) {
        const errorCode = (err as { code?: string })?.code ?? 'unknown';
        const errorMessage = (err as { message?: string })?.message ?? String(err);
        // Log detallat per diagnòstic
        console.warn(
          '[product-updates] Firestore query failed, using legacy fallback',
          { code: errorCode, message: errorMessage }
        );
        // Si és FAILED_PRECONDITION, probablement falta l'índex
        if (errorCode === 'failed-precondition' && !isDemoEnv()) {
          console.error(
            '[product-updates] Index missing! Run: firebase deploy --only firestore:indexes'
          );
        }
        setError(err instanceof Error ? err : new Error(String(err)));
        setRawUpdates(fallbackEntries);
        setUsingFallback(true);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUpdates();
  }, [fallbackEntries, firestore]);

  return { updates, isLoading, error, usingFallback };
}
