// src/lib/firestore-utils.ts
// Utilitats per treballar amb Firestore de forma segura

import { stripUndefinedDeep as stripUndefinedDeepValue } from '@/lib/strip-undefined-deep';

/**
 * Elimina propietats amb valor `undefined` d'un objecte.
 * Firestore no accepta `undefined` com a valor - causa errors silenciosos.
 *
 * Usar sempre abans d'escriure a Firestore:
 * - setDoc(docRef, stripUndefined(data))
 * - updateDoc(docRef, stripUndefined(updates))
 *
 * Per valors opcionals, usar `?? null` explícitament:
 * - { field: value ?? null }
 */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  ) as T;
}

/**
 * Versió profunda de stripUndefined per objectes niuats.
 * Recorre recursivament i elimina propietats undefined a tots els nivells.
 *
 * Els objectes no plans (Timestamp, FieldValue, Date, etc.) es conserven.
 * Les entrades undefined dels arrays es compacten abans d'escriure.
 */
export function stripUndefinedDeep<T>(obj: T): T {
  return stripUndefinedDeepValue(obj);
}
