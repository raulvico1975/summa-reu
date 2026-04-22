import { collection, type Firestore } from 'firebase/firestore';

import type { ClassificationMemoryEntry } from '@/lib/data';

export const CLASSIFICATION_MEMORY_MIN_USAGE_COUNT = 2;

export function classificationMemoryCollection(firestore: Firestore, orgId: string) {
  return collection(firestore, 'organizations', orgId, 'classificationMemory');
}

export function findClassificationMemoryEntry(
  entries: ClassificationMemoryEntry[] | null | undefined,
  normalizedDescription: string
): ClassificationMemoryEntry | null {
  if (!entries || !normalizedDescription) return null;

  return entries.find((entry) => entry.normalizedDescription === normalizedDescription) ?? null;
}

export function isConfirmedClassificationMemoryEntry(
  entry: ClassificationMemoryEntry | null | undefined
): entry is ClassificationMemoryEntry {
  return Boolean(
    entry
    && entry.normalizedDescription
    && typeof entry.usageCount === 'number'
    && entry.usageCount >= CLASSIFICATION_MEMORY_MIN_USAGE_COUNT
  );
}
