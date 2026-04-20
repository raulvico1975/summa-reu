/**
 * POST /api/remittances/in/process
 *
 * Processa una remesa IN (cobraments/donacions) de forma atòmica i idempotent.
 *
 * Característiques:
 * - Només accepta remeses IN (rebutja direction/remittanceType/category inconsistents)
 * - inputHash SHA-256 server-side per idempotència
 * - Invariants BLOQUEJANTS (R-SUM-1, R-COUNT-1)
 * - Locks amb TTL 5min i heartbeat
 * - Només soft-delete (mai hard-delete)
 *
 * @see /docs/plans/noble-zooming-quilt.md per documentació completa
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import {
  getFirestore,
  Timestamp,
  FieldValue,
  type Firestore,
  type WriteBatch,
} from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import {
  computeInputHashServer,
  assertSumInvariantExact,
  assertCountInvariant,
  checkIdempotence,
  sumCents,
  toEuros,
  RemittanceInvariantError,
  type HashableItem,
} from '../../../../../lib/fiscal/remittance-invariants';
import { verifyAdminMembership } from '../../../../../lib/fiscal/remittances/admin-auth';
import { safeSet, safeUpdate, SafeWriteValidationError } from '../../../../../lib/safe-write';

// =============================================================================
// CONSTANTS
// =============================================================================

/** TTL del lock en segons (5 minuts) */
const LOCK_TTL_SECONDS = 300;

/** Grandària dels batches per evitar límits de Firestore */
const BATCH_SIZE = 50;

/** Interval per renovar el heartbeat del lock (en ms) */
const HEARTBEAT_INTERVAL_MS = 60_000;

// =============================================================================
// FIREBASE ADMIN INITIALIZATION
// =============================================================================

let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;

function getAdminDb(): Firestore {
  if (cachedDb) return cachedDb;

  if (getApps().length === 0) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      throw new Error('Firebase config incompleta per Admin SDK');
    }

    initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }

  cachedDb = getFirestore();
  return cachedDb;
}

function getAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  getAdminDb();
  cachedAuth = getAuth();
  return cachedAuth;
}

// =============================================================================
// AUTENTICACIÓ
// =============================================================================

interface AuthResult {
  uid: string;
  email?: string;
}

async function verifyIdToken(request: NextRequest): Promise<AuthResult | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const idToken = authHeader.substring(7);
  if (!idToken) {
    return null;
  }

  try {
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
  } catch (error) {
    console.error('[remittances/in/process] Error verificant token:', error);
    return null;
  }
}

// =============================================================================
// TIPUS
// =============================================================================

/** Motiu pel qual un item està pendent */
type RemittancePendingReason =
  | 'NO_TAXID'
  | 'INVALID_DATA'
  | 'NO_MATCH'
  | 'DUPLICATE'
  | 'NO_IBAN_MATCH'
  | 'AMBIGUOUS_IBAN';

interface ProcessRemittanceItem {
  contactId: string;
  amountCents: number;
  iban?: string | null;
  name?: string;
  taxId?: string | null;
  sourceRowIndex: number;
}

interface ProcessRemittancePendingItem {
  nameRaw: string;
  taxId: string | null;
  iban: string | null;
  amountCents: number;
  reason: RemittancePendingReason;
  sourceRowIndex: number;
  ambiguousDonorIds?: string[];
}

interface ProcessRemittanceRequest {
  orgId: string;
  parentTxId: string;
  items: ProcessRemittanceItem[];
  pendingItems?: ProcessRemittancePendingItem[];
  category?: string | null;
  bankAccountId?: string | null;
}

interface ProcessRemittanceResponse {
  success: boolean;
  idempotent: boolean;
  remittanceId?: string;
  createdCount?: number;
  pendingCount?: number;
  error?: string;
  code?: string;
}

// =============================================================================
// LOCK AMB HEARTBEAT
// =============================================================================

interface LockState {
  lockRef: FirebaseFirestore.DocumentReference;
  operationId: string;
  heartbeatInterval: NodeJS.Timeout | null;
}

async function acquireLockWithHeartbeat(
  db: Firestore,
  orgId: string,
  parentTxId: string,
  uid: string
): Promise<LockState | { error: string; code: string }> {
  const lockRef = db.doc(`organizations/${orgId}/processLocks/${parentTxId}`);
  const operationId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  try {
    const acquired = await db.runTransaction(async (transaction) => {
      const lockDoc = await transaction.get(lockRef);
      const now = Timestamp.now();

      if (lockDoc.exists) {
        const lockData = lockDoc.data();
        // Comprovar si el lock NO ha expirat
        if (lockData?.expiresAt && lockData.expiresAt.toMillis() > now.toMillis()) {
          return {
            ok: false as const,
            lockedByUid: lockData.lockedByUid,
          };
        }
      }

      // Crear lock amb TTL de 5 minuts
      const expiresAt = Timestamp.fromMillis(now.toMillis() + LOCK_TTL_SECONDS * 1000);
      transaction.set(lockRef, {
        lockedAt: now,
        expiresAt,
        lockedByUid: uid,
        operation: 'remittanceSplit',
        operationId,
      });

      return { ok: true as const };
    });

    if (!acquired.ok) {
      return {
        error: `Operació bloquejada per un altre usuari (${acquired.lockedByUid})`,
        code: 'LOCKED_BY_OTHER',
      };
    }

    // Iniciar heartbeat per renovar el lock cada minut
    const heartbeatInterval = setInterval(async () => {
      try {
        const newExpiry = Timestamp.fromMillis(Date.now() + LOCK_TTL_SECONDS * 1000);
        await lockRef.update({ expiresAt: newExpiry });
      } catch (e) {
        console.warn('[remittances/in/process] Heartbeat failed:', e);
      }
    }, HEARTBEAT_INTERVAL_MS);

    return { lockRef, operationId, heartbeatInterval };
  } catch (error) {
    console.error('[remittances/in/process] Error acquiring lock:', error);
    return { error: 'Error adquirint lock', code: 'LOCK_ERROR' };
  }
}

async function releaseLock(lockState: LockState): Promise<void> {
  if (lockState.heartbeatInterval) {
    clearInterval(lockState.heartbeatInterval);
  }
  try {
    await lockState.lockRef.delete();
  } catch (error) {
    console.warn('[remittances/in/process] Error releasing lock:', error);
  }
}

// =============================================================================
// VALIDACIÓ
// =============================================================================

function validateRequest(body: unknown): {
  valid: true;
  data: ProcessRemittanceRequest;
} | { valid: false; error: string; code: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Body invàlid', code: 'INVALID_BODY' };
  }

  const req = body as Record<string, unknown>;

  // orgId obligatori
  if (typeof req.orgId !== 'string' || !req.orgId.trim()) {
    return { valid: false, error: 'orgId obligatori', code: 'MISSING_ORG_ID' };
  }

  // parentTxId obligatori
  if (typeof req.parentTxId !== 'string' || !req.parentTxId.trim()) {
    return { valid: false, error: 'parentTxId obligatori', code: 'MISSING_PARENT_TX_ID' };
  }

  // items obligatori i no buit
  if (!Array.isArray(req.items) || req.items.length === 0) {
    return { valid: false, error: 'items obligatori i no pot ser buit', code: 'MISSING_ITEMS' };
  }

  // Validar cada item
  for (let i = 0; i < req.items.length; i++) {
    const item = req.items[i] as Record<string, unknown>;

    if (typeof item.contactId !== 'string' || !item.contactId.trim()) {
      return {
        valid: false,
        error: `items[${i}].contactId obligatori`,
        code: 'INVALID_ITEM_CONTACT_ID',
      };
    }

    if (typeof item.amountCents !== 'number' || item.amountCents <= 0) {
      return {
        valid: false,
        error: `items[${i}].amountCents ha de ser > 0`,
        code: 'INVALID_ITEM_AMOUNT',
      };
    }

    if (typeof item.sourceRowIndex !== 'number') {
      return {
        valid: false,
        error: `items[${i}].sourceRowIndex obligatori`,
        code: 'MISSING_SOURCE_ROW_INDEX',
      };
    }
  }

  // Validar pendingItems si existeix
  const pendingItems = req.pendingItems as ProcessRemittancePendingItem[] | undefined;
  if (pendingItems && Array.isArray(pendingItems)) {
    for (let i = 0; i < pendingItems.length; i++) {
      const pending = pendingItems[i] as unknown as Record<string, unknown>;

      if (typeof pending.amountCents !== 'number' || pending.amountCents <= 0) {
        return {
          valid: false,
          error: `pendingItems[${i}].amountCents ha de ser > 0`,
          code: 'INVALID_PENDING_AMOUNT',
        };
      }

      if (typeof pending.sourceRowIndex !== 'number') {
        return {
          valid: false,
          error: `pendingItems[${i}].sourceRowIndex obligatori`,
          code: 'MISSING_PENDING_SOURCE_ROW_INDEX',
        };
      }
    }
  }

  return {
    valid: true,
    data: {
      orgId: req.orgId as string,
      parentTxId: req.parentTxId as string,
      items: req.items as ProcessRemittanceItem[],
      pendingItems: pendingItems,
      category: typeof req.category === 'string' ? req.category : null,
      bankAccountId: typeof req.bankAccountId === 'string' ? req.bankAccountId : null,
    },
  };
}

// =============================================================================
// SOFT-DELETE PER ROLLBACK
// =============================================================================

async function rollbackChildren(
  db: Firestore,
  orgId: string,
  childIds: string[],
  uid: string
): Promise<void> {
  const now = new Date().toISOString();

  for (let i = 0; i < childIds.length; i += BATCH_SIZE) {
    const chunk = childIds.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const childId of chunk) {
      const childRef = db.doc(`organizations/${orgId}/transactions/${childId}`);
      await safeUpdate({
        data: {
          archivedAt: now,
          archivedByUid: uid,
          archivedReason: 'rollback_invariant_failure',
          archivedFromAction: 'process_rollback',
        },
        context: {
          updatedBy: uid,
          source: 'user',
          updatedAtFactory: () => FieldValue.serverTimestamp(),
        },
        write: (payload) => {
          batch.update(childRef, payload);
        },
      });
    }

    await batch.commit();
  }
}

// =============================================================================
// POST HANDLER
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<ProcessRemittanceResponse>> {
  let lockState: LockState | null = null;
  const createdChildIds: string[] = [];

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // 1. Verificar autenticació
    // ─────────────────────────────────────────────────────────────────────────
    const authResult = await verifyIdToken(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, idempotent: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Validar request body
    // ─────────────────────────────────────────────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, idempotent: false, error: 'JSON invàlid', code: 'INVALID_JSON' },
        { status: 400 }
      );
    }

    const validation = validateRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, idempotent: false, error: validation.error, code: validation.code },
        { status: 400 }
      );
    }

    const { data } = validation;
    const { orgId, parentTxId, items, pendingItems, category, bankAccountId } = data;

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Verificar que l'usuari és admin de l'org
    // ─────────────────────────────────────────────────────────────────────────
    const db = getAdminDb();
    const membership = await verifyAdminMembership(request, orgId);
    if (!membership.success) {
      return NextResponse.json(
        {
          success: false,
          idempotent: false,
          error:
            membership.code === 'NOT_ADMIN'
              ? 'Només els admins poden processar remeses'
              : membership.error,
          code: membership.code,
        },
        { status: membership.status }
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Llegir transacció pare
    // ─────────────────────────────────────────────────────────────────────────
    const parentRef = db.doc(`organizations/${orgId}/transactions/${parentTxId}`);
    const parentSnap = await parentRef.get();

    if (!parentSnap.exists) {
      return NextResponse.json(
        {
          success: false,
          idempotent: false,
          error: 'Transacció pare no trobada',
          code: 'PARENT_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    const parentData = parentSnap.data();
    if (!parentData) {
      return NextResponse.json(
        { success: false, idempotent: false, error: 'Dades del pare buides', code: 'PARENT_EMPTY' },
        { status: 500 }
      );
    }

    // Verificar que és un ingrés (amount > 0)
    if (typeof parentData.amount !== 'number' || parentData.amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          idempotent: false,
          error: 'La transacció pare ha de ser un ingrés (amount > 0)',
          code: 'PARENT_NOT_INCOME',
        },
        { status: 400 }
      );
    }

    const parentAmountCents = Math.round(parentData.amount * 100);
    const parentBankAccountId =
      typeof parentData.bankAccountId === 'string' && parentData.bankAccountId.trim()
        ? parentData.bankAccountId
        : null;

    // ─────────────────────────────────────────────────────────────────────────
    // 4b. GUARDRAIL: Rebutjar si ja és remesa processada
    // ─────────────────────────────────────────────────────────────────────────
    // No es permet reprocessar directament. El flux és: Desfer → Processar.
    // Això aplica tant a IN com a OUT per evitar duplicats fiscals.
    if (parentData.isRemittance === true) {
      return NextResponse.json(
        {
          success: false,
          idempotent: false,
          error: 'Remesa ja processada. Cal desfer abans de tornar a processar.',
          code: 'REMITTANCE_ALREADY_PROCESSED',
        },
        { status: 409 }
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4c. GUARDRAIL: La remesa guardada ha de correspondre al mateix compte
    // ─────────────────────────────────────────────────────────────────────────
    if (bankAccountId && !parentBankAccountId) {
      return NextResponse.json(
        {
          success: false,
          idempotent: false,
          error: 'No es pot verificar el compte bancari del moviment bancari.',
          code: 'BANK_ACCOUNT_NOT_VERIFIABLE',
        },
        { status: 400 }
      );
    }

    if (bankAccountId && parentBankAccountId && bankAccountId !== parentBankAccountId) {
      return NextResponse.json(
        {
          success: false,
          idempotent: false,
          error: 'El compte bancari de la remesa guardada no coincideix amb el moviment bancari.',
          code: 'BANK_ACCOUNT_MISMATCH',
        },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Computar inputHash (SHA-256 server-side)
    // ─────────────────────────────────────────────────────────────────────────
    const hashableItems: HashableItem[] = items.map((item) => ({
      contactId: item.contactId,
      amountCents: item.amountCents,
      iban: item.iban,
      taxId: item.taxId,
      sourceRowIndex: item.sourceRowIndex,
    }));

    const inputHash = computeInputHashServer(parentTxId, hashableItems);

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Comprovar idempotència
    // ─────────────────────────────────────────────────────────────────────────
    // Buscar si ja existeix un doc de remesa per aquest pare
    const existingRemittanceId = parentData.remittanceId as string | undefined;

    if (existingRemittanceId) {
      const existingRemittanceRef = db.doc(`organizations/${orgId}/remittances/${existingRemittanceId}`);
      const existingRemittanceSnap = await existingRemittanceRef.get();

      if (existingRemittanceSnap.exists) {
        const existingData = existingRemittanceSnap.data();
        const idempResult = checkIdempotence(
          existingData?.inputHash as string | undefined,
          inputHash,
          existingData?.status as string | undefined
        );

        if (!idempResult.shouldProcess) {
          console.log(
            `[remittances/in/process] Idempotent: ${idempResult.reason} (remittanceId: ${existingRemittanceId})`
          );
          return NextResponse.json({
            success: true,
            idempotent: true,
            remittanceId: existingRemittanceId,
            createdCount: existingData?.resolvedCount ?? 0,
            pendingCount: existingData?.pendingCount ?? 0,
          });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Adquirir lock amb heartbeat (TTL 5 min)
    // ─────────────────────────────────────────────────────────────────────────
    const lockResult = await acquireLockWithHeartbeat(db, orgId, parentTxId, authResult.uid);

    if ('error' in lockResult) {
      return NextResponse.json(
        {
          success: false,
          idempotent: false,
          error: lockResult.error,
          code: lockResult.code,
        },
        { status: 409 }
      );
    }

    lockState = lockResult;
    const writeContextBase = {
      updatedBy: authResult.uid,
      source: 'user' as const,
      updatedAtFactory: () => FieldValue.serverTimestamp(),
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Pre-validar R-SUM-1 (BLOQUEJANT)
    // ─────────────────────────────────────────────────────────────────────────
    const itemsSumCents = sumCents(items);
    const pendingSumCents = pendingItems ? sumCents(pendingItems) : 0;
    const totalSumCents = itemsSumCents + pendingSumCents;

    try {
      // Remeses IN: tolerància 0 (quadrament exacte)
      assertSumInvariantExact(parentAmountCents, totalSumCents);
    } catch (error) {
      if (error instanceof RemittanceInvariantError) {
        console.error(`[remittances/in/process] R-SUM-1 failed:`, error.details);
        return NextResponse.json(
          {
            success: false,
            idempotent: false,
            error: error.message,
            code: error.code,
          },
          { status: 400 }
        );
      }
      throw error;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 9. Crear filles en batches (amb heartbeat automàtic)
    // ─────────────────────────────────────────────────────────────────────────
    const now = new Date().toISOString();
    const remittanceId = db.collection(`organizations/${orgId}/remittances`).doc().id;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);
      const batch: WriteBatch = db.batch();

      for (const item of chunk) {
        const childRef = db.collection(`organizations/${orgId}/transactions`).doc();
        const childId = childRef.id;
        createdChildIds.push(childId);

        const childDoc = {
          // Identificació
          id: childId,

          // Dades de la transacció
          date: parentData.date,
          description: parentData.description,
          amount: toEuros(item.amountCents),
          transactionType: 'donation' as const,
          category: category || parentData.category || null,
          document: null,

          // Contacte
          contactId: item.contactId,
          contactType: 'donor' as const,

          // Remesa
          isRemittanceItem: true,
          parentTransactionId: parentTxId,
          remittanceId,
          source: 'remittance' as const,

          // Multicompte
          bankAccountId: bankAccountId || parentData.bankAccountId || null,

          // Metadata
          createdAt: now,
          createdByUid: authResult.uid,

          // Soft-delete (null = activa)
          archivedAt: null,
        };

        await safeSet({
          data: childDoc,
          context: {
            ...writeContextBase,
            requiredFields: ['id', 'date', 'description', 'amount', 'parentTransactionId', 'source'],
            amountFields: ['amount'],
          },
          write: (payload) => {
            batch.set(childRef, payload);
          },
        });
      }

      await batch.commit();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 10. Crear pendingItems a subcol·lecció
    // ─────────────────────────────────────────────────────────────────────────
    if (pendingItems && pendingItems.length > 0) {
      for (let i = 0; i < pendingItems.length; i += BATCH_SIZE) {
        const chunk = pendingItems.slice(i, i + BATCH_SIZE);
        const batch = db.batch();

        for (const pending of chunk) {
          const pendingRef = db.collection(`organizations/${orgId}/remittances/${remittanceId}/pending`).doc();
          await safeSet({
            data: {
              id: pendingRef.id,
              nameRaw: pending.nameRaw,
              taxId: pending.taxId ?? null,
              iban: pending.iban ?? null,
              amountCents: pending.amountCents,
              reason: pending.reason,
              sourceRowIndex: pending.sourceRowIndex,
              ambiguousDonorIds: pending.ambiguousDonorIds || [],
              createdAt: now,
            },
            context: {
              ...writeContextBase,
              requiredFields: ['id', 'amountCents', 'reason', 'sourceRowIndex'],
              amountFields: ['amountCents'],
            },
            write: (payload) => {
              batch.set(pendingRef, payload);
            },
          });
        }

        await batch.commit();
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 11. Crear document de remesa
    // ─────────────────────────────────────────────────────────────────────────
    const pendingCount = pendingItems?.length ?? 0;
    const status = pendingCount === 0 ? 'complete' : 'partial';

    const remittanceDoc = {
      id: remittanceId,
      direction: 'in',
      type: 'donations',

      // Parent
      parentTransactionId: parentTxId,

      // Children
      transactionIds: createdChildIds,

      // Comptadors
      itemCount: items.length + pendingCount,
      resolvedCount: items.length,
      pendingCount: pendingCount,

      // Imports en cèntims
      expectedTotalCents: totalSumCents,
      resolvedTotalCents: itemsSumCents,
      pendingTotalCents: pendingSumCents,

      // Hash i estat
      inputHash,
      status,

      // Audit
      createdAt: now,
      createdBy: authResult.uid,
      bankAccountId: bankAccountId || parentData.bankAccountId || null,
    };

    await safeSet({
      data: remittanceDoc,
      context: {
        ...writeContextBase,
        requiredFields: ['id', 'direction', 'type', 'parentTransactionId', 'status', 'inputHash'],
      },
      write: async (payload) => {
        await db.doc(`organizations/${orgId}/remittances/${remittanceId}`).set(payload);
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 12. Actualitzar transacció pare
    // ─────────────────────────────────────────────────────────────────────────
    await safeUpdate({
      data: {
        isRemittance: true,
        remittanceId,
        remittanceType: 'donations',
        remittanceDirection: 'IN',
        remittanceStatus: status,
        remittanceItemCount: items.length + pendingCount,
        remittanceResolvedCount: items.length,
        remittancePendingCount: pendingCount,
        remittanceExpectedTotalCents: totalSumCents,
        remittanceResolvedTotalCents: itemsSumCents,
        remittancePendingTotalCents: pendingSumCents,
      },
      context: writeContextBase,
      write: async (payload) => {
        await parentRef.update(payload);
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 13. Post-validar R-COUNT-1 (BLOQUEJANT amb rollback si falla)
    // ─────────────────────────────────────────────────────────────────────────
    try {
      assertCountInvariant(createdChildIds, items.length);
    } catch (error) {
      // ROLLBACK: soft-delete de les filles creades
      console.error('[remittances/in/process] R-COUNT-1 failed, rolling back...');
      await rollbackChildren(db, orgId, createdChildIds, authResult.uid);

      // Reset pare
      await safeUpdate({
        data: {
          isRemittance: FieldValue.delete(),
          remittanceId: FieldValue.delete(),
          remittanceType: FieldValue.delete(),
          remittanceDirection: FieldValue.delete(),
          remittanceStatus: FieldValue.delete(),
          remittanceItemCount: FieldValue.delete(),
          remittanceResolvedCount: FieldValue.delete(),
          remittancePendingCount: FieldValue.delete(),
          remittanceExpectedTotalCents: FieldValue.delete(),
          remittanceResolvedTotalCents: FieldValue.delete(),
          remittancePendingTotalCents: FieldValue.delete(),
        },
        context: writeContextBase,
        write: async (payload) => {
          await parentRef.update(payload);
        },
      });

      // Eliminar doc remesa
      await db.doc(`organizations/${orgId}/remittances/${remittanceId}`).delete();

      if (error instanceof RemittanceInvariantError) {
        return NextResponse.json(
          {
            success: false,
            idempotent: false,
            error: error.message,
            code: error.code,
          },
          { status: 500 }
        );
      }
      throw error;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 14. Tot OK - alliberar lock
    // ─────────────────────────────────────────────────────────────────────────
    console.log(
      `[remittances/in/process] Success: remittanceId=${remittanceId}, ` +
        `created=${items.length}, pending=${pendingCount}`
    );

    return NextResponse.json({
      success: true,
      idempotent: false,
      remittanceId,
      createdCount: items.length,
      pendingCount,
    });
  } catch (error) {
    if (error instanceof SafeWriteValidationError) {
      return NextResponse.json(
        {
          success: false,
          idempotent: false,
          error: error.message,
          code: error.code,
        },
        { status: 400 }
      );
    }

    console.error('[remittances/in/process] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        idempotent: false,
        error: 'Error intern del servidor',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  } finally {
    // Sempre alliberar el lock
    if (lockState) {
      await releaseLock(lockState);
    }
  }
}
